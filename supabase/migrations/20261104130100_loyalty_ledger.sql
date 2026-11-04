-- Parcours client complet (2/4) — fidélité réelle et automatique.
-- Points attribués uniquement sur rendez-vous TERMINÉ et PAYÉ, une seule fois,
-- journal append-only, reprise en cas de remboursement, consommation atomique
-- des récompenses. Aucun point n'est calculé côté navigateur.

create table public.loyalty_programs (
  salon_id uuid primary key references public.salons(id) on delete restrict,
  is_enabled boolean not null default true,
  points_per_100_xof integer not null default 1 check (points_per_100_xof between 0 and 1000),
  welcome_bonus integer not null default 0 check (welcome_bonus between 0 and 100000),
  silver_threshold integer not null default 100 check (silver_threshold > 0),
  gold_threshold integer not null default 250 check (gold_threshold > 0),
  vip_threshold integer not null default 500 check (vip_threshold > 0),
  updated_at timestamptz not null default now(),
  check (silver_threshold < gold_threshold and gold_threshold < vip_threshold)
);

create table public.loyalty_accounts (
  salon_id uuid not null,
  client_id uuid not null,
  points_balance integer not null default 0 check (points_balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  total_redeemed integer not null default 0 check (total_redeemed >= 0),
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'vip')),
  updated_at timestamptz not null default now(),
  primary key (salon_id, client_id),
  foreign key (salon_id, client_id) references public.clients(salon_id, id) on delete restrict
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  client_id uuid not null,
  appointment_id uuid,
  reward_id uuid,
  kind text not null check (kind in ('earned_service', 'redeemed_reward', 'welcome_bonus', 'manual_adjustment', 'reversal')),
  points integer not null check (points <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (salon_id, client_id) references public.clients(salon_id, id) on delete restrict,
  foreign key (salon_id, appointment_id) references public.appointments(salon_id, id) on delete restrict,
  foreign key (salon_id, reward_id) references public.rewards(salon_id, id) on delete restrict
);

-- Un gain par rendez-vous, une reprise par rendez-vous, un bonus de bienvenue
-- par client : l'idempotence est garantie par la base, pas par l'UI.
create unique index loyalty_one_earn_per_appointment
  on public.loyalty_transactions (appointment_id) where kind = 'earned_service';
create unique index loyalty_one_reversal_per_appointment
  on public.loyalty_transactions (appointment_id) where kind = 'reversal';
create unique index loyalty_one_welcome_per_client
  on public.loyalty_transactions (salon_id, client_id) where kind = 'welcome_bonus';
create index loyalty_transactions_client_idx
  on public.loyalty_transactions (salon_id, client_id, created_at desc);

alter table public.rewards add column if not exists times_redeemed integer not null default 0 check (times_redeemed >= 0);

create function private.protect_loyalty_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Loyalty transactions are append-only' using errcode = '42501';
end;
$$;
create trigger loyalty_transactions_immutable
  before update or delete on public.loyalty_transactions
  for each row execute function private.protect_loyalty_transaction();

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
revoke all on public.loyalty_programs, public.loyalty_accounts, public.loyalty_transactions from public, anon, authenticated;
grant select on public.loyalty_programs, public.loyalty_accounts, public.loyalty_transactions to authenticated;
grant select (times_redeemed) on public.rewards to authenticated;

create policy loyalty_programs_read_member on public.loyalty_programs for select to authenticated
  using (private.has_salon_permission(salon_id, 'loyalty.read'));
create policy loyalty_accounts_read_member on public.loyalty_accounts for select to authenticated
  using (private.has_salon_permission(salon_id, 'loyalty.read'));
create policy loyalty_transactions_read_member on public.loyalty_transactions for select to authenticated
  using (private.has_salon_permission(salon_id, 'loyalty.read'));

create function private.loyalty_program(p_salon_id uuid)
returns public.loyalty_programs
language plpgsql security definer set search_path = '' as $$
declare v_program public.loyalty_programs;
begin
  select * into v_program from public.loyalty_programs where salon_id = p_salon_id;
  if not found then
    insert into public.loyalty_programs(salon_id) values (p_salon_id)
      on conflict (salon_id) do nothing;
    select * into v_program from public.loyalty_programs where salon_id = p_salon_id;
  end if;
  return v_program;
end;
$$;
revoke all on function private.loyalty_program(uuid) from public, anon, authenticated;

