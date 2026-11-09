import { useEffect } from 'react';
import type { MarketplaceSiteMetadata } from '../lib/marketplace-content';

/**
 * Applique les métadonnées SEO globales (titre d'onglet et meta description).
 * Se met à jour dès que le SuperAdmin enregistre de nouvelles métadonnées.
 */
export function useSiteMetadata(
  metadata: Pick<MarketplaceSiteMetadata, 'metaTitle' | 'metaDescription'>,
  options: { skip?: boolean } = {},
) {
  const { metaTitle, metaDescription } = metadata;
  const skip = options.skip === true;

  useEffect(() => {
    // Les pages d'administration gardent leur propre titre : on n'y touche pas.
    if (skip || typeof document === 'undefined') return;

    if (metaTitle.trim()) {
      document.title = metaTitle.trim();
    }

    let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionTag && metaDescription.trim()) {
      descriptionTag = document.createElement('meta');
      descriptionTag.name = 'description';
      document.head.appendChild(descriptionTag);
    }
    if (descriptionTag) {
      descriptionTag.content = metaDescription.trim();
    }
  }, [metaTitle, metaDescription, skip]);
}
