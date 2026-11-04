-- Lot 7 — réservation en ligne publique (anon) sur salons publiés.
-- Réutilise private.is_slot_available (Lot 5) : mêmes horaires succursale,
-- horaires/absences staff et anti-chevauchement que le planning interne.
-- Un rendez-vous marketplace naît « pending » : le salon le confirme ensuite.
-- Le client reçoit un jeton d'annulation secret, jamais exposé en lecture publique.

alter table public.appointments
  add column if not exists client_email text,
  add column if not exists public_cancel_token uuid not null default gen_random_uuid(),
  add column if not exists public_idempotency_key uuid;
create unique index if not exists appointments_public_idempotency
  on public.appointments (salon_id, public_idempotency_key)
  where public_idempotency_key is not null;
create index if not exists appointments_public_token_idx on public.appointments (public_cancel_token);

-- Les événements marketplace sont créés par le système (acteur anonyme nul).
alter table public.appointment_events alter column actor_id drop not null;

create function public.marketplace_day_availability(
  p_salon_id uuid,
  p_date date,
  p_service_id uuid default null,
  p_staff_id uuid default null
)
returns table (staff_id uuid, starts_at timestamptz, available boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_minutes integer := 30;
  v_published boolean;
begin
  select s.is_published into v_published from public.salons s where s.id = p_salon_id;
  if not coalesce(v_published, false) then
    raise exception 'Salon not found or not published' using errcode = '22023';
  end if;
  if p_date is null or p_date < (now() at time zone 'Africa/Abidjan')::date
    or p_date > (now() at time zone 'Africa/Abidjan')::date + 60 then
    raise exception 'Invalid date' using errcode = '22023';
  end if;
  if p_service_id is not null then
    select sv.duration_minutes + sv.prep_minutes into v_minutes
      from public.services sv
      where sv.id = p_service_id and sv.salon_id = p_salon_id and sv.is_active;
    if not found then
      raise exception 'Service unavailable' using errcode = '22023';
    end if;
  end if;

  return query
  select st.id,
         slot.starts_at,
         private.is_slot_available(
           p_salon_id, st.branch_id, st.id, slot.starts_at,
           slot.starts_at + make_interval(mins => v_minutes), null)
  from public.staff st
  left join public.branches b on b.salon_id = st.salon_id and b.id = st.branch_id
  cross join lateral (
    select (p_date::timestamp + make_interval(hours => g.h))
             at time zone coalesce(b.timezone, 'Africa/Abidjan') as starts_at
    from generate_series(8, 19) as g(h)
  ) slot
  where st.salon_id = p_salon_id and st.is_active and st.is_available
    and (p_staff_id is null or st.id = p_staff_id)
    and (p_service_id is null or array_length(st.service_ids, 1) is null or p_service_id = any(st.service_ids))
  order by st.name, slot.starts_at;
end;
$$;
revoke all on function public.marketplace_day_availability(uuid, date, uuid, uuid) from public;
grant execute on function public.marketplace_day_availability(uuid, date, uuid, uuid) to anon, authenticated;

create function private.marketplace_booking_summary(p_appointment public.appointments)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_appointment.id,
    'salon_id', p_appointment.salon_id,
    'status', p_appointment.status,
    'payment_status', p_appointment.payment_status,
    'client_name', p_appointment.client_name,
    'service_name', p_appointment.service_name,
    'staff_name', p_appointment.staff_name,
    'starts_at', p_appointment.starts_at,
    'ends_at', p_appointment.ends_at,
    'amount', p_appointment.amount,
    'currency', p_appointment.currency,
    'source', p_appointment.source,
    'cancel_token', p_appointment.public_cancel_token
  )
$$;

