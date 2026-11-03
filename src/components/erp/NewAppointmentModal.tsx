import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
  initialStaffId
}) => {
  const {
    activeSalon,
    services,
    staff,
    formatPrice,
    bookAppointment,
    checkSlotAvailability
  } = useApp();

  const salonServices = services.filter((s) => s.salonId === activeSalon.id);
  const salonStaff = staff.filter((s) => s.salonId === activeSalon.id);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(salonServices[0]?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState(
    initialStaffId && (initialStaffId === 'any' || salonStaff.some((s) => s.id === initialStaffId))
      ? initialStaffId
      : salonStaff[0]?.id || 'any'
  );
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = useState(initialTime || '14:00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [source, setSource] = useState<'direct' | 'whatsapp' | 'phone'>('phone');
  const [notes, setNotes] = useState('');

  const timeSlots = [
    '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Veuillez renseigner le nom et le numéro du client.');
      return;
    }

    const res = bookAppointment({
      salonId: activeSalon.id,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      serviceId: selectedServiceId,
      staffId: selectedStaffId,
      date: selectedDate,
      time: selectedTime,
      paymentMethod,
      notes: notes ? `[Source: ${source}] ${notes}` : `[Source: ${source}] Prise de RDV au salon`
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
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Téléphone / WhatsApp *</label>
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
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">Source de réservation</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
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
                onChange={(e) => setPaymentMethod(e.target.value as any)}
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
            <label className="text-[11px] font-semibold text-stone-300 block mb-1">Notes / Préférences client</label>
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
