// Carrousel de témoignages : avis réels des clients, avec repli sur les
// témoignages de démonstration (jamais confondus avec de vrais avis).
import React from 'react';
import { Quote, Star } from 'lucide-react';

export interface HomeTestimony {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  initials: string;
}

export const TestimonialsSection: React.FC<{
  items: HomeTestimony[];
  activeIndex: number;
  onSelect: (index: number) => void;
}> = ({ items, activeIndex, onSelect }) => {
  const active = items.length ? items[activeIndex % items.length] : null;
  return (
    <>
      <section id="testimonies-section" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5" />
              TÉMOIGNAGES
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Ils nous font confiance</h2>
            <p className="text-xs text-stone-400 mt-2 max-w-xl leading-relaxed">
              Des clients satisfaits et des gérants de salons qui font grandir leur activité avec Barber Cuts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {items.map((testimony, index) => (
              <button
                key={testimony.id}
                onClick={() => onSelect(index)}
                aria-label={`Voir le témoignage de ${testimony.name}`}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  activeIndex === index ? 'bg-[#C9A45C] w-6' : 'bg-[#3a3a40] hover:bg-[#57575f]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grand témoignage actif */}
          <div className="lg:col-span-1 bg-gradient-to-b from-[#1b1913] to-[#151518] border border-[#C9A45C]/30 rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden">
            <Quote className="absolute -top-3 -right-3 w-24 h-24 text-[#C9A45C]/10" />
            {active ? (
              <>
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: active.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-stone-100 leading-relaxed italic">« {active.quote} »</p>
                </div>
                <div className="flex items-center gap-3 pt-6 mt-6 border-t border-[#2a2820]">
                  <div className="w-10 h-10 rounded-full bg-[#C9A45C] text-[#101010] font-bold text-xs flex items-center justify-center shrink-0">
                    {active.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{active.name}</h4>
                    <p className="text-[11px] text-[#C9A45C]">{active.role}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative z-10 text-left py-4">
                <Quote className="w-6 h-6 text-[#C9A45C] mb-3" />
                <h4 className="text-sm font-bold text-white">Aucun témoignage pour l’instant</h4>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                  Les avis de vos clients s’afficheront ici dès le premier retour.
                </p>
              </div>
            )}
          </div>

          {/* Liste compacte des témoignages */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.length === 0 && (
              <div className="sm:col-span-2 flex items-center justify-center rounded-2xl border border-dashed border-[#2a2a2e] p-8 text-center text-xs text-stone-500">
                Aucun avis client enregistré pour le moment.
              </div>
            )}
            {items.map((testimony, index) => (
              <button
                key={testimony.id}
                onClick={() => onSelect(index)}
                className={`text-left bg-[#151518] border rounded-2xl p-5 transition-all cursor-pointer ${
                  activeIndex === index
                    ? 'border-[#C9A45C]/50 shadow-[0_0_20px_rgba(201,164,92,0.08)]'
                    : 'border-[#26262b] hover:border-[#3d3d44]'
                }`}
              >
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: testimony.rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed line-clamp-3 mb-3">{testimony.quote}</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#24242a] border border-[#3a3a42] text-[11px] font-bold text-stone-200 flex items-center justify-center shrink-0">
                    {testimony.initials}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-bold text-white truncate">{testimony.name}</span>
                    <span className="block text-[10px] text-stone-500 truncate">{testimony.role}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
