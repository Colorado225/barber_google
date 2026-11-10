// Blocs de bas de page marketplace : FAQ dynamique, appel à l'action pro
// et pied de page du site (contacts, réseaux, liens métier).
import React from 'react';
import { ChevronDown, HelpCircle, Scissors } from 'lucide-react';
import type {
  MarketplaceFaqItem,
  MarketplaceProCtaConfig,
  MarketplaceSiteMetadata,
} from '../../../lib/marketplace-content';

export const FaqSection: React.FC<{
  faqs: MarketplaceFaqItem[];
  openIndex: number | null;
  onToggle: (index: number | null) => void;
}> = ({ faqs, openIndex, onToggle }) => (
  <>
    <section className="py-14 bg-[#0f0f12] border-t border-[#1f1f26]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            FOIRE AUX QUESTIONS
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Tout ce que vous devez savoir
          </h2>
        </div>

        <div className="space-y-3">
          {faqs
            .filter((f) => f.isVisible)
            .map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={faq.id}
                  className="bg-[#16161b] border border-[#272732] rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => onToggle(isOpen ? null : index)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-[#C9A45C] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#C9A45C] transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs text-stone-300 leading-relaxed border-t border-[#22222b] pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </section>
  </>
);
export const ProCtaBanner: React.FC<{ cta: MarketplaceProCtaConfig }> = ({ cta }) => (
  <>
    <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1c1a16] via-[#161619] to-[#121214] border border-[#C9A45C]/30 p-8 sm:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#C9A45C]">
            {cta.badge || 'BARBER CUTS BUSINESS'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight font-serif-luxury">
            {cta.title || 'Gérez votre salon avec l’ERP Barber Cuts.'}
          </h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            {cta.description ||
              'Planning, caisse, clients, services, personnel et statistiques réunis dans un même espace.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-3">
            <a
              href={cta.primaryButtonLink || '/tarifs'}
              className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] cursor-pointer"
            >
              {cta.primaryButtonText || 'Découvrir les Tarifs Salons'}
            </a>
            <a
              href={cta.secondaryButtonLink || '/inscription'}
              className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b42] font-semibold text-sm px-6 py-3 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              {cta.secondaryButtonText || 'Inscrire mon salon'}
            </a>
            {cta.showExistingProLink && (
              <a
                href="/app/tableau-de-bord"
                className="text-stone-400 hover:text-white text-xs underline underline-offset-4 ml-2"
              >
                Espace pro existant
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  </>
);
export const SiteFooter: React.FC<{
  siteMetadata: MarketplaceSiteMetadata;
  communes: string[];
  onSelectCommune: (commune: string) => void;
}> = ({ siteMetadata, communes, onSelectCommune }) => {
  const socialLinks = [
    { label: 'Instagram', url: siteMetadata.instagramUrl },
    { label: 'Facebook', url: siteMetadata.facebookUrl },
    { label: 'TikTok', url: siteMetadata.tiktokUrl },
    { label: 'WhatsApp', url: siteMetadata.whatsappUrl },
  ].filter((link) => Boolean(link.url));
  const hasContactOrSocial = Boolean(
    siteMetadata.contactEmail || siteMetadata.contactPhone || socialLinks.length > 0,
  );
  return (
    <>
      <footer className="mt-auto bg-[#0a0a0c] border-t border-[#1a1a1d] py-12 text-xs text-stone-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1c1a16] border border-[#C9A45C]/30 flex items-center justify-center text-[#C9A45C]">
                  <Scissors className="w-4 h-4" />
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
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">CLIENTS</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#salons-section" className="hover:text-white transition-colors">
                    Trouver un salon
                  </a>
                </li>
                {communes.map((commune) => (
                  <li key={commune}>
                    <button
                      onClick={() => onSelectCommune(commune)}
                      className="hover:text-white transition-colors"
                    >
                      Salons à {commune}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                PROFESSIONNELS
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/tarifs"
                    className="text-[#E5C378] hover:underline font-semibold transition-colors"
                  >
                    Tarifs & Formules Salons
                  </a>
                </li>
                <li>
                  <a href="/inscription" className="hover:text-white transition-colors">
                    Inscrire un établissement
                  </a>
                </li>
                <li>
                  <a href="/app/tableau-de-bord" className="hover:text-white transition-colors">
                    Espace salon
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">INFORMATIONS</h4>
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
            <div className="flex gap-4">
              <span>Conditions d'utilisation</span>
              <span>Politique de confidentialité</span>
              <span>Sécurité des paiements</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
