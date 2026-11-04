-- Lot 7 — profil public des salons, publication contrôlée et lecture marketplace.
-- Les lectures publiques passent par des RPC security definer qui ne renvoient
-- que les salons publiés ; aucune table métier n'est ouverte en lecture anon.

-- Le noyau local avait créé ces colonnes sans guillemets : PostgreSQL les a
-- repliées en minuscules (ispublishedonmarketplace / nextavailableslot). Sur
-- l'instance distante, le noyau appliqué ne contenait pas ces colonnes : on
-- renomme si présent, sinon on ajoute directement is_published.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'salons' and column_name = 'ispublishedonmarketplace'
  ) then
    alter table public.salons rename column ispublishedonmarketplace to is_published;
  else
    alter table public.salons add column if not exists is_published boolean not null default false;
  end if;
end $$;
alter table public.salons drop column if exists nextavailableslot;

alter table public.salons
  add column if not exists slug text,
  add column if not exists tagline text not null default '',
  add column if not exists description text not null default '',
  add column if not exists type text not null default 'barbershop'
    check (type in ('barbershop', 'salon_femme', 'salon_mixte', 'institut')),
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists country text not null default 'Côte d''Ivoire',
  add column if not exists city text not null default 'Abidjan',
  add column if not exists commune text not null default '',
  add column if not exists quarter text not null default '',
  add column if not exists address text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists email text,
  add column if not exists currency text not null default 'XOF' check (currency = 'XOF'),
  add column if not exists payment_methods text[] not null default array['cash','wave','orange_money','mtn_momo','moov_money'],
  add column if not exists featured_service_ids uuid[] not null default '{}',
  add column if not exists publication_date timestamptz,
  add column if not exists is_verified boolean not null default false;

alter table public.salons
  add constraint salons_slug_unique unique (slug),
  add constraint salons_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint salons_gallery_array check (jsonb_typeof(gallery) = 'array');

create index salons_published_idx on public.salons (is_published, city, commune) where is_published;

-- Profil : seuls les champs vitrine sont modifiables, par le propriétaire.
create function public.update_salon_profile(p_salon_id uuid, p_profile jsonb)
returns public.salons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.salons;
  v_slug text;
  v_type text;
  v_gallery jsonb;
  v_methods text[];
  v_featured uuid[];
  v_item jsonb;
  v_url text;
