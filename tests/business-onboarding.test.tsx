import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import {
  AppProvider,
  INITIAL_APPOINTMENTS,
  INITIAL_CLIENTS,
  INITIAL_EXPENSES,
  INITIAL_LOYALTY_REWARDS,
  INITIAL_LOYALTY_TRANSACTIONS,
  INITIAL_REVIEWS,
  INITIAL_SALONS,
  INITIAL_SERVICES,
  INITIAL_STAFF,
  INITIAL_STOCKS,
  INITIAL_TRANSACTIONS,
} from '../src/context/AppContext';
import { getSupabaseClient, isSupabaseConfigured } from '../src/lib/supabase';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { render, screen, cleanup } = await import('@testing-library/react');

test('les données initiales métier sont vides', () => {
  const initialCollections = [
    INITIAL_SALONS,
    INITIAL_SERVICES,
    INITIAL_STAFF,
    INITIAL_APPOINTMENTS,
    INITIAL_CLIENTS,
    INITIAL_TRANSACTIONS,
    INITIAL_EXPENSES,
    INITIAL_STOCKS,
    INITIAL_REVIEWS,
    INITIAL_LOYALTY_REWARDS,
    INITIAL_LOYALTY_TRANSACTIONS,
  ];
  assert.ok(initialCollections.every((collection) => collection.length === 0));
});

test('la marketplace affiche un état vide plutôt que des salons fictifs', () => {
  render(
    <AppProvider>
      <MemoryRouter>
        <MarketplaceHome />
      </MemoryRouter>
    </AppProvider>,
  );
  assert.ok(screen.getByText('Aucun salon réel n’est actuellement publié dans la marketplace.'));
  cleanup();
});

test('le client Supabase signale une configuration absente', () => {
  if (!isSupabaseConfigured()) {
    assert.throws(
      () => getSupabaseClient(),
      /Supabase is not configured\. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\./,
    );
  }
});
