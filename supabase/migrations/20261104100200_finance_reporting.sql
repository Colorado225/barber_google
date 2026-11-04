-- Lot 6 — rapports financiers, soldes par RDV et dépenses tracées.
-- Sémantique de période : facturé = RDV actifs dont starts_at tombe dans la
-- période ; encaissé/dépenses = écritures confirmées/dépenses datées dans la
-- période ; impayé = reste à payer des RDV de la période, tous règlements
-- confondus (pas une soustraction de deux périodes différentes).

create function public.list_payments(
  p_salon_id uuid,
  p_from date default null,
  p_to date default null,
  p_appointment_id uuid default null,
  p_cash_session_id uuid default null,
  p_status text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.has_salon_permission(p_salon_id, 'payments.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500
    or (p_from is not null and p_to is not null and p_from > p_to)
    or (p_status is not null and p_status not in ('pending', 'confirmed', 'failed')) then
    raise exception 'Invalid payment filter' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'client_name', a.client_name,
      'service_name', a.service_name,
      'appointment_amount', a.amount
    ) order by p.created_at desc, p.id), '[]'::jsonb)
    into v_result
    from public.payments p
    join public.appointments a on a.id = p.appointment_id and a.salon_id = p.salon_id
    where p.salon_id = p_salon_id
      and (p_from is null or p.created_at >= (p_from::timestamp at time zone 'Africa/Abidjan'))
      and (p_to is null or p.created_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan'))
      and (p_appointment_id is null or p.appointment_id = p_appointment_id)
      and (p_cash_session_id is null or p.cash_session_id = p_cash_session_id)
      and (p_status is null or p.status = p_status)
    limit p_limit;
  return v_result;
end;
$$;
revoke all on function public.list_payments(uuid, date, date, uuid, uuid, text, integer) from public, anon;
grant execute on function public.list_payments(uuid, date, date, uuid, uuid, text, integer) to authenticated;

create function public.get_appointment_balance(p_salon_id uuid, p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount bigint;
  v_net bigint;
  v_pending bigint;
  v_refunded bigint;
begin
  if not private.has_salon_permission(p_salon_id, 'payments.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select amount into v_amount from public.appointments
    where id = p_appointment_id and salon_id = p_salon_id;
  if not found then
    raise exception 'Appointment not found' using errcode = '22023';
  end if;
  select coalesce(sum(private.payment_signed_amount(kind, amount)) filter (where status = 'confirmed'), 0),
         coalesce(sum(amount) filter (where status = 'pending'), 0),
         coalesce(sum(amount) filter (where status = 'confirmed' and kind = 'refund'), 0)
    into v_net, v_pending, v_refunded
    from public.payments where appointment_id = p_appointment_id;
  return jsonb_build_object(
    'appointment_id', p_appointment_id,
    'billed', v_amount,
    'collected', v_net,
    'outstanding', greatest(v_amount - v_net, 0),
    'pending', v_pending,
    'refunded', v_refunded
  );
end;
$$;
revoke all on function public.get_appointment_balance(uuid, uuid) from public, anon;
grant execute on function public.get_appointment_balance(uuid, uuid) to authenticated;

create function public.financial_summary(p_salon_id uuid, p_from date, p_to date)
returns table (
  revenue_billed bigint,
  revenue_collected bigint,
  outstanding bigint,
  refunds bigint,
  expenses bigint,
  net_balance bigint,
  pending_amount bigint,
  payment_count bigint,
  by_method jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_salon_permission(p_salon_id, 'reports.read')
    or not private.has_salon_permission(p_salon_id, 'expenses.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or (p_to - p_from) > 366 then
    raise exception 'Invalid report period' using errcode = '22023';
  end if;
  return query
  with apt as (
    select a.amount,
           coalesce((
             select sum(private.payment_signed_amount(p.kind, p.amount))
             from public.payments p
             where p.appointment_id = a.id and p.status = 'confirmed'
           ), 0) as net
    from public.appointments a
    where a.salon_id = p_salon_id
      and a.status not in ('cancelled', 'no_show')
      and a.starts_at >= (p_from::timestamp at time zone 'Africa/Abidjan')
      and a.starts_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan')
  ), entries as (
    select p.method, p.kind, p.amount
    from public.payments p
    where p.salon_id = p_salon_id and p.status = 'confirmed'
      and p.created_at >= (p_from::timestamp at time zone 'Africa/Abidjan')
      and p.created_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan')
  ), exp as (
    select e.amount from public.expenses e
    where e.salon_id = p_salon_id and e.spent_on between p_from and p_to
  ), pending as (
    select p.amount from public.payments p
    where p.salon_id = p_salon_id and p.status = 'pending'
      and p.created_at >= (p_from::timestamp at time zone 'Africa/Abidjan')
      and p.created_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan')
  ), methods as (
    select method, sum(private.payment_signed_amount(kind, amount)) as net
    from entries group by method
  )
  select
    coalesce((select sum(amount) from apt), 0)::bigint,
    coalesce((select sum(private.payment_signed_amount(kind, amount)) from entries), 0)::bigint,
    coalesce((select sum(greatest(amount - net, 0)) from apt), 0)::bigint,
    coalesce((select sum(amount) from entries where kind = 'refund'), 0)::bigint,
    coalesce((select sum(amount) from exp), 0)::bigint,
    (coalesce((select sum(private.payment_signed_amount(kind, amount)) from entries), 0)
      - coalesce((select sum(amount) from exp), 0))::bigint,
    coalesce((select sum(amount) from pending), 0)::bigint,
    coalesce((select count(*) from entries where kind = 'payment'), 0)::bigint,
    coalesce((select jsonb_object_agg(method, net) from methods), '{}'::jsonb);
end;
$$;
revoke all on function public.financial_summary(uuid, date, date) from public, anon;
grant execute on function public.financial_summary(uuid, date, date) to authenticated;

-- Dépenses : le serveur renseigne l'auteur et la succursale ; le client ne peut
-- plus choisir created_by. La suppression reste une opération explicite existante.
alter table public.expenses alter column created_by set default auth.uid();
alter table public.expenses add constraint expenses_currency_xof check (currency = 'XOF');
revoke insert on public.expenses from authenticated;
grant insert (salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref)
  on public.expenses to authenticated;

create function public.record_expense(
  p_salon_id uuid,
  p_title text,
  p_category text,
  p_amount bigint,
  p_spent_on date,
  p_branch_id uuid default null,
  p_notes text default '',
  p_receipt_ref text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses;
begin
  if not private.has_salon_permission(p_salon_id, 'expenses.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120
    or p_category not in ('rent', 'electricity', 'water', 'salaries', 'products', 'maintenance', 'marketing', 'other')
    or p_amount is null or p_amount <= 0 or p_amount > 1000000000000
    or p_spent_on is null
    or char_length(coalesce(p_notes, '')) > 500
    or char_length(coalesce(p_receipt_ref, '')) > 120 then
    raise exception 'Invalid expense' using errcode = '22023';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  insert into public.expenses(salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref, created_by)
    values (p_salon_id, p_branch_id, btrim(p_title), p_category, p_amount, 'XOF', p_spent_on,
            btrim(coalesce(p_notes, '')), nullif(btrim(coalesce(p_receipt_ref, '')), ''), auth.uid())
    returning * into v_expense;
  return v_expense;
end;
$$;
revoke all on function public.record_expense(uuid, text, text, bigint, date, uuid, text, text) from public, anon;
grant execute on function public.record_expense(uuid, text, text, bigint, date, uuid, text, text) to authenticated;
