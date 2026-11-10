import type { PublicSalonDetail } from '../types';
import type { MarketplaceSiteMetadata } from './marketplace-content';
import { isBookingSecretRoute } from './portalIsolation';

export const PRIMARY_LANGUAGE = 'fr';
export const DEFAULT_OG_LOCALE = 'fr_FR';
export const DEFAULT_SITE_NAME = 'BarberCuts';
export const DEFAULT_SITE_URL = 'https://barbercuts.ci';

export interface PageSeoMetadata {
  lang: string;
  title: string;
  description: string;
  robots: string;
  canonicalPath: string;
  canonicalUrl?: string;
  ogType: 'website' | 'business.business';
  ogLocale: string;
  ogSiteName: string;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  jsonLd?: Record<string, unknown> | null;
}

const WEEKDAY_SCHEMA_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeJsonLdStringify(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export function normalizeOrigin(candidate?: string | null): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin(explicitOrigin?: string | null): string {
  const fromArg = normalizeOrigin(explicitOrigin);
  if (fromArg) return fromArg;

  const envOrigin = normalizeOrigin(
    typeof import.meta !== 'undefined'
      ? ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PUBLIC_SITE_URL ?? null)
      : null,
  );
  if (envOrigin) return envOrigin;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const winOrigin = normalizeOrigin(window.location.origin);
    if (winOrigin) return winOrigin;
  }

  return DEFAULT_SITE_URL;
}

function safeHttpUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function truncateDescription(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function buildAbsoluteUrl(canonicalPath: string, siteOrigin?: string | null): string {
  const origin = resolveSiteOrigin(siteOrigin);
  const normalizedPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  return `${origin}${normalizedPath}`;
}

export function resolvePageMetadata(
  pathname: string,
  siteMetadata: Pick<MarketplaceSiteMetadata, 'siteName' | 'metaTitle' | 'metaDescription'>,
  siteOrigin?: string | null,
): PageSeoMetadata {
  const cleanPath = (pathname.split('?')[0].split('#')[0] || '/').trim() || '/';
  const lower = cleanPath.toLowerCase();
  const siteName = siteMetadata.siteName?.trim() || DEFAULT_SITE_NAME;
  const homeTitle = siteMetadata.metaTitle?.trim() || `${siteName} | Réservez votre barbier en ligne`;
  const homeDescription =
    siteMetadata.metaDescription?.trim() ||
    `Parcourez les salons publiés sur ${siteName} et réservez votre prochain rendez-vous en ligne.`;

  const base = (
    overrides: Partial<PageSeoMetadata> & { canonicalPath: string; title: string; description: string },
  ): PageSeoMetadata => {
    const canonicalUrl = buildAbsoluteUrl(overrides.canonicalPath, siteOrigin);
    return {
      lang: PRIMARY_LANGUAGE,
      robots: 'index, follow',
      ogType: 'website',
      ogLocale: DEFAULT_OG_LOCALE,
      ogSiteName: siteName,
      ogTitle: overrides.title,
      ogDescription: overrides.description,
      canonicalUrl,
      jsonLd: null,
      ...overrides,
    };
  };

  if (isBookingSecretRoute(lower)) {
    return base({
      canonicalPath: lower.startsWith('/mes-reservations') ? '/mes-reservations' : '/reservation',
      title: lower.startsWith('/mes-reservations')
        ? `Mes réservations — ${siteName}`
        : `Ma réservation — ${siteName}`,
      description: `Espace privé de suivi de votre réservation sur ${siteName}.`,
      robots: 'noindex, nofollow, noarchive',
    });
  }

  if (lower.startsWith('/admin')) {
    return base({
      canonicalPath: '/admin',
      title: `Administration plateforme — ${siteName}`,
      description: `Console d’administration interne ${siteName}.`,
      robots: 'noindex, nofollow',
    });
  }

  if (lower.startsWith('/app')) {
    return base({
      canonicalPath: '/app/tableau-de-bord',
      title: `Espace Salon — ${siteName} ERP`,
      description: `Espace de gestion professionnel ${siteName}.`,
      robots: 'noindex, nofollow',
    });
  }

  if (lower === '/tarifs' || lower === '/pricing') {
    const title = `Tarifs & Formules SaaS | ${siteName}`;
    const description = `Découvrez les forfaits ${siteName} pour barbershops et salons : planning en ligne, caisse Mobile Money, fidélité et vitrine marketplace.`;
    return base({
      canonicalPath: '/tarifs',
      title,
      description,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        inLanguage: PRIMARY_LANGUAGE,
        url: buildAbsoluteUrl('/tarifs', siteOrigin),
      },
    });
  }

  if (lower === '/inscription' || lower === '/register') {
    const title = `Inscrire mon salon | ${siteName}`;
    const description = `Créez votre compte professionnel ${siteName} pour publier la vitrine de votre salon et gérer vos rendez-vous en ligne.`;
    return base({
      canonicalPath: '/inscription',
      title,
      description,
    });
  }

  if (lower === '/connexion') {
    return base({
      canonicalPath: '/connexion',
      title: `Connexion | ${siteName}`,
      description: `Connectez-vous à votre espace professionnel ${siteName}.`,
      robots: 'noindex, nofollow',
    });
  }

  if (lower === '/verifier-email') {
    return base({
      canonicalPath: '/verifier-email',
      title: `Vérification de l’adresse e-mail | ${siteName}`,
      description: `Confirmation de votre compte professionnel ${siteName}.`,
      robots: 'noindex, nofollow',
    });
  }

  if (lower === '/mot-de-passe-oublie' || lower === '/reinitialiser') {
    return base({
      canonicalPath: lower,
      title: `Récupération de compte | ${siteName}`,
      description: `Réinitialisation sécurisée du mot de passe ${siteName}.`,
      robots: 'noindex, nofollow',
    });
  }

  if (lower === '/vitrine') {
    return base({
      canonicalPath: '/vitrine',
      title: `Vitrine du salon | ${siteName}`,
      description: `Gestion de la vitrine marketplace ${siteName}.`,
      robots: 'noindex, nofollow',
    });
  }

  return base({
    canonicalPath: '/',
    title: homeTitle,
    description: homeDescription,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      description: homeDescription,
      inLanguage: PRIMARY_LANGUAGE,
      url: buildAbsoluteUrl('/', siteOrigin),
    },
  });
}

