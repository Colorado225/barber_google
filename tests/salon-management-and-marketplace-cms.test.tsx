import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapPlatformSalon, type PlatformSalonRow } from '../src/lib/platform-admin';
import { SalonManagement } from '../src/components/admin/SalonManagement';
import type { SalonAdminDetail } from '../src/lib/superadmin';
import type { SaaSPlan } from '../src/types';
import {
  getMarketplaceContent,
  saveMarketplaceContent,
  resetMarketplaceContent,
  DEFAULT_MARKETPLACE_CONTENT,
} from '../src/lib/marketplace-content';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { AppProvider } from '../src/context/AppContext';

// Les actions admin notifient la marketplace via window.dispatchEvent : on fournit un window minimal
// (EventTarget natif) dans cet environnement Node sans DOM.
if (typeof globalThis.window === 'undefined') {
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { pathname: '/', search: '', hash: '' },
  });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
}

// In-memory mock localStorage for SSR test environment
function setupMockLocalStorage() {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function renderManagement(salons: SalonAdminDetail[]): string {
  return renderToStaticMarkup(
    React.createElement(
      AppProvider,
      null,
      React.createElement(SalonManagement, { salons, plans: PLANS, onRefresh: () => undefined }),
    ),
  );
}

const PLANS: SaaSPlan[] = [
  { id: 'starter', name: 'Starter Solo', priceXof: 15000, maxStaff: 1, maxBranches: 1 } as SaaSPlan,
  { id: 'pro', name: 'Pro Équipe', priceXof: 35000, maxStaff: 5, maxBranches: 1 } as SaaSPlan,
];

function row(patch: Partial<PlatformSalonRow>): PlatformSalonRow {
  return {
    id: 'real-a',
    name: 'Salon A',
    organization_name: null,
    city: 'Abidjan',
    commune: 'Cocody',
    is_published: true,
    is_verified: false,
    platform_status: 'active',
    platform_status_reason: null,
    publication_date: null,
    plan_id: 'pro',
    plan_name: 'Pro Équipe',
    price_at_subscription: 35000,
    billing_period: 'monthly',
    subscription_status: 'active',
    current_period_end: '2026-12-09T00:00:00Z',
    ...patch,
  };
}

test('SalonManagement : affiche uniquement les salons reçus de la base, avec leur statut réel', () => {
  setupMockLocalStorage();

  const salons: SalonAdminDetail[] = [
    mapPlatformSalon(row({ id: 'real-a', name: 'Salon A' })),
    mapPlatformSalon(
      row({
        id: 'real-b',
        name: 'Salon B',
        platform_status: 'suspended',
        platform_status_reason: 'Plainte client',
        is_published: false,
        plan_id: null,
        plan_name: null,
        price_at_subscription: null,
        subscription_status: null,
        current_period_end: null,
      }),
    ),
  ];

  const html = renderManagement(salons);

  assert.ok(html.includes('Salon A'));
  assert.ok(html.includes('Salon B'));
  assert.ok(html.includes('Accès Suspendu'), 'Le salon suspendu doit être signalé comme tel');
  assert.ok(html.includes('Formule non disponible'), 'Sans abonnement, aucune formule n’est affichée');
  // Aucune décision n'est stockée localement.
  assert.equal(globalThis.localStorage.getItem('barbercuts_admin_salon_overrides'), null);
});

test('SalonManagement : aucune décision n’est enregistrée localement (lecture seule sans base)', () => {
  setupMockLocalStorage();
  const salons = [mapPlatformSalon(row({ id: 'real-c', name: 'Salon C', is_published: false }))];
  renderManagement(salons);
  assert.equal(globalThis.localStorage.getItem('barbercuts_admin_salon_overrides'), null);
  assert.equal(globalThis.localStorage.getItem('barbercuts_admin_audit_log'), null);
});

test('MarketplaceSectionsAdmin : administration dynamique des sections, onglets et ajout de nouvelles sections', () => {
  setupMockLocalStorage();

  // 1. Lecture de la configuration par défaut
  const initialConfig = getMarketplaceContent();
  assert.ok(initialConfig.hero.headlineMain, 'La section Hero doit avoir un titre');
  assert.ok(initialConfig.trustItems.length >= 3, 'Doit comporter des points de réassurance');
  assert.ok(initialConfig.categories.length >= 3, 'Doit comporter des catégories de coiffure');
  assert.ok(initialConfig.steps.length >= 3, 'Doit comporter les étapes de réservation');

  // 2. Modification des textes Hero et ajout d’une nouvelle section dynamique
  const customSectionTitle = 'Nos Engagements d’Hygiène Médicale';
  const customSectionBadge = 'GARANTIE CLINIQUE 2026';
  const updatedConfig = {
    ...initialConfig,
    hero: {
      ...initialConfig.hero,
      headlineMain: 'L’Art de la Haute Coiffure',
      headlineHighlight: 'à Abidjan',
      badgeText: 'SÉLECTION D’ÉLITE 2026',
    },
    customSections: [
      {
        id: 'sec_hygiene_test',
        title: customSectionTitle,
        badgeText: customSectionBadge,
        description: 'Protocole de stérilisation systématique par ultraviolets.',
        layout: 'cards' as const,
        isVisible: true,
        order: 1,
        items: [
          {
            id: 'item_1',
            title: 'Stérilisation UV-C',
            description: 'Lames et tondeuses passées en autoclave après chaque client.',
            tag: 'Norme Hospitalière',
          },
        ],
      },
    ],
  };

  saveMarketplaceContent(updatedConfig, 'admin@barbercuts.com');

  // 3. Relecture de la configuration persistée
  const saved = getMarketplaceContent();
  assert.equal(saved.hero.headlineMain, 'L’Art de la Haute Coiffure');
  assert.equal(saved.hero.headlineHighlight, 'à Abidjan');
  assert.equal(saved.hero.badgeText, 'SÉLECTION D’ÉLITE 2026');
  assert.equal(saved.customSections.length, 1);
  assert.equal(saved.customSections[0].title, customSectionTitle);

  // 4. Rendu de la Marketplace : la nouvelle section personnalisée et les nouveaux titres sont visibles en direct
  const html = renderToStaticMarkup(
    <AppProvider>
      <MarketplaceHome />
    </AppProvider>,
  );
  assert.ok(html.includes('L’Art de la Haute Coiffure'), 'Le nouveau titre hero doit apparaître');
  assert.ok(html.includes('à Abidjan'), 'Le mot clé de luxe doit apparaître');
  assert.ok(html.includes(customSectionTitle), 'La nouvelle section personnalisée doit être rendue');
  assert.ok(html.includes(customSectionBadge), 'Le badge de la nouvelle section doit être rendu');
  assert.ok(html.includes('Stérilisation UV-C'), 'L’élément de la section ajoutée doit être affiché');

  // 5. Réinitialisation sécurisée aux valeurs par défaut
  resetMarketplaceContent('admin@barbercuts.com');
  const restored = getMarketplaceContent();
  assert.equal(restored.hero.headlineMain, DEFAULT_MARKETPLACE_CONTENT.hero.headlineMain);
});
