-- Migration 20261111200000 : Contenu global de la Marketplace persisté en base (P1 SuperAdmin).
--
-- Objectifs :
--  1. Remplacer la persistance localStorage du contenu global Marketplace (bandeau d'annonce,
--     bannières, sections à la une, métadonnées du site, onglets, FAQ…) par la table singleton
--     public.platform_marketplace_content : le contenu publié est désormais partagé entre
--     administrateurs et visible par tous les visiteurs, pas seulement le navigateur de l'éditeur.
--  2. Toute écriture passe par une opération serveur réservée au SuperAdmin
--     (private.require_platform_role) avec motif de modification obligatoire et journal d'audit.
--  3. Lecture publique non sensible via public.get_public_marketplace_content() : la marketplace,
--     la navbar et le SEO affichent le contenu réellement publié, quel que soit le navigateur.
--  4. Le stockage navigateur devient un simple cache de lecture (et un aperçu local en
--     développement sans Supabase) : il ne fait plus autorité.

-- 1. Table singleton du contenu Marketplace -------------------------------------------------
create table if not exists public.platform_marketplace_content (
  id text primary key default 'global' check (id = 'global'),
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Aucune ligne par défaut : tant que le SuperAdmin n'a rien publié, la lecture publique
-- renvoie un objet vide que le frontend complète avec les valeurs par défaut.
alter table public.platform_marketplace_content enable row level security;
revoke all on public.platform_marketplace_content from public, anon, authenticated;

-- 2. Lecture publique (contenu marketing non sensible) --------------------------------------
create or replace function public.get_public_marketplace_content()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.platform_marketplace_content%rowtype;
begin
  select * into v_row from public.platform_marketplace_content where id = 'global';
  if not found then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'content', v_row.content,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.get_public_marketplace_content() from public, anon;
grant execute on function public.get_public_marketplace_content() to anon, authenticated;

-- 3. Lecture et écriture SuperAdmin (motif + audit obligatoires) ----------------------------
create or replace function public.admin_get_marketplace_content()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.platform_marketplace_content%rowtype;
begin
  perform private.require_platform_role(array['super_admin']);

  select * into v_row from public.platform_marketplace_content where id = 'global';
  if not found then
    return jsonb_build_object('content', null::jsonb, 'updated_at', null::timestamptz, 'updated_by', null::uuid);
  end if;

  return jsonb_build_object(
    'content', v_row.content,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
end;
$$;

create or replace function public.admin_update_marketplace_content(
  p_content jsonb,
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
  v_content jsonb;
  v_before_updated_at timestamptz;
  v_row public.platform_marketplace_content%rowtype;
begin
  perform private.require_platform_role(array['super_admin']);
  v_uid := (select auth.uid());
  v_reason := private.require_audit_reason(p_reason);

  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Le contenu Marketplace doit être un objet JSON.' using errcode = '22023';
  end if;
  if pg_column_size(p_content) > 262144 then
    raise exception 'Contenu Marketplace trop volumineux (256 Ko maximum).' using errcode = '22023';
  end if;

  -- Le frontend n''est pas propriétaire de l''horodatage : il est posé par le serveur.
  v_content := p_content - 'updatedAt';

  select updated_at into v_before_updated_at
    from public.platform_marketplace_content where id = 'global';

  insert into public.platform_marketplace_content (id, content, updated_at, updated_by)
  values ('global', v_content, now(), v_uid)
  on conflict (id) do update set
    content = excluded.content,
    updated_at = now(),
    updated_by = v_uid
  returning * into v_row;

  perform private.record_platform_audit(
    'platform.marketplace_content_updated',
    'platform_marketplace_content',
    'global',
    jsonb_build_object('updated_at', v_before_updated_at),
    jsonb_build_object(
      'updated_at', v_row.updated_at,
      'content_bytes', pg_column_size(v_content)
    ),
    v_reason,
    jsonb_build_object('published_by', v_uid)
  );

  return jsonb_build_object(
    'content', v_row.content,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
end;
$$;

revoke all on function public.admin_get_marketplace_content() from public, anon;
revoke all on function public.admin_update_marketplace_content(jsonb, text) from public, anon;
grant execute on function public.admin_get_marketplace_content() to authenticated;
grant execute on function public.admin_update_marketplace_content(jsonb, text) to authenticated;
