// Mémorise sur l'appareil les liens de suivi des réservations faites depuis ce
// navigateur. Le jeton est un secret : il n'est jamais envoyé à un tiers et ne
// quitte pas l'appareil. Aucun compte client n'est nécessaire.

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
const MAX_ENTRIES = 20;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function listSavedBookings(): SavedBooking[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedBooking =>
        !!entry && typeof entry.token === 'string' && typeof entry.startsAt === 'string',
    );
  } catch {
    return [];
  }
}

export function saveBookingLink(entry: Omit<SavedBooking, 'savedAt'>): void {
  const store = storage();
  if (!store || !entry.token) return;
  const others = listSavedBookings().filter((b) => b.token !== entry.token);
  const next = [{ ...entry, savedAt: new Date().toISOString() }, ...others].slice(0, MAX_ENTRIES);
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota privé : le lien reste consultable via l'e-mail/WhatsApp */
  }
}

export function forgetBookingLink(token: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(listSavedBookings().filter((b) => b.token !== token)));
  } catch {
    /* ignore */
  }
}

export function bookingPortalPath(token: string): string {
  return `/reservation/${token}`;
}

export function bookingPortalUrl(token: string): string {
  const path = bookingPortalPath(token);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
