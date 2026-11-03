import { Salon } from "../types";

/**
 * Public route of a salon on the marketplace.
 * Matches the target routes of `docs/workflow-officiel-erp.md` (`/salons/[slug]`).
 */
export const SALON_PUBLIC_PATH = "/salons";

/** Identifier used in public links: the slug, falling back to a slugified name/id. */
export function getSalonLinkKey(
  salon: Pick<Salon, "id" | "slug" | "name">,
): string {
  const slug = salon.slug?.trim();
  if (slug) return slug;
  const fallback = (salon.name || salon.id)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return fallback || salon.id;
}

/** Path of the salon's public page, e.g. `/salons/le-roi-du-degrade`. */
export function buildSalonBookingPath(
  salon: Pick<Salon, "id" | "slug" | "name">,
): string {
  return `${SALON_PUBLIC_PATH}/${encodeURIComponent(getSalonLinkKey(salon))}`;
}

/**
 * Absolute URL that redirects a client straight to the salon's booking profile.
 * `origin` only falls back to the current browser origin; it is never invented.
 */
export function buildSalonBookingUrl(
  salon: Pick<Salon, "id" | "slug" | "name">,
  origin?: string,
): string {
  const base =
    origin ??
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "");
  return `${base}${buildSalonBookingPath(salon)}`;
}

/** Reads the salon slug from a `/salons/<slug>` path. Returns null otherwise. */
export function readSalonKeyFromPath(pathname?: string): string | null {
  const path =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  if (!path) return null;
  const match = path.match(new RegExp(`^${SALON_PUBLIC_PATH}/([^/]+)/?$`));
  if (!match) return null;
  const key = decodeURIComponent(match[1]).trim();
  return key ? key : null;
}

/** Legacy query read: `/` compatible with old `?salon=<slug>` links. */
export function readSalonKeyFromSearch(search?: string): string | null {
  const query =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!query) return null;
  const value = new URLSearchParams(query).get("salon");
  return value && value.trim() ? value.trim() : null;
}

/** Finds the salon matching a public link key (slug first, then id). */
export function findSalonByLinkKey(salons: Salon[], key: string): Salon | null {
  const normalized = key.toLowerCase();
  return (
    salons.find((s) => s.slug?.toLowerCase() === normalized) ??
    salons.find((s) => s.id.toLowerCase() === normalized) ??
    null
  );
}
