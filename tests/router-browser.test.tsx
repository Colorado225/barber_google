import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRouter } from '../src/router';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
});
const win = dom.window as unknown as Window & typeof globalThis;
for (const name of [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'HTMLElement',
  'Node',
  'CustomEvent',
] as const) {
  Object.defineProperty(globalThis, name, {
    value: name === 'window' ? win : win[name],
    configurable: true,
    writable: true,
  });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');

test('le routeur navigateur charge les routes publiques et protège l’ERP', async () => {
  window.history.replaceState({}, '', '/');
  const view = render(
    <AuthProvider>
      <AppRouter />
    </AuthProvider>,
  );
  try {
    assert.ok(await screen.findByTestId('marketplace-header-search'));
    window.history.pushState({}, '', '/mes-reservations');
    fireEvent(window, new window.PopStateEvent('popstate'));
    assert.ok(await screen.findByRole('heading', { name: 'Mes réservations' }));
    window.history.pushState({}, '', '/app/');
    fireEvent(window, new window.PopStateEvent('popstate'));
    assert.ok(await screen.findByRole('heading', { name: 'Connexion requise' }));
    fireEvent.click(screen.getByRole('link', { name: /Se connecter/ }));
    await waitFor(() => assert.equal(window.location.pathname, '/connexion'));
  } finally {
    view.unmount();
    cleanup();
  }
});
