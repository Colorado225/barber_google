#!/usr/bin/env bash
# Appliquer une seule instance de ce script à la fois, avec un rôle de migration privilégié.
set -euo pipefail
: "${DATABASE_URL:?Définir DATABASE_URL pour la base de développement}"
command -v psql >/dev/null || { echo 'psql est requis' >&2; exit 1; }
command -v sha256sum >/dev/null || { echo 'sha256sum est requis' >&2; exit 1; }
root="$(cd "$(dirname "$0")" && pwd)"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS public.bc_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())'
for file in "$root"/migrations/*.sql; do
  version="$(basename "$file")"
  [[ "$version" =~ ^[0-9]+_[a-z0-9_]+\.sql$ ]] || { echo "Nom de migration invalide: $version" >&2; exit 1; }
  checksum="$(sha256sum "$file" | cut -d ' ' -f1)"
  existing="$(psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT checksum FROM public.bc_schema_migrations WHERE version = '$version'")"
  if [[ -n "$existing" ]]; then
    [[ "$existing" == "$checksum" ]] || { echo "Migration déjà appliquée mais modifiée : $version" >&2; exit 1; }
    echo "Déjà appliquée : $version"
    continue
  fi
  echo "Application : $version"
  # Migration et inscription sont dans la même transaction ; l'échec annule les deux.
  psql "$DATABASE_URL" -X -1 -v ON_ERROR_STOP=1 -f "$file" -c "INSERT INTO public.bc_schema_migrations(version, checksum) VALUES ('$version', '$checksum')"
done
