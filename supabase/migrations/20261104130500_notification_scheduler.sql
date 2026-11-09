-- Parcours client complet — planification de l'envoi automatique.
--
-- La file est traitée par l'edge function « notifications-dispatcher ». Ce
-- fichier branche le déclencheur périodique, sans jamais stocker de secret
-- fournisseur dans la base : seule une URL et un jeton d'appel interne y
-- figurent, dans le schéma `private` non exposé par l'API.
--
-- Le jeton N'EST PAS dans le dépôt. L'exploitant le renseigne une fois :
--   insert into private.notification_dispatch_config(id, endpoint, dispatch_token, is_enabled)
--   values (true, 'https://<projet>.supabase.co/functions/v1/notifications-dispatcher', '<jeton>', true);
-- Le même jeton doit être posé en secret Edge `NOTIFICATIONS_DISPATCH_TOKEN`.
--
-- Tant que la ligne est absente ou désactivée, rien n'est planifié ni envoyé :
-- le traitement reste possible à la main depuis l'ERP.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
end $$;

create table if not exists private.notification_dispatch_config (
  id boolean primary key default true check (id),
  endpoint text not null,
  dispatch_token text,
  batch_size integer not null default 50 check (batch_size between 1 and 100),
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
revoke all on private.notification_dispatch_config from public, anon, authenticated, service_role;

create or replace function private.invoke_notification_dispatcher()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg private.notification_dispatch_config;
  v_request_id bigint;
begin
  select * into v_cfg from private.notification_dispatch_config where id;
  if not found or not v_cfg.is_enabled or coalesce(v_cfg.dispatch_token, '') = '' then
    return null;
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'net' and p.proname = 'http_post') then
    return null;
  end if;

  select net.http_post(
    url := v_cfg.endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-token', v_cfg.dispatch_token
    ),
    body := jsonb_build_object('limit', v_cfg.batch_size),
    timeout_milliseconds := 25000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.invoke_notification_dispatcher() from public, anon, authenticated, service_role;

-- Planification : toutes les 5 minutes. Absente si pg_cron n'est pas installé
-- (ex. environnement de test PGlite) ; le bouton ERP reste alors le seul moteur.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('dispatch-appointment-notifications')
      from cron.job where jobname = 'dispatch-appointment-notifications';
    perform cron.schedule(
      'dispatch-appointment-notifications',
      '*/5 * * * *',
      $cmd$select private.invoke_notification_dispatcher()$cmd$
    );
  end if;
end $$;
