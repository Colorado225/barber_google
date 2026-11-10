import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import React from 'react';
import { JSDOM } from 'jsdom';
import { PGlite } from '@electric-sql/pglite';
import {
  getAdminReviews,
  getAdminSalonsList,
  getPlatformAuditLogs,
  moderateReviewByAdmin,
  setSalonPublicationByAdmin,
  setSalonStatusByAdmin,
  setSalonVerificationByAdmin,
  updateSalonDetailsByAdmin,
  type AdminRpcClient,
  type AuditLogEntry,
  type MarketplaceReviewItem,
  type SalonAdminDetail,
} from '../src/lib/superadmin';
import { AppProvider } from '../src/context/AppContext';
import { SalonManagement } from '../src/components/admin/SalonManagement';
import { AdminReviewsPanel } from '../src/components/admin/AdminReviewsPanel';
import { AdminAuditLogPanel } from '../src/components/admin/AdminAuditLogPanel';
import { AdminSubscriptionsPanel } from '../src/components/admin/AdminSubscriptionsPanel';
import type { SaaSPaymentReviewItem } from '../src/lib/saas';

const db = new PGlite();
const superAdminId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';

function createPgliteRpcClient(): AdminRpcClient {
  return {
    async rpc(fn, params = {}) {
      try {
        if (fn === 'admin_list_salons') {
          const r = await db.query<{ res: unknown }>('select public.admin_list_salons() as res');
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_set_salon_publication') {
          const r = await db.query<{ res: unknown }>(
            'select public.admin_set_salon_publication($1, $2, $3) as res',
            [params.p_salon_id, params.p_published, params.p_reason],
          );
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_set_salon_verification') {
          const r = await db.query<{ res: unknown }>(
            'select public.admin_set_salon_verification($1, $2, $3) as res',
            [params.p_salon_id, params.p_verified, params.p_reason],
          );
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_set_salon_status') {
          const r = await db.query<{ res: unknown }>(
            'select public.admin_set_salon_status($1, $2, $3) as res',
            [params.p_salon_id, params.p_status, params.p_reason],
          );
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_update_salon_details') {
          const r = await db.query<{ res: unknown }>(
            'select public.admin_update_salon_details($1, $2::jsonb, $3) as res',
            [params.p_salon_id, JSON.stringify(params.p_updates ?? {}), params.p_reason],
          );
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_list_reviews') {
          const r = await db.query<{ res: unknown }>('select public.admin_list_reviews($1, $2) as res', [
            params.p_salon_id ?? null,
            params.p_include_hidden ?? true,
          ]);
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_moderate_review') {
          const r = await db.query<{ res: unknown }>(
            'select public.admin_moderate_review($1, $2, $3) as res',
            [params.p_review_id, params.p_action, params.p_reason],
          );
          return { data: r.rows[0].res, error: null };
        }
        if (fn === 'admin_list_audit_logs') {
          const r = await db.query<{ res: unknown }>('select public.admin_list_audit_logs($1, $2) as res', [
            params.p_limit ?? 100,
            params.p_target_type ?? null,
          ]);
          return { data: r.rows[0].res, error: null };
        }
        return { data: null, error: { message: `RPC inconnue: ${fn}` } };
      } catch (err) {
        const e = err as { message: string; code?: string };
        return { data: null, error: { message: e.message, code: e.code } };
      }
    },
  };
}

async function setDbActor(userId: string, email: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query("select set_config('request.jwt.claim.email', $1, false)", [email]);
  await db.exec('set role authenticated');
}

function ensureDom() {
  const existing = (globalThis as { __adminTestWin?: Window & typeof globalThis }).__adminTestWin;
  if (existing) {
    const rootEl = existing.document.getElementById('root');
    if (rootEl) rootEl.innerHTML = '';
    return { win: existing, doc: existing.document };
  }
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/admin',
  });
  const win = dom.window as unknown as Window & typeof globalThis;
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (idx: number) => [...store.keys()][idx] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', {
    value: win.document,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: win.navigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: win.CustomEvent,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'HTMLElement', {
    value: win.HTMLElement,
    configurable: true,
    writable: true,
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { __adminTestWin?: Window & typeof globalThis }).__adminTestWin = win;
  return { win, doc: win.document };
}

