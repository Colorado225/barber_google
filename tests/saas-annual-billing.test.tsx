import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, type SalonApiClient } from '../src/context/AppContext';
import { AuthContext, type AuthContextType, type SalonMembership } from '../src/context/AuthContext';
import { PricingView } from '../src/components/marketplace/PricingView';
import { SaaSPlanView } from '../src/components/erp/SaaSPlanView';
import { SignupPage } from '../src/components/auth/SignupPage';
import { VerifyEmailPage } from '../src/components/auth/VerifyEmailPage';
import { LoginPage } from '../src/components/auth/LoginPage';
import { OnboardingGate } from '../src/components/auth/OnboardingGate';
import { SaasPaymentReviewPanel } from '../src/components/admin/SaasPaymentReviewPanel';
import { PricingTierEditor } from '../src/components/admin/PricingTierEditor';
import {
  clearPlanSelectionIntent,
  readPlanSelectionIntent,
  resolvePlanBilling,
  savePlanSelectionIntent,
} from '../src/lib/saasPricing';
import type { SaaSPlan, SaaSSubscription } from '../src/types';

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

const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');

const PLANS: SaaSPlan[] = [
  {
    id: 'starter',
    name: 'Starter Solo',
    slug: 'starter',
    priceXof: 15000,
    billingPeriod: 'monthly',
    description: 'Solo',
    features: ['Planning illimité'],
    maxStaff: 1,
    maxBranches: 1,
    isPopular: false,
    isActive: true,
    badgeText: 'Solo',
    displayOrder: 1,
  },
  {
    id: 'pro',
    name: 'Pro Équipe',
    slug: 'pro',
    priceXof: 35000,
    billingPeriod: 'monthly',
    description: 'Équipe',
    features: ["Jusqu'à 5 barbiers"],
    maxStaff: 5,
    maxBranches: 1,
    isPopular: true,
    isActive: true,
    badgeText: 'Plus Populaire',
    displayOrder: 2,
  },
  {
    id: 'prestige',
    name: 'Prestige & Chaînes',
    slug: 'prestige',
    priceXof: 75000,
    billingPeriod: 'monthly',
    description: 'Chaînes',
    features: ['Illimité'],
    maxStaff: null,
    maxBranches: 5,
    isPopular: false,
    isActive: true,
    badgeText: 'Haut de Gamme',
    displayOrder: 3,
  },
];

