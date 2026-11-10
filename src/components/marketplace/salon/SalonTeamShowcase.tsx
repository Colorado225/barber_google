import React, { useState } from 'react';
import { StaffMember, SalonCardStyle } from '../../../types';
import { Card } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { UserCheck } from 'lucide-react';

interface SalonTeamShowcaseProps {
  staff: Pick<StaffMember, 'id' | 'name' | 'role' | 'specialties' | 'avatar'>[];
  visibleStaffIds?: string[];
  cardStyle?: SalonCardStyle;
  accentColor?: string;
  onSelectStaff?: (staffId: string) => void;
}

// Aucun portrait de substitution : un employé sans photo est représenté par
// ses initiales, jamais par le visage d'une autre personne.
function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  master_barber: 'Master Barber',
  barber: 'Barbier Professionnel',
  colorist: 'Coloriste Expert',
  stylist: 'Styliste Coiffeur',
  manager: 'Manager & Coiffeur',
};

export const SalonTeamShowcase: React.FC<SalonTeamShowcaseProps> = ({
  staff,
  visibleStaffIds = [],
  cardStyle = 'rounded-3xl',
  accentColor = '#C9A45C',
  onSelectStaff,
}) => {
  const visibleList =
    visibleStaffIds.length > 0 ? staff.filter((m) => visibleStaffIds.includes(m.id)) : staff;

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const displayStaff = visibleList.slice(0, 3);

  if (displayStaff.length === 0) {
    return (
      <Card
        className={cn(
          'p-5 border border-stone-800 bg-[#161619] text-center text-stone-400 text-xs min-h-[180px] flex items-center justify-center',
          cardStyle,
        )}
      >
        <p>L'équipe sera bientôt présentée.</p>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'relative bg-[#161619] border border-stone-800 p-4 cursor-pointer overflow-hidden shadow-lg flex flex-col justify-between group transition-all duration-300',
        cardStyle,
      )}
    >
      {/* Top Banner / Counter */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#101010]"
            style={{ backgroundColor: accentColor }}
          >
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white">Équipe d'artisans</span>
        </div>
        <span className="text-[11px] font-semibold text-stone-300 bg-stone-800/80 px-2.5 py-0.5 rounded-full border border-stone-700">
          {visibleList.length} barbier{visibleList.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Interactive Stacked Avatars (inspired by TripFolderCard) */}
      <div className="relative my-3 h-28 flex items-center justify-center">
        {displayStaff.map((member, i) => {
          const avatarUrl = member.avatar || null;
          const isSelected = selectedStaffId === member.id;

          // Fan-out positions for stacked presentation
          const offsetClass =
            i === 0 ? '-translate-x-12 -rotate-6' : i === 1 ? 'z-10 scale-105' : 'translate-x-12 rotate-6';

          const hoverClass =
            i === 0
              ? 'group-hover:-translate-x-14 group-hover:-rotate-12'
              : i === 1
                ? 'group-hover:scale-110'
                : 'group-hover:translate-x-14 group-hover:rotate-12';

          return (
            <div
              key={member.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStaffId(member.id);
                onSelectStaff?.(member.id);
              }}
              className={cn(
                'absolute size-18 rounded-2xl overflow-hidden border-2 shadow-xl transition-all duration-500 cursor-pointer',
                isSelected ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110 z-20' : 'border-stone-700',
                offsetClass,
                hoverClass,
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={member.name} loading="lazy" className="size-full object-cover" />
              ) : (
                <div
                  aria-hidden="true"
                  className="size-full flex items-center justify-center bg-gradient-to-br from-stone-700 to-stone-900 text-lg font-bold text-[#C9A45C]"
                >
                  {initialsOf(member.name)}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-1">
                <span className="text-[9px] font-bold text-white truncate">{member.name.split(' ')[0]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details of team member or hint */}
      <div className="text-center space-y-1 z-10 pt-1 border-t border-stone-800/60">
        <p className="text-xs font-semibold text-white">
          {displayStaff.map((m) => m.name.split(' ')[0]).join(', ')}
        </p>
        <p className="text-[11px] text-stone-400">
          {displayStaff[0]?.role
            ? (ROLE_LABELS[displayStaff[0].role] ?? 'Artisan expert')
            : 'Artisans experts'}
        </p>
      </div>
    </Card>
  );
};
