import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { salonApi, ApiError } from '../../lib/api';
import { PaymentMethod } from '../../types';
import { X, Calendar, Clock, User, Scissors, CheckCircle2 } from 'lucide-react';

interface NewAppointmentModalProps {
  onClose: () => void;
  initialDate?: string;
  initialTime?: string;
  initialStaffId?: string;
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  onClose,
  initialDate,
  initialTime,
  initialStaffId,
}) => {
  const { activeSalon, services, staff, formatPrice, bookAppointment } = useApp();

  const salonServices = services.filter((s) => s.salonId === activeSalon.id);
  const salonStaff = staff.filter((s) => s.salonId === activeSalon.id);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(salonServices[0]?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState(
    initialStaffId && (initialStaffId === 'any' || salonStaff.some((s) => s.id === initialStaffId))
      ? initialStaffId
      : salonStaff[0]?.id || '',
  );
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = useState(initialTime || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [source, setSource] = useState<'direct' | 'whatsapp' | 'phone'>('phone');
  const [notes, setNotes] = useState('');

  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTimeSlots([]);
    setSelectedTime('');
    setAvailabilityError(null);

    void salonApi(activeSalon.id)
      .appointments.availability(selectedDate, selectedServiceId || undefined)
      .then((byStaff: Record<string, { startsAt: string; available: boolean }[]>) => {
        if (!active) return;
        const staffSlots =
          selectedStaffId === 'any' ? Object.values(byStaff).flat() : (byStaff[selectedStaffId] ?? []);
        const available = [
          ...new Set(
            staffSlots
              .filter((slot) => slot.available)
              .map((slot) => slot.startsAt.slice(11, 16))
              .filter(Boolean),
          ),
        ].sort();
        setTimeSlots(available);
        setSelectedTime((current) =>
          initialTime && available.includes(initialTime)
            ? initialTime
            : available.includes(current)
              ? current
              : (available[0] ?? ''),
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setAvailabilityError(
            error instanceof ApiError ? error.message : 'Impossible de charger les disponibilités réelles.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [activeSalon.id, selectedDate, selectedStaffId, selectedServiceId, initialTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Veuillez renseigner le nom et le numéro du client.');
      return;
    }
    if (!selectedServiceId || !selectedStaffId || !selectedTime) {
      alert('Sélectionnez une prestation, un membre de l’équipe et une disponibilité réelle.');
      return;
    }

    const res = await bookAppointment({
      salonId: activeSalon.id,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      serviceId: selectedServiceId,
      staffId: selectedStaffId,
      date: selectedDate,
      time: selectedTime,
      paymentMethod,
      source,
      notes: notes.trim(),
    });

    if (res.success) {
      onClose();
    } else {
      alert(res.error || 'Erreur lors de la réservation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#161619] border border-[#2b2b30] rounded-3xl shadow-2xl p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A45C] mb-1">
            <Calendar className="w-4 h-4" />
            <span>Nouveau Rendez-vous</span>
          </div>
          <h2 className="text-xl font-bold text-white">Créer un RDV manuel</h2>
          <p className="text-xs text-stone-400 mt-1">
            Ajout immédiat au planning du salon {activeSalon.name}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Nom du client *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Kouamé Marc"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                Téléphone / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="07 00 00 00 00"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Prestation</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                {salonServices.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} ({formatPrice(srv.price)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Barbier assigné</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                <option value="any">Sans préférence (Auto)</option>
                {salonStaff.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Date</label>
              <input
                type="date"
                required
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Heure de début</label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                disabled={timeSlots.length === 0}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {availabilityError && (
                <p role="alert" className="mt-1 text-[11px] text-red-300">
                  {availabilityError}
                </p>
              )}
              {!availabilityError && timeSlots.length === 0 && (
                <p className="mt-1 text-[11px] text-stone-500">
                  Aucune disponibilité réelle chargée pour cette date.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                Source de réservation
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as typeof source)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                <option value="phone">Appel Téléphonique</option>
                <option value="whatsapp">WhatsApp Direct</option>
                <option value="direct">Client au comptoir</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Mode de règlement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                <option value="cash">Espèces au salon</option>
                <option value="wave">Wave Mobile Money</option>
                <option value="orange_money">Orange Money</option>
                <option value="mtn_momo">MTN MoMo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-stone-300 block mb-1">
              Notes / Préférences client
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Contours très fins, café noir..."
              className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmer & Enregistrer au planning</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
