import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthContextType, type AuthUser } from '../src/context/AuthContext';
import { MarketplaceProvider } from '../src/context/MarketplaceProvider';
import { Navbar } from '../src/components/common/Navbar';
import { ToastContainer } from '../src/components/common/ToastContainer';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { MyFavoritesView } from '../src/components/marketplace/MyFavoritesView';
import { SalonPublicPage } from '../src/components/marketplace/salon/SalonPublicPage';
import type { PublicSalonDetail, Review, Salon } from '../src/types';

function setupDom(url = 'http://localhost/') {
  const existing = (globalThis as { __favReviewsDom?: JSDOM }).__favReviewsDom;
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
    __favReviewsDom: dom,
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

const SAMPLE_SALONS: Salon[] = [
  {
    id: 'salon-fav-1',
    name: 'L’Atelier du Rasoir',
    slug: 'atelier-du-rasoir',
    city: 'Abidjan',
    commune: 'Cocody',
    quarter: 'Riviera 2',
    type: 'barbershop',
    rating: 4.9,
    reviewCount: 42,
    minPrice: 4000,
    isVerified: true,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
  {
    id: 'salon-fav-2',
    name: 'Coupe Royale Plateau',
    slug: 'coupe-royale-plateau',
    city: 'Abidjan',
    commune: 'Plateau',
    quarter: 'Centre',
    type: 'barbershop',
    rating: 4.7,
    reviewCount: 19,
    minPrice: 3500,
    isVerified: false,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
];

const SAMPLE_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    salonId: 'salon-fav-1',
    author: 'Kouassi Jean',
    rating: 5,
    comment: 'Dégradé impeccable et accueil ponctuel.',
    date: '2026-03-10T10:00:00Z',
    verified: true,
  },
  {
    id: 'rev-2',
    salonId: 'salon-fav-1',
    author: 'Mariam Diallo',
    rating: 4,
    comment: 'Très bonne ambiance et taille de barbe soignée.',
    date: '2026-03-12T15:30:00Z',
    verified: true,
  },
  {
    id: 'rev-3',
    salonId: 'salon-fav-1',
    author: 'Sékou Touré',
    rating: 5,
    comment: 'Hygiène irréprochable, je recommande sans hésiter.',
    date: '2026-03-15T18:00:00Z',
    verified: true,
  },
];

const SAMPLE_DETAIL: PublicSalonDetail = {
  salon: SAMPLE_SALONS[0],
  services: [],
  staff: [],
  reviews: SAMPLE_REVIEWS,
  branches: [],
  rating: 4.8,
  reviewCount: 3,
  minPrice: 4000,
};

function makeAuthValue(user: AuthUser | null): AuthContextType {
  return {
    user,
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
    isAuthenticated: Boolean(user),
    hasWorkspace: false,
    hasPermission: () => false,
  };
}

function Harness({ user, initialPath = '/' }: { user: AuthUser | null; initialPath?: string }) {
  return (
    <AuthContext.Provider value={makeAuthValue(user)}>
      <MarketplaceProvider initialSalons={SAMPLE_SALONS}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Navbar />
          <Routes>
            <Route path="/" element={<MarketplaceHome />} />
            <Route path="/mes-favoris" element={<MyFavoritesView />} />
            <Route path="/salons/:slug" element={<SalonPublicPage initialDetail={SAMPLE_DETAIL} />} />
          </Routes>
          <ToastContainer />
        </MemoryRouter>
      </MarketplaceProvider>
    </AuthContext.Provider>
  );
}

test('visiteur déconnecté : onglet Mes favoris masqué et le cœur invite à se connecter', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<Harness user={null} />);

  assert.equal(screen.queryByTestId('navbar-favorites-tab'), null);

  const favBtn = screen.getByTestId('favorite-toggle-salon-fav-1');
  assert.equal(favBtn.getAttribute('aria-pressed'), 'false');

  fireEvent.click(favBtn);
  assert.equal(favBtn.getAttribute('aria-pressed'), 'false');
  assert.ok(screen.getByText(/Connectez-vous pour enregistrer vos salons favoris/i));
});

