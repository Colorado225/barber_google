import { expect, test } from '@playwright/test';
import { E2E } from './helpers';

/**
 * Avis vérifié : le rendez-vous seedé est « completed » + payé, donc le
 * portail (jeton public fixe) propose le formulaire d'avis. L'avis publié,
 * marqué vérifié côté serveur, apparaît ensuite sur la vitrine publique.
 */
test('avis vérifié depuis le portail puis visible sur la vitrine', async ({ page }) => {
  // --- 1. Portail : formulaire d'avis proposé pour la prestation terminée ----
  await page.goto(`/reservation#${E2E.reviewToken}`);
  await expect(page.getByText('Prestation terminée').first()).toBeVisible();
  await expect(page.getByText('Votre prestation est terminée : donnez votre avis')).toBeVisible();
  await expect(page.getByText(/Votre avis sera marqué « vérifié »/)).toBeVisible();

  // --- 2. Note + commentaire obligatoires ------------------------------------
  const submit = page.getByRole('button', { name: 'Publier mon avis vérifié' });
  await expect(submit).toBeDisabled(); // commentaire trop court → envoi bloqué

  await page.getByRole('radio', { name: '5 étoiles' }).click();
  await page.getByPlaceholder('Décrivez votre expérience').fill(E2E.reviewComment);
  await expect(submit).toBeEnabled();
  await submit.click();

  // --- 3. L'avis est publié et marqué « vérifié » sur le portail -------------
  await expect(page.getByText('Votre avis', { exact: true })).toBeVisible();
  await expect(page.getByText('VÉRIFIÉ')).toBeVisible();
  await expect(page.getByText(E2E.reviewComment)).toBeVisible();

  // --- 4. La vitrine publique affiche l'avis vérifié -------------------------
  await page.goto(`/salons/${E2E.salonSlug}`);
  await expect(page.getByText(E2E.reviewComment)).toBeVisible();
});
