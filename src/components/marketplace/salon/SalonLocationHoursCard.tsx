import React, { useState } from 'react';
import { SalonCardStyle } from '../../../types';
import { Card } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { MapPin, Clock, Phone, MessageCircle, ExternalLink, ChevronDown, Check } from 'lucide-react';

interface BranchInfo {
  id: string;
  name: string;
  timezone: string;
  hours: { weekday: number; isOpen: boolean; opensAt: string | null; closesAt: string | null }[];
}

interface SalonLocationHoursCardProps {
  address?: string;
  city?: string;
  commune?: string;
  quarter?: string;
  phone?: string;
  whatsapp?: string;
  branches?: BranchInfo[];
  cardStyle?: SalonCardStyle;
  accentColor?: string;
  showAddress?: boolean;
  showPhone?: boolean;
  showWhatsapp?: boolean;
  /** Succursale mise en avant par le propriétaire (sélectionnée par défaut). */
  defaultBranchId?: string;
}

const WEEKDAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const SalonLocationHoursCard: React.FC<SalonLocationHoursCardProps> = ({
  address,
  city = 'Abidjan',
  commune,
  quarter,
  phone,
  whatsapp,
  branches = [],
  cardStyle = 'rounded-3xl',
  accentColor = '#C9A45C',
  showAddress = true,
  showPhone = true,
  showWhatsapp = true,
  defaultBranchId
}) => {
  const initialBranchIndex = Math.max(
    0,
    branches.findIndex((b) => b.id === defaultBranchId)
  );
  const [selectedBranchIndex, setSelectedBranchIndex] = useState(initialBranchIndex);
  const [hoursExpanded, setHoursExpanded] = useState(false);

  const activeBranch = branches[selectedBranchIndex] || branches[0];
  const fullAddress = [address, quarter, commune, city].filter(Boolean).join(', ');

  // Determine current weekday in Africa/Abidjan (UTC)
  const currentWeekday = new Date().getUTCDay();
  const currentBranchHour = activeBranch?.hours?.find((h) => h.weekday === currentWeekday);
  const isOpenToday = currentBranchHour ? currentBranchHour.isOpen : true;

  const mapsQuery = encodeURIComponent(`${fullAddress || 'Barbershop Abidjan'}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <Card
      className={cn(
        'bg-[#161619] border border-stone-800 p-5 shadow-lg space-y-4',
        cardStyle
      )}
    >
      {/* Header with branch selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#101010]"
            style={{ backgroundColor: accentColor }}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Horaires & Accès
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'size-2 rounded-full',
                  isOpenToday ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                )}
              />
              <span className="text-[11px] font-medium text-stone-300">
                {isOpenToday
                  ? currentBranchHour?.opensAt
                    ? `Ouvert aujourd'hui (${currentBranchHour.opensAt.slice(0, 5)} - ${currentBranchHour.closesAt?.slice(0, 5)})`
                    : "Ouvert aujourd'hui"
                  : 'Fermé aujourd’hui'}
              </span>
            </div>
          </div>
        </div>

        {branches.length > 1 && (
          <select
            value={selectedBranchIndex}
            onChange={(e) => setSelectedBranchIndex(Number(e.target.value))}
            className="bg-[#202025] border border-stone-700 text-stone-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            {branches.map((b, i) => (
              <option key={b.id} value={i}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Address & Itinerary */}
      {showAddress && (
        <div className="p-3 rounded-xl bg-[#1d1d22] border border-stone-800/80 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Adresse</p>
              <p className="text-stone-300 mt-0.5">{fullAddress || 'Adresse disponible sur confirmation'}</p>
            </div>
          </div>

          {fullAddress && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <span>Itinéraire</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Weekday Schedule List (Expandable or Compact) */}
      {activeBranch?.hours && activeBranch.hours.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setHoursExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs text-stone-400 hover:text-white py-1 cursor-pointer transition-colors"
          >
            <span>Voir toute la semaine</span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', hoursExpanded && 'rotate-180')}
            />
          </button>

          {hoursExpanded && (
            <div className="pt-2 border-t border-stone-800/80 space-y-1 text-xs">
              {activeBranch.hours.map((h) => {
                const isToday = h.weekday === currentWeekday;
                return (
                  <div
                    key={h.weekday}
                    className={cn(
                      'flex items-center justify-between py-1 px-2 rounded-md',
                      isToday ? 'bg-white/5 font-semibold text-white' : 'text-stone-400'
                    )}
                  >
                    <span>{WEEKDAY_NAMES[h.weekday]}</span>
                    <span>
                      {h.isOpen
                        ? `${h.opensAt ? h.opensAt.slice(0, 5) : '09:00'} — ${h.closesAt ? h.closesAt.slice(0, 5) : '19:00'}`
                        : 'Fermé'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick Contacts */}
      <div className="flex items-center gap-2 pt-1">
        {showPhone && phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-stone-400" />
            <span>{phone}</span>
          </a>
        )}

        {showWhatsapp && whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-800/40 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp direct</span>
          </a>
        )}
      </div>
    </Card>
  );
};
