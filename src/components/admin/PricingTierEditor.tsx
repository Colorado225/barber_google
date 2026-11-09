import React, { useState } from 'react';
import { Check, Sliders, Trash2, X } from 'lucide-react';
import type { SaaSPlan } from '../../types';
import { saveSaasPlanWorkflow, type SaaSPlanInput, type SaaSPlanSaveStatus } from '../../lib/saas';
import { useOptionalApp } from '../../context/AppContext';

export interface PricingTierEditorProps {
  /** Forfait publié à modifier ; null pour un nouveau forfait. */
  plan: SaaSPlan | null;
  /** Brouillon en attente pour ce forfait : le formulaire reprend ses valeurs. */
  pendingDraft: SaaSPlanInput | null;
  /** Position par défaut d'un nouveau forfait. */
  nextDisplayOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

interface TierForm {
  name: string;
  slug: string;
  priceXof: number;
  billingPeriod: 'monthly' | 'yearly';
  description: string;
  features: string[];
  maxStaff: string;
  maxBranches: number;
  isPopular: boolean;
  isActive: boolean;
  badgeText: string;
  displayOrder: number;
}

function buildInitialForm(
  plan: SaaSPlan | null,
  pendingDraft: SaaSPlanInput | null,
  nextDisplayOrder: number,
): TierForm {
  const source = pendingDraft ?? plan;
  if (source) {
    return {
      name: source.name,
      slug: source.slug,
      priceXof: source.priceXof,
      billingPeriod: source.billingPeriod,
      description: source.description,
      features: [...source.features],
      maxStaff: source.maxStaff === null ? '' : String(source.maxStaff),
      maxBranches: source.maxBranches,
      isPopular: source.isPopular,
      isActive: source.isActive,
      badgeText: source.badgeText || '',
      displayOrder: source.displayOrder,
    };
  }
  return {
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
    displayOrder: nextDisplayOrder,
  };
}

function statusMessage(status: SaaSPlanSaveStatus, name: string): { text: string; tone: 'success' | 'info' } {
  if (status === 'published') {
    return { text: `« ${name} » est publié : visible sur la page Tarifs.`, tone: 'success' };
  }
  if (status === 'draft') {
    return { text: `Brouillon de « ${name} » enregistré : non visible sur la page Tarifs.`, tone: 'info' };
  }
  return { text: `Mode local : « ${name} » enregistré dans ce navigateur uniquement.`, tone: 'info' };
}

/**
 * Éditeur d'un forfait (prix, quotas, avantages).
 * Interrupteur « Publier immédiatement » : activé, la modification est visible sur la page Tarifs ;
 * désactivé, elle est enregistrée en brouillon et la version publiée ne change pas.
 */
export const PricingTierEditor: React.FC<PricingTierEditorProps> = ({
  plan,
  pendingDraft,
  nextDisplayOrder,
  onClose,
  onSaved,
}) => {
  const { addToast } = useOptionalApp();
  const [form, setForm] = useState<TierForm>(() => buildInitialForm(plan, pendingDraft, nextDisplayOrder));
  const [newFeatureText, setNewFeatureText] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExisting = Boolean(plan || pendingDraft);
  const title = pendingDraft
    ? `Modifier le brouillon « ${pendingDraft.name} »`
    : plan
      ? `Modifier le forfait « ${plan.name} »`
      : 'Nouveau Forfait';

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    setForm((prev) => ({ ...prev, features: [...prev.features, newFeatureText.trim()] }));
    setNewFeatureText('');
  };

