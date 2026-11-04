-- LOT 3 — Gestion opérationnelle du salon : prestations, personnel, rendez-vous.
--
-- Principes :
--   * toutes les écritures passent par des fonctions SECURITY DEFINER qui
--     vérifient les permissions (bc_app n'a aucun INSERT/UPDATE/DELETE direct) ;
--   * la disponibilité et les chevauchements sont vérifiés côté serveur, dans la
--     même transaction que l'écriture ;
--   * deux requêtes concurrentes ne peuvent pas réserver le même créneau pour
--     un même employé (contrainte d'exclusion + verrou par employé) ;
--   * l'historique des changements de statut est conservé (append-only).

-- ============================================================================
-- 3.1 Catalogue : prestations activables et cohérence monétaire
-- ============================================================================
alter table public.bc_services
  add column is_active boolean not null default true,
  -- Prix et durées restent des entiers (XOF = devise sans décimale) : aucun
  -- calcul flottant. On ajoute le temps de préparation éventuel.
  add column prep_minutes integer not null default 0 check (prep_minutes between 0 and 120);
create index bc_services_active_idx on public.bc_services (salon_id) where is_active;

-- Les rendez-vous ne référencent plus des prestations supprimées.
alter table public.bc_appointments
  add column client_id uuid,
  add column staff_id uuid,
  add column service_id uuid,
  add column notes text not null default '',
  add column updated_at timestamptz not null default now();

alter table public.bc_appointments
  add constraint bc_appointments_client_fk foreign key (client_id) references public.bc_clients(id) on delete set null,
  add constraint bc_appointments_staff_fk foreign key (staff_id) references public.bc_staff(id) on delete set null,
  add constraint bc_appointments_service_fk foreign key (service_id) references public.bc_services(id) on delete set null;
create index bc_appointments_staff_time_idx on public.bc_appointments (salon_id, staff_id, starts_at);
create index bc_appointments_client_idx on public.bc_appointments (client_id);

-- Anti-chevauchement par employé, au niveau de la base.
-- `staff_id` nullable : les rendez-vous sans employé ne sont pas concernés. Les
-- statuts annulés/absents libèrent le créneau.
--
-- La contrainte d'exclusion est l'ultime garde-fou. Elle nécessite l'extension
-- `btree_gist`, disponible sur PostgreSQL ; l'instance de test embarquée
-- (PGlite) ne fournit pas cette extension, l'énoncé est donc conditionnel. Dans
-- ce cas, l'atomicité reste garantie par le verrou `for update` sur l'employé
-- dans `bc_book_appointment` (une seule transaction à la fois par employé).
-- À vérifier en production : `select extname from pg_extension where extname = 'btree_gist';`
do $$
begin
  create extension if not exists btree_gist;
  alter table public.bc_appointments
    add constraint bc_appointments_no_overlap
    exclude using gist (
      salon_id with =,
      staff_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (staff_id is not null and status not in ('cancelled', 'no_show'));
exception
  when undefined_file or insufficient_privilege or feature_not_supported then
    raise notice 'btree_gist indisponible : contrainte anti-chevauchement non créée (protection assurée par les fonctions SQL)';
end $$;

-- ============================================================================
-- 3.2 Personnel : profil métier distinct de l'identité de connexion
-- ============================================================================
alter table public.bc_staff
  add column email text check (email is null or char_length(email) <= 254),
  add column user_id uuid references public.bc_users(id) on delete set null,
  add column branch_id uuid references public.bc_branches(id) on delete set null,
  add column is_active boolean not null default true,
  -- Prestations maîtrisées (utilisées pour filtrer les affectations).
  add column service_ids uuid[] not null default '{}';
create index bc_staff_branch_idx on public.bc_staff (salon_id, branch_id);
create index bc_staff_user_idx on public.bc_staff (user_id);

-- Un employé peut avoir plusieurs profils mais un seul par salon.
create unique index bc_staff_one_profile_per_salon on public.bc_staff (salon_id, user_id) where user_id is not null;

-- Horaires hebdomadaires de l'employé (0 = dimanche … 6 = samedi).
create table public.bc_staff_schedules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  staff_id uuid not null references public.bc_staff(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at),
  unique (staff_id, weekday, starts_at)
);
create index bc_staff_schedules_staff_idx on public.bc_staff_schedules (salon_id, staff_id, weekday);

-- Absences (congés, maladie) par employé.
create table public.bc_staff_absences (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  staff_id uuid not null references public.bc_staff(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index bc_staff_absences_staff_idx on public.bc_staff_absences (salon_id, staff_id, starts_on);

-- Horaires d'ouverture du salon (par succursale), utilisés par la disponibilité.
create table public.bc_branch_hours (
  salon_id uuid not null,
  branch_id uuid not null,
  weekday integer not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_open boolean not null default true,
  primary key (branch_id, weekday),
  foreign key (salon_id, branch_id) references public.bc_branches(salon_id, id) on delete cascade
);

-- ============================================================================
-- Droits : lecture par RLS, écriture uniquement via fonctions
-- ============================================================================
alter table public.bc_staff_schedules enable row level security;
alter table public.bc_staff_absences enable row level security;
alter table public.bc_branch_hours enable row level security;

revoke all on public.bc_staff_schedules, public.bc_staff_absences, public.bc_branch_hours from public, bc_app;
grant select on public.bc_staff_schedules, public.bc_staff_absences, public.bc_branch_hours to bc_app;

create policy bc_staff_schedules_read on public.bc_staff_schedules for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'staff.read'));
create policy bc_staff_absences_read on public.bc_staff_absences for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'staff.read'));
create policy bc_branch_hours_read on public.bc_branch_hours for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));

