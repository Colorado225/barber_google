import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppProvider } from '../src/context/AppContext';
import { PricingTierEditor } from '../src/components/admin/PricingTierEditor';
import { getAllSaasPlans, getSaasPlans, saveSaasPlanWorkflow, type SaaSPlanInput } from '../src/lib/saas';
import type { SaaSPlan } from '../src/types';

/** Stockage en mémoire et window minimal : les modules lisent le localStorage global. */
function installBrowserStubs() {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { pathname: '/admin', search: '', hash: '' },
  });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
}

installBrowserStubs();

const starter: SaaSPlan = {
  id: 'starter',
  name: 'Starter Solo',
  slug: 'starter',
  priceXof: 15000,
  billingPeriod: 'monthly',
  description: 'Forfait de test.',
  features: ['1 barbier / 1 fauteuil'],
  maxStaff: 1,
  maxBranches: 1,
  isPopular: false,
  isActive: true,
  badgeText: null,
  displayOrder: 1,
};

function render(element: React.ReactElement) {
  return renderToStaticMarkup(<AppProvider>{element}</AppProvider>);
}

const noop = () => {};

test('éditeur : nouveau forfait publié immédiatement par défaut, avec interrupteur explicite', () => {
  const html = render(
    <PricingTierEditor plan={null} pendingDraft={null} nextDisplayOrder={4} onClose={noop} onSaved={noop} />,
  );
  assert.ok(html.includes('Nouveau Forfait'), 'Titre du nouveau forfait');
  assert.ok(html.includes('Publier immédiatement sur la page Tarifs'), 'Interrupteur de publication présent');
  assert.match(html, /role="switch"[^>]*checked=""/, 'Publication immédiate activée par défaut');
  assert.ok(html.includes('Publier le forfait'), 'Le bouton annonce une publication');
  assert.ok(html.includes('value="3"'), 'Quota de coiffeurs par défaut conservé');
  assert.ok(!html.includes('Un brouillon est en attente'), 'Pas de bandeau de brouillon sans brouillon');
});

test('éditeur : un brouillon en attente pré-remplit le formulaire et le signale', () => {
  const draft: SaaSPlanInput = {
    ...starter,
    name: 'Starter Solo Plus',
    priceXof: 18500,
  };
  const html = render(
    <PricingTierEditor
      plan={starter}
      pendingDraft={draft}
      nextDisplayOrder={1}
      onClose={noop}
      onSaved={noop}
    />,
  );
  assert.ok(html.includes('Modifier le brouillon « Starter Solo Plus »'), 'Le titre désigne le brouillon');
  assert.ok(
    html.includes('Un brouillon est en attente pour ce forfait'),
    'Le bandeau de brouillon est affiché',
  );
  assert.ok(html.includes('value="Starter Solo Plus"'), 'Le formulaire reprend le brouillon');
  assert.ok(html.includes('value="18500"'), 'Le prix du brouillon est repris');
  assert.ok(/id="tier-slug"[^>]*disabled/.test(html), 'L’identifiant d’un forfait existant reste verrouillé');
});

test('éditeur : forfait publié sans brouillon, sans bandeau et avec le tarif actuel', () => {
  const html = render(
    <PricingTierEditor
      plan={starter}
      pendingDraft={null}
      nextDisplayOrder={1}
      onClose={noop}
      onSaved={noop}
    />,
  );
  assert.ok(html.includes('Modifier le forfait « Starter Solo »'));
  assert.ok(html.includes('value="15000"'));
  assert.ok(!html.includes('Un brouillon est en attente'));
});

test('mode local : brouillon non publié et forfaits inactifs réservés à la console', async () => {
  const input: SaaSPlanInput = { ...starter, priceXof: 19000 };
  const status = await saveSaasPlanWorkflow(input, false);
  assert.equal(status, 'local', 'Sans Supabase, l’enregistrement reste local et le statut le dit');

  const publicPlans = await getSaasPlans();
  assert.equal(publicPlans.find((p) => p.id === 'starter')?.priceXof, 19000);

  const inactive: SaaSPlanInput = {
    ...starter,
    id: 'archive',
    slug: 'archive',
    name: 'Archive',
    isActive: false,
  };
  await saveSaasPlanWorkflow(inactive, true);
  const adminPlans = await getAllSaasPlans();
  assert.ok(
    adminPlans.some((p) => p.id === 'archive'),
    'La console voit les forfaits inactifs',
  );
  assert.ok(
    !(await getSaasPlans()).some((p) => p.id === 'archive'),
    'La page Tarifs ne voit pas les forfaits inactifs',
  );
});
