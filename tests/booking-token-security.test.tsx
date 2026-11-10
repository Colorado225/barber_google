import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext';
import { BookingPortalView, type BookingPortalApi } from '../src/components/marketplace/BookingPortalView';
import { MyBookingsView } from '../src/components/marketplace/MyBookingsView';
import { SalonDetailModal } from '../src/components/marketplace/SalonDetailModal';
import {
  bookingPortalPath,
  bookingPortalUrl,
  clearActiveBookingToken,
  clearAllSavedBookings,
  extractTokenFromHash,
  getActiveBookingToken,
  listSavedBookings,
  redactBookingSecrets,
  replaceSavedBookingToken,
  resolveBookingToken,
  saveBookingLink,
  setActiveBookingToken,
} from '../src/lib/bookingVault';
import {
  applyStrictPortalPrivacy,
  isBookingSecretRoute,
  loadMarketplaceFontsIfAllowed,
} from '../src/lib/portalIsolation';
import type { BookingPortal, PublicBooking, PublicSalonDetail } from '../src/lib/marketplace';

function ensureDom(initialUrl = 'http://localhost/reservation') {
  const existing = (globalThis as { __bookingTokenDom?: JSDOM }).__bookingTokenDom;
  if (existing) {
    existing.reconfigure({ url: initialUrl });
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: initialUrl,
  });
  Object.assign(globalThis, {
    __bookingTokenDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

ensureDom('http://localhost/reservation');
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');

function resetBrowserState(url = 'http://localhost/reservation') {
  const dom = ensureDom(url);
  dom.window.document.head.innerHTML = '';
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  return dom;
}

function makePortalPayload(token: string, overrides: Partial<BookingPortal> = {}): BookingPortal {
  return {
    booking: {
      id: 'apt-1111-2222-3333',
      salonId: 'salon-1',
      status: 'confirmed',
      paymentStatus: 'unpaid',
      clientName: 'Awa Koné',
      serviceName: 'Coupe & Barbe',
      staffName: 'Kouassi',
      startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86400000 + 30 * 60000).toISOString(),
      amount: 5000,
      currency: 'XOF',
      source: 'marketplace',
      cancelToken: token,
      clientEmail: 'awa@example.com',
      clientPhone: '0700000010',
      notes: '',
      createdAt: new Date().toISOString(),
      tokenRotatedAt: null,
    },
    salon: {
      id: 'salon-1',
      name: 'Atelier Abidjan',
      slug: 'atelier-abidjan',
      type: 'barbershop',
      city: 'Abidjan',
      commune: 'Cocody',
      address: 'Rue des Jardins',
      phone: '0700000001',
      whatsapp: '0700000001',
      logoUrl: 'https://third-party.example.net/logo.png',
      coverUrl: 'https://third-party.example.net/cover.jpg',
      currency: 'XOF',
    },
    canCancel: true,
    canReview: false,
    review: null,
    loyalty: null,
    timeline: [
      { status: 'confirmed', reason: 'Confirmée par le salon', createdAt: new Date().toISOString() },
    ],
    ...overrides,
  };
}

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return (
    <output data-testid="location-probe">{`${location.pathname}${location.search}${location.hash}`}</output>
  );
};

test('index.html and notifications-dispatcher treat the booking token as a secret', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<meta\s+name="referrer"\s+content="no-referrer"/i);
  assert.ok(!html.includes('fonts.googleapis.com'), 'index.html must not preload Google Fonts globally');
  assert.ok(!html.includes('fonts.gstatic.com'), 'index.html must not preconnect Google Fonts globally');

  const dispatcher = await readFile(
    new URL('../supabase/functions/notifications-dispatcher/index.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    dispatcher.includes('/reservation#${token}'),
    'notification links must place the secret token in the URL fragment (#)',
  );
  assert.ok(!dispatcher.includes('/reservation/${token}'));
  assert.match(dispatcher, /secret/i);
});

