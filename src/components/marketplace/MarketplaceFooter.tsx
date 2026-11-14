import React, { useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { ChevronDown, Scissors, ShieldCheck } from 'lucide-react';
import type { MarketplaceFaqItem, MarketplaceSiteMetadata } from '../../lib/marketplace-content';

interface MarketplaceFooterProps {
  faqs: MarketplaceFaqItem[];
  siteMetadata: MarketplaceSiteMetadata;
  communes: string[];
  onSelectCommune?: (commune: string) => void;
}

export const MarketplaceFooter: React.FC<MarketplaceFooterProps> = ({
  faqs,
  siteMetadata,
  communes,
  onSelectCommune,
}) => {
  const routed = useInRouterContext();
  const visibleFaqs = faqs.filter((item) => item.isVisible);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const socialLinks = [
    { label: 'Instagram', url: siteMetadata.instagramUrl },
    { label: 'Facebook', url: siteMetadata.facebookUrl },
    { label: 'TikTok', url: siteMetadata.tiktokUrl },
    { label: 'WhatsApp', url: siteMetadata.whatsappUrl },
  ].filter((link) => Boolean(link.url));

  const hasContactOrSocial = Boolean(
    siteMetadata.contactEmail || siteMetadata.contactPhone || socialLinks.length > 0,
  );

  const handleCommuneClick = (commune: string) => {
    onSelectCommune?.(commune);
    if (typeof document !== 'undefined') {
      const target = document.getElementById('salons-section');
      if (target && typeof target.scrollIntoView === 'function') {
        const reduced =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      }
    }
  };

  return (
    <footer
      data-testid="marketplace-footer"
      className="mt-auto bg-[#0a0a0c] border-t border-[#1a1a1d] pt-14 pb-10 text-xs text-stone-400"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {visibleFaqs.length > 0 && (
          <section
            id="footer-faq-section"
            aria-labelledby="footer-faq-heading"
            data-testid="footer-faq-section"
            className="pb-12 mb-12 border-b border-[#19191e]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <div className="lg:col-span-4 space-y-3">
                <p className="text-xs font-semibold text-[#C9A45C] tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Questions fréquentes</span>
                </p>
                <h2
                  id="footer-faq-heading"
                  className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance"
                >
                  Réserver en toute confiance
                </h2>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-md">
                  Tout savoir sur les réservations en ligne, les fiches de salons publiées, le suivi sans
                  compte et les avis vérifiés.
                </p>
                <p className="text-[11px] text-stone-400 pt-1">
                  Salons actifs · Suivi par lien personnel · Tarifs transparents par prestation
                </p>
              </div>

              <div className="lg:col-span-8">
                <div className="divide-y divide-[#1d1d23] border-y border-[#1d1d23]">
                  {visibleFaqs.map((faq) => {
                    const isOpen = openFaqId === faq.id;
                    const triggerId = `footer-faq-trigger-${faq.id}`;
                    const panelId = `footer-faq-panel-${faq.id}`;

                    return (
                      <div key={faq.id}>
                        <h3 className="m-0">
                          <button
                            id={triggerId}
                            type="button"
                            data-testid={`footer-faq-trigger-${faq.id}`}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => setOpenFaqId((prev) => (prev === faq.id ? null : faq.id))}
                            className="w-full min-h-[48px] py-4 px-1 flex items-center justify-between gap-4 text-left text-sm sm:text-[15px] font-semibold text-white hover:text-[#E5C378] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] rounded-lg cursor-pointer"
                          >
                            <span>{faq.question}</span>
                            <ChevronDown
                              aria-hidden="true"
                              className={`w-4 h-4 text-[#C9A45C] shrink-0 transition-transform duration-200 ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </h3>

                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={triggerId}
                          data-testid={`footer-faq-panel-${faq.id}`}
                          hidden={!isOpen}
                          className="pb-4 pr-6 sm:pr-10 pl-1 text-xs sm:text-sm text-stone-300 leading-relaxed"
                        >
                          {faq.answer}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1c1a16] border border-[#C9A45C]/30 flex items-center justify-center text-[#C9A45C]">
                <Scissors className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold text-white">{siteMetadata.siteName}</span>
            </div>
            {siteMetadata.tagline && (
              <p className="text-xs text-[#E5C378] font-semibold">{siteMetadata.tagline}</p>
            )}
            {siteMetadata.footerText && (
              <p className="text-xs text-stone-400 leading-relaxed">{siteMetadata.footerText}</p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#C9A45C] tracking-wider mb-3">Clients</h4>
            <ul className="space-y-2">
              <li>
                <a href="#salons-section" className="hover:text-white transition-colors">
                  Trouver un salon
                </a>
              </li>
              <li>
                <a href="#footer-faq-section" className="hover:text-white transition-colors">
                  Questions fréquentes
                </a>
              </li>
              {communes.map((commune) => (
                <li key={commune}>
                  <button
                    type="button"
                    onClick={() => handleCommuneClick(commune)}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Salons à {commune}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#C9A45C] tracking-wider mb-3">Professionnels</h4>
            <ul className="space-y-2">
              <li>
                {routed ? (
                  <Link
                    to="/tarifs"
                    className="text-[#E5C378] hover:underline font-semibold transition-colors"
                  >
                    Tarifs & Formules Salons
                  </Link>
                ) : (
                  <a
                    href="/tarifs"
                    className="text-[#E5C378] hover:underline font-semibold transition-colors"
                  >
                    Tarifs & Formules Salons
                  </a>
                )}
              </li>
              <li>
                {routed ? (
                  <Link to="/inscription" className="hover:text-white transition-colors">
                    Inscrire un établissement
                  </Link>
                ) : (
                  <a href="/inscription" className="hover:text-white transition-colors">
                    Inscrire un établissement
                  </a>
                )}
              </li>
              <li>
                {routed ? (
                  <Link to="/app/tableau-de-bord" className="hover:text-white transition-colors">
                    Espace salon
                  </Link>
                ) : (
                  <a href="/app/tableau-de-bord" className="hover:text-white transition-colors">
                    Espace salon
                  </a>
                )}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#C9A45C] tracking-wider mb-3">Informations</h4>
            {hasContactOrSocial ? (
              <ul className="space-y-2">
                {siteMetadata.contactEmail && (
                  <li>
                    <a
                      href={`mailto:${siteMetadata.contactEmail}`}
                      className="hover:text-white transition-colors"
                    >
                      {siteMetadata.contactEmail}
                    </a>
                  </li>
                )}
                {siteMetadata.contactPhone && <li>{siteMetadata.contactPhone}</li>}
                {socialLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-stone-400 leading-relaxed">
                Les établissements affichés proviennent des données publiées dans la plateforme.
              </p>
            )}
          </div>
        </div>

        <div className="pt-8 border-t border-[#19191c] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-400">
          <span>{siteMetadata.copyrightText}</span>
          <div className="flex flex-wrap items-center gap-4">
            <span>Salons publiés</span>
            <span>Suivi de réservation protégé</span>
            <span>Avis liés aux rendez-vous</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
