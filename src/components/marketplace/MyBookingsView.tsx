import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Scissors, ShieldAlert, Trash2 } from 'lucide-react';
import {
  clearActiveBookingToken,
  clearAllSavedBookings,
  forgetBookingLink,
  listSavedBookings,
  setActiveBookingToken,
  type SavedBooking,
} from '../../lib/bookingVault';
import { applyStrictPortalPrivacy } from '../../lib/portalIsolation';
import { useOptionalApp } from '../../context/AppContext';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export const MyBookingsView: React.FC = () => {
  const { addToast } = useOptionalApp();
  const [bookings, setBookings] = useState<SavedBooking[]>([]);

  useEffect(() => applyStrictPortalPrivacy({ title: 'Mes réservations — Barber Cuts' }), []);

  useEffect(() => {
    setBookings(listSavedBookings());
  }, []);

  const forget = (token: string, appointmentId?: string) => {
    forgetBookingLink(token, appointmentId);
    setBookings(listSavedBookings());
    addToast('Lien retiré de cet appareil.', 'success');
  };

  const clearAll = () => {
    clearAllSavedBookings();
    clearActiveBookingToken();
    setBookings([]);
    addToast('Tous les liens secrets ont été effacés de cet appareil.', 'success');
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-10 space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#C9A45C] font-semibold">
              Suivi sans compte
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">Mes réservations</h1>
          </div>
          {bookings.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-red-300 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Tout effacer de cet appareil
            </button>
          )}
        </div>
        <div
          role="note"
          className="rounded-2xl border border-amber-500/35 bg-amber-950/20 p-3.5 text-xs text-stone-300 flex items-start gap-2.5"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Chaque lien mémorisé sur cet appareil est un secret d’accès : toute personne utilisant ce
            navigateur ou possédant le lien peut consulter, annuler ou noter la réservation associée. Retirez
            vos liens si vous utilisez un ordinateur ou téléphone partagé.
          </p>
        </div>
      </header>

      {bookings.length === 0 ? (
        <div className="bg-[#18181b] border border-[#26262a] rounded-3xl p-8 text-center space-y-3">
          <CalendarClock className="w-8 h-8 text-stone-500 mx-auto" />
          <p className="text-sm text-stone-300">Aucune réservation mémorisée sur cet appareil.</p>
          <Link to="/" className="inline-block text-[#C9A45C] text-xs font-bold">
            Trouver un salon et réserver
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.appointmentId || booking.token}
              className="bg-[#18181b] border border-[#26262a] rounded-2xl p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{booking.salonName}</p>
                <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                  <Scissors className="w-3.5 h-3.5" /> {booking.serviceName}
                </p>
                <p className="text-xs text-[#E5C378] mt-0.5">{formatWhen(booking.startsAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/reservation"
                  state={{ bookingToken: booking.token }}
                  onClick={() => setActiveBookingToken(booking.token)}
                  className="px-3 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold inline-flex items-center gap-1"
                >
                  Suivre <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => forget(booking.token, booking.appointmentId)}
                  aria-label="Retirer ce lien de l’appareil"
                  className="p-2 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
