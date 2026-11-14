import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../src/context/AuthContext';
import { AppProvider } from '../src/context/AppContext';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import {
  DEFAULT_MARKETPLACE_CONTENT,
  resetMarketplaceContent,
  saveMarketplaceContent,
} from '../src/lib/marketplace-content';
import type { Salon } from '../src/types';

function setupDom(url = 'http://localhost/') {
  const existing = (globalThis as { __footerFaqDom?: JSDOM }).__footerFaqDom;
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
    __footerFaqDom: dom,
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
    id: 'salon-faq-1',
    name: 'L’Atelier Cocody',
    slug: 'atelier-cocody',
    city: 'Abidjan',
    commune: 'Cocody',
    quarter: 'Riviera 2',
    type: 'barbershop',
    rating: 4.9,
    reviewCount: 18,
    minPrice: 4000,
    isVerified: true,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
  {
    id: 'salon-faq-2',
    name: 'Coupe Plateau',
    slug: 'coupe-plateau',
    city: 'Abidjan',
    commune: 'Plateau',
    quarter: 'Centre',
    type: 'salon_mixte',
    rating: 4.6,
    reviewCount: 11,
    minPrice: 3500,
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

function Harness() {
  return (
    <AuthContext.Provider value={GUEST_AUTH}>
      <AppProvider initialSalons={SAMPLE_SALONS}>
        <MemoryRouter>
          <MarketplaceHome />
        </MemoryRouter>
      </AppProvider>
    </AuthContext.Provider>
  );
}

test('footer marketplace : affiche la FAQ repliable avec questions réservation et salons, accessible et interactive', async (t) => {
  setupDom('http://localhost/');
  resetMarketplaceContent('admin@barbercuts.com');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<Harness />);

  const footer = screen.getByTestId('marketplace-footer');
  assert.equal(footer.tagName.toLowerCase(), 'footer');

  const faqSection = within(footer).getByTestId('footer-faq-section');
  assert.ok(within(faqSection).getByRole('heading', { name: /Réserver en toute confiance/i }));

  // Les 5 questions par défaut (réservation + confiance salons) sont présentes et repliées au départ
  assert.equal(DEFAULT_MARKETPLACE_CONTENT.faqs.length, 5);
  const trigger1 = within(faqSection).getByTestId('footer-faq-trigger-faq-1');
  const panel1 = within(faqSection).getByTestId('footer-faq-panel-faq-1');
  const trigger4 = within(faqSection).getByTestId('footer-faq-trigger-faq-4');
  const panel4 = within(faqSection).getByTestId('footer-faq-panel-faq-4');

  assert.equal(trigger1.getAttribute('aria-expanded'), 'false');
  assert.equal(panel1.hasAttribute('hidden'), true);
  assert.equal(trigger4.getAttribute('aria-expanded'), 'false');
  assert.equal(panel4.hasAttribute('hidden'), true);

  // Déplier la question réservation
  fireEvent.click(trigger1);
  assert.equal(trigger1.getAttribute('aria-expanded'), 'true');
  assert.equal(panel1.hasAttribute('hidden'), false);
  assert.match(panel1.textContent || '', /Sélectionnez le salon de votre choix/i);

  // Déplier la question salon replie la précédente
  fireEvent.click(trigger4);
  assert.equal(trigger1.getAttribute('aria-expanded'), 'false');
  assert.equal(panel1.hasAttribute('hidden'), true);
  assert.equal(trigger4.getAttribute('aria-expanded'), 'true');
  assert.equal(panel4.hasAttribute('hidden'), false);
  assert.match(panel4.textContent || '', /établissements actifs ayant complété et publié leur fiche/i);

  // Replier la question active en cliquant à nouveau
  fireEvent.click(trigger4);
  assert.equal(trigger4.getAttribute('aria-expanded'), 'false');
  assert.equal(panel4.hasAttribute('hidden'), true);
});

test('footer marketplace : respecte la visibilité admin des questions et permet de filtrer par commune', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  saveMarketplaceContent(
    {
      ...DEFAULT_MARKETPLACE_CONTENT,
      faqs: DEFAULT_MARKETPLACE_CONTENT.faqs.map((faq) => ({ ...faq, isVisible: false })),
    },
    'admin@barbercuts.com',
  );

  render(<Harness />);

  const footer = screen.getByTestId('marketplace-footer');
  assert.equal(within(footer).queryByTestId('footer-faq-section'), null);

  // Cliquer sur "Salons à Cocody" dans le footer filtre les établissements
  const cocodyButton = within(footer).getByRole('button', { name: 'Salons à Cocody' });
  fireEvent.click(cocodyButton);

  const listView = screen.getByTestId('marketplace-list-view');
  assert.ok(within(listView).getByText('L’Atelier Cocody'));
  assert.equal(within(listView).queryByText('Coupe Plateau'), null);

  resetMarketplaceContent('admin@barbercuts.com');
});
