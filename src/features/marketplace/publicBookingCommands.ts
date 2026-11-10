/**
 * Réservation et annulation publiques (marketplace, sans compte). Les appels passent par la base (RPC) ;
 * la clé d'idempotence protège contre un double envoi. Le port est injectable pour les tests.
 */
import {
  bookMarketplaceAppointment,
  cancelMarketplaceBooking,
  type PublicBooking,
  type PublicBookingInput,
} from '../../lib/marketplace';

export interface PublicBookingPort {
  book: (input: PublicBookingInput) => Promise<PublicBooking>;
  cancel: (
    salonId: string,
    appointmentId: string,
    cancelToken: string,
    reason: string,
  ) => Promise<PublicBooking>;
}

export type PublicBookingResult = { success: boolean; booking?: PublicBooking; error?: string };

const defaultPort: PublicBookingPort = {
  book: bookMarketplaceAppointment,
  cancel: cancelMarketplaceBooking,
};

/**
 * Clé fournie par l'appelant (même « ?? » que l'original : une chaîne vide est transmise telle quelle),
 * sinon UUID du navigateur, sinon valeur horodatée (anciens navigateurs).
 */
export function publicIdempotencyKey(
  provided: string | undefined,
  random: { randomUUID?: () => string; now?: () => number; random?: () => number } = {},
): string {
  if (provided !== undefined && provided !== null) return provided;
  if (typeof random.randomUUID === 'function') return random.randomUUID();
  const now = random.now ?? Date.now;
  const rnd = random.random ?? Math.random;
  return `${now()}-${rnd().toString(16).slice(2)}`;
}

function browserRandom() {
  return typeof crypto !== 'undefined' ? crypto : undefined;
}

export async function bookPublicAppointment(
  input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string },
  port: PublicBookingPort = defaultPort,
  random: Parameters<typeof publicIdempotencyKey>[1] = browserRandom() ?? {},
): Promise<PublicBookingResult> {
  try {
    const idempotencyKey = publicIdempotencyKey(input.idempotencyKey, random);
    const booking = await port.book({ ...input, idempotencyKey });
    return { success: true, booking };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Réservation en ligne impossible.';
    return { success: false, error: message };
  }
}

export async function cancelPublicBooking(
  salonId: string,
  appointmentId: string,
  cancelToken: string,
  reason: string,
  port: PublicBookingPort = defaultPort,
): Promise<PublicBookingResult> {
  try {
    const booking = await port.cancel(salonId, appointmentId, cancelToken, reason);
    return { success: true, booking };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Annulation impossible.';
    return { success: false, error: message };
  }
}
