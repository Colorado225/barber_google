-- LOT 5 — Avis publics : création (vérifiée si liée à un rendez-vous terminé)
-- et modération par le salon. Les écritures passent par des RPC SECURITY DEFINER ;
-- aucun INSERT/DELETE direct sur public.reviews n'est accordé.

-- Lien vers le rendez-vous d'origine : un avis vérifié par rendez-vous au maximum.
alter table public.reviews add column appointment_id uuid;
alter table public.reviews
  add constraint reviews_appointment_fk
  foreign key (salon_id, appointment_id)
  references public.appointments(salon_id, id) on delete restrict;
create unique index reviews_one_per_appointment
  on public.reviews (appointment_id) where appointment_id is not null;

-- Nouvelle permission de modération (owner/manager), ajoutée sans toucher aux
-- permissions existantes. Les migrations appliquées sont immuables : on remplace
-- la fonction dans ce nouveau fichier versionné.
create or replace function private.has_salon_permission(p_salon_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and case p_permission
        when 'dashboard.read' then true
        when 'services.read' then true
        when 'staff.read' then true
        when 'clients.read' then true
        when 'clients.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'appointments.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'appointments.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'catalog.write' then m.role in ('owner', 'manager')
        when 'team.write' then m.role in ('owner', 'manager')
        when 'expenses.read' then m.role in ('owner', 'manager', 'accountant')
        when 'expenses.manage' then m.role in ('owner', 'manager')
        when 'stock.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'stock.write' then m.role in ('owner', 'manager')
        when 'loyalty.read' then true
        when 'loyalty.write' then m.role in ('owner', 'manager')
        when 'reviews.read' then true
        when 'reviews.moderate' then m.role in ('owner', 'manager')
        when 'members.read' then m.role in ('owner', 'manager')
        when 'members.manage' then m.role = 'owner'
        when 'salon.read' then true
        when 'salon.update' then m.role = 'owner'
        when 'branch.create' then m.role in ('owner', 'manager')
        when 'branch.update' then m.role in ('owner', 'manager')
        else false
      end
  )
$$;
revoke all on function private.has_salon_permission(uuid, text) from public, anon;
grant execute on function private.has_salon_permission(uuid, text) to authenticated;

-- Création d'un avis par tout utilisateur authentifié. Il n'est « verified »
-- que s'il est lié à un rendez-vous terminé de ce salon (client repris du RDV).
create function public.create_review(
  p_salon_id uuid, p_author text, p_rating integer, p_comment text,
  p_appointment_id uuid default null)
returns public.reviews
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.reviews%rowtype;
  v_appt public.appointments%rowtype;
  v_author text;
  v_comment text;
  v_verified boolean := false;
  v_client uuid := null;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  v_author := btrim(coalesce(p_author, ''));
  v_comment := btrim(coalesce(p_comment, ''));
  if char_length(v_author) not between 1 and 120 then
    raise exception 'Invalid author' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Invalid rating' using errcode = '22023';
  end if;
  if char_length(v_comment) not between 1 and 1000 then
    raise exception 'Invalid comment' using errcode = '22023';
  end if;
  if not exists (select 1 from public.salons s where s.id = p_salon_id) then
    raise exception 'Salon not found' using errcode = '22023';
  end if;

  if p_appointment_id is not null then
    select * into v_appt from public.appointments
     where id = p_appointment_id and salon_id = p_salon_id;
    if not found then
      raise exception 'Appointment not found' using errcode = '22023';
    end if;
    if v_appt.status <> 'completed' then
      raise exception 'Appointment not completed' using errcode = '22023';
    end if;
    v_verified := true;
    v_client := v_appt.client_id;
  end if;

  insert into public.reviews(salon_id, client_id, appointment_id, author, rating, comment, verified)
  values (p_salon_id, v_client, p_appointment_id, v_author, p_rating, v_comment, v_verified)
  returning * into v_row;

  return v_row;
end $$;
revoke all on function public.create_review(uuid, text, integer, text, uuid) from public, anon;
grant execute on function public.create_review(uuid, text, integer, text, uuid) to authenticated;

-- Modération : suppression réservée aux rôles reviews.moderate (owner/manager).
create function public.delete_review(p_salon_id uuid, p_review_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_salon_permission(p_salon_id, 'reviews.moderate') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.reviews where id = p_review_id and salon_id = p_salon_id;
  if not found then
    raise exception 'Not found' using errcode = '42501';
  end if;
end $$;
revoke all on function public.delete_review(uuid, uuid) from public, anon;
grant execute on function public.delete_review(uuid, uuid) to authenticated;