test('portalIsolation blocks third-party font loads on booking portal routes', () => {
  const dom = resetBrowserState('http://localhost/');
  assert.equal(isBookingSecretRoute('/reservation'), true);
  assert.equal(isBookingSecretRoute('/reservation/legacy-token'), true);
  assert.equal(isBookingSecretRoute('/mes-reservations'), true);
  assert.equal(isBookingSecretRoute('/'), false);
  assert.equal(isBookingSecretRoute('/salons/test'), false);

  assert.equal(loadMarketplaceFontsIfAllowed('/'), true);
  assert.equal(dom.window.document.head.querySelectorAll('link[href*="fonts.googleapis"]').length, 1);

  assert.equal(loadMarketplaceFontsIfAllowed('/reservation'), false);
  assert.equal(dom.window.document.head.querySelectorAll('link[href*="fonts.googleapis"]').length, 0);

  const cleanupPrivacy = applyStrictPortalPrivacy({ title: 'Ma réservation — Barber Cuts' });
  const referrer = dom.window.document.head.querySelector('meta[name="referrer"]') as HTMLMetaElement;
  const robots = dom.window.document.head.querySelector('meta[name="robots"]') as HTMLMetaElement;
  assert.equal(referrer?.content, 'no-referrer');
  assert.equal(robots?.content, 'noindex, nofollow, noarchive');
  cleanupPrivacy();
});

test('bookingVault uses fragment URLs, scrubs secrets, expires old items, and avoids silent writes', () => {
  resetBrowserState('http://localhost/');
  const secret = '12345678-1234-4123-8123-1234567890ab';

  assert.equal(bookingPortalPath(secret), `/reservation#${secret}`);
  assert.equal(bookingPortalUrl(secret), `http://localhost/reservation#${secret}`);
  assert.equal(extractTokenFromHash(`#${secret}`), secret);
  assert.equal(extractTokenFromHash(`#token=${secret}`), secret);
  assert.equal(resolveBookingToken({ hash: `#${secret}` }), secret);
  assert.equal(resolveBookingToken({ stateToken: 'from-state', hash: `#${secret}` }), 'from-state');

  const redacted = redactBookingSecrets(
    `Failed loading http://localhost/reservation#${secret} or /reservation/${secret}?token=${secret}`,
    secret,
  );
  assert.ok(!redacted.includes(secret), `Token leaked in redacted text: ${redacted}`);

  // Expiration automatique (> 30 jours après startsAt).
  const oldIso = new Date(Date.now() - 40 * 86400000).toISOString();
  const futureIso = new Date(Date.now() + 2 * 86400000).toISOString();
  saveBookingLink({
    token: 'old-expired-token',
    appointmentId: 'apt-old',
    salonId: 's1',
    salonName: 'Ancien',
    serviceName: 'Coupe',
    startsAt: oldIso,
  });
  saveBookingLink({
    token: secret,
    appointmentId: 'apt-new',
    salonId: 's1',
    salonName: 'Actuel',
    serviceName: 'Barbe',
    startsAt: futureIso,
  });
  const saved = listSavedBookings();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].token, secret);

  // replaceSavedBookingToken ne doit rien créer si le jeton n'était pas déjà enregistré.
  assert.equal(replaceSavedBookingToken('unknown-token', 'new-token', 'apt-unknown'), false);
  assert.equal(replaceSavedBookingToken(secret, 'rotated-token', 'apt-new'), true);
  assert.equal(listSavedBookings()[0].token, 'rotated-token');

  clearAllSavedBookings();
  assert.equal(listSavedBookings().length, 0);
});

