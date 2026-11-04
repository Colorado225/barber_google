import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { Appointment } from '../../types';
import { bookingPortalPath } from '../../lib/bookingVault';
import { Inbox, CheckCircle2, Ban, Clock, Phone, Mail, Scissors, UserCheck, RefreshCw, ExternalLink } from 'lucide-react';

type Filter = 'pending' | 'upcoming' | 'history' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'À confirmer' },
  { id: 'upcoming', label: 'Confirmées à venir' },
  { id: 'history', label: 'Historique' },
  { id: 'all', label: 'Toutes' },
];

function minutesSince(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : 0;
}

function ageLabel(iso: string): string {
  const minutes = minutesSince(iso);
  if (minutes < 60) return `reçue il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `reçue il y a ${hours} h`;
  return `reçue il y a ${Math.floor(hours / 24)} j`;
}

/** Boîte de réception des réservations venues de la marketplace. */
export const OnlineRequestsView: React.FC = () => {
  const {
    activeSalon, appointments, clients, formatPrice,
    updateAppointmentStatus, reloadWorkspace,
  } = useApp();
  const { hasPermission } = useOptionalAuth();
  const canWrite = hasPermission('appointments.write', activeSalon.id);

  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const online = useMemo(
    () => appointments
      .filter((a) => a.salonId === activeSalon.id && a.source === 'marketplace')
      .sort((a, b) => (b.createdAt ?? b.startsAt).localeCompare(a.createdAt ?? a.startsAt)),
    [appointments, activeSalon.id],
  );

  const pending = online.filter((a) => a.status === 'pending');
  const upcoming = online.filter((a) => a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress');
  const history = online.filter((a) => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show');

  const rows = filter === 'pending' ? pending : filter === 'upcoming' ? upcoming : filter === 'history' ? history : online;
  const clientName = (apt: Appointment) => clients.find((c) => c.id === apt.clientId)?.name;

  const confirm = async (apt: Appointment) => {
    setBusyId(apt.id);
    updateAppointmentStatus(apt.id, 'confirmed');
    setBusyId(null);
  };
  const refuse = (apt: Appointment) => {
    const reason = window.prompt(`Motif du refus pour ${apt.clientName} (obligatoire) :`, 'Créneau indisponible');
    if (!reason || reason.trim().length < 3) return;
    setBusyId(apt.id);
    updateAppointmentStatus(apt.id, 'cancelled', reason.trim());
    setBusyId(null);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-[#C9A45C]" />
          <div>
            <h1 className="text-xl font-bold text-white">Demandes en ligne</h1>
            <p className="text-sm text-stone-400">
              Réservations reçues depuis la marketplace — {pending.length} en attente de confirmation
            </p>
          </div>
        </div>
        <button onClick={() => void reloadWorkspace(activeSalon.id)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2b] bg-[#161619] px-3 py-2 text-xs font-semibold text-stone-300 hover:text-white">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'À confirmer', value: pending.length, tone: 'text-amber-300' },
          { label: 'Confirmées à venir', value: upcoming.length, tone: 'text-emerald-300' },
          { label: 'Traitées', value: history.length, tone: 'text-stone-300' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[#27272c] bg-[#161619] p-4">
            <p className="text-xs text-stone-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.id} onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === item.id ? 'bg-[#C9A45C] text-[#101010]' : 'bg-[#1a1a1d] text-stone-400 hover:text-white'
            }`}>
            {item.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-[#27272c] bg-[#161619] p-6 text-sm text-stone-400">
          Aucune demande dans cette catégorie. Les réservations en ligne apparaissent ici dès qu’un client réserve sur la marketplace.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((apt) => (
            <li key={apt.id} className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{apt.clientName}</p>
                    {apt.status === 'pending' && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        À CONFIRMER
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400 flex items-center gap-1">
                    <Scissors className="h-3.5 w-3.5" /> {apt.serviceName} · {formatPrice(apt.price)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#E5C378] flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {apt.date} à {apt.time}
                    {apt.staffName && <span className="text-stone-400"> · avec {apt.staffName}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-stone-500">
                    {apt.clientPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {apt.clientPhone}</span>}
                    {apt.clientEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {apt.clientEmail}</span>}
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {apt.clientId ? `CRM : ${clientName(apt) ?? 'fiche liée'}` : 'CRM : non rattaché'}
                    </span>
                    <span>{ageLabel(apt.createdAt ?? apt.startsAt)}</span>
                  </div>
                  {apt.notes && <p className="mt-1 text-[11px] text-stone-400 italic">« {apt.notes} »</p>}
                </div>

                {canWrite && apt.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => void confirm(apt)} disabled={busyId === apt.id}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> Confirmer
                    </button>
                    <button onClick={() => refuse(apt)} disabled={busyId === apt.id}
                      className="inline-flex items-center gap-1 rounded-xl bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-900/60 disabled:opacity-50">
                      <Ban className="h-4 w-4" /> Refuser
                    </button>
                  </div>
                )}
                {apt.status !== 'pending' && (
                  <span className="shrink-0 rounded-full border border-[#2f2f34] bg-[#1a1a1d] px-3 py-1 text-[11px] font-semibold text-stone-300">
                    {apt.status}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-stone-500 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Le client suit sa demande depuis son lien personnel
        <code className="text-stone-400">{bookingPortalPath('<jeton>')}</code> : toute confirmation ou annulation y est visible immédiatement.
      </p>
    </section>
  );
};
