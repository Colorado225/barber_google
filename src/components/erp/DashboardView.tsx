import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { AppointmentStatus, ErpDashboardMetrics, ErpDashboardPeriod } from '../../types';
import {
  appointmentBusinessDate,
  buildHourlySeries,
  buildRevenueSeries,
  buildServicePerformance,
  computeFinancialTotals,
  HourlyDayFilter,
  HourlyPoint,
  isBilledAppointment,
  PeriodKey,
  RevenuePoint,
  ServicePerformanceScope,
} from '../../lib/analytics';
import { resolveErpPeriodRange, zonedToday } from '../../lib/businessTime';
import {
  TrendingUp,
  Calendar,
  Users,
  Wallet,
  Clock,
  AlertTriangle,
  CreditCard,
  Scissors,
  Sparkles,
  BarChart3,
  Flame,
  Star,
  ArrowDownRight,
  UserPlus,
  Info,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenNewAppointment: () => void;
  onOpenWalkIn: () => void;
  onOpenNewPayment: () => void;
}

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const SHORT_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

function growthPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function mapMonthlySeriesPoints(metrics: ErpDashboardMetrics): RevenuePoint[] {
  const rows = metrics.monthlySeries ?? [];
  const pts: RevenuePoint[] = rows.map((row, idx) => {
    const [y, m] = row.month.split('-').map(Number);
    const mIdx = Math.max(0, Math.min(11, (m || 1) - 1));
    const isLast = idx === rows.length - 1;
    return {
      label: `${MONTH_NAMES[mIdx]} ${y}${isLast ? ' (En cours)' : ''}`,
      shortLabel: SHORT_MONTHS[mIdx],
      revenue: row.revenueCollected ?? 0,
      billedRevenue: row.revenueBilled ?? 0,
      realizedRevenue: row.revenueRealized ?? 0,
      appointments: row.completedAppointments,
      activeAppointments: row.activeAppointments,
      cancelledAppointments: row.cancelledAppointments,
      expenses: row.expenses ?? 0,
      margin: row.margin ?? 0,
      growth: null,
    };
  });
  pts.forEach((p, idx) => {
    if (idx > 0) p.growth = growthPercent(p.revenue, pts[idx - 1].revenue);
  });
  return pts;
}

