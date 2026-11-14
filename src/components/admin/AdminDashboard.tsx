import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  TrendingUp,
  Store,
  CreditCard,
  Edit3,
  Plus,
  Check,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Eye,
  Sliders,
  LogOut,
  Activity,
  MessageSquare,
  Globe,
  Settings,
  FileText,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  SaaSPlan,
  PlatformMetrics,
  PlatformNotificationHealthSummary,
  NotificationProbeResult,
} from '../../types';
import {
  getAllSaasPlans,
  getPlatformMetrics,
  getSaasPlanDrafts,
  publishSaasPlanDraft,
  discardSaasPlanDraft,
  type SaaSPlanDraft,
  type SaaSPlanInput,
} from '../../lib/saas';
import { resolvePlanBilling } from '../../lib/saasPricing';
import {
  verifySuperAdminAccess,
  logoutSuperAdmin,
  getAdminSalonsList,
  setSalonStatusByAdmin,
  getAdminReviews,
  getPlatformAuditLogs,
  getPlatformNotificationHealth,
  probePlatformNotificationDispatcher,
  getPlatformSettings,
  updatePlatformSettings,
  validateAuditReason,
  type AdminUser,
  type SalonAdminDetail,
  type MarketplaceReviewItem,
  type AuditLogEntry,
  type PlatformGlobalSettings,
} from '../../lib/superadmin';
import { rangeForMetricsPeriod, type MetricsPeriodKey } from '../../lib/metricsPeriod';
import { resolvePageMetadata } from '../../lib/seo';
import { usePageSeo } from '../../hooks/useSiteMetadata';
import { SectionLoadingFallback, lazyNamed } from '../common/ViewLoader';
import { useMarketplaceApp } from '../../context/useMarketplaceApp';

const ADMIN_SEO = resolvePageMetadata('/admin', {
  siteName: 'BarberCuts',
  metaTitle: '',
  metaDescription: '',
});

const AdminLoginForm = lazyNamed(() => import('./AdminLoginForm'), 'AdminLoginForm');
const SalonManagement = lazyNamed(() => import('./SalonManagement'), 'SalonManagement');
const AdminReviewsPanel = lazyNamed(() => import('./AdminReviewsPanel'), 'AdminReviewsPanel');
const AdminAuditLogPanel = lazyNamed(() => import('./AdminAuditLogPanel'), 'AdminAuditLogPanel');
const AdminSubscriptionsPanel = lazyNamed(
  () => import('./AdminSubscriptionsPanel'),
  'AdminSubscriptionsPanel',
);
const AdminOverviewPanel = lazyNamed(() => import('./AdminOverviewPanel'), 'AdminOverviewPanel');
const AdminNotificationsPanel = lazyNamed(
  () => import('./AdminNotificationsPanel'),
  'AdminNotificationsPanel',
);
const MarketplaceSectionsAdmin = lazyNamed(
  () => import('./MarketplaceSectionsAdmin'),
  'MarketplaceSectionsAdmin',
);
const MarketplaceConfigManager = lazyNamed(
  () => import('./MarketplaceConfigManager'),
  'MarketplaceConfigManager',
);
const PricingTierEditor = lazyNamed(() => import('./PricingTierEditor'), 'PricingTierEditor');
const SaasPaymentReviewPanel = lazyNamed(() => import('./SaasPaymentReviewPanel'), 'SaasPaymentReviewPanel');
const AdminPlatformSettingsPanel = lazyNamed(
  () => import('./AdminPlatformSettingsPanel'),
  'AdminPlatformSettingsPanel',
);

export type AdminDashboardTab =
  | 'overview'
  | 'salons'
  | 'reviews'
  | 'notifications'
  | 'audit'
  | 'marketplace-sections'
  | 'marketplace-config'
  | 'pricing'
  | 'subscriptions'
  | 'settings';

const ADMIN_NAVIGATION_GROUPS: Array<{ label: string; tabs: AdminDashboardTab[] }> = [
  { label: 'Supervision', tabs: ['overview', 'salons', 'reviews', 'notifications', 'audit'] },
  { label: 'Marketplace', tabs: ['marketplace-sections', 'marketplace-config'] },
  { label: 'Offre & plateforme', tabs: ['pricing', 'subscriptions', 'settings'] },
];

