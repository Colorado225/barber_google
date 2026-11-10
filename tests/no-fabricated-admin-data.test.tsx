import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAdminSalonsList, mapAdminSalonRow } from '../src/lib/superadmin';
import { getPlatformMetrics, mapPlatformMetricsRow } from '../src/lib/saas';
import { DEMO_SALONS } from '../src/lib/marketplace-demo';

const rawSalonRow = {
  id: 'real-1',
  name: 'Salon réel test',
  commune: 'Cocody',
  is_published: true,
  is_verified: true,
  status: 'active',
  subscription_plan_id: 'pro',
  subscription_plan_name: 'Pro Équipe',
  subscription_price_xof: 35000,
  subscription_billing_period: 'monthly',
  subscription_status: 'active',
  subscription_current_period_end: '2026-12-10T10:00:00Z',
  subscription_payment_id: 'pay-1',
  subscription_payment_status: 'confirmed',
  subscription_payment_amount_xof: 35000,
  subscription_payment_method: 'mobile_money',
  subscription_payment_reference: 'MM-2026-01',
};

test('admin list rejects when Supabase is not configured (no invented rows)', async () => {
  await assert.rejects(getAdminSalonsList(), /base de données n’est pas configurée/);
});

test('mapAdminSalonRow does not invent contact, metrics or organisation for a real salon', () => {
  const row = mapAdminSalonRow(rawSalonRow);
  assert.equal(row.id, 'real-1');
  assert.equal(row.name, 'Salon réel test');
  assert.equal(row.isPublished, true);
  assert.equal(row.isVerified, true);
  assert.equal(row.phone, '');
  assert.equal(row.email, undefined);
  assert.equal(row.organizationName, '');
  assert.equal(row.planName, 'Pro Équipe');
  assert.equal(row.priceAtSubscription, 35000);
  assert.equal(row.subscriptionStatus, 'active');
  assert.equal(row.currentPeriodEnd, '2026-12-10T10:00:00Z');
  assert.equal(row.latestPayment?.reference, 'MM-2026-01');
  assert.equal(row.appointmentsCount, undefined);
  assert.equal(row.totalRevenueXof, undefined);
});

test('a salon without subscription data shows missing fields (undefined/null), not 0 or calculated dates', () => {
  const row = mapAdminSalonRow({ id: 'x', name: 'Sans formule' });
  assert.equal(row.planName, '');
  assert.equal(row.planId, '');
  assert.equal(row.priceAtSubscription, undefined);
  assert.equal(row.subscriptionStatus, undefined);
  assert.equal(row.subscriptionBillingPeriod, undefined);
  assert.equal(row.currentPeriodEnd, undefined);
  assert.equal(row.latestPayment, null);
  assert.equal(row.pendingSubscription, null);
  assert.equal(row.isPublished, false);
  assert.equal(row.isVerified, false);

  // Même si un brouillon/demande en attente portait une date technique, aucune échéance n'est exposée
  const pendingRow = mapAdminSalonRow({
    id: 'p',
    name: 'En attente',
    subscription_plan_id: 'starter',
    subscription_plan_name: 'Starter Solo',
    subscription_status: 'pending_payment',
    subscription_price_xof: 15000,
    subscription_current_period_end: '2026-11-10T10:00:00Z',
  });
  assert.equal(pendingRow.currentPeriodEnd, undefined);
});

test('administration subscription code contains no OFFICIAL_PLANS, no +25d date calculation and no local override', async () => {
  const files = [
    '../src/lib/superadmin.ts',
    '../src/components/admin/AdminDashboard.tsx',
    '../src/components/admin/AdminOverviewPanel.tsx',
    '../src/components/admin/AdminSubscriptionsPanel.tsx',
    '../src/components/admin/SalonManagement.tsx',
  ];
  for (const rel of files) {
    const source = await readFile(new URL(rel, import.meta.url), 'utf8');
    assert.equal(source.includes('OFFICIAL_PLANS'), false, `OFFICIAL_PLANS présent dans ${rel}`);
    assert.equal(source.includes('86400000'), false, `calcul +25j présent dans ${rel}`);
    assert.equal(source.includes('updateSalonAdminOverride'), false, `override local présent dans ${rel}`);
    assert.equal(
      source.includes('assignSalonSubscriptionByAdmin'),
      false,
      `contournement de forfait présent dans ${rel}`,
    );
  }
});

test('known invented values from the former fallbacks never reach the mapped admin row', () => {
  const serialized = JSON.stringify(mapAdminSalonRow(rawSalonRow));
  for (const forbidden of ['Palace', 'Empire Cuts', 'Roi du Dégradé', '1120000', '185000', '142']) {
    assert.equal(serialized.includes(forbidden), false, `valeur inventée détectée : ${forbidden}`);
  }
});

