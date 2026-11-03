import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { LoyaltyReward, RewardCategory, Client, LoyaltyTransaction } from '../../types';
import {
  Award,
  Gift,
  Plus,
  Search,
  Star,
  CheckCircle2,
  Trash2,
  Edit,
  Sparkles,
  UserCheck,
  TrendingUp,
  Settings,
  History,
  Clock,
  Phone,
  Scissors,
  Tag,
  Percent,
  X,
  ShieldCheck,
  ChevronRight,
  Filter
} from 'lucide-react';

export const LoyaltyRewardsView: React.FC = () => {
  const {
    activeSalon,
    clients,
    loyaltyRewards,
    loyaltyTransactions,
    loyaltySettings,
    addLoyaltyReward,
    updateLoyaltyReward,
    deleteLoyaltyReward,
    updateLoyaltySettings,
    redeemRewardForClient,
    creditPointsToClient,
    formatPrice
  } = useApp();

  const [activeTab, setActiveTab] = useState<'rewards' | 'clients' | 'history' | 'settings'>('rewards');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals
  const [isAddRewardModalOpen, setIsAddRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);

  // Client Redemption Modal
  const [selectedClientForRedeem, setSelectedClientForRedeem] = useState<Client | null>(null);

  // Manual point adjustment modal
  const [selectedClientForAdjustment, setSelectedClientForAdjustment] = useState<Client | null>(null);
  const [adjustmentPoints, setAdjustmentPoints] = useState<number>(20);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Geste commercial / Bonus');

  // New / Edit Reward Form State
  const [rewardName, setRewardName] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardPointsCost, setRewardPointsCost] = useState(50);
  const [rewardCategory, setRewardCategory] = useState<RewardCategory>('free_service');
  const [rewardDiscount, setRewardDiscount] = useState<number>(25);
  const [rewardFreeService, setRewardFreeService] = useState('Coupe classique');

  // Filter rewards for active salon
  const salonRewards = useMemo(() => {
    return loyaltyRewards.filter((r) => r.salonId === activeSalon.id || !r.salonId);
  }, [loyaltyRewards, activeSalon.id]);

  const filteredRewards = useMemo(() => {
    return salonRewards.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [salonRewards, categoryFilter, searchQuery]);

  // Clients with points for active salon
  const salonClients = useMemo(() => {
    return clients.filter((c) => c.salonId === activeSalon.id);
  }, [clients, activeSalon.id]);

  const filteredClients = useMemo(() => {
    return salonClients.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
      }
      return true;
    }).sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0));
  }, [salonClients, searchQuery]);

  // Transactions ledger for active salon
  const salonTransactions = useMemo(() => {
    return loyaltyTransactions.filter((tx) => tx.salonId === activeSalon.id || !tx.salonId);
  }, [loyaltyTransactions, activeSalon.id]);

  // KPI calculations
  const totalCirculatingPoints = useMemo(() => {
    return salonClients.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0);
  }, [salonClients]);

  const totalRewardsRedeemedCount = useMemo(() => {
    return salonRewards.reduce((acc, r) => acc + r.timesRedeemed, 0);
  }, [salonRewards]);

  const vipMembersCount = useMemo(() => {
    return salonClients.filter((c) => (c.loyaltyTier === 'vip' || (c.loyaltyPoints || 0) >= loyaltySettings.vipThreshold)).length;
  }, [salonClients, loyaltySettings.vipThreshold]);

  // Handlers for Add / Edit Reward
  const openAddRewardModal = () => {
    setEditingReward(null);
    setRewardName('');
    setRewardDesc('');
    setRewardPointsCost(50);
    setRewardCategory('free_service');
    setRewardDiscount(20);
    setRewardFreeService('Coupe classique');
    setIsAddRewardModalOpen(true);
  };

  const openEditRewardModal = (reward: LoyaltyReward) => {
    setEditingReward(reward);
    setRewardName(reward.name);
    setRewardDesc(reward.description);
    setRewardPointsCost(reward.pointsCost);
    setRewardCategory(reward.category);
    setRewardDiscount(reward.discountPercentage || 20);
    setRewardFreeService(reward.freeServiceName || 'Coupe classique');
    setIsAddRewardModalOpen(true);
  };

  const handleSaveReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardName.trim() || rewardPointsCost <= 0) {
      alert('Veuillez renseigner le nom de la récompense et un coût en points valide.');
      return;
    }

    if (editingReward) {
      updateLoyaltyReward(editingReward.id, {
        name: rewardName.trim(),
        description: rewardDesc.trim(),
        pointsCost: Number(rewardPointsCost),
        category: rewardCategory,
        discountPercentage: rewardCategory === 'discount' ? Number(rewardDiscount) : undefined,
        freeServiceName: rewardCategory === 'free_service' ? rewardFreeService : undefined
      });
    } else {
      addLoyaltyReward({
        salonId: activeSalon.id,
        name: rewardName.trim(),
        description: rewardDesc.trim(),
        pointsCost: Number(rewardPointsCost),
        category: rewardCategory,
        isActive: true,
        discountPercentage: rewardCategory === 'discount' ? Number(rewardDiscount) : undefined,
        freeServiceName: rewardCategory === 'free_service' ? rewardFreeService : undefined
      });
    }

    setIsAddRewardModalOpen(false);
  };

  const handleRedeem = (reward: LoyaltyReward) => {
    if (!selectedClientForRedeem) return;
    const res = redeemRewardForClient(selectedClientForRedeem.id, reward.id);
    if (res.success) {
      // Refresh selected client
      const updated = clients.find((c) => c.id === selectedClientForRedeem.id);
      setSelectedClientForRedeem(updated || null);
    } else {
      alert(res.error || 'Erreur lors de l\'échange de récompense.');
    }
  };

  const handleManualPointsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForAdjustment) return;
    creditPointsToClient(selectedClientForAdjustment.id, Number(adjustmentPoints), adjustmentReason.trim());
    setSelectedClientForAdjustment(null);
  };

  const categoryLabels: Record<RewardCategory, { label: string; badge: string; icon: any }> = {
    free_service: { label: 'Prestation Offerte', badge: 'bg-emerald-950 text-emerald-400 border-emerald-800/40', icon: Scissors },
    discount: { label: 'Remise en %', badge: 'bg-blue-950 text-blue-400 border-blue-800/40', icon: Percent },
    product: { label: 'Produit de Soin', badge: 'bg-purple-950 text-purple-400 border-purple-800/40', icon: Tag },
    vip_upgrade: { label: 'Surclassement VIP', badge: 'bg-[#C9A45C]/20 text-[#E5C378] border-[#C9A45C]/40', icon: Sparkles }
  };

  const tierBadges: Record<string, { label: string; badge: string }> = {
    vip: { label: 'VIP Ambassadeur', badge: 'bg-[#C9A45C] text-[#101010] font-black' },
    gold: { label: 'Membre Or', badge: 'bg-amber-400/20 text-amber-300 border border-amber-400/40' },
    silver: { label: 'Membre Argent', badge: 'bg-stone-300/20 text-stone-200 border border-stone-400/40' },
    bronze: { label: 'Membre Bronze', badge: 'bg-amber-900/20 text-amber-500 border border-amber-800/40' }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & PROGRAM STATUS */}
      <div className="bg-[#161619] border border-[#27272c] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
            <Award className="w-4 h-4" />
            <span>Fidélisation Client & Récompenses</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Programme de Récompenses Automatique
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Chaque prestation terminée crédite automatiquement des points aux clients. Définissez vos récompenses personnalisées.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-[#111113] border border-[#27272c] flex items-center gap-2">
            <span className="text-[11px] text-stone-400 font-semibold">Taux de crédit :</span>
            <span className="text-xs font-bold text-[#E5C378]">
              {loyaltySettings.pointsPer100Fcfa} pt / 100 FCFA
            </span>
          </div>

          <button
            onClick={openAddRewardModal}
            className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Créer Récompense</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">Points en Circulation</div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {totalCirculatingPoints} <span className="text-xs font-normal text-stone-500">pts</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#201d16] border border-[#C9A45C]/30 flex items-center justify-center text-[#C9A45C]">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">Récompenses Échangées</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
              {totalRewardsRedeemedCount} <span className="text-xs font-normal text-stone-500">cadeaux</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-600/30 flex items-center justify-center text-emerald-400">
            <Gift className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">Clients VIP & Fidèles</div>
            <div className="text-xl font-extrabold text-[#E5C378] mt-0.5">
              {vipMembersCount} <span className="text-xs font-normal text-stone-500">membres</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#221c13] border border-[#C9A45C]/40 flex items-center justify-center text-[#E5C378]">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">Bonus Nouveau Client</div>
            <div className="text-xl font-extrabold text-blue-400 mt-0.5">
              +{loyaltySettings.welcomeBonus} <span className="text-xs font-normal text-stone-500">pts offerts</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-600/30 flex items-center justify-center text-blue-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION SUB-TABS & SEARCH BAR */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-[#111113] p-1 rounded-xl border border-[#28282d] overflow-x-auto">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'rewards' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Catalogue Récompenses ({salonRewards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'clients' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Soldes & Échanges Clients</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'history' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Journal des Points</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'settings' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Règles & Barème</span>
          </button>
        </div>

        {/* Search & filter if rewards or clients */}
        {(activeTab === 'rewards' || activeTab === 'clients') && (
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'rewards' ? 'Rechercher une récompense...' : 'Nom ou téléphone client...'}
                className="bg-[#111113] border border-[#28282d] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C] w-52"
              />
            </div>

            {activeTab === 'rewards' && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#111113] border border-[#28282d] rounded-xl px-2.5 py-1.5 text-xs text-stone-300 focus:outline-none focus:border-[#C9A45C]"
              >
                <option value="all">Toutes catégories</option>
                <option value="free_service">Prestation offerte</option>
                <option value="discount">Remise en %</option>
                <option value="product">Produits</option>
                <option value="vip_upgrade">Surclassement VIP</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* 4. TAB 1: CATALOGUE DES RÉCOMPENSES */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRewards.map((reward) => {
              const catCfg = categoryLabels[reward.category] || categoryLabels.free_service;
              const Icon = catCfg.icon;

              return (
                <div
                  key={reward.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-md ${
                    reward.isActive
                      ? 'bg-[#161619] border-[#29292e] hover:border-[#C9A45C]/50'
                      : 'bg-[#121214] border-[#222226] opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-[#1e1c15] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catCfg.badge}`}>
                          {catCfg.label}
                        </span>

                        <button
                          type="button"
                          onClick={() => updateLoyaltyReward(reward.id, { isActive: !reward.isActive })}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${
                            reward.isActive
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/40'
                              : 'bg-stone-800 text-stone-500 border-stone-700'
                          }`}
                        >
                          {reward.isActive ? 'Actif' : 'Inactif'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-white text-base">{reward.name}</h3>
                      <p className="text-xs text-stone-400 mt-1 line-clamp-2">
                        {reward.description}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#111113] border border-[#242428] flex items-center justify-between text-xs">
                      <span className="text-stone-400">Coût d'échange :</span>
                      <span className="font-extrabold text-base text-[#E5C378] flex items-center gap-1">
                        <Award className="w-4 h-4 text-[#C9A45C]" />
                        {reward.pointsCost} pts
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 flex items-center justify-between">
                      <span>Utilisé {reward.timesRedeemed} fois au salon</span>
                      {reward.discountPercentage && (
                        <span className="text-blue-400 font-semibold">-{reward.discountPercentage}% remise</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#232328] mt-4 flex items-center justify-between">
                    <button
                      onClick={() => openEditRewardModal(reward)}
                      className="text-xs font-semibold text-stone-400 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Modifier</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Supprimer la récompense "${reward.name}" ?`)) {
                          deleteLoyaltyReward(reward.id);
                        }
                      }}
                      className="text-xs text-stone-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRewards.length === 0 && (
            <div className="p-10 rounded-3xl bg-[#161619] border border-[#26262a] text-center text-xs text-stone-500">
              Aucune récompense trouvée. Cliquez sur "+ Créer Récompense" pour définir vos offres.
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 2: SOLDES CLIENTS & ÉCHANGE DE RÉCOMPENSES */}
      {activeTab === 'clients' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-4">Client</th>
                  <th className="p-4">Palier Fidélité</th>
                  <th className="p-4 text-center">Solde Disponible</th>
                  <th className="p-4 text-center">Points Cumulés</th>
                  <th className="p-4 text-center">Récompenses Éligibles</th>
                  <th className="p-4 text-right">Actions Comptoir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {filteredClients.map((client) => {
                  const points = client.loyaltyPoints || 0;
                  const tier = client.loyaltyTier || 'bronze';
                  const tierBadge = tierBadges[tier] || tierBadges.bronze;

                  // Count rewards this client can afford right now
                  const affordableRewards = salonRewards.filter((r) => r.isActive && r.pointsCost <= points);

                  return (
                    <tr key={client.id} className="hover:bg-[#1a1a1e] transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{client.name}</div>
                        <div className="text-[11px] text-stone-400 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#C9A45C]" />
                          {client.phone}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${tierBadge.badge}`}>
                          {tierBadge.label}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span className="font-extrabold text-base text-[#E5C378] bg-[#221c13] border border-[#C9A45C]/40 px-3 py-1 rounded-xl inline-block shadow-sm">
                          {points} pts
                        </span>
                      </td>

                      <td className="p-4 text-center font-mono text-stone-400">
                        {client.totalPointsEarned || points} pts
                      </td>

                      <td className="p-4 text-center">
                        {affordableRewards.length > 0 ? (
                          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                            {affordableRewards.length} disponible(s)
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-500">Pas assez de points</span>
                        )}
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedClientForRedeem(client)}
                          disabled={affordableRewards.length === 0}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                            affordableRewards.length > 0
                              ? 'bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] shadow-sm'
                              : 'bg-[#222227] text-stone-600 cursor-not-allowed'
                          }`}
                        >
                          Échanger Récompense
                        </button>

                        <button
                          onClick={() => {
                            setSelectedClientForAdjustment(client);
                            setAdjustmentPoints(20);
                            setAdjustmentReason('Bonus de fidélité');
                          }}
                          className="text-[11px] text-stone-400 hover:text-white px-2 py-1 rounded-lg border border-[#2b2b30] hover:bg-[#202025]"
                          title="Ajuster les points manuellement"
                        >
                          +/- Points
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: JOURNAL & HISTORIQUE DES POINTS */}
      {activeTab === 'history' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#242428] flex items-center justify-between">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#C9A45C]" />
              Historique des Mouvements de Points (Crédits Automatiques & Débits)
            </h3>
            <span className="text-xs text-stone-400 font-mono">
              {salonTransactions.length} entrées
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-4">Date & Heure</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Type d'opération</th>
                  <th className="p-4">Détails / Prestation</th>
                  <th className="p-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {salonTransactions.map((tx) => {
                  const isCredit = tx.points > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-[#1a1a1e] transition-colors">
                      <td className="p-4 font-mono text-stone-400">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="p-4 font-bold text-white">
                        {tx.clientName}
                      </td>

                      <td className="p-4">
                        {tx.type === 'earned_service' && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                            Prestation terminée
                          </span>
                        )}
                        {tx.type === 'redeemed_reward' && (
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-950/80 border border-purple-800/40 px-2 py-0.5 rounded-full">
                            Récompense échangée
                          </span>
                        )}
                        {tx.type === 'welcome_bonus' && (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-950/80 border border-blue-800/40 px-2 py-0.5 rounded-full">
                            Bonus Bienvenue
                          </span>
                        )}
                        {tx.type === 'manual_adjustment' && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800/40 px-2 py-0.5 rounded-full">
                            Ajustement
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-stone-300">
                        {tx.description}
                      </td>

                      <td className="p-4 text-right">
                        <span
                          className={`font-black text-sm px-2.5 py-1 rounded-xl inline-block ${
                            isCredit
                              ? 'text-emerald-400 bg-emerald-950/50'
                              : 'text-red-400 bg-red-950/50'
                          }`}
                        >
                          {isCredit ? `+${tx.points}` : tx.points} pts
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB 4: RÈGLES & BARÈMES */}
      {activeTab === 'settings' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl max-w-3xl">
          <div className="border-b border-[#242428] pb-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
              <Settings className="w-4 h-4" />
              <span>Paramètres du Barème</span>
            </div>
            <h2 className="text-xl font-bold text-white">Règles de Calcul & Seuils VIP</h2>
            <p className="text-xs text-stone-400 mt-1">
              Ajustez la générosité du barème de fidélité pour votre salon {activeSalon.name}.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#121214] border border-[#242428] flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Activer le programme de fidélité</h4>
                <p className="text-[11px] text-stone-400">Crédite automatiquement des points après chaque coupe ou soin</p>
              </div>
              <input
                type="checkbox"
                checked={loyaltySettings.programEnabled}
                onChange={(e) => updateLoyaltySettings({ programEnabled: e.target.checked })}
                className="w-5 h-5 rounded border-[#2c2c32] bg-[#111113] text-[#C9A45C] focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Points pour 100 FCFA dépensés
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={loyaltySettings.pointsPer100Fcfa}
                  onChange={(e) => updateLoyaltySettings({ pointsPer100Fcfa: Number(e.target.value) })}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Ex: 1 pt / 100 FCFA &rarr; une coupe à 4 000 FCFA rapporte 40 points.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Points de bienvenue (1ère visite)
                </label>
                <input
                  type="number"
                  min="0"
                  value={loyaltySettings.welcomeBonus}
                  onChange={(e) => updateLoyaltySettings({ welcomeBonus: Number(e.target.value) })}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Crédité dès la création du client dans le fichier.
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#222226]">
              <h4 className="text-xs font-bold text-white mb-3">Seuils de Statut VIP</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#121214] border border-[#242428]">
                  <span className="text-[10px] text-stone-400 block mb-1">Palier Argent (Silver)</span>
                  <input
                    type="number"
                    value={loyaltySettings.silverThreshold}
                    onChange={(e) => updateLoyaltySettings({ silverThreshold: Number(e.target.value) })}
                    className="w-full bg-[#18181b] border border-[#2d2d34] rounded-lg px-2 py-1 text-xs font-bold text-stone-200"
                  />
                  <span className="text-[9px] text-stone-500 mt-1 block">pts cumulés</span>
                </div>

                <div className="p-3 rounded-xl bg-[#121214] border border-[#242428]">
                  <span className="text-[10px] text-amber-400 block mb-1">Palier Or (Gold)</span>
                  <input
                    type="number"
                    value={loyaltySettings.goldThreshold}
                    onChange={(e) => updateLoyaltySettings({ goldThreshold: Number(e.target.value) })}
                    className="w-full bg-[#18181b] border border-[#2d2d34] rounded-lg px-2 py-1 text-xs font-bold text-amber-300"
                  />
                  <span className="text-[9px] text-stone-500 mt-1 block">pts cumulés</span>
                </div>

                <div className="p-3 rounded-xl bg-[#121214] border border-[#C9A45C]/40">
                  <span className="text-[10px] text-[#C9A45C] block mb-1 font-bold">Palier VIP</span>
                  <input
                    type="number"
                    value={loyaltySettings.vipThreshold}
                    onChange={(e) => updateLoyaltySettings({ vipThreshold: Number(e.target.value) })}
                    className="w-full bg-[#18181b] border border-[#2d2d34] rounded-lg px-2 py-1 text-xs font-extrabold text-[#E5C378]"
                  />
                  <span className="text-[9px] text-stone-500 mt-1 block">pts cumulés</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: CRÉER OU MODIFIER UNE RÉCOMPENSE PERSONNALISÉE     */}
      {/* ============================================================ */}
      {isAddRewardModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#161619] border border-[#2d2d34] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
            <button
              onClick={() => setIsAddRewardModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                <Gift className="w-4 h-4" />
                <span>{editingReward ? 'Modifier la Récompense' : 'Nouvelle Récompense Personnalisée'}</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                {editingReward ? editingReward.name : 'Définir une récompense barber'}
              </h2>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Intitulé de la récompense *
                </label>
                <input
                  type="text"
                  required
                  value={rewardName}
                  onChange={(e) => setRewardName(e.target.value)}
                  placeholder="Ex: Taille de barbe à l'ancienne offerte"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Description pour le client
                </label>
                <textarea
                  rows={2}
                  value={rewardDesc}
                  onChange={(e) => setRewardDesc(e.target.value)}
                  placeholder="Ex: Serviette chaude, baume parfumé et finitions précises au coupe-chou."
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Coût en points *
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    required
                    value={rewardPointsCost}
                    onChange={(e) => setRewardPointsCost(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs font-bold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Catégorie
                  </label>
                  <select
                    value={rewardCategory}
                    onChange={(e) => setRewardCategory(e.target.value as RewardCategory)}
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="free_service">Prestation Offerte</option>
                    <option value="discount">Remise en %</option>
                    <option value="product">Produit de soin</option>
                    <option value="vip_upgrade">Surclassement VIP</option>
                  </select>
                </div>
              </div>

              {rewardCategory === 'discount' && (
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Pourcentage de réduction (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={rewardDiscount}
                    onChange={(e) => setRewardDiscount(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-blue-400 font-bold focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-extrabold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingReward ? 'Enregistrer les modifications' : 'Ajouter au catalogue'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ÉCHANGER UNE RÉCOMPENSE POUR UN CLIENT SÉLECTIONNÉ */}
      {/* ============================================================ */}
      {selectedClientForRedeem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl bg-[#161619] border border-[#2d2d34] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
            <button
              onClick={() => setSelectedClientForRedeem(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                <Award className="w-4 h-4" />
                <span>Échange Immédiat au Salon</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Récompenses pour {selectedClientForRedeem.name}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-stone-400">Solde disponible :</span>
                <span className="text-sm font-black text-[#E5C378] bg-[#221c13] px-2.5 py-0.5 rounded-lg border border-[#C9A45C]/40">
                  {selectedClientForRedeem.loyaltyPoints || 0} pts
                </span>
              </div>
            </div>

            {/* List of rewards */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {salonRewards
                .filter((r) => r.isActive)
                .map((reward) => {
                  const clientPoints = selectedClientForRedeem.loyaltyPoints || 0;
                  const canAfford = clientPoints >= reward.pointsCost;

                  return (
                    <div
                      key={reward.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        canAfford
                          ? 'bg-[#18181c] border-[#2f2f36] hover:border-[#C9A45C]'
                          : 'bg-[#121214] border-[#222226] opacity-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{reward.name}</span>
                          <span className="text-[10px] text-[#E5C378] font-bold">({reward.pointsCost} pts)</span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-0.5">{reward.description}</p>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleRedeem(reward)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                          canAfford
                            ? 'bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] shadow-md cursor-pointer'
                            : 'bg-[#222226] text-stone-500 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'Valider l\'échange' : 'Points manquants'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: AJUSTEMENT MANUEL DE POINTS                        */}
      {/* ============================================================ */}
      {selectedClientForAdjustment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#161619] border border-[#2d2d34] rounded-3xl shadow-2xl p-6 space-y-4">
            <button
              onClick={() => setSelectedClientForAdjustment(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white">
                Ajustement de points pour {selectedClientForAdjustment.name}
              </h3>
              <p className="text-xs text-stone-400">Solde actuel : {selectedClientForAdjustment.loyaltyPoints || 0} pts</p>
            </div>

            <form onSubmit={handleManualPointsSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Variation de points (ex: +30 ou -20)
                </label>
                <input
                  type="number"
                  required
                  value={adjustmentPoints}
                  onChange={(e) => setAdjustmentPoints(Number(e.target.value))}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs font-bold text-[#E5C378]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Motif de l'ajustement
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Ex: Geste commercial retard ou anniversaire"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-2.5 rounded-xl shadow-md cursor-pointer"
                >
                  Appliquer l'ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
