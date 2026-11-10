// Pré-rendu hybride Edge pour les fiches salons publiques (/salons/:slug)
// et génération dynamique du sitemap XML (/sitemap.xml).
//
// Pourquoi cette Edge Function existe :
//  - l'application cliente est une SPA Vite ; les robots sans exécution JS
//    (WhatsApp, Facebook, X/Twitter, iMessage, crawlers simples) ne voient sinon
//    que les balises génériques de index.html ;
//  - les fiches salons sont dynamiques dans PostgreSQL (création, édition de
//    tarifs, suspension par le SuperAdmin) : un pré-rendu statique au moment du
//    build (SSG) deviendrait obsolète entre deux déploiements ;
//  - l'appel direct aux RPC anonymes `marketplace_salon_detail` et
//    `marketplace_list_salons` (déjà accordées à `anon`) permet de générer à la
//    demande un HTML complet (lang="fr", title, meta description, canonical,
//    og:*, twitter:*, JSON-LD Schema.org HairSalon, résumé sémantique) avec
//    mise en cache CDN (s-maxage=3600, stale-while-revalidate=86400).
//
// Aucune dépendance externe (conformité au runtime Edge sans esm.sh / jsr).

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const PUBLIC_APP_URL = (Deno.env.get('PUBLIC_APP_URL') ?? 'https://barbercuts.ci').replace(/\/+$/, '');

const WEEKDAY_SCHEMA_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function safeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
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

