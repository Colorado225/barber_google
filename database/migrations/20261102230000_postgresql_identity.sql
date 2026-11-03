-- Socle PostgreSQL local. À appliquer avec un rôle de migration administrateur.
-- bc_app est uniquement un rôle de privilèges, jamais un compte de connexion public.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'bc_app') then
    create role bc_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  elsif exists (select 1 from pg_catalog.pg_roles where rolname = 'bc_app'
    and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolbypassrls)) then
    raise exception 'Existing bc_app role is overprivileged';
  end if;
end $$;
create schema if not exists barber_private;
revoke all on schema barber_private from public;

-- Identités minimales ; aucun système de connexion n'est implémenté ici.
create table public.bc_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
revoke all on public.bc_users from public, bc_app;

-- Cette variable n'est pas une authentification. Seul un serveur de confiance
-- peut l'établir dans une transaction après validation de la session applicative.
create function barber_private.current_user_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('barber.user_id', true), '')::uuid
$$;
revoke all on function barber_private.current_user_id() from public;
grant usage on schema barber_private to bc_app;
grant execute on function barber_private.current_user_id() to bc_app;
