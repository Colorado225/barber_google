-- Lot 6 — journal financier append-only, paiements, corrections et clôture.
-- XOF en bigint. Aucun paiement n'est « vérifié opérateur » : les paiements
-- Mobile Money sont confirmés manuellement avec référence + note de preuve.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid not null,
  appointment_id uuid not null,
  cash_session_id uuid,
  original_entry_id uuid,
  kind text not null check (kind in ('payment', 'refund', 'payment_reversal', 'refund_reversal')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  currency text not null default 'XOF' check (currency = 'XOF'),
  method text not null check (method in ('cash', 'wave', 'orange_money', 'mtn_momo', 'moov_money', 'card')),
  provider_reference text,
  reason text not null default '' check (char_length(reason) <= 500),
  settlement_mode text check (settlement_mode in ('cash_drawer', 'manual_confirmed', 'manual_rejected')),
  settlement_note text not null default '' check (char_length(settlement_note) <= 500),
  actor_id uuid references auth.users(id) on delete set null,
  settled_by uuid references auth.users(id) on delete set null,
  settled_at timestamptz,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (salon_id, id),
  unique (salon_id, idempotency_key),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict,
  foreign key (salon_id, appointment_id) references public.appointments(salon_id, id) on delete restrict,
  foreign key (salon_id, cash_session_id) references public.cash_sessions(salon_id, id) on delete restrict,
  foreign key (salon_id, original_entry_id) references public.payments(salon_id, id) on delete restrict,
  check (
    (kind = 'payment' and original_entry_id is null)
    or (kind <> 'payment' and original_entry_id is not null and char_length(btrim(reason)) >= 3)
  ),
  check (
    method <> 'cash'
    or (provider_reference is null and status = 'confirmed' and cash_session_id is not null
        and settlement_mode = 'cash_drawer' and settled_by is not null and settled_at is not null)
  ),
  check (
    method = 'cash'
    or (
      (provider_reference is not null and char_length(btrim(provider_reference)) between 4 and 120)
      and (
        (status = 'pending' and settlement_mode is null and settled_by is null and settled_at is null and cash_session_id is null)
        or (status = 'confirmed' and settlement_mode = 'manual_confirmed' and settled_by is not null and settled_at is not null and char_length(btrim(settlement_note)) >= 10)
        or (status = 'failed' and settlement_mode = 'manual_rejected' and settled_by is not null and settled_at is not null and char_length(btrim(settlement_note)) >= 3)
      )
    )
  ),
  check (kind = 'payment' or status = 'confirmed')
);
create index payments_salon_created_idx on public.payments (salon_id, created_at desc);
create index payments_appointment_idx on public.payments (salon_id, appointment_id, created_at);
create index payments_session_idx on public.payments (salon_id, cash_session_id) where cash_session_id is not null;
create index payments_original_idx on public.payments (salon_id, original_entry_id) where original_entry_id is not null;
create index payments_pending_idx on public.payments (salon_id, created_at) where status = 'pending';
create unique index payments_one_reversal_per_original
  on public.payments (original_entry_id) where kind = 'payment_reversal';

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid not null,
  payment_id uuid not null,
  appointment_id uuid not null,
  event_type text not null check (event_type in ('recorded', 'confirmed', 'rejected', 'corrected')),
  previous_status text,
  new_status text not null check (new_status in ('pending', 'confirmed', 'failed')),
  amount bigint not null check (amount > 0),
  reason text not null default '' check (char_length(reason) <= 500),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (salon_id, payment_id) references public.payments(salon_id, id) on delete restrict,
  foreign key (salon_id, appointment_id) references public.appointments(salon_id, id) on delete restrict
);
create index payment_events_payment_idx on public.payment_events (salon_id, payment_id, created_at);
create index payment_events_appointment_idx on public.payment_events (salon_id, appointment_id, created_at);

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
create policy payments_read_finance on public.payments for select to authenticated
  using (private.has_salon_permission(salon_id, 'payments.read'));
create policy payment_events_read_finance on public.payment_events for select to authenticated
  using (private.has_salon_permission(salon_id, 'payments.read'));
