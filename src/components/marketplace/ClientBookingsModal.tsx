import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Calendar, Clock, MapPin, AlertCircle, Phone } from 'lucide-react';

export const ClientBookingsModal: React.FC = () => {
  const {
    isClientAppointmentsOpen,
    setIsClientAppointmentsOpen,
    appointments,
    salons,
    formatPrice,
    cancelAppointment
  } = useApp();

  const [phoneFilter, setPhoneFilter] = useState('');

  if (!isClientAppointmentsOpen) return null;

  // Filter appointments by phone if entered, otherwise show all recent
  const displayedAppointments = appointments.filter((apt) => {
    if (!phoneFilter.trim()) return true;
    const cleanFilter = phoneFilter.replace(/\s+/g, '');
    const cleanPhone = apt.clientPhone.replace(/\s+/g, '');
    return cleanPhone.includes(cleanFilter) || apt.clientName.toLowerCase().includes(phoneFilter.toLowerCase());
  });

  const getSalonName = (salonId: string) => {
    return salons.find((s) => s.id === salonId)?.name || 'Salon';
  };

  const getSalonAddress = (salonId: string) => {
    const s = salons.find((s) => s.id === salonId);
    return s ? `${s.commune}, ${s.quarter}` : 'Abidjan';
  };

  const statusBadges: Record<string, { label: string; class: string }> = {
    confirmed: { label: 'Confirmé', class: 'bg-emerald-950 text-emerald-400 border-emerald-800/40' },
    in_progress: { label: 'En cours', class: 'bg-amber-950 text-amber-400 border-amber-800/40' },
    completed: { label: 'Terminé', class: 'bg-stone-800 text-stone-300 border-stone-700' },
    cancelled: { label: 'Annulé', class: 'bg-red-950 text-red-400 border-red-800/40' },
    pending: { label: 'En attente', class: 'bg-blue-950 text-blue-400 border-blue-800/40' }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#151518] border border-[#2b2b30] rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={() => setIsClientAppointmentsOpen(false)}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#202024] text-stone-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A45C] mb-1">
            <Calendar className="w-4 h-4" />
            <span>Espace Client</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Mes réservations</h2>
          <p className="text-xs text-stone-400 mt-1">
            Consultez vos prochains rendez-vous et vos reçus de passage.
          </p>

          {/* Quick Phone Filter */}
          <div className="mt-4 relative">
            <Phone className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              placeholder="Filtrer par numéro de téléphone ou nom..."
              className="w-full bg-[#111113] border border-[#29292e] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
            />
          </div>
        </div>

        {/* List of bookings */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {displayedAppointments.length === 0 ? (
            <div className="text-center py-12 bg-[#111113] rounded-2xl border border-[#222226]">
              <AlertCircle className="w-8 h-8 text-stone-500 mx-auto mb-2" />
              <p className="text-stone-400 text-xs">Aucune réservation trouvée pour ce numéro.</p>
            </div>
          ) : (
            displayedAppointments.map((apt) => {
              const statusInfo = statusBadges[apt.status] || {
                label: apt.status,
                class: 'bg-stone-800 text-stone-300'
              };
              return (
                <div
                  key={apt.id}
                  className="p-4 rounded-2xl bg-[#19191d] border border-[#28282d] hover:border-stone-500 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{getSalonName(apt.salonId)}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.class}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-[#E5C378]">
                      {apt.serviceName}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-stone-500" />
                        <span>{apt.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-500" />
                        <span>{apt.time} ({apt.durationMinutes} min)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-500" />
                        <span>{getSalonAddress(apt.salonId)}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-stone-500">
                      Barbier : <span className="text-stone-300 font-medium">{apt.staffName}</span> • Client : <span className="text-stone-300 font-medium">{apt.clientName}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#25252a]">
                    <span className="text-sm font-extrabold text-white">
                      {formatPrice(apt.price)}
                    </span>

                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                      <button
                        onClick={() => {
                          if (confirm('Voulez-vous vraiment annuler ce rendez-vous ?')) {
                            cancelAppointment(apt.id);
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-900/40 px-3 py-1 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
