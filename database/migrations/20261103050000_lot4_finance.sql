-- LOT 4 — Caisse, encaissements et finances.
--
-- Principes :
--   * une caisse (cash_register) par succursale, une seule session ouverte à la fois ;
--   * les encaissements déjà modélisés dans `bc_payment_entries` (lot 2) sont
--     conservés : journal append-only, opérations compensatoires, idempotence ;
--   * la session de caisse n'est qu'un REGROUPEMENT : le solde attendu est
--     recalculé depuis le journal, jamais depuis un compteur frontend ;
--   * aucune opération financière n'est modifiable ou supprimable : seules des
--     écritures compensatoires sont autorisées ;
--   * un paiement électronique reste `pending` tant qu'aucune preuve n'existe.

-- ============================================================================
-- 4.1 Caisses et sessions
-- ============================================================================
create table public.bc_cash_registers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  branch_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (salon_id, branch_id) references public.bc_branches(salon_id, id) on delete cascade
);
create unique index bc_cash_registers_unique_name on public.bc_cash_registers (salon_id, branch_id, lower(name));

create table public.bc_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  branch_id uuid not null,
  cash_register_id uuid not null references public.bc_cash_registers(id),
  opened_by uuid not null references public.bc_users(id),
  opened_at timestamptz not null default now(),
  opening_balance bigint not null default 0,
  closed_by uuid references public.bc_users(id),
  closed_at timestamptz,
  closing_balance bigint,
  expected_balance bigint,
  difference bigint,
  status text not null default 'open' check (status in ('open', 'closed', 'reconciled')),
  notes text not null default '',
  foreign key (salon_id, branch_id) references public.bc_branches(salon_id, id)
);
-- Une seule session ouverte par caisse (garantie par la base, pas par l'UI).
create unique index bc_cash_sessions_one_open on public.bc_cash_sessions (cash_register_id)
  where status = 'open';
create index bc_cash_sessions_scope_idx on public.bc_cash_sessions (salon_id, branch_id, opened_at desc);

-- ============================================================================
-- 4.2 Encaissements : rattachement à une caisse et méthodes réelles
-- ============================================================================
alter table public.bc_payment_entries
  add column cash_register_id uuid references public.bc_cash_registers(id),
  add column cash_session_id uuid references public.bc_cash_sessions(id),
  add column provider_reference text,
  -- Un encaissement électronique peut rester en attente : jamais « confirmé »
  -- à partir d'une action frontend.
  add column payment_status text not null default 'confirmed'
    check (payment_status in ('pending', 'confirmed', 'failed'));
create index bc_payment_entries_session_idx on public.bc_payment_entries (cash_session_id);

-- Le journal est immuable : aucune modification, aucune suppression.
create function barber_private.forbid_financial_tampering()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.payment_status = 'pending' and new.payment_status = 'confirmed' then
    return new;
  end if;
  raise exception 'Financial entries are immutable' using errcode = '42501';
end $$;
revoke all on function barber_private.forbid_financial_tampering() from public;

create trigger bc_payment_entries_immutable
  before update or delete on public.bc_payment_entries
  for each row execute function barber_private.forbid_financial_tampering();

-- ============================================================================
-- 4.5 Dépenses : succursale, responsable, justificatif
-- ============================================================================
alter table public.bc_expenses
  add column branch_id uuid references public.bc_branches(id),
  add column created_by uuid references public.bc_users(id),
  add column receipt_ref text,
  add column updated_at timestamptz not null default now();
create index bc_expenses_branch_idx on public.bc_expenses (salon_id, branch_id, spent_on desc);

-- ============================================================================
-- Droits
-- ============================================================================
alter table public.bc_cash_registers enable row level security;
alter table public.bc_cash_sessions enable row level security;
revoke all on public.bc_cash_registers, public.bc_cash_sessions from public, bc_app;
grant select on public.bc_cash_registers, public.bc_cash_sessions to bc_app;

create policy bc_cash_registers_read on public.bc_cash_registers for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'cash.open'));
create policy bc_cash_sessions_read on public.bc_cash_sessions for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'cash.open'));

grant update (payment_status, provider_reference) on public.bc_payment_entries to bc_app;

