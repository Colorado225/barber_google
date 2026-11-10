-- Migration 20261110150000 : Fiabilisation des indicateurs financiers et commerciaux plateforme (P1).
--
-- Objectifs :
-- 1. Normaliser les forfaits annuels en montant mensuel (/ 12) dans le calcul du MRR.
-- 2. Séparer revenus récurrents (MRR / ARR), revenus SaaS encaissés, paiements SaaS en attente,
--    encaissements salons (bruts & nets), remboursements/contrepassations et paiements en attente.
-- 3. Filtrer les indicateurs transactionnels et de rendez-vous par période (p_from, p_to, fuseau
--    Africa/Abidjan) et ventiler les rendez-vous par statut : seuls les rendez-vous `completed`
--    sont comptés comme « réalisés ».
-- 4. Enrichir private.admin_salon_summary avec les compteurs par statut et paiements séparés.

drop function if exists public.get_platform_metrics();

create or replace function public.get_platform_metrics(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;

  v_total_salons bigint;
  v_published_salons bigint;
  v_suspended_salons bigint;
  v_verified_salons bigint;
  v_plans_count bigint;
  v_hidden_reviews bigint;

  v_active_subscriptions bigint;
  v_trialing_subscriptions bigint;
  v_pending_subscriptions bigint;
  v_past_due_subscriptions bigint;
  v_cancelled_subscriptions bigint;
  v_monthly_active_subscriptions bigint;
  v_yearly_active_subscriptions bigint;
  v_monthly_mrr_xof bigint;
  v_yearly_mrr_xof bigint;
  v_estimated_mrr_xof bigint;
  v_annual_run_rate_xof bigint;

  v_saas_collected_xof bigint;
  v_saas_confirmed_count bigint;
  v_saas_pending_xof bigint;
  v_saas_pending_count bigint;
  v_saas_rejected_xof bigint;
  v_saas_rejected_count bigint;

  v_collected_net_xof bigint;
  v_collected_gross_xof bigint;
  v_refunds_xof bigint;
  v_payment_reversals_xof bigint;
  v_refund_reversals_xof bigint;
  v_pending_payments_xof bigint;
  v_pending_payments_count bigint;
  v_failed_payments_xof bigint;
  v_failed_payments_count bigint;
  v_confirmed_payments_count bigint;
  v_refunds_count bigint;

  v_total_appointments bigint;
  v_pending_appointments bigint;
  v_confirmed_appointments bigint;
  v_checked_in_appointments bigint;
  v_in_progress_appointments bigint;
  v_completed_appointments bigint;
  v_cancelled_appointments bigint;
  v_no_show_appointments bigint;
begin
  perform private.require_platform_role(array['super_admin']);

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'Période invalide : la date de début doit précéder la date de fin.'
      using errcode = '22023';
  end if;

  v_start := case when p_from is not null then (p_from::timestamp at time zone 'Africa/Abidjan') else null end;
  v_end := case when p_to is not null then ((p_to + 1)::timestamp at time zone 'Africa/Abidjan') else null end;

  -- 1. État du parc salons & catalogue
  select
    count(*),
    count(*) filter (where is_published = true and status = 'active'),
    count(*) filter (where status = 'suspended'),
    count(*) filter (where is_verified = true)
  into v_total_salons, v_published_salons, v_suspended_salons, v_verified_salons
  from public.salons;

  select count(*) into v_plans_count from public.saas_plans where is_active = true;
  select count(*) into v_hidden_reviews from public.reviews where is_hidden = true;

  -- 2. Abonnements SaaS & revenus récurrents normalisés (mensuels + annuels / 12)
  select
    count(*) filter (where status = 'active')::bigint,
    count(*) filter (where status = 'trialing')::bigint,
    count(*) filter (where status = 'pending_payment')::bigint,
    count(*) filter (where status = 'past_due')::bigint,
    count(*) filter (where status = 'cancelled')::bigint,
    count(*) filter (where status = 'active' and billing_period = 'monthly')::bigint,
    count(*) filter (where status = 'active' and billing_period = 'yearly')::bigint,
    coalesce(sum(price_at_subscription) filter (where status = 'active' and billing_period = 'monthly'), 0)::bigint,
    round(
      coalesce(
        sum(price_at_subscription::numeric / 12.0) filter (where status = 'active' and billing_period = 'yearly'),
        0
      )
    )::bigint,
    round(
      coalesce(
        sum(
          case
            when billing_period = 'yearly' then price_at_subscription::numeric / 12.0
            else price_at_subscription::numeric
          end
        ) filter (where status = 'active'),
        0
      )
    )::bigint,
    round(
      coalesce(
        sum(
          case
            when billing_period = 'yearly' then price_at_subscription::numeric
            else price_at_subscription::numeric * 12.0
          end
        ) filter (where status = 'active'),
        0
      )
    )::bigint
  into
    v_active_subscriptions,
    v_trialing_subscriptions,
    v_pending_subscriptions,
    v_past_due_subscriptions,
    v_cancelled_subscriptions,
    v_monthly_active_subscriptions,
    v_yearly_active_subscriptions,
    v_monthly_mrr_xof,
    v_yearly_mrr_xof,
    v_estimated_mrr_xof,
    v_annual_run_rate_xof
  from public.saas_subscriptions;

  -- 3. Paiements d'abonnements SaaS sur la période (encaissés vs en attente vs rejetés)
  select
    coalesce(sum(sp.amount_xof) filter (where sp.status = 'confirmed'), 0)::bigint,
    count(*) filter (where sp.status = 'confirmed')::bigint,
    coalesce(sum(sp.amount_xof) filter (where sp.status = 'pending'), 0)::bigint,
    count(*) filter (where sp.status = 'pending')::bigint,
    coalesce(sum(sp.amount_xof) filter (where sp.status = 'rejected'), 0)::bigint,
    count(*) filter (where sp.status = 'rejected')::bigint
  into
    v_saas_collected_xof,
    v_saas_confirmed_count,
    v_saas_pending_xof,
    v_saas_pending_count,
    v_saas_rejected_xof,
    v_saas_rejected_count
  from public.saas_subscription_payments sp
  where (v_start is null or coalesce(sp.decided_at, sp.declared_at) >= v_start)
    and (v_end is null or coalesce(sp.decided_at, sp.declared_at) < v_end);

  -- 4. Paiements clients des salons sur la période (brut, remboursements, contrepassations, en attente, échoués)
  select
    coalesce(sum(private.payment_signed_amount(p.kind, p.amount)) filter (where p.status = 'confirmed'), 0)::bigint,
    coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'payment'), 0)::bigint,
    coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'refund'), 0)::bigint,
    coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'payment_reversal'), 0)::bigint,
    coalesce(sum(p.amount) filter (where p.status = 'confirmed' and p.kind = 'refund_reversal'), 0)::bigint,
    coalesce(sum(p.amount) filter (where p.status = 'pending'), 0)::bigint,
    count(*) filter (where p.status = 'pending')::bigint,
    coalesce(sum(p.amount) filter (where p.status = 'failed'), 0)::bigint,
    count(*) filter (where p.status = 'failed')::bigint,
    count(*) filter (where p.status = 'confirmed' and p.kind = 'payment')::bigint,
    count(*) filter (where p.status = 'confirmed' and p.kind = 'refund')::bigint
  into
    v_collected_net_xof,
    v_collected_gross_xof,
    v_refunds_xof,
    v_payment_reversals_xof,
    v_refund_reversals_xof,
    v_pending_payments_xof,
    v_pending_payments_count,
    v_failed_payments_xof,
    v_failed_payments_count,
    v_confirmed_payments_count,
    v_refunds_count
  from public.payments p
  where (v_start is null or p.created_at >= v_start)
    and (v_end is null or p.created_at < v_end);

  -- 5. Rendez-vous sur la période, ventilés par statut (seuls `completed` sont « réalisés »)
  select
    count(*)::bigint,
    count(*) filter (where a.status = 'pending')::bigint,
    count(*) filter (where a.status = 'confirmed')::bigint,
    count(*) filter (where a.status = 'checked_in')::bigint,
    count(*) filter (where a.status = 'in_progress')::bigint,
    count(*) filter (where a.status = 'completed')::bigint,
    count(*) filter (where a.status = 'cancelled')::bigint,
    count(*) filter (where a.status = 'no_show')::bigint
  into
    v_total_appointments,
    v_pending_appointments,
    v_confirmed_appointments,
    v_checked_in_appointments,
    v_in_progress_appointments,
    v_completed_appointments,
    v_cancelled_appointments,
    v_no_show_appointments
  from public.appointments a
  where (v_start is null or a.starts_at >= v_start)
    and (v_end is null or a.starts_at < v_end);

  return
    jsonb_build_object(
      'period_from', p_from,
      'period_to', p_to,
      'timezone', 'Africa/Abidjan',
      'total_salons', v_total_salons,
      'published_salons', v_published_salons,
      'suspended_salons', v_suspended_salons,
      'verified_salons', v_verified_salons,
      'plans_count', v_plans_count,
      'hidden_reviews', v_hidden_reviews
    )
    || jsonb_build_object(
      'active_subscriptions', v_active_subscriptions,
      'estimated_mrr_xof', v_estimated_mrr_xof,
      'monthly_mrr_xof', v_monthly_mrr_xof,
      'yearly_mrr_xof', v_yearly_mrr_xof,
      'annual_run_rate_xof', v_annual_run_rate_xof,
      'subscriptions_by_status', jsonb_build_object(
        'active', v_active_subscriptions,
        'trialing', v_trialing_subscriptions,
        'pending_payment', v_pending_subscriptions,
        'past_due', v_past_due_subscriptions,
        'cancelled', v_cancelled_subscriptions
      ),
      'subscriptions_by_billing_period', jsonb_build_object(
        'monthly', v_monthly_active_subscriptions,
        'yearly', v_yearly_active_subscriptions
      )
    )
    || jsonb_build_object(
      'saas_collected_revenue_xof', v_saas_collected_xof,
      'saas_confirmed_payments_count', v_saas_confirmed_count,
      'saas_pending_payments_xof', v_saas_pending_xof,
      'saas_pending_payments_count', v_saas_pending_count,
      'saas_rejected_payments_xof', v_saas_rejected_xof,
      'saas_rejected_payments_count', v_saas_rejected_count
    )
    || jsonb_build_object(
      'total_revenue_xof', v_collected_net_xof,
      'collected_net_revenue_xof', v_collected_net_xof,
      'collected_gross_revenue_xof', v_collected_gross_xof,
      'refunds_xof', v_refunds_xof,
      'payment_reversals_xof', v_payment_reversals_xof,
      'refund_reversals_xof', v_refund_reversals_xof,
      'pending_payments_xof', v_pending_payments_xof,
      'pending_payments_count', v_pending_payments_count,
      'failed_payments_xof', v_failed_payments_xof,
      'failed_payments_count', v_failed_payments_count,
      'confirmed_payments_count', v_confirmed_payments_count,
      'refunds_count', v_refunds_count
    )
    || jsonb_build_object(
      'completed_appointments', v_completed_appointments,
      'cancelled_appointments', v_cancelled_appointments,
      'no_show_appointments', v_no_show_appointments,
      'total_appointments', v_total_appointments,
      'appointments_by_status', jsonb_build_object(
        'pending', v_pending_appointments,
        'confirmed', v_confirmed_appointments,
        'checked_in', v_checked_in_appointments,
        'in_progress', v_in_progress_appointments,
        'completed', v_completed_appointments,
        'cancelled', v_cancelled_appointments,
        'no_show', v_no_show_appointments
      )
    );
