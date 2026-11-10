import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { AdminPlatformSettingsPanel } from '../src/components/admin/AdminPlatformSettingsPanel';
import { SignupPage } from '../src/components/auth/SignupPage';
import { OnboardingGate } from '../src/components/auth/OnboardingGate';
import { AuthContext, type AuthContextType } from '../src/context/AuthContext';
import { getPublicPlatformStatus } from '../src/lib/platformSettings';
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformGlobalSettings,
} from '../src/lib/superadmin';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin' });
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

function ensureDom(url = 'http://localhost/admin') {
  dom.reconfigure({ url });
  return dom;
}

const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');

function makeAuthValue(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: { id: 'u-1', email: 'owner@salon.ci', name: 'Owner Test', emailVerified: true },
    loading: false,
    error: null,
    isAuthenticated: true,
    memberships: [],
    activeMembership: null,
    activeSalonId: null,
    onboarding: {
      emailVerified: true,
      salonCreated: false,
      setupCompleted: false,
      currentStep: 'salon_creation',
    },
    hasWorkspace: false,
    hasPermission: () => false,
    signIn: async () => undefined,
    signUp: async () => ({ status: 'authenticated' }),
    verifyEmail: async () => undefined,
    resendVerification: async () => undefined,
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    selectSalon: () => false,
    signOut: async () => undefined,
    createSalon: async () => 's-1',
    completeOnboarding: async () => undefined,
    refreshSession: async () => undefined,
    ...overrides,
  };
}

test('AdminDashboard et superadmin.ts n’utilisent plus localStorage barbercuts_platform_settings', async () => {
  const adminSrc = await readFile(
    new URL('../src/components/admin/AdminDashboard.tsx', import.meta.url),
    'utf8',
  );
  assert.equal(adminSrc.includes('barbercuts_platform_settings'), false);
  assert.equal(adminSrc.includes('localStorage'), false);
  assert.equal(adminSrc.includes('AdminPlatformSettingsPanel'), true);
});