  const handleRemoveFeature = (index: number) => {
    setForm((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.priceXof < 0) {
      setError('Le prix ne peut pas être négatif.');
      return;
    }

    const input: SaaSPlanInput = {
      id: plan?.id ?? pendingDraft?.id ?? form.slug.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: form.name.trim(),
      slug: form.slug.trim(),
      priceXof: Number(form.priceXof),
      billingPeriod: form.billingPeriod,
      description: form.description.trim(),
      features: form.features.filter((f) => f.trim().length > 0),
      maxStaff: form.maxStaff.trim() === '' ? null : Number(form.maxStaff),
      maxBranches: Number(form.maxBranches) || 1,
      isPopular: form.isPopular,
      isActive: form.isActive,
      badgeText: form.badgeText.trim() || null,
      displayOrder: Number(form.displayOrder),
    };

    setSaving(true);
    try {
      const status = await saveSaasPlanWorkflow(input, publishNow);
      const message = statusMessage(status, input.name);
      addToast(message.text, message.tone);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f0f13] border border-[#262632] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-[#1c1c24] pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#C9A45C]" />
              <span>{title}</span>
            </h3>
            <p className="text-xs text-stone-400">
              Ajustez les prix, quotas et avantages visibles par les salons.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#1a1a22]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pendingDraft && (
          <p className="text-xs text-amber-200 bg-amber-950/30 border border-amber-500/30 rounded-xl p-3">
            Un brouillon est en attente pour ce forfait. Le formulaire reprend ce brouillon ; la version
            publiée n’a pas changé.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tier-name" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Nom du forfait *
              </label>
              <input
                id="tier-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
            <div>
              <label htmlFor="tier-slug" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Identifiant / Slug *
              </label>
              <input
                id="tier-slug"
                type="text"
                required
                disabled={isExisting}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C] disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tier-price" className="block text-xs font-semibold text-[#E5C378] mb-1.5">
                Prix Mensuel (FCFA) *
              </label>
              <input
                id="tier-price"
                type="number"
                required
                min={0}
                step={500}
                value={form.priceXof}
                onChange={(e) => setForm({ ...form, priceXof: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#C9A45C]/50 text-xs font-bold text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
            <div>
              <label htmlFor="tier-badge" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Étiquette Promotionnelle (Badge)
              </label>
              <input
                id="tier-badge"
                type="text"
                value={form.badgeText}
                onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                placeholder="ex: Plus Populaire"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tier-description" className="block text-xs font-semibold text-stone-300 mb-1.5">
              Description
            </label>
            <textarea
              id="tier-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tier-staff" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Nombre max de coiffeurs
              </label>
              <input
                id="tier-staff"
                type="text"
                value={form.maxStaff}
                onChange={(e) => setForm({ ...form, maxStaff: e.target.value })}
                placeholder="Vide pour Illimité"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
            <div>
              <label htmlFor="tier-branches" className="block text-xs font-semibold text-stone-300 mb-1.5">
                Succursales max
              </label>
              <input
                id="tier-branches"
                type="number"
                min={1}
                value={form.maxBranches}
                onChange={(e) => setForm({ ...form, maxBranches: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Avantages ({form.features.length})
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {form.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />
                  <input
                    type="text"
                    aria-label={`Avantage ${idx + 1}`}
                    value={feat}
                    onChange={(e) => {
                      const updated = [...form.features];
                      updated[idx] = e.target.value;
                      setForm({ ...form, features: updated });
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFeature(idx)}
                    aria-label={`Retirer l’avantage ${idx + 1}`}
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
                aria-label="Nouvel avantage"
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

          <div className="rounded-2xl border border-[#262632] bg-[#0b0b0f] p-4 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                role="switch"
                aria-checked={publishNow}
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#C9A45C]"
              />
              <span className="text-xs">
                <span className="block font-bold text-white">Publier immédiatement sur la page Tarifs</span>
                <span className="block text-stone-400 mt-1">
                  {publishNow
                    ? 'Visible dès l’enregistrement sur la Marketplace. Les salons déjà abonnés gardent leur tarif d’origine.'
                    : 'Enregistré en brouillon : la page Tarifs continue d’afficher la version publiée. Publiez-le ensuite depuis la liste des forfaits.'}
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs text-red-300 bg-red-950/40 border border-red-500/30 rounded-xl p-3"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1c1c24]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#C9A45C] text-[#101010] font-bold text-xs disabled:opacity-60"
            >
              {saving ? 'Sauvegarde…' : publishNow ? 'Publier le forfait' : 'Enregistrer le brouillon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
