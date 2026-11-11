-- Migration 20261110120000: Actions SuperAdmin serveur, modération des avis,
-- suspension effective des salons et journal d'audit structuré (avant/après/motif).
--
-- Objectifs :
-- 1. Persister publication, certification, suspension/réactivation, édition locataire
--    et modération d'avis dans PostgreSQL uniquement.
-- 2. Construire les données d'abonnement admin uniquement depuis public.saas_subscriptions
--    et public.saas_subscription_payments (aucun contournement local ou sans validation).
-- 3. Bloquer toute action admin si l'appelant n'est pas autorisé dans public.platform_admins
--    (rôle 'super_admin').
-- 4. Appliquer la suspension (status = 'suspended') sur toutes les RPC publiques
--    marketplace, customizer et publication propriétaire.
-- 5. Exclure les avis masqués (is_hidden = true) des notes et listes publiques.
-- 6. Tracer acteur, rôle, e-mail JWT, date, cible, valeurs avant/après et motif obligatoire
--    dans public.platform_audit_logs.

-- 1. Colonnes de statut / certification sur public.salons ----------------------------------------
alter table public.salons
  add column if not exists status text not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists verified_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.salons drop constraint if exists salons_status_check;
alter table public.salons
  add constraint salons_status_check check (status in ('active', 'suspended'));

update public.salons
set verified_at = coalesce(verified_at, publication_date, now())
where is_verified = true and verified_at is null;

-- 2. Colonnes de modération sur public.reviews ----------------------------------------------------
alter table public.reviews
  add column if not exists is_hidden boolean not null default false,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_reason text;

create index if not exists reviews_salon_visible_idx
  on public.reviews (salon_id, created_at desc)
  where verified and not is_hidden;

-- 3. Journal d'audit structuré sur public.platform_audit_logs -------------------------------------
alter table public.platform_audit_logs
  add column if not exists actor_role text,
  add column if not exists actor_email text,
  add column if not exists before_values jsonb,
  add column if not exists after_values jsonb,
  add column if not exists reason text;

create index if not exists platform_audit_logs_target_idx
  on public.platform_audit_logs (target_type, target_id, created_at desc);

-- 4. Helpers d'autorisation et d'audit ------------------------------------------------------------
create or replace function private.current_actor_email()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_claims text;
begin
  v_email := nullif(btrim(coalesce(current_setting('request.jwt.claim.email', true), '')), '');
  if v_email is not null then
    return lower(v_email);
  end if;

  v_claims := nullif(btrim(coalesce(current_setting('request.jwt.claims', true), '')), '');
  if v_claims is not null then
    v_email := nullif(btrim(coalesce((v_claims::jsonb) ->> 'email', '')), '');
    if v_email is not null then
      return lower(v_email);
    end if;
  end if;

  return null;
exception
  when others then
    return null;
end;
$$;
revoke all on function private.current_actor_email() from public, anon, authenticated;