test('platform metrics return null without a configured backend (no fallback figures)', async () => {
  assert.equal(await getPlatformMetrics(), null);
  const emptyMapped = mapPlatformMetricsRow({});
  assert.equal(emptyMapped.estimatedMrrXof, 0);
  assert.equal(emptyMapped.completedAppointments, 0);
  assert.equal(emptyMapped.cancelledAppointments, 0);
  assert.equal(emptyMapped.refundsXof, 0);
  assert.equal(emptyMapped.pendingPaymentsXof, 0);
});

test('demo salons are fully fictional, labelled and carry no metrics or bookable data', () => {
  assert.equal(DEMO_SALONS.length, 8);
  assert.equal(new Set(DEMO_SALONS.map((s) => s.id)).size, 8);
  for (const salon of DEMO_SALONS) {
    assert.equal(salon.isDemo, true);
    assert.ok(salon.name.startsWith('[DÉMO]'), salon.name);
    assert.equal(salon.minPrice, undefined);
    assert.equal(salon.rating, undefined);
    assert.equal(salon.reviewCount, undefined);
    assert.equal(salon.nextAvailableSlot, undefined);
    assert.equal(salon.coverImage, undefined);
    assert.equal(salon.isVerified, false);
  }
});

test('demo marketplace content is labelled and free of metrics, payment or promise claims', async () => {
  const { DEMO_DATA } = await import('../src/lib/marketplace-demo');
  const labelled = (text: string) => text.includes('[DÉMO]') || text.includes('fictif');
  const texts: string[] = [
    ...DEMO_DATA.content.trustItems.map((item) => item.title),
    ...DEMO_DATA.content.steps.map((step) => step.title),
    ...DEMO_DATA.content.faqs.map((faq) => faq.question),
    ...DEMO_DATA.content.featuredSections.map((section) => section.title),
    ...DEMO_DATA.content.customSections.map((section) => section.title),
    DEMO_DATA.content.promoBanner.title,
    DEMO_DATA.content.proCta.title,
    ...DEMO_DATA.testimonials.map((t) => t.comment),
  ];
  for (const text of texts) {
    assert.ok(labelled(text), `contenu non étiqueté : ${text}`);
  }
  const serialized = JSON.stringify({ content: DEMO_DATA.content, testimonials: DEMO_DATA.testimonials });
  assert.equal(
    /\d\s?\d{3}\+|\d+\s?%|FCFA|Wave|Orange Money|MoMo|Moov/i.test(serialized),
    false,
    'donnée chiffrée ou moyen de paiement détecté',
  );
  assert.equal(DEMO_DATA.testimonials.length >= 4, true);
  assert.equal(DEMO_DATA.content.customSections[0].items.length, 3);
});

test('default public marketplace content carries no unverified metrics, contest or payment promises', async () => {
  const { DEFAULT_MARKETPLACE_CONTENT } = await import('../src/lib/marketplace-content');
  const serialized = JSON.stringify({
    trustItems: DEFAULT_MARKETPLACE_CONTENT.trustItems,
    steps: DEFAULT_MARKETPLACE_CONTENT.steps,
    faqs: DEFAULT_MARKETPLACE_CONTENT.faqs,
    proCta: DEFAULT_MARKETPLACE_CONTENT.proCta,
    promoBanner: DEFAULT_MARKETPLACE_CONTENT.promoBanner,
    customSections: DEFAULT_MARKETPLACE_CONTENT.customSections,
  });
  assert.equal(
    /\d\s?\d{3}\+|\d+\s?%|Concours|Wave|Orange Money|MoMo|Moov|Certifiés|Stérilisation/i.test(serialized),
    false,
  );
  assert.equal(DEFAULT_MARKETPLACE_CONTENT.promoBanner.enabled, false);
  assert.deepEqual(DEFAULT_MARKETPLACE_CONTENT.customSections, []);
});

test('demo salon detail is fictional and labelled, with no rating, review or availability invented', async () => {
  const { buildDemoSalonDetail, DEMO_SALONS } = await import('../src/lib/marketplace-demo');
  const detail = buildDemoSalonDetail(DEMO_SALONS[0]);
  assert.equal(detail.rating, null);
  assert.equal(detail.reviewCount, 0);
  assert.deepEqual(detail.reviews, []);
  assert.equal(detail.services.length, 3);
  for (const service of detail.services) {
    assert.ok(service.name.startsWith('[DÉMO]'), service.name);
    assert.equal(service.salonId, DEMO_SALONS[0].id);
  }
  for (const member of detail.staff) assert.ok(member.name.startsWith('[DÉMO]'), member.name);
  for (const branch of detail.branches) assert.ok(branch.name.startsWith('[DÉMO]'), branch.name);
  assert.equal(detail.minPrice, Math.min(...detail.services.map((service) => service.price)));
});
