import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
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
import { AdminHeader, AdminSidebar } from './dashboard/AdminChrome';
import { PricingTab } from './dashboard/PricingTab';
import { SubscriptionStatusModal } from './dashboard/SubscriptionStatusModal';
import { rangeForMetricsPeriod, type MetricsPeriodKey } from '../../lib/metricsPeriod';
import { resolvePageMetadata } from '../../lib/seo';
import { usePageSeo } from '../../hooks/useSiteMetadata';
import { SectionLoadingFallback, lazyNamed } from '../common/ViewLoader';
import { useOptionalApp } from '../../context/AppContext';

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

export const AdminDashboard: React.FC = () => {
  usePageSeo(ADMIN_SEO);
  const { addToast, formatPrice, refreshMarketplace } = useOptionalApp();

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

  return (
    <div className="min-h-screen bg-[#070709] text-[#f7f6f2] font-sans flex flex-col selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* En-tête applicatif (session + actions globales) */}
      <AdminHeader
        adminSession={adminSession}
        loading={loading}
        onRefresh={() => void refreshAllAndMarketplace()}
        onLogout={handleLogout}
      />

      {/* Navigation + contenu principal */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        salons={salons}
        reviews={reviews}
        auditLogs={auditLogs}
        plans={plans}
        notificationAlertCount={repeatedNotificationAlertCount}
        hiddenReviewsCount={hiddenReviewsCount}
        metrics={metrics}
        formatPrice={formatPrice}
      >
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
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
              <PricingTab
                plans={plans}
                planDrafts={planDrafts}
                formatPrice={formatPrice}
                onOpenPlanEditor={openPlanEditor}
                onPublishDraft={handlePublishDraft}
                onDiscardDraft={handleDiscardDraft}
                onPaymentDecision={() => {
                  void refreshAllAndMarketplace();
                }}
              />
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
      </AdminSidebar>

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

      {/* Modale de changement de statut d'abonnement (motif auditée) */}
      {pendingStatusSalon && (
        <SubscriptionStatusModal
          salon={pendingStatusSalon.salon}
          nextStatus={pendingStatusSalon.nextStatus}
          reason={statusReason}
          onReasonChange={setStatusReason}
          error={statusError}
          busy={statusBusy}
          onConfirm={handleConfirmSubscriptionStatus}
          onClose={() => setPendingStatusSalon(null)}
        />
      )}
    </div>
  );
};
