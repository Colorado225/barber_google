import { expect, test } from '@playwright/test';
import { E2E, loginOwner, supabaseAdmin } from './helpers';

/**
 * Parcours caisse : un paiement Wave seedé « en attente de vérification »
 * est confirmé manuellement (référence + note de preuve), puis remboursé
 * via une écriture de correction. Le journal de caisse reflète chaque étape.
 */
test('paiement en attente, vérification manuelle puis remboursement', async ({ page }) => {
  await loginOwner(page);
  await page.goto('/app/caisse');

  // --- 1. Le paiement Wave seedé attend une vérification ---------------------
  await expect(page.getByRole('heading', { name: 'Paiements en attente de vérification' })).toBeVisible();
  await expect(page.getByText(E2E.caisseClientName).first()).toBeVisible();
  await expect(page.getByText(E2E.caissePendingRef)).toBeVisible();

  // --- 2. Vérification manuelle (référence + note de preuve ≥ 10 caractères) -
  await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Vérification manuelle' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog
    .getByPlaceholder('Ex: reçu vérifié dans le relevé Wave du 04/11')
    .fill('Reçu vérifié dans le relevé marchand Wave (E2E).');
  await confirmDialog.getByRole('button', { name: 'Confirmer le paiement' }).click();

  await expect(page.getByRole('heading', { name: 'Paiements en attente de vérification' })).toHaveCount(0);
  await expect(page.getByText('Vérifié manuellement').first()).toBeVisible();

  // --- 3. Remboursement via une écriture de correction -----------------------
  await page.getByRole('button', { name: 'Corriger' }).click();
  const correctionDialog = page.getByRole('dialog', { name: 'Correction / remboursement' });
  await expect(correctionDialog).toBeVisible();
  await correctionDialog.locator('select').selectOption({ label: 'Remboursement' });
  await correctionDialog
    .locator('input[type="text"]')
    .first()
    .fill('Client remboursé après annulation (E2E).');
  await correctionDialog.locator('textarea').fill('Remboursement wave vérifié manuellement (E2E).');
  await correctionDialog.getByRole('button', { name: 'Enregistrer la correction' }).click();

  await expect(page.getByText('Remboursement').first()).toBeVisible();

  // --- 4. Journal côté base : encaissement confirmé + remboursement confirmé -
  const { data, error } = await supabaseAdmin()
    .from('payments')
    .select('kind, status, amount, provider_reference')
    .eq('salon_id', E2E.salonId)
    .order('created_at', { ascending: true });
  expect(error).toBeNull();
  const kinds = (data ?? []).map((row) => `${row.kind}:${row.status}`);
  expect(kinds).toContain('payment:confirmed');
  expect(kinds).toContain('refund:confirmed');
});
