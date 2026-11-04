create table public.branch_hours (
  salon_id uuid not null,
  branch_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time,
  closes_at time,
  primary key (salon_id, branch_id, weekday),
  foreign key (salon_id, branch_id)
    references public.branches(salon_id, id) on delete cascade,
  check (
    (is_open and opens_at is not null and closes_at is not null and closes_at > opens_at)
    or (not is_open and opens_at is null and closes_at is null)
  )
);
create index branch_hours_branch_idx on public.branch_hours (salon_id, branch_id);

alter table public.branch_hours enable row level security;

revoke all on public.branch_hours from public, anon, authenticated;
grant select, delete on public.branch_hours to authenticated;
grant insert (salon_id, branch_id, weekday, is_open, opens_at, closes_at)
  on public.branch_hours to authenticated;
grant update (is_open, opens_at, closes_at)
  on public.branch_hours to authenticated;

create policy branch_hours_read_member on public.branch_hours for select to authenticated
  using (private.has_salon_permission(salon_id, 'salon.read'));
create policy branch_hours_insert_manager on public.branch_hours for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'branch.update'));
create policy branch_hours_update_manager on public.branch_hours for update to authenticated
  using (private.has_salon_permission(salon_id, 'branch.update'))
  with check (private.has_salon_permission(salon_id, 'branch.update'));
create policy branch_hours_delete_manager on public.branch_hours for delete to authenticated
  using (private.has_salon_permission(salon_id, 'branch.update'));