test('aller-retour client superadmin.ts <-> PostgreSQL : autorisations, persistance et journal d’audit', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now())', [
    superAdminId,
    ownerId,
  ]);

  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [
    superAdminId,
  ]);

  await setDbActor(ownerId, 'owner@example.com');
  const created = (
    await db.query<{ salon_id: string; branch_id: string }>(
      "select * from public.create_salon('Org Client', 'Salon Studio', 'Principal')",
    )
  ).rows[0];
  const salonId: string = created.salon_id;
  const branchId: string = created.branch_id;

  await db.exec('reset role');
  const svcId = (
    await db.query<{ id: string }>(
      "insert into public.services(salon_id, name, category, price, duration_minutes) values ($1, 'Coupe', 'coupe', 5000, 30) returning id",
      [salonId],
    )
  ).rows[0].id;
  const staffId = (
    await db.query<{ id: string }>(
      "insert into public.staff(salon_id, name, role, branch_id, service_ids) values ($1, 'Awa', 'stylist', $2, $3) returning id",
      [salonId, branchId, [svcId]],
    )
  ).rows[0].id;
  const apptId = (
    await db.query<{ id: string }>(
      `insert into public.appointments(
         salon_id, branch_id, staff_id, service_id, client_name, client_phone,
         service_name, staff_name, starts_at, ends_at, amount, source, status, payment_status
       ) values (
         $1, $2, $3, $4, 'Amina', '+22507000011',
         'Coupe', 'Awa', now() - interval '3 hours', now() - interval '2 hours', 5000,
         'direct', 'completed', 'paid'
       ) returning id`,
      [salonId, branchId, staffId, svcId],
    )
  ).rows[0].id;

  await setDbActor(ownerId, 'owner@example.com');
  const reviewId: string = (
    await db.query<{ id: string }>("select id from public.create_review($1, 'Amina', 5, 'Très pro', $2)", [
      salonId,
      apptId,
    ])
  ).rows[0].id;

  const client = createPgliteRpcClient();

  // Un non-superadmin est rejeté par les RPC via superadmin.ts
  await assert.rejects(getAdminSalonsList(client), /super administrateur/);
  await assert.rejects(
    setSalonPublicationByAdmin(salonId, true, 'Test non autorisé', client),
    /super administrateur/,
  );

  // Le SuperAdmin exécute le cycle complet et relit depuis PostgreSQL
  await setDbActor(superAdminId, 'dominiquek051@gmail.com');
  const initialList = await getAdminSalonsList(client);
  assert.equal(initialList.length, 1);
  assert.equal(initialList[0].isPublished, false);
  assert.equal(initialList[0].planName, '');
  assert.equal(initialList[0].priceAtSubscription, undefined);
  assert.equal(initialList[0].currentPeriodEnd, undefined);
  assert.equal(initialList[0].latestPayment, null);

  await setSalonPublicationByAdmin(salonId, true, 'Publication initiale', client);
  await setSalonVerificationByAdmin(salonId, true, 'Salon certifié', client);
  await updateSalonDetailsByAdmin(
    salonId,
    { name: 'Salon Studio Abidjan', commune: 'Cocody' },
    'Complément adresse',
    client,
  );

  // Souscription via le flux officiel : demande propriétaire -> paiement déclaré -> validation SuperAdmin
  await setDbActor(ownerId, 'owner@example.com');
  await db.query("select public.subscribe_salon_to_plan($1, 'pro')", [salonId]);
  const declaredPayment = (
    await db.query<{ res: { id: string } }>(
      "select public.declare_saas_payment($1, 'bank_transfer', 'VIR-2026-ALPHA') as res",
      [salonId],
    )
  ).rows[0].res;

  await setDbActor(superAdminId, 'dominiquek051@gmail.com');
  const pendingList = await getAdminSalonsList(client);
  assert.equal(pendingList[0].subscriptionStatus, 'pending_payment');
  assert.equal(pendingList[0].currentPeriodEnd, undefined);
  assert.equal(pendingList[0].latestPayment?.status, 'pending');
  assert.equal(pendingList[0].latestPayment?.reference, 'VIR-2026-ALPHA');

  await db.query("select public.review_saas_payment($1, 'confirm', 'Virement confirmé')", [
    declaredPayment.id,
  ]);
  const activeList = await getAdminSalonsList(client);
  assert.equal(activeList[0].subscriptionStatus, 'active');
  assert.equal(activeList[0].planName, 'Pro Équipe');
  assert.equal(activeList[0].priceAtSubscription, 35000);
  assert.ok(activeList[0].currentPeriodEnd);
  assert.equal(activeList[0].latestPayment?.status, 'confirmed');
  assert.equal(activeList[0].latestPayment?.reference, 'VIR-2026-ALPHA');

  await setSalonStatusByAdmin(salonId, 'suspended', 'Impayé confirmé', client);
  await setSalonStatusByAdmin(salonId, 'active', 'Paiement reçu', client);

  await moderateReviewByAdmin(reviewId, 'hide', 'Propos déplacés', client);
  let reviews = await getAdminReviews(undefined, client);
  assert.equal(reviews[0].isHidden, true);
  assert.equal(reviews[0].moderationReason, 'Propos déplacés');

  await moderateReviewByAdmin(reviewId, 'restore', 'Vérification ok', client);
  reviews = await getAdminReviews(undefined, client);
  assert.equal(reviews[0].isHidden, false);

  const logs = await getPlatformAuditLogs({ limit: 50 }, client);
  assert.equal(logs.length, 8);
  assert.equal(logs[0].action, 'review.restored');
  assert.equal(logs[0].actorEmail, 'dominiquek051@gmail.com');
  assert.equal(logs[0].reason, 'Vérification ok');
});

