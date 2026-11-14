import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { JSDOM } from 'jsdom';
import { ESLint } from 'eslint';
import { AppProvider, useOptionalApp } from '../src/context/AppContext';
import { ToastContainer } from '../src/components/common/ToastContainer';
import { UIProvider, useUI } from '../src/context/UIContext';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const win = dom.window as unknown as Window & typeof globalThis;
Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
Object.defineProperty(globalThis, 'document', { value: win.document, configurable: true, writable: true });
Object.defineProperty(globalThis, 'localStorage', {
  value: win.localStorage,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: win.sessionStorage,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: win.navigator,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', {
  value: win.HTMLElement,
  configurable: true,
  writable: true,
});

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');

test('ESLint vérifie réellement les fichiers TypeScript et React Hooks', async () => {
  const eslint = new ESLint();
  const tsxResults = await eslint.lintText(
    `import React, { useState } from 'react';
export function BadComponent({ flag }: { flag: boolean }) {
  if (flag) {
    useState(0);
  }
  const unusedVar = 42;
  return <div>ok</div>;
}
`,
    { filePath: 'src/components/__probe__.tsx' },
  );

  const ruleIds = new Set(tsxResults[0].messages.map((m) => m.ruleId));
  assert.ok(ruleIds.has('react-hooks/rules-of-hooks'));
  assert.ok(ruleIds.has('@typescript-eslint/no-unused-vars'));
});

test('CI et package.json ont supprimé le contournement --legacy-peer-deps', async () => {
  const ciYml = await readFile('.github/workflows/ci.yml', 'utf8');
  assert.ok(!ciYml.includes('--legacy-peer-deps'));
  assert.match(ciYml, /\brun:\s*npm ci\b/);

  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as {
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  assert.ok(pkg.devDependencies['typescript-eslint']);
  assert.match(pkg.devDependencies.typescript, /^\^?6\./);
  assert.match(pkg.scripts.lint, /^eslint \./);
});

test('ToastContainer reste sans erreur hors AppProvider et affiche/ferme les toasts dans AppProvider', async () => {
  try {
    const empty = render(<ToastContainer />);
    assert.equal(empty.container.innerHTML, '');
    cleanup();

    function ToastTrigger() {
      const { addToast } = useOptionalApp();
      return (
        <button type="button" onClick={() => addToast('Configuration ESLint TS active', 'success')}>
          Déclencher
        </button>
      );
    }

    const mounted = render(
      <AppProvider>
        <ToastTrigger />
        <ToastContainer />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText('Déclencher'));
    assert.ok(screen.getByText('Configuration ESLint TS active'));

    const closeBtn = mounted.container.querySelector('div.fixed button');
    assert.ok(closeBtn);
    fireEvent.click(closeBtn);
    assert.equal(screen.queryByText('Configuration ESLint TS active'), null);
  } finally {
    cleanup();
  }
});

test('Configuration héritée nettoyée (.env.example, vite.config.ts) et documentation réconciliée présente', async () => {
  const envExample = await readFile('.env.example', 'utf8');
  for (const legacy of ['APP_ORIGIN', 'AUTH_EXPOSE_TOKENS', 'AUTH_PORT', 'DATABASE_URL', 'SESSION_TTL_MS']) {
    assert.ok(!envExample.includes(legacy), `Variable héritée inattendue : ${legacy}`);
  }
  for (const currentVar of [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_MARKETPLACE_DEMO',
    'VITE_PUBLIC_SITE_URL',
  ]) {
    assert.ok(envExample.includes(currentVar), `Variable attendue manquante : ${currentVar}`);
  }

  const viteConfig = await readFile('vite.config.ts', 'utf8');
  assert.ok(!viteConfig.includes('127.0.0.1:3001'));
  assert.ok(!viteConfig.includes("'/api'"));

  const readme = await readFile('README.md', 'utf8');
  const backlog = await readFile('docs/AMELIORATIONS.md', 'utf8');
  const prodChecklist = await readFile('docs/CONFIGURATION-PRODUCTION.md', 'utf8');
  assert.ok(readme.includes('docs/CONFIGURATION-PRODUCTION.md'));
  assert.ok(backlog.includes('livré') && backlog.includes('bloqué par configuration'));
  assert.ok(prodChecklist.includes('salon-seo') && prodChecklist.includes('notifications-dispatcher'));
});

test('les toasts fonctionnent avec UIProvider seul, sans charger le fournisseur ERP', () => {
  function Trigger() {
    const { addToast } = useUI();
    return <button onClick={() => addToast('Toast isolé', 'info')}>Ajouter</button>;
  }
  try {
    render(
      <UIProvider>
        <Trigger />
        <ToastContainer />
      </UIProvider>,
    );
    fireEvent.click(screen.getByText('Ajouter'));
    assert.ok(screen.getByText('Toast isolé'));
  } finally {
    cleanup();
  }
});