end;
$$;
revoke all on function public.get_platform_metrics(date, date) from public, anon;
grant execute on function public.get_platform_metrics(date, date) to authenticated;

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
      'pending_payment_decision_reason', pending_pay.decision_reason
    )
    || jsonb_build_object(
      'staff_count', coalesce(st.cnt, 0),
      'service_count', coalesce(sv.cnt, 0),
      'appointments_count', coalesce(ap.total_cnt, 0),
      'appointments_completed_count', coalesce(ap.completed_cnt, 0),
      'appointments_cancelled_count', coalesce(ap.cancelled_cnt, 0),
      'revenue_xof', coalesce(py.net_total, 0),
      'collected_gross_xof', coalesce(py.gross_total, 0),
      'refunds_xof', coalesce(py.refunds_total, 0),
      'pending_payments_xof', coalesce(py.pending_total, 0),
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
    select
      count(*)::bigint as total_cnt,
      count(*) filter (where ap_row.status = 'completed')::bigint as completed_cnt,
      count(*) filter (where ap_row.status = 'cancelled')::bigint as cancelled_cnt
    from public.appointments ap_row
    where ap_row.salon_id = s.id
  ) ap on true
  left join lateral (
    select
      coalesce(sum(private.payment_signed_amount(py_row.kind, py_row.amount)) filter (where py_row.status = 'confirmed'), 0)::bigint as net_total,
      coalesce(sum(py_row.amount) filter (where py_row.status = 'confirmed' and py_row.kind = 'payment'), 0)::bigint as gross_total,
      coalesce(sum(py_row.amount) filter (where py_row.status = 'confirmed' and py_row.kind = 'refund'), 0)::bigint as refunds_total,
      coalesce(sum(py_row.amount) filter (where py_row.status = 'pending'), 0)::bigint as pending_total
    from public.payments py_row
    where py_row.salon_id = s.id
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