create or replace function private.require_platform_role(
  p_allowed_roles text[] default array['super_admin']
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_role text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  select pa.role into v_role
  from public.platform_admins pa
  where pa.user_id = v_uid;

  if v_role is null or not (v_role = any(coalesce(p_allowed_roles, array['super_admin']))) then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  return v_role;
end;
$$;
revoke all on function private.require_platform_role(text[]) from public, anon, authenticated;

create or replace function private.require_audit_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Un motif est obligatoire (entre 3 et 500 caractères).' using errcode = '22023';
  end if;
  return v_reason;
end;
$$;
revoke all on function private.require_audit_reason(text) from public, anon, authenticated;

create or replace function private.write_platform_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  select pa.role into v_role
  from public.platform_admins pa
  where pa.user_id = v_uid;

  insert into public.platform_audit_logs (
    actor_user_id,
    actor_role,
    actor_email,
    action,
    target_type,
    target_id,
    before_values,
    after_values,
    reason,
    details
  )
  values (
    v_uid,
    v_role,
    private.current_actor_email(),
    p_action,
    p_target_type,
    p_target_id,
    case when v_details ? 'before' then v_details -> 'before' else null end,
    case when v_details ? 'after' then v_details -> 'after' else null end,
    nullif(btrim(coalesce(v_details ->> 'reason', '')), ''),
    v_details
  );
end;
$$;
revoke all on function private.write_platform_audit(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.record_platform_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb,
  p_after jsonb,
  p_reason text,
  p_extra jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_details jsonb;
begin
  select pa.role into v_role
  from public.platform_admins pa
  where pa.user_id = v_uid;

  v_details := coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
    'before', p_before,
    'after', p_after,
    'reason', v_reason
  );

  insert into public.platform_audit_logs (
    actor_user_id,
    actor_role,
    actor_email,
    action,
    target_type,
    target_id,
    before_values,
    after_values,
    reason,
    details
  )
  values (
    v_uid,
    v_role,
    private.current_actor_email(),
    p_action,
    p_target_type,
    p_target_id,
    p_before,
    p_after,
    v_reason,
    v_details
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function private.record_platform_audit(text, text, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

create or replace function private.admin_salon_summary(p_salon_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'organization_id', s.organization_id,
      'organization_name', coalesce(o.name, ''),
      'type', s.type,
      'country', s.country,
      'city', s.city,
      'commune', s.commune,
      'quarter', s.quarter,
      'address', s.address,
      'phone', s.phone,
      'whatsapp', s.whatsapp,
      'email', s.email,
      'logo_url', s.logo_url,
      'cover_url', s.cover_url,
      'is_published', s.is_published,
      'is_verified', s.is_verified,
      'verified_at', s.verified_at,
      'status', s.status,
      'suspended_at', s.suspended_at,
      'suspension_reason', s.suspension_reason,
      'publication_date', s.publication_date,
      'created_at', s.created_at,
      'updated_at', s.updated_at
    )
    || jsonb_build_object(
      'subscription_id', sub.id,
      'subscription_plan_id', sub.plan_id,
      'subscription_status', sub.status,
      'subscription_plan_name', p.name,
      'subscription_price_xof', sub.price_at_subscription,
      'subscription_billing_period', sub.billing_period,
      'subscription_started_at', case
        when sub.status in ('active', 'trialing', 'past_due')
          or (sub.status = 'cancelled' and sub.current_period_end > sub.started_at)
        then sub.started_at
        else null
      end,
      'subscription_current_period_end', case
        when sub.status in ('active', 'trialing', 'past_due')
          or (sub.status = 'cancelled' and sub.current_period_end > sub.started_at)
        then sub.current_period_end
        else null
      end,
      'subscription_payment_id', sub_pay.id,
      'subscription_payment_status', sub_pay.status,
      'subscription_payment_amount_xof', sub_pay.amount_xof,
      'subscription_payment_method', sub_pay.method,
      'subscription_payment_reference', sub_pay.reference,
      'subscription_payment_declared_at', sub_pay.declared_at,
      'subscription_payment_decided_at', sub_pay.decided_at,
      'subscription_payment_decision_reason', sub_pay.decision_reason
    )
    || jsonb_build_object(
      'pending_subscription_id', pending_sub.id,
      'pending_subscription_plan_id', pending_sub.plan_id,
      'pending_subscription_plan_name', pending_plan.name,
      'pending_subscription_price_xof', pending_sub.price_at_subscription,
      'pending_subscription_billing_period', pending_sub.billing_period,
      'pending_payment_id', pending_pay.id,
      'pending_payment_status', pending_pay.status,
      'pending_payment_amount_xof', pending_pay.amount_xof,
      'pending_payment_method', pending_pay.method,
      'pending_payment_reference', pending_pay.reference,
      'pending_payment_declared_at', pending_pay.declared_at,
      'pending_payment_decision_reason', pending_pay.decision_reason,
      'staff_count', coalesce(st.cnt, 0),
      'service_count', coalesce(sv.cnt, 0),
      'appointments_count', coalesce(ap.cnt, 0),
      'revenue_xof', coalesce(py.total, 0),
      'rating', rv.avg_rating,
      'review_count', coalesce(rv.visible_cnt, 0),
      'total_review_count', coalesce(rv.total_cnt, 0)
    )
  from public.salons s
  left join public.organizations o on o.id = s.organization_id
  left join lateral (
    select sub_row.*
    from public.saas_subscriptions sub_row
    where sub_row.salon_id = s.id
    order by
      case sub_row.status
        when 'active' then 1
        when 'trialing' then 2
        when 'pending_payment' then 3
        when 'past_due' then 4
        else 5
      end,
      sub_row.updated_at desc,
      sub_row.created_at desc
    limit 1
  ) sub on true
  left join public.saas_plans p on p.id = sub.plan_id
  left join lateral (
    select pay_row.*
    from public.saas_subscription_payments pay_row
    where pay_row.subscription_id = sub.id
    order by
      case pay_row.status
        when 'confirmed' then 1
        when 'pending' then 2
        else 3
      end,
      pay_row.declared_at desc
    limit 1
  ) sub_pay on sub.id is not null
  left join lateral (
    select ps.*
    from public.saas_subscriptions ps
    where ps.salon_id = s.id
      and ps.status = 'pending_payment'
    order by ps.created_at desc
    limit 1
  ) pending_sub on true
  left join public.saas_plans pending_plan on pending_plan.id = pending_sub.plan_id
  left join lateral (
    select pp.*
    from public.saas_subscription_payments pp
    where pp.subscription_id = pending_sub.id
    order by pp.declared_at desc
    limit 1
  ) pending_pay on pending_sub.id is not null
  left join lateral (
    select count(*)::bigint as cnt
    from public.staff st_row
    where st_row.salon_id = s.id and st_row.is_active
  ) st on true
  left join lateral (
    select count(*)::bigint as cnt
    from public.services sv_row
    where sv_row.salon_id = s.id and sv_row.is_active
  ) sv on true
  left join lateral (
    select count(*)::bigint as cnt
    from public.appointments ap_row
    where ap_row.salon_id = s.id
  ) ap on true
  left join lateral (
    select coalesce(sum(private.payment_signed_amount(py_row.kind, py_row.amount)), 0)::bigint as total
    from public.payments py_row
    where py_row.salon_id = s.id and py_row.status = 'confirmed'
  ) py on true
  left join lateral (
    select
      round(avg(r_row.rating) filter (where r_row.verified and not r_row.is_hidden)::numeric, 1) as avg_rating,
      count(*) filter (where r_row.verified and not r_row.is_hidden)::bigint as visible_cnt,
      count(*)::bigint as total_cnt
    from public.reviews r_row
    where r_row.salon_id = s.id
  ) rv on true
  where s.id = p_salon_id;
$$;
revoke all on function private.admin_salon_summary(uuid) from public, anon, authenticated;

-- 5. Application de la suspension et des avis masqués aux RPC existantes -----------------------
create or replace function public.set_salon_publication(p_salon_id uuid, p_published boolean)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.salons;
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_row from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon not found' using errcode = '22023';
  end if;
  if p_published then
    if v_row.status = 'suspended' then
      raise exception 'Ce salon est suspendu et ne peut pas être publié.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.services s where s.salon_id = p_salon_id and s.is_active) then
      raise exception 'At least one active service is required to publish' using errcode = '22023';
    end if;
    if btrim(v_row.address) = '' or btrim(v_row.phone) = '' or v_row.cover_url is null then
      raise exception 'Address, phone and cover photo are required to publish' using errcode = '22023';
    end if;
    v_row.publication_date := coalesce(v_row.publication_date, now());
  end if;
  update public.salons
  set is_published = p_published,
      publication_date = v_row.publication_date,
      updated_at = now()
  where id = p_salon_id
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.set_salon_publication(uuid, boolean) from public, anon;
grant execute on function public.set_salon_publication(uuid, boolean) to authenticated;

create or replace function public.publish_marketplace_customizer(p_salon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.salon_marketplace_settings;
  v_salon public.salons;
  v_featured_services uuid[] := '{}';
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_salon from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon not found' using errcode = '22023';
  end if;
  if v_salon.status = 'suspended' then
    raise exception 'Ce salon est suspendu et ne peut pas être publié.' using errcode = '22023';
  end if;

  select * into v_rec from public.salon_marketplace_settings where salon_id = p_salon_id for update;
  if not found then
    raise exception 'Customizer settings not found. Save a draft first' using errcode = '22023';
  end if;

  if not exists (select 1 from public.services s where s.salon_id = p_salon_id and s.is_active) then
    raise exception 'At least one active service is required to publish' using errcode = '22023';
  end if;
  if btrim(v_salon.address) = '' or btrim(v_salon.phone) = '' or v_salon.cover_url is null then
    raise exception 'Address, phone and cover photo are required to publish' using errcode = '22023';
  end if;

  if v_rec.draft_config ? 'featuredServiceIds' then
    select coalesce(array_agg(value::uuid), '{}') into v_featured_services
    from jsonb_array_elements_text(v_rec.draft_config -> 'featuredServiceIds') as t(value);
  end if;

  update public.salon_marketplace_settings set
    published_config = v_rec.draft_config,
    is_published = true,
    published_at = now(),
    updated_at = now()
  where salon_id = p_salon_id
  returning * into v_rec;

  update public.salons set
    is_published = true,
    publication_date = coalesce(publication_date, now()),
    featured_service_ids = v_featured_services,
    updated_at = now()
  where id = p_salon_id;

  return jsonb_build_object(
    'salon_id', v_rec.salon_id,
    'layout', v_rec.layout,
    'accent_color', v_rec.accent_color,
    'card_style', v_rec.card_style,
    'draft_config', v_rec.draft_config,
    'published_config', v_rec.published_config,
    'is_published', v_rec.is_published,
    'published_at', v_rec.published_at,
    'updated_at', v_rec.updated_at
  );
end;
$$;
revoke all on function public.publish_marketplace_customizer(uuid) from public, anon;
grant execute on function public.publish_marketplace_customizer(uuid) to authenticated;

create or replace function public.marketplace_list_salons(
  p_query text default null,
  p_commune text default null,
  p_city text default null,
  p_category text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid limit' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(card order by card->>'publication_date' desc nulls last, card->>'name'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', s.id, 'name', s.name, 'slug', s.slug, 'tagline', s.tagline, 'type', s.type,
        'logo_url', s.logo_url, 'cover_url', s.cover_url, 'country', s.country, 'city', s.city,
        'commune', s.commune, 'quarter', s.quarter, 'address', s.address,
        'phone', s.phone, 'whatsapp', s.whatsapp, 'currency', s.currency,
        'status', s.status,
        'is_published', s.is_published, 'is_verified', s.is_verified,
        'publication_date', s.publication_date,
        'rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.salon_id = s.id and r.verified and not r.is_hidden),
        'review_count', (select count(*) from public.reviews r where r.salon_id = s.id and r.verified and not r.is_hidden),
        'min_price', (select min(sv.price) from public.services sv where sv.salon_id = s.id and sv.is_active),
        'service_count', (select count(*) from public.services sv where sv.salon_id = s.id and sv.is_active)
      ) as card
      from public.salons s
      where s.is_published
        and s.status = 'active'
        and (p_city is null or lower(s.city) = lower(p_city))
        and (p_commune is null or lower(s.commune) = lower(p_commune))
        and (v_query is null or s.name ilike '%' || v_query || '%' or s.tagline ilike '%' || v_query || '%'
             or s.commune ilike '%' || v_query || '%' or s.quarter ilike '%' || v_query || '%')
        and (p_category is null or exists (
          select 1 from public.services sv where sv.salon_id = s.id and sv.is_active and sv.category = p_category
        ))
      order by s.publication_date desc nulls last, s.name
      limit p_limit
    ) cards;
  return v_result;
end;
$$;
revoke all on function public.marketplace_list_salons(text, text, text, text, integer) from public;
grant execute on function public.marketplace_list_salons(text, text, text, text, integer) to anon, authenticated;

create or replace function public.marketplace_salon_detail(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_settings public.salon_marketplace_settings;
  v_customizer jsonb;
  v_visible_staff uuid[] := '{}';
  v_has_published_staff_filter boolean := false;
  v_result jsonb;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'Invalid salon key' using errcode = '22023';
  end if;

  select * into v_salon from public.salons s
    where s.is_published
      and s.status = 'active'
      and (s.slug = lower(btrim(p_key)) or s.id::text = btrim(p_key))
    limit 1;
  if not found then
    raise exception 'Salon not found or not published' using errcode = '22023';
  end if;

  select * into v_settings from public.salon_marketplace_settings sms where sms.salon_id = v_salon.id;
  if found and v_settings.published_config is not null then
    v_customizer := v_settings.published_config;
    if v_customizer ? 'visibleStaffIds' and jsonb_typeof(v_customizer -> 'visibleStaffIds') = 'array' then
      v_has_published_staff_filter := true;
      select coalesce(array_agg(value::uuid), '{}') into v_visible_staff
      from jsonb_array_elements_text(v_customizer -> 'visibleStaffIds') as t(value);
    end if;
  else
    v_customizer := private.build_default_marketplace_config(v_salon.id);
  end if;

  select jsonb_build_object(
    'salon', to_jsonb(v_salon),
    'rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.salon_id = v_salon.id and r.verified and not r.is_hidden),
    'review_count', (select count(*) from public.reviews r where r.salon_id = v_salon.id and r.verified and not r.is_hidden),
    'min_price', (select min(sv.price) from public.services sv where sv.salon_id = v_salon.id and sv.is_active),
    'services', coalesce((select jsonb_agg(to_jsonb(sv) order by sv.category, sv.name)
      from public.services sv where sv.salon_id = v_salon.id and sv.is_active), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role,
        'specialties', st.specialties, 'service_ids', st.service_ids
      ) order by st.name)
      from public.staff st
      where st.salon_id = v_salon.id and st.is_active and st.is_available
        and (not v_has_published_staff_filter or st.id = any(v_visible_staff))
      ), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'author', r.author, 'rating', r.rating, 'comment', r.comment,
        'verified', r.verified, 'created_at', r.created_at
      ) order by r.created_at desc)
      from public.reviews r where r.salon_id = v_salon.id and r.verified and not r.is_hidden), '[]'::jsonb),
    'branches', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'timezone', b.timezone,
        'hours', coalesce((select jsonb_agg(jsonb_build_object(
            'weekday', h.weekday, 'is_open', h.is_open, 'opens_at', h.opens_at, 'closes_at', h.closes_at
          ) order by h.weekday)
          from public.branch_hours h where h.branch_id = b.id), '[]'::jsonb)
      ) order by b.created_at)
      from public.branches b where b.salon_id = v_salon.id), '[]'::jsonb),
    'customizer', v_customizer
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.marketplace_salon_detail(text) from public;
grant execute on function public.marketplace_salon_detail(text) to anon, authenticated;

