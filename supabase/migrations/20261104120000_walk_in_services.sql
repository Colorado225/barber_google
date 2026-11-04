-- Clients de passage (« sans rendez-vous »).
-- Objectif : permettre l'accueil au comptoir, la file d'attente, le démarrage
-- immédiat ou différé, la fin de prestation puis l'encaissement en caisse.
--
-- Règles :
--   * source = 'walk_in', arrivée tracée (arrival_at) ;
--   * nom/téléphone optionnels ; un client CRM existant peut être lié ;
--   * aucun créneau futur n'est exigé et la grille de réservation n'est pas
--     utilisée pour l'accueil ; en revanche un même coiffeur ne peut pas avoir
--     deux prestations actives qui se chevauchent ;
--   * toutes les écritures passent par des RPC SECURITY DEFINER contrôlant
--     appointments.write ; l'historique reste append-only ;
--   * l'encaissement réutilise le journal de caisse existant (record_payment).

alter table public.appointments drop constraint if exists appointments_source_check;
alter table public.appointments add constraint appointments_source_check
  check (source in ('marketplace', 'direct', 'whatsapp', 'phone', 'walk_in'));

alter table public.appointments
  add column if not exists arrival_at timestamptz,
  add column if not exists service_started_at timestamptz,
  add column if not exists service_completed_at timestamptz,
  add column if not exists walk_in_idempotency_key uuid;

create unique index if not exists appointments_walk_in_idempotency
  on public.appointments (salon_id, walk_in_idempotency_key)
  where walk_in_idempotency_key is not null;
create index if not exists appointments_walk_in_queue_idx
  on public.appointments (salon_id, arrival_at)
  where source = 'walk_in';

alter table public.appointments drop constraint if exists appointments_walk_in_arrival;
alter table public.appointments add constraint appointments_walk_in_arrival
  check (source <> 'walk_in' or arrival_at is not null);
alter table public.appointments drop constraint if exists appointments_walk_in_key_source;
alter table public.appointments add constraint appointments_walk_in_key_source
  check (walk_in_idempotency_key is null or source = 'walk_in');