test('UI SalonManagement : motif obligatoire, rechargement serveur après action et affichage clair des échecs', async () => {
  const { win, doc } = ensureDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  let salonsState: SalonAdminDetail[] = [
    {
      id: 'salon-1',
      name: 'Studio Ébène',
      organizationName: 'Ébène SARL',
      commune: 'Cocody',
      phone: '+22507000001',
      isPublished: true,
      isVerified: false,
      status: 'active',
      planId: '',
      planName: '',
      priceAtSubscription: undefined,
      latestPayment: null,
      pendingSubscription: null,
      createdAt: '2026-11-01T10:00:00Z',
    },
  ];
  let refreshCalls = 0;
  let shouldFailStatus = false;

  const actions = {
    setVerification: async (id: string, verified: boolean) => {
      salonsState = salonsState.map((s) => (s.id === id ? { ...s, isVerified: verified } : s));
      return salonsState[0];
    },
    setPublication: async (id: string, published: boolean) => {
      salonsState = salonsState.map((s) => (s.id === id ? { ...s, isPublished: published } : s));
      return salonsState[0];
    },
    setStatus: async (id: string, status: 'active' | 'suspended', reason: string) => {
      if (shouldFailStatus) {
        throw new Error('Accès réservé au super administrateur (échec persistance)');
      }
      salonsState = salonsState.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              isPublished: status === 'suspended' ? false : s.isPublished,
              suspensionReason: status === 'suspended' ? reason : undefined,
            }
          : s,
      );
      return salonsState[0];
    },
    updateDetails: async (id: string) => salonsState.find((s) => s.id === id)!,
  };

  const container = doc.getElementById('root');
  assert.ok(container);
  const root = createRoot(container);

  const renderRaw = () => {
    root.render(
      <AppProvider>
        <SalonManagement
          salons={salonsState}
          adminEmail="dominiquek051@gmail.com"
          onRefresh={() => {
            refreshCalls += 1;
            renderRaw();
          }}
          actions={actions}
        />
      </AppProvider>,
    );
  };

  await act(async () => {
    renderRaw();
  });

  const setInput = (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
    assert.ok(setter);
    setter.call(input, value);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
  };

  // 1. Cliquer sur Certifier ouvre la modale de motif
  const certifyBtn = doc.querySelector('button[aria-label="Certifier Studio Ébène"]') as HTMLButtonElement;
  assert.ok(certifyBtn);
  await act(async () => {
    certifyBtn.click();
  });

  // 2. Motif vide rejeté dans l'interface sans appel serveur
  const confirmBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Confirmer');
  assert.ok(confirmBtn);
  await act(async () => {
    confirmBtn.click();
  });
  assert.ok(doc.querySelector('[role="alert"]')?.textContent?.includes('motif est obligatoire'));
  assert.equal(refreshCalls, 0);

  // 3. Motif valide : persiste, appelle onRefresh et met à jour l'état depuis le serveur
  const reasonInput = doc.getElementById('salon-action-reason') as HTMLInputElement;
  await act(async () => {
    setInput(reasonInput, 'Audit qualité validé');
  });
  await act(async () => {
    confirmBtn.click();
  });
  assert.equal(refreshCalls, 1);
  assert.equal(salonsState[0].isVerified, true);
  assert.ok(doc.querySelector('button[aria-label="Retirer la certification de Studio Ébène"]'));

  // 4. Échec serveur lors d'une suspension : la modale reste ouverte et affiche clairement l'erreur
  shouldFailStatus = true;
  const suspendBtn = doc.querySelector('button[aria-label="Suspendre Studio Ébène"]') as HTMLButtonElement;
  await act(async () => {
    suspendBtn.click();
  });
  const suspendReasonInput = doc.getElementById('salon-action-reason') as HTMLInputElement;
  await act(async () => {
    setInput(suspendReasonInput, 'Facture impayée');
  });
  const confirmSuspendBtn = [...doc.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Confirmer',
  );
  await act(async () => {
    confirmSuspendBtn?.click();
  });

  const errorAlert = doc.querySelector('[role="alert"]')?.textContent ?? '';
  assert.ok(
    errorAlert.includes('échec persistance'),
    `L’échec de persistance doit être visible: ${errorAlert}`,
  );
  assert.equal(salonsState[0].status, 'active', 'Aucune mutation optimiste trompeuse en cas d’échec');
  assert.equal(refreshCalls, 1);

  await act(async () => {
    root.unmount();
  });
});

