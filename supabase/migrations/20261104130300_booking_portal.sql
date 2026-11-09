-- Parcours client complet (4/4) — page de suivi persistante + avis vérifié.
-- Le jeton public de la réservation (déjà généré à la création) devient la clé
-- d'un portail client : suivre, annuler, puis noter la prestation terminée.
-- Accès anonyme uniquement via ces RPC security definer, jamais via les tables.

create function public.marketplace_booking_by_token(p_token uuid)
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
      || jsonb_build_object('client_email', v_row.client_email, 'client_phone', v_row.client_phone,
                            'notes', v_row.notes, 'created_at', v_row.created_at),
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

-- Avis vérifié : le jeton prouve la réservation, le statut « completed » prouve
-- la prestation. Un seul avis par rendez-vous, jamais modifiable par ce canal.
create function public.marketplace_submit_review(
  p_token uuid, p_rating integer, p_comment text, p_author text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_author text := left(coalesce(nullif(btrim(p_author), ''), ''), 120);
  v_review public.reviews;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Invalid rating' using errcode = '22023';
  end if;
  if char_length(v_comment) not between 3 and 1000 then
    raise exception 'Invalid review comment' using errcode = '22023';
  end if;

  select * into v_row from public.appointments where public_cancel_token = p_token for update;
  if not found then
    raise exception 'Booking not found' using errcode = '22023';
  end if;
  if v_row.status <> 'completed' then
    raise exception 'Service not completed yet' using errcode = '22023';
  end if;
  if exists (select 1 from public.reviews r where r.appointment_id = v_row.id) then
    raise exception 'Review already submitted' using errcode = '22023';
  end if;
  if v_author = '' then
    v_author := v_row.client_name;
  end if;

  insert into public.reviews(salon_id, client_id, appointment_id, author, rating, comment, verified)
    values (v_row.salon_id, v_row.client_id, v_row.id, v_author, p_rating, v_comment, true)
    returning * into v_review;

  return jsonb_build_object('id', v_review.id, 'author', v_review.author, 'rating', v_review.rating,
    'comment', v_review.comment, 'verified', v_review.verified, 'created_at', v_review.created_at);
end;
$$;
revoke all on function public.marketplace_submit_review(uuid, integer, text, text) from public;
grant execute on function public.marketplace_submit_review(uuid, integer, text, text) to anon, authenticated;
