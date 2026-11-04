-- LOT 3 — Finitions opérationnelles.
-- 1) prep_minutes entre dans le calcul du créneau : la fin du créneau réservé
--    est désormais déduite par le serveur (début + durée + préparation), quelle
--    que soit la valeur envoyée par le client.
-- 2) Écran de configuration des horaires d'ouverture par succursale (bc_branch_hours).

-- ---------------------------------------------------------------------------
-- 1.1) bc_save_service : persiste prep_minutes (0-120).
-- ---------------------------------------------------------------------------
drop function if exists public.bc_save_service(uuid,uuid,text,text,text,bigint,integer,boolean);

create function public.bc_save_service(
  p_salon uuid, p_id uuid, p_name text, p_category text, p_description text,
  p_price bigint, p_duration integer, p_popular boolean, p_prep_minutes integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'catalog.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'Invalid price' using errcode = '22023';
  end if;
  if p_duration is null or p_duration not between 5 and 600 then
    raise exception 'Invalid duration' using errcode = '22023';
  end if;
  if p_prep_minutes is null or p_prep_minutes not between 0 and 120 then
    raise exception 'Invalid prep time' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.bc_services(salon_id,name,category,description,price,duration_minutes,prep_minutes,popular)
    values(p_salon,btrim(p_name),p_category,coalesce(p_description,''),p_price,p_duration,coalesce(p_prep_minutes,0),coalesce(p_popular,false))
    returning id into v_id;
  else
    update public.bc_services set name=btrim(p_name), category=p_category,
      description=coalesce(p_description,''), price=p_price, duration_minutes=p_duration,
      prep_minutes=coalesce(p_prep_minutes,0), popular=coalesce(p_popular,false), updated_at=now()
    where id=p_id and salon_id=p_salon returning id into v_id;
    if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.bc_save_service(uuid,uuid,text,text,text,bigint,integer,boolean,integer) from public;
grant execute on function public.bc_save_service(uuid,uuid,text,text,text,bigint,integer,boolean,integer) to bc_app;

-- ---------------------------------------------------------------------------
-- 1.2) bc_book_appointment : ends_at calculé par le serveur (durée + prep).
-- ---------------------------------------------------------------------------
create or replace function public.bc_book_appointment(
  p_salon uuid, p_branch uuid, p_client uuid, p_staff uuid, p_service uuid,
  p_starts timestamptz, p_ends timestamptz, p_notes text, p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_client public.bc_clients%rowtype;
  v_service public.bc_services%rowtype;
  v_staff public.bc_staff%rowtype;
  v_ends timestamptz;
begin
  if not barber_private.has_salon_permission(p_salon, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_starts is null then
    raise exception 'Invalid time range' using errcode = '22023';
  end if;
  if p_source not in ('direct', 'phone', 'whatsapp') then
    raise exception 'Invalid source' using errcode = '22023';
  end if;

  select * into v_service from public.bc_services
   where id = p_service and salon_id = p_salon and is_active;
  if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;

  -- Fin du créneau réservée = début + durée de la prestation + temps de
  -- préparation. Le serveur est le seul juge : la valeur envoyée par le client
  -- (p_ends) est ignorée au profit de ce calcul cohérent.
  v_ends := p_starts + (v_service.duration_minutes + coalesce(v_service.prep_minutes, 0)) * interval '1 minute';
  if v_ends <= p_starts then
    raise exception 'Invalid time range' using errcode = '22023';
  end if;

  -- « Sans préférence » : le serveur choisit un employé compétent et disponible.
  if p_staff is null then
    select s.id into p_staff
      from public.bc_staff s
     where s.salon_id = p_salon and s.is_active and s.is_available
       and (array_length(s.service_ids, 1) is null or p_service = any(s.service_ids))
       and barber_private.is_slot_available(p_salon, p_branch, s.id, p_starts, v_ends, null)
     order by s.name
     limit 1;
    if p_staff is null then
      raise exception 'Slot unavailable' using errcode = '23P01';
    end if;
  end if;

  select * into v_client from public.bc_clients where id = p_client and salon_id = p_salon;
  if not found then raise exception 'Client not found' using errcode = '22023'; end if;

  if p_staff is null then
    raise exception 'Staff required' using errcode = '22023';
  end if;

  -- Verrou explicite sur l'employé : sérialise deux réservations concurrentes.
  select * into v_staff from public.bc_staff where id = p_staff and salon_id = p_salon for update;
  if not found or not v_staff.is_active or not v_staff.is_available then
    raise exception 'Staff unavailable' using errcode = '22023';
  end if;
  if array_length(v_staff.service_ids, 1) is not null and not (p_service = any(v_staff.service_ids)) then
    raise exception 'Staff does not perform this service' using errcode = '22023';
  end if;

  if not barber_private.is_slot_available(p_salon, p_branch, p_staff, p_starts, v_ends, null) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;

  insert into public.bc_appointments(
    salon_id, branch_id, client_id, staff_id, service_id, client_name, service_name,
    starts_at, ends_at, amount, currency, source, status, notes, created_by)
  values (
    p_salon, p_branch, p_client, p_staff, p_service, v_client.name, v_service.name,
    p_starts, v_ends, v_service.price, 'XOF', p_source, 'confirmed', coalesce(btrim(p_notes), ''),
    barber_private.current_user_id())
  returning id into v_id;

  insert into public.bc_appointment_events(salon_id, branch_id, appointment_id, new_status, actor_id)
  values (p_salon, p_branch, v_id, 'confirmed', barber_private.current_user_id());
  return v_id;
end $$;
revoke all on function public.bc_book_appointment(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text) from public;
grant execute on function public.bc_book_appointment(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text) to bc_app;


-- ---------------------------------------------------------------------------
-- 1.3) bc_reschedule_appointment : fin du créneau recalculée (durée + prep).
-- ---------------------------------------------------------------------------
create or replace function public.bc_reschedule_appointment(
  p_id uuid, p_staff uuid, p_service uuid, p_starts timestamptz, p_ends timestamptz, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.bc_appointments%rowtype;
  v_service public.bc_services%rowtype;
  v_ends timestamptz;
begin
  select * into a from public.bc_appointments where id = p_id for update;
  if not found or not barber_private.has_salon_permission(a.salon_id, 'appointments.write') then
    raise exception 'Not found or not authorized' using errcode = '42501';
  end if;
  if a.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Appointment is closed' using errcode = '22023';
  end if;
  select * into v_service from public.bc_services where id = p_service and salon_id = a.salon_id and is_active;
  if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;

  v_ends := p_starts + (v_service.duration_minutes + coalesce(v_service.prep_minutes, 0)) * interval '1 minute';
  if v_ends <= p_starts then
    raise exception 'Invalid time range' using errcode = '22023';
  end if;

  if not barber_private.is_slot_available(a.salon_id, a.branch_id, p_staff, p_starts, v_ends, a.id) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;
  update public.bc_appointments set
    staff_id = p_staff, service_id = p_service, service_name = v_service.name,
    starts_at = p_starts, ends_at = v_ends, amount = v_service.price,
    notes = coalesce(btrim(p_notes), ''), updated_at = now()
  where id = a.id;
end $$;
revoke all on function public.bc_reschedule_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text) from public;
grant execute on function public.bc_reschedule_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text) to bc_app;

