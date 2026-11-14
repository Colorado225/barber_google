import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../src/App';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { Navbar } from '../src/components/common/Navbar';
import { AppProvider } from '../src/context/AppContext';
import {
  DEFAULT_MARKETPLACE_CONTENT,
  matchesSalonCategory,
  resolveCategoryFilter,
} from '../src/lib/marketplace-content';
import type { Salon } from '../src/types';

function setupDom(url = 'http://localhost/') {
  const existing = (globalThis as { __headerCatDom?: JSDOM }).__headerCatDom;
  if (existing) {
    existing.reconfigure({ url });
    existing.window.document.body.innerHTML = '<div id="root"></div>';
    existing.window.localStorage.clear();
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url,
  });
  Object.assign(globalThis, {
    __headerCatDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = (() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof dom.window.matchMedia;
  dom.window.scrollTo = () => {};
  return dom;
}

const SAMPLE_SALONS: Salon[] = [
  {
    id: 's-barber',
    name: 'Atelier Fade Abidjan',
    commune: 'Cocody',
    type: 'barbershop',
    isPublishedOnMarketplace: true,
    status: 'active',
    serviceCategories: ['coupe', 'barbe', 'combo'],
  },
  {
    id: 's-tresses',
    name: 'Studio Tresses Riviera',
    commune: 'Riviera',
    type: 'salon_femme',
    isPublishedOnMarketplace: true,
    status: 'active',
    serviceCategories: ['tresses', 'soins', 'coloration'],
  },
  {
    id: 's-visage',
    name: 'Institut Éclat Plateau',
    commune: 'Plateau',
    type: 'institut',
    isPublishedOnMarketplace: true,
    status: 'active',
    serviceCategories: ['visage', 'soins'],
  },
];

function MarketplaceHarness({ initialSalons }: { initialSalons: Salon[] }) {
  return (
    <AppProvider initialSalons={initialSalons}>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
        <MarketplaceHome />
      </MemoryRouter>
    </AppProvider>
  );
}

test('resolveCategoryFilter et matchesSalonCategory associent correctement les catégories', () => {
  assert.equal(resolveCategoryFilter({ slug: 'degrade', label: 'Dégradé (Fade)' }), 'coupe');
  assert.equal(resolveCategoryFilter({ slug: 'fade', label: 'Fade' }), 'coupe');
  assert.equal(resolveCategoryFilter({ slug: 'barbe', label: 'Taille de Barbe' }), 'barbe');
  assert.equal(resolveCategoryFilter({ slug: 'rasage', label: 'Rasage Traditionnel' }), 'barbe');
  assert.equal(resolveCategoryFilter({ slug: 'shave', label: 'Shave' }), 'barbe');
  assert.equal(resolveCategoryFilter({ slug: 'visage', label: 'Soin Visage' }), 'visage');

  const fadeCat = DEFAULT_MARKETPLACE_CONTENT.categories.find((c) => c.slug === 'degrade')!;
  const tressesCat = DEFAULT_MARKETPLACE_CONTENT.categories.find((c) => c.slug === 'tresses')!;

  assert.equal(matchesSalonCategory(SAMPLE_SALONS[0], fadeCat), true);
  assert.equal(matchesSalonCategory(SAMPLE_SALONS[1], fadeCat), false);
  assert.equal(matchesSalonCategory(SAMPLE_SALONS[1], tressesCat), true);
});

test('le header marketplace affiche une liste horizontale défilable de catégories et filtre les salons', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<MarketplaceHarness initialSalons={SAMPLE_SALONS} />);

  const header = document.querySelector('header');
  assert.ok(header, 'Le header doit être rendu');

  const strip = screen.getByTestId('marketplace-header-categories');
  assert.ok(header.contains(strip), 'La liste de catégories doit être dans le <header> marketplace');
  assert.ok(strip.className.includes('overflow-x-auto'), 'La barre doit être défilable horizontalement');

  // Tous les salons visibles par défaut
  assert.ok(screen.getByText('Atelier Fade Abidjan'));
  assert.ok(screen.getByText('Studio Tresses Riviera'));
  assert.ok(screen.getByText('Institut Éclat Plateau'));

  // Filtrage via la catégorie "Dégradé (Fade)" dans le header
  const fadeBtn = screen.getByRole('button', { name: /Dégradé \(Fade\)/i });
  fireEvent.click(fadeBtn);
  assert.equal(fadeBtn.getAttribute('aria-pressed'), 'true');
  assert.ok(screen.getByText('Atelier Fade Abidjan'));
  assert.equal(screen.queryByText('Studio Tresses Riviera'), null);
  assert.equal(screen.queryByText('Institut Éclat Plateau'), null);

  // Filtrage via "Soin Visage"
  const facialBtn = screen.getByRole('button', { name: /Soin Visage/i });
  fireEvent.click(facialBtn);
  assert.equal(facialBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(screen.queryByText('Atelier Fade Abidjan'), null);
  assert.ok(screen.getByText('Institut Éclat Plateau'));

  // Réinitialisation via "Tous les services"
  const allBtn = screen.getByRole('button', { name: /Tous les services/i });
  fireEvent.click(allBtn);
  assert.equal(allBtn.getAttribute('aria-pressed'), 'true');
  assert.ok(screen.getByText('Atelier Fade Abidjan'));
  assert.ok(screen.getByText('Studio Tresses Riviera'));
  assert.ok(screen.getByText('Institut Éclat Plateau'));
});

test('la barre de catégories est masquée sur les routes privées ou non-marketplace (/reservation, /admin, /connexion)', async (t) => {
  setupDom('http://localhost/reservation');
  const { render, screen, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  for (const routePath of ['/reservation', '/admin', '/connexion', '/tarifs']) {
    const view = render(
      <MemoryRouter initialEntries={[routePath]}>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </MemoryRouter>,
    );
    assert.equal(
      screen.queryByTestId('marketplace-header-categories'),
      null,
      `La barre de catégories ne doit pas apparaître sur ${routePath}`,
    );
    view.unmount();
  }
});