export const AdminDashboard: React.FC = () => {
  usePageSeo(ADMIN_SEO);
  const { addToast, formatPrice, refreshMarketplace } = useMarketplaceApp();

  // Authentication gate state — verified server-side via verifySuperAdminAccess
  const [adminSession, setAdminSession] = useState<AdminUser | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    verifySuperAdminAccess().then((admin) => {
      if (cancelled) return;
      setAdminSession(admin);
      setAccessChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview');
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavigationOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileNavigationOpen]);

  // Platform Data (100% server-backed)
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriodKey>('month');
  const [metricsRange, setMetricsRange] = useState<{ from: string | null; to: string | null }>(() =>
    rangeForMetricsPeriod('month'),
  );
  const metricsRangeRef = useRef(metricsRange);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [salons, setSalons] = useState<SalonAdminDetail[]>([]);
  const [reviews, setReviews] = useState<MarketplaceReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [notificationHealth, setNotificationHealth] = useState<PlatformNotificationHealthSummary | null>(
    null,
  );
  const [notificationProbe, setNotificationProbe] = useState<NotificationProbeResult | null>(null);
  const [probingNotifications, setProbingNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Éditeur de forfait
  const [editorTarget, setEditorTarget] = useState<{
    plan: SaaSPlan | null;
    draft: SaaSPlanInput | null;
  } | null>(null);
  const [planDrafts, setPlanDrafts] = useState<SaaSPlanDraft[]>([]);

  // Quick status modal on subscriptions tab (with mandatory motif)
  const [pendingStatusSalon, setPendingStatusSalon] = useState<{
    salon: SalonAdminDetail;
    nextStatus: 'active' | 'suspended';
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [platformSettings, setPlatformSettings] = useState<PlatformGlobalSettings | null>(null);
  const [platformSettingsError, setPlatformSettingsError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setPlatformSettingsError(null);
    try {
      const activeRange = metricsRangeRef.current;
      let settingsErrorMessage: string | null = null;
      const [
        fetchedPlans,
        fetchedMetrics,
        fetchedDrafts,
        fetchedSalons,
        fetchedReviews,
        fetchedAuditLogs,
        fetchedNotifHealth,
        fetchedPlatformSettings,
      ] = await Promise.all([
        getAllSaasPlans(),
        getPlatformMetrics({ from: activeRange.from, to: activeRange.to }),
        getSaasPlanDrafts(),
        getAdminSalonsList(),
        getAdminReviews(),
        getPlatformAuditLogs({ limit: 150 }),
        getPlatformNotificationHealth().catch(() => null),
        getPlatformSettings().catch((err: unknown) => {
          settingsErrorMessage =
            err instanceof Error ? err.message : 'Erreur lors du chargement des paramètres plateforme.';
          return null;
        }),
      ]);
      setPlans(fetchedPlans);
      setMetrics(fetchedMetrics);
      setPlanDrafts(fetchedDrafts);
      setSalons(fetchedSalons);
      setReviews(fetchedReviews);
      setAuditLogs(fetchedAuditLogs);
      setPlatformSettings(fetchedPlatformSettings);
      setPlatformSettingsError(settingsErrorMessage);
      if (fetchedNotifHealth) {
        setNotificationHealth(fetchedNotifHealth);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des données serveur.';
      setLoadError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleMetricsPeriodChange = useCallback(
    async (nextPeriod: MetricsPeriodKey, nextFrom: string | null, nextTo: string | null) => {
      const nextRange = { from: nextFrom, to: nextTo };
      metricsRangeRef.current = nextRange;
      setMetricsPeriod(nextPeriod);
      setMetricsRange(nextRange);
      setMetricsLoading(true);
      setLoadError(null);
      try {
        const fetchedMetrics = await getPlatformMetrics({ from: nextFrom, to: nextTo });
        setMetrics(fetchedMetrics);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur lors du filtrage des indicateurs.';
        setLoadError(message);
        addToast(message, 'error');
      } finally {
        setMetricsLoading(false);
      }
    },
    [addToast],
  );

  const refreshAllAndMarketplace = useCallback(async () => {
    await loadAllData();
    if (refreshMarketplace) {
      void refreshMarketplace();
    }
  }, [loadAllData, refreshMarketplace]);

  useEffect(() => {
    if (adminSession) {
      void loadAllData();
    }
    const handleSessionChange = () => setAdminSession(null);
    const handlePlansUpdate = () => {
      void refreshAllAndMarketplace();
    };

    window.addEventListener('superadmin_session_changed', handleSessionChange);
    window.addEventListener('saas_plans_updated', handlePlansUpdate);

    return () => {
      window.removeEventListener('superadmin_session_changed', handleSessionChange);
      window.removeEventListener('saas_plans_updated', handlePlansUpdate);
    };
  }, [adminSession, loadAllData, refreshAllAndMarketplace]);

  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center text-stone-400 text-sm">
        Vérification de l’accès…
      </div>
    );
  }

  if (!adminSession) {
    return (
      <Suspense fallback={<SectionLoadingFallback label="Chargement de la connexion SuperAdmin…" />}>
        <AdminLoginForm
          onSuccess={(user) => {
            setAdminSession(user);
            addToast(`Session Administrateur active : ${user.email}`, 'success');
          }}
        />
      </Suspense>
    );
  }

  const handleLogout = () => {
    logoutSuperAdmin();
    setAdminSession(null);
    addToast('Session administrateur clôturée.', 'info');
  };

  const openPlanEditor = (plan: SaaSPlan | null, draft: SaaSPlanInput | null = null) => {
    setEditorTarget({ plan, draft });
  };

  const handlePublishDraft = async (planId: string) => {
    try {
      await publishSaasPlanDraft(planId);
      addToast('Brouillon publié : visible sur la page Tarifs.', 'success');
      await refreshAllAndMarketplace();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la publication', 'error');
    }
  };

  const handleDiscardDraft = async (planId: string) => {
    if (!window.confirm('Abandonner ce brouillon ? La version publiée reste inchangée.')) return;
    try {
      await discardSaasPlanDraft(planId);
      addToast('Brouillon abandonné.', 'info');
      await refreshAllAndMarketplace();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de l’abandon du brouillon', 'error');
    }
  };

  type PlanCardView = SaaSPlanInput & { subscribersCount?: number };
  const pricingCards: Array<{ view: PlanCardView; draft: SaaSPlanDraft | undefined; draftOnly: boolean }> = [
    ...plans.map((plan) => ({
      view: plan as PlanCardView,
      draft: planDrafts.find((d) => d.planId === plan.id),
      draftOnly: false,
    })),
    ...planDrafts
      .filter((d) => !plans.some((p) => p.id === d.planId))
      .map((d) => ({ view: { ...d.plan, subscribersCount: 0 } as PlanCardView, draft: d, draftOnly: true })),
  ];

  const handleConfirmSubscriptionStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStatusSalon) return;

    setStatusError(null);
    let validReason: string;
    try {
      validReason = validateAuditReason(statusReason);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Motif invalide.');
      return;
    }

    setStatusBusy(true);
    try {
      await setSalonStatusByAdmin(pendingStatusSalon.salon.id, pendingStatusSalon.nextStatus, validReason);
      await refreshAllAndMarketplace();
      addToast(
        pendingStatusSalon.nextStatus === 'suspended'
          ? `Accès de « ${pendingStatusSalon.salon.name} » suspendu.`
          : `Accès de « ${pendingStatusSalon.salon.name} » réactivé.`,
        pendingStatusSalon.nextStatus === 'suspended' ? 'error' : 'success',
      );
      setPendingStatusSalon(null);
      setStatusReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour du statut.';
      setStatusError(msg);
      addToast(msg, 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleSavePlatformSettings = async (updates: {
    maintenanceMode: boolean;
    autoApproveSalons: boolean;
    reason: string;
  }) => {
    const saved = await updatePlatformSettings(updates);
    setPlatformSettings(saved);
    setPlatformSettingsError(null);
    addToast('Paramètres globaux enregistrés côté serveur.', 'success');
    await refreshAllAndMarketplace();
    return saved;
  };

  const handleProbeNotifications = async () => {
    setProbingNotifications(true);
    try {
      const result = await probePlatformNotificationDispatcher({ checkWhatsappApi: true });
      setNotificationProbe(result);
      const refreshedHealth = await getPlatformNotificationHealth().catch(() => null);
      if (refreshedHealth) setNotificationHealth(refreshedHealth);
      addToast('Audit des secrets et canaux de notification terminé.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de l’audit des notifications.', 'error');
    } finally {
      setProbingNotifications(false);
    }
  };

  const hiddenReviewsCount = reviews.filter((r) => r.isHidden).length;
  const repeatedNotificationAlertCount = notificationHealth?.repeatedFailures ?? 0;
  const adminNavItems: Array<{
    id: AdminDashboardTab;
    label: string;
    icon: LucideIcon;
    count?: number;
  }> = [
    { id: 'overview', label: 'Vue d’Ensemble', icon: Activity },
    { id: 'salons', label: 'Gestion des Salons', icon: Store, count: salons.length },
    { id: 'reviews', label: 'Modération des Avis', icon: MessageSquare, count: reviews.length },
    {
      id: 'notifications',
      label: 'Notifications & Alertes',
      icon: Bell,
      count: repeatedNotificationAlertCount > 0 ? repeatedNotificationAlertCount : undefined,
    },
    { id: 'audit', label: 'Journal d’Audit', icon: FileText, count: auditLogs.length },
    { id: 'marketplace-sections', label: 'Sections Marketplace', icon: Globe },
    { id: 'marketplace-config', label: 'Bannières & Métadonnées', icon: Sliders },
    { id: 'pricing', label: 'Tarifs & Plans SaaS', icon: DollarSign, count: plans.length },
    { id: 'subscriptions', label: 'Statuts d’Abonnement', icon: CreditCard, count: salons.length },
    { id: 'settings', label: 'Paramètres Globaux', icon: Settings },
  ];

  const groupedAdminNavItems = ADMIN_NAVIGATION_GROUPS.map((group) => ({
    label: group.label,
    items: group.tabs
      .map((tab) => adminNavItems.find((item) => item.id === tab))
      .filter((item): item is (typeof adminNavItems)[number] => Boolean(item)),
  })).filter((group) => group.items.length > 0);

  const selectAdminTab = (nextTab: AdminDashboardTab) => {
    setActiveTab(nextTab);
    setIsMobileNavigationOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-[#f7f6f2] font-sans flex flex-col selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Top Application Header */}
      <header className="h-16 bg-[#0c0c10] border-b border-[#1c1c24] px-3 sm:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setIsMobileNavigationOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#26262e] bg-[#141418] text-stone-200 hover:bg-[#1c1c22] hover:text-white md:hidden"
            aria-label={`Ouvrir la navigation administration — ${adminNavItems.find((item) => item.id === activeTab)?.label ?? 'onglet actif'}`}
            aria-expanded={isMobileNavigationOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-[#171612] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                Barber<span className="text-[#C9A45C]">Cuts</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C9A45C]/20 text-[#E5C378] border border-[#C9A45C]/30 hidden sm:inline">
                Admin Dashboard
              </span>
            </div>
            <span className="text-[10px] text-stone-500 hidden sm:block">
              Supervision Générale de la Plateforme SaaS & Marketplace
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refreshAllAndMarketplace()}
            disabled={loading}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <Link
            to="/tarifs"
            target="_blank"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
            <span>Tarifs Publics</span>
          </Link>
          <Link
            to="/"
            target="_blank"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-[#C9A45C]" />
            <span>Marketplace</span>
          </Link>

          <div className="h-4 w-px bg-[#26262e] hidden md:block" />

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white">{adminSession.name}</div>
              <div className="text-[10px] text-[#C9A45C]">{adminSession.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-xs font-bold text-red-300 gap-1.5 transition-colors cursor-pointer"
              title="Déconnexion sécurisée"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {isMobileNavigationOpen && (
        <button
          type="button"
          aria-label="Fermer la navigation administration"
          onClick={() => setIsMobileNavigationOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Layout Body */}
      <div className="flex-1 flex min-w-0 flex-col md:flex-row md:items-start">
        {/* Navigation Sidebar / mobile drawer — same active tab and server-backed panels. */}
        <aside
          role={isMobileNavigationOpen ? 'dialog' : undefined}
          aria-modal={isMobileNavigationOpen || undefined}
          aria-label="Navigation administration"
          className={`${
            isMobileNavigationOpen
              ? 'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-3rem))] shadow-2xl'
              : 'hidden'
          } md:sticky md:top-[4.25rem] md:self-start md:z-auto md:flex md:h-[calc(100dvh-4.25rem)] md:w-72 md:shadow-none bg-[#0a0a0d] border-r border-[#1a1a22] overflow-y-auto p-4 flex-col shrink-0 space-y-6`}
        >
          <div className="flex items-center justify-between md:hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Navigation plateforme
            </span>
            <button
              type="button"
              onClick={() => setIsMobileNavigationOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-300 hover:bg-[#121217] hover:text-white"
              aria-label="Fermer la navigation administration"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 px-3">
              Navigation Plateforme
            </div>
            <nav aria-label="Navigation plateforme" className="space-y-5">
              {groupedAdminNavItems.map((group) => (
                <section key={group.label} aria-label={group.label} className="space-y-1">
                  <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-stone-500">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => selectAdminTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#C9A45C] text-[#101010] shadow-sm'
                            : 'text-stone-400 hover:text-white hover:bg-[#121217]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.count !== undefined && (
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                              isActive ? 'bg-[#101010] text-[#C9A45C]' : 'bg-[#181820] text-stone-300'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </section>
              ))}
            </nav>
          </div>

          <div className="space-y-2 border-y border-[#1a1a22] py-4 md:hidden">
            <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
              Actions rapides
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMobileNavigationOpen(false);
                void refreshAllAndMarketplace();
              }}
              disabled={loading}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-bold text-stone-300 hover:bg-[#121217] hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
              Actualiser les données
            </button>
            <Link
              to="/tarifs"
              target="_blank"
              className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-xs font-bold text-stone-300 hover:bg-[#121217] hover:text-white"
            >
              <Eye className="h-4 w-4 text-[#C9A45C]" />
              Tarifs publics
            </Link>
            <Link
              to="/"
              target="_blank"
              className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-xs font-bold text-stone-300 hover:bg-[#121217] hover:text-white"
            >
              <Globe className="h-4 w-4 text-[#C9A45C]" />
              Ouvrir la marketplace
            </Link>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0f0f13] border border-[#1e1e26] space-y-2 mt-auto">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-400">
              <span>MRR Normalisé (actifs)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-white">
              {metrics ? formatPrice(metrics.estimatedMrrXof) : '—'}
            </div>
            <div className="text-[10px] text-stone-500">
              {metrics
                ? `${metrics.activeSubscriptions} abonnement(s) actif(s) · annuels ÷ 12`
                : `${salons.filter((s) => s.status === 'active').length} établissement(s) actif(s)`}{' '}
              · {hiddenReviewsCount} avis masqué(s)
            </div>
          </div>
        </aside>

        {/* Dynamic Content Panel */}
        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          {loadError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-xs text-red-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => void refreshAllAndMarketplace()}
                className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/60 text-white font-bold cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          )}

          <Suspense fallback={<SectionLoadingFallback label="Chargement du module d’administration…" />}>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <AdminOverviewPanel
                metrics={metrics}
                metricsLoading={metricsLoading}
                salons={salons}
                auditLogs={auditLogs}
                notificationHealth={notificationHealth}
                period={metricsPeriod}
                fromDate={metricsRange.from}
                toDate={metricsRange.to}
                onPeriodChange={(nextPeriod, nextFrom, nextTo) => {
                  void handleMetricsPeriodChange(nextPeriod, nextFrom, nextTo);
                }}
                onNavigateTab={(tab) => setActiveTab(tab)}
                formatPrice={formatPrice}
              />
            )}

            {/* TAB 2: PRICING PLANS */}
            {activeTab === 'pricing' && (
              <div className="space-y-6">
                <SaasPaymentReviewPanel
                  formatPrice={formatPrice}
                  onDecision={() => {
                    void refreshAllAndMarketplace();
                  }}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Tarifs & Forfaits SaaS</h1>
                    <p className="text-xs text-stone-400 mt-1">
                      Chaque modification peut être publiée immédiatement sur la page Tarifs, ou enregistrée
                      en brouillon pour être publiée plus tard. Les salons déjà abonnés conservent leur tarif
                      d’origine.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openPlanEditor(null)}
                    className="px-4 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Forfait</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {pricingCards.map(({ view: plan, draft, draftOnly }) => (
                    <div
                      key={plan.id}
                      className={`rounded-3xl bg-[#0c0c10] border transition-all flex flex-col justify-between relative overflow-hidden ${
                        plan.isPopular
                          ? 'border-[#C9A45C] shadow-lg shadow-[#C9A45C]/5'
                          : 'border-[#1e1e26] hover:border-[#33333d]'
                      } ${!plan.isActive ? 'opacity-60' : ''}`}
                    >
                      {plan.badgeText && (
                        <div className="absolute top-0 right-0 bg-[#C9A45C] text-[#101010] text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                          {plan.badgeText}
                        </div>
                      )}

                      <div className="p-6 space-y-5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                            {!plan.isActive && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 text-red-400 border border-red-800/50">
                                Inactif
                              </span>
                            )}
                            {draftOnly && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-500/40">
                                Brouillon · non publié
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400 mt-1 min-h-[32px] line-clamp-2">
                            {plan.description}
                          </p>
                        </div>

                        <div className="border-y border-[#181820] py-4 space-y-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-[#E5C378]">
                              {formatPrice(plan.priceXof)}
                            </span>
                            <span className="text-xs text-stone-400">
                              {plan.billingPeriod === 'yearly' ? '/ an' : '/ mois'}
                            </span>
                          </div>
                          {plan.billingPeriod === 'monthly' && (
                            <p className="text-[11px] text-stone-400">
                              Annuel (-15%) : {formatPrice(resolvePlanBilling(plan, 'yearly').billedPriceXof)}{' '}
                              / an
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-[#111116] border border-[#1c1c24]">
                            <span className="text-[10px] text-stone-400 block uppercase">Capacité Staff</span>
                            <span className="font-bold text-white">
                              {plan.maxStaff === null ? 'Illimité' : `${plan.maxStaff} barbier(s)`}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#111116] border border-[#1c1c24]">
                            <span className="text-[10px] text-stone-400 block uppercase">Succursales</span>
                            <span className="font-bold text-white">
                              {plan.maxBranches === 1 ? '1 salon' : `${plan.maxBranches} salons max`}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                            Avantages Inclus ({plan.features.length})
                          </div>
                          <ul className="space-y-2 text-xs text-stone-300">
                            {plan.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {draft && (
                        <div className="mx-6 mb-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200 space-y-2">
                          <div className="font-semibold">Brouillon en attente · non publié</div>
                          <div>
                            {draft.plan.name} — {formatPrice(draft.plan.priceXof)}{' '}
                            {draft.plan.billingPeriod === 'yearly' ? '/ an' : '/ mois'}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => void handlePublishDraft(draft.planId)}
                              className="px-3 py-1.5 rounded-lg bg-[#C9A45C] text-[#101010] font-bold"
                            >
                              Publier le brouillon
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDiscardDraft(draft.planId)}
                              className="px-3 py-1.5 rounded-lg bg-[#181820] text-stone-300"
                            >
                              Abandonner
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-[#101014] border-t border-[#1a1a22] flex items-center justify-between">
                        <div className="text-xs text-stone-400">
                          <span className="font-semibold text-stone-300">{plan.subscribersCount ?? 0}</span>{' '}
                          salon(s) abonné(s)
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openPlanEditor(
                              draftOnly ? null : (plans.find((p) => p.id === plan.id) ?? null),
                              draft?.plan ?? null,
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#1a1a22] hover:bg-[#22222c] text-stone-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#C9A45C]" />
                          <span>Modifier</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: SALON MANAGEMENT */}
            {activeTab === 'salons' && (
              <SalonManagement
                salons={salons}
                onRefresh={refreshAllAndMarketplace}
                adminEmail={adminSession.email}
              />
            )}

            {/* TAB: REVIEWS MODERATION */}
            {activeTab === 'reviews' && (
              <AdminReviewsPanel reviews={reviews} onRefresh={refreshAllAndMarketplace} />
            )}

            {/* TAB: SERVER AUDIT LOG */}
            {activeTab === 'audit' && (
              <AdminAuditLogPanel logs={auditLogs} onRefresh={refreshAllAndMarketplace} />
            )}

            {/* TAB: MARKETPLACE SECTIONS */}
            {activeTab === 'marketplace-sections' && (
              <MarketplaceSectionsAdmin adminEmail={adminSession.email} />
            )}

            {/* TAB: MARKETPLACE CONFIG */}
            {activeTab === 'marketplace-config' && (
              <MarketplaceConfigManager adminEmail={adminSession.email} />
            )}

            {/* TAB: SUBSCRIPTION STATUS */}
            {activeTab === 'subscriptions' && (
              <AdminSubscriptionsPanel
                salons={salons}
                formatPrice={formatPrice}
                onRefresh={() => {
                  void refreshAllAndMarketplace();
                }}
                onToggleSalonStatus={(salon) => {
                  setPendingStatusSalon({
                    salon,
                    nextStatus: salon.status === 'active' ? 'suspended' : 'active',
                  });
                  setStatusReason('');
                  setStatusError(null);
                }}
              />
            )}

            {/* TAB: NOTIFICATIONS & OBSERVABILITY */}
            {activeTab === 'notifications' && (
              <AdminNotificationsPanel
                health={notificationHealth}
                probe={notificationProbe}
                probing={probingNotifications}
                onRefresh={() => {
                  void refreshAllAndMarketplace();
                }}
                onProbe={() => {
                  void handleProbeNotifications();
                }}
              />
            )}

            {/* TAB: PLATFORM-WIDE SETTINGS */}
            {activeTab === 'settings' && (
              <AdminPlatformSettingsPanel
                settings={platformSettings}
                loading={loading}
                error={platformSettingsError}
                onRefresh={refreshAllAndMarketplace}
                onSave={handleSavePlatformSettings}
                onOpenMarketplaceConfig={() => setActiveTab('marketplace-config')}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* PLAN EDIT MODAL */}
      {editorTarget && (
        <Suspense fallback={null}>
          <PricingTierEditor
            plan={editorTarget.plan}
            pendingDraft={editorTarget.draft}
            nextDisplayOrder={plans.length + 1}
            onClose={() => setEditorTarget(null)}
            onSaved={() => {
              setEditorTarget(null);
              void refreshAllAndMarketplace();
            }}
          />
        </Suspense>
      )}

      {/* SUBSCRIPTION TAB STATUS TOGGLE MODAL */}
      {pendingStatusSalon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-y-auto p-4">
          <form
            onSubmit={handleConfirmSubscriptionStatus}
            className="bg-[#0f0f13] border border-[#262632] rounded-3xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {pendingStatusSalon.nextStatus === 'suspended'
                    ? `Suspendre « ${pendingStatusSalon.salon.name} »`
                    : `Réactiver « ${pendingStatusSalon.salon.name} »`}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  {pendingStatusSalon.nextStatus === 'suspended'
                    ? 'Le salon sera immédiatement retiré de la marketplace et ses réservations publiques bloquées.'
                    : 'Le salon retrouvera un statut actif mais devra être republié pour redevenir visible.'}
                </p>
              </div>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => setPendingStatusSalon(null)}
                className="p-1.5 rounded-lg bg-[#181820] text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="sub-status-reason" className="block text-xs font-semibold text-stone-300 mb-1">
                Motif de l’opération *
              </label>
              <input
                id="sub-status-reason"
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Ex. Impayé prolongé, régularisation effectuée..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            {statusError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{statusError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1c1c24]">
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => setPendingStatusSalon(null)}
                className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={statusBusy}
                className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 ${
                  pendingStatusSalon.nextStatus === 'suspended'
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-[#C9A45C] text-[#101010] hover:bg-[#d6b36a]'
                }`}
              >
                {statusBusy ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
