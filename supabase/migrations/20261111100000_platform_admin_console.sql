-- Migration 20261111100000 : console SuperAdmin (vue d'ensemble, fiche salon 360, actions d'abonnement, journal filtrable).
--
-- - Lecture : agrégats et états issus de la base. Aucune donnée personnelle de clients finaux n'est renvoyée
--   (seulement des compteurs). Les e-mails des propriétaires/gérants sont renvoyés au SuperAdmin pour le support.
-- - Actions : annulation et prolongation d'abonnement. Motif obligatoire. Chaque action écrit dans platform_audit_logs.
-- - Correction : get_platform_metrics normalise le MRR selon la période (un abonnement annuel est divisé par 12)
--   et calcule le revenu net (remboursements déduits), au lieu d'additionner tous les montants confirmés.
-- - Aucune donnée n'est supprimée (règle : ne jamais supprimer les données d'un salon).

-- 0. Garde commune ------------------------------------------------------------------------------
create or replace function private.assert_platform_superadmin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.assert_platform_superadmin() from public, anon, authenticated;

-- 1. Métriques corrigées (même forme de réponse) ------------------------------------------------
create or replace function public.get_platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_total_salons bigint;
  v_published_salons bigint;
  v_active_subscriptions bigint;
  v_estimated_mrr_xof bigint;
  v_plans_count bigint;
  v_total_appointments bigint;
  v_total_revenue_xof bigint;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select count(*) into v_total_salons from public.salons;
  select count(*) into v_published_salons from public.salons where is_published = true;
  select count(*),
         coalesce(sum(case when billing_period = 'yearly'
                           then round(price_at_subscription::numeric / 12)
                           else price_at_subscription end), 0)::bigint
    into v_active_subscriptions, v_estimated_mrr_xof
  from public.saas_subscriptions where status in ('active', 'trialing');
  select count(*) into v_plans_count from public.saas_plans where is_active = true;
  select count(*) into v_total_appointments from public.appointments;
  select coalesce(sum(private.payment_signed_amount(kind, amount)), 0) into v_total_revenue_xof
  from public.payments where status = 'confirmed';

  return jsonb_build_object(
    'total_salons', v_total_salons,
    'published_salons', v_published_salons,
    'active_subscriptions', v_active_subscriptions,
    'estimated_mrr_xof', v_estimated_mrr_xof,
    'plans_count', v_plans_count,
    'total_appointments', v_total_appointments,
    'total_revenue_xof', v_total_revenue_xof
  );
end;
$$;
revoke all on function public.get_platform_metrics() from public, anon;
grant execute on function public.get_platform_metrics() to authenticated;