revoke all on public.payments, public.payment_events from anon, authenticated;
grant select on public.payments, public.payment_events to authenticated;

-- Journal immuable : seule la résolution d'un paiement en attente peut changer
-- le statut et les champs de règlement. Montant, méthode, référence, motif,
-- acteur, clé d'idempotence et payload ne sont jamais réécrits.
create function private.protect_payment_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment entries are immutable' using errcode = '23514';
  end if;
  if old.status = 'pending' and new.status in ('confirmed', 'failed') then
    if (to_jsonb(old) - array['status', 'cash_session_id', 'settlement_mode', 'settlement_note', 'settled_by', 'settled_at'])
       = (to_jsonb(new) - array['status', 'cash_session_id', 'settlement_mode', 'settlement_note', 'settled_by', 'settled_at']) then
      return new;
    end if;
  end if;
  raise exception 'Payment entry is immutable' using errcode = '23514';
end;
$$;
create trigger payments_protect
  before update or delete on public.payments
  for each row execute function private.protect_payment_entry();

create function private.protect_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Payment events are append-only' using errcode = '23514';
end;
$$;
create trigger payment_events_protect
  before update or delete on public.payment_events
  for each row execute function private.protect_payment_event();

create function private.payment_signed_amount(p_kind text, p_amount bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when p_kind in ('payment', 'refund_reversal') then p_amount else -p_amount end
$$;

create function private.lock_cash_session(p_salon_id uuid, p_branch_id uuid, p_required boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from public.cash_sessions
    where salon_id = p_salon_id and branch_id = p_branch_id and status = 'open'
    for update;
  if v_session_id is null and p_required then
    raise exception 'Open a cash session before recording a cash movement' using errcode = '22023';
  end if;
  return v_session_id;
end;
$$;

create function private.cash_drawer_balance(p_session_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select s.opening_balance + coalesce(sum(private.payment_signed_amount(p.kind, p.amount)), 0)
    from public.cash_sessions s
    left join public.payments p
      on p.cash_session_id = s.id and p.status = 'confirmed' and p.method = 'cash'
    where s.id = p_session_id
    group by s.opening_balance
$$;

create function private.recompute_appointment_payment_status(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_net bigint;
  v_has_refund boolean;
  v_status text;
begin
  select amount into v_amount from public.appointments where id = p_appointment_id;
  select coalesce(sum(private.payment_signed_amount(kind, amount)), 0),
         coalesce(bool_or(kind = 'refund'), false)
    into v_net, v_has_refund
    from public.payments
    where appointment_id = p_appointment_id and status = 'confirmed';
  v_status := case
    when v_net >= v_amount and v_amount > 0 then 'paid'
    when v_net > 0 then 'deposit_paid'
    when v_has_refund then 'refunded'
    else 'unpaid'
  end;
  update public.appointments
    set payment_status = v_status, updated_at = now()
    where id = p_appointment_id and payment_status is distinct from v_status;
end;
$$;

create function private.record_payment_entry(
  p_salon_id uuid,
  p_appointment_id uuid,
  p_kind text,
  p_amount bigint,
  p_method text,
  p_idempotency_key uuid,
  p_provider_reference text,
  p_reason text,
  p_settlement_note text,
  p_original_entry_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments;
  v_original public.payments;
  v_existing public.payments;
  v_entry public.payments;
  v_method text := p_method;
  v_reference text := nullif(btrim(coalesce(p_provider_reference, '')), '');
  v_reason text := btrim(coalesce(p_reason, ''));
  v_note text := btrim(coalesce(p_settlement_note, ''));
  v_payload jsonb;
  v_net bigint;
  v_delta bigint;
  v_remaining bigint;
  v_status text;
  v_session_id uuid;
  v_settlement_mode text;
  v_actor uuid := auth.uid();
begin
  if p_kind not in ('payment', 'refund', 'payment_reversal', 'refund_reversal')
    or p_amount is null or p_amount <= 0 or p_amount > 1000000000000
    or p_idempotency_key is null
    or char_length(v_reason) > 500 or char_length(v_note) > 500
    or (v_reference is not null and char_length(v_reference) > 120) then
    raise exception 'Invalid payment entry' using errcode = '22023';
  end if;

  -- Verrou métier : sérialise les encaissements/corrections d'un même RDV.
  select * into v_appointment from public.appointments
    where id = p_appointment_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Appointment not found' using errcode = '22023';
  end if;
  if v_appointment.currency <> 'XOF' then
    raise exception 'Only XOF appointments can be paid in this journal' using errcode = '22023';
  end if;

  if p_kind <> 'payment' then
    select * into v_original from public.payments
      where id = p_original_entry_id and salon_id = p_salon_id and appointment_id = p_appointment_id
      for update;
    if not found or v_original.status <> 'confirmed' then
      raise exception 'Original payment entry not found or not confirmed' using errcode = '22023';
    end if;
    if (p_kind in ('refund', 'payment_reversal') and v_original.kind <> 'payment')
      or (p_kind = 'refund_reversal' and v_original.kind <> 'refund') then
      raise exception 'Invalid original entry kind for this correction' using errcode = '22023';
    end if;
    if char_length(v_reason) < 3 then
      raise exception 'A correction reason is required' using errcode = '22023';
    end if;
    v_method := v_original.method;
  else
    if v_method not in ('cash', 'wave', 'orange_money', 'mtn_momo', 'moov_money', 'card') then
      raise exception 'Invalid payment method' using errcode = '22023';
    end if;
    if v_appointment.status in ('cancelled', 'no_show') then
      raise exception 'Cannot record a payment for a cancelled or no-show appointment' using errcode = '22023';
    end if;
  end if;

  v_payload := jsonb_build_object(
    'appointment_id', p_appointment_id,
    'kind', p_kind,
    'amount', p_amount,
    'method', v_method,
    'original_entry_id', p_original_entry_id,
    'provider_reference', v_reference,
    'reason', v_reason,
    'settlement_note', case when p_kind = 'payment' and v_method <> 'cash' then null else v_note end
  );
  select * into v_existing from public.payments
    where salon_id = p_salon_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_payload <> v_payload then
      raise exception 'Idempotency key reused with a different payload' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  if v_method <> 'cash' and (v_reference is null or char_length(v_reference) < 4) then
    raise exception 'A provider transaction reference is required for non-cash payments' using errcode = '22023';
  end if;
  if v_method = 'cash' and v_reference is not null then
    raise exception 'Cash movements do not use a provider reference' using errcode = '22023';
  end if;

  select coalesce(sum(private.payment_signed_amount(kind, amount)), 0)
    into v_net from public.payments
    where appointment_id = p_appointment_id and status = 'confirmed';

  if p_kind = 'payment' then
    v_status := case when v_method = 'cash' then 'confirmed' else 'pending' end;
  else
    -- Plafond par entrée d'origine : remboursements cumulés + annulation unique.
    if p_kind in ('refund', 'payment_reversal') then
      select v_original.amount - coalesce(sum(p.amount), 0)
        into v_remaining
        from public.payments p
        where p.original_entry_id = v_original.id and p.status = 'confirmed'
          and p.kind in ('refund', 'payment_reversal');
    else
      select v_original.amount - coalesce(sum(p.amount), 0)
        into v_remaining
        from public.payments p
        where p.original_entry_id = v_original.id and p.status = 'confirmed'
          and p.kind = 'refund_reversal';
    end if;
    if p_amount > v_remaining then
      raise exception 'Correction exceeds the remaining amount of the original entry' using errcode = '22023';
    end if;
    v_status := 'confirmed';
    if v_method <> 'cash' and char_length(v_note) < 10 then
      raise exception 'A manual settlement note is required to confirm a non-cash correction' using errcode = '22023';
    end if;
  end if;

  v_delta := private.payment_signed_amount(p_kind, p_amount);
  if v_status = 'confirmed' then
    if v_net + v_delta < 0 or v_net + v_delta > v_appointment.amount then
      raise exception 'Payment would make the appointment balance negative or exceed its price' using errcode = '22023';
    end if;
    v_session_id := private.lock_cash_session(p_salon_id, v_appointment.branch_id, v_method = 'cash');
    if v_method = 'cash' and v_delta < 0 and private.cash_drawer_balance(v_session_id) < p_amount then
      raise exception 'Insufficient cash in the open session for this outflow' using errcode = '22023';
    end if;
    v_settlement_mode := case when v_method = 'cash' then 'cash_drawer' else 'manual_confirmed' end;
  else
    v_session_id := null;
    v_settlement_mode := null;
    if v_note <> '' then
      raise exception 'A pending payment cannot carry a settlement note' using errcode = '22023';
    end if;
  end if;

  insert into public.payments(
    salon_id, branch_id, appointment_id, cash_session_id, original_entry_id,
    kind, status, amount, currency, method, provider_reference, reason,
    settlement_mode, settlement_note, actor_id, settled_by, settled_at,
    idempotency_key, request_payload
  ) values (
    p_salon_id, v_appointment.branch_id, p_appointment_id, v_session_id, p_original_entry_id,
    p_kind, v_status, p_amount, 'XOF', v_method, v_reference, v_reason,
    v_settlement_mode, v_note, v_actor,
    case when v_status = 'confirmed' then v_actor else null end,
    case when v_status = 'confirmed' then now() else null end,
    p_idempotency_key, v_payload
  ) returning * into v_entry;

  insert into public.payment_events(salon_id, branch_id, payment_id, appointment_id, event_type, new_status, amount, reason, actor_id, metadata)
    values (p_salon_id, v_appointment.branch_id, v_entry.id, p_appointment_id, 'recorded', v_status, p_amount, v_reason, v_actor,
            jsonb_build_object('kind', p_kind, 'method', v_method));
  if p_original_entry_id is not null then
    insert into public.payment_events(salon_id, branch_id, payment_id, appointment_id, event_type, previous_status, new_status, amount, reason, actor_id, metadata)
      values (p_salon_id, v_appointment.branch_id, p_original_entry_id, p_appointment_id, 'corrected', 'confirmed', 'confirmed', p_amount, v_reason, v_actor,
              jsonb_build_object('correction_id', v_entry.id, 'kind', p_kind));
  end if;
  if v_status = 'confirmed' then
    perform private.recompute_appointment_payment_status(p_appointment_id);
  end if;
  return v_entry;
end;
$$;

create function public.record_payment(
  p_salon_id uuid,
  p_appointment_id uuid,
  p_amount bigint,
  p_method text,
  p_idempotency_key uuid,
  p_provider_reference text default null,
  p_reason text default ''
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_salon_permission(p_salon_id, 'payments.record') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return private.record_payment_entry(p_salon_id, p_appointment_id, 'payment', p_amount, p_method,
    p_idempotency_key, p_provider_reference, p_reason, '', null);
end;
$$;
revoke all on function public.record_payment(uuid, uuid, bigint, text, uuid, text, text) from public, anon;
grant execute on function public.record_payment(uuid, uuid, bigint, text, uuid, text, text) to authenticated;

create function public.record_payment_correction(
  p_salon_id uuid,
  p_original_entry_id uuid,
  p_kind text,
  p_amount bigint,
  p_reason text,
  p_idempotency_key uuid,
  p_provider_reference text default null,
  p_settlement_note text default ''
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
begin
  if not private.has_salon_permission(p_salon_id, 'payments.correct') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_kind not in ('refund', 'payment_reversal', 'refund_reversal') then
    raise exception 'Invalid correction kind' using errcode = '22023';
  end if;
  select appointment_id into v_appointment_id from public.payments
    where id = p_original_entry_id and salon_id = p_salon_id;
  if not found then
    raise exception 'Original payment entry not found' using errcode = '22023';
  end if;
  return private.record_payment_entry(p_salon_id, v_appointment_id, p_kind, p_amount, null,
    p_idempotency_key, p_provider_reference, p_reason, p_settlement_note, p_original_entry_id);
end;
$$;
revoke all on function public.record_payment_correction(uuid, uuid, text, bigint, text, uuid, text, text) from public, anon;
grant execute on function public.record_payment_correction(uuid, uuid, text, bigint, text, uuid, text, text) to authenticated;

create function public.confirm_pending_payment(
  p_salon_id uuid,
  p_payment_id uuid,
  p_provider_reference text,
  p_settlement_note text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_appointment public.appointments;
  v_net bigint;
  v_session_id uuid;
begin
  if not private.has_salon_permission(p_salon_id, 'payments.correct') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_payment from public.payments
    where id = p_payment_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Payment not found' using errcode = '22023';
  end if;
  if v_payment.status <> 'pending' or v_payment.kind <> 'payment' or v_payment.method = 'cash' then
    raise exception 'Only a pending non-cash payment can be confirmed' using errcode = '22023';
  end if;
  if btrim(coalesce(p_provider_reference, '')) <> v_payment.provider_reference then
    raise exception 'Provider reference does not match the recorded payment' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_settlement_note, ''))) < 10 then
    raise exception 'A manual verification note of at least 10 characters is required' using errcode = '22023';
  end if;
  select * into v_appointment from public.appointments where id = v_payment.appointment_id for update;
  if v_appointment.status in ('cancelled', 'no_show') then
    raise exception 'Cannot confirm a payment for a cancelled or no-show appointment' using errcode = '22023';
  end if;
  select coalesce(sum(private.payment_signed_amount(kind, amount)), 0)
    into v_net from public.payments
    where appointment_id = v_payment.appointment_id and status = 'confirmed';
  if v_net + v_payment.amount > v_appointment.amount then
    raise exception 'Confirming this payment would exceed the appointment price' using errcode = '22023';
  end if;
  v_session_id := private.lock_cash_session(p_salon_id, v_payment.branch_id, false);
  update public.payments
    set status = 'confirmed', cash_session_id = v_session_id,
        settlement_mode = 'manual_confirmed', settlement_note = btrim(p_settlement_note),
        settled_by = auth.uid(), settled_at = now()
    where id = v_payment.id
    returning * into v_payment;
  insert into public.payment_events(salon_id, branch_id, payment_id, appointment_id, event_type, previous_status, new_status, amount, reason, actor_id, metadata)
    values (p_salon_id, v_payment.branch_id, v_payment.id, v_payment.appointment_id, 'confirmed', 'pending', 'confirmed', v_payment.amount, btrim(p_settlement_note), auth.uid(), '{}'::jsonb);
  perform private.recompute_appointment_payment_status(v_payment.appointment_id);
  return v_payment;
end;
$$;
revoke all on function public.confirm_pending_payment(uuid, uuid, text, text) from public, anon;
grant execute on function public.confirm_pending_payment(uuid, uuid, text, text) to authenticated;

create function public.reject_pending_payment(p_salon_id uuid, p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if not private.has_salon_permission(p_salon_id, 'payments.correct') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;
  select * into v_payment from public.payments
    where id = p_payment_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Payment not found' using errcode = '22023';
  end if;
  if v_payment.status <> 'pending' or v_payment.kind <> 'payment' or v_payment.method = 'cash' then
    raise exception 'Only a pending non-cash payment can be rejected' using errcode = '22023';
  end if;
  update public.payments
    set status = 'failed', settlement_mode = 'manual_rejected', settlement_note = btrim(p_reason),
        settled_by = auth.uid(), settled_at = now()
    where id = v_payment.id
    returning * into v_payment;
  insert into public.payment_events(salon_id, branch_id, payment_id, appointment_id, event_type, previous_status, new_status, amount, reason, actor_id, metadata)
    values (p_salon_id, v_payment.branch_id, v_payment.id, v_payment.appointment_id, 'rejected', 'pending', 'failed', v_payment.amount, btrim(p_reason), auth.uid(), '{}'::jsonb);
  return v_payment;
end;
$$;
revoke all on function public.reject_pending_payment(uuid, uuid, text) from public, anon;
grant execute on function public.reject_pending_payment(uuid, uuid, text) to authenticated;

create function public.close_cash_session(
  p_salon_id uuid,
  p_session_id uuid,
  p_counted_balance bigint,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions;
  v_expected bigint;
begin
  if not private.has_salon_permission(p_salon_id, 'cash.close') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_counted_balance is null or p_counted_balance < 0 or p_counted_balance > 1000000000000
    or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Invalid counted balance or note' using errcode = '22023';
  end if;
  select * into v_session from public.cash_sessions
    where id = p_session_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Cash session not found' using errcode = '22023';
  end if;
  if v_session.status <> 'open' then
    raise exception 'Only an open cash session can be closed' using errcode = '22023';
  end if;
  select v_session.opening_balance + coalesce(sum(private.payment_signed_amount(p.kind, p.amount)), 0)
    into v_expected
    from public.payments p
    where p.cash_session_id = v_session.id and p.status = 'confirmed' and p.method = 'cash';
  update public.cash_sessions
    set status = 'closed', expected_balance = v_expected, counted_balance = p_counted_balance,
        difference = p_counted_balance - v_expected, closing_note = btrim(coalesce(p_note, '')),
        closed_by = auth.uid(), closed_at = now()
    where id = v_session.id;
  return v_session.id;
end;
$$;
revoke all on function public.close_cash_session(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.close_cash_session(uuid, uuid, bigint, text) to authenticated;

create function public.reconcile_cash_session(p_salon_id uuid, p_session_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not private.has_salon_permission(p_salon_id, 'cash.reconcile') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 3 and 500 then
    raise exception 'A reconciliation note is required' using errcode = '22023';
  end if;
  select status into v_status from public.cash_sessions
    where id = p_session_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Cash session not found' using errcode = '22023';
  end if;
  if v_status <> 'closed' then
    raise exception 'Only a closed cash session can be reconciled' using errcode = '22023';
  end if;
  update public.cash_sessions
    set status = 'reconciled', reconciliation_note = btrim(p_note),
        reconciled_by = auth.uid(), reconciled_at = now()
    where id = p_session_id;
  return p_session_id;
end;
$$;
revoke all on function public.reconcile_cash_session(uuid, uuid, text) from public, anon;
grant execute on function public.reconcile_cash_session(uuid, uuid, text) to authenticated;

create function private.cash_session_snapshot(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(s) || jsonb_build_object(
    'register_name', r.name,
    'total_cash_in', coalesce(sum(case when p.method = 'cash' and private.payment_signed_amount(p.kind, p.amount) > 0 then p.amount else 0 end), 0),
    'total_cash_out', coalesce(sum(case when p.method = 'cash' and private.payment_signed_amount(p.kind, p.amount) < 0 then -p.amount else 0 end), 0),
    'total_mobile_money_in', coalesce(sum(case when p.method <> 'cash' and private.payment_signed_amount(p.kind, p.amount) > 0 then p.amount else 0 end), 0),
    'total_mobile_money_out', coalesce(sum(case when p.method <> 'cash' and private.payment_signed_amount(p.kind, p.amount) < 0 then -p.amount else 0 end), 0),
    'theoretical_balance', s.opening_balance + coalesce(sum(case when p.method = 'cash' then private.payment_signed_amount(p.kind, p.amount) else 0 end), 0)
  )
    from public.cash_sessions s
    join public.cash_registers r on r.id = s.register_id
    left join public.payments p on p.cash_session_id = s.id and p.status = 'confirmed'
    where s.id = p_session_id
    group by s.id, r.name
$$;

create function public.get_cash_session(p_salon_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_salon_permission(p_salon_id, 'cash.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cash_sessions where id = p_session_id and salon_id = p_salon_id) then
    raise exception 'Cash session not found' using errcode = '22023';
  end if;
  return private.cash_session_snapshot(p_session_id);
end;
$$;
revoke all on function public.get_cash_session(uuid, uuid) from public, anon;
grant execute on function public.get_cash_session(uuid, uuid) to authenticated;

create function public.list_cash_sessions(p_salon_id uuid, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.has_salon_permission(p_salon_id, 'cash.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid limit' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(private.cash_session_snapshot(s.id) order by s.opened_at desc), '[]'::jsonb)
    into v_result
    from (
      select id, opened_at from public.cash_sessions
        where salon_id = p_salon_id
        order by opened_at desc limit p_limit
    ) s;
  return v_result;
end;
$$;
revoke all on function public.list_cash_sessions(uuid, integer) from public, anon;
grant execute on function public.list_cash_sessions(uuid, integer) to authenticated;
