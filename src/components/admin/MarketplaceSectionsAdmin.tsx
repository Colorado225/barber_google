import React, { useState } from 'react';
import {
  Globe,
  Layout,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Scissors,
  Award,
  Smartphone,
  Star,
  Clock,
  Search,
  Sliders,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  Tag,
  Flame,
  ArrowRight,
} from 'lucide-react';
import {
  useMarketplaceContent,
  type MarketplaceContentConfig,
  type MarketplaceCustomSection,
  type MarketplaceCustomSectionItem,
  type MarketplaceCategoryItem,
  type MarketplaceTrustItem,
  type MarketplaceStepItem,
  type MarketplaceTabConfig,
  type MarketplaceFaqItem,
} from '../../lib/marketplace-content';
import { useOptionalApp } from '../../context/AppContext';

interface MarketplaceSectionsAdminProps {
  adminEmail: string;
}

type AdminSectionSubTab =
  | 'hero'
  | 'tabs'
  | 'trust'
  | 'categories'
  | 'steps'
  | 'promo'
  | 'custom'
  | 'faq'
  | 'pro_cta';

export const MarketplaceSectionsAdmin: React.FC<MarketplaceSectionsAdminProps> = ({
  adminEmail,
}) => {
  const { addToast } = useOptionalApp();
  const { config, updateConfig, resetConfig } = useMarketplaceContent();

  // Local editable draft state
  const [draft, setDraft] = useState<MarketplaceContentConfig>(() => JSON.parse(JSON.stringify(config)));
  const [activeSubTab, setActiveSubTab] = useState<AdminSectionSubTab>('hero');

  // New item draft states
  const [newTabLabel, setNewTabLabel] = useState('');
  const [newTabPath, setNewTabPath] = useState('');

  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [newTrustTitle, setNewTrustTitle] = useState('');
  const [newTrustSubtitle, setNewTrustSubtitle] = useState('');

  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  // New Custom Section draft
  const [isAddingCustomSection, setIsAddingCustomSection] = useState(false);
  const [newCustomSecTitle, setNewCustomSecTitle] = useState('');
  const [newCustomSecBadge, setNewCustomSecBadge] = useState('SECTION EXCLUSIVE');
  const [newCustomSecDesc, setNewCustomSecDesc] = useState('');
  const [newCustomSecLayout, setNewCustomSecLayout] = useState<'cards' | 'banner' | 'faq' | 'features'>('cards');

  // Save changes handler
  const handleSaveAll = () => {
    updateConfig(draft, adminEmail);
    addToast('Toutes les modifications de la Marketplace sont enregistrées et visibles en direct !', 'success');
  };

  const handleResetDefaults = () => {
    if (window.confirm('Voulez-vous réinitialiser toutes les sections de la Marketplace aux valeurs par défaut d’usine ?')) {
      resetConfig(adminEmail);
      setDraft(JSON.parse(JSON.stringify(config)));
      addToast('Contenus réinitialisés aux valeurs d’origine.', 'info');
    }
  };

  // Add custom section
  const handleAddCustomSection = () => {
    if (!newCustomSecTitle.trim()) {
      addToast('Veuillez entrer un titre pour la section', 'error');
      return;
    }
    const newSec: MarketplaceCustomSection = {
      id: `custom-sec-${Date.now()}`,
      title: newCustomSecTitle.trim(),
      badgeText: newCustomSecBadge.trim() || 'SECTION EXCLUSIVE',
      description: newCustomSecDesc.trim(),
      layout: newCustomSecLayout,
      isVisible: true,
      order: draft.customSections.length + 1,
      items: [
        {
          id: `item-${Date.now()}-1`,
          title: 'Premier élément clé',
          description: 'Description détaillée des avantages et caractéristiques proposés.',
          tag: 'Point Fort',
        },
      ],
    };
    setDraft((prev) => ({
      ...prev,
      customSections: [...prev.customSections, newSec],
    }));
    setNewCustomSecTitle('');
    setNewCustomSecDesc('');
    setIsAddingCustomSection(false);
    addToast(`Section "${newSec.title}" ajoutée avec succès.`, 'success');
  };

  const handleDeleteCustomSection = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((s) => s.id !== id),
    }));
    addToast('Section supprimée du brouillon.', 'info');
  };

  const handleAddCustomSectionItem = (secId: string) => {
    const newItem: MarketplaceCustomSectionItem = {
      id: `item-${Date.now()}`,
      title: 'Nouveau point d’excellence',
      description: 'Détail de la prestation ou de la garantie offerte au client.',
      tag: 'Nouveau',
    };
    setDraft((prev) => ({
      ...prev,
      customSections: prev.customSections.map((s) =>
        s.id === secId ? { ...s, items: [...s.items, newItem] } : s
      ),
    }));
  };

  const handleDeleteCustomSectionItem = (secId: string, itemId: string) => {
    setDraft((prev) => ({
      ...prev,
      customSections: prev.customSections.map((s) =>
        s.id === secId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s
      ),
    }));
  };

  // Add Navigation Tab
  const handleAddTab = () => {
    if (!newTabLabel.trim() || !newTabPath.trim()) return;
    const newTab: MarketplaceTabConfig = {
      id: `tab-${Date.now()}`,
      label: newTabLabel.trim(),
      path: newTabPath.trim(),
      isVisible: true,
      order: draft.navTabs.length + 1,
    };
    setDraft((prev) => ({ ...prev, navTabs: [...prev.navTabs, newTab] }));
    setNewTabLabel('');
    setNewTabPath('');
    addToast(`Onglet "${newTab.label}" ajouté à la barre de navigation.`, 'success');
  };

  // Add Category
  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    const newCat: MarketplaceCategoryItem = {
      id: `cat-${Date.now()}`,
      label: newCatLabel.trim(),
      slug: newCatLabel.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      iconName: 'Scissors',
      description: newCatDesc.trim(),
      isPopular: true,
      isVisible: true,
    };
    setDraft((prev) => ({ ...prev, categories: [...prev.categories, newCat] }));
    setNewCatLabel('');
    setNewCatDesc('');
    addToast(`Catégorie "${newCat.label}" ajoutée au catalogue.`, 'success');
  };

  // Add Trust Item
  const handleAddTrustItem = () => {
    if (!newTrustTitle.trim()) return;
    const item: MarketplaceTrustItem = {
      id: `trust-${Date.now()}`,
      title: newTrustTitle.trim(),
      subtitle: newTrustSubtitle.trim(),
      iconName: 'Award',
      isVisible: true,
    };
    setDraft((prev) => ({ ...prev, trustItems: [...prev.trustItems, item] }));
    setNewTrustTitle('');
    setNewTrustSubtitle('');
    addToast('Point de réassurance ajouté.', 'success');
  };

  // Add FAQ Item
  const handleAddFaqItem = () => {
    if (!newFaqQ.trim() || !newFaqA.trim()) return;
    const item: MarketplaceFaqItem = {
      id: `faq-${Date.now()}`,
      question: newFaqQ.trim(),
      answer: newFaqA.trim(),
      isVisible: true,
    };
    setDraft((prev) => ({ ...prev, faqs: [...prev.faqs, item] }));
    setNewFaqQ('');
    setNewFaqA('');
    addToast('Question FAQ ajoutée.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f1f27]">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#C9A45C] flex items-center gap-1.5">
            <Globe className="w-4 h-4" />
            MARKETPLACE CMS · SUPERADMIN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Administration des Sections & Onglets de la Marketplace
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Modifiez les textes, visuels, bannières, et ajoutez de nouvelles sections personnalisées visibles immédiatement.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[#17171d] hover:bg-[#22222a] border border-[#2c2c36] text-xs font-bold text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
            <span>Voir Marketplace en direct</span>
          </a>

          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-[#17171d] hover:bg-[#22222a] border border-[#2c2c36] text-xs font-bold text-stone-400 hover:text-red-300 transition-colors cursor-pointer"
            title="Rétablir valeurs par défaut"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] text-xs font-black flex items-center gap-1.5 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer & Publier</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#121217] border border-[#22222a] rounded-2xl">
        {[
          { id: 'hero', label: '1. Hero & Accroche', icon: Sparkles },
          { id: 'tabs', label: '2. Onglets Navigation', icon: Layout, count: draft.navTabs.length },
          { id: 'trust', label: '3. Réassurance & Preuves', icon: Award, count: draft.trustItems.length },
          { id: 'categories', label: '4. Catégories & Tags', icon: Tag, count: draft.categories.length },
          { id: 'steps', label: '5. Étapes Réservation', icon: Clock, count: draft.steps.length },
          { id: 'promo', label: '6. Bannière Événement', icon: Flame },
          { id: 'custom', label: '7. Nouvelles Sections', icon: Plus, count: draft.customSections.length },
          { id: 'pro_cta', label: '8. Bannière Business Pro', icon: Scissors },
          { id: 'faq', label: '9. Questions Fréquentes', icon: HelpCircle, count: draft.faqs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as AdminSectionSubTab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#C9A45C] text-[#101010] shadow-md'
                  : 'text-stone-400 hover:text-white hover:bg-[#181820]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-[#101010]/20 text-[#101010]' : 'bg-[#1e1e26] text-stone-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB CONTENT PANELS */}

      {/* 1. HERO SECTION */}
      {activeSubTab === 'hero' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9A45C]" />
              Configuration de la Section Hero (Tête de page)
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Personnalisez le titre d’impact, le sous-titre de luxe, et le champ de recherche principal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Badge d’accroche supérieur</label>
              <input
                type="text"
                value={draft.hero.badgeText}
                onChange={(e) =>
                  setDraft({ ...draft, hero: { ...draft.hero, badgeText: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Texte du Bouton CTA Principal</label>
              <input
                type="text"
                value={draft.hero.ctaText}
                onChange={(e) =>
                  setDraft({ ...draft, hero: { ...draft.hero, ctaText: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Titre Principal (Ligne 1)</label>
              <input
                type="text"
                value={draft.hero.headlineMain}
                onChange={(e) =>
                  setDraft({ ...draft, hero: { ...draft.hero, headlineMain: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Mot Clé de Luxe (Italique & Doré)
              </label>
              <input
                type="text"
                value={draft.hero.headlineHighlight}
                onChange={(e) =>
                  setDraft({ ...draft, hero: { ...draft.hero, headlineHighlight: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-300 mb-1">Description / Sous-titre</label>
              <textarea
                rows={2}
                value={draft.hero.description}
                onChange={(e) =>
                  setDraft({ ...draft, hero: { ...draft.hero, description: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Texte d’aide de la recherche</label>
              <input
                type="text"
                value={draft.hero.searchPlaceholder}
                onChange={(e) =>
                  setDraft({ ...draft, hero: { ...draft.hero, searchPlaceholder: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.hero.showVideo}
                  onChange={(e) =>
                    setDraft({ ...draft, hero: { ...draft.hero, showVideo: e.target.checked } })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#25252e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C9A45C]"></div>
              </label>
              <span className="text-xs text-stone-300 font-semibold">
                Activer la vidéo cinématographique d'arrière-plan
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. ONGLETS DE NAVIGATION */}
      {activeSubTab === 'tabs' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layout className="w-4 h-4 text-[#C9A45C]" />
              Gestion des Onglets de Navigation Publique
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Activez, modifiez ou ajoutez de nouveaux liens dans l’en-tête et le pied de page de la marketplace.
            </p>
          </div>

          <div className="space-y-3">
            {draft.navTabs.map((tab, idx) => (
              <div
                key={tab.id}
                className="flex items-center justify-between gap-4 p-3.5 bg-[#181820] border border-[#282834] rounded-2xl"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-bold text-stone-500 w-6">0{idx + 1}</span>
                  <input
                    type="text"
                    value={tab.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft({
                        ...draft,
                        navTabs: draft.navTabs.map((t) => (t.id === tab.id ? { ...t, label: val } : t)),
                      });
                    }}
                    className="bg-[#121217] border border-[#2d2d38] rounded-xl px-3 py-1.5 text-xs text-white font-bold w-44"
                  />
                  <input
                    type="text"
                    value={tab.path}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft({
                        ...draft,
                        navTabs: draft.navTabs.map((t) => (t.id === tab.id ? { ...t, path: val } : t)),
                      });
                    }}
                    className="bg-[#121217] border border-[#2d2d38] rounded-xl px-3 py-1.5 text-xs text-stone-400 flex-1"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDraft({
                        ...draft,
                        navTabs: draft.navTabs.map((t) =>
                          t.id === tab.id ? { ...t, isVisible: !t.isVisible } : t
                        ),
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      tab.isVisible ? 'bg-emerald-950/60 text-emerald-300' : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {tab.isVisible ? 'Visible' : 'Masqué'}
                  </button>

                  {draft.navTabs.length > 2 && (
                    <button
                      onClick={() => {
                        setDraft({
                          ...draft,
                          navTabs: draft.navTabs.filter((t) => t.id !== tab.id),
                        });
                      }}
                      className="p-1.5 text-stone-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Tab form */}
          <div className="p-4 bg-[#16161d] border border-dashed border-[#2d2d3a] rounded-2xl flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-stone-300">Ajouter un onglet :</span>
            <input
              type="text"
              placeholder="Libellé (ex. Guide Style)"
              value={newTabLabel}
              onChange={(e) => setNewTabLabel(e.target.value)}
              className="bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white w-40"
            />
            <input
              type="text"
              placeholder="Lien/URL (ex. /guide ou #salons-section)"
              value={newTabPath}
              onChange={(e) => setNewTabPath(e.target.value)}
              className="bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white flex-1"
            />
            <button
              onClick={handleAddTab}
              className="px-4 py-1.5 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. RÉASSURANCE & PREUVES */}
      {activeSubTab === 'trust' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-[#C9A45C]" />
              Bannière de Réassurance & Preuves d'Excellence
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Configurez les 4 badges de confiance et statistiques affichés sous la recherche.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {draft.trustItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#181820] border border-[#282834] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#C9A45C]">Badge Réassurance</span>
                  <button
                    onClick={() => {
                      setDraft({
                        ...draft,
                        trustItems: draft.trustItems.map((t) =>
                          t.id === item.id ? { ...t, isVisible: !t.isVisible } : t
                        ),
                      });
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                      item.isVisible ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {item.isVisible ? 'Affiché' : 'Désactivé'}
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Titre d'impact (Gras)</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft({
                        ...draft,
                        trustItems: draft.trustItems.map((t) => (t.id === item.id ? { ...t, title: val } : t)),
                      });
                    }}
                    className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Sous-texte explicatif</label>
                  <input
                    type="text"
                    value={item.subtitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft({
                        ...draft,
                        trustItems: draft.trustItems.map((t) => (t.id === item.id ? { ...t, subtitle: val } : t)),
                      });
                    }}
                    className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-stone-300"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Trust Item */}
          <div className="p-4 bg-[#16161d] border border-dashed border-[#2d2d3a] rounded-2xl flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-stone-300">Nouveau point de preuve :</span>
            <input
              type="text"
              placeholder="Titre (ex. 99.8% de Satisfaction)"
              value={newTrustTitle}
              onChange={(e) => setNewTrustTitle(e.target.value)}
              className="bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white w-56"
            />
            <input
              type="text"
              placeholder="Sous-titre (ex. Plus de 20 000 avis certifiés)"
              value={newTrustSubtitle}
              onChange={(e) => setNewTrustSubtitle(e.target.value)}
              className="bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white flex-1"
            />
            <button
              onClick={handleAddTrustItem}
              className="px-4 py-1.5 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. CATÉGORIES & TAGS */}
      {activeSubTab === 'categories' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#C9A45C]" />
              Catégories de Prestations & Filtres Rapides
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Gérez les tags de styles proposés aux clients pour filtrer les salons en 1 clic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {draft.categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-[#181820] border border-[#282834] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#C9A45C]">Tag Prestation</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setDraft({
                          ...draft,
                          categories: draft.categories.map((c) =>
                            c.id === cat.id ? { ...c, isPopular: !c.isPopular } : c
                          ),
                        });
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        cat.isPopular ? 'bg-amber-950 text-amber-300 font-bold' : 'text-stone-500'
                      }`}
                    >
                      {cat.isPopular ? '★ Populaire' : 'Standard'}
                    </button>
                    <button
                      onClick={() => {
                        setDraft({
                          ...draft,
                          categories: draft.categories.filter((c) => c.id !== cat.id),
                        });
                      }}
                      className="p-1 text-stone-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={cat.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft({
                      ...draft,
                      categories: draft.categories.map((c) => (c.id === cat.id ? { ...c, label: val } : c)),
                    });
                  }}
                  className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                />

                <input
                  type="text"
                  value={cat.description || ''}
                  placeholder="Courte description"
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft({
                      ...draft,
                      categories: draft.categories.map((c) =>
                        c.id === cat.id ? { ...c, description: val } : c
                      ),
                    });
                  }}
                  className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-stone-300"
                />
              </div>
            ))}
          </div>

          {/* Add Category */}
          <div className="p-4 bg-[#16161d] border border-dashed border-[#2d2d3a] rounded-2xl flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-stone-300">Nouvelle catégorie :</span>
            <input
              type="text"
              placeholder="Nom (ex. Barbe & Soin Royal)"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              className="bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white w-52"
            />
            <input
              type="text"
              placeholder="Description des prestations associées"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              className="bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white flex-1"
            />
            <button
              onClick={handleAddCategory}
              className="px-4 py-1.5 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. ÉTAPES DE RÉSERVATION (COMMENT ÇA MARCHE) */}
      {activeSubTab === 'steps' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C9A45C]" />
              Section « Comment ça marche » (01, 02, 03...)
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Présentez le parcours utilisateur clair en 3 ou 4 étapes numérotées.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {draft.steps.map((st, i) => (
              <div
                key={st.id}
                className="bg-[#181820] border border-[#282834] rounded-2xl p-5 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-serif-luxury font-bold text-[#C9A45C]/40">
                    {st.stepNumber}
                  </span>
                  <button
                    onClick={() => {
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s) => (s.id === st.id ? { ...s, isVisible: !s.isVisible } : s)),
                      });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      st.isVisible ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {st.isVisible ? 'Actif' : 'Masqué'}
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Titre de l'étape</label>
                  <input
                    type="text"
                    value={st.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s) => (s.id === st.id ? { ...s, title: val } : s)),
                      });
                    }}
                    className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Description explicative</label>
                  <textarea
                    rows={3}
                    value={st.description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s) => (s.id === st.id ? { ...s, description: val } : s)),
                      });
                    }}
                    className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-stone-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. BANNIÈRE PROMO / ÉVÉNEMENT */}
      {activeSubTab === 'promo' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#C9A45C]" />
                Bannière Promotionnelle & Événements Spéciaux
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Affichez un encart saisonnier mis en valeur (ex. Fêtes de fin d'année, Tabaski, Grands Concours).
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={draft.promoBanner.enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: { ...draft.promoBanner, enabled: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#25252e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C9A45C]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Badge d'événement</label>
              <input
                type="text"
                value={draft.promoBanner.badge}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: { ...draft.promoBanner, badge: e.target.value },
                  })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Thème visuel</label>
              <select
                value={draft.promoBanner.theme}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: {
                      ...draft.promoBanner,
                      theme: e.target.value as 'gold' | 'dark' | 'emerald',
                    },
                  })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                <option value="gold">Or Impérial (Gold Luxury)</option>
                <option value="dark">Obsidienne & Nuit Noire</option>
                <option value="emerald">Émeraude & Succès</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-300 mb-1">Titre de l'annonce</label>
              <input
                type="text"
                value={draft.promoBanner.title}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: { ...draft.promoBanner, title: e.target.value },
                  })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-300 mb-1">Détails de l'offre</label>
              <textarea
                rows={2}
                value={draft.promoBanner.description}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: { ...draft.promoBanner, description: e.target.value },
                  })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-stone-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Libellé du bouton</label>
              <input
                type="text"
                value={draft.promoBanner.buttonText}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: { ...draft.promoBanner, buttonText: e.target.value },
                  })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Lien de redirection</label>
              <input
                type="text"
                value={draft.promoBanner.buttonLink}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    promoBanner: { ...draft.promoBanner, buttonLink: e.target.value },
                  })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. NOUVELLES SECTIONS DYNAMIQUES (AJOUTER DES SECTIONS) */}
      {activeSubTab === 'custom' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#C9A45C]" />
                Création & Administration de Sections Personnalisées
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Ajoutez de nouvelles sections de contenu directement sur la marketplace sans toucher au code.
              </p>
            </div>

            <button
              onClick={() => setIsAddingCustomSection(!isAddingCustomSection)}
              className="px-4 py-2 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold flex items-center gap-1.5 self-start cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une Section</span>
            </button>
          </div>

          {/* Form to add a new section */}
          {isAddingCustomSection && (
            <div className="p-5 bg-[#16161e] border border-[#C9A45C]/40 rounded-2xl space-y-4 animate-in fade-in">
              <h4 className="text-xs uppercase font-extrabold text-[#C9A45C]">
                Nouvelle Section Personnalisée
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] text-stone-300 mb-1">Titre de la section</label>
                  <input
                    type="text"
                    placeholder="ex. Nos Engagements Qualité & Hygiène"
                    value={newCustomSecTitle}
                    onChange={(e) => setNewCustomSecTitle(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2c2c38] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-300 mb-1">Badge de section</label>
                  <input
                    type="text"
                    placeholder="ex. NOUVEAUTÉ 2026"
                    value={newCustomSecBadge}
                    onChange={(e) => setNewCustomSecBadge(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2c2c38] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-300 mb-1">Mise en page (Layout)</label>
                  <select
                    value={newCustomSecLayout}
                    onChange={(e) =>
                      setNewCustomSecLayout(e.target.value as 'cards' | 'banner' | 'faq' | 'features')
                    }
                    className="w-full bg-[#121217] border border-[#2c2c38] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="cards">Grille de Cartes d’Excellence (Cards)</option>
                    <option value="features">Liste de Caractéristiques (Features)</option>
                    <option value="banner">Encart Pleine Largeur (Banner)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] text-stone-300 mb-1">Description / Tagline</label>
                  <input
                    type="text"
                    placeholder="ex. Découvrez les protocoles exclusifs de notre réseau d'artisans"
                    value={newCustomSecDesc}
                    onChange={(e) => setNewCustomSecDesc(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2c2c38] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsAddingCustomSection(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#22222c] text-xs font-semibold text-stone-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddCustomSection}
                  className="px-4 py-1.5 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold"
                >
                  Créer cette section
                </button>
              </div>
            </div>
          )}

          {/* List of existing custom sections */}
          {draft.customSections.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-xs">
              Aucune section personnalisée active. Cliquez sur « Ajouter une Section » pour en créer une.
            </div>
          ) : (
            <div className="space-y-6">
              {draft.customSections.map((sec) => (
                <div
                  key={sec.id}
                  className="bg-[#181820] border border-[#282834] rounded-2xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#242430]">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#C9A45C]/20 text-[#E5C378] border border-[#C9A45C]/30">
                        {sec.badgeText}
                      </span>
                      <h4 className="text-sm font-bold text-white">{sec.title}</h4>
                      <span className="text-[10px] text-stone-400">({sec.layout})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDraft({
                            ...draft,
                            customSections: draft.customSections.map((s) =>
                              s.id === sec.id ? { ...s, isVisible: !s.isVisible } : s
                            ),
                          });
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          sec.isVisible ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-800 text-stone-500'
                        }`}
                      >
                        {sec.isVisible ? 'Visible' : 'Masquée'}
                      </button>

                      <button
                        onClick={() => handleDeleteCustomSection(sec.id)}
                        className="p-1.5 text-stone-500 hover:text-red-400"
                        title="Supprimer la section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Section metadata edit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft({
                          ...draft,
                          customSections: draft.customSections.map((s) =>
                            s.id === sec.id ? { ...s, title: val } : s
                          ),
                        });
                      }}
                      className="bg-[#121217] border border-[#2d2d3a] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                    />

                    <input
                      type="text"
                      value={sec.description}
                      placeholder="Sous-titre / description"
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft({
                          ...draft,
                          customSections: draft.customSections.map((s) =>
                            s.id === sec.id ? { ...s, description: val } : s
                          ),
                        });
                      }}
                      className="bg-[#121217] border border-[#2d2d3a] rounded-xl px-3 py-1.5 text-xs text-stone-300"
                    />
                  </div>

                  {/* Items inside this section */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-400">
                        Éléments / Cartes de la section ({sec.items.length})
                      </span>
                      <button
                        onClick={() => handleAddCustomSectionItem(sec.id)}
                        className="text-[11px] text-[#C9A45C] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ajouter un élément</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sec.items.map((it) => (
                        <div
                          key={it.id}
                          className="bg-[#121217] border border-[#2a2a36] rounded-xl p-3 space-y-2 relative"
                        >
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={it.tag || ''}
                              placeholder="Tag / Badge"
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraft({
                                  ...draft,
                                  customSections: draft.customSections.map((s) =>
                                    s.id === sec.id
                                      ? {
                                          ...s,
                                          items: s.items.map((i) =>
                                            i.id === it.id ? { ...i, tag: val } : i
                                          ),
                                        }
                                      : s
                                  ),
                                });
                              }}
                              className="text-[10px] text-[#C9A45C] bg-transparent border-b border-[#333342] focus:outline-none w-32"
                            />
                            <button
                              onClick={() => handleDeleteCustomSectionItem(sec.id, it.id)}
                              className="text-stone-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          <input
                            type="text"
                            value={it.title}
                            placeholder="Titre de la carte"
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft({
                                ...draft,
                                customSections: draft.customSections.map((s) =>
                                  s.id === sec.id
                                    ? {
                                        ...s,
                                        items: s.items.map((i) =>
                                          i.id === it.id ? { ...i, title: val } : i
                                        ),
                                      }
                                    : s
                                ),
                              });
                            }}
                            className="w-full bg-[#181820] border border-[#2e2e3c] rounded-lg px-2.5 py-1 text-xs text-white font-bold"
                          />

                          <textarea
                            rows={2}
                            value={it.description}
                            placeholder="Détails"
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft({
                                ...draft,
                                customSections: draft.customSections.map((s) =>
                                  s.id === sec.id
                                    ? {
                                        ...s,
                                        items: s.items.map((i) =>
                                          i.id === it.id ? { ...i, description: val } : i
                                        ),
                                      }
                                    : s
                                ),
                              });
                            }}
                            className="w-full bg-[#181820] border border-[#2e2e3c] rounded-lg px-2.5 py-1 text-xs text-stone-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. BANNIÈRE BUSINESS PRO (ERP CTA) */}
      {activeSubTab === 'pro_cta' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#C9A45C]" />
                Bannière d'Appel Professionnels (Barber Cuts Business ERP)
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Encart invitant les propriétaires de salons à s'inscrire et s'abonner à l'ERP.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={draft.proCta.isVisible}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    proCta: { ...draft.proCta, isVisible: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#25252e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C9A45C]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Badge de bannière</label>
              <input
                type="text"
                value={draft.proCta.badge}
                onChange={(e) =>
                  setDraft({ ...draft, proCta: { ...draft.proCta, badge: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-300 mb-1">Titre d'accroche ERP</label>
              <input
                type="text"
                value={draft.proCta.title}
                onChange={(e) =>
                  setDraft({ ...draft, proCta: { ...draft.proCta, title: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-300 mb-1">Description des atouts</label>
              <textarea
                rows={2}
                value={draft.proCta.description}
                onChange={(e) =>
                  setDraft({ ...draft, proCta: { ...draft.proCta, description: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-stone-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Bouton Principal</label>
              <input
                type="text"
                value={draft.proCta.primaryButtonText}
                onChange={(e) =>
                  setDraft({ ...draft, proCta: { ...draft.proCta, primaryButtonText: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Bouton Secondaire</label>
              <input
                type="text"
                value={draft.proCta.secondaryButtonText}
                onChange={(e) =>
                  setDraft({ ...draft, proCta: { ...draft.proCta, secondaryButtonText: e.target.value } })
                }
                className="w-full bg-[#181820] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* 9. QUESTIONS FRÉQUENTES (FAQ) */}
      {activeSubTab === 'faq' && (
        <div className="bg-[#121216] border border-[#22222a] rounded-3xl p-6 space-y-6">
          <div className="border-b border-[#1f1f28] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#C9A45C]" />
              Foire Aux Questions Marketplace (FAQ)
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Rassurez les clients finaux sur les modes de réservation, paiements Wave/MoMo et annulations.
            </p>
          </div>

          <div className="space-y-4">
            {draft.faqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-[#181820] border border-[#282834] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#C9A45C]">Question Client</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDraft({
                          ...draft,
                          faqs: draft.faqs.map((f) => (f.id === faq.id ? { ...f, isVisible: !f.isVisible } : f)),
                        });
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        faq.isVisible ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-800 text-stone-500'
                      }`}
                    >
                      {faq.isVisible ? 'Affichée' : 'Masquée'}
                    </button>
                    <button
                      onClick={() => {
                        setDraft({
                          ...draft,
                          faqs: draft.faqs.filter((f) => f.id !== faq.id),
                        });
                      }}
                      className="p-1 text-stone-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft({
                      ...draft,
                      faqs: draft.faqs.map((f) => (f.id === faq.id ? { ...f, question: val } : f)),
                    });
                  }}
                  className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                />

                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft({
                      ...draft,
                      faqs: draft.faqs.map((f) => (f.id === faq.id ? { ...f, answer: val } : f)),
                    });
                  }}
                  className="w-full bg-[#121217] border border-[#2e2e3a] rounded-xl px-3 py-1.5 text-xs text-stone-300"
                />
              </div>
            ))}
          </div>

          {/* Add FAQ form */}
          <div className="p-4 bg-[#16161d] border border-dashed border-[#2d2d3a] rounded-2xl space-y-3">
            <span className="text-xs font-bold text-stone-300 block">Ajouter une question / réponse :</span>
            <input
              type="text"
              placeholder="Question (ex. Les pourboires sont-ils inclus ?)"
              value={newFaqQ}
              onChange={(e) => setNewFaqQ(e.target.value)}
              className="w-full bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-2 text-xs text-white"
            />
            <textarea
              rows={2}
              placeholder="Réponse détaillée..."
              value={newFaqA}
              onChange={(e) => setNewFaqA(e.target.value)}
              className="w-full bg-[#181820] border border-[#2e2e3a] rounded-xl px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddFaqItem}
                className="px-4 py-1.5 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter à la FAQ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
