import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getAdminSalonsList,
  getPlatformAuditLogs,
  setSalonStatusByAdmin,
  setSalonVerificationByAdmin,
  type AdminRpcClient,
} from '../src/lib/superadmin';
import {
  getMarketplaceContent,
  saveMarketplaceContent,
  resetMarketplaceContent,
  DEFAULT_MARKETPLACE_CONTENT,
} from '../src/lib/marketplace-content';
import { MarketplaceHome } from '../src/components/marketplace/MarketplaceHome';
import { AppProvider } from '../src/context/AppContext';

// Les actions admin notifient la marketplace via window.dispatchEvent : on fournit un window minimal
// (EventTarget natif) dans cet environnement Node sans DOM.
if (typeof globalThis.window === 'undefined') {
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { pathname: '/', search: '', hash: '' },
  });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
}

// In-memory mock localStorage for SSR test environment
function setupMockLocalStorage() {
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

test('SalonManagement : consultation, certification, suspension et audit via RPC serveur', async () => {
  setupMockLocalStorage();

  const serverSalons = [
    {
      id: 'real-a',
      name: 'Salon A',
      commune: 'Cocody',
      organization_name: 'Org A',
      phone: '+22507000001',
      is_published: true,
      is_verified: false,
      status: 'active',
      subscription_plan_id: 'starter',
      subscription_plan_name: 'Starter Solo',
      subscription_price_xof: 15000,
    },
    {
      id: 'real-b',
      name: 'Salon B',
      commune: 'Plateau',
      organization_name: 'Org B',
      phone: '+22507000002',
      is_published: false,
      is_verified: false,
      status: 'active',
      subscription_plan_id: 'pro',
      subscription_plan_name: 'Pro Équipe',
      subscription_price_xof: 35000,
    },
  ];
  const serverAudit: Array<Record<string, unknown>> = [];

  const rpcClient: AdminRpcClient = {
    async rpc(fn, params = {}) {
      if (fn === 'admin_list_salons') {
        return { data: serverSalons.map((s) => ({ ...s })), error: null };
      }
      if (fn === 'admin_set_salon_verification') {
        const target = serverSalons.find((s) => s.id === params.p_salon_id);
        if (!target) return { data: null, error: { message: 'Salon introuvable.' } };
        const before = { is_verified: target.is_verified };
        target.is_verified = Boolean(params.p_verified);
        serverAudit.unshift({
          id: `audit-${serverAudit.length + 1}`,
          created_at: new Date().toISOString(),
          actor_role: 'super_admin',
          actor_email: 'dominiquek051@gmail.com',
          action: target.is_verified ? 'salon.certified' : 'salon.uncertified',
          target_type: 'salon',
          target_id: target.id,
          before_values: before,
          after_values: { is_verified: target.is_verified },
          reason: params.p_reason,
          details: { salon_name: target.name },
        });
        return { data: { ...target }, error: null };
      }
      if (fn === 'admin_set_salon_status') {
        const target = serverSalons.find((s) => s.id === params.p_salon_id);
        if (!target) return { data: null, error: { message: 'Salon introuvable.' } };
        const before = { status: target.status, is_published: target.is_published };
        target.status = params.p_status === 'suspended' ? 'suspended' : 'active';
        if (target.status === 'suspended') target.is_published = false;
        serverAudit.unshift({
          id: `audit-${serverAudit.length + 1}`,
          created_at: new Date().toISOString(),
          actor_role: 'super_admin',
          actor_email: 'dominiquek051@gmail.com',
          action: target.status === 'suspended' ? 'salon.suspended' : 'salon.reactivated',
          target_type: 'salon',
          target_id: target.id,
          before_values: before,
          after_values: { status: target.status, is_published: target.is_published },
          reason: params.p_reason,
          details: { salon_name: target.name },
        });
        return { data: { ...target }, error: null };
      }
      if (fn === 'admin_list_audit_logs') {
        return { data: serverAudit, error: null };
      }
      return { data: null, error: { message: `RPC inconnue: ${fn}` } };
    },
  };

  // 1. Consultation consolidée (inclut publiés et non-publiés)
  const salons = await getAdminSalonsList(rpcClient);
  assert.equal(salons.length, 2);
  assert.equal(salons[0].status, 'active');

  // 2. Certification officielle avec motif obligatoire
  await assert.rejects(
    setSalonVerificationByAdmin('real-a', true, ' ', rpcClient),
    /Un motif est obligatoire/,
  );
  await setSalonVerificationByAdmin('real-a', true, 'Contrôle conformité validé', rpcClient);

  // 3. Suspension d’un salon locataire
  await setSalonStatusByAdmin('real-a', 'suspended', 'Impayé critique', rpcClient);
  const reloaded = await getAdminSalonsList(rpcClient);
  const targetSuspended = reloaded.find((s) => s.id === 'real-a');
  assert.equal(targetSuspended?.status, 'suspended');
  assert.equal(targetSuspended?.isPublished, false);
  assert.equal(targetSuspended?.isVerified, true);

  // 4. Traçabilité serveur avant/après + motif, sans aucune écriture localStorage
  const logs = await getPlatformAuditLogs(undefined, rpcClient);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].action, 'salon.suspended');
  assert.equal(logs[0].reason, 'Impayé critique');
  assert.deepEqual(logs[0].beforeValues, { status: 'active', is_published: true });
  assert.deepEqual(logs[0].afterValues, { status: 'suspended', is_published: false });
  assert.equal(localStorage.getItem('barbercuts_admin_salon_overrides'), null);
  assert.equal(localStorage.getItem('barbercuts_admin_audit_log'), null);
});

