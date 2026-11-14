import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Globe2,
  LayoutTemplate,
  Megaphone,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  useMarketplaceContent,
  type MarketplaceAnnouncementConfig,
  type MarketplaceContentConfig,
  type MarketplaceFeaturedSection,
  type MarketplaceHeroConfig,
  type MarketplacePromoBannerConfig,
  type MarketplaceProCtaConfig,
  type MarketplaceSiteMetadata,
} from '../../lib/marketplace-content';
import { useUI } from '../../context/UIContext';
import { SiteAnnouncementBar } from '../common/SiteAnnouncementBar';
import { FeaturedSectionCard } from '../marketplace/FeaturedSectionCard';

interface MarketplaceConfigManagerProps {
  adminEmail: string;
}

type ConfigSubTab = 'banners' | 'featured' | 'metadata';

interface BannerDraft {
  announcement: MarketplaceAnnouncementConfig;
  hero: MarketplaceHeroConfig;
  promoBanner: MarketplacePromoBannerConfig;
  proCta: MarketplaceProCtaConfig;
}

const SUB_TABS: Array<{ id: ConfigSubTab; label: string; icon: React.ElementType }> = [
  { id: 'banners', label: '1. Bannières', icon: Megaphone },
  { id: 'featured', label: '2. Sections à la une', icon: LayoutTemplate },
  { id: 'metadata', label: '3. Métadonnées du site', icon: Globe2 },
];

const INPUT_CLASS =
  'w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C]';
const PRIMARY_BUTTON_CLASS =
  'px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] text-xs font-black flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const SECONDARY_BUTTON_CLASS =
  'px-3.5 py-2 rounded-xl bg-[#1c1c24] hover:bg-[#252530] text-xs font-bold text-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer';

const META_TITLE_RECOMMENDED = 60;
const META_DESCRIPTION_RECOMMENDED = 160;

/** Copie profonde simple (la configuration est sérialisable). */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Supprime les espaces superflus sur toutes les valeurs texte d'un bloc. */
const trimStrings = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, typeof field === 'string' ? field.trim() : field]),
  ) as T;

/** Liens acceptés : chemin interne, ancre, e-mail ou URL http(s). Vide = aucun lien. */
const isValidLink = (url: string) => url.trim() === '' || /^(\/|#|https?:\/\/|mailto:)/i.test(url.trim());
const isValidHttpUrl = (url: string) => url.trim() === '' || /^https?:\/\/\S+$/i.test(url.trim());
const isValidEmail = (email: string) =>
  email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const pickBanners = (config: MarketplaceContentConfig): BannerDraft =>
  clone({
    announcement: config.announcement,
    hero: config.hero,
    promoBanner: config.promoBanner,
    proCta: config.proCta,
  });

/** Renumérote l'ordre d'affichage selon la position dans la liste. */
const withSequentialOrder = (list: MarketplaceFeaturedSection[]): MarketplaceFeaturedSection[] =>
  list.map((feature, index) => ({ ...feature, order: index + 1 }));

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  type?: string;
  wide?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  hint,
  placeholder,
  multiline = false,
  rows = 2,
  type = 'text',
  wide = false,
}) => (
  <div className={wide ? 'md:col-span-2' : undefined}>
    <label htmlFor={id} className="block text-xs font-semibold text-stone-300 mb-1">
      {label}
    </label>
    {multiline ? (
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    ) : (
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    )}
    {hint && <p className="text-[10px] text-stone-500 mt-1">{hint}</p>}
  </div>
);

interface ToggleFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleField: React.FC<ToggleFieldProps> = ({ id, label, checked, onChange }) => (
  <label
    htmlFor={id}
    className="flex items-center gap-2.5 text-xs font-semibold text-stone-300 cursor-pointer"
  >
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="w-4 h-4 rounded text-[#C9A45C] bg-[#08080a] border-[#2e2e38] focus:ring-0"
    />
    <span>{label}</span>
  </label>
);

interface PanelProps {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ id, title, description, icon: Icon, action, children }) => (
  <section aria-labelledby={id} className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#1f1f28] pb-4">
      <div>
        <h3 id={id} className="text-base font-bold text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
          {title}
        </h3>
        <p className="text-xs text-stone-400 mt-1">{description}</p>
      </div>
      {action}
    </div>
    {children}
  </section>
);