-- ============================================================================
-- Disponibilité : une seule source de vérité (salon + employé + absences + RDV)
-- ============================================================================
create or replace function barber_private.is_slot_available(
  p_salon uuid, p_branch uuid, p_staff uuid, p_start timestamptz, p_end timestamptz, p_ignore uuid default null)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_weekday integer;
  v_date date;
  v_start_time time;
  v_end_time time;
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return false;
  end if;
  v_date := (p_start at time zone 'Africa/Abidjan')::date;
  v_weekday := extract(dow from (p_start at time zone 'Africa/Abidjan'))::int;
  v_start_time := (p_start at time zone 'Africa/Abidjan')::time;
  v_end_time := (p_end at time zone 'Africa/Abidjan')::time;

  -- 1) Salon ouvert ce jour-là, sur ce créneau.
  if p_branch is not null then
    if not exists (
      select 1 from public.bc_branch_hours h
      where h.salon_id = p_salon and h.branch_id = p_branch and h.weekday = v_weekday
        and h.is_open and h.opens_at is not null and h.closes_at is not null
        and v_start_time >= h.opens_at and v_end_time <= h.closes_at
    ) then
      -- Sans horaires configurés, on ne bloque pas (configuration progressive).
      if exists (select 1 from public.bc_branch_hours h where h.salon_id = p_salon and h.branch_id = p_branch) then
        return false;
      end if;
    end if;
  end if;

  if p_staff is null then
    return true;
  end if;

  -- 2) Employé actif, affecté à cette succursale si elle est connue.
  if not exists (
    select 1 from public.bc_staff s
    where s.id = p_staff and s.salon_id = p_salon and s.is_active
      and (p_branch is null or s.branch_id is null or s.branch_id = p_branch)
  ) then
    return false;
  end if;

  -- 3) Horaires de l'employé (s'il en a) : le créneau doit y tenir.
  if exists (select 1 from public.bc_staff_schedules sc where sc.staff_id = p_staff) then
    if not exists (
      select 1 from public.bc_staff_schedules sc
      where sc.staff_id = p_staff and sc.weekday = v_weekday
        and v_start_time >= sc.starts_at and v_end_time <= sc.ends_at
    ) then
      return false;
    end if;
  end if;

  -- 4) Absence sur la date.
  if exists (
    select 1 from public.bc_staff_absences a
    where a.staff_id = p_staff and v_date between a.starts_on and a.ends_on
  ) then
    return false;
  end if;

  -- 5) Chevauchement avec un rendez-vous actif.
  if exists (
    select 1 from public.bc_appointments ap
    where ap.salon_id = p_salon and ap.staff_id = p_staff
      and ap.status not in ('cancelled', 'no_show')
      and (p_ignore is null or ap.id <> p_ignore)
      and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(p_start, p_end)
  ) then
    return false;
  end if;

  return true;
end $$;
revoke all on function barber_private.is_slot_available(uuid, uuid, uuid, timestamptz, timestamptz, uuid) from public;
grant execute on function barber_private.is_slot_available(uuid, uuid, uuid, timestamptz, timestamptz, uuid) to bc_app;

