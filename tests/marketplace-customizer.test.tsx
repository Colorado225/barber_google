import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDefaultCustomizerConfig } from '../src/lib/marketplace-customizer';
import { ClassicSalonLayout } from '../src/components/marketplace/salon/layouts/ClassicSalonLayout';
import { ElegantSalonLayout } from '../src/components/marketplace/salon/layouts/ElegantSalonLayout';
import { EditorialSalonLayout } from '../src/components/marketplace/salon/layouts/EditorialSalonLayout';
import { PublicSalonDetail, SalonMarketplaceViewConfig } from '../src/types';

const MOCK_DETAIL: PublicSalonDetail = {
  salon: {
    id: 'salon-123',
    name: 'Barbershop Premium',
    slug: 'barbershop-premium',
    tagline: 'L’élégance masculine à Abidjan',
    description: 'Services de coiffure haut de gamme pour homme moderne.',
    address: 'Rue des Jardins, Vallon',
    city: 'Abidjan',
    commune: 'Cocody',
    phone: '+225 07 00 00 00',
    whatsapp: '+225 07 00 00 00',
    coverImage: 'https://example.com/cover.jpg',
    gallery: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    rating: 4.9,
    reviewCount: 32,
    isPublishedOnMarketplace: true,
    isVerified: true,
  },
  services: [
    {
      id: 'srv-1',
      salonId: 'salon-123',
      name: 'Dégradé Américain',
      category: 'coupe',
      description: 'Coupe soignée avec contours précis au rasoir.',
      price: 6000,
      durationMinutes: 35,
      popular: true,
      isActive: true,
    },
    {
      id: 'srv-2',
      salonId: 'salon-123',
      name: 'Soin Barbe à la Vapeur',
      category: 'barbe',
      description: 'Huiles essentielles chaudes et serviette tiède.',
      price: 4500,
      durationMinutes: 25,
      popular: false,
      isActive: true,
    },
  ],
  staff: [
    {
      id: 'st-1',
      name: 'Yves Kouamé',
      role: 'master_barber',
      specialties: ['dégradé', 'barbe'],
    },
    {
      id: 'st-2',
      name: 'Amadou Diallo',
      role: 'barber',
      specialties: ['tresses', 'coloration'],
    },
  ],
  reviews: [
    {
      id: 'rev-1',
      salonId: 'salon-123',
      author: 'Jean-Marc D.',
      rating: 5,
      comment: 'Meilleur barbier de Cocody ! Très propre et ponctuel.',
      verified: true,
      date: '2026-11-01',
    },
  ],
  branches: [
    {
      id: 'b-1',
      name: 'Vallon',
      timezone: 'Africa/Abidjan',
      hours: [
        { weekday: 1, isOpen: true, opensAt: '08:30:00', closesAt: '19:30:00' },
        { weekday: 0, isOpen: false, opensAt: null, closesAt: null },
      ],
    },
  ],
  rating: 4.9,
  reviewCount: 32,
  minPrice: 4500,
};

test('1. getDefaultCustomizerConfig fournit une configuration complète et typée', () => {
  const config = getDefaultCustomizerConfig('salon-123');
  assert.equal(config.layout, 'classic');
  assert.equal(config.accentColor, '#C9A45C');
  assert.equal(config.cardStyle, 'rounded-3xl');
  assert.equal(config.sections.length, 7);
  assert.equal(config.showAddress, true);
  assert.equal(config.showPhone, true);
  assert.equal(config.showWhatsapp, true);
});

test('2. Modèle 1 Classique : rendu HTML avec prix ERP et staff visible', () => {
  const config = getDefaultCustomizerConfig('salon-123');
  const html = renderToStaticMarkup(
    <ClassicSalonLayout
      detail={MOCK_DETAIL}
      config={config}
      formatPrice={(amt) => `${amt.toLocaleString('fr-FR')} FCFA`}
    />,
  );

  assert.ok(html.includes('Barbershop Premium'));
  assert.ok(html.includes('Dégradé Américain'));
  assert.ok(html.replace(/[\u202F\u00A0]/g, ' ').includes('6 000 FCFA'));
  assert.ok(html.includes('Yves'));
  assert.ok(html.includes('Gage de confiance'));
});

