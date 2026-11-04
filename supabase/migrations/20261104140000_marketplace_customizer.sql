-- Lot 4.2 — Personnalisation des vitrines marketplace (Customizer).
-- Permet au propriétaire d'un salon de personnaliser sa présentation publique
-- (modèle de layout, couleurs, ordre des sections, prestations et membres visibles)
-- sans jamais dupliquer les données métier (services, tarifs, staff, avis).

create table if not exists public.salon_marketplace_settings (
  salon_id uuid primary key references public.salons(id) on delete cascade,
  layout text not null default 'classic' check (layout in ('classic', 'elegant', 'editorial')),
  accent_color text not null default '#C9A45C',
  sections jsonb not null default '[
    {"id": "hero", "enabled": true, "position": 0},
    {"id": "gallery", "enabled": true, "position": 1},
    {"id": "featured_services", "enabled": true, "position": 2},
    {"id": "team", "enabled": true, "position": 3},
    {"id": "trust", "enabled": true, "position": 4},
    {"id": "location_hours", "enabled": true, "position": 5},
    {"id": "reviews", "enabled": true, "position": 6}
  ]'::jsonb,
  featured_service_ids uuid[] not null default '{}',
  visible_staff_ids uuid[] not null default '{}',
  featured_gallery_image_ids text[] not null default '{}',
  show_address boolean not null default true,
  show_phone boolean not null default true,
  show_whatsapp boolean not null default true,
  custom_tagline text not null default '',
  custom_description text not null default '',
  card_style text not null default 'rounded-3xl' check (card_style in ('rounded-3xl', 'rounded-2xl', 'rounded-xl')),
  draft_config jsonb not null default '{}'::jsonb,
  published_config jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salon_marketplace_settings enable row level security;

create policy marketplace_settings_member_select on public.salon_marketplace_settings
  for select to authenticated
  using (private.has_salon_permission(salon_id, 'salon.read'));

create policy marketplace_settings_owner_insert on public.salon_marketplace_settings
  for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'salon.update'));

create policy marketplace_settings_owner_update on public.salon_marketplace_settings
  for update to authenticated
  using (private.has_salon_permission(salon_id, 'salon.update'));

grant select, insert, update on public.salon_marketplace_settings to authenticated;

-- Helper privé : génère la configuration par défaut pour un salon
create or replace function private.build_default_marketplace_config(p_salon_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_services uuid[];
  v_staff uuid[];
begin
  select * into v_salon from public.salons where id = p_salon_id;
  
  -- Prestations par défaut : prestations déjà marquées en vedette ou les 3 premières actives
  select coalesce(v_salon.featured_service_ids, '{}') into v_services;
  if array_length(v_services, 1) is null or array_length(v_services, 1) = 0 then
    select coalesce(array_agg(id), '{}') into v_services
    from (
      select id from public.services
      where salon_id = p_salon_id and is_active
      order by popular desc, created_at
      limit 4
    ) sub;
  end if;

  -- Personnel visible par défaut : tous les membres actifs disponibles
  select coalesce(array_agg(id), '{}') into v_staff
  from (
    select id from public.staff
    where salon_id = p_salon_id and is_active
    order by name
  ) sub;

  return jsonb_build_object(
    'layout', 'classic',
    'accentColor', '#C9A45C',
    'cardStyle', 'rounded-3xl',
    'sections', '[
      {"id": "hero", "enabled": true, "position": 0},
      {"id": "gallery", "enabled": true, "position": 1},
      {"id": "featured_services", "enabled": true, "position": 2},
      {"id": "team", "enabled": true, "position": 3},
      {"id": "trust", "enabled": true, "position": 4},
      {"id": "location_hours", "enabled": true, "position": 5},
      {"id": "reviews", "enabled": true, "position": 6}
    ]'::jsonb,
    'featuredServiceIds', to_jsonb(coalesce(v_services, '{}')),
    'visibleStaffIds', to_jsonb(coalesce(v_staff, '{}')),
    'featuredGalleryImageIds', '[]'::jsonb,
    'showAddress', true,
    'showPhone', true,
    'showWhatsapp', true,
    'customTagline', coalesce(v_salon.tagline, ''),
    'customDescription', coalesce(v_salon.description, ''),
    'themeMode', 'dark'
  );
end;
$$;

