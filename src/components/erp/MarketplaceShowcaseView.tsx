import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SalonGalleryItem, Service } from '../../types';
import {
  Sparkles,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  Globe,
  Scissors,
  Star,
  Camera,
  Layers,
  ArrowRight,
  Info,
  Check,
  Flame,
  Clock
} from 'lucide-react';

export const MarketplaceShowcaseView: React.FC = () => {
  const {
    activeSalon,
    services,
    formatPrice,
    updateSalonDetails,
    setMode,
    setSelectedSalonForModal,
    addToast
  } = useApp();

  const salonServices = services.filter((s) => s.salonId === activeSalon.id);

  // Status & Recommandation
  const [isRecommended, setIsRecommended] = useState<boolean>(activeSalon.isRecommended ?? true);
  const [isPublished, setIsPublished] = useState<boolean>(activeSalon.isPublishedOnMarketplace ?? true);

  // Gallery items with title and description
  const initialGalleryItems: SalonGalleryItem[] = activeSalon.galleryItems && activeSalon.galleryItems.length > 0
    ? activeSalon.galleryItems
    : activeSalon.gallery.map((url, i) => ({
        id: `img-${i}`,
        url,
        title: i === 0 ? 'Fauteuils en cuir doré & Miroirs rétro' : i === 1 ? 'Signature Dégradé Américain' : 'Espace soin & serviettes chaudes',
        description: i === 0 ? 'Ambiance feutrée et confort prestige pour votre rasage à l\'ancienne.' : 'Précision millimétrée réalisée par notre maître barbier.'
      }));

  const [galleryItems, setGalleryItems] = useState<SalonGalleryItem[]>(initialGalleryItems);

  // New photo upload modal/form state
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoDescription, setNewPhotoDescription] = useState('');
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);

  // Selected catalog services for publication
  const [publishedServiceIds, setPublishedServiceIds] = useState<string[]>(
    activeSalon.featuredPrestations && activeSalon.featuredPrestations.length > 0
      ? activeSalon.featuredPrestations
      : salonServices.map((s) => s.id)
  );

  const toggleServicePublish = (serviceId: string) => {
    setPublishedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setNewPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim() || !newPhotoTitle.trim()) {
      alert('Veuillez fournir une image et un titre pour cette photo.');
      return;
    }

    const newItem: SalonGalleryItem = {
      id: `gal-${Date.now()}`,
      url: newPhotoUrl,
      title: newPhotoTitle.trim(),
      description: newPhotoDescription.trim() || 'Photo officielle de la vitrine Barber Cuts.'
    };

    setGalleryItems((prev) => [...prev, newItem]);
    setNewPhotoUrl('');
    setNewPhotoTitle('');
    setNewPhotoDescription('');
    setIsAddingPhoto(false);
  };

  const handleRemovePhoto = (id: string) => {
    if (galleryItems.length <= 1) {
      alert('Vous devez conserver au moins une photo pour votre vitrine.');
      return;
    }
    setGalleryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSetAsCover = (url: string) => {
    updateSalonDetails(activeSalon.id, { coverImage: url });
    addToast('Photo de couverture mise à jour !', 'success');
  };

  // Main Publish Action
  const handleValidateAndPublish = () => {
    const updatedGalleryUrls = galleryItems.map((g) => g.url);

    updateSalonDetails(activeSalon.id, {
      isPublishedOnMarketplace: true,
      isRecommended: isRecommended,
      galleryItems,
      gallery: updatedGalleryUrls,
      featuredPrestations: publishedServiceIds,
      coverImage: galleryItems[0]?.url || activeSalon.coverImage,
      publicationDate: new Date().toISOString()
    });

    addToast(
      isRecommended
        ? `Félicitations ! La vitrine de "${activeSalon.name}" est publiée et en vedette dans l'onglet "Salons recommandés" de la Marketplace !`
        : `La vitrine de "${activeSalon.name}" est maintenant publiée sur la Marketplace !`,
      'success'
    );
  };

  const presetPhotos = [
    {
      title: 'Salon lounge doré',
      desc: 'Fauteuils en cuir doré et éclairage chaleureux',
      url: '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png'
    },
    {
      title: 'Coupe dégradé américain',
      desc: 'Maîtrise de la tondeuse et finitions rasoir',
      url: '/assets/aistudio/screenshot-e664554a-e3b4-4d22-924e-332446e319ad_dfc35c43.png'
    },
    {
      title: 'Espace barbier prestige',
      desc: 'Postes de travail tout confort pour les clients',
      url: '/assets/aistudio/screenshot-18481913-c95c-475e-8deb-93143b1d04f4_b4e11663.png'
    },
    {
      title: 'Comptoir de soins capillaires',
      desc: 'Sélection de produits et huiles de barbe',
      url: '/assets/aistudio/screenshot-ddf3f3da-a677-43c3-98cc-b2a17960cd0b_63fcfb93.png'
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Banner with direct CTA */}
      <div className="bg-gradient-to-r from-[#1e1b14] via-[#17171a] to-[#121214] border border-[#C9A45C]/40 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A45C]/15 border border-[#C9A45C]/30 text-xs font-bold text-[#E5C378]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio de Publication Vitrine Marketplace</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-serif-luxury">
            Publiez vos catalogues & photos sur la Marketplace
          </h2>

          <p className="text-xs text-stone-300 leading-relaxed">
            Choisissez les prestations à exposer aux clients, définissez les titres et descriptions de vos photos d'établissement, et activez la présence de votre salon dans la section <span className="font-bold text-[#E5C378]">"Salons recommandés"</span>.
          </p>
        </div>

        {/* Big Action Button */}
        <div className="shrink-0 flex flex-col gap-2.5">
          <button
            onClick={handleValidateAndPublish}
            className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-xl hover:shadow-[0_0_30px_rgba(201,164,92,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>🚀 Valider & Publier sur la Marketplace</span>
          </button>

          <button
            onClick={() => {
              handleValidateAndPublish();
              setMode('marketplace');
              setTimeout(() => {
                const el = document.getElementById('salons-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }}
            className="text-xs text-[#E5C378] hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-colors py-1"
          >
            <span>Voir en direct dans "Salons recommandés"</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SECTION 1: ACTIVATION "SALONS RECOMMANDÉS" */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <h3 className="font-bold text-white text-base">
                Mise en avant dans l'onglet "Salons recommandés"
              </h3>
            </div>
            <p className="text-xs text-stone-400">
              Lorsque activé, votre salon est affiché en tête de gondole sur la page d'accueil de la Marketplace pour tous les clients d'Abidjan.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={isRecommended}
              onChange={(e) => setIsRecommended(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-[#232328] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-6 after:transition-all peer-checked:bg-[#C9A45C]"></div>
            <span className="ml-3 text-xs font-bold text-white">
              {isRecommended ? 'Activé (Recommandé)' : 'Standard'}
            </span>
          </label>
        </div>

        {isRecommended && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/30 text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Votre salon <strong className="text-white">{activeSalon.name}</strong> apparaîtra directement avec le badge de disponibilité en direct dans la grille <strong className="text-white">"Salons recommandés"</strong>.
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: GESTIONNAIRE D'IMAGES AVEC TITRES & DESCRIPTIONS */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242428] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#C9A45C]" />
              <h3 className="font-bold text-white text-base">
                Galerie Photos de la Vitrine ({galleryItems.length} photos)
              </h3>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Chaque photo uploadée possède son propre titre et sa description affichés aux clients lors de la consultation.
            </p>
          </div>

          <button
            onClick={() => setIsAddingPhoto(!isAddingPhoto)}
            className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b42] text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-[#C9A45C]" />
            <span>Ajouter une photo avec titre</span>
          </button>
        </div>

        {/* Add photo sub-form */}
        {isAddingPhoto && (
          <form onSubmit={handleAddPhotoSubmit} className="p-5 rounded-2xl bg-[#111113] border border-[#C9A45C]/40 space-y-4 animate-in fade-in">
            <h4 className="text-xs font-bold text-[#E5C378] uppercase tracking-wider">
              Nouvelle photo pour la vitrine
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Titre de l'image *
                </label>
                <input
                  type="text"
                  required
                  value={newPhotoTitle}
                  onChange={(e) => setNewPhotoTitle(e.target.value)}
                  placeholder="Ex: Espace Fauteuils Rétro & Shampoing"
                  className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Description / Légende explicative
                </label>
                <input
                  type="text"
                  value={newPhotoDescription}
                  onChange={(e) => setNewPhotoDescription(e.target.value)}
                  placeholder="Ex: Confort absolu pour vos rituels de rasage et soins"
                  className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>
            </div>

            {/* Photo upload / URL */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-300 block">
                Fichier image ou URL *
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="Collez l'URL d'une image ou uploadez un fichier..."
                  className="flex-1 bg-[#161619] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />

                <label className="bg-[#222226] hover:bg-[#2b2b30] text-stone-200 border border-[#333338] px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>Uploader un fichier</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Presets suggestions */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-400">
                <span>Ou choisir un visuel de prestige :</span>
                {presetPhotos.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setNewPhotoUrl(preset.url);
                      setNewPhotoTitle(preset.title);
                      setNewPhotoDescription(preset.desc);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#202025] hover:bg-[#2c2c34] text-stone-300 border border-[#2d2d34]"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingPhoto(false)}
                className="px-4 py-2 rounded-xl bg-[#232328] text-stone-400 hover:text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold"
              >
                Ajouter cette photo
              </button>
            </div>
          </form>
        )}

        {/* Gallery items list with title and description editing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {galleryItems.map((item, index) => {
            const isCover = item.url === activeSalon.coverImage;
            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-[#111113] border border-[#25252a] hover:border-stone-500 transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-3">
                  <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-black/40 border border-[#2a2a2e]">
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    {isCover && (
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] bg-[#C9A45C] text-[#101010] font-extrabold px-2.5 py-0.5 rounded-full shadow-md">
                          Photo de couverture
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Description Inputs */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-0.5">
                        Titre affiché
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGalleryItems((prev) =>
                            prev.map((g) => (g.id === item.id ? { ...g, title: val } : g))
                          );
                        }}
                        className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-[#C9A45C]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-0.5">
                        Description / Légende
                      </label>
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGalleryItems((prev) =>
                            prev.map((g) => (g.id === item.id ? { ...g, description: val } : g))
                          );
                        }}
                        className="w-full bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1 text-xs text-stone-300 focus:outline-none focus:border-[#C9A45C]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#222226]">
                  {!isCover ? (
                    <button
                      type="button"
                      onClick={() => handleSetAsCover(item.url)}
                      className="text-[11px] text-[#C9A45C] hover:underline font-semibold"
                    >
                      Définir comme couverture
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Couverture active
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(item.id)}
                    className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-red-950/20 transition-colors"
                    title="Supprimer la photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: CATALOGUES DE PRESTATIONS À PUBLIER */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#242428] pb-3">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#C9A45C]" />
            <div>
              <h3 className="font-bold text-white text-base">
                Catalogue des Prestations Publiées sur la Vitrine
              </h3>
              <p className="text-xs text-stone-400">
                Sélectionnez les formules accessibles à la réservation en ligne sur la Marketplace.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#E5C378]">
            {publishedServiceIds.length} / {salonServices.length} prestations publiées
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {salonServices.map((srv) => {
            const isPublished = publishedServiceIds.includes(srv.id);
            return (
              <div
                key={srv.id}
                onClick={() => toggleServicePublish(srv.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isPublished
                    ? 'bg-[#1b1914] border-[#C9A45C] shadow-sm'
                    : 'bg-[#111113] border-[#25252a] opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      isPublished
                        ? 'bg-[#C9A45C] border-[#C9A45C] text-[#101010]'
                        : 'border-[#333338] bg-transparent'
                    }`}
                  >
                    {isPublished && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white">{srv.name}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                      <span className="uppercase text-[#C9A45C] font-semibold">{srv.category}</span>
                      <span>•</span>
                      <span>{srv.durationMinutes} min</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-extrabold text-[#E5C378]">
                    {formatPrice(srv.price)}
                  </span>
                  <div className="text-[10px] text-stone-500 font-medium">
                    {isPublished ? 'En ligne' : 'Masqué'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FINAL PUBLICATION CONFIRMATION BAR */}
      <div className="bg-[#121214] border border-[#C9A45C]/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Prêt pour la publication en direct</span>
          </h4>
          <p className="text-xs text-stone-400 mt-0.5">
            Vos modifications seront immédiatement synchronisées dans l'onglet "Salons recommandés" et sur la fiche publique.
          </p>
        </div>

        <button
          onClick={handleValidateAndPublish}
          className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-extrabold text-sm px-6 py-3 rounded-xl shadow-lg hover:shadow-[0_0_25px_rgba(201,164,92,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Valider & Publier la Vitrine</span>
        </button>
      </div>
    </div>
  );
};
