-- Migration 20261111110000 : Paramètres globaux de la plateforme persistés et appliqués côté serveur.
--
-- Objectifs :
--  1. Remplacer la persistance locale illusoire (localStorage) par la table singleton
--     public.platform_settings accessible en écriture uniquement au SuperAdmin (avec journal d'audit).
--  2. Appliquer maintenance_mode côté serveur sur public.create_salon() et l'exposer via
--     public.get_public_platform_status() pour verrouiller les nouvelles inscriptions (/inscription).
--  3. Appliquer auto_approve_salons côté serveur sur public.set_salon_publication() et
--     public.publish_marketplace_customizer() : lorsqu'il est désactivé (false), un salon non
--     certifié/non publié ne peut pas s'auto-publier sans validation SuperAdmin.
--  4. La commission marketplace n'a pas de mécanisme de prélèvement serveur et n'est donc pas
--     stockée comme un faux paramètre actif (l'interface la marque explicitement indisponible).

-- 1. Table singleton des paramètres plateforme --------------------------------------------
create table if not exists public.platform_settings (
  id text primary key default 'global' check (id = 'global'),
  default_currency text not null default 'XOF' check (default_currency = 'XOF'),
  maintenance_mode boolean not null default false,
  auto_approve_salons boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_settings (id, default_currency, maintenance_mode, auto_approve_salons)
values ('global', 'XOF', false, true)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;
grant select on public.platform_settings to authenticated;

drop policy if exists platform_settings_superadmin_select on public.platform_settings;
create policy platform_settings_superadmin_select on public.platform_settings
  for select to authenticated
  using (public.is_platform_superadmin());

-- 2. Lecture interne protégée (utilisée par les RPC métier) -------------------------------
create or replace function private.platform_settings_row()
returns public.platform_settings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.platform_settings%rowtype;
begin
  select * into v_row from public.platform_settings where id = 'global';
  if not found then
    v_row.id := 'global';
    v_row.default_currency := 'XOF';
    v_row.maintenance_mode := false;
    v_row.auto_approve_salons := true;
    v_row.updated_at := now();
  end if;
  return v_row;
end;
$$;

revoke all on function private.platform_settings_row() from public, anon, authenticated;

-- 3. Statut public non sensible (lecture seule pour /inscription, onboarding et ERP) ------
create or replace function public.get_public_platform_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'default_currency', s.default_currency,
    'maintenance_mode', s.maintenance_mode,
    'auto_approve_salons', s.auto_approve_salons
  )
  from private.platform_settings_row() s
$$;

revoke all on function public.get_public_platform_status() from public;
grant execute on function public.get_public_platform_status() to anon, authenticated;

-- 4. Lecture et mise à jour SuperAdmin (avec journal d'audit obligatoire) -----------------
create or replace function public.admin_get_platform_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.platform_settings%rowtype;
begin
  perform private.require_platform_role(array['super_admin']);
  v_row := private.platform_settings_row();

  return jsonb_build_object(
    'default_currency', v_row.default_currency,
    'maintenance_mode', v_row.maintenance_mode,
    'auto_approve_salons', v_row.auto_approve_salons,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by,
    'commission_rate_available', false
  );
end;
$$;

revoke all on function public.admin_get_platform_settings() from public, anon;
grant execute on function public.admin_get_platform_settings() to authenticated;

create or replace function public.admin_update_platform_settings(
  p_maintenance_mode boolean,
  p_auto_approve_salons boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_reason text;
  v_before public.platform_settings%rowtype;
  v_after public.platform_settings%rowtype;
begin
  perform private.require_platform_role(array['super_admin']);
  v_uid := (select auth.uid());
  v_reason := private.require_audit_reason(p_reason);

  if p_maintenance_mode is null or p_auto_approve_salons is null then
    raise exception 'Les paramètres maintenance_mode et auto_approve_salons sont obligatoires.'
      using errcode = '22023';
  end if;

  v_before := private.platform_settings_row();

  insert into public.platform_settings (
    id, default_currency, maintenance_mode, auto_approve_salons, updated_at, updated_by
  )
  values (
    'global', 'XOF', p_maintenance_mode, p_auto_approve_salons, now(), v_uid
  )
  on conflict (id) do update set
    maintenance_mode = excluded.maintenance_mode,
    auto_approve_salons = excluded.auto_approve_salons,
    updated_at = now(),
    updated_by = v_uid
  returning * into v_after;

  perform private.record_platform_audit(
    'platform.settings_updated',
    'platform_settings',
    'global',
    jsonb_build_object(
      'maintenance_mode', v_before.maintenance_mode,
      'auto_approve_salons', v_before.auto_approve_salons
    ),
    jsonb_build_object(
      'maintenance_mode', v_after.maintenance_mode,
      'auto_approve_salons', v_after.auto_approve_salons
    ),
    v_reason,
    jsonb_build_object('default_currency', v_after.default_currency)
  );

  return jsonb_build_object(
    'default_currency', v_after.default_currency,
    'maintenance_mode', v_after.maintenance_mode,
    'auto_approve_salons', v_after.auto_approve_salons,
    'updated_at', v_after.updated_at,
    'updated_by', v_after.updated_by,
    'commission_rate_available', false
  );
end;
$$;

revoke all on function public.admin_update_platform_settings(boolean, boolean, text) from public, anon;
grant execute on function public.admin_update_platform_settings(boolean, boolean, text) to authenticated;

-- 5. Application côté serveur dans create_salon, set_salon_publication et customizer ------
create or replace function public.create_salon(
  p_organization_name text,
  p_salon_name text,
  p_branch_name text
)
returns table (organization_id uuid, salon_id uuid, branch_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email_verified boolean;
  v_settings public.platform_settings%rowtype;
  v_organization_id uuid;
  v_salon_id uuid;
  v_branch_id uuid;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select u.email_confirmed_at is not null into v_email_verified
    from auth.users u where u.id = v_user_id;
  if not coalesce(v_email_verified, false) then
    raise exception 'Email verification required' using errcode = '42501';
  end if;

  v_settings := private.platform_settings_row();
  if v_settings.maintenance_mode and not public.is_platform_superadmin() then
    raise exception 'Mode maintenance actif : la création de nouveaux établissements est temporairement suspendue.'
      using errcode = '55000';
  end if;

  if p_organization_name is null or char_length(btrim(p_organization_name)) not between 1 and 120
    or p_salon_name is null or char_length(btrim(p_salon_name)) not between 1 and 120
    or p_branch_name is null or char_length(btrim(p_branch_name)) not between 1 and 120 then
    raise exception 'Invalid salon details' using errcode = '22023';
  end if;

  insert into public.organizations(name) values (btrim(p_organization_name))
    returning id into v_organization_id;
  insert into public.salons(organization_id, name) values (v_organization_id, btrim(p_salon_name))
    returning id into v_salon_id;
  insert into public.branches(salon_id, name) values (v_salon_id, btrim(p_branch_name))
    returning id into v_branch_id;
  insert into public.memberships(salon_id, user_id, role)
    values (v_salon_id, v_user_id, 'owner')
    returning id into v_membership_id;
  insert into public.branch_memberships(salon_id, branch_id, membership_id)
    values (v_salon_id, v_branch_id, v_membership_id);
  insert into public.onboarding_state(user_id, email_verified, salon_created, current_step)
    values (v_user_id, v_email_verified, true, 'setup')
    on conflict (user_id) do update
      set email_verified = public.onboarding_state.email_verified or excluded.email_verified,
          salon_created = true,
          current_step = case
            when public.onboarding_state.setup_completed then public.onboarding_state.current_step
            else 'setup'
          end,
          updated_at = now();

  return query select v_organization_id, v_salon_id, v_branch_id;
end
$$;
revoke all on function public.create_salon(text, text, text) from public, anon;
grant execute on function public.create_salon(text, text, text) to authenticated;

create or replace function public.set_salon_publication(p_salon_id uuid, p_published boolean)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.salons;
  v_settings public.platform_settings%rowtype;
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
    v_settings := private.platform_settings_row();
    if not v_settings.auto_approve_salons
       and not v_row.is_verified
       and not v_row.is_published
       and not public.is_platform_superadmin() then
      raise exception 'Approbation requise : la publication automatique est désactivée par l''administration. Un super-administrateur doit certifier ou publier ce salon.'
        using errcode = '42501';
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
  v_settings public.platform_settings%rowtype;
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

  v_settings := private.platform_settings_row();
  if not v_settings.auto_approve_salons
     and not v_salon.is_verified
     and not v_salon.is_published
     and not public.is_platform_superadmin() then
    raise exception 'Approbation requise : la publication automatique est désactivée par l''administration. Un super-administrateur doit certifier ou publier ce salon.'
      using errcode = '42501';
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