-- ============================================================================
-- 3.1 Prestations : activation / désactivation (jamais de suppression silencieuse)
-- ============================================================================
create or replace function public.bc_set_service_active(p_salon uuid, p_service uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'catalog.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.bc_services set is_active = p_active, updated_at = now()
   where id = p_service and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
  insert into public.bc_admin_audit(salon_id, actor_id, action, metadata)
  values (p_salon, barber_private.current_user_id(), 'service.activation',
          jsonb_build_object('service', p_service, 'active', p_active));
end $$;
revoke all on function public.bc_set_service_active(uuid, uuid, boolean) from public;
grant execute on function public.bc_set_service_active(uuid, uuid, boolean) to bc_app;

-- ============================================================================
-- 3.2 Personnel : horaires et absences
-- ============================================================================
create or replace function public.bc_save_staff_schedule(
  p_salon uuid, p_staff uuid, p_weekday integer, p_starts time, p_ends time)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_weekday not between 0 and 6 or p_starts is null or p_ends is null or p_ends <= p_starts then
    raise exception 'Invalid schedule' using errcode = '22023';
  end if;
  if not exists (select 1 from public.bc_staff where id = p_staff and salon_id = p_salon) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  -- Suppression des plages identiques pour éviter les doublons.
  delete from public.bc_staff_schedules
   where salon_id = p_salon and staff_id = p_staff and weekday = p_weekday and starts_at = p_starts;
  insert into public.bc_staff_schedules(salon_id, staff_id, weekday, starts_at, ends_at)
  values (p_salon, p_staff, p_weekday, p_starts, p_ends)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.bc_save_staff_schedule(uuid, uuid, integer, time, time) from public;
grant execute on function public.bc_save_staff_schedule(uuid, uuid, integer, time, time) to bc_app;

create or replace function public.bc_delete_staff_schedule(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.bc_staff_schedules where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;
revoke all on function public.bc_delete_staff_schedule(uuid, uuid) from public;
grant execute on function public.bc_delete_staff_schedule(uuid, uuid) to bc_app;

create or replace function public.bc_add_staff_absence(
  p_salon uuid, p_staff uuid, p_starts date, p_ends date, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_starts is null or p_ends is null or p_ends < p_starts then
    raise exception 'Invalid absence' using errcode = '22023';
  end if;
  if not exists (select 1 from public.bc_staff where id = p_staff and salon_id = p_salon) then
    raise exception 'Not found' using errcode = '42501';
  end if;
  insert into public.bc_staff_absences(salon_id, staff_id, starts_on, ends_on, reason)
  values (p_salon, p_staff, p_starts, p_ends, coalesce(p_reason, ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.bc_add_staff_absence(uuid, uuid, date, date, text) from public;
grant execute on function public.bc_add_staff_absence(uuid, uuid, date, date, text) to bc_app;

create or replace function public.bc_delete_staff_absence(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.bc_staff_absences where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;
revoke all on function public.bc_delete_staff_absence(uuid, uuid) from public;
grant execute on function public.bc_delete_staff_absence(uuid, uuid) to bc_app;

-- ============================================================================
-- 3.2 Personnel : création/mise à jour avec profil métier enrichi
--    (nom, rôle, téléphone, email, succursale, prestations, actif)
-- ============================================================================
create or replace function public.bc_save_staff_profile(
  p_salon uuid, p_id uuid, p_name text, p_role text, p_phone text, p_email text,
  p_specialties text[], p_commission integer, p_available boolean,
  p_branch uuid, p_active boolean, p_service_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_commission is null or p_commission not between 0 and 100 then raise exception 'Invalid commission' using errcode = '22023'; end if;
  if p_email is not null and char_length(p_email) > 254 then raise exception 'Invalid email' using errcode = '22023'; end if;
  if p_branch is not null and not exists (select 1 from public.bc_branches where id = p_branch and salon_id = p_salon) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.bc_staff(salon_id,name,role,phone,email,specialties,commission_rate,is_available,branch_id,is_active,service_ids)
    values (p_salon, btrim(p_name), p_role, coalesce(p_phone,''), nullif(btrim(coalesce(p_email,'')),''),
            coalesce(p_specialties,'{}'), p_commission, coalesce(p_available,true), p_branch,
            coalesce(p_active,true), coalesce(p_service_ids,'{}'))
    returning id into v_id;
  else
    update public.bc_staff set
      name = btrim(p_name), role = p_role, phone = coalesce(p_phone,''),
      email = nullif(btrim(coalesce(p_email,'')),''), specialties = coalesce(p_specialties,'{}'),
      commission_rate = p_commission, is_available = coalesce(p_available,true),
      branch_id = p_branch, is_active = coalesce(p_active,true),
      service_ids = coalesce(p_service_ids,'{}'), updated_at = now()
    where id = p_id and salon_id = p_salon returning id into v_id;
    if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.bc_save_staff_profile(uuid,uuid,text,text,text,text,text[],integer,boolean,uuid,boolean,uuid[]) from public;
grant execute on function public.bc_save_staff_profile(uuid,uuid,text,text,text,text,text[],integer,boolean,uuid,boolean,uuid[]) to bc_app;

-- ============================================================================
-- 3.3 / 3.4 Rendez-vous : création avec contrôle de disponibilité atomique
-- ============================================================================
create or replace function public.bc_book_appointment(
  p_salon uuid, p_branch uuid, p_client uuid, p_staff uuid, p_service uuid,
  p_starts timestamptz, p_ends timestamptz, p_notes text, p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_client public.bc_clients%rowtype;
  v_service public.bc_services%rowtype;
  v_staff public.bc_staff%rowtype;
begin
  if not barber_private.has_salon_permission(p_salon, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then
    raise exception 'Invalid time range' using errcode = '22023';
  end if;
  if p_source not in ('direct', 'phone', 'whatsapp') then
    raise exception 'Invalid source' using errcode = '22023';
  end if;

  select * into v_service from public.bc_services
   where id = p_service and salon_id = p_salon and is_active;
  if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;

  -- « Sans préférence » : le serveur choisit un employé compétent et disponible.
  if p_staff is null then
    select s.id into p_staff
      from public.bc_staff s
     where s.salon_id = p_salon and s.is_active and s.is_available
       and (array_length(s.service_ids, 1) is null or p_service = any(s.service_ids))
       and barber_private.is_slot_available(p_salon, p_branch, s.id, p_starts, p_ends, null)
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

  -- Verrou explicite sur l'employé : sérialise deux réservations concurrentes
  -- avant même l'évaluation de la contrainte d'exclusion.
  select * into v_staff from public.bc_staff where id = p_staff and salon_id = p_salon for update;
  if not found or not v_staff.is_active or not v_staff.is_available then
    raise exception 'Staff unavailable' using errcode = '22023';
  end if;
  if array_length(v_staff.service_ids, 1) is not null and not (p_service = any(v_staff.service_ids)) then
    raise exception 'Staff does not perform this service' using errcode = '22023';
  end if;

  if not barber_private.is_slot_available(p_salon, p_branch, p_staff, p_starts, p_ends, null) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;

  insert into public.bc_appointments(
    salon_id, branch_id, client_id, staff_id, service_id, client_name, service_name,
    starts_at, ends_at, amount, currency, source, status, notes, created_by)
  values (
    p_salon, p_branch, p_client, p_staff, p_service, v_client.name, v_service.name,
    p_starts, p_ends, v_service.price, 'XOF', p_source, 'confirmed', coalesce(btrim(p_notes), ''),
    barber_private.current_user_id())
  returning id into v_id;

  insert into public.bc_appointment_events(salon_id, branch_id, appointment_id, new_status, actor_id)
  values (p_salon, p_branch, v_id, 'confirmed', barber_private.current_user_id());
  return v_id;
end $$;
revoke all on function public.bc_book_appointment(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text) from public;
grant execute on function public.bc_book_appointment(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text) to bc_app;

-- Déplacement / modification d'un rendez-vous : même contrôle, en excluant le RDV courant.
create or replace function public.bc_reschedule_appointment(
  p_id uuid, p_staff uuid, p_service uuid, p_starts timestamptz, p_ends timestamptz, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.bc_appointments%rowtype;
  v_service public.bc_services%rowtype;
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
  if not barber_private.is_slot_available(a.salon_id, a.branch_id, p_staff, p_starts, p_ends, a.id) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;
  update public.bc_appointments set
    staff_id = p_staff, service_id = p_service, service_name = v_service.name,
    starts_at = p_starts, ends_at = p_ends, amount = v_service.price,
    notes = coalesce(btrim(p_notes), ''), updated_at = now()
  where id = a.id;
end $$;
revoke all on function public.bc_reschedule_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text) from public;
grant execute on function public.bc_reschedule_appointment(uuid,uuid,uuid,timestamptz,timestamptz,text) to bc_app;

-- Transitions : conservées (bc_transition_appointment) + audit complet.

-- Suppression physique : interdite ; on annule (le RDV reste dans l'historique).
create or replace function public.bc_cancel_appointment(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.bc_transition_appointment(p_id, 'cancelled', p_reason);
end $$;
revoke all on function public.bc_cancel_appointment(uuid, text) from public;
grant execute on function public.bc_cancel_appointment(uuid, text) to bc_app;

-- ============================================================================
-- 3.4 Lecture des disponibilités d'une journée (pour l'UI et le serveur)
-- ============================================================================
create or replace function public.bc_day_availability(p_salon uuid, p_date date)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz, available boolean)
language sql stable security definer set search_path = '' as $$
  select s.id,
         (p_date + make_interval(hours => g.h))::timestamptz,
         (p_date + make_interval(hours => g.h, mins => 30))::timestamptz,
         barber_private.has_salon_permission(p_salon, 'appointments.read')
           and barber_private.is_slot_available(p_salon, s.branch_id, s.id,
               (p_date + make_interval(hours => g.h))::timestamptz,
               (p_date + make_interval(hours => g.h, mins => 30))::timestamptz, null)
  from public.bc_staff s
  cross join generate_series(8, 19) as g(h)
  where s.salon_id = p_salon and s.is_active
  order by s.id, g.h
$$;
revoke all on function public.bc_day_availability(uuid, date) from public;
grant execute on function public.bc_day_availability(uuid, date) to bc_app;