function makeSalonApi(): SalonApiClient {
  return {
    async workspace() {
      return {
        salon: { id: 'salon-1', name: 'Barber Royal', commune: 'Plateau', is_published: true },
        branches: [],
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
  } as unknown as SalonApiClient;
}

function makeAuthValue(memberships: SalonMembership[]): AuthContextType {
  return {
    user: { id: 'u-1', name: 'Owner', email: 'owner@barber.test', emailVerified: true },
    memberships,
    activeMembership: memberships[0] ?? null,
    activeSalonId: memberships[0]?.salonId ?? null,
    onboarding: {
      currentStep: 'completed',
      emailVerified: true,
      salonCreated: true,
      setupCompleted: true,
    },
    loading: false,
    error: null,
    signIn: async () => {},
    signUp: async () => ({ status: 'authenticated' }),
    signOut: async () => {},
    refreshSession: async () => {},
    selectSalon: () => true,
    verifyEmail: async () => {},
    resendVerification: async () => {},
    requestPasswordReset: async () => {},
    resetPassword: async () => {},
    createSalon: async () => 'salon-1',
    completeOnboarding: async () => {},
    isAuthenticated: true,
    hasWorkspace: memberships.length > 0,
    hasPermission: () => true,
  };
}

const OWNER_MEMBERSHIPS: SalonMembership[] = [
  {
    id: 'm-1',
    salonId: 'salon-1',
    salonName: 'Barber Royal',
    organizationId: 'org-1',
    organizationName: 'Org Royal',
    branchId: null,
    branchName: null,
    role: 'owner',
    status: 'active',
    permissions: ['subscriptions.read'],
  },
];

test('resolvePlanBilling : formule identique au serveur pour mensuel, annuel (-15%) et annuel natif', () => {
  const starterAnnual = resolvePlanBilling({ priceXof: 15000, billingPeriod: 'monthly' }, 'yearly');
  assert.equal(starterAnnual.billingPeriod, 'yearly');
  assert.equal(starterAnnual.billedPriceXof, 153000);
  assert.equal(starterAnnual.monthlyEquivalentXof, 12750);
  assert.equal(starterAnnual.annualSavingsXof, 27000);
  assert.equal(starterAnnual.discountPercent, 15);
  assert.equal(starterAnnual.supportsPeriodChoice, true);

  const proAnnual = resolvePlanBilling({ priceXof: 35000, billingPeriod: 'monthly' }, 'yearly');
  assert.equal(proAnnual.billedPriceXof, 357000);
  assert.equal(proAnnual.monthlyEquivalentXof, 29750);
  assert.equal(proAnnual.annualSavingsXof, 63000);

  // Valeur arbitraire non divisible par 12 : total facturé identique à round(p * 12 * 0.85)
  const oddAnnual = resolvePlanBilling({ priceXof: 10001, billingPeriod: 'monthly' }, 'yearly');
  assert.equal(oddAnnual.billedPriceXof, 102010);

  // Forfait nativement annuel : jamais de double-multiplication ni double-remise
  const nativeYearly = resolvePlanBilling({ priceXof: 120000, billingPeriod: 'yearly' }, 'monthly');
  assert.equal(nativeYearly.billingPeriod, 'yearly');
  assert.equal(nativeYearly.billedPriceXof, 120000);
  assert.equal(nativeYearly.monthlyEquivalentXof, 10000);
  assert.equal(nativeYearly.supportsPeriodChoice, false);
});

test('PricingView : la bascule annuelle (-15 %) met à jour les montants et transmet ?plan=…&billing=yearly', async () => {
  const dom = ensureDom('http://localhost/tarifs');
  dom.window.localStorage.setItem('barbercuts_saas_plans', JSON.stringify(PLANS));
  dom.window.sessionStorage.clear();

  render(
    <MemoryRouter initialEntries={['/tarifs']}>
      <AppProvider>
        <PricingView />
      </AppProvider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getByText('Pro Équipe'));
  });

  // Par défaut en mensuel
  const proLinkMonthly = screen.getByRole('link', { name: /Démarrer avec Pro Équipe/i });
  assert.equal(proLinkMonthly.getAttribute('href'), '/inscription?plan=pro&billing=monthly');

  // Bascule vers Annuelle (-15%)
  fireEvent.click(screen.getByRole('button', { name: /Facturation Annuelle/i }));
  await waitFor(() => {
    const proLinkYearly = screen.getByRole('link', { name: /Démarrer avec Pro Équipe/i });
    assert.equal(proLinkYearly.getAttribute('href'), '/inscription?plan=pro&billing=yearly');
  });

  const bodyText = document.body.textContent ?? '';
  assert.match(bodyText, /29[\s\u202f\u00a0]750/);
  assert.match(bodyText, /357[\s\u202f\u00a0]000/);

  fireEvent.click(screen.getByRole('link', { name: /Démarrer avec Pro Équipe/i }));
  assert.deepEqual(readPlanSelectionIntent(), { planSlug: 'pro', billingPeriod: 'yearly' });
  cleanup();
});

