import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, useOptionalApp, type SalonApiClient } from '../src/context/AppContext';
import { AuthContext, type AuthContextType } from '../src/context/AuthContext';
import { PricingView } from '../src/components/marketplace/PricingView';
import { SaaSPlanView } from '../src/components/erp/SaaSPlanView';
import { DashboardView } from '../src/components/erp/DashboardView';
import { getSaasPlans } from '../src/lib/saas';
import {
  HONEST_CASH_RECONCILIATION_FEATURE,
  HONEST_COMMISSION_FEATURE,
  HONEST_MARKETPLACE_SHOWCASE_FEATURE,
  LEGACY_FALSE_ACCOUNTING_EXPORT_FEATURE,
  LEGACY_FALSE_COMMISSION_FEATURE,
  LEGACY_FALSE_PRIORITY_MARKETPLACE_FEATURE,
  LEGACY_FALSE_SMS_FEATURE,
  LEGACY_FALSE_VIP_SUPPORT_FEATURE,
  NOTIFICATION_CHANNEL_HONEST_FEATURE,
  normalizeSaasPlanFeatures,
} from '../src/lib/notifications';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/tarifs' });
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
Object.defineProperty(globalThis, 'Node', {
  value: win.Node,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'CustomEvent', {
  value: win.CustomEvent,
  configurable: true,
  writable: true,
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ensureDom(url = 'http://localhost/tarifs') {
  dom.reconfigure({ url });
  return dom;
}

const { render, screen, waitFor, cleanup } = await import('@testing-library/react');

function makeAuthValue(): AuthContextType {
  const membership = {
    id: 'm-1',
    salonId: 'salon-honest',
    salonName: 'Salon Honnête',
    organizationId: 'org-1',
    organizationName: 'Org Honnête',
    branchId: 'branch-1',
    branchName: 'Principal',
    role: 'owner',
    status: 'active',
    permissions: [
      'salon.view',
      'appointments.view',
      'finance.view',
      'cash.view',
      'clients.view',
      'services.view',
      'staff.view',
      'expenses.view',
      'stock.view',
    ],
  };
  return {
    user: { id: 'u-1', email: 'owner@salon.ci', name: 'Owner', emailVerified: true },
    loading: false,
    error: null,
    isAuthenticated: true,
    memberships: [membership],
    activeMembership: membership,
    activeSalonId: 'salon-honest',
    onboarding: {
      emailVerified: true,
      salonCreated: true,
      setupCompleted: true,
      currentStep: 'completed',
    },
    hasWorkspace: true,
    hasPermission: () => true,
    signIn: async () => undefined,
    signUp: async () => ({ status: 'authenticated' }),
    verifyEmail: async () => undefined,
    resendVerification: async () => undefined,
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    selectSalon: () => true,
    signOut: async () => undefined,
    createSalon: async () => 'salon-honest',
    completeOnboarding: async () => undefined,
    refreshSession: async () => undefined,
  };
}

test('normalizeSaasPlanFeatures et getSaasPlans éliminent les promesses non livrées héritées', async () => {
  ensureDom('http://localhost/tarifs');

  const normalized = normalizeSaasPlanFeatures([
    LEGACY_FALSE_COMMISSION_FEATURE,
    LEGACY_FALSE_SMS_FEATURE,
    LEGACY_FALSE_ACCOUNTING_EXPORT_FEATURE,
    LEGACY_FALSE_PRIORITY_MARKETPLACE_FEATURE,
    LEGACY_FALSE_VIP_SUPPORT_FEATURE,
  ]);
  assert.deepEqual(normalized, [
    HONEST_COMMISSION_FEATURE,
    NOTIFICATION_CHANNEL_HONEST_FEATURE,
    HONEST_CASH_RECONCILIATION_FEATURE,
    HONEST_MARKETPLACE_SHOWCASE_FEATURE,
    'Accompagnement à l’onboarding multi-sites (support VIP 7j/7 non intégré à l’application)',
  ]);

  // Même si le stockage local contient d'anciennes données, getSaasPlans() les normalise
  win.localStorage.setItem(
    'barbercuts_saas_plans',
    JSON.stringify([
      {
        id: 'pro',
        name: 'Pro Équipe',
        slug: 'pro',
        priceXof: 35000,
        billingPeriod: 'monthly',
        description: 'Pro',
        features: [LEGACY_FALSE_COMMISSION_FEATURE, LEGACY_FALSE_SMS_FEATURE],
        maxStaff: 5,
        maxBranches: 1,
        isPopular: true,
        isActive: true,
        badgeText: 'Plus Populaire',
        displayOrder: 2,
      },
    ]),
  );

  const plans = await getSaasPlans();
  assert.equal(plans[0].features.includes(LEGACY_FALSE_COMMISSION_FEATURE), false);
  assert.equal(plans[0].features.includes(LEGACY_FALSE_SMS_FEATURE), false);
  assert.ok(plans[0].features.includes(HONEST_COMMISSION_FEATURE));
  assert.ok(plans[0].features.includes(NOTIFICATION_CHANNEL_HONEST_FEATURE));

  win.localStorage.removeItem('barbercuts_saas_plans');
});

test('matrice P1 : les formulations trop généreuses (sélecteur ERP, rapports par établissement) sont normalisées', async () => {
  ensureDom('http://localhost/tarifs');

  // Les deux formulations « honnêtes » antérieures, devenues trop généreuses après audit,
  // sont remappées vers le libellé exact du livré.
  const remapped = normalizeSaasPlanFeatures([
    'Multi-succursales jusqu’à 5 établissements (quota serveur & sélecteur ERP)',
    'Rapports financiers et indicateurs d’activité par établissement',
  ]);
  assert.deepEqual(remapped, [
    'Multi-succursales jusqu’à 5 établissements (quota serveur ; horaires et effectifs par succursale)',
    'Rapports financiers et indicateurs d’activité consolidés du salon',
  ]);

  // Le catalogue par défaut (forfaits publics) ne contient plus ces formulations.
  const defaultPlans = await getSaasPlans();
  assert.ok(defaultPlans.length >= 3);
  for (const plan of defaultPlans) {
    for (const feature of plan.features) {
      assert.equal(
        feature.includes('sélecteur ERP'),
        false,
        `${plan.id} : sélecteur ERP par succursale non livré`,
      );
      assert.equal(
        feature.includes('par établissement'),
        false,
        `${plan.id} : rapports détaillés par établissement non livrés`,
      );
    }
  }
  const prestige = defaultPlans.find((p) => p.slug === 'prestige');
  assert.ok(prestige);
  assert.ok(prestige.features.some((f) => f.includes('horaires et effectifs par succursale')));
  assert.ok(prestige.features.some((f) => f.includes('consolidés du salon')));
});

test('PricingView et SaaSPlanView affichent les avantages honnêtes et rappellent les prérequis opérateur/commissions', async () => {
  ensureDom('http://localhost/tarifs');
  win.localStorage.removeItem('barbercuts_saas_plans');

  render(
    React.createElement(MemoryRouter, {
      children: React.createElement(AppProvider, {
        children: React.createElement(PricingView),
      }),
    }),
  );

  await waitFor(() => {
    assert.ok(screen.getByText(HONEST_COMMISSION_FEATURE));
  });
  assert.equal(screen.queryByText(LEGACY_FALSE_COMMISSION_FEATURE), null);
  assert.equal(screen.queryByText(LEGACY_FALSE_ACCOUNTING_EXPORT_FEATURE), null);
  assert.equal(screen.queryByText(LEGACY_FALSE_PRIORITY_MARKETPLACE_FEATURE), null);
  assert.equal(screen.queryByText(LEGACY_FALSE_VIP_SUPPORT_FEATURE), null);
  assert.ok(screen.getByText(NOTIFICATION_CHANNEL_HONEST_FEATURE));
  assert.ok(screen.getByText(HONEST_CASH_RECONCILIATION_FEATURE));

  const pricingNotice = screen.getByTestId('pricing-sms-unavailable-notice');
  assert.match(pricingNotice.textContent ?? '', /activation des clés opérateur/i);
  assert.match(pricingNotice.textContent ?? '', /sans calcul automatique des montants dus/i);
  assert.equal(screen.queryByText(/Carte bancaire/i), null);
  cleanup();

  ensureDom('http://localhost/app');
  render(
    React.createElement(MemoryRouter, {
      children: React.createElement(AuthContext.Provider, {
        value: makeAuthValue(),
        children: React.createElement(AppProvider, {
          apiClientFactory: () =>
            ({
              async workspace() {
                return {
                  salon: {
                    id: 'salon-honest',
                    name: 'Salon Honnête',
                    commune: 'Plateau',
                    is_published: true,
                  },
                  branches: [{ id: 'branch-1', name: 'Principal', timezone: 'Africa/Abidjan' }],
                  clients: [],
                  services: [],
                  staff: [],
                  expenses: [],
                  stock: [],
                  rewards: [],
                  reviews: [],
                };
              },
              appointments: {
                async list() {
                  return [];
                },
              },
              payments: {
                async list() {
                  return [];
                },
              },
              cash: {
                async sessions() {
                  return [];
                },
              },
              reports: {
                async summary() {
                  return null;
                },
                async dashboardMetrics() {
                  return null;
                },
              },
              loyalty: {
                async program() {
                  return null;
                },
                async accounts() {
                  return [];
                },
                async ledger() {
                  return [];
                },
              },
              notifications: {
                async list() {
                  return [];
                },
              },
            }) as unknown as SalonApiClient,
          children: React.createElement(SaaSPlanView),
        }),
      }),
    }),
  );

  await waitFor(() => {
    const notice = screen.getByTestId('saas-sms-unavailable-notice');
    assert.match(notice.textContent ?? '', /activation des clés opérateur/i);
    assert.match(notice.textContent ?? '', /sans calcul automatique des montants dus/i);
  });
  assert.equal(screen.queryByText(LEGACY_FALSE_COMMISSION_FEATURE), null);
  cleanup();
});

const ActiveSalonGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useOptionalApp();
  if (!app?.activeSalon) return React.createElement('div', null, 'Chargement…');
  return React.createElement(React.Fragment, null, children);
};

test('DashboardView précise sous les taux de commission que le calcul des montants dus n’est pas disponible', async () => {
  ensureDom('http://localhost/app');

  render(
    React.createElement(MemoryRouter, {
      children: React.createElement(AuthContext.Provider, {
        value: makeAuthValue(),
        children: React.createElement(AppProvider, {
          apiClientFactory: () =>
            ({
              async workspace() {
                return {
                  salon: {
                    id: 'salon-honest',
                    name: 'Salon Honnête',
                    commune: 'Plateau',
                    is_published: true,
                    timezone: 'Africa/Abidjan',
                  },
                  branches: [{ id: 'branch-1', name: 'Principal', timezone: 'Africa/Abidjan' }],
                  clients: [],
                  services: [],
                  staff: [
                    {
                      id: 'st-1',
                      salonId: 'salon-honest',
                      branchId: 'branch-1',
                      name: 'Koffi',
                      role: 'barber',
                      phone: '',
                      commissionRate: 35,
                      isAvailable: true,
                      isActive: true,
                      specialties: [],
                      serviceIds: [],
                    },
                  ],
                  expenses: [],
                  stock: [],
                  rewards: [],
                  reviews: [],
                };
              },
              appointments: {
                async list() {
                  return [];
                },
              },
              payments: {
                async list() {
                  return [];
                },
              },
              cash: {
                async sessions() {
                  return [];
                },
              },
              reports: {
                async summary() {
                  return null;
                },
                async dashboard() {
                  return null;
                },
              },
              loyalty: {
                async program() {
                  return null;
                },
                async accounts() {
                  return [];
                },
                async ledger() {
                  return [];
                },
              },
              notifications: {
                async list() {
                  return [];
                },
                async health() {
                  return null;
                },
              },
              suppliers: {
                async list() {
                  return [];
                },
              },
              stock: {
                async list() {
                  return [];
                },
                async movements() {
                  return [];
                },
              },
              expenses: {
                async list() {
                  return [];
                },
                async events() {
                  return [];
                },
              },
            }) as unknown as SalonApiClient,
          children: React.createElement(ActiveSalonGate, {
            children: React.createElement(DashboardView, {
              onOpenNewAppointment: () => undefined,
              onOpenWalkIn: () => undefined,
              onOpenNewPayment: () => undefined,
            }),
          }),
        }),
      }),
    }),
  );

  await waitFor(() => {
    const note = screen.getByTestId('dashboard-commission-rate-note');
    assert.match(note.textContent ?? '', /calcul des montants de commissions dus.*pas encore disponible/i);
  });
  assert.ok(screen.getByText('35% comm.'));
  cleanup();
});
