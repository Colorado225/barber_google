import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const source = (relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');

test('la navigation mobile ERP réutilise le modèle RBAC et les handlers existants', () => {
  const erp = source('src/components/erp/ErpLayout.tsx');
  const shell = source('src/components/erp/navigation/ResponsiveShell.tsx');
  const bottomNavigation = source('src/components/erp/navigation/MobileBottomNavigation.tsx');
  const moreMenu = source('src/components/erp/navigation/MobileMoreMenu.tsx');
  const actionBar = source('src/components/erp/navigation/MobileActionBar.tsx');
  const admin = source('src/components/admin/AdminDashboard.tsx');

  assert.match(erp, /isMobileNavigationOpen/);
  assert.match(erp, /const handleSelectTab = \(nextTab: ErpTab\)/);
  assert.match(erp, /const mobilePrimaryNavItems = MOBILE_PRIMARY_TAB_IDS/);
  assert.match(erp, /const mobileSecondaryNavGroups = groupedVisibleNavItems/);
  assert.match(erp, /mobileBottomNavigation=\{/);
  assert.match(erp, /mobileMoreMenu=\{/);
  assert.match(erp, /mobileActionBar=\{<MobileActionBar actions=\{mobileQuickActions\}/);
  assert.match(erp, /navItems\.filter\(\(i\) => !i\.permission \|\| canSee\(i\.permission\)\)/);

  assert.match(shell, /desktopSidebar/);
  assert.match(shell, /mobileHeader/);
  assert.match(shell, /mobileBottomNavigation/);
  assert.match(bottomNavigation, /dashboard: 'Accueil'/);
  assert.match(bottomNavigation, /calendar: 'Planning'/);
  assert.match(bottomNavigation, /cash: 'Caisse'/);
  assert.match(bottomNavigation, /crm: 'Clients'/);
  assert.match(bottomNavigation, /<span>Plus<\/span>/);
  assert.match(bottomNavigation, /safe-area-inset-bottom/);
  assert.match(moreMenu, /Modules secondaires/);
  assert.match(moreMenu, /groups: ErpNavigationGroup\[\]/);
  assert.match(actionBar, /Permission-aware quick actions/);

  assert.match(admin, /isMobileNavigationOpen/);
  assert.match(admin, /const selectAdminTab = \(nextTab: AdminDashboardTab\)/);
  assert.match(admin, /onClick=\{\(\) => selectAdminTab\(item\.id\)\}/);
  assert.match(admin, /md:sticky md:top-\[4\.25rem\] md:self-start md:z-auto md:flex/);
  assert.match(admin, /Actions rapides/);

  const adminHeader = admin.match(/<header className="([^"]+)"/);
  assert.ok(adminHeader, 'Le header d’administration doit être présent');
  assert.doesNotMatch(adminHeader[1], /sticky|top-0/, 'Le header admin ne doit pas doubler la navbar sticky');
});

test('le layout desktop garde une sidebar sticky, catégorisée et reliée aux permissions existantes', () => {
  const erp = source('src/components/erp/ErpLayout.tsx');
  const desktopSidebar = source('src/components/erp/navigation/DesktopSidebar.tsx');
  const salonSelector = source('src/components/erp/navigation/ErpSalonSelector.tsx');
  const admin = source('src/components/admin/AdminDashboard.tsx');

  assert.match(erp, /const ERP_NAVIGATION_GROUPS/);
  assert.match(erp, /label: 'Pilotage'/);
  assert.match(erp, /label: 'Opérations'/);
  assert.match(erp, /const groupedVisibleNavItems = ERP_NAVIGATION_GROUPS/);
  assert.match(erp, /navItems\.filter\(\(i\) => !i\.permission \|\| canSee\(i\.permission\)\)/);
  assert.match(erp, /<DesktopSidebar/);
  assert.match(desktopSidebar, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(desktopSidebar, /md:sticky md:top-0 md:self-start md:flex md:h-dvh md:w-72/);
  assert.match(salonSelector, /data-testid=\{testId\}/);

  assert.match(admin, /const ADMIN_NAVIGATION_GROUPS/);
  assert.match(admin, /label: 'Supervision'/);
  assert.match(admin, /label: 'Marketplace'/);
  assert.match(admin, /const groupedAdminNavItems = ADMIN_NAVIGATION_GROUPS/);
  assert.match(admin, /md:sticky md:top-\[4\.25rem\] md:self-start md:z-auto md:flex/);
  assert.match(admin, /md:h-\[calc\(100dvh-4\.25rem\)\] md:w-72/);
});

test('le tableau de bord ERP priorise les KPI, actions et graphiques tactiles sur mobile', () => {
  const dashboard = source('src/components/erp/DashboardView.tsx');

  assert.match(dashboard, /grid grid-cols-1 gap-3 min-\[420px\]:grid-cols-2/);
  assert.match(dashboard, /hidden flex-wrap items-center justify-between[\s\S]+md:flex/);
  assert.match(dashboard, /grid w-full shrink-0 grid-cols-2[\s\S]+min-\[420px\]:grid-cols-4/);
  assert.match(dashboard, /const \[selectedRevenueIndex, setSelectedRevenueIndex\]/);
  assert.match(dashboard, /data-testid="dashboard-revenue-point-detail"/);
  assert.match(dashboard, /aria-label=\{`\$\{item\.label\} : \$\{accessibleValue\}`\}/);
  assert.match(dashboard, /min-h-11 w-full rounded-xl/);
  assert.match(dashboard, /updateAppointmentStatus\(apt\.id, e\.target\.value as AppointmentStatus\)/);
  assert.match(dashboard, /formatPrice\(totalRevenue\)/);
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

test('le planning actif rend une chronologie tactile sans changer les mutations de rendez-vous', () => {
  const planning = source('src/components/erp/PlanningView.tsx');
  const formModal = source('src/components/erp/FormModal.tsx');

  assert.match(planning, /data-testid="planning-mobile-list"/);
  assert.match(planning, /Liste chronologique des rendez-vous/);
  assert.match(planning, /className="space-y-4 p-3 md:hidden"/);
  assert.match(planning, /className="hidden overflow-x-auto md:block"/);
  assert.match(planning, /min-h-11 min-w-11/);
  assert.match(planning, /grid grid-cols-1 gap-3 min-\[480px\]:grid-cols-2/);
  assert.match(planning, /const handleAdvance = \(apt: Appointment\)/);
  assert.match(planning, /void startWalkIn\(apt.id, apt.staffId\)/);
  assert.match(planning, /void completeWalkIn\(apt.id\)/);
  assert.match(planning, /updateAppointmentStatus\(apt.id, next\)/);
  assert.match(planning, /const result = await bookAppointment\(/);
  assert.match(planning, /updateAppointment\(editing.id,/);
  assert.match(planning, /deleteAppointment\(appointment.id\)/);

  assert.match(formModal, /items-end justify-center overflow-y-auto/);
  assert.match(formModal, /max-h-\[calc\(100dvh-0\.75rem\)\]/);
  assert.match(formModal, /min-h-11 w-full/);
  assert.match(formModal, /min-h-11 rounded-xl bg-\[#C9A45C\]/);
});

test('le CRM privilégie des fiches tactiles sans contourner le domaine clients ou la fidélité', () => {
  const clients = source('src/components/erp/ClientsView.tsx');
  const clientsDomain = source('src/context/domains/ClientsDomainContext.tsx');
  const loyalty = source('src/components/erp/LoyaltyView.tsx');

  assert.match(clients, /data-testid="clients-mobile-list"/);
  assert.match(clients, /aria-label="Liste des clients"/);
  assert.match(clients, /className="space-y-3 p-3 md:hidden"/);
  assert.match(clients, /className="hidden md:block"/);
  assert.match(clients, /aria-label="Liste des clients, défilement horizontal"/);
  assert.match(clients, /min-h-11 min-w-11/);
  assert.match(clients, /min-h-11 border-\[#5e2020\] px-3/);
  assert.match(clients, /grid grid-cols-1 gap-3 min-\[480px\]:grid-cols-2/);

  assert.match(clients, /clients\.filter\(\(c\) => c\.salonId === activeSalon\.id\)/);
  assert.match(clients, /addClient\(\{/);
  assert.match(clients, /updateClient\(editing\.id,/);
  assert.match(clients, /deleteClient\(client\.id\)/);
  assert.doesNotMatch(clients, /loyalty(?:Accounts|Ledger|Transactions|Rewards|Settings)/);

  assert.match(clientsDomain, /api\.clients\.create\(/);
  assert.match(clientsDomain, /api\.clients\.update\(/);
  assert.match(clientsDomain, /api\.clients\.remove\(/);
  assert.match(clientsDomain, /domainCache\.invalidate\(salonId, 'workspace'\)/);
  assert.match(loyalty, /hasPermission\('loyalty\.write'/);
});

test('les prestations et l’équipe privilégient des fiches tactiles sans contourner le domaine rendez-vous', () => {
  const erp = source('src/components/erp/ErpLayout.tsx');
  const services = source('src/components/erp/ServicesView.tsx');
  const staff = source('src/components/erp/StaffView.tsx');
  const schedules = source('src/components/erp/StaffSchedulePanel.tsx');
  const appointmentsDomain = source('src/context/domains/AppointmentsDomainContext.tsx');

  assert.match(erp, /id: 'services'[\s\S]+permission: 'services\.read'/);
  assert.match(erp, /id: 'staff'[\s\S]+permission: 'staff\.read'/);
  assert.match(erp, /visibleActiveTab === 'services' && <ServicesView \/>/);
  assert.match(erp, /visibleActiveTab === 'staff' && <StaffView \/>/);

  assert.match(services, /data-testid="services-mobile-list"/);
  assert.match(services, /className="space-y-3 p-3 md:hidden"/);
  assert.match(services, /className="hidden md:block"/);
  assert.match(services, /min-h-11 min-w-11/);
  assert.match(services, /grid grid-cols-1 gap-3 min-\[480px\]:grid-cols-2/);
  assert.match(services, /services\.filter\(\(s\) => s\.salonId === activeSalon\.id\)/);
  assert.match(services, /addService\(payload\)/);
  assert.match(services, /updateService\(editing\.id, payload\)/);
  assert.match(services, /deleteService\(srv\.id\)/);
  assert.match(services, /setServiceActive\(srv\.id, !isActive\)/);

  assert.match(staff, /data-testid="staff-mobile-list"/);
  assert.match(staff, /className="space-y-3 p-3 md:hidden"/);
  assert.match(staff, /className="hidden md:block"/);
  assert.match(staff, /min-h-11 min-w-11/);
  assert.match(staff, /grid grid-cols-1 gap-3 min-\[480px\]:grid-cols-2/);
  assert.match(staff, /staff\.filter\(\(m\) => m\.salonId === activeSalon\.id\)/);
  assert.match(staff, /addStaff\(payload\)/);
  assert.match(staff, /updateStaff\(editing\.id, payload\)/);
  assert.match(staff, /deleteStaff\(member\.id\)/);
  assert.match(staff, /setScheduleFor\(member\)/);

  assert.match(schedules, /items-end justify-center overflow-y-auto/);
  assert.match(schedules, /max-h-\[calc\(100dvh-0\.75rem\)\]/);
  assert.match(schedules, /safe-area-inset-bottom/);
  assert.match(schedules, /grid grid-cols-1 gap-2 pt-1 min-\[480px\]:grid-cols-2/);
  assert.match(schedules, /const api = salonApi\(activeSalon\.id\)/);
  assert.match(schedules, /api\.staff\.schedule\(member\.id\)/);
  assert.match(schedules, /api\.staff\.addSchedule\(member\.id,/);
  assert.match(schedules, /api\.staff\.addAbsence\(member\.id,/);

  assert.match(appointmentsDomain, /api\.services\.create\(/);
  assert.match(appointmentsDomain, /api\.services\.update\(/);
  assert.match(appointmentsDomain, /api\.services\.remove\(/);
  assert.match(appointmentsDomain, /api\.staff\.create\(/);
  assert.match(appointmentsDomain, /api\.staff\.update\(/);
  assert.match(appointmentsDomain, /api\.staff\.remove\(/);
  assert.match(appointmentsDomain, /domainCache\.invalidate\(salonId, 'workspace'\)/);
});

test('la caisse et l’encaissement restent tactiles sans contourner le domaine finance', () => {
  const cash = source('src/components/erp/CashRegisterView.tsx');
  const payment = source('src/components/erp/NewPaymentModal.tsx');

  assert.match(cash, /const canOpen = hasPermission\('cash.open', activeSalon.id\)/);
  assert.match(cash, /const canClose = hasPermission\('cash.close', activeSalon.id\)/);
  assert.match(cash, /const canReconcile = hasPermission\('cash.reconcile', activeSalon.id\)/);
  assert.match(cash, /const canCorrect = hasPermission\('payments.correct', activeSalon.id\)/);
  assert.match(cash, /await openNewCashSession\(/);
  assert.match(cash, /await closeCurrentCashSession\(/);
  assert.match(cash, /await reconcileCashSession\(/);
  assert.match(cash, /await confirmPendingPayment\(/);
  assert.match(cash, /await rejectPendingPayment\(/);
  assert.match(cash, /await recordPaymentCorrection\(/);
  assert.match(cash, /items-end justify-center overflow-y-auto/);
  assert.match(cash, /max-h-\[calc\(100dvh-0\.75rem\)\]/);
  assert.match(cash, /safe-area-inset-bottom/);
  assert.match(cash, /min-h-11 flex-1 items-center justify-center/);

  assert.match(payment, /aria-label="Nouvel encaissement"/);
  assert.match(payment, /max-h-\[calc\(100dvh-0\.75rem\)\]/);
  assert.match(payment, /safe-area-inset-bottom/);
  assert.match(payment, /grid grid-cols-1 gap-2 min-\[380px\]:grid-cols-2/);
  assert.match(payment, /aria-pressed=\{method === m\.id\}/);
  assert.match(payment, /const tx = await recordPayment\(/);
  assert.match(payment, /min-h-11 w-full/);
});

test('les modales métier longues P0 restent défilables dans un viewport mobile court', () => {
  const expectedPanels = [
    [
      'src/components/erp/CashRegisterView.tsx',
      1,
      /max-h-\[calc\(100dvh-0\.75rem\)\][\s\S]+overflow-y-auto/g,
    ],
    ['src/components/erp/FinanceExpensesView.tsx', 3, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/g],
    ['src/components/erp/InventoryView.tsx', 4, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/g],
  ];

  for (const [file, expectedCount, panelPattern] of expectedPanels) {
    const content = source(file);
    const panels = content.match(panelPattern) ?? [];
    const overlays = content.match(/fixed inset-0 z-50[^"]+overflow-y-auto/g) ?? [];
    assert.equal(panels.length, expectedCount, `${file} doit contraindre chaque panneau modal`);
    assert.equal(overlays.length, expectedCount, `${file} doit laisser défiler chaque overlay modal`);
  }

  const admin = source('src/components/admin/AdminDashboard.tsx');
  assert.match(admin, /fixed inset-0 z-50[^"]+overflow-y-auto/);
  assert.match(admin, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
});