test('UI Modération des Avis & Journal d’Audit : masquage, erreur serveur et affichage avant/après/motif', async () => {
  const { win, doc } = ensureDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  let reviewsState: MarketplaceReviewItem[] = [
    {
      id: 'rev-1',
      salonId: 'salon-1',
      salonName: 'Studio Ébène',
      author: 'Karim',
      rating: 2,
      comment: 'Contenu inapproprié',
      createdAt: '2026-11-10T10:00:00Z',
      isVerified: true,
      isHidden: false,
    },
  ];
  let auditState: AuditLogEntry[] = [];
  let failModeration = false;

  const container = doc.getElementById('root');
  assert.ok(container);
  const root = createRoot(container);

  const renderRaw = () => {
    root.render(
      <AppProvider>
        <AdminReviewsPanel
          reviews={reviewsState}
          moderateAction={async (reviewId, action, reason) => {
            if (failModeration) {
              throw new Error('Erreur réseau lors de la modération.');
            }
            reviewsState = reviewsState.map((r) =>
              r.id === reviewId ? { ...r, isHidden: action === 'hide', moderationReason: reason } : r,
            );
            auditState = [
              {
                id: 'log-1',
                timestamp: '2026-11-10T11:00:00Z',
                actorEmail: 'dominiquek051@gmail.com',
                actorRole: 'super_admin',
                action: `review.${action === 'hide' ? 'hidden' : 'restored'}`,
                targetType: 'review',
                targetId: reviewId,
                beforeValues: { is_hidden: false },
                afterValues: { is_hidden: true },
                reason,
                details: { salon_name: 'Studio Ébène' },
              },
            ];
            return { id: reviewId, salonId: 'salon-1', action, isHidden: action === 'hide', deleted: false };
          }}
          onRefresh={() => {
            renderRaw();
          }}
        />
        <AdminAuditLogPanel logs={auditState} onRefresh={() => {}} />
      </AppProvider>,
    );
  };

  await act(async () => {
    renderRaw();
  });

  const setInput = (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
    assert.ok(setter);
    setter.call(input, value);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
  };

  // 1. Masquer avec échec serveur -> erreur visible
  failModeration = true;
  const hideBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Masquer');
  assert.ok(hideBtn, 'Le bouton Masquer doit être rendu');
  await act(async () => {
    hideBtn.click();
  });
  await act(async () => {
    setInput(doc.getElementById('review-moderation-reason') as HTMLInputElement, 'Propos hors charte');
  });
  const confirmBtn = [...doc.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Confirmer la décision'),
  );
  await act(async () => {
    confirmBtn?.click();
  });
  assert.ok(doc.querySelector('[role="alert"]')?.textContent?.includes('Erreur réseau'));
  assert.equal(reviewsState[0].isHidden, false);

  // 2. Nouvelle tentative réussie -> rechargement et affichage dans le journal d'audit (avant/après + motif)
  failModeration = false;
  await act(async () => {
    confirmBtn?.click();
  });
  assert.equal(reviewsState[0].isHidden, true);
  assert.ok(doc.body.textContent?.includes('Rétablir'));
  assert.ok(doc.body.textContent?.includes('review.hidden'));
  assert.ok(doc.body.textContent?.includes('Propos hors charte'));
  assert.ok(doc.body.textContent?.includes('dominiquek051@gmail.com'));
  assert.ok(doc.body.textContent?.includes('is_hidden: false'));
  assert.ok(doc.body.textContent?.includes('is_hidden: true'));

  await act(async () => {
    root.unmount();
  });
});

