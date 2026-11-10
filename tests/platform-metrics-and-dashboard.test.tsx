import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import React from 'react';
import { JSDOM } from 'jsdom';
import { PGlite } from '@electric-sql/pglite';
import { getPlatformMetrics, type SaasRpcClient } from '../src/lib/saas';
import type { PlatformMetrics } from '../src/types';
import {
  AdminOverviewPanel,
  rangeForMetricsPeriod,
  type MetricsPeriodKey,
} from '../src/components/admin/AdminOverviewPanel';
import { SalonManagement } from '../src/components/admin/SalonManagement';
import { AppProvider } from '../src/context/AppContext';
import type { SalonAdminDetail } from '../src/lib/superadmin';

const db = new PGlite();
const superAdminId = '11111111-1111-4111-8111-111111111111';
const ownerMonthlyId = '22222222-2222-4222-8222-222222222222';
const ownerYearlyId = '33333333-3333-4333-8333-333333333333';
const ownerPendingId = '44444444-4444-4444-8444-444444444444';

function todayAbidjan() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function createMetricsRpcClient(): SaasRpcClient {
  return {
    async rpc(fn, params = {}) {
      try {
        if (fn === 'get_platform_metrics') {
          const r = await db.query<{ res: unknown }>(
            'select public.get_platform_metrics($1::date, $2::date) as res',
            [params.p_from ?? null, params.p_to ?? null],
          );
          return { data: r.rows[0].res, error: null };
        }
        return { data: null, error: { message: `RPC non supportée: ${fn}` } };
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
  const existing = (globalThis as { __metricsTestWin?: Window & typeof globalThis }).__metricsTestWin;
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
  (globalThis as { __metricsTestWin?: Window & typeof globalThis }).__metricsTestWin = win;
  return { win, doc: win.document };
}

test('aller-retour getPlatformMetrics() <-> PostgreSQL : mensuels + annuels normalisés, remboursés, en attente et RDV annulés', async () => {
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

  await db.query(
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now())',
    [superAdminId, ownerMonthlyId, ownerYearlyId, ownerPendingId],
  );

  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [
    superAdminId,
  ]);

  await setDbActor(ownerMonthlyId, 'monthly@example.com');
  const s1 = (
    await db.query<{ salon_id: string; branch_id: string }>(
      "select * from public.create_salon('Org M', 'Salon Mensuel', 'Principal')",
    )
  ).rows[0];

  await setDbActor(ownerYearlyId, 'yearly@example.com');
  const s2 = (
    await db.query<{ salon_id: string }>(
      "select * from public.create_salon('Org Y', 'Salon Annuel', 'Principal')",
    )
  ).rows[0];

  await setDbActor(ownerPendingId, 'pending@example.com');
  const s3 = (
    await db.query<{ salon_id: string }>(
      "select * from public.create_salon('Org P', 'Salon Attente', 'Principal')",
    )
  ).rows[0];

  // Plan annuel 120 000 XOF (= 10 000/mois)
  await setDbActor(superAdminId, 'dominiquek051@gmail.com');
  await db.query("select public.save_saas_plan_workflow('pro-yearly', $1::jsonb, true)", [
    JSON.stringify({
      name: 'Pro Annuel',
      slug: 'pro-yearly',
      price_xof: 120000,
      billing_period: 'yearly',
      description: 'Annuel',
      features: ['Tout inclus'],
      max_staff: 5,
      max_branches: 1,
      is_popular: true,
      is_active: true,
      display_order: 4,
    }),
  ]);

  // Abonnement mensuel (15 000) confirmé
  await setDbActor(ownerMonthlyId, 'monthly@example.com');
  await db.query("select public.subscribe_salon_to_plan($1, 'starter')", [s1.salon_id]);
  const p1 = (
    await db.query<{ res: { id: string } }>(
      "select public.declare_saas_payment($1, 'mobile_money', 'REF-M-1') as res",
      [s1.salon_id],
    )
  ).rows[0].res;
  await setDbActor(superAdminId, 'dominiquek051@gmail.com');
  await db.query("select public.review_saas_payment($1, 'confirm', 'OK')", [p1.id]);

  // Abonnement annuel (120 000) confirmé
  await setDbActor(ownerYearlyId, 'yearly@example.com');
  await db.query("select public.subscribe_salon_to_plan($1, 'pro-yearly')", [s2.salon_id]);
  const p2 = (
    await db.query<{ res: { id: string } }>(
      "select public.declare_saas_payment($1, 'bank_transfer', 'REF-Y-1') as res",
      [s2.salon_id],
    )
  ).rows[0].res;
  await setDbActor(superAdminId, 'dominiquek051@gmail.com');
  await db.query("select public.review_saas_payment($1, 'confirm', 'OK')", [p2.id]);

  // Abonnement en attente (35 000) -> hors MRR
  await setDbActor(ownerPendingId, 'pending@example.com');
  await db.query("select public.subscribe_salon_to_plan($1, 'pro')", [s3.salon_id]);
  await db.query("select public.declare_saas_payment($1, 'mobile_money', 'REF-P-1')", [s3.salon_id]);

  // Activité salon : 1 RDV terminé, 2 annulés, 1 en attente + paiement 10k, remb 4k, attente 8k
  await setDbActor(ownerMonthlyId, 'monthly@example.com');
  const svcId = (
    await db.query<{ id: string }>(
      "insert into public.services(salon_id, name, category, price, duration_minutes) values ($1, 'Coupe', 'coupe', 10000, 30) returning id",
      [s1.salon_id],
    )
  ).rows[0].id;
  const staffId = (
    await db.query<{ id: string }>(
      "insert into public.staff(salon_id, name, role, branch_id, service_ids) values ($1, 'Koffi', 'barber', $2, $3) returning id",
      [s1.salon_id, s1.branch_id, [svcId]],
    )
  ).rows[0].id;
  const regId = (
    await db.query<{ id: string }>('select public.ensure_default_register($1, $2) as id', [
      s1.salon_id,
      s1.branch_id,
    ])
  ).rows[0].id;
  await db.query("select public.open_cash_session($1, $2, 0, $3, 'Caisse test')", [
    s1.salon_id,
    s1.branch_id,
    regId,
  ]);

  const today = todayAbidjan();
  const createdIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const h = String(9 + i).padStart(2, '0');
    const id = (
      await db.query<{ id: string }>(
        "select id from public.create_appointment($1, $2, $3::timestamptz, $4, $5, $6, null, null, 'direct', '')",
        [s1.salon_id, svcId, `${today}T${h}:00:00Z`, `Client ${i + 1}`, `+2250700002${i}`, staffId],
      )
    ).rows[0].id;
    createdIds.push(id);
  }
  const [apptCompleted, apptCancel1, apptCancel2, apptPendingPay] = createdIds;
  await db.query("select public.transition_appointment($1, $2, 'checked_in', null)", [
    s1.salon_id,
    apptCompleted,
  ]);
  await db.query("select public.transition_appointment($1, $2, 'in_progress', null)", [
    s1.salon_id,
    apptCompleted,
  ]);
  await db.query("select public.transition_appointment($1, $2, 'completed', null)", [
    s1.salon_id,
    apptCompleted,
  ]);
  await db.query("select public.cancel_appointment($1, $2, 'Annulé 1')", [s1.salon_id, apptCancel1]);
  await db.query("select public.cancel_appointment($1, $2, 'Annulé 2')", [s1.salon_id, apptCancel2]);

  const payCash = (
    await db.query<{ id: string }>(
      "select * from public.record_payment($1, $2, 10000, 'cash', '21000000-0000-4000-8000-000000000001', null, 'Cash')",
      [s1.salon_id, apptCompleted],
    )
  ).rows[0];
  await db.query(
    "select * from public.record_payment_correction($1, $2, 'refund', 4000, 'Remboursement test', '21000000-0000-4000-8000-000000000002', null, '')",
    [s1.salon_id, payCash.id],
  );
  await db.query(
    "select * from public.record_payment($1, $2, 8000, 'wave', '21000000-0000-4000-8000-000000000003', 'WAVE-WAIT-TEST', 'Attente')",
    [s1.salon_id, apptPendingPay],
  );

  // Appel via le client TypeScript réel getPlatformMetrics
  await setDbActor(superAdminId, 'dominiquek051@gmail.com');
  const client = createMetricsRpcClient();
  const range = rangeForMetricsPeriod('month', today);
  const metrics = await getPlatformMetrics({ from: range.from, to: range.to }, client);
  assert.ok(metrics);
  assert.equal(metrics.estimatedMrrXof, 25000);
  assert.equal(metrics.monthlyMrrXof, 15000);
  assert.equal(metrics.yearlyMrrXof, 10000);
  assert.equal(metrics.annualRunRateXof, 300000);
  assert.equal(metrics.saasCollectedRevenueXof, 135000);
  assert.equal(metrics.saasPendingPaymentsXof, 35000);
  assert.equal(metrics.collectedGrossRevenueXof, 10000);
  assert.equal(metrics.refundsXof, 4000);
  assert.equal(metrics.collectedNetRevenueXof, 6000);
  assert.equal(metrics.totalRevenueXof, 6000);
  assert.equal(metrics.pendingPaymentsXof, 8000);
  assert.equal(metrics.completedAppointments, 1);
  assert.equal(metrics.cancelledAppointments, 2);
  assert.equal(metrics.totalAppointments, 4);

  // Une période passée sans activité retourne 0 sur les flux de la période mais conserve l'état instantané MRR
  const emptyPast = await getPlatformMetrics({ from: '2025-01-01', to: '2025-01-31' }, client);
  assert.ok(emptyPast);
  assert.equal(emptyPast.estimatedMrrXof, 25000);
  assert.equal(emptyPast.collectedNetRevenueXof, 0);
  assert.equal(emptyPast.completedAppointments, 0);
  assert.equal(emptyPast.cancelledAppointments, 0);
  assert.equal(emptyPast.saasCollectedRevenueXof, 0);
});

