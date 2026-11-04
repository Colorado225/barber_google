-- Tables d'authentification privées. À tester dans une base de développement isolée.
-- Les FK vers bc_users ne sont pas utilisées par bc_auth (il n'a pas le droit de
-- lecture sur bc_users) : l'intégrité est garantie par un trigger défini ci-dessous.
create or replace function barber_private.require_user_exists()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.bc_users where id = new.user_id) then
    raise exception 'Unknown user' using errcode = '23503';
  end if;
  return new;
end $$;
revoke all on function barber_private.require_user_exists() from public;

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
  user_id uuid primary key,
  email text not null unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  password_hash text not null,
  created_at timestamptz not null default now()
);
create trigger bc_auth_accounts_user_exists before insert on public.bc_auth_accounts
  for each row execute function barber_private.require_user_exists();
create table public.bc_auth_sessions (
  token_hash text primary key check (char_length(token_hash) = 64),
  user_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create trigger bc_auth_sessions_user_exists before insert on public.bc_auth_sessions
  for each row execute function barber_private.require_user_exists();
create index bc_auth_sessions_user_idx on public.bc_auth_sessions(user_id);
revoke all on public.bc_auth_accounts, public.bc_auth_sessions from public, bc_app;
grant insert on public.bc_users to bc_auth;
grant select (id) on public.bc_users to bc_auth;
grant select, insert on public.bc_auth_accounts to bc_auth;
grant select, insert, delete on public.bc_auth_sessions to bc_auth;