test('utilisateur connecté : bascule un salon en favori, affiche Mes favoris dans la navigation et la page dédiée', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  const loggedInUser: AuthUser = {
    id: 'user-client-1',
    name: 'Awa Koné',
    email: 'awa@example.com',
    emailVerified: true,
  };

  render(<Harness user={loggedInUser} />);

  const navTab = screen.getByTestId('navbar-favorites-tab');
  assert.ok(navTab.textContent?.includes('Mes favoris'));

  const salonsSection = document.getElementById('salons-section');
  assert.ok(salonsSection);
  const favBtn = within(salonsSection).getByTestId('favorite-toggle-salon-fav-1');
  assert.equal(favBtn.getAttribute('aria-pressed'), 'false');

  // Ajouter aux favoris
  fireEvent.click(favBtn);
  assert.equal(favBtn.getAttribute('aria-pressed'), 'true');
  assert.ok(navTab.textContent?.includes('(1)'));

  // Naviguer vers l'onglet Mes favoris
  fireEvent.click(navTab);
  const favView = screen.getByTestId('my-favorites-view');
  assert.ok(within(favView).getByText('L’Atelier du Rasoir'));
  assert.equal(within(favView).queryByText('Coupe Royale Plateau'), null);

  // Retirer depuis la vue Mes favoris affiche l'état vide
  const removeBtn = within(favView).getByTestId('favorite-toggle-salon-fav-1');
  fireEvent.click(removeBtn);
  assert.ok(screen.getByTestId('my-favorites-empty'));
});

test('page détail salon : le carrousel Avis clients affiche les témoignages avec notes en étoiles et navigue', async (t) => {
  setupDom('http://localhost/salons/atelier-du-rasoir');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<Harness user={null} initialPath="/salons/atelier-du-rasoir" />);

  const carousel = screen.getByTestId('salon-reviews-carousel');
  assert.equal(carousel.getAttribute('aria-roledescription'), 'carousel');

  assert.equal(screen.getByTestId('reviews-carousel-counter').textContent, 'Avis 1 / 3');
  assert.ok(within(carousel).getByText('Kouassi Jean'));
  assert.ok(within(carousel).getByText(/Dégradé impeccable et accueil ponctuel/));
  assert.ok(within(carousel).getByLabelText('Note 5 sur 5'));

  // Passer à l'avis suivant
  fireEvent.click(screen.getByTestId('reviews-carousel-next'));
  assert.equal(screen.getByTestId('reviews-carousel-counter').textContent, 'Avis 2 / 3');
  assert.ok(within(carousel).getByText('Mariam Diallo'));
  assert.ok(within(carousel).getByLabelText('Note 4 sur 5'));

  // Aller directement au troisième avis via la pastille
  fireEvent.click(screen.getByTestId('reviews-carousel-dot-2'));
  assert.equal(screen.getByTestId('reviews-carousel-counter').textContent, 'Avis 3 / 3');
  assert.ok(within(carousel).getByText('Sékou Touré'));

  // Revenir à l'avis précédent
  fireEvent.click(screen.getByTestId('reviews-carousel-prev'));
  assert.equal(screen.getByTestId('reviews-carousel-counter').textContent, 'Avis 2 / 3');
});

test('page détail salon : aucun avis affiché honnêtement et sans contrôles superflus pour un avis unique', async (t) => {
  setupDom('http://localhost/salons/atelier-du-rasoir');
  const { render, screen, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  const { SalonReviewsSection } = await import('../src/components/marketplace/salon/SalonReviewsSection');

  const singleView = render(<SalonReviewsSection reviews={[SAMPLE_REVIEWS[0]]} rating={5} reviewCount={1} />);
  assert.equal(screen.getByTestId('reviews-carousel-counter').textContent, 'Avis 1 / 1');
  assert.equal(screen.queryByTestId('reviews-carousel-next'), null);
  singleView.unmount();

  render(<SalonReviewsSection reviews={[]} />);
  assert.ok(screen.getByText(/Aucun avis n'a encore été déposé/));
});
