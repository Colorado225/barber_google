import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const source = (relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');

test('les navigations ERP et administration ont un drawer mobile qui réutilise leurs flux existants', () => {
  const erp = source('src/components/erp/ErpLayout.tsx');
  const admin = source('src/components/admin/AdminDashboard.tsx');

  assert.match(erp, /isMobileNavigationOpen/);
  assert.match(erp, /const handleSelectTab = \(nextTab: ErpTab\)/);
  assert.match(erp, /onClick=\{\(\) => handleSelectTab\(item\.id\)\}/);
  assert.match(erp, /md:sticky md:top-0 md:self-start md:z-auto md:flex md:h-dvh md:w-72/);
  assert.match(erp, /Ouvrir la navigation ERP/);
  assert.match(erp, /setIsMobileNavigationOpen\(false\);\s*setMode\('marketplace'\)/);

  assert.match(admin, /isMobileNavigationOpen/);
  assert.match(admin, /const selectAdminTab = \(nextTab: AdminDashboardTab\)/);
  assert.match(admin, /onClick=\{\(\) => selectAdminTab\(item\.id\)\}/);
  assert.match(admin, /md:sticky md:top-\[4\.25rem\] md:self-start md:z-auto md:flex/);
  assert.match(admin, /Actions rapides/);
  assert.match(admin, /Ouvrir la navigation administration/);

  const adminHeader = admin.match(/<header className="([^"]+)"/);
  assert.ok(adminHeader, 'Le header d’administration doit être présent');
  assert.doesNotMatch(adminHeader[1], /sticky|top-0/, 'Le header admin ne doit pas doubler la navbar sticky');
});

test('le layout desktop garde une sidebar sticky, catégorisée et reliée aux permissions existantes', () => {
  const erp = source('src/components/erp/ErpLayout.tsx');
  const admin = source('src/components/admin/AdminDashboard.tsx');

  assert.match(erp, /const ERP_NAVIGATION_GROUPS/);
  assert.match(erp, /label: 'Pilotage'/);
  assert.match(erp, /label: 'Opérations'/);
  assert.match(erp, /const groupedVisibleNavItems = ERP_NAVIGATION_GROUPS/);
  assert.match(erp, /navItems\.filter\(\(i\) => !i\.permission \|\| canSee\(i\.permission\)\)/);
  assert.match(erp, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(erp, /md:sticky md:top-0 md:self-start md:z-auto md:flex md:h-dvh md:w-72/);
  assert.match(erp, /data-testid="erp-salon-switcher"/);

  assert.match(admin, /const ADMIN_NAVIGATION_GROUPS/);
  assert.match(admin, /label: 'Supervision'/);
  assert.match(admin, /label: 'Marketplace'/);
  assert.match(admin, /const groupedAdminNavItems = ADMIN_NAVIGATION_GROUPS/);
  assert.match(admin, /md:sticky md:top-\[4\.25rem\] md:self-start md:z-auto md:flex/);
  assert.match(admin, /md:h-\[calc\(100dvh-4\.25rem\)\] md:w-72/);
});

test('les tableaux P0 disposent tous d’un conteneur horizontal accessible sur écran étroit', () => {
  const expectedTables = [
    ['src/components/erp/ClientsView.tsx', 'Liste des clients, défilement horizontal'],
    ['src/components/erp/ServicesView.tsx', 'Liste des prestations, défilement horizontal'],
    ['src/components/erp/StaffView.tsx', 'Liste de l’équipe, défilement horizontal'],
    ['src/components/erp/DataTableCard.tsx', 'défilement horizontal'],
    ['src/components/admin/AdminNotificationsPanel.tsx', 'Santé des notifications, défilement horizontal'],
    ['src/components/admin/AdminOverviewPanel.tsx', 'Extrait du journal d’audit, défilement horizontal'],
  ];

  for (const [file, label] of expectedTables) {
    const content = source(file);
    assert.match(content, /className="overflow-x-auto"/, `${file} doit permettre le défilement horizontal`);
    assert.ok(content.includes(label), `${file} doit nommer la région défilable`);
    assert.match(
      content,
      /<table className="w-full min-w-/,
      `${file} doit conserver une largeur de table lisible`,
    );
  }
});

test('les contrôles tactiles et le toast P1 conservent une zone d’action mobile sûre', () => {
  const switchSource = source('src/components/ui/switch.tsx');
  const toastSource = source('src/components/common/ToastContainer.tsx');

  assert.match(switchSource, /<label[\s\S]+h-11 w-11/);
  assert.match(switchSource, /peer-checked:bg-\[#C9A45C\]/);
  assert.match(switchSource, /role="switch"/);
  assert.match(toastSource, /inset-x-3 bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(toastSource, /sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-full/);
  assert.match(toastSource, /aria-label="Fermer la notification"/);
});

test('les modales métier longues P0 restent défilables dans un viewport mobile court', () => {
  const expectedPanels = [
    ['src/components/erp/CashRegisterView.tsx', 1],
    ['src/components/erp/FinanceExpensesView.tsx', 3],
    ['src/components/erp/InventoryView.tsx', 4],
  ];

  for (const [file, expectedCount] of expectedPanels) {
    const content = source(file);
    const panels = content.match(/max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/g) ?? [];
    const overlays = content.match(/fixed inset-0 z-50[^"]+overflow-y-auto/g) ?? [];
    assert.equal(panels.length, expectedCount, `${file} doit contraindre chaque panneau modal`);
    assert.equal(overlays.length, expectedCount, `${file} doit laisser défiler chaque overlay modal`);
  }

  const admin = source('src/components/admin/AdminDashboard.tsx');
  assert.match(admin, /fixed inset-0 z-50[^"]+overflow-y-auto/);
  assert.match(admin, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
});