export function buildSalonSeoMetadata(
  detail: PublicSalonDetail,
  options: { siteName?: string; siteOrigin?: string | null } = {},
): PageSeoMetadata {
  const siteName = options.siteName?.trim() || DEFAULT_SITE_NAME;
  const { salon, services, branches, rating, reviewCount } = detail;
  const slug = (salon.slug || salon.id).trim();
  const canonicalPath = `/salons/${encodeURIComponent(slug)}`;
  const canonicalUrl = buildAbsoluteUrl(canonicalPath, options.siteOrigin);

  const locationParts = [salon.commune, salon.city].filter((part) => Boolean(part && part.trim()));
  const locationLabel = locationParts.join(', ');
  const title = locationLabel
    ? `${salon.name} — ${locationLabel} | ${siteName}`
    : `${salon.name} | ${siteName}`;

  const fallbackDesc = locationLabel
    ? `${salon.name} à ${locationLabel}. Consultez les prestations, tarifs et réservez votre créneau en ligne sur ${siteName}.`
    : `${salon.name}. Consultez les prestations, tarifs et réservez votre créneau en ligne sur ${siteName}.`;
  const rawDescription = salon.description?.trim() || salon.tagline?.trim() || fallbackDesc;
  const description = truncateDescription(rawDescription, 160);

  const ogImage = safeHttpUrl(salon.coverImage) ?? safeHttpUrl(salon.logo);
  const robots = salon.status === 'suspended' ? 'noindex, nofollow' : 'index, follow';

  const openingHoursSpecification = (branches[0]?.hours ?? [])
    .filter((h) => h.isOpen && h.opensAt && h.closesAt && h.weekday >= 0 && h.weekday <= 6)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: WEEKDAY_SCHEMA_DAYS[h.weekday],
      opens: h.opensAt?.slice(0, 5),
      closes: h.closesAt?.slice(0, 5),
    }));

  const offers = services
    .filter((s) => s.isActive !== false)
    .slice(0, 12)
    .map((s) => ({
      '@type': 'Offer',
      price: s.price,
      priceCurrency: salon.currency || 'XOF',
      itemOffered: {
        '@type': 'Service',
        name: s.name,
        ...(s.description ? { description: truncateDescription(s.description, 120) } : {}),
      },
    }));

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: salon.name,
    url: canonicalUrl,
    description,
    inLanguage: PRIMARY_LANGUAGE,
    ...(ogImage ? { image: ogImage } : {}),
    ...(salon.phone ? { telephone: salon.phone } : {}),
    ...(salon.address || salon.city || salon.commune
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(salon.address ? { streetAddress: salon.address } : {}),
            ...(salon.commune ? { addressLocality: salon.commune } : {}),
            ...(salon.city ? { addressRegion: salon.city } : {}),
            ...(salon.country ? { addressCountry: salon.country } : {}),
          },
        }
      : {}),
    ...(openingHoursSpecification.length > 0 ? { openingHoursSpecification } : {}),
    ...(offers.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `Prestations ${salon.name}`,
            itemListElement: offers,
          },
        }
      : {}),
    ...(reviewCount > 0 && typeof rating === 'number' && rating > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(rating.toFixed(1)),
            reviewCount,
          },
        }
      : {}),
  };

  return {
    lang: PRIMARY_LANGUAGE,
    title,
    description,
    robots,
    canonicalPath,
    canonicalUrl,
    ogType: 'business.business',
    ogLocale: DEFAULT_OG_LOCALE,
    ogSiteName: siteName,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    jsonLd,
  };
}

