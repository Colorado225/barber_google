import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Appointment } from '../../types';
import { DoorOpen, Play, CheckCircle2, CreditCard, Ban, UserPlus, Clock } from 'lucide-react';

interface WalkInViewProps {
  onOpenNewWalkIn: () => void;
  onOpenPayment: (appointment: Appointment) => void;
}

const todayAbidjan = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function minutesSince(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : null;
}

/** File d'attente et prestations des clients arrivés sans rendez-vous. */
export const WalkInView: React.FC<WalkInViewProps> = ({ onOpenNewWalkIn, onOpenPayment }) => {
  const { activeSalon, appointments, staff, formatPrice, startWalkIn, completeWalkIn, cancelAppointment } =
    useApp();

  const [staffChoice, setStaffChoice] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = todayAbidjan();
  const walkIns = useMemo(
    () =>
      appointments
        .filter((a) => a.salonId === activeSalon.id && a.source === 'walk_in')
        .filter((a) => a.status === 'checked_in' || a.status === 'in_progress' || a.date === today)
        .sort((a, b) => (a.arrivalAt ?? a.startsAt ?? '').localeCompare(b.arrivalAt ?? b.startsAt ?? '')),
    [appointments, activeSalon.id, today],
  );

  const waiting = walkIns.filter((a) => a.status === 'checked_in');
  const inProgress = walkIns.filter((a) => a.status === 'in_progress');
  const completed = walkIns.filter((a) => a.status === 'completed');

  const eligibleStaff = (serviceId: string) =>
    staff
      .filter((m) => m.salonId === activeSalon.id && m.isActive !== false && m.isAvailable)
      .filter((m) => (m.serviceIds?.length ?? 0) === 0 || m.serviceIds?.includes(serviceId));

  const handleStart = async (apt: Appointment) => {
    setBusyId(apt.id);
    await startWalkIn(apt.id, staffChoice[apt.id] || apt.staffId || null);
    setBusyId(null);
  };
  const handleComplete = async (apt: Appointment) => {
    setBusyId(apt.id);
    await completeWalkIn(apt.id);
    setBusyId(null);
  };
  const handleCancel = (apt: Appointment) => {
    if (window.confirm(`Annuler le passage de ${apt.clientName} ?`)) cancelAppointment(apt.id);
  };

  const renderCard = (apt: Appointment) => {
    const waitMin = minutesSince(apt.arrivalAt);
    const serviceMin = minutesSince(apt.serviceStartedAt);
    const options = eligibleStaff(apt.serviceId);
    return (
      <div key={apt.id} className="bg-[#151516] border border-[#2a2a2b] rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{apt.clientName}</p>
            <p className="text-xs text-stone-400 truncate">
              {apt.serviceName} · {formatPrice(apt.price)}
            </p>
            {apt.clientPhone && <p className="text-[11px] text-stone-500">{apt.clientPhone}</p>}
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              apt.status === 'in_progress'
                ? 'bg-purple-950 text-purple-300'
                : apt.status === 'checked_in'
                  ? 'bg-amber-950 text-amber-300'
                  : 'bg-emerald-950 text-emerald-300'
            }`}
          >
            {apt.status === 'in_progress'
              ? 'Au fauteuil'
              : apt.status === 'checked_in'
                ? 'En attente'
                : 'Terminé'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
          {apt.status === 'checked_in' && waitMin !== null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> attente {waitMin} min
            </span>
          )}
          {apt.status === 'in_progress' && serviceMin !== null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> en cours {serviceMin} min
            </span>
          )}
          {apt.staffName && (
            <span>
              Coiffeur : <span className="text-stone-200">{apt.staffName}</span>
            </span>
          )}
          {apt.status === 'completed' && (
            <span>
              Paiement :{' '}
              <span className={apt.paymentStatus === 'paid' ? 'text-emerald-300' : 'text-amber-300'}>
                {apt.paymentStatus === 'paid' ? 'réglé' : 'à encaisser'}
              </span>
            </span>
          )}
        </div>

        {apt.status === 'checked_in' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={staffChoice[apt.id] ?? apt.staffId ?? ''}
              onChange={(e) => setStaffChoice((prev) => ({ ...prev, [apt.id]: e.target.value }))}
              className="flex-1 bg-[#111113] border border-[#29292e] rounded-lg px-3 py-2 text-xs text-stone-200"
              aria-label={`Coiffeur pour ${apt.clientName}`}
            >
              <option value="">Premier disponible</option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleStart(apt)}
              disabled={busyId === apt.id}
              className="flex items-center justify-center gap-1.5 bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-60 text-[#101010] font-bold text-xs px-4 py-2 rounded-lg"
            >
              <Play className="w-3.5 h-3.5" /> Démarrer
            </button>
          </div>
        )}

        {apt.status === 'in_progress' && (
          <button
            onClick={() => handleComplete(apt)}
            disabled={busyId === apt.id}
            className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-lg"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Terminer la prestation
          </button>
        )}

        {apt.status === 'completed' && apt.paymentStatus !== 'paid' && (
          <button
            onClick={() => onOpenPayment(apt)}
            className="w-full flex items-center justify-center gap-1.5 bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2 rounded-lg"
          >
            <CreditCard className="w-3.5 h-3.5" /> Encaisser {formatPrice(apt.price)}
          </button>
        )}

        {(apt.status === 'checked_in' || apt.status === 'in_progress') && (
          <button
            onClick={() => handleCancel(apt)}
            className="w-full flex items-center justify-center gap-1.5 text-amber-300 hover:text-amber-200 text-[11px] font-semibold py-1"
          >
            <Ban className="w-3 h-3" /> Annuler ce passage
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-[#C9A45C]" /> Sans rendez-vous
          </h1>
          <p className="text-[#a9a9a9] mt-1">Accueil comptoir, file d’attente et prestations immédiates.</p>
        </div>
        <button
          onClick={onOpenNewWalkIn}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Accueillir un client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#151516] border border-[#2a2a2b] rounded-xl p-4">
          <p className="text-xs text-stone-400">En attente</p>
          <p className="text-2xl font-bold text-amber-300">{waiting.length}</p>
        </div>
        <div className="bg-[#151516] border border-[#2a2a2b] rounded-xl p-4">
          <p className="text-xs text-stone-400">Au fauteuil</p>
          <p className="text-2xl font-bold text-purple-300">{inProgress.length}</p>
        </div>
        <div className="bg-[#151516] border border-[#2a2a2b] rounded-xl p-4">
          <p className="text-xs text-stone-400">Terminés aujourd’hui</p>
          <p className="text-2xl font-bold text-emerald-300">{completed.length}</p>
        </div>
      </div>

      {walkIns.length === 0 ? (
        <div className="text-center py-16 bg-[#151516] rounded-xl border border-[#2a2a2b] text-stone-400">
          <DoorOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun client de passage pour le moment.</p>
          <button
            onClick={onOpenNewWalkIn}
            className="mt-3 text-xs text-[#C9A45C] font-semibold hover:underline"
          >
            Accueillir le premier client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-white">File d’attente ({waiting.length})</h2>
            {waiting.length === 0 ? (
              <p className="text-xs text-stone-500">Personne en attente.</p>
            ) : (
              waiting.map(renderCard)
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-white">Prestations en cours ({inProgress.length})</h2>
            {inProgress.length === 0 ? (
              <p className="text-xs text-stone-500">Aucune prestation en cours.</p>
            ) : (
              inProgress.map(renderCard)
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-white">Terminés / à encaisser ({completed.length})</h2>
            {completed.length === 0 ? (
              <p className="text-xs text-stone-500">Aucune prestation terminée aujourd’hui.</p>
            ) : (
              completed.map(renderCard)
            )}
          </section>
        </div>
      )}
    </div>
  );
};
