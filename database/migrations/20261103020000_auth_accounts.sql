-- Tables d'authentification privées. À tester dans une base de développement isolée.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'bc_auth') then
    create role bc_auth nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  elsif exists (select 1 from pg_catalog.pg_roles where rolname = 'bc_auth'
    and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolbypassrls)) then
    raise exception 'Existing bc_auth role is overprivileged';
  end if;
end $$;
create table public.bc_auth_accounts (
  user_id uuid primary key references public.bc_users(id) on delete restrict,
  email text not null unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table public.bc_auth_sessions (
  token_hash text primary key check (char_length(token_hash) = 64),
  user_id uuid not null references public.bc_auth_accounts(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index bc_auth_sessions_user_idx on public.bc_auth_sessions(user_id);
revoke all on public.bc_auth_accounts, public.bc_auth_sessions from public, bc_app;
grant insert on public.bc_users to bc_auth;
grant select (id) on public.bc_users to bc_auth;
grant select, insert on public.bc_auth_accounts to bc_auth;
grant select, insert, delete on public.bc_auth_sessions to bc_auth;