export function renderHeadSeoTagsHtml(seo: PageSeoMetadata): string {
  const canonicalUrl = seo.canonicalUrl ?? buildAbsoluteUrl(seo.canonicalPath);
  const lines = [
    `<title>${escapeHtml(seo.title)}</title>`,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="robots" content="${escapeHtml(seo.robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:locale" content="${escapeHtml(seo.ogLocale)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(seo.ogSiteName)}" />`,
    `<meta property="og:type" content="${escapeHtml(seo.ogType)}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.ogDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    ...(seo.ogImage ? [`<meta property="og:image" content="${escapeHtml(seo.ogImage)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.ogDescription)}" />`,
    ...(seo.ogImage ? [`<meta name="twitter:image" content="${escapeHtml(seo.ogImage)}" />`] : []),
    ...(seo.jsonLd
      ? [
          `<script type="application/ld+json" data-seo-jsonld="barbercuts">${safeJsonLdStringify(seo.jsonLd)}</script>`,
        ]
      : []),
  ];
  return lines.join('\n    ');
}

export function renderSalonFallbackBodyHtml(detail: PublicSalonDetail): string {
  const { salon, services } = detail;
  const location = [salon.address, salon.commune, salon.city].filter(Boolean).join(', ');
  const activeServices = services.filter((s) => s.isActive !== false).slice(0, 12);

  return `<main data-prerender="salon-seo" style="max-width:720px;margin:2rem auto;padding:1rem;font-family:sans-serif;color:#f7f6f2;">
      <h1>${escapeHtml(salon.name)}</h1>
      ${location ? `<p>${escapeHtml(location)}</p>` : ''}
      ${salon.tagline ? `<p>${escapeHtml(salon.tagline)}</p>` : ''}
      ${salon.description ? `<p>${escapeHtml(salon.description)}</p>` : ''}
      ${
        activeServices.length > 0
          ? `<ul>${activeServices
              .map(
                (s) =>
                  `<li>${escapeHtml(s.name)} — ${escapeHtml(String(s.price))} ${escapeHtml(salon.currency || 'XOF')}</li>`,
              )
              .join('')}</ul>`
          : ''
      }
    </main>`;
}

export function injectSeoIntoHtmlShell(
  templateHtml: string,
  seo: PageSeoMetadata,
  rootFallbackHtml?: string,
): string {
  let html = templateHtml.replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(seo.lang)}">`);

  // Retire les balises dynamiques gérées afin d'éviter tout doublon lors du pré-rendu.
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(
      /<meta\b[^>]*name=["'](?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*>/gi,
      '',
    )
    .replace(/<meta\b[^>]*property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*data-seo-jsonld=["']barbercuts["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const headBlock = `    ${renderHeadSeoTagsHtml(seo)}\n  </head>`;
  html = html.replace(/<\/head>/i, headBlock);

  if (rootFallbackHtml) {
    html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${rootFallbackHtml}</div>`);
  }

  return html;
}

export function renderSalonPrerenderHtml(
  templateHtml: string,
  detail: PublicSalonDetail,
  siteOrigin?: string | null,
): string {
  const seo = buildSalonSeoMetadata(detail, { siteOrigin });
  return injectSeoIntoHtmlShell(templateHtml, seo, renderSalonFallbackBodyHtml(detail));
}

export function buildSitemapXml(
  entries: Array<{ path: string; lastmod?: string | null; changefreq?: string; priority?: string }>,
  siteOrigin?: string | null,
): string {
  const urls = entries.map((entry) => {
    const loc = escapeHtml(buildAbsoluteUrl(entry.path, siteOrigin));
    const lastmod = entry.lastmod ? `<lastmod>${escapeHtml(entry.lastmod.slice(0, 10))}</lastmod>` : '';
    const changefreq = entry.changefreq ? `<changefreq>${escapeHtml(entry.changefreq)}</changefreq>` : '';
    const priority = entry.priority ? `<priority>${escapeHtml(entry.priority)}</priority>` : '';
    return `  <url><loc>${loc}</loc>${lastmod}${changefreq}${priority}</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n');
}
