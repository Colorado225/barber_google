import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  SalonMarketplaceSettingsRecord,
  SalonMarketplaceViewConfig,
  PublicSalonDetail
} from '../../types';
import {
  getCustomizerConfig,
  saveCustomizerDraft,
  publishCustomizer,
  unpublishCustomizer,
  revertCustomizerDraft,
  getDefaultCustomizerConfig
} from '../../lib/marketplace-customizer';
import { listSalonBranches, getBranchHours } from '../../lib/branch-hours';
import { SalonMarketplaceToolbar, ViewportMode } from './SalonMarketplaceToolbar';
import { SalonMarketplaceThemeEditor } from './SalonMarketplaceThemeEditor';
import { SalonMarketplaceContentEditor } from './SalonMarketplaceContentEditor';
import { SalonMarketplaceSectionsEditor } from './SalonMarketplaceSectionsEditor';
import { SalonMarketplacePreview } from './SalonMarketplacePreview';
import {
  Globe,
  Palette,
  FileText,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const SalonMarketplaceCustomizer: React.FC = () => {
  const {
    activeSalon,
    services,
    staff,
    reviews,
    formatPrice,
    addToast
  } = useApp();

  const [settings, setSettings] = useState<SalonMarketplaceSettingsRecord | null>(null);
  const [draftConfig, setDraftConfig] = useState<SalonMarketplaceViewConfig>(() =>
    getDefaultCustomizerConfig(activeSalon?.id)
  );
  const [initialConfig, setInitialConfig] = useState<SalonMarketplaceViewConfig>(() =>
    getDefaultCustomizerConfig(activeSalon?.id)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [activeTab, setActiveTab] = useState<'theme' | 'content' | 'sections'>('theme');

  // Succursales réelles + horaires réels pour l'aperçu (aucune donnée inventée).
  const [salonBranches, setSalonBranches] = useState<{ id: string; name: string }[]>([]);
  const [previewBranches, setPreviewBranches] = useState<PublicSalonDetail['branches']>([]);

  useEffect(() => {
    if (!activeSalon?.id) return;
    let cancelled = false;
    const weekdayOf: Record<string, number> = {
      Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 0
    };
    listSalonBranches(activeSalon.id)
      .then(async (branches) => {
        if (cancelled) return;
        setSalonBranches(branches);
        const withHours = await Promise.all(
          branches.map(async (b) => {
            try {
              const hours = await getBranchHours(activeSalon.id, b.id);
              return {
                id: b.id,
                name: b.name,
                timezone: 'Africa/Abidjan',
                hours: hours.map((h) => ({
                  weekday: weekdayOf[h.day] ?? 1,
                  isOpen: h.isOpen,
                  opensAt: h.isOpen ? h.open : null,
                  closesAt: h.isOpen ? h.close : null
                }))
              };
            } catch {
              return { id: b.id, name: b.name, timezone: 'Africa/Abidjan', hours: [] };
            }
          })
        );
        if (!cancelled) setPreviewBranches(withHours);
      })
      .catch(() => {
        if (!cancelled) {
          setSalonBranches([]);
          setPreviewBranches([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSalon?.id]);

  // Load customizer configuration on mount or when activeSalon changes
  useEffect(() => {
    if (!activeSalon?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCustomizerConfig(activeSalon.id)
      .then((rec) => {
        if (!cancelled) {
          setSettings(rec);
          const cfg = rec.draftConfig || getDefaultCustomizerConfig(activeSalon.id);
          setDraftConfig(cfg);
          setInitialConfig(cfg);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const fallback = getDefaultCustomizerConfig(activeSalon.id);
          setDraftConfig(fallback);
          setInitialConfig(fallback);
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger la configuration de vitrine."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSalon?.id]);

  const isDirty = useMemo(() => {
    return JSON.stringify(draftConfig) !== JSON.stringify(initialConfig);
  }, [draftConfig, initialConfig]);

  const handleConfigChange = (updated: Partial<SalonMarketplaceViewConfig>) => {
    setDraftConfig((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleSaveDraft = async () => {
    if (!activeSalon?.id) return;
    try {
      setSaving(true);
      const updated = await saveCustomizerDraft(activeSalon.id, draftConfig);
      setSettings(updated);
      setInitialConfig(draftConfig);
      addToast("Brouillon de la vitrine enregistré avec succès.", 'success');
    } catch (err) {
      addToast((err instanceof Error ? err.message : '') || "Erreur lors de l'enregistrement du brouillon.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!activeSalon?.id) return;
    try {
      setPublishing(true);
      // Save draft first if dirty
      if (isDirty) {
        await saveCustomizerDraft(activeSalon.id, draftConfig);
      }
      const updated = await publishCustomizer(activeSalon.id);
      setSettings(updated);
      setInitialConfig(draftConfig);
      addToast("Votre vitrine est désormais publiée et visible sur la marketplace !", 'success');
    } catch (err) {
      addToast((err instanceof Error ? err.message : '') || "Impossible de publier la vitrine. Vérifiez l'adresse, téléphone et photo de couverture.", 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!activeSalon?.id) return;
    try {
      setPublishing(true);
      await unpublishCustomizer(activeSalon.id);
      setSettings((prev) => (prev ? { ...prev, isPublished: false } : null));
      addToast("La vitrine a été dépubliée de la marketplace.", 'info');
    } catch (err) {
      addToast((err instanceof Error ? err.message : '') || "Erreur lors de la dépublication.", 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleRevert = async () => {
    if (!activeSalon?.id) return;
    try {
      setSaving(true);
      const reverted = await revertCustomizerDraft(activeSalon.id);
      setSettings(reverted);
      const cfg = reverted.draftConfig || getDefaultCustomizerConfig(activeSalon.id);
      setDraftConfig(cfg);
      setInitialConfig(cfg);
      addToast("Modifications non enregistrées annulées.", 'info');
    } catch (err) {
      addToast((err instanceof Error ? err.message : '') || "Erreur lors de l'annulation.", 'error');
    } finally {
      setSaving(false);
    }
  };

  // Build live PublicSalonDetail object for real-time live preview
  const previewDetail: PublicSalonDetail = useMemo(() => {
    const salonServices = services.filter((s) => s.salonId === activeSalon.id);
    const salonStaff = staff.filter((s) => s.salonId === activeSalon.id);
    const salonReviews = reviews.filter((r) => r.salonId === activeSalon.id);

    return {
      salon: {
        ...activeSalon,
        tagline: draftConfig.customTagline || activeSalon.tagline,
        description: draftConfig.customDescription || activeSalon.description,
      },
      services: salonServices,
      // L'aperçu applique la sélection du brouillon, comme la page publique
      // appliquera celle de la configuration publiée (liste vide = aucun).
      staff: salonStaff
        .filter((st) => (draftConfig.visibleStaffIds ?? []).includes(st.id))
        .map((st) => ({
        id: st.id,
        name: st.name,
        role: st.role,
        specialties: st.specialties,
        serviceIds: st.serviceIds,
      })),
      reviews: salonReviews,
      branches: previewBranches,
      rating:
        activeSalon.rating ??
        (salonReviews.length > 0
          ? salonReviews.reduce((sum, r) => sum + r.rating, 0) / salonReviews.length
          : null),
      reviewCount: activeSalon.reviewCount ?? salonReviews.length,
      minPrice:
        salonServices.length > 0
          ? Math.min(...salonServices.map((s) => s.price))
          : (activeSalon.minPrice ?? null),
      customizer: draftConfig,
    };
  }, [activeSalon, services, staff, reviews, draftConfig, previewBranches]);

  const publicUrl = activeSalon.slug
    ? `/salons/${activeSalon.slug}`
    : `/salons/${activeSalon.id}`;

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-stone-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A45C]" />
        <p className="text-sm">Chargement du personnalisateur de vitrine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#C9A45C]" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Personnalisation de la Vitrine Marketplace
            </h1>
          </div>
          <p className="text-sm text-stone-400 mt-1">
            Configurez et prévisualisez la présentation publique de {activeSalon.name} sur la marketplace.
          </p>
        </div>
      </div>

      {/* Zone C: Action Bar & Viewport Controller */}
      <SalonMarketplaceToolbar
        viewport={viewport}
        onViewportChange={setViewport}
        isDirty={isDirty}
        isPublished={settings?.isPublished ?? false}
        publishedAt={settings?.publishedAt}
        saving={saving}
        publishing={publishing}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onRevert={handleRevert}
        publicUrl={publicUrl}
      />

      {error && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split Screen: Zone A (Config) & Zone B (Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Zone A: Configuration Panels (5 cols on lg) */}
        <div className="lg:col-span-5 bg-[#161619] border border-stone-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Section Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#111113] border border-stone-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('theme')}
              className={cn(
                'py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                activeTab === 'theme'
                  ? 'bg-[#222228] text-white shadow'
                  : 'text-stone-400 hover:text-white'
              )}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Modèle</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={cn(
                'py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                activeTab === 'content'
                  ? 'bg-[#222228] text-white shadow'
                  : 'text-stone-400 hover:text-white'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Contenu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className={cn(
                'py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                activeTab === 'sections'
                  ? 'bg-[#222228] text-white shadow'
                  : 'text-stone-400 hover:text-white'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Sections</span>
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="pt-1">
            {activeTab === 'theme' && (
              <SalonMarketplaceThemeEditor
                config={draftConfig}
                onChange={handleConfigChange}
              />
            )}

            {activeTab === 'content' && (
              <SalonMarketplaceContentEditor
                salon={activeSalon}
                config={draftConfig}
                services={services}
                staff={staff}
                onChange={handleConfigChange}
                formatPrice={formatPrice}
              />
            )}

            {activeTab === 'sections' && (
              <SalonMarketplaceSectionsEditor
                config={draftConfig}
                onChange={handleConfigChange}
              />
            )}
          </div>
        </div>

        {/* Zone B: Real-Time Live Preview (7 cols on lg) */}
        <div className="lg:col-span-7">
          <SalonMarketplacePreview
            detail={previewDetail}
            config={draftConfig}
            viewport={viewport}
            formatPrice={formatPrice}
          />
        </div>
      </div>
    </div>
  );
};
