import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getAdminSalonsList,
  updateSalonByAdmin,
  getAuditLogs,
  type SalonAdminDetail,
} from '../src/lib/superadmin';
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

test('SalonManagement : consultation, certification et désactivation/suspension des salons locataires', () => {
  setupMockLocalStorage();

  // Salons tels que renvoyés par la base (aucune donnée inventée).
  const REAL_SALONS = [
    { id: 'real-a', name: 'Salon A', commune: 'Cocody', isPublishedOnMarketplace: true, isVerified: false },
    { id: 'real-b', name: 'Salon B', commune: 'Plateau', isPublishedOnMarketplace: true, isVerified: false },
    { id: 'real-c', name: 'Salon C', commune: 'Marcory', isPublishedOnMarketplace: false, isVerified: false },
  ];

  // 1. Consultation de la liste consolidée
  const salons = getAdminSalonsList(REAL_SALONS);
  assert.equal(
    salons.length,
    REAL_SALONS.length,
    'La liste doit refléter exactement les salons reçus de la base',
  );

  const salonA = salons[0];
  assert.ok(salonA.id, 'Le salon doit posséder un identifiant');
  assert.ok(salonA.name, 'Le salon doit posséder un nom commercial');
  assert.equal(salonA.status, 'active', 'Le salon doit être actif par défaut');

  // 2. Certification officielle par le SuperAdmin
  updateSalonByAdmin(salonA.id, { isVerified: true }, 'admin@barbercuts.com');
  const updatedSalons = getAdminSalonsList(REAL_SALONS);
  const verifiedSalon = updatedSalons.find((s) => s.id === salonA.id);
  assert.equal(verifiedSalon?.isVerified, true, 'Le salon doit être marqué certifié');

  // 3. Désactivation / Suspension d’un salon locataire
  updateSalonByAdmin(salonA.id, { status: 'suspended', isPublished: false }, 'admin@barbercuts.com');
  const suspendedSalons = getAdminSalonsList(REAL_SALONS);
  const targetSuspended = suspendedSalons.find((s) => s.id === salonA.id);
  assert.equal(targetSuspended?.status, 'suspended', 'Le statut du salon doit être suspendu');
  assert.equal(targetSuspended?.isPublished, false, 'Le salon suspendu doit être masqué de la marketplace');

  // 4. Vérification de la traçabilité dans les journaux d’audit
  const logs = getAuditLogs();
  assert.ok(logs.length >= 2, 'Les actions administratives doivent être journalisées');
  assert.ok(
    logs.some((l) => l.action.includes('Modification statut') || l.action.includes('suspendu')),
    'Le journal doit tracer la suspension du salon',
  );
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
