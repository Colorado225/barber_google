import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import {
  AppProvider,
  useAppointmentsDomain,
  useClientsDomain,
  useFinanceDomain,
  useMarketplaceDomain,
  useNotificationsDomain,
  useOptionalApp,
  useUI,
} from '../src/context/AppContext';
import { AuthContext, type AuthContextType, type SalonMembership } from '../src/context/AuthContext';
import { createDomainCache } from '../src/lib/domainCache';
import { isSlowOrConstrainedNetwork } from '../src/lib/networkHints';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { ErpLayout } from '../src/components/erp/ErpLayout';

function setupMobileDom(url = 'http://localhost/') {
  const existing = (globalThis as { __p2Dom?: JSDOM }).__p2Dom;
  if (existing) {
    existing.reconfigure({ url });
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url });
  Object.assign(globalThis, {
    __p2Dom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(dom.window, 'innerWidth', { value: 375, configurable: true });
  Object.defineProperty(dom.window, 'innerHeight', { value: 812, configurable: true });
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
  return dom;
}

async function loadRtl(url = 'http://localhost/') {
  const dom = setupMobileDom(url);
  const rtl = await import('@testing-library/react');
  return { dom, ...rtl };
}

test('DomainCache met en cache par domaine, déduplique les requêtes concurrentes et invalide de façon ciblée', async () => {
  const cache = createDomainCache();
  let calls = 0;

  let resolveFirst!: (value: string[]) => void;
  const firstPromise = new Promise<string[]>((resolve) => {
    resolveFirst = resolve;
  });

  const fetcher = () => {
    calls += 1;
    return firstPromise;
  };

  // Deux appels concurrents pour le même (salon, domain) ne déclenchent qu'une seule requête serveur.
  const p1 = cache.getOrLoad('salon-1', 'appointments', fetcher, { ttlMs: 10_000, now: 1000 });
  const p2 = cache.getOrLoad('salon-1', 'appointments', fetcher, { ttlMs: 10_000, now: 1000 });
  resolveFirst(['rdv-1']);

  assert.deepEqual(await p1, ['rdv-1']);
  assert.deepEqual(await p2, ['rdv-1']);
  assert.equal(calls, 1);

  // Hit cache dans la fenêtre TTL.
  const cached = await cache.getOrLoad(
    'salon-1',
    'appointments',
    async () => {
      calls += 1;
      return ['rdv-2'];
    },
    { ttlMs: 10_000, now: 5000 },
  );
  assert.deepEqual(cached, ['rdv-1']);
  assert.equal(calls, 1);

  // Expiration du TTL ou invalidation ciblée déclenche un nouveau fetch.
  cache.invalidate('salon-1', 'appointments');
  const reloaded = await cache.getOrLoad(
    'salon-1',
    'appointments',
    async () => {
      calls += 1;
      return ['rdv-3'];
    },
    { ttlMs: 10_000, now: 6000 },
  );
  assert.deepEqual(reloaded, ['rdv-3']);
  assert.equal(calls, 2);

  const stats = cache.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.coalesced, 1);
  assert.equal(stats.misses, 2);
  assert.equal(stats.invalidations, 1);

  // Isolation par salon : invalider salon-2 n'efface pas salon-1.
  await cache.getOrLoad('salon-2', 'finance', async () => ({ ok: true }), { ttlMs: 10_000, now: 6000 });
  cache.invalidateSalon('salon-2');
  assert.deepEqual(cache.peek('salon-1', 'appointments', undefined, 7000), ['rdv-3']);
  assert.equal(cache.peek('salon-2', 'finance', undefined, 7000), undefined);
});

test('AppProvider expose les hooks de domaines découpés (RDV, finance, clients, notifications, marketplace, UI)', async (t) => {
  const { render, screen, cleanup } = await loadRtl('http://localhost/');
  t.after(() => cleanup());

  const Probe: React.FC = () => {
    const app = useOptionalApp();
    const appointments = useAppointmentsDomain();
    const finance = useFinanceDomain();
    const clients = useClientsDomain();
    const notifications = useNotificationsDomain();
    const marketplace = useMarketplaceDomain();
    const ui = useUI();

    return (
      <div data-testid="domains-probe">
        {[
          app.mode,
          ui.formatPrice(2500),
          String(Array.isArray(appointments.appointments)),
          String(Array.isArray(finance.transactions)),
          String(Array.isArray(clients.clients)),
          String(Array.isArray(notifications.notifications)),
          String(Array.isArray(marketplace.salons)),
          typeof appointments.bookAppointment,
          typeof finance.recordPayment,
          typeof clients.addClient,
          typeof notifications.dispatchNotifications,
        ].join('|')}
      </div>
    );
  };

  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );

  const text = screen.getByTestId('domains-probe').textContent ?? '';
  assert.match(
    text,
    /^marketplace\|2[\s\u00a0\u202f]500 FCFA\|true\|true\|true\|true\|true\|function\|function\|function\|function$/,
  );
});

