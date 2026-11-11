import type { Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Constantes et outils partagés des scénarios E2E navigateur.
 *
 * Les identifiants pointent vers le jeu de données `supabase/e2e-seed.sql`
 * (chargé par `supabase db reset`). La clé service_role n'est utilisée que
 * côté Node (jamais dans le navigateur) pour vérifier l'état de la base :
 * rendez-vous, notifications, écritures de paiement.
 */
export const E2E = {
  salonSlug: 'e2e-barber-abidjan',
  salonName: 'E2E Barber Abidjan',
  salonId: '33333333-3333-4333-8333-333333333333',
  serviceName: 'Coupe E2E Express',
  ownerEmail: 'e2e-owner@barbercuts.test',
  ownerPassword: 'E2E-Proprietaire-2026!',
  // Jeton public fixe du rendez-vous terminé et réglé (parcours avis vérifié).
  reviewToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  bookingClientName: 'Client E2E',
  bookingClientPhone: '+225 07 99 88 77 66',
  bookingClientEmail: 'client-e2e@clients.test',
  reviewComment: 'Coupe impeccable et barbier ponctuel — scénario E2E.',
  caisseClientName: 'Mariam Traoré',
  caissePendingRef: 'WAVE-E2E-PENDING-0001',
} as const;

/** Client Supabase privilégié (Node uniquement) pour auditer l'état de la base. */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.API_URL ?? 'http://127.0.0.1:54321';
  const serviceKey = process.env.SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      'SERVICE_ROLE_KEY manquant : exportez le résultat de `supabase status -o env` avant `npm run e2e`.',
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export interface E2EAppointment {
  id: string;
  status: string;
  payment_status: string;
  public_cancel_token: string;
}

/** Dernier rendez-vous marketplace d'un numéro client (le scénario de réservation). */
export async function fetchLastAppointmentByPhone(phone: string): Promise<E2EAppointment> {
  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .select('id, status, payment_status, public_cancel_token')
    .eq('client_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data?.length) {
    throw new Error(`Rendez-vous introuvable pour ${phone} : ${error?.message ?? 'aucune ligne'}`);
  }
  return data[0] as E2EAppointment;
}

/** Notifications planifiées pour un rendez-vous donné. */
export async function listAppointmentNotifications(
  appointmentId: string,
): Promise<Array<{ kind: string; status: string }>> {
  const { data, error } = await supabaseAdmin()
    .from('appointment_notifications')
    .select('kind, status')
    .eq('appointment_id', appointmentId);
  if (error) {
    throw new Error(`Lecture appointment_notifications impossible : ${error.message}`);
  }
  return (data ?? []) as Array<{ kind: string; status: string }>;
}

/** Connexion du propriétaire E2E et arrivée sur l'ERP. */
export async function loginOwner(page: Page): Promise<void> {
  await page.goto('/connexion');
  await page.locator('#login-email').fill(E2E.ownerEmail);
  await page.locator('#login-password').fill(E2E.ownerPassword);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/app/);
}
