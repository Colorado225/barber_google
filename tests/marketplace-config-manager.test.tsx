import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import {
  DEFAULT_MARKETPLACE_CONTENT,
  getMarketplaceContent,
  resetMarketplaceContent,
  saveMarketplaceContent,
  subscribeMarketplaceContent,
  type MarketplaceContentConfig,
} from '../src/lib/marketplace-content';
import * as superadmin from '../src/lib/superadmin';
import { isSalonLiveOnMarketplace } from '../src/lib/superadmin';
import { AppProvider } from '../src/context/AppContext';
import App from '../src/App';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { MarketplaceConfigManager } from '../src/components/admin/MarketplaceConfigManager';
import { MarketplaceSectionsAdmin } from '../src/components/admin/MarketplaceSectionsAdmin';

const ADMIN = 'admin@barbercuts.com';

/** Stockage en mémoire (les modules lisent le localStorage global). */
function installStorage() {
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
  };
}

/** window minimal (EventTarget natif) pour le rendu serveur et les événements. */
function installServerWindow() {
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { pathname: '/', search: '', hash: '' },
  });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
}

function withConfig(patch: Partial<MarketplaceContentConfig>): MarketplaceContentConfig {
  return { ...getMarketplaceContent(), ...patch };
}

test('store : valeurs par défaut neutres et compatibilité avec une ancienne configuration', () => {
  installStorage();
  installServerWindow();

  assert.equal(
    DEFAULT_MARKETPLACE_CONTENT.announcement.enabled,
    false,
    'Le bandeau est désactivé par défaut',
  );
  assert.deepEqual(DEFAULT_MARKETPLACE_CONTENT.featuredSections, [], 'Aucune section à la une inventée');
  assert.equal(DEFAULT_MARKETPLACE_CONTENT.siteMetadata.siteName, 'BarberCuts');

  // Configuration enregistrée avant l'ajout des nouveaux blocs : les champs manquants sont complétés.
  const legacy = { hero: { headlineMain: 'Ancien titre' }, navTabs: DEFAULT_MARKETPLACE_CONTENT.navTabs };
  globalThis.localStorage.setItem('barbercuts_marketplace_content_config', JSON.stringify(legacy));
  const loaded = getMarketplaceContent();
  assert.equal(loaded.hero.headlineMain, 'Ancien titre');
  assert.equal(loaded.announcement.enabled, false);
  assert.deepEqual(loaded.featuredSections, []);
  assert.equal(loaded.siteMetadata.metaTitle, DEFAULT_MARKETPLACE_CONTENT.siteMetadata.metaTitle);
});

test('store : abonnement synchrone, référence stable et réinitialisation notifiée', () => {
  installStorage();
  installServerWindow();

  const seenHeadlines: string[] = [];
  const unsubscribe = subscribeMarketplaceContent(() => {
    seenHeadlines.push(getMarketplaceContent().hero.headlineMain);
  });

  const current = getMarketplaceContent();
  assert.equal(getMarketplaceContent(), current, 'Deux lectures sans changement renvoient la même référence');

  saveMarketplaceContent(withConfig({ hero: { ...current.hero, headlineMain: 'Titre mis à jour' } }), ADMIN);
  // La notification est synchrone : l'abonné voit la nouvelle valeur dès le retour de l'enregistrement.
  assert.deepEqual(seenHeadlines, ['Titre mis à jour']);
  assert.equal(getMarketplaceContent().hero.headlineMain, 'Titre mis à jour');

  resetMarketplaceContent(ADMIN);
  assert.equal(seenHeadlines.at(-1), DEFAULT_MARKETPLACE_CONTENT.hero.headlineMain);

  unsubscribe();
  saveMarketplaceContent(
    withConfig({ hero: { ...current.hero, headlineMain: 'Après désabonnement' } }),
    ADMIN,
  );
  assert.equal(seenHeadlines.length, 2, 'Un abonné désinscrit ne reçoit plus de notification');
});