-- ---------------------------------------------------------------------------
-- 2) bc_save_branch_hours : configuration des horaires d'ouverture par
--    succursale (permission branch.update : owner / manager).
-- ---------------------------------------------------------------------------
create function public.bc_save_branch_hours(
  p_salon uuid, p_branch uuid, p_weekday integer, p_opens_at time,
  p_closes_at time, p_is_open boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'branch.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_weekday is null or p_weekday not between 0 and 6 then
    raise exception 'Invalid weekday' using errcode = '22023';
  end if;
  -- Fermer le jour : on supprime la plage (jour non ouvrable).
  if not p_is_open then
    delete from public.bc_branch_hours
    where salon_id = p_salon and branch_id = p_branch and weekday = p_weekday;
    return;
  end if;
  if p_opens_at is null or p_closes_at is null or p_closes_at <= p_opens_at then
    raise exception 'Invalid opening hours' using errcode = '22023';
  end if;
  insert into public.bc_branch_hours(salon_id, branch_id, weekday, opens_at, closes_at, is_open)
  values(p_salon, p_branch, p_weekday, p_opens_at, p_closes_at, true)
  on conflict (branch_id, weekday) do update
    set opens_at = excluded.opens_at,
        closes_at = excluded.closes_at,
        is_open = excluded.is_open;
end $$;
revoke all on function public.bc_save_branch_hours(uuid,uuid,integer,time,time,boolean) from public;
grant execute on function public.bc_save_branch_hours(uuid,uuid,integer,time,time,boolean) to bc_app;

