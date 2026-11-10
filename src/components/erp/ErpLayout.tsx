import React, { useState, useEffect, useRef } from 'react';
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

import {
  Wifi,
  WifiOff,
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
  Globe,
  QrCode,
  BarChart3,
  Heart,
  UserPlus,
  Inbox,
  Send,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ErpSidebar } from './layout/ErpSidebar';
import { ErpTopbar } from './layout/ErpTopbar';
import { ErpWorkspace } from './layout/ErpWorkspace';

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
    <ErpSidebar
      activeSalon={activeSalon}
      activeSubtitle={activeSubtitle}
      switchableOptions={switchableOptions}
      dropdownOpen={salonDropdownOpen}
      onToggleDropdown={() => setSalonDropdownOpen((open) => !open)}
      onCloseDropdown={() => setSalonDropdownOpen(false)}
      onSelectSalon={handleSelectSalon}
      navItems={visibleNavItems}
      visibleActiveTab={visibleActiveTab}
      onSelectTab={(item) => {
        setActiveTab(item);
        const nextUrl = buildErpUrl(TAB_PATHS[item], expectedSalonId, activeMemberships.length > 0);
        if (window.location.pathname + window.location.search !== nextUrl) {
          window.history.pushState({}, '', nextUrl);
        }
      }}
      navBadge={navBadge}
      hasCriticalNotificationAlert={hasCriticalNotificationAlert}
      cashSession={cashSession}
      formatPrice={formatPrice}
      onBackToMarketplace={() => setMode('marketplace')}
    >
      <ErpTopbar
        activeTab={visibleActiveTab}
        tabLabel={navItems.find((n) => n.id === visibleActiveTab)?.label ?? ''}
        salonName={activeSalon.name}
        realtimeBadge={realtimeBadge}
        hasMemberships={memberships.length > 0}
        canWriteAppointments={memberships.length === 0 || canSee('appointments.write')}
        canRecordPayments={memberships.length === 0 || canSee('payments.record')}
        isSyncing={isSyncing}
        onSyncNow={() => void syncNow()}
        onOpenWalkIn={() => setIsWalkInOpen(true)}
        onOpenNewAppointment={() => {
          setNewAppointmentSlot({});
          setIsNewAppointmentOpen(true);
        }}
        onOpenNewPayment={() => {
          setPreselectedAppointment(null);
          setIsNewPaymentOpen(true);
        }}
      />
      <ErpWorkspace
        activeSalon={activeSalon}
        visibleActiveTab={visibleActiveTab}
        syncError={syncError}
        onSyncNow={() => void syncNow()}
        reopenAppointment={() => {
          setNewAppointmentSlot({});
          setIsNewAppointmentOpen(true);
        }}
        openWalkIn={() => setIsWalkInOpen(true)}
        openPayment={() => {
          setPreselectedAppointment(null);
          setIsNewPaymentOpen(true);
        }}
        openPaymentWith={(apt) => {
          setPreselectedAppointment(apt);
          setIsNewPaymentOpen(true);
        }}
        isWalkInOpen={isWalkInOpen}
        onCloseWalkIn={() => setIsWalkInOpen(false)}
        onWalkInCreated={() => setActiveTab('walk_in')}
        isNewAppointmentOpen={isNewAppointmentOpen}
        onCloseAppointment={() => {
          setIsNewAppointmentOpen(false);
          setNewAppointmentSlot({});
        }}
        newAppointmentSlot={newAppointmentSlot}
        isNewPaymentOpen={isNewPaymentOpen}
        onClosePayment={() => {
          setPreselectedAppointment(null);
          setIsNewPaymentOpen(false);
        }}
        preselectedAppointment={preselectedAppointment}
      />
    </ErpSidebar>
  );
};
