// Isolation et protection du portail de réservation :
// - aucune ressource tierce (polices Google Fonts, préconnexions) sur les routes portail ;
// - politique de référent stricte (`no-referrer`) ;
// - désindexation (`noindex, nofollow, noarchive`) et titre neutre sans PII ni jeton.

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,400;1,600&display=swap';

const THIRD_PARTY_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

export function isBookingSecretRoute(pathname: string): boolean {
  const normalized = pathname.trim().toLowerCase();
  return (
    normalized === '/reservation' ||
    normalized.startsWith('/reservation/') ||
    normalized === '/mes-reservations' ||
    normalized.startsWith('/mes-reservations/')
  );
}

function upsertMetaTag(name: string, content: string): { element: HTMLMetaElement; previous: string | null } {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (tag) {
    const previous = tag.content;
    tag.content = content;
    return { element: tag, previous };
  }
  tag = document.createElement('meta');
  tag.name = name;
  tag.content = content;
  document.head.appendChild(tag);
  return { element: tag, previous: null };
}

export function stripThirdPartyPortalLinks(): number {
  if (typeof document === 'undefined' || !document.head) return 0;
  let removed = 0;
  const links = document.head.querySelectorAll<HTMLLinkElement>('link[href]');
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    if (THIRD_PARTY_FONT_HOSTS.some((host) => href.includes(host))) {
      link.remove();
      removed += 1;
    }
  }
  return removed;
}

export function applyStrictPortalPrivacy(options: { title?: string } = {}): () => void {
  if (typeof document === 'undefined' || !document.head) {
    return () => {};
  }

  if (document.documentElement) {
    document.documentElement.lang = 'fr';
  }
  upsertMetaTag('referrer', 'no-referrer');
  const robots = upsertMetaTag('robots', 'noindex, nofollow, noarchive');
  stripThirdPartyPortalLinks();

  // Purge les balises sociales/canoniques héritées d'une navigation SPA précédente
  // pour éviter toute fuite d'URL secrète ou de métadonnées hors portail.
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('script[data-seo-jsonld="barbercuts"]')?.remove();
  for (const og of document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')) {
    og.remove();
  }

  if (options.title) {
    document.title = options.title;
  }

  return () => {
    if (robots.previous === null) {
      robots.element.remove();
    } else {
      robots.element.content = robots.previous;
    }
  };
}

export function loadMarketplaceFontsIfAllowed(pathname?: string): boolean {
  if (typeof document === 'undefined' || !document.head) return false;
  const targetPath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (isBookingSecretRoute(targetPath)) {
    stripThirdPartyPortalLinks();
    return false;
  }

  const alreadyLoaded = Boolean(document.head.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`));
  if (alreadyLoaded) return true;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_URL;
  link.referrerPolicy = 'no-referrer';
  document.head.appendChild(link);
  return true;
}
