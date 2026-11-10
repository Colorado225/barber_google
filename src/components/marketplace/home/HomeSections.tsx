// Sections éditoriales de la page d'accueil marketplace : « comment ça marche »,
// sections personnalisées du SuperAdmin et avis clients réels.
import React from 'react';
import { ArrowRight, CheckCircle2, Sparkles, Star } from 'lucide-react';
import type { MarketplaceCustomSection, MarketplaceStepItem } from '../../../lib/marketplace-content';
import type { Review } from '../../../types';
import { DynamicIcon } from './DynamicIcon';

export const StepsSection: React.FC<{ steps: MarketplaceStepItem[] }> = ({ steps }) => (
  <>
    <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps
          .filter((st) => st.isVisible)
          .map((st) => (
            <div
              key={st.id}
              className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9A45C]/40 transition-colors"
            >
              <span className="absolute top-4 right-5 text-4xl font-serif-luxury italic text-[#C9A45C]/25 font-bold">
                {st.stepNumber}
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center mb-4">
                <DynamicIcon name={st.iconName} />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{st.title}</h3>
              <p className="text-xs text-stone-400 leading-relaxed">{st.description}</p>
            </div>
          ))}
      </div>
    </section>
  </>
);
export const CustomSections: React.FC<{ customSections: MarketplaceCustomSection[] }> = ({
  customSections,
}) => (
  <>
    {customSections
      .filter((sec) => sec.isVisible)
      .map((sec) => (
        <section
          key={sec.id}
          className="py-14 border-t border-[#1c1c24] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"
        >
          <div className="mb-8">
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {sec.badgeText}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{sec.title}</h2>
            {sec.description && (
              <p className="text-xs text-stone-400 mt-1 max-w-2xl leading-relaxed">{sec.description}</p>
            )}
          </div>

          {sec.layout === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sec.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#161619] border border-[#282830] hover:border-[#C9A45C]/40 rounded-2xl p-6 flex flex-col justify-between transition-colors"
                >
                  <div>
                    {item.tag && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#221c0e] text-[#E5C378] border border-[#C9A45C]/30 mb-3">
                        {item.tag}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-xs text-stone-400 leading-relaxed">{item.description}</p>
                  </div>
                  {item.linkText && (
                    <a
                      href={item.linkUrl || '#'}
                      className="mt-4 text-xs font-bold text-[#C9A45C] hover:underline flex items-center gap-1"
                    >
                      <span>{item.linkText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {sec.layout === 'features' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sec.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#141418] border border-[#23232c] rounded-2xl p-4 flex items-start gap-3.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#221c0e] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sec.layout === 'banner' && (
            <div className="bg-gradient-to-r from-[#1c1a16] via-[#16161a] to-[#111114] border border-[#C9A45C]/30 rounded-3xl p-8 sm:p-10 shadow-xl">
              <div className="max-w-2xl space-y-3">
                <h3 className="text-xl sm:text-2xl font-bold text-white font-serif-luxury">{sec.title}</h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">{sec.description}</p>
                <div className="pt-2 flex flex-wrap gap-4">
                  {sec.items.map((it) => (
                    <div
                      key={it.id}
                      className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-stone-200"
                    >
                      <span className="font-bold text-[#C9A45C]">{it.title} : </span>
                      <span>{it.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      ))}
  </>
);
export const ReviewsSection: React.FC<{ reviews: Review[] }> = ({ reviews }) => (
  <>
    <section className="py-14 bg-[#111113] border-t border-[#1f1f23]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold">AVIS</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Ils réservent avec Barber Cuts
          </h2>
        </div>

        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-[#161619] rounded-2xl border border-[#27272c]">
            <Star className="w-10 h-10 mx-auto mb-3 text-stone-600" />
            <p className="text-sm text-stone-400">Aucun avis pour le moment.</p>
            <p className="text-xs text-stone-500 mt-1">
              Les avis apparaîtront ici dès que des clients auront noté leur rendez-vous.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.slice(0, 6).map((rev) => (
              <div
                key={rev.id}
                className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-stone-200 leading-relaxed italic mb-4">« {rev.comment} »</p>
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-[#242429]">
                  <span className="font-bold text-white">{rev.author}</span>
                  <span className="text-stone-500">• {rev.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  </>
);
