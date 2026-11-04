-- Lot 7 — file d'attente de notifications (outbox) pour les rendez-vous.
-- Aucune envoi réel n'est effectué ici : le fournisseur e-mail/WhatsApp/SMS
-- reste à brancher (edge function + secret). Les lignes sont tracées et
-- consultables par le salon ; le statut « pending » est honnête.

create table public.appointment_notifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  appointment_id uuid not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  kind text not null check (kind in ('booking_received', 'booking_confirmed', 'booking_cancelled', 'reminder_24h')),
  recipient text not null check (char_length(btrim(recipient)) between 3 and 160),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  foreign key (salon_id, appointment_id) references public.appointments(salon_id, id) on delete cascade
);
create index appointment_notifications_salon_idx on public.appointment_notifications (salon_id, status, scheduled_at);
create index appointment_notifications_appointment_idx on public.appointment_notifications (appointment_id);

alter table public.appointment_notifications enable row level security;
revoke all on public.appointment_notifications from public, anon, authenticated;
grant select on public.appointment_notifications to authenticated;
create policy appointment_notifications_read_member on public.appointment_notifications for select to authenticated
  using (private.has_salon_permission(salon_id, 'appointments.read'));

create function private.enqueue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_email text;
  v_phone text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'booking_received';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_kind := case new.status
      when 'confirmed' then 'booking_confirmed'
      when 'cancelled' then 'booking_cancelled'
      else null
    end;
  else
    return new;
  end if;
  if v_kind is null then
    return new;
  end if;

  v_email := nullif(btrim(coalesce(new.client_email, '')), '');
  v_phone := nullif(btrim(coalesce(new.client_phone, '')), '');

  if v_email is not null then
    insert into public.appointment_notifications(salon_id, appointment_id, channel, kind, recipient, payload, scheduled_at)
      values (new.salon_id, new.id, 'email', v_kind, v_email,
              jsonb_build_object('client_name', new.client_name, 'service_name', new.service_name, 'starts_at', new.starts_at), now());
    if v_kind = 'booking_received' and new.starts_at > now() + interval '24 hours' then
      insert into public.appointment_notifications(salon_id, appointment_id, channel, kind, recipient, payload, scheduled_at)
        values (new.salon_id, new.id, 'email', 'reminder_24h', v_email,
                jsonb_build_object('client_name', new.client_name, 'service_name', new.service_name, 'starts_at', new.starts_at),
                new.starts_at - interval '24 hours');
    end if;
  end if;
  if v_phone is not null then
    insert into public.appointment_notifications(salon_id, appointment_id, channel, kind, recipient, payload, scheduled_at)
      values (new.salon_id, new.id, 'whatsapp', v_kind, v_phone,
              jsonb_build_object('client_name', new.client_name, 'service_name', new.service_name, 'starts_at', new.starts_at), now());
  end if;
  return new;
end;
$$;
create trigger appointments_enqueue_notifications
  after insert or update of status on public.appointments
  for each row execute function private.enqueue_appointment_notifications();
