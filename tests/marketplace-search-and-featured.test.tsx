import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../src/App';
import { Navbar } from '../src/components/common/Navbar';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { AppProvider, useOptionalApp } from '../src/context/AppContext';
import { matchesSalonSearch, selectTopRatedBarbers } from '../src/lib/marketplace-content';
import type { Salon } from '../src/types';

function setupDom(url = 'http://localhost/') {
  const existing = (globalThis as { __searchFeaturedDom?: JSDOM }).__searchFeaturedDom;
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
    __searchFeaturedDom: dom,
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
    id: 'salon-1',
    name: 'King Fade Riviera',
    slug: 'king-fade-riviera',
    city: 'Abidjan',
    commune: 'Cocody',
    quarter: 'Riviera Palmeraie',
    address: 'Rue des Jardins',
    type: 'barbershop',
    rating: 4.9,
    reviewCount: 84,
    minPrice: 4000,
    isVerified: true,
    isPublishedOnMarketplace: true,
    status: 'active',
    tagline: 'Dégradés de précision & serviette chaude',
  },
  {
    id: 'salon-2',
    name: 'Studio Élite Marcory',
    slug: 'studio-elite-marcory',
    city: 'Abidjan',
    commune: 'Marcory',
    quarter: 'Zone 4',
    address: 'Boulevard de Marseille',
    type: 'salon_mixte',
    rating: 4.7,
    reviewCount: 45,
    minPrice: 5000,
    isVerified: false,
    isPublishedOnMarketplace: true,
    status: 'active',
    tagline: 'Coiffure urbaine et barbe',
  },
  {
    id: 'salon-3',
    name: 'Barbier Plateau Classic',
    slug: 'barbier-plateau-classic',
    city: 'Yamoussoukro',
    commune: 'Plateau',
    quarter: 'Centre',
    address: 'Avenue Houphouët',
    type: 'barbershop',
    rating: 4.9,
    reviewCount: 120,
    minPrice: 3500,
    isVerified: true,
    isPublishedOnMarketplace: true,
    status: 'active',
  },
  {
    id: 'salon-unrated',
    name: 'Nouveau Barbier Yopougon',
    slug: 'nouveau-barbier-yopougon',
    city: 'Abidjan',
    commune: 'Yopougon',
    quarter: 'Selmer',
    type: 'barbershop',
    isPublishedOnMarketplace: true,
    status: 'active',
  },
  {
    id: 'salon-suspended',
    name: 'Salon Suspendu',
    commune: 'Treichville',
    type: 'barbershop',
    rating: 5.0,
    reviewCount: 200,
    isPublishedOnMarketplace: true,
    status: 'suspended',
  },
];

function SelectedSalonProbe() {
  const { selectedSalonForModal } = useOptionalApp();
  if (!selectedSalonForModal) return null;
  return (
    <div role="dialog" aria-label={selectedSalonForModal.name}>
      {selectedSalonForModal.name}
    </div>
  );
}

function MarketplaceHarness({ initialSalons }: { initialSalons: Salon[] }) {
  return (
    <AppProvider initialSalons={initialSalons}>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
        <MarketplaceHome />
        <SelectedSalonProbe />
      </MemoryRouter>
    </AppProvider>
  );
}

test('matchesSalonSearch filtre par nom et localisation (ville, commune, quartier, adresse)', () => {
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[0], ''), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[0], 'King Fade'), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[0], 'cocody'), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[0], 'Palmeraie'), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[1], 'Zone 4'), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[1], 'Marseille'), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[2], 'Yamoussoukro'), true);
  // Insensible aux accents + multi-mots nom/lieu
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[1], 'Elite Marcory'), true);
  assert.equal(matchesSalonSearch(SAMPLE_SALONS[0], 'Yamoussoukro'), false);
});

test('selectTopRatedBarbers trie les salons publiés les mieux notés et exclut les non-notés ou suspendus', () => {
  const top = selectTopRatedBarbers(SAMPLE_SALONS);
  assert.deepEqual(
    top.map((s) => s.id),
    ['salon-3', 'salon-1', 'salon-2'],
  );
  assert.deepEqual(selectTopRatedBarbers([SAMPLE_SALONS[3]]), []);
});

test('la barre de recherche du header filtre les salons en temps réel par nom ou localisation', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<MarketplaceHarness initialSalons={SAMPLE_SALONS} />);

  const header = document.querySelector('header');
  assert.ok(header);

  const headerSearch = screen.getByTestId('marketplace-header-search') as HTMLInputElement;
  assert.ok(header.contains(headerSearch), 'La barre de recherche doit être dans le <header>');

  const salonsSection = document.getElementById('salons-section');
  assert.ok(salonsSection);
  const scopedSalons = within(salonsSection);

  // Tous les salons publiés actifs sont affichés
  assert.ok(scopedSalons.getByText('King Fade Riviera'));
  assert.ok(scopedSalons.getByText('Studio Élite Marcory'));
  assert.ok(scopedSalons.getByText('Barbier Plateau Classic'));
  assert.ok(scopedSalons.getByText('Nouveau Barbier Yopougon'));
  assert.equal(scopedSalons.queryByText('Salon Suspendu'), null);

  // Filtrage en temps réel par localisation (commune/quartier)
  fireEvent.change(headerSearch, { target: { value: 'Zone 4' } });
  assert.ok(scopedSalons.getByText('Studio Élite Marcory'));
  assert.equal(scopedSalons.queryByText('King Fade Riviera'), null);
  assert.equal(scopedSalons.queryByText('Barbier Plateau Classic'), null);

  // Synchronisation avec le champ de recherche hero
  const heroSearch = document.getElementById('marketplace-search') as HTMLInputElement;
  assert.equal(heroSearch.value, 'Zone 4');

  // Filtrage en temps réel par nom
  fireEvent.change(headerSearch, { target: { value: 'Yamoussoukro' } });
  assert.ok(scopedSalons.getByText('Barbier Plateau Classic'));
  assert.equal(scopedSalons.queryByText('Studio Élite Marcory'), null);

  // Bouton d'effacement dans le header
  const clearBtn = screen.getByRole('button', { name: 'Effacer la recherche' });
  fireEvent.click(clearBtn);
  assert.equal(headerSearch.value, '');
  assert.ok(scopedSalons.getByText('King Fade Riviera'));
  assert.ok(scopedSalons.getByText('Studio Élite Marcory'));
});

