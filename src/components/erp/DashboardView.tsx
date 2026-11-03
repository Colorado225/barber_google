import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AppointmentStatus, Service } from '../../types';
import {
  TrendingUp,
  Calendar,
  Users,
  Wallet,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Banknote,
  Scissors,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  Flame,
  Star,
  ChevronRight,
  Filter,
  Layers,
  ArrowDownRight
} from 'lucide-react';

interface DashboardViewProps {
  onOpenNewAppointment: () => void;
  onOpenNewPayment: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewAppointment,
  onOpenNewPayment
}) => {
  const {
    activeSalon,
    appointments,
    transactions,
    expenses,
    stocks,
    services,
    staff,
    formatPrice,
    updateAppointmentStatus
  } = useApp();

  // Filters for interactive charts
  const [revenuePeriod, setRevenuePeriod] = useState<'6m' | '12m' | 'month_weeks'>('6m');
  const [revenueMetric, setRevenueMetric] = useState<'revenue' | 'appointments' | 'margin'>('revenue');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  const [busyHoursDayFilter, setBusyHoursDayFilter] = useState<'all' | 'saturday' | 'friday' | 'weekday'>('all');
  const [hoveredHour, setHoveredHour] = useState<string | null>(null);

  const [serviceMetricSort, setServiceMetricSort] = useState<'revenue' | 'volume'>('revenue');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const salonAppointments = useMemo(
    () => appointments.filter((a) => a.salonId === activeSalon.id),
    [appointments, activeSalon.id]
  );

  const salonTransactions = useMemo(
    () => transactions.filter((t) => t.salonId === activeSalon.id && t.status === 'completed'),
    [transactions, activeSalon.id]
  );

  const salonExpenses = useMemo(
    () => expenses.filter((e) => e.salonId === activeSalon.id),
    [expenses, activeSalon.id]
  );

  const salonServices = useMemo(
    () => services.filter((s) => s.salonId === activeSalon.id),
    [services, activeSalon.id]
  );

  const salonStaff = useMemo(
    () => staff.filter((s) => s.salonId === activeSalon.id),
    [staff, activeSalon.id]
  );

  const salonStocks = useMemo(
    () => stocks.filter((st) => st.salonId === activeSalon.id),
    [stocks, activeSalon.id]
  );

  // Financial calculations
  const totalRevenue = useMemo(
    () => salonTransactions.reduce((acc, t) => acc + t.amount, 0),
    [salonTransactions]
  );

  const totalExpenses = useMemo(
    () => salonExpenses.reduce((acc, e) => acc + e.amount, 0),
    [salonExpenses]
  );

  const estimatedMargin = totalRevenue - totalExpenses;

  // Today's stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppointments = salonAppointments.filter((a) => a.date === todayStr);

  const completedToday = todayAppointments.filter((a) => a.status === 'completed').length;
  const inProgressToday = todayAppointments.filter((a) => a.status === 'in_progress').length;
  const confirmedToday = todayAppointments.filter((a) => a.status === 'confirmed').length;

  const averageBasket =
    salonTransactions.length > 0 ? Math.round(totalRevenue / salonTransactions.length) : 3800;

  // Breakdown by payment method
  const mobileMoneyTotal = salonTransactions
    .filter((t) => ['wave', 'orange_money', 'mtn_momo', 'moov_money'].includes(t.method))
    .reduce((acc, t) => acc + t.amount, 0);

  const cashTotal = salonTransactions
    .filter((t) => t.method === 'cash')
    .reduce((acc, t) => acc + t.amount, 0);

  const lowStockItems = salonStocks.filter((item) => item.quantity <= item.minThreshold);

  // ==========================================
  // 1. DATA FOR MONTHLY REVENUE CHART
  // ==========================================
  const monthlyData = useMemo(() => {
    if (revenuePeriod === 'month_weeks') {
      return [
        { label: 'Semaine 1 (1-7 Nov)', shortLabel: 'Sem 1', revenue: 420000, appointments: 84, expenses: 110000, margin: 310000, growth: '+8.4%' },
        { label: 'Semaine 2 (8-14 Nov)', shortLabel: 'Sem 2', revenue: 485000, appointments: 96, expenses: 125000, margin: 360000, growth: '+15.5%' },
        { label: 'Semaine 3 (15-21 Nov)', shortLabel: 'Sem 3', revenue: 530000, appointments: 104, expenses: 140000, margin: 390000, growth: '+9.3%' },
        { label: 'Semaine 4 (22-28 Nov)', shortLabel: 'Sem 4', revenue: 610000, appointments: 118, expenses: 155000, margin: 455000, growth: '+15.1%' }
      ];
    } else if (revenuePeriod === '12m') {
      return [
        { label: 'Décembre 2025', shortLabel: 'Déc', revenue: 2450000, appointments: 480, expenses: 780000, margin: 1670000, growth: '+22.5%' },
        { label: 'Janvier 2026', shortLabel: 'Jan', revenue: 1680000, appointments: 340, expenses: 620000, margin: 1060000, growth: '-31.4%' },
        { label: 'Février 2026', shortLabel: 'Fév', revenue: 1820000, appointments: 365, expenses: 640000, margin: 1180000, growth: '+8.3%' },
        { label: 'Mars 2026', shortLabel: 'Mar', revenue: 1950000, appointments: 390, expenses: 660000, margin: 1290000, growth: '+7.1%' },
        { label: 'Avril 2026', shortLabel: 'Avr', revenue: 2050000, appointments: 410, expenses: 690000, margin: 1360000, growth: '+5.1%' },
        { label: 'Mai 2026', shortLabel: 'Mai', revenue: 2180000, appointments: 435, expenses: 710000, margin: 1470000, growth: '+6.3%' },
        { label: 'Juin 2026', shortLabel: 'Juin', revenue: 2120000, appointments: 420, expenses: 700000, margin: 1420000, growth: '-2.7%' },
        { label: 'Juillet 2026', shortLabel: 'Juil', revenue: 2290000, appointments: 455, expenses: 730000, margin: 1560000, growth: '+8.0%' },
        { label: 'Août 2026', shortLabel: 'Août', revenue: 2380000, appointments: 470, expenses: 750000, margin: 1630000, growth: '+3.9%' },
        { label: 'Septembre 2026', shortLabel: 'Sept', revenue: 2210000, appointments: 440, expenses: 720000, margin: 1490000, growth: '-7.1%' },
        { label: 'Octobre 2026', shortLabel: 'Oct', revenue: 2490000, appointments: 495, expenses: 770000, margin: 1720000, growth: '+12.6%' },
        { label: 'Novembre 2026 (En cours)', shortLabel: 'Nov', revenue: 2650000, appointments: 520, expenses: 810000, margin: 1840000, growth: '+6.4%' }
      ];
    } else {
      // Default: Last 6 months
      return [
        { label: 'Juin 2026', shortLabel: 'Juin', revenue: 2120000, appointments: 420, expenses: 700000, margin: 1420000, growth: '+4.2%' },
        { label: 'Juillet 2026', shortLabel: 'Juil', revenue: 2290000, appointments: 455, expenses: 730000, margin: 1560000, growth: '+8.0%' },
        { label: 'Août 2026', shortLabel: 'Août', revenue: 2380000, appointments: 470, expenses: 750000, margin: 1630000, growth: '+3.9%' },
        { label: 'Septembre 2026', shortLabel: 'Sept', revenue: 2210000, appointments: 440, expenses: 720000, margin: 1490000, growth: '-7.1%' },
        { label: 'Octobre 2026', shortLabel: 'Oct', revenue: 2490000, appointments: 495, expenses: 770000, margin: 1720000, growth: '+12.6%' },
        { label: 'Novembre 2026 (En cours)', shortLabel: 'Nov', revenue: 2650000, appointments: 520, expenses: 810000, margin: 1840000, growth: '+6.4%' }
      ];
    }
  }, [revenuePeriod]);

  // Max value for revenue scaling
  const maxRevenueVal = useMemo(() => {
    const vals = monthlyData.map((d) =>
      revenueMetric === 'revenue' ? d.revenue : revenueMetric === 'appointments' ? d.appointments : d.margin
    );
    return Math.max(...vals, 1);
  }, [monthlyData, revenueMetric]);

  // ==========================================
  // 2. DATA FOR BUSY HOURS (Affluence horaire)
  // ==========================================
  const hourlyData = useMemo(() => {
    // Base hourly slots from 08:30 to 20:00
    const rawHours = [
      { hour: '08:30', all: 4, saturday: 7, friday: 5, weekday: 3 },
      { hour: '09:00', all: 7, saturday: 12, friday: 8, weekday: 6 },
      { hour: '09:30', all: 9, saturday: 14, friday: 10, weekday: 8 },
      { hour: '10:00', all: 13, saturday: 21, friday: 14, weekday: 11 },
      { hour: '10:30', all: 16, saturday: 25, friday: 17, weekday: 13 },
      { hour: '11:00', all: 19, saturday: 28, friday: 20, weekday: 15 },
      { hour: '11:30', all: 21, saturday: 30, friday: 23, weekday: 17 },
      { hour: '12:00', all: 22, saturday: 31, friday: 25, weekday: 19 },
      { hour: '12:30', all: 18, saturday: 26, friday: 20, weekday: 15 },
      { hour: '13:00', all: 14, saturday: 22, friday: 16, weekday: 11 },
      { hour: '13:30', all: 12, saturday: 20, friday: 14, weekday: 10 },
      { hour: '14:00', all: 15, saturday: 24, friday: 17, weekday: 12 },
      { hour: '14:30', all: 17, saturday: 27, friday: 19, weekday: 14 },
      { hour: '15:00', all: 19, saturday: 30, friday: 21, weekday: 16 },
      { hour: '15:30', all: 22, saturday: 33, friday: 25, weekday: 18 },
      { hour: '16:00', all: 25, saturday: 36, friday: 29, weekday: 21 },
      { hour: '16:30', all: 28, saturday: 39, friday: 32, weekday: 24 },
      { hour: '17:00', all: 32, saturday: 42, friday: 38, weekday: 28 }, // Peak Rush
      { hour: '17:30', all: 35, saturday: 45, friday: 42, weekday: 31 }, // Peak Rush
      { hour: '18:00', all: 34, saturday: 44, friday: 40, weekday: 30 }, // Peak Rush
      { hour: '18:30', all: 30, saturday: 38, friday: 36, weekday: 26 },
      { hour: '19:00', all: 24, saturday: 32, friday: 29, weekday: 20 },
      { hour: '19:30', all: 16, saturday: 24, friday: 20, weekday: 14 },
      { hour: '20:00', all: 9, saturday: 15, friday: 12, weekday: 7 }
    ];

    return rawHours.map((h) => {
      const count =
        busyHoursDayFilter === 'saturday'
          ? h.saturday
          : busyHoursDayFilter === 'friday'
          ? h.friday
          : busyHoursDayFilter === 'weekday'
          ? h.weekday
          : h.all;

      // Occupancy percentage based on 3 active chairs (max ~45 clients in interval)
      const maxCapacity = busyHoursDayFilter === 'saturday' ? 48 : 36;
      const occupancyRate = Math.min(100, Math.round((count / maxCapacity) * 100));

      let intensity: 'calm' | 'moderate' | 'peak' = 'calm';
      if (occupancyRate >= 75) intensity = 'peak';
      else if (occupancyRate >= 45) intensity = 'moderate';

      return {
        ...h,
        count,
        occupancyRate,
        intensity
      };
    });
  }, [busyHoursDayFilter]);

  const maxHourlyCount = useMemo(() => {
    return Math.max(...hourlyData.map((d) => d.count), 1);
  }, [hourlyData]);

  // ==========================================
  // 3. DATA FOR TOP-SELLING SERVICES
  // ==========================================
  const topServicesData = useMemo(() => {
    // Generate ranking based on actual services catalog + simulated historical numbers
    const baseServices = salonServices.length > 0 ? salonServices : [
      { id: 'srv-1', name: 'Coupe classique aux ciseaux', price: 3000, category: 'coupe', durationMinutes: 30 },
      { id: 'srv-2', name: 'Dégradé américain (Fade)', price: 4000, category: 'coupe', durationMinutes: 40 },
      { id: 'srv-3', name: 'Taille & traçage de barbe serviette chaude', price: 2500, category: 'barbe', durationMinutes: 25 },
      { id: 'srv-4', name: 'Formule VIP Gentleman (Coupe + Barbe + Soin)', price: 7000, category: 'combo', durationMinutes: 60 },
      { id: 'srv-5', name: 'Soin du visage purifiant au charbon', price: 5000, category: 'visage', durationMinutes: 35 },
      { id: 'srv-6', name: 'Coloration barbe / Bigen Black', price: 3500, category: 'coloration', durationMinutes: 30 }
    ];

    // Multipliers for realistic distribution in Abidjan
    const weightMap: Record<string, { volume: number; factor: number }> = {
      'Dégradé américain (Fade)': { volume: 142, factor: 1.15 },
      'Formule VIP Gentleman (Coupe + Barbe + Soin)': { volume: 98, factor: 1.4 },
      'Taille & traçage de barbe serviette chaude': { volume: 112, factor: 1.0 },
      'Coupe classique aux ciseaux': { volume: 85, factor: 0.9 },
      'Soin du visage purifiant au charbon': { volume: 46, factor: 1.2 },
      'Coloration barbe / Bigen Black': { volume: 38, factor: 1.05 }
    };

    const calculated = baseServices.map((srv, idx) => {
      const match = weightMap[srv.name] || { volume: Math.max(25, 120 - idx * 18), factor: 1.0 };
      const volume = match.volume;
      const totalGeneratedRevenue = volume * srv.price;
      return {
        id: srv.id,
        name: srv.name,
        category: srv.category,
        price: srv.price,
        durationMinutes: srv.durationMinutes,
        volume,
        totalGeneratedRevenue
      };
    });

    const grandTotalRevenue = calculated.reduce((acc, s) => acc + s.totalGeneratedRevenue, 0);
    const grandTotalVolume = calculated.reduce((acc, s) => acc + s.volume, 0);

    const enriched = calculated.map((s) => ({
      ...s,
      revenueShare: Math.round((s.totalGeneratedRevenue / grandTotalRevenue) * 100),
      volumeShare: Math.round((s.volume / grandTotalVolume) * 100)
    }));

    if (serviceMetricSort === 'revenue') {
      return enriched.sort((a, b) => b.totalGeneratedRevenue - a.totalGeneratedRevenue);
    } else {
      return enriched.sort((a, b) => b.volume - a.volume);
    }
  }, [salonServices, serviceMetricSort]);

  // Key Peak Hour
  const peakHourItem = useMemo(() => {
    return [...hourlyData].sort((a, b) => b.count - a.count)[0];
  }, [hourlyData]);

  // Star service
  const starService = useMemo(() => {
    return topServicesData[0];
  }, [topServicesData]);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 0. Top Alert Banner if any low stock */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 flex items-center justify-between text-amber-200 text-xs shadow-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Alerte Stock Critique :</span> {lowStockItems.length} produit(s) en dessous du seuil minimum ({lowStockItems.map((i) => i.name).join(', ')}).
            </div>
          </div>
          <span className="font-semibold text-xs text-amber-300 bg-amber-900/60 px-2.5 py-1 rounded-lg border border-amber-500/30">
            À réapprovisionner
          </span>
        </div>
      )}

      {/* 1. HERO KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Chiffre d'affaires encaissé */}
        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] relative overflow-hidden shadow-sm hover:border-[#C9A45C]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">CA Total Encaissé</span>
            <div className="w-8 h-8 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatPrice(totalRevenue)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold mt-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.8% vs mois précédent</span>
          </div>
        </div>

        {/* KPI 2: Rendez-vous aujourd'hui */}
        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] relative overflow-hidden shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">Rendez-vous du jour</span>
            <div className="w-8 h-8 rounded-xl bg-[#17201c] border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {todayAppointments.length} RDV
          </div>
          <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-2">
            <span className="text-emerald-400 font-semibold">{completedToday} terminés</span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">{inProgressToday} au fauteuil</span>
          </div>
        </div>

        {/* KPI 3: Panier Moyen */}
        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] relative overflow-hidden shadow-sm hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">Panier Moyen</span>
            <div className="w-8 h-8 rounded-xl bg-[#1f1b24] border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#E5C378]">
            {formatPrice(averageBasket)}
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            Combo Coupe & Soins très demandés
          </div>
        </div>

        {/* KPI 4: Marge Nette Estimée */}
        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] relative overflow-hidden shadow-sm hover:border-[#C9A45C]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-400">Bénéfice Net Estimé</span>
            <div className="w-8 h-8 rounded-xl bg-[#191e24] border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${estimatedMargin >= 0 ? 'text-[#E5C378]' : 'text-red-400'}`}>
            {formatPrice(estimatedMargin)}
          </div>
          <div className="text-[11px] text-stone-400 mt-2">
            Charges fixes & commissions déduites
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS COUNTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#18181b] border border-[#27272c] shadow-sm">
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <Clock className="w-4 h-4 text-[#C9A45C]" />
          <span>Raccourcis comptoir :</span>
        </div>

        <div className="flex items-center gap-2.5">
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
      <div className="bg-[#161619] border border-[#27272c] rounded-3xl p-6 shadow-xl space-y-6">
        {/* Chart Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242428] pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>Performance Financière</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Évolution du Chiffre d'Affaires Mensuel
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Visualisez la croissance des encaissements et la marge nette du salon {activeSalon.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Metric Selector */}
            <div className="flex bg-[#111113] p-1 rounded-xl border border-[#29292e]">
              <button
                type="button"
                onClick={() => setRevenueMetric('revenue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  revenueMetric === 'revenue'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Chiffre d'Affaires
              </button>
              <button
                type="button"
                onClick={() => setRevenueMetric('appointments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  revenueMetric === 'appointments'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Nombre de RDV
              </button>
              <button
                type="button"
                onClick={() => setRevenueMetric('margin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  revenueMetric === 'margin'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Bénéfice Net
              </button>
            </div>

            {/* Timeframe Selector */}
            <div className="flex bg-[#111113] p-1 rounded-xl border border-[#29292e]">
              <button
                type="button"
                onClick={() => setRevenuePeriod('6m')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  revenuePeriod === '6m' ? 'bg-[#25252b] text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                6 mois
              </button>
              <button
                type="button"
                onClick={() => setRevenuePeriod('12m')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  revenuePeriod === '12m' ? 'bg-[#25252b] text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                12 mois
              </button>
              <button
                type="button"
                onClick={() => setRevenuePeriod('month_weeks')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  revenuePeriod === 'month_weeks' ? 'bg-[#25252b] text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Mois (semaines)
              </button>
            </div>
          </div>
        </div>

        {/* Interactive SVG Chart Container */}
        <div className="relative pt-4 pb-2">
          {/* Active Hover Tooltip Callout */}
          {hoveredMonthIndex !== null && monthlyData[hoveredMonthIndex] && (
            <div className="absolute top-0 right-4 bg-[#1e1e24] border border-[#C9A45C]/60 rounded-xl p-3 shadow-2xl z-20 pointer-events-none animate-in fade-in zoom-in-95">
              <div className="text-[11px] font-bold text-stone-300">
                {monthlyData[hoveredMonthIndex].label}
              </div>
              <div className="text-base font-extrabold text-[#E5C378] mt-0.5">
                {revenueMetric === 'revenue'
                  ? formatPrice(monthlyData[hoveredMonthIndex].revenue)
                  : revenueMetric === 'appointments'
                  ? `${monthlyData[hoveredMonthIndex].appointments} réservations`
                  : formatPrice(monthlyData[hoveredMonthIndex].margin)}
              </div>
              <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-2">
                <span>RDV : <strong className="text-white">{monthlyData[hoveredMonthIndex].appointments}</strong></span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{monthlyData[hoveredMonthIndex].growth}</span>
              </div>
            </div>
          )}

          {/* SVG Graph Matrix */}
          <div className="h-64 sm:h-72 w-full flex items-end gap-2 sm:gap-4 px-2 pt-6">
            {monthlyData.map((item, idx) => {
              const currentVal =
                revenueMetric === 'revenue'
                  ? item.revenue
                  : revenueMetric === 'appointments'
                  ? item.appointments
                  : item.margin;

              const heightPercent = Math.max(8, Math.round((currentVal / maxRevenueVal) * 100));
              const isHovered = hoveredMonthIndex === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredMonthIndex(idx)}
                  onMouseLeave={() => setHoveredMonthIndex(null)}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                >
                  {/* Top value indicator on hover */}
                  <div
                    className={`text-[10px] font-bold mb-1 transition-all ${
                      isHovered ? 'text-[#C9A45C] scale-110 opacity-100' : 'text-stone-500 opacity-70 group-hover:opacity-100'
                    }`}
                  >
                    {revenueMetric === 'revenue'
                      ? `${Math.round(currentVal / 1000)}k`
                      : revenueMetric === 'appointments'
                      ? currentVal
                      : `${Math.round(currentVal / 1000)}k`}
                  </div>

                  {/* Bar Column */}
                  <div className="w-full max-w-[48px] bg-[#121215] rounded-xl overflow-hidden flex flex-col justify-end border border-[#242429] group-hover:border-[#C9A45C]/50 transition-all p-1">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        isHovered
                          ? 'bg-gradient-to-t from-[#C9A45C] to-[#E5C378] shadow-[0_0_20px_rgba(201,164,92,0.5)]'
                          : idx === monthlyData.length - 1
                          ? 'bg-gradient-to-t from-[#a88237] to-[#C9A45C]'
                          : 'bg-gradient-to-t from-[#26241e] to-[#594726] group-hover:from-[#C9A45C]/60 group-hover:to-[#C9A45C]'
                      }`}
                    />
                  </div>

                  {/* X Axis Label */}
                  <span
                    className={`text-[10px] sm:text-xs font-semibold mt-2.5 transition-colors ${
                      isHovered ? 'text-[#E5C378] font-bold' : 'text-stone-400'
                    }`}
                  >
                    {item.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Baseline Indicator */}
          <div className="w-full border-t border-[#222226] mt-2 pt-3 flex items-center justify-between text-[11px] text-stone-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C9A45C]" />
                {revenueMetric === 'revenue' ? 'Chiffre d\'Affaires Réalisé' : revenueMetric === 'appointments' ? 'Volumes de RDV' : 'Bénéfice Net'}
              </span>
              <span className="flex items-center gap-1.5 hidden sm:inline-flex">
                <span className="w-2.5 h-2.5 rounded-full bg-[#353023]" />
                Moyenne période : {formatPrice(Math.round(monthlyData.reduce((a, b) => a + b.revenue, 0) / monthlyData.length))}
              </span>
            </div>
            <span className="text-[#C9A45C] font-semibold">Taux de croissance global : +18.2%</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. TWO COLUMNS: BUSY HOURS & TOP-SELLING SERVICES           */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================== */}
        {/* LEFT (7 cols): BUSY HOURS / HEURES DE POINTE */}
        {/* ========================================== */}
        <div className="lg:col-span-7 bg-[#161619] border border-[#27272c] rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242428] pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Affluence & Heures de Pointe</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Fréquentation par Créneau Horaire
              </h3>
            </div>

            {/* Day of week filter */}
            <select
              value={busyHoursDayFilter}
              onChange={(e) => setBusyHoursDayFilter(e.target.value as any)}
              className="bg-[#111113] border border-[#2a2a2f] rounded-xl px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
            >
              <option value="all">Toute la semaine (Moyenne)</option>
              <option value="saturday">Samedi (Grande Affluence)</option>
              <option value="friday">Vendredi (After-work)</option>
              <option value="weekday">Semaine (Lun - Jeu)</option>
            </select>
          </div>

          {/* Busy hour recommendation callout */}
          <div className="p-3.5 rounded-2xl bg-[#1d1912] border border-[#C9A45C]/30 flex items-start gap-3 text-xs">
            <Clock className="w-4 h-4 text-[#C9A45C] shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-white">Créneau le plus chargé : </span>
              <span className="text-[#E5C378] font-bold">{peakHourItem.hour} - {peakHourItem.hour.split(':')[0]}:55</span>
              <p className="text-stone-400 text-[11px] mt-0.5">
                Pic d'occupation à <strong className="text-white">{peakHourItem.occupancyRate}%</strong>. Il est conseillé d'avoir l'équipe au complet au salon.
              </p>
            </div>
          </div>

          {/* Hourly Visual Distribution Grid */}
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-12 gap-1.5 text-center text-[10px] text-stone-500 font-bold mb-1">
              {hourlyData.filter((_, i) => i % 2 === 0).map((h) => (
                <div key={h.hour} className="col-span-1">{h.hour}</div>
              ))}
            </div>

            <div className="h-44 flex items-end gap-1 sm:gap-1.5 p-2 rounded-2xl bg-[#121214] border border-[#242429]">
              {hourlyData.map((h, i) => {
                const heightPercent = Math.max(12, Math.round((h.count / maxHourlyCount) * 100));
                const isHovered = hoveredHour === h.hour;

                return (
                  <div
                    key={h.hour}
                    onMouseEnter={() => setHoveredHour(h.hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-14 bg-[#1e1e24] border border-[#C9A45C] rounded-lg p-1.5 shadow-xl text-[10px] whitespace-nowrap z-30 pointer-events-none">
                        <div className="font-bold text-white">{h.hour}</div>
                        <div className="text-[#E5C378] font-extrabold">{h.count} clients • {h.occupancyRate}%</div>
                      </div>
                    )}

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        h.intensity === 'peak'
                          ? isHovered
                            ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                            : 'bg-amber-500'
                          : h.intensity === 'moderate'
                          ? isHovered
                            ? 'bg-[#C9A45C]'
                            : 'bg-[#8f743c]'
                          : isHovered
                          ? 'bg-emerald-400'
                          : 'bg-[#293b33]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-400 pt-2 px-1">
              <div className="flex items-center gap-3">
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
              <span className="text-stone-500 hidden sm:inline">Créneaux de 30 minutes</span>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT (5 cols): TOP-SELLING SERVICES       */}
        {/* ========================================== */}
        <div className="lg:col-span-5 bg-[#161619] border border-[#27272c] rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#242428] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                  <Star className="w-4 h-4 text-[#C9A45C]" />
                  <span>Palmarès des Prestations</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Prestations les Plus Demandées
                </h3>
              </div>

              {/* Sort Switcher */}
              <div className="flex bg-[#111113] p-1 rounded-xl border border-[#27272c]">
                <button
                  type="button"
                  onClick={() => setServiceMetricSort('revenue')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    serviceMetricSort === 'revenue'
                      ? 'bg-[#C9A45C] text-[#101010]'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Par CA
                </button>
                <button
                  type="button"
                  onClick={() => setServiceMetricSort('volume')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    serviceMetricSort === 'volume'
                      ? 'bg-[#C9A45C] text-[#101010]'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Par Volume
                </button>
              </div>
            </div>

            {/* Service ranking list */}
            <div className="space-y-3.5 pt-4">
              {topServicesData.slice(0, 5).map((srv, idx) => {
                const isSelected = selectedServiceId === srv.id;
                const percentage = serviceMetricSort === 'revenue' ? srv.revenueShare : srv.volumeShare;

                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(isSelected ? null : srv.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1e1c15] border-[#C9A45C] shadow-md'
                        : 'bg-[#121214] border-[#242428] hover:border-stone-500'
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
                          <span className="text-xs font-bold text-white truncate block">
                            {srv.name}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {srv.durationMinutes} min • {formatPrice(srv.price)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-[#E5C378]">
                          {serviceMetricSort === 'revenue'
                            ? formatPrice(srv.totalGeneratedRevenue)
                            : `${srv.volume} réservations`}
                        </div>
                        <div className="text-[10px] font-semibold text-stone-400">
                          {percentage}% du total
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#1e1e24] overflow-hidden mt-2">
                      <div
                        style={{ width: `${percentage}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-[#C9A45C]'
                            : idx === 1
                            ? 'bg-amber-400'
                            : 'bg-stone-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Service Insight Footer */}
          <div className="p-3 rounded-2xl bg-[#131316] border border-[#222226] text-[11px] text-stone-400 flex items-center justify-between mt-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>Prestation n°1 : <strong className="text-white">{starService?.name}</strong></span>
            </span>
            <span className="text-[#E5C378] font-bold">Top Rentabilité</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. TODAY'S REAL-TIME SCHEDULE & PAYMENT CHANNELS             */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT (8 cols): Today's Schedule & Status updater */}
        <div className="lg:col-span-8 bg-[#161619] border border-[#27272c] rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#242428] pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C9A45C]" />
              <h3 className="font-bold text-white text-sm">
                Planning du jour — {todayStr} ({todayAppointments.length} réservations)
              </h3>
            </div>
            <span className="text-xs text-stone-400">Mise à jour en temps réel</span>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-xs">
              Aucun rendez-vous planifié pour aujourd'hui.
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-3.5 rounded-2xl bg-[#121214] border border-[#242428] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-stone-500 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{apt.time}</span>
                      <span className="text-xs text-stone-500">•</span>
                      <span className="text-xs font-bold text-[#E5C378]">{apt.clientName}</span>
                      <span className="text-[10px] bg-[#222226] text-stone-400 px-2 py-0.5 rounded font-mono">
                        {apt.clientPhone}
                      </span>
                    </div>
                    <div className="text-xs text-stone-300">
                      {apt.serviceName} ({apt.durationMinutes} min) • Barbier : <span className="font-semibold text-white">{apt.staffName}</span>
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white mr-1 font-mono">
                      {formatPrice(apt.price)}
                    </span>

                    <select
                      value={apt.status}
                      onChange={(e) => updateAppointmentStatus(apt.id, e.target.value as AppointmentStatus)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border font-semibold focus:outline-none cursor-pointer ${
                        apt.status === 'completed'
                          ? 'bg-stone-800 text-stone-300 border-stone-700'
                          : apt.status === 'in_progress'
                          ? 'bg-amber-950 text-amber-400 border-amber-800/40'
                          : apt.status === 'confirmed'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40'
                          : 'bg-blue-950 text-blue-400 border-blue-800/40'
                      }`}
                    >
                      <option value="pending" className="bg-[#18181b] text-white">En attente</option>
                      <option value="confirmed" className="bg-[#18181b] text-white">Confirmé</option>
                      <option value="checked_in" className="bg-[#18181b] text-white">Client arrivé</option>
                      <option value="in_progress" className="bg-[#18181b] text-white">En cours</option>
                      <option value="completed" className="bg-[#18181b] text-white">Terminé</option>
                      <option value="cancelled" className="bg-[#18181b] text-white">Annulé</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT (4 cols): Payment Channels & Staff Activity */}
        <div className="lg:col-span-4 space-y-6">
          {/* Payment breakdown */}
          <div className="bg-[#161619] border border-[#27272c] rounded-3xl p-6 space-y-4 shadow-xl">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-stone-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#C9A45C]" />
              Répartition des Encaissements
            </h4>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    Mobile Money (Wave / OM)
                  </span>
                  <span className="font-bold text-white">{formatPrice(mobileMoneyTotal)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#111113] overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-500"
                    style={{
                      width: totalRevenue > 0 ? `${(mobileMoneyTotal / totalRevenue) * 100}%` : '0%'
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
                      width: totalRevenue > 0 ? `${(cashTotal / totalRevenue) * 100}%` : '0%'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Staff Leaderboard */}
          <div className="bg-[#161619] border border-[#27272c] rounded-3xl p-6 space-y-3 shadow-xl">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-stone-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C9A45C]" />
              Activité de l'équipe
            </h4>

            <div className="space-y-2.5">
              {salonStaff.map((st) => {
                const staffAppointments = salonAppointments.filter((a) => a.staffId === st.id);
                return (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#111113] border border-[#242428]"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={st.avatar}
                        alt={st.name}
                        className="w-8 h-8 rounded-full object-cover border border-[#C9A45C]/30"
                      />
                      <div>
                        <div className="text-xs font-bold text-white">{st.name}</div>
                        <div className="text-[10px] text-stone-400">
                          {staffAppointments.length} coupes réalisées
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-[#E5C378]">
                      {st.commissionRate}% comm.
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
