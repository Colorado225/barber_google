import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React, { useMemo, useState } from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType, type SalonMembership } from '../src/context/AuthContext';
import { AppProvider, type SalonApiClient } from '../src/context/AppContext';
import { NotificationsView } from '../src/components/erp/NotificationsView';
import { ErpLayout } from '../src/components/erp/ErpLayout';
import { SaaSPlanView } from '../src/components/erp/SaaSPlanView';
import { PricingView } from '../src/components/marketplace/PricingView';
import { AdminNotificationsPanel } from '../src/components/admin/AdminNotificationsPanel';
import {
  evaluateNotificationAlerts,
  isRepeatedNotificationFailure,
  LEGACY_FALSE_SMS_FEATURE,
  mapNotificationProbe,
  mapPlatformNotificationHealth,
  mapSalonNotificationHealth,
  normalizeSaasPlanFeatures,
} from '../src/lib/notifications';
import { getSaasPlans } from '../src/lib/saas';
import type {
  AppointmentNotification,
  NotificationHealthSummary,
  NotificationProbeResult,
  PlatformNotificationHealthSummary,
} from '../src/types';

function ensureDom(initialUrl = 'http://localhost/erp') {
  const existing = (globalThis as { __notifObsDom?: JSDOM }).__notifObsDom;
  if (existing) {
    existing.reconfigure({ url: initialUrl });
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: initialUrl,
  });
  Object.assign(globalThis, {
    __notifObsDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

ensureDom('http://localhost/erp');
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');

function makeMembership(salonId: string, name: string): SalonMembership {
  return {
    id: `membership-${salonId}`,
    salonId,
    salonName: name,
    branchId: `branch-${salonId}`,
    branchName: 'Principal',
    organizationId: `org-${salonId}`,
    organizationName: 'Org Test',
    role: 'owner',
    status: 'active',
    permissions: [
      'dashboard.read',
      'appointments.read',
      'appointments.write',
      'payments.read',
      'cash.read',
      'reports.read',
      'clients.read',
      'services.read',
      'staff.read',
      'loyalty.read',
      'expenses.read',
      'stock.read',
      'salon.read',
      'salon.update',
      'subscriptions.read',
    ],
  };
}

const AuthTestHarness: React.FC<{
  memberships: SalonMembership[];
  children: React.ReactNode;
}> = ({ memberships, children }) => {
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(memberships[0]?.salonId ?? null);
  const activeMembership = useMemo(
    () => memberships.find((m) => m.salonId === selectedSalonId) ?? memberships[0] ?? null,
    [memberships, selectedSalonId],
  );
  const value = useMemo<AuthContextType>(
    () => ({
      user: { id: 'user-owner', name: 'Awa', email: 'awa@test.ci', emailVerified: true },
      memberships,
      activeMembership,
      activeSalonId: activeMembership?.salonId ?? null,
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
      selectSalon: (salonId: string) => {
        setSelectedSalonId(salonId);
        return true;
      },
      verifyEmail: async () => {},
      resendVerification: async () => {},
      requestPasswordReset: async () => {},
      resetPassword: async () => {},
      createSalon: async () => '',
      completeOnboarding: async () => {},
      isAuthenticated: true,
      hasWorkspace: memberships.length > 0,
      hasPermission: (permission: string, salonId?: string) => {
        const target = salonId ?? activeMembership?.salonId;
        return memberships.some((m) => m.salonId === target && m.permissions.includes(permission));
      },
    }),
    [memberships, activeMembership],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

test('evaluateNotificationAlerts detects repeated failures, scheduler errors, missing providers, and WhatsApp template gaps', () => {
  const now = Date.now();
  const baseNotif: AppointmentNotification = {
    id: 'n-1',
    salonId: 's-1',
    appointmentId: 'a-1',
    channel: 'whatsapp',
    kind: 'booking_received',
    recipient: '+2250700000001',
    status: 'failed',
    scheduledAt: new Date(now - 3600_000).toISOString(),
    createdAt: new Date(now - 3600_000).toISOString(),
    attempts: 1,
    failureCount: 2,
    error: 'whatsapp 400 (code 131047 / template_required_24h): outside 24h window',
  };

  assert.equal(isRepeatedNotificationFailure(baseNotif), true);

  const health: NotificationHealthSummary = mapSalonNotificationHealth({
    salonId: 's-1',
    counts: { pending: 2, sending: 1, sent: 4, failed: 3, skipped: 1, total: 11 },
    repeatedFailures: 1,
    exhaustedFailures: 0,
    recentFailures24h: 3,
    overduePending: 2,
    stuckSending: 1,
    byChannel: {
      email: {
        supported: true,
        pending: 1,
        sent: 4,
        failed: 0,
        skipped: 0,
        repeatedFailures: 0,
        latestError: null,
      },
      whatsapp: {
        supported: true,
        pending: 1,
        sent: 0,
        failed: 3,
        skipped: 1,
        repeatedFailures: 1,
        latestError: baseNotif.error,
      },
      sms: { supported: false, pending: 0, sent: 0, failed: 0, skipped: 0, repeatedFailures: 0 },
    },
    repeatedFailureItems: [],
    scheduler: {
      configured: true,
      isEnabled: true,
      hasDispatchToken: true,
      hasEndpoint: true,
      cronAvailable: true,
      cronScheduled: true,
      cronActive: true,
      cronSchedule: '*/5 * * * *',
      lastRunStatus: 'failed',
      lastHttpStatus: 500,
      lastHttpError: 'edge timeout',
    },
    lastRun: null,
    lastSalonRun: null,
  });

  const probe: NotificationProbeResult = mapNotificationProbe({
    service: 'notifications-dispatcher',
    ok: true,
    provider_configured: true,
    capabilities: {
      email: { provider: 'resend', supported: true, configured: false, hasApiKey: false, hasSender: false },
      whatsapp: {
        provider: 'meta_cloud_api',
        supported: true,
        configured: true,
        hasToken: true,
        hasPhoneNumberId: true,
        hasBusinessAccountId: true,
        templateModeEnabled: false,
        templatePrefixConfigured: false,
        templateLang: 'fr',
        defaultCountryCode: '225',
        expectedTemplates: [],
      },
      sms: { provider: null, supported: false, configured: false, reason: 'channel_not_supported: sms' },
      scheduler: { dispatchTokenConfigured: true, publicAppUrlConfigured: true },
    },
    whatsappAudit: null,
  });

  const alerts = evaluateNotificationAlerts({ notifications: [baseNotif], health, probe, nowMs: now });
  const codes = new Set(alerts.map((a) => a.code));

  assert.ok(codes.has('repeated_failures'));
  assert.ok(codes.has('failure_burst'));
  assert.ok(codes.has('stuck_sending'));
  assert.ok(codes.has('scheduler_error'));
  assert.ok(codes.has('overdue_pending'));
  assert.ok(codes.has('provider_missing'));
  assert.ok(codes.has('whatsapp_template_disabled'));
});

test('SaaS plans normalize legacy SMS reminder claims out and notifications-dispatcher enforces honest capabilities', async () => {
  const dom = ensureDom('http://localhost/tarifs');
  dom.window.localStorage.setItem(
    'barbercuts_saas_plans',
    JSON.stringify([
      {
        id: 'pro',
        name: 'Pro Équipe',
        slug: 'pro',
        priceXof: 35000,
        billingPeriod: 'monthly',
        description: 'Pro',
        features: [LEGACY_FALSE_SMS_FEATURE],
        maxStaff: 5,
        maxBranches: 1,
        isPopular: true,
        isActive: true,
        badgeText: 'Plus Populaire',
        displayOrder: 2,
      },
    ]),
  );

  const normalized = normalizeSaasPlanFeatures([LEGACY_FALSE_SMS_FEATURE]);
  assert.equal(normalized.includes(LEGACY_FALSE_SMS_FEATURE), false);
  assert.ok(normalized[0].includes('SMS non disponible'));

  const fetched = await getSaasPlans();
  assert.equal(fetched[0].features.includes(LEGACY_FALSE_SMS_FEATURE), false);
  assert.ok(fetched[0].features[0].includes('SMS non disponible'));

  const edgeSrc = await readFile(
    new URL('../supabase/functions/notifications-dispatcher/index.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(edgeSrc, /^\s*import\s+.*(esm\.sh|jsr:)/m);
  assert.ok(edgeSrc.includes('/reservation#${token}'));
  assert.ok(edgeSrc.includes('channel_not_supported: sms'));
  assert.ok(edgeSrc.includes('record_notification_dispatch_run'));
  assert.ok(edgeSrc.includes('auditWhatsappConfig'));
  assert.ok(edgeSrc.includes('getCapabilities'));
});

test('NotificationsView and ErpLayout surface repeated-failure alerts, channel diagnostics, and SMS unavailability', async () => {
  ensureDom('http://localhost/app');
  const salonId = 'salon-obs';
  let probeCalls = 0;

  const notificationsFixture: AppointmentNotification[] = [
    {
      id: 'notif-repeated',
      salonId,
      appointmentId: 'appt-1',
      channel: 'whatsapp',
      kind: 'booking_received',
      recipient: '+2250700000010',
      status: 'failed',
      scheduledAt: '2026-11-04T07:23:00Z',
      createdAt: '2026-11-04T07:22:00Z',
      attempts: 1,
      failureCount: 2,
      error: 'whatsapp 401 (code 190 / token_invalid_or_expired): Token expired',
      lastError: 'whatsapp 401 (code 190 / token_invalid_or_expired): Token expired',
    },
    {
      id: 'notif-sent',
      salonId,
      appointmentId: 'appt-2',
      channel: 'email',
      kind: 'booking_confirmed',
      recipient: 'client@test.ci',
      status: 'sent',
      scheduledAt: '2026-11-09T10:00:00Z',
      createdAt: '2026-11-09T10:00:00Z',
      sentAt: '2026-11-09T10:01:00Z',
      attempts: 1,
      failureCount: 0,
      providerMessageId: 're_123456',
    },
  ];

  const healthFixture = mapSalonNotificationHealth({
    salonId,
    counts: { pending: 1, sending: 0, sent: 1, failed: 1, skipped: 0, total: 3 },
    repeatedFailures: 1,
    exhaustedFailures: 0,
    recentFailures24h: 1,
    overduePending: 1,
    stuckSending: 0,
    byChannel: {
      email: {
        supported: true,
        pending: 0,
        sent: 1,
        failed: 0,
        skipped: 0,
        repeatedFailures: 0,
        latestError: null,
      },
      whatsapp: {
        supported: true,
        pending: 1,
        sent: 0,
        failed: 1,
        skipped: 0,
        repeatedFailures: 1,
        latestError: 'whatsapp 401 (code 190 / token_invalid_or_expired): Token expired',
      },
      sms: { supported: false, pending: 0, sent: 0, failed: 0, skipped: 0, repeatedFailures: 0 },
    },
    repeatedFailureItems: [],
    scheduler: {
      configured: true,
      isEnabled: true,
      hasDispatchToken: true,
      hasEndpoint: true,
      cronAvailable: true,
      cronScheduled: true,
      cronActive: true,
      cronSchedule: '*/5 * * * *',
      lastRunAt: '2026-11-10T09:00:00Z',
      lastRunStatus: 'succeeded',
      httpAvailable: true,
      lastHttpStatus: 200,
    },
    lastRun: {
      id: 'run-1',
      salonId: null,
      triggerSource: 'cron',
      providerConfigured: false,
      emailConfigured: false,
      whatsappConfigured: false,
      whatsappTemplateMode: false,
      smsSupported: false,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      createdAt: '2026-11-10T09:00:00Z',
    },
  });

  const apiFactory = (): SalonApiClient =>
    ({
      async workspace() {
        return {
          salon: { id: salonId, name: 'Atelier Abidjan', commune: 'Cocody', is_published: true },
          branches: [{ id: `branch-${salonId}`, name: 'Principal' }],
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
          return {
            periodFrom: '2026-11-01',
            periodTo: '2026-11-10',
            totalRevenue: 0,
            totalCollected: 0,
            totalRefunded: 0,
            pendingMobileMoney: 0,
            cashCollected: 0,
            mobileMoneyCollected: 0,
            cardCollected: 0,
            completedAppointments: 0,
            cancelledAppointments: 0,
            noShowAppointments: 0,
          };
        },
      },
      loyalty: {
        async program() {
          return {
            salonId,
            pointsPer100Fcfa: 1,
            welcomeBonus: 0,
            silverThreshold: 100,
            goldThreshold: 250,
            vipThreshold: 500,
            programEnabled: false,
          };
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
          return notificationsFixture;
        },
        async health() {
          return healthFixture;
        },
        async probe() {
          probeCalls += 1;
          return mapNotificationProbe({
            service: 'notifications-dispatcher',
            ok: true,
            provider_configured: true,
            capabilities: {
              email: {
                provider: 'resend',
                supported: true,
                configured: true,
                hasApiKey: true,
                hasSender: true,
              },
              whatsapp: {
                provider: 'meta_cloud_api',
                supported: true,
                configured: false,
                hasToken: false,
                hasPhoneNumberId: false,
                hasBusinessAccountId: false,
                templateModeEnabled: false,
                templatePrefixConfigured: false,
                templateLang: 'fr',
                defaultCountryCode: '225',
                expectedTemplates: [],
              },
              sms: {
                provider: null,
                supported: false,
                configured: false,
                reason: 'channel_not_supported: sms',
              },
              scheduler: { dispatchTokenConfigured: true, publicAppUrlConfigured: true },
            },
            whatsappAudit: null,
          });
        },
      },
    }) as unknown as SalonApiClient;

  const memberships = [makeMembership(salonId, 'Atelier Abidjan')];

  render(
    <MemoryRouter>
      <AuthTestHarness memberships={memberships}>
        <AppProvider apiClientFactory={apiFactory}>
          <ErpLayout />
        </AppProvider>
      </AuthTestHarness>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getByTestId('notifications-critical-badge'));
  });

  fireEvent.click(screen.getByRole('button', { name: /Notifications clients/i }));

  await waitFor(() => {
    assert.ok(screen.getByTestId('sms-unavailable-notice'));
    assert.ok(screen.getByText(/Alerte échecs répétés/i));
  });

  assert.ok(screen.getByText(/Échec répété \(×2\)/i));
  assert.ok(screen.getByText(/ID re_123456/i));
  assert.ok(screen.getByTestId('notification-observability-panel'));
  assert.ok(screen.getByText(/Actif \(\*\/5 \* \* \* \*\)/i));

  fireEvent.click(screen.getByRole('button', { name: /Vérifier les canaux/i }));
  await waitFor(() => {
    assert.equal(probeCalls, 1);
    assert.ok(screen.getByText('Prêt'));
    assert.ok(screen.getByText('Secrets manquants'));
  });

  cleanup();
});

test('AdminNotificationsPanel, PricingView, and SaaSPlanView display honest SMS unavailability and alerts', async () => {
  ensureDom('http://localhost/admin/console');

  const platformHealth: PlatformNotificationHealthSummary = mapPlatformNotificationHealth({
    counts: { pending: 2, sending: 0, sent: 5, failed: 3, skipped: 0, total: 10 },
    repeatedFailures: 2,
    exhaustedFailures: 1,
    recentFailures24h: 3,
    overduePending: 2,
    stuckSending: 0,
    byChannel: {
      email: {
        supported: true,
        pending: 0,
        sent: 5,
        failed: 0,
        skipped: 0,
        repeatedFailures: 0,
        latestError: null,
      },
      whatsapp: {
        supported: true,
        pending: 2,
        sent: 0,
        failed: 3,
        skipped: 0,
        repeatedFailures: 2,
        latestError: 'whatsapp 400 (code 132001 / template_not_approved)',
      },
      sms: { supported: false, pending: 0, sent: 0, failed: 0, skipped: 0, repeatedFailures: 0 },
    },
    salonsWithIssues: [
      {
        salonId: 's-1',
        salonName: 'Royal Cuts Abidjan',
        failedCount: 3,
        repeatedFailures: 2,
        recentFailures24h: 3,
        overduePending: 2,
        latestError: 'whatsapp 400 (code 132001 / template_not_approved)',
      },
    ],
    scheduler: {
      configured: true,
      isEnabled: true,
      hasDispatchToken: true,
      hasEndpoint: true,
      cronAvailable: true,
      cronScheduled: true,
      cronActive: true,
      cronSchedule: '*/5 * * * *',
      lastRunAt: '2026-11-10T09:00:00Z',
      lastRunStatus: 'succeeded',
      httpAvailable: true,
      lastHttpStatus: 200,
    },
    lastRun: null,
  });

  const probe = mapNotificationProbe({
    service: 'notifications-dispatcher',
    ok: true,
    provider_configured: true,
    capabilities: {
      email: { provider: 'resend', supported: true, configured: false, hasApiKey: false, hasSender: false },
      whatsapp: {
        provider: 'meta_cloud_api',
        supported: true,
        configured: true,
        hasToken: true,
        hasPhoneNumberId: true,
        hasBusinessAccountId: true,
        templateModeEnabled: true,
        templatePrefixConfigured: true,
        templateLang: 'fr',
        defaultCountryCode: '225',
        expectedTemplates: ['bc_booking_received', 'bc_booking_confirmed'],
      },
      sms: { provider: null, supported: false, configured: false, reason: 'channel_not_supported: sms' },
      scheduler: { dispatchTokenConfigured: true, publicAppUrlConfigured: true },
    },
    whatsappAudit: {
      checked: true,
      phoneVerified: true,
      verifiedName: 'BarberCuts CI',
      displayPhoneNumber: '+225 07 00 00 00',
      templatesChecked: true,
      approvedTemplates: [
        { name: 'bc_booking_received', status: 'APPROVED', language: 'fr' },
        { name: 'bc_booking_confirmed', status: 'PENDING', language: 'fr' },
      ],
      missingTemplates: ['bc_booking_confirmed'],
      error: null,
    },
  });

  render(
    <AdminNotificationsPanel
      health={platformHealth}
      probe={probe}
      probing={false}
      onRefresh={() => {}}
      onProbe={() => {}}
    />,
  );

  assert.ok(screen.getByTestId('admin-sms-unavailable-notice'));
  assert.ok(screen.getByTestId('admin-notification-alerts'));
  assert.ok(screen.getByText(/Alerte échecs répétés \(2 messages\)/i));
  assert.ok(screen.getByText(/Royal Cuts Abidjan/));
  assert.ok(screen.getByText(/bc_booking_received \(fr\) · APPROVED/));
  assert.ok(screen.getByText(/Modèles WhatsApp manquants ou non approuvés \(1\)/i));
  cleanup();

  // PricingView & SaaSPlanView : aucune promesse SMS prématurée + encart explicite
  const dom = ensureDom('http://localhost/tarifs');
  dom.window.localStorage.removeItem('barbercuts_saas_plans');
  render(
    <MemoryRouter>
      <AppProvider>
        <PricingView />
      </AppProvider>
    </MemoryRouter>,
  );
  await waitFor(() => {
    assert.ok(screen.getByTestId('pricing-sms-unavailable-notice'));
  });
  assert.equal(screen.queryByText(LEGACY_FALSE_SMS_FEATURE), null);
  cleanup();

  const memberships = [makeMembership('salon-saas', 'Salon SaaS')];
  ensureDom('http://localhost/app');
  render(
    <MemoryRouter>
      <AuthTestHarness memberships={memberships}>
        <AppProvider
          apiClientFactory={() =>
            ({
              async workspace() {
                return {
                  salon: { id: 'salon-saas', name: 'Salon SaaS', commune: 'Plateau', is_published: true },
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
            }) as unknown as SalonApiClient
          }
        >
          <SaaSPlanView />
        </AppProvider>
      </AuthTestHarness>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.ok(screen.getByTestId('saas-sms-unavailable-notice'));
  });
  assert.equal(screen.queryByText(LEGACY_FALSE_SMS_FEATURE), null);
  cleanup();
});
