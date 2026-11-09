import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Store,
  Users,
  CreditCard,
  Edit3,
  Plus,
  Check,
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
  RefreshCw,
  Eye,
  Sliders,
  LogOut,
  Activity,
  MessageSquare,
  ShieldAlert,
  Search,
  ExternalLink,
  Ban,
  Settings,
  Bell,
  Globe,
  Award,
  Filter,
} from 'lucide-react';
import type { SaaSPlan, Salon } from '../../types';
import {
  getAllSaasPlans,
  getSaasPlanDrafts,
  publishSaasPlanDraft,
  discardSaasPlanDraft,
  type SaaSPlanDraft,
  type SaaSPlanInput,
} from '../../lib/saas';
import {
  verifySuperAdminAccess,
  logoutSuperAdmin,
  isSalonLiveOnMarketplace,
  type AdminUser,
  type SalonAdminDetail,
  type MarketplaceReviewItem,
  type PlatformAuditEntry,
} from '../../lib/superadmin';
import type { PlatformOverview as PlatformOverviewData } from '../../lib/platform-admin';
import {
  listPlatformSalons,
  listPlatformReviews,
  listPlatformAuditLogs,
  getPlatformOverview,
  setPlatformSalonStatus,
  assignPlatformSalonPlan,
} from '../../lib/platform-admin';
import { AdminLoginForm } from './AdminLoginForm';
import { SalonManagement } from './SalonManagement';
import { ReasonDialog } from './ReasonDialog';
import { ReviewModerationPanel } from './ReviewModerationPanel';
import { PlatformOverview } from './PlatformOverview';
import { PlatformAdminsPanel } from './PlatformAdminsPanel';
import { MarketplaceSectionsAdmin } from './MarketplaceSectionsAdmin';
import { MarketplaceConfigManager } from './MarketplaceConfigManager';
import { PricingTierEditor } from './PricingTierEditor';
import { SaasPaymentReviewPanel } from './SaasPaymentReviewPanel';
import { useOptionalApp } from '../../context/AppContext';

export type AdminDashboardTab =
  | 'overview'
  | 'salons'
  | 'marketplace-sections'
  | 'marketplace-config'
  | 'pricing'
  | 'subscriptions'
  | 'reviews'
  | 'governance'
  | 'settings';

