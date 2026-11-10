import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, useOptionalApp } from '../src/context/AppContext';
import { AuthContext, type AuthContextType, type SalonMembership } from '../src/context/AuthContext';
import { InventoryView } from '../src/components/erp/InventoryView';
import { FinanceExpensesView } from '../src/components/erp/FinanceExpensesView';
import { SalonProfileSettingsView } from '../src/components/erp/SalonProfileSettingsView';
import { SalonDetailModal } from '../src/components/marketplace/SalonDetailModal';
import { buildRevenueSeries, expenseSignedAmount } from '../src/lib/analytics';
import {
  createExpenseAttachmentSignedUrl,
  uploadExpenseAttachment,
  uploadSalonMedia,
} from '../src/lib/storage';
import type { Expense, PublicSalonDetail, StockItem, StockMovement, Supplier } from '../src/types';

function ensureDom() {
  const existing = (globalThis as { __p2OpsDom?: JSDOM }).__p2OpsDom;
  if (existing) {
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/app',
  });
  Object.assign(globalThis, {
    __p2OpsDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    Event: dom.window.Event,
    Node: dom.window.Node,
    File: dom.window.File,
    Blob: dom.window.Blob,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

ensureDom();
const { cleanup, fireEvent, render, waitFor, within } = await import('@testing-library/react');

const ActiveSalonGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useOptionalApp();
  if (!app?.activeSalon) return <div>Chargement workspace...</div>;
  return <>{children}</>;
};

const SALON_ID = 'salon-ops-1';
const BRANCH_ID = 'branch-ops-1';

function buildAuth(permissions: string[] = ['*']): AuthContextType {
  const membership: SalonMembership = {
    id: 'mem-ops-1',
    organizationId: 'org-ops-1',
    organizationName: 'Org Ops Test',
    salonId: SALON_ID,
    salonName: 'Salon Ops Test',
    branchId: BRANCH_ID,
    branchName: 'Plateau',
    role: 'owner',
    status: 'active',
    permissions,
  };
  return {
    user: { id: 'user-ops-1', name: 'Owner Ops', email: 'owner@ops.test', emailVerified: true },
    memberships: [membership],
    activeMembership: membership,
    activeSalonId: SALON_ID,
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
    createSalon: async () => SALON_ID,
    completeOnboarding: async () => {},
    isAuthenticated: true,
    hasWorkspace: true,
    hasPermission: (perm) => permissions.includes('*') || permissions.includes(perm),
  };
}

test('analytics : expenseSignedAmount et buildRevenueSeries déduisent proprement les contrepassations', () => {
  const active: Expense = {
    id: 'e1',
    salonId: SALON_ID,
    title: 'CIE',
    category: 'electricity',
    amount: 10000,
    date: new Date().toISOString().slice(0, 10),
    entryKind: 'expense',
    status: 'reversed',
  };
  const reversal: Expense = {
    id: 'e2',
    salonId: SALON_ID,
    title: 'Contrepassation : CIE',
    category: 'electricity',
    amount: 10000,
    date: new Date().toISOString().slice(0, 10),
    entryKind: 'expense_reversal',
    originalExpenseId: 'e1',
    status: 'active',
  };
  const activeCorrected: Expense = {
    id: 'e3',
    salonId: SALON_ID,
    title: 'CIE corrigée',
    category: 'electricity',
    amount: 14500,
    date: new Date().toISOString().slice(0, 10),
    entryKind: 'expense',
    status: 'active',
  };

  assert.equal(expenseSignedAmount(active), 10000);
  assert.equal(expenseSignedAmount(reversal), -10000);
  const net = [active, reversal, activeCorrected].reduce((s, e) => s + expenseSignedAmount(e), 0);
  assert.equal(net, 14500);

  const series = buildRevenueSeries('6m', [], [], [active, reversal, activeCorrected]);
  assert.equal(series[series.length - 1].expenses, 14500);
});

test('storage helpers : validation MIME/taille, isolation tenant et chemins sécurisés Supabase Storage', async () => {
  ensureDom();

  const uploads: Array<{ bucket: string; path: string; contentType: string }> = [];
  const fakeStorageClient = {
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string, _file: Blob, opts?: { contentType?: string }) => {
            uploads.push({ bucket, path, contentType: opts?.contentType ?? '' });
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` },
          }),
          createSignedUrl: async (path: string, expiresIn: number) => ({
            data: {
              signedUrl: `https://example.supabase.co/storage/v1/object/sign/${bucket}/${path}?e=${expiresIn}`,
            },
            error: null,
          }),
        };
      },
    },
  };

  const validImg = new File(['abc'], 'Mon Logo!!.png', { type: 'image/png' });
  const mediaRes = await uploadSalonMedia(SALON_ID, 'logo', validImg, fakeStorageClient);
  assert.ok(mediaRes.path.startsWith(`${SALON_ID}/logo/`));
  assert.ok(mediaRes.publicUrl.includes('salon-media'));

  const badImg = new File(['abc'], 'script.exe', { type: 'application/x-msdownload' });
  await assert.rejects(
    () => uploadSalonMedia(SALON_ID, 'logo', badImg, fakeStorageClient),
    /Format non pris en charge/,
  );

  const validPdf = new File(['pdf-bytes'], 'Facture CIE.pdf', { type: 'application/pdf' });
  const attRes = await uploadExpenseAttachment(SALON_ID, validPdf, fakeStorageClient);
  assert.ok(attRes.path.startsWith(`${SALON_ID}/expenses/`));
  assert.equal(attRes.mime, 'application/pdf');
  assert.equal(attRes.name, 'Facture CIE.pdf');

  const signedUrl = await createExpenseAttachmentSignedUrl(SALON_ID, attRes.path, 300, fakeStorageClient);
  assert.ok(signedUrl.includes('e=300'));

  await assert.rejects(
    () => createExpenseAttachmentSignedUrl(SALON_ID, 'other-salon/expenses/leak.pdf', 300, fakeStorageClient),
    /invalide pour cet établissement/,
  );
  assert.equal(uploads.length, 2);
});