test('marketplace : bandeau d’annonce, sections à la une (ordre, visibilité) et métadonnées rendus', () => {
  installStorage();
  installServerWindow();

  saveMarketplaceContent(
    withConfig({
      announcement: { enabled: true, text: 'Promo de test', linkLabel: 'Voir', linkUrl: '/tarifs' },
      featuredSections: [
        {
          id: 'f-a',
          eyebrow: 'Test',
          title: 'Section Alpha',
          description: 'Description alpha',
          ctaLabel: 'Aller',
          ctaLink: '#salons-section',
          theme: 'gold',
          isVisible: true,
          order: 2,
        },
        {
          id: 'f-b',
          eyebrow: '',
          title: 'Section Bravo',
          description: '',
          ctaLabel: '',
          ctaLink: '',
          theme: 'emerald',
          isVisible: true,
          order: 1,
        },
        {
          id: 'f-c',
          eyebrow: '',
          title: 'Section Cachee',
          description: '',
          ctaLabel: '',
          ctaLink: '',
          theme: 'dark',
          isVisible: false,
          order: 3,
        },
      ],
      siteMetadata: {
        ...getMarketplaceContent().siteMetadata,
        copyrightText: 'Copyright Test 2026',
        contactEmail: 'contact@test.ci',
        instagramUrl: 'https://instagram.com/test',
      },
    }),
    ADMIN,
  );

  const page = renderToStaticMarkup(
    <AppProvider>
      <App />
    </AppProvider>,
  );

  assert.ok(page.includes('Promo de test'), 'Le bandeau d’annonce global est rendu');
  assert.ok(page.includes('href="/tarifs"'), 'Le lien du bandeau est rendu');

  const home = renderToStaticMarkup(
    <AppProvider>
      <MarketplaceHome />
    </AppProvider>,
  );
  assert.ok(home.includes('aria-label="Sections à la une"'), 'La zone « à la une » est rendue');
  assert.ok(home.indexOf('Section Bravo') < home.indexOf('Section Alpha'), 'Ordre d’affichage respecté');
  assert.ok(!home.includes('Section Cachee'), 'Une section masquée n’est pas affichée');
  assert.ok(home.includes('Copyright Test 2026'), 'Le copyright vient des métadonnées');
  assert.ok(home.includes('contact@test.ci'), 'L’e-mail de contact est affiché');
  assert.ok(home.includes('https://instagram.com/test'), 'Le lien réseau social est affiché');
});

test('marketplace : sans section à la une ni bandeau, aucun bloc vide n’est rendu', () => {
  installStorage();
  installServerWindow();
  resetMarketplaceContent(ADMIN);

  const home = renderToStaticMarkup(
    <AppProvider>
      <MarketplaceHome />
    </AppProvider>,
  );
  assert.ok(!home.includes('aria-label="Sections à la une"'));
  assert.ok(!home.includes('aria-label="Annonce"'));
});

test('superadmin : aucune décision locale ne modifie la visibilité publique (la base est la source)', () => {
  installStorage();
  installServerWindow();

  // Les anciennes surcharges localStorage ne sont plus lues ni exportées.
  assert.equal('applySalonAdminOverrides' in superadmin, false);
  assert.equal('updateSalonByAdmin' in superadmin, false);
  assert.equal('getSalonAdminOverrides' in superadmin, false);

  assert.equal(isSalonLiveOnMarketplace({ isPublished: true, status: 'suspended' }), false);
  assert.equal(isSalonLiveOnMarketplace({ isPublished: true, status: 'active' }), true);
  assert.equal(isSalonLiveOnMarketplace({ isPublished: false, status: 'active' }), false);
});

test('gestionnaire : formulaires pré-remplis depuis la configuration courante', () => {
  installStorage();
  installServerWindow();

  saveMarketplaceContent(
    withConfig({
      hero: { ...getMarketplaceContent().hero, headlineMain: 'Titre Pre Rempli' },
    }),
    ADMIN,
  );

  const html = renderToStaticMarkup(
    <AppProvider>
      <MarketplaceConfigManager adminEmail={ADMIN} />
    </AppProvider>,
  );
  assert.ok(html.includes('Bannières, Sections à la une'), 'Titre du gestionnaire rendu');
  assert.ok(html.includes('role="tablist"'), 'Sous-onglets accessibles');
  assert.ok(html.includes('Enregistrer les bannières'));
  assert.ok(html.includes('value="Titre Pre Rempli"'), 'Le titre Hero est pré-rempli depuis le store');
});