-- 2. Vue d'ensemble -----------------------------------------------------------------------------
create or replace function public.platform_dashboard_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_platform_superadmin();

  select jsonb_build_object(
    'salons', jsonb_build_object(
      'total', (select count(*) from public.salons),
      'published', (select count(*) from public.salons where is_published),
      'verified', (select count(*) from public.salons where is_verified),
      'suspended', (select count(*) from public.salons where platform_status = 'suspended')
    ),
    'subscriptions', jsonb_build_object(
      'active', (select count(*) from public.saas_subscriptions where status in ('active', 'trialing')),
      'past_due', (select count(*) from public.saas_subscriptions where status = 'past_due'),
      'pending_payment', (select count(*) from public.saas_subscriptions where status = 'pending_payment'),
      'cancelled', (select count(*) from public.saas_subscriptions where status = 'cancelled'),
      'mrr_xof', (select coalesce(sum(case when billing_period = 'yearly'
                                          then round(price_at_subscription::numeric / 12)
                                          else price_at_subscription end), 0)::bigint
                  from public.saas_subscriptions where status in ('active', 'trialing')),
      'expiring_7d', (select count(*) from public.saas_subscriptions
                      where status in ('active', 'trialing')
                        and current_period_end between now() and now() + interval '7 days')
    ),
    'payments', jsonb_build_object(
      'awaiting_review', (select count(*) from public.saas_subscription_payments where status = 'pending')
    ),
    'reviews', jsonb_build_object(
      'total', (select count(*) from public.reviews),
      'hidden', (select count(*) from public.reviews where platform_hidden)
    ),
    'activity_30d', jsonb_build_object(
      'appointments', (select count(*) from public.appointments where starts_at >= now() - interval '30 days'),
      'appointments_completed', (select count(*) from public.appointments
                                 where starts_at >= now() - interval '30 days' and status = 'completed'),
      'appointments_upcoming_7d', (select count(*) from public.appointments
                                   where starts_at between now() and now() + interval '7 days'
                                     and status in ('pending', 'confirmed', 'checked_in', 'in_progress')),
      'net_revenue_xof', (select coalesce(sum(private.payment_signed_amount(kind, amount)), 0)::bigint
                          from public.payments
                          where status = 'confirmed' and created_at >= now() - interval '30 days')
    ),
    'quota_overages', (
      select count(*) from public.saas_subscriptions sub
      join public.salons s on s.id = sub.salon_id
      join public.saas_plans p on p.id = sub.plan_id
      where sub.status in ('active', 'trialing')
        and (
          (p.max_staff is not null and (select count(*) from public.staff st
                                        where st.salon_id = s.id and st.is_active) > p.max_staff)
          or (p.max_branches is not null and (select count(*) from public.branches b
                                              where b.salon_id = s.id) > p.max_branches)
        )
    ),
    'audit_24h', (select count(*) from public.platform_audit_logs where created_at >= now() - interval '24 hours')
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.platform_dashboard_overview() from public, anon;
grant execute on function public.platform_dashboard_overview() to authenticated;

-- 3. Fiche salon 360 (lecture seule) -------------------------------------------------------------
create or replace function public.platform_get_salon_360(p_salon_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salon record;
  v_result jsonb;
begin
  perform private.assert_platform_superadmin();

  select s.id, s.name, s.slug, s.city, s.commune, s.is_published, s.is_verified, s.platform_status,
         s.platform_status_reason, s.publication_date, s.subscription_plan_id, o.name as organization_name
    into v_salon
  from public.salons s join public.organizations o on o.id = s.organization_id
  where s.id = p_salon_id;
  if not found then
    raise exception 'Salon introuvable.' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'salon', jsonb_build_object(
      'id', v_salon.id, 'name', v_salon.name, 'slug', v_salon.slug, 'city', v_salon.city,
      'commune', v_salon.commune, 'is_published', v_salon.is_published, 'is_verified', v_salon.is_verified,
      'platform_status', v_salon.platform_status, 'platform_status_reason', v_salon.platform_status_reason,
      'publication_date', v_salon.publication_date, 'organization_name', v_salon.organization_name
    ),
    'owners', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'email', u.email, 'role', m.role, 'status', m.status, 'since', m.created_at
      ) order by m.created_at), '[]'::jsonb)
      from public.memberships m
      left join auth.users u on u.id = m.user_id
      where m.salon_id = p_salon_id and m.role in ('owner', 'manager')
    ),
    'counts', jsonb_build_object(
      'branches', (select count(*) from public.branches where salon_id = p_salon_id),
      'staff_active', (select count(*) from public.staff where salon_id = p_salon_id and is_active),
      'staff_total', (select count(*) from public.staff where salon_id = p_salon_id),
      'clients', (select count(*) from public.clients where salon_id = p_salon_id),
      'services_active', (select count(*) from public.services where salon_id = p_salon_id and is_active),
      'stock_low', (select count(*) from public.stock_items
                    where salon_id = p_salon_id and quantity <= min_threshold)
    ),
    'activity_30d', jsonb_build_object(
      'appointments', (select count(*) from public.appointments
                       where salon_id = p_salon_id and starts_at >= now() - interval '30 days'),
      'appointments_by_status', (
        select coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
        from (select status, count(*) as n from public.appointments
              where salon_id = p_salon_id and starts_at >= now() - interval '30 days'
              group by status) x
      ),
      'net_revenue_xof', (select coalesce(sum(private.payment_signed_amount(kind, amount)), 0)::bigint
                          from public.payments
                          where salon_id = p_salon_id and status = 'confirmed'
                            and created_at >= now() - interval '30 days'),
      'reviews', (select count(*) from public.reviews where salon_id = p_salon_id and not platform_hidden),
      'average_rating', (select round(avg(rating)::numeric, 1) from public.reviews
                         where salon_id = p_salon_id and not platform_hidden),
      'hidden_reviews', (select count(*) from public.reviews where salon_id = p_salon_id and platform_hidden)
    ),
    'subscription', (
      select jsonb_build_object(
        'id', sub.id, 'plan_id', sub.plan_id, 'plan_name', p.name, 'status', sub.status,
        'billing_period', sub.billing_period, 'price_at_subscription', sub.price_at_subscription,
        'started_at', sub.started_at, 'current_period_end', sub.current_period_end,
        'max_staff', p.max_staff, 'max_branches', p.max_branches,
        'staff_active', (select count(*) from public.staff where salon_id = p_salon_id and is_active),
        'branches', (select count(*) from public.branches where salon_id = p_salon_id)
      )
      from public.saas_subscriptions sub
      join public.saas_plans p on p.id = sub.plan_id
      where sub.salon_id = p_salon_id and sub.status in ('pending_payment', 'trialing', 'active', 'past_due')
      order by sub.created_at desc
      limit 1
    ),
    'subscription_history', (
      select coalesce(jsonb_agg(h order by h.started_at desc), '[]'::jsonb) from (
        select sub.id, sub.plan_id, p.name as plan_name, sub.status, sub.billing_period,
               sub.price_at_subscription, sub.started_at, sub.current_period_end, sub.cancelled_at
        from public.saas_subscriptions sub
        join public.saas_plans p on p.id = sub.plan_id
        where sub.salon_id = p_salon_id
        order by sub.started_at desc
        limit 10
      ) h
    ),
    'payment_declarations', (
      select coalesce(jsonb_agg(d order by d.declared_at desc), '[]'::jsonb) from (
        select id, amount_xof, method, reference, status, declared_at, decided_at, decision_reason
        from public.saas_subscription_payments
        where salon_id = p_salon_id
        order by declared_at desc
        limit 10
      ) d
    ),
    'audit', (
      select coalesce(jsonb_agg(a order by a.created_at desc), '[]'::jsonb) from (
        select al.id, al.action, al.target_type, al.target_id, al.details, al.created_at, u.email as actor_email
        from public.platform_audit_logs al
        left join auth.users u on u.id = al.actor_user_id
        where (al.target_type = 'salon' and al.target_id = p_salon_id::text)
           or al.details->>'salon_id' = p_salon_id::text
        order by al.created_at desc
        limit 30
      ) a
    )
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.platform_get_salon_360(uuid) from public, anon;
grant execute on function public.platform_get_salon_360(uuid) to authenticated;

