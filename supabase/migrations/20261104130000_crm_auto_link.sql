-- Parcours client complet (1/4) — CRM automatique.
-- Une réservation marketplace ou un passage avec téléphone rattache/crée une
-- fiche client du salon, sans doublon (matching sur les chiffres du numéro).
-- Aucune donnée existante n'est réécrite : seules les nouvelles écritures sont
-- liées, et un e-mail manquant peut être complété.

-- Normalisation téléphone (Côte d'Ivoire) : on ignore espaces/indicatif pour
-- que « +225 07 00 00 00 02 », « 00225 07… » et « 0700000002 » désignent la
-- même personne. Les numéros hors CI conservent tous leurs chiffres.
create function private.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_digits := regexp_replace(v_digits, '^00', '');
  if char_length(v_digits) = 13 and v_digits like '225%' then
    v_digits := substring(v_digits from 4);
  end if;
  return v_digits;
end;
$$;
revoke all on function private.normalize_phone(text) from public, anon, authenticated;

create index if not exists clients_salon_phone_normalized_idx
  on public.clients (salon_id, private.normalize_phone(phone));

create function private.ensure_client_for_contact(
  p_salon_id uuid, p_name text, p_phone text, p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text;
  v_client uuid;
  v_name text;
  v_email text;
begin
  v_digits := private.normalize_phone(p_phone);
  -- Trop court pour identifier un client de façon fiable : pas de fiche CRM.
  if char_length(v_digits) < 6 then
    return null;
  end if;

  -- Sérialise deux arrivées simultanées du même numéro dans le même salon.
  perform pg_advisory_xact_lock(hashtext(p_salon_id::text || ':' || v_digits));

  select c.id into v_client
    from public.clients c
   where c.salon_id = p_salon_id
     and private.normalize_phone(c.phone) = v_digits
   order by c.created_at
   limit 1;

  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    v_email := null;
  end if;

  if v_client is not null then
    -- On ne renomme jamais une fiche existante : on complète seulement l'e-mail.
    if v_email is not null then
      update public.clients set email = v_email, updated_at = now()
        where id = v_client and (email is null or btrim(email) = '');
    end if;
    return v_client;
  end if;

  v_name := left(coalesce(nullif(btrim(p_name), ''), 'Client'), 120);
  insert into public.clients(salon_id, name, phone, email)
    values (p_salon_id, v_name, left(btrim(p_phone), 40), v_email)
    returning id into v_client;
  return v_client;
end;
$$;
revoke all on function private.ensure_client_for_contact(uuid, text, text, text) from public, anon, authenticated;

-- Réservation marketplace : même contrat qu'avant, avec client_id en plus.
create or replace function public.marketplace_book_appointment(
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
  v_client uuid;
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

  -- CRM : fiche retrouvée par téléphone ou créée, dans la même transaction.
  v_client := private.ensure_client_for_contact(p_salon_id, v_name, v_phone, v_email);

  insert into public.appointments(
    salon_id, branch_id, client_id, staff_id, service_id, client_name, client_phone, client_email,
    service_name, staff_name, starts_at, ends_at, amount, currency, source, status,
    payment_status, notes, created_by, public_idempotency_key
  ) values (
    p_salon_id, v_branch, v_client, v_staff_id, p_service_id, v_name, v_phone, v_email,
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

-- Client de passage : même logique CRM dès qu'un téléphone exploitable est donné.
create or replace function public.register_walk_in(
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
  v_client_id uuid := p_client_id;
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
    v_client_id := private.ensure_client_for_contact(p_salon_id, v_name, v_phone, null);
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
    p_salon_id, v_branch, v_client_id, v_staff_id, p_service_id, v_name, v_phone,
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