begin
  if not private.has_salon_permission(p_salon_id, 'salon.update') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'Invalid profile payload' using errcode = '22023';
  end if;
  select * into v_row from public.salons where id = p_salon_id for update;
  if not found then
    raise exception 'Salon not found' using errcode = '22023';
  end if;

  if p_profile ? 'name' then
    v_row.name := btrim(p_profile->>'name');
    if char_length(v_row.name) not between 1 and 120 then
      raise exception 'Invalid salon name' using errcode = '22023';
    end if;
  end if;
  if p_profile ? 'slug' then
    v_slug := nullif(btrim(p_profile->>'slug'), '');
    if v_slug is not null and (char_length(v_slug) not between 3 and 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
      raise exception 'Invalid slug' using errcode = '22023';
    end if;
    if v_slug is not null and exists (select 1 from public.salons s where s.slug = v_slug and s.id <> p_salon_id) then
      raise exception 'Slug already used' using errcode = '23505';
    end if;
    v_row.slug := v_slug;
  end if;
  if p_profile ? 'type' then
    v_type := p_profile->>'type';
    if v_type not in ('barbershop', 'salon_femme', 'salon_mixte', 'institut') then
      raise exception 'Invalid salon type' using errcode = '22023';
    end if;
    v_row.type := v_type;
  end if;

  v_row.tagline := left(btrim(coalesce(p_profile->>'tagline', v_row.tagline)), 160);
  v_row.description := left(btrim(coalesce(p_profile->>'description', v_row.description)), 2000);
  v_row.country := left(btrim(coalesce(p_profile->>'country', v_row.country)), 80);
  v_row.city := left(btrim(coalesce(p_profile->>'city', v_row.city)), 80);
  v_row.commune := left(btrim(coalesce(p_profile->>'commune', v_row.commune)), 80);
  v_row.quarter := left(btrim(coalesce(p_profile->>'quarter', v_row.quarter)), 80);
  v_row.address := left(btrim(coalesce(p_profile->>'address', v_row.address)), 240);
  v_row.phone := left(btrim(coalesce(p_profile->>'phone', v_row.phone)), 40);
  v_row.whatsapp := left(btrim(coalesce(p_profile->>'whatsapp', v_row.whatsapp)), 40);
  v_row.email := nullif(lower(btrim(coalesce(p_profile->>'email', v_row.email))), '');
  if v_row.email is not null and v_row.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  foreach v_url in array array['logo_url', 'cover_url'] loop
    if p_profile ? v_url then
      v_row.logo_url := case when v_url = 'logo_url' then nullif(btrim(p_profile->>'logo_url'), '') else v_row.logo_url end;
      v_row.cover_url := case when v_url = 'cover_url' then nullif(btrim(p_profile->>'cover_url'), '') else v_row.cover_url end;
    end if;
  end loop;
  if v_row.logo_url is not null and v_row.logo_url !~* '^https?://' then
    raise exception 'Invalid logo URL' using errcode = '22023';
  end if;
  if v_row.cover_url is not null and v_row.cover_url !~* '^https?://' then
    raise exception 'Invalid cover URL' using errcode = '22023';
  end if;

  if p_profile ? 'gallery' then
    v_gallery := p_profile->'gallery';
    if jsonb_typeof(v_gallery) <> 'array' or jsonb_array_length(v_gallery) > 12 then
      raise exception 'Invalid gallery' using errcode = '22023';
    end if;
    for v_item in select * from jsonb_array_elements(v_gallery) loop
      if jsonb_typeof(v_item) <> 'object'
        or coalesce(v_item->>'url', '') !~* '^https?://'
        or char_length(v_item->>'url') > 500 then
        raise exception 'Invalid gallery item' using errcode = '22023';
      end if;
    end loop;
    v_row.gallery := v_gallery;
  end if;

  if p_profile ? 'payment_methods' then
    select array_agg(value) into v_methods
      from jsonb_array_elements_text(p_profile->'payment_methods') as t(value);
    v_methods := coalesce(v_methods, '{}');
    if v_methods <@ array['cash','wave','orange_money','mtn_momo','moov_money','card'] is not true then
      raise exception 'Invalid payment methods' using errcode = '22023';
    end if;
    v_row.payment_methods := v_methods;
  end if;

  if p_profile ? 'featured_service_ids' then
    select array_agg(value::uuid) into v_featured
      from jsonb_array_elements_text(p_profile->'featured_service_ids') as t(value);
    v_featured := coalesce(v_featured, '{}');
    if exists (
      select 1 from unnest(v_featured) as f(id)
      where not exists (select 1 from public.services s where s.id = f.id and s.salon_id = p_salon_id)
    ) then
      raise exception 'Invalid featured service' using errcode = '22023';
    end if;
    v_row.featured_service_ids := v_featured;
  end if;

  update public.salons set
    name = v_row.name, slug = v_row.slug, tagline = v_row.tagline, description = v_row.description,
    type = v_row.type, logo_url = v_row.logo_url, cover_url = v_row.cover_url, gallery = v_row.gallery,
    country = v_row.country, city = v_row.city, commune = v_row.commune, quarter = v_row.quarter,
    address = v_row.address, phone = v_row.phone, whatsapp = v_row.whatsapp, email = v_row.email,
    payment_methods = v_row.payment_methods, featured_service_ids = v_row.featured_service_ids
  where id = p_salon_id
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.update_salon_profile(uuid, jsonb) from public, anon;
grant execute on function public.update_salon_profile(uuid, jsonb) to authenticated;

create function public.set_salon_publication(p_salon_id uuid, p_published boolean)
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
    if not exists (select 1 from public.services s where s.salon_id = p_salon_id and s.is_active) then
      raise exception 'At least one active service is required to publish' using errcode = '22023';
    end if;
    if btrim(v_row.address) = '' or btrim(v_row.phone) = '' or v_row.cover_url is null then
      raise exception 'Address, phone and cover photo are required to publish' using errcode = '22023';
    end if;
    v_row.publication_date := coalesce(v_row.publication_date, now());
  end if;
  update public.salons set is_published = p_published, publication_date = v_row.publication_date
    where id = p_salon_id returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.set_salon_publication(uuid, boolean) from public, anon;
grant execute on function public.set_salon_publication(uuid, boolean) to authenticated;

-- Liste publique : uniquement les salons publiés, avec note et prix minimum réels.
create function public.marketplace_list_salons(
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
        'is_published', s.is_published, 'is_verified', s.is_verified,
        'publication_date', s.publication_date,
        'rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.salon_id = s.id and r.verified),
        'review_count', (select count(*) from public.reviews r where r.salon_id = s.id and r.verified),
        'min_price', (select min(sv.price) from public.services sv where sv.salon_id = s.id and sv.is_active),
        'service_count', (select count(*) from public.services sv where sv.salon_id = s.id and sv.is_active)
      ) as card
      from public.salons s
      where s.is_published
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

-- Fiche publique complète (salon publié uniquement). Les données staff sont
-- limitées aux champs publics ; aucun téléphone/email client n'est exposé.
create function public.marketplace_salon_detail(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_result jsonb;
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
      from public.staff st where st.salon_id = v_salon.id and st.is_active and st.is_available), '[]'::jsonb),
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
      from public.branches b where b.salon_id = v_salon.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.marketplace_salon_detail(text) from public;
grant execute on function public.marketplace_salon_detail(text) to anon, authenticated;