export const AdminDashboard: React.FC = () => {
  const { addToast, formatPrice } = useOptionalApp();

  // Authentication gate state
  // Aucune session n'est acceptée avant vérification serveur (voir verifySuperAdminAccess).
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

  // Navigation tab
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview');

  // Platform Data
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [overview, setOverview] = useState<PlatformOverviewData | null>(null);
  const [salons, setSalons] = useState<SalonAdminDetail[]>([]);
  const [reviews, setReviews] = useState<MarketplaceReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'hidden' | 'suspended'>('all');

  // Éditeur de forfait : null = fermé ; plan null = nouveau forfait.
  const [editorTarget, setEditorTarget] = useState<{
    plan: SaaSPlan | null;
    draft: SaaSPlanInput | null;
  } | null>(null);
  // Brouillons en attente (non visibles sur la page Tarifs).
  const [planDrafts, setPlanDrafts] = useState<SaaSPlanDraft[]>([]);

  // Subscription Edit Modal for a Salon
  const [selectedSalonForSub, setSelectedSalonForSub] = useState<SalonAdminDetail | null>(null);
  const [newSubPlanId, setNewSubPlanId] = useState('');
  const [subReason, setSubReason] = useState('');
  const [subError, setSubError] = useState<string | null>(null);
  // Suspension depuis l'onglet Abonnements : fenêtre de motif.
  const [statusTarget, setStatusTarget] = useState<SalonAdminDetail | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedPlans, fetchedOverview, fetchedDrafts, fetchedSalons, fetchedReviews, fetchedAudit] =
        await Promise.all([
          getAllSaasPlans(),
          getPlatformOverview(),
          getSaasPlanDrafts(),
          listPlatformSalons(),
          listPlatformReviews(),
          listPlatformAuditLogs(100),
        ]);
      setPlans(fetchedPlans);
      setOverview(fetchedOverview);
      setPlanDrafts(fetchedDrafts);
      setSalons(fetchedSalons);
      setReviews(fetchedReviews);
      setAuditLogs(fetchedAudit);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminSession) {
      loadAllData();
    }
    const handleSessionChange = () => setAdminSession(null);
    const handlePlansUpdate = () => loadAllData();

    window.addEventListener('superadmin_session_changed', handleSessionChange);
    window.addEventListener('saas_plans_updated', handlePlansUpdate);

    return () => {
      window.removeEventListener('superadmin_session_changed', handleSessionChange);
      window.removeEventListener('saas_plans_updated', handlePlansUpdate);
    };
  }, [adminSession]);

  // VÉRIFICATION D'ACCÈS EN COURS : rien de sensible n'est affiché avant la réponse du serveur
  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center text-stone-400 text-sm">
        Vérification de l’accès…
      </div>
    );
  }

  // LOGIN GATE
  if (!adminSession) {
    return (
      <AdminLoginForm
        onSuccess={(user) => {
          setAdminSession(user);
          addToast(`Session Administrateur active : ${user.email}`, 'success');
        }}
      />
    );
  }

  const handleLogout = () => {
    logoutSuperAdmin();
    setAdminSession(null);
    addToast('Session administrateur clôturée.', 'info');
  };

  // Plan Management handlers
  const openPlanEditor = (plan: SaaSPlan | null, draft: SaaSPlanInput | null = null) => {
    setEditorTarget({ plan, draft });
  };

  const handlePublishDraft = async (planId: string) => {
    try {
      await publishSaasPlanDraft(planId);
      addToast('Brouillon publié : visible sur la page Tarifs.', 'success');
      await loadAllData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la publication', 'error');
    }
  };

  const handleDiscardDraft = async (planId: string) => {
    if (!window.confirm('Abandonner ce brouillon ? La version publiée reste inchangée.')) return;
    try {
      await discardSaasPlanDraft(planId);
      addToast('Brouillon abandonné.', 'info');
      await loadAllData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de l’abandon du brouillon', 'error');
    }
  };

  // Cartes de l'onglet Tarifs : forfaits publiés + nouveaux forfaits existant seulement en brouillon.
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

  // Décisions SuperAdmin : envoyées à la base (RPC tracées), puis la liste est relue.
  const runDecision = async (
    work: () => Promise<void>,
    successMessage: string,
    tone: 'success' | 'info' | 'error' = 'info',
  ) => {
    try {
      await work();
      addToast(successMessage, tone);
      await loadAllData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'L’action a échoué.', 'error');
    }
  };

  // Suspension : motif obligatoire (fenêtre dédiée). Réactivation directe, sans motif.
  const handleToggleSalonStatus = (salon: SalonAdminDetail) => {
    if (salon.status === 'active') {
      setStatusTarget(salon);
      return;
    }
    void runDecision(
      () => setPlatformSalonStatus(salon.id, 'active').then(() => undefined),
      `Accès ERP pour "${salon.name}" réactivé. Republiez-le pour le remettre en ligne.`,
      'success',
    );
  };

  const confirmSuspension = async (reason: string) => {
    if (!statusTarget) return;
    const target = statusTarget;
    await setPlatformSalonStatus(target.id, 'suspended', reason);
    setStatusTarget(null);
    addToast(`Accès ERP pour "${target.name}" suspendu.`, 'error');
    await loadAllData();
  };

  // Attribution manuelle de formule : motif obligatoire, abonnement actif mensuel créé par la base.
  const handleSaveSubscriptionOverride = async () => {
    if (!selectedSalonForSub || !newSubPlanId) return;
    const targetPlan = plans.find((p) => p.id === newSubPlanId);
    if (!targetPlan) return;
    if (!subReason.trim()) {
      setSubError('Le motif est obligatoire.');
      return;
    }
    try {
      await assignPlatformSalonPlan(selectedSalonForSub.id, targetPlan.id, subReason.trim());
      addToast(`Formule de "${selectedSalonForSub.name}" mise à jour vers ${targetPlan.name}.`, 'success');
      setSelectedSalonForSub(null);
      setSubReason('');
      setSubError(null);
      await loadAllData();
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'L’attribution a échoué.');
    }
  };

  const filteredSalons = salons.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.commune.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.organizationName.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'published') return matchesSearch && s.isPublished;
    if (statusFilter === 'hidden') return matchesSearch && !s.isPublished;
    if (statusFilter === 'suspended') return matchesSearch && s.status === 'suspended';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#070709] text-[#f7f6f2] font-sans flex flex-col selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Top Application Header */}
      <header className="h-16 bg-[#0c0c10] border-b border-[#1c1c24] px-4 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4">
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

          {/* Admin User Badge & Logout */}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white">{adminSession.name}</div>
              <div className="text-[10px] text-[#C9A45C]">{adminSession.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-xs font-bold text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Déconnexion sécurisée"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-[#0a0a0d] border-r border-[#1a1a22] p-4 flex flex-col shrink-0 space-y-6">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 px-3">
              Navigation Plateforme
            </div>
            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Vue d’Ensemble', icon: Activity },
                { id: 'salons', label: 'Gestion des Salons', icon: Store, count: salons.length },
                { id: 'marketplace-sections', label: 'Sections Marketplace', icon: Globe },
                { id: 'marketplace-config', label: 'Bannières & Métadonnées', icon: Sliders },
                { id: 'pricing', label: 'Tarifs & Plans SaaS', icon: DollarSign, count: plans.length },
                {
                  id: 'subscriptions',
                  label: 'Statuts d’Abonnement',
                  icon: CreditCard,
                  count: salons.length,
                },
                { id: 'reviews', label: 'Modération des Avis', icon: MessageSquare, count: reviews.length },
                { id: 'governance', label: 'Administrateurs & Journal', icon: ShieldCheck },
                { id: 'settings', label: 'Paramètres Globaux', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as AdminDashboardTab)}
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
            </nav>
          </div>

          {/* Quick Metrics Widget */}
          <div className="p-3.5 rounded-2xl bg-[#0f0f13] border border-[#1e1e26] space-y-2 mt-auto">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-400">
              <span>MRR Prévisionnel</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-white">
              {overview ? formatPrice(overview.subscriptions.mrr_xof) : '—'}
            </div>
            <div className="text-[10px] text-stone-500">
              {overview ? `${overview.subscriptions.active} abonnements actifs` : 'Indisponible'}
            </div>
          </div>
        </aside>

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW (indicateurs calculés par la base) */}
          {activeTab === 'overview' && (
            <PlatformOverview
              overview={overview}
              loading={loading}
              recentDecisions={auditLogs.slice(0, 4)}
              onNavigate={(tab) => setActiveTab(tab as AdminDashboardTab)}
            />
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <SaasPaymentReviewPanel formatPrice={formatPrice} />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">Tarifs & Forfaits SaaS</h1>
                  <p className="text-xs text-stone-400 mt-1">
                    Chaque modification peut être publiée immédiatement sur la page Tarifs, ou enregistrée en
                    brouillon pour être publiée plus tard. Les salons déjà abonnés conservent leur tarif
                    d’origine.
                  </p>
                </div>

                <button
                  onClick={() => openPlanEditor(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau Forfait</span>
                </button>
              </div>

              {/* Plans Grid */}
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

                      <div className="border-y border-[#181820] py-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-[#E5C378]">
                            {formatPrice(plan.priceXof)}
                          </span>
                          <span className="text-xs text-stone-400">/ mois</span>
                        </div>
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
                          {draft.plan.name} — {formatPrice(draft.plan.priceXof)} / mois
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handlePublishDraft(draft.planId)}
                            className="px-3 py-1.5 rounded-lg bg-[#C9A45C] text-[#101010] font-bold"
                          >
                            Publier le brouillon
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDiscardDraft(draft.planId)}
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

          {/* TAB 2: SALON MANAGEMENT (VIEW, VERIFY, DEACTIVATE/SUSPEND) */}
          {activeTab === 'reviews' && <ReviewModerationPanel reviews={reviews} onRefresh={loadAllData} />}

          {activeTab === 'governance' && (
            <PlatformAdminsPanel currentUserId={adminSession.id} onRefresh={loadAllData} />
          )}

          {activeTab === 'salons' && (
            <SalonManagement salons={salons} plans={plans} onRefresh={loadAllData} />
          )}

          {/* TAB 3: MARKETPLACE SECTIONS & TABS CMS */}
          {activeTab === 'marketplace-sections' && (
            <MarketplaceSectionsAdmin adminEmail={adminSession.email} />
          )}

          {/* TAB 3 bis: BANNIÈRES, SECTIONS À LA UNE & MÉTADONNÉES DU SITE */}
          {activeTab === 'marketplace-config' && <MarketplaceConfigManager adminEmail={adminSession.email} />}

          {/* TAB 4: SUBSCRIPTION STATUS */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Statuts d'Abonnement des Salons
                  </h1>
                  <p className="text-xs text-stone-400 mt-1">
                    Gérez les abonnements des établissements partenaires, tarifs garantis et suspensions
                    d'accès ERP.
                  </p>
                </div>
              </div>

              {/* Subscriptions Table */}
              <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#101014] border-b border-[#1a1a22] text-stone-400 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Salon Partenaire</th>
                        <th className="py-3 px-4">Forfait Actif</th>
                        <th className="py-3 px-4">Tarif Souscrit Garanti</th>
                        <th className="py-3 px-4">Statut Abonnement</th>
                        <th className="py-3 px-4">Date de Renouvellement</th>
                        <th className="py-3 px-4 text-right">Actions Contrat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#15151c] text-stone-300">
                      {salons.map((salon) => (
                        <tr key={salon.id} className="hover:bg-[#111116] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-[#C9A45C]" />
                              <span>{salon.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-[#E5C378]">
                              {salon.planName || 'Formule non disponible'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            {salon.planName ? `${formatPrice(salon.priceAtSubscription)} / mois` : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                salon.status === 'active'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {salon.status === 'suspended'
                                ? 'Accès suspendu'
                                : salon.subscriptionStatus === 'active' ||
                                    salon.subscriptionStatus === 'trialing'
                                  ? 'Abonnement actif'
                                  : salon.subscriptionStatus === 'pending_payment'
                                    ? 'Paiement en attente'
                                    : 'Aucun abonnement'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-400">
                            {salon.currentPeriodEnd
                              ? new Date(salon.currentPeriodEnd).toLocaleDateString('fr-FR')
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedSalonForSub(salon);
                                setNewSubPlanId(salon.planId);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#1a1a22] hover:bg-[#242430] text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Changer Forfait
                            </button>
                            <button
                              onClick={() => handleToggleSalonStatus(salon)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                salon.status === 'active'
                                  ? 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40'
                                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40'
                              }`}
                            >
                              {salon.status === 'active' ? 'Suspendre' : 'Réactiver'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PARAMÈTRES (lecture seule : aucune valeur n'est sauvegardée hors base) */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Paramètres de la plateforme</h1>
                <p className="text-xs text-stone-400 mt-1">
                  Les réglages qui pilotent l’ERP sont portés par la base : formules et quotas (Tarifs & Plans
                  SaaS), statut des salons (Gestion des Salons), avis (Modération des Avis), décisions
                  (Administrateurs & Journal).
                </p>
              </div>
              <div className="space-y-3 bg-[#0c0c10] border border-[#1a1a22] rounded-3xl p-6 sm:p-8 text-sm text-stone-300">
                <p>
                  Devise de référence :{' '}
                  <strong className="text-white">XOF (franc CFA), montants entiers.</strong>
                </p>
                <p>
                  Les anciens réglages « taux de commission », « mode maintenance » et « approbation
                  automatique » étaient enregistrés dans ce navigateur seulement et n’avaient aucun effet sur
                  l’application. Ils ont été retirés pour ne pas donner une fausse impression de contrôle.
                </p>
                <p className="text-xs text-stone-500">
                  Un réglage de commission ou de maintenance sera ajouté lorsqu’il sera branché côté serveur.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {statusTarget && (
        <ReasonDialog
          title={`Suspendre l’accès de « ${statusTarget.name} »`}
          description="Le salon perd son accès ERP et disparaît de la marketplace. Le motif est conservé dans le journal d’audit."
          confirmLabel="Suspendre l’accès"
          tone="danger"
          onConfirm={confirmSuspension}
          onCancel={() => setStatusTarget(null)}
        />
      )}

      {/* PLAN EDIT MODAL */}
      {editorTarget && (
        <PricingTierEditor
          plan={editorTarget.plan}
          pendingDraft={editorTarget.draft}
          nextDisplayOrder={plans.length + 1}
          onClose={() => setEditorTarget(null)}
          onSaved={() => {
            setEditorTarget(null);
            loadAllData();
          }}
        />
      )}

      {/* SUBSCRIPTION OVERRIDE MODAL FOR SALON */}
      {selectedSalonForSub && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f0f13] border border-[#262632] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-white">
                Modifier la Formule de « {selectedSalonForSub.name} »
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Attribuez manuellement un nouveau forfait SaaS à cet établissement.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-300">
                Sélectionner le forfait cible :
              </label>
              <select
                value={newSubPlanId}
                onChange={(e) => setNewSubPlanId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatPrice(p.priceXof)} / mois
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-300">
                Motif de l’attribution (obligatoire)
                <textarea
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </label>
              {subError && (
                <p role="alert" className="text-xs text-red-300">
                  {subError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1c1c24]">
              <button
                type="button"
                onClick={() => {
                  setSelectedSalonForSub(null);
                  setSubError(null);
                  setSubReason('');
                }}
                className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSubscriptionOverride()}
                className="px-4 py-2 rounded-xl bg-[#C9A45C] text-[#101010] font-bold text-xs"
              >
                Appliquer la Formule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
