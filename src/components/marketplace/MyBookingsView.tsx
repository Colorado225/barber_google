import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Scissors, Trash2 } from 'lucide-react';
import { bookingPortalPath, forgetBookingLink, listSavedBookings, type SavedBooking } from '../../lib/bookingVault';
import { useOptionalApp } from '../../context/AppContext';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan', weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export const MyBookingsView: React.FC = () => {
  const { addToast } = useOptionalApp();
  const [bookings, setBookings] = useState<SavedBooking[]>([]);

  useEffect(() => { setBookings(listSavedBookings()); }, []);

  const forget = (token: string) => {
    forgetBookingLink(token);
    setBookings(listSavedBookings());
    addToast('Lien retiré de cet appareil.', 'success');
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-10 space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-[#C9A45C] font-semibold">Suivi sans compte</p>
        <h1 className="text-2xl font-bold text-white mt-1">Mes réservations</h1>
        <p className="text-xs text-stone-400 mt-2">
          Liens enregistrés sur cet appareil. Chaque lien permet de suivre, annuler, puis noter la prestation.
        </p>
      </header>

      {bookings.length === 0 ? (
        <div className="bg-[#18181b] border border-[#26262a] rounded-3xl p-8 text-center space-y-3">
          <CalendarClock className="w-8 h-8 text-stone-500 mx-auto" />
          <p className="text-sm text-stone-300">Aucune réservation enregistrée sur cet appareil.</p>
          <Link to="/" className="inline-block text-[#C9A45C] text-xs font-bold">Trouver un salon et réserver</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li key={booking.token} className="bg-[#18181b] border border-[#26262a] rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{booking.salonName}</p>
                <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                  <Scissors className="w-3.5 h-3.5" /> {booking.serviceName}
                </p>
                <p className="text-xs text-[#E5C378] mt-0.5">{formatWhen(booking.startsAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={bookingPortalPath(booking.token)}
                  className="px-3 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold inline-flex items-center gap-1">
                  Suivre <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button onClick={() => forget(booking.token)} aria-label="Retirer ce lien de l’appareil"
                  className="p-2 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-400">
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
