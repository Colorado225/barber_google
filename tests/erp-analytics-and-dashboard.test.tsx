import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppProvider, useOptionalApp, type SalonApiClient } from '../src/context/AppContext';
import { AuthContext, type AuthContextType, type SalonMembership } from '../src/context/AuthContext';
import { CashRegisterView } from '../src/components/erp/CashRegisterView';
import { DashboardView } from '../src/components/erp/DashboardView';
import { PlanningView } from '../src/components/erp/PlanningView';
import { ReportsView } from '../src/components/erp/ReportsView';
import { TodayView } from '../src/components/erp/TodayView';
import { mapErpDashboardMetrics } from '../src/lib/api';
import {
  buildHourlySeries,
  buildServicePerformance,
  computeAverageBasket,
  computeFinancialTotals,
  type HourlyBranchHour,
} from '../src/lib/analytics';
import {
  calendarWeekday,
  resolveErpPeriodRange,
  resolveSalonTimezone,
  shiftCalendarDays,
  zonedDateString,
  zonedDateTimeToIso,
  zonedDayRangeToUtcBounds,
  zonedTimeString,
} from '../src/lib/businessTime';
import type { Appointment, Expense, PaymentTransaction, Service, StaffMember } from '../src/types';

function ensureDom() {
  const existing = (globalThis as { __erpAnalyticsDom?: JSDOM }).__erpAnalyticsDom;
  if (existing) {
    return existing;
  }
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/app/tableau-de-bord',
  });
  Object.assign(globalThis, {
    __erpAnalyticsDom: dom,
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    Event: dom.window.Event,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

ensureDom();
const { cleanup, fireEvent, render, waitFor, within } = await import('@testing-library/react');

afterEach(() => {
  cleanup();
});

const SALON_ID = 'salon-erp-p1';
const BRANCH_ID = 'branch-erp-p1';

const ActiveSalonGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useOptionalApp();
  if (!app?.activeSalon) return <div>Chargement workspace...</div>;
  return <>{children}</>;
};

function buildAuth(permissions: string[] = ['*'], role = 'owner'): AuthContextType {
  const membership: SalonMembership = {
    id: 'mem-erp-p1',
    organizationId: 'org-erp-p1',
    organizationName: 'Org ERP Test',
    salonId: SALON_ID,
    salonName: 'Salon Paris Test',
    branchId: BRANCH_ID,
    branchName: 'Marais',
    role: role as SalonMembership['role'],
    status: 'active',
    permissions,
  };
  return {
    user: { id: 'user-erp-p1', name: 'Manager ERP', email: 'manager@erp.test', emailVerified: true },
    memberships: [membership],
    activeMembership: membership,
    activeSalonId: SALON_ID,
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
    createSalon: async () => SALON_ID,
    completeOnboarding: async () => {},
    isAuthenticated: true,
    hasWorkspace: true,
    hasPermission: (perm) => permissions.includes('*') || permissions.includes(perm),
  };
}

test('businessTime : conversions IANA sans dérive UTC/navigateur et bornes DST', () => {
  // 2026-11-12T23:30:00Z correspond à 2026-11-13 00:30 à Paris (UTC+1) et 18:30 le 12 à New York (UTC-5)
  assert.equal(zonedDateString('2026-11-12T23:30:00Z', 'Europe/Paris'), '2026-11-13');
  assert.equal(zonedTimeString('2026-11-12T23:30:00Z', 'Europe/Paris'), '00:30');
  assert.equal(zonedDateString('2026-11-12T23:30:00Z', 'Africa/Abidjan'), '2026-11-12');
  assert.equal(zonedDateString('2026-11-12T23:30:00Z', 'America/New_York'), '2026-11-12');
  assert.equal(zonedTimeString('2026-11-12T23:30:00Z', 'America/New_York'), '18:30');

  // Aller-retour hiver (UTC+1) et été (UTC+2) en Europe/Paris
  assert.equal(zonedDateTimeToIso('2026-11-13', '00:30', 'Europe/Paris'), '2026-11-12T23:30:00.000Z');
  assert.equal(zonedDateTimeToIso('2026-07-15', '10:00', 'Europe/Paris'), '2026-07-15T08:00:00.000Z');

  // Bornes UTC d'une journée métier à Paris (minuit Paris -> minuit Paris suivant)
  const bounds = zonedDayRangeToUtcBounds('2026-11-13', '2026-11-13', 'Europe/Paris');
  assert.equal(bounds.startIso, '2026-11-12T23:00:00.000Z');
  assert.equal(bounds.endExclusiveIso, '2026-11-13T23:00:00.000Z');

  // Résolution de fuseau : succursale sélectionnée -> succursale principale -> salon -> repli Abidjan
  assert.equal(
    resolveSalonTimezone({ timezone: 'Africa/Abidjan' }, [{ id: 'b1', timezone: 'Europe/Paris' }]),
    'Europe/Paris',
  );
  assert.equal(
    resolveSalonTimezone(
      { timezone: 'Africa/Abidjan' },
      [
        { id: 'b1', timezone: 'Europe/Paris' },
        { id: 'b2', timezone: 'America/New_York' },
      ],
      'b2',
    ),
    'America/New_York',
  );
  assert.equal(resolveSalonTimezone({ timezone: 'Europe/Paris' }, [{ id: 'b1' }]), 'Europe/Paris');
  assert.equal(resolveSalonTimezone(null, []), 'Africa/Abidjan');

  // Périodes calendaires sur date métier Paris à 23:30 UTC (= 13 nov Paris)
  const ref = new Date('2026-11-12T23:30:00Z');
  const monthRange = resolveErpPeriodRange('month', 'Europe/Paris', ref);
  assert.equal(monthRange.from, '2026-11-01');
  assert.equal(monthRange.to, '2026-11-13');
  const range30d = resolveErpPeriodRange('30d', 'Europe/Paris', ref);
  assert.equal(range30d.from, '2026-10-15');
  assert.equal(range30d.to, '2026-11-13');
  const rangeYear = resolveErpPeriodRange('year', 'Europe/Paris', ref);
  assert.equal(rangeYear.from, '2026-01-01');
  assert.equal(rangeYear.to, '2026-11-13');
  assert.equal(shiftCalendarDays('2026-11-01', -1), '2026-10-31');
  assert.equal(calendarWeekday('2026-11-13'), 5); // vendredi
});

test('analytics : séparation encaissé/facturé/réalisé, exclusion annulés/absents et occupation durée/capacité', () => {
  const tz = 'Europe/Paris';
  const services: Service[] = [
    {
      id: 'srv-coupe',
      salonId: SALON_ID,
      name: 'Coupe Classique',
      category: 'coupe',
      description: 'Coupe classique',
      price: 5000,
      durationMinutes: 60,
      isActive: true,
    },
    {
      id: 'srv-barbe',
      salonId: SALON_ID,
      name: 'Taille Barbe',
      category: 'barbe',
      description: 'Taille barbe',
      price: 3000,
      durationMinutes: 30,
      isActive: true,
    },
  ];
  const staff: StaffMember[] = [
    {
      id: 'st-moussa',
      salonId: SALON_ID,
      branchId: BRANCH_ID,
      name: 'Moussa',
      role: 'master_barber',
      phone: '',
      specialties: [],
      commissionRate: 40,
      isAvailable: true,
      isActive: true,
      serviceIds: ['srv-coupe', 'srv-barbe'],
    },
    {
      id: 'st-inactif',
      salonId: SALON_ID,
      branchId: BRANCH_ID,
      name: 'Ancien',
      role: 'barber',
      phone: '',
      specialties: [],
      commissionRate: 30,
      isAvailable: false,
      isActive: false,
      serviceIds: [],
    },
  ];
  const branchHours: HourlyBranchHour[] = [
    {
      weekday: 2,
      isOpen: true,
      opensAt: '08:00',
      closesAt: '12:00',
    },
  ];

  // Mardi 2026-11-10 (Paris = UTC+1)
  const appointments: Appointment[] = [
    {
      id: 'apt-1',
      salonId: SALON_ID,
      branchId: BRANCH_ID,
      clientId: 'c1',
      clientName: 'Client 1',
      clientPhone: '+33600000001',
      serviceId: 'srv-coupe',
      serviceName: 'Coupe Classique',
      staffId: 'st-moussa',
      staffName: 'Moussa',
      date: '2026-11-10',
      time: '10:00',
      startsAt: '2026-11-10T09:00:00.000Z',
      endsAt: '2026-11-10T10:00:00.000Z',
      durationMinutes: 60,
      price: 5000,
      status: 'completed',
      paymentStatus: 'deposit_paid',
      source: 'direct',
      createdAt: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'apt-2',
      salonId: SALON_ID,
      branchId: BRANCH_ID,
      clientId: 'c2',
      clientName: 'Client 2',
      clientPhone: '+33600000002',
      serviceId: 'srv-barbe',
      serviceName: 'Taille Barbe',
      staffId: 'st-moussa',
      staffName: 'Moussa',
      date: '2026-11-10',
      time: '11:00',
      startsAt: '2026-11-10T10:00:00.000Z',
      endsAt: '2026-11-10T10:30:00.000Z',
      durationMinutes: 30,
      price: 3000,
      status: 'confirmed',
      paymentStatus: 'paid',
      source: 'direct',
      createdAt: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'apt-3',
      salonId: SALON_ID,
      branchId: BRANCH_ID,
      clientId: 'c3',
      clientName: 'Client Annulé',
      clientPhone: '+33600000003',
      serviceId: 'srv-coupe',
      serviceName: 'Coupe Classique',
      staffId: 'st-moussa',
      staffName: 'Moussa',
      date: '2026-11-10',
      time: '09:00',
      startsAt: '2026-11-10T08:00:00.000Z',
      endsAt: '2026-11-10T09:00:00.000Z',
      durationMinutes: 60,
      price: 5000,
      status: 'cancelled',
      paymentStatus: 'unpaid',
      source: 'direct',
      createdAt: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'apt-4',
      salonId: SALON_ID,
      branchId: BRANCH_ID,
      clientId: 'c4',
      clientName: 'Client Absent',
      clientPhone: '+33600000004',
      serviceId: 'srv-barbe',
      serviceName: 'Taille Barbe',
      staffId: 'st-moussa',
      staffName: 'Moussa',
      date: '2026-11-10',
      time: '08:30',
      startsAt: '2026-11-10T07:30:00.000Z',
      endsAt: '2026-11-10T08:00:00.000Z',
      durationMinutes: 30,
      price: 3000,
      status: 'no_show',
      paymentStatus: 'unpaid',
      source: 'direct',
      createdAt: '2026-11-10T08:00:00.000Z',
    },
  ];

  const transactions: PaymentTransaction[] = [
    {
      id: 'tx-1',
      salonId: SALON_ID,
      appointmentId: 'apt-1',
      clientName: 'Client 1',
      amount: 5000,
      type: 'full',
      kind: 'payment',
      method: 'cash',
      status: 'completed',
      reference: 'TX-1',
      time: '11:15',
      date: '2026-11-10T10:15:00Z',
    },
    {
      id: 'tx-2',
      salonId: SALON_ID,
      appointmentId: 'apt-1',
      clientName: 'Client 1',
      amount: 1000,
      type: 'full',
      kind: 'refund',
      method: 'cash',
      status: 'completed',
      reference: 'TX-2',
      time: '11:30',
      date: '2026-11-10T10:30:00Z',
    },
    {
      id: 'tx-3',
      salonId: SALON_ID,
      appointmentId: 'apt-2',
      clientName: 'Client 2',
      amount: 3000,
      type: 'full',
      kind: 'payment',
      method: 'wave',
      status: 'completed',
      reference: 'TX-3',
      time: '11:45',
      date: '2026-11-10T10:45:00Z',
    },
    {
      id: 'tx-4',
      salonId: SALON_ID,
      appointmentId: 'apt-2',
      clientName: 'Client 2',
      amount: 1500,
      type: 'full',
      kind: 'payment',
      method: 'wave',
      status: 'pending',
      reference: 'TX-4',
      time: '11:50',
      date: '2026-11-10T10:50:00Z',
    },
  ];

  const expenses: Expense[] = [
    {
      id: 'exp-1',
      salonId: SALON_ID,
      title: 'Lames',
      category: 'products',
      amount: 2000,
      date: '2026-11-10',
      entryKind: 'expense',
      status: 'active',
    },
    {
      id: 'exp-2',
      salonId: SALON_ID,
      title: 'Contrepassation',
      category: 'products',
      amount: 500,
      date: '2026-11-10',
      entryKind: 'expense_reversal',
      originalExpenseId: 'exp-1',
      status: 'active',
    },
  ];

  const totals = computeFinancialTotals(transactions, appointments, expenses, {
    from: '2026-11-10',
    to: '2026-11-10',
    timeZone: tz,
  });
  assert.equal(totals.collectedNet, 7000);
  assert.equal(totals.refunds, 1000);
  assert.equal(totals.pendingAmount, 1500);
  assert.equal(totals.confirmedPaymentCount, 2);
  assert.equal(
    computeAverageBasket(transactions, { from: '2026-11-10', to: '2026-11-10', timeZone: tz }),
    3500,
  );
  assert.equal(totals.billedRevenue, 8000);
  assert.equal(totals.realizedRevenue, 5000);
  assert.equal(totals.expensesNet, 1500);
  assert.equal(totals.netMargin, 5500);

  // Palmarès prestations (completed vs billed)
  const completedPerf = buildServicePerformance(appointments, services, 'revenue', {
    from: '2026-11-10',
    to: '2026-11-10',
    scope: 'completed',
    timeZone: tz,
  });
  assert.equal(completedPerf[0].id, 'srv-coupe');
  assert.equal(completedPerf[0].volume, 1);
  assert.equal(completedPerf[0].totalGeneratedRevenue, 5000);
  assert.equal(completedPerf[1].volume, 0); // Barbe est confirmed, pas completed

  const billedPerf = buildServicePerformance(appointments, services, 'revenue', {
    from: '2026-11-10',
    to: '2026-11-10',
    scope: 'billed',
    timeZone: tz,
  });
  assert.equal(billedPerf[1].volume, 1);
  assert.equal(billedPerf[1].totalGeneratedRevenue, 3000);

  // Occupation horaire : Coupe 60 min (10:00-11:00) occupe 10:00 ET 10:30 à 100% avec 1 coiffeur actif
  const hourly = buildHourlySeries(appointments, {
    from: '2026-11-10',
    to: '2026-11-10',
    dayFilter: 'all',
    timeZone: tz,
    staff,
    branchHours,
  });
  const s0900 = hourly.find((h) => h.hour === '09:00');
  const s1000 = hourly.find((h) => h.hour === '10:00');
  const s1030 = hourly.find((h) => h.hour === '10:30');
  assert.equal(s0900?.occupancyRate, 0); // annulé exclu
  assert.equal(s1000?.occupiedMinutes, 30);
  assert.equal(s1000?.availableMinutes, 30);
  assert.equal(s1000?.occupancyRate, 100);
  assert.equal(s1030?.occupiedMinutes, 30);
  assert.equal(s1030?.occupancyRate, 100);

  // Filtre friday sur mardi -> 0 RDV
  const fridayHourly = buildHourlySeries(appointments, {
    from: '2026-11-10',
    to: '2026-11-10',
    dayFilter: 'friday',
    timeZone: tz,
    staff,
    branchHours,
  });
  assert.equal(
    fridayHourly.every((h) => h.count === 0),
    true,
  );
});

test('mapErpDashboardMetrics préserve null RBAC et mappe le contrat snake_case SQL', () => {
  const mapped = mapErpDashboardMetrics({
    salon_id: SALON_ID,
    timezone: 'Europe/Paris',
    period_from: '2026-11-01',
    period_to: '2026-11-10',
    day_filter: 'all',
    today: '2026-11-10',
    configured_staff_count: 2,
    permissions: {
      can_view_finance: false,
      can_view_expenses: false,
      can_view_appointments: true,
    },
    kpis: {
      revenue_collected_net: null,
      revenue_collected_gross: null,
      refunds: null,
      payment_reversals: null,
      refund_reversals: null,
      pending_payments_amount: null,
      confirmed_payment_count: null,
      average_basket: null,
      revenue_billed: null,
      revenue_realized: null,
      outstanding: null,
      expenses_net: null,
      net_margin: null,
      appointments_total: 4,
      appointments_active: 2,
      appointments_completed: 1,
      appointments_cancelled: 1,
      appointments_no_show: 0,
      today_appointments_active: 2,
      today_appointments_completed: 1,
      today_appointments_in_progress: 0,
      today_appointments_cancelled: 1,
      today_appointments_no_show: 0,
    },
    by_method: {},
    monthly_series: [],
    weekly_series: [],
    hourly_occupancy: [],
    service_performance: [],
    staff_activity: [],
  });

  assert.equal(mapped.timezone, 'Europe/Paris');
  assert.equal(mapped.permissions.canViewFinance, false);
  assert.equal(mapped.kpis.revenueCollectedNet, null);
  assert.equal(mapped.kpis.netMargin, null);
  assert.equal(mapped.kpis.appointmentsCompleted, 1);
  assert.equal(mapped.configuredStaffCount, 2);
});

test('DashboardView & ReportsView : intégration reports.dashboard, filtres unifiés et séparation RBAC', async () => {
  ensureDom();
  cleanup();

  const dashboardCalls: Array<{ from: string; to: string; dayFilter?: string }> = [];
  const summaryCalls: Array<{ from: string; to: string }> = [];

  const buildPayload = (from: string, to: string, dayFilter = 'all', restricted = false) => ({
    salonId: SALON_ID,
    timezone: 'Europe/Paris',
    periodFrom: from,
    periodTo: to,
    dayFilter: dayFilter as 'all' | 'weekday' | 'friday' | 'weekend',
    today: '2026-11-10',
    configuredStaffCount: 2,
    permissions: {
      canViewFinance: !restricted,
      canViewExpenses: !restricted,
      canViewAppointments: true,
    },
    kpis: {
      revenueCollectedNet: restricted ? null : 7000,
      revenueCollectedGross: restricted ? null : 8000,
      refunds: restricted ? null : 1000,
      paymentReversals: restricted ? null : 0,
      refundReversals: restricted ? null : 0,
      pendingPaymentsAmount: restricted ? null : 1500,
      confirmedPaymentCount: restricted ? null : 2,
      averageBasket: restricted ? null : 3500,
      revenueBilled: restricted ? null : 8000,
      revenueRealized: restricted ? null : 5000,
      outstanding: restricted ? null : 1000,
      expensesNet: restricted ? null : 1500,
      netMargin: restricted ? null : 5500,
      appointmentsTotal: 4,
      appointmentsActive: 2,
      appointmentsCompleted: 1,
      appointmentsCancelled: 1,
      appointmentsNoShow: 1,
      todayAppointmentsActive: 2,
      todayAppointmentsCompleted: 1,
      todayAppointmentsInProgress: 0,
      todayAppointmentsCancelled: 1,
      todayAppointmentsNoShow: 1,
    },
    byMethod: restricted ? {} : { cash: 4000, wave: 3000 },
    monthlySeries: [
      {
        month: '2026-11',
        fromDate: from,
        toDate: to,
        revenueCollected: restricted ? null : 7000,
        revenueBilled: restricted ? null : 8000,
        revenueRealized: restricted ? null : 5000,
        expenses: restricted ? null : 1500,
        margin: restricted ? null : 5500,
        completedAppointments: 1,
        activeAppointments: 2,
        cancelledAppointments: 1,
      },
    ],
    weeklySeries: [
      {
        label: 'Semaine 2',
        shortLabel: 'S2',
        fromDate: from,
        toDate: to,
        revenueCollected: restricted ? null : 7000,
        revenueBilled: restricted ? null : 8000,
        revenueRealized: restricted ? null : 5000,
        expenses: restricted ? null : 1500,
        margin: restricted ? null : 5500,
        completedAppointments: 1,
        activeAppointments: 2,
      },
    ],
    hourlyOccupancy: [
      {
        hour: '10:00',
        occupiedMinutes: 30,
        availableMinutes: 30,
        occupancyRate: 100,
        activeAppointments: 1,
        completedAppointments: 1,
      },
      {
        hour: '10:30',
        occupiedMinutes: 30,
        availableMinutes: 30,
        occupancyRate: 100,
        activeAppointments: 1,
        completedAppointments: 1,
      },
    ],
    servicePerformance: [
      {
        serviceId: 'srv-1',
        name: 'Coupe Classique',
        category: 'coupe' as const,
        price: 5000,
        durationMinutes: 60,
        completedVolume: 1,
        completedRevenue: 5000,
        billedVolume: 1,
        billedRevenue: 5000,
        cancelledVolume: 1,
        noShowVolume: 0,
      },
    ],
    staffActivity: [
      {
        staffId: 'st-1',
        name: 'Moussa',
        commissionRate: 40,
        completedAppointments: 1,
        completedRevenue: 5000,
        billedAppointments: 2,
        billedRevenue: 8000,
        cancelledAppointments: 1,
        noShowAppointments: 1,
      },
    ],
  });

  const makeFactory = (restricted: boolean) => () =>
    ({
      workspace: async () => ({
        salon: {
          id: SALON_ID,
          name: 'Salon Paris Test',
          status: 'active',
          is_published: true,
          timezone: 'Europe/Paris',
        },
        branches: [{ id: BRANCH_ID, name: 'Marais', timezone: 'Europe/Paris' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: {
        summary: async (from: string, to: string) => {
          summaryCalls.push({ from, to });
          return {
            revenueCollected: 7000,
            revenueBilled: 8000,
            outstanding: 1000,
            refunds: 1000,
            expenses: 1500,
            netBalance: 5500,
            pendingAmount: 1500,
            paymentCount: 2,
            byMethod: { cash: 4000, wave: 3000 },
          };
        },
        dashboard: async (params: { from: string; to: string; dayFilter?: string }) => {
          dashboardCalls.push(params);
          return buildPayload(params.from, params.to, params.dayFilter, restricted);
        },
      },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: { list: async () => [] },
      stock: { list: async () => [], movements: async () => [] },
      expenses: { list: async () => [], events: async () => [] },
    }) as unknown as SalonApiClient;

  // 1. Manager / Owner : toutes les métriques serveur affichées avec séparation claire
  const view = render(
    <AuthContext.Provider value={buildAuth(['*'], 'owner')}>
      <AppProvider apiClientFactory={makeFactory(false)}>
        <ActiveSalonGate>
          <DashboardView
            onOpenNewAppointment={() => {}}
            onOpenWalkIn={() => {}}
            onOpenNewPayment={() => {}}
          />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(within(view.container).getAllByText(/Fuseau Europe\/Paris/i).length >= 1);
    assert.ok(within(view.container).getByText(/Agrégat serveur complet/i));
    assert.ok(within(view.container).getByText(/3[\s\u202f\u00a0]500\s*FCFA/i));
    assert.ok(within(view.container).getByText('Sur 2 paiement(s) confirmé(s)'));
    assert.ok(within(view.container).getByText('2 RDV exclus des revenus'));
  });

  // Le détail du graphique est aussi atteignable au clic/toucher, sans dépendre du hover desktop.
  await waitFor(() => {
    const loadedRevenuePoint = within(view.container)
      .getAllByRole('button')
      .find(
        (button) =>
          button.getAttribute('aria-label')?.includes('Novembre 2026') &&
          !button.getAttribute('aria-label')?.includes(': 0 FCFA'),
      );
    assert.ok(loadedRevenuePoint, 'Une barre de revenu doit rester une cible interactive accessible');
  });
  const revenuePoint = within(view.container)
    .getAllByRole('button')
    .find(
      (button) =>
        button.getAttribute('aria-label')?.includes('Novembre 2026') &&
        !button.getAttribute('aria-label')?.includes(': 0 FCFA'),
    );
  assert.ok(revenuePoint, 'La barre doit utiliser la métrique chargée');
  fireEvent.click(revenuePoint);
  await waitFor(() => {
    const selectedRevenuePoint = within(view.container)
      .getAllByRole('button')
      .find(
        (button) =>
          button.getAttribute('aria-label')?.includes('Novembre 2026') &&
          button.getAttribute('aria-pressed') === 'true',
      );
    assert.ok(selectedRevenuePoint);
    assert.ok(within(view.container).getByTestId('dashboard-revenue-point-detail'));
  });

  // Changer la période KPI à 30 jours déclenche un nouvel appel serveur
  fireEvent.click(within(view.container).getByRole('button', { name: '30 jours' }));
  await waitFor(() => {
    assert.ok(dashboardCalls.length >= 2);
  });

  // Changer le filtre jour d'occupation vers Semaine (Lun - Jeu) déclenche dayFilter='weekday'
  fireEvent.change(within(view.container).getByRole('combobox'), { target: { value: 'weekday' } });
  await waitFor(() => {
    assert.ok(dashboardCalls.some((c) => c.dayFilter === 'weekday'));
  });

  cleanup();

  // 2. Barber : sans permission finance/dépenses -> aucune fuite de CA ni 0 F CFA factice
  const barberView = render(
    <AuthContext.Provider value={buildAuth(['dashboard.read', 'appointments.read'], 'barber')}>
      <AppProvider apiClientFactory={makeFactory(true)}>
        <ActiveSalonGate>
          <DashboardView
            onOpenNewAppointment={() => {}}
            onOpenWalkIn={() => {}}
            onOpenNewPayment={() => {}}
          />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(within(barberView.container).getAllByText('Accès restreint').length >= 2);
    assert.ok(within(barberView.container).getAllByText(/Permission finance requise/i).length >= 2);
  });

  cleanup();

  // 3. ReportsView : charge summary + dashboard et affiche les totaux réconciliés
  const reportsView = render(
    <AuthContext.Provider value={buildAuth(['*'], 'owner')}>
      <AppProvider apiClientFactory={makeFactory(false)}>
        <ActiveSalonGate>
          <ReportsView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(summaryCalls.length >= 1);
    assert.ok(within(reportsView.container).getByText('Encaissé net'));
    assert.ok(within(reportsView.container).getByText('CA réalisé (terminés)'));
    assert.ok(within(reportsView.container).getByText('Coupe Classique'));
  });
});

test('PlanningView : la chronologie tactile utilise la transition serveur existante', async () => {
  ensureDom();
  cleanup();

  const scheduledAppointment: Appointment = {
    id: 'apt-planning-confirmed',
    salonId: SALON_ID,
    branchId: BRANCH_ID,
    clientId: 'client-planning',
    clientName: 'Awa Planning',
    clientPhone: '+2250700000001',
    serviceId: 'srv-planning',
    serviceName: 'Coupe Signature',
    staffId: 'staff-planning',
    staffName: 'Moussa Planning',
    date: '2026-11-13',
    time: '10:00',
    startsAt: '2026-11-13T09:00:00.000Z',
    endsAt: '2026-11-13T09:45:00.000Z',
    durationMinutes: 45,
    price: 6500,
    status: 'confirmed',
    paymentStatus: 'unpaid',
    source: 'direct',
    notes: '',
    createdAt: '2026-11-13T08:00:00.000Z',
  };
  const transitionCalls: Array<{ id: string; status: string }> = [];

  const planningApiFactory = () =>
    ({
      workspace: async () => ({
        salon: {
          id: SALON_ID,
          name: 'Salon Planning Test',
          status: 'active',
          is_published: true,
          timezone: 'Europe/Paris',
        },
        branches: [{ id: BRANCH_ID, name: 'Marais', timezone: 'Europe/Paris' }],
        clients: [
          {
            id: 'client-planning',
            salonId: SALON_ID,
            name: 'Awa Planning',
            phone: '+2250700000001',
            email: '',
            visits: 0,
            totalSpent: 0,
            createdAt: '2026-11-01T00:00:00.000Z',
          },
        ],
        services: [
          {
            id: 'srv-planning',
            salonId: SALON_ID,
            name: 'Coupe Signature',
            category: 'coupe',
            description: '',
            price: 6500,
            durationMinutes: 45,
            isActive: true,
          },
        ],
        staff: [
          {
            id: 'staff-planning',
            salonId: SALON_ID,
            branchId: BRANCH_ID,
            name: 'Moussa Planning',
            role: 'barber',
            phone: '',
            specialties: [],
            commissionRate: 0,
            isAvailable: true,
            isActive: true,
            serviceIds: ['srv-planning'],
          },
        ],
        expenses: [],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: {
        list: async () => [scheduledAppointment],
        transition: async (id: string, status: Appointment['status']) => {
          transitionCalls.push({ id, status });
          return { ...scheduledAppointment, status };
        },
      },
      payments: { list: async () => [] },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: { list: async () => [] },
      stock: { list: async () => [], movements: async () => [] },
      expenses: { list: async () => [], events: async () => [] },
    }) as unknown as SalonApiClient;

  const view = render(
    <AuthContext.Provider value={buildAuth(['*'], 'owner')}>
      <AppProvider apiClientFactory={planningApiFactory}>
        <ActiveSalonGate>
          <PlanningView onOpenWalkIn={() => {}} />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    const mobileList = within(view.container).getByTestId('planning-mobile-list');
    assert.ok(within(mobileList).getByText('Awa Planning'));
    assert.ok(within(mobileList).getByText('Coupe Signature'));
    assert.ok(within(mobileList).getByText('Moussa Planning'));
  });

  const mobileList = within(view.container).getByTestId('planning-mobile-list');
  fireEvent.click(
    within(mobileList).getByRole('button', {
      name: 'Passer le rendez-vous de Awa Planning à Arrivé',
    }),
  );

  await waitFor(() => {
    assert.deepEqual(transitionCalls, [{ id: 'apt-planning-confirmed', status: 'checked_in' }]);
    assert.ok(within(mobileList).getByText('Arrivé'));
  });

  fireEvent.click(within(view.container).getByRole('button', { name: 'Nouveau rendez-vous' }));
  await waitFor(() => {
    assert.ok(within(view.container).getByRole('dialog', { name: 'Nouveau rendez-vous' }));
    assert.ok(within(view.container).getByLabelText(/Nom du client/));
  });
});

test('CashRegisterView : la feuille mobile conserve l’ouverture de caisse via le domaine finance', async () => {
  ensureDom();
  cleanup();

  const cashOpenCalls: Array<{ branchId: string; openingBalance: number; note: string }> = [];
  let isSessionOpen = false;
  const openedSession = {
    id: 'cash-session-mobile',
    salonId: SALON_ID,
    branchId: BRANCH_ID,
    registerId: 'register-mobile',
    registerName: 'Caisse principale',
    status: 'open' as const,
    openingBalance: 12500,
    theoreticalBalance: 12500,
    totalCashIn: 0,
    totalCashOut: 0,
    totalMobileMoneyIn: 0,
    totalMobileMoneyOut: 0,
    openedAt: '2026-11-13T08:00:00.000Z',
    closedAt: null,
    expectedBalance: null,
    countedBalance: null,
    difference: null,
    openingNote: 'Fond initial',
    closingNote: '',
  };

  const cashApiFactory = () =>
    ({
      workspace: async () => ({
        salon: {
          id: SALON_ID,
          name: 'Salon Caisse Test',
          status: 'active',
          is_published: true,
          timezone: 'Europe/Paris',
        },
        branches: [{ id: BRANCH_ID, name: 'Marais', timezone: 'Europe/Paris' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: { list: async () => [] },
      payments: { list: async () => [] },
      cash: {
        sessions: async () => (isSessionOpen ? [openedSession] : []),
        open: async (branchId: string, openingBalance: number, note: string) => {
          cashOpenCalls.push({ branchId, openingBalance, note });
          isSessionOpen = true;
          return openedSession;
        },
      },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: { list: async () => [] },
      stock: { list: async () => [], movements: async () => [] },
      expenses: { list: async () => [], events: async () => [] },
    }) as unknown as SalonApiClient;

  const view = render(
    <AuthContext.Provider value={buildAuth(['*'], 'owner')}>
      <AppProvider apiClientFactory={cashApiFactory}>
        <ActiveSalonGate>
          <CashRegisterView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(within(view.container).getByRole('button', { name: 'Ouvrir une session' }));
  });

  fireEvent.click(within(view.container).getByRole('button', { name: 'Ouvrir une session' }));
  const dialog = within(view.container).getByRole('dialog', { name: 'Ouvrir une session' });
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '12500' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir' }));

  await waitFor(() => {
    assert.deepEqual(cashOpenCalls, [{ branchId: BRANCH_ID, openingBalance: 12500, note: '' }]);
    assert.ok(within(view.container).getByRole('button', { name: 'Clôturer' }));
    assert.ok(within(view.container).getByText(/Caisse principale/));
  });
});

test('TodayView : utilise la date métier Europe/Paris autour de minuit UTC', async (t) => {
  ensureDom();
  cleanup();

  // 2026-11-12T23:30:00Z = 2026-11-13 00:30 à Paris !
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T23:30:00Z').getTime() });

  const fakeApiFactory = () =>
    ({
      workspace: async () => ({
        salon: {
          id: SALON_ID,
          name: 'Salon Paris',
          status: 'active',
          is_published: true,
          timezone: 'Europe/Paris',
        },
        branches: [{ id: BRANCH_ID, name: 'Marais', timezone: 'Europe/Paris' }],
        clients: [],
        services: [],
        staff: [],
        expenses: [],
        stock: [],
        suppliers: [],
        rewards: [],
        reviews: [],
      }),
      appointments: {
        list: async () => [
          {
            id: 'apt-paris-13',
            salonId: SALON_ID,
            branchId: BRANCH_ID,
            clientId: 'c1',
            clientName: 'Client Paris 13',
            clientPhone: '+33600000010',
            serviceId: 'srv-1',
            serviceName: 'Coupe Express',
            staffId: 'st-1',
            staffName: 'Moussa',
            date: '2026-11-13',
            time: '00:30',
            startsAt: '2026-11-12T23:30:00.000Z',
            endsAt: '2026-11-13T00:00:00.000Z',
            durationMinutes: 30,
            price: 5000,
            status: 'confirmed',
            paymentStatus: 'unpaid',
            source: 'direct',
          },
          {
            id: 'apt-paris-12',
            salonId: SALON_ID,
            branchId: BRANCH_ID,
            clientId: 'c2',
            clientName: 'Client Hier 12',
            clientPhone: '+33600000011',
            serviceId: 'srv-1',
            serviceName: 'Coupe Hier',
            staffId: 'st-1',
            staffName: 'Moussa',
            date: '2026-11-12',
            time: '15:00',
            startsAt: '2026-11-12T14:00:00.000Z',
            endsAt: '2026-11-12T14:30:00.000Z',
            durationMinutes: 30,
            price: 5000,
            status: 'confirmed',
            paymentStatus: 'unpaid',
            source: 'direct',
          },
        ],
      },
      payments: {
        list: async () => [
          {
            id: 'pay-paris-13',
            salonId: SALON_ID,
            appointmentId: 'apt-paris-13',
            clientName: 'Client Paris 13',
            amount: 5000,
            type: 'service',
            kind: 'payment',
            method: 'cash',
            status: 'completed',
            date: '2026-11-12T23:30:00.000Z',
          },
        ],
      },
      cash: { sessions: async () => [] },
      reports: { summary: async () => null },
      loyalty: { program: async () => null, accounts: async () => [], ledger: async () => [] },
      notifications: { list: async () => [], health: async () => null },
      suppliers: { list: async () => [] },
      stock: { list: async () => [], movements: async () => [] },
      expenses: { list: async () => [], events: async () => [] },
    }) as unknown as SalonApiClient;

  const view = render(
    <AuthContext.Provider value={buildAuth(['*'], 'owner')}>
      <AppProvider apiClientFactory={fakeApiFactory}>
        <ActiveSalonGate>
          <TodayView />
        </ActiveSalonGate>
      </AppProvider>
    </AuthContext.Provider>,
  );

  await waitFor(() => {
    assert.ok(within(view.container).getByText('Client Paris 13'));
    assert.equal(within(view.container).queryByText('Client Hier 12'), null);
    assert.ok(within(view.container).getAllByText(/5[\s\u202f\u00a0]000\s*FCFA/i).length >= 2);
  });
});