-- ============================================================================
-- 4.1 Ouverture / clôture / rapprochement
-- ============================================================================
create or replace function public.bc_open_cash_session(p_salon uuid, p_branch uuid, p_register uuid, p_balance bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'cash.open') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_balance is null or p_balance < 0 then raise exception 'Invalid opening balance' using errcode = '22023'; end if;
  if not exists (select 1 from public.bc_cash_registers r
                  where r.id = p_register and r.salon_id = p_salon and r.branch_id = p_branch and r.is_active) then
    raise exception 'Unknown cash register' using errcode = '22023';
  end if;
  begin
    insert into public.bc_cash_sessions(salon_id, branch_id, cash_register_id, opened_by, opening_balance)
    values (p_salon, p_branch, p_register, barber_private.current_user_id(), p_balance)
    returning id into v_id;
  exception when unique_violation then
    -- Deux ouvertures simultanées : la contrainte partielle tranche.
    raise exception 'Register already open' using errcode = '22023';
  end;
  insert into public.bc_admin_audit(salon_id, actor_id, action, metadata)
  values (p_salon, barber_private.current_user_id(), 'cash.open',
          jsonb_build_object('register', p_register, 'balance', p_balance));
  return v_id;
end $$;
revoke all on function public.bc_open_cash_session(uuid, uuid, uuid, bigint) from public;
grant execute on function public.bc_open_cash_session(uuid, uuid, uuid, bigint) to bc_app;

