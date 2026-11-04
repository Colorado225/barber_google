-- LOT 5 — Opérations rendez-vous sur Supabase (parity avec la lignée bc_*).
--
-- Principes (identiques à l'ancien backend, portés vers le modèle Supabase) :
--   * toutes les écritures passent par des fonctions SECURITY DEFINER qui
--     vérifient les permissions ; aucun INSERT/UPDATE/DELETE direct sur
--     public.appointments n'est accordé au rôle authenticated ;
--   * la disponibilité (horaires succursale + horaires/absences staff +
--     chevauchements) est vérifiée côté serveur dans la même transaction ;
--   * deux réservations concurrentes pour un même employé sont sérialisées
--     par verrou FOR UPDATE + contrainte d'exclusion (quand disponible) ;
--   * l'historique des statuts est append-only (public.appointment_events) ;
--   * aucune suppression physique : « supprimer » annule avec motif.

-- ============================================================================
-- Journal des statuts (append-only)
-- ============================================================================
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  branch_id uuid not null,
  appointment_id uuid not null,
  previous_status text,
  new_status text not null,
  reason text,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- La clé unique de appointments est (salon_id, id) ; branch_id est dénormalisé
  -- et toujours copié depuis le rendez-vous par les fonctions ci-dessous.
  foreign key (salon_id, appointment_id)
    references public.appointments(salon_id, id) on delete cascade
);
create index appointment_events_appointment_idx
  on public.appointment_events (appointment_id, created_at);

alter table public.appointment_events enable row level security;
revoke all on public.appointment_events from public, anon, authenticated;
grant select on public.appointment_events to authenticated;
create policy appointment_events_read_member on public.appointment_events for select to authenticated
  using (private.has_salon_permission(salon_id, 'appointments.read'));

-- ============================================================================
-- Anti-chevauchement par employé, au niveau de la base (ultime garde-fou).
-- btree_gist est disponible sur Supabase ; PGlite (tests) ne le fournit pas :
-- l'énoncé est conditionnel, le verrou FOR UPDATE garde l'atomicité sinon.
-- ============================================================================
do $$
begin
  create extension if not exists btree_gist;
  alter table public.appointments
    add constraint appointments_no_overlap
    exclude using gist (
      salon_id with =,
      staff_id with =,
      tstzrange(starts_at, ends_at) with &&
    ) where (staff_id is not null and status not in ('cancelled', 'no_show'));
exception
  when undefined_file or insufficient_privilege or feature_not_supported then
    raise notice 'btree_gist indisponible : anti-chevauchement assuré par les fonctions SQL';
end $$;

-- ============================================================================
-- Disponibilité : une seule source de vérité (succursale + employé + absences + RDV)
-- ============================================================================
create function private.is_slot_available(
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

  -- 1) Succursale ouverte ce jour-là, sur ce créneau (si des horaires existent).
  if p_branch is not null then
    if not exists (
      select 1 from public.branch_hours h
      where h.salon_id = p_salon and h.branch_id = p_branch and h.weekday = v_weekday
        and h.is_open and h.opens_at is not null and h.closes_at is not null
        and v_start_time >= h.opens_at and v_end_time <= h.closes_at
    ) then
      -- Sans horaires configurés, on ne bloque pas (configuration progressive).
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

  -- 2) Employé actif, affecté à cette succursale si elle est connue.
  if not exists (
    select 1 from public.staff s
    where s.id = p_staff and s.salon_id = p_salon and s.is_active
      and (p_branch is null or s.branch_id is null or s.branch_id = p_branch)
  ) then
    return false;
  end if;

  -- 3) Horaires de l'employé (s'il en a) : le créneau doit y tenir.
  if exists (select 1 from public.staff_schedules sc where sc.staff_id = p_staff) then
    if not exists (
      select 1 from public.staff_schedules sc
      where sc.staff_id = p_staff and sc.weekday = v_weekday
        and v_start_time >= sc.starts_at and v_end_time <= sc.ends_at
    ) then
      return false;
    end if;
  end if;

  -- 4) Absence sur la date.
  if exists (
    select 1 from public.staff_absences a
    where a.staff_id = p_staff and v_date between a.starts_on and a.ends_on
  ) then
    return false;
  end if;

  -- 5) Chevauchement avec un rendez-vous actif.
  if exists (
    select 1 from public.appointments ap
    where ap.salon_id = p_salon and ap.staff_id = p_staff
      and ap.status not in ('cancelled', 'no_show')
      and (p_ignore is null or ap.id <> p_ignore)
      and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(p_start, p_end)
  ) then
    return false;
  end if;

  return true;
