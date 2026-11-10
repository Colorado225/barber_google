import { useEffect } from 'react';
import type { MarketplaceSiteMetadata } from '../lib/marketplace-content';
import {
  DEFAULT_SITE_NAME,
  PRIMARY_LANGUAGE,
  buildAbsoluteUrl,
  resolvePageMetadata,
  safeJsonLdStringify,
  type PageSeoMetadata,
} from '../lib/seo';

function upsertMeta(attr: 'name' | 'property', key: string, content: string | undefined) {
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    if (tag) tag.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function upsertCanonicalLink(href: string | undefined) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    if (link) link.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertJsonLdScript(jsonLd: Record<string, unknown> | null | undefined) {
  let script = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-seo-jsonld="barbercuts"]',
  );
  if (!jsonLd) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', 'barbercuts');
    document.head.appendChild(script);
  }
  script.textContent = safeJsonLdStringify(jsonLd);
}

export function applyPageSeoMetadata(seo: PageSeoMetadata): void {
  if (typeof document === 'undefined' || !document.head) return;

  if (document.documentElement) {
    document.documentElement.lang = seo.lang || PRIMARY_LANGUAGE;
  }
  if (seo.title.trim()) {
    document.title = seo.title.trim();
  }

  upsertMeta('name', 'description', seo.description);
  upsertMeta('name', 'robots', seo.robots);
  upsertCanonicalLink(seo.canonicalUrl ?? buildAbsoluteUrl(seo.canonicalPath));

  upsertMeta('property', 'og:locale', seo.ogLocale);
  upsertMeta('property', 'og:site_name', seo.ogSiteName);
  upsertMeta('property', 'og:type', seo.ogType);
  upsertMeta('property', 'og:title', seo.ogTitle);
  upsertMeta('property', 'og:description', seo.ogDescription);
  upsertMeta('property', 'og:url', seo.canonicalUrl ?? buildAbsoluteUrl(seo.canonicalPath));
  upsertMeta('property', 'og:image', seo.ogImage);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', seo.ogTitle);
  upsertMeta('name', 'twitter:description', seo.ogDescription);
  upsertMeta('name', 'twitter:image', seo.ogImage);

  upsertJsonLdScript(seo.jsonLd);
}

/**
 * Synchronise la langue du document et les métadonnées SEO de la route courante.
 * Reste totalement inactif lorsque `skip: true` (pages /admin, portail secret de réservation,
 * ou fiche salon qui gère ses propres métadonnées).
 */
export function useSiteMetadata(
  metadata: Pick<MarketplaceSiteMetadata, 'metaTitle' | 'metaDescription'> & { siteName?: string },
  options: { skip?: boolean; pathname?: string } = {},
) {
  const { metaTitle, metaDescription, siteName } = metadata;
  const skip = options.skip === true;
  const pathname = options.pathname ?? '/';

  useEffect(() => {
    if (skip || typeof document === 'undefined') return;

    const resolved = resolvePageMetadata(pathname, {
      siteName: siteName?.trim() || DEFAULT_SITE_NAME,
      metaTitle,
      metaDescription,
    });
    applyPageSeoMetadata(resolved);
  }, [metaTitle, metaDescription, siteName, pathname, skip]);
}

export function usePageSeo(seo: PageSeoMetadata | null, options: { skip?: boolean } = {}) {
  const skip = options.skip === true;
  const serialized = seo ? JSON.stringify(seo) : '';

  useEffect(() => {
    if (skip || !seo || typeof document === 'undefined') return;
    applyPageSeoMetadata(seo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, serialized]);
}
