// Types ERP : succursales et métriques du tableau de bord multi-postes.

import type { ServiceCategory } from './salon';

export interface ErpBranch {
  id: string;
  name: string;
  timezone?: string;
}

export type ErpDashboardPeriod = 'month' | '30d' | 'month_weeks' | '6m' | '12m' | 'year';

export interface ErpDashboardKpis {
  revenueCollectedNet: number | null;
  revenueCollectedGross: number | null;
  refunds: number | null;
  paymentReversals: number | null;
  refundReversals: number | null;
  pendingPaymentsAmount: number | null;
  confirmedPaymentCount: number | null;
  averageBasket: number | null;
  revenueBilled: number | null;
  revenueRealized: number | null;
  outstanding: number | null;
  expensesNet: number | null;
  netMargin: number | null;
  appointmentsTotal: number;
  appointmentsActive: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  appointmentsNoShow: number;
  todayAppointmentsActive: number;
  todayAppointmentsCompleted: number;
  todayAppointmentsInProgress: number;
  todayAppointmentsCancelled: number;
  todayAppointmentsNoShow: number;
}

export interface ErpDashboardMonthlyPoint {
  month: string;
  fromDate: string;
  toDate: string;
  revenueCollected: number | null;
  revenueBilled: number | null;
  revenueRealized: number | null;
  expenses: number | null;
  margin: number | null;
  completedAppointments: number;
  activeAppointments: number;
  cancelledAppointments: number;
}

export interface ErpDashboardWeeklyPoint {
  label: string;
  shortLabel: string;
  fromDate: string;
  toDate: string;
  revenueCollected: number | null;
  revenueBilled: number | null;
  revenueRealized: number | null;
  expenses: number | null;
  margin: number | null;
  completedAppointments: number;
  activeAppointments: number;
}

export interface ErpDashboardServiceStat {
  serviceId: string;
  name: string;
  category: ServiceCategory;
  price: number;
  durationMinutes: number;
  completedVolume: number;
  completedRevenue: number;
  billedVolume: number;
  billedRevenue: number;
  cancelledVolume: number;
  noShowVolume: number;
}

export interface ErpDashboardStaffStat {
  staffId: string;
  name: string;
  commissionRate: number;
  completedAppointments: number;
  completedRevenue: number;
  billedAppointments: number;
  billedRevenue: number;
  cancelledAppointments: number;
  noShowAppointments: number;
}

export interface ErpDashboardHourlySlot {
  hour: string;
  occupiedMinutes: number;
  availableMinutes: number;
  occupancyRate: number;
  activeAppointments: number;
  completedAppointments: number;
}

export interface ErpDashboardMetrics {
  periodFrom: string;
  periodTo: string;
  timezone: string;
  today: string;
  dayFilter: 'all' | 'saturday' | 'friday' | 'weekday';
  configuredStaffCount: number;
  permissions: {
    canViewFinance: boolean;
    canViewExpenses: boolean;
    canViewAppointments: boolean;
  };
  kpis: ErpDashboardKpis;
  byMethod: Record<string, number>;
  monthlySeries: ErpDashboardMonthlyPoint[];
  weeklySeries: ErpDashboardWeeklyPoint[];
  servicePerformance: ErpDashboardServiceStat[];
  staffActivity: ErpDashboardStaffStat[];
  hourlyOccupancy: ErpDashboardHourlySlot[];
}

export type RealtimeSyncStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
