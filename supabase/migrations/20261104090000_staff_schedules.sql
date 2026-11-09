-- LOT 5 — Horaires hebdomadaires et absences du personnel (parity avec bc_*).
-- Ces tables alimentent le calcul de disponibilité des rendez-vous.
-- Lecture par les membres autorisés ; écriture réservée aux rôles team.write.

create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at),
  unique (staff_id, weekday, starts_at),
  foreign key (salon_id, staff_id) references public.staff(salon_id, id) on delete cascade
);
create index staff_schedules_staff_idx on public.staff_schedules (salon_id, staff_id, weekday);

create table public.staff_absences (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  staff_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  foreign key (salon_id, staff_id) references public.staff(salon_id, id) on delete cascade
);
create index staff_absences_staff_idx on public.staff_absences (salon_id, staff_id, starts_on);

alter table public.staff_schedules enable row level security;
alter table public.staff_absences enable row level security;

revoke all on public.staff_schedules, public.staff_absences from public, anon, authenticated;
grant select, delete on public.staff_schedules, public.staff_absences to authenticated;
grant insert (salon_id, staff_id, weekday, starts_at, ends_at)
  on public.staff_schedules to authenticated;
grant insert (salon_id, staff_id, starts_on, ends_on, reason)
  on public.staff_absences to authenticated;

create policy staff_schedules_read_member on public.staff_schedules for select to authenticated
  using (private.has_salon_permission(salon_id, 'staff.read'));
create policy staff_schedules_insert_manager on public.staff_schedules for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'team.write'));
create policy staff_schedules_delete_manager on public.staff_schedules for delete to authenticated
  using (private.has_salon_permission(salon_id, 'team.write'));

create policy staff_absences_read_member on public.staff_absences for select to authenticated
  using (private.has_salon_permission(salon_id, 'staff.read'));
create policy staff_absences_insert_manager on public.staff_absences for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'team.write'));
create policy staff_absences_delete_manager on public.staff_absences for delete to authenticated
  using (private.has_salon_permission(salon_id, 'team.write'));
