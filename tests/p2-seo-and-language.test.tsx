import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  buildSalonSeoMetadata,
  buildSitemapXml,
  PRIMARY_LANGUAGE,
  renderSalonPrerenderHtml,
  resolvePageMetadata,
} from '../src/lib/seo';
import { DEFAULT_MARKETPLACE_CONTENT } from '../src/lib/marketplace-content';
import { applyStrictPortalPrivacy } from '../src/lib/portalIsolation';
import { SalonPublicPage } from '../src/components/marketplace/salon/SalonPublicPage';
import { prerenderPublicDist } from '../scripts/prerender-public.mjs';
import type { PublicSalonDetail } from '../src/types';

function setupDom(url = 'https://barbercuts.ci/') {
  const existing = (globalThis as { __p2SeoDom?: JSDOM }).__p2SeoDom;
  if (existing) {
    existing.reconfigure({ url });
    existing.window.document.head.innerHTML = '';
    existing.window.document.body.innerHTML = '<div id="root"></div>';
    existing.window.document.documentElement.lang = 'en';
    existing.window.document.title = '';
    return existing;
  }
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>',
    {
      url,
    },
  );
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.assign(globalThis, {
    __p2SeoDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IntersectionObserver: MockIntersectionObserver,
  });
  Object.defineProperty(dom.window, 'IntersectionObserver', {
    value: MockIntersectionObserver,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

async function loadRtl() {
  return import('@testing-library/react');
}

function makeSampleSalonDetail(overrides: Partial<PublicSalonDetail> = {}): PublicSalonDetail {
  return {
    salon: {
      id: 'salon-1',
      name: 'Studio Ivoire Cut',
      slug: 'studio-ivoire-cut',
      tagline: 'Barbier & soins visage premium',
      description: 'Salon de coiffure masculine à Cocody avec prise de rendez-vous en ligne.',
      city: 'Abidjan',
      commune: 'Cocody',
      country: 'CI',
      address: 'Rue des Jardins, II Plateaux',
      phone: '+2250700000000',
      currency: 'XOF',
      coverImage: 'https://cdn.example.com/studio-cover.jpg',
      status: 'active',
      isPublishedOnMarketplace: true,
      ...(overrides.salon ?? {}),
    },
    services: overrides.services ?? [
      {
        id: 'svc-1',
        salonId: 'salon-1',
        name: 'Dégradé Signature',
        category: 'coupe',
        description: 'Coupe précise avec finitions au coupe-chou.',
        price: 5000,
        durationMinutes: 45,
        prepMinutes: 0,
        popular: true,
        isActive: true,
      },
    ],
    staff: overrides.staff ?? [],
    reviews: overrides.reviews ?? [],
    branches: overrides.branches ?? [
      {
        id: 'branch-1',
        name: 'Principal',
        timezone: 'Africa/Abidjan',
        hours: [
          { weekday: 1, isOpen: true, opensAt: '09:00:00', closesAt: '20:00:00' },
          { weekday: 0, isOpen: false, opensAt: null, closesAt: null },
        ],
      },
    ],
    rating: overrides.rating !== undefined ? overrides.rating : 4.8,
    reviewCount: overrides.reviewCount !== undefined ? overrides.reviewCount : 19,
    minPrice: overrides.minPrice !== undefined ? overrides.minPrice : 5000,
  };
}

test('index.html déclare lang="fr", les métadonnées françaises cohérentes et préserve le durcissement vie privée', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  assert.match(html, /<html\s+lang="fr">/i);
  assert.doesNotMatch(html, /<html\s+lang="en">/i);
  assert.match(html, /<meta\s+name="referrer"\s+content="no-referrer"\s*\/?>/i);
  assert.match(html, /<meta\s+property="og:locale"\s+content="fr_FR"\s*\/?>/i);
  assert.match(html, /<meta\s+property="og:site_name"\s+content="BarberCuts"\s*\/?>/i);
  assert.ok(html.includes(DEFAULT_MARKETPLACE_CONTENT.siteMetadata.metaTitle));
  assert.ok(html.includes(DEFAULT_MARKETPLACE_CONTENT.siteMetadata.metaDescription));
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
});

test('public/robots.txt autorise les routes publiques SEO et bloque les espaces privés/tokens', () => {
  const robots = fs.readFileSync(path.resolve(process.cwd(), 'public/robots.txt'), 'utf8');

  for (const allowed of ['Allow: /', 'Allow: /salons/', 'Allow: /tarifs', 'Allow: /inscription']) {
    assert.ok(robots.includes(allowed), `robots.txt doit inclure "${allowed}"`);
  }
  for (const disallowed of [
    'Disallow: /app/',
    'Disallow: /admin',
    'Disallow: /reservation',
    'Disallow: /mes-reservations',
    'Disallow: /connexion',
    'Disallow: /verifier-email',
    'Disallow: /mot-de-passe-oublie',
    'Disallow: /reinitialiser',
    'Disallow: /vitrine',
  ]) {
    assert.ok(robots.includes(disallowed), `robots.txt doit bloquer "${disallowed}"`);
  }
});

test('resolvePageMetadata attribue langue, canonical et directives robots justes sur toutes les routes', () => {
  const siteMeta = DEFAULT_MARKETPLACE_CONTENT.siteMetadata;
  const origin = 'https://barbercuts.ci';

  const home = resolvePageMetadata('/', siteMeta, origin);
  assert.equal(home.lang, PRIMARY_LANGUAGE);
  assert.equal(home.robots, 'index, follow');
  assert.equal(home.canonicalUrl, 'https://barbercuts.ci/');
  assert.equal(home.jsonLd?.['@type'], 'WebSite');
  assert.equal(home.jsonLd?.inLanguage, 'fr');

  const tarifs = resolvePageMetadata('/tarifs', siteMeta, origin);
  const pricingAlias = resolvePageMetadata('/pricing', siteMeta, origin);
  assert.equal(tarifs.robots, 'index, follow');
  assert.equal(tarifs.canonicalUrl, 'https://barbercuts.ci/tarifs');
  assert.equal(pricingAlias.canonicalUrl, 'https://barbercuts.ci/tarifs');
  assert.match(tarifs.title, /Tarifs/);

  const registerAlias = resolvePageMetadata('/register', siteMeta, origin);
  assert.equal(registerAlias.robots, 'index, follow');
  assert.equal(registerAlias.canonicalUrl, 'https://barbercuts.ci/inscription');

  for (const privatePath of [
    '/connexion',
    '/verifier-email',
    '/mot-de-passe-oublie',
    '/reinitialiser',
    '/app/tableau-de-bord',
    '/admin',
    '/vitrine',
  ]) {
    const seo = resolvePageMetadata(privatePath, siteMeta, origin);
    assert.equal(seo.lang, 'fr');
    assert.equal(seo.robots, 'noindex, nofollow', `${privatePath} doit être en noindex, nofollow`);
  }

  const secretPortal = resolvePageMetadata('/reservation/secret-token-123', siteMeta, origin);
  assert.equal(secretPortal.robots, 'noindex, nofollow, noarchive');
});

test('buildSalonSeoMetadata et renderSalonPrerenderHtml produisent JSON-LD HairSalon sans notes inventées ni XSS', () => {
  const detail = makeSampleSalonDetail();
  const seo = buildSalonSeoMetadata(detail, { siteOrigin: 'https://barbercuts.ci' });

  assert.equal(seo.lang, 'fr');
  assert.equal(seo.robots, 'index, follow');
  assert.equal(seo.title, 'Studio Ivoire Cut — Cocody, Abidjan | BarberCuts');
  assert.equal(seo.canonicalUrl, 'https://barbercuts.ci/salons/studio-ivoire-cut');
  assert.equal(seo.ogType, 'business.business');
  assert.equal(seo.ogImage, 'https://cdn.example.com/studio-cover.jpg');
  assert.equal(seo.jsonLd?.['@type'], 'HairSalon');
  assert.deepEqual((seo.jsonLd?.aggregateRating as Record<string, unknown>) ?? null, {
    '@type': 'AggregateRating',
    ratingValue: 4.8,
    reviewCount: 19,
  });
  assert.equal((seo.jsonLd?.openingHoursSpecification as unknown[]).length, 1);

  // Aucun avis vérifié -> aucune note agrégée fabriquée
  const noReviewSeo = buildSalonSeoMetadata(
    makeSampleSalonDetail({ rating: null, reviewCount: 0, reviews: [] }),
    { siteOrigin: 'https://barbercuts.ci' },
  );
  assert.equal(noReviewSeo.jsonLd?.aggregateRating, undefined);

  // Salon suspendu -> désindexation immédiate
  const suspendedSeo = buildSalonSeoMetadata(
    makeSampleSalonDetail({ salon: { ...detail.salon, status: 'suspended' } }),
    { siteOrigin: 'https://barbercuts.ci' },
  );
  assert.equal(suspendedSeo.robots, 'noindex, nofollow');

  // Échappement XSS sur les balises HTML et JSON-LD pré-rendus
  const xssDetail = makeSampleSalonDetail({
    salon: {
      ...detail.salon,
      name: 'Coupe </script><img src=x onerror=alert(1)>',
      description: 'Description "spéciale" & sécurisée',
    },
  });
  const templateHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const rendered = renderSalonPrerenderHtml(templateHtml, xssDetail, 'https://barbercuts.ci');
  assert.ok(!rendered.includes('<img src=x onerror=alert(1)>'), 'Le HTML brut injecté doit être échappé');
  assert.ok(rendered.includes('\\u003c/script\\u003e'), 'Le JSON-LD doit neutraliser </script>');
  assert.ok(rendered.includes('data-prerender="salon-seo"'));
});

test('SalonPublicPage synchronise le DOM (lang="fr", canonical, og:image, JSON-LD) et le portail secret purge ces balises', async () => {
  setupDom('https://barbercuts.ci/salons/studio-ivoire-cut');
  const { render, cleanup } = await loadRtl();
  const detail = makeSampleSalonDetail();

  try {
    render(
      <MemoryRouter initialEntries={['/salons/studio-ivoire-cut']}>
        <Routes>
          <Route path="/salons/:slug" element={<SalonPublicPage initialDetail={detail} />} />
        </Routes>
      </MemoryRouter>,
    );

    assert.equal(document.documentElement.lang, 'fr');
    assert.equal(document.title, 'Studio Ivoire Cut — Cocody, Abidjan | BarberCuts');
    assert.equal(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
      'https://barbercuts.ci/salons/studio-ivoire-cut',
    );
    assert.equal(
      document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
      'https://cdn.example.com/studio-cover.jpg',
    );
    const jsonLdEl = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"][data-seo-jsonld="barbercuts"]',
    );
    assert.ok(jsonLdEl?.textContent);
    const parsed = JSON.parse(jsonLdEl.textContent) as Record<string, unknown>;
    assert.equal(parsed['@type'], 'HairSalon');
    assert.equal(parsed.name, 'Studio Ivoire Cut');

    // Passage vers le portail secret de réservation -> purge stricte de l'empreinte SEO du salon
    applyStrictPortalPrivacy({ title: 'Ma réservation — Barber Cuts' });
    assert.equal(document.documentElement.lang, 'fr');
    assert.equal(
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content,
      'noindex, nofollow, noarchive',
    );
    assert.equal(document.head.querySelector('link[rel="canonical"]'), null);
    assert.equal(document.head.querySelector('meta[property="og:image"]'), null);
    assert.equal(document.head.querySelector('script[data-seo-jsonld="barbercuts"]'), null);
  } finally {
    cleanup();
  }
});