end $$;
revoke all on function private.is_slot_available(uuid, uuid, uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;

-- ============================================================================
-- Création interne avec contrôle de disponibilité atomique
-- ============================================================================
create function public.create_appointment(
  p_salon_id uuid, p_service_id uuid, p_starts_at timestamptz,
  p_client_name text, p_client_phone text,
  p_staff_id uuid default null, p_client_id uuid default null,
  p_branch_id uuid default null, p_source text default 'direct', p_notes text default '')
returns public.appointments
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.appointments%rowtype;
  v_service public.services%rowtype;
  v_staff public.staff%rowtype;
  v_client public.clients%rowtype;
  v_branch uuid;
  v_ends timestamptz;
  v_name text;
  v_phone text;
begin
  if not private.has_salon_permission(p_salon_id, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_starts_at is null then
    raise exception 'Invalid time range' using errcode = '22023';
  end if;
  if p_source not in ('direct', 'phone', 'whatsapp') then
    raise exception 'Invalid source' using errcode = '22023';
  end if;

  select * into v_service from public.services
   where id = p_service_id and salon_id = p_salon_id and is_active;
  if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;
  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes + v_service.prep_minutes);

  -- Client existant (source de vérité) ou client de passage (nom + téléphone).
  if p_client_id is not null then
    select * into v_client from public.clients where id = p_client_id and salon_id = p_salon_id;
    if not found then raise exception 'Client not found' using errcode = '22023'; end if;
    v_name := v_client.name;
    v_phone := v_client.phone;
  else
    v_name := btrim(coalesce(p_client_name, ''));
    v_phone := btrim(coalesce(p_client_phone, ''));
    if char_length(v_name) not between 1 and 120 then
      raise exception 'Invalid client name' using errcode = '22023';
    end if;
    if char_length(v_phone) not between 3 and 40 then
      raise exception 'Invalid client phone' using errcode = '22023';
    end if;
  end if;

  -- « Sans préférence » : le serveur choisit un employé compétent et disponible.
  if p_staff_id is null then
    select s.id into p_staff_id
      from public.staff s
     where s.salon_id = p_salon_id and s.is_active and s.is_available
       and (array_length(s.service_ids, 1) is null or p_service_id = any(s.service_ids))
       and private.is_slot_available(
             p_salon_id, coalesce(p_branch_id, s.branch_id), s.id, p_starts_at, v_ends, null)
     order by s.name
     limit 1;
    if p_staff_id is null then
      raise exception 'Slot unavailable' using errcode = '23P01';
    end if;
  end if;

  -- Verrou explicite : sérialise deux réservations concurrentes sur le même employé.
  select * into v_staff from public.staff
   where id = p_staff_id and salon_id = p_salon_id for update;
  if not found or not v_staff.is_active or not v_staff.is_available then
    raise exception 'Staff unavailable' using errcode = '22023';
  end if;
  if array_length(v_staff.service_ids, 1) is not null and not (p_service_id = any(v_staff.service_ids)) then
    raise exception 'Staff does not perform this service' using errcode = '22023';
  end if;

  -- Succursale : explicite, sinon celle de l'employé, sinon la première du salon.
  v_branch := p_branch_id;
  if v_branch is null then
    v_branch := v_staff.branch_id;
  end if;
  if v_branch is null then
    select b.id into v_branch from public.branches b
     where b.salon_id = p_salon_id order by b.created_at limit 1;
  end if;
  if v_branch is null or not exists (
    select 1 from public.branches b where b.id = v_branch and b.salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;

  if not private.is_slot_available(p_salon_id, v_branch, p_staff_id, p_starts_at, v_ends, null) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;

  insert into public.appointments(
    salon_id, branch_id, client_id, staff_id, service_id, client_name, client_phone,
    service_name, staff_name, starts_at, ends_at, amount, currency, source, status,
    notes, created_by)
  values (
    p_salon_id, v_branch, p_client_id, p_staff_id, p_service_id, v_name, v_phone,
    v_service.name, v_staff.name, p_starts_at, v_ends, v_service.price, 'XOF', p_source,
    'confirmed', btrim(coalesce(p_notes, '')), (select auth.uid()))
  returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, new_status, actor_id)
  values (p_salon_id, v_branch, v_row.id, 'confirmed', (select auth.uid()));

  return v_row;
end $$;
revoke all on function public.create_appointment(uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, text)
  from public, anon;
grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, text)
  to authenticated;

