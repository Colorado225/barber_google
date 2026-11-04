# Matrice des rôles et permissions (source de vérité serveur)

Générée le 2026-11-04 (Lot 2) depuis la définition **effective** de
`private.has_salon_permission` — dernière version :
`supabase/migrations/20261104100300_finance_permissions_fix.sql`.
Le miroir frontend `src/lib/permissions.ts` (affichage uniquement ; la
décision réelle est toujours serveur) est vérifié par le test de parité
d'exécution `tests/permissions-parity.test.tsx` : toute divergence
front/serveur fait échouer la CI.

Conditions préalables côté serveur : membership du salon avec
`status='active'` pour `auth.uid()` ; rôle ∈ {owner, manager,
receptionist, barber, cashier, accountant} (`memberships.role`).
Toute permission absente de la fonction retourne `false`.

| Permission              | Owner | Manager | Receptionist | Barber | Cashier | Accountant | Notes                                          |
| ----------------------- | ----- | ------- | ------------ | ------ | ------- | ---------- | ---------------------------------------------- |
| `appointments.read`     | ✅    | ✅      | ✅           | ✅     | ✅      | —          |                                                |
| `appointments.write`    | ✅    | ✅      | ✅           | —      | —       | —          |                                                |
| `branch.create`         | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `branch.update`         | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `cash.close`            | ✅    | ✅      | —            | —      | ✅      | —          |                                                |
| `cash.open`             | ✅    | ✅      | —            | —      | ✅      | —          |                                                |
| `cash.read`             | ✅    | ✅      | —            | —      | ✅      | ✅         |                                                |
| `cash.reconcile`        | ✅    | —       | —            | —      | —       | —          |                                                |
| `cashier.read`          | ✅    | ✅      | —            | —      | ✅      | ✅         | Alias hérité (inutilisé par les RPC actuelles) |
| `cashier.write`         | ✅    | ✅      | —            | —      | ✅      | —          | Alias hérité (inutilisé par les RPC actuelles) |
| `catalog.write`         | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `clients.read`          | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `clients.write`         | ✅    | ✅      | ✅           | —      | —       | —          |                                                |
| `dashboard.read`        | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `expenses.manage`       | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `expenses.read`         | ✅    | ✅      | —            | —      | —       | ✅         |                                                |
| `loyalty.read`          | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `loyalty.write`         | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `members.manage`        | ✅    | —       | —            | —      | —       | —          |                                                |
| `members.read`          | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `payments.correct`      | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `payments.create`       | ✅    | ✅      | —            | —      | ✅      | —          | Alias hérité (inutilisé par les RPC actuelles) |
| `payments.read`         | ✅    | ✅      | —            | —      | ✅      | ✅         |                                                |
| `payments.record`       | ✅    | ✅      | —            | —      | ✅      | —          |                                                |
| `payments.refund.read`  | ✅    | ✅      | —            | —      | —       | —          | Alias hérité (inutilisé par les RPC actuelles) |
| `payments.refund.write` | ✅    | ✅      | —            | —      | —       | —          | Alias hérité (inutilisé par les RPC actuelles) |
| `payments.write`        | ✅    | ✅      | —            | —      | ✅      | —          | Alias hérité (inutilisé par les RPC actuelles) |
| `reports.read`          | ✅    | ✅      | —            | —      | —       | ✅         |                                                |
| `reviews.moderate`      | ✅    | ✅      | —            | —      | —       | —          | Serveur uniquement (modération des avis)       |
| `reviews.read`          | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `salon.read`            | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `salon.update`          | ✅    | —       | —            | —      | —       | —          |                                                |
| `services.read`         | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `staff.read`            | ✅    | ✅      | ✅           | ✅     | ✅      | ✅         |                                                |
| `stock.read`            | ✅    | ✅      | ✅           | ✅     | ✅      | —          |                                                |
| `stock.write`           | ✅    | ✅      | —            | —      | —       | —          |                                                |
| `subscriptions.read`    | ✅    | —       | —            | —      | —       | —          |                                                |
| `team.write`            | ✅    | ✅      | —            | —      | —       | —          |                                                |

## Divergences corrigées au Lot 2 (miroir frontend)

| Permission                                                                          | Avant (frontend)                              | Serveur (vérité)               | Correction                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `payments.read` (receptionist)                                                      | accordée à l'affichage                        | refusée                        | retirée du miroir (le réceptionniste ne voit plus la caisse qu'il ne pouvait pas utiliser) |
| `display.update`                                                                    | présente (owner/manager), utilisée nulle part | inexistante (toujours `false`) | retirée du miroir                                                                          |
| `reviews.moderate`, alias `payments.write/create`, `payments.refund.*`, `cashier.*` | absents du miroir                             | présents côté serveur          | documentés ci-dessus ; le test de parité échoue si un nouvel écart non documenté apparaît  |

## Notes métier

- Les permissions « lecture membre » (`dashboard.read`, `services.read`,
  `staff.read`, `clients.read`, `loyalty.read`, `reviews.read`,
  `salon.read`) valent pour **tout membre actif**, quel que soit son rôle.
- La finance suit le principe du moindre privilège : enregistrement
  (owner/manager/cashier), correction (owner/manager), rapprochement de
  caisse et gestion des membres/abonnement (owner uniquement).
- Aucun rôle « administrateur de plateforme » n'existe à ce jour
  (Lot 8, hors feuille de route).