create or replace function public.marketplace_day_availability(
  p_salon_id uuid,
  p_date date,
  p_service_id uuid default null,
  p_staff_id uuid default null
)
returns table (staff_id uuid, starts_at timestamptz, available boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_minutes integer := 30;
  v_live boolean;
begin
  select (s.is_published and s.status = 'active')
    into v_live
  from public.salons s
  where s.id = p_salon_id;

  if not coalesce(v_live, false) then
    raise exception 'Salon not found or not published' using errcode = '22023';
  end if;
  if p_date is null or p_date < (now() at time zone 'Africa/Abidjan')::date
    or p_date > (now() at time zone 'Africa/Abidjan')::date + 60 then
    raise exception 'Invalid date' using errcode = '22023';
  end if;
  if p_service_id is not null then
    select sv.duration_minutes + sv.prep_minutes into v_minutes
      from public.services sv
      where sv.id = p_service_id and sv.salon_id = p_salon_id and sv.is_active;
    if not found then
      raise exception 'Service unavailable' using errcode = '22023';
    end if;
  end if;

  return query
  select st.id,
         slot.starts_at,
         private.is_slot_available(
           p_salon_id, st.branch_id, st.id, slot.starts_at,
           slot.starts_at + make_interval(mins => v_minutes), null)
  from public.staff st
  left join public.branches b on b.salon_id = st.salon_id and b.id = st.branch_id
  cross join lateral (
    select (p_date::timestamp + make_interval(hours => g.h))
             at time zone coalesce(b.timezone, 'Africa/Abidjan') as starts_at
    from generate_series(8, 19) as g(h)
  ) slot
  where st.salon_id = p_salon_id and st.is_active and st.is_available
    and (p_staff_id is null or st.id = p_staff_id)
    and (p_service_id is null or array_length(st.service_ids, 1) is null or p_service_id = any(st.service_ids))
  order by st.name, slot.starts_at;
end;
$$;
revoke all on function public.marketplace_day_availability(uuid, date, uuid, uuid) from public;
grant execute on function public.marketplace_day_availability(uuid, date, uuid, uuid) to anon, authenticated;

create or replace function public.marketplace_book_appointment(
  p_salon_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_idempotency_key uuid,
  p_staff_id uuid default null,
  p_client_email text default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_service public.services;
  v_staff public.staff;
  v_existing public.appointments;
  v_row public.appointments;
  v_branch uuid;
  v_ends timestamptz;
  v_client uuid;
  v_name text := btrim(coalesce(p_client_name, ''));
  v_phone text := btrim(coalesce(p_client_phone, ''));
  v_email text := nullif(lower(btrim(coalesce(p_client_email, ''))), '');
  v_notes text := btrim(coalesce(p_notes, ''));
  v_staff_id uuid := p_staff_id;
  v_recent integer;
begin
  if p_idempotency_key is null then
    raise exception 'Idempotency key required' using errcode = '22023';
  end if;
  select * into v_salon from public.salons where id = p_salon_id;
  if not found or not v_salon.is_published or v_salon.status <> 'active' then
    raise exception 'Salon not found or not published' using errcode = '22023';
  end if;

  select * into v_existing from public.appointments
    where salon_id = p_salon_id and public_idempotency_key = p_idempotency_key;
  if found then
    return private.marketplace_booking_summary(v_existing);
  end if;

  if char_length(v_name) not between 1 and 120
    or char_length(v_phone) not between 3 and 40
    or char_length(v_notes) > 500 then
    raise exception 'Invalid client details' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  if p_starts_at is null
    or p_starts_at < now() + interval '5 minutes'
    or p_starts_at > now() + interval '60 days' then
    raise exception 'Invalid booking time' using errcode = '22023';
  end if;

  select count(*) into v_recent from public.appointments a
    where a.salon_id = p_salon_id and a.source = 'marketplace'
      and a.client_phone = v_phone and a.created_at > now() - interval '1 day';
  if v_recent >= 5 then
    raise exception 'Too many recent bookings for this phone number' using errcode = '22023';
  end if;

  select * into v_service from public.services
    where id = p_service_id and salon_id = p_salon_id and is_active;
  if not found then
    raise exception 'Service unavailable' using errcode = '22023';
  end if;
  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes + v_service.prep_minutes);

  if v_staff_id is null then
    select st.id into v_staff_id
      from public.staff st
     where st.salon_id = p_salon_id and st.is_active and st.is_available
       and (array_length(st.service_ids, 1) is null or p_service_id = any(st.service_ids))
       and private.is_slot_available(p_salon_id, st.branch_id, st.id, p_starts_at, v_ends, null)
     order by st.name
     limit 1;
    if v_staff_id is null then
      raise exception 'Slot unavailable' using errcode = '23P01';
    end if;
  end if;

  select * into v_staff from public.staff
    where id = v_staff_id and salon_id = p_salon_id for update;
  if not found or not v_staff.is_active or not v_staff.is_available then
    raise exception 'Staff unavailable' using errcode = '22023';
  end if;
  if array_length(v_staff.service_ids, 1) is not null and not (p_service_id = any(v_staff.service_ids)) then
    raise exception 'Staff does not perform this service' using errcode = '22023';
  end if;

  v_branch := v_staff.branch_id;
  if v_branch is null then
    select b.id into v_branch from public.branches b
      where b.salon_id = p_salon_id order by b.created_at limit 1;
  end if;
  if v_branch is null then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  if not private.is_slot_available(p_salon_id, v_branch, v_staff_id, p_starts_at, v_ends, null) then
    raise exception 'Slot unavailable' using errcode = '23P01';
  end if;

  v_client := private.ensure_client_for_contact(p_salon_id, v_name, v_phone, v_email);

  insert into public.appointments(
    salon_id, branch_id, client_id, staff_id, service_id, client_name, client_phone, client_email,
    service_name, staff_name, starts_at, ends_at, amount, currency, source, status,
    payment_status, notes, created_by, public_idempotency_key
  ) values (
    p_salon_id, v_branch, v_client, v_staff_id, p_service_id, v_name, v_phone, v_email,
    v_service.name, v_staff.name, p_starts_at, v_ends, v_service.price, 'XOF', 'marketplace', 'pending',
    'unpaid', v_notes, null, p_idempotency_key
  ) returning * into v_row;

  insert into public.appointment_events(salon_id, branch_id, appointment_id, new_status, reason, actor_id)
    values (p_salon_id, v_branch, v_row.id, 'pending', 'Réservation en ligne', null);

  return private.marketplace_booking_summary(v_row);
end;
$$;
revoke all on function public.marketplace_book_appointment(uuid, uuid, timestamptz, text, text, uuid, uuid, text, text) from public;
grant execute on function public.marketplace_book_appointment(uuid, uuid, timestamptz, text, text, uuid, uuid, text, text) to anon, authenticated;

-- 6. Métriques plateforme et audit structuré de review_saas_payment --------------------------------
create or replace function public.get_platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_salons bigint;
  v_published_salons bigint;
  v_suspended_salons bigint;
  v_verified_salons bigint;
  v_active_subscriptions bigint;
  v_estimated_mrr_xof bigint;
  v_plans_count bigint;
  v_total_appointments bigint;
  v_total_revenue_xof bigint;
  v_hidden_reviews bigint;
begin
  perform private.require_platform_role(array['super_admin']);

  select
    count(*),
    count(*) filter (where is_published = true and status = 'active'),
    count(*) filter (where status = 'suspended'),
    count(*) filter (where is_verified = true)
  into v_total_salons, v_published_salons, v_suspended_salons, v_verified_salons
  from public.salons;

  select count(*), coalesce(sum(price_at_subscription), 0)
  into v_active_subscriptions, v_estimated_mrr_xof
  from public.saas_subscriptions
  where status in ('active', 'trialing');

  select count(*) into v_plans_count from public.saas_plans where is_active = true;
  select count(*) into v_total_appointments from public.appointments;
  select coalesce(sum(private.payment_signed_amount(kind, amount)), 0)
  into v_total_revenue_xof
  from public.payments
  where status = 'confirmed';
  select count(*) into v_hidden_reviews from public.reviews where is_hidden = true;

  return jsonb_build_object(
    'total_salons', v_total_salons,
    'published_salons', v_published_salons,
    'suspended_salons', v_suspended_salons,
    'verified_salons', v_verified_salons,
    'active_subscriptions', v_active_subscriptions,
    'estimated_mrr_xof', v_estimated_mrr_xof,
    'plans_count', v_plans_count,
    'total_appointments', v_total_appointments,
    'total_revenue_xof', v_total_revenue_xof,
    'hidden_reviews', v_hidden_reviews
  );
end;
$$;
revoke all on function public.get_platform_metrics() from public, anon;
grant execute on function public.get_platform_metrics() to authenticated;

create or replace function public.review_saas_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_payment public.saas_subscription_payments;
  v_subscription public.saas_subscriptions;
  v_prev_active public.saas_subscriptions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.require_platform_role(array['super_admin']);
  v_uid := (select auth.uid());

  if p_decision not in ('confirm', 'reject') then
    raise exception 'Décision invalide : confirm ou reject attendu.' using errcode = '22023';
  end if;

  select * into v_payment
  from public.saas_subscription_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Paiement introuvable.' using errcode = '22023';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Ce paiement a déjà été traité.' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.saas_subscriptions
  where id = v_payment.subscription_id
  for update;

  if p_decision = 'reject' then
    if v_reason is null then
      raise exception 'Le motif du rejet est obligatoire.' using errcode = '22023';
    end if;

    update public.saas_subscription_payments
    set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_reason = v_reason
    where id = v_payment.id;

    update public.saas_subscriptions
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = v_subscription.id and status = 'pending_payment';

    perform private.record_platform_audit(
      'saas_payment.rejected',
      'saas_subscription_payment',
      v_payment.id::text,
      jsonb_build_object(
        'payment_status', v_payment.status,
        'subscription_status', v_subscription.status,
        'plan_id', v_subscription.plan_id
      ),
      jsonb_build_object(
        'payment_status', 'rejected',
        'subscription_status', 'cancelled',
        'plan_id', v_subscription.plan_id
      ),
      v_reason,
      jsonb_build_object('salon_id', v_payment.salon_id, 'amount_xof', v_payment.amount_xof)
    );
  else
    select * into v_prev_active
    from public.saas_subscriptions
    where salon_id = v_payment.salon_id and status in ('active', 'trialing')
    limit 1;

    update public.saas_subscriptions
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where salon_id = v_payment.salon_id and status in ('active', 'trialing');

    update public.saas_subscriptions
    set status = 'active',
        started_at = now(),
        current_period_end = now() + private.saas_billing_interval(billing_period),
        updated_at = now()
    where id = v_subscription.id;

    update public.saas_subscription_payments
    set status = 'confirmed', decided_by = v_uid, decided_at = now(), decision_reason = v_reason
    where id = v_payment.id;

    update public.salons
    set subscription_plan_id = v_subscription.plan_id,
        updated_at = now()
    where id = v_payment.salon_id;

    perform private.record_platform_audit(
      'saas_payment.confirmed',
      'saas_subscription_payment',
      v_payment.id::text,
      jsonb_build_object(
        'payment_status', v_payment.status,
        'subscription_status', v_subscription.status,
        'previous_active_plan_id', v_prev_active.plan_id
      ),
      jsonb_build_object(
        'payment_status', 'confirmed',
        'subscription_status', 'active',
        'plan_id', v_subscription.plan_id
      ),
      coalesce(v_reason, 'Validation de paiement SaaS'),
      jsonb_build_object(
        'salon_id', v_payment.salon_id,
        'plan_id', v_subscription.plan_id,
        'amount_xof', v_payment.amount_xof,
        'billing_period', v_subscription.billing_period
      )
    );
  end if;

  return jsonb_build_object(
    'id', v_payment.id,
    'decision', case when p_decision = 'confirm' then 'confirmed' else 'rejected' end,
    'subscription_id', v_subscription.id
  );
end;
$$;
revoke all on function public.review_saas_payment(uuid, text, text) from public, anon;
grant execute on function public.review_saas_payment(uuid, text, text) to authenticated;

-- 7. RPC d'administration des salons (lecture + mutations auditées) ----------------------------
create or replace function public.admin_list_salons()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_platform_role(array['super_admin']);

  select coalesce(
    jsonb_agg(private.admin_salon_summary(s.id) order by s.created_at desc, s.name asc),
    '[]'::jsonb
  )
  into v_result
  from public.salons s;

  return v_result;
end;
$$;
revoke all on function public.admin_list_salons() from public, anon;
grant execute on function public.admin_list_salons() to authenticated;

create or replace function public.admin_set_salon_publication(
  p_salon_id uuid,
  p_published boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.salons;
  v_after public.salons;
  v_reason text;
begin
  perform private.require_platform_role(array['super_admin']);
  v_reason := private.require_audit_reason(p_reason);

  select * into v_before from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon introuvable.' using errcode = '22023';
  end if;

  if p_published is null then
    raise exception 'Statut de publication requis.' using errcode = '22023';
  end if;

  if p_published and v_before.status = 'suspended' then
    raise exception 'Impossible de publier un salon suspendu. Réactivez le salon au préalable.'
      using errcode = '22023';
  end if;

  update public.salons
  set is_published = p_published,
      publication_date = case when p_published then coalesce(publication_date, now()) else publication_date end,
      updated_at = now()
  where id = p_salon_id
  returning * into v_after;

  update public.salon_marketplace_settings
  set is_published = p_published,
      published_at = case when p_published then coalesce(published_at, now()) else published_at end,
      updated_at = now()
  where salon_id = p_salon_id;

  perform private.record_platform_audit(
    case when p_published then 'salon.published' else 'salon.unpublished' end,
    'salon',
    p_salon_id::text,
    jsonb_build_object(
      'is_published', v_before.is_published,
      'publication_date', v_before.publication_date
    ),
    jsonb_build_object(
      'is_published', v_after.is_published,
      'publication_date', v_after.publication_date
    ),
    v_reason,
    jsonb_build_object('salon_name', v_before.name)
  );

  return private.admin_salon_summary(p_salon_id);
end;
$$;
revoke all on function public.admin_set_salon_publication(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_salon_publication(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_salon_verification(
  p_salon_id uuid,
  p_verified boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.salons;
  v_after public.salons;
  v_reason text;
begin
  perform private.require_platform_role(array['super_admin']);
  v_reason := private.require_audit_reason(p_reason);

  select * into v_before from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon introuvable.' using errcode = '22023';
  end if;

  if p_verified is null then
    raise exception 'Statut de certification requis.' using errcode = '22023';
  end if;

  update public.salons
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      updated_at = now()
  where id = p_salon_id
  returning * into v_after;

  perform private.record_platform_audit(
    case when p_verified then 'salon.certified' else 'salon.uncertified' end,
    'salon',
    p_salon_id::text,
    jsonb_build_object(
      'is_verified', v_before.is_verified,
      'verified_at', v_before.verified_at
    ),
    jsonb_build_object(
      'is_verified', v_after.is_verified,
      'verified_at', v_after.verified_at
    ),
    v_reason,
    jsonb_build_object('salon_name', v_before.name)
  );

  return private.admin_salon_summary(p_salon_id);
end;
$$;
revoke all on function public.admin_set_salon_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_salon_verification(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_salon_status(
  p_salon_id uuid,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.salons;
  v_after public.salons;
  v_reason text;
begin
  perform private.require_platform_role(array['super_admin']);
  v_reason := private.require_audit_reason(p_reason);

  if p_status not in ('active', 'suspended') then
    raise exception 'Statut invalide : active ou suspended attendu.' using errcode = '22023';
  end if;

  select * into v_before from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon introuvable.' using errcode = '22023';
  end if;

  if p_status = 'suspended' then
    update public.salons
    set status = 'suspended',
        is_published = false,
        suspended_at = now(),
        suspension_reason = v_reason,
        updated_at = now()
    where id = p_salon_id
    returning * into v_after;

    update public.salon_marketplace_settings
    set is_published = false,
        updated_at = now()
    where salon_id = p_salon_id;
  else
    update public.salons
    set status = 'active',
        suspended_at = null,
        suspension_reason = null,
        updated_at = now()
    where id = p_salon_id
    returning * into v_after;
  end if;

  perform private.record_platform_audit(
    case when p_status = 'suspended' then 'salon.suspended' else 'salon.reactivated' end,
    'salon',
    p_salon_id::text,
    jsonb_build_object(
      'status', v_before.status,
      'is_published', v_before.is_published,
      'suspended_at', v_before.suspended_at,
      'suspension_reason', v_before.suspension_reason
    ),
    jsonb_build_object(
      'status', v_after.status,
      'is_published', v_after.is_published,
      'suspended_at', v_after.suspended_at,
      'suspension_reason', v_after.suspension_reason
    ),
    v_reason,
    jsonb_build_object('salon_name', v_before.name)
  );

  return private.admin_salon_summary(p_salon_id);
end;
$$;
revoke all on function public.admin_set_salon_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_salon_status(uuid, text, text) to authenticated;

create or replace function public.admin_update_salon_details(
  p_salon_id uuid,
  p_updates jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.salons;
  v_org public.organizations;
  v_after public.salons;
  v_reason text;
  v_name text;
  v_org_name text;
  v_new_org_name text;
  v_commune text;
  v_phone text;
  v_email text;
begin
  perform private.require_platform_role(array['super_admin']);
  v_reason := private.require_audit_reason(p_reason);

  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'Données de mise à jour invalides.' using errcode = '22023';
  end if;

  select * into v_before from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon introuvable.' using errcode = '22023';
  end if;

  select * into v_org from public.organizations where id = v_before.organization_id for update;
  v_org_name := coalesce(v_org.name, '');
  v_new_org_name := v_org_name;

  v_name := v_before.name;
  if p_updates ? 'name' then
    v_name := btrim(coalesce(p_updates ->> 'name', ''));
    if char_length(v_name) not between 1 and 120 then
      raise exception 'Le nom du salon doit contenir entre 1 et 120 caractères.' using errcode = '22023';
    end if;
  end if;

  if p_updates ? 'organization_name' then
    v_new_org_name := btrim(coalesce(p_updates ->> 'organization_name', ''));
    if char_length(v_new_org_name) not between 1 and 120 then
      raise exception 'La raison sociale doit contenir entre 1 et 120 caractères.' using errcode = '22023';
    end if;
    if v_org.id is not null and v_new_org_name <> v_org_name then
      update public.organizations set name = v_new_org_name where id = v_org.id;
    end if;
  end if;

  v_commune := v_before.commune;
  if p_updates ? 'commune' then
    v_commune := btrim(coalesce(p_updates ->> 'commune', ''));
    if char_length(v_commune) > 120 then
      raise exception 'Commune trop longue.' using errcode = '22023';
    end if;
  end if;

  v_phone := v_before.phone;
  if p_updates ? 'phone' then
    v_phone := btrim(coalesce(p_updates ->> 'phone', ''));
    if char_length(v_phone) > 40 then
      raise exception 'Téléphone trop long.' using errcode = '22023';
    end if;
  end if;

  v_email := v_before.email;
  if p_updates ? 'email' then
    v_email := nullif(lower(btrim(coalesce(p_updates ->> 'email', ''))), '');
    if v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Adresse e-mail invalide.' using errcode = '22023';
    end if;
  end if;

  update public.salons
  set name = v_name,
      commune = v_commune,
      phone = v_phone,
      email = v_email,
      updated_at = now()
  where id = p_salon_id
  returning * into v_after;

  perform private.record_platform_audit(
    'salon.updated',
    'salon',
    p_salon_id::text,
    jsonb_build_object(
      'name', v_before.name,
      'organization_name', v_org_name,
      'commune', v_before.commune,
      'phone', v_before.phone,
      'email', v_before.email
    ),
    jsonb_build_object(
      'name', v_after.name,
      'organization_name', v_new_org_name,
      'commune', v_after.commune,
      'phone', v_after.phone,
      'email', v_after.email
    ),
    v_reason,
    jsonb_build_object('salon_name', v_after.name)
  );

  return private.admin_salon_summary(p_salon_id);
end;
$$;
revoke all on function public.admin_update_salon_details(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_update_salon_details(uuid, jsonb, text) to authenticated;

-- 8. RPC de modération des avis et consultation du journal d'audit -------------------------------
create or replace function public.admin_list_reviews(
  p_salon_id uuid default null,
  p_include_hidden boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_platform_role(array['super_admin']);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'salon_id', r.salon_id,
        'salon_name', s.name,
        'salon_slug', s.slug,
        'salon_status', s.status,
        'author', r.author,
        'rating', r.rating,
        'comment', r.comment,
        'verified', r.verified,
        'is_hidden', r.is_hidden,
        'moderated_at', r.moderated_at,
        'moderated_by', r.moderated_by,
        'moderation_reason', r.moderation_reason,
        'created_at', r.created_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.reviews r
  join public.salons s on s.id = r.salon_id
  where (p_salon_id is null or r.salon_id = p_salon_id)
    and (coalesce(p_include_hidden, true) or not r.is_hidden);

  return v_result;
end;
$$;
revoke all on function public.admin_list_reviews(uuid, boolean) from public, anon;
grant execute on function public.admin_list_reviews(uuid, boolean) to authenticated;

create or replace function public.admin_moderate_review(
  p_review_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_rev public.reviews;
  v_salon_name text;
  v_after public.reviews;
  v_reason text;
begin
  perform private.require_platform_role(array['super_admin']);
  v_uid := (select auth.uid());
  v_reason := private.require_audit_reason(p_reason);

  if p_action not in ('hide', 'restore', 'delete') then
    raise exception 'Action de modération invalide : hide, restore ou delete attendu.'
      using errcode = '22023';
  end if;

  select r.* into v_rev
  from public.reviews r
  where r.id = p_review_id
  for update;

  if not found then
    raise exception 'Avis introuvable.' using errcode = '22023';
  end if;

  select s.name into v_salon_name from public.salons s where s.id = v_rev.salon_id;

  if p_action = 'hide' then
    update public.reviews
    set is_hidden = true,
        moderated_at = now(),
        moderated_by = v_uid,
        moderation_reason = v_reason
    where id = p_review_id
    returning * into v_after;

    perform private.record_platform_audit(
      'review.hidden',
      'review',
      p_review_id::text,
      jsonb_build_object(
        'salon_id', v_rev.salon_id,
        'salon_name', v_salon_name,
        'author', v_rev.author,
        'rating', v_rev.rating,
        'is_hidden', v_rev.is_hidden,
        'moderation_reason', v_rev.moderation_reason
      ),
      jsonb_build_object(
        'is_hidden', true,
        'moderated_at', v_after.moderated_at,
        'moderation_reason', v_reason
      ),
      v_reason,
      jsonb_build_object('salon_id', v_rev.salon_id, 'salon_name', v_salon_name)
    );

    return jsonb_build_object(
      'id', v_after.id,
      'salon_id', v_after.salon_id,
      'action', 'hide',
      'is_hidden', v_after.is_hidden,
      'deleted', false
    );
  elsif p_action = 'restore' then
    update public.reviews
    set is_hidden = false,
        moderated_at = now(),
        moderated_by = v_uid,
        moderation_reason = v_reason
    where id = p_review_id
    returning * into v_after;

    perform private.record_platform_audit(
      'review.restored',
      'review',
      p_review_id::text,
      jsonb_build_object(
        'salon_id', v_rev.salon_id,
        'salon_name', v_salon_name,
        'author', v_rev.author,
        'rating', v_rev.rating,
        'is_hidden', v_rev.is_hidden,
        'moderation_reason', v_rev.moderation_reason
      ),
      jsonb_build_object(
        'is_hidden', false,
        'moderated_at', v_after.moderated_at,
        'moderation_reason', v_reason
      ),
      v_reason,
      jsonb_build_object('salon_id', v_rev.salon_id, 'salon_name', v_salon_name)
    );

    return jsonb_build_object(
      'id', v_after.id,
      'salon_id', v_after.salon_id,
      'action', 'restore',
      'is_hidden', v_after.is_hidden,
      'deleted', false
    );
  else
    delete from public.reviews where id = p_review_id;

    perform private.record_platform_audit(
      'review.deleted',
      'review',
      p_review_id::text,
      jsonb_build_object(
        'salon_id', v_rev.salon_id,
        'salon_name', v_salon_name,
        'author', v_rev.author,
        'rating', v_rev.rating,
        'comment', v_rev.comment,
        'is_hidden', v_rev.is_hidden
      ),
      jsonb_build_object('deleted', true),
      v_reason,
      jsonb_build_object('salon_id', v_rev.salon_id, 'salon_name', v_salon_name)
    );

    return jsonb_build_object(
      'id', p_review_id,
      'salon_id', v_rev.salon_id,
      'action', 'delete',
      'is_hidden', true,
      'deleted', true
    );
  end if;
end;
$$;
revoke all on function public.admin_moderate_review(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_review(uuid, text, text) to authenticated;

create or replace function public.admin_list_audit_logs(
  p_limit integer default 100,
  p_target_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_target_type text := nullif(btrim(coalesce(p_target_type, '')), '');
  v_result jsonb;
begin
  perform private.require_platform_role(array['super_admin']);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'actor_user_id', l.actor_user_id,
        'actor_role', l.actor_role,
        'actor_email', l.actor_email,
        'action', l.action,
        'target_type', l.target_type,
        'target_id', l.target_id,
        'before_values', coalesce(l.before_values, case when l.details ? 'before' then l.details -> 'before' else null end),
        'after_values', coalesce(l.after_values, case when l.details ? 'after' then l.details -> 'after' else null end),
        'reason', coalesce(l.reason, nullif(btrim(coalesce(l.details ->> 'reason', '')), '')),
        'details', l.details,
        'created_at', l.created_at
      )
      order by l.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.platform_audit_logs
    where v_target_type is null or target_type = v_target_type
    order by created_at desc
    limit v_limit
  ) l;

  return v_result;
end;
$$;
revoke all on function public.admin_list_audit_logs(integer, text) from public, anon;
grant execute on function public.admin_list_audit_logs(integer, text) to authenticated;