test('3. Modèle 2 Élégant et Modèle 3 Éditorial : rendu sans erreur et respect du layout', () => {
  const configElegant: SalonMarketplaceViewConfig = {
    ...getDefaultCustomizerConfig('salon-123'),
    layout: 'elegant',
    accentColor: '#D97706',
  };
  const htmlElegant = renderToStaticMarkup(
    <ElegantSalonLayout
      detail={MOCK_DETAIL}
      config={configElegant}
      formatPrice={(amt) => `${amt.toLocaleString('fr-FR')} FCFA`}
    />,
  );
  assert.ok(htmlElegant.includes('Barbershop Premium'));
  assert.ok(htmlElegant.includes('Galerie officielle'));

  const configEditorial: SalonMarketplaceViewConfig = {
    ...getDefaultCustomizerConfig('salon-123'),
    layout: 'editorial',
  };
  const htmlEditorial = renderToStaticMarkup(
    <EditorialSalonLayout
      detail={MOCK_DETAIL}
      config={configEditorial}
      formatPrice={(amt) => `${amt.toLocaleString('fr-FR')} FCFA`}
    />,
  );
  assert.ok(htmlEditorial.includes('Barbershop Premium'));
  assert.ok(htmlEditorial.includes('Dégradé Américain'));
});

test('4. Sections conditionnelles : désactiver les avis masque la section sans toucher à la base', () => {
  const configWithoutReviews: SalonMarketplaceViewConfig = {
    ...getDefaultCustomizerConfig('salon-123'),
    sections: getDefaultCustomizerConfig('salon-123').sections.map((s) =>
      s.id === 'reviews' ? { ...s, enabled: false } : s,
    ),
  };

  const html = renderToStaticMarkup(
    <ClassicSalonLayout
      detail={MOCK_DETAIL}
      config={configWithoutReviews}
      formatPrice={(amt) => `${amt.toLocaleString('fr-FR')} FCFA`}
    />,
  );

  assert.ok(!html.includes('Avis certifiés par les clients'));
  // Les autres sections restent présentes
  assert.ok(html.includes('Prestations en vedette'));
  assert.ok(html.replace(/&#x27;|[’]/g, "'").includes("Équipe d'artisans"));
});

test('5. Personnel visible : un membre non sélectionné n’apparaît pas dans la vitrine', () => {
  const configWithSingleStaff: SalonMarketplaceViewConfig = {
    ...getDefaultCustomizerConfig('salon-123'),
    visibleStaffIds: ['st-1'], // Yves seul, Amadou exclu
  };

  const html = renderToStaticMarkup(
    <ClassicSalonLayout
      detail={MOCK_DETAIL}
      config={configWithSingleStaff}
      formatPrice={(amt) => `${amt.toLocaleString('fr-FR')} FCFA`}
    />,
  );

  assert.ok(html.includes('Yves'));
  assert.ok(!html.includes('Amadou'));
});

test('6. Synchronisation tarifaire ERP : une hausse de prix est immédiatement visible', () => {
  const updatedDetail: PublicSalonDetail = {
    ...MOCK_DETAIL,
    services: [
      {
        ...MOCK_DETAIL.services[0],
        price: 7500, // Prix modifié dans l'ERP
      },
    ],
  };

  const config = getDefaultCustomizerConfig('salon-123');
  const html = renderToStaticMarkup(
    <ClassicSalonLayout
      detail={updatedDetail}
      config={config}
      formatPrice={(amt) => `${amt.toLocaleString('fr-FR')} FCFA`}
    />,
  );

  const normalized = html.replace(/[\u202F\u00A0]/g, ' ');
  assert.ok(normalized.includes('7 500 FCFA'));
  assert.ok(!normalized.includes('6 000 FCFA'));
});

test('7. Ordre des sections : la position configurée pilote l’ordre de rendu', () => {
  const base = getDefaultCustomizerConfig('salon-123');
  const config: SalonMarketplaceViewConfig = {
    ...base,
    sections: base.sections.map((s) =>
      s.id === 'reviews'
        ? { ...s, position: 1 }
        : s.id === 'gallery'
          ? { ...s, position: 6 }
          : s.id === 'hero'
            ? { ...s, position: 0 }
            : { ...s, position: s.position + 10 },
    ),
  };
  const html = renderToStaticMarkup(
    <ClassicSalonLayout detail={MOCK_DETAIL} config={config} formatPrice={(amt) => `${amt} FCFA`} />,
  );
  const reviewsIdx = html.indexOf('Meilleur barbier de Cocody');
  const servicesIdx = html.indexOf('Prestations en vedette');
  assert.ok(reviewsIdx > -1 && servicesIdx > -1);
  assert.ok(reviewsIdx < servicesIdx, 'les avis (position 1) précèdent les prestations');
});

test('8. Galerie : seules les images sélectionnées sont affichées, dans l’ordre choisi', () => {
  const config: SalonMarketplaceViewConfig = {
    ...getDefaultCustomizerConfig('salon-123'),
    featuredGalleryImageIds: ['https://example.com/photo2.jpg'],
  };
  const html = renderToStaticMarkup(
    <ClassicSalonLayout detail={MOCK_DETAIL} config={config} formatPrice={(amt) => `${amt} FCFA`} />,
  );
  assert.ok(html.includes('https://example.com/photo2.jpg'));
  assert.ok(!html.includes('https://example.com/photo1.jpg'));
});
