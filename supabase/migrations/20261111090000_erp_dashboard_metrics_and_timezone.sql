-- Migration 20261111090000 : Fiabilité des indicateurs ERP (P1).
--
-- Objectifs :
-- 1. Aligner toutes les bornes de période SQL sur le fuseau horaire réel du salon
--    (`private.salon_timezone(p_salon_id)` issu de `branches.timezone`, repli `'Africa/Abidjan'`).
-- 2. Mettre à jour `list_payments` et `financial_summary` pour utiliser ce fuseau commun.
-- 3. Fournir l'agrégat serveur explicite `public.erp_dashboard_metrics(p_salon_id, p_from, p_to, p_day_filter)` :
--    - Séparation stricte : encaissé net/brut, remboursements, facturé actif, réalisé (`completed`),
--      dépenses nettes, marge estimée et reste à encaisser sur la même période `[p_from, p_to]` ;
--    - Exclusion systématique des rendez-vous `cancelled` et `no_show` du chiffre facturé, du
--      classement des prestations, de l'activité équipe et de l'occupation ;
--    - Mesure réelle de l'occupation horaire par tranches de 30 min (`occupied_minutes` / `available_minutes`)
--      tenant compte de la durée des prestations et de la capacité disponible (horaires succursale,
--      plannings et absences du personnel).

create or replace function private.salon_timezone(p_salon_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select nullif(btrim(b.timezone), '')
      from public.branches b
      where b.salon_id = p_salon_id
      order by b.created_at asc, b.id asc
      limit 1
    ),
    'Africa/Abidjan'
  );
$$;
revoke all on function private.salon_timezone(uuid) from public, anon, authenticated;

-- Met à jour `list_payments` pour respecter le fuseau du salon.
create or replace function public.list_payments(
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
  v_tz text;
begin
  if not private.has_salon_permission(p_salon_id, 'payments.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500
    or (p_from is not null and p_to is not null and p_from > p_to)
    or (p_status is not null and p_status not in ('pending', 'confirmed', 'failed')) then
    raise exception 'Invalid payment filter' using errcode = '22023';
  end if;
  v_tz := private.salon_timezone(p_salon_id);
  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'client_name', a.client_name,
      'service_name', a.service_name,
      'appointment_amount', a.amount
    ) order by p.created_at desc, p.id), '[]'::jsonb)
    into v_result
    from public.payments p
    join public.appointments a on a.id = p.appointment_id and a.salon_id = p.salon_id
    where p.salon_id = p_salon_id
      and (p_from is null or p.created_at >= (p_from::timestamp at time zone v_tz))
      and (p_to is null or p.created_at < ((p_to + 1)::timestamp at time zone v_tz))
      and (p_appointment_id is null or p.appointment_id = p_appointment_id)
      and (p_cash_session_id is null or p.cash_session_id = p_cash_session_id)
      and (p_status is null or p.status = p_status)
    limit p_limit;
  return v_result;
end;
$$;
revoke all on function public.list_payments(uuid, date, date, uuid, uuid, text, integer) from public, anon;
grant execute on function public.list_payments(uuid, date, date, uuid, uuid, text, integer) to authenticated;

-- Met à jour `financial_summary` pour respecter le fuseau du salon et déduire les contrepassations.
create or replace function public.financial_summary(p_salon_id uuid, p_from date, p_to date)
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
declare
  v_tz text;
