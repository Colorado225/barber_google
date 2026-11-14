import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
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
  Phone,
  MapPin,
  Edit,
  Save,
  AlertCircle,
  Building,
} from 'lucide-react';
import {
  isSalonLiveOnMarketplace,
  setSalonPublicationByAdmin,
  setSalonStatusByAdmin,
  setSalonVerificationByAdmin,
  updateSalonDetailsByAdmin,
  validateAuditReason,
  type SalonAdminDetail,
} from '../../lib/superadmin';
import { useUI } from '../../context/UIContext';

export interface SalonManagementActions {
  setPublication: typeof setSalonPublicationByAdmin;
  setVerification: typeof setSalonVerificationByAdmin;
  setStatus: typeof setSalonStatusByAdmin;
  updateDetails: typeof updateSalonDetailsByAdmin;
}

interface SalonManagementProps {
  salons: SalonAdminDetail[];
  onRefresh: () => Promise<void> | void;
  adminEmail: string;
  actions?: Partial<SalonManagementActions>;
}

type FilterStatus = 'all' | 'verified' | 'unverified' | 'published' | 'hidden' | 'active' | 'suspended';

type PendingControlAction =
  | { kind: 'verify'; salon: SalonAdminDetail; nextValue: boolean }
  | { kind: 'publish'; salon: SalonAdminDetail; nextValue: boolean }
  | { kind: 'status'; salon: SalonAdminDetail; nextValue: 'active' | 'suspended' };