test('InventoryView : enregistre un mouvement historisé sans écrasement silencieux et gère les fournisseurs', async () => {
  ensureDom();
  cleanup();

  const stockState: StockItem[] = [
    {
      id: 'stk-1',
      salonId: SALON_ID,
      name: 'Cire Coiffante Mate',
      category: 'gel_cire',
      quantity: 10,
      minThreshold: 3,
      unitCost: 2500,
      supplierId: 'sup-1',
      supplier: 'AfroBeauté Pro',
      isActive: true,
    },
  ];
  const supplierState: Supplier[] = [
    {
      id: 'sup-1',
      salonId: SALON_ID,
      name: 'AfroBeauté Pro',
      contactName: 'Koffi',
      phone: '+22507000001',
      email: 'contact@afrobeaute.ci',
      address: 'Cocody',
      notes: '',
      isActive: true,
    },
  ];
  const movementState: StockMovement[] = [];
  const recordedMovements: unknown[] = [];
  const upsertedSuppliers: unknown[] = [];

  const fakeApiFactory = () =>
    ({
      workspace: async () => ({
        salon: { id: SALON_ID, name: 'Salon Ops', status: 'active', is_published: true },
        branches: [{ id: BRANCH_ID, name: 'Plateau' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [],
        stock: [...stockState],
        suppliers: [...supplierState],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: {
        list: async () => [...supplierState],
        upsert: async (input: { name: string }) => {
          upsertedSuppliers.push(input);
          const next: Supplier = {
            id: 'sup-2',
            salonId: SALON_ID,
            name: input.name,
            contactName: '',
            phone: '',
            email: undefined,
            address: '',
            notes: '',
            isActive: true,
          };
          supplierState.push(next);
          return next;
        },
      },
      stock: {
        list: async () => [...stockState],
        movements: async () => [...movementState],
        recordMovement: async (input: {
          stockItemId: string;
          movementType: StockMovement['movementType'];
          quantityDelta: number;
          reason: string;
        }) => {
          recordedMovements.push(input);
          const item = stockState[0];
          const before = item.quantity;
          item.quantity += input.quantityDelta;
          const mov: StockMovement = {
            id: `mov-${movementState.length + 1}`,
            salonId: SALON_ID,
            stockItemId: item.id,
            stockItemName: item.name,
            movementType: input.movementType,
            quantityDelta: input.quantityDelta,
            quantityBefore: before,
            quantityAfter: item.quantity,
            reason: input.reason,
            createdAt: new Date().toISOString(),
          };
          movementState.unshift(mov);
          return mov;
        },
      },
      expenses: { list: async () => [], events: async () => [] },
    }) as any;

  const view = render(
    <AuthContext.Provider value={buildAuth()}>
      <AppProvider apiClientFactory={fakeApiFactory}>
        <ActiveSalonGate>
          <InventoryView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(view.getByText('Cire Coiffante Mate'));
  });

  // Ouvre la modale de mouvement
  fireEvent.click(view.getByText('Mouvement'));
  await waitFor(() => {
    assert.ok(view.getByText('Mouvement de stock'));
  });

  const qtyInput = view.getByDisplayValue('1');
  fireEvent.change(qtyInput, { target: { value: '5' } });
  const reasonInput = view.getByPlaceholderText(/Réception commande fournisseur/i);
  fireEvent.change(reasonInput, { target: { value: 'Livraison BL-07' } });

  fireEvent.submit(view.getByText('Valider et historiser le mouvement').closest('form')!);

  await waitFor(() => {
    assert.equal(recordedMovements.length, 1);
    assert.equal(stockState[0].quantity, 15);
  });

  // Passe sur l’onglet Journal des mouvements et vérifie l’apparition du mouvement
  fireEvent.click(view.getByText(/Journal des mouvements/i));
  await waitFor(() => {
    assert.ok(view.getByText('Livraison BL-07'));
    assert.ok(view.getByText('10 → 15'));
  });

  // Passe sur l’onglet Fournisseurs et crée un nouveau fournisseur
  fireEvent.click(view.getByText(/Fournisseurs \(/i));
  fireEvent.click(view.getByText('Nouveau fournisseur'));
  fireEvent.change(view.getByPlaceholderText('Ex: Abidjan Barber Supply'), {
    target: { value: 'Yopougon Cosmétiques' },
  });
  fireEvent.click(view.getByText('Enregistrer le fournisseur'));

  await waitFor(() => {
    assert.equal(upsertedSuppliers.length, 1);
    assert.ok(within(view.container).getByText('Yopougon Cosmétiques'));
  });
});

test('FinanceExpensesView : contrepassation et correction auditée sans suppression silencieuse', async () => {
  ensureDom();
  cleanup();

  const expensesState: Expense[] = [
    {
      id: 'exp-1',
      salonId: SALON_ID,
      title: 'Facture Eau',
      category: 'water',
      amount: 15000,
      date: '2026-11-10',
      entryKind: 'expense',
      status: 'active',
    },
  ];
  const reversedCalls: Array<{ id: string; reason: string }> = [];
  const correctedCalls: unknown[] = [];

  const fakeApiFactory = () =>
    ({
      workspace: async () => ({
        salon: { id: SALON_ID, name: 'Salon Ops', status: 'active', is_published: true },
        branches: [{ id: BRANCH_ID, name: 'Plateau' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [...expensesState],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: { list: async () => [] },
      stock: { list: async () => [], movements: async () => [] },
      expenses: {
        list: async () => [...expensesState],
        events: async () => [],
        reverse: async (id: string, reason: string) => {
          reversedCalls.push({ id, reason });
          expensesState[0] = { ...expensesState[0], status: 'reversed' };
          const rev: Expense = {
            id: 'exp-rev-1',
            salonId: SALON_ID,
            title: 'Contrepassation : Facture Eau',
            category: 'water',
            amount: 15000,
            date: '2026-11-10',
            entryKind: 'expense_reversal',
            originalExpenseId: id,
            status: 'active',
            reason,
          };
          expensesState.unshift(rev);
          return rev;
        },
        correct: async (input: {
          originalExpenseId: string;
          title: string;
          amount: number;
          reason: string;
        }) => {
          correctedCalls.push(input);
          const corr: Expense = {
            id: 'exp-corr-1',
            salonId: SALON_ID,
            title: input.title,
            category: 'water',
            amount: input.amount,
            date: '2026-11-10',
            entryKind: 'expense',
            status: 'active',
          };
          expensesState.unshift(corr);
          return corr;
        },
      },
    }) as any;

  const view = render(
    <AuthContext.Provider value={buildAuth()}>
      <AppProvider apiClientFactory={fakeApiFactory}>
        <ActiveSalonGate>
          <FinanceExpensesView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(view.getByText('Facture Eau'));
  });

  // Vérifie que la contrepassation exige un motif et met à jour le journal
  fireEvent.click(view.getByTitle('Contrepasser (annulation auditée)'));
  fireEvent.change(view.getByPlaceholderText(/Facture annulée/i), {
    target: { value: 'Facture annulée par SODECI' },
  });
  fireEvent.submit(view.getByText('Confirmer la contrepassation').closest('form')!);

  await waitFor(() => {
    assert.equal(reversedCalls.length, 1);
    assert.equal(reversedCalls[0].reason, 'Facture annulée par SODECI');
    assert.ok(view.getByText('Contrepassation'));
    assert.ok(view.getByText('Annulée'));
  });
});

test('FinanceExpensesView : correction auditée conserve l’écriture initiale et crée l’écriture rectifiée', async () => {
  ensureDom();
  cleanup();

  const expensesState: Expense[] = [
    {
      id: 'exp-corr-src',
      salonId: SALON_ID,
      title: 'Loyer Bureau',
      category: 'rent',
      amount: 50000,
      date: '2026-11-10',
      entryKind: 'expense',
      status: 'active',
    },
  ];
  const correctedCalls: unknown[] = [];

  const fakeApiFactory = () =>
    ({
      workspace: async () => ({
        salon: { id: SALON_ID, name: 'Salon Ops', status: 'active', is_published: true },
        branches: [{ id: BRANCH_ID, name: 'Plateau' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [...expensesState],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: { list: async () => [] },
      stock: { list: async () => [], movements: async () => [] },
      expenses: {
        list: async () => [...expensesState],
        events: async () => [],
        correct: async (input: {
          originalExpenseId: string;
          title: string;
          amount: number;
          reason: string;
        }) => {
          correctedCalls.push(input);
          expensesState[0] = { ...expensesState[0], status: 'superseded' };
          const rev: Expense = {
            id: 'exp-rev-src',
            salonId: SALON_ID,
            title: 'Annulation correction : Loyer Bureau',
            category: 'rent',
            amount: 50000,
            date: '2026-11-10',
            entryKind: 'expense_reversal',
            originalExpenseId: input.originalExpenseId,
            status: 'active',
          };
          const repl: Expense = {
            id: 'exp-repl',
            salonId: SALON_ID,
            title: input.title,
            category: 'rent',
            amount: input.amount,
            date: '2026-11-10',
            entryKind: 'expense',
            originalExpenseId: input.originalExpenseId,
            status: 'active',
          };
          expensesState.unshift(rev);
          expensesState.unshift(repl);
          return repl;
        },
      },
    }) as any;

  const view = render(
    <AuthContext.Provider value={buildAuth()}>
      <AppProvider apiClientFactory={fakeApiFactory}>
        <ActiveSalonGate>
          <FinanceExpensesView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(view.getByText('Loyer Bureau'));
  });

  fireEvent.click(view.getByTitle('Corriger via écriture liée'));
  fireEvent.change(view.getByPlaceholderText(/Erreur de saisie/i), {
    target: { value: 'Montant rectifié TTC' },
  });
  fireEvent.change(view.getByDisplayValue('50000'), {
    target: { value: '55000' },
  });
  fireEvent.submit(view.getByText('Valider la correction auditée').closest('form')!);

  await waitFor(() => {
    assert.equal(correctedCalls.length, 1);
    assert.ok(view.getByText('Corrigée'));
    assert.ok(view.getByText('Contrepassation'));
  });
});

test('SalonProfileSettingsView : enregistre la galerie et les visuels via updateSalonDetails', async () => {
  ensureDom();
  cleanup();

  const profileUpdates: unknown[] = [];

  const fakeApiFactory = () =>
    ({
      workspace: async () => ({
        salon: {
          id: SALON_ID,
          name: 'Salon Ops',
          status: 'active',
          is_published: true,
          gallery: [{ url: 'https://cdn.test/existing.jpg', title: 'Existant', description: '' }],
        },
        branches: [{ id: BRANCH_ID, name: 'Plateau' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      salon: {
        updateProfile: async (payload: unknown) => {
          profileUpdates.push(payload);
          return {
            id: SALON_ID,
            name: 'Salon Ops',
            status: 'active',
            is_published: true,
            gallery: ['https://cdn.test/existing.jpg', 'https://cdn.test/new-cut.jpg'],
          };
        },
      },
    }) as any;

  const view = render(
    <AuthContext.Provider value={buildAuth()}>
      <AppProvider apiClientFactory={fakeApiFactory}>
        <ActiveSalonGate>
          <SalonProfileSettingsView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(view.getByText(/Galerie photos du salon/i));
  });

  fireEvent.change(view.getByPlaceholderText(/Ou coller une URL HTTPS/i), {
    target: { value: 'https://cdn.test/new-cut.jpg' },
  });
  fireEvent.click(view.getByText('Ajouter URL'));

  await waitFor(() => {
    assert.ok(view.getByText(/Galerie photos du salon \(2\/12\)/i));
  });
});

test('SalonDetailModal mobile : pré-sélectionne prestation & collaborateur et affiche le raccourci de réservation mobile', async () => {
  ensureDom();
  cleanup();

  const detail: PublicSalonDetail = {
    salon: {
      id: SALON_ID,
      name: 'Studio Ébène',
      slug: 'studio-ebene',
      type: 'barbershop',
      city: 'Abidjan',
      commune: 'Plateau',
      currency: 'XOF',
      isPublishedOnMarketplace: true,
      isVerified: true,
      status: 'active',
    },
    branches: [{ id: BRANCH_ID, name: 'Plateau', timezone: 'Africa/Abidjan', hours: [] }],
    services: [
      {
        id: 'srv-1',
        salonId: SALON_ID,
        name: 'Coupe Classique',
        category: 'coupe',
        description: '',
        price: 4000,
        durationMinutes: 30,
        isActive: true,
      },
      {
        id: 'srv-2',
        salonId: SALON_ID,
        name: 'Dégradé + Barbe VIP',
        category: 'combo',
        description: '',
        price: 8000,
        durationMinutes: 45,
        isActive: true,
      },
    ],
    staff: [
      {
        id: 'stf-1',
        name: 'Kouassi',
        role: 'barber',
        specialties: ['Dégradé'],
        serviceIds: ['srv-1', 'srv-2'],
      },
    ],
    reviews: [],
    rating: 4.9,
    reviewCount: 12,
    minPrice: 4000,
  };

  const view = render(
    <MemoryRouter>
      <AppProvider>
        <SalonDetailModal
          salon={detail.salon}
          initialDetail={detail}
          initialServiceId="srv-2"
          initialStaffId="stf-1"
          initialSlots={[]}
          onClose={() => {}}
        />
      </AppProvider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(view.getByText('Réserver un créneau'));
  });
  const selects = view.container.querySelectorAll('select');
  assert.equal((selects[0] as HTMLSelectElement).value, 'srv-2');
  assert.equal((selects[1] as HTMLSelectElement).value, 'stf-1');
});
