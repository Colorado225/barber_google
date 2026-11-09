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
  CheckSquare,
} from 'lucide-react';
import type { SaaSPlan, PlatformMetrics, Salon } from '../../types';
import { getAllSaasPlans, saveSaasPlan, getPlatformMetrics } from '../../lib/saas';
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
import { useOptionalApp } from '../../context/AppContext';

export const SuperAdminConsoleView: React.FC = () => {
  const { addToast, formatPrice, salons: appSalons } = useOptionalApp();

  // Authentication State
  const [adminSession, setAdminSession] = useState<AdminUser | null>(() => getSuperAdminSession());

  // Active Tab: 'overview' | 'pricing' | 'salons' | 'marketplace' | 'audit'
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'salons' | 'marketplace' | 'audit'>(
    'overview',
  );

  // SaaS Plans & Metrics State
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [adminSalons, setAdminSalons] = useState<SalonAdminDetail[]>([]);
  const [reviews, setReviews] = useState<MarketplaceReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Plan Edit Modal State
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulaire d'édition de plan
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formBillingPeriod, setFormBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [formDescription, setFormDescription] = useState('');
  const [formFeatures, setFormFeatures] = useState<string[]>([]);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [formMaxStaff, setFormMaxStaff] = useState<string>('5');
  const [formMaxBranches, setFormMaxBranches] = useState(1);
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formBadgeText, setFormBadgeText] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);

  // Filter salons
  const [salonSearch, setSalonSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedPlans, fetchedMetrics] = await Promise.all([getAllSaasPlans(), getPlatformMetrics()]);
      setPlans(fetchedPlans);
      setMetrics(fetchedMetrics);
      setAdminSalons(getAdminSalonsList(appSalons));
      setReviews(getMarketplaceReviews());
      setAuditLogs(getAuditLogs());
    } catch {
      addToast('Erreur lors du chargement des données de la console', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminSession) {
      loadData();
    }
    const handleSessionChange = () => {
      setAdminSession(getSuperAdminSession());
    };
    const handleSalonsUpdate = () => {
      setAdminSalons(getAdminSalonsList(appSalons));
      setAuditLogs(getAuditLogs());
    };
    const handleReviewsUpdate = () => {
      setReviews(getMarketplaceReviews());
      setAuditLogs(getAuditLogs());
    };

    window.addEventListener('superadmin_session_changed', handleSessionChange);
    window.addEventListener('saas_plans_updated', loadData);
    window.addEventListener('admin_salons_updated', handleSalonsUpdate);
    window.addEventListener('admin_reviews_updated', handleReviewsUpdate);

    return () => {
      window.removeEventListener('superadmin_session_changed', handleSessionChange);
      window.removeEventListener('saas_plans_updated', loadData);
      window.removeEventListener('admin_salons_updated', handleSalonsUpdate);
      window.removeEventListener('admin_reviews_updated', handleReviewsUpdate);
    };
  }, [adminSession, appSalons]);

  if (!adminSession) {
    return (
      <AdminLoginForm
        onSuccess={(user) => {
          setAdminSession(user);
          addToast(`Bienvenue dans la Console Maître, ${user.name}`, 'success');
        }}
      />
    );
  }

  const handleLogout = () => {
    logoutSuperAdmin();
    setAdminSession(null);
    addToast('Session SuperAdmin clôturée avec succès.', 'info');
  };

  const openEditModal = (plan?: SaaSPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormName(plan.name);
      setFormSlug(plan.slug);
      setFormPrice(plan.priceXof);
      setFormBillingPeriod(plan.billingPeriod);
      setFormDescription(plan.description);
      setFormFeatures([...plan.features]);
      setFormMaxStaff(plan.maxStaff === null ? '' : String(plan.maxStaff));
      setFormMaxBranches(plan.maxBranches);
      setFormIsPopular(plan.isPopular);
      setFormIsActive(plan.isActive);
      setFormBadgeText(plan.badgeText || '');
      setFormDisplayOrder(plan.displayOrder);
    } else {
      const nextOrder = plans.length + 1;
      setEditingPlan(null);
      setFormName('Nouveau Forfait');
      setFormSlug(`plan-${Date.now()}`);
      setFormPrice(25000);
      setFormBillingPeriod('monthly');
      setFormDescription('Description de la nouvelle offre de gestion');
      setFormFeatures([
        'Accès complet au planning',
        'Caisse et encaissements Mobile Money',
        'Fichier clients CRM',
      ]);
      setFormMaxStaff('3');
      setFormMaxBranches(1);
      setFormIsPopular(false);
      setFormIsActive(true);
      setFormBadgeText('');
      setFormDisplayOrder(nextOrder);
    }
    setNewFeatureText('');
    setIsModalOpen(true);
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    setFormFeatures([...formFeatures, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const handleRemoveFeature = (index: number) => {
    setFormFeatures(formFeatures.filter((_, i) => i !== index));
  };

  const handleUpdateFeature = (index: number, val: string) => {
    const updated = [...formFeatures];
    updated[index] = val;
    setFormFeatures(updated);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPrice < 0) {
      addToast('Le tarif ne peut pas être négatif', 'error');
      return;
    }
    if (!formName.trim()) {
      addToast('Le nom du forfait est requis', 'error');
      return;
    }

    setSaving(true);
    try {
      const planToSave: SaaSPlan = {
        id: editingPlan ? editingPlan.id : formSlug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: formName.trim(),
        slug: formSlug.trim() || formName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        priceXof: Number(formPrice),
        billingPeriod: formBillingPeriod,
        description: formDescription.trim(),
        features: formFeatures.filter((f) => f.trim().length > 0),
        maxStaff: formMaxStaff.trim() === '' ? null : Number(formMaxStaff),
        maxBranches: Number(formMaxBranches) || 1,
        isPopular: formIsPopular,
        isActive: formIsActive,
        badgeText: formBadgeText.trim() ? formBadgeText.trim() : null,
        displayOrder: Number(formDisplayOrder),
      };

      await saveSaasPlan(planToSave);
      addToast(
        `Forfait "${planToSave.name}" mis à jour : les nouveaux tarifs sont répercutés immédiatement sur la Marketplace et le portail d'abonnement !`,
        'success',
      );
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSalonPublish = (salon: SalonAdminDetail) => {
    const newPub = !salon.isPublished;
    updateSalonByAdmin(salon.id, { isPublished: newPub }, adminSession.email);
    addToast(
      `Salon "${salon.name}" ${newPub ? 'publié sur la Marketplace' : 'masqué de la Marketplace'}.`,
      'info',
    );
  };

  const handleToggleSalonStatus = (salon: SalonAdminDetail) => {
    const newStatus = salon.status === 'active' ? 'suspended' : 'active';
    updateSalonByAdmin(salon.id, { status: newStatus }, adminSession.email);
    addToast(
      `Salon "${salon.name}" ${newStatus === 'suspended' ? 'suspendu de la plateforme' : 'réactivé'}.`,
      newStatus === 'suspended' ? 'error' : 'success',
    );
  };

  const handleDeleteReview = (review: MarketplaceReviewItem) => {
    deleteReviewByAdmin(review.id, adminSession.email);
    addToast(`Avis de ${review.author} supprimé pour motif de modération.`, 'info');
  };

  const filteredSalons = adminSalons.filter(
    (s) =>
      s.name.toLowerCase().includes(salonSearch.toLowerCase()) ||
      s.commune.toLowerCase().includes(salonSearch.toLowerCase()) ||
      s.planName.toLowerCase().includes(salonSearch.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#070709] text-[#f7f6f2] p-4 sm:p-6 lg:p-10 font-sans selection:bg-[#C9A45C] selection:text-[#101010]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Control Bar with SuperAdmin identity */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#22222a] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#C9A45C]/20 text-[#E5C378] border border-[#C9A45C]/40 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
                Super Admin Console
              </span>
              <span className="text-xs text-stone-500">• Tour de Contrôle ERP & Marketplace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Administration Centrale de la Plateforme
            </h1>
            <p className="text-xs sm:text-sm text-stone-400">
              Session active : <strong className="text-white">{adminSession.email}</strong> (
              <span className="text-[#C9A45C]">Super Administrateur</span>)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/tarifs"
              target="_blank"
              className="px-3.5 py-2 rounded-xl bg-[#131317] hover:bg-[#1a1a21] border border-[#2b2b34] text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>Aperçu Tarifs Publics</span>
            </Link>
            <Link
              to="/"
              className="px-3.5 py-2 rounded-xl bg-[#131317] hover:bg-[#1a1a21] border border-[#2b2b34] text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Voir Marketplace</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 text-xs font-bold text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Clôturer la session SuperAdmin"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Global SaaS Platform KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#0e0e12] border border-[#202028] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                MRR Abonnements SaaS
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#C9A45C]/15 flex items-center justify-center text-[#C9A45C]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {metrics ? formatPrice(metrics.estimatedMrrXof) : '—'}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span>Revenu mensuel récurrent prévisionnel</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e0e12] border border-[#202028] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Abonnements Actifs
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {metrics ? metrics.activeSubscriptions : '—'}
            </div>
            <div className="text-[11px] text-stone-400">Salons souscripteurs en règle</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e0e12] border border-[#202028] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Salons Réseau (Tenants)
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{adminSalons.length}</div>
            <div className="text-[11px] text-stone-400">
              {adminSalons.filter((s) => s.isPublished).length} publiés sur la Marketplace
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e0e12] border border-[#202028] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Volume d'Affaires Global
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {metrics ? formatPrice(metrics.totalRevenueXof) : '—'}
            </div>
            <div className="text-[11px] text-stone-400">Transactions confirmées tous ERPs confondus</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#202027] pb-1">
          {[
            { id: 'overview', label: 'Vue d’Ensemble', icon: Activity },
            { id: 'pricing', label: 'Tarifs & Forfaits SaaS', icon: DollarSign },
            { id: 'salons', label: 'Salons & ERPs Partenaires', icon: Store, count: adminSalons.length },
            {
              id: 'marketplace',
              label: 'Modération Marketplace',
              icon: MessageSquare,
              count: reviews.length,
            },
            { id: 'audit', label: 'Journal d’Audit & Sécurité', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#C9A45C] text-[#101010] shadow-sm'
                    : 'text-stone-400 hover:text-white hover:bg-[#141418]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-[#101010] text-[#C9A45C]' : 'bg-[#22222a] text-stone-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-[#0f0f13] border border-[#22222a] space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C9A45C]" />
                <span>État Global de la Plateforme BarberCuts</span>
              </h2>
              <p className="text-xs text-stone-300 leading-relaxed max-w-3xl">
                Cette console centrale vous permet d'administrer l'ensemble du parc de salons, de modifier les
                tarifs et avantages SaaS en direct avec répercussion instantanée, de modérer les avis de la
                Marketplace et de surveiller l'intégrité financière.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <button
                  onClick={() => setActiveTab('pricing')}
                  className="p-4 rounded-2xl bg-[#141418] hover:bg-[#1a1a21] border border-[#25252e] text-left transition-all group"
                >
                  <DollarSign className="w-5 h-5 text-[#C9A45C] mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-bold text-white">Gestionnaire de Prix & Plans</div>
                  <p className="text-xs text-stone-400 mt-1">
                    Ajuster les tarifs FCFA, quotas de coiffeurs et avantages pour les prochains abonnés.
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('salons')}
                  className="p-4 rounded-2xl bg-[#141418] hover:bg-[#1a1a21] border border-[#25252e] text-left transition-all group"
                >
                  <Store className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-bold text-white">Contrôle des Salons & ERPs</div>
                  <p className="text-xs text-stone-400 mt-1">
                    Publier sur la marketplace, suspendre en cas d'impayé ou changer de forfait.
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="p-4 rounded-2xl bg-[#141418] hover:bg-[#1a1a21] border border-[#25252e] text-left transition-all group"
                >
                  <MessageSquare className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-bold text-white">Modération Marketplace</div>
                  <p className="text-xs text-stone-400 mt-1">
                    Contrôler les avis clients, supprimer les faux commentaires et préserver la réputation.
                  </p>
                </button>
              </div>
            </div>

            {/* Quick summary of recent salons */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Derniers Salons Enregistrés sur le Réseau
              </h3>
              <div className="rounded-2xl bg-[#0f0f13] border border-[#22222a] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141418] border-b border-[#22222a] text-stone-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Établissement</th>
                      <th className="py-3 px-4">Commune</th>
                      <th className="py-3 px-4">Forfait Actif</th>
                      <th className="py-3 px-4">Tarif Souscrit</th>
                      <th className="py-3 px-4">Marketplace</th>
                      <th className="py-3 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b1b22] text-stone-300">
                    {adminSalons.slice(0, 5).map((salon) => (
                      <tr key={salon.id} className="hover:bg-[#141418]/60">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-[#C9A45C]" />
                          <span>{salon.name}</span>
                        </td>
                        <td className="py-3 px-4 text-stone-400">{salon.commune}</td>
                        <td className="py-3 px-4 font-semibold text-[#E5C378]">{salon.planName}</td>
                        <td className="py-3 px-4 font-bold text-white">
                          {formatPrice(salon.priceAtSubscription)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              salon.isPublished
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {salon.isPublished ? 'En Ligne' : 'Hors Ligne'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              salon.status === 'active'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {salon.status === 'active' ? 'Opérationnel' : 'Suspendu'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRICING & SAAS PLANS */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[#15151a] border border-[#C9A45C]/30 flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-[#C9A45C]/15 text-[#C9A45C] shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-[#E5C378]">
                  Moteur de Tarification & Règle des Souscripteurs Ultérieurs
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Lorsque vous modifiez un prix en FCFA ou des avantages ci-dessous, la page publique{' '}
                  <Link to="/tarifs" target="_blank" className="text-[#C9A45C] underline">
                    /tarifs
                  </Link>{' '}
                  et la Marketplace s'actualisent <strong>automatiquement</strong>. Tous les salons qui
                  souscriront ultérieurement payeront le nouveau tarif. Les salons déjà abonnés conservent
                  leur prix contractuel initial garanti.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Plans & Formules SaaS</h2>
                <p className="text-xs text-stone-400">
                  Configurez les tarifs, les quotas de personnel et la liste des avantages offerts.
                </p>
              </div>

              <button
                onClick={() => openEditModal()}
                className="px-4 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Forfait</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-3xl bg-[#0e0e12] border transition-all flex flex-col justify-between relative overflow-hidden ${
                    plan.isPopular
                      ? 'border-[#C9A45C] shadow-lg shadow-[#C9A45C]/5'
                      : 'border-[#22222a] hover:border-[#383844]'
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

                    <div className="border-y border-[#1d1d25] py-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-[#E5C378]">
                          {formatPrice(plan.priceXof)}
                        </span>
                        <span className="text-xs text-stone-400">/ mois</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#131317] border border-[#202028]">
                        <span className="text-[10px] text-stone-400 block uppercase">Capacité Staff</span>
                        <span className="font-bold text-white">
                          {plan.maxStaff === null ? 'Illimité' : `${plan.maxStaff} coiffeur(s)`}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#131317] border border-[#202028]">
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

                  <div className="p-4 bg-[#121216] border-t border-[#1d1d24] flex items-center justify-between">
                    <div className="text-xs text-stone-400">
                      <span className="font-semibold text-stone-300">{plan.subscribersCount ?? 0}</span>{' '}
                      salon(s) abonné(s)
                    </div>
                    <button
                      onClick={() => openEditModal(plan)}
                      className="px-3 py-1.5 rounded-lg bg-[#1d1d24] hover:bg-[#272730] text-stone-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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

        {/* TAB 3: SALONS & ERPS PARTNERS */}
        {activeTab === 'salons' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Gestion de Tous les Établissements (Multi-Tenants)
                </h2>
                <p className="text-xs text-stone-400">
                  Surveillez l'activité des salons, validez leur publication ou suspendez l'accès en cas
                  d'impayé.
                </p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={salonSearch}
                  onChange={(e) => setSalonSearch(e.target.value)}
                  placeholder="Rechercher par nom, commune, forfait…"
                  className="pl-9 pr-4 py-2 rounded-xl bg-[#0e0e12] border border-[#25252d] text-xs text-white placeholder-stone-500 w-64 focus:outline-none focus:border-[#C9A45C]"
                />
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-3" />
              </div>
            </div>

            <div className="rounded-2xl bg-[#0e0e12] border border-[#22222a] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141418] border-b border-[#22222a] text-stone-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Établissement</th>
                      <th className="py-3 px-4">Organisation / Contact</th>
                      <th className="py-3 px-4">Formule SaaS Active</th>
                      <th className="py-3 px-4">Tarif Souscrit</th>
                      <th className="py-3 px-4">Marketplace</th>
                      <th className="py-3 px-4">Statut ERP</th>
                      <th className="py-3 px-4 text-right">Actions SuperAdmin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b1b22] text-stone-300">
                    {filteredSalons.map((salon) => (
                      <tr key={salon.id} className="hover:bg-[#141418]/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-[#C9A45C]" />
                            <div>
                              <div>{salon.name}</div>
                              <div className="text-[10px] text-stone-500 font-normal">{salon.commune}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-white">{salon.organizationName}</div>
                          <div className="text-[10px] text-stone-400">{salon.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-[#E5C378]">{salon.planName}</span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {formatPrice(salon.priceAtSubscription)}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleSalonPublish(salon)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              salon.isPublished
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                            }`}
                          >
                            {salon.isPublished ? '● Publié' : '○ Masqué'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              salon.status === 'active'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {salon.status === 'active' ? 'Opérationnel' : 'Suspendu'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleToggleSalonStatus(salon)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              salon.status === 'active'
                                ? 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/50'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50'
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

        {/* TAB 4: MARKETPLACE MODERATION */}
        {activeTab === 'marketplace' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Modération des Avis & Commentaires Publics</h2>
              <p className="text-xs text-stone-400">
                Surveillez les avis déposés par les clients et supprimez les contenus inappropriés ou
                frauduleux.
              </p>
            </div>

            <div className="space-y-3">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-2xl bg-[#0e0e12] border border-[#22222a] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{rev.author}</span>
                      <span className="text-[10px] text-stone-500">• sur</span>
                      <span className="text-xs font-semibold text-[#E5C378]">{rev.salonName}</span>
                      <div className="flex items-center text-amber-400 text-xs font-bold ml-2">
                        ★ {rev.rating}/5
                      </div>
                      {rev.isVerified && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Avis Vérifié (RDV Terminé)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-300 italic">« {rev.comment} »</p>
                    <div className="text-[10px] text-stone-500">
                      Posté le {new Date(rev.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteReview(rev)}
                    className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-xs font-semibold text-red-300 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer cet avis</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Journal d'Audit & Sécurité de la Plateforme</h2>
              <p className="text-xs text-stone-400">
                Historique chronologique et immuable de toutes les opérations administratives sensibles.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0e0e12] border border-[#22222a] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141418] border-b border-[#22222a] text-stone-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date & Heure</th>
                      <th className="py-3 px-4">Action Effectuée</th>
                      <th className="py-3 px-4">Cible</th>
                      <th className="py-3 px-4">Opérateur</th>
                      <th className="py-3 px-4">Niveau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b1b22] text-stone-300 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#141418]/60">
                        <td className="py-3 px-4 text-stone-400">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-white font-sans">{log.action}</td>
                        <td className="py-3 px-4 text-[#E5C378]">{log.target}</td>
                        <td className="py-3 px-4 text-stone-300">{log.performedBy}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.severity === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : log.severity === 'warning'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {log.severity.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL D'ÉDITION DE PLAN SAAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#101014] border border-[#2d2d38] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#24242d] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#C9A45C]" />
                  <span>
                    {editingPlan ? `Modifier le forfait « ${editingPlan.name} »` : 'Créer un nouveau forfait'}
                  </span>
                </h3>
                <p className="text-xs text-stone-400">
                  Ajustez les prix, quotas et avantages visibles par les salons.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#1d1d24]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Nom de l'offre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ex: Pro Équipe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#25252e] text-sm text-white focus:outline-none focus:border-[#C9A45C]"
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
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="ex: pro-equipe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#25252e] text-sm text-white focus:outline-none focus:border-[#C9A45C] disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#E5C378] mb-1.5">
                    Tarif mensuel (FCFA / XOF) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0}
                      step={500}
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#C9A45C]/50 text-sm font-bold text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-stone-400 font-semibold">
                      FCFA
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Badge Promotionnel / Étiquette
                  </label>
                  <input
                    type="text"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    placeholder="ex: Plus Populaire, Recommandé..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#25252e] text-sm text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  Description courte
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Résumé attrayant de la cible visée par cette formule..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#25252e] text-sm text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Coiffeurs / Barbiers autorisés
                  </label>
                  <input
                    type="text"
                    value={formMaxStaff}
                    onChange={(e) => setFormMaxStaff(e.target.value)}
                    placeholder="Nombre ou laissez vide pour Illimité"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#25252e] text-sm text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Nombre maximum de salons
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formMaxBranches}
                    onChange={(e) => setFormMaxBranches(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#25252e] text-sm text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider block">
                  Avantages Inclus ({formFeatures.length})
                </label>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formFeatures.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#C9A45C]/20 text-[#C9A45C] flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => handleUpdateFeature(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#08080a] border border-[#25252e] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-[#1a1212] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
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
                    placeholder="+ Ajouter un nouvel avantage ou une fonctionnalité..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#08080a] border border-[#25252e] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3.5 py-2 rounded-xl bg-[#1e1e26] hover:bg-[#282832] text-stone-200 text-xs font-semibold transition-colors"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[#22222a]">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPopular}
                    onChange={(e) => setFormIsPopular(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C9A45C] bg-[#08080a] border-[#3b3b44] focus:ring-0"
                  />
                  <span>Mettre en avant (« Plus Populaire »)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C9A45C] bg-[#08080a] border-[#3b3b44] focus:ring-0"
                  />
                  <span>Actif & Visible sur la Marketplace</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#22222a]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#1c1c24] hover:bg-[#252530] text-stone-300 text-xs font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Enregistrer & Répercuter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
