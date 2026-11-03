import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Appointment, AppointmentStatus, StaffMember } from '../../types';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Scissors,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  CreditCard,
  X,
  UserCheck,
  Sparkles,
  Info
} from 'lucide-react';

interface AppointmentsCalendarViewProps {
  onOpenNewAppointment: (prefill?: { date?: string; time?: string; staffId?: string }) => void;
  onOpenNewPaymentForAppointment: (apt: Appointment) => void;
}

export const AppointmentsCalendarView: React.FC<AppointmentsCalendarViewProps> = ({
  onOpenNewAppointment,
  onOpenNewPaymentForAppointment
}) => {
  const {
    activeSalon,
    appointments,
    staff,
    formatPrice,
    updateAppointmentStatus,
    updateAppointmentDetails,
    cancelAppointment
  } = useApp();

  const [viewType, setViewType] = useState<'day' | 'week' | 'list'>('week');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected appointment for detailed inspection modal
  const [inspectedAppointment, setInspectedAppointment] = useState<Appointment | null>(null);

  const salonStaff = staff.filter((s) => s.salonId === activeSalon.id);

  // Status visual configs
  const statusLabels: Record<AppointmentStatus, { label: string; badge: string; border: string; bgCard: string }> = {
    pending: {
      label: 'En attente',
      badge: 'bg-blue-950/80 text-blue-400 border-blue-800/50',
      border: 'border-l-blue-500',
      bgCard: 'bg-[#151a24] hover:bg-[#1a2130]'
    },
    confirmed: {
      label: 'Confirmé',
      badge: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50',
      border: 'border-l-emerald-500',
      bgCard: 'bg-[#14201a] hover:bg-[#1a2b23]'
    },
    checked_in: {
      label: 'En attente au salon',
      badge: 'bg-purple-950/80 text-purple-300 border-purple-800/50',
      border: 'border-l-purple-500',
      bgCard: 'bg-[#1e1526] hover:bg-[#281c33]'
    },
    in_progress: {
      label: 'Au fauteuil (En cours)',
      badge: 'bg-amber-950/90 text-[#E5C378] border-[#C9A45C]/50',
      border: 'border-l-[#C9A45C]',
      bgCard: 'bg-[#221c13] hover:bg-[#2b2418]'
    },
    completed: {
      label: 'Terminé',
      badge: 'bg-stone-800 text-stone-300 border-stone-700',
      border: 'border-l-stone-600',
      bgCard: 'bg-[#19191d] hover:bg-[#202025]'
    },
    cancelled: {
      label: 'Annulé',
      badge: 'bg-red-950/80 text-red-400 border-red-800/50',
      border: 'border-l-red-500 opacity-60',
      bgCard: 'bg-[#221516] hover:bg-[#2b1b1c]'
    },
    no_show: {
      label: 'Absent (No-show)',
      badge: 'bg-stone-900 text-stone-500 border-stone-800',
      border: 'border-l-stone-700 opacity-50',
      bgCard: 'bg-[#141417]'
    }
  };

  // Compute 7 days of the currently selected week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const ref = new Date(selectedDate);
    const day = ref.getDay();
    const diff = ref.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(ref.setDate(diff));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const dayFull = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const monthNames = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
      const todayIso = new Date().toISOString().slice(0, 10);

      return {
        iso,
        shortName: dayNames[d.getDay()],
        fullName: dayFull[d.getDay()],
        dayNum: d.getDate(),
        month: monthNames[d.getMonth()],
        isToday: iso === todayIso,
        isSelected: iso === selectedDate
      };
    });
  }, [selectedDate]);

  // Hourly slots from 08:30 to 20:00
  const calendarHours = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00',
    '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

  // Navigation handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handlePrevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  // Filtered Appointments
  const salonAppointments = useMemo(() => {
    return appointments.filter((apt) => apt.salonId === activeSalon.id);
  }, [appointments, activeSalon.id]);

  const filteredAppointments = useMemo(() => {
    return salonAppointments.filter((apt) => {
      if (filterStaffId !== 'all' && apt.staffId !== filterStaffId) return false;
      if (filterStatus !== 'all' && apt.status !== filterStatus) return false;

      if (viewType === 'day' && apt.date !== selectedDate) return false;
      if (viewType === 'week') {
        const weekDatesIso = weekDays.map((w) => w.iso);
        if (!weekDatesIso.includes(apt.date)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          apt.clientName.toLowerCase().includes(q) ||
          apt.serviceName.toLowerCase().includes(q) ||
          apt.clientPhone.includes(q) ||
          apt.staffName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [salonAppointments, filterStaffId, filterStatus, viewType, selectedDate, weekDays, searchQuery]);

  // Daily / Weekly KPI calculations
  const kpiStats = useMemo(() => {
    const relevantApts = viewType === 'day'
      ? salonAppointments.filter((a) => a.date === selectedDate)
      : salonAppointments.filter((a) => weekDays.some((w) => w.iso === a.date));

    const totalCount = relevantApts.filter((a) => a.status !== 'cancelled').length;
    const inProgressCount = relevantApts.filter((a) => a.status === 'in_progress').length;
    const checkedInCount = relevantApts.filter((a) => a.status === 'checked_in').length;
    const estimatedRevenue = relevantApts
      .filter((a) => a.status !== 'cancelled')
      .reduce((acc, curr) => acc + curr.price, 0);

    return { totalCount, inProgressCount, checkedInCount, estimatedRevenue };
  }, [salonAppointments, viewType, selectedDate, weekDays]);

  // Sync inspected appointment state if changed
  const currentInspected = useMemo(() => {
    if (!inspectedAppointment) return null;
    return appointments.find((a) => a.id === inspectedAppointment.id) || null;
  }, [appointments, inspectedAppointment]);

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">
              {viewType === 'day' ? 'RDV Aujourd\'hui' : 'RDV de la semaine'}
            </div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {kpiStats.totalCount} <span className="text-xs font-normal text-stone-500">créneaux</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#201d16] border border-[#C9A45C]/30 flex items-center justify-center text-[#C9A45C]">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">Au Fauteuil (En cours)</div>
            <div className="text-xl font-extrabold text-[#E5C378] mt-0.5 flex items-center gap-1.5">
              <span>{kpiStats.inProgressCount}</span>
              {kpiStats.inProgressCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-600/30 flex items-center justify-center text-amber-400">
            <Scissors className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">En Salle d'Attente</div>
            <div className="text-xl font-extrabold text-purple-400 mt-0.5">
              {kpiStats.checkedInCount} <span className="text-xs font-normal text-stone-500">clients</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-600/30 flex items-center justify-center text-purple-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-semibold text-stone-400">Chiffre d'Affaires Prévu</div>
            <div className="text-lg sm:text-xl font-extrabold text-[#C9A45C] mt-0.5">
              {formatPrice(kpiStats.estimatedRevenue)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-600/30 flex items-center justify-center text-emerald-400">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. BARBER QUICK SELECTOR BAR ("Planning par Barbier") */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-3 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider pl-2 pr-1 shrink-0 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-[#C9A45C]" />
          Planning :
        </span>

        <button
          onClick={() => setFilterStaffId('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
            filterStaffId === 'all'
              ? 'bg-[#C9A45C] text-[#101010] shadow-md'
              : 'bg-[#111113] text-stone-300 hover:text-white border border-[#27272c]'
          }`}
        >
          <span>Tous les barbiers</span>
          <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-full font-semibold">
            {salonAppointments.filter((a) => a.date === selectedDate && a.status !== 'cancelled').length}
          </span>
        </button>

        {salonStaff.map((barber) => {
          const barberCountToday = salonAppointments.filter(
            (a) => a.staffId === barber.id && a.date === selectedDate && a.status !== 'cancelled'
          ).length;
          const isSelected = filterStaffId === barber.id;

          return (
            <button
              key={barber.id}
              onClick={() => setFilterStaffId(barber.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-[#C9A45C] text-[#101010] shadow-md font-bold'
                  : 'bg-[#111113] text-stone-300 hover:text-white border border-[#27272c]'
              }`}
            >
              <img
                src={barber.avatar}
                alt={barber.name}
                className="w-5 h-5 rounded-full object-cover border border-black/40"
              />
              <span>{barber.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-[#1e1e24] text-stone-400'
                }`}
              >
                {barberCountToday}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. CONTROLS BAR: Views + Week/Day Navigators + Search */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: View Tabs & Navigator */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View switcher pills */}
          <div className="flex bg-[#111113] p-1 rounded-xl border border-[#28282d]">
            <button
              onClick={() => setViewType('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewType === 'day' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              Vue Jour
            </button>
            <button
              onClick={() => setViewType('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewType === 'week' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              Vue Semaine (7j)
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewType === 'list' ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm' : 'text-stone-400 hover:text-white'
              }`}
            >
              Liste globale
            </button>
          </div>

          {/* Date arrows & Today button */}
          <div className="flex items-center gap-1.5 bg-[#111113] p-1 rounded-xl border border-[#28282d]">
            <button
              onClick={viewType === 'week' ? handlePrevWeek : handlePrevDay}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#1e1e23] transition-colors"
              title={viewType === 'week' ? 'Semaine précédente' : 'Jour précédent'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleSetToday}
              className="px-2.5 py-1 text-[11px] font-bold text-[#E5C378] hover:bg-[#1e1e23] rounded-lg transition-colors"
            >
              Aujourd'hui
            </button>

            <button
              onClick={viewType === 'week' ? handleNextWeek : handleNextDay}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#1e1e23] transition-colors"
              title={viewType === 'week' ? 'Semaine suivante' : 'Jour suivant'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current Date Label */}
          <div className="flex items-center gap-2 bg-[#111113] px-3 py-1.5 rounded-xl border border-[#28282d]">
            <CalendarIcon className="w-4 h-4 text-[#C9A45C]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            />
            {viewType === 'week' && (
              <span className="text-[11px] text-stone-400 pl-1 border-l border-[#2e2e34]">
                Sem. du {weekDays[0].dayNum} {weekDays[0].month} au {weekDays[6].dayNum} {weekDays[6].month}
              </span>
            )}
          </div>
        </div>

        {/* Right: Search, Status Filter & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher client, tel..."
              className="bg-[#111113] border border-[#28282d] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C] w-44"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#111113] border border-[#28282d] rounded-xl px-2.5 py-1.5 text-xs text-stone-300 focus:outline-none focus:border-[#C9A45C]"
          >
            <option value="all">Tous statuts</option>
            <option value="confirmed">Confirmé</option>
            <option value="checked_in">Au salon</option>
            <option value="in_progress">Au fauteuil</option>
            <option value="completed">Terminé</option>
            <option value="pending">En attente</option>
            <option value="cancelled">Annulé</option>
          </select>

          <button
            onClick={() => onOpenNewAppointment({ date: selectedDate, time: '14:00', staffId: filterStaffId !== 'all' ? filterStaffId : undefined })}
            className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau RDV</span>
          </button>
        </div>
      </div>

      {/* 4. VUE SEMAINE INTERACTIVE (7 Jours, Matrice horaire) */}
      {viewType === 'week' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <div className="min-w-[950px]">
              {/* Header: 7 Columns for Days of the Week */}
              <div className="grid grid-cols-8 border-b border-[#28282e] bg-[#121214]">
                <div className="p-3 text-center text-xs font-bold text-stone-500 border-r border-[#222226] flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 mr-1 text-[#C9A45C]" />
                  Heure
                </div>

                {weekDays.map((day) => {
                  const dayAptsCount = salonAppointments.filter(
                    (a) => a.date === day.iso && a.status !== 'cancelled'
                  ).length;

                  return (
                    <div
                      key={day.iso}
                      onClick={() => {
                        setSelectedDate(day.iso);
                        // Optional click to zoom in day
                      }}
                      className={`p-3 text-center border-r border-[#222226] transition-colors cursor-pointer ${
                        day.isToday
                          ? 'bg-[#1d1b14] border-t-2 border-t-[#C9A45C]'
                          : day.isSelected
                          ? 'bg-[#18181c]'
                          : 'hover:bg-[#17171a]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-xs font-bold uppercase ${day.isToday ? 'text-[#C9A45C]' : 'text-stone-300'}`}>
                          {day.shortName}
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] bg-[#C9A45C] text-[#101010] font-extrabold px-1.5 py-0.2 rounded">
                            Auj.
                          </span>
                        )}
                      </div>
                      <div className="text-base font-extrabold text-white mt-0.5">
                        {day.dayNum} <span className="text-xs font-normal text-stone-400">{day.month}</span>
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5 font-medium">
                        {dayAptsCount > 0 ? (
                          <span className="text-[#E5C378] font-semibold">{dayAptsCount} RDV</span>
                        ) : (
                          <span className="text-stone-600">Libre</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Matrix Rows: Hours 08:30 to 20:00 */}
              <div className="divide-y divide-[#202025]">
                {calendarHours.map((hour) => {
                  return (
                    <div key={hour} className="grid grid-cols-8 min-h-[72px]">
                      {/* Left Hour Column */}
                      <div className="p-2.5 text-center text-xs font-mono font-bold text-stone-400 border-r border-[#222226] bg-[#131315] flex items-center justify-center">
                        {hour}
                      </div>

                      {/* 7 Day Cells */}
                      {weekDays.map((day) => {
                        // Appointments matching this day & hour & filter
                        const cellApts = filteredAppointments.filter(
                          (a) => a.date === day.iso && a.time === hour
                        );

                        return (
                          <div
                            key={day.iso + hour}
                            className={`p-1.5 border-r border-[#222226] relative transition-all group flex flex-col gap-1.5 ${
                              day.isToday ? 'bg-[#181714]/40' : 'hover:bg-[#18181c]/60'
                            }`}
                          >
                            {cellApts.map((apt) => {
                              const cfg = statusLabels[apt.status] || {
                                label: apt.status,
                                badge: 'bg-stone-800 text-stone-300',
                                border: 'border-l-[#C9A45C]',
                                bgCard: 'bg-[#18181b]'
                              };

                              return (
                                <div
                                  key={apt.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectedAppointment(apt);
                                  }}
                                  className={`p-2 rounded-xl border border-[#2d2d34] border-l-4 ${cfg.border} ${cfg.bgCard} shadow-md transition-all hover:scale-[1.02] cursor-pointer`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-extrabold text-white truncate">
                                      {apt.clientName}
                                    </span>
                                    {apt.status === 'in_progress' ? (
                                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                                    ) : (
                                      <span className={`text-[8px] font-bold px-1 rounded ${cfg.badge}`}>
                                        {cfg.label.slice(0, 8)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[10px] text-[#E5C378] font-medium truncate">
                                    {apt.serviceName}
                                  </div>

                                  <div className="flex items-center justify-between text-[9px] text-stone-400 mt-1 pt-1 border-t border-white/5">
                                    <div className="flex items-center gap-1 truncate">
                                      <span className="w-3.5 h-3.5 rounded-full bg-[#2a2a30] text-[8px] text-[#C9A45C] flex items-center justify-center font-bold">
                                        {apt.staffName.slice(0, 1)}
                                      </span>
                                      <span className="truncate">{apt.staffName.split(' ')[0]}</span>
                                    </div>
                                    <span className="font-semibold text-white">
                                      {formatPrice(apt.price)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Slot Click action: + Réserver */}
                            {cellApts.length === 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenNewAppointment({
                                    date: day.iso,
                                    time: hour,
                                    staffId: filterStaffId !== 'all' ? filterStaffId : undefined
                                  })
                                }
                                className="w-full h-full min-h-[48px] rounded-lg border border-dashed border-transparent hover:border-[#C9A45C]/40 hover:bg-[#C9A45C]/5 flex items-center justify-center text-[10px] text-stone-500 hover:text-[#E5C378] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              >
                                + Réserver
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. VUE JOUR INTERACTIVE: Grid par Barbier avec colonne horaire */}
      {viewType === 'day' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-5 overflow-x-auto shadow-xl">
          <div className="min-w-[750px]">
            {/* Header: Staff columns */}
            <div className="grid grid-cols-12 gap-3 pb-4 border-b border-[#28282e] text-xs font-bold text-stone-400">
              <div className="col-span-2 text-stone-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>Horaires</span>
              </div>

              {(filterStaffId === 'all' ? salonStaff : salonStaff.filter((s) => s.id === filterStaffId)).map(
                (st) => {
                  const staffDayApts = salonAppointments.filter(
                    (a) => a.date === selectedDate && a.staffId === st.id && a.status !== 'cancelled'
                  );
                  return (
                    <div
                      key={st.id}
                      className={`${
                        filterStaffId === 'all' ? 'col-span-3' : 'col-span-10'
                      } flex items-center justify-between p-2 rounded-xl bg-[#121214] border border-[#27272c]`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <img
                          src={st.avatar}
                          alt={st.name}
                          className="w-7 h-7 rounded-full object-cover border border-[#C9A45C]/40"
                        />
                        <div className="truncate">
                          <span className="text-white font-bold block truncate">{st.name}</span>
                          <span className="text-[10px] text-stone-400 font-normal">{st.role}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#C9A45C] bg-[#1e1a12] px-2 py-0.5 rounded-lg border border-[#C9A45C]/30 shrink-0">
                        {staffDayApts.length} RDV
                      </span>
                    </div>
                  );
                }
              )}
            </div>

            {/* Time Slot Rows */}
            <div className="divide-y divide-[#202025]">
              {calendarHours.map((slot) => {
                const targetStaffList =
                  filterStaffId === 'all'
                    ? salonStaff
                    : salonStaff.filter((s) => s.id === filterStaffId);

                return (
                  <div key={slot} className="grid grid-cols-12 gap-3 py-3 items-stretch">
                    <div className="col-span-2 text-xs font-mono text-stone-400 font-bold flex items-center">
                      {slot}
                    </div>

                    {targetStaffList.map((st) => {
                      const matchingApt = filteredAppointments.find(
                        (a) => a.time === slot && (a.staffId === st.id || a.staffId === 'any')
                      );

                      if (matchingApt) {
                        const cfg = statusLabels[matchingApt.status] || {
                          label: matchingApt.status,
                          badge: 'bg-stone-800',
                          border: 'border-l-[#C9A45C]',
                          bgCard: 'bg-[#18181b]'
                        };

                        return (
                          <div
                            key={st.id}
                            onClick={() => setInspectedAppointment(matchingApt)}
                            className={`${
                              filterStaffId === 'all' ? 'col-span-3' : 'col-span-10'
                            } p-3 rounded-2xl border border-[#2d2d34] border-l-4 ${cfg.border} ${cfg.bgCard} flex flex-col justify-between shadow-md cursor-pointer transition-all hover:scale-[1.01]`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-extrabold text-white truncate">
                                {matchingApt.clientName}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                            </div>

                            <span className="text-[11px] text-[#E5C378] font-medium truncate">
                              {matchingApt.serviceName} ({matchingApt.durationMinutes} min)
                            </span>

                            <div className="flex items-center justify-between text-[11px] text-stone-400 mt-2 pt-2 border-t border-white/5">
                              <span className="font-extrabold text-white">
                                {formatPrice(matchingApt.price)}
                              </span>

                              {matchingApt.paymentStatus !== 'paid' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenNewPaymentForAppointment(matchingApt);
                                  }}
                                  className="text-[10px] text-[#101010] bg-[#C9A45C] hover:bg-[#d8b56d] font-bold px-2.5 py-0.5 rounded-lg transition-colors"
                                >
                                  Encaisser
                                </button>
                              ) : (
                                <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Payé
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={st.id}
                          onClick={() =>
                            onOpenNewAppointment({
                              date: selectedDate,
                              time: slot,
                              staffId: st.id
                            })
                          }
                          className={`${
                            filterStaffId === 'all' ? 'col-span-3' : 'col-span-10'
                          } h-14 rounded-2xl border border-dashed border-[#242429] hover:border-[#C9A45C]/50 hover:bg-[#C9A45C]/5 flex items-center justify-center text-xs text-stone-500 hover:text-[#E5C378] transition-all cursor-pointer group`}
                        >
                          <span className="opacity-0 group-hover:opacity-100 font-semibold flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Réserver ce créneau
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. VUE LISTE: Tableau filtrable et exhaustif */}
      {viewType === 'list' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-4">Date & Heure</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Prestation</th>
                  <th className="p-4">Barbier</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4">Paiement</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-stone-500">
                      Aucun rendez-vous trouvé pour ces critères de filtre.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt) => {
                    const cfg = statusLabels[apt.status] || {
                      label: apt.status,
                      badge: 'bg-stone-800'
                    };
                    return (
                      <tr
                        key={apt.id}
                        onClick={() => setInspectedAppointment(apt)}
                        className="hover:bg-[#1a1a1e] transition-colors cursor-pointer"
                      >
                        <td className="p-4 font-mono">
                          <div className="font-bold text-white">{apt.time}</div>
                          <div className="text-[11px] text-stone-400">{apt.date}</div>
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-white">{apt.clientName}</div>
                          <div className="text-[11px] text-stone-400">{apt.clientPhone}</div>
                        </td>

                        <td className="p-4">
                          <div className="font-semibold text-[#E5C378]">{apt.serviceName}</div>
                          <div className="text-[11px] text-stone-400">
                            {apt.durationMinutes} min • {formatPrice(apt.price)}
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="font-medium text-white">{apt.staffName}</span>
                        </td>

                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={apt.status}
                            onChange={(e) =>
                              updateAppointmentStatus(apt.id, e.target.value as AppointmentStatus)
                            }
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold focus:outline-none cursor-pointer ${cfg.badge}`}
                          >
                            <option value="pending" className="bg-[#18181b] text-white">En attente</option>
                            <option value="confirmed" className="bg-[#18181b] text-white">Confirmé</option>
                            <option value="checked_in" className="bg-[#18181b] text-white">Arrivé au salon</option>
                            <option value="in_progress" className="bg-[#18181b] text-white">Au fauteuil (En cours)</option>
                            <option value="completed" className="bg-[#18181b] text-white">Terminé</option>
                            <option value="cancelled" className="bg-[#18181b] text-white">Annulé</option>
                          </select>
                        </td>

                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          {apt.paymentStatus === 'paid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Payé ({apt.paymentMethod?.toUpperCase() || 'OK'})
                            </span>
                          ) : (
                            <button
                              onClick={() => onOpenNewPaymentForAppointment(apt)}
                              className="text-[11px] font-bold text-[#101010] bg-[#C9A45C] hover:bg-[#d8b56d] px-2.5 py-1 rounded transition-colors"
                            >
                              Encaisser
                            </button>
                          )}
                        </td>

                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setInspectedAppointment(apt)}
                            className="text-xs text-[#C9A45C] hover:underline font-semibold"
                          >
                            Détails →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. FICHE RENDEZ-VOUS / MODAL D'INSPECTION INTERACTIVE */}
      {currentInspected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#161619] border border-[#2e2e34] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Close Button */}
            <button
              onClick={() => setInspectedAppointment(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C9A45C] mb-1">
                <Scissors className="w-4 h-4" />
                <span>Fiche Rendez-vous • {activeSalon.name}</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white">
                {currentInspected.clientName}
              </h2>
              <div className="text-xs text-stone-400 flex items-center gap-2 mt-1">
                <CalendarIcon className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>{currentInspected.date} à <strong className="text-white">{currentInspected.time}</strong> ({currentInspected.durationMinutes} min)</span>
              </div>
            </div>

            {/* Quick Action Contact Buttons */}
            <div className="flex gap-3">
              <a
                href={`https://wa.me/${currentInspected.clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Bonjour ${currentInspected.clientName}, nous vous attendons chez ${activeSalon.name} le ${currentInspected.date} à ${currentInspected.time} pour votre ${currentInspected.serviceName}. À tout de suite !`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Rappel</span>
              </a>

              <a
                href={`tel:${currentInspected.clientPhone}`}
                className="py-2.5 px-4 rounded-xl bg-[#222227] hover:bg-[#2b2b32] border border-[#33333b] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>Appeler</span>
              </a>
            </div>

            {/* Appointment Details Grid */}
            <div className="p-4 rounded-2xl bg-[#121214] border border-[#242429] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">Prestation demandée :</span>
                <span className="font-extrabold text-[#E5C378] text-sm">{currentInspected.serviceName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-400">Montant :</span>
                <span className="font-bold text-white">{formatPrice(currentInspected.price)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-400">Règlement :</span>
                {currentInspected.paymentStatus === 'paid' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Réglé ({currentInspected.paymentMethod?.toUpperCase()})
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold">À payer au salon</span>
                )}
              </div>

              {/* Reassign Barber */}
              <div className="pt-2 border-t border-[#222226] flex items-center justify-between">
                <span className="text-stone-400 font-medium">Barbier en charge :</span>
                <select
                  value={currentInspected.staffId}
                  onChange={(e) => {
                    const nextStaffId = e.target.value;
                    const found = salonStaff.find((s) => s.id === nextStaffId);
                    updateAppointmentDetails(currentInspected.id, {
                      staffId: nextStaffId,
                      staffName: found?.name || 'Sans préférence'
                    });
                  }}
                  className="bg-[#18181c] border border-[#2e2e34] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                >
                  {salonStaff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {currentInspected.notes && (
                <div className="pt-2 border-t border-[#222226] text-[11px] text-stone-400">
                  <span className="font-bold text-stone-300">Notes : </span>
                  {currentInspected.notes}
                </div>
              )}
            </div>

            {/* Status Quick Flow */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                Faire progresser le statut du client :
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => updateAppointmentStatus(currentInspected.id, 'confirmed')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    currentInspected.status === 'confirmed'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-[#18181c] border-[#29292e] text-stone-400 hover:text-white'
                  }`}
                >
                  Confirmé
                </button>

                <button
                  type="button"
                  onClick={() => updateAppointmentStatus(currentInspected.id, 'checked_in')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    currentInspected.status === 'checked_in'
                      ? 'bg-purple-950 border-purple-500 text-purple-300'
                      : 'bg-[#18181c] border-[#29292e] text-stone-400 hover:text-white'
                  }`}
                >
                  Arrivé au salon
                </button>

                <button
                  type="button"
                  onClick={() => updateAppointmentStatus(currentInspected.id, 'in_progress')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    currentInspected.status === 'in_progress'
                      ? 'bg-amber-950 border-[#C9A45C] text-[#E5C378]'
                      : 'bg-[#18181c] border-[#29292e] text-stone-400 hover:text-white'
                  }`}
                >
                  Au fauteuil
                </button>

                <button
                  type="button"
                  onClick={() => updateAppointmentStatus(currentInspected.id, 'completed')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    currentInspected.status === 'completed'
                      ? 'bg-stone-800 border-stone-500 text-white'
                      : 'bg-[#18181c] border-[#29292e] text-stone-400 hover:text-white'
                  }`}
                >
                  Terminé
                </button>
              </div>
            </div>

            {/* Bottom Actions: Cash In or Cancel */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {currentInspected.paymentStatus !== 'paid' ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewPaymentForAppointment(currentInspected);
                    setInspectedAppointment(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Encaisser {formatPrice(currentInspected.price)}</span>
                </button>
              ) : (
                <div className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Prestation entièrement payée</span>
                </div>
              )}

              {currentInspected.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Voulez-vous vraiment annuler ce rendez-vous ?')) {
                      cancelAppointment(currentInspected.id);
                      setInspectedAppointment(null);
                    }
                  }}
                  className="py-3 px-4 rounded-xl bg-[#201818] hover:bg-red-950 border border-red-900/40 text-red-400 hover:text-red-300 font-semibold text-xs transition-colors"
                >
                  Annuler le RDV
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