test('Auth flow : SignupPage, VerifyEmailPage et LoginPage conservent la formule et facturation annuelle', () => {
  const dom = ensureDom('http://localhost/inscription?plan=pro&billing=yearly');
  dom.window.sessionStorage.clear();

  render(
    <MemoryRouter initialEntries={['/inscription?plan=pro&billing=yearly']}>
      <AuthContext.Provider value={makeAuthValue([])}>
        <Routes>
          <Route path="/inscription" element={<SignupPage />} />
          <Route path="/verifier-email" element={<VerifyEmailPage />} />
          <Route path="/connexion" element={<LoginPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  const banner = screen.getByTestId('signup-selected-plan-banner');
  assert.match(banner.textContent ?? '', /Pro Équipe/);
  assert.match(banner.textContent ?? '', /Facturation annuelle \(-15%\)/);
  assert.equal(
    screen.getByRole('link', { name: /Se connecter/i }).getAttribute('href'),
    '/connexion?plan=pro&billing=yearly',
  );
  cleanup();

  // VerifyEmailPage garde ?plan=pro&billing=yearly sur le lien de connexion
  ensureDom('http://localhost/verifier-email?email=test@example.com&plan=pro&billing=yearly');
  render(
    <MemoryRouter initialEntries={['/verifier-email?email=test@example.com&plan=pro&billing=yearly']}>
      <AuthContext.Provider value={makeAuthValue([])}>
        <VerifyEmailPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  assert.equal(
    screen.getByRole('link', { name: /Aller à la connexion/i }).getAttribute('href'),
    '/connexion?plan=pro&billing=yearly',
  );
  cleanup();
});

test('SaaSPlanView : préselection annuelle depuis /tarifs, envoi de billingPeriod=yearly au RPC et passage mensuel->annuel', async () => {
  const dom = ensureDom('http://localhost/app/abonnement');
  dom.window.sessionStorage.clear();
  savePlanSelectionIntent({ planSlug: 'pro', billingPeriod: 'yearly' });

  const calls: Array<{ salonId: string; planId: string; billingPeriod?: string }> = [];
  let activeSub: SaaSSubscription | null = null;

  render(
    <MemoryRouter initialEntries={['/app/abonnement']}>
      <AuthContext.Provider value={makeAuthValue(OWNER_MEMBERSHIPS)}>
        <AppProvider apiClientFactory={makeSalonApi}>
          <SaaSPlanView
            loadPlans={async () => PLANS}
            loadSubscription={async () => activeSub}
            loadPending={async () => null}
            subscribeToPlan={async (salonId, planId, billingPeriod) => {
              calls.push({ salonId, planId, billingPeriod });
              return {
                id: 'sub-pending',
                salonId,
                planId,
                status: 'pending_payment',
                priceAtSubscription: billingPeriod === 'yearly' ? 357000 : 35000,
                billingPeriod: billingPeriod ?? 'monthly',
                featuresSnapshot: [],
                startedAt: '2026-11-10T00:00:00Z',
                currentPeriodEnd: '2026-11-10T00:00:00Z',
              };
            }}
          />
        </AppProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getByText('Pro Équipe'));
  });

  // L'interrupteur est déjà sur Facturation Annuelle (-15%) et le montant annuel s'affiche
  const annualBtn = screen.getByRole('button', { name: /Facturation Annuelle/i });
  assert.equal(annualBtn.getAttribute('aria-pressed'), 'true');
  assert.ok(screen.getByText('Sélectionnée'));
  const text = document.body.textContent ?? '';
  assert.match(text, /357[\s\u202f\u00a0]000/);

  // Clic sur "Choisir cette formule" sur la carte Pro (2e carte)
  const chooseButtons = screen.getAllByRole('button', { name: /Choisir cette formule/i });
  assert.equal(chooseButtons.length, 3);
  fireEvent.click(chooseButtons[1]);

  await waitFor(() => {
    assert.equal(calls.length, 1);
  });
  assert.deepEqual(calls[0], { salonId: 'salon-1', planId: 'pro', billingPeriod: 'yearly' });
  assert.equal(readPlanSelectionIntent(), null, 'L’intention de sélection est consommée après demande');
  cleanup();

  // Scénario 2 : salon déjà actif en Pro mensuel qui bascule vers l'annuel
  clearPlanSelectionIntent();
  activeSub = {
    id: 'sub-active-monthly',
    salonId: 'salon-1',
    planId: 'pro',
    status: 'active',
    priceAtSubscription: 35000,
    billingPeriod: 'monthly',
    featuresSnapshot: [],
    startedAt: '2026-11-01T00:00:00Z',
    currentPeriodEnd: '2026-12-01T00:00:00Z',
    plan: {
      id: 'pro',
      name: 'Pro Équipe',
      slug: 'pro',
      currentPriceXof: 35000,
      description: 'Équipe',
      features: ["Jusqu'à 5 barbiers"],
      badgeText: 'Plus Populaire',
      maxStaff: 5,
      maxBranches: 1,
    },
  };

  render(
    <MemoryRouter initialEntries={['/app/abonnement']}>
      <AuthContext.Provider value={makeAuthValue(OWNER_MEMBERSHIPS)}>
        <AppProvider apiClientFactory={makeSalonApi}>
          <SaaSPlanView
            loadPlans={async () => PLANS}
            loadSubscription={async () => activeSub}
            loadPending={async () => null}
            subscribeToPlan={async (salonId, planId, billingPeriod) => {
              calls.push({ salonId, planId, billingPeriod });
              return activeSub!;
            }}
          />
        </AppProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getAllByText('Formule active').length >= 1);
  });

  fireEvent.click(screen.getByRole('button', { name: /Facturation Annuelle/i }));
  const upgradeAnnualBtn = await screen.findByRole('button', { name: /Passer à l’annuel \(-15%\)/i });
  fireEvent.click(upgradeAnnualBtn);

  await waitFor(() => {
    assert.equal(calls.length, 2);
  });
  assert.deepEqual(calls[1], { salonId: 'salon-1', planId: 'pro', billingPeriod: 'yearly' });
  cleanup();
});