test('BookingPortalView scrubs URL fragments, avoids silent localStorage writes, blocks third-party assets, and allows rotation & revocation', async (t) => {
  const dom = resetBrowserState('http://localhost/reservation');
  t.after(() => cleanup());

  // Simuler une feuille Google Fonts déjà injectée lors d'une navigation précédente.
  const strayFont = dom.window.document.createElement('link');
  strayFont.rel = 'stylesheet';
  strayFont.href = 'https://fonts.googleapis.com/css2?family=Inter';
  dom.window.document.head.appendChild(strayFont);

  let currentToken = 'aaaaaaaa-1111-4111-8111-111111111111';
  const rotatedToken = 'bbbbbbbb-2222-4222-8222-222222222222';
  let rotated = false;
  let revoked = false;

  const api: BookingPortalApi = {
    getBookingPortal: async (tok) => {
      assert.equal(tok, currentToken);
      return makePortalPayload(tok, {
        booking: {
          ...makePortalPayload(tok).booking,
          tokenRotatedAt: rotated ? new Date().toISOString() : null,
        },
      });
    },
    cancelMarketplaceBooking: async (_salonId, _id, tok) => makePortalPayload(tok).booking,
    submitBookingReview: async () => {
      throw new Error('unused');
    },
    rotateBookingToken: async (tok) => {
      assert.equal(tok, currentToken);
      rotated = true;
      currentToken = rotatedToken;
      return {
        appointmentId: 'apt-1111-2222-3333',
        token: rotatedToken,
        rotatedAt: new Date().toISOString(),
      };
    },
    revokeBookingToken: async (tok) => {
      assert.equal(tok, currentToken);
      revoked = true;
      return { appointmentId: 'apt-1111-2222-3333', revoked: true, revokedAt: new Date().toISOString() };
    },
  };

  render(
    React.createElement(
      AppProvider,
      null,
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/reservation#${currentToken}`] },
        React.createElement(LocationProbe),
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/reservation',
            element: React.createElement(BookingPortalView, { api }),
          }),
          React.createElement(Route, {
            path: '/reservation/:token',
            element: React.createElement(BookingPortalView, { api }),
          }),
        ),
      ),
    ),
  );

  await screen.findByText('Atelier Abidjan');

  // 1. L'URL a été nettoyée (/reservation sans #token) et stockée uniquement en sessionStorage.
  await waitFor(() => {
    assert.equal(screen.getByTestId('location-probe').textContent, '/reservation');
  });
  assert.equal(getActiveBookingToken(), 'aaaaaaaa-1111-4111-8111-111111111111');
  assert.equal(
    listSavedBookings().length,
    0,
    'opening the portal must not silently persist token to localStorage',
  );

  // 2. Politique de référent stricte, noindex et zéro ressource tierce chargée.
  const referrer = dom.window.document.head.querySelector('meta[name="referrer"]') as HTMLMetaElement;
  const robots = dom.window.document.head.querySelector('meta[name="robots"]') as HTMLMetaElement;
  assert.equal(referrer?.content, 'no-referrer');
  assert.equal(robots?.content, 'noindex, nofollow, noarchive');
  assert.equal(dom.window.document.head.querySelectorAll('link[href*="fonts.googleapis"]').length, 0);
  assert.equal(dom.window.document.querySelectorAll('img, iframe').length, 0);

  const waLink = screen.getByRole('link', { name: /Contacter le salon/i }) as HTMLAnchorElement;
  assert.equal(waLink.getAttribute('referrerpolicy') || waLink.referrerPolicy, 'no-referrer');
  assert.match(waLink.rel, /noopener/);
  assert.ok(!waLink.href.includes(currentToken), 'WhatsApp URL must never carry the booking secret token');

  // 3. Explication claire du modèle secret.
  assert.ok(screen.getByText(/Toute personne possédant ce lien peut consulter/i));

  // 4. Mémorisation explicite puis renouvellement du jeton secret.
  fireEvent.click(screen.getByRole('button', { name: /Mémoriser sur cet appareil/i }));
  assert.equal(listSavedBookings().length, 1);
  assert.equal(listSavedBookings()[0].token, 'aaaaaaaa-1111-4111-8111-111111111111');

  fireEvent.click(screen.getByRole('button', { name: /Renouveler le lien secret/i }));
  fireEvent.click(screen.getByRole('button', { name: /Confirmer le renouvellement/i }));

  await screen.findByText(/Nouveau lien secret actif/i);
  assert.equal(rotated, true);
  assert.equal(getActiveBookingToken(), rotatedToken);
  assert.equal(listSavedBookings()[0].token, rotatedToken);

  // 5. Révocation définitive du lien secret.
  const revokeBtn = await screen.findByRole('button', { name: /Révoquer définitivement le lien/i });
  fireEvent.click(revokeBtn);
  fireEvent.click(screen.getByRole('button', { name: /Confirmer la révocation/i }));

  await screen.findByRole('heading', { name: /Lien secret révoqué/i });
  assert.equal(revoked, true);
  assert.equal(getActiveBookingToken(), '');
  assert.equal(listSavedBookings().length, 0);
});