-- Un service terminé ne doit plus bloquer le coiffeur : on aligne la contrainte
-- d'exclusion et la disponibilité interne sur les statuts réellement actifs.
alter table public.appointments drop constraint if exists appointments_no_overlap;
do $$
begin
  create extension if not exists btree_gist;
  alter table public.appointments
    add constraint appointments_no_overlap
    exclude using gist (
      salon_id with =,
      staff_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (staff_id is not null and status not in ('cancelled', 'no_show', 'completed'));
exception
  when undefined_file or insufficient_privilege or feature_not_supported then
    raise notice 'btree_gist indisponible : anti-chevauchement assuré par les fonctions SQL';
end $$;

create or replace function private.is_slot_available(
  p_salon uuid, p_branch uuid, p_staff uuid,
  p_start timestamptz, p_end timestamptz, p_ignore uuid default null)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_weekday integer;
  v_date date;
  v_start_time time;
  v_end_time time;
  v_tz text;
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return false;
  end if;

  select coalesce(b.timezone, 'Africa/Abidjan') into v_tz
  from public.branches b where b.salon_id = p_salon and b.id = p_branch;
  v_tz := coalesce(v_tz, 'Africa/Abidjan');

  v_date := (p_start at time zone v_tz)::date;
  v_weekday := extract(dow from (p_start at time zone v_tz))::int;
  v_start_time := (p_start at time zone v_tz)::time;
  v_end_time := (p_end at time zone v_tz)::time;

  if p_branch is not null then
    if not exists (
      select 1 from public.branch_hours h
      where h.salon_id = p_salon and h.branch_id = p_branch and h.weekday = v_weekday
        and h.is_open and h.opens_at is not null and h.closes_at is not null
        and v_start_time >= h.opens_at and v_end_time <= h.closes_at
    ) then
      if exists (
        select 1 from public.branch_hours h where h.salon_id = p_salon and h.branch_id = p_branch
      ) then
        return false;
      end if;
    end if;
  end if;

  if p_staff is null then
    return true;
  end if;

  if not exists (
    select 1 from public.staff s
    where s.id = p_staff and s.salon_id = p_salon and s.is_active
      and (p_branch is null or s.branch_id is null or s.branch_id = p_branch)
  ) then
    return false;
  end if;

  if exists (select 1 from public.staff_schedules sc where sc.staff_id = p_staff) then
    if not exists (
      select 1 from public.staff_schedules sc
      where sc.staff_id = p_staff and sc.weekday = v_weekday
        and v_start_time >= sc.starts_at and v_end_time <= sc.ends_at
    ) then
      return false;
    end if;
  end if;

  if exists (
    select 1 from public.staff_absences a
    where a.staff_id = p_staff and v_date between a.starts_on and a.ends_on
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.appointments ap
    where ap.salon_id = p_salon and ap.staff_id = p_staff
      and ap.status not in ('cancelled', 'no_show', 'completed')
      and (p_ignore is null or ap.id <> p_ignore)
      and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(p_start, p_end)
  ) then
    return false;
  end if;

  return true;
end $$;
revoke all on function private.is_slot_available(uuid, uuid, uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;

-- Accueil : enregistre une arrivée. p_start_immediately = false place le client
-- en attente (checked_in) ; true démarre la prestation (in_progress) si un
-- coiffeur compétent est libre maintenant. Sans coiffeur explicite en attente,
-- le client reste non attribué dans la file.
create function public.register_walk_in(
  p_salon_id uuid,
  p_service_id uuid,
  p_idempotency_key uuid,
  p_client_name text default null,
  p_client_phone text default null,
  p_client_id uuid default null,
  p_staff_id uuid default null,
  p_branch_id uuid default null,
  p_start_immediately boolean default false,
  p_notes text default ''
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments%rowtype;
  v_existing public.appointments%rowtype;
  v_service public.services%rowtype;
  v_staff public.staff%rowtype;
  v_client public.clients%rowtype;
  v_branch uuid;
  v_staff_id uuid := p_staff_id;
  v_staff_name text := '';
  v_name text;
  v_phone text;
  v_now timestamptz := clock_timestamp();
  v_ends timestamptz;
  v_status text := 'checked_in';
  v_started timestamptz;
begin
  if not private.has_salon_permission(p_salon_id, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key required' using errcode = '22023';
  end if;

  select * into v_existing from public.appointments
    where salon_id = p_salon_id and walk_in_idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_service from public.services
    where id = p_service_id and salon_id = p_salon_id and is_active;
  if not found then
    raise exception 'Service unavailable' using errcode = '22023';
  end if;
  v_ends := v_now + make_interval(mins => v_service.duration_minutes + v_service.prep_minutes);

  if p_client_id is not null then
    select * into v_client from public.clients where id = p_client_id and salon_id = p_salon_id;
    if not found then
      raise exception 'Client not found' using errcode = '22023';
    end if;
    v_name := v_client.name;
    v_phone := v_client.phone;
  else
    v_name := coalesce(nullif(btrim(p_client_name), ''), 'Client de passage');
    v_phone := coalesce(btrim(p_client_phone), '');
    if char_length(v_name) not between 1 and 120 then
      raise exception 'Invalid client name' using errcode = '22023';
    end if;
    if v_phone <> '' and char_length(v_phone) not between 3 and 40 then
      raise exception 'Invalid client phone' using errcode = '22023';
    end if;
  end if;

  v_branch := p_branch_id;
  if v_branch is null and v_staff_id is not null then
    select s.branch_id into v_branch from public.staff s where s.id = v_staff_id and s.salon_id = p_salon_id;
  end if;
  if v_branch is null then
    select b.id into v_branch from public.branches b where b.salon_id = p_salon_id order by b.created_at limit 1;
  end if;
  if v_branch is null or not exists (
    select 1 from public.branches b where b.id = v_branch and b.salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;

  if p_start_immediately then
    v_status := 'in_progress';
    v_started := v_now;
    if v_staff_id is null then
      select s.id into v_staff_id
        from public.staff s
       where s.salon_id = p_salon_id and s.is_active and s.is_available
         and (s.branch_id is null or s.branch_id = v_branch)
         and (array_length(s.service_ids, 1) is null or p_service_id = any(s.service_ids))
         and not exists (
           select 1 from public.appointments ap
            where ap.salon_id = p_salon_id and ap.staff_id = s.id
              and ap.status not in ('cancelled', 'no_show', 'completed')
              and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(v_now, v_ends)
         )
       order by s.name
       limit 1;
      if v_staff_id is null then
        raise exception 'No staff available now; place the client in the waiting queue' using errcode = '23P01';
      end if;
    end if;
  end if;

  if v_staff_id is not null then
    select * into v_staff from public.staff
      where id = v_staff_id and salon_id = p_salon_id for update;
    if not found or not v_staff.is_active or not v_staff.is_available then
      raise exception 'Staff unavailable' using errcode = '22023';
    end if;
    if v_staff.branch_id is not null and v_staff.branch_id <> v_branch then
      raise exception 'Staff belongs to another branch' using errcode = '22023';
    end if;
    if array_length(v_staff.service_ids, 1) is not null and not (p_service_id = any(v_staff.service_ids)) then
      raise exception 'Staff does not perform this service' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.appointments ap
       where ap.salon_id = p_salon_id and ap.staff_id = v_staff_id
         and ap.status not in ('cancelled', 'no_show', 'completed')
         and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(v_now, v_ends)
    ) then
      raise exception 'Staff busy; place the client in the waiting queue' using errcode = '23P01';
    end if;
    v_staff_name := v_staff.name;
  end if;

  insert into public.appointments(
    salon_id, branch_id, client_id, staff_id, service_id, client_name, client_phone,
    service_name, staff_name, starts_at, ends_at, amount, currency, source, status,
    payment_status, notes, created_by, arrival_at, service_started_at, walk_in_idempotency_key
  ) values (
    p_salon_id, v_branch, p_client_id, v_staff_id, p_service_id, v_name, v_phone,
    v_service.name, v_staff_name, v_now, v_ends, v_service.price, 'XOF', 'walk_in', v_status,
    'unpaid', left(btrim(coalesce(p_notes, '')), 500), (select auth.uid()), v_now, v_started, p_idempotency_key
  ) returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, new_status, reason, actor_id)
    values (p_salon_id, v_branch, v_row.id, v_status,
            case when p_start_immediately then 'Démarrage immédiat sans rendez-vous' else 'Arrivée sans rendez-vous' end,
            (select auth.uid()));

  return v_row;
end;
$$;
revoke all on function public.register_walk_in(uuid, uuid, uuid, text, text, uuid, uuid, uuid, boolean, text) from public, anon;
grant execute on function public.register_walk_in(uuid, uuid, uuid, text, text, uuid, uuid, uuid, boolean, text) to authenticated;

-- Démarrage depuis la file d'attente : réaffecte éventuellement un coiffeur,
-- recalcule la fenêtre réelle et empêche le chevauchement avec un autre service
-- actif du même coiffeur.
create function public.start_walk_in(
  p_salon_id uuid,
  p_appointment_id uuid,
  p_staff_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments%rowtype;
  v_row public.appointments%rowtype;
  v_staff public.staff%rowtype;
  v_service public.services%rowtype;
  v_staff_id uuid;
  v_now timestamptz := clock_timestamp();
  v_ends timestamptz;
begin
  select * into a from public.appointments
    where id = p_appointment_id and salon_id = p_salon_id for update;
  if not found or not private.has_salon_permission(p_salon_id, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if a.source <> 'walk_in' then
    raise exception 'Not a walk-in' using errcode = '22023';
  end if;
  if a.status = 'in_progress' then
    return a;
  end if;
  if a.status <> 'checked_in' then
    raise exception 'Walk-in cannot be started from this status' using errcode = '22023';
  end if;

  select * into v_service from public.services where id = a.service_id and salon_id = p_salon_id;
  if not found then
    raise exception 'Service unavailable' using errcode = '22023';
  end if;
  v_ends := v_now + make_interval(mins => v_service.duration_minutes + v_service.prep_minutes);

  v_staff_id := coalesce(p_staff_id, a.staff_id);
  if v_staff_id is null then
    select s.id into v_staff_id
      from public.staff s
     where s.salon_id = p_salon_id and s.is_active and s.is_available
       and (s.branch_id is null or s.branch_id = a.branch_id)
       and (array_length(s.service_ids, 1) is null or a.service_id = any(s.service_ids))
       and not exists (
         select 1 from public.appointments ap
          where ap.salon_id = p_salon_id and ap.staff_id = s.id and ap.id <> a.id
            and ap.status not in ('cancelled', 'no_show', 'completed')
            and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(v_now, v_ends)
       )
     order by s.name limit 1;
    if v_staff_id is null then
      raise exception 'No staff available now' using errcode = '23P01';
    end if;
  end if;

  select * into v_staff from public.staff where id = v_staff_id and salon_id = p_salon_id for update;
  if not found or not v_staff.is_active or not v_staff.is_available then
    raise exception 'Staff unavailable' using errcode = '22023';
  end if;
  if v_staff.branch_id is not null and v_staff.branch_id <> a.branch_id then
    raise exception 'Staff belongs to another branch' using errcode = '22023';
  end if;
  if array_length(v_staff.service_ids, 1) is not null and not (a.service_id = any(v_staff.service_ids)) then
    raise exception 'Staff does not perform this service' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.appointments ap
     where ap.salon_id = p_salon_id and ap.staff_id = v_staff_id and ap.id <> a.id
       and ap.status not in ('cancelled', 'no_show', 'completed')
       and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(v_now, v_ends)
  ) then
    raise exception 'Staff busy' using errcode = '23P01';
  end if;

  update public.appointments set
    staff_id = v_staff_id,
    staff_name = v_staff.name,
    starts_at = v_now,
    ends_at = v_ends,
    status = 'in_progress',
    service_started_at = v_now,
    updated_at = v_now
  where id = a.id returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, previous_status, new_status, reason, actor_id)
    values (p_salon_id, v_row.branch_id, v_row.id, a.status, 'in_progress', 'Démarrage sans rendez-vous', (select auth.uid()));
  return v_row;
end;
$$;
revoke all on function public.start_walk_in(uuid, uuid, uuid) from public, anon;
grant execute on function public.start_walk_in(uuid, uuid, uuid) to authenticated;

-- Fin de prestation : le montant reste celui de la prestation ; l'encaissement
-- se fait ensuite via le journal de caisse (record_payment).
create function public.complete_walk_in(p_salon_id uuid, p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments%rowtype;
  v_row public.appointments%rowtype;
  v_now timestamptz := clock_timestamp();
  v_end timestamptz;
begin
  select * into a from public.appointments
    where id = p_appointment_id and salon_id = p_salon_id for update;
  if not found or not private.has_salon_permission(p_salon_id, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if a.source <> 'walk_in' then
    raise exception 'Not a walk-in' using errcode = '22023';
  end if;
  if a.status = 'completed' then
    return a;
  end if;
  if a.status <> 'in_progress' then
    raise exception 'Walk-in is not in progress' using errcode = '22023';
  end if;

  v_end := greatest(v_now, a.starts_at + interval '1 second');
  update public.appointments set
    status = 'completed',
    service_completed_at = v_now,
    ends_at = v_end,
    updated_at = v_now
  where id = a.id returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, previous_status, new_status, reason, actor_id)
    values (p_salon_id, v_row.branch_id, v_row.id, a.status, 'completed', 'Prestation sans rendez-vous terminée', (select auth.uid()));
  return v_row;
end;
$$;
revoke all on function public.complete_walk_in(uuid, uuid) from public, anon;
grant execute on function public.complete_walk_in(uuid, uuid) to authenticated;
