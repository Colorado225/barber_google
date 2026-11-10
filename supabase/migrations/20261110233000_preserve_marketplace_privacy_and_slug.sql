-- Preserve marketplace contact privacy gating and fallback slug resolution
-- alongside SuperAdmin suspension (`status = 'active'`) and review moderation
-- (`not r.is_hidden`).

create or replace function private.marketplace_public_contact(p_config jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'show_address', coalesce((p_config ->> 'showAddress')::boolean, true),
    'show_phone', coalesce((p_config ->> 'showPhone')::boolean, true),
    'show_whatsapp', coalesce((p_config ->> 'showWhatsapp')::boolean, true)
  );
$$;
revoke all on function private.marketplace_public_contact(jsonb) from public, anon, authenticated;

create or replace function private.slugify(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    trim(
      both '-' from regexp_replace(
        lower(translate(
          coalesce(p_value, ''),
          'ÀÁÂÃÄÅàáâãäåĀāĂăĄąǍǎȀȁȂȃȦȧÇçĆćĈĉĊċČčĎďÈÉÊËèéêëĒēĔĕĖėĘęĚěȄȅȆȇȨȩĜĝĞğĠġĢģǦǧǴǵĤĥȞȟÌÍÎÏìíîïĨĩĪīĬĭĮįİǏǐȈȉȊȋĴĵǰĶķǨǩĹĺĻļĽľÑñŃńŅņŇňǸǹÒÓÔÕÖòóôõöŌōŎŏŐőƠơǑǒǪǫȌȍȎȏȮȯŔŕŖŗŘřȐȑȒȓŚśŜŝŞşŠšȘșŢţŤťȚțÙÚÛÜùúûüŨũŪūŬŭŮůŰűŲųƯưǓǔȔȕȖȗŴŵÝýÿŶŷŸȲȳŹźŻżŽž',
          'aaaaaaaaaaaaaaaaaaaaaaaaaaccccccccccddeeeeeeeeeeeeeeeeeeeeeeeegggggggggggghhhhiiiiiiiiiiiiiiiiiiiiiiijjjkkkkllllllnnnnnnnnnnoooooooooooooooooooooooooooorrrrrrrrrrssssssssssttttttuuuuuuuuuuuuuuuuuuuuuuuuuuuuwwyyyyyyyyzzzzzz'
        )),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  );
$$;
revoke all on function private.slugify(text) from public, anon, authenticated;

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
        'commune', s.commune,
        'quarter', case when (c.contact->>'show_address')::boolean then s.quarter end,
        'address', case when (c.contact->>'show_address')::boolean then s.address end,
        'phone', case when (c.contact->>'show_phone')::boolean then s.phone end,
        'whatsapp', case when (c.contact->>'show_whatsapp')::boolean then s.whatsapp end,
        'currency', s.currency,
        'status', s.status,
        'is_published', s.is_published, 'is_verified', s.is_verified,
        'publication_date', s.publication_date,
        'rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.salon_id = s.id and r.verified and not r.is_hidden),
        'review_count', (select count(*) from public.reviews r where r.salon_id = s.id and r.verified and not r.is_hidden),
        'min_price', (select min(sv.price) from public.services sv where sv.salon_id = s.id and sv.is_active),
        'service_count', (select count(*) from public.services sv where sv.salon_id = s.id and sv.is_active)
      ) as card
      from public.salons s
      left join public.salon_marketplace_settings ms on ms.salon_id = s.id
      cross join lateral (
        select private.marketplace_public_contact(coalesce(ms.published_config, '{}'::jsonb)) as contact
      ) c
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
  v_contact jsonb;
  v_salon_json jsonb;
  v_result jsonb;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'Invalid salon key' using errcode = '22023';
  end if;

  select * into v_salon from public.salons s
    where s.is_published
      and s.status = 'active'
      and (
        s.slug = lower(btrim(p_key))
        or s.id::text = btrim(p_key)
        or (s.slug is null and private.slugify(s.name) = private.slugify(p_key))
      )
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
      from jsonb_array_elements_text(v_customizer -> 'visibleStaffIds') as t(value)
      where value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    end if;
  else
    v_customizer := private.build_default_marketplace_config(v_salon.id);
  end if;

  v_contact := private.marketplace_public_contact(v_settings.published_config);
  v_salon_json := to_jsonb(v_salon);
  if not (v_contact->>'show_phone')::boolean then
    v_salon_json := v_salon_json - 'phone';
  end if;
  if not (v_contact->>'show_whatsapp')::boolean then
    v_salon_json := v_salon_json - 'whatsapp';
  end if;
  if not (v_contact->>'show_address')::boolean then
    v_salon_json := v_salon_json - 'address' - 'quarter';
  end if;

  select jsonb_build_object(
    'salon', v_salon_json,
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
