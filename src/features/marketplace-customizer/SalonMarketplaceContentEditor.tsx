import React from 'react';
import {
  Salon,
  SalonMarketplaceViewConfig,
  Service,
  StaffMember
} from '../../types';
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
  Building2
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

export const SalonMarketplaceContentEditor: React.FC<
  SalonMarketplaceContentEditorProps
> = ({
  salon,
  config,
  services,
  staff,
  branches = [],
  onChange,
  formatPrice = (amt) => `${amt.toLocaleString('fr-FR')} FCFA`
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
    const next = current.includes(staffId)
      ? current.filter((id) => id !== staffId)
      : [...current, staffId];
    onChange({ visibleStaffIds: next });
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
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Slogan public (Tagline)
            </label>
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
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Description publique
            </label>
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

      {/* 2. PRESTATIONS MISES EN AVANT */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#C9A45C]" />
            <h3 className="text-sm font-bold text-white">Prestations en vedette</h3>
          </div>
          <span className="text-[11px] text-stone-400">
            {config.featuredServiceIds?.length || 0} sélectionnée{config.featuredServiceIds?.length > 1 ? 's' : ''}
          </span>
        </div>

        <p className="text-xs text-stone-400 leading-relaxed">
          Sélectionnez les prestations à afficher prioritairement sur votre vitrine (tarifs issus de votre catalogue).
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
                    : 'bg-[#18181c] border-stone-800 text-stone-400 hover:border-stone-700'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'size-4 rounded flex items-center justify-center shrink-0 border',
                      isSelected
                        ? 'bg-[#C9A45C] border-[#C9A45C] text-[#101010]'
                        : 'border-stone-700 bg-stone-900'
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
          Choisissez les membres d'équipe qui apparaissent publiquement. Vos données privées restent protégées.
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
                    : 'bg-[#18181c] border-stone-800 text-stone-400 hover:border-stone-700'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'size-4 rounded flex items-center justify-center shrink-0 border',
                      isSelected
                        ? 'bg-[#C9A45C] border-[#C9A45C] text-[#101010]'
                        : 'border-stone-700 bg-stone-900'
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                  <span className="font-medium text-white truncate">{member.name}</span>
                </div>

                <span className="text-[11px] text-stone-400 capitalize">
                  {member.role.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
            <Switch
              checked={config.showAddress}
              onCheckedChange={(val) => onChange({ showAddress: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#18181c] border border-stone-800">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-stone-400" />
              <div>
                <p className="text-xs font-semibold text-white">Afficher le numéro de téléphone</p>
                <p className="text-[10px] text-stone-400">{salon.phone || 'Non renseigné'}</p>
              </div>
            </div>
            <Switch
              checked={config.showPhone}
              onCheckedChange={(val) => onChange({ showPhone: val })}
            />
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