test('prerenderPublicDist et buildSitemapXml génèrent les pages statiques pré-rendues et le sitemap XML', () => {
  const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'barbercuts-seo-dist-'));
  try {
    const sourceIndex = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    fs.writeFileSync(path.join(tmpDist, 'index.html'), sourceIndex, 'utf8');

    const result = prerenderPublicDist(tmpDist, 'https://barbercuts.ci');
    assert.ok(result.generatedFiles.includes('tarifs/index.html'));
    assert.ok(result.generatedFiles.includes('inscription/index.html'));
    assert.ok(result.generatedFiles.includes('sitemap.xml'));

    const tarifsHtml = fs.readFileSync(path.join(tmpDist, 'tarifs', 'index.html'), 'utf8');
    assert.match(tarifsHtml, /<html lang="fr">/);
    assert.match(tarifsHtml, /<title>Tarifs &amp; Formules SaaS \| BarberCuts<\/title>/);
    assert.match(tarifsHtml, /<link rel="canonical" href="https:\/\/barbercuts\.ci\/tarifs" \/>/);

    const sitemap = buildSitemapXml(
      [
        { path: '/', priority: '1.0', changefreq: 'daily' },
        { path: '/salons/studio-ivoire-cut', lastmod: '2026-11-10T10:00:00Z', priority: '0.9' },
      ],
      'https://barbercuts.ci',
    );
    assert.ok(sitemap.includes('<loc>https://barbercuts.ci/</loc>'));
    assert.ok(sitemap.includes('<loc>https://barbercuts.ci/salons/studio-ivoire-cut</loc>'));
    assert.ok(sitemap.includes('<lastmod>2026-11-10</lastmod>'));
  } finally {
    fs.rmSync(tmpDist, { recursive: true, force: true });
  }
});

test('Edge Function salon-seo respecte le runtime sans import distant et les RPC publiques', () => {
  const edgeCode = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/functions/salon-seo/index.ts'),
    'utf8',
  );
  const codeWithoutComments = edgeCode.replace(/\/\/.*$/gm, '');

  assert.doesNotMatch(codeWithoutComments, /^\s*import\b/m);
  assert.doesNotMatch(codeWithoutComments, /esm\.sh|jsr:|https:\/\/deno\.land/i);
  assert.ok(edgeCode.includes('marketplace_salon_detail'));
  assert.ok(edgeCode.includes('marketplace_list_salons'));
  assert.ok(edgeCode.includes('noindex, nofollow'));
  assert.ok(edgeCode.includes('s-maxage=3600'));
});
