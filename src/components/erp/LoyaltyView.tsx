import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LoyaltyReward, RewardCategory } from '../../types';
import { FormModal, Field, inputClass, ConfirmDelete } from './FormModal';
import { Heart, Plus, Pencil, Settings } from 'lucide-react';

const CATEGORIES: { id: RewardCategory; label: string }[] = [
  { id: 'free_service', label: 'Prestation offerte' },
  { id: 'discount', label: 'Réduction' },
  { id: 'product', label: 'Produit' },
  { id: 'vip_upgrade', label: 'Statut VIP' }
];

const CATEGORY_LABELS: Record<RewardCategory, string> = {
  free_service: 'Prestation offerte',
  discount: 'Réduction',
  product: 'Produit',
  vip_upgrade: 'Statut VIP'
};

type RewardForm = {
  name: string;
  description: string;
  pointsCost: string;
  category: RewardCategory;
  discountPercentage: string;
  freeServiceName: string;
  isActive: boolean;
};

const emptyReward: RewardForm = {
  name: '',
  description: '',
  pointsCost: '100',
  category: 'free_service',
  discountPercentage: '',
  freeServiceName: '',
  isActive: true
};

type SettingsForm = {
  pointsPer100Fcfa: string;
  welcomeBonus: string;
  silverThreshold: string;
  goldThreshold: string;
  vipThreshold: string;
  programEnabled: boolean;
};

