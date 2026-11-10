import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useOptionalApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import {
  buildErpUrl,
  formatErpRoleLabel,
  getActiveMemberships,
  readErpSalonFromSearch,
} from '../../lib/erpSalonSelection';
import { isRepeatedNotificationFailure } from '../../lib/notifications';
import { DEFAULT_BUSINESS_TIMEZONE } from '../../lib/businessTime';
import { parsePlanSelectionFromSearch, savePlanSelectionIntent } from '../../lib/saasPricing';
import { Appointment } from '../../types';
import { SectionLoadingFallback, lazyNamed } from '../common/ViewLoader';

const DashboardView = lazyNamed(() => import('./DashboardView'), 'DashboardView');
const CashRegisterView = lazyNamed(() => import('./CashRegisterView'), 'CashRegisterView');
const ServicesView = lazyNamed(() => import('./ServicesView'), 'ServicesView');
const StaffView = lazyNamed(() => import('./StaffView'), 'StaffView');
const FinanceExpensesView = lazyNamed(() => import('./FinanceExpensesView'), 'FinanceExpensesView');
const InventoryView = lazyNamed(() => import('./InventoryView'), 'InventoryView');
const SalonProfileSettingsView = lazyNamed(
  () => import('./SalonProfileSettingsView'),
  'SalonProfileSettingsView',
);
const MarketplaceShowcaseView = lazyNamed(
  () => import('./MarketplaceShowcaseView'),
  'MarketplaceShowcaseView',
);
const SaaSPlanView = lazyNamed(() => import('./SaaSPlanView'), 'SaaSPlanView');
const SalonQrCodeView = lazyNamed(() => import('./SalonQrCodeView'), 'SalonQrCodeView');
const ReportsView = lazyNamed(() => import('./ReportsView'), 'ReportsView');
const ClientsView = lazyNamed(() => import('./ClientsView'), 'ClientsView');
const PlanningView = lazyNamed(() => import('./PlanningView'), 'PlanningView');
const LoyaltyView = lazyNamed(() => import('./LoyaltyView'), 'LoyaltyView');
const NewAppointmentModal = lazyNamed(() => import('./NewAppointmentModal'), 'NewAppointmentModal');
const NewPaymentModal = lazyNamed(() => import('./NewPaymentModal'), 'NewPaymentModal');
const WalkInModal = lazyNamed(() => import('./WalkInModal'), 'WalkInModal');
const WalkInView = lazyNamed(() => import('./WalkInView'), 'WalkInView');
const OnlineRequestsView = lazyNamed(() => import('./OnlineRequestsView'), 'OnlineRequestsView');
const NotificationsView = lazyNamed(() => import('./NotificationsView'), 'NotificationsView');
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Users,
  Scissors,
  UserCheck,
  TrendingDown,
  Package,
  Store,
  Sparkles,
  ChevronDown,
  ArrowLeft,
  Globe,
  QrCode,
  BarChart3,
  Heart,
  UserPlus,
  Inbox,
  Send,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ErpTab =
  | 'dashboard'
  | 'walk_in'
  | 'online_requests'
  | 'notifications'
  | 'calendar'
  | 'cash'
  | 'crm'
  | 'services'
  | 'staff'
  | 'expenses'
  | 'inventory'
  | 'marketplace_showcase'
  | 'reports'
  | 'loyalty'
  | 'qr_code'
  | 'storefront'
  | 'saas';

/** URL segment for each ERP tab, so views stay shareable and reloadable. */
const TAB_PATHS: Record<ErpTab, string> = {
  dashboard: 'tableau-de-bord',
  walk_in: 'sans-rendez-vous',
  online_requests: 'demandes-en-ligne',
  notifications: 'notifications',
  calendar: 'planning',
  cash: 'caisse',
  crm: 'clients',
  services: 'prestations',
  staff: 'equipe',
  expenses: 'depenses',
  inventory: 'stocks',
  marketplace_showcase: 'vitrine',
  reports: 'rapports',
  loyalty: 'fidelite',
  qr_code: 'qr-code',
  storefront: 'parametres',
  saas: 'abonnement',
};