test('getPlatformSettings, updatePlatformSettings et getPublicPlatformStatus appellent les RPC serveur attendues', async () => {
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> | undefined }> = [];
  const client = {
    async rpc(fn: string, params?: Record<string, unknown>) {
      rpcCalls.push({ fn, params });
      if (fn === 'admin_get_platform_settings') {
        return {
          data: {
            default_currency: 'XOF',
            maintenance_mode: true,
            auto_approve_salons: false,
            updated_at: '2026-11-10T10:00:00Z',
            updated_by: 'admin-1',
            commission_rate_available: false,
          },
          error: null,
        };
      }
      if (fn === 'admin_update_platform_settings') {
        return {
          data: {
            default_currency: 'XOF',
            maintenance_mode: params?.p_maintenance_mode,
            auto_approve_salons: params?.p_auto_approve_salons,
            updated_at: '2026-11-10T10:05:00Z',
            updated_by: 'admin-1',
            commission_rate_available: false,
          },
          error: null,
        };
      }
      if (fn === 'get_public_platform_status') {
        return {
          data: {
            default_currency: 'XOF',
            maintenance_mode: true,
            auto_approve_salons: false,
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    },
  };

  const loaded = await getPlatformSettings(client);
  assert.equal(loaded.defaultCurrency, 'XOF');
  assert.equal(loaded.maintenanceMode, true);
  assert.equal(loaded.autoApproveSalons, false);
  assert.equal(loaded.commissionRateAvailable, false);

  await assert.rejects(
    updatePlatformSettings({ maintenanceMode: false, autoApproveSalons: true, reason: 'ok' }, client),
    /entre 3 et 500/,
  );

  const saved = await updatePlatformSettings(
    { maintenanceMode: false, autoApproveSalons: true, reason: 'Réouverture inscriptions' },
    client,
  );
  assert.equal(saved.maintenanceMode, false);
  assert.equal(saved.autoApproveSalons, true);

  const pubStatus = await getPublicPlatformStatus(client);
  assert.equal(pubStatus.maintenanceMode, true);
  assert.equal(pubStatus.autoApproveSalons, false);

  assert.deepEqual(
    rpcCalls.map((c) => c.fn),
    ['admin_get_platform_settings', 'admin_update_platform_settings', 'get_public_platform_status'],
  );
});

test('AdminPlatformSettingsPanel distingue réglages persistés et paramètres indisponibles, sans localStorage', async () => {
  ensureDom('http://localhost/admin');
  win.localStorage.setItem(
    'barbercuts_platform_settings',
    JSON.stringify({ commissionRate: 9, maintenanceMode: true, autoApproveSalons: false }),
  );

  const initial: PlatformGlobalSettings = {
    defaultCurrency: 'XOF',
    maintenanceMode: false,
    autoApproveSalons: true,
    updatedAt: '2026-11-10T09:00:00Z',
    updatedBy: 'admin-1',
    commissionRateAvailable: false,
  };

  const savedPayloads: Array<{ maintenanceMode: boolean; autoApproveSalons: boolean; reason: string }> = [];

  render(
    React.createElement(AdminPlatformSettingsPanel, {
      settings: initial,
      onSave: async (updates) => {
        savedPayloads.push(updates);
        return {
          ...initial,
          maintenanceMode: updates.maintenanceMode,
          autoApproveSalons: updates.autoApproveSalons,
          updatedAt: '2026-11-10T11:00:00Z',
        };
      },
    }),
  );

  // Le composant ignore totalement une ancienne valeur présente en localStorage
  const autoApproveCheckbox = document.getElementById('platform-auto-approve-salons') as HTMLInputElement;
  const maintenanceCheckbox = document.getElementById('platform-maintenance-mode') as HTMLInputElement;
  assert.equal(autoApproveCheckbox.checked, true);
  assert.equal(maintenanceCheckbox.checked, false);

  // La commission marketplace est marquée explicitement indisponible & désactivée
  const unavailableSection = screen.getByTestId('settings-unavailable-section');
  assert.match(unavailableSection.textContent ?? '', /Indisponible — non implémenté/);
  const commissionInput = document.getElementById('platform-commission-rate-unavailable') as HTMLInputElement;
  assert.equal(commissionInput.disabled, true);

  // Enregistrer sans motif est bloqué
  fireEvent.click(autoApproveCheckbox);
  fireEvent.click(maintenanceCheckbox);
  fireEvent.submit(screen.getByTestId('settings-persisted-form'));
  await waitFor(() => {
    assert.match(screen.getByRole('alert').textContent ?? '', /motif/i);
  });
  assert.equal(savedPayloads.length, 0);

  // Avec un motif valide, la sauvegarde serveur reçoit les deux booléens exacts
  const reasonInput = document.getElementById('platform-settings-reason') as HTMLInputElement;
  fireEvent.change(reasonInput, { target: { value: 'Maintenance planifiée' } });
  fireEvent.submit(screen.getByTestId('settings-persisted-form'));

  await waitFor(() => {
    assert.equal(savedPayloads.length, 1);
  });
  assert.deepEqual(savedPayloads[0], {
    maintenanceMode: true,
    autoApproveSalons: false,
    reason: 'Maintenance planifiée',
  });
  assert.equal(reasonInput.value, '');
  cleanup();
});

test('AdminPlatformSettingsPanel affiche un avertissement et bloque l’enregistrement si les réglages serveur sont indisponibles', () => {
  ensureDom('http://localhost/admin');
  render(
    React.createElement(AdminPlatformSettingsPanel, {
      settings: null,
      error: 'Accès réservé au super administrateur',
    }),
  );

  assert.match(screen.getByRole('alert').textContent ?? '', /Impossible de charger les paramètres serveur/);
  const submitButton = screen.getByRole('button', {
    name: /Enregistrer les Paramètres/i,
  }) as HTMLButtonElement;
  assert.equal(submitButton.disabled, true);
  cleanup();
});

test('SignupPage et OnboardingGate bloquent les créations lorsque maintenanceMode=true côté serveur', async () => {
  ensureDom('http://localhost/inscription');

  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthContext.Provider,
        { value: makeAuthValue({ isAuthenticated: false, user: null }) },
        React.createElement(SignupPage, {
          loadPlatformStatus: async () => ({
            defaultCurrency: 'XOF',
            maintenanceMode: true,
            autoApproveSalons: true,
          }),
        }),
      ),
    ),
  );

  await waitFor(() => {
    const banner = screen.getByTestId('signup-maintenance-banner');
    assert.match(banner.textContent ?? '', /Mode maintenance actif/);
  });

  const signupSubmit = screen.getByRole('button', { name: /Créer mon compte/i }) as HTMLButtonElement;
  assert.equal(signupSubmit.disabled, true);
  cleanup();

  let createSalonCalled = false;
  ensureDom('http://localhost/app');
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthContext.Provider,
        {
          value: makeAuthValue({
            hasWorkspace: false,
            createSalon: async () => {
              createSalonCalled = true;
              return 's-1';
            },
          }),
        },
        React.createElement(OnboardingGate, {
          loadPlatformStatus: async () => ({
            defaultCurrency: 'XOF',
            maintenanceMode: true,
            autoApproveSalons: false,
          }),
          children: React.createElement('div', null, 'ERP'),
        }),
      ),
    ),
  );

  await waitFor(() => {
    const banner = screen.getByTestId('onboarding-maintenance-banner');
    assert.match(banner.textContent ?? '', /Mode maintenance actif/);
  });
  const createBtn = screen.getByRole('button', { name: /Créer mon salon/i }) as HTMLButtonElement;
  assert.equal(createBtn.disabled, true);
  fireEvent.click(createBtn);
  assert.equal(createSalonCalled, false);
  cleanup();
});
