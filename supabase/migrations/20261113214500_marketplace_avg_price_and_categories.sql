-- Ajout du prix moyen (avg_price) et des catégories de services actives (service_categories)
-- dans marketplace_list_salons pour le filtrage par budget moyen et la personnalisation.

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
        'avg_price', (select round(avg(sv.price)) from public.services sv where sv.salon_id = s.id and sv.is_active),
        'service_categories', coalesce(
          (select array_agg(distinct sv.category) from public.services sv where sv.salon_id = s.id and sv.is_active),
          '{}'::text[]
        ),
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