-- Solde attendu = fond de caisse + espèces encaissées − espèces remboursées.
create or replace function barber_private.cash_expected_balance(p_session uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select s.opening_balance + coalesce((
    select sum(case when e.kind in ('payment', 'refund_reversal') then e.amount else -e.amount end)
      from public.bc_payment_entries e
     where e.cash_session_id = s.id
       and e.payment_status = 'confirmed'
       and e.method = 'cash'
  ), 0)
  from public.bc_cash_sessions s where s.id = p_session
$$;
revoke all on function barber_private.cash_expected_balance(uuid) from public;
grant execute on function barber_private.cash_expected_balance(uuid) to bc_app;

create or replace function public.bc_close_cash_session(p_session uuid, p_counted bigint, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.bc_cash_sessions%rowtype; v_expected bigint;
begin
  select * into s from public.bc_cash_sessions where id = p_session for update;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
  if not barber_private.has_salon_permission(s.salon_id, 'cash.close') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if s.status <> 'open' then raise exception 'Session already closed' using errcode = '22023'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Invalid counted amount' using errcode = '22023'; end if;
  v_expected := barber_private.cash_expected_balance(p_session);
  update public.bc_cash_sessions set
    status = 'closed', closed_by = barber_private.current_user_id(), closed_at = now(),
    closing_balance = p_counted, expected_balance = v_expected, difference = p_counted - v_expected,
    notes = coalesce(btrim(p_notes), '')
  where id = p_session;
  insert into public.bc_admin_audit(salon_id, actor_id, action, metadata)
  values (s.salon_id, barber_private.current_user_id(), 'cash.close',
          jsonb_build_object('session', p_session, 'expected', v_expected, 'counted', p_counted));
end $$;
revoke all on function public.bc_close_cash_session(uuid, bigint, text) from public;
grant execute on function public.bc_close_cash_session(uuid, bigint, text) to bc_app;

-- Le rapprochement est réservé au propriétaire (acte de contrôle).
create or replace function public.bc_reconcile_cash_session(p_session uuid, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.bc_cash_sessions%rowtype;
begin
  select * into s from public.bc_cash_sessions where id = p_session for update;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
  if not barber_private.has_salon_permission(s.salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if s.status <> 'closed' then raise exception 'Session must be closed first' using errcode = '22023'; end if;
  update public.bc_cash_sessions set status = 'reconciled',
    notes = concat_ws(' | ', nullif(s.notes, ''), nullif(btrim(coalesce(p_notes, '')), ''))
  where id = p_session;
  insert into public.bc_admin_audit(salon_id, actor_id, action, metadata)
  values (s.salon_id, barber_private.current_user_id(), 'cash.reconcile',
          jsonb_build_object('session', p_session));
end $$;
revoke all on function public.bc_reconcile_cash_session(uuid, text) from public;
grant execute on function public.bc_reconcile_cash_session(uuid, text) to bc_app;

create or replace function public.bc_ensure_default_register(p_salon uuid, p_branch uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'salon.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select id into v_id from public.bc_cash_registers
   where salon_id = p_salon and branch_id = p_branch order by created_at limit 1;
  if v_id is null then
    insert into public.bc_cash_registers(salon_id, branch_id, name)
    values (p_salon, p_branch, 'Caisse principale') returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.bc_ensure_default_register(uuid, uuid) from public;
grant execute on function public.bc_ensure_default_register(uuid, uuid) to bc_app;

-- ============================================================================
-- 4.2 / 4.4 Encaissement et remboursement rattachés à une session ouverte
-- ============================================================================
-- Remplace la version du socle : ajoute la session de caisse, le statut du
-- paiement (pending pour un électronique non prouvé) et la devise XOF.
create or replace function public.bc_record_manual_entry(
  p_appointment uuid, p_kind text, p_amount bigint, p_method text, p_reason text,
  p_key uuid, p_original uuid default null, p_status text default 'confirmed', p_provider_ref text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.bc_appointments%rowtype;
  orig public.bc_payment_entries%rowtype;
  v_balance bigint;
  v_delta bigint;
  v_id uuid;
  v_session uuid;
begin
  select * into a from public.bc_appointments where id = p_appointment for update;
  if not found then raise exception 'Not found or not authorized' using errcode = '42501'; end if;

  if p_kind = 'payment' then
    if a.status in ('cancelled', 'no_show') then raise exception 'Cannot charge a cancelled or missed appointment' using errcode = '22023'; end if;
    if not barber_private.has_branch_permission(a.salon_id, a.branch_id, 'payments.record') then raise exception 'Not authorized' using errcode = '42501'; end if;
  elsif p_kind in ('refund', 'payment_reversal', 'refund_reversal') then
    if not barber_private.has_salon_permission(a.salon_id, 'payments.refund') then raise exception 'Not authorized' using errcode = '42501'; end if;
  else
    raise exception 'Invalid entry kind' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 or p_key is null or p_method is null
     or p_method not in ('cash', 'manual_mobile', 'manual_card', 'other') then
    raise exception 'Invalid entry' using errcode = '22023';
  end if;
  if p_status not in ('pending', 'confirmed') then raise exception 'Invalid payment status' using errcode = '22023'; end if;
  if p_kind <> 'payment' and p_status <> 'confirmed' then
    raise exception 'Only payments can stay pending' using errcode = '22023';
  end if;
  if p_kind <> 'payment' and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'Reason required' using errcode = '22023';
  end if;

  if p_kind in ('payment_reversal', 'refund_reversal') then
    select * into orig from public.bc_payment_entries
     where id = p_original and appointment_id = a.id
       and kind = case when p_kind = 'payment_reversal' then 'payment' else 'refund' end
       and amount = p_amount and method = p_method;
    if not found then raise exception 'Invalid original entry' using errcode = '22023'; end if;
  elsif p_kind = 'refund' and p_original is not null then
    select * into orig from public.bc_payment_entries
     where id = p_original and appointment_id = a.id and kind = 'payment';
    if not found then raise exception 'Invalid original entry' using errcode = '22023'; end if;
  elsif p_original is not null then
    raise exception 'Unexpected original entry' using errcode = '22023';
  end if;

  select coalesce(sum(case when kind in ('payment', 'refund_reversal') then amount else -amount end), 0)
    into v_balance
    from public.bc_payment_entries
   where appointment_id = a.id and payment_status = 'confirmed';
  v_delta := case when p_kind in ('payment', 'refund_reversal') then p_amount else -p_amount end;
  -- Un paiement en attente ne consomme pas de solde du rendez-vous.
  if p_status = 'confirmed' and (v_balance + v_delta < 0 or v_balance + v_delta > a.amount) then
    raise exception 'Entry exceeds outstanding balance or collected amount' using errcode = '22023';
  end if;

  -- Rattachement à la session de caisse ouverte de la succursale, pour les
  -- espèces confirmées : c'est ce lien qui alimente le solde attendu.
  if p_status = 'confirmed' and p_method = 'cash' then
    select cs.id into v_session
      from public.bc_cash_sessions cs
      join public.bc_cash_registers r on r.id = cs.cash_register_id
     where cs.salon_id = a.salon_id and cs.branch_id = a.branch_id and cs.status = 'open'
     order by cs.opened_at desc limit 1;
  end if;

  insert into public.bc_payment_entries(
    salon_id, branch_id, appointment_id, kind, amount, currency, method, original_entry_id,
    reason, actor_id, idempotency_key, cash_session_id, provider_reference, payment_status)
  values (a.salon_id, a.branch_id, a.id, p_kind, p_amount, 'XOF', p_method, p_original,
          nullif(btrim(p_reason), ''), barber_private.current_user_id(), p_key,
          v_session, nullif(btrim(coalesce(p_provider_ref, '')), ''), p_status)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.bc_record_manual_entry(uuid,text,bigint,text,text,uuid,uuid,text,text) from public;
grant execute on function public.bc_record_manual_entry(uuid,text,bigint,text,text,uuid,uuid,text,text) to bc_app;

-- Confirmation d'un paiement électronique à partir d'une preuve fournisseur.
-- Sans preuve (référence), l'appel est refusé : rien ne se confirme depuis le front.
create or replace function public.bc_confirm_provider_payment(p_entry uuid, p_provider_ref text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.bc_payment_entries%rowtype;
begin
  if p_provider_ref is null or char_length(btrim(p_provider_ref)) < 4 then
    raise exception 'Provider reference required' using errcode = '22023';
  end if;
  select * into e from public.bc_payment_entries where id = p_entry for update;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
  if not barber_private.has_branch_permission(e.salon_id, e.branch_id, 'payments.correct') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if e.payment_status <> 'pending' then raise exception 'Entry is not pending' using errcode = '22023'; end if;
  update public.bc_payment_entries
     set payment_status = 'confirmed', provider_reference = btrim(p_provider_ref)
   where id = p_entry;
end $$;
revoke all on function public.bc_confirm_provider_payment(uuid, text) from public;
grant execute on function public.bc_confirm_provider_payment(uuid, text) to bc_app;

-- ============================================================================
-- 4.5 Dépenses avec succursale et justificatif
-- ============================================================================
create or replace function public.bc_add_expense_v2(
  p_salon uuid, p_branch uuid, p_title text, p_category text, p_amount bigint,
  p_date date, p_notes text, p_receipt text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'expenses.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then raise exception 'Invalid title' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  if p_date is null then raise exception 'Invalid date' using errcode = '22023'; end if;
  if p_branch is not null and not exists (select 1 from public.bc_branches where id = p_branch and salon_id = p_salon) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  insert into public.bc_expenses(salon_id, branch_id, title, category, amount, spent_on, notes, receipt_ref, created_by)
  values (p_salon, p_branch, btrim(p_title), p_category, p_amount, p_date,
          coalesce(p_notes, ''), nullif(btrim(coalesce(p_receipt, '')), ''), barber_private.current_user_id())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.bc_add_expense_v2(uuid,uuid,text,text,bigint,date,text,text) from public;
grant execute on function public.bc_add_expense_v2(uuid,uuid,text,text,bigint,date,text,text) to bc_app;

-- ============================================================================
-- 4.6 Rapports calculés depuis les opérations réelles
-- ============================================================================
-- Solde restant par rendez-vous : montant facturé − encaissements confirmés.
create or replace function public.bc_financial_summary(p_salon uuid, p_from date, p_to date)
returns table (
  revenue_billed bigint,
  revenue_collected bigint,
  outstanding bigint,
  refunds bigint,
  expenses bigint,
  net_balance bigint
) language sql stable security definer set search_path = '' as $$
  with apt as (
    select a.id, a.amount
      from public.bc_appointments a
     where a.salon_id = p_salon
       and a.status not in ('cancelled', 'no_show')
       and (a.starts_at at time zone 'Africa/Abidjan')::date between p_from and p_to
       and barber_private.has_salon_permission(p_salon, 'payments.read')
  ), entries as (
    select e.kind, e.amount
      from public.bc_payment_entries e
      left join public.bc_appointments a on a.id = e.appointment_id
     where e.salon_id = p_salon
       and e.payment_status = 'confirmed'
       and coalesce((a.starts_at at time zone 'Africa/Abidjan')::date, (e.created_at at time zone 'Africa/Abidjan')::date) between p_from and p_to
       and barber_private.has_salon_permission(p_salon, 'payments.read')
  ), exp as (
    select coalesce(sum(x.amount), 0) as total
      from public.bc_expenses x
     where x.salon_id = p_salon and x.spent_on between p_from and p_to
       and barber_private.has_salon_permission(p_salon, 'expenses.read')
  )
  select
    coalesce((select sum(amount) from apt), 0)                                         as revenue_billed,
    coalesce((select sum(case when kind = 'payment' then amount when kind = 'refund' then -amount else 0 end)
                from entries), 0)                                                      as revenue_collected,
    coalesce((select sum(amount) from apt), 0)
      - coalesce((select sum(case when kind = 'payment' then amount when kind = 'refund' then -amount else 0 end)
                    from entries), 0)                                                  as outstanding,
    coalesce((select sum(amount) from entries where kind = 'refund'), 0)               as refunds,
    (select total from exp)                                                            as expenses,
    -- Solde net documenté : encaissements nets de remboursements − dépenses.
    -- Il ne s'agit pas d'un bénéfice comptable certifié.
    coalesce((select sum(case when kind = 'payment' then amount when kind = 'refund' then -amount else 0 end)
                from entries), 0) - (select total from exp)                            as net_balance
$$;
revoke all on function public.bc_financial_summary(uuid, date, date) from public;
grant execute on function public.bc_financial_summary(uuid, date, date) to bc_app;