function mapWeeklySeriesPoints(metrics: ErpDashboardMetrics): RevenuePoint[] {
  const pts: RevenuePoint[] = (metrics.weeklySeries ?? []).map((row) => ({
    label: `${row.label} (${row.fromDate} → ${row.toDate})`,
    shortLabel: row.shortLabel,
    revenue: row.revenueCollected ?? 0,
    billedRevenue: row.revenueBilled ?? 0,
    realizedRevenue: row.revenueRealized ?? 0,
    appointments: row.completedAppointments,
    activeAppointments: row.activeAppointments,
    cancelledAppointments: 0,
    expenses: row.expenses ?? 0,
    margin: row.margin ?? 0,
    growth: null,
  }));
  pts.forEach((p, idx) => {
    if (idx > 0) p.growth = growthPercent(p.revenue, pts[idx - 1].revenue);
  });
  return pts;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewAppointment,
  onOpenWalkIn,
  onOpenNewPayment,
}) => {
  const {
    activeSalon,
    salonTimezone,
    appointments,
    transactions,
    expenses,
    stocks,
    services,
    staff,
    financialSummary,
    dashboardMetrics,
    loadDashboardMetrics,
    formatPrice,
    updateAppointmentStatus,
  } = useApp();
  const { isAuthenticated, hasPermission } = useOptionalAuth();

  // Période unifiée des indicateurs principaux (KPIs, palmarès, encaissements, équipe, affluence)
  const [kpiPeriod, setKpiPeriod] =
    useState<Extract<ErpDashboardPeriod, 'month' | '30d' | '6m' | '12m'>>('month');

  // Contrôles de la courbe d'évolution
  const [revenuePeriod, setRevenuePeriod] = useState<PeriodKey>('6m');
  const [revenueMetric, setRevenueMetric] = useState<'revenue' | 'appointments' | 'margin'>('revenue');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [selectedRevenueIndex, setSelectedRevenueIndex] = useState<number | null>(null);

  // Contrôles d'occupation horaire
  const [busyHoursDayFilter, setBusyHoursDayFilter] = useState<HourlyDayFilter>('all');
  const [hoveredHour, setHoveredHour] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);

  // Contrôles du palmarès prestations
  const [serviceMetricSort, setServiceMetricSort] = useState<'revenue' | 'volume'>('revenue');
  const [serviceScope, setServiceScope] = useState<ServicePerformanceScope>('completed');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const kpiRange = useMemo(() => resolveErpPeriodRange(kpiPeriod, salonTimezone), [kpiPeriod, salonTimezone]);
  const chartRange = useMemo(
    () => resolveErpPeriodRange(revenuePeriod, salonTimezone),
    [revenuePeriod, salonTimezone],
  );

  const [kpiServerMetrics, setKpiServerMetrics] = useState<ErpDashboardMetrics | null>(null);
  const [chartServerMetrics, setChartServerMetrics] = useState<ErpDashboardMetrics | null>(null);

  // Chargement des métriques serveur pour la période des KPIs & le filtre d'affluence
  useEffect(() => {
    let cancelled = false;
    void loadDashboardMetrics({
      from: kpiRange.from,
      to: kpiRange.to,
      dayFilter: busyHoursDayFilter,
    }).then((res) => {
      if (!cancelled) setKpiServerMetrics(res);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeSalon.id,
    kpiRange.from,
    kpiRange.to,
    busyHoursDayFilter,
    appointments,
    transactions,
    expenses,
    loadDashboardMetrics,
  ]);

  // Chargement des métriques serveur pour le graphique d'évolution
  useEffect(() => {
    let cancelled = false;
    if (
      chartRange.from === kpiRange.from &&
      chartRange.to === kpiRange.to &&
      busyHoursDayFilter === 'all' &&
      kpiServerMetrics
    ) {
      setChartServerMetrics(kpiServerMetrics);
      return;
    }
    void loadDashboardMetrics({
      from: chartRange.from,
      to: chartRange.to,
      dayFilter: 'all',
    }).then((res) => {
      if (!cancelled) setChartServerMetrics(res);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeSalon.id,
    chartRange.from,
    chartRange.to,
    kpiRange.from,
    kpiRange.to,
    busyHoursDayFilter,
    kpiServerMetrics,
    appointments,
    transactions,
    expenses,
    loadDashboardMetrics,
  ]);

  // Réutilisation immédiate du préchargement si les dates correspondent
  const resolvedKpiMetrics = useMemo(() => {
    if (kpiServerMetrics) return kpiServerMetrics;
    if (
      dashboardMetrics &&
      dashboardMetrics.periodFrom === kpiRange.from &&
      dashboardMetrics.periodTo === kpiRange.to &&
      dashboardMetrics.dayFilter === busyHoursDayFilter
    ) {
      return dashboardMetrics;
    }
    return null;
  }, [kpiServerMetrics, dashboardMetrics, kpiRange.from, kpiRange.to, busyHoursDayFilter]);

  const resolvedChartMetrics = useMemo(() => {
    if (chartServerMetrics) return chartServerMetrics;
    if (
      dashboardMetrics &&
      dashboardMetrics.periodFrom === chartRange.from &&
      dashboardMetrics.periodTo === chartRange.to
    ) {
      return dashboardMetrics;
    }
    return null;
  }, [chartServerMetrics, dashboardMetrics, chartRange.from, chartRange.to]);

  const canViewFinance = resolvedKpiMetrics
    ? resolvedKpiMetrics.permissions.canViewFinance
    : !isAuthenticated ||
      hasPermission('payments.read', activeSalon.id) ||
      hasPermission('reports.read', activeSalon.id);
  const canViewExpenses = resolvedKpiMetrics
    ? resolvedKpiMetrics.permissions.canViewExpenses
    : !isAuthenticated || hasPermission('expenses.read', activeSalon.id);
  const canViewAppointments = resolvedKpiMetrics
    ? resolvedKpiMetrics.permissions.canViewAppointments
    : !isAuthenticated ||
      hasPermission('appointments.read', activeSalon.id) ||
      hasPermission('reports.read', activeSalon.id);

  const salonAppointments = useMemo(
    () => appointments.filter((a) => a.salonId === activeSalon.id),
    [appointments, activeSalon.id],
  );
  const salonTransactions = useMemo(
    () => transactions.filter((t) => t.salonId === activeSalon.id),
    [transactions, activeSalon.id],
  );
  const salonExpenses = useMemo(
    () => expenses.filter((e) => e.salonId === activeSalon.id),
    [expenses, activeSalon.id],
  );
  const salonServices = useMemo(
    () => services.filter((s) => s.salonId === activeSalon.id),
    [services, activeSalon.id],
  );
  const salonStaff = useMemo(
    () => staff.filter((s) => s.salonId === activeSalon.id),
    [staff, activeSalon.id],
  );
  const salonStocks = useMemo(
    () => stocks.filter((st) => st.salonId === activeSalon.id),
    [stocks, activeSalon.id],
  );

  // Totaux locaux bornés exactement à [kpiRange.from, kpiRange.to] lorsque le RPC dashboard est absent
  const localTotals = useMemo(
    () =>
      computeFinancialTotals(salonTransactions, salonAppointments, salonExpenses, {
        from: kpiRange.from,
        to: kpiRange.to,
        timeZone: salonTimezone,
      }),
    [salonTransactions, salonAppointments, salonExpenses, kpiRange.from, kpiRange.to, salonTimezone],
  );

  // Date du jour dans le fuseau du salon
  const todayStr = resolvedKpiMetrics?.today ?? zonedToday(salonTimezone);
  const todayAppointmentsAll = useMemo(
    () =>
      salonAppointments
        .filter((a) => appointmentBusinessDate(a, salonTimezone) === todayStr)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [salonAppointments, salonTimezone, todayStr],
  );
  const todayActiveAppointments = useMemo(
    () => todayAppointmentsAll.filter(isBilledAppointment),
    [todayAppointmentsAll],
  );

  const todayCountActive = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.todayAppointmentsActive
    : todayActiveAppointments.length;
  const completedToday = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.todayAppointmentsCompleted
    : todayAppointmentsAll.filter((a) => a.status === 'completed').length;
  const inProgressToday = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.todayAppointmentsInProgress
    : todayAppointmentsAll.filter((a) => a.status === 'in_progress').length;
  const todayCancelledOrNoShow = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.todayAppointmentsCancelled + resolvedKpiMetrics.kpis.todayAppointmentsNoShow
    : todayAppointmentsAll.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length;

  // KPIs financiers principaux alignés sur [kpiRange.from, kpiRange.to]
  const totalRevenue = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.revenueCollectedNet ?? 0)
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.revenueCollected
      : localTotals.collectedNet;

  const totalExpenses = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.expensesNet ?? 0)
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.expenses
      : localTotals.expensesNet;

  const netMargin = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.netMargin ?? totalRevenue - totalExpenses)
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.netBalance
      : localTotals.netMargin;

  const confirmedPaymentCount = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.confirmedPaymentCount ?? 0)
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.paymentCount
      : localTotals.confirmedPaymentCount;

  const pendingPaymentsAmount = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.pendingPaymentsAmount ?? 0)
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.pendingAmount
      : localTotals.pendingAmount;

  const averageBasket = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.averageBasket
    : confirmedPaymentCount > 0
      ? Math.round(totalRevenue / confirmedPaymentCount)
      : null;

  const billedRevenue = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.revenueBilled ?? 0)
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.revenueBilled
      : localTotals.billedRevenue;

  const realizedRevenue = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.revenueRealized ?? 0)
    : localTotals.realizedRevenue;

  const outstandingAmount = resolvedKpiMetrics
    ? (resolvedKpiMetrics.kpis.outstanding ?? Math.max(billedRevenue - totalRevenue, 0))
    : kpiPeriod === 'month' && financialSummary
      ? financialSummary.outstanding
      : Math.max(billedRevenue - totalRevenue, 0);

  const completedAppointmentsCount = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.appointmentsCompleted
    : localTotals.appointmentsCompleted;

  const cancelledOrNoShowCount = resolvedKpiMetrics
    ? resolvedKpiMetrics.kpis.appointmentsCancelled + resolvedKpiMetrics.kpis.appointmentsNoShow
    : localTotals.appointmentsCancelled + localTotals.appointmentsNoShow;

  // Variation mensuelle calculée sur les données réelles du graphique
  const monthlyData = useMemo(() => {
    if (resolvedChartMetrics) {
      return revenuePeriod === 'month_weeks'
        ? mapWeeklySeriesPoints(resolvedChartMetrics)
        : mapMonthlySeriesPoints(resolvedChartMetrics);
    }
    return buildRevenueSeries(revenuePeriod, salonTransactions, salonAppointments, salonExpenses, {
      timeZone: salonTimezone,
    });
  }, [
    resolvedChartMetrics,
    revenuePeriod,
    salonTransactions,
    salonAppointments,
    salonExpenses,
    salonTimezone,
  ]);

  const revenueGrowth = useMemo(() => {
    const sourceSeries =
      revenuePeriod === 'month_weeks'
        ? buildRevenueSeries('6m', salonTransactions, salonAppointments, salonExpenses, {
            timeZone: salonTimezone,
          })
        : monthlyData;
    return sourceSeries.length < 2 ? null : sourceSeries[sourceSeries.length - 1].growth;
  }, [revenuePeriod, monthlyData, salonTransactions, salonAppointments, salonExpenses, salonTimezone]);

  // Moyens de paiement sur [kpiRange.from, kpiRange.to]
  const byMethod = useMemo(() => {
    if (resolvedKpiMetrics) return resolvedKpiMetrics.byMethod;
    if (kpiPeriod === 'month' && financialSummary) return financialSummary.byMethod;
    return localTotals.byMethod;
  }, [resolvedKpiMetrics, kpiPeriod, financialSummary, localTotals.byMethod]);

  const mobileMoneyTotal =
    (byMethod.wave ?? 0) +
    (byMethod.orange_money ?? 0) +
    (byMethod.mtn_momo ?? 0) +
    (byMethod.moov_money ?? 0);
  const cashTotal = byMethod.cash ?? 0;
  const cardTotal = byMethod.card ?? 0;

  const lowStockItems = salonStocks.filter(
    (item) => item.isActive !== false && item.quantity <= item.minThreshold,
  );

  const periodGrowth = useMemo(() => {
    const first = monthlyData[0];
    const last = monthlyData[monthlyData.length - 1];
    if (!first || !last || first === last || first.revenue <= 0) return null;
    return Math.round(((last.revenue - first.revenue) / first.revenue) * 1000) / 10;
  }, [monthlyData]);

  const maxRevenueVal = useMemo(() => {
    const vals = monthlyData.map((d) =>
      revenueMetric === 'revenue'
        ? d.revenue
        : revenueMetric === 'appointments'
          ? d.appointments
          : Math.max(d.margin, 0),
    );
    return Math.max(...vals, 1);
  }, [monthlyData, revenueMetric]);

  const chartPeriodAverage = useMemo(() => {
    if (monthlyData.length === 0) return 0;
    const sum = monthlyData.reduce(
      (acc, d) =>
        acc +
        (revenueMetric === 'revenue'
          ? d.revenue
          : revenueMetric === 'appointments'
            ? d.appointments
            : d.margin),
      0,
    );
    return Math.round(sum / monthlyData.length);
  }, [monthlyData, revenueMetric]);

  // Occupation horaire réelle (durée chevauchée / capacité disponible)
  const hourlyData: HourlyPoint[] = useMemo(() => {
    if (resolvedKpiMetrics && resolvedKpiMetrics.permissions.canViewAppointments) {
      return resolvedKpiMetrics.hourlyOccupancy
        .filter((slot) => slot.availableMinutes > 0 || slot.occupiedMinutes > 0)
        .map((slot) => ({
          hour: slot.hour,
          count: slot.activeAppointments,
          activeAppointments: slot.activeAppointments,
          completedAppointments: slot.completedAppointments,
          occupiedMinutes: slot.occupiedMinutes,
          availableMinutes: slot.availableMinutes,
          occupancyRate: slot.occupancyRate,
          intensity: slot.occupancyRate >= 75 ? 'peak' : slot.occupancyRate >= 45 ? 'moderate' : 'calm',
        }));
    }
    return buildHourlySeries(salonAppointments, busyHoursDayFilter, {
      from: kpiRange.from,
      to: kpiRange.to,
      timeZone: salonTimezone,
      staff: salonStaff,
    });
  }, [
    resolvedKpiMetrics,
    salonAppointments,
    busyHoursDayFilter,
    kpiRange.from,
    kpiRange.to,
    salonTimezone,
    salonStaff,
  ]);

  const peakHourItem = useMemo(() => {
    return [...hourlyData]
      .filter((h) => h.occupiedMinutes > 0)
      .sort((a, b) => b.occupancyRate - a.occupancyRate || b.occupiedMinutes - a.occupiedMinutes)[0];
  }, [hourlyData]);
  const activeHourlyPoint = useMemo(() => {
    const activeHour = selectedHour ?? hoveredHour;
    return activeHour ? (hourlyData.find((point) => point.hour === activeHour) ?? null) : null;
  }, [hourlyData, hoveredHour, selectedHour]);

  // Palmarès des prestations sur [kpiRange.from, kpiRange.to]
  const topServicesData = useMemo(() => {
    if (resolvedKpiMetrics && resolvedKpiMetrics.permissions.canViewAppointments) {
      const rows = resolvedKpiMetrics.servicePerformance.map((srv) => {
        const volume = serviceScope === 'billed' ? srv.billedVolume : srv.completedVolume;
        const totalGeneratedRevenue = serviceScope === 'billed' ? srv.billedRevenue : srv.completedRevenue;
        return {
          id: srv.serviceId,
          name: srv.name,
          category: srv.category,
          price: srv.price,
          durationMinutes: srv.durationMinutes,
          volume,
          totalGeneratedRevenue,
          completedVolume: srv.completedVolume,
          completedRevenue: srv.completedRevenue,
          billedVolume: srv.billedVolume,
          billedRevenue: srv.billedRevenue,
          cancelledVolume: srv.cancelledVolume,
          noShowVolume: srv.noShowVolume,
          revenueShare: 0,
          volumeShare: 0,
        };
      });
      const totalRev = rows.reduce((acc, r) => acc + r.totalGeneratedRevenue, 0);
      const totalVol = rows.reduce((acc, r) => acc + r.volume, 0);
      rows.forEach((r) => {
        r.revenueShare = totalRev > 0 ? Math.round((r.totalGeneratedRevenue / totalRev) * 100) : 0;
        r.volumeShare = totalVol > 0 ? Math.round((r.volume / totalVol) * 100) : 0;
      });
      return rows.sort((a, b) =>
        serviceMetricSort === 'revenue'
          ? b.totalGeneratedRevenue - a.totalGeneratedRevenue || b.volume - a.volume
          : b.volume - a.volume || b.totalGeneratedRevenue - a.totalGeneratedRevenue,
      );
    }

    return buildServicePerformance(salonAppointments, salonServices, serviceMetricSort, {
      from: kpiRange.from,
      to: kpiRange.to,
      scope: serviceScope,
      timeZone: salonTimezone,
    });
  }, [
    resolvedKpiMetrics,
    serviceScope,
    serviceMetricSort,
    salonAppointments,
    salonServices,
    kpiRange.from,
    kpiRange.to,
    salonTimezone,
  ]);

  const starService = useMemo(
    () => topServicesData.find((s) => s.volume > 0) ?? topServicesData[0],
    [topServicesData],
  );

  // Activité réelle de l'équipe sur [kpiRange.from, kpiRange.to] (réalisées `completed` vs actives)
  const staffStatsRows = useMemo(() => {
    const avatarMap = new Map(salonStaff.map((s) => [s.id, s.avatar]));
    if (resolvedKpiMetrics && resolvedKpiMetrics.permissions.canViewAppointments) {
      return resolvedKpiMetrics.staffActivity.map((st) => ({
        id: st.staffId,
        name: st.name,
        avatar: avatarMap.get(st.staffId),
        commissionRate: st.commissionRate,
        completedAppointments: st.completedAppointments,
        billedAppointments: st.billedAppointments,
        completedRevenue: st.completedRevenue,
      }));
    }

    return salonStaff.map((st) => {
      const inRange = salonAppointments.filter((a) => {
        if (a.staffId !== st.id) return false;
        const d = appointmentBusinessDate(a, salonTimezone);
        return d >= kpiRange.from && d <= kpiRange.to;
      });
      const active = inRange.filter(isBilledAppointment);
      const completed = active.filter((a) => a.status === 'completed');
      return {
        id: st.id,
        name: st.name,
        avatar: st.avatar,
        commissionRate: st.commissionRate,
        completedAppointments: completed.length,
        billedAppointments: active.length,
        completedRevenue: completed.reduce((acc, a) => acc + a.price, 0),
      };
    });
  }, [resolvedKpiMetrics, salonStaff, salonAppointments, salonTimezone, kpiRange.from, kpiRange.to]);

  const periodLabel =
    kpiPeriod === 'month'
      ? 'Mois en cours'
      : kpiPeriod === '30d'
        ? '30 derniers jours'
        : kpiPeriod === '6m'
          ? '6 derniers mois'
          : '12 derniers mois';
  const activeRevenuePointIndex = selectedRevenueIndex ?? hoveredMonthIndex;
  const activeRevenuePoint =
    activeRevenuePointIndex === null ? null : (monthlyData[activeRevenuePointIndex] ?? null);

  return (
    <div className="space-y-5 animate-in fade-in sm:space-y-8">
      {/* 0. Alerte stock critique */}
      {lowStockItems.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-600/40 bg-amber-950/40 p-4 text-xs text-amber-200 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Alerte Stock Critique :</span> {lowStockItems.length} produit(s) en
              dessous du seuil minimum ({lowStockItems.map((i) => i.name).join(', ')}).
            </div>
          </div>
          <span className="self-start rounded-lg border border-amber-500/30 bg-amber-900/60 px-2.5 py-1 text-xs font-semibold text-amber-300 sm:self-auto">
            À réapprovisionner
          </span>
        </div>
      )}

      {/* BANDEAU PÉRIMÈTRE TEMPOREL & FUSEAU MÉTIER */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#27272c] bg-[#161619] p-3.5 shadow-sm lg:flex-row lg:items-center sm:p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-white">Périmètre des indicateurs : {periodLabel}</span>
            <span className="font-mono text-[11px] bg-[#222226] text-[#E5C378] px-2 py-0.5 rounded-md">
              {kpiRange.from} → {kpiRange.to}
            </span>
            <span className="font-mono text-[11px] bg-[#1d1c17] border border-[#C9A45C]/30 text-[#C9A45C] px-2 py-0.5 rounded-md">
              Fuseau {salonTimezone}
            </span>
            <span className="hidden text-[11px] text-stone-400 sm:block">
              {resolvedKpiMetrics ? '• Agrégat serveur complet' : '• Vue locale (fenêtre chargée)'}
            </span>
          </div>
          <p className="hidden text-[11px] text-stone-400 sm:block">
            Encaissé = paiements confirmés nets des remboursements · Facturé = RDV actifs hors annulés/absents
            · Réalisé = RDV terminés (<span className="font-mono text-stone-300">completed</span>)
          </p>
        </div>

        <div className="grid w-full shrink-0 grid-cols-2 gap-1 rounded-xl border border-[#29292e] bg-[#111113] p-1 min-[420px]:grid-cols-4 lg:w-auto">
          {(
            [
              ['month', 'Mois en cours'],
              ['30d', '30 jours'],
              ['6m', '6 mois'],
              ['12m', '12 mois'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={kpiPeriod === key}
              onClick={() => setKpiPeriod(key)}
              className={`min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                kpiPeriod === key
                  ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. HERO KPI GRID */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {/* KPI 1: Encaissé Net sur la période */}
        <div className="relative overflow-hidden rounded-2xl border border-[#27272c] bg-[#161619] p-4 shadow-sm transition-all hover:border-[#C9A45C]/40 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">CA Encaissé Net ({periodLabel})</span>
            <div className="w-8 h-8 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {canViewFinance ? formatPrice(totalRevenue) : 'Accès restreint'}
          </div>
          <div
            className={`flex items-center gap-1.5 text-[11px] font-semibold mt-2 ${
              !canViewFinance || revenueGrowth === null
                ? 'text-stone-500'
                : revenueGrowth >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
            }`}
          >
            {!canViewFinance ? (
              <span>Permission finance requise</span>
            ) : revenueGrowth === null ? (
              <span>
                {pendingPaymentsAmount > 0
                  ? `Confirmé net (+${formatPrice(pendingPaymentsAmount)} en attente)`
                  : 'Confirmé net des remboursements'}
              </span>
            ) : (
              <>
                {revenueGrowth >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {revenueGrowth >= 0 ? '+' : ''}
                  {revenueGrowth}% vs mois précédent
                </span>
              </>
            )}
          </div>
        </div>

        {/* KPI 2: Rendez-vous actifs aujourd'hui */}
        <div className="relative overflow-hidden rounded-2xl border border-[#27272c] bg-[#161619] p-4 shadow-sm transition-all hover:border-emerald-500/40 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">RDV actifs du jour</span>
            <div className="w-8 h-8 rounded-xl bg-[#17201c] border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {canViewAppointments ? `${todayCountActive} RDV` : 'Accès restreint'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400 mt-2">
            {canViewAppointments ? (
              <>
                <span className="text-emerald-400 font-semibold">{completedToday} terminés</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">{inProgressToday} au fauteuil</span>
                {todayCancelledOrNoShow > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-stone-500">{todayCancelledOrNoShow} annulé(s)/absent(s)</span>
                  </>
                )}
              </>
            ) : (
              <span>Permission planning requise</span>
            )}
          </div>
        </div>

        {/* KPI 3: Panier Moyen Encaissé */}
        <div className="relative overflow-hidden rounded-2xl border border-[#27272c] bg-[#161619] p-4 shadow-sm transition-all hover:border-purple-500/40 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">Panier Moyen Encaissé</span>
            <div className="w-8 h-8 rounded-xl bg-[#1f1b24] border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#E5C378]">
            {!canViewFinance ? 'Accès restreint' : averageBasket === null ? '—' : formatPrice(averageBasket)}
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            {!canViewFinance
              ? 'Permission finance requise'
              : averageBasket === null
                ? 'Aucun paiement confirmé sur la période'
                : `Sur ${confirmedPaymentCount} paiement(s) confirmé(s)`}
          </div>
        </div>

        {/* KPI 4: Résultat Net sur la même période */}
        <div className="relative overflow-hidden rounded-2xl border border-[#27272c] bg-[#161619] p-4 shadow-sm transition-all hover:border-[#C9A45C]/40 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">Résultat Net ({periodLabel})</span>
            <div className="w-8 h-8 rounded-xl bg-[#191e24] border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-extrabold ${
              !canViewFinance || !canViewExpenses
                ? 'text-stone-400'
                : netMargin >= 0
                  ? 'text-[#E5C378]'
                  : 'text-red-400'
            }`}
          >
            {canViewFinance && canViewExpenses ? formatPrice(netMargin) : 'Accès restreint'}
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            {canViewFinance && canViewExpenses
              ? `Encaissé − dépenses (${formatPrice(totalExpenses)}) · hors commissions`
              : 'Permissions finance & dépenses requises'}
          </div>
        </div>
      </div>

      {/* SYNTHÈSE FACTURÉ vs RÉALISÉ vs ENCAISSÉ */}
      {canViewAppointments && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#242429] bg-[#141417] p-3 text-xs sm:gap-3 sm:p-4 lg:grid-cols-4">
          <div>
            <span className="text-stone-400 block">Facturé actif (hors annulés/absents)</span>
            <span className="text-sm font-bold text-white mt-0.5 block">{formatPrice(billedRevenue)}</span>
          </div>
          <div>
            <span className="text-stone-400 block">CA réalisé (statut completed)</span>
            <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
              {formatPrice(realizedRevenue)} · {completedAppointmentsCount} RDV
            </span>
          </div>
          <div>
            <span className="text-stone-400 block">Reste à encaisser sur la période</span>
            <span className="text-sm font-bold text-amber-300 mt-0.5 block">
              {canViewFinance ? formatPrice(outstandingAmount) : '—'}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block">Annulés & absents exclus</span>
            <span className="text-sm font-bold text-stone-300 mt-0.5 block">
              {cancelledOrNoShowCount} RDV exclus des revenus
            </span>
          </div>
        </div>
      )}

      {/* QUICK ACTIONS COUNTER BAR */}
      <div className="hidden flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#27272c] bg-[#18181b] p-4 shadow-sm md:flex">
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <Clock className="w-4 h-4 text-[#C9A45C]" />
          <span>Raccourcis comptoir :</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenWalkIn}
            className="bg-[#C9A45C]/15 hover:bg-[#C9A45C]/25 text-[#E5C378] border border-[#C9A45C]/40 font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Client de passage</span>
          </button>

          <button
            onClick={onOpenNewAppointment}
            className="bg-[#242429] hover:bg-[#2c2c33] text-white border border-[#383840] font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" />
            <span>+ Nouveau Rendez-vous</span>
          </button>

          <button
            onClick={onOpenNewPayment}
            className="bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>+ Encaisser Paiement</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. INTERACTIVE CHART: MONTHLY REVENUE (Évolution du CA)      */}
      {/* ============================================================ */}
      <div className="space-y-4 rounded-3xl border border-[#27272c] bg-[#161619] p-4 shadow-xl sm:space-y-6 sm:p-6">
        {/* Chart Header & Controls */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#242428] pb-4 sm:flex-row sm:items-center sm:pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>
                Performance Financière ({chartRange.from} → {chartRange.to})
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              {revenuePeriod === 'month_weeks'
                ? 'Évolution Hebdomadaire du Mois en Cours'
                : "Évolution du Chiffre d'Affaires Mensuel"}
            </h2>
            <p className="mt-1 hidden text-xs text-stone-400 sm:block">
              Encaissements confirmés nets, rendez-vous réalisés (<span className="font-mono">completed</span>
              ) et résultat net de {activeSalon.name} · Fuseau {salonTimezone}.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
            {/* Metric Selector */}
            <div className="grid grid-cols-3 rounded-xl border border-[#29292e] bg-[#111113] p-1">
              <button
                type="button"
                aria-pressed={revenueMetric === 'revenue'}
                onClick={() => setRevenueMetric('revenue')}
                className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                  revenueMetric === 'revenue'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="sm:hidden">CA</span>
                <span className="hidden sm:inline">Encaissé Net</span>
              </button>
              <button
                type="button"
                aria-pressed={revenueMetric === 'appointments'}
                onClick={() => setRevenueMetric('appointments')}
                className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                  revenueMetric === 'appointments'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="sm:hidden">RDV</span>
                <span className="hidden sm:inline">RDV Réalisés</span>
              </button>
              <button
                type="button"
                aria-pressed={revenueMetric === 'margin'}
                onClick={() => setRevenueMetric('margin')}
                className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                  revenueMetric === 'margin'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="sm:hidden">Net</span>
                <span className="hidden sm:inline">Résultat Net</span>
              </button>
            </div>

            {/* Timeframe Selector */}
            <div className="grid grid-cols-3 rounded-xl border border-[#29292e] bg-[#111113] p-1">
              <button
                type="button"
                aria-pressed={revenuePeriod === '6m'}
                onClick={() => {
                  setSelectedRevenueIndex(null);
                  setRevenuePeriod('6m');
                }}
                className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all sm:px-2.5 sm:text-xs ${
                  revenuePeriod === '6m' ? 'bg-[#25252b] text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                6 mois
              </button>
              <button
                type="button"
                aria-pressed={revenuePeriod === '12m'}
                onClick={() => {
                  setSelectedRevenueIndex(null);
                  setRevenuePeriod('12m');
                }}
                className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all sm:px-2.5 sm:text-xs ${
                  revenuePeriod === '12m' ? 'bg-[#25252b] text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                12 mois
              </button>
              <button
                type="button"
                aria-pressed={revenuePeriod === 'month_weeks'}
                onClick={() => {
                  setSelectedRevenueIndex(null);
                  setRevenuePeriod('month_weeks');
                }}
                className={`min-h-11 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all sm:px-2.5 sm:text-xs ${
                  revenuePeriod === 'month_weeks'
                    ? 'bg-[#25252b] text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="sm:hidden">Semaines</span>
                <span className="hidden sm:inline">Mois (semaines)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Chart Container */}
        <div className="pt-3 sm:pt-4">
          {activeRevenuePoint && (
            <div
              role="status"
              data-testid="dashboard-revenue-point-detail"
              className="mb-3 rounded-xl border border-[#C9A45C]/60 bg-[#1e1e24] p-3 shadow-lg"
            >
              <div className="text-[11px] font-bold text-stone-300">{activeRevenuePoint.label}</div>
              <div className="mt-0.5 text-base font-extrabold text-[#E5C378]">
                {revenueMetric === 'revenue'
                  ? formatPrice(activeRevenuePoint.revenue)
                  : revenueMetric === 'appointments'
                    ? `${activeRevenuePoint.appointments} RDV réalisés`
                    : formatPrice(activeRevenuePoint.margin)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stone-400">
                <span>
                  Réalisés : <strong className="text-white">{activeRevenuePoint.appointments}</strong>
                  {' / '}Actifs :{' '}
                  <strong className="text-stone-200">{activeRevenuePoint.activeAppointments}</strong>
                </span>
                <span aria-hidden="true">•</span>
                <span
                  className={
                    activeRevenuePoint.growth !== null && activeRevenuePoint.growth >= 0
                      ? 'font-semibold text-emerald-400'
                      : 'font-semibold text-red-400'
                  }
                >
                  {activeRevenuePoint.growth === null
                    ? 'Variation indisponible'
                    : `${activeRevenuePoint.growth >= 0 ? '+' : ''}${activeRevenuePoint.growth}%`}
                </span>
              </div>
            </div>
          )}

          {/* Bars */}
          <div className="flex h-56 w-full items-end gap-1.5 px-1 pt-4 sm:h-72 sm:gap-4 sm:px-2 sm:pt-6">
            {monthlyData.map((item, idx) => {
              const currentVal =
                revenueMetric === 'revenue'
                  ? item.revenue
                  : revenueMetric === 'appointments'
                    ? item.appointments
                    : item.margin;

              const isNegative = currentVal < 0;
              const heightPercent = isNegative
                ? 8
                : currentVal === 0
                  ? 4
                  : Math.max(8, Math.round((currentVal / maxRevenueVal) * 100));
              const isHovered = hoveredMonthIndex === idx;
              const isSelected = selectedRevenueIndex === idx;
              const isActive = isHovered || isSelected;
              const accessibleValue =
                revenueMetric === 'appointments'
                  ? `${currentVal} rendez-vous réalisés`
                  : formatPrice(currentVal);

              return (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${item.label} : ${accessibleValue}`}
                  onMouseEnter={() => setHoveredMonthIndex(idx)}
                  onMouseLeave={() => setHoveredMonthIndex(null)}
                  onFocus={() => setHoveredMonthIndex(idx)}
                  onBlur={() => setHoveredMonthIndex(null)}
                  onClick={() => setSelectedRevenueIndex((current) => (current === idx ? null : idx))}
                  className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#E5C378] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161619]"
                >
                  <span
                    className={`mb-1 text-[10px] font-bold transition-all ${
                      isNegative
                        ? 'text-red-400'
                        : isActive
                          ? 'scale-110 text-[#C9A45C] opacity-100'
                          : 'text-stone-500 opacity-70 group-hover:opacity-100'
                    }`}
                    aria-hidden="true"
                  >
                    {revenueMetric === 'appointments' ? currentVal : `${Math.round(currentVal / 1000)}k`}
                  </span>

                  <span className="flex w-full max-w-[48px] flex-1 flex-col justify-end overflow-hidden rounded-xl border border-[#242429] bg-[#121215] p-1 transition-all group-hover:border-[#C9A45C]/50">
                    <span
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        isNegative
                          ? 'bg-red-500/70'
                          : isActive
                            ? 'bg-gradient-to-t from-[#C9A45C] to-[#E5C378] shadow-[0_0_20px_rgba(201,164,92,0.5)]'
                            : idx === monthlyData.length - 1
                              ? 'bg-gradient-to-t from-[#a88237] to-[#C9A45C]'
                              : 'bg-gradient-to-t from-[#26241e] to-[#594726] group-hover:from-[#C9A45C]/60 group-hover:to-[#C9A45C]'
                      }`}
                    />
                  </span>

                  <span
                    className={`mt-2.5 text-[10px] font-semibold transition-colors sm:text-xs ${
                      isActive ? 'font-bold text-[#E5C378]' : 'text-stone-400'
                    }`}
                    aria-hidden="true"
                  >
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Baseline Indicator */}
          <div className="mt-2 flex flex-col gap-2 border-t border-[#222226] pt-3 text-[11px] text-stone-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C9A45C]" />
                {revenueMetric === 'revenue'
                  ? 'Encaissements Nets Confirmés'
                  : revenueMetric === 'appointments'
                    ? 'Rendez-vous Réalisés (completed)'
                    : 'Résultat Net (Encaissé − Dépenses)'}
              </span>
              <span className="text-stone-400 sm:hidden">Touchez une barre pour consulter le détail.</span>
              <span className="items-center gap-1.5 hidden sm:inline-flex">
                <span className="w-2.5 h-2.5 rounded-full bg-[#353023]" />
                Moyenne période :{' '}
                {revenueMetric === 'appointments'
                  ? `${chartPeriodAverage} RDV`
                  : formatPrice(chartPeriodAverage)}
              </span>
            </div>
            <span className="text-[#C9A45C] font-semibold">
              {periodGrowth === null
                ? 'Variation période : aucune base comparable'
                : `Évolution sur la période : ${periodGrowth >= 0 ? '+' : ''}${periodGrowth}%`}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. TWO COLUMNS: BUSY HOURS & TOP-SELLING SERVICES            */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* LEFT (7 cols): BUSY HOURS / HEURES DE POINTE */}
        <div className="space-y-4 rounded-3xl border border-[#27272c] bg-[#161619] p-4 shadow-xl sm:space-y-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242428] pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Affluence & Taux d'Occupation Réel</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Occupation par Tranche de 30 min ({kpiRange.from} → {kpiRange.to})
              </h3>
            </div>

            <select
              value={busyHoursDayFilter}
              aria-label="Filtrer l’occupation par jour"
              onChange={(e) => {
                setSelectedHour(null);
                setBusyHoursDayFilter(e.target.value as HourlyDayFilter);
              }}
              className="min-h-11 w-full rounded-xl border border-[#2a2a2f] bg-[#111113] px-3 py-1.5 text-xs text-stone-200 focus:border-[#C9A45C] focus:outline-none sm:w-auto"
            >
              <option value="all">Toute la semaine (Lun - Dim)</option>
              <option value="saturday">Samedi (Grande Affluence)</option>
              <option value="friday">Vendredi (After-work)</option>
              <option value="weekday">Semaine (Lun - Jeu)</option>
            </select>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#1d1912] border border-[#C9A45C]/30 flex items-start gap-3 text-xs">
            <Clock className="w-4 h-4 text-[#C9A45C] shrink-0 mt-0.5" />
            {peakHourItem ? (
              <div>
                <span className="font-extrabold text-white">Créneau le plus chargé : </span>
                <span className="text-[#E5C378] font-bold">{peakHourItem.hour}</span>
                <span className="text-stone-400">
                  {' '}
                  ({peakHourItem.occupiedMinutes} min occupées / {peakHourItem.availableMinutes} min dispo ·{' '}
                  {peakHourItem.activeAppointments} RDV actifs)
                </span>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  Taux d’occupation réel de{' '}
                  <strong className="text-white">{peakHourItem.occupancyRate}%</strong> calculé sur la durée
                  des prestations (hors annulés et absents).
                </p>
              </div>
            ) : (
              <div>
                <span className="font-extrabold text-white">Aucune occupation sur cette sélection</span>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  Les créneaux annulés ou marqués absents sont automatiquement exclus.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {hourlyData.length === 0 ? (
              <div className="h-44 flex items-center justify-center rounded-2xl bg-[#121214] border border-[#242429] text-xs text-stone-500">
                Aucune plage ouverte ou activité enregistrée pour ce filtre.
              </div>
            ) : (
              <>
                {activeHourlyPoint && (
                  <div
                    role="status"
                    className="mb-2 rounded-xl border border-[#C9A45C]/40 bg-[#1e1c15] px-3 py-2 text-xs text-stone-300"
                  >
                    <strong className="text-[#E5C378]">{activeHourlyPoint.hour}</strong> ·{' '}
                    {activeHourlyPoint.occupancyRate}% d’occupation · {activeHourlyPoint.occupiedMinutes}/
                    {activeHourlyPoint.availableMinutes} min · {activeHourlyPoint.activeAppointments} RDV
                    actif(s)
                  </div>
                )}
                <div className="flex gap-1 sm:gap-1.5 px-2 text-center text-[10px] text-stone-500 font-bold mb-1">
                  {hourlyData.map((h, i) => {
                    const step = Math.max(2, Math.ceil(hourlyData.length / 12));
                    return (
                      <div key={h.hour} className="flex-1 truncate">
                        {i % step === 0 ? h.hour.slice(0, 2) + 'h' : ''}
                      </div>
                    );
                  })}
                </div>

                <div className="h-44 flex items-end gap-1 sm:gap-1.5 p-2 rounded-2xl bg-[#121214] border border-[#242429]">
                  {hourlyData.map((h) => {
                    const heightPercent = Math.max(
                      h.occupiedMinutes > 0 ? 12 : 4,
                      Math.min(100, h.occupancyRate),
                    );
                    const isHovered = hoveredHour === h.hour;
                    const isSelected = selectedHour === h.hour;
                    const isActive = isHovered || isSelected;

                    return (
                      <button
                        key={h.hour}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${h.hour} : ${h.occupancyRate}% d’occupation, ${h.occupiedMinutes} minutes occupées sur ${h.availableMinutes}`}
                        onMouseEnter={() => setHoveredHour(h.hour)}
                        onMouseLeave={() => setHoveredHour(null)}
                        onFocus={() => setHoveredHour(h.hour)}
                        onBlur={() => setHoveredHour(null)}
                        onClick={() => setSelectedHour((current) => (current === h.hour ? null : h.hour))}
                        className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#E5C378]"
                      >
                        <span
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            h.intensity === 'peak'
                              ? isActive
                                ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                                : 'bg-amber-500'
                              : h.intensity === 'moderate'
                                ? isActive
                                  ? 'bg-[#C9A45C]'
                                  : 'bg-[#8f743c]'
                                : isActive
                                  ? 'bg-emerald-400'
                                  : 'bg-[#293b33]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-400 pt-2 px-1">
              <div className="flex items-start gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  Calme (&lt;45%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8f743c]" />
                  Modéré (45-74%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Forte Affluence (&ge;75%)
                </span>
              </div>
              <span className="text-stone-500 hidden sm:inline">
                Durée réelle / capacité équipe ({salonTimezone})
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT (5 cols): TOP-SELLING SERVICES */}
        <div className="flex flex-col justify-between space-y-4 rounded-3xl border border-[#27272c] bg-[#161619] p-4 shadow-xl sm:space-y-5 sm:p-6 lg:col-span-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#242428] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                  <Star className="w-4 h-4 text-[#C9A45C]" />
                  <span>Palmarès des Prestations ({periodLabel})</span>
                </div>
                <h3 className="text-lg font-bold text-white">Prestations les Plus Performantes</h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex bg-[#111113] p-1 rounded-xl border border-[#27272c]">
                  <button
                    type="button"
                    aria-pressed={serviceScope === 'completed'}
                    onClick={() => setServiceScope('completed')}
                    className={`min-h-10 rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                      serviceScope === 'completed'
                        ? 'bg-[#2a2a31] text-white'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Réalisés
                  </button>
                  <button
                    type="button"
                    aria-pressed={serviceScope === 'billed'}
                    onClick={() => setServiceScope('billed')}
                    className={`min-h-10 rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                      serviceScope === 'billed'
                        ? 'bg-[#2a2a31] text-white'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Facturés actifs
                  </button>
                </div>

                <div className="flex bg-[#111113] p-1 rounded-xl border border-[#27272c]">
                  <button
                    type="button"
                    aria-pressed={serviceMetricSort === 'revenue'}
                    onClick={() => setServiceMetricSort('revenue')}
                    className={`min-h-10 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                      serviceMetricSort === 'revenue'
                        ? 'bg-[#C9A45C] text-[#101010]'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Par CA
                  </button>
                  <button
                    type="button"
                    aria-pressed={serviceMetricSort === 'volume'}
                    onClick={() => setServiceMetricSort('volume')}
                    className={`min-h-10 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                      serviceMetricSort === 'volume'
                        ? 'bg-[#C9A45C] text-[#101010]'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Par Volume
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 pt-4">
              {topServicesData.slice(0, 5).map((srv, idx) => {
                const isSelected = selectedServiceId === srv.id;
                const percentage = serviceMetricSort === 'revenue' ? srv.revenueShare : srv.volumeShare;

                return (
                  <button
                    key={srv.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedServiceId(isSelected ? null : srv.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C378] ${
                      isSelected
                        ? 'border-[#C9A45C] bg-[#1e1c15] shadow-md'
                        : 'border-[#242428] bg-[#121214] hover:border-stone-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                            idx === 0
                              ? 'bg-[#C9A45C] text-[#101010]'
                              : idx === 1
                                ? 'bg-stone-300 text-stone-900'
                                : idx === 2
                                  ? 'bg-amber-800 text-amber-100'
                                  : 'bg-[#222226] text-stone-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-bold text-white truncate block">{srv.name}</span>
                          <span className="text-[10px] text-stone-400">
                            {srv.durationMinutes} min • {formatPrice(srv.price)}
                            {srv.cancelledVolume + srv.noShowVolume > 0 && (
                              <span className="text-stone-500">
                                {' '}
                                • {srv.cancelledVolume + srv.noShowVolume} exclu(s)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-[#E5C378]">
                          {serviceMetricSort === 'revenue'
                            ? formatPrice(srv.totalGeneratedRevenue)
                            : `${srv.volume} RDV ${serviceScope === 'completed' ? 'réalisés' : 'actifs'}`}
                        </div>
                        <div className="text-[10px] font-semibold text-stone-400">{percentage}% du total</div>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[#1e1e24] overflow-hidden mt-2">
                      <div
                        style={{ width: `${percentage}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0 ? 'bg-[#C9A45C]' : idx === 1 ? 'bg-amber-400' : 'bg-stone-500'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-[#222226] bg-[#131316] p-3 text-[11px] text-stone-400 sm:flex-row sm:items-center sm:justify-between">
            {starService && starService.volume > 0 ? (
              <>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>
                    Prestation n°1 : <strong className="text-white">{starService.name}</strong>
                  </span>
                </span>
                <span className="text-[#E5C378] font-bold">
                  {serviceScope === 'completed' ? 'Réalisées' : 'Actives'}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>
                  Hors rendez-vous annulés ou absents sur {kpiRange.from} → {kpiRange.to}.
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. TODAY'S REAL-TIME SCHEDULE & PAYMENT CHANNELS             */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* LEFT (8 cols): Today's Schedule & Status updater */}
        <div className="space-y-4 rounded-3xl border border-[#27272c] bg-[#161619] p-4 shadow-xl sm:p-6 lg:col-span-8">
          <div className="flex flex-col gap-2 border-b border-[#242428] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C9A45C]" />
              <h3 className="font-bold text-white text-sm">
                Planning du jour — {todayStr} ({todayActiveAppointments.length} RDV actifs)
              </h3>
            </div>
            <span className="text-xs text-stone-400">Fuseau {salonTimezone}</span>
          </div>

          {todayAppointmentsAll.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-xs">
              Aucun rendez-vous planifié pour aujourd'hui.
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayAppointmentsAll.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[#242428] bg-[#121214] p-3 transition-colors hover:border-stone-500 sm:flex-row sm:items-center sm:p-3.5"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{apt.time}</span>
                      <span className="text-xs text-stone-500">•</span>
                      <span className="text-xs font-bold text-[#E5C378]">{apt.clientName}</span>
                      <span className="text-[10px] bg-[#222226] text-stone-400 px-2 py-0.5 rounded font-mono">
                        {apt.clientPhone}
                      </span>
                    </div>
                    <div className="text-xs text-stone-300">
                      {apt.serviceName} ({apt.durationMinutes} min) • Barbier :{' '}
                      <span className="font-semibold text-white">{apt.staffName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white mr-1 font-mono">
                      {formatPrice(apt.price)}
                    </span>

                    <select
                      value={apt.status}
                      onChange={(e) => updateAppointmentStatus(apt.id, e.target.value as AppointmentStatus)}
                      aria-label={`Mettre à jour le statut du rendez-vous de ${apt.clientName}`}
                      className={`min-h-11 rounded-xl border px-2.5 py-1.5 text-xs font-semibold cursor-pointer focus:outline-none ${
                        apt.status === 'completed'
                          ? 'bg-stone-800 text-stone-300 border-stone-700'
                          : apt.status === 'in_progress'
                            ? 'bg-amber-950 text-amber-400 border-amber-800/40'
                            : apt.status === 'confirmed'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40'
                              : apt.status === 'cancelled' || apt.status === 'no_show'
                                ? 'bg-red-950/60 text-red-300 border-red-800/40'
                                : 'bg-blue-950 text-blue-400 border-blue-800/40'
                      }`}
                    >
                      <option value="pending" className="bg-[#18181b] text-white">
                        En attente
                      </option>
                      <option value="confirmed" className="bg-[#18181b] text-white">
                        Confirmé
                      </option>
                      <option value="checked_in" className="bg-[#18181b] text-white">
                        Client arrivé
                      </option>
                      <option value="in_progress" className="bg-[#18181b] text-white">
                        En cours
                      </option>
                      <option value="completed" className="bg-[#18181b] text-white">
                        Terminé
                      </option>
                      <option value="cancelled" className="bg-[#18181b] text-white">
                        Annulé
                      </option>
                      <option value="no_show" className="bg-[#18181b] text-white">
                        Absent
                      </option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT (4 cols): Payment Channels & Staff Activity */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-4">
          <div className="space-y-4 rounded-3xl border border-[#27272c] bg-[#161619] p-4 shadow-xl sm:p-6">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#C9A45C]" />
              Encaissements Nets ({periodLabel})
            </h4>

            {!canViewFinance ? (
              <p className="text-xs text-stone-500">Permission finance requise pour voir la ventilation.</p>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      Mobile Money (Wave / OM / MTN / Moov)
                    </span>
                    <span className="font-bold text-white">{formatPrice(mobileMoneyTotal)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#111113] overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500"
                      style={{
                        width:
                          totalRevenue > 0
                            ? `${Math.max(0, Math.min(100, (mobileMoneyTotal / totalRevenue) * 100))}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      Espèces (Comptoir)
                    </span>
                    <span className="font-bold text-white">{formatPrice(cashTotal)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#111113] overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{
                        width:
                          totalRevenue > 0
                            ? `${Math.max(0, Math.min(100, (cashTotal / totalRevenue) * 100))}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      Carte bancaire
                    </span>
                    <span className="font-bold text-white">{formatPrice(cardTotal)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#111113] overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{
                        width:
                          totalRevenue > 0
                            ? `${Math.max(0, Math.min(100, (cardTotal / totalRevenue) * 100))}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-3xl border border-[#27272c] bg-[#161619] p-4 shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-stone-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C9A45C]" />
                Activité de l'équipe ({periodLabel})
              </h4>
              <Info className="w-3.5 h-3.5 text-stone-500" />
            </div>

            <div className="space-y-2.5">
              {staffStatsRows.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#111113] border border-[#242428]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {st.avatar ? (
                      <img
                        src={st.avatar}
                        alt={st.name}
                        className="w-8 h-8 rounded-full object-cover border border-[#C9A45C]/30 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#222226] border border-[#C9A45C]/30 text-[#E5C378] text-xs font-bold flex items-center justify-center shrink-0">
                        {st.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{st.name}</div>
                      <div className="text-[10px] text-stone-400">
                        {st.completedAppointments} réalisées
                        {st.billedAppointments > st.completedAppointments
                          ? ` · ${st.billedAppointments} actifs`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-[#E5C378] shrink-0">
                    {st.commissionRate}% comm.
                  </span>
                </div>
              ))}
            </div>
            <p
              data-testid="dashboard-commission-rate-note"
              className="text-[11px] text-stone-500 pt-1 leading-relaxed"
            >
              Taux configuré par membre uniquement : le calcul des montants de commissions dus par période
              n’est pas encore disponible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