test('gestionnaire : une modification enregistrée est visible en direct par les autres consommateurs (DOM réel)', async () => {
  installStorage();
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });
  const win = dom.window as unknown as Window & typeof globalThis;
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: win.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: win.CustomEvent,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'StorageEvent', {
    value: win.StorageEvent,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: win.navigator,
    configurable: true,
    writable: true,
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { useMarketplaceContent } = await import('../src/lib/marketplace-content');

  // Consommateur indépendant (comme la navbar ou la marketplace) : il doit se mettre à jour seul.
  const Probe = () => {
    const { config } = useMarketplaceContent();
    return (
      <div>
        <p data-testid="probe-name">{config.siteMetadata.siteName}</p>
        <p data-testid="probe-featured">{config.featuredSections.length}</p>
      </div>
    );
  };

  const container = win.document.getElementById('root');
  assert.ok(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <AppProvider>
        <Probe />
        <MarketplaceConfigManager adminEmail={ADMIN} />
      </AppProvider>,
    );
  });

  const doc = win.document;
  const findButton = (text: string) =>
    [...doc.querySelectorAll('button')].find((button) => button.textContent?.includes(text));
  const setInputValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const prototype =
      element instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement : win.HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set;
    assert.ok(setter);
    setter.call(element, value);
    element.dispatchEvent(new win.Event('input', { bubbles: true }));
  };

  assert.equal(doc.querySelector('[data-testid="probe-name"]')?.textContent, 'BarberCuts');

  // 1. Métadonnées : nom du site modifié et enregistré
  await act(async () => {
    findButton('3. Métadonnées du site')?.click();
  });
  const siteName = doc.getElementById('mcm-meta-site-name') as HTMLInputElement;
  await act(async () => {
    setInputValue(siteName, 'Salon Live Test');
  });
  await act(async () => {
    findButton('Enregistrer les métadonnées')?.click();
  });
  assert.equal(
    doc.querySelector('[data-testid="probe-name"]')?.textContent,
    'Salon Live Test',
    'Le consommateur indépendant reflète la modification sans rechargement',
  );
  assert.equal(getMarketplaceContent().siteMetadata.siteName, 'Salon Live Test');

  // 2. Sections à la une : création puis enregistrement
  await act(async () => {
    findButton('2. Sections à la une')?.click();
  });
  await act(async () => {
    findButton('Ajouter une section')?.click();
  });
  await act(async () => {
    findButton('Enregistrer les sections')?.click();
  });
  assert.equal(doc.querySelector('[data-testid="probe-featured"]')?.textContent, '1');
  assert.equal(getMarketplaceContent().featuredSections.length, 1);

  // 3. Bannière : une annonce activée avec un texte apparaît dans la configuration partagée
  await act(async () => {
    findButton('1. Bannières')?.click();
  });
  const announcementToggle = doc.getElementById('mcm-announcement-enabled') as HTMLInputElement;
  await act(async () => {
    announcementToggle.click();
  });
  const announcementText = doc.getElementById('mcm-announcement-text') as HTMLInputElement;
  await act(async () => {
    setInputValue(announcementText, 'Nouveaux créneaux disponibles');
  });
  await act(async () => {
    findButton('Enregistrer les bannières')?.click();
  });
  assert.equal(getMarketplaceContent().announcement.enabled, true);
  assert.equal(getMarketplaceContent().announcement.text, 'Nouveaux créneaux disponibles');

  await act(async () => {
    root.unmount();
  });
  win.close();
});

test('métadonnées : le titre n’est pas écrasé sur les pages /admin', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><head><title>Console Admin</title></head><body></body></html>',
    {
      url: 'http://localhost/admin/dashboard',
    },
  );
  const win = dom.window as unknown as Window & typeof globalThis;
  Object.defineProperty(globalThis, 'document', { value: win.document, configurable: true, writable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { useSiteMetadata } = await import('../src/hooks/useSiteMetadata');

  const Probe: React.FC<{ skip: boolean }> = ({ skip }) => {
    useSiteMetadata({ metaTitle: 'Titre Marketplace', metaDescription: 'Desc' }, { skip });
    return null;
  };

  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Probe skip />);
  });
  assert.equal(win.document.title, 'Console Admin', 'Sur /admin le titre d’administration est conservé');

  await act(async () => {
    root.render(<Probe skip={false} />);
  });
  assert.equal(win.document.title, 'Titre Marketplace', 'Hors admin le titre configuré est appliqué');

  await act(async () => {
    root.unmount();
  });
  win.close();
});

test('sections : hero, promo et CTA Pro ne sont plus éditables ici et ne sont jamais écrasés à la sauvegarde', async () => {
  installStorage();
  installServerWindow();
  resetMarketplaceContent(ADMIN);

  const html = renderToStaticMarkup(
    <AppProvider>
      <MarketplaceSectionsAdmin adminEmail={ADMIN} />
    </AppProvider>,
  );
  assert.ok(
    !html.includes('1. Hero &amp; Accroche') && !html.includes('1. Hero & Accroche'),
    'Plus d’onglet Hero',
  );
  assert.ok(!html.includes('Bannière Business Pro'), 'Plus d’onglet CTA Pro');
  assert.ok(
    html.includes('Bannières &amp; Métadonnées') || html.includes('Bannières & Métadonnées'),
    'Renvoi vers le gestionnaire',
  );

  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  });
  const win = dom.window as unknown as Window & typeof globalThis;
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: win.document, configurable: true, writable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const container = win.document.getElementById('root');
  assert.ok(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AppProvider>
        <MarketplaceSectionsAdmin adminEmail={ADMIN} />
      </AppProvider>,
    );
  });

  // Modification du hero faite ailleurs (gestionnaire Bannières) pendant que l'onglet Sections est ouvert.
  await act(async () => {
    saveMarketplaceContent(
      withConfig({ hero: { ...getMarketplaceContent().hero, headlineMain: 'Hero modifié ailleurs' } }),
      ADMIN,
    );
  });

  const saveButton = [...win.document.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Enregistrer & Publier'),
  );
  assert.ok(saveButton, 'Bouton d’enregistrement présent');
  await act(async () => {
    saveButton.click();
  });

  assert.equal(
    getMarketplaceContent().hero.headlineMain,
    'Hero modifié ailleurs',
    'La sauvegarde Sections conserve le hero courant du store',
  );

  await act(async () => {
    root.unmount();
  });
  win.close();
});
