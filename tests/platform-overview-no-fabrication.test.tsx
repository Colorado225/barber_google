import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformOverview } from '../src/components/admin/PlatformOverview';
import type { PlatformOverview as Overview } from '../src/lib/platform-admin';
import { AppProvider } from '../src/context/AppContext';

// Le fournisseur de l'application lit window.location : shim minimal en Node sans DOM.
if (typeof globalThis.window === 'undefined') {
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { pathname: '/', search: '', hash: '' },
  });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
}

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(React.createElement(AppProvider, null, node));
}

const overview: Overview = {
  salons: { total: 8, published: 3, verified: 2, suspended: 1 },
  subscriptions: { active: 4, past_due: 0, pending_payment: 2, cancelled: 1, mrr_xof: 35000, expiring_7d: 1 },
  payments: { awaiting_review: 2 },
  reviews: { total: 5, hidden: 1 },
  activity_30d: {
    appointments: 12,
    appointments_completed: 7,
    appointments_upcoming_7d: 3,
    net_revenue_xof: 70000,
  },
  quota_overages: 0,
  audit_24h: 4,
};

test('vue d’ensemble sans réponse de la base : aucune valeur affichée', () => {
  const html = render(
    <PlatformOverview overview={null} loading={false} recentDecisions={[]} onNavigate={() => undefined} />,
  );
  assert.match(html, /Indicateurs indisponibles/);
  assert.doesNotMatch(html, /MRR estimé/);
  assert.doesNotMatch(html, />\s*0\s*</);
});

test('vue d’ensemble : les indicateurs viennent de la base telle que reçue', () => {
  const html = render(
    <PlatformOverview
      overview={overview}
      loading={false}
      recentDecisions={[]}
      onNavigate={() => undefined}
    />,
  );
  assert.match(html, /MRR estimé/);
  assert.match(html, />8</);
  assert.match(html, /35/);
  assert.doesNotMatch(html, /Impayés/);
});
