-- Première tranche du workflow interne. Aucun paiement en ligne ni publication.

create table public.bc_branch_memberships (
  salon_id uuid not null references public.bc_salons(id),
  branch_id uuid not null references public.bc_branches(id),
  membership_id uuid not null references public.bc_memberships(id),
  primary key (branch_id, membership_id)
);
-- Prévenir les rattachements entre salons, y compris pour des écritures privilégiées.
alter table public.bc_branches add constraint bc_branches_salon_id_id_unique unique (salon_id, id);
alter table public.bc_memberships add constraint bc_memberships_salon_id_id_unique unique (salon_id, id);
alter table public.bc_branch_memberships add constraint bc_branch_memberships_branch_fk foreign key (salon_id, branch_id) references public.bc_branches(salon_id, id);
alter table public.bc_branch_memberships add constraint bc_branch_memberships_member_fk foreign key (salon_id, membership_id) references public.bc_memberships(salon_id, id);

create function barber_private.has_branch_permission(p_salon uuid, p_branch uuid, p_action text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bc_memberships m
    join public.bc_branches b on b.salon_id = m.salon_id and b.id = p_branch
    where m.salon_id = p_salon and m.user_id = (select barber_private.current_user_id()) and m.status = 'active'
      and (m.role = 'owner' or exists (
        select 1 from public.bc_branch_memberships bm where bm.salon_id = m.salon_id and bm.branch_id = b.id and bm.membership_id = m.id
      ))
      and case p_action
        when 'branch.read' then true
        when 'branch.update' then m.role in ('owner', 'manager')
        when 'appointments.read' then m.role in ('owner', 'manager', 'receptionist')
        when 'appointments.create' then m.role in ('owner', 'manager', 'receptionist')
        when 'appointments.transition' then m.role in ('owner', 'manager', 'receptionist')
        when 'payments.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'payments.record' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.correct' then m.role in ('owner', 'manager')
        else false end
  )
$$;
revoke all on function barber_private.has_branch_permission(uuid, uuid, text) from public;
grant execute on function barber_private.has_branch_permission(uuid, uuid, text) to bc_app;

-- Un owner voit toutes ses succursales ; les autres uniquement celles affectées.
drop policy bc_branches_read on public.bc_branches;
drop policy bc_branches_update on public.bc_branches;
drop policy bc_branches_insert on public.bc_branches;
create policy bc_branches_read on public.bc_branches for select to bc_app
 using (barber_private.has_salon_permission(salon_id, 'salon.update') or barber_private.has_branch_permission(salon_id, id, 'branch.read'));
create policy bc_branches_update on public.bc_branches for update to bc_app
 using (barber_private.has_branch_permission(salon_id, id, 'branch.update'))
 with check (barber_private.has_branch_permission(salon_id, id, 'branch.update'));
-- Seul le propriétaire crée une succursale jusqu'à l'existence d'un parcours
-- d'affectation transactionnel pour les managers.
create policy bc_branches_insert on public.bc_branches for insert to bc_app
 with check (barber_private.has_salon_permission(salon_id, 'salon.update'));

alter table public.bc_branch_memberships enable row level security;
revoke all on public.bc_branch_memberships from public, bc_app;

