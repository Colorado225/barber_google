import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../src/context/AuthContext';
import { AppProvider } from '../src/context/AppContext';
import { Navbar } from '../src/components/common/Navbar';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import {
  computeMarketplacePriceBounds,
  extractSearchedCategoriesFromQuery,
  isSalonRecommendedByHistory,
  matchesSalonPriceRange,
} from '../src/lib/marketplace-content';
import type { Salon } from '../src/types';

function setupDom(url = 'http://localhost/') {
  const existing = (globalThis as { __recPriceDom?: JSDOM }).__recPriceDom;
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
    __recPriceDom: dom,
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
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    const MockIntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      MockIntersectionObserver;
    (dom.window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      MockIntersectionObserver;
  }
  return dom;
}

const TEST_SALONS: Salon[] = [
  {
    id: 'salon-fade',
    name: 'Studio Fade Cocody',
    slug: 'studio-fade-cocody',
    city: 'Abidjan',
    commune: 'Cocody',
    quarter: 'Angré',
    type: 'barbershop',
    serviceCategories: ['coupe', 'barbe'],
    rating: 4.9,
    reviewCount: 34,
    minPrice: 3000,
    avgPrice: 5000,
    isVerified: true,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
  {
    id: 'salon-visage',
    name: 'Maison Soin & Visage',
    slug: 'maison-soin-visage',
    city: 'Abidjan',
    commune: 'Plateau',
    quarter: 'Centre',
    type: 'institut',
    serviceCategories: ['visage', 'soins'],
    rating: 4.8,
    reviewCount: 21,
    minPrice: 12000,
    avgPrice: 15000,
    isVerified: true,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
  {
    id: 'salon-tresses',
    name: 'Atelier Tresses Marcory',
    slug: 'atelier-tresses-marcory',
    city: 'Abidjan',
    commune: 'Marcory',
    quarter: 'Zone 4',
    type: 'salon_femme',
    serviceCategories: ['tresses'],
    rating: 4.6,
    reviewCount: 14,
    minPrice: 8000,
    isVerified: false,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
];

const GUEST_AUTH: AuthContextType = {
  user: null,
  memberships: [],
  activeMembership: null,
  activeSalonId: null,
  onboarding: null,
  loading: false,
  error: null,
  signIn: async () => {},
  signUp: async () => ({ status: 'confirmation-required' }),
  signOut: async () => {},
  refreshSession: async () => {},
  selectSalon: () => false,
  verifyEmail: async () => {},
  resendVerification: async () => {},
  requestPasswordReset: async () => {},
  resetPassword: async () => {},
  createSalon: async () => '',
  completeOnboarding: async () => {},
  isAuthenticated: false,
  hasWorkspace: false,
  hasPermission: () => false,
};

function Harness({ initialPath = '/' }: { initialPath?: string }) {
  return (
    <AuthContext.Provider value={GUEST_AUTH}>
      <AppProvider initialSalons={TEST_SALONS}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Navbar />
          <Routes>
            <Route path="/" element={<MarketplaceHome />} />
            <Route path="/tarifs" element={<div data-testid="pricing-page">Tarifs</div>} />
            <Route path="/connexion" element={<div data-testid="login-page">Connexion</div>} />
            <Route path="/reservation" element={<div data-testid="booking-page">Réservation</div>} />
          </Routes>
        </MemoryRouter>
      </AppProvider>
    </AuthContext.Provider>
  );
}

test('helpers : extraction de catégories, recommandation dynamique et bornes de prix', () => {
  assert.deepEqual(extractSearchedCategoriesFromQuery('Fade cocody'), ['degrade']);
  assert.deepEqual(extractSearchedCategoriesFromQuery('soin visage'), ['visage', 'soins']);
  assert.deepEqual(extractSearchedCategoriesFromQuery('ab'), []);

  assert.equal(isSalonRecommendedByHistory(TEST_SALONS[0], []), false);
  assert.equal(isSalonRecommendedByHistory(TEST_SALONS[0], ['degrade']), true);
  assert.equal(isSalonRecommendedByHistory(TEST_SALONS[1], ['degrade']), false);
  assert.equal(isSalonRecommendedByHistory(TEST_SALONS[1], ['visage']), true);

  const bounds = computeMarketplacePriceBounds(TEST_SALONS);
  assert.deepEqual(bounds, { min: 0, max: 15000, step: 500 });

  assert.equal(matchesSalonPriceRange(TEST_SALONS[0], null, bounds), true);
  assert.equal(matchesSalonPriceRange(TEST_SALONS[0], [4000, 10000], bounds), true); // avgPrice 5000
  assert.equal(matchesSalonPriceRange(TEST_SALONS[1], [4000, 10000], bounds), false); // avgPrice 15000
  assert.equal(matchesSalonPriceRange(TEST_SALONS[2], [4000, 10000], bounds), true); // minPrice fallback 8000
});

test('badge Recommandé dynamique : apparaît selon les catégories recherchées et persiste dans localStorage', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  const firstRender = render(<Harness />);

  // Aucune catégorie recherchée au départ : aucun badge Recommandé
  assert.equal(screen.queryByTestId('recommended-badge-salon-fade'), null);
  assert.equal(screen.queryByTestId('featured-recommended-badge-salon-fade'), null);

  // Clic sur la catégorie "Dégradé (Fade)" dans le header
  const categoryStrip = screen.getByTestId('marketplace-header-categories');
  fireEvent.click(within(categoryStrip).getByRole('button', { name: /Dégradé \(Fade\)/i }));

  // Revenir à "Tous les services" pour afficher tous les salons
  fireEvent.click(within(categoryStrip).getByRole('button', { name: /Tous les services/i }));

  // Seul le salon correspondant à "Dégradé (Fade)" porte le badge "Recommandé"
  assert.ok(screen.getByTestId('recommended-badge-salon-fade'));
  assert.ok(screen.getByTestId('featured-recommended-badge-salon-fade'));
  assert.equal(screen.queryByTestId('recommended-badge-salon-visage'), null);
  assert.equal(screen.queryByTestId('recommended-badge-salon-tresses'), null);

  // Recherche texte libre contenant un mot-clé de catégorie ("Visage")
  const headerSearch = screen.getByTestId('marketplace-header-search');
  fireEvent.change(headerSearch, { target: { value: 'Visage' } });
  fireEvent.change(headerSearch, { target: { value: '' } });

  assert.ok(screen.getByTestId('recommended-badge-salon-fade'));
  assert.ok(screen.getByTestId('recommended-badge-salon-visage'));
  assert.equal(screen.queryByTestId('recommended-badge-salon-tresses'), null);

  // Vérifier la persistance dans localStorage après un nouveau montage
  const storedRaw = window.localStorage.getItem('barber_cuts_searched_categories_v1');
  assert.ok(storedRaw);
  const stored = JSON.parse(storedRaw) as string[];
  assert.ok(stored.includes('degrade'));
  assert.ok(stored.includes('visage'));

  firstRender.unmount();
  render(<Harness />);
  assert.ok(screen.getByTestId('recommended-badge-salon-fade'));
  assert.ok(screen.getByTestId('recommended-badge-salon-visage'));
});

test('filtre fourchette de prix dans le header : visible sur / et filtre les salons selon le coût moyen', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  const { unmount } = render(<Harness />);

  const priceFilter = screen.getByTestId('marketplace-price-filter');
  assert.ok(document.querySelector('header')?.contains(priceFilter));

  const minSlider = screen.getByTestId('price-range-min') as HTMLInputElement;
  const maxSlider = screen.getByTestId('price-range-max') as HTMLInputElement;
  const priceLabel = screen.getByTestId('marketplace-price-label');
  const listView = () => screen.getByTestId('marketplace-list-view');

  // Tous les salons visibles initialement
  assert.ok(within(listView()).getByText('Studio Fade Cocody'));
  assert.ok(within(listView()).getByText('Atelier Tresses Marcory'));
  assert.ok(within(listView()).getByText('Maison Soin & Visage'));

  // Restreindre entre 6 000 et 10 000 FCFA -> seul Atelier Tresses Marcory (8 000) reste
  fireEvent.change(minSlider, { target: { value: '6000' } });
  fireEvent.change(maxSlider, { target: { value: '10000' } });

  assert.match(priceLabel.textContent || '', /6[\s\u202f]000/);
  assert.match(priceLabel.textContent || '', /10[\s\u202f]000/);
  assert.equal(within(listView()).queryByText('Studio Fade Cocody'), null);
  assert.ok(within(listView()).getByText('Atelier Tresses Marcory'));
  assert.equal(within(listView()).queryByText('Maison Soin & Visage'), null);

  // Le badge de filtre actif s'affiche et réinitialise le filtre au clic
  const salonsSection = document.getElementById('salons-section');
  assert.ok(salonsSection);
  const chipReset = within(salonsSection).getByRole('button', { name: /Prix moyen :/i });
  fireEvent.click(chipReset);

  assert.ok(within(listView()).getByText('Studio Fade Cocody'));
  assert.ok(within(listView()).getByText('Atelier Tresses Marcory'));
  assert.ok(within(listView()).getByText('Maison Soin & Visage'));

  // Masqué hors parcours marketplace (/tarifs, /connexion, /reservation)
  unmount();
  for (const path of ['/tarifs', '/connexion', '/reservation']) {
    const subView = render(<Harness initialPath={path} />);
    assert.equal(screen.queryByTestId('marketplace-price-filter'), null);
    subView.unmount();
  }
});