function readTabFromPathname(pathname?: string): ErpTab {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const segment = path.split('/app/')[1]?.split('/')[0]?.trim();
  if (segment === 'marketplace-personnalisation') return 'marketplace_showcase';
  const match = (Object.entries(TAB_PATHS) as [ErpTab, string][]).find(([, p]) => p === segment);
  return match ? match[0] : 'dashboard';
}

export const ErpLayout: React.FC = () => {
  const {
    activeSalon,
    salons,
    setActiveSalonId,
    cashSession,
    formatPrice,
    setMode,
    isSyncing,
    syncError,
    realtimeStatus,
    lastSyncedAt,
    salonTimezone = DEFAULT_BUSINESS_TIMEZONE,
    workspaceLoadedSalonId,
    reloadWorkspace,
    syncNow,
    appointments,
    notifications,
    notificationHealth,
  } = useOptionalApp();
  const { memberships, activeMembership, selectSalon, hasPermission } = useOptionalAuth();

  const activeMemberships = getActiveMemberships(memberships);
  const expectedMembership = activeMembership ?? activeMemberships[0] ?? null;
  const expectedSalonId = expectedMembership?.salonId ?? null;

  const [activeTab, setActiveTab] = useState<ErpTab>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return readTabFromPathname(window.location.pathname);
  });
  const [salonDropdownOpen, setSalonDropdownOpen] = useState(false);

  // Quick modals
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [newAppointmentSlot, setNewAppointmentSlot] = useState<{
    date?: string;
    time?: string;
    staffId?: string;
  }>({});
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [preselectedAppointment, setPreselectedAppointment] = useState<Appointment | null>(null);

  const canSeeForSalon = (permission: string, salonId: string | null) =>
    Boolean(salonId && activeMemberships.length > 0 && hasPermission(permission, salonId));
  const canSee = (permission: string) => canSeeForSalon(permission, expectedSalonId);

  const navItems: { id: ErpTab; label: string; icon: LucideIcon; permission?: string }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'dashboard.read' },
    { id: 'walk_in', label: 'Sans rendez-vous', icon: UserPlus, permission: 'appointments.read' },
    { id: 'online_requests', label: 'Demandes en ligne', icon: Inbox, permission: 'appointments.read' },
    { id: 'calendar', label: 'Planning & RDV', icon: Calendar, permission: 'appointments.read' },
    { id: 'notifications', label: 'Notifications clients', icon: Send, permission: 'appointments.read' },
    { id: 'cash', label: 'Caisse & Encaissements', icon: CreditCard, permission: 'payments.read' },
    { id: 'crm', label: 'CRM Clients', icon: Users, permission: 'clients.read' },
    { id: 'services', label: 'Prestations & Tarifs', icon: Scissors, permission: 'services.read' },
    { id: 'staff', label: 'Équipe & Commissions', icon: UserCheck, permission: 'staff.read' },
    { id: 'loyalty', label: 'Fidélité', icon: Heart, permission: 'loyalty.read' },
    { id: 'expenses', label: 'Dépenses & Bilan', icon: TrendingDown, permission: 'expenses.read' },
    { id: 'inventory', label: 'Stocks & Produits', icon: Package, permission: 'stock.read' },
    {
      id: 'marketplace_showcase',
      label: 'Vitrine & Personnalisation',
      icon: Globe,
      permission: 'salon.read',
    },
    { id: 'reports', label: 'Rapports', icon: BarChart3, permission: 'reports.read' },
    { id: 'qr_code', label: 'QR Code Réservation', icon: QrCode, permission: 'salon.read' },
    { id: 'storefront', label: 'Personnalisation Salon', icon: Store, permission: 'salon.update' },
    { id: 'saas', label: 'Abonnement SaaS', icon: Sparkles, permission: 'subscriptions.read' },
  ];

  // Compteurs d'action : demandes à confirmer et messages à traiter.
  const pendingOnline = appointments.filter(
    (a) => a.salonId === activeSalon?.id && a.source === 'marketplace' && a.status === 'pending',
  ).length;
  const pendingNotifications = notifications.filter(
    (n) =>
      n.salonId === activeSalon?.id &&
      (n.status === 'pending' || n.status === 'failed' || n.status === 'skipped'),
  ).length;
  const repeatedNotificationFailures = Math.max(
    notificationHealth?.repeatedFailures ?? 0,
    notifications.filter((n) => n.salonId === activeSalon?.id && isRepeatedNotificationFailure(n)).length,
  );
  const failedNotificationsBurst =
    notifications.filter((n) => n.salonId === activeSalon?.id && n.status === 'failed').length >= 3;
  const hasCriticalNotificationAlert = repeatedNotificationFailures > 0 || failedNotificationsBurst;
  const navBadge = (id: ErpTab): number =>
    id === 'online_requests' ? pendingOnline : id === 'notifications' ? pendingNotifications : 0;

  // Sans session serveur (démonstration locale), tous les onglets restent visibles.
  const visibleNavItems = activeMemberships.length
    ? navItems.filter((i) => !i.permission || canSee(i.permission))
    : navItems;
  const visibleActiveTab = visibleNavItems.some((item) => item.id === activeTab)
    ? activeTab
    : (visibleNavItems[0]?.id ?? 'dashboard');

  const initialUrlSalonRef = useRef<string | null>(
    typeof window !== 'undefined' ? readErpSalonFromSearch(window.location.search) : null,
  );

  // Applique le paramètre ?salon= d'arrivée (lien direct) s'il correspond à une adhésion active.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const planIntent = parsePlanSelectionFromSearch(window.location.search);
      if (planIntent) {
        savePlanSelectionIntent(planIntent);
      }
    }
    const requested = initialUrlSalonRef.current;
    if (!requested || activeMemberships.length === 0) return;
    initialUrlSalonRef.current = null;
    if (requested !== expectedSalonId && activeMemberships.some((m) => m.salonId === requested)) {
      selectSalon(requested);
      setActiveSalonId(requested);
    }
  }, [activeMemberships, expectedSalonId, selectSalon, setActiveSalonId]);

  // Garde l'URL cohérente avec l'onglet autorisé et le salon actif sélectionné.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingDeepLink = initialUrlSalonRef.current;
    if (pendingDeepLink && activeMemberships.some((m) => m.salonId === pendingDeepLink)) {
      return;
    }
    if (visibleActiveTab !== activeTab) {
      setActiveTab(visibleActiveTab);
    }
    const nextUrl = buildErpUrl(TAB_PATHS[visibleActiveTab], expectedSalonId, activeMemberships.length > 0);
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [activeTab, visibleActiveTab, expectedSalonId, activeMemberships]);

  // Synchronise les navigations Précédent / Suivant du navigateur (onglet + ?salon=).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setActiveTab(readTabFromPathname(window.location.pathname));
      const urlSalonId = readErpSalonFromSearch(window.location.search);
      if (urlSalonId && activeMemberships.some((m) => m.salonId === urlSalonId)) {
        selectSalon(urlSalonId);
        setActiveSalonId(urlSalonId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeMemberships, selectSalon, setActiveSalonId]);

  const handleSelectSalon = (nextSalonId: string) => {
    setSalonDropdownOpen(false);
    setIsWalkInOpen(false);
    setIsNewAppointmentOpen(false);
    setIsNewPaymentOpen(false);
    setPreselectedAppointment(null);
    setNewAppointmentSlot({});

    if (activeMemberships.length > 0) {
      const accepted = selectSalon(nextSalonId);
      if (!accepted) return;
    }
    setActiveSalonId(nextSalonId);

    const targetNavItems = activeMemberships.length
      ? navItems.filter((i) => !i.permission || canSeeForSalon(i.permission, nextSalonId))
      : navItems;
    const nextTab = targetNavItems.some((item) => item.id === activeTab)
      ? activeTab
      : (targetNavItems[0]?.id ?? 'dashboard');
    setActiveTab(nextTab);

    if (typeof window !== 'undefined') {
      const nextUrl = buildErpUrl(TAB_PATHS[nextTab], nextSalonId, activeMemberships.length > 0);
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
    }
  };

  if (
    activeMemberships.length > 0 &&
    expectedSalonId &&
    (activeSalon?.id !== expectedSalonId || workspaceLoadedSalonId !== expectedSalonId)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4 text-center text-stone-200">
        <div className="max-w-lg space-y-4">
          <h1 className="text-xl font-bold">
            {syncError && !isSyncing ? 'Chargement de l’espace impossible' : 'Chargement de votre espace…'}
          </h1>
          {syncError && !isSyncing && (
            <p role="alert" className="text-sm text-red-300">
              {syncError}
            </p>
          )}
          {syncError && !isSyncing && (
            <button
              type="button"
              onClick={() => void reloadWorkspace(expectedSalonId)}
              className="px-5 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold"
            >
              Réessayer
            </button>
          )}
        </div>
      </div>
    );
  }

  const syncTimeLabel = lastSyncedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: salonTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(lastSyncedAt))
    : null;

  const realtimeBadge =
    realtimeStatus === 'connected'
      ? {
          label: syncTimeLabel ? `Temps réel · ${syncTimeLabel}` : 'Temps réel',
          tone: 'border-emerald-500/30 bg-emerald-950/50 text-emerald-300',
          icon: Wifi,
        }
      : realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting'
        ? {
            label: 'Reconnexion…',
            tone: 'border-amber-500/30 bg-amber-950/50 text-amber-300',
            icon: Wifi,
          }
        : realtimeStatus === 'error'
          ? {
              label: 'Mode secours (15s)',
              tone: 'border-red-500/30 bg-red-950/50 text-red-300',
              icon: WifiOff,
            }
          : null;

  if (!activeSalon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] text-stone-200">
        Chargement de votre salon…
      </div>
    );
  }

  const switchableOptions =
    activeMemberships.length > 0
      ? activeMemberships.map((m) => ({
          salonId: m.salonId,
          salonName: m.salonName,
          roleLabel: formatErpRoleLabel(m.role),
          branchName: m.branchName,
          organizationName: m.organizationName,
        }))
      : salons.map((s) => ({
          salonId: s.id,
          salonName: s.name,
          roleLabel: '',
          branchName: null as string | null,
          organizationName: s.commune || '',
        }));

  const activeRoleLabel = expectedMembership ? formatErpRoleLabel(expectedMembership.role) : '';
  const activeSubtitle = activeRoleLabel
    ? `${activeRoleLabel}${activeSalon.commune ? ` · ${activeSalon.commune}` : expectedMembership?.organizationName ? ` · ${expectedMembership.organizationName}` : ''}`
    : activeSalon.commune || 'Établissement actif';

  return (
    <div className="min-h-screen bg-[#0d0d0e] flex flex-col md:flex-row text-stone-200">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#121214] border-r border-[#222226] flex flex-col shrink-0">
        {/* Salon Selector Header */}
        <div className="p-4 border-b border-[#222226] relative">
          {switchableOptions.length > 1 ? (
            <>
              <button
                type="button"
                data-testid="erp-salon-switcher"
                aria-haspopup="listbox"
                aria-expanded={salonDropdownOpen}
                onClick={() => setSalonDropdownOpen((open) => !open)}
                className="w-full p-2.5 rounded-xl bg-[#18181b] hover:bg-[#1f1f23] border border-[#2a2a2e] flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#201d16] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] shrink-0 font-bold text-xs">
                    {activeSalon.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate">{activeSalon.name}</div>
                    <div className="text-[10px] text-stone-400 truncate">{activeSubtitle}</div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              </button>

              {salonDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Changer d’établissement"
                  className="absolute left-4 right-4 top-18 bg-[#18181b] border border-[#2d2d33] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setSalonDropdownOpen(false)}
                >
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-stone-500">
                    Vos Établissements ({switchableOptions.length})
                  </div>
                  {switchableOptions.map((option) => {
                    const isSelected = activeSalon.id === option.salonId;
                    const meta = [option.roleLabel, option.branchName || option.organizationName]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={option.salonId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectSalon(option.salonId)}
                        className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between gap-2 hover:bg-[#232328] transition-colors cursor-pointer ${
                          isSelected ? 'text-[#C9A45C] font-bold bg-[#232328]/50' : 'text-stone-300'
                        }`}
                      >
                        <span className="truncate">{option.salonName}</span>
                        {meta && <span className="text-[10px] text-stone-400 shrink-0">{meta}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div
              data-testid="erp-salon-single"
              className="w-full p-2.5 rounded-xl bg-[#18181b] border border-[#2a2a2e] flex items-center gap-2.5"
              title="Un seul établissement est rattaché à ce compte"
            >
              <div className="w-8 h-8 rounded-lg bg-[#201d16] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] shrink-0 font-bold text-xs">
                {activeSalon.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{activeSalon.name}</div>
                <div className="text-[10px] text-stone-400 truncate">{activeSubtitle}</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = visibleActiveTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  const nextUrl = buildErpUrl(
                    TAB_PATHS[item.id],
                    expectedSalonId,
                    activeMemberships.length > 0,
                  );
                  if (window.location.pathname + window.location.search !== nextUrl) {
                    window.history.pushState({}, '', nextUrl);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#C9A45C] text-[#101010] shadow-sm font-bold'
                    : 'text-stone-400 hover:text-white hover:bg-[#1a1a1d]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#101010]' : 'text-stone-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {navBadge(item.id) > 0 && (
                  <span
                    data-testid={
                      item.id === 'notifications' && hasCriticalNotificationAlert
                        ? 'notifications-critical-badge'
                        : undefined
                    }
                    title={
                      item.id === 'notifications' && hasCriticalNotificationAlert
                        ? 'Alerte : échecs répétés sur les notifications'
                        : undefined
                    }
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      item.id === 'notifications' && hasCriticalNotificationAlert
                        ? 'bg-red-500 text-white'
                        : isActive
                          ? 'bg-[#101010] text-[#C9A45C]'
                          : 'bg-[#C9A45C] text-[#101010]'
                    }`}
                  >
                    {navBadge(item.id)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Cash Register status indicator */}
        <div className="p-3 border-t border-[#222226] space-y-2">
          <div className="p-3 rounded-xl bg-[#161619] border border-[#242428] text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-stone-400">Tiroir Caisse :</span>
              <span
                className={`text-[10px] font-bold ${cashSession?.status === 'open' ? 'text-emerald-400' : 'text-stone-500'}`}
              >
                {cashSession ? (cashSession.status === 'open' ? 'Ouverte' : 'Fermée') : 'Non configurée'}
              </span>
            </div>
            <div className="font-extrabold text-[#E5C378] text-sm">
              {cashSession ? formatPrice(cashSession.theoreticalBalance) : '—'}
            </div>
          </div>

          <button
            onClick={() => setMode('marketplace')}
            className="w-full py-2 px-3 rounded-xl bg-[#18181b] hover:bg-[#202025] text-stone-400 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour Marketplace</span>
          </button>
        </div>
      </aside>

      {/* MAIN ERP WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-[#121214] border-b border-[#222226] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <span className="text-xs text-stone-500 hidden sm:inline">• {activeSalon.name}</span>
            {realtimeBadge && (
              <div
                data-testid="erp-realtime-status"
                className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${realtimeBadge.tone}`}
                title="Synchronisation multi-postes active pour cet établissement"
              >
                <realtimeBadge.icon className="w-3 h-3" />
                <span>{realtimeBadge.label}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {memberships.length > 0 && (
              <button
                type="button"
                onClick={() => void syncNow()}
                title="Synchroniser immédiatement les données du salon"
                aria-label="Synchroniser les données"
                className="p-2 rounded-xl bg-[#18181c] hover:bg-[#24242a] text-stone-300 hover:text-white border border-[#2a2a32] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
            {(memberships.length === 0 || canSee('appointments.write')) && (
              <button
                onClick={() => setIsWalkInOpen(true)}
                className="bg-[#C9A45C]/15 hover:bg-[#C9A45C]/25 text-[#E5C378] border border-[#C9A45C]/40 font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Client de passage</span>
              </button>
            )}
            <button
              onClick={() => {
                setNewAppointmentSlot({});
                setIsNewAppointmentOpen(true);
              }}
              className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b44] font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span className="hidden sm:inline">+ Nouveau RDV</span>
            </button>

            {(memberships.length === 0 || canSee('payments.record')) && (
              <button
                onClick={() => {
                  setPreselectedAppointment(null);
                  setIsNewPaymentOpen(true);
                }}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Encaisser</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <main key={activeSalon.id} className="p-4 sm:p-6 lg:p-8 flex-1">
          {syncError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-800/60 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200"
            >
              <span>{syncError}</span>
              <button
                type="button"
                onClick={() => void syncNow()}
                className="px-3 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800/60 text-white font-semibold cursor-pointer"
              >
                Synchroniser
              </button>
            </div>
          )}
          {activeSalon.status === 'suspended' && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-xs text-red-200"
            >
              <p className="font-bold">
                Salon suspendu par l’administration : la vitrine marketplace et les réservations publiques
                sont désactivées.
              </p>
              {activeSalon.suspensionReason && (
                <p className="text-red-300/90 mt-1">Motif : {activeSalon.suspensionReason}</p>
              )}
            </div>
          )}
          <Suspense fallback={<SectionLoadingFallback label="Chargement de la vue ERP…" />}>
            {visibleActiveTab === 'dashboard' && (
              <DashboardView
                onOpenNewAppointment={() => {
                  setNewAppointmentSlot({});
                  setIsNewAppointmentOpen(true);
                }}
                onOpenWalkIn={() => setIsWalkInOpen(true)}
                onOpenNewPayment={() => {
                  setPreselectedAppointment(null);
                  setIsNewPaymentOpen(true);
                }}
              />
            )}

            {visibleActiveTab === 'walk_in' && (
              <WalkInView
                onOpenNewWalkIn={() => setIsWalkInOpen(true)}
                onOpenPayment={(apt) => {
                  setPreselectedAppointment(apt);
                  setIsNewPaymentOpen(true);
                }}
              />
            )}

            {visibleActiveTab === 'online_requests' && <OnlineRequestsView />}
            {visibleActiveTab === 'notifications' && <NotificationsView />}
            {visibleActiveTab === 'calendar' && <PlanningView onOpenWalkIn={() => setIsWalkInOpen(true)} />}

            {visibleActiveTab === 'cash' && <CashRegisterView />}

            {visibleActiveTab === 'loyalty' && <LoyaltyView />}

            {visibleActiveTab === 'crm' && <ClientsView />}

            {visibleActiveTab === 'services' && <ServicesView />}

            {visibleActiveTab === 'staff' && <StaffView />}

            {visibleActiveTab === 'expenses' && <FinanceExpensesView />}

            {visibleActiveTab === 'inventory' && <InventoryView />}

            {visibleActiveTab === 'marketplace_showcase' && <MarketplaceShowcaseView />}

            {visibleActiveTab === 'reports' && <ReportsView />}

            {visibleActiveTab === 'qr_code' && <SalonQrCodeView />}

            {visibleActiveTab === 'storefront' && <SalonProfileSettingsView />}

            {visibleActiveTab === 'saas' && <SaaSPlanView />}
          </Suspense>
        </main>
      </div>

      {/* ACCUEIL CLIENT SANS RENDEZ-VOUS */}
      {isWalkInOpen && (
        <Suspense fallback={null}>
          <WalkInModal onClose={() => setIsWalkInOpen(false)} onCreated={() => setActiveTab('walk_in')} />
        </Suspense>
      )}

      {/* QUICK NEW APPOINTMENT MODAL */}
      {isNewAppointmentOpen && (
        <Suspense fallback={null}>
          <NewAppointmentModal
            onClose={() => {
              setIsNewAppointmentOpen(false);
              setNewAppointmentSlot({});
            }}
            initialDate={newAppointmentSlot.date}
            initialTime={newAppointmentSlot.time}
            initialStaffId={newAppointmentSlot.staffId}
          />
        </Suspense>
      )}

      {/* QUICK NEW PAYMENT MODAL */}
      {isNewPaymentOpen && (
        <Suspense fallback={null}>
          <NewPaymentModal
            onClose={() => {
              setIsNewPaymentOpen(false);
              setPreselectedAppointment(null);
            }}
            preselectedAppointmentId={preselectedAppointment?.id}
            defaultAmount={preselectedAppointment?.price}
            defaultClientName={preselectedAppointment?.clientName || ''}
          />
        </Suspense>
      )}
    </div>
  );
};