function truncateText(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

async function callPublicRpc<T>(fnName: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function fetchSpaTemplate(): Promise<string> {
  const fallback = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="no-referrer" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${PUBLIC_APP_URL}/index.html`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const html = await res.text();
    return html.includes('</head>') ? html : fallback;
  } catch {
    return fallback;
  }
}

type JsonObj = Record<string, unknown>;

function renderNotFoundHtml(template: string, slug: string): string {
  const canonical = `${PUBLIC_APP_URL}/salons/${encodeURIComponent(slug)}`;
  const head = [
    '<title>Salon introuvable | BarberCuts</title>',
    '<meta name="description" content="Cette fiche salon est introuvable ou n’est plus publiée sur BarberCuts." />',
    '<meta name="robots" content="noindex, nofollow" />',
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  ].join('\n    ');

  return template
    .replace(/<html\b[^>]*>/i, '<html lang="fr">')
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\b[^>]*name=["'](?:description|robots)["'][^>]*>/gi, '')
    .replace(/<\/head>/i, `    ${head}\n  </head>`)
    .replace(
      /<div id="root"><\/div>/i,
      '<div id="root"><main style="max-width:640px;margin:3rem auto;padding:1rem;font-family:sans-serif;"><h1>Salon introuvable</h1><p>Cet établissement n’est pas disponible sur BarberCuts.</p></main></div>',
    );
}

function renderSalonHtml(template: string, payload: JsonObj, requestedSlug: string): string {
  const salon = (payload.salon ?? {}) as JsonObj;
  const services = Array.isArray(payload.services) ? (payload.services as JsonObj[]) : [];
  const branches = Array.isArray(payload.branches) ? (payload.branches as JsonObj[]) : [];
  const rating = typeof payload.rating === 'number' ? payload.rating : Number(payload.rating ?? 0);
  const reviewCount = Number(payload.review_count ?? 0);

  const name = typeof salon.name === 'string' && salon.name.trim() ? salon.name.trim() : 'Salon BarberCuts';
  const slug = typeof salon.slug === 'string' && salon.slug.trim() ? salon.slug.trim() : requestedSlug;
  const commune = typeof salon.commune === 'string' ? salon.commune.trim() : '';
  const city = typeof salon.city === 'string' ? salon.city.trim() : '';
  const address = typeof salon.address === 'string' ? salon.address.trim() : '';
  const country = typeof salon.country === 'string' ? salon.country.trim() : '';
  const phone = typeof salon.phone === 'string' ? salon.phone.trim() : '';
  const currency = typeof salon.currency === 'string' && salon.currency ? salon.currency : 'XOF';
  const location = [commune, city].filter(Boolean).join(', ');

  const title = location ? `${name} — ${location} | BarberCuts` : `${name} | BarberCuts`;
  const rawDescription =
    (typeof salon.description === 'string' && salon.description.trim()) ||
    (typeof salon.tagline === 'string' && salon.tagline.trim()) ||
    `${name}${location ? ` à ${location}` : ''}. Découvrez les prestations, les tarifs et réservez votre créneau en ligne sur BarberCuts.`;
  const description = truncateText(rawDescription, 160);
  const canonicalUrl = `${PUBLIC_APP_URL}/salons/${encodeURIComponent(slug)}`;
  const ogImage = safeHttpUrl(salon.cover_url) ?? safeHttpUrl(salon.logo_url);
  const robots = salon.status === 'suspended' ? 'noindex, nofollow' : 'index, follow';

  const firstBranch = branches[0] ?? {};
  const hours = Array.isArray(firstBranch.hours) ? (firstBranch.hours as JsonObj[]) : [];
  const openingHoursSpecification = hours
    .filter(
      (h) =>
        h.is_open === true &&
        typeof h.opens_at === 'string' &&
        typeof h.closes_at === 'string' &&
        typeof h.weekday === 'number' &&
        h.weekday >= 0 &&
        h.weekday <= 6,
    )
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: WEEKDAY_SCHEMA_DAYS[Number(h.weekday)],
      opens: String(h.opens_at).slice(0, 5),
      closes: String(h.closes_at).slice(0, 5),
    }));

  const activeServices = services.filter((s) => s.is_active !== false).slice(0, 12);
  const offers = activeServices.map((s) => ({
    '@type': 'Offer',
    price: Number(s.price ?? 0),
    priceCurrency: currency,
    itemOffered: {
      '@type': 'Service',
      name: String(s.name ?? 'Prestation'),
    },
  }));

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name,
    url: canonicalUrl,
    description,
    inLanguage: 'fr',
    ...(ogImage ? { image: ogImage } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(address || commune || city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(address ? { streetAddress: address } : {}),
            ...(commune ? { addressLocality: commune } : {}),
            ...(city ? { addressRegion: city } : {}),
            ...(country ? { addressCountry: country } : {}),
          },
        }
      : {}),
    ...(openingHoursSpecification.length > 0 ? { openingHoursSpecification } : {}),
    ...(offers.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `Prestations ${name}`,
            itemListElement: offers,
          },
        }
      : {}),
    ...(reviewCount > 0 && rating > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(rating.toFixed(1)),
            reviewCount,
          },
        }
      : {}),
  };

  const headTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    '<meta property="og:locale" content="fr_FR" />',
    '<meta property="og:site_name" content="BarberCuts" />',
    '<meta property="og:type" content="business.business" />',
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    ...(ogImage ? [`<meta property="og:image" content="${escapeHtml(ogImage)}" />`] : []),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    ...(ogImage ? [`<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`] : []),
    `<script type="application/ld+json" data-seo-jsonld="barbercuts">${safeJsonLd(jsonLd)}</script>`,
  ].join('\n    ');

  const addressLine = [address, commune, city].filter(Boolean).join(', ');
  const fallbackBody = `<main data-prerender="salon-seo" style="max-width:720px;margin:2rem auto;padding:1rem;font-family:sans-serif;color:#f7f6f2;">
      <h1>${escapeHtml(name)}</h1>
      ${addressLine ? `<p>${escapeHtml(addressLine)}</p>` : ''}
      <p>${escapeHtml(description)}</p>
      ${
        activeServices.length > 0
          ? `<ul>${activeServices
              .map(
                (s) =>
                  `<li>${escapeHtml(String(s.name ?? ''))} — ${escapeHtml(String(s.price ?? 0))} ${escapeHtml(currency)}</li>`,
              )
              .join('')}</ul>`
          : ''
      }
    </main>`;

  return template
    .replace(/<html\b[^>]*>/i, '<html lang="fr">')
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(
      /<meta\b[^>]*name=["'](?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*>/gi,
      '',
    )
    .replace(/<meta\b[^>]*property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<\/head>/i, `    ${headTags}\n  </head>`)
    .replace(/<div id="root"><\/div>/i, `<div id="root">${fallbackBody}</div>`);
}

function buildSitemap(salons: JsonObj[]): string {
  const staticUrls = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/tarifs', changefreq: 'weekly', priority: '0.8' },
    { path: '/inscription', changefreq: 'monthly', priority: '0.7' },
  ];

  const salonUrls = salons
    .filter((s) => s.status !== 'suspended' && (typeof s.slug === 'string' || typeof s.id === 'string'))
    .map((s) => {
      const slug = typeof s.slug === 'string' && s.slug.trim() ? s.slug.trim() : String(s.id);
      const lastmod =
        typeof s.publication_date === 'string' && s.publication_date
          ? `<lastmod>${escapeHtml(s.publication_date.slice(0, 10))}</lastmod>`
          : '';
      return `  <url><loc>${escapeHtml(`${PUBLIC_APP_URL}/salons/${encodeURIComponent(slug)}`)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.9</priority></url>`;
    });

  const staticXml = staticUrls.map(
    (u) =>
      `  <url><loc>${escapeHtml(`${PUBLIC_APP_URL}${u.path}`)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticXml,
    ...salonUrls,
    '</urlset>',
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Méthode non autorisée', { status: 405 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') ?? '';

  if (mode === 'sitemap' || url.pathname.endsWith('/sitemap.xml')) {
    const salons = (await callPublicRpc<JsonObj[]>('marketplace_list_salons', { p_limit: 100 })) ?? [];
    const xml = buildSitemap(Array.isArray(salons) ? salons : []);
    return new Response(req.method === 'HEAD' ? null : xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  const pathMatch = url.pathname.match(/\/salons\/([^/]+)\/?$/);
  const slug = (url.searchParams.get('slug') ?? pathMatch?.[1] ?? '').trim();
  if (!slug) {
    return new Response('Paramètre slug requis', { status: 400 });
  }

  const [template, detail] = await Promise.all([
    fetchSpaTemplate(),
    callPublicRpc<JsonObj>('marketplace_salon_detail', { p_key: slug }),
  ]);

  if (!detail || !detail.salon || (detail.salon as JsonObj).status === 'suspended') {
    const notFoundHtml = renderNotFoundHtml(template, slug);
    return new Response(req.method === 'HEAD' ? null : notFoundHtml, {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const html = renderSalonHtml(template, detail, slug);
  return new Response(req.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
});
