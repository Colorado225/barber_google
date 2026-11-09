import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapPlatformSalon, type PlatformSalonRow } from '../src/lib/platform-admin';
import { getPlatformMetrics } from '../src/lib/saas';
import { DEMO_SALONS } from '../src/lib/marketplace-demo';

/** Ligne telle que renvoyée par la RPC `platform_list_salons`. */
function dbRow(patch: Partial<PlatformSalonRow> = {}): PlatformSalonRow {
  return {
    id: 'real-1',
    name: 'Salon réel test',
    organization_name: null,
    city: 'Abidjan',
    commune: 'Cocody',
    is_published: true,
    is_verified: true,
    platform_status: 'active',
    platform_status_reason: null,
    publication_date: null,
    plan_id: 'pro',
    plan_name: 'Pro Équipe',
    price_at_subscription: 35000,
    billing_period: 'monthly',
    subscription_status: 'active',
    current_period_end: '2026-12-09T00:00:00Z',
    ...patch,
  };
}

test('admin list maps only the rows received from the database (one entry per row, no invented rows)', () => {
  const rows = [dbRow(), dbRow({ id: 'real-2', name: 'Salon réel 2' })];
  const mapped = rows.map(mapPlatformSalon);
  assert.equal(mapped.length, rows.length);
  assert.deepEqual(
    mapped.map((s) => s.id),
    ['real-1', 'real-2'],
  );
});

test('admin list does not invent contact, plan, metrics or organisation for a real salon', () => {
  const row = mapPlatformSalon(dbRow());
  assert.equal(row.id, 'real-1');
  assert.equal(row.name, 'Salon réel test');
  assert.equal(row.isPublished, true);
  assert.equal(row.isVerified, true);
  assert.equal(row.phone, '');
  assert.equal(row.email, undefined);
  assert.equal(row.organizationName, '');
  assert.equal(row.planName, 'Pro Équipe');
  assert.equal(row.priceAtSubscription, 35000);
  assert.equal(row.appointmentsCount, undefined);
  assert.equal(row.totalRevenueXof, undefined);
});

test('a salon without subscription shows an empty plan and no renewal date, not a default one', () => {
  const row = mapPlatformSalon(
    dbRow({
      plan_id: null,
      plan_name: null,
      price_at_subscription: null,
      subscription_status: null,
      current_period_end: null,
      is_published: false,
      is_verified: false,
    }),
  );
  assert.equal(row.planName, '');
  assert.equal(row.planId, '');
  assert.equal(row.priceAtSubscription, 0);
  assert.equal(row.subscriptionStatus, undefined);
  assert.equal(row.currentPeriodEnd, undefined);
  assert.equal(row.isPublished, false);
  assert.equal(row.isVerified, false);
});

test('known invented values from the former fallbacks never reach the admin list', () => {
  const serialized = JSON.stringify(mapPlatformSalon(dbRow()));
  for (const forbidden of ['Palace', 'Empire Cuts', 'Roi du Dégradé', '1120000', '185000', '142']) {
    assert.equal(serialized.includes(forbidden), false, `valeur inventée détectée : ${forbidden}`);
  }
});

test('platform metrics return null without a configured backend (no fallback figures)', async () => {
  assert.equal(await getPlatformMetrics(), null);
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
