-- Parcours client complet (3/4) — file d'envoi exploitable par un vrai expéditeur.
-- La base reste seule responsable de la file : elle réserve les messages
-- (claim), l'expéditeur externe rapporte le résultat (mark). Un message ne peut
-- être pris que par un seul travailleur grâce à FOR UPDATE SKIP LOCKED.

alter table public.appointment_notifications
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists provider_message_id text;

alter table public.appointment_notifications drop constraint if exists appointment_notifications_status_check;
alter table public.appointment_notifications add constraint appointment_notifications_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));

alter table public.appointment_notifications drop constraint if exists appointment_notifications_kind_check;
alter table public.appointment_notifications add constraint appointment_notifications_kind_check
  check (kind in ('booking_received', 'booking_confirmed', 'booking_cancelled', 'reminder_24h', 'review_request'));

create index if not exists appointment_notifications_dispatch_idx
  on public.appointment_notifications (status, scheduled_at) where status in ('pending', 'sending');

-- Déclencheur enrichi : lien de suivi + invitation à laisser un avis vérifié.
create or replace function private.enqueue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_email text;
  v_phone text;
  v_payload jsonb;
  v_salon_name text;
  v_scheduled timestamptz := now();
begin
  if tg_op = 'INSERT' then
    v_kind := 'booking_received';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_kind := case new.status
      when 'confirmed' then 'booking_confirmed'
      when 'cancelled' then 'booking_cancelled'
      when 'completed' then 'review_request'
      else null
    end;
  else
    return new;
  end if;
  if v_kind is null then
    return new;
  end if;

  -- L'invitation à noter part 2 h après la fin de la prestation.
  if v_kind = 'review_request' then
    v_scheduled := now() + interval '2 hours';
  end if;

  select s.name into v_salon_name from public.salons s where s.id = new.salon_id;
  v_payload := jsonb_build_object(
    'client_name', new.client_name,
    'service_name', new.service_name,
    'staff_name', new.staff_name,
    'starts_at', new.starts_at,
    'amount', new.amount,
    'currency', new.currency,
    'salon_name', coalesce(v_salon_name, ''),
    'booking_token', new.public_cancel_token
  );

  v_email := nullif(btrim(coalesce(new.client_email, '')), '');
  v_phone := nullif(btrim(coalesce(new.client_phone, '')), '');

  if v_email is not null then
    insert into public.appointment_notifications(salon_id, appointment_id, channel, kind, recipient, payload, scheduled_at)
      values (new.salon_id, new.id, 'email', v_kind, v_email, v_payload, v_scheduled);
    if v_kind = 'booking_received' and new.starts_at > now() + interval '24 hours' then
      insert into public.appointment_notifications(salon_id, appointment_id, channel, kind, recipient, payload, scheduled_at)
        values (new.salon_id, new.id, 'email', 'reminder_24h', v_email, v_payload,
                new.starts_at - interval '24 hours');
    end if;
  end if;
  if v_phone is not null then
    insert into public.appointment_notifications(salon_id, appointment_id, channel, kind, recipient, payload, scheduled_at)
      values (new.salon_id, new.id, 'whatsapp', v_kind, v_phone, v_payload, v_scheduled);
  end if;
  return new;
end;
$$;

-- Autorisation d'envoi manuel depuis l'ERP : même droit que la gestion des RDV.
create function public.can_manage_notifications(p_salon_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_salon_permission(p_salon_id, 'appointments.write');
$$;
revoke all on function public.can_manage_notifications(uuid) from public, anon;
grant execute on function public.can_manage_notifications(uuid) to authenticated;

-- Réservation de lot. Réservé au rôle service (edge function), jamais au navigateur.
create function public.claim_due_notifications(p_limit integer default 25, p_salon_id uuid default null)
returns setof public.appointment_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid batch size' using errcode = '22023';
  end if;
  return query
  with candidate as (
    select n.id from public.appointment_notifications n
     where n.scheduled_at <= now()
       and n.attempts < 5
       and (n.status = 'pending' or (n.status = 'sending' and n.locked_at < now() - interval '10 minutes'))
       and (p_salon_id is null or n.salon_id = p_salon_id)
     order by n.scheduled_at
     for update skip locked
     limit p_limit
  )
  update public.appointment_notifications n
     set status = 'sending', attempts = n.attempts + 1, last_attempt_at = now(), locked_at = now()
    from candidate c where n.id = c.id
  returning n.*;
end;
$$;
revoke all on function public.claim_due_notifications(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(integer, uuid) to service_role;

create function public.mark_notification_result(
  p_id uuid, p_status text, p_provider_message_id text default null, p_error text default null
)
returns public.appointment_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.appointment_notifications;
begin
  if p_status not in ('sent', 'failed', 'skipped', 'pending') then
    raise exception 'Invalid notification status' using errcode = '22023';
  end if;
  update public.appointment_notifications set
    status = p_status,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error = left(nullif(btrim(coalesce(p_error, '')), ''), 500),
    sent_at = case when p_status = 'sent' then now() else sent_at end,
    locked_at = null
  where id = p_id returning * into v_row;
  if not found then
    raise exception 'Notification not found' using errcode = '22023';
  end if;
  return v_row;
end;
$$;
revoke all on function public.mark_notification_result(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mark_notification_result(uuid, text, text, text) to service_role;

-- Relance manuelle d'un message échoué ou ignoré, depuis l'ERP.
create function public.retry_notification(p_salon_id uuid, p_id uuid)
returns public.appointment_notifications
language plpgsql security definer set search_path = ''
as $$
declare v_row public.appointment_notifications;
begin
  if not private.has_salon_permission(p_salon_id, 'appointments.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.appointment_notifications set
    status = 'pending', attempts = 0, error = null, locked_at = null, scheduled_at = now()
  where id = p_id and salon_id = p_salon_id and status in ('failed', 'skipped')
  returning * into v_row;
  if not found then
    raise exception 'Notification cannot be retried' using errcode = '22023';
  end if;
  return v_row;
end;
$$;
revoke all on function public.retry_notification(uuid, uuid) from public, anon;
grant execute on function public.retry_notification(uuid, uuid) to authenticated;
