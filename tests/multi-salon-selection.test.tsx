import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { useMemo, useState } from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType, type SalonMembership } from '../src/context/AuthContext';
import { AppProvider, type SalonApiClient } from '../src/context/AppContext';
import { ErpLayout } from '../src/components/erp/ErpLayout';
import {
  buildErpUrl,
  getActiveMemberships,
  persistSelectedSalonId,
  readErpSalonFromSearch,
  readStoredSalonId,
  resolveSelectedMembership,
  upsertWorkspaceSalon,
} from '../src/lib/erpSalonSelection';
import { getRolePermissions } from '../src/lib/permissions';
import type { RealtimeChannelLike, RealtimeClientLike } from '../src/lib/realtimeSync';
import type {
  Appointment,
  AppointmentNotification,
  CashSession,
  PaymentTransaction,
  Salon,
} from '../src/types';

function ensureDom(initialUrl = 'http://localhost/app/tableau-de-bord') {
  const existing = (globalThis as { __multiSalonDom?: JSDOM }).__multiSalonDom;
  if (existing) {
    existing.reconfigure({ url: initialUrl });
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: initialUrl,
  });
  Object.assign(globalThis, {
    __multiSalonDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

function makeMembership(
  salonId: string,
  salonName: string,
  role: string,
  status = 'active',
): SalonMembership {
  return {
    id: `mem-${salonId}`,
    salonId,
    salonName,
    organizationId: `org-${salonId}`,
    organizationName: `Groupe ${salonName}`,
    branchId: `branch-${salonId}`,
    branchName: 'Principal',
    role,
    status,
    permissions: getRolePermissions(role),
  };
}

function createMockRealtimeClient() {
  const channels: Array<{
    topic: string;
    bindings: Array<{ table: string; filter?: string }>;
  }> = [];
  const removedTopics: string[] = [];

  const client: RealtimeClientLike = {
    channel(topic) {
      const record = { topic, bindings: [] as Array<{ table: string; filter?: string }> };
      channels.push(record);
      const ch: RealtimeChannelLike = {
        on(_type, filter, _cb) {
          record.bindings.push({ table: filter.table, filter: filter.filter });
          return ch;
        },
        subscribe(cb) {
          cb?.('SUBSCRIBED');
          return ch;
        },
      };
      return ch;
    },
    async removeChannel(channel) {
      const found = channels.find((c) => channel && typeof channel === 'object');
      if (found) removedTopics.push(found.topic);
    },
  };

  return { client, channels, removedTopics };
}

function makeStubApiFactory(fixtures: {
  [salonId: string]: {
    salonRow: Record<string, unknown>;
    appointments: Appointment[];
    notifications: AppointmentNotification[];
    payments: PaymentTransaction[];
    cashSessions: CashSession[];
  };
}): (salonId: string) => SalonApiClient {
  return (salonId: string) => {
    const f = fixtures[salonId];
    if (!f) throw new Error(`Salon inconnu dans le stub API: ${salonId}`);
    return {
      async workspace() {
        return {
          salon: f.salonRow,
          branches: [{ id: `branch-${salonId}`, name: 'Principal' }],
          clients: [],
          services: [],
          staff: [],
          expenses: [],
          stock: [],
          rewards: [],
          reviews: [],
        };
      },
      appointments: {
        async list() {
          return f.appointments;
        },
      },
      payments: {
        async list() {
          return f.payments;
        },
      },
      cash: {
        async sessions() {
          return f.cashSessions;
        },
      },
      reports: {
        async summary() {
          return {
            periodFrom: '2026-11-01',
            periodTo: '2026-11-10',
            totalRevenue: 0,
            totalCollected: 0,
            totalRefunded: 0,
            pendingMobileMoney: 0,
            cashCollected: 0,
            mobileMoneyCollected: 0,
            cardCollected: 0,
            completedAppointments: f.appointments.length,
            cancelledAppointments: 0,
            noShowAppointments: 0,
          };
        },
      },
      loyalty: {
        async program() {
          return {
            salonId,
            pointsPer100Fcfa: 1,
            welcomeBonus: 0,
            silverThreshold: 100,
            goldThreshold: 250,
            vipThreshold: 500,
            programEnabled: false,
          };
        },
        async accounts() {
          return [];
        },
        async ledger() {
          return [];
        },
      },
      notifications: {
        async list() {
          return f.notifications;
        },
      },
    } as unknown as SalonApiClient;
  };
}

const ControlledAuthHarness: React.FC<{
  memberships: SalonMembership[];
  children: React.ReactNode;
}> = ({ memberships, children }) => {
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(() => {
    const urlId = readErpSalonFromSearch(window.location.search);
    return resolveSelectedMembership(memberships, { urlSalonId: urlId })?.salonId ?? null;
  });

  const activeMemberships = useMemo(() => getActiveMemberships(memberships), [memberships]);
  const activeMembership = useMemo(
    () =>
      resolveSelectedMembership(memberships, {
        requestedSalonId: selectedSalonId,
        urlSalonId: readErpSalonFromSearch(window.location.search),
      }),
    [memberships, selectedSalonId],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user: { id: 'user-1', name: 'Koffi Multi', email: 'koffi@example.test', emailVerified: true },
      memberships,
      activeMembership,
      activeSalonId: activeMembership?.salonId ?? null,
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
      selectSalon: (salonId: string) => {
        const match = activeMemberships.find((m) => m.salonId === salonId);
        if (!match) return false;
        setSelectedSalonId(match.salonId);
        return true;
      },
      verifyEmail: async () => {},
      resendVerification: async () => {},
      requestPasswordReset: async () => {},
      resetPassword: async () => {},
      createSalon: async () => '',
      completeOnboarding: async () => {},
      isAuthenticated: true,
      hasWorkspace: activeMemberships.length > 0,
      hasPermission: (permission: string, salonId?: string) => {
        const target = salonId ?? activeMembership?.salonId;
        if (!target) return false;
        return activeMemberships.some((m) => m.salonId === target && m.permissions.includes(permission));
      },
    }),
    [memberships, activeMemberships, activeMembership],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

async function flushEffects() {
  await new Promise((r) => setTimeout(r, 25));
}

test('resolveSelectedMembership respecte les priorités, filtre les salons non autorisés/suspendus et isole le stockage par utilisateur', () => {
  const mA = makeMembership('salon-a', 'Atelier Alpha', 'owner', 'active');
  const mB = makeMembership('salon-b', 'Salon Bêta', 'barber', 'active');
  const mSuspended = makeMembership('salon-c', 'Salon Suspendu', 'owner', 'suspended');
  const list = [mSuspended, mA, mB];

  // Priorité : requestedSalonId > urlSalonId > storedSalonId > 1er actif (jamais un suspendu)
  assert.equal(
    resolveSelectedMembership(list, {
      requestedSalonId: 'salon-b',
      urlSalonId: 'salon-a',
      storedSalonId: 'salon-a',
    })?.salonId,
    'salon-b',
  );
  assert.equal(
    resolveSelectedMembership(list, {
      requestedSalonId: null,
      urlSalonId: 'salon-b',
      storedSalonId: 'salon-a',
    })?.salonId,
    'salon-b',
  );
  assert.equal(
    resolveSelectedMembership(list, {
      requestedSalonId: 'salon-intrus',
      urlSalonId: 'salon-c', // suspendu -> ignoré
      storedSalonId: 'salon-b',
    })?.salonId,
    'salon-b',
  );
  assert.equal(resolveSelectedMembership(list)?.salonId, 'salon-a');

  // Stockage scopé par userId
  const map = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
  persistSelectedSalonId('user-1', 'salon-b', mockStorage);
  persistSelectedSalonId('user-2', 'salon-a', mockStorage);
  assert.equal(readStoredSalonId('user-1', mockStorage), 'salon-b');
  assert.equal(readStoredSalonId('user-2', mockStorage), 'salon-a');

  // URL builders & workspace salons merge
  assert.equal(buildErpUrl('caisse', 'salon-b', true), '/app/caisse?salon=salon-b');
  assert.equal(buildErpUrl('caisse', 'salon-b', false), '/app/caisse');
  assert.equal(readErpSalonFromSearch('?salon=salon-b&foo=1'), 'salon-b');

  const merged1 = upsertWorkspaceSalon([], { id: 'salon-a', name: 'Atelier Alpha' } as Salon, [mA, mB]);
  const merged2 = upsertWorkspaceSalon(merged1, { id: 'salon-b', name: 'Salon Bêta' } as Salon, [mA, mB]);
  assert.deepEqual(
    merged2.map((s) => s.id),
    ['salon-a', 'salon-b'],
  );
});

test('changement réel multi-salons dans ErpLayout : recharge les données, recalcule les permissions, réabonne Realtime et maintient l’URL cohérente', async (t) => {
  const dom = ensureDom('http://localhost/app/abonnement');
  const { render, fireEvent, screen, cleanup, waitFor } = await import('@testing-library/react');
  const { act } = await import('react');
  t.after(() => cleanup());

  const mA = makeMembership('salon-a', 'Atelier Plateau', 'owner');
  const mB = makeMembership('salon-b', 'Studio Cocody', 'barber');
  const mockRt = createMockRealtimeClient();

  const apiFactory = makeStubApiFactory({
    'salon-a': {
      salonRow: { id: 'salon-a', name: 'Atelier Plateau', commune: 'Plateau', city: 'Abidjan' },
      appointments: [
        {
          id: 'apt-a1',
          salonId: 'salon-a',
          branchId: 'branch-salon-a',
          clientId: null,
          clientName: 'Client Alpha',
          clientPhone: '0102030405',
          serviceId: 'srv-a1',
          serviceName: 'Coupe Alpha',
          price: 5000,
          staffId: null,
          staffName: '',
          date: '2026-11-10',
          time: '10:00',
          durationMinutes: 30,
          status: 'pending',
          paymentStatus: 'unpaid',
          source: 'marketplace',
          notes: '',
          createdAt: '2026-11-10T08:00:00Z',
        },
      ],
      notifications: [],
      payments: [],
      cashSessions: [
        {
          id: 'cs-a',
          salonId: 'salon-a',
          branchId: 'branch-salon-a',
          registerId: 'reg-a',
          openedAt: '2026-11-10T08:00:00Z',
          openingBalance: 10000,
          theoreticalBalance: 25000,
          totalCashIn: 15000,
          totalMobileMoneyIn: 0,
          totalCashOut: 0,
          totalMobileMoneyOut: 0,
          totalOut: 0,
          status: 'open',
        },
      ],
    },
    'salon-b': {
      salonRow: { id: 'salon-b', name: 'Studio Cocody', commune: 'Cocody', city: 'Abidjan' },
      appointments: [],
      notifications: [],
      payments: [],
      cashSessions: [],
    },
  });

  render(
    <ControlledAuthHarness memberships={[mA, mB]}>
      <AppProvider realtimeClient={mockRt.client} apiClientFactory={apiFactory}>
        <MemoryRouter initialEntries={['/app/abonnement']}>
          <ErpLayout />
        </MemoryRouter>
      </AppProvider>
    </ControlledAuthHarness>,
  );

  await waitFor(() => {
    assert.ok(screen.getByTestId('erp-salon-switcher'));
  });
  await act(async () => {
    await flushEffects();
  });

  // 1. Salon A (owner) : tous les onglets owner sont visibles + URL cohérente ?salon=salon-a
  assert.ok(screen.getAllByText('Abonnement SaaS').length >= 1);
  assert.ok(screen.getByRole('button', { name: /Caisse & Encaissements/i }));
  assert.match(screen.getByTestId('erp-salon-switcher').textContent ?? '', /Atelier Plateau/);
  assert.equal(dom.window.location.pathname + dom.window.location.search, '/app/abonnement?salon=salon-a');
  assert.equal(mockRt.channels[0]?.topic, 'erp-salon-salon-a');
  assert.deepEqual(
    mockRt.channels[0]?.bindings.map((b) => b.table),
    ['appointments', 'appointment_notifications', 'payments', 'cash_sessions'],
  );

  // 2. Ouvre le sélecteur d'établissements et bascule vers Studio Cocody (barber)
  fireEvent.click(screen.getByTestId('erp-salon-switcher'));
  const optionB = screen.getByRole('option', { name: /Studio Cocody/i });
  await act(async () => {
    fireEvent.click(optionB);
    await flushEffects();
  });

  await waitFor(() => {
    assert.match(screen.getByTestId('erp-salon-switcher').textContent ?? '', /Studio Cocody/);
    assert.equal(
      dom.window.location.pathname + dom.window.location.search,
      '/app/tableau-de-bord?salon=salon-b',
    );
  });

  // 3. Permissions recalculées : Abonnement SaaS & Caisse sont masqués pour le barbier de Salon B
  assert.equal(screen.queryByRole('button', { name: /Abonnement SaaS/i }), null);
  assert.equal(screen.queryByRole('button', { name: /Caisse & Encaissements/i }), null);

  // 4. Realtime réabonné sur salon-b sans les flux finance/caisse
  const lastChannel = mockRt.channels[mockRt.channels.length - 1];
  assert.equal(lastChannel?.topic, 'erp-salon-salon-b');
  assert.deepEqual(
    lastChannel?.bindings.map((b) => b.table),
    ['appointments', 'appointment_notifications'],
  );

  // 5. Aucune fuite de la session de caisse de Salon A sur Salon B
  assert.equal(screen.queryByText(/25\s?000\s?FCFA/), null);

  // 6. Navigation Précédent (popstate) revient bien sur salon-a et rétablit ses permissions
  await act(async () => {
    dom.reconfigure({ url: 'http://localhost/app/abonnement?salon=salon-a' });
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    await flushEffects();
  });

  await waitFor(() => {
    assert.match(screen.getByTestId('erp-salon-switcher').textContent ?? '', /Atelier Plateau/);
    assert.ok(screen.getByRole('button', { name: /Caisse & Encaissements/i }));
  });
});

test('lien direct ?salon= et rejet d’un ?salon= non autorisé + affichage mono-salon sans faux sélecteur', async (t) => {
  const dom = ensureDom('http://localhost/app/planning?salon=salon-b');
  const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
  const { act } = await import('react');
  t.after(() => cleanup());

  const mA = makeMembership('salon-a', 'Atelier Plateau', 'owner');
  const mB = makeMembership('salon-b', 'Studio Cocody', 'owner');

  const apiFactory = makeStubApiFactory({
    'salon-a': {
      salonRow: { id: 'salon-a', name: 'Atelier Plateau', commune: 'Plateau' },
      appointments: [],
      notifications: [],
      payments: [],
      cashSessions: [],
    },
    'salon-b': {
      salonRow: { id: 'salon-b', name: 'Studio Cocody', commune: 'Cocody' },
      appointments: [],
      notifications: [],
      payments: [],
      cashSessions: [],
    },
  });

  // 1. Deep-link vers salon-b -> ouvre directement Studio Cocody (pas memberships[0])
  render(
    <ControlledAuthHarness memberships={[mA, mB]}>
      <AppProvider realtimeClient={createMockRealtimeClient().client} apiClientFactory={apiFactory}>
        <MemoryRouter initialEntries={['/app/planning?salon=salon-b']}>
          <ErpLayout />
        </MemoryRouter>
      </AppProvider>
    </ControlledAuthHarness>,
  );

  await waitFor(() => {
    assert.ok(screen.getByTestId('erp-salon-switcher'));
    assert.match(screen.getByTestId('erp-salon-switcher').textContent ?? '', /Studio Cocody/);
  });
  assert.equal(dom.window.location.pathname + dom.window.location.search, '/app/planning?salon=salon-b');
  cleanup();

  // 2. Compte mono-salon + ?salon=intrus dans l'URL -> rejette l'intrus, corrige l'URL et masque le faux menu multi-tenants
  dom.reconfigure({ url: 'http://localhost/app/planning?salon=intrus-999' });
  render(
    <ControlledAuthHarness memberships={[mA]}>
      <AppProvider realtimeClient={createMockRealtimeClient().client} apiClientFactory={apiFactory}>
        <MemoryRouter initialEntries={['/app/planning?salon=intrus-999']}>
          <ErpLayout />
        </MemoryRouter>
      </AppProvider>
    </ControlledAuthHarness>,
  );

  await waitFor(() => {
    assert.ok(screen.getByTestId('erp-salon-single'));
  });
  await act(async () => {
    await flushEffects();
  });
  assert.match(screen.getByTestId('erp-salon-single').textContent ?? '', /Atelier Plateau/);
  assert.equal(screen.queryByTestId('erp-salon-switcher'), null);
  assert.equal(dom.window.location.pathname + dom.window.location.search, '/app/planning?salon=salon-a');
});

test('erreur de chargement sur le 2e salon sélectionné : Réessayer recharge le salon sélectionné (pas memberships[0])', async (t) => {
  const dom = ensureDom('http://localhost/app/caisse?salon=salon-b');
  const { render, fireEvent, screen, cleanup, waitFor } = await import('@testing-library/react');
  const { act } = await import('react');
  t.after(() => cleanup());

  const mA = makeMembership('salon-a', 'Atelier Plateau', 'owner');
  const mB = makeMembership('salon-b', 'Studio Cocody', 'owner');
  const loadedIds: string[] = [];
  let failSalonBOnce = true;

  const baseFactory = makeStubApiFactory({
    'salon-a': {
      salonRow: { id: 'salon-a', name: 'Atelier Plateau', commune: 'Plateau' },
      appointments: [],
      notifications: [],
      payments: [],
      cashSessions: [],
    },
    'salon-b': {
      salonRow: { id: 'salon-b', name: 'Studio Cocody', commune: 'Cocody' },
      appointments: [],
      notifications: [],
      payments: [],
      cashSessions: [],
    },
  });

  const flakyFactory = (salonId: string): SalonApiClient => {
    const inner = baseFactory(salonId);
    return {
      ...inner,
      async workspace() {
        loadedIds.push(salonId);
        if (salonId === 'salon-b' && failSalonBOnce) {
          failSalonBOnce = false;
          throw new Error('Réseau indisponible');
        }
        return inner.workspace();
      },
    };
  };

  render(
    <ControlledAuthHarness memberships={[mA, mB]}>
      <AppProvider realtimeClient={createMockRealtimeClient().client} apiClientFactory={flakyFactory}>
        <MemoryRouter initialEntries={['/app/caisse?salon=salon-b']}>
          <ErpLayout />
        </MemoryRouter>
      </AppProvider>
    </ControlledAuthHarness>,
  );

  await waitFor(() => {
    assert.ok(screen.getByText('Chargement de l’espace impossible'));
    assert.ok(screen.getByRole('button', { name: 'Réessayer' }));
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await flushEffects();
  });

  await waitFor(() => {
    assert.match(screen.getByTestId('erp-salon-switcher').textContent ?? '', /Studio Cocody/);
  });

  assert.deepEqual(loadedIds, ['salon-b', 'salon-b']);
  assert.equal(dom.window.location.pathname + dom.window.location.search, '/app/caisse?salon=salon-b');
});