test('rangeForMetricsPeriod calcule des bornes cohérentes', () => {
  assert.deepEqual(rangeForMetricsPeriod('month', '2026-11-10'), {
    from: '2026-11-01',
    to: '2026-11-10',
  });
  assert.deepEqual(rangeForMetricsPeriod('30d', '2026-11-10'), {
    from: '2026-10-12',
    to: '2026-11-10',
  });
  assert.deepEqual(rangeForMetricsPeriod('year', '2026-11-10'), {
    from: '2026-01-01',
    to: '2026-11-10',
  });
  assert.deepEqual(rangeForMetricsPeriod('all', '2026-11-10'), {
    from: null,
    to: null,
  });
});

test('UI AdminOverviewPanel & SalonManagement : affichage exact MRR normalisé, flux séparés, RDV réalisés vs annulés et filtre période', async () => {
  const { win, doc } = ensureDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  const sampleMetrics: PlatformMetrics = {
    periodFrom: '2026-11-01',
    periodTo: '2026-11-10',
    timezone: 'Africa/Abidjan',
    totalSalons: 3,
    publishedSalons: 2,
    verifiedSalons: 1,
    suspendedSalons: 0,
    activeSubscriptions: 2,
    estimatedMrrXof: 25000,
    monthlyMrrXof: 15000,
    yearlyMrrXof: 10000,
    annualRunRateXof: 300000,
    subscriptionsByStatus: {
      active: 2,
      trialing: 0,
      pendingPayment: 1,
      pastDue: 0,
      cancelled: 0,
    },
    subscriptionsByBillingPeriod: { monthly: 1, yearly: 1 },
    saasCollectedRevenueXof: 135000,
    saasConfirmedPaymentsCount: 2,
    saasPendingPaymentsXof: 35000,
    saasPendingPaymentsCount: 1,
    saasRejectedPaymentsXof: 0,
    saasRejectedPaymentsCount: 0,
    plansCount: 3,
    totalRevenueXof: 6000,
    collectedNetRevenueXof: 6000,
    collectedGrossRevenueXof: 10000,
    refundsXof: 4000,
    paymentReversalsXof: 0,
    refundReversalsXof: 0,
    pendingPaymentsXof: 8000,
    failedPaymentsXof: 0,
    confirmedPaymentsCount: 1,
    refundsCount: 1,
    pendingPaymentsCount: 1,
    failedPaymentsCount: 0,
    totalAppointments: 4,
    completedAppointments: 1,
    cancelledAppointments: 2,
    noShowAppointments: 0,
    appointmentsByStatus: {
      pending: 0,
      confirmed: 1,
      checkedIn: 0,
      inProgress: 0,
      completed: 1,
      cancelled: 2,
      noShow: 0,
    },
  };

  const sampleSalons: SalonAdminDetail[] = [
    {
      id: 'salon-m',
      name: 'Salon Mensuel',
      organizationName: 'Org M',
      commune: 'Cocody',
      phone: '+22507000001',
      isPublished: true,
      isVerified: true,
      status: 'active',
      planId: 'starter',
      planName: 'Starter Solo',
      priceAtSubscription: 15000,
      subscriptionStatus: 'active',
      subscriptionBillingPeriod: 'monthly',
      currentPeriodEnd: '2026-12-10T00:00:00Z',
      latestPayment: null,
      pendingSubscription: null,
      appointmentsCount: 4,
      completedAppointmentsCount: 1,
      cancelledAppointmentsCount: 2,
      collectedGrossXof: 10000,
      refundsXof: 4000,
      pendingPaymentsXof: 8000,
      totalRevenueXof: 6000,
      createdAt: '2026-11-01T10:00:00Z',
    },
  ];

  const periodCalls: Array<{ period: MetricsPeriodKey; from: string | null; to: string | null }> = [];
  let currentMetrics: PlatformMetrics | null = sampleMetrics;
  let currentPeriod: MetricsPeriodKey = 'month';
  let currentFrom: string | null = '2026-11-01';
  let currentTo: string | null = '2026-11-10';

  const rootEl = doc.getElementById('root')!;
  const root = createRoot(rootEl);
  const formatPrice = (n: number) => `${n} FCFA`;

  const renderPanel = () => {
    root.render(
      <AppProvider>
        <AdminOverviewPanel
          metrics={currentMetrics}
          metricsLoading={false}
          salons={sampleSalons}
          auditLogs={[]}
          period={currentPeriod}
          fromDate={currentFrom}
          toDate={currentTo}
          onPeriodChange={(period, from, to) => {
            periodCalls.push({ period, from, to });
            currentPeriod = period;
            currentFrom = from;
            currentTo = to;
            renderPanel();
          }}
          onNavigateTab={() => {}}
          formatPrice={formatPrice}
        />
        <SalonManagement
          salons={sampleSalons}
          adminEmail="dominiquek051@gmail.com"
          onRefresh={() => {}}
          actions={{
            setVerification: async () => sampleSalons[0],
            setPublication: async () => sampleSalons[0],
            setStatus: async () => sampleSalons[0],
            updateDetails: async () => sampleSalons[0],
          }}
        />
      </AppProvider>,
    );
  };

  await act(async () => {
    renderPanel();
  });

  const text = doc.body.textContent ?? '';
  // MRR normalisé et séparation SaaS / Salons / Remboursements / Attente
  assert.ok(text.includes('25000 FCFA'), 'MRR normalisé attendu');
  assert.ok(text.includes('Mensuels (1) : 15000 FCFA / mois'));
  assert.ok(text.includes('Annuels (1) : 10000 FCFA / mois (normalisés ÷ 12)'));
  assert.ok(text.includes('ARR annualisé : 300000 FCFA'));
  assert.ok(text.includes('135000 FCFA'), 'Encaissements SaaS attendus');
  assert.ok(text.includes('35000 FCFA'), 'Paiements SaaS en attente attendus');
  assert.ok(text.includes('6000 FCFA'), 'Encaissements nets salons attendus');
  assert.ok(text.includes('4000 FCFA'), 'Remboursements salons attendus');
  assert.ok(text.includes('8000 FCFA'), 'Paiements salons en attente attendus');

  // Ne qualifier de "réalisés" que status = completed (1, jamais 4)
  assert.equal(doc.querySelector('[data-testid="metric-completed-appointments"]')?.textContent?.trim(), '1');
  assert.ok(
    doc
      .querySelector('[data-testid="metric-completed-appointments-detail"]')
      ?.textContent?.includes('2 annulé(s)'),
  );

  // SalonManagement affiche aussi réalisés / total + net / remb / attente
  const normalizedText = text.replace(/\s+/g, ' ');
  assert.ok(
    normalizedText.includes(
      '1 réalisé(s) / 4 RDV · Net : 6 000 FCFA · Remb. : 4 000 FCFA · Attente : 8 000 FCFA',
    ),
    `Texte SalonManagement inattendu: ${normalizedText}`,
  );

  // Clic sur "Tout" déclenche onPeriodChange('all', null, null)
  const allBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tout');
  assert.ok(allBtn);
  await act(async () => {
    allBtn.click();
  });
  assert.deepEqual(periodCalls[0], { period: 'all', from: null, to: null });

  // Validation de plage personnalisée inversée (from > to)
  const customBtn = [...doc.querySelectorAll('button')].find((b) =>
    b.textContent?.trim().includes('Personnalisée'),
  );
  assert.ok(customBtn);
  await act(async () => {
    customBtn.click();
  });
  assert.equal(periodCalls.length, 2);
  assert.equal(periodCalls[1].period, 'custom');

  const setInput = (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
    assert.ok(setter);
    setter.call(input, value);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    input.dispatchEvent(new win.Event('change', { bubbles: true }));
  };

  const fromInput = doc.getElementById('metrics-from') as HTMLInputElement;
  const toInput = doc.getElementById('metrics-to') as HTMLInputElement;
  await act(async () => {
    setInput(fromInput, '2026-11-20');
    setInput(toInput, '2026-11-05');
  });
  const applyBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Appliquer');
  assert.ok(applyBtn);
  await act(async () => {
    applyBtn.click();
  });
  assert.equal(periodCalls.length, 2, 'Une plage invalide ne doit pas appeler le serveur');
  assert.ok(doc.querySelector('[role="alert"]')?.textContent?.includes('précéder'));

  // Plage personnalisée valide
  await act(async () => {
    setInput(fromInput, '2026-10-01');
    setInput(toInput, '2026-10-31');
  });
  await act(async () => {
    applyBtn.click();
  });
  assert.deepEqual(periodCalls[2], { period: 'custom', from: '2026-10-01', to: '2026-10-31' });

  // Absence de données serveur => tiret, jamais de valeur inventée
  currentMetrics = null;
  await act(async () => {
    renderPanel();
  });
  assert.equal(doc.querySelector('[data-testid="metric-completed-appointments"]')?.textContent?.trim(), '—');
  assert.equal(doc.querySelector('[data-testid="metric-normalized-mrr"]')?.textContent?.trim(), '—');

  await act(async () => {
    root.unmount();
  });
});

after(async () => {
  await db.close();
});
