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
  Trash2,
  Check,
  X,
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
import type { SaaSPlan, PlatformMetrics, Salon } from '../../types';
import {
  getAllSaasPlans,
  saveSaasPlan,
  getPlatformMetrics,
} from '../../lib/saas';
import {
  getSuperAdminSession,
  logoutSuperAdmin,
  getAdminSalonsList,
  updateSalonByAdmin,
  getMarketplaceReviews,
  deleteReviewByAdmin,
  getAuditLogs,
  type AdminUser,
  type SalonAdminDetail,
  type MarketplaceReviewItem,
  type AuditLogEntry,
} from '../../lib/superadmin';
import { AdminLoginForm } from './AdminLoginForm';
import { SalonManagement } from './SalonManagement';
import { MarketplaceSectionsAdmin } from './MarketplaceSectionsAdmin';
import { useOptionalApp } from '../../context/AppContext';

export type AdminDashboardTab =
  | 'overview'
  | 'salons'
  | 'marketplace-sections'
  | 'pricing'
  | 'subscriptions'
  | 'settings';

export const AdminDashboard: React.FC = () => {
  const { addToast, formatPrice, salons: appSalons } = useOptionalApp();

  // Authentication gate state
  const [adminSession, setAdminSession] = useState<AdminUser | null>(() => getSuperAdminSession());

  // Navigation tab
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview');

  // Platform Data
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [salons, setSalons] = useState<SalonAdminDetail[]>([]);
  const [reviews, setReviews] = useState<MarketplaceReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'hidden' | 'suspended'>('all');

  // Plan Edit Modal
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Plan Form State
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    priceXof: 0,
    billingPeriod: 'monthly' as 'monthly' | 'yearly',
    description: '',
    features: [] as string[],
    maxStaff: '5',
    maxBranches: 1,
    isPopular: false,
    isActive: true,
    badgeText: '',
    displayOrder: 1,
  });
  const [newFeatureText, setNewFeatureText] = useState('');

  // Subscription Edit Modal for a Salon
  const [selectedSalonForSub, setSelectedSalonForSub] = useState<SalonAdminDetail | null>(null);
  const [newSubPlanId, setNewSubPlanId] = useState('');

  // Platform-wide Settings State (stored in localStorage)
  const [platformSettings, setPlatformSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        commissionRate: 3.5,
        defaultCurrency: 'XOF (FCFA)',
        announcementBanner: 'Bienvenue sur BarberCuts : Découvrez les meilleurs barbershops d’Abidjan et réservez en ligne.',
        announcementActive: true,
        maintenanceMode: false,
        autoApproveSalons: false,
      };
    }
    try {
      const saved = localStorage.getItem('barbercuts_platform_settings');
      return saved
        ? JSON.parse(saved)
        : {
            commissionRate: 3.5,
            defaultCurrency: 'XOF (FCFA)',
            announcementBanner: 'Bienvenue sur BarberCuts : Découvrez les meilleurs barbershops d’Abidjan et réservez en ligne.',
            announcementActive: true,
            maintenanceMode: false,
            autoApproveSalons: false,
          };
    } catch {
      return {
        commissionRate: 3.5,
        defaultCurrency: 'XOF (FCFA)',
        announcementBanner: 'Bienvenue sur BarberCuts : Découvrez les meilleurs barbershops d’Abidjan et réservez en ligne.',
        announcementActive: true,
        maintenanceMode: false,
        autoApproveSalons: false,
      };
    }
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedPlans, fetchedMetrics] = await Promise.all([
        getAllSaasPlans(),
        getPlatformMetrics(),
      ]);
      setPlans(fetchedPlans);
      setMetrics(fetchedMetrics);
      setSalons(getAdminSalonsList(appSalons));
      setReviews(getMarketplaceReviews());
      setAuditLogs(getAuditLogs());
    } catch {
      addToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminSession) {
      loadAllData();
    }
    const handleSessionChange = () => setAdminSession(getSuperAdminSession());
    const handleSalonsUpdate = () => {
      setSalons(getAdminSalonsList(appSalons));
      setAuditLogs(getAuditLogs());
    };
    const handlePlansUpdate = () => loadAllData();

    window.addEventListener('superadmin_session_changed', handleSessionChange);
    window.addEventListener('admin_salons_updated', handleSalonsUpdate);
    window.addEventListener('saas_plans_updated', handlePlansUpdate);

    return () => {
      window.removeEventListener('superadmin_session_changed', handleSessionChange);
      window.removeEventListener('admin_salons_updated', handleSalonsUpdate);
      window.removeEventListener('saas_plans_updated', handlePlansUpdate);
    };
  }, [adminSession, appSalons]);

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
  const openPlanModal = (plan?: SaaSPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name,
        slug: plan.slug,
        priceXof: plan.priceXof,
        billingPeriod: plan.billingPeriod,
        description: plan.description,
        features: [...plan.features],
        maxStaff: plan.maxStaff === null ? '' : String(plan.maxStaff),
        maxBranches: plan.maxBranches,
        isPopular: plan.isPopular,
        isActive: plan.isActive,
        badgeText: plan.badgeText || '',
        displayOrder: plan.displayOrder,
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        name: 'Nouveau Forfait',
        slug: `plan-${Date.now()}`,
        priceXof: 25000,
        billingPeriod: 'monthly',
        description: 'Formule adaptée aux barbershops en développement.',
        features: [
          'Planning et réservations illimités',
          'Gestion de caisse & Mobile Money',
          'Fichier clients CRM & historique',
        ],
        maxStaff: '3',
        maxBranches: 1,
        isPopular: false,
        isActive: true,
        badgeText: '',
        displayOrder: plans.length + 1,
      });
    }
    setNewFeatureText('');
    setIsPlanModalOpen(true);
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    setPlanForm((prev) => ({ ...prev, features: [...prev.features, newFeatureText.trim()] }));
    setNewFeatureText('');
  };

  const handleRemoveFeature = (index: number) => {
    setPlanForm((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planForm.priceXof < 0) {
      addToast('Le prix ne peut être négatif', 'error');
      return;
    }
    setSavingPlan(true);
    try {
      const planToSave: SaaSPlan = {
        id: editingPlan ? editingPlan.id : planForm.slug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: planForm.name.trim(),
        slug: planForm.slug.trim(),
        priceXof: Number(planForm.priceXof),
        billingPeriod: planForm.billingPeriod,
        description: planForm.description.trim(),
        features: planForm.features.filter((f) => f.trim().length > 0),
        maxStaff: planForm.maxStaff.trim() === '' ? null : Number(planForm.maxStaff),
        maxBranches: Number(planForm.maxBranches) || 1,
        isPopular: planForm.isPopular,
        isActive: planForm.isActive,
        badgeText: planForm.badgeText.trim() || null,
        displayOrder: Number(planForm.displayOrder),
      };
      await saveSaasPlan(planToSave);
      addToast(`Le forfait "${planToSave.name}" a été enregistré. Nouveaux tarifs en ligne !`, 'success');
      setIsPlanModalOpen(false);
      await loadAllData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de sauvegarde', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  // Salon Listing Handlers
  const handleToggleListingPublish = (salon: SalonAdminDetail) => {
    const updated = !salon.isPublished;
    updateSalonByAdmin(salon.id, { isPublished: updated }, adminSession.email);
    addToast(
      `Salon "${salon.name}" ${updated ? 'publié sur la Marketplace' : 'masqué de la Marketplace'}.`,
      'info',
    );
  };

  const handleToggleVerified = (salon: SalonAdminDetail) => {
    const updated = !salon.isVerified;
    updateSalonByAdmin(salon.id, { isVerified: updated }, adminSession.email);
    addToast(`Badge de vérification ${updated ? 'accordé à' : 'retiré de'} "${salon.name}".`, 'info');
  };

  const handleToggleSalonStatus = (salon: SalonAdminDetail) => {
    const updated = salon.status === 'active' ? 'suspended' : 'active';
    updateSalonByAdmin(salon.id, { status: updated }, adminSession.email);
    addToast(
      `Accès ERP pour "${salon.name}" ${updated === 'suspended' ? 'suspendu' : 'réactivé'}.`,
      updated === 'suspended' ? 'error' : 'success',
    );
  };

  // Subscription Plan override handler
  const handleSaveSubscriptionOverride = () => {
    if (!selectedSalonForSub || !newSubPlanId) return;
    const targetPlan = plans.find((p) => p.id === newSubPlanId);
    if (!targetPlan) return;

    updateSalonByAdmin(
      selectedSalonForSub.id,
      {
        planId: targetPlan.id,
        planName: targetPlan.name,
        priceAtSubscription: targetPlan.priceXof,
      },
      adminSession.email,
    );
    addToast(`Formule de "${selectedSalonForSub.name}" mise à jour vers ${targetPlan.name}.`, 'success');
    setSelectedSalonForSub(null);
  };

  // Save Platform-wide settings
  const handleSavePlatformSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('barbercuts_platform_settings', JSON.stringify(platformSettings));
      addToast('Paramètres globaux de la plateforme enregistrés.', 'success');
    } catch {
      addToast('Erreur lors de la sauvegarde des paramètres', 'error');
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
                { id: 'pricing', label: 'Tarifs & Plans SaaS', icon: DollarSign, count: plans.length },
                { id: 'subscriptions', label: 'Statuts d’Abonnement', icon: CreditCard, count: salons.length },
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
              {metrics ? formatPrice(metrics.estimatedMrrXof) : '—'}
            </div>
            <div className="text-[10px] text-stone-500">
              {salons.filter((s) => s.status === 'active').length} établissements souscripteurs
            </div>
          </div>
        </aside>

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Tableau de Bord Exécutif</h1>
                <p className="text-xs text-stone-400 mt-1">
                  Surveillance en direct de l'activité, des transactions et de la performance globale.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Revenu Récurrent Mensuel (MRR)
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {metrics ? formatPrice(metrics.estimatedMrrXof) : '—'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold">
                    Abonnements salons régularisés
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Vitrines Marketplace
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {salons.filter((s) => s.isPublished).length} / {salons.length}
                  </div>
                  <div className="text-[10px] text-stone-400">Salons visibles publiquement</div>
                </div>

                <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Volume d'Affaires Global
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {metrics ? formatPrice(metrics.totalRevenueXof) : '1 120 000 FCFA'}
                  </div>
                  <div className="text-[10px] text-stone-400">Total encaissements déclarés</div>
                </div>

                <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Rendez-vous Réalisés
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {metrics ? metrics.totalAppointments : 142}
                  </div>
                  <div className="text-[10px] text-stone-400">Réservations traitées avec succès</div>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('pricing')}
                  className="p-5 rounded-2xl bg-[#0f0f13] hover:bg-[#141419] border border-[#202028] text-left transition-all"
                >
                  <DollarSign className="w-5 h-5 text-[#C9A45C] mb-2" />
                  <div className="text-sm font-bold text-white">Gérer les Tarifs & Plans</div>
                  <p className="text-xs text-stone-400 mt-1">
                    Modifier les prix en FCFA et les avantages qui s'appliquent immédiatement sur la marketplace.
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="p-5 rounded-2xl bg-[#0f0f13] hover:bg-[#141419] border border-[#202028] text-left transition-all"
                >
                  <Globe className="w-5 h-5 text-blue-400 mb-2" />
                  <div className="text-sm font-bold text-white">Contrôler les Vitrines Salons</div>
                  <p className="text-xs text-stone-400 mt-1">
                    Publier, masquer ou certifier les fiches des salons visibles par les clients.
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('subscriptions')}
                  className="p-5 rounded-2xl bg-[#0f0f13] hover:bg-[#141419] border border-[#202028] text-left transition-all"
                >
                  <CreditCard className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-sm font-bold text-white">Statuts & Contrats SaaS</div>
                  <p className="text-xs text-stone-400 mt-1">
                    Surveiller les échéances, tarifs souscrits garantis et suspensions d'accès.
                  </p>
                </button>
              </div>

              {/* Recent Audit Activity */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Dernières Opérations Enregistrées
                </h3>
                <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#101014] border-b border-[#1a1a22] text-stone-400 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Horodatage</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Cible</th>
                        <th className="py-2.5 px-4">Opérateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#15151c] text-stone-300 font-mono text-[11px]">
                      {auditLogs.slice(0, 4).map((log) => (
                        <tr key={log.id}>
                          <td className="py-2.5 px-4 text-stone-500">
                            {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                          </td>
                          <td className="py-2.5 px-4 text-white font-sans">{log.action}</td>
                          <td className="py-2.5 px-4 text-[#E5C378]">{log.target}</td>
                          <td className="py-2.5 px-4 text-stone-400">{log.performedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING PLANS */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">Tarifs & Forfaits SaaS</h1>
                  <p className="text-xs text-stone-400 mt-1">
                    Gérez les prix en FCFA, les quotas et les avantages. Les nouveaux tarifs s'appliquent immédiatement
                    sur la Marketplace et pour tous les souscripteurs ultérieurs.
                  </p>
                </div>

                <button
                  onClick={() => openPlanModal()}
                  className="px-4 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau Forfait</span>
                </button>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
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
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                          {!plan.isActive && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 text-red-400 border border-red-800/50">
                              Inactif
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

                    <div className="p-4 bg-[#101014] border-t border-[#1a1a22] flex items-center justify-between">
                      <div className="text-xs text-stone-400">
                        <span className="font-semibold text-stone-300">{plan.subscribersCount ?? 0}</span> salon(s)
                        abonné(s)
                      </div>
                      <button
                        onClick={() => openPlanModal(plan)}
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
          {activeTab === 'salons' && (
            <SalonManagement
              salons={salons}
              onRefresh={loadAllData}
              adminEmail={adminSession.email}
            />
          )}

          {/* TAB 3: MARKETPLACE SECTIONS & TABS CMS */}
          {activeTab === 'marketplace-sections' && (
            <MarketplaceSectionsAdmin adminEmail={adminSession.email} />
          )}

          {/* TAB 4: SUBSCRIPTION STATUS */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Statuts d'Abonnement des Salons
                  </h1>
                  <p className="text-xs text-stone-400 mt-1">
                    Gérez les abonnements des établissements partenaires, tarifs garantis et suspensions d'accès ERP.
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
                            <span className="font-semibold text-[#E5C378]">{salon.planName}</span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            {formatPrice(salon.priceAtSubscription)} / mois
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                salon.status === 'active'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {salon.status === 'active' ? 'Abonné Actif' : 'Suspendu / Impayé'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-400">
                            {new Date(Date.now() + 25 * 86400000).toLocaleDateString('fr-FR')}
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

          {/* TAB 5: PLATFORM-WIDE SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Paramètres Globaux de la Plateforme
                </h1>
                <p className="text-xs text-stone-400 mt-1">
                  Configurez les règles financières, bannières d'annonce et alertes pour l'ensemble du SaaS.
                </p>
              </div>

              <form onSubmit={handleSavePlatformSettings} className="space-y-5 bg-[#0c0c10] border border-[#1a1a22] rounded-3xl p-6 sm:p-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                      Devise Officielle de la Plateforme
                    </label>
                    <input
                      type="text"
                      disabled
                      value={platformSettings.defaultCurrency}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-stone-400 disabled:opacity-60"
                    />
                    <span className="text-[10px] text-stone-500">
                      Standardisé en Franc CFA (XOF) sans arrondis flottants.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                      Frais de Service / Commission Marketplace (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        max={20}
                        value={platformSettings.commissionRate}
                        onChange={(e) =>
                          setPlatformSettings({ ...platformSettings, commissionRate: Number(e.target.value) })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-stone-500 font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                      Bannière d'Annonce Globale (Haut de page Marketplace)
                    </label>
                    <textarea
                      rows={2}
                      value={platformSettings.announcementBanner}
                      onChange={(e) =>
                        setPlatformSettings({ ...platformSettings, announcementBanner: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-stone-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.announcementActive}
                        onChange={(e) =>
                          setPlatformSettings({ ...platformSettings, announcementActive: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#C9A45C] bg-[#08080a] border-[#2e2e38] focus:ring-0"
                      />
                      <span>Afficher la bannière d'annonce aux visiteurs</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-semibold text-stone-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.autoApproveSalons}
                        onChange={(e) =>
                          setPlatformSettings({ ...platformSettings, autoApproveSalons: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#C9A45C] bg-[#08080a] border-[#2e2e38] focus:ring-0"
                      />
                      <span>Publication automatique des salons après inscription</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs font-semibold text-red-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platformSettings.maintenanceMode}
                        onChange={(e) =>
                          setPlatformSettings({ ...platformSettings, maintenanceMode: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-red-500 bg-[#08080a] border-[#2e2e38] focus:ring-0"
                      />
                      <span>Mode Maintenance Global (Verrouiller les nouvelles inscriptions)</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1a1a22] flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer les Paramètres</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* PLAN EDIT MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f0f13] border border-[#262632] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1c1c24] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#C9A45C]" />
                  <span>{editingPlan ? `Modifier le forfait « ${editingPlan.name} »` : 'Nouveau Forfait'}</span>
                </h3>
                <p className="text-xs text-stone-400">
                  Ajustez les prix, quotas et avantages visibles par les salons.
                </p>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#1a1a22]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Nom du forfait *
                  </label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Identifiant / Slug *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingPlan)}
                    value={planForm.slug}
                    onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C] disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#E5C378] mb-1.5">
                    Prix Mensuel (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={planForm.priceXof}
                    onChange={(e) => setPlanForm({ ...planForm, priceXof: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#C9A45C]/50 text-xs font-bold text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Étiquette Promotionnelle (Badge)
                  </label>
                  <input
                    type="text"
                    value={planForm.badgeText}
                    onChange={(e) => setPlanForm({ ...planForm, badgeText: e.target.value })}
                    placeholder="ex: Plus Populaire"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Nombre max de coiffeurs
                  </label>
                  <input
                    type="text"
                    value={planForm.maxStaff}
                    onChange={(e) => setPlanForm({ ...planForm, maxStaff: e.target.value })}
                    placeholder="Vide pour Illimité"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Succursales max
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={planForm.maxBranches}
                    onChange={(e) => setPlanForm({ ...planForm, maxBranches: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              {/* Features Editor */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider block">
                  Avantages ({planForm.features.length})
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {planForm.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => {
                          const updated = [...planForm.features];
                          updated[idx] = e.target.value;
                          setPlanForm({ ...planForm, features: updated });
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-1 rounded text-stone-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="+ Ajouter un avantage..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3 py-2 rounded-xl bg-[#1c1c24] text-xs font-semibold text-stone-200"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1c1c24]">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2 rounded-xl bg-[#C9A45C] text-[#101010] font-bold text-xs"
                >
                  {savingPlan ? 'Sauvegarde…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1c1c24]">
              <button
                type="button"
                onClick={() => setSelectedSalonForSub(null)}
                className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveSubscriptionOverride}
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