-- L'owner affecte un membre existant. Les invitations et retraits sont hors périmètre.
create function public.bc_assign_member_to_branch(p_salon uuid, p_branch uuid, p_membership uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.bc_branch_memberships(salon_id, branch_id, membership_id)
    values (p_salon, p_branch, p_membership) on conflict (branch_id, membership_id) do nothing;
end $$;

create table public.bc_appointments (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null references public.bc_salons(id),
 branch_id uuid not null,
 client_name text not null check (char_length(btrim(client_name)) between 1 and 120),
 service_name text not null check (char_length(btrim(service_name)) between 1 and 120),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at > starts_at),
 amount bigint not null check (amount >= 0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 source text not null check (source in ('direct', 'phone', 'whatsapp')),
 status text not null default 'confirmed' check (status in ('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show')),
 created_by uuid not null references public.bc_users(id),
 created_at timestamptz not null default now(),
 foreign key (salon_id, branch_id) references public.bc_branches(salon_id, id),
 unique (salon_id, branch_id, id)
);
create index bc_appointments_branch_time_idx on public.bc_appointments (salon_id, branch_id, starts_at);
create table public.bc_appointment_events (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null,
 branch_id uuid not null,
 appointment_id uuid not null,
 previous_status text,
 new_status text not null,
 reason text,
 actor_id uuid not null references public.bc_users(id),
 created_at timestamptz not null default now(),
 foreign key (salon_id, branch_id, appointment_id) references public.bc_appointments(salon_id, branch_id, id)
);
create index bc_appointment_events_appointment_idx on public.bc_appointment_events(appointment_id, created_at);

-- Journal append-only pour règlements déclarés manuellement (pas de fournisseur).
create table public.bc_payment_entries (
 id uuid primary key default gen_random_uuid(),
 salon_id uuid not null,
 branch_id uuid not null,
 appointment_id uuid not null,
 kind text not null check (kind in ('payment','refund','payment_reversal','refund_reversal')),
 amount bigint not null check (amount > 0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 method text not null check (method in ('cash','manual_mobile','manual_card','other')),
 original_entry_id uuid references public.bc_payment_entries(id),
 reason text,
 actor_id uuid not null references public.bc_users(id),
 idempotency_key uuid not null unique,
 created_at timestamptz not null default now(),
 foreign key (salon_id, branch_id, appointment_id) references public.bc_appointments(salon_id, branch_id, id)
);
create unique index bc_payment_one_reversal_idx on public.bc_payment_entries(original_entry_id) where kind in ('payment_reversal','refund_reversal');
create index bc_payment_entries_appointment_idx on public.bc_payment_entries (appointment_id, created_at);

alter table public.bc_appointments enable row level security;
alter table public.bc_appointment_events enable row level security;
alter table public.bc_payment_entries enable row level security;
revoke all on public.bc_appointments, public.bc_appointment_events, public.bc_payment_entries from public, bc_app;
grant select on public.bc_appointments, public.bc_appointment_events, public.bc_payment_entries to bc_app;
create policy bc_appointments_read on public.bc_appointments for select to bc_app using (barber_private.has_branch_permission(salon_id, branch_id, 'appointments.read'));
create policy bc_appointment_events_read on public.bc_appointment_events for select to bc_app using (barber_private.has_branch_permission(salon_id, branch_id, 'appointments.read'));
create policy bc_payment_entries_read on public.bc_payment_entries for select to bc_app using (barber_private.has_branch_permission(salon_id, branch_id, 'payments.read'));

-- Création d'une réservation interne uniquement. Le contrôle d'horaires et des
-- chevauchements par collaborateur n'est pas encore implémenté : ne pas ouvrir
-- ces fonctions aux réservations publiques ni les considérer prêtes production.
create function public.bc_create_appointment(p_salon uuid, p_branch uuid, p_client text, p_service text, p_start timestamptz, p_end timestamptz, p_amount bigint, p_currency text, p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not barber_private.has_branch_permission(p_salon, p_branch, 'appointments.create') then raise exception 'Not authorized' using errcode = '42501'; end if;
 insert into public.bc_appointments(salon_id,branch_id,client_name,service_name,starts_at,ends_at,amount,currency,source,created_by)
 values(p_salon,p_branch,btrim(p_client),btrim(p_service),p_start,p_end,p_amount,p_currency,p_source,barber_private.current_user_id()) returning id into v_id;
 insert into public.bc_appointment_events(salon_id,branch_id,appointment_id,new_status,actor_id) values(p_salon,p_branch,v_id,'confirmed',barber_private.current_user_id());
 return v_id;
end $$;

create function public.bc_transition_appointment(p_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.bc_appointments%rowtype;
begin
 select * into a from public.bc_appointments where id = p_id for update;
 if not found or not barber_private.has_branch_permission(a.salon_id,a.branch_id,'appointments.transition') then raise exception 'Not found or not authorized' using errcode = '42501'; end if;
 if not ((a.status = 'pending' and p_status in ('confirmed','cancelled'))
  or (a.status = 'confirmed' and p_status in ('checked_in','cancelled','no_show'))
  or (a.status = 'checked_in' and p_status in ('in_progress','cancelled'))
  or (a.status = 'in_progress' and p_status in ('completed','cancelled'))) then
   raise exception 'Invalid transition' using errcode = '22023';
 end if;
 if p_status in ('cancelled','no_show') and (p_reason is null or btrim(p_reason) = '') then raise exception 'Reason required' using errcode = '22023'; end if;
 update public.bc_appointments set status = p_status where id = p_id;
 insert into public.bc_appointment_events(salon_id,branch_id,appointment_id,previous_status,new_status,reason,actor_id)
 values(a.salon_id,a.branch_id,a.id,a.status,p_status,nullif(btrim(p_reason),''),barber_private.current_user_id());
end $$;

-- Toutes les écritures financières verrouillent le rendez-vous : montants et
-- remboursements sont vérifiés sur le journal complet, jamais sur le navigateur.
create function public.bc_record_manual_entry(p_appointment uuid, p_kind text, p_amount bigint, p_method text, p_reason text, p_key uuid, p_original uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.bc_appointments%rowtype; orig public.bc_payment_entries%rowtype; v_balance bigint; v_delta bigint; v_id uuid;
begin
 select * into a from public.bc_appointments where id = p_appointment for update;
 if not found then raise exception 'Not found or not authorized' using errcode = '42501'; end if;
 if p_kind = 'payment' then
   if a.status in ('cancelled','no_show') then raise exception 'Cannot charge a cancelled or missed appointment' using errcode = '22023'; end if;
   if not barber_private.has_branch_permission(a.salon_id,a.branch_id,'payments.record') then raise exception 'Not authorized' using errcode = '42501'; end if;
 elsif p_kind in ('refund','payment_reversal','refund_reversal') then
   if not barber_private.has_branch_permission(a.salon_id,a.branch_id,'payments.correct') then raise exception 'Not authorized' using errcode = '42501'; end if;
 else raise exception 'Invalid entry kind' using errcode = '22023'; end if;
 if p_amount is null or p_amount <= 0 or p_key is null or p_method is null or p_method not in ('cash','manual_mobile','manual_card','other') then raise exception 'Invalid entry' using errcode = '22023'; end if;
 if p_kind <> 'payment' and (p_reason is null or btrim(p_reason) = '') then raise exception 'Reason required' using errcode = '22023'; end if;
 if p_kind in ('payment_reversal','refund_reversal') then
   select * into orig from public.bc_payment_entries where id = p_original and appointment_id = a.id;
   if not found or orig.kind <> (case when p_kind = 'payment_reversal' then 'payment' else 'refund' end) or orig.amount <> p_amount or orig.method <> p_method then
     raise exception 'Invalid original entry' using errcode = '22023';
   end if;
 elsif p_original is not null then raise exception 'Unexpected original entry' using errcode = '22023'; end if;
 select coalesce(sum(case when kind in ('payment','refund_reversal') then amount else -amount end),0) into v_balance from public.bc_payment_entries where appointment_id = a.id;
 v_delta := case when p_kind in ('payment','refund_reversal') then p_amount else -p_amount end;
 if v_balance + v_delta < 0 or v_balance + v_delta > a.amount then raise exception 'Entry exceeds outstanding balance or collected amount' using errcode = '22023'; end if;
 insert into public.bc_payment_entries(salon_id,branch_id,appointment_id,kind,amount,currency,method,original_entry_id,reason,actor_id,idempotency_key)
 values(a.salon_id,a.branch_id,a.id,p_kind,p_amount,a.currency,p_method,p_original,nullif(btrim(p_reason),''),barber_private.current_user_id(),p_key) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.bc_assign_member_to_branch(uuid,uuid,uuid) from public;
revoke all on function public.bc_create_appointment(uuid,uuid,text,text,timestamptz,timestamptz,bigint,text,text) from public;
revoke all on function public.bc_transition_appointment(uuid,text,text) from public;
revoke all on function public.bc_record_manual_entry(uuid,text,bigint,text,text,uuid,uuid) from public;
grant execute on function public.bc_assign_member_to_branch(uuid,uuid,uuid) to bc_app;
grant execute on function public.bc_create_appointment(uuid,uuid,text,text,timestamptz,timestamptz,bigint,text,text) to bc_app;
grant execute on function public.bc_transition_appointment(uuid,text,text) to bc_app;
grant execute on function public.bc_record_manual_entry(uuid,text,bigint,text,text,uuid,uuid) to bc_app;
