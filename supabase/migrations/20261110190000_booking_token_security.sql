-- P1 — Traitement du jeton de réservation comme un secret (révocation & renouvellement).
--
-- Jusqu'ici, `appointments.public_cancel_token` était un UUID immuable : un lien
-- fuité restait valide jusqu'à annulation ou réalisation. Cette migration :
--   1. rend `public_cancel_token` révocable (nullable + horodatages de rotation/révocation),
--      avec un index unique partiel sur les jetons actifs ;
--   2. permet au client porteur du jeton de le renouveler (`marketplace_rotate_booking_token`)
--      en invalidant immédiatement l'ancien jeton et en mettant à jour les notifications
--      non encore envoyées ;
--   3. permet au client de révoquer définitivement l'accès par lien
--      (`marketplace_revoke_booking_token`), en retirant le jeton de la file d'envoi ;
--   4. expose `token_rotated_at` dans `marketplace_booking_by_token` sans exposer de secrets tiers.

alter table public.appointments
  alter column public_cancel_token drop not null;

alter table public.appointments
  add column if not exists public_token_rotated_at timestamptz,
  add column if not exists public_token_revoked_at timestamptz;

drop index if exists public.appointments_public_token_idx;
create unique index if not exists appointments_public_token_idx
  on public.appointments (public_cancel_token)
  where public_cancel_token is not null;

-- Met à jour `marketplace_booking_by_token` pour exposer `token_rotated_at`.
create or replace function public.marketplace_booking_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_salon public.salons;
  v_review public.reviews;
  v_account public.loyalty_accounts;
  v_earned integer;
begin
  if p_token is null then
    raise exception 'Invalid token' using errcode = '22023';
  end if;
  select * into v_row from public.appointments where public_cancel_token = p_token limit 1;
  if not found then
    raise exception 'Booking not found' using errcode = '22023';
  end if;
  select * into v_salon from public.salons where id = v_row.salon_id;

  select * into v_review from public.reviews where appointment_id = v_row.id limit 1;
  if v_row.client_id is not null then
    select * into v_account from public.loyalty_accounts
      where salon_id = v_row.salon_id and client_id = v_row.client_id;
    select t.points into v_earned from public.loyalty_transactions t
      where t.appointment_id = v_row.id and t.kind = 'earned_service';
  end if;

  return jsonb_build_object(
    'booking', private.marketplace_booking_summary(v_row)
      || jsonb_build_object(
        'client_email', v_row.client_email,
        'client_phone', v_row.client_phone,
        'notes', v_row.notes,
        'created_at', v_row.created_at,
        'token_rotated_at', v_row.public_token_rotated_at
      ),
    'salon', jsonb_build_object(
      'id', v_salon.id, 'name', v_salon.name, 'slug', v_salon.slug, 'type', v_salon.type,
      'city', v_salon.city, 'commune', v_salon.commune, 'address', v_salon.address,
      'phone', v_salon.phone, 'whatsapp', v_salon.whatsapp,
      'logo_url', v_salon.logo_url, 'cover_url', v_salon.cover_url, 'currency', v_salon.currency),
    'can_cancel', v_row.status in ('pending', 'confirmed'),
    'can_review', v_row.status = 'completed' and v_review.id is null,
    'review', case when v_review.id is null then null else jsonb_build_object(
      'id', v_review.id, 'author', v_review.author, 'rating', v_review.rating,
      'comment', v_review.comment, 'verified', v_review.verified, 'created_at', v_review.created_at) end,
    'loyalty', case when v_account.client_id is null then null else jsonb_build_object(
      'points_balance', v_account.points_balance, 'tier', v_account.tier,
      'points_earned', coalesce(v_earned, 0)) end,
    'timeline', coalesce((select jsonb_agg(jsonb_build_object(
        'status', e.new_status, 'reason', e.reason, 'created_at', e.created_at) order by e.created_at)
      from public.appointment_events e where e.appointment_id = v_row.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.marketplace_booking_by_token(uuid) from public;
grant execute on function public.marketplace_booking_by_token(uuid) to anon, authenticated;

-- Renouvelle le jeton secret d'une réservation : invalide immédiatement l'ancien
-- lien et propage le nouveau jeton sur les notifications pas encore envoyées.
create function public.marketplace_rotate_booking_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_new_token uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if p_token is null then
    raise exception 'Invalid token' using errcode = '22023';
  end if;

  select * into v_row
    from public.appointments
   where public_cancel_token = p_token
   for update;

  if not found then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  update public.appointments
     set public_cancel_token = v_new_token,
         public_token_rotated_at = v_now,
         public_token_revoked_at = null,
         updated_at = v_now
   where id = v_row.id
   returning * into v_row;

  update public.appointment_notifications
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('booking_token', v_new_token)
   where appointment_id = v_row.id
     and status in ('pending', 'failed', 'skipped');

  insert into public.appointment_events(
    salon_id, branch_id, appointment_id, previous_status, new_status, reason, actor_id
  ) values (
    v_row.salon_id, v_row.branch_id, v_row.id, v_row.status, v_row.status,
    'Lien de suivi renouvelé par le client', null
  );

  return jsonb_build_object(
    'appointment_id', v_row.id,
    'token', v_new_token,
    'rotated_at', v_now
  );
end;
$$;
revoke all on function public.marketplace_rotate_booking_token(uuid) from public;
grant execute on function public.marketplace_rotate_booking_token(uuid) to anon, authenticated;

-- Révoque définitivement le jeton secret d'une réservation : plus aucun accès
-- autonome par lien n'est possible ensuite, et les notifications en attente
-- perdent leur `booking_token`.
create function public.marketplace_revoke_booking_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_now timestamptz := now();
begin
  if p_token is null then
    raise exception 'Invalid token' using errcode = '22023';
  end if;

  select * into v_row
    from public.appointments
   where public_cancel_token = p_token
   for update;

  if not found then
    raise exception 'Booking not found' using errcode = '22023';
  end if;

  update public.appointments
     set public_cancel_token = null,
         public_token_revoked_at = v_now,
         updated_at = v_now
   where id = v_row.id
   returning * into v_row;

  update public.appointment_notifications
     set payload = coalesce(payload, '{}'::jsonb) - 'booking_token'
   where appointment_id = v_row.id
     and status in ('pending', 'failed', 'skipped');

  insert into public.appointment_events(
    salon_id, branch_id, appointment_id, previous_status, new_status, reason, actor_id
  ) values (
    v_row.salon_id, v_row.branch_id, v_row.id, v_row.status, v_row.status,
    'Accès par lien révoqué par le client', null
  );

  return jsonb_build_object(
    'appointment_id', v_row.id,
    'revoked', true,
    'revoked_at', v_now
  );
end;
$$;
revoke all on function public.marketplace_revoke_booking_token(uuid) from public;
grant execute on function public.marketplace_revoke_booking_token(uuid) to anon, authenticated;
