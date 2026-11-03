import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';

const key = 'barber_cuts_state_v1_isRegisteredInErp';
function renderMarketplace(registration?: boolean) {
  const store = new Map<string, string>();
  if (registration !== undefined) store.set(key, JSON.stringify(registration));
  globalThis.localStorage = {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => { store.set(name, value); },
    removeItem: (name: string) => { store.delete(name); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  return renderToStaticMarkup(<App />);
}

test('visiteur par défaut et non inscrit : navigation privée masquée, inscription disponible', () => {
  for (const registered of [undefined, false]) {
    const html = renderMarketplace(registered);
    for (const label of ['Mes réservations', 'Pour les professionnels', 'Admin Total', "Accéder à l&#x27;ERP Pro", 'Barber Cuts Business ERP', 'Tarifs &amp; Formules SaaS']) {
      assert.ok(!html.includes(label), `Visible à tort : ${label}`);
    }
    assert.ok(html.includes('Inscrire mon salon'));
    assert.ok(html.includes('Explorer'));
  }
});

test('utilisateur inscrit : les accès restent disponibles', () => {
  const html = renderMarketplace(true);
  assert.ok(html.includes('Mes réservations'));
  assert.ok(html.includes('Pour les professionnels'));
  assert.ok(html.includes('Admin Total'));
  assert.ok(html.includes('Barber Cuts Business ERP'));
});