test('la section Barbiers à la une met en avant les salons les mieux notés dans un rail horizontal', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<MarketplaceHarness initialSalons={SAMPLE_SALONS} />);

  const featuredSection = screen.getByTestId('featured-barbers-section');
  assert.ok(within(featuredSection).getByText('Barbiers à la une'));

  const rail = screen.getByTestId('featured-barbers-rail');
  assert.ok(rail.className.includes('overflow-x-auto'), 'Le rail doit défiler horizontalement');

  const cardNames = Array.from(rail.querySelectorAll('h3')).map((h) => h.textContent);
  assert.deepEqual(cardNames, ['Barbier Plateau Classic', 'King Fade Riviera', 'Studio Élite Marcory']);

  // Vérifie l'animation discrète d'attention sur les boutons Réserver des cartes à la une
  const reserveButtons = within(featuredSection).getAllByRole('button', { name: 'Réserver' });
  assert.equal(reserveButtons.length, 3);
  reserveButtons.forEach((btn) => {
    assert.ok(btn.className.includes('featured-book-pulse'));
  });

  // Un clic sur une carte ouvre la fiche détaillée du salon
  const firstCardTrigger = within(screen.getByTestId('featured-barber-card-salon-3')).getByRole('button', {
    name: /Barbier Plateau Classic/i,
  });
  fireEvent.click(firstCardTrigger);
  assert.ok(screen.getByRole('dialog'));
});

test('Barbiers à la une reste masquée si aucun salon n’a encore de note', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<MarketplaceHarness initialSalons={[SAMPLE_SALONS[3]]} />);
  assert.equal(screen.queryByTestId('featured-barbers-section'), null);
});

test('le bouton du header bascule entre la vue liste en cartes et la vue carte géographique', async (t) => {
  setupDom('http://localhost/');
  const { render, screen, fireEvent, within, waitFor, cleanup } = await import('@testing-library/react');
  t.after(() => cleanup());

  render(<MarketplaceHarness initialSalons={SAMPLE_SALONS} />);

  const header = document.querySelector('header');
  assert.ok(header);

  const viewToggle = screen.getByTestId('marketplace-view-toggle');
  assert.ok(header.contains(viewToggle), 'Le bouton Liste/Carte doit être dans le <header>');
  assert.equal(viewToggle.getAttribute('aria-pressed'), 'false');
  assert.ok(screen.getByTestId('marketplace-list-view'));
  assert.equal(screen.queryByTestId('marketplace-map-view'), null);

  // Bascule vers la vue carte géographique
  fireEvent.click(viewToggle);
  assert.equal(viewToggle.getAttribute('aria-pressed'), 'true');
  const mapView = await waitFor(() => screen.getByTestId('marketplace-map-view'));
  assert.equal(screen.queryByTestId('marketplace-list-view'), null);
  assert.ok(within(mapView).getByText('King Fade Riviera'));
  assert.ok(within(mapView).getByText(/Rue des Jardins, Riviera Palmeraie, Cocody, Abidjan/));

  // La recherche en temps réel s'applique aussi en vue carte
  const headerSearch = screen.getByTestId('marketplace-header-search');
  fireEvent.change(headerSearch, { target: { value: 'Yamoussoukro' } });
  assert.ok(within(mapView).getByText('Barbier Plateau Classic'));
  assert.equal(within(mapView).queryByText('King Fade Riviera'), null);

  // Rebasculer vers la vue liste en cartes
  fireEvent.click(viewToggle);
  assert.equal(viewToggle.getAttribute('aria-pressed'), 'false');
  assert.ok(screen.getByTestId('marketplace-list-view'));
  assert.equal(screen.queryByTestId('marketplace-map-view'), null);
});

test('les contrôles recherche et carte du header sont masqués hors marketplace (/reservation, /admin, /connexion, /tarifs)', async (t) => {
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
      screen.queryByTestId('marketplace-header-search'),
      null,
      `La barre de recherche du header ne doit pas apparaître sur ${routePath}`,
    );
    assert.equal(
      screen.queryByTestId('marketplace-view-toggle'),
      null,
      `Le bouton carte/liste du header ne doit pas apparaître sur ${routePath}`,
    );
    view.unmount();
  }
});