test('BookingPortalView also rescues and scrubs legacy /reservation/:token paths', async (t) => {
  resetBrowserState('http://localhost/reservation');
  t.after(() => cleanup());

  const legacyToken = 'cccccccc-3333-4333-8333-333333333333';
  const api: BookingPortalApi = {
    getBookingPortal: async (tok) => makePortalPayload(tok),
    cancelMarketplaceBooking: async (_salonId, _id, tok) => makePortalPayload(tok).booking,
    submitBookingReview: async () => {
      throw new Error('unused');
    },
    rotateBookingToken: async () => {
      throw new Error('unused');
    },
    revokeBookingToken: async () => {
      throw new Error('unused');
    },
  };

  render(
    React.createElement(
      AppProvider,
      null,
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/reservation/${legacyToken}`] },
        React.createElement(LocationProbe),
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/reservation',
            element: React.createElement(BookingPortalView, { api }),
          }),
          React.createElement(Route, {
            path: '/reservation/:token',
            element: React.createElement(BookingPortalView, { api }),
          }),
        ),
      ),
    ),
  );

  await screen.findByText('Atelier Abidjan');
  await waitFor(() => {
    assert.equal(screen.getByTestId('location-probe').textContent, '/reservation');
  });
  assert.equal(getActiveBookingToken(), legacyToken);
  assert.equal(listSavedBookings().length, 0);
});

test('SalonDetailModal never exposes the token in DOM href or saves to localStorage without consent', async (t) => {
  resetBrowserState('http://localhost/');
  t.after(() => cleanup());

  const secretToken = 'dddddddd-4444-4444-8444-444444444444';
  const futureStarts = new Date(Date.now() + 86400000).toISOString();
  const detail: PublicSalonDetail = {
    salon: {
      id: 'salon-1',
      name: 'Atelier Abidjan',
      slug: 'atelier-abidjan',
      tagline: 'Premium',
      description: 'Test',
      type: 'barbershop',
      commune: 'Cocody',
      address: 'Rue des Jardins',
      phone: '0700000001',
      whatsapp: '0700000001',
      rating: 5,
      reviewCount: 1,
      minPrice: 4000,
    },
    services: [
      {
        id: 'srv-1',
        salonId: 'salon-1',
        name: 'Coupe Classique',
        category: 'coupe',
        price: 4000,
        durationMinutes: 30,
        description: '',
        isActive: true,
      },
    ],
    staff: [{ id: 'stf-1', name: 'Kouassi', role: 'barber', specialties: [] }],
    branches: [],
    reviews: [],
    rating: 5,
    reviewCount: 1,
    minPrice: 4000,
  };
  const slots = [{ staffId: 'stf-1', startsAt: futureStarts, time: '10:00', available: true }];
  const createdBooking: PublicBooking = {
    id: 'apt-modal-1',
    salonId: 'salon-1',
    status: 'pending',
    paymentStatus: 'unpaid',
    clientName: 'Awa',
    serviceName: 'Coupe Classique',
    staffName: 'Kouassi',
    startsAt: futureStarts,
    endsAt: futureStarts,
    amount: 4000,
    currency: 'XOF',
    source: 'marketplace',
    cancelToken: secretToken,
  };

  render(
    React.createElement(
      AppProvider,
      null,
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(SalonDetailModal, {
          salon: detail.salon,
          onClose: () => {},
          initialDetail: detail,
          initialSlots: slots,
          onBookAppointment: async () => ({ success: true, booking: createdBooking }),
          onCancelBooking: async () => ({ success: true, booking: createdBooking }),
        }),
      ),
    ),
  );

  fireEvent.click(screen.getByRole('button', { name: '10:00' }));
  fireEvent.change(screen.getByPlaceholderText(/Nom & prénom/i), { target: { value: 'Awa' } });
  fireEvent.change(screen.getByPlaceholderText(/Téléphone \/ WhatsApp/i), {
    target: { value: '0700000010' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Confirmer la réservation/i }));

  await screen.findByText(/Ma réservation — lien d’accès secret/i);

  assert.equal(getActiveBookingToken(), secretToken);
  assert.equal(listSavedBookings().length, 0, 'booking must not auto-save to localStorage without opt-in');

  const followLink = screen.getByRole('link', { name: /Suivre ma réservation/i }) as HTMLAnchorElement;
  assert.equal(followLink.getAttribute('href'), '/reservation');
  assert.ok(!followLink.getAttribute('href')?.includes(secretToken));

  const checkbox = screen.getByRole('checkbox');
  fireEvent.click(checkbox);
  assert.equal(listSavedBookings().length, 1);
  assert.equal(listSavedBookings()[0].token, secretToken);

  fireEvent.click(checkbox);
  assert.equal(listSavedBookings().length, 0);
});

test('MyBookingsView hides tokens from link hrefs, warns about shared devices, and clears all secrets', async (t) => {
  resetBrowserState('http://localhost/mes-reservations');
  t.after(() => cleanup());

  const tok = 'eeeeeeee-5555-4555-8555-555555555555';
  saveBookingLink({
    token: tok,
    appointmentId: 'apt-saved-1',
    salonId: 'salon-1',
    salonName: 'Atelier Abidjan',
    serviceName: 'Coupe',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
  });
  setActiveBookingToken(tok);

  render(
    React.createElement(
      AppProvider,
      null,
      React.createElement(MemoryRouter, null, React.createElement(MyBookingsView)),
    ),
  );

  await screen.findByText('Atelier Abidjan');
  const followLink = screen.getByRole('link', { name: /Suivre/i }) as HTMLAnchorElement;
  assert.equal(followLink.getAttribute('href'), '/reservation');
  assert.ok(!followLink.getAttribute('href')?.includes(tok));
  assert.ok(screen.getByText(/toute personne utilisant ce navigateur/i));

  fireEvent.click(screen.getByRole('button', { name: /Tout effacer de cet appareil/i }));
  assert.equal(listSavedBookings().length, 0);
  assert.equal(getActiveBookingToken(), '');
  clearActiveBookingToken();
});

test('BookingPortalView redacts leaked tokens in errors and handles missing tokens safely', async (t) => {
  resetBrowserState('http://localhost/reservation');
  t.after(() => cleanup());

  const leakedToken = 'ffffffff-6666-4666-8666-666666666666';
  const api: BookingPortalApi = {
    getBookingPortal: async () => {
      throw new Error(`Échec sur /reservation#${leakedToken} (${leakedToken})`);
    },
    cancelMarketplaceBooking: async () => {
      throw new Error('unused');
    },
    submitBookingReview: async () => {
      throw new Error('unused');
    },
    rotateBookingToken: async () => {
      throw new Error('unused');
    },
    revokeBookingToken: async () => {
      throw new Error('unused');
    },
  };

  render(
    React.createElement(
      AppProvider,
      null,
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/reservation#${leakedToken}`] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/reservation',
            element: React.createElement(BookingPortalView, { api }),
          }),
        ),
      ),
    ),
  );

  await screen.findByRole('heading', { name: /Réservation introuvable/i });
  assert.ok(!document.body.textContent?.includes(leakedToken), 'UI error must never echo the raw token');
  cleanup();

  clearActiveBookingToken();
  render(
    React.createElement(
      AppProvider,
      null,
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/reservation'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/reservation',
            element: React.createElement(BookingPortalView, { api }),
          }),
        ),
      ),
    ),
  );
  await screen.findByRole('heading', { name: /Réservation introuvable/i });
});
