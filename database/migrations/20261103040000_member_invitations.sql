-- Invitations de membres par e-mail
create table if not exists public.bc_member_invitations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','manager','receptionist','barber','cashier','accountant')),
  token_hash text not null unique,
  invited_by uuid not null references public.bc_users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bc_member_invitations_salon_idx on public.bc_member_invitations(salon_id);
create index if not exists bc_member_invitations_email_idx on public.bc_member_invitations(lower(email));

alter table public.bc_member_invitations enable row level security;
revoke all on public.bc_member_invitations from public, bc_app;
grant select, insert, update on public.bc_member_invitations to bc_app;
