import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import App from '../src/App';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { render, fireEvent, screen, within, cleanup } = await import('@testing-library/react');

test('parcours de démonstration : données saisies, validation et dashboard privé', async () => {
  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Inscrire mon salon' })[0]);
  assert.ok(screen.getByText(/Aucun compte réel n’est créé/));
  fireEvent.change(screen.getByLabelText('Votre nom'), { target: { value: 'Awa Kouassi' } });
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'awa@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuer en démonstration/ }));
  fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
  assert.ok(screen.getByRole('alert').textContent?.includes('nom'));
  fireEvent.change(screen.getByLabelText(/Nom du salon/), { target: { value: 'Salon Awa' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
  fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '0700000000' } });
  fireEvent.change(screen.getByLabelText(/Commune/), { target: { value: 'Marcory' } });
  fireEvent.change(screen.getByLabelText(/Adresse \*/), { target: { value: 'Rue du marché' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
  fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'tresses' } });
  fireEvent.change(screen.getByLabelText(/Première prestation/), { target: { value: 'Tresses' } });
  fireEvent.change(screen.getByLabelText(/Prix/), { target: { value: '7000' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
  fireEvent.click(screen.getByRole('button', { name: /Valider la configuration/ }));
  assert.ok(screen.getByText('Configuration validée'));
  fireEvent.click(screen.getByRole('button', { name: /Découvrir mon tableau de bord/ }));
  assert.ok(screen.getByText('Bienvenue, Awa.'));
  assert.ok(screen.getByText('Tresses'));
  assert.ok(screen.getByText(/Marcory, Abidjan/));
  const salons = JSON.parse(localStorage.getItem('barber_cuts_state_v1_salons')!);
  const salon = salons.find((item: { name: string }) => item.name === 'Salon Awa');
  assert.equal(salon.isPublishedOnMarketplace, false);
  const services = JSON.parse(localStorage.getItem('barber_cuts_state_v1_services')!);
  assert.equal(services.find((item: { salonId: string }) => item.salonId === salon.id).category, 'tresses');
  cleanup();
});

test('connexion réelle indisponible et aucun mot de passe demandé', () => {
  localStorage.clear();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Connexion' }));
  const dialog = screen.getByRole('dialog');
  assert.ok(within(dialog).getByText(/Connexion indisponible/));
  assert.ok((within(dialog).getByLabelText('Mot de passe') as HTMLInputElement).disabled);
  cleanup();
});
