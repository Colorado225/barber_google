import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Ban,
  RotateCcw,
  Store,
  Eye,
  EyeOff,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Edit,
  Save,
  AlertCircle,
  Building,
  UserCheck,
} from 'lucide-react';
import type { SalonAdminDetail } from '../../lib/superadmin';
import type { SaaSPlan } from '../../types';
import { isSalonLiveOnMarketplace } from '../../lib/superadmin';
import {
  assignPlatformSalonPlan,
  setPlatformSalonPublication,
  setPlatformSalonStatus,
  setPlatformSalonVerification,
} from '../../lib/platform-admin';
import { useOptionalApp } from '../../context/AppContext';
import { ReasonDialog } from './ReasonDialog';

interface SalonManagementProps {
  salons: SalonAdminDetail[];
  plans: SaaSPlan[];
  /** Relit la liste depuis la base après chaque décision. */
  onRefresh: () => void | Promise<void>;
}

type FilterStatus = 'all' | 'verified' | 'unverified' | 'published' | 'hidden' | 'active' | 'suspended';

export const SalonManagement: React.FC<SalonManagementProps> = ({ salons, plans, onRefresh }) => {
  const { addToast, formatPrice } = useOptionalApp();

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedCommune, setSelectedCommune] = useState<string>('all');

  // Detail & Edit Modal State
  const [selectedSalon, setSelectedSalon] = useState<SalonAdminDetail | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ planId: '', reason: '' });
  const [editError, setEditError] = useState<string | null>(null);
  // Suspension : fenêtre de motif ouverte pour ce salon.
  const [suspendTarget, setSuspendTarget] = useState<SalonAdminDetail | null>(null);

  // Unique communes list
  const communes = useMemo(() => {
    const set = new Set<string>();
    salons.forEach((s) => {
      if (s.commune) set.add(s.commune);
    });
    return Array.from(set).sort();
  }, [salons]);

  // Filtered Salons
  const filteredSalons = useMemo(() => {
    return salons.filter((salon) => {
      const matchSearch =
        !searchQuery.trim() ||
        salon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        salon.commune.toLowerCase().includes(searchQuery.toLowerCase()) ||
        salon.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.email && salon.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        salon.phone.includes(searchQuery);

      const matchCommune = selectedCommune === 'all' || salon.commune === selectedCommune;

      let matchStatus = true;
      if (statusFilter === 'verified') matchStatus = salon.isVerified;
      else if (statusFilter === 'unverified') matchStatus = !salon.isVerified;
      else if (statusFilter === 'published') matchStatus = isSalonLiveOnMarketplace(salon);
      else if (statusFilter === 'hidden') matchStatus = !isSalonLiveOnMarketplace(salon);
      else if (statusFilter === 'active') matchStatus = salon.status === 'active';
      else if (statusFilter === 'suspended') matchStatus = salon.status === 'suspended';

      return matchSearch && matchCommune && matchStatus;
    });
  }, [salons, searchQuery, selectedCommune, statusFilter]);

  // KPI counters
  const totalCount = salons.length;
  const verifiedCount = salons.filter((s) => s.isVerified).length;
  // « En ligne » = publié ET accès non suspendu (un salon suspendu n'est jamais visible)
  const publishedCount = salons.filter(isSalonLiveOnMarketplace).length;
  const suspendedCount = salons.filter((s) => s.status === 'suspended').length;

  // Actions : chaque décision est envoyée à la base (RPC), tracée côté serveur, puis la liste est relue.
  const runAction = async (work: () => Promise<void>, successMessage: string) => {
    try {
      await work();
      addToast(successMessage, 'success');
      await onRefresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'L’action a échoué.', 'error');
    }
  };

  const handleToggleVerify = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newVerified = !salon.isVerified;
    void runAction(
      () => setPlatformSalonVerification(salon.id, newVerified),
      `Badge de certification ${newVerified ? 'accordé à' : 'retiré de'} "${salon.name}".`,
    );
  };

  const handleTogglePublish = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newPublished = !salon.isPublished;
    void runAction(
      () => setPlatformSalonPublication(salon.id, newPublished),
      `Salon "${salon.name}" ${newPublished ? 'visible sur la Marketplace' : 'masqué de la Marketplace'}.`,
    );
  };

  // Suspension : motif obligatoire (fenêtre dédiée). La réactivation ne demande pas de motif.
  const handleToggleStatus = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (salon.status === 'active') {
      setSuspendTarget(salon);
      return;
    }
    void runAction(
      () => setPlatformSalonStatus(salon.id, 'active').then(() => undefined),
      `Accès de "${salon.name}" réactivé. Le salon reste masqué : republiez-le pour le remettre en ligne.`,
    );
  };

  const confirmSuspension = async (reason: string) => {
    if (!suspendTarget) return;
    const target = suspendTarget;
    await setPlatformSalonStatus(target.id, 'suspended', reason);
    setSuspendTarget(null);
    addToast(`Accès de "${target.name}" suspendu et retiré de la marketplace.`, 'error');
    await onRefresh();
  };

  const openEditModal = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedSalon(salon);
    setEditFormData({ planId: salon.planId, reason: '' });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalon) return;
    if (!editFormData.planId) {
      setEditError('Choisissez une formule.');
      return;
    }
    if (editFormData.planId === selectedSalon.planId) {
      setEditError('Cette formule est déjà attribuée à ce salon.');
      return;
    }
    if (!editFormData.reason.trim()) {
      setEditError('Le motif est obligatoire.');
      return;
    }
    try {
      await assignPlatformSalonPlan(selectedSalon.id, editFormData.planId, editFormData.reason.trim());
      addToast(`Formule de "${selectedSalon.name}" mise à jour.`, 'success');
      setIsEditModalOpen(false);
      setSelectedSalon(null);
      await onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'L’attribution a échoué.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f1f27]">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#C9A45C] flex items-center gap-1.5">
            <Store className="w-4 h-4" />
            CONSOLE LOCATAIRES · SUPERADMIN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Gestion des Salons Locataires (Marketplace & ERP)
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Inspectez, certifiez, publiez ou suspendez les accès et vitrines des établissements partenaires.
          </p>
          <p className="mt-2 text-[11px] text-amber-300/90 max-w-2xl">
            Stockage local : certifications, publications et suspensions sont enregistrées dans ce navigateur
            uniquement. Les visiteurs ne voient pas encore ces changements, la persistance serveur reste à
            brancher.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-3.5 py-2 rounded-xl bg-[#17171d] hover:bg-[#22222a] border border-[#2c2c36] text-xs font-bold text-stone-300 hover:text-white flex items-center gap-2 self-start sm:self-auto transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Actualiser la liste</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Total Locataires</span>
            <Building className="w-4 h-4 text-stone-500" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{totalCount}</div>
          <div className="text-[11px] text-stone-500 mt-1">Établissements enregistrés</div>
        </div>

        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Certifiés Officiels</span>
            <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
          </div>
          <div className="text-2xl font-black text-[#E5C378] mt-2">{verifiedCount}</div>
          <div className="text-[11px] text-emerald-400 mt-1">
            {totalCount ? Math.round((verifiedCount / totalCount) * 100) : 0}% de conformité d’élite
          </div>
        </div>

        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Publiés Marketplace</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{publishedCount}</div>
          <div className="text-[11px] text-stone-500 mt-1">Visibles par les clients finaux</div>
        </div>

        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span>Salons Suspendus</span>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 mt-2">{suspendedCount}</div>
          <div className="text-[11px] text-stone-500 mt-1">
            {suspendedCount > 0 ? 'Accès & réservations bloqués' : 'Aucun salon en litige'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, gérant, téléphone, commune..."
              className="w-full bg-[#18181f] border border-[#2b2b36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Commune Filter Dropdown */}
          <div className="relative shrink-0 md:w-48">
            <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <select
              value={selectedCommune}
              onChange={(e) => setSelectedCommune(e.target.value)}
              className="w-full bg-[#18181f] border border-[#2b2b36] rounded-xl pl-9 pr-8 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            >
              <option value="all">Toutes communes ({communes.length})</option>
              {communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1f1f28]">
          <span className="text-[11px] font-bold text-stone-400 mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtrer :
          </span>
          {[
            { id: 'all', label: `Tous (${salons.length})` },
            { id: 'verified', label: `Certifiés (${verifiedCount})` },
            { id: 'unverified', label: `Non certifiés (${totalCount - verifiedCount})` },
            { id: 'published', label: `Publiés (${publishedCount})` },
            { id: 'hidden', label: `Masqués (${totalCount - publishedCount})` },
            { id: 'active', label: `Actifs (${totalCount - suspendedCount})` },
            { id: 'suspended', label: `Suspendus (${suspendedCount})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id as FilterStatus)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === item.id
                  ? 'bg-[#C9A45C] text-[#101010] shadow-sm font-bold'
                  : 'bg-[#18181f] text-stone-400 hover:text-white border border-[#292934]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Salons Table */}
      <div className="bg-[#121216] border border-[#22222a] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#22222a] bg-[#16161c] text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                <th className="py-3 px-4">Établissement & Locataire</th>
                <th className="py-3 px-4">Commune & Contact</th>
                <th className="py-3 px-4">Forfait SaaS & CA</th>
                <th className="py-3 px-4">Statuts</th>
                <th className="py-3 px-4 text-right">Actions de Contrôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e26] text-xs">
              {filteredSalons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    <Store className="w-8 h-8 mx-auto text-stone-600 mb-2" />
                    Aucun salon ne correspond à vos filtres de recherche.
                  </td>
                </tr>
              ) : (
                filteredSalons.map((salon) => {
                  const isSuspended = salon.status === 'suspended';

                  return (
                    <tr
                      key={salon.id}
                      onClick={() => openEditModal(salon)}
                      className={`hover:bg-[#181820] transition-colors cursor-pointer ${
                        isSuspended ? 'bg-red-950/10' : ''
                      }`}
                    >
                      {/* Name & Org */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSuspended
                                ? 'bg-red-950/50 text-red-400 border border-red-800/50'
                                : salon.isVerified
                                  ? 'bg-[#211d13] text-[#C9A45C] border border-[#C9A45C]/40'
                                  : 'bg-[#1a1a22] text-stone-300 border border-[#2f2f3c]'
                            }`}
                          >
                            {salon.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-white">
                              <span className="truncate">{salon.name}</span>
                              {salon.isVerified && (
                                <span title="Salon Certifié BarberCuts" className="text-[#C9A45C]">
                                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate">
                              {salon.organizationName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Commune & Contact */}
                      <td className="py-3.5 px-4 text-stone-300">
                        <div className="flex items-center gap-1 text-white font-medium">
                          <MapPin className="w-3 h-3 text-[#C9A45C]" />
                          <span>{salon.commune}</span>
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-stone-500" />
                          <span>{salon.phone || '—'}</span>
                        </div>
                      </td>

                      {/* SaaS Plan & Stats */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-[#E5C378]">
                          <span>{salon.planName || 'Formule non disponible'}</span>
                          {salon.planName && (
                            <span className="text-[10px] text-stone-400">
                              ({formatPrice(salon.priceAtSubscription)}/m)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          {salon.appointmentsCount !== undefined && salon.totalRevenueXof !== undefined
                            ? `${salon.appointmentsCount} rdv · CA : ${formatPrice(salon.totalRevenueXof)}`
                            : 'Indicateurs non disponibles'}
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          {/* Active / Suspended */}
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-800/40 w-fit">
                              <Ban className="w-3 h-3" />
                              Accès Suspendu
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 w-fit">
                              <Check className="w-3 h-3" />
                              Compte Actif
                            </span>
                          )}

                          {/* Marketplace publication (visibilité réelle : publié et non suspendu) */}
                          {isSalonLiveOnMarketplace(salon) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-300">
                              <Eye className="w-3 h-3 text-blue-400" />
                              En ligne sur Marketplace
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-stone-500">
                              <EyeOff className="w-3 h-3 text-stone-500" />
                              Masqué Marketplace
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Controls */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Verified */}
                          <button
                            onClick={(e) => handleToggleVerify(salon, e)}
                            title={salon.isVerified ? 'Retirer la certification' : 'Certifier ce salon'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              salon.isVerified
                                ? 'bg-[#221c0e] border-[#C9A45C]/50 text-[#E5C378] hover:bg-[#322710]'
                                : 'bg-[#181820] border-[#292936] text-stone-400 hover:text-white'
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                          {/* Toggle Publish */}
                          <button
                            onClick={(e) => handleTogglePublish(salon, e)}
                            title={
                              salon.isPublished ? 'Masquer de la Marketplace' : 'Publier sur la Marketplace'
                            }
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              salon.isPublished
                                ? 'bg-blue-950/40 border-blue-800/50 text-blue-300 hover:bg-blue-900/50'
                                : 'bg-[#181820] border-[#292936] text-stone-400 hover:text-white'
                            }`}
                          >
                            {salon.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>

                          {/* Toggle Suspend/Active */}
                          <button
                            onClick={(e) => handleToggleStatus(salon, e)}
                            title={isSuspended ? 'Réactiver le salon' : 'Suspendre le salon'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              isSuspended
                                ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50'
                                : 'bg-red-950/40 border-red-800/40 text-red-300 hover:bg-red-900/50'
                            }`}
                          >
                            {isSuspended ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>

                          {/* Edit / Detail modal trigger */}
                          <button
                            onClick={(e) => openEditModal(salon, e)}
                            title="Inspecter et modifier"
                            className="p-1.5 rounded-lg bg-[#181820] border border-[#292936] text-stone-300 hover:text-white hover:bg-[#252532] cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL & EDIT MODAL */}
      {suspendTarget && (
        <ReasonDialog
          title={`Suspendre « ${suspendTarget.name} »`}
          description="Le salon perd son accès ERP et disparaît de la marketplace. Le motif est conservé dans le journal d’audit."
          confirmLabel="Suspendre l’accès"
          tone="danger"
          onConfirm={confirmSuspension}
          onCancel={() => setSuspendTarget(null)}
        />
      )}
      {isEditModalOpen && selectedSalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121217] border border-[#2b2b36] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#22222c]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#211d13] border border-[#C9A45C]/40 text-[#C9A45C] flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Édition Fiche Locataire</h3>
                  <p className="text-xs text-stone-400">ID : {selectedSalon.id}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl bg-[#1b1b22] text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Status Control Bar inside modal */}
            <div className="bg-[#181820] border border-[#282834] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Actions Immédiates</span>
                <span className="text-[11px] text-stone-400">
                  {selectedSalon.isVerified ? '✓ Établissement Certifié' : 'Certification non accordée'} ·{' '}
                  {selectedSalon.status === 'active' ? 'Compte Opérationnel' : 'Compte Suspendu'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleVerify(selectedSalon)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    selectedSalon.isVerified
                      ? 'bg-[#221c0e] text-[#E5C378] border border-[#C9A45C]/40'
                      : 'bg-[#252530] text-stone-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {selectedSalon.isVerified ? 'Certifié' : 'Certifier'}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(selectedSalon)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    selectedSalon.status === 'suspended'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                      : 'bg-red-950/60 text-red-300 border border-red-800/50'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {selectedSalon.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                </button>
              </div>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <p className="text-[11px] text-stone-500">
                Nom, commune et coordonnées : lecture seule ici (non modifiables par cette console).
              </p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Formule SaaS assignée
                  </label>
                  <select
                    value={editFormData.planId}
                    onChange={(e) => setEditFormData({ ...editFormData, planId: e.target.value })}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({formatPrice(plan.priceXof)} / mois)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Motif de l’attribution (obligatoire)
                  </label>
                  <textarea
                    value={editFormData.reason}
                    onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                    rows={2}
                    maxLength={500}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
                {editError && (
                  <p role="alert" className="text-xs text-red-300">
                    {editError}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#22222c]">
                <a
                  href={`/?salon=${encodeURIComponent(selectedSalon.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#C9A45C] hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Voir page publique de réservation</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#1c1c24] hover:bg-[#252530] text-xs font-bold text-stone-300 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Enregistrer modifications</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