-- Lecture de la configuration d'édition (ERP)
create or replace function public.get_marketplace_customizer_config(p_salon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.salon_marketplace_settings;
  v_default jsonb;
begin
  if not private.has_salon_permission(p_salon_id, 'salon.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_rec from public.salon_marketplace_settings where salon_id = p_salon_id;

  if not found then
    v_default := private.build_default_marketplace_config(p_salon_id);
    insert into public.salon_marketplace_settings (
      salon_id, layout, accent_color, draft_config, is_published
    ) values (
      p_salon_id,
      coalesce(v_default->>'layout', 'classic'),
      coalesce(v_default->>'accentColor', '#C9A45C'),
      v_default,
      false
    )
    returning * into v_rec;
  end if;

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
revoke all on function public.get_marketplace_customizer_config(uuid) from public, anon;
grant execute on function public.get_marketplace_customizer_config(uuid) to authenticated;

-- Enregistrement du brouillon (draft)
create or replace function public.save_marketplace_customizer_draft(
  p_salon_id uuid,
  p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_layout text;
  v_accent text;
  v_card_style text;
  v_featured_services uuid[] := '{}';
  v_visible_staff uuid[] := '{}';
  v_service_id uuid;
  v_staff_id uuid;
  v_rec public.salon_marketplace_settings;
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Invalid customizer config payload' using errcode = '22023';
  end if;

  v_layout := coalesce(p_config->>'layout', 'classic');
  if v_layout not in ('classic', 'elegant', 'editorial') then
    raise exception 'Invalid layout model' using errcode = '22023';
  end if;

  v_accent := coalesce(p_config->>'accentColor', '#C9A45C');
  v_card_style := coalesce(p_config->>'cardStyle', 'rounded-3xl');
  if v_card_style not in ('rounded-3xl', 'rounded-2xl', 'rounded-xl') then
    v_card_style := 'rounded-3xl';
  end if;

  -- Validation stricte multi-tenant : les prestations doivent appartenir au salon
  if p_config ? 'featuredServiceIds' and jsonb_typeof(p_config->'featuredServiceIds') = 'array' then
    select coalesce(array_agg(value::uuid), '{}') into v_featured_services
    from jsonb_array_elements_text(p_config->'featuredServiceIds') as t(value);

    foreach v_service_id in array v_featured_services loop
      if not exists (select 1 from public.services s where s.id = v_service_id and s.salon_id = p_salon_id) then
        raise exception 'Service % does not belong to this salon', v_service_id using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Validation stricte multi-tenant : les membres d'équipe doivent appartenir au salon
  if p_config ? 'visibleStaffIds' and jsonb_typeof(p_config->'visibleStaffIds') = 'array' then
    select coalesce(array_agg(value::uuid), '{}') into v_visible_staff
    from jsonb_array_elements_text(p_config->'visibleStaffIds') as t(value);

    foreach v_staff_id in array v_visible_staff loop
      if not exists (select 1 from public.staff st where st.id = v_staff_id and st.salon_id = p_salon_id) then
        raise exception 'Staff % does not belong to this salon', v_staff_id using errcode = '22023';
      end if;
    end loop;
  end if;

  insert into public.salon_marketplace_settings (
    salon_id, layout, accent_color, card_style,
    featured_service_ids, visible_staff_ids,
    draft_config, updated_at
  ) values (
    p_salon_id, v_layout, v_accent, v_card_style,
    v_featured_services, v_visible_staff,
    p_config, now()
  )
  on conflict (salon_id) do update set
    layout = excluded.layout,
    accent_color = excluded.accent_color,
    card_style = excluded.card_style,
    featured_service_ids = excluded.featured_service_ids,
    visible_staff_ids = excluded.visible_staff_ids,
    draft_config = excluded.draft_config,
    updated_at = now()
  returning * into v_rec;

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
revoke all on function public.save_marketplace_customizer_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_marketplace_customizer_draft(uuid, jsonb) to authenticated;

-- Publication de la vitrine
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

  select * into v_rec from public.salon_marketplace_settings where salon_id = p_salon_id for update;
  if not found then
    raise exception 'Customizer settings not found. Save a draft first' using errcode = '22023';
  end if;

  -- Vérification des critères de publication de base du salon
  if not exists (select 1 from public.services s where s.salon_id = p_salon_id and s.is_active) then
    raise exception 'At least one active service is required to publish' using errcode = '22023';
  end if;
  if btrim(v_salon.address) = '' or btrim(v_salon.phone) = '' or v_salon.cover_url is null then
    raise exception 'Address, phone and cover photo are required to publish' using errcode = '22023';
  end if;

  -- Extraction des prestations mises en avant pour synchroniser la colonne canonique du salon
  if v_rec.draft_config ? 'featuredServiceIds' then
    select coalesce(array_agg(value::uuid), '{}') into v_featured_services
    from jsonb_array_elements_text(v_rec.draft_config->'featuredServiceIds') as t(value);
  end if;

  -- Mise à jour des paramètres customizer
  update public.salon_marketplace_settings set
    published_config = v_rec.draft_config,
    is_published = true,
    published_at = now(),
    updated_at = now()
  where salon_id = p_salon_id
  returning * into v_rec;

  -- Synchronisation atomique sur la table salons
  update public.salons set
    is_published = true,
    publication_date = coalesce(publication_date, now()),
    featured_service_ids = v_featured_services
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

-- Dépublication de la vitrine
create or replace function public.unpublish_marketplace_customizer(p_salon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.salon_marketplace_settings;
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.salon_marketplace_settings set
    is_published = false,
    updated_at = now()
  where salon_id = p_salon_id
  returning * into v_rec;

  if not found then
    raise exception 'Customizer settings not found' using errcode = '22023';
  end if;

  -- On synchronise également salons.is_published
  update public.salons set is_published = false where id = p_salon_id;

  return jsonb_build_object(
    'salon_id', v_rec.salon_id,
    'is_published', v_rec.is_published,
    'updated_at', v_rec.updated_at
  );
end;
$$;
revoke all on function public.unpublish_marketplace_customizer(uuid) from public, anon;
grant execute on function public.unpublish_marketplace_customizer(uuid) to authenticated;

-- Annulation des modifications : réinitialise le draft à partir du dernier published_config
create or replace function public.revert_marketplace_customizer_draft(p_salon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.salon_marketplace_settings;
  v_default jsonb;
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_rec from public.salon_marketplace_settings where salon_id = p_salon_id for update;
  if not found then
    raise exception 'Customizer settings not found' using errcode = '22023';
  end if;

  if v_rec.published_config is not null then
    update public.salon_marketplace_settings set
      draft_config = v_rec.published_config,
      layout = coalesce(v_rec.published_config->>'layout', v_rec.layout),
      accent_color = coalesce(v_rec.published_config->>'accentColor', v_rec.accent_color),
      card_style = coalesce(v_rec.published_config->>'cardStyle', v_rec.card_style),
      updated_at = now()
    where salon_id = p_salon_id
    returning * into v_rec;
  else
    v_default := private.build_default_marketplace_config(p_salon_id);
    update public.salon_marketplace_settings set
      draft_config = v_default,
      layout = 'classic',
      accent_color = '#C9A45C',
      card_style = 'rounded-3xl',
      updated_at = now()
    where salon_id = p_salon_id
    returning * into v_rec;
  end if;

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
revoke all on function public.revert_marketplace_customizer_draft(uuid) from public, anon;
grant execute on function public.revert_marketplace_customizer_draft(uuid) to authenticated;

-- Mise à jour de marketplace_salon_detail pour enrichir la fiche avec la configuration publiée de la vitrine
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
  v_result jsonb;
  v_visible_staff_ids uuid[];
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'Invalid salon key' using errcode = '22023';
  end if;
  select * into v_salon from public.salons s
    where s.is_published and (s.slug = lower(btrim(p_key)) or s.id::text = btrim(p_key))
    limit 1;
  if not found then
    raise exception 'Salon not found or not published' using errcode = '22023';
  end if;

  select * into v_settings from public.salon_marketplace_settings ms
    where ms.salon_id = v_salon.id;

  if v_settings.published_config is not null and v_settings.published_config ? 'visibleStaffIds' then
    select coalesce(array_agg(value::uuid), '{}') into v_visible_staff_ids
    from jsonb_array_elements_text(v_settings.published_config->'visibleStaffIds') as t(value);
  end if;

  select jsonb_build_object(
    'salon', to_jsonb(v_salon),
    'rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.salon_id = v_salon.id and r.verified),
    'review_count', (select count(*) from public.reviews r where r.salon_id = v_salon.id and r.verified),
    'min_price', (select min(sv.price) from public.services sv where sv.salon_id = v_salon.id and sv.is_active),
    'services', coalesce((select jsonb_agg(to_jsonb(sv) order by sv.category, sv.name)
      from public.services sv where sv.salon_id = v_salon.id and sv.is_active), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role,
        'specialties', st.specialties, 'service_ids', st.service_ids
      ) order by st.name)
      from public.staff st
      where st.salon_id = v_salon.id
        and st.is_active
        and st.is_available
        and (v_visible_staff_ids is null or array_length(v_visible_staff_ids, 1) is null or st.id = any(v_visible_staff_ids))
    ), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'author', r.author, 'rating', r.rating, 'comment', r.comment,
        'verified', r.verified, 'created_at', r.created_at
      ) order by r.created_at desc)
      from public.reviews r where r.salon_id = v_salon.id and r.verified), '[]'::jsonb),
    'branches', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'timezone', b.timezone,
        'hours', coalesce((select jsonb_agg(jsonb_build_object(
            'weekday', h.weekday, 'is_open', h.is_open, 'opens_at', h.opens_at, 'closes_at', h.closes_at
          ) order by h.weekday)
          from public.branch_hours h where h.branch_id = b.id), '[]'::jsonb)
      ) order by b.created_at)
      from public.branches b where b.salon_id = v_salon.id), '[]'::jsonb),
    'customizer', coalesce(v_settings.published_config, v_settings.draft_config, private.build_default_marketplace_config(v_salon.id))
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.marketplace_salon_detail(text) from public;
grant execute on function public.marketplace_salon_detail(text) to anon, authenticated;