test('MarketplaceSectionsAdmin : administration dynamique des sections, onglets et ajout de nouvelles sections', () => {
  setupMockLocalStorage();

  // 1. Lecture de la configuration par défaut
  const initialConfig = getMarketplaceContent();
  assert.ok(initialConfig.hero.headlineMain, 'La section Hero doit avoir un titre');
  assert.ok(initialConfig.trustItems.length >= 3, 'Doit comporter des points de réassurance');
  assert.ok(initialConfig.categories.length >= 3, 'Doit comporter des catégories de coiffure');
  assert.ok(initialConfig.steps.length >= 3, 'Doit comporter les étapes de réservation');

  // 2. Modification des textes Hero et ajout d’une nouvelle section dynamique
  const customSectionTitle = 'Nos Engagements d’Hygiène Médicale';
  const customSectionBadge = 'GARANTIE CLINIQUE 2026';
  const updatedConfig = {
    ...initialConfig,
    hero: {
      ...initialConfig.hero,
      headlineMain: 'L’Art de la Haute Coiffure',
      headlineHighlight: 'à Abidjan',
      badgeText: 'SÉLECTION D’ÉLITE 2026',
    },
    customSections: [
      {
        id: 'sec_hygiene_test',
        title: customSectionTitle,
        badgeText: customSectionBadge,
        description: 'Protocole de stérilisation systématique par ultraviolets.',
        layout: 'cards' as const,
        isVisible: true,
        order: 1,
        items: [
          {
            id: 'item_1',
            title: 'Stérilisation UV-C',
            description: 'Lames et tondeuses passées en autoclave après chaque client.',
            tag: 'Norme Hospitalière',
          },
        ],
      },
    ],
  };

  saveMarketplaceContent(updatedConfig, 'admin@barbercuts.com');

  // 3. Relecture de la configuration persistée
  const saved = getMarketplaceContent();
  assert.equal(saved.hero.headlineMain, 'L’Art de la Haute Coiffure');
  assert.equal(saved.hero.headlineHighlight, 'à Abidjan');
  assert.equal(saved.hero.badgeText, 'SÉLECTION D’ÉLITE 2026');
  assert.equal(saved.customSections.length, 1);
  assert.equal(saved.customSections[0].title, customSectionTitle);

  // 4. Rendu de la Marketplace : la nouvelle section personnalisée et les nouveaux titres sont visibles en direct
  const html = renderToStaticMarkup(
    <AppProvider>
      <MarketplaceHome />
    </AppProvider>,
  );
  assert.ok(html.includes('L’Art de la Haute Coiffure'), 'Le nouveau titre hero doit apparaître');
  assert.ok(html.includes('à Abidjan'), 'Le mot clé de luxe doit apparaître');
  assert.ok(html.includes(customSectionTitle), 'La nouvelle section personnalisée doit être rendue');
  assert.ok(html.includes(customSectionBadge), 'Le badge de la nouvelle section doit être rendu');
  assert.ok(html.includes('Stérilisation UV-C'), 'L’élément de la section ajoutée doit être affiché');

  // 5. Réinitialisation sécurisée aux valeurs par défaut
  resetMarketplaceContent('admin@barbercuts.com');
  const restored = getMarketplaceContent();
  assert.equal(restored.hero.headlineMain, DEFAULT_MARKETPLACE_CONTENT.hero.headlineMain);
});