-- ============================================================================
-- Déplacement / modification : même contrôle, en excluant le RDV courant.
-- Un paramètre null conserve la valeur actuelle. La fin et le montant sont
-- toujours recalculés depuis la prestation (jamais depuis le client).
-- ============================================================================
create function public.reschedule_appointment(
  p_salon_id uuid, p_appointment_id uuid,
  p_staff_id uuid default null, p_service_id uuid default null,
  p_starts_at timestamptz default null, p_notes text default null)
returns public.appointments
language plpgsql security definer set search_path = '' as $$
declare
  a public.appointments%rowtype;
  v_row public.appointments%rowtype;
  v_service public.services%rowtype;
  v_staff public.staff%rowtype;
  v_staff_id uuid;
  v_service_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  select * into a from public.appointments
   where id = p_appointment_id and salon_id = p_salon_id for update;
  if not found or not private.has_salon_permission(a.salon_id, 'appointments.write') then
    raise exception 'Not found or not authorized' using errcode = '42501';
  end if;
  if a.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'Appointment is closed' using errcode = '22023';
  end if;

  v_service_id := coalesce(p_service_id, a.service_id);
  select * into v_service from public.services
   where id = v_service_id and salon_id = a.salon_id and is_active;
  if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;

  v_staff_id := coalesce(p_staff_id, a.staff_id);
  v_starts := coalesce(p_starts_at, a.starts_at);
  v_ends := v_starts + make_interval(mins => v_service.duration_minutes + v_service.prep_minutes);

  if v_staff_id is not null then
    select * into v_staff from public.staff
     where id = v_staff_id and salon_id = a.salon_id for update;
    if not found or not v_staff.is_active or not v_staff.is_available then
      raise exception 'Staff unavailable' using errcode = '22023';
    end if;
    if array_length(v_staff.service_ids, 1) is not null and not (v_service_id = any(v_staff.service_ids)) then
      raise exception 'Staff does not perform this service' using errcode = '22023';
    end if;
  end if;

  if not private.is_slot_available(a.salon_id, a.branch_id, v_staff_id, v_starts, v_ends, a.id) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;

  update public.appointments set
    staff_id = v_staff_id,
    staff_name = coalesce(v_staff.name, ''),
    service_id = v_service_id,
    service_name = v_service.name,
    starts_at = v_starts,
    ends_at = v_ends,
    amount = v_service.price,
    notes = coalesce(p_notes, a.notes),
    updated_at = now()
  where id = a.id and salon_id = a.salon_id
  returning * into v_row;

  return v_row;
end $$;
revoke all on function public.reschedule_appointment(uuid, uuid, uuid, uuid, timestamptz, text)
  from public, anon;