create function private.loyalty_tier(p_points integer, p_program public.loyalty_programs)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_points >= p_program.vip_threshold then 'vip'
    when p_points >= p_program.gold_threshold then 'gold'
    when p_points >= p_program.silver_threshold then 'silver'
    else 'bronze'
  end;
$$;
revoke all on function private.loyalty_tier(integer, public.loyalty_programs) from public, anon, authenticated;

-- Applique un mouvement : crée le compte, journalise, met à jour le solde.
create function private.loyalty_apply(
  p_salon_id uuid, p_client_id uuid, p_points integer, p_kind text,
  p_appointment_id uuid, p_reward_id uuid, p_reason text, p_actor uuid
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_program public.loyalty_programs;
  v_balance integer;
  v_id uuid;
begin
  if p_points = 0 then return null; end if;
  v_program := private.loyalty_program(p_salon_id);

  insert into public.loyalty_accounts(salon_id, client_id)
    values (p_salon_id, p_client_id) on conflict (salon_id, client_id) do nothing;
  select points_balance into v_balance from public.loyalty_accounts
    where salon_id = p_salon_id and client_id = p_client_id for update;

  if p_points < 0 and v_balance + p_points < 0 then
    raise exception 'Insufficient loyalty points' using errcode = '22023';
  end if;

  insert into public.loyalty_transactions(
    salon_id, client_id, appointment_id, reward_id, kind, points, balance_after, reason, created_by)
  values (p_salon_id, p_client_id, p_appointment_id, p_reward_id, p_kind, p_points,
          v_balance + p_points, p_reason, p_actor)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    return null; -- mouvement déjà journalisé (idempotence)
  end if;

  update public.loyalty_accounts set
    points_balance = points_balance + p_points,
    total_earned = total_earned + greatest(p_points, 0),
    total_redeemed = total_redeemed + greatest(-p_points, 0),
    tier = private.loyalty_tier(points_balance + p_points, v_program),
    updated_at = now()
  where salon_id = p_salon_id and client_id = p_client_id;

  return v_id;
end;
$$;
revoke all on function private.loyalty_apply(uuid, uuid, integer, text, uuid, uuid, text, uuid) from public, anon, authenticated;

-- Gain automatique : rendez-vous terminé ET payé, client identifié.
create function private.loyalty_on_appointment_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_program public.loyalty_programs;
  v_points integer;
  v_earned integer;
  v_balance integer;
  v_reversal integer;
begin
  if new.client_id is null then
    return new;
  end if;

  if new.status = 'completed' and new.payment_status = 'paid' then
    v_program := private.loyalty_program(new.salon_id);
    if v_program.is_enabled and v_program.points_per_100_xof > 0 then
      v_points := ((new.amount * v_program.points_per_100_xof) / 100)::integer;
      if v_points > 0 then
        perform private.loyalty_apply(new.salon_id, new.client_id, v_points, 'earned_service',
          new.id, null, 'Prestation ' || new.service_name || ' réglée', null);
      end if;
    end if;
  elsif new.payment_status = 'refunded' then
    -- Remboursement : on retire les points gagnés, sans rendre le solde négatif.
    select t.points into v_earned from public.loyalty_transactions t
      where t.appointment_id = new.id and t.kind = 'earned_service';
    if v_earned is not null then
      select a.points_balance into v_balance from public.loyalty_accounts a
        where a.salon_id = new.salon_id and a.client_id = new.client_id;
      v_reversal := least(v_earned, coalesce(v_balance, 0));
      if v_reversal > 0 then
        perform private.loyalty_apply(new.salon_id, new.client_id, -v_reversal, 'reversal',
          new.id, null, 'Remboursement de la prestation ' || new.service_name, null);
      end if;
    end if;
  end if;

  return new;
end;
$$;
create trigger appointments_loyalty_award
  after insert or update of status, payment_status on public.appointments
  for each row execute function private.loyalty_on_appointment_change();

-- Bonus de bienvenue à la création d'une fiche client (si activé).
create function private.loyalty_welcome_bonus()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_program public.loyalty_programs;
begin
  v_program := private.loyalty_program(new.salon_id);
  if v_program.is_enabled and v_program.welcome_bonus > 0 then
    perform private.loyalty_apply(new.salon_id, new.id, v_program.welcome_bonus, 'welcome_bonus',
      null, null, 'Bonus de bienvenue', null);
  end if;
  return new;
end;
$$;
create trigger clients_loyalty_welcome
  after insert on public.clients
  for each row execute function private.loyalty_welcome_bonus();

-- Paramétrage du programme (propriétaire / manager).
create function public.set_loyalty_program(p_salon_id uuid, p_settings jsonb)
returns public.loyalty_programs
language plpgsql security definer set search_path = '' as $$
declare v_row public.loyalty_programs;
begin
  if not private.has_salon_permission(p_salon_id, 'loyalty.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Invalid settings' using errcode = '22023';
  end if;
  v_row := private.loyalty_program(p_salon_id);

  update public.loyalty_programs set
    is_enabled = coalesce((p_settings->>'is_enabled')::boolean, is_enabled),
    points_per_100_xof = coalesce((p_settings->>'points_per_100_xof')::integer, points_per_100_xof),
    welcome_bonus = coalesce((p_settings->>'welcome_bonus')::integer, welcome_bonus),
    silver_threshold = coalesce((p_settings->>'silver_threshold')::integer, silver_threshold),
    gold_threshold = coalesce((p_settings->>'gold_threshold')::integer, gold_threshold),
    vip_threshold = coalesce((p_settings->>'vip_threshold')::integer, vip_threshold),
    updated_at = now()
  where salon_id = p_salon_id returning * into v_row;

  update public.loyalty_accounts a set tier = private.loyalty_tier(a.points_balance, v_row)
    where a.salon_id = p_salon_id;
  return v_row;
end;
$$;
revoke all on function public.set_loyalty_program(uuid, jsonb) from public, anon;
grant execute on function public.set_loyalty_program(uuid, jsonb) to authenticated;

-- Consommation d'une récompense : atomique, plafonnée au solde.
create function public.redeem_loyalty_reward(p_salon_id uuid, p_client_id uuid, p_reward_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_reward public.rewards;
  v_account public.loyalty_accounts;
  v_tx uuid;
begin
  if not private.has_salon_permission(p_salon_id, 'loyalty.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_reward from public.rewards
    where id = p_reward_id and salon_id = p_salon_id and is_active for update;
  if not found then
    raise exception 'Reward unavailable' using errcode = '22023';
  end if;
  select * into v_account from public.loyalty_accounts
    where salon_id = p_salon_id and client_id = p_client_id for update;
  if not found or v_account.points_balance < v_reward.points_cost then
    raise exception 'Insufficient loyalty points' using errcode = '22023';
  end if;

  v_tx := private.loyalty_apply(p_salon_id, p_client_id, -v_reward.points_cost, 'redeemed_reward',
    null, p_reward_id, 'Récompense : ' || v_reward.name, (select auth.uid()));
  update public.rewards set times_redeemed = times_redeemed + 1 where id = p_reward_id;

  select * into v_account from public.loyalty_accounts where salon_id = p_salon_id and client_id = p_client_id;
  return jsonb_build_object('transaction_id', v_tx, 'points_balance', v_account.points_balance,
                            'tier', v_account.tier, 'reward_name', v_reward.name);
end;
$$;
revoke all on function public.redeem_loyalty_reward(uuid, uuid, uuid) from public, anon;
grant execute on function public.redeem_loyalty_reward(uuid, uuid, uuid) to authenticated;

-- Ajustement manuel tracé (geste commercial, correction).
create function public.adjust_loyalty_points(p_salon_id uuid, p_client_id uuid, p_points integer, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_tx uuid; v_account public.loyalty_accounts;
begin
  if not private.has_salon_permission(p_salon_id, 'loyalty.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_points is null or p_points = 0 or char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Invalid adjustment' using errcode = '22023';
  end if;
  v_tx := private.loyalty_apply(p_salon_id, p_client_id, p_points, 'manual_adjustment',
    null, null, btrim(p_reason), (select auth.uid()));
  select * into v_account from public.loyalty_accounts where salon_id = p_salon_id and client_id = p_client_id;
  return jsonb_build_object('transaction_id', v_tx, 'points_balance', v_account.points_balance, 'tier', v_account.tier);
end;
$$;
revoke all on function public.adjust_loyalty_points(uuid, uuid, integer, text) from public, anon;
grant execute on function public.adjust_loyalty_points(uuid, uuid, integer, text) to authenticated;
