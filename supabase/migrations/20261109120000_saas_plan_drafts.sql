-- Brouillons des forfaits SaaS et publication contrôlée sur la page Tarifs.
--
-- Le super administrateur peut enregistrer une modification de forfait :
--   - en brouillon : stockée à part, invisible des visiteurs et des salons ;
--   - publiée immédiatement : appliquée à public.saas_plans, donc visible sur la page Tarifs.
-- Les abonnements existants conservent leur tarif (instantané à la souscription) : seule
-- public.saas_plans est lue par le public, les brouillons restent privés.

-- 1. Table des brouillons (un brouillon au plus par forfait) ----------------------------------------
create table if not exists public.saas_plan_drafts (
  plan_id text primary key,
  payload jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.saas_plan_drafts enable row level security;

drop policy if exists saas_plan_drafts_superadmin_all on public.saas_plan_drafts;
create policy saas_plan_drafts_superadmin_all on public.saas_plan_drafts
  for all to authenticated
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());

revoke all on public.saas_plan_drafts from public, anon;
grant select, insert, update, delete on public.saas_plan_drafts to authenticated;

-- 2. Validation commune aux brouillons et aux publications -------------------------------------------
create or replace function private.validate_saas_plan_payload(p_id text, p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if btrim(coalesce(p_id, '')) = '' then
    raise exception 'Identifiant du forfait obligatoire.' using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Données du forfait invalides.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_payload->>'name', '')) = '' then
    raise exception 'Le nom du forfait est obligatoire.' using errcode = '22023';
  end if;

  if (p_payload->>'price_xof') is null or (p_payload->>'price_xof')::numeric < 0 then
    raise exception 'Le tarif doit être un nombre supérieur ou égal à zéro.' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'billing_period', 'monthly') not in ('monthly', 'yearly') then
    raise exception 'Période de facturation invalide.' using errcode = '22023';
  end if;

  if coalesce((p_payload->>'max_branches')::integer, 1) < 1 then
    raise exception 'Le nombre de succursales doit être au moins 1.' using errcode = '22023';
  end if;

  if p_payload ? 'features' and jsonb_typeof(p_payload->'features') not in ('array', 'null') then
    raise exception 'Les avantages doivent être une liste.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_saas_plan_payload(text, jsonb) from public, anon, authenticated;

-- 3. Écriture effective dans public.saas_plans (appelée uniquement par les RPC gardées) ---------------
create or replace function private.upsert_saas_plan(p_id text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validate_saas_plan_payload(p_id, p_payload);

  insert into public.saas_plans (
    id, name, slug, price_xof, billing_period, description, features,
    max_staff, max_branches, is_popular, is_active, badge_text, display_order, updated_at
  )
  values (
    p_id,
    btrim(p_payload->>'name'),
    coalesce(
      nullif(btrim(p_payload->>'slug'), ''),
      lower(regexp_replace(btrim(p_payload->>'name'), '[^a-zA-Z0-9]+', '-', 'g'))
    ),
    (p_payload->>'price_xof')::bigint,
    coalesce(p_payload->>'billing_period', 'monthly'),
    coalesce(p_payload->>'description', ''),
    case when jsonb_typeof(p_payload->'features') = 'array' then p_payload->'features' else '[]'::jsonb end,
    nullif(p_payload->>'max_staff', '')::integer,
    coalesce((p_payload->>'max_branches')::integer, 1),
    coalesce((p_payload->>'is_popular')::boolean, false),
    coalesce((p_payload->>'is_active')::boolean, true),
    nullif(p_payload->>'badge_text', ''),
    coalesce((p_payload->>'display_order')::integer, 0),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    price_xof = excluded.price_xof,
    billing_period = excluded.billing_period,
    description = excluded.description,
    features = excluded.features,
    max_staff = excluded.max_staff,
    max_branches = excluded.max_branches,
    is_popular = excluded.is_popular,
    is_active = excluded.is_active,
    badge_text = excluded.badge_text,
    display_order = excluded.display_order,
    updated_at = now();
end;
$$;

revoke all on function private.upsert_saas_plan(text, jsonb) from public, anon, authenticated;

-- 4. RPC super administrateur ---------------------------------------------------------------------------

-- Enregistre un brouillon (p_publish = false) ou publie immédiatement (p_publish = true).
-- Une publication immédiate supprime le brouillon précédent du même forfait.
create or replace function public.save_saas_plan_workflow(
  p_id text,
  p_payload jsonb,
  p_publish boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  if coalesce(p_publish, true) then
    perform private.upsert_saas_plan(p_id, p_payload);
    delete from public.saas_plan_drafts where plan_id = p_id;
    return jsonb_build_object('status', 'published', 'plan_id', p_id);
  end if;

  perform private.validate_saas_plan_payload(p_id, p_payload);

  insert into public.saas_plan_drafts (plan_id, payload, updated_by, updated_at)
  values (p_id, p_payload, v_uid, now())
  on conflict (plan_id) do update set
    payload = excluded.payload,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return jsonb_build_object('status', 'draft', 'plan_id', p_id);
end;
$$;

revoke all on function public.save_saas_plan_workflow(text, jsonb, boolean) from public, anon;
grant execute on function public.save_saas_plan_workflow(text, jsonb, boolean) to authenticated;

-- Publie le brouillon existant d'un forfait.
create or replace function public.publish_saas_plan_draft(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select d.payload into v_payload
  from public.saas_plan_drafts d
  where d.plan_id = p_id;

  if not found then
    raise exception 'Aucun brouillon à publier pour ce forfait.' using errcode = 'P0002';
  end if;

  perform private.upsert_saas_plan(p_id, v_payload);
  delete from public.saas_plan_drafts where plan_id = p_id;

  return jsonb_build_object('status', 'published', 'plan_id', p_id);
end;
$$;

revoke all on function public.publish_saas_plan_draft(text) from public, anon;
grant execute on function public.publish_saas_plan_draft(text) to authenticated;

-- Abandonne le brouillon sans toucher à la version publiée.
create or replace function public.discard_saas_plan_draft(p_id text)
returns jsonb
language plpgsql
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

  delete from public.saas_plan_drafts where plan_id = p_id;

  return jsonb_build_object('status', 'discarded', 'plan_id', p_id);
end;
$$;

revoke all on function public.discard_saas_plan_draft(text) from public, anon;
grant execute on function public.discard_saas_plan_draft(text) to authenticated;

-- Liste des brouillons en attente (console Super Admin uniquement).
create or replace function public.get_saas_plan_drafts()
returns table (
  plan_id text,
  payload jsonb,
  updated_at timestamptz
)
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

  return query
  select d.plan_id, d.payload, d.updated_at
  from public.saas_plan_drafts d
  order by d.updated_at desc;
end;
$$;

revoke all on function public.get_saas_plan_drafts() from public, anon;
grant execute on function public.get_saas_plan_drafts() to authenticated;
