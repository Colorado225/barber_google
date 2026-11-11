import { expect, test } from '@playwright/test';
import { E2E, fetchLastAppointmentByPhone, listAppointmentNotifications, loginOwner } from './helpers';

/**
 * Parcours client complet : réservation depuis la vitrine publique,
 * file de notification, confirmation par le salon (ERP), suivi puis
 * annulation depuis le portail client (lien secret).
 */
test('réservation en ligne, notification, confirmation salon puis annulation client', async ({ page }) => {
  // --- 1. Vitrine publique du salon seedé ------------------------------------
  await test.step('vitrine publique', async () => {
    await page.goto(`/salons/${E2E.salonSlug}`);
    await expect(page.getByText(E2E.salonName).first()).toBeVisible();
  });

  // --- 2. Réservation (prestation seedée + créneau de demain) ----------------
  await test.step('réservation depuis la vitrine', async () => {
    await page
      .getByRole('button', { name: /Réserver un créneau/ })
      .first()
      .click();

    // Le formulaire de réservation affiche la prestation seedée.
    const serviceSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: E2E.serviceName }) });
    await expect(serviceSelect).toHaveCount(1);
    await serviceSelect.selectOption({ label: E2E.serviceName });

    await page.getByRole('button', { name: 'Demain' }).click();
    // Les créneaux listés sont tous disponibles (la grille ne rend que ceux-là).
    await expect(page.getByText('Aucun créneau disponible ce jour-là.')).toHaveCount(0);
    await page
      .locator('button', { hasText: /^\d{1,2}:\d{2}$/ })
      .first()
      .click();

    await page.getByPlaceholder('Nom & prénom *').fill(E2E.bookingClientName);
    await page.getByPlaceholder('Téléphone / WhatsApp *').fill(E2E.bookingClientPhone);
    await page.getByPlaceholder('E-mail (optionnel, pour le rappel)').fill(E2E.bookingClientEmail);
    await page.getByRole('button', { name: 'Confirmer la réservation' }).click();

    // Réservation créée « en attente » : le salon doit la confirmer.
    await expect(page.getByText('EN ATTENTE DE CONFIRMATION')).toBeVisible();
    await expect(page.getByText(`Merci ${E2E.bookingClientName} !`)).toBeVisible();
  });

  // --- 3. File de notifications + jeton de portail ---------------------------
  const appointment = await test.step('notification et jeton côté base', async () => {
    const row = await fetchLastAppointmentByPhone(E2E.bookingClientPhone);
    expect(row.status).toBe('pending');
    const notifications = await listAppointmentNotifications(row.id);
    expect(
      notifications.some((n) => n.kind === 'booking_received'),
      'la réservation doit enqueue une notification booking_received',
    ).toBe(true);
    expect(row.public_cancel_token).toBeTruthy();
    return row;
  });

  // --- 4. Portail client : suivi « en attente » -------------------------------
  await test.step('portail client — en attente', async () => {
    await page.goto(`/reservation#${appointment.public_cancel_token}`);
    await expect(page.getByText('En attente de confirmation').first()).toBeVisible();
  });

  // --- 5. Salon (ERP) : confirmation de la demande en ligne -------------------
  await test.step('ERP — confirmation de la demande', async () => {
    await loginOwner(page);
    await page.goto('/app/demandes-en-ligne');
    await expect(page.getByText(/Réservations reçues depuis la marketplace/)).toBeVisible();
    await expect(page.getByText('À CONFIRMER')).toBeVisible();

    await page
      .locator('li', { hasText: E2E.bookingClientName })
      .getByRole('button', { name: 'Confirmer', exact: true })
      .click();

    // La demande quitte la liste « À confirmer ».
    await expect(page.getByText('À CONFIRMER')).toHaveCount(0);
    const row = await fetchLastAppointmentByPhone(E2E.bookingClientPhone);
    expect(row.status).toBe('confirmed');
    const notifications = await listAppointmentNotifications(row.id);
    expect(notifications.some((n) => n.kind === 'booking_confirmed')).toBe(true);
  });

  // --- 6. Portail client : confirmation visible puis annulation ---------------
  await test.step('portail client — confirmation puis annulation', async () => {
    await page.goto(`/reservation#${appointment.public_cancel_token}`);
    await expect(page.getByText('Confirmée').first()).toBeVisible();

    await page.getByRole('button', { name: 'Annuler ma réservation' }).click();
    await expect(page.getByText('Annulée').first()).toBeVisible();
    await expect(page.getByText('Cette réservation n’est plus active.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Annuler ma réservation' })).toHaveCount(0);

    const row = await fetchLastAppointmentByPhone(E2E.bookingClientPhone);
    expect(row.status).toBe('cancelled');
    const notifications = await listAppointmentNotifications(row.id);
    expect(notifications.some((n) => n.kind === 'booking_cancelled')).toBe(true);
  });
});