begin
  if not private.has_salon_permission(p_salon_id, 'reports.read')
    or not private.has_salon_permission(p_salon_id, 'expenses.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or (p_to - p_from) > 366 then
    raise exception 'Invalid report period' using errcode = '22023';
  end if;
  v_tz := private.salon_timezone(p_salon_id);
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
      and a.starts_at >= (p_from::timestamp at time zone v_tz)
      and a.starts_at < ((p_to + 1)::timestamp at time zone v_tz)
  ), entries as (
    select p.method, p.kind, p.amount
    from public.payments p
    where p.salon_id = p_salon_id and p.status = 'confirmed'
      and p.created_at >= (p_from::timestamp at time zone v_tz)
      and p.created_at < ((p_to + 1)::timestamp at time zone v_tz)
  ), exp as (
    select private.expense_signed_amount(e.entry_kind, e.amount) as signed_amount
    from public.expenses e
    where e.salon_id = p_salon_id and e.spent_on between p_from and p_to
  ), pending as (
    select p.amount from public.payments p
    where p.salon_id = p_salon_id and p.status = 'pending'
      and p.created_at >= (p_from::timestamp at time zone v_tz)
      and p.created_at < ((p_to + 1)::timestamp at time zone v_tz)
  ), methods as (
    select method, sum(private.payment_signed_amount(kind, amount)) as net
    from entries group by method
  )
  select
    coalesce((select sum(amount) from apt), 0)::bigint,
    coalesce((select sum(private.payment_signed_amount(kind, amount)) from entries), 0)::bigint,
    coalesce((select sum(greatest(amount - net, 0)) from apt), 0)::bigint,
    coalesce((select sum(amount) from entries where kind = 'refund'), 0)::bigint,
    coalesce((select sum(signed_amount) from exp), 0)::bigint,
    (coalesce((select sum(private.payment_signed_amount(kind, amount)) from entries), 0)
      - coalesce((select sum(signed_amount) from exp), 0))::bigint,
    coalesce((select sum(amount) from pending), 0)::bigint,
    coalesce((select count(*) from entries where kind = 'payment'), 0)::bigint,
    coalesce((select jsonb_object_agg(method, net) from methods), '{}'::jsonb);
end;
$$;
revoke all on function public.financial_summary(uuid, date, date) from public, anon;
grant execute on function public.financial_summary(uuid, date, date) to authenticated;

