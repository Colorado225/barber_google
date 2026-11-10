import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJsonLd(data) {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export function normalizeOrigin(candidate) {
  if (!candidate) return 'https://barbercuts.ci';
  const trimmed = String(candidate).trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    // Repli sur l'URL canonique par défaut
  }
  return 'https://barbercuts.ci';
}

export function buildStaticPublicRoutes(origin) {
  return [
    {
      outputSubdir: '',
      canonicalPath: '/',
      title: 'BarberCuts | Réservez votre barbier en ligne',
      description:
        'Parcourez les salons publiés sur BarberCuts et réservez votre prochain rendez-vous en ligne.',
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'BarberCuts',
        description:
          'Parcourez les salons publiés sur BarberCuts et réservez votre prochain rendez-vous en ligne.',
        inLanguage: 'fr',
        url: `${origin}/`,
      },
    },
    {
      outputSubdir: 'tarifs',
      canonicalPath: '/tarifs',
      title: 'Tarifs & Formules SaaS | BarberCuts',
      description:
        'Découvrez les forfaits BarberCuts pour barbershops et salons : planning en ligne, caisse Mobile Money, fidélité et vitrine marketplace.',
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Tarifs & Formules SaaS | BarberCuts',
        description:
          'Découvrez les forfaits BarberCuts pour barbershops et salons : planning en ligne, caisse Mobile Money, fidélité et vitrine marketplace.',
        inLanguage: 'fr',
        url: `${origin}/tarifs`,
      },
    },
    {
      outputSubdir: 'inscription',
      canonicalPath: '/inscription',
      title: 'Inscrire mon salon | BarberCuts',
      description:
        'Créez votre compte professionnel BarberCuts pour publier la vitrine de votre salon et gérer vos rendez-vous en ligne.',
      robots: 'index, follow',
      jsonLd: null,
    },
  ];
}

export function injectStaticPageSeo(templateHtml, route, origin) {
  const canonicalUrl = `${origin}${route.canonicalPath}`;
  const headTags = [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<meta name="robots" content="${escapeHtml(route.robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    '<meta property="og:locale" content="fr_FR" />',
    '<meta property="og:site_name" content="BarberCuts" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    ...(route.jsonLd
      ? [
          `<script type="application/ld+json" data-seo-jsonld="barbercuts">${safeJsonLd(route.jsonLd)}</script>`,
        ]
      : []),
  ].join('\n    ');

  return templateHtml
    .replace(/<html\b[^>]*>/i, '<html lang="fr">')
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(
      /<meta\b[^>]*name=["'](?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*>/gi,
      '',
    )
    .replace(/<meta\b[^>]*property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*data-seo-jsonld=["']barbercuts["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/head>/i, `    ${headTags}\n  </head>`);
}

export function prerenderPublicDist(
  distDir = path.join(ROOT_DIR, 'dist'),
  siteUrl = process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_APP_URL || 'https://barbercuts.ci',
) {
  const templatePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing build output: ${templatePath}. Run "vite build" first.`);
  }

  const origin = normalizeOrigin(siteUrl);
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const routes = buildStaticPublicRoutes(origin);
  const generatedFiles = [];

  for (const route of routes) {
    const targetDir = route.outputSubdir ? path.join(distDir, route.outputSubdir) : distDir;
    fs.mkdirSync(targetDir, { recursive: true });
    const outPath = path.join(targetDir, 'index.html');
    const html = injectStaticPageSeo(templateHtml, route, origin);
    fs.writeFileSync(outPath, html, 'utf8');
    generatedFiles.push(path.relative(distDir, outPath));
  }

  const sitemapEntries = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/tarifs', changefreq: 'weekly', priority: '0.8' },
    { path: '/inscription', changefreq: 'monthly', priority: '0.7' },
  ];

  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapEntries.map(
      (entry) =>
        `  <url><loc>${escapeHtml(`${origin}${entry.path}`)}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`,
    ),
    '</urlset>',
  ].join('\n');

  const sitemapPath = path.join(distDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, `${sitemapXml}\n`, 'utf8');
  generatedFiles.push('sitemap.xml');

  return { origin, generatedFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = prerenderPublicDist();
  console.log(`SEO static prerender (${result.origin}): ${result.generatedFiles.join(', ')}`);
}