export const LoyaltyView: React.FC = () => {
  const {
    activeSalon,
    loyaltyRewards,
    loyaltySettings,
    loyaltyTransactions,
    addLoyaltyReward,
    updateLoyaltyReward,
    deleteLoyaltyReward,
    updateLoyaltySettings,
    addToast
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyReward | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyReward);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsForm>({
    pointsPer100Fcfa: String(loyaltySettings.pointsPer100Fcfa),
    welcomeBonus: String(loyaltySettings.welcomeBonus),
    silverThreshold: String(loyaltySettings.silverThreshold),
    goldThreshold: String(loyaltySettings.goldThreshold),
    vipThreshold: String(loyaltySettings.vipThreshold),
    programEnabled: loyaltySettings.programEnabled
  });

  const rewards = useMemo(
    () => loyaltyRewards.filter((r) => r.salonId === activeSalon.id),
    [loyaltyRewards, activeSalon.id]
  );

  const salonTransactions = useMemo(
    () => loyaltyTransactions.filter((t) => t.salonId === activeSalon.id),
    [loyaltyTransactions, activeSalon.id]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyReward);
    setIsFormOpen(true);
  };

  const openEdit = (reward: LoyaltyReward) => {
    setEditing(reward);
    setForm({
      name: reward.name,
      description: reward.description,
      pointsCost: String(reward.pointsCost),
      category: reward.category,
      discountPercentage: reward.discountPercentage ? String(reward.discountPercentage) : '',
      freeServiceName: reward.freeServiceName || '',
      isActive: reward.isActive
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pointsCost = Number(form.pointsCost);

    if (!form.name.trim()) {
      addToast('Le nom de la récompense est obligatoire.', 'error');
      return;
    }
    if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
      addToast('Le coût en points doit être supérieur à 0.', 'error');
      return;
    }
    if (form.category === 'discount') {
      const pct = Number(form.discountPercentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        addToast('La réduction doit être comprise entre 1 et 100 %.', 'error');
        return;
      }
    }

    const payload = {
      salonId: activeSalon.id,
      name: form.name.trim(),
      description: form.description.trim(),
      pointsCost,
      category: form.category,
      isActive: form.isActive,
      discountPercentage:
        form.category === 'discount' ? Number(form.discountPercentage) : undefined,
      freeServiceName:
        form.category === 'free_service' ? form.freeServiceName.trim() : undefined
    };

    if (editing) {
      updateLoyaltyReward(editing.id, payload);
    } else {
      addLoyaltyReward(payload);
    }
    setIsFormOpen(false);
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numbers = {
      pointsPer100Fcfa: Number(settings.pointsPer100Fcfa),
      welcomeBonus: Number(settings.welcomeBonus),
      silverThreshold: Number(settings.silverThreshold),
      goldThreshold: Number(settings.goldThreshold),
      vipThreshold: Number(settings.vipThreshold)
    };

    if (Object.values(numbers).some((v) => !Number.isFinite(v) || v < 0)) {
      addToast('Tous les paramètres numériques doivent être positifs ou nuls.', 'error');
      return;
    }
    if (!(numbers.silverThreshold <= numbers.goldThreshold && numbers.goldThreshold <= numbers.vipThreshold)) {
      addToast('Les seuils doivent être croissants (Argent ≤ Or ≤ VIP).', 'error');
      return;
    }

    updateLoyaltySettings({ ...numbers, programEnabled: settings.programEnabled });
    setIsSettingsOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <Heart className="w-6 h-6 text-[#C9A45C]" />
            Fidélité
          </h1>
          <p className="text-[#a9a9a9] mt-1">Programme de fidélité</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSettings({
                pointsPer100Fcfa: String(loyaltySettings.pointsPer100Fcfa),
                welcomeBonus: String(loyaltySettings.welcomeBonus),
                silverThreshold: String(loyaltySettings.silverThreshold),
                goldThreshold: String(loyaltySettings.goldThreshold),
                vipThreshold: String(loyaltySettings.vipThreshold),
                programEnabled: loyaltySettings.programEnabled
              });
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#232328] border border-[#3b3b42] text-white rounded-lg font-semibold hover:bg-[#2d2d34] cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4 text-[#C9A45C]" />
            Paramètres
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouvelle récompense
          </button>
        </div>
      </div>

      {/* Program status */}
      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              loyaltySettings.programEnabled
                ? 'bg-emerald-950/80 text-emerald-400'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {loyaltySettings.programEnabled ? 'Programme actif' : 'Programme désactivé'}
          </span>
          <span className="text-xs text-[#a9a9a9]">
            {loyaltySettings.pointsPer100Fcfa} point(s) par 100 FCFA · Bonus de bienvenue{' '}
            {loyaltySettings.welcomeBonus} pts
          </span>
        </div>
        <span className="text-xs text-[#a9a9a9]">
          {salonTransactions.length} mouvement(s) de points
        </span>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] overflow-hidden">
        {rewards.length === 0 ? (
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune récompense configurée</p>
            <p className="text-sm mt-1">Ajoutez votre première récompense</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2b] text-left">
                {['Récompense', 'Type', 'Coût', 'Utilisations', 'Statut', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#a9a9a9] font-bold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward) => (
                <tr
                  key={reward.id}
                  className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#f7f6f2]">{reward.name}</span>
                    {reward.description && (
                      <div className="text-[11px] text-[#a9a9a9] line-clamp-1">
                        {reward.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#a9a9a9] text-xs">
                    {CATEGORY_LABELS[reward.category]}
                    {reward.category === 'discount' && reward.discountPercentage
                      ? ` (${reward.discountPercentage} %)`
                      : ''}
                  </td>
                  <td className="px-4 py-3 text-[#E5C378] font-semibold">
                    {reward.pointsCost} pts
                  </td>
                  <td className="px-4 py-3 text-[#a9a9a9]">{reward.timesRedeemed}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        updateLoyaltyReward(reward.id, { isActive: !reward.isActive })
                      }
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer ${
                        reward.isActive
                          ? 'bg-emerald-950/80 text-emerald-400'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {reward.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(reward)}
                        title="Modifier"
                        className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <ConfirmDelete onConfirm={() => deleteLoyaltyReward(reward.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isFormOpen && (
        <FormModal
          title={editing ? 'Modifier la récompense' : 'Nouvelle récompense'}
          subtitle={activeSalon.name}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={editing ? 'Enregistrer' : 'Créer'}
        >
          <Field label="Nom" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Coupe offerte"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as RewardCategory })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#17171a]">
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Coût en points" required>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.pointsCost}
                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
              />
            </Field>
          </div>

          {form.category === 'discount' && (
            <Field label="Réduction (%)" required>
              <input
                type="number"
                min={1}
                max={100}
                className={inputClass}
                value={form.discountPercentage}
                onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
              />
            </Field>
          )}

          {form.category === 'free_service' && (
            <Field label="Prestation offerte">
              <input
                className={inputClass}
                value={form.freeServiceName}
                onChange={(e) => setForm({ ...form, freeServiceName: e.target.value })}
                placeholder="Ex: Coupe classique"
              />
            </Field>
          )}

          <Field label="Description">
            <textarea
              rows={2}
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-[#C9A45C]"
            />
            Récompense active
          </label>
        </FormModal>
      )}

      {isSettingsOpen && (
        <FormModal
          title="Paramètres du programme"
          subtitle={activeSalon.name}
          onClose={() => setIsSettingsOpen(false)}
          onSubmit={handleSettingsSubmit}
          submitLabel="Enregistrer"
        >
          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.programEnabled}
              onChange={(e) => setSettings({ ...settings, programEnabled: e.target.checked })}
              className="accent-[#C9A45C]"
            />
            Activer le programme de fidélité
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Points par 100 FCFA">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={settings.pointsPer100Fcfa}
                onChange={(e) =>
                  setSettings({ ...settings, pointsPer100Fcfa: e.target.value })
                }
              />
            </Field>

            <Field label="Bonus de bienvenue (points)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={settings.welcomeBonus}
                onChange={(e) => setSettings({ ...settings, welcomeBonus: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Seuil Argent">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={settings.silverThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, silverThreshold: e.target.value })
                }
              />
            </Field>
            <Field label="Seuil Or">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={settings.goldThreshold}
                onChange={(e) => setSettings({ ...settings, goldThreshold: e.target.value })}
              />
            </Field>
            <Field label="Seuil VIP">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={settings.vipThreshold}
                onChange={(e) => setSettings({ ...settings, vipThreshold: e.target.value })}
              />
            </Field>
          </div>
        </FormModal>
      )}
    </div>
  );
};