test('UI AdminSubscriptionsPanel : source saas_subscriptions + paiements, "indisponible" si manquant et validation serveur', async () => {
  const { doc } = ensureDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  const formatPrice = (n: number) => `${n} FCFA`;
  let pendingQueue: SaaSPaymentReviewItem[] = [
    {
      id: 'pay-pending-1',
      salonId: 'salon-no-sub',
      salonName: 'Salon Sans Contrat',
      planId: 'starter',
      planName: 'Starter Solo',
      amountXof: 15000,
      method: 'mobile_money',
      reference: 'MM-WAIT-99',
      declaredAt: '2026-11-10T09:00:00Z',
    },
  ];
  let salonsState: SalonAdminDetail[] = [
    {
      id: 'salon-no-sub',
      name: 'Salon Sans Contrat',
      organizationName: 'Org 1',
      commune: 'Yopougon',
      phone: '+22507000010',
      isPublished: false,
      isVerified: false,
      status: 'active',
      planId: '',
      planName: '',
      priceAtSubscription: undefined,
      subscriptionStatus: undefined,
      subscriptionBillingPeriod: undefined,
      currentPeriodEnd: undefined,
      latestPayment: null,
      pendingSubscription: null,
      createdAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'salon-real-sub',
      name: 'Salon Contrat Réel',
      organizationName: 'Org 2',
      commune: 'Plateau',
      phone: '+22507000020',
      isPublished: true,
      isVerified: true,
      status: 'active',
      subscriptionId: 'sub-2',
      planId: 'prestige',
      planName: 'Prestige & Chaînes',
      priceAtSubscription: 120000,
      subscriptionStatus: 'active',
      subscriptionBillingPeriod: 'yearly',
      currentPeriodEnd: '2027-06-15T12:00:00Z',
      latestPayment: {
        id: 'pay-2',
        status: 'confirmed',
        amountXof: 120000,
        method: 'bank_transfer',
        reference: 'VIR-REAL-2026',
        declaredAt: '2026-11-01T10:00:00Z',
        decidedAt: '2026-11-02T14:00:00Z',
      },
      pendingSubscription: null,
      createdAt: '2026-11-01T10:00:00Z',
    },
  ];
  let refreshCount = 0;

  const container = doc.getElementById('root');
  assert.ok(container);
  const root = createRoot(container);

  const renderPanel = () => {
    root.render(
      <AppProvider>
        <AdminSubscriptionsPanel
          salons={salonsState}
          formatPrice={formatPrice}
          onRefresh={() => {
            refreshCount += 1;
            renderPanel();
          }}
          listPayments={async () => pendingQueue}
          decidePayment={async (paymentId, decision) => {
            assert.equal(paymentId, 'pay-pending-1');
            assert.equal(decision, 'confirm');
            pendingQueue = [];
            salonsState = salonsState.map((s) =>
              s.id === 'salon-no-sub'
                ? {
                    ...s,
                    planId: 'starter',
                    planName: 'Starter Solo',
                    priceAtSubscription: 15000,
                    subscriptionStatus: 'active',
                    subscriptionBillingPeriod: 'monthly',
                    currentPeriodEnd: '2026-12-10T09:00:00Z',
                    latestPayment: {
                      id: paymentId,
                      status: 'confirmed',
                      amountXof: 15000,
                      method: 'mobile_money',
                      reference: 'MM-WAIT-99',
                      decidedAt: '2026-11-10T10:00:00Z',
                    },
                  }
                : s,
            );
          }}
        />
      </AppProvider>,
    );
  };

  await act(async () => {
    renderPanel();
  });

  const text = doc.body.textContent ?? '';
  // 1. Salon sans abonnement/paiement : affiche explicitement "indisponible" (aucun tarif ni date +25j)
  assert.ok(text.includes('indisponible'), 'Doit afficher indisponible quand les données manquent');
  const fake25d = new Date(Date.now() + 25 * 86400000).toLocaleDateString('fr-FR');
  assert.equal(
    text.includes(fake25d),
    false,
    'Aucune date calculée aujourd’hui + 25 jours ne doit apparaître',
  );

  // 2. Salon avec abonnement & paiement réels : tarif DB, cycle annuel (/ an), date réelle et référence
  assert.ok(text.includes('120000 FCFA / an'));
  assert.ok(text.includes(new Date('2027-06-15T12:00:00Z').toLocaleDateString('fr-FR')));
  assert.ok(text.includes('VIR-REAL-2026'));

  // 3. Aucune modification locale/manuelle de forfait ("Changer Forfait" désactivé)
  assert.equal(text.includes('Changer Forfait'), false);

  // 4. La validation passe par la file serveur (SaasPaymentReviewPanel -> Confirmer)
  const confirmPaymentBtn = [...doc.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Confirmer',
  );
  assert.ok(confirmPaymentBtn, 'Le bouton Confirmer de validation serveur doit être présent');
  await act(async () => {
    confirmPaymentBtn.click();
  });

  assert.equal(refreshCount, 1);
  const updatedText = doc.body.textContent ?? '';
  assert.ok(updatedText.includes('15000 FCFA / mois'));
  assert.ok(updatedText.includes('MM-WAIT-99'));

  await act(async () => {
    root.unmount();
  });
});

after(async () => {
  await db.close();
});
