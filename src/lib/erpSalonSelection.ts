import type { Salon } from '../types';

export interface SalonMembership {
  id: string;
  salonId: string;
  salonName: string;
  organizationId: string;
  organizationName: string;
  branchId: string | null;
  branchName: string | null;
  role: string;
  status: string;
  permissions: string[];
}

export const ERP_ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Gérant',
  cashier: 'Caissier',
  receptionist: 'Réceptionniste',
  barber: 'Barbier',
  accountant: 'Comptable',
};

export function formatErpRoleLabel(role: string): string {
  return ERP_ROLE_LABELS[role] ?? role;
}

export function getActiveMemberships(memberships: SalonMembership[]): SalonMembership[] {
  return memberships.filter((membership) => membership.status === 'active');
}

export function getStoredSalonStorageKey(userId: string): string {
  return `barbercuts_active_salon_${userId}`;
}

export function readStoredSalonId(userId: string, storage?: Pick<Storage, 'getItem'> | null): string | null {
  if (!userId) return null;
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return null;
  try {
    const value = target.getItem(getStoredSalonStorageKey(userId));
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function persistSelectedSalonId(
  userId: string,
  salonId: string | null,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void {
  if (!userId) return;
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return;
  try {
    const key = getStoredSalonStorageKey(userId);
    if (salonId && salonId.trim()) {
      target.setItem(key, salonId.trim());
    } else {
      target.removeItem(key);
    }
  } catch {
    // Ignore storage quota / privacy mode errors cleanly.
  }
}

export function readErpSalonFromSearch(search?: string): string | null {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) return null;
  try {
    const value = new URLSearchParams(query).get('salon');
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function resolveSelectedMembership(
  memberships: SalonMembership[],
  options?: {
    requestedSalonId?: string | null;
    urlSalonId?: string | null;
    storedSalonId?: string | null;
  },
): SalonMembership | null {
  const active = getActiveMemberships(memberships);
  if (active.length === 0) return null;

  const candidates = [options?.requestedSalonId, options?.urlSalonId, options?.storedSalonId];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = active.find((membership) => membership.salonId === candidate);
    if (match) return match;
  }

  return active[0];
}

export function buildErpUrl(tabSegment: string, salonId?: string | null, includeSalonQuery = true): string {
  const cleanSegment = tabSegment.replace(/^\/+/, '');
  const basePath = `/app/${cleanSegment}`;
  if (!includeSalonQuery || !salonId) return basePath;
  const params = new URLSearchParams();
  params.set('salon', salonId);
  return `${basePath}?${params.toString()}`;
}

export function upsertWorkspaceSalon(
  existing: Salon[],
  loadedSalon: Salon,
  memberships: SalonMembership[],
): Salon[] {
  const activeIds = new Set(getActiveMemberships(memberships).map((m) => m.salonId));
  if (activeIds.size === 0) return [loadedSalon];
  const preserved = existing.filter((salon) => activeIds.has(salon.id) && salon.id !== loadedSalon.id);
  return [...preserved, loadedSalon];
}