-- 4. Actions d'abonnement (motif obligatoire, audit) --------------------------------------------
create or replace function public.platform_cancel_salon_subscription(p_salon_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_sub public.saas_subscriptions%rowtype;
begin
  perform private.assert_platform_superadmin();
  if char_length(v_reason) < 3 then
    raise exception 'Le motif de l’annulation est obligatoire (3 caractères minimum).' using errcode = '22023';
  end if;

  select * into v_sub from public.saas_subscriptions
  where salon_id = p_salon_id and status in ('pending_payment', 'trialing', 'active', 'past_due')
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Aucun abonnement en cours pour ce salon.' using errcode = 'P0002';
  end if;

  update public.saas_subscriptions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_sub.id;

  -- Les demandes de paiement encore ouvertes pour cet abonnement sont closes (rejetées), jamais supprimées.
  update public.saas_subscription_payments
  set status = 'rejected', decided_by = (select auth.uid()), decided_at = now(),
      decision_reason = 'Abonnement annulé par le SuperAdmin'
  where subscription_id = v_sub.id and status = 'pending';

  update public.salons set subscription_plan_id = null
  where id = p_salon_id and subscription_plan_id = v_sub.plan_id;

  perform private.write_platform_audit(
    'subscription.cancelled_by_admin', 'salon', p_salon_id::text,
    jsonb_build_object('salon_id', p_salon_id, 'subscription_id', v_sub.id, 'plan_id', v_sub.plan_id,
                       'previous_status', v_sub.status, 'reason', v_reason)
  );

  return jsonb_build_object('subscription_id', v_sub.id, 'status', 'cancelled');
end;
$$;
revoke all on function public.platform_cancel_salon_subscription(uuid, text) from public, anon;
grant execute on function public.platform_cancel_salon_subscription(uuid, text) to authenticated;

create or replace function public.platform_extend_salon_subscription(p_salon_id uuid, p_days integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_sub public.saas_subscriptions%rowtype;
  v_new_end timestamptz;
begin
  perform private.assert_platform_superadmin();
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'La prolongation doit être comprise entre 1 et 90 jours.' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Le motif de la prolongation est obligatoire (3 caractères minimum).' using errcode = '22023';
  end if;

  select * into v_sub from public.saas_subscriptions
  where salon_id = p_salon_id and status in ('trialing', 'active', 'past_due')
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Aucun abonnement actif à prolonger pour ce salon.' using errcode = 'P0002';
  end if;

  v_new_end := v_sub.current_period_end + make_interval(days => p_days);
  update public.saas_subscriptions
  set current_period_end = v_new_end, updated_at = now()
  where id = v_sub.id;

  perform private.write_platform_audit(
    'subscription.extended_by_admin', 'salon', p_salon_id::text,
    jsonb_build_object('salon_id', p_salon_id, 'subscription_id', v_sub.id, 'days', p_days,
                       'previous_period_end', v_sub.current_period_end, 'new_period_end', v_new_end,
                       'reason', v_reason)
  );

  return jsonb_build_object('subscription_id', v_sub.id, 'current_period_end', v_new_end);
end;
$$;
revoke all on function public.platform_extend_salon_subscription(uuid, integer, text) from public, anon;
grant execute on function public.platform_extend_salon_subscription(uuid, integer, text) to authenticated;

-- 5. Journal filtrable ---------------------------------------------------------------------------
create or replace function public.platform_search_audit_logs(
  p_action text default null,
  p_salon_id uuid default null,
  p_since timestamptz default null,
  p_limit integer default 100
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
  perform private.assert_platform_superadmin();

  select coalesce(jsonb_agg(row_to_json(l)::jsonb order by l.created_at desc), '[]'::jsonb) into v_result
  from (
    select al.id, al.action, al.target_type, al.target_id, al.details, al.created_at, u.email as actor_email
    from public.platform_audit_logs al
    left join auth.users u on u.id = al.actor_user_id
    where (p_action is null or al.action = p_action)
      and (p_salon_id is null
           or (al.target_type = 'salon' and al.target_id = p_salon_id::text)
           or al.details->>'salon_id' = p_salon_id::text)
      and (p_since is null or al.created_at >= p_since)
    order by al.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) l;

  return v_result;
end;
$$;
revoke all on function public.platform_search_audit_logs(text, uuid, timestamptz, integer) from public, anon;
grant execute on function public.platform_search_audit_logs(text, uuid, timestamptz, integer) to authenticated;

create or replace function public.platform_audit_actions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_platform_superadmin();
  select coalesce(jsonb_agg(a order by a), '[]'::jsonb) into v_result
  from (select distinct action as a from public.platform_audit_logs) x;
  return v_result;
end;
$$;
revoke all on function public.platform_audit_actions() from public, anon;
grant execute on function public.platform_audit_actions() to authenticated;
