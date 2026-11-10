-- Migration 20261110210000 : Observabilité des notifications, alertes d'échecs répétés
-- et information honnête sur les canaux (e-mail / WhatsApp / SMS indisponible).
--
-- Objectifs :
-- 1. Conserver un compteur cumulatif `failure_count` et `last_error` sur les notifications
--    afin que des relances manuelles n'effacent pas l'historique d'échecs répétés.
-- 2. Journaliser chaque passage de `notifications-dispatcher` (cron, manuel, sonde santé)
--    dans `public.notification_dispatch_runs` sans jamais exposer les secrets fournisseurs.
-- 3. Fournir aux salons (`get_salon_notification_health`) et au SuperAdmin
--    (`platform_get_notification_health`) l'état de la file, des échecs répétés,
--    du déclencheur planifié (`pg_cron` + `pg_net`) et des capacités par canal.
-- 4. Remplacer la promesse prématurée « Rappels SMS & WhatsApp anti-no-show » dans
--    `public.saas_plans` et `public.saas_plan_drafts` par une description exacte.

alter table public.appointment_notifications
  add column if not exists failure_count integer not null default 0 check (failure_count >= 0),
  add column if not exists last_error text;

update public.appointment_notifications
set
  failure_count = greatest(failure_count, attempts),
  last_error = coalesce(last_error, error)
where status = 'failed'
  and (failure_count = 0 or last_error is null);

create or replace function public.mark_notification_result(
  p_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
)
returns public.appointment_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointment_notifications;
  v_err text;
begin
  if p_status not in ('sent', 'failed', 'skipped', 'pending') then
    raise exception 'Invalid notification status' using errcode = '22023';
  end if;

  v_err := left(nullif(btrim(coalesce(p_error, '')), ''), 500);

  update public.appointment_notifications
  set
    status = p_status,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error = case when p_status = 'sent' then null else v_err end,
    failure_count = case when p_status = 'failed' then failure_count + 1 else failure_count end,
    last_error = case
      when p_status = 'sent' then null
      when p_status = 'failed' then coalesce(v_err, last_error)
      else last_error
    end,
    sent_at = case when p_status = 'sent' then now() else sent_at end,
    locked_at = null
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Notification not found' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