create function public.marketplace_book_appointment(
  p_salon_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_idempotency_key uuid,
  p_staff_id uuid default null,
  p_client_email text default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_service public.services;
  v_staff public.staff;
  v_existing public.appointments;
  v_row public.appointments;
  v_branch uuid;
  v_ends timestamptz;
  v_name text := btrim(coalesce(p_client_name, ''));
  v_phone text := btrim(coalesce(p_client_phone, ''));
  v_email text := nullif(lower(btrim(coalesce(p_client_email, ''))), '');
  v_notes text := btrim(coalesce(p_notes, ''));
  v_staff_id uuid := p_staff_id;
  v_recent integer;
begin
  if p_idempotency_key is null then
    raise exception 'Idempotency key required' using errcode = '22023';
  end if;
  select * into v_salon from public.salons where id = p_salon_id;
  if not found or not v_salon.is_published then
    raise exception 'Salon not found or not published' using errcode = '22023';
  end if;

  select * into v_existing from public.appointments
    where salon_id = p_salon_id and public_idempotency_key = p_idempotency_key;
  if found then
    return private.marketplace_booking_summary(v_existing);
  end if;

  if char_length(v_name) not between 1 and 120
    or char_length(v_phone) not between 3 and 40
    or char_length(v_notes) > 500 then
    raise exception 'Invalid client details' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  if p_starts_at is null
    or p_starts_at < now() + interval '5 minutes'
    or p_starts_at > now() + interval '60 days' then
    raise exception 'Invalid booking time' using errcode = '22023';
  end if;

  -- Garde-fou anti-abus simple : 5 résolutions marketplace / téléphone / jour.
  select count(*) into v_recent from public.appointments a
    where a.salon_id = p_salon_id and a.source = 'marketplace'
      and a.client_phone = v_phone and a.created_at > now() - interval '1 day';
  if v_recent >= 5 then
    raise exception 'Too many recent bookings for this phone number' using errcode = '22023';
  end if;

  select * into v_service from public.services
    where id = p_service_id and salon_id = p_salon_id and is_active;
  if not found then
    raise exception 'Service unavailable' using errcode = '22023';
  end if;
  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes + v_service.prep_minutes);

  if v_staff_id is null then
    select st.id into v_staff_id
      from public.staff st
     where st.salon_id = p_salon_id and st.is_active and st.is_available
       and (array_length(st.service_ids, 1) is null or p_service_id = any(st.service_ids))
       and private.is_slot_available(p_salon_id, st.branch_id, st.id, p_starts_at, v_ends, null)
     order by st.name
     limit 1;
    if v_staff_id is null then
      raise exception 'Slot unavailable' using errcode = '23P01';
    end if;
  end if;

  select * into v_staff from public.staff
    where id = v_staff_id and salon_id = p_salon_id for update;
  if not found or not v_staff.is_active or not v_staff.is_available then
    raise exception 'Staff unavailable' using errcode = '22023';
  end if;
  if array_length(v_staff.service_ids, 1) is not null and not (p_service_id = any(v_staff.service_ids)) then
    raise exception 'Staff does not perform this service' using errcode = '22023';
  end if;

  v_branch := v_staff.branch_id;
  if v_branch is null then
    select b.id into v_branch from public.branches b
      where b.salon_id = p_salon_id order by b.created_at limit 1;
  end if;
  if v_branch is null then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  if not private.is_slot_available(p_salon_id, v_branch, v_staff_id, p_starts_at, v_ends, null) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;

  insert into public.appointments(
    salon_id, branch_id, staff_id, service_id, client_name, client_phone, client_email,
    service_name, staff_name, starts_at, ends_at, amount, currency, source, status,
    payment_status, notes, created_by, public_idempotency_key
  ) values (
    p_salon_id, v_branch, v_staff_id, p_service_id, v_name, v_phone, v_email,
    v_service.name, v_staff.name, p_starts_at, v_ends, v_service.price, 'XOF', 'marketplace', 'pending',
    'unpaid', v_notes, null, p_idempotency_key
  ) returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, new_status, reason, actor_id)
    values (p_salon_id, v_branch, v_row.id, 'pending', 'Réservation en ligne', null);

  return private.marketplace_booking_summary(v_row);
end;
$$;
revoke all on function public.marketplace_book_appointment(uuid, uuid, timestamptz, text, text, uuid, uuid, text, text) from public;
grant execute on function public.marketplace_book_appointment(uuid, uuid, timestamptz, text, text, uuid, uuid, text, text) to anon, authenticated;

create function public.marketplace_get_booking(
  p_salon_id uuid, p_appointment_id uuid, p_cancel_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select * into v_row from public.appointments
    where id = p_appointment_id and salon_id = p_salon_id and public_cancel_token = p_cancel_token;
  if not found then
    raise exception 'Booking not found' using errcode = '22023';
  end if;
  return private.marketplace_booking_summary(v_row);
end;
$$;
revoke all on function public.marketplace_get_booking(uuid, uuid, uuid) from public;
grant execute on function public.marketplace_get_booking(uuid, uuid, uuid) to anon, authenticated;

create function public.marketplace_cancel_booking(
  p_salon_id uuid, p_appointment_id uuid, p_cancel_token uuid, p_reason text default 'Annulé par le client'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_previous text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'Invalid cancellation reason' using errcode = '22023';
  end if;
  select * into v_row from public.appointments
    where id = p_appointment_id and salon_id = p_salon_id and public_cancel_token = p_cancel_token
    for update;
  if not found then
    raise exception 'Booking not found' using errcode = '22023';
  end if;
  if v_row.status not in ('pending', 'confirmed') then
    raise exception 'Booking cannot be cancelled' using errcode = '22023';
  end if;
  v_previous := v_row.status;
  update public.appointments set status = 'cancelled', updated_at = now()
    where id = v_row.id returning * into v_row;
  insert into public.appointment_events(salon_id, branch_id, appointment_id, previous_status, new_status, reason, actor_id)
    values (p_salon_id, v_row.branch_id, v_row.id, v_previous, 'cancelled', v_reason, null);
  return private.marketplace_booking_summary(v_row);
end;
$$;
revoke all on function public.marketplace_cancel_booking(uuid, uuid, uuid, text) from public;
grant execute on function public.marketplace_cancel_booking(uuid, uuid, uuid, text) to anon, authenticated;
