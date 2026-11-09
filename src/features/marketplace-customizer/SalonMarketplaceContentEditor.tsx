import React from 'react';
import { Salon, SalonMarketplaceViewConfig, Service, StaffMember } from '../../types';
import { Switch } from '../../components/ui/switch';
import { cn } from '../../lib/utils';
import {
  Scissors,
  Users,
  MapPin,
  Phone,
  MessageCircle,
  FileText,
  Check,
  Building2,
  Images,
  Star,
} from 'lucide-react';

interface SalonMarketplaceContentEditorProps {
  salon: Salon;
  config: SalonMarketplaceViewConfig;
  services: Service[];
  staff: StaffMember[];
  branches?: { id: string; name: string }[];
  onChange: (updated: Partial<SalonMarketplaceViewConfig>) => void;
  formatPrice?: (amount: number) => string;
}

export const SalonMarketplaceContentEditor: React.FC<SalonMarketplaceContentEditorProps> = ({
  salon,
  config,
  services,
  staff,
  branches = [],
  onChange,
  formatPrice = (amt) => `${amt.toLocaleString('fr-FR')} FCFA`,
}) => {
  const activeServices = services.filter((s) => s.isActive !== false);
  const activeStaff = staff.filter((s) => s.isActive !== false);

  const toggleFeaturedService = (serviceId: string) => {
    const current = config.featuredServiceIds || [];
    const next = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId];
    onChange({ featuredServiceIds: next });
  };

  const toggleVisibleStaff = (staffId: string) => {
    const current = config.visibleStaffIds || [];
    const next = current.includes(staffId) ? current.filter((id) => id !== staffId) : [...current, staffId];
    onChange({ visibleStaffIds: next });
  };

  // Galerie : photos du profil du salon (couverture + galerie). Celles
  // sélectionnées s'affichent dans cet ordre ; la première = couverture.
  const availableImages: string[] = [
    ...(salon.coverImage ? [salon.coverImage] : []),
    ...(salon.gallery ?? []).filter((src: string) => src && src !== salon.coverImage),
  ];
  const selectedImages: string[] = (config.featuredGalleryImageIds ?? []).filter((src: string) =>
    availableImages.includes(src),
  );

  const toggleGalleryImage = (src: string) => {
    const next = selectedImages.includes(src)
      ? selectedImages.filter((s) => s !== src)
      : [...selectedImages, src];
    onChange({ featuredGalleryImageIds: next });
  };

  const makeCover = (src: string) => {
    onChange({
      featuredGalleryImageIds: [src, ...selectedImages.filter((s) => s !== src)],
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TEXTES PUBLICS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#C9A45C]" />
          <h3 className="text-sm font-bold text-white">Textes de présentation</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Slogan public (Tagline)</label>
            <input
              type="text"
              value={config.customTagline ?? salon.tagline ?? ''}
              onChange={(e) => onChange({ customTagline: e.target.value })}
              placeholder="Ex: L'art du dégradé moderne et des soins masculins"
              maxLength={160}
              className="w-full bg-[#18181c] border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Description publique</label>
            <textarea
              rows={3}
              value={config.customDescription ?? salon.description ?? ''}
              onChange={(e) => onChange({ customDescription: e.target.value })}
              placeholder="Présentez l'expérience, les produits utilisés et l'atmosphère..."
              maxLength={1000}
              className="w-full bg-[#18181c] border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C] resize-none"
            />
          </div>
        </div>
      </div>

      {/* 1 bis. GALERIE & COUVERTURE */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-[#C9A45C]" />
            <h3 className="text-sm font-bold text-white">Photos de la vitrine</h3>
          </div>
          <span className="text-[11px] text-stone-400">
            {selectedImages.length > 0
              ? `${selectedImages.length} sélectionnée${selectedImages.length > 1 ? 's' : ''}`
              : 'Toutes affichées'}
          </span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          Choisissez les photos affichées dans le carrousel public. La première sélectionnée sert de
          couverture (étoile pour la définir). Sans sélection, toutes les photos du profil sont affichées. Les
          photos se gèrent dans les paramètres du salon.
        </p>
        {availableImages.length === 0 ? (
          <p className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
            Aucune photo dans le profil du salon. Ajoutez une couverture et des photos depuis les paramètres
            du salon pour personnaliser la galerie.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {availableImages.map((src) => {
              const order = selectedImages.indexOf(src);
              const isSelected = order >= 0;
              const isCover = order === 0;
              return (
                <div key={src} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleGalleryImage(src)}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected ? 'Retirer cette photo de la vitrine' : 'Afficher cette photo sur la vitrine'
                    }
                    className={cn(
                      'block w-full aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all cursor-pointer',
                      isSelected
                        ? 'border-[#C9A45C] opacity-100'
                        : 'border-stone-800 opacity-50 hover:opacity-80',
                    )}
                  >
                    <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                  {isSelected && (
                    <span className="absolute top-1.5 left-1.5 size-5 rounded-full bg-[#C9A45C] text-[#101010] text-[10px] font-bold flex items-center justify-center">
                      {order + 1}
                    </span>
                  )}
                  {isCover ? (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-semibold text-[#C9A45C]">
                      Couverture
                    </span>
                  ) : (
                    isSelected && (
                      <button
                        type="button"
                        onClick={() => makeCover(src)}
                        aria-label="Définir comme photo de couverture"
                        title="Définir comme couverture"
                        className="absolute bottom-1.5 right-1.5 size-6 rounded-md bg-black/70 text-stone-300 hover:text-[#C9A45C] flex items-center justify-center cursor-pointer"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. PRESTATIONS MISES EN AVANT */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#C9A45C]" />
            <h3 className="text-sm font-bold text-white">Prestations en vedette</h3>
          </div>
          <span className="text-[11px] text-stone-400">
            {config.featuredServiceIds?.length || 0} sélectionnée
            {config.featuredServiceIds?.length > 1 ? 's' : ''}
          </span>
        </div>

        <p className="text-xs text-stone-400 leading-relaxed">
          Sélectionnez les prestations à afficher prioritairement sur votre vitrine (tarifs issus de votre
          catalogue).
        </p>

        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {activeServices.map((service) => {
            const isSelected = (config.featuredServiceIds || []).includes(service.id);
            return (
              <div
                key={service.id}
                onClick={() => toggleFeaturedService(service.id)}
                className={cn(
                  'p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer',
                  isSelected
                    ? 'bg-[#201e19] border-[#C9A45C]/60 text-white'
                    : 'bg-[#18181c] border-stone-800 text-stone-400 hover:border-stone-700',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'size-4 rounded flex items-center justify-center shrink-0 border',
                      isSelected
                        ? 'bg-[#C9A45C] border-[#C9A45C] text-[#101010]'
                        : 'border-stone-700 bg-stone-900',
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                  <span className="font-medium truncate text-white">{service.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-stone-400">{service.durationMinutes} min</span>
                  <span className="font-bold text-[#E5C378]">{formatPrice(service.price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MEMBRES D'ÉQUIPE VISIBLES */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C9A45C]" />
            <h3 className="text-sm font-bold text-white">Artisans & Coiffeurs visibles</h3>
          </div>
          <span className="text-[11px] text-stone-400">
            {config.visibleStaffIds?.length || 0} / {activeStaff.length}
          </span>
        </div>

        <p className="text-xs text-stone-400 leading-relaxed">
          Choisissez les membres d'équipe qui apparaissent publiquement. Vos données privées restent
          protégées.
        </p>

        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {activeStaff.map((member) => {
            const isSelected = (config.visibleStaffIds || []).includes(member.id);
            return (
              <div
                key={member.id}
                onClick={() => toggleVisibleStaff(member.id)}
                className={cn(
                  'p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer',
                  isSelected
                    ? 'bg-[#201e19] border-[#C9A45C]/60 text-white'
                    : 'bg-[#18181c] border-stone-800 text-stone-400 hover:border-stone-700',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'size-4 rounded flex items-center justify-center shrink-0 border',
                      isSelected
                        ? 'bg-[#C9A45C] border-[#C9A45C] text-[#101010]'
                        : 'border-stone-700 bg-stone-900',
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                  <span className="font-medium text-white truncate">{member.name}</span>
                </div>

                <span className="text-[11px] text-stone-400 capitalize">{member.role.replace('_', ' ')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 bis. SUCCURSALE MISE EN AVANT */}
      {branches.length > 1 && (
        <div className="space-y-3 pt-2 border-t border-stone-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#C9A45C]" />
            <h3 className="text-sm font-bold text-white">Succursale mise en avant</h3>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Les horaires de cette succursale sont affichés par défaut sur la vitrine. Les visiteurs peuvent
            toujours consulter les autres succursales.
          </p>
          <select
            value={config.featuredBranchId ?? ''}
            onChange={(e) => onChange({ featuredBranchId: e.target.value || undefined })}
            className="w-full bg-[#18181c] border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C] cursor-pointer"
            aria-label="Succursale mise en avant"
          >
            <option value="">Première succursale (par défaut)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. VISIBILITÉ DES CONTACTS */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <h3 className="text-sm font-bold text-white">Coordonnées publiques</h3>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#18181c] border border-stone-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-stone-400" />
              <div>
                <p className="text-xs font-semibold text-white">Afficher l'adresse</p>
                <p className="text-[10px] text-stone-400">{salon.address || 'Non renseignée'}</p>
              </div>
            </div>
            <Switch checked={config.showAddress} onCheckedChange={(val) => onChange({ showAddress: val })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#18181c] border border-stone-800">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-stone-400" />
              <div>
                <p className="text-xs font-semibold text-white">Afficher le numéro de téléphone</p>
                <p className="text-[10px] text-stone-400">{salon.phone || 'Non renseigné'}</p>
              </div>
            </div>
            <Switch checked={config.showPhone} onCheckedChange={(val) => onChange({ showPhone: val })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#18181c] border border-stone-800">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-white">Afficher le bouton WhatsApp</p>
                <p className="text-[10px] text-stone-400">{salon.whatsapp || 'Non renseigné'}</p>
              </div>
            </div>
            <Switch
              checked={config.showWhatsapp}
              onCheckedChange={(val) => onChange({ showWhatsapp: val })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