revoke all on function public.mark_notification_result(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_notification_result(uuid, text, text, text) to service_role;

-- 2. Journal des exécutions de notifications-dispatcher -------------------------------------------
create table if not exists public.notification_dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons(id) on delete cascade,
  trigger_source text not null check (trigger_source in ('cron', 'manual', 'probe')),
  provider_configured boolean not null default false,
  email_configured boolean not null default false,
  whatsapp_configured boolean not null default false,
  whatsapp_template_mode boolean not null default false,
  sms_supported boolean not null default false,
  processed integer not null default 0 check (processed >= 0),
  sent integer not null default 0 check (sent >= 0),
  failed integer not null default 0 check (failed >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  error text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_dispatch_runs_created_idx
  on public.notification_dispatch_runs (created_at desc);

create index if not exists notification_dispatch_runs_salon_created_idx
  on public.notification_dispatch_runs (salon_id, created_at desc);

alter table public.notification_dispatch_runs enable row level security;
revoke all on table public.notification_dispatch_runs from public, anon, authenticated;
grant select, insert on table public.notification_dispatch_runs to service_role;

create or replace function public.record_notification_dispatch_run(
  p_salon_id uuid default null,
  p_trigger_source text default 'cron',
  p_provider_configured boolean default false,
  p_email_configured boolean default false,
  p_whatsapp_configured boolean default false,
  p_whatsapp_template_mode boolean default false,
  p_processed integer default 0,
  p_sent integer default 0,
  p_failed integer default 0,
  p_skipped integer default 0,
  p_error text default null,
  p_details jsonb default '{}'::jsonb
)
returns public.notification_dispatch_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_dispatch_runs;
begin
  if p_trigger_source not in ('cron', 'manual', 'probe') then
    raise exception 'Invalid trigger_source' using errcode = '22023';
  end if;

  insert into public.notification_dispatch_runs (
    salon_id,
    trigger_source,
    provider_configured,
    email_configured,
    whatsapp_configured,
    whatsapp_template_mode,
    sms_supported,
    processed,
    sent,
    failed,
    skipped,
    error,
    details
  ) values (
    p_salon_id,
    p_trigger_source,
    coalesce(p_provider_configured, false),
    coalesce(p_email_configured, false),
    coalesce(p_whatsapp_configured, false),
    coalesce(p_whatsapp_template_mode, false),
    false,
    greatest(coalesce(p_processed, 0), 0),
    greatest(coalesce(p_sent, 0), 0),
    greatest(coalesce(p_failed, 0), 0),
    greatest(coalesce(p_skipped, 0), 0),
    left(nullif(btrim(coalesce(p_error, '')), ''), 500),
    coalesce(p_details, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_notification_dispatch_run(
  uuid, text, boolean, boolean, boolean, boolean, integer, integer, integer, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_notification_dispatch_run(
  uuid, text, boolean, boolean, boolean, boolean, integer, integer, integer, integer, text, jsonb
) to service_role;

-- Utilitaire d'autorisation pour les sondes santé SuperAdmin sur l'Edge Function.
create or replace function public.can_administer_notifications()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_superadmin();
$$;

revoke all on function public.can_administer_notifications() from public, anon;
grant execute on function public.can_administer_notifications() to authenticated;

-- 3. Lecture interne sûre de l'état pg_cron + pg_net (sans jamais exposer de secret) ----------------
create or replace function private.read_notification_scheduler_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_enabled boolean := false;
  v_has_dispatch_token boolean := false;
  v_has_endpoint boolean := false;
  v_batch_size integer := 50;
  v_updated_at timestamptz := null;
  v_has_cfg boolean := false;
  v_cron_available boolean := false;
  v_cron_scheduled boolean := false;
  v_cron_active boolean := false;
  v_cron_schedule text := null;
  v_last_run_at timestamptz := null;
  v_last_run_status text := null;
  v_last_return_message text := null;
  v_http_available boolean := false;
  v_last_http_status integer := null;
  v_last_http_error text := null;
  v_last_http_at timestamptz := null;
  v_last_http_preview text := null;
  v_job_id bigint := null;
begin
  select
    is_enabled,
    coalesce(nullif(btrim(dispatch_token), ''), '') <> '',
    coalesce(nullif(btrim(endpoint), ''), '') <> '',
    batch_size,
    updated_at
  into v_is_enabled, v_has_dispatch_token, v_has_endpoint, v_batch_size, v_updated_at
  from private.notification_dispatch_config
  where id = true;

  v_has_cfg := found;

  if to_regclass('cron.job') is not null then
    v_cron_available := true;
    begin
      execute
        'select jobid, schedule, active from cron.job where jobname = $1 limit 1'
      into v_job_id, v_cron_schedule, v_cron_active
      using 'dispatch-appointment-notifications';

      v_cron_scheduled := v_job_id is not null;

      if v_cron_scheduled and to_regclass('cron.job_run_details') is not null then
        execute
          'select end_time, status, left(coalesce(return_message, ''''), 240)
             from cron.job_run_details
            where jobid = $1
            order by start_time desc
            limit 1'
        into v_last_run_at, v_last_run_status, v_last_return_message
        using v_job_id;
      end if;
    exception when others then
      v_last_return_message := coalesce(v_last_return_message, sqlerrm);
    end;
  end if;

  if to_regclass('net._http_response') is not null then
    v_http_available := true;
    begin
      execute
        'select status_code, left(coalesce(error_msg, ''''), 240), created, left(coalesce(content, ''''), 240)
           from net._http_response
          order by created desc
          limit 1'
      into v_last_http_status, v_last_http_error, v_last_http_at, v_last_http_preview;
    exception when others then
      v_last_http_error := coalesce(v_last_http_error, sqlerrm);
    end;
  end if;

  return jsonb_build_object(
    'configured', v_has_cfg,
    'isEnabled', coalesce(v_is_enabled, false),
    'hasDispatchToken', coalesce(v_has_dispatch_token, false),
    'hasEndpoint', coalesce(v_has_endpoint, false),
    'batchSize', coalesce(v_batch_size, 50),
    'updatedAt', v_updated_at,
    'cronAvailable', v_cron_available,
    'cronScheduled', v_cron_scheduled,
    'cronActive', coalesce(v_cron_active, false),
    'cronSchedule', v_cron_schedule,
    'lastRunAt', v_last_run_at,
    'lastRunStatus', v_last_run_status,
    'lastReturnMessage', nullif(btrim(coalesce(v_last_return_message, '')), ''),
    'httpAvailable', v_http_available,
    'lastHttpStatus', v_last_http_status,
    'lastHttpError', nullif(btrim(coalesce(v_last_http_error, '')), ''),
    'lastHttpAt', v_last_http_at,
    'lastHttpPreview', nullif(btrim(coalesce(v_last_http_preview, '')), '')
  );
end;
$$;

revoke all on function private.read_notification_scheduler_health() from public, anon, authenticated;

-- 4. Observabilité côté salon (ERP) ----------------------------------------------------------------
create or replace function public.get_salon_notification_health(p_salon_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
  v_by_channel jsonb;
  v_repeated_items jsonb;
  v_last_run jsonb;
  v_last_salon_run jsonb;
  v_repeated_failures integer := 0;
  v_exhausted_failures integer := 0;
  v_recent_failures_24h integer := 0;
  v_overdue_pending integer := 0;
  v_stuck_sending integer := 0;
begin
  if not private.has_salon_permission(p_salon_id, 'appointments.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select
    jsonb_build_object(
      'pending', count(*) filter (where status = 'pending'),
      'sending', count(*) filter (where status = 'sending'),
      'sent', count(*) filter (where status = 'sent'),
      'failed', count(*) filter (where status = 'failed'),
      'skipped', count(*) filter (where status = 'skipped'),
      'total', count(*)
    ),
    count(*) filter (where status = 'failed' and (attempts >= 2 or failure_count >= 2))::integer,
    count(*) filter (where status = 'failed' and attempts >= 5)::integer,
    count(*) filter (where status = 'failed' and coalesce(last_attempt_at, created_at) >= now() - interval '24 hours')::integer,
    count(*) filter (where status = 'pending' and scheduled_at < now() - interval '15 minutes')::integer,
    count(*) filter (where status = 'sending' and locked_at < now() - interval '10 minutes')::integer
  into
    v_counts,
    v_repeated_failures,
    v_exhausted_failures,
    v_recent_failures_24h,
    v_overdue_pending,
    v_stuck_sending
  from public.appointment_notifications
  where salon_id = p_salon_id;

  select jsonb_build_object(
    'email', (
      select jsonb_build_object(
        'supported', true,
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'repeatedFailures', count(*) filter (where status = 'failed' and (attempts >= 2 or failure_count >= 2)),
        'latestError', (
          select coalesce(error, last_error)
          from public.appointment_notifications n2
          where n2.salon_id = p_salon_id and n2.channel = 'email' and coalesce(n2.error, n2.last_error) is not null
          order by coalesce(n2.last_attempt_at, n2.created_at) desc
          limit 1
        )
      )
      from public.appointment_notifications
      where salon_id = p_salon_id and channel = 'email'
    ),
    'whatsapp', (
      select jsonb_build_object(
        'supported', true,
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'repeatedFailures', count(*) filter (where status = 'failed' and (attempts >= 2 or failure_count >= 2)),
        'latestError', (
          select coalesce(error, last_error)
          from public.appointment_notifications n2
          where n2.salon_id = p_salon_id and n2.channel = 'whatsapp' and coalesce(n2.error, n2.last_error) is not null
          order by coalesce(n2.last_attempt_at, n2.created_at) desc
          limit 1
        )
      )
      from public.appointment_notifications
      where salon_id = p_salon_id and channel = 'whatsapp'
    ),
    'sms', (
      select jsonb_build_object(
        'supported', false,
        'unavailableReason', 'Le canal SMS n’est pas disponible tant qu’il n’a pas de fournisseur raccordé.',
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'repeatedFailures', 0,
        'latestError', 'channel_not_supported: sms'
      )
      from public.appointment_notifications
      where salon_id = p_salon_id and channel = 'sms'
    )
  ) into v_by_channel;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'channel', t.channel,
        'kind', t.kind,
        'recipient', t.recipient,
        'attempts', t.attempts,
        'failureCount', t.failure_count,
        'lastAttemptAt', t.last_attempt_at,
        'error', coalesce(t.error, t.last_error)
      )
      order by coalesce(t.last_attempt_at, t.created_at) desc
    ),
    '[]'::jsonb
  )
  into v_repeated_items
  from (
    select id, channel, kind, recipient, attempts, failure_count, last_attempt_at, error, last_error, created_at
    from public.appointment_notifications
    where salon_id = p_salon_id
      and status = 'failed'
      and (attempts >= 2 or failure_count >= 2)
    order by coalesce(last_attempt_at, created_at) desc
    limit 10
  ) t;

  select jsonb_build_object(
    'id', r.id,
    'salonId', r.salon_id,
    'triggerSource', r.trigger_source,
    'providerConfigured', r.provider_configured,
    'emailConfigured', r.email_configured,
    'whatsappConfigured', r.whatsapp_configured,
    'whatsappTemplateMode', r.whatsapp_template_mode,
    'smsSupported', r.sms_supported,
    'processed', r.processed,
    'sent', r.sent,
    'failed', r.failed,
    'skipped', r.skipped,
    'error', r.error,
    'details', r.details,
    'createdAt', r.created_at
  )
  into v_last_run
  from public.notification_dispatch_runs r
  where r.salon_id = p_salon_id or r.salon_id is null
  order by r.created_at desc
  limit 1;

  select jsonb_build_object(
    'id', r.id,
    'salonId', r.salon_id,
    'triggerSource', r.trigger_source,
    'providerConfigured', r.provider_configured,
    'emailConfigured', r.email_configured,
    'whatsappConfigured', r.whatsapp_configured,
    'whatsappTemplateMode', r.whatsapp_template_mode,
    'smsSupported', r.sms_supported,
    'processed', r.processed,
    'sent', r.sent,
    'failed', r.failed,
    'skipped', r.skipped,
    'error', r.error,
    'details', r.details,
    'createdAt', r.created_at
  )
  into v_last_salon_run
  from public.notification_dispatch_runs r
  where r.salon_id = p_salon_id
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'salonId', p_salon_id,
    'counts', v_counts,
    'repeatedFailures', v_repeated_failures,
    'exhaustedFailures', v_exhausted_failures,
    'recentFailures24h', v_recent_failures_24h,
    'overduePending', v_overdue_pending,
    'stuckSending', v_stuck_sending,
    'byChannel', v_by_channel,
    'repeatedFailureItems', v_repeated_items,
    'scheduler', private.read_notification_scheduler_health(),
    'lastRun', v_last_run,
    'lastSalonRun', v_last_salon_run,
    'smsUnavailableReason', 'Le canal SMS n’est pas disponible tant qu’il n’a pas de fournisseur raccordé.'
  );
end;
$$;

revoke all on function public.get_salon_notification_health(uuid) from public, anon;
grant execute on function public.get_salon_notification_health(uuid) to authenticated;

-- 5. Observabilité globale plateforme (SuperAdmin) ------------------------------------------------
create or replace function public.platform_get_notification_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
  v_by_channel jsonb;
  v_salons_alerts jsonb;
  v_last_run jsonb;
  v_repeated_failures integer := 0;
  v_exhausted_failures integer := 0;
  v_recent_failures_24h integer := 0;
  v_overdue_pending integer := 0;
  v_stuck_sending integer := 0;
begin
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select
    jsonb_build_object(
      'pending', count(*) filter (where status = 'pending'),
      'sending', count(*) filter (where status = 'sending'),
      'sent', count(*) filter (where status = 'sent'),
      'failed', count(*) filter (where status = 'failed'),
      'skipped', count(*) filter (where status = 'skipped'),
      'total', count(*)
    ),
    count(*) filter (where status = 'failed' and (attempts >= 2 or failure_count >= 2))::integer,
    count(*) filter (where status = 'failed' and attempts >= 5)::integer,
    count(*) filter (where status = 'failed' and coalesce(last_attempt_at, created_at) >= now() - interval '24 hours')::integer,
    count(*) filter (where status = 'pending' and scheduled_at < now() - interval '15 minutes')::integer,
    count(*) filter (where status = 'sending' and locked_at < now() - interval '10 minutes')::integer
  into
    v_counts,
    v_repeated_failures,
    v_exhausted_failures,
    v_recent_failures_24h,
    v_overdue_pending,
    v_stuck_sending
  from public.appointment_notifications;

  select jsonb_build_object(
    'email', (
      select jsonb_build_object(
        'supported', true,
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'repeatedFailures', count(*) filter (where status = 'failed' and (attempts >= 2 or failure_count >= 2)),
        'latestError', (
          select coalesce(error, last_error)
          from public.appointment_notifications n2
          where n2.channel = 'email' and coalesce(n2.error, n2.last_error) is not null
          order by coalesce(n2.last_attempt_at, n2.created_at) desc
          limit 1
        )
      )
      from public.appointment_notifications
      where channel = 'email'
    ),
    'whatsapp', (
      select jsonb_build_object(
        'supported', true,
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'repeatedFailures', count(*) filter (where status = 'failed' and (attempts >= 2 or failure_count >= 2)),
        'latestError', (
          select coalesce(error, last_error)
          from public.appointment_notifications n2
          where n2.channel = 'whatsapp' and coalesce(n2.error, n2.last_error) is not null
          order by coalesce(n2.last_attempt_at, n2.created_at) desc
          limit 1
        )
      )
      from public.appointment_notifications
      where channel = 'whatsapp'
    ),
    'sms', (
      select jsonb_build_object(
        'supported', false,
        'unavailableReason', 'Le canal SMS n’est pas disponible tant qu’il n’a pas de fournisseur raccordé.',
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'),
        'repeatedFailures', 0,
        'latestError', 'channel_not_supported: sms'
      )
      from public.appointment_notifications
      where channel = 'sms'
    )
  ) into v_by_channel;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'salonId', g.salon_id,
        'salonName', g.salon_name,
        'failedCount', g.failed_count,
        'repeatedFailures', g.repeated_failures,
        'recentFailures24h', g.recent_failures_24h,
        'overduePending', g.overdue_pending,
        'latestError', g.latest_error
      )
      order by g.repeated_failures desc, g.failed_count desc, g.overdue_pending desc
    ),
    '[]'::jsonb
  )
  into v_salons_alerts
  from (
    select
      s.id as salon_id,
      s.name as salon_name,
      count(*) filter (where n.status = 'failed')::integer as failed_count,
      count(*) filter (where n.status = 'failed' and (n.attempts >= 2 or n.failure_count >= 2))::integer as repeated_failures,
      count(*) filter (where n.status = 'failed' and coalesce(n.last_attempt_at, n.created_at) >= now() - interval '24 hours')::integer as recent_failures_24h,
      count(*) filter (where n.status = 'pending' and n.scheduled_at < now() - interval '15 minutes')::integer as overdue_pending,
      (
        select coalesce(n2.error, n2.last_error)
        from public.appointment_notifications n2
        where n2.salon_id = s.id and coalesce(n2.error, n2.last_error) is not null
        order by coalesce(n2.last_attempt_at, n2.created_at) desc
        limit 1
      ) as latest_error
    from public.appointment_notifications n
    join public.salons s on s.id = n.salon_id
    group by s.id, s.name
    having
      count(*) filter (where n.status = 'failed') > 0
      or count(*) filter (where n.status = 'pending' and n.scheduled_at < now() - interval '15 minutes') > 0
    limit 15
  ) g;

  select jsonb_build_object(
    'id', r.id,
    'salonId', r.salon_id,
    'triggerSource', r.trigger_source,
    'providerConfigured', r.provider_configured,
    'emailConfigured', r.email_configured,
    'whatsappConfigured', r.whatsapp_configured,
    'whatsappTemplateMode', r.whatsapp_template_mode,
    'smsSupported', r.sms_supported,
    'processed', r.processed,
    'sent', r.sent,
    'failed', r.failed,
    'skipped', r.skipped,
    'error', r.error,
    'details', r.details,
    'createdAt', r.created_at
  )
  into v_last_run
  from public.notification_dispatch_runs r
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'counts', v_counts,
    'repeatedFailures', v_repeated_failures,
    'exhaustedFailures', v_exhausted_failures,
    'recentFailures24h', v_recent_failures_24h,
    'overduePending', v_overdue_pending,
    'stuckSending', v_stuck_sending,
    'byChannel', v_by_channel,
    'salonsWithIssues', v_salons_alerts,
    'scheduler', private.read_notification_scheduler_health(),
    'lastRun', v_last_run,
    'smsUnavailableReason', 'Le canal SMS n’est pas disponible tant qu’il n’a pas de fournisseur raccordé.'
  );
end;
$$;

revoke all on function public.platform_get_notification_health() from public, anon;
grant execute on function public.platform_get_notification_health() to authenticated;

-- 6. Aligner les promesses des forfaits SaaS sur l'état réel des canaux ----------------------
update public.saas_plans
set
  features = (
    select jsonb_agg(
      case
        when elem::text = '"Rappels SMS & WhatsApp anti-no-show"'
          then to_jsonb('Suivi des confirmations & rappels e-mail / WhatsApp (selon activation opérateur ; SMS non disponible)'::text)
        else elem
      end
      order by ord
    )
    from jsonb_array_elements(features) with ordinality as f(elem, ord)
  ),
  updated_at = now()
where features @> '["Rappels SMS & WhatsApp anti-no-show"]'::jsonb;

update public.saas_plan_drafts
set
  payload = jsonb_set(
    payload,
    '{features}',
    (
      select jsonb_agg(
        case
          when elem::text = '"Rappels SMS & WhatsApp anti-no-show"'
            then to_jsonb('Suivi des confirmations & rappels e-mail / WhatsApp (selon activation opérateur ; SMS non disponible)'::text)
          else elem
        end
        order by ord
      )
      from jsonb_array_elements(payload -> 'features') with ordinality as f(elem, ord)
    )
  ),
  updated_at = now()
where (payload -> 'features') @> '["Rappels SMS & WhatsApp anti-no-show"]'::jsonb;
