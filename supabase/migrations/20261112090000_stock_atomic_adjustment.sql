-- Ajustement atomique de la quantité en stock.
--
-- Avant : le client lisait la quantité, calculait la nouvelle valeur, puis renvoyait toute la ligne.
-- Deux ajustements simultanés pouvaient s'écraser (mise à jour perdue).
-- Ici : la ligne est verrouillée (FOR UPDATE) le temps du calcul, puis la quantité est mise à jour
-- dans la même transaction. Les bornes sont contrôlées côté serveur, jamais seulement côté client.
--
-- La colonne stock_items.quantity est un entier : un delta fractionnaire est refusé par PostgreSQL
-- (22P02) avant d'atteindre la fonction.

create function public.adjust_stock_quantity(p_salon_id uuid, p_item_id uuid, p_delta integer)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_items;
  v_next integer;
begin
  if not private.has_salon_permission(p_salon_id, 'stock.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or p_delta < -1000000 or p_delta > 1000000 then
    raise exception 'Invalid adjustment' using errcode = '22023';
  end if;

  select * into v_item
  from public.stock_items
  where salon_id = p_salon_id and id = p_item_id
  for update;
  if not found then
    raise exception 'Stock item not found' using errcode = '22023';
  end if;

  v_next := v_item.quantity + p_delta;
  if v_next < 0 then
    raise exception 'Insufficient stock' using errcode = '22023';
  end if;
  if v_next > 1000000 then
    raise exception 'Stock quantity out of range' using errcode = '22023';
  end if;

  update public.stock_items
     set quantity = v_next,
         updated_at = now()
   where salon_id = p_salon_id and id = p_item_id
  returning * into v_item;

  return v_item;
end;
$$;

revoke all on function public.adjust_stock_quantity(uuid, uuid, integer) from public, anon;
grant execute on function public.adjust_stock_quantity(uuid, uuid, integer) to authenticated;