export const SalonManagement: React.FC<SalonManagementProps> = ({
  salons,
  onRefresh,
  adminEmail: _adminEmail,
  actions,
}) => {
  const { addToast, formatPrice } = useUI();
  const rpcActions: SalonManagementActions = {
    setPublication: actions?.setPublication ?? setSalonPublicationByAdmin,
    setVerification: actions?.setVerification ?? setSalonVerificationByAdmin,
    setStatus: actions?.setStatus ?? setSalonStatusByAdmin,
    updateDetails: actions?.updateDetails ?? updateSalonDetailsByAdmin,
  };

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedCommune, setSelectedCommune] = useState<string>('all');

  // Action + Motif confirmation modal state
  const [pendingAction, setPendingAction] = useState<PendingControlAction | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Detail & Edit Modal State
  const [selectedSalon, setSelectedSalon] = useState<SalonAdminDetail | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    organizationName: '',
    commune: '',
    phone: '',
    email: '',
    reason: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

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
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        salon.name.toLowerCase().includes(q) ||
        salon.commune.toLowerCase().includes(q) ||
        salon.organizationName.toLowerCase().includes(q) ||
        (salon.email && salon.email.toLowerCase().includes(q)) ||
        salon.phone.includes(searchQuery.trim());

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
  const publishedCount = salons.filter(isSalonLiveOnMarketplace).length;
  const suspendedCount = salons.filter((s) => s.status === 'suspended').length;

  // Open Confirmation + Motif modal
  const requestVerifyToggle = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionReason('');
    setActionError(null);
    setPendingAction({ kind: 'verify', salon, nextValue: !salon.isVerified });
  };

  const requestPublishToggle = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionReason('');
    setActionError(null);
    setPendingAction({ kind: 'publish', salon, nextValue: !salon.isPublished });
  };

  const requestStatusToggle = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionReason('');
    setActionError(null);
    setPendingAction({
      kind: 'status',
      salon,
      nextValue: salon.status === 'active' ? 'suspended' : 'active',
    });
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;

    setActionError(null);
    let validReason: string;
    try {
      validReason = validateAuditReason(actionReason);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Motif invalide.');
      return;
    }

    setActionBusy(true);
    try {
      let updatedSalon: SalonAdminDetail;
      if (pendingAction.kind === 'verify') {
        updatedSalon = await rpcActions.setVerification(
          pendingAction.salon.id,
          pendingAction.nextValue,
          validReason,
        );
        addToast(
          `Badge de certification ${pendingAction.nextValue ? 'accordé à' : 'retiré de'} « ${pendingAction.salon.name} ».`,
          pendingAction.nextValue ? 'success' : 'info',
        );
      } else if (pendingAction.kind === 'publish') {
        updatedSalon = await rpcActions.setPublication(
          pendingAction.salon.id,
          pendingAction.nextValue,
          validReason,
        );
        addToast(
          `Salon « ${pendingAction.salon.name} » ${pendingAction.nextValue ? 'publié sur la Marketplace' : 'masqué de la Marketplace'}.`,
          'info',
        );
      } else {
        updatedSalon = await rpcActions.setStatus(
          pendingAction.salon.id,
          pendingAction.nextValue,
          validReason,
        );
        addToast(
          pendingAction.nextValue === 'suspended'
            ? `Accès de « ${pendingAction.salon.name} » SUSPENDU et retiré de la marketplace.`
            : `Accès de « ${pendingAction.salon.name} » RÉACTIVÉ. Republiez-le pour le remettre en ligne.`,
          pendingAction.nextValue === 'suspended' ? 'error' : 'success',
        );
      }

      if (selectedSalon?.id === updatedSalon.id) {
        setSelectedSalon(updatedSalon);
      }
      await onRefresh();
      setPendingAction(null);
      setActionReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de l’opération serveur.';
      setActionError(msg);
      addToast(msg, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const openEditModal = (salon: SalonAdminDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedSalon(salon);
    setEditFormData({
      name: salon.name,
      organizationName: salon.organizationName,
      commune: salon.commune,
      phone: salon.phone,
      email: salon.email || '',
      reason: '',
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalon) return;
    setEditError(null);

    if (!editFormData.name.trim()) {
      setEditError('Le nom du salon est obligatoire.');
      return;
    }

    let validReason: string;
    try {
      validReason = validateAuditReason(editFormData.reason);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Motif invalide.');
      return;
    }

    const detailsChanged =
      editFormData.name.trim() !== selectedSalon.name ||
      editFormData.organizationName.trim() !== selectedSalon.organizationName ||
      editFormData.commune.trim() !== selectedSalon.commune ||
      editFormData.phone.trim() !== selectedSalon.phone ||
      editFormData.email.trim().toLowerCase() !== (selectedSalon.email || '').toLowerCase();

    if (!detailsChanged) {
      setEditError('Aucune modification détectée.');
      return;
    }

    setEditBusy(true);
    try {
      await rpcActions.updateDetails(
        selectedSalon.id,
        {
          name: editFormData.name.trim(),
          organizationName: editFormData.organizationName.trim(),
          commune: editFormData.commune.trim(),
          phone: editFormData.phone.trim(),
          email: editFormData.email.trim(),
        },
        validReason,
      );

      await onRefresh();
      addToast(`Informations du salon « ${editFormData.name.trim()} » enregistrées côté serveur.`, 'success');
      setIsEditModalOpen(false);
      setSelectedSalon(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour serveur.';
      setEditError(msg);
      addToast(msg, 'error');
    } finally {
      setEditBusy(false);
    }
  };

  const describePendingAction = (pending: PendingControlAction) => {
    if (pending.kind === 'verify') {
      return {
        title: pending.nextValue ? 'Certifier cet établissement' : 'Retirer la certification',
        summary: `${pending.salon.isVerified ? 'Certifié' : 'Non certifié'} → ${pending.nextValue ? 'Certifié' : 'Non certifié'}`,
        danger: false,
      };
    }
    if (pending.kind === 'publish') {
      return {
        title: pending.nextValue ? 'Publier sur la Marketplace' : 'Masquer de la Marketplace',
        summary: `${pending.salon.isPublished ? 'Publié' : 'Masqué'} → ${pending.nextValue ? 'Publié' : 'Masqué'}`,
        danger: false,
      };
    }
    return {
      title: pending.nextValue === 'suspended' ? 'Suspendre le salon' : 'Réactiver le salon',
      summary:
        pending.nextValue === 'suspended'
          ? 'Actif → Suspendu (vitrine dépubliée et réservations bloquées)'
          : 'Suspendu → Actif (reste masqué jusqu’à republication explicite)',
      danger: pending.nextValue === 'suspended',
    };
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
            Chaque décision est enregistrée dans le journal d’audit serveur avec motif obligatoire.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
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
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

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
              type="button"
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
                              {salon.organizationName || 'Organisation non renseignée'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-stone-300">
                        <div className="flex items-center gap-1 text-white font-medium">
                          <MapPin className="w-3 h-3 text-[#C9A45C]" />
                          <span>{salon.commune || '—'}</span>
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-stone-500" />
                          <span>{salon.phone || '—'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-[#E5C378]">
                          <span>{salon.planName || salon.planId || 'indisponible'}</span>
                          {salon.priceAtSubscription !== undefined ? (
                            <span className="text-[10px] text-stone-400">
                              ({formatPrice(salon.priceAtSubscription)}
                              {salon.subscriptionBillingPeriod === 'yearly'
                                ? '/an'
                                : salon.subscriptionBillingPeriod === 'monthly'
                                  ? '/m'
                                  : ''}
                              )
                            </span>
                          ) : (
                            <span className="text-[10px] font-normal text-stone-500">
                              (tarif indisponible)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Échéance :{' '}
                          {salon.currentPeriodEnd
                            ? new Date(salon.currentPeriodEnd).toLocaleDateString('fr-FR')
                            : 'indisponible'}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          {salon.appointmentsCount !== undefined && salon.totalRevenueXof !== undefined ? (
                            <>
                              {salon.completedAppointmentsCount !== undefined
                                ? `${salon.completedAppointmentsCount} réalisé(s) / ${salon.appointmentsCount} RDV`
                                : `${salon.appointmentsCount} RDV enregistrés`}{' '}
                              · Net : {formatPrice(salon.totalRevenueXof)}
                              {salon.refundsXof ? ` · Remb. : ${formatPrice(salon.refundsXof)}` : ''}
                              {salon.pendingPaymentsXof
                                ? ` · Attente : ${formatPrice(salon.pendingPaymentsXof)}`
                                : ''}
                            </>
                          ) : (
                            'Indicateurs non disponibles'
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
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

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => requestVerifyToggle(salon, e)}
                            aria-label={
                              salon.isVerified
                                ? `Retirer la certification de ${salon.name}`
                                : `Certifier ${salon.name}`
                            }
                            title={salon.isVerified ? 'Retirer la certification' : 'Certifier ce salon'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              salon.isVerified
                                ? 'bg-[#221c0e] border-[#C9A45C]/50 text-[#E5C378] hover:bg-[#322710]'
                                : 'bg-[#181820] border-[#292936] text-stone-400 hover:text-white'
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => requestPublishToggle(salon, e)}
                            aria-label={
                              salon.isPublished
                                ? `Masquer ${salon.name} de la Marketplace`
                                : `Publier ${salon.name} sur la Marketplace`
                            }
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

                          <button
                            type="button"
                            onClick={(e) => requestStatusToggle(salon, e)}
                            aria-label={isSuspended ? `Réactiver ${salon.name}` : `Suspendre ${salon.name}`}
                            title={isSuspended ? 'Réactiver le salon' : 'Suspendre le salon'}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              isSuspended
                                ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50'
                                : 'bg-red-950/40 border-red-800/40 text-red-300 hover:bg-red-900/50'
                            }`}
                          >
                            {isSuspended ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openEditModal(salon, e)}
                            aria-label={`Modifier ${salon.name}`}
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

      {/* ACTION + MANDATORY REASON MODAL */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmAction}
            className="bg-[#121217] border border-[#2b2b36] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            {(() => {
              const info = describePendingAction(pendingAction);
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white">{info.title}</h3>
                      <p className="text-xs text-stone-400 mt-1">{pendingAction.salon.name}</p>
                    </div>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setPendingAction(null)}
                      className="p-1.5 rounded-lg bg-[#1b1b22] text-stone-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="rounded-xl bg-[#181820] border border-[#282834] p-3 text-xs text-stone-300">
                    {info.summary}
                  </div>

                  <div>
                    <label
                      htmlFor="salon-action-reason"
                      className="block text-xs font-semibold text-stone-300 mb-1.5"
                    >
                      Motif de l’opération *
                    </label>
                    <input
                      id="salon-action-reason"
                      type="text"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Ex. Dossier vérifié, impayé confirmé, demande du gérant..."
                      className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  {actionError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{actionError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22222c]">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setPendingAction(null)}
                      className="px-4 py-2 rounded-xl bg-[#1c1c24] text-xs font-bold text-stone-300"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={actionBusy}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${
                        info.danger
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-[#C9A45C] text-[#101010] hover:bg-[#d6b36a]'
                      }`}
                    >
                      {actionBusy ? 'Enregistrement…' : 'Confirmer'}
                    </button>
                  </div>
                </>
              );
            })()}
          </form>
        </div>
      )}

      {/* DETAIL & EDIT MODAL */}
      {isEditModalOpen && selectedSalon && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                type="button"
                disabled={editBusy}
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl bg-[#1b1b22] text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedSalon.status === 'suspended' && selectedSalon.suspensionReason && (
              <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-xs text-red-200">
                Suspendu : {selectedSalon.suspensionReason}
              </div>
            )}

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
                  onClick={() => requestVerifyToggle(selectedSalon)}
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
                  onClick={() => requestStatusToggle(selectedSalon)}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Nom Commercial du Salon
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Raison Sociale / Entité
                  </label>
                  <input
                    type="text"
                    value={editFormData.organizationName}
                    onChange={(e) => setEditFormData({ ...editFormData, organizationName: e.target.value })}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Commune / Ville</label>
                  <input
                    type="text"
                    value={editFormData.commune}
                    onChange={(e) => setEditFormData({ ...editFormData, commune: e.target.value })}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Téléphone de contact
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Email professionnel
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div className="sm:col-span-2 rounded-2xl bg-[#181820] border border-[#282834] p-3.5 space-y-1.5 text-xs">
                  <div className="font-bold text-stone-200">
                    Abonnement SaaS & Paiement (lecture seule — source serveur)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-stone-400">
                    <div>
                      Forfait :{' '}
                      <span className="text-white font-semibold">
                        {selectedSalon.planName || selectedSalon.planId || 'indisponible'}
                      </span>
                    </div>
                    <div>
                      Tarif souscrit :{' '}
                      <span className="text-white font-semibold">
                        {selectedSalon.priceAtSubscription !== undefined
                          ? `${formatPrice(selectedSalon.priceAtSubscription)}${
                              selectedSalon.subscriptionBillingPeriod === 'yearly'
                                ? ' / an'
                                : selectedSalon.subscriptionBillingPeriod === 'monthly'
                                  ? ' / mois'
                                  : ''
                            }`
                          : 'indisponible'}
                      </span>
                    </div>
                    <div>
                      Statut contrat :{' '}
                      <span className="text-white font-semibold">
                        {selectedSalon.subscriptionStatus || 'indisponible'}
                      </span>
                    </div>
                    <div>
                      Échéance :{' '}
                      <span className="text-white font-semibold">
                        {selectedSalon.currentPeriodEnd
                          ? new Date(selectedSalon.currentPeriodEnd).toLocaleDateString('fr-FR')
                          : 'indisponible'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      Dernier paiement :{' '}
                      <span className="text-white font-semibold">
                        {selectedSalon.latestPayment
                          ? `${selectedSalon.latestPayment.status} · ${
                              selectedSalon.latestPayment.reference || 'indisponible'
                            }`
                          : 'indisponible'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 pt-1">
                    La modification locale ou directe de forfait est désactivée : le changement de formule
                    passe par la souscription côté salon et la validation du paiement dans « Statuts
                    d’Abonnement ».
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="salon-edit-reason"
                    className="block text-xs font-semibold text-stone-300 mb-1"
                  >
                    Motif de la modification *
                  </label>
                  <input
                    id="salon-edit-reason"
                    type="text"
                    value={editFormData.reason}
                    onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                    placeholder="Ex. Correction coordonnées gérant ou changement contractuel..."
                    className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              {editError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

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
                    disabled={editBusy}
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#1c1c24] hover:bg-[#252530] text-xs font-bold text-stone-300 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={editBusy}
                    className="px-5 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editBusy ? 'Enregistrement…' : 'Enregistrer modifications'}</span>
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