grant execute on function public.reschedule_appointment(uuid, uuid, uuid, uuid, timestamptz, text)
  to authenticated;

-- ============================================================================
-- Transitions : machine à états stricte + audit complet.
-- ============================================================================
create function public.transition_appointment(
  p_salon_id uuid, p_appointment_id uuid, p_status text, p_reason text default null)
returns public.appointments
language plpgsql security definer set search_path = '' as $$
declare
  a public.appointments%rowtype;
  v_row public.appointments%rowtype;
begin
  select * into a from public.appointments
   where id = p_appointment_id and salon_id = p_salon_id for update;
  if not found or not private.has_salon_permission(a.salon_id, 'appointments.write') then
    raise exception 'Not found or not authorized' using errcode = '42501';
  end if;
  if not ((a.status = 'pending' and p_status in ('confirmed', 'cancelled'))
    or (a.status = 'confirmed' and p_status in ('checked_in', 'cancelled', 'no_show'))
    or (a.status = 'checked_in' and p_status in ('in_progress', 'cancelled'))
    or (a.status = 'in_progress' and p_status in ('completed', 'cancelled'))) then
    raise exception 'Invalid transition' using errcode = '22023';
  end if;
  if p_status in ('cancelled', 'no_show') and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'Reason required' using errcode = '22023';
  end if;

  update public.appointments set status = p_status, updated_at = now()
  where id = a.id and salon_id = a.salon_id
  returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, previous_status, new_status, reason, actor_id)
  values (a.salon_id, a.branch_id, a.id, a.status, p_status, nullif(btrim(p_reason), ''), (select auth.uid()));

  return v_row;
end $$;
revoke all on function public.transition_appointment(uuid, uuid, text, text) from public, anon;
grant execute on function public.transition_appointment(uuid, uuid, text, text) to authenticated;

-- Suppression physique interdite : on annule (motif obligatoire), l'historique reste.
create function public.cancel_appointment(p_salon_id uuid, p_appointment_id uuid, p_reason text)
returns public.appointments
language sql security definer set search_path = '' as $$
  select public.transition_appointment(p_salon_id, p_appointment_id, 'cancelled', p_reason);
$$;
revoke all on function public.cancel_appointment(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_appointment(uuid, uuid, text) to authenticated;

-- ============================================================================
-- Disponibilités d'une journée (UI). Créneaux horaires 08:00 → 19:00, fenêtre
-- de la durée de la prestation (ou 30 min par défaut), dans le fuseau de la
-- succursale (Africa/Abidjan par défaut, UTC+0).
-- ============================================================================
create function public.day_availability(
  p_salon_id uuid, p_date date, p_service_id uuid default null)
returns table (staff_id uuid, starts_at timestamptz, available boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_minutes integer := 30;
begin
  if not private.has_salon_permission(p_salon_id, 'appointments.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Invalid date' using errcode = '22023';
  end if;
  if p_service_id is not null then
    select s.duration_minutes + s.prep_minutes into v_minutes
    from public.services s where s.id = p_service_id and s.salon_id = p_salon_id and s.is_active;
    if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;
  end if;

  return query
  select s.id,
         slot.starts_at,
         private.is_slot_available(
           p_salon_id, s.branch_id, s.id, slot.starts_at,
           slot.starts_at + make_interval(mins => v_minutes), null)
  from public.staff s
  left join public.branches b on b.salon_id = s.salon_id and b.id = s.branch_id
  cross join lateral (
    select (p_date::timestamp + make_interval(hours => g.h))
             at time zone coalesce(b.timezone, 'Africa/Abidjan') as starts_at
    from generate_series(8, 19) as g(h)
  ) slot
  where s.salon_id = p_salon_id and s.is_active and s.is_available
  order by s.name, slot.starts_at;
end $$;
revoke all on function public.day_availability(uuid, date, uuid) from public, anon;
grant execute on function public.day_availability(uuid, date, uuid) to authenticated;