interface SaveBarProps {
  dirty: boolean;
  onDiscard: () => void;
  saveLabel: string;
}

const SaveBar: React.FC<SaveBarProps> = ({ dirty, onDiscard, saveLabel }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-4 border-t border-[#1f1f28]">
    {dirty && <span className="text-[11px] text-[#E5C378] sm:mr-auto">Modifications non enregistrées</span>}
    <button type="button" onClick={onDiscard} disabled={!dirty} className={SECONDARY_BUTTON_CLASS}>
      <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Annuler les modifications</span>
    </button>
    <button type="submit" disabled={!dirty} className={PRIMARY_BUTTON_CLASS}>
      <Save className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{saveLabel}</span>
    </button>
  </div>
);

/**
 * Configuration des bannières, sections à la une et métadonnées du site.
 * Chaque enregistrement met à jour le store partagé : la marketplace, la navbar et le
 * titre de l'onglet reflètent la nouvelle configuration immédiatement.
 */
export const MarketplaceConfigManager: React.FC<MarketplaceConfigManagerProps> = ({ adminEmail }) => {
  const { addToast } = useUI();
  const { config, updateConfig } = useMarketplaceContent();
  const [subTab, setSubTab] = useState<ConfigSubTab>('banners');

  // Brouillons locaux : rien n'est publié avant « Enregistrer ».
  const [bannerDraft, setBannerDraft] = useState<BannerDraft>(() => pickBanners(config));
  const [featuredDraft, setFeaturedDraft] = useState<MarketplaceFeaturedSection[]>(() =>
    clone(config.featuredSections),
  );
  const [metaDraft, setMetaDraft] = useState<MarketplaceSiteMetadata>(() => clone(config.siteMetadata));

  const bannersDirty = JSON.stringify(bannerDraft) !== JSON.stringify(pickBanners(config));
  const featuredDirty =
    JSON.stringify(withSequentialOrder(featuredDraft)) !==
    JSON.stringify(withSequentialOrder(config.featuredSections));
  const metaDirty = JSON.stringify(metaDraft) !== JSON.stringify(config.siteMetadata);
  const dirtyBySubTab: Record<ConfigSubTab, boolean> = {
    banners: bannersDirty,
    featured: featuredDirty,
    metadata: metaDirty,
  };

  // ---------- BANNIÈRES ----------
  const updateBanner = <K extends keyof BannerDraft>(block: K, patch: Partial<BannerDraft[K]>) => {
    setBannerDraft((prev) => ({ ...prev, [block]: { ...prev[block], ...patch } }));
  };

  const saveBanners = (event: React.FormEvent) => {
    event.preventDefault();
    const { announcement, hero, promoBanner, proCta } = bannerDraft;

    if (announcement.enabled && !announcement.text.trim()) {
      addToast("Renseignez le texte de l'annonce ou désactivez-la.", 'error');
      return;
    }
    if (!isValidLink(announcement.linkUrl) || !isValidLink(promoBanner.buttonLink)) {
      addToast('Les liens doivent commencer par /, #, mailto: ou https://', 'error');
      return;
    }
    if (!isValidLink(proCta.primaryButtonLink) || !isValidLink(proCta.secondaryButtonLink)) {
      addToast('Les liens doivent commencer par /, #, mailto: ou https://', 'error');
      return;
    }
    if (!hero.headlineMain.trim()) {
      addToast('Le titre principal de la bannière Hero est obligatoire.', 'error');
      return;
    }

    updateConfig(
      {
        ...config,
        announcement: trimStrings(announcement),
        hero: { ...hero, ...trimStrings(hero) },
        promoBanner: { ...promoBanner, ...trimStrings(promoBanner) },
        proCta: { ...proCta, ...trimStrings(proCta) },
      },
      adminEmail,
      'Mise à jour des bannières Marketplace',
    );
    addToast('Bannières enregistrées : visibles immédiatement sur la marketplace.', 'success');
  };

  // ---------- SECTIONS À LA UNE ----------
  const addFeaturedSection = () => {
    const next: MarketplaceFeaturedSection = {
      id: `featured-${Date.now()}`,
      eyebrow: 'Nouveauté',
      title: 'Nouvelle section à la une',
      description: 'Décrivez ici ce que vous souhaitez mettre en avant.',
      ctaLabel: 'Découvrir',
      ctaLink: '#salons-section',
      theme: 'dark',
      isVisible: true,
      order: featuredDraft.length + 1,
    };
    setFeaturedDraft((prev) => [...prev, next]);
  };

  const patchFeaturedSection = (id: string, patch: Partial<MarketplaceFeaturedSection>) => {
    setFeaturedDraft((prev) =>
      prev.map((feature) => (feature.id === id ? { ...feature, ...patch } : feature)),
    );
  };

  const removeFeaturedSection = (id: string) => {
    setFeaturedDraft((prev) => prev.filter((feature) => feature.id !== id));
  };

  const moveFeaturedSection = (index: number, direction: -1 | 1) => {
    setFeaturedDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveFeaturedSections = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = featuredDraft.find((feature) => !feature.title.trim() || !isValidLink(feature.ctaLink));
    if (invalid) {
      addToast(
        invalid.title.trim()
          ? `Lien invalide dans la section « ${invalid.title} ».`
          : 'Chaque section à la une doit avoir un titre.',
        'error',
      );
      return;
    }

    const normalized = withSequentialOrder(featuredDraft.map((feature) => trimStrings(feature)));
    updateConfig(
      { ...config, featuredSections: normalized },
      adminEmail,
      'Mise à jour des sections à la une',
    );
    setFeaturedDraft(normalized);
    addToast('Sections à la une enregistrées : elles apparaissent sur la marketplace.', 'success');
  };

  // ---------- MÉTADONNÉES ----------
  const updateMeta = (patch: Partial<MarketplaceSiteMetadata>) => {
    setMetaDraft((prev) => ({ ...prev, ...patch }));
  };

  const saveMetadata = (event: React.FormEvent) => {
    event.preventDefault();
    if (!metaDraft.siteName.trim()) {
      addToast('Le nom du site est obligatoire.', 'error');
      return;
    }
    if (!isValidEmail(metaDraft.contactEmail)) {
      addToast("L'adresse e-mail de contact n'est pas valide.", 'error');
      return;
    }
    const socialFields = [
      metaDraft.instagramUrl,
      metaDraft.facebookUrl,
      metaDraft.tiktokUrl,
      metaDraft.whatsappUrl,
    ];
    if (!socialFields.every(isValidHttpUrl)) {
      addToast('Les liens réseaux sociaux doivent commencer par https://', 'error');
      return;
    }

    updateConfig(
      { ...config, siteMetadata: trimStrings(metaDraft) },
      adminEmail,
      'Mise à jour des métadonnées du site',
    );
    addToast('Métadonnées enregistrées : titre, SEO et pied de page sont à jour.', 'success');
  };

  const announcementPreview = bannerDraft.announcement;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f1f27]">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#C9A45C] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            MARKETPLACE CONFIG · SUPERADMIN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Bannières, Sections à la une & Métadonnées
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Chaque enregistrement est appliqué immédiatement à la marketplace publique. Dernière publication :{' '}
            {formatDateTime(config.updatedAt)}
          </p>
          <p className="mt-2 text-[11px] text-amber-300/90 max-w-2xl">
            Stockage local : les modifications sont appliquées dans ce navigateur uniquement. Les visiteurs ne
            les voient pas encore, la persistance serveur reste à brancher. Dernière sauvegarde :{' '}
            {formatDateTime(config.updatedAt)}.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="px-3.5 py-2 rounded-xl bg-[#17171d] hover:bg-[#22222a] border border-[#2c2c36] text-xs font-bold text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <ExternalLink className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
          <span>Voir la marketplace</span>
        </a>
      </div>

      {/* Sous-onglets */}
      <div
        role="tablist"
        aria-label="Configuration marketplace"
        className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#121217] border border-[#22222a] rounded-2xl"
      >
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#C9A45C] text-[#101010] shadow-md'
                  : 'text-stone-400 hover:text-white hover:bg-[#181820]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
              {dirtyBySubTab[tab.id] && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-400"
                  title="Modifications non enregistrées"
                  aria-label="Modifications non enregistrées"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 1. BANNIÈRES */}
      {subTab === 'banners' && (
        <form onSubmit={saveBanners} className="space-y-6">
          <Panel
            id="mcm-announcement-title"
            title="Bandeau d'annonce global (haut de page)"
            description="Message affiché au-dessus de la navigation sur toute la marketplace. Désactivé par défaut."
            icon={Megaphone}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <ToggleField
                  id="mcm-announcement-enabled"
                  label="Afficher le bandeau d'annonce"
                  checked={announcementPreview.enabled}
                  onChange={(checked) => updateBanner('announcement', { enabled: checked })}
                />
              </div>
              <TextField
                id="mcm-announcement-text"
                label="Texte de l'annonce"
                wide
                value={announcementPreview.text}
                onChange={(value) => updateBanner('announcement', { text: value })}
                placeholder="ex. Nouveaux créneaux disponibles cette semaine"
              />
              <TextField
                id="mcm-announcement-link-label"
                label="Libellé du lien (optionnel)"
                value={announcementPreview.linkLabel}
                onChange={(value) => updateBanner('announcement', { linkLabel: value })}
              />
              <TextField
                id="mcm-announcement-link-url"
                label="Lien (optionnel)"
                value={announcementPreview.linkUrl}
                onChange={(value) => updateBanner('announcement', { linkUrl: value })}
                placeholder="/tarifs ou https://…"
              />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Aperçu</span>
              <div className="rounded-2xl overflow-hidden border border-[#22222a] bg-[#0d0d0e]">
                {announcementPreview.enabled && announcementPreview.text.trim() ? (
                  <SiteAnnouncementBar announcement={announcementPreview} />
                ) : (
                  <p className="p-4 text-xs text-stone-500">
                    Bandeau masqué : il n'apparaît pas sur la marketplace tant qu'il est désactivé ou sans
                    texte.
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            id="mcm-hero-title"
            title="Bannière d'accueil (Hero)"
            description="Titre d'impact, sous-titre et bouton principal de la page d'accueil."
            icon={LayoutTemplate}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TextField
                id="mcm-hero-badge"
                label="Badge d'accroche"
                value={bannerDraft.hero.badgeText}
                onChange={(value) => updateBanner('hero', { badgeText: value })}
              />
              <TextField
                id="mcm-hero-cta"
                label="Texte du bouton principal"
                value={bannerDraft.hero.ctaText}
                onChange={(value) => updateBanner('hero', { ctaText: value })}
              />
              <TextField
                id="mcm-hero-headline"
                label="Titre principal (ligne 1)"
                value={bannerDraft.hero.headlineMain}
                onChange={(value) => updateBanner('hero', { headlineMain: value })}
              />
              <TextField
                id="mcm-hero-highlight"
                label="Mot clé en italique doré"
                value={bannerDraft.hero.headlineHighlight}
                onChange={(value) => updateBanner('hero', { headlineHighlight: value })}
              />
              <TextField
                id="mcm-hero-description"
                label="Sous-titre"
                wide
                multiline
                rows={2}
                value={bannerDraft.hero.description}
                onChange={(value) => updateBanner('hero', { description: value })}
              />
              <TextField
                id="mcm-hero-search"
                label="Texte d'aide de la recherche"
                value={bannerDraft.hero.searchPlaceholder}
                onChange={(value) => updateBanner('hero', { searchPlaceholder: value })}
              />
              <div className="flex items-end pb-2">
                <ToggleField
                  id="mcm-hero-video"
                  label="Vidéo d'arrière-plan"
                  checked={bannerDraft.hero.showVideo}
                  onChange={(checked) => updateBanner('hero', { showVideo: checked })}
                />
              </div>
            </div>
          </Panel>

          <Panel
            id="mcm-promo-title"
            title="Bannière promotionnelle"
            description="Bandeau d'événement affiché sous le bandeau d'annonce."
            icon={Sparkles}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <ToggleField
                  id="mcm-promo-enabled"
                  label="Afficher la bannière promotionnelle"
                  checked={bannerDraft.promoBanner.enabled}
                  onChange={(checked) => updateBanner('promoBanner', { enabled: checked })}
                />
              </div>
              <TextField
                id="mcm-promo-badge"
                label="Étiquette"
                value={bannerDraft.promoBanner.badge}
                onChange={(value) => updateBanner('promoBanner', { badge: value })}
              />
              <div>
                <label htmlFor="mcm-promo-theme" className="block text-xs font-semibold text-stone-300 mb-1">
                  Thème
                </label>
                <select
                  id="mcm-promo-theme"
                  value={bannerDraft.promoBanner.theme}
                  onChange={(event) =>
                    updateBanner('promoBanner', {
                      theme: event.target.value as MarketplacePromoBannerConfig['theme'],
                    })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="gold">Or</option>
                  <option value="dark">Sombre</option>
                  <option value="emerald">Émeraude</option>
                </select>
              </div>
              <TextField
                id="mcm-promo-title-field"
                label="Titre"
                wide
                value={bannerDraft.promoBanner.title}
                onChange={(value) => updateBanner('promoBanner', { title: value })}
              />
              <TextField
                id="mcm-promo-description"
                label="Description"
                wide
                multiline
                value={bannerDraft.promoBanner.description}
                onChange={(value) => updateBanner('promoBanner', { description: value })}
              />
              <TextField
                id="mcm-promo-button"
                label="Texte du bouton"
                value={bannerDraft.promoBanner.buttonText}
                onChange={(value) => updateBanner('promoBanner', { buttonText: value })}
              />
              <TextField
                id="mcm-promo-link"
                label="Lien du bouton"
                value={bannerDraft.promoBanner.buttonLink}
                onChange={(value) => updateBanner('promoBanner', { buttonLink: value })}
                placeholder="#salons-section"
              />
            </div>
          </Panel>

          <Panel
            id="mcm-pro-title"
            title="Bannière professionnels (ERP)"
            description="Encart invitant les propriétaires de salons à découvrir l'offre et à s'inscrire."
            icon={Globe2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <ToggleField
                  id="mcm-pro-visible"
                  label="Afficher la bannière professionnels"
                  checked={bannerDraft.proCta.isVisible}
                  onChange={(checked) => updateBanner('proCta', { isVisible: checked })}
                />
              </div>
              <TextField
                id="mcm-pro-badge"
                label="Badge"
                value={bannerDraft.proCta.badge}
                onChange={(value) => updateBanner('proCta', { badge: value })}
              />
              <TextField
                id="mcm-pro-title-field"
                label="Titre d'accroche"
                value={bannerDraft.proCta.title}
                onChange={(value) => updateBanner('proCta', { title: value })}
              />
              <TextField
                id="mcm-pro-description"
                label="Description des atouts"
                wide
                multiline
                rows={2}
                value={bannerDraft.proCta.description}
                onChange={(value) => updateBanner('proCta', { description: value })}
              />
              <TextField
                id="mcm-pro-primary-text"
                label="Bouton principal"
                value={bannerDraft.proCta.primaryButtonText}
                onChange={(value) => updateBanner('proCta', { primaryButtonText: value })}
              />
              <TextField
                id="mcm-pro-primary-link"
                label="Lien du bouton principal"
                value={bannerDraft.proCta.primaryButtonLink}
                onChange={(value) => updateBanner('proCta', { primaryButtonLink: value })}
                placeholder="/tarifs"
              />
              <TextField
                id="mcm-pro-secondary-text"
                label="Bouton secondaire"
                value={bannerDraft.proCta.secondaryButtonText}
                onChange={(value) => updateBanner('proCta', { secondaryButtonText: value })}
              />
              <TextField
                id="mcm-pro-secondary-link"
                label="Lien du bouton secondaire"
                value={bannerDraft.proCta.secondaryButtonLink}
                onChange={(value) => updateBanner('proCta', { secondaryButtonLink: value })}
                placeholder="/inscription"
              />
              <div className="md:col-span-2">
                <ToggleField
                  id="mcm-pro-existing"
                  label="Afficher le lien « Espace salon » pour les professionnels déjà inscrits"
                  checked={bannerDraft.proCta.showExistingProLink}
                  onChange={(checked) => updateBanner('proCta', { showExistingProLink: checked })}
                />
              </div>
            </div>
          </Panel>

          <div className="bg-[#0c0c10] border border-[#1a1a22] rounded-3xl p-6">
            <SaveBar
              dirty={bannersDirty}
              onDiscard={() => setBannerDraft(pickBanners(config))}
              saveLabel="Enregistrer les bannières"
            />
          </div>
        </form>
      )}

      {/* 2. SECTIONS À LA UNE */}
      {subTab === 'featured' && (
        <form onSubmit={saveFeaturedSections} className="space-y-6">
          <Panel
            id="mcm-featured-title"
            title="Sections à la une"
            description="Blocs mis en avant sur la page d'accueil, juste après la bande de réassurance. Ils sont affichés dans l'ordre indiqué ci-dessous."
            icon={LayoutTemplate}
            action={
              <button type="button" onClick={addFeaturedSection} className={SECONDARY_BUTTON_CLASS}>
                <Plus className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
                <span>Ajouter une section</span>
              </button>
            }
          >
            {featuredDraft.length === 0 ? (
              <p className="text-xs text-stone-500 bg-[#16161d] border border-dashed border-[#2d2d3a] rounded-2xl p-6 text-center">
                Aucune section à la une. Rien n'est affiché sur la marketplace tant que vous n'en ajoutez pas.
              </p>
            ) : (
              <ol className="space-y-4">
                {featuredDraft.map((feature, index) => (
                  <li
                    key={feature.id}
                    className="bg-[#181820] border border-[#282834] rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#C9A45C]">Position {index + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-300 mr-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={feature.isVisible}
                            onChange={(event) =>
                              patchFeaturedSection(feature.id, { isVisible: event.target.checked })
                            }
                            className="w-3.5 h-3.5 rounded text-[#C9A45C] bg-[#08080a] border-[#2e2e38] focus:ring-0"
                          />
                          <span>Visible</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => moveFeaturedSection(index, -1)}
                          disabled={index === 0}
                          aria-label={`Monter la section ${index + 1}`}
                          className="p-1.5 rounded-lg bg-[#121217] border border-[#2d2d38] text-stone-300 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFeaturedSection(index, 1)}
                          disabled={index === featuredDraft.length - 1}
                          aria-label={`Descendre la section ${index + 1}`}
                          className="p-1.5 rounded-lg bg-[#121217] border border-[#2d2d38] text-stone-300 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFeaturedSection(feature.id)}
                          aria-label={`Supprimer la section ${index + 1}`}
                          className="p-1.5 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 hover:bg-red-900/50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextField
                        id={`mcm-featured-${feature.id}-eyebrow`}
                        label="Surtitre"
                        value={feature.eyebrow}
                        onChange={(value) => patchFeaturedSection(feature.id, { eyebrow: value })}
                      />
                      <div>
                        <label
                          htmlFor={`mcm-featured-${feature.id}-theme`}
                          className="block text-xs font-semibold text-stone-300 mb-1"
                        >
                          Thème
                        </label>
                        <select
                          id={`mcm-featured-${feature.id}-theme`}
                          value={feature.theme}
                          onChange={(event) =>
                            patchFeaturedSection(feature.id, {
                              theme: event.target.value as MarketplaceFeaturedSection['theme'],
                            })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="dark">Sombre</option>
                          <option value="gold">Or</option>
                          <option value="emerald">Émeraude</option>
                        </select>
                      </div>
                      <TextField
                        id={`mcm-featured-${feature.id}-title`}
                        label="Titre"
                        wide
                        value={feature.title}
                        onChange={(value) => patchFeaturedSection(feature.id, { title: value })}
                      />
                      <TextField
                        id={`mcm-featured-${feature.id}-description`}
                        label="Description"
                        wide
                        multiline
                        value={feature.description}
                        onChange={(value) => patchFeaturedSection(feature.id, { description: value })}
                      />
                      <TextField
                        id={`mcm-featured-${feature.id}-cta-label`}
                        label="Texte du lien (optionnel)"
                        value={feature.ctaLabel}
                        onChange={(value) => patchFeaturedSection(feature.id, { ctaLabel: value })}
                      />
                      <TextField
                        id={`mcm-featured-${feature.id}-cta-link`}
                        label="Lien (optionnel)"
                        value={feature.ctaLink}
                        onChange={(value) => patchFeaturedSection(feature.id, { ctaLink: value })}
                        placeholder="#salons-section"
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <SaveBar
              dirty={featuredDirty}
              onDiscard={() => setFeaturedDraft(clone(config.featuredSections))}
              saveLabel="Enregistrer les sections"
            />
          </Panel>

          {featuredDraft.some((feature) => feature.isVisible) && (
            <div className="bg-[#0c0c10] border border-[#1a1a22] rounded-3xl p-6 space-y-3">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Aperçu (sections visibles)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {withSequentialOrder(featuredDraft)
                  .filter((feature) => feature.isVisible)
                  .map((feature) => (
                    <FeaturedSectionCard key={feature.id} feature={feature} />
                  ))}
              </div>
            </div>
          )}
        </form>
      )}

      {/* 3. MÉTADONNÉES DU SITE */}
      {subTab === 'metadata' && (
        <form onSubmit={saveMetadata} className="space-y-6">
          <Panel
            id="mcm-meta-seo-title"
            title="Identité & référencement (SEO)"
            description="Nom du site, titre affiché dans l'onglet du navigateur et description pour les moteurs de recherche."
            icon={Globe2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TextField
                id="mcm-meta-site-name"
                label="Nom du site"
                value={metaDraft.siteName}
                onChange={(value) => updateMeta({ siteName: value })}
              />
              <TextField
                id="mcm-meta-tagline"
                label="Slogan"
                value={metaDraft.tagline}
                onChange={(value) => updateMeta({ tagline: value })}
              />
              <TextField
                id="mcm-meta-title"
                label="Titre de l'onglet (meta title)"
                wide
                value={metaDraft.metaTitle}
                onChange={(value) => updateMeta({ metaTitle: value })}
                hint={`${metaDraft.metaTitle.length}/${META_TITLE_RECOMMENDED} caractères recommandés`}
              />
              <TextField
                id="mcm-meta-description"
                label="Description (meta description)"
                wide
                multiline
                rows={3}
                value={metaDraft.metaDescription}
                onChange={(value) => updateMeta({ metaDescription: value })}
                hint={`${metaDraft.metaDescription.length}/${META_DESCRIPTION_RECOMMENDED} caractères recommandés`}
              />
            </div>
          </Panel>

          <Panel
            id="mcm-meta-footer-title"
            title="Pied de page & contact"
            description="Textes et coordonnées affichés en bas de la marketplace. Les champs vides sont masqués."
            icon={LayoutTemplate}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TextField
                id="mcm-meta-footer-text"
                label="Présentation (pied de page)"
                wide
                multiline
                rows={2}
                value={metaDraft.footerText}
                onChange={(value) => updateMeta({ footerText: value })}
              />
              <TextField
                id="mcm-meta-copyright"
                label="Mention de copyright"
                wide
                value={metaDraft.copyrightText}
                onChange={(value) => updateMeta({ copyrightText: value })}
              />
              <TextField
                id="mcm-meta-email"
                label="E-mail de contact"
                type="email"
                value={metaDraft.contactEmail}
                onChange={(value) => updateMeta({ contactEmail: value })}
              />
              <TextField
                id="mcm-meta-phone"
                label="Téléphone de contact"
                value={metaDraft.contactPhone}
                onChange={(value) => updateMeta({ contactPhone: value })}
              />
            </div>
          </Panel>

          <Panel
            id="mcm-meta-social-title"
            title="Réseaux sociaux"
            description="Liens complets (https://). Seuls les liens renseignés sont affichés."
            icon={Sparkles}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TextField
                id="mcm-meta-instagram"
                label="Instagram"
                value={metaDraft.instagramUrl}
                onChange={(value) => updateMeta({ instagramUrl: value })}
                placeholder="https://instagram.com/…"
              />
              <TextField
                id="mcm-meta-facebook"
                label="Facebook"
                value={metaDraft.facebookUrl}
                onChange={(value) => updateMeta({ facebookUrl: value })}
                placeholder="https://facebook.com/…"
              />
              <TextField
                id="mcm-meta-tiktok"
                label="TikTok"
                value={metaDraft.tiktokUrl}
                onChange={(value) => updateMeta({ tiktokUrl: value })}
                placeholder="https://tiktok.com/@…"
              />
              <TextField
                id="mcm-meta-whatsapp"
                label="WhatsApp (lien d'échange)"
                value={metaDraft.whatsappUrl}
                onChange={(value) => updateMeta({ whatsappUrl: value })}
                placeholder="https://wa.me/…"
              />
            </div>
            <SaveBar
              dirty={metaDirty}
              onDiscard={() => setMetaDraft(clone(config.siteMetadata))}
              saveLabel="Enregistrer les métadonnées"
            />
          </Panel>
        </form>
      )}
    </div>
  );
};
