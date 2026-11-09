-- Lot 4.2 (durcissement) — Personnalisation des vitrines marketplace.
-- 1) save_marketplace_customizer_draft : validation stricte et normalisation
--    complète de la configuration (sections canoniques, couleur hexadécimale,
--    plafonds, appartenance multi-tenant des prestations/personnel/images/
--    succursale). Seule la configuration normalisée est persistée.
-- 2) marketplace_salon_detail : la page publique ne reçoit JAMAIS le brouillon
--    (published_config uniquement, sinon configuration par défaut) et une
--    sélection de personnel publiée vide signifie « aucun membre visible ».

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
  v_salon public.salons;
  v_layout text;
  v_accent text;
  v_card_style text;
  v_theme text;
  v_sections jsonb;
  v_featured_services uuid[] := '{}';
  v_visible_staff uuid[] := '{}';
  v_gallery_images text[] := '{}';
  v_valid_images text[];
  v_featured_branch uuid;
  v_tagline text;
  v_description text;
  v_normalized jsonb;
  v_rec public.salon_marketplace_settings;
  v_uuid_regex constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Invalid customizer config payload' using errcode = '22023';
  end if;

  select * into v_salon from public.salons where id = p_salon_id;
  if not found then
    raise exception 'Salon not found' using errcode = '22023';
  end if;

  -- Modèle de présentation
  v_layout := coalesce(p_config->>'layout', 'classic');
  if v_layout not in ('classic', 'elegant', 'editorial') then
    raise exception 'Invalid layout model' using errcode = '22023';
  end if;

  -- Couleur d'accentuation : hexadécimal strict (#RRGGBB), aucune injection CSS
  v_accent := coalesce(p_config->>'accentColor', '#C9A45C');
  if v_accent !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid accent color' using errcode = '22023';
  end if;

  v_card_style := coalesce(p_config->>'cardStyle', 'rounded-3xl');
  if v_card_style not in ('rounded-3xl', 'rounded-2xl', 'rounded-xl') then
    v_card_style := 'rounded-3xl';
  end if;

  v_theme := coalesce(p_config->>'themeMode', 'dark');
  if v_theme not in ('dark', 'light', 'auto') then
    v_theme := 'dark';
  end if;

  -- Textes publics : plafonds alignés sur l'éditeur
  v_tagline := btrim(coalesce(p_config->>'customTagline', ''));
  if char_length(v_tagline) > 160 then
    raise exception 'Custom tagline too long' using errcode = '22023';
  end if;
  v_description := btrim(coalesce(p_config->>'customDescription', ''));
  if char_length(v_description) > 1000 then
    raise exception 'Custom description too long' using errcode = '22023';
  end if;

  -- Sections : liste blanche canonique, déduplication, positions normalisées
  -- 0..6 déterministes ; les sections absentes sont ré-ajoutées actives en fin.
  with provided as (
    select elem->>'id' as id,
           case when elem->>'enabled' in ('true', 'false')
                then (elem->>'enabled')::boolean else true end as enabled,
           case when elem->>'position' ~ '^-?[0-9]+$'
                then (elem->>'position')::int else idx::int end as pos,
           idx
    from jsonb_array_elements(
           case when jsonb_typeof(p_config->'sections') = 'array'
                then p_config->'sections' else '[]'::jsonb end
         ) with ordinality as t(elem, idx)
    where elem->>'id' in ('hero', 'gallery', 'featured_services', 'team', 'trust', 'location_hours', 'reviews')
  ),
  dedup as (
    select distinct on (id) id, enabled, pos, idx
    from provided order by id, pos, idx
  ),
  missing as (
    select c.id, true as enabled, 1000 + c.ord as pos, 1000 + c.ord as idx
    from (values ('hero', 1), ('gallery', 2), ('featured_services', 3), ('team', 4),
                 ('trust', 5), ('location_hours', 6), ('reviews', 7)) as c(id, ord)
    where c.id not in (select id from dedup)
  ),
  all_sections as (select * from dedup union all select * from missing),
  numbered as (
    select id, enabled, (row_number() over (order by pos, idx)) - 1 as position
    from all_sections
  )
  select jsonb_agg(jsonb_build_object('id', id, 'enabled', enabled, 'position', position) order by position)
  into v_sections
  from numbered;

  -- Prestations mises en avant : UUID valides, dédupliquées, plafond 12,
  -- appartenance stricte au salon (prix/durée proviennent du catalogue).
  if jsonb_typeof(p_config->'featuredServiceIds') = 'array' then
    if exists (
      select 1 from jsonb_array_elements_text(p_config->'featuredServiceIds') as t(value)
      where value !~ v_uuid_regex
    ) then
      raise exception 'Invalid service identifier' using errcode = '22023';
    end if;
    select coalesce(array_agg(id order by idx), '{}') into v_featured_services
    from (
      select distinct on (value::uuid) value::uuid as id, idx
      from jsonb_array_elements_text(p_config->'featuredServiceIds') with ordinality as t(value, idx)
      order by value::uuid, idx
    ) d;
    if coalesce(array_length(v_featured_services, 1), 0) > 12 then
      raise exception 'Too many featured services' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_featured_services) as wanted(id)
      where not exists (
        select 1 from public.services s where s.id = wanted.id and s.salon_id = p_salon_id
      )
    ) then
      raise exception 'Service does not belong to this salon' using errcode = '22023';
    end if;
  end if;

  -- Personnel visible : mêmes règles, plafond 50.
  if jsonb_typeof(p_config->'visibleStaffIds') = 'array' then
    if exists (
      select 1 from jsonb_array_elements_text(p_config->'visibleStaffIds') as t(value)
      where value !~ v_uuid_regex
    ) then
      raise exception 'Invalid staff identifier' using errcode = '22023';
    end if;
    select coalesce(array_agg(id order by idx), '{}') into v_visible_staff
    from (
      select distinct on (value::uuid) value::uuid as id, idx
      from jsonb_array_elements_text(p_config->'visibleStaffIds') with ordinality as t(value, idx)
      order by value::uuid, idx
    ) d;
    if coalesce(array_length(v_visible_staff, 1), 0) > 50 then
      raise exception 'Too many visible staff members' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_visible_staff) as wanted(id)
      where not exists (
        select 1 from public.staff st where st.id = wanted.id and st.salon_id = p_salon_id
      )
    ) then
      raise exception 'Staff does not belong to this salon' using errcode = '22023';
    end if;
  end if;

  -- Images de galerie sélectionnées : sous-ensemble strict des images du
  -- salon (couverture + galerie du profil), dédupliquées, plafond 20.
  select coalesce(array_agg(url), '{}') into v_valid_images
  from (
    select v_salon.cover_url as url where v_salon.cover_url is not null
    union
    select elem->>'url'
    from jsonb_array_elements(coalesce(v_salon.gallery, '[]'::jsonb)) as elem
    where elem->>'url' is not null
  ) imgs;
  if jsonb_typeof(p_config->'featuredGalleryImageIds') = 'array' then
    select coalesce(array_agg(url order by idx), '{}') into v_gallery_images
    from (
      select distinct on (value) value as url, idx
      from jsonb_array_elements_text(p_config->'featuredGalleryImageIds') with ordinality as t(value, idx)
      order by value, idx
    ) d;
    if coalesce(array_length(v_gallery_images, 1), 0) > 20 then
      raise exception 'Too many gallery images' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_gallery_images) as wanted(url)
      where not (wanted.url = any(v_valid_images))
    ) then
      raise exception 'Gallery image does not belong to this salon' using errcode = '22023';
    end if;
  end if;

  -- Succursale mise en avant : doit appartenir au salon.
  if coalesce(p_config->>'featuredBranchId', '') <> '' then
    if p_config->>'featuredBranchId' !~ v_uuid_regex then
      raise exception 'Invalid branch identifier' using errcode = '22023';
    end if;
    v_featured_branch := (p_config->>'featuredBranchId')::uuid;
    if not exists (
      select 1 from public.branches b where b.id = v_featured_branch and b.salon_id = p_salon_id
    ) then
      raise exception 'Branch does not belong to this salon' using errcode = '22023';
    end if;
  end if;

  -- Configuration normalisée : seules les clés connues sont conservées.
  v_normalized := jsonb_build_object(
    'layout', v_layout,
    'accentColor', v_accent,
    'cardStyle', v_card_style,
    'themeMode', v_theme,
    'sections', v_sections,
    'featuredServiceIds', to_jsonb(v_featured_services),
    'visibleStaffIds', to_jsonb(v_visible_staff),
    'featuredGalleryImageIds', to_jsonb(v_gallery_images),
    'showAddress', case when p_config->>'showAddress' in ('true', 'false') then (p_config->>'showAddress')::boolean else true end,
    'showPhone', case when p_config->>'showPhone' in ('true', 'false') then (p_config->>'showPhone')::boolean else true end,
    'showWhatsapp', case when p_config->>'showWhatsapp' in ('true', 'false') then (p_config->>'showWhatsapp')::boolean else true end,
    'customTagline', v_tagline,
    'customDescription', v_description
  );
  if v_featured_branch is not null then
    v_normalized := v_normalized || jsonb_build_object('featuredBranchId', v_featured_branch);
  end if;

  insert into public.salon_marketplace_settings (
    salon_id, layout, accent_color, card_style, sections,
    featured_service_ids, visible_staff_ids, featured_gallery_image_ids,
    show_address, show_phone, show_whatsapp,
    custom_tagline, custom_description,
    draft_config, updated_at
  ) values (
    p_salon_id, v_layout, v_accent, v_card_style, v_sections,
    v_featured_services, v_visible_staff, v_gallery_images,
    (v_normalized->>'showAddress')::boolean,
    (v_normalized->>'showPhone')::boolean,
    (v_normalized->>'showWhatsapp')::boolean,
    v_tagline, v_description,
    v_normalized, now()
  )
  on conflict (salon_id) do update set
    layout = excluded.layout,
    accent_color = excluded.accent_color,
    card_style = excluded.card_style,
    sections = excluded.sections,
    featured_service_ids = excluded.featured_service_ids,
    visible_staff_ids = excluded.visible_staff_ids,
    featured_gallery_image_ids = excluded.featured_gallery_image_ids,
    show_address = excluded.show_address,
    show_phone = excluded.show_phone,
    show_whatsapp = excluded.show_whatsapp,
    custom_tagline = excluded.custom_tagline,
    custom_description = excluded.custom_description,
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

-- Fiche publique : jamais de brouillon, sélection de personnel publiée stricte.
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
  v_has_published_staff_filter boolean := false;
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

  -- Seule la configuration PUBLIÉE pilote la vitrine et la visibilité du
  -- personnel. Une liste publiée vide = aucun membre affiché ; sans
  -- configuration publiée, comportement historique (équipe active visible).
  if v_settings.published_config is not null
     and jsonb_typeof(v_settings.published_config->'visibleStaffIds') = 'array' then
    v_has_published_staff_filter := true;
    select coalesce(array_agg(value::uuid), '{}') into v_visible_staff_ids
    from jsonb_array_elements_text(v_settings.published_config->'visibleStaffIds') as t(value)
    where value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
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
        and (not v_has_published_staff_filter or st.id = any(coalesce(v_visible_staff_ids, '{}'::uuid[])))
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
    'customizer', coalesce(v_settings.published_config, private.build_default_marketplace_config(v_salon.id))
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function public.marketplace_salon_detail(text) from public;
grant execute on function public.marketplace_salon_detail(text) to anon, authenticated;