-- Agrégat serveur complet du tableau de bord ERP sur une période explicite et dans le fuseau du salon.
create or replace function public.erp_dashboard_metrics(
  p_salon_id uuid,
  p_from date,
  p_to date,
  p_day_filter text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_day_filter text := lower(btrim(coalesce(p_day_filter, 'all')));

  v_can_finance boolean;
  v_can_expenses boolean;
  v_can_appointments boolean;

  v_collected_net bigint := null;
  v_collected_gross bigint := null;
  v_refunds bigint := null;
  v_payment_reversals bigint := null;
  v_refund_reversals bigint := null;
  v_pending_payments bigint := null;
  v_confirmed_payment_count bigint := null;
  v_average_basket bigint := null;
  v_by_method jsonb := '{}'::jsonb;

  v_expenses_net bigint := null;
  v_net_margin bigint := null;

  v_revenue_billed bigint := null;
  v_revenue_realized bigint := null;
  v_outstanding bigint := null;

  v_appointments_total bigint := 0;
  v_appointments_active bigint := 0;
  v_appointments_completed bigint := 0;
  v_appointments_cancelled bigint := 0;
  v_appointments_no_show bigint := 0;

  v_today_active bigint := 0;
  v_today_completed bigint := 0;
  v_today_in_progress bigint := 0;
  v_today_cancelled bigint := 0;
  v_today_no_show bigint := 0;

  v_monthly_series jsonb := '[]'::jsonb;
  v_weekly_series jsonb := '[]'::jsonb;
  v_service_performance jsonb := '[]'::jsonb;
  v_staff_activity jsonb := '[]'::jsonb;
  v_hourly_occupancy jsonb := '[]'::jsonb;

  v_primary_branch_id uuid;
  v_active_staff_count integer := 0;
  v_month_start date;
begin
  if not private.has_salon_permission(p_salon_id, 'dashboard.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to or (p_to - p_from) > 366 then
    raise exception 'Invalid dashboard period' using errcode = '22023';
  end if;

  if v_day_filter not in ('all', 'saturday', 'friday', 'weekday') then
    raise exception 'Invalid day filter' using errcode = '22023';
  end if;

  v_tz := private.salon_timezone(p_salon_id);
  v_today := (now() at time zone v_tz)::date;
  v_today_start := (v_today::timestamp at time zone v_tz);
  v_today_end := ((v_today + 1)::timestamp at time zone v_tz);
  v_start := (p_from::timestamp at time zone v_tz);
  v_end := ((p_to + 1)::timestamp at time zone v_tz);

  v_can_finance := private.has_salon_permission(p_salon_id, 'payments.read')
    or private.has_salon_permission(p_salon_id, 'reports.read');
  v_can_expenses := private.has_salon_permission(p_salon_id, 'expenses.read');
  v_can_appointments := private.has_salon_permission(p_salon_id, 'appointments.read')
    or private.has_salon_permission(p_salon_id, 'reports.read');

  select b.id
    into v_primary_branch_id
  from public.branches b
  where b.salon_id = p_salon_id
  order by b.created_at asc, b.id asc
  limit 1;

  select count(*)::integer
    into v_active_staff_count
  from public.staff st
  where st.salon_id = p_salon_id
    and st.is_active
    and st.is_available;

  -- 1. Encaissements, remboursements et panier moyen (période [p_from, p_to] dans v_tz)
  if v_can_finance then
    select
      coalesce(sum(private.payment_signed_amount(p.kind, p.amount)) filter (where p.status = 'confirmed'), 0)::bigint,
      coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'payment'), 0)::bigint,
      coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'refund'), 0)::bigint,
      coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'payment_reversal'), 0)::bigint,
      coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'refund_reversal'), 0)::bigint,
      coalesce(sum(p.amount) filter (where p.status = 'pending'), 0)::bigint,
      count(*) filter (where p.status = 'confirmed' and p.kind = 'payment')::bigint
    into
      v_collected_net,
      v_collected_gross,
      v_refunds,
      v_payment_reversals,
      v_refund_reversals,
      v_pending_payments,
      v_confirmed_payment_count
    from public.payments p
    where p.salon_id = p_salon_id
      and p.created_at >= v_start
      and p.created_at < v_end;

    if v_confirmed_payment_count > 0 then
      v_average_basket := round(v_collected_net::numeric / v_confirmed_payment_count)::bigint;
    else
      v_average_basket := null;
    end if;

    select coalesce(jsonb_object_agg(method_row.method, method_row.net), '{}'::jsonb)
      into v_by_method
    from (
      select p.method,
             sum(private.payment_signed_amount(p.kind, p.amount))::bigint as net
      from public.payments p
      where p.salon_id = p_salon_id
        and p.status = 'confirmed'
        and p.created_at >= v_start
        and p.created_at < v_end
      group by p.method
    ) method_row;
  end if;

  -- 2. Dépenses nettes (contrepassations déduites) et marge nette sur la même période
  if v_can_expenses then
    select coalesce(sum(private.expense_signed_amount(e.entry_kind, e.amount)), 0)::bigint
      into v_expenses_net
    from public.expenses e
    where e.salon_id = p_salon_id
      and e.spent_on between p_from and p_to;

    if v_can_finance then
      v_net_margin := v_collected_net - v_expenses_net;
    end if;
  end if;

  -- 3. Rendez-vous (facturé actif vs réalisé `completed`, annulations/absences séparées)
  if v_can_appointments then
    select
      count(*)::bigint,
      count(*) filter (where a.status not in ('cancelled', 'no_show'))::bigint,
      count(*) filter (where a.status = 'completed')::bigint,
      count(*) filter (where a.status = 'cancelled')::bigint,
      count(*) filter (where a.status = 'no_show')::bigint,
      coalesce(sum(a.amount) filter (where a.status not in ('cancelled', 'no_show')), 0)::bigint,
      coalesce(sum(a.amount) filter (where a.status = 'completed'), 0)::bigint
    into
      v_appointments_total,
      v_appointments_active,
      v_appointments_completed,
      v_appointments_cancelled,
      v_appointments_no_show,
      v_revenue_billed,
      v_revenue_realized
    from public.appointments a
    where a.salon_id = p_salon_id
      and a.starts_at >= v_start
      and a.starts_at < v_end;

    select
      count(*) filter (where a.status not in ('cancelled', 'no_show'))::bigint,
      count(*) filter (where a.status = 'completed')::bigint,
      count(*) filter (where a.status = 'in_progress')::bigint,
      count(*) filter (where a.status = 'cancelled')::bigint,
      count(*) filter (where a.status = 'no_show')::bigint
    into
      v_today_active,
      v_today_completed,
      v_today_in_progress,
      v_today_cancelled,
      v_today_no_show
    from public.appointments a
    where a.salon_id = p_salon_id
      and a.starts_at >= v_today_start
      and a.starts_at < v_today_end;

    if v_can_finance then
      select coalesce(sum(greatest(apt.amount - apt.collected_for_apt, 0)), 0)::bigint
        into v_outstanding
      from (
        select a.amount,
               coalesce((
                 select sum(private.payment_signed_amount(p.kind, p.amount))
                 from public.payments p
                 where p.appointment_id = a.id
                   and p.status = 'confirmed'
               ), 0) as collected_for_apt
        from public.appointments a
        where a.salon_id = p_salon_id
          and a.status not in ('cancelled', 'no_show')
          and a.starts_at >= v_start
          and a.starts_at < v_end
      ) apt;
    end if;

    -- Palmarès des prestations : distinction explicite réalisées (`completed`) vs facturées actives
    select coalesce(jsonb_agg(to_jsonb(srv_row) order by srv_row.completed_revenue desc, srv_row.billed_revenue desc, srv_row.name asc), '[]'::jsonb)
      into v_service_performance
    from (
      select s.id as service_id,
             s.name,
             s.category,
             s.price,
             s.duration_minutes,
             coalesce(count(a.id) filter (where a.status = 'completed'), 0)::bigint as completed_volume,
             coalesce(sum(a.amount) filter (where a.status = 'completed'), 0)::bigint as completed_revenue,
             coalesce(count(a.id) filter (where a.status not in ('cancelled', 'no_show')), 0)::bigint as billed_volume,
             coalesce(sum(a.amount) filter (where a.status not in ('cancelled', 'no_show')), 0)::bigint as billed_revenue,
             coalesce(count(a.id) filter (where a.status = 'cancelled'), 0)::bigint as cancelled_volume,
             coalesce(count(a.id) filter (where a.status = 'no_show'), 0)::bigint as no_show_volume
      from public.services s
      left join public.appointments a
        on a.salon_id = s.salon_id
       and a.service_id = s.id
       and a.starts_at >= v_start
       and a.starts_at < v_end
      where s.salon_id = p_salon_id
      group by s.id, s.name, s.category, s.price, s.duration_minutes
    ) srv_row;

    -- Activité de l'équipe sur la période (réalisés vs facturés actifs vs annulés/absents)
    select coalesce(jsonb_agg(to_jsonb(st_row) order by st_row.completed_appointments desc, st_row.name asc), '[]'::jsonb)
      into v_staff_activity
    from (
      select st.id as staff_id,
             st.name,
             st.commission_rate,
             coalesce(count(a.id) filter (where a.status = 'completed'), 0)::bigint as completed_appointments,
             coalesce(sum(a.amount) filter (where a.status = 'completed'), 0)::bigint as completed_revenue,
             coalesce(count(a.id) filter (where a.status not in ('cancelled', 'no_show')), 0)::bigint as billed_appointments,
             coalesce(sum(a.amount) filter (where a.status not in ('cancelled', 'no_show')), 0)::bigint as billed_revenue,
             coalesce(count(a.id) filter (where a.status = 'cancelled'), 0)::bigint as cancelled_appointments,
             coalesce(count(a.id) filter (where a.status = 'no_show'), 0)::bigint as no_show_appointments
      from public.staff st
      left join public.appointments a
        on a.salon_id = st.salon_id
       and a.staff_id = st.id
       and a.starts_at >= v_start
       and a.starts_at < v_end
      where st.salon_id = p_salon_id
      group by st.id, st.name, st.commission_rate
    ) st_row;

    -- Occupation horaire réelle par tranche de 30 minutes : durée des RDV actifs / capacité disponible
    with matching_days as (
      select (p_from + g.d) as day_date,
             extract(dow from (p_from + g.d))::int as weekday
      from generate_series(0, p_to - p_from) as g(d)
      where case v_day_filter
        when 'saturday' then extract(dow from (p_from + g.d))::int = 6
        when 'friday' then extract(dow from (p_from + g.d))::int = 5
        when 'weekday' then extract(dow from (p_from + g.d))::int between 1 and 4
        else true
      end
    ),
    half_hours as (
      select s_idx,
             s_idx * 30 as slot_start_min,
             (s_idx + 1) * 30 as slot_end_min,
             lpad((s_idx / 2)::text, 2, '0') || ':' || case when s_idx % 2 = 0 then '00' else '30' end as hour_label
      from generate_series(0, 47) as s_idx
    ),
    active_appts as (
      select a.id,
             a.status,
             a.starts_at,
             a.ends_at,
             (a.starts_at at time zone v_tz)::date as start_local_date,
             ((a.ends_at - interval '1 microsecond') at time zone v_tz)::date as end_local_date
      from public.appointments a
      where a.salon_id = p_salon_id
        and a.status not in ('cancelled', 'no_show')
        and a.ends_at > v_start
        and a.starts_at < v_end
    ),
    occupied_slots as (
      select h.s_idx,
             sum(
               greatest(
                 0.0,
                 extract(
                   epoch from (
                     least(a.ends_at, ((d.day_date::timestamp + make_interval(mins => h.slot_end_min)) at time zone v_tz))
                     - greatest(a.starts_at, ((d.day_date::timestamp + make_interval(mins => h.slot_start_min)) at time zone v_tz))
                   )
                 ) / 60.0
               )
             ) as occupied_minutes,
             count(distinct (a.id::text || ':' || d.day_date::text))::bigint as active_appointments,
             count(distinct (a.id::text || ':' || d.day_date::text)) filter (where a.status = 'completed')::bigint as completed_appointments
      from active_appts a
      join matching_days d
        on d.day_date between a.start_local_date and a.end_local_date
      join half_hours h
        on a.starts_at < ((d.day_date::timestamp + make_interval(mins => h.slot_end_min)) at time zone v_tz)
       and a.ends_at > ((d.day_date::timestamp + make_interval(mins => h.slot_start_min)) at time zone v_tz)
      group by h.s_idx
    ),
    weekday_counts as (
      select md.weekday, count(*)::integer as day_count
      from matching_days md
      group by md.weekday
    ),
    active_staff as (
      select st.id,
             coalesce(st.branch_id, v_primary_branch_id) as eff_branch_id,
             exists (
               select 1 from public.staff_schedules sc where sc.staff_id = st.id
             ) as has_schedules
      from public.staff st
      where st.salon_id = p_salon_id
        and st.is_active
        and st.is_available
    ),
    branch_day_windows as (
      select b.id as branch_id,
             w.weekday,
             case
               when exists (
                 select 1 from public.branch_hours bh
                 where bh.salon_id = p_salon_id and bh.branch_id = b.id
               ) then coalesce((
                 select (extract(hour from bh.opens_at)::int * 60 + extract(minute from bh.opens_at)::int)
                 from public.branch_hours bh
                 where bh.salon_id = p_salon_id
                   and bh.branch_id = b.id
                   and bh.weekday = w.weekday
                   and bh.is_open
                 limit 1
               ), 0)
               else 480
             end as open_min,
             case
               when exists (
                 select 1 from public.branch_hours bh
                 where bh.salon_id = p_salon_id and bh.branch_id = b.id
               ) then coalesce((
                 select (extract(hour from bh.closes_at)::int * 60 + extract(minute from bh.closes_at)::int)
                 from public.branch_hours bh
                 where bh.salon_id = p_salon_id
                   and bh.branch_id = b.id
                   and bh.weekday = w.weekday
                   and bh.is_open
                 limit 1
               ), 0)
               else 1200
             end as close_min
      from public.branches b
      cross join (select generate_series(0, 6) as weekday) w
      where b.salon_id = p_salon_id
    ),
    staff_weekday_slot_minutes as (
      select st.id as staff_id,
             bw.weekday,
             h.s_idx,
             case
               when bw.close_min <= bw.open_min then 0
               when not st.has_schedules then
                 greatest(0, least(bw.close_min, h.slot_end_min) - greatest(bw.open_min, h.slot_start_min))
               else least(
                 greatest(0, least(bw.close_min, h.slot_end_min) - greatest(bw.open_min, h.slot_start_min)),
                 coalesce((
                   select sum(
                     greatest(
                       0,
                       least(
                         bw.close_min,
                         (extract(hour from sc.ends_at)::int * 60 + extract(minute from sc.ends_at)::int),
                         h.slot_end_min
                       ) - greatest(
                         bw.open_min,
                         (extract(hour from sc.starts_at)::int * 60 + extract(minute from sc.starts_at)::int),
                         h.slot_start_min
                       )
                     )
                   )
                   from public.staff_schedules sc
                   where sc.staff_id = st.id and sc.weekday = bw.weekday
                 ), 0)
               )
             end as avail_min
      from active_staff st
      join branch_day_windows bw on bw.branch_id = st.eff_branch_id
      cross join half_hours h
    ),
    base_available as (
      select sw.s_idx,
             sum(sw.avail_min * wc.day_count)::bigint as base_minutes
      from staff_weekday_slot_minutes sw
      join weekday_counts wc on wc.weekday = sw.weekday
      group by sw.s_idx
    ),
    staff_absence_days as (
      select distinct st.id as staff_id, d.weekday, d.day_date
      from active_staff st
      join matching_days d on true
      where exists (
        select 1 from public.staff_absences ab
        where ab.staff_id = st.id
          and d.day_date between ab.starts_on and ab.ends_on
      )
    ),
    absent_available as (
      select sw.s_idx,
             sum(sw.avail_min)::bigint as absent_minutes
      from staff_absence_days sad
      join staff_weekday_slot_minutes sw
        on sw.staff_id = sad.staff_id and sw.weekday = sad.weekday
      group by sw.s_idx
    ),
    combined_slots as (
      select h.s_idx,
             h.hour_label,
             round(coalesce(os.occupied_minutes, 0))::bigint as occupied_minutes,
             greatest(0::bigint, coalesce(ba.base_minutes, 0) - coalesce(aa.absent_minutes, 0)) as available_minutes,
             coalesce(os.active_appointments, 0)::bigint as active_appointments,
             coalesce(os.completed_appointments, 0)::bigint as completed_appointments
      from half_hours h
      left join occupied_slots os on os.s_idx = h.s_idx
      left join base_available ba on ba.s_idx = h.s_idx
      left join absent_available aa on aa.s_idx = h.s_idx
      where coalesce(os.occupied_minutes, 0) > 0
         or greatest(0::bigint, coalesce(ba.base_minutes, 0) - coalesce(aa.absent_minutes, 0)) > 0
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'hour', cs.hour_label,
        'occupied_minutes', cs.occupied_minutes,
        'available_minutes', cs.available_minutes,
        'occupancy_rate', case
          when cs.available_minutes > 0 then least(100, round((cs.occupied_minutes::numeric / cs.available_minutes) * 100))::integer
          when cs.occupied_minutes > 0 then 100
          else 0
        end,
        'active_appointments', cs.active_appointments,
        'completed_appointments', cs.completed_appointments
      )
      order by cs.s_idx
    ), '[]'::jsonb)
      into v_hourly_occupancy
    from combined_slots cs;
  end if;

  -- 4. Série mensuelle sur [p_from, p_to] dans le fuseau du salon
  with month_buckets as (
    select to_char(m_ts::date, 'YYYY-MM') as month_key,
           greatest(m_ts::date, p_from) as b_from,
           least((m_ts::date + interval '1 month - 1 day')::date, p_to) as b_to
    from generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) as m_ts
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'month', mb.month_key,
      'from_date', mb.b_from,
      'to_date', mb.b_to,
      'revenue_collected', case
        when v_can_finance then coalesce((
          select sum(private.payment_signed_amount(p.kind, p.amount))::bigint
          from public.payments p
          where p.salon_id = p_salon_id
            and p.status = 'confirmed'
            and p.created_at >= (mb.b_from::timestamp at time zone v_tz)
            and p.created_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else null
      end,
      'revenue_billed', case
        when v_can_appointments then coalesce((
          select sum(a.amount)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status not in ('cancelled', 'no_show')
            and a.starts_at >= (mb.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else null
      end,
      'revenue_realized', case
        when v_can_appointments then coalesce((
          select sum(a.amount)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status = 'completed'
            and a.starts_at >= (mb.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else null
      end,
      'expenses', case
        when v_can_expenses then coalesce((
          select sum(private.expense_signed_amount(e.entry_kind, e.amount))::bigint
          from public.expenses e
          where e.salon_id = p_salon_id
            and e.spent_on between mb.b_from and mb.b_to
        ), 0)
        else null
      end,
      'margin', case
        when v_can_finance and v_can_expenses then (
          coalesce((
            select sum(private.payment_signed_amount(p.kind, p.amount))::bigint
            from public.payments p
            where p.salon_id = p_salon_id
              and p.status = 'confirmed'
              and p.created_at >= (mb.b_from::timestamp at time zone v_tz)
              and p.created_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
          ), 0)
          - coalesce((
            select sum(private.expense_signed_amount(e.entry_kind, e.amount))::bigint
            from public.expenses e
            where e.salon_id = p_salon_id
              and e.spent_on between mb.b_from and mb.b_to
          ), 0)
        )
        else null
      end,
      'completed_appointments', case
        when v_can_appointments then coalesce((
          select count(*)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status = 'completed'
            and a.starts_at >= (mb.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else 0
      end,
      'active_appointments', case
        when v_can_appointments then coalesce((
          select count(*)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status not in ('cancelled', 'no_show')
            and a.starts_at >= (mb.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else 0
      end,
      'cancelled_appointments', case
        when v_can_appointments then coalesce((
          select count(*)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status = 'cancelled'
            and a.starts_at >= (mb.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((mb.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else 0
      end
    )
    order by mb.month_key
  ), '[]'::jsonb)
    into v_monthly_series
  from month_buckets mb;

  -- 5. Série hebdomadaire du mois de p_to (4 semaines : 1-7, 8-14, 15-21, 22-fin de mois)
  v_month_start := date_trunc('month', p_to::timestamp)::date;
  with week_defs as (
    select 1 as idx, 'Semaine 1' as label, 'Sem 1' as short_label, v_month_start as w_from, least(v_month_start + 6, (v_month_start + interval '1 month - 1 day')::date) as w_to
    union all
    select 2, 'Semaine 2', 'Sem 2', v_month_start + 7, least(v_month_start + 13, (v_month_start + interval '1 month - 1 day')::date)
    union all
    select 3, 'Semaine 3', 'Sem 3', v_month_start + 14, least(v_month_start + 20, (v_month_start + interval '1 month - 1 day')::date)
    union all
    select 4, 'Semaine 4', 'Sem 4', v_month_start + 21, (v_month_start + interval '1 month - 1 day')::date
  ),
  clamped_weeks as (
    select idx,
           label,
           short_label,
           greatest(w_from, p_from) as b_from,
           least(w_to, p_to) as b_to
    from week_defs
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label', cw.label,
      'short_label', cw.short_label,
      'from_date', cw.b_from,
      'to_date', cw.b_to,
      'revenue_collected', case
        when v_can_finance and cw.b_from <= cw.b_to then coalesce((
          select sum(private.payment_signed_amount(p.kind, p.amount))::bigint
          from public.payments p
          where p.salon_id = p_salon_id
            and p.status = 'confirmed'
            and p.created_at >= (cw.b_from::timestamp at time zone v_tz)
            and p.created_at < ((cw.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        when v_can_finance then 0
        else null
      end,
      'revenue_billed', case
        when v_can_appointments and cw.b_from <= cw.b_to then coalesce((
          select sum(a.amount)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status not in ('cancelled', 'no_show')
            and a.starts_at >= (cw.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((cw.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        when v_can_appointments then 0
        else null
      end,
      'revenue_realized', case
        when v_can_appointments and cw.b_from <= cw.b_to then coalesce((
          select sum(a.amount)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status = 'completed'
            and a.starts_at >= (cw.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((cw.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        when v_can_appointments then 0
        else null
      end,
      'expenses', case
        when v_can_expenses and cw.b_from <= cw.b_to then coalesce((
          select sum(private.expense_signed_amount(e.entry_kind, e.amount))::bigint
          from public.expenses e
          where e.salon_id = p_salon_id
            and e.spent_on between cw.b_from and cw.b_to
        ), 0)
        when v_can_expenses then 0
        else null
      end,
      'margin', case
        when v_can_finance and v_can_expenses and cw.b_from <= cw.b_to then (
          coalesce((
            select sum(private.payment_signed_amount(p.kind, p.amount))::bigint
            from public.payments p
            where p.salon_id = p_salon_id
              and p.status = 'confirmed'
              and p.created_at >= (cw.b_from::timestamp at time zone v_tz)
              and p.created_at < ((cw.b_to + 1)::timestamp at time zone v_tz)
          ), 0)
          - coalesce((
            select sum(private.expense_signed_amount(e.entry_kind, e.amount))::bigint
            from public.expenses e
            where e.salon_id = p_salon_id
              and e.spent_on between cw.b_from and cw.b_to
          ), 0)
        )
        when v_can_finance and v_can_expenses then 0
        else null
      end,
      'completed_appointments', case
        when v_can_appointments and cw.b_from <= cw.b_to then coalesce((
          select count(*)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status = 'completed'
            and a.starts_at >= (cw.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((cw.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else 0
      end,
      'active_appointments', case
        when v_can_appointments and cw.b_from <= cw.b_to then coalesce((
          select count(*)::bigint
          from public.appointments a
          where a.salon_id = p_salon_id
            and a.status not in ('cancelled', 'no_show')
            and a.starts_at >= (cw.b_from::timestamp at time zone v_tz)
            and a.starts_at < ((cw.b_to + 1)::timestamp at time zone v_tz)
        ), 0)
        else 0
      end
    )
    order by cw.idx
  ), '[]'::jsonb)
    into v_weekly_series
  from clamped_weeks cw;

  return jsonb_build_object(
    'period_from', p_from,
    'period_to', p_to,
    'timezone', v_tz,
    'today', v_today,
    'day_filter', v_day_filter,
    'configured_staff_count', v_active_staff_count,
    'permissions', jsonb_build_object(
      'can_view_finance', v_can_finance,
      'can_view_expenses', v_can_expenses,
      'can_view_appointments', v_can_appointments
    ),
    'kpis', jsonb_build_object(
      'revenue_collected_net', v_collected_net,
      'revenue_collected_gross', v_collected_gross,
      'refunds', v_refunds,
      'payment_reversals', v_payment_reversals,
      'refund_reversals', v_refund_reversals,
      'pending_payments_amount', v_pending_payments,
      'confirmed_payment_count', v_confirmed_payment_count,
      'average_basket', v_average_basket,
      'revenue_billed', v_revenue_billed,
      'revenue_realized', v_revenue_realized,
      'outstanding', v_outstanding,
      'expenses_net', v_expenses_net,
      'net_margin', v_net_margin,
      'appointments_total', v_appointments_total,
      'appointments_active', v_appointments_active,
      'appointments_completed', v_appointments_completed,
      'appointments_cancelled', v_appointments_cancelled,
      'appointments_no_show', v_appointments_no_show,
      'today_appointments_active', v_today_active,
      'today_appointments_completed', v_today_completed,
      'today_appointments_in_progress', v_today_in_progress,
      'today_appointments_cancelled', v_today_cancelled,
      'today_appointments_no_show', v_today_no_show
    ),
    'by_method', v_by_method,
    'monthly_series', v_monthly_series,
    'weekly_series', v_weekly_series,
    'service_performance', v_service_performance,
    'staff_activity', v_staff_activity,
    'hourly_occupancy', v_hourly_occupancy
  );
end;
$$;
revoke all on function public.erp_dashboard_metrics(uuid, date, date, text) from public, anon;
grant execute on function public.erp_dashboard_metrics(uuid, date, date, text) to authenticated;
