import React, { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  updatePlatformSettings,
  validateAuditReason,
  type PlatformGlobalSettings,
} from '../../lib/superadmin';

export interface AdminPlatformSettingsPanelProps {
  settings: PlatformGlobalSettings | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void> | void;
  onSave?: (updates: {
    maintenanceMode: boolean;
    autoApproveSalons: boolean;
    reason: string;
  }) => Promise<PlatformGlobalSettings>;
  onOpenMarketplaceConfig?: () => void;
}

export const AdminPlatformSettingsPanel: React.FC<AdminPlatformSettingsPanelProps> = ({
  settings,
  loading = false,
  error = null,
  onRefresh,
  onSave = updatePlatformSettings,
  onOpenMarketplaceConfig,
}) => {
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(settings?.maintenanceMode ?? false);
  const [autoApproveSalons, setAutoApproveSalons] = useState<boolean>(settings?.autoApproveSalons ?? true);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setMaintenanceMode(settings.maintenanceMode);
    setAutoApproveSalons(settings.autoApproveSalons);
  }, [settings]);

  const unavailable = settings === null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unavailable) {
      setFormError('Les paramètres serveur ne sont pas chargés : enregistrement impossible.');
      return;
    }

    setFormError(null);
    setSaveSuccess(null);

    let validReason: string;
    try {
      validReason = validateAuditReason(reason);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Un motif est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      const updated = await onSave({
        maintenanceMode,
        autoApproveSalons,
        reason: validReason,
      });
      setMaintenanceMode(updated.maintenanceMode);
      setAutoApproveSalons(updated.autoApproveSalons);
      setReason('');
      setSaveSuccess('Paramètres enregistrés côté serveur et tracés dans le journal d’audit.');
      await onRefresh?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Échec de l’enregistrement des paramètres.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Paramètres Globaux de la Plateforme
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Distinction explicite entre les réglages persistés dans PostgreSQL (appliqués côté serveur et
            audités) et les fonctionnalités non implémentées.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-xs text-red-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Impossible de charger les paramètres serveur</p>
            <p className="text-red-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {unavailable && !error && (
        <div
          data-testid="settings-server-unavailable"
          className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-4 text-xs text-amber-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Configuration serveur indisponible</p>
            <p className="text-amber-300/90 mt-0.5">
              Aucun paramètre global n’est stocké en local : connectez la base Supabase pour lire ou modifier
              ces réglages.
            </p>
          </div>
        </div>
      )}

      {/* Section 1 : Réglages persistés et appliqués par le backend */}
      <form
        onSubmit={handleSubmit}
        data-testid="settings-persisted-form"
        className="space-y-5 bg-[#0c0c10] border border-[#1a1a22] rounded-3xl p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#181820]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E5C378] uppercase tracking-wider">
            <Database className="w-4 h-4 text-[#C9A45C]" />
            <span>Réglages persistés & appliqués côté serveur</span>
          </div>
          {settings?.updatedAt ? (
            <span className="text-[11px] text-stone-400">
              Dernière mise à jour : {new Date(settings.updatedAt).toLocaleString('fr-FR')}
            </span>
          ) : (
            <span className="text-[11px] text-stone-500">Source : table public.platform_settings</span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="platform-default-currency"
              className="block text-xs font-semibold text-stone-300 mb-1.5"
            >
              Devise Officielle de la Plateforme
            </label>
            <input
              id="platform-default-currency"
              type="text"
              disabled
              value={settings ? `${settings.defaultCurrency} (FCFA)` : 'indisponible'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-stone-400 disabled:opacity-70"
            />
            <span className="text-[10px] text-stone-500">
              Standardisé côté serveur en Franc CFA (XOF) sans arrondis flottants.
            </span>
          </div>

          <div className="rounded-2xl border border-[#1e1e26] bg-[#08080a] p-4 space-y-2">
            <label className="flex items-start gap-3 text-xs font-semibold text-stone-200 cursor-pointer">
              <input
                id="platform-auto-approve-salons"
                type="checkbox"
                disabled={unavailable || saving}
                checked={autoApproveSalons}
                onChange={(e) => setAutoApproveSalons(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#C9A45C]"
              />
              <span className="space-y-1">
                <span className="block">Auto-publication des salons sur la Marketplace</span>
                <span className="block font-normal text-[11px] text-stone-400 leading-relaxed">
                  {autoApproveSalons
                    ? 'Activé : tout établissement complet (adresse, téléphone, couverture et au moins 1 prestation active) peut se publier.'
                    : 'Désactivé : un nouvel établissement non certifié ne peut pas se publier sans certification ou publication préalable par le super-administrateur.'}
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-4 space-y-2">
            <label className="flex items-start gap-3 text-xs font-semibold text-red-200 cursor-pointer">
              <input
                id="platform-maintenance-mode"
                type="checkbox"
                disabled={unavailable || saving}
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-red-500"
              />
              <span className="space-y-1">
                <span className="block">
                  Mode Maintenance Global (Verrouiller les nouvelles inscriptions)
                </span>
                <span className="block font-normal text-[11px] text-stone-400 leading-relaxed">
                  Bloque côté serveur (<code className="text-stone-300">create_salon</code>) et sur la page{' '}
                  <code className="text-stone-300">/inscription</code> toute nouvelle création de compte ou
                  d’établissement.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label
              htmlFor="platform-settings-reason"
              className="block text-xs font-semibold text-stone-300 mb-1.5"
            >
              Motif de modification (journal d’audit) *
            </label>
            <input
              id="platform-settings-reason"
              type="text"
              disabled={unavailable || saving}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setFormError(null);
              }}
              placeholder="Ex. Passage en maintenance programmée ou ouverture des auto-publications"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C] disabled:opacity-50"
            />
          </div>
        </div>

        {formError && (
          <p
            role="alert"
            className="text-xs text-red-300 bg-red-950/40 border border-red-500/30 rounded-xl p-3"
          >
            {formError}
          </p>
        )}

        {saveSuccess && (
          <p className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </p>
        )}

        <div className="pt-4 border-t border-[#1a1a22] flex justify-end">
          <button
            type="submit"
            disabled={unavailable || saving}
            className="px-5 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Enregistrement…' : 'Enregistrer les Paramètres'}</span>
          </button>
        </div>
      </form>

      {/* Section 2 : Réglages explicitement non implémentés / indisponibles */}
      <section
        data-testid="settings-unavailable-section"
        className="rounded-3xl border border-[#22222b] bg-[#0a0a0e] p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-300 uppercase tracking-wider">
            <Ban className="w-4 h-4 text-stone-400" />
            <span>Paramètres non implémentés / indisponibles</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#181820] text-stone-400 border border-[#2a2a34]">
            Sans effet serveur
          </span>
        </div>

        <div className="rounded-2xl border border-[#1d1d24] bg-[#08080a] p-4 space-y-2 opacity-80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="platform-commission-rate-unavailable"
              className="text-xs font-semibold text-stone-300"
            >
              Frais de Service / Commission Marketplace (%)
            </label>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-stone-800 text-stone-300 border border-stone-700">
              Indisponible — non implémenté
            </span>
          </div>
          <input
            id="platform-commission-rate-unavailable"
            type="text"
            disabled
            value="Indisponible (aucun prélèvement sur réservations)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0b0f] border border-[#1e1e26] text-xs text-stone-500 cursor-not-allowed"
          />
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Aucun mécanisme de commission sur les encaissements ou réservations Marketplace n’est activé côté
            serveur : le modèle économique repose exclusivement sur les abonnements SaaS. Aucune valeur locale
            fictive n’est enregistrée.
          </p>
        </div>

        {onOpenMarketplaceConfig && (
          <div className="rounded-xl border border-[#22222c] bg-[#08080a] p-3.5 text-xs text-stone-400">
            La bannière d’annonce globale, les sections à la une et les métadonnées du site se gèrent côté
            serveur dans{' '}
            <button
              type="button"
              onClick={onOpenMarketplaceConfig}
              className="text-[#C9A45C] font-bold hover:underline cursor-pointer"
            >
              Bannières & Métadonnées
            </button>
            .
          </div>
        )}
      </section>
    </div>
  );
};