test('SuperAdmin : SaasPaymentReviewPanel et PricingTierEditor affichent correctement la facturation annuelle', async () => {
  ensureDom('http://localhost/admin');

  render(
    <AppProvider>
      <SaasPaymentReviewPanel
        formatPrice={(v) => `${v.toLocaleString('fr-FR')} FCFA`}
        listPayments={async () => [
          {
            id: 'pay-yearly-1',
            salonId: 'salon-1',
            salonName: 'Barber Royal',
            planId: 'pro',
            planName: 'Pro Équipe',
            billingPeriod: 'yearly',
            amountXof: 357000,
            method: 'bank_transfer',
            reference: 'VIR-AN-2026',
            declaredAt: '2026-11-10T10:00:00Z',
          },
        ]}
        decidePayment={async () => {}}
      />
      <PricingTierEditor
        plan={PLANS[1]}
        pendingDraft={null}
        nextDisplayOrder={2}
        onClose={() => {}}
        onSaved={() => {}}
      />
    </AppProvider>,
  );

  await waitFor(() => {
    assert.ok(screen.getByText(/Annuel · 12 mois/));
  });
  assert.ok(screen.getByLabelText(/Facturation du forfait/i));
  assert.match(document.body.textContent ?? '', /Annuel \(-15%\) : 357[\s\u202f\u00a0]000/);
  cleanup();
});

test('OnboardingGate : affiche la formule annuelle sélectionnée et redirige vers /app/abonnement après création', async () => {
  const dom = ensureDom('http://localhost/app?plan=pro&billing=yearly');
  dom.window.sessionStorage.clear();

  let created = false;
  render(
    <MemoryRouter initialEntries={['/app?plan=pro&billing=yearly']}>
      <AuthContext.Provider
        value={{
          ...makeAuthValue([]),
          hasWorkspace: false,
          createSalon: async () => {
            created = true;
            return 'salon-new';
          },
        }}
      >
        <Routes>
          <Route
            path="/app"
            element={
              <OnboardingGate>
                <div>ERP Ready</div>
              </OnboardingGate>
            }
          />
          <Route
            path="/app/abonnement"
            element={<div data-testid="arrived-abonnement">Abonnement ERP</div>}
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  assert.match(document.body.textContent ?? '', /Facturation annuelle \(-15%\)/);
  assert.deepEqual(readPlanSelectionIntent(), { planSlug: 'pro', billingPeriod: 'yearly' });

  const inputs = document.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'Org Test' } });
  fireEvent.change(inputs[1], { target: { value: 'Salon Test' } });
  fireEvent.click(screen.getByRole('button', { name: /Créer mon salon/i }));

  await waitFor(() => {
    assert.equal(created, true);
    assert.ok(screen.getByTestId('arrived-abonnement'));
  });
  cleanup();
});