test('MarketplaceHome sur téléphone (375px) et réseau lent/Save-Data diffère la vidéo hero tout en restant interactif', async (t) => {
  const { dom, render, screen, cleanup } = await loadRtl('http://localhost/');
  t.after(() => {
    delete (dom.window.navigator as { connection?: unknown }).connection;
    cleanup();
  });

  assert.equal(isSlowOrConstrainedNetwork({ saveData: true, effectiveType: '4g' }), true);
  assert.equal(isSlowOrConstrainedNetwork({ saveData: false, effectiveType: 'slow-2g' }), true);
  assert.equal(isSlowOrConstrainedNetwork({ saveData: false, effectiveType: '2g' }), true);
  assert.equal(isSlowOrConstrainedNetwork({ saveData: false, effectiveType: '4g' }), false);

  Object.defineProperty(dom.window.navigator, 'connection', {
    value: { saveData: true, effectiveType: '2g' },
    configurable: true,
  });

  const { container } = render(
    <AppProvider>
      <MarketplaceHome />
    </AppProvider>,
  );

  assert.equal(
    container.querySelector('video'),
    null,
    'La vidéo de fond 455 kB ne doit pas être téléchargée sur réseau 2G / Save-Data',
  );
  assert.ok(screen.getByPlaceholderText(/salon/i));
});

test('ErpLayout avec vues lazy() + Suspense résout et affiche correctement le tableau de bord', async (t) => {
  const { render, screen, waitFor, cleanup } = await loadRtl('http://localhost/app');
  t.after(() => cleanup());

  const membership: SalonMembership = {
    id: 'mem-p2',
    salonId: 'salon-p2',
    salonName: 'Salon Mobile Perf',
    organizationId: 'org-p2',
    organizationName: 'Org P2',
    branchId: 'branch-p2',
    branchName: 'Plateau',
    role: 'owner',
    status: 'active',
    permissions: ['dashboard.read', 'appointments.read', 'appointments.write'],
  };

  const authValue: AuthContextType = {
    user: { id: 'user-p2', name: 'Owner', email: 'owner@p2.test', emailVerified: true },
    memberships: [membership],
    activeMembership: membership,
    activeSalonId: 'salon-p2',
    onboarding: {
      currentStep: 'completed',
      emailVerified: true,
      salonCreated: true,
      setupCompleted: true,
    },
    loading: false,
    error: null,
    signIn: async () => {},
    signUp: async () => ({ status: 'authenticated' }),
    signOut: async () => {},
    refreshSession: async () => {},
    selectSalon: () => true,
    verifyEmail: async () => {},
    resendVerification: async () => {},
    requestPasswordReset: async () => {},
    resetPassword: async () => {},
    createSalon: async () => 'salon-p2',
    completeOnboarding: async () => {},
    isAuthenticated: true,
    hasWorkspace: true,
    hasPermission: () => true,
  };

  const fakeApiFactory = () =>
    ({
      workspace: async () => ({
        salon: {
          id: 'salon-p2',
          name: 'Salon Mobile Perf',
          city: 'Abidjan',
          commune: 'Plateau',
          status: 'active',
          is_published: true,
        },
        branches: [{ id: 'branch-p2', name: 'Plateau' }],
        services: [],
        staff: [],
        clients: [],
        expenses: [],
        stock: [],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: {
        program: async () => null,
        accounts: async () => [],
        ledger: async () => [],
      },
      notifications: {
        list: async () => [],
        health: async () => null,
      },
    }) as any;

  render(
    <AuthContext.Provider value={authValue}>
      <AppProvider apiClientFactory={fakeApiFactory}>
        <MemoryRouter initialEntries={['/app']}>
          <ErpLayout />
        </MemoryRouter>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(screen.getAllByText('Salon Mobile Perf').length >= 1);
  });
});
