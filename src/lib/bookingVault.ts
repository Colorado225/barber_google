// Gestion sécurisée du jeton secret de suivi/annulation côté navigateur.
// - Le jeton actif de la session en cours est isolé dans `sessionStorage`
//   (limité à l'onglet courant) afin de pouvoir nettoyer immédiatement l'URL.
// - L'enregistrement durable dans `localStorage` (« Mes réservations ») est
//   strictement explicite et accompagné d'une purge automatique des anciennes
//   réservations (> 30 jours) et d'une suppression manuelle en un clic.
// - Les liens partageables utilisent le fragment URL (`#`) pour ne jamais
//   transmettre le jeton au serveur HTTP, aux journaux d'accès ou au Referer.

export interface SavedBooking {
  token: string;
  appointmentId: string;
  salonId: string;
  salonName: string;
  serviceName: string;
  startsAt: string;
  savedAt: string;
}

const STORAGE_KEY = 'barber.booking.links.v1';
const ACTIVE_TOKEN_KEY = 'barber.booking.active.v1';
const MAX_ENTRIES = 20;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function localStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isExpiredEntry(startsAt: string, nowMs = Date.now()): boolean {
  const timestamp = Date.parse(startsAt);
  if (Number.isNaN(timestamp)) return false;
  return nowMs - timestamp > RETENTION_MS;
}

export function listSavedBookings(): SavedBooking[] {
  const store = localStore();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (entry): entry is SavedBooking =>
        !!entry &&
        typeof entry.token === 'string' &&
        entry.token.trim().length > 0 &&
        typeof entry.startsAt === 'string',
    );
    const active = valid.filter((entry) => !isExpiredEntry(entry.startsAt));
    if (active.length !== valid.length) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(active));
      } catch {
        /* ignore quota */
      }
    }
    return active;
  } catch {
    return [];
  }
}

export function isBookingSavedOnDevice(criteria: { token?: string; appointmentId?: string }): boolean {
  const { token, appointmentId } = criteria;
  if (!token && !appointmentId) return false;
  return listSavedBookings().some(
    (b) => (token && b.token === token) || (appointmentId && b.appointmentId === appointmentId),
  );
}

export function saveBookingLink(entry: Omit<SavedBooking, 'savedAt'>): void {
  const store = localStore();
  const cleanToken = entry.token.trim();
  if (!store || !cleanToken) return;
  const others = listSavedBookings().filter(
    (b) =>
      b.token !== cleanToken &&
      (!entry.appointmentId || !b.appointmentId || b.appointmentId !== entry.appointmentId),
  );
  const next = [{ ...entry, token: cleanToken, savedAt: new Date().toISOString() }, ...others].slice(
    0,
    MAX_ENTRIES,
  );
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota privé : le lien reste utilisable dans l'onglet ou via l'e-mail/WhatsApp */
  }
}

export function replaceSavedBookingToken(
  oldToken: string,
  newToken: string,
  appointmentId?: string,
): boolean {
  const store = localStore();
  const cleanNew = newToken.trim();
  if (!store || !cleanNew) return false;
  const current = listSavedBookings();
  const matches = (b: SavedBooking) =>
    (oldToken && b.token === oldToken) || (appointmentId && b.appointmentId === appointmentId);
  if (!current.some(matches)) return false;

  const updated = current.map((entry) =>
    matches(entry) ? { ...entry, token: cleanNew, savedAt: new Date().toISOString() } : entry,
  );
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export function forgetBookingLink(token: string, appointmentId?: string): void {
  const store = localStore();
  if (!store) return;
  try {
    const filtered = listSavedBookings().filter(
      (b) => b.token !== token && (!appointmentId || b.appointmentId !== appointmentId),
    );
    store.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
}

export function clearAllSavedBookings(): void {
  const store = localStore();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getActiveBookingToken(): string {
  const store = sessionStore();
  if (!store) return '';
  try {
    return (store.getItem(ACTIVE_TOKEN_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function setActiveBookingToken(token: string): void {
  const store = sessionStore();
  const clean = token.trim();
  if (!store || !clean) return;
  try {
    store.setItem(ACTIVE_TOKEN_KEY, clean);
  } catch {
    /* ignore */
  }
}

export function clearActiveBookingToken(): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.removeItem(ACTIVE_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function extractTokenFromHash(hash: string): string {
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return '';
  if (raw.includes('=')) {
    const params = new URLSearchParams(raw);
    const value = params.get('token') ?? '';
    return value.trim();
  }
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
}

export function extractTokenFromSearch(search: string): string {
  const raw = search.replace(/^\?/, '').trim();
  if (!raw) return '';
  const params = new URLSearchParams(raw);
  return (params.get('token') ?? '').trim();
}

export function resolveBookingToken(sources: {
  stateToken?: string;
  hash?: string;
  search?: string;
  paramToken?: string;
}): string {
  const fromState = (sources.stateToken ?? '').trim();
  if (fromState) return fromState;

  const fromHash = extractTokenFromHash(sources.hash ?? '');
  if (fromHash) return fromHash;

  const fromParam = (sources.paramToken ?? '').trim();
  if (fromParam) return fromParam;

  const fromSearch = extractTokenFromSearch(sources.search ?? '');
  if (fromSearch) return fromSearch;

  return getActiveBookingToken();
}

export function redactBookingSecrets(text: string, knownToken?: string): string {
  let sanitized = text;
  if (knownToken && knownToken.trim()) {
    sanitized = sanitized.split(knownToken.trim()).join('[jeton-masqué]');
  }
  sanitized = sanitized.replace(/(\/reservation)[#/][0-9a-fA-F-]{8,}/gi, '$1#[jeton-masqué]');
  sanitized = sanitized.replace(/([?&]token=)[^&\s]+/gi, '$1[jeton-masqué]');
  return sanitized;
}

export function bookingPortalPath(token: string): string {
  const clean = token.trim();
  if (!clean) return '/reservation';
  return `/reservation#${encodeURIComponent(clean)}`;
}

export function bookingPortalUrl(token: string): string {
  const path = bookingPortalPath(token);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