test('PricingView : un forfait nativement annuel ne subit jamais de double remise ni lien mensuel', async () => {
  const dom = ensureDom('http://localhost/tarifs');
  const nativeYearlyPlan: SaaSPlan = {
    ...PLANS[1],
    id: 'pro-yearly',
    name: 'Pro Annuel',
    slug: 'pro-yearly',
    priceXof: 120000,
    billingPeriod: 'yearly',
  };
  dom.window.localStorage.setItem('barbercuts_saas_plans', JSON.stringify([nativeYearlyPlan]));
  dom.window.sessionStorage.clear();

  render(
    <MemoryRouter initialEntries={['/tarifs']}>
      <AppProvider>
        <PricingView />
      </AppProvider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getByText('Pro Annuel'));
  });

  // Même quand l'interrupteur est sur Mensuelle, le forfait nativement annuel garde /an sans remise et pointe vers billing=yearly
  assert.match(document.body.textContent ?? '', /120[\s\u202f\u00a0]000 FCFA \/ an/);
  assert.equal(
    screen.getByRole('link', { name: /Démarrer avec Pro Annuel/i }).getAttribute('href'),
    '/inscription?plan=pro-yearly&billing=yearly',
  );
  // Catalogue sans aucun forfait au mois : la bascule (et sa promesse -15 %) est masquée
  assert.equal(
    screen.queryByTestId('pricing-billing-toggle'),
    null,
    'La bascule mensuelle/annuelle doit être absente quand aucun forfait actif ne propose le choix de période',
  );
  assert.doesNotMatch(document.body.textContent ?? '', /-15% Économies/);
  cleanup();
});

test('SaaSPlanView : bascule masquée pour un catalogue 100 % annuel natif, demande envoyée en yearly', async () => {
  const dom = ensureDom('http://localhost/app/abonnement');
  dom.window.sessionStorage.clear();
  clearPlanSelectionIntent();

  const nativeYearlyPlan: SaaSPlan = {
    ...PLANS[1],
    id: 'pro-yearly',
    name: 'Pro Annuel',
    slug: 'pro-yearly',
    priceXof: 120000,
    billingPeriod: 'yearly',
  };
  const calls: Array<{ salonId: string; planId: string; billingPeriod?: string }> = [];

  render(
    <MemoryRouter initialEntries={['/app/abonnement']}>
      <AuthContext.Provider value={makeAuthValue(OWNER_MEMBERSHIPS)}>
        <AppProvider apiClientFactory={makeSalonApi}>
          <SaaSPlanView
            loadPlans={async () => [nativeYearlyPlan]}
            loadSubscription={async () => null}
            loadPending={async () => null}
            subscribeToPlan={async (salonId, planId, billingPeriod) => {
              calls.push({ salonId, planId, billingPeriod });
              return {
                id: 'sub-pending-yearly',
                salonId,
                planId,
                status: 'pending_payment',
                priceAtSubscription: 120000,
                billingPeriod: 'yearly',
                featuresSnapshot: [],
                startedAt: '2026-11-10T00:00:00Z',
                currentPeriodEnd: '2026-11-10T00:00:00Z',
              };
            }}
          />
        </AppProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getByText('Pro Annuel'));
  });

  // Aucune promesse de remise ni de choix de période : la bascule est absente
  assert.equal(
    screen.queryByTestId('saas-billing-toggle'),
    null,
    'La bascule mensuelle/annuelle doit être absente pour un catalogue 100 % annuel natif',
  );
  assert.doesNotMatch(document.body.textContent ?? '', /-15% Économies/);
  assert.match(document.body.textContent ?? '', /120[\s\u202f\u00a0]000/);

  // La demande enregistre bien la période annuelle du forfait (pas de mensuel fantôme)
  fireEvent.click(screen.getByRole('button', { name: /Choisir cette formule/i }));
  await waitFor(() => {
    assert.equal(calls.length, 1);
  });
  assert.deepEqual(calls[0], { salonId: 'salon-1', planId: 'pro-yearly', billingPeriod: 'yearly' });
  cleanup();
});
