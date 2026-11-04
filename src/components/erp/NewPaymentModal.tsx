import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, PaymentTransaction } from '../../types';
import { X, CreditCard, Banknote, CheckCircle2, Printer, Smartphone } from 'lucide-react';

interface NewPaymentModalProps {
  onClose: () => void;
  preselectedAppointmentId?: string;
  defaultAmount?: number;
  defaultClientName?: string;
}

export const NewPaymentModal: React.FC<NewPaymentModalProps> = ({
  onClose,
  preselectedAppointmentId,
  defaultAmount,
  defaultClientName = ''
}) => {
  const { activeSalon, formatPrice, recordPayment, appointments } = useApp();

  const [clientName, setClientName] = useState(defaultClientName);
  const [amount, setAmount] = useState(String(defaultAmount ?? ''));
  const [method, setMethod] = useState<PaymentMethod>('wave');
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full');
  const [createdReceipt, setCreatedReceipt] = useState<PaymentTransaction | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // If appointment selected, can choose from unpaid appointments
  const unpaidAppointments = appointments.filter(
    (a) => a.salonId === activeSalon.id && a.paymentStatus !== 'paid'
  );

  const [linkedAptId, setLinkedAptId] = useState<string>(preselectedAppointmentId || '');

  const handleSelectApt = (aptId: string) => {
    setLinkedAptId(aptId);
    const apt = appointments.find((a) => a.id === aptId);
    if (apt) {
      setClientName(apt.clientName);
      setAmount(String(apt.price));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      alert('Veuillez renseigner le nom du client et un montant valide.');
      return;
    }

    setPaymentError(null);
    try {
      const tx = recordPayment({
        appointmentId: linkedAptId || undefined,
        clientName: clientName.trim(),
        amount: Number(amount),
        method,
        type: paymentType
      });
      setCreatedReceipt(tx);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Enregistrement du paiement impossible.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl shadow-2xl p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {!createdReceipt ? (
          <div>
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A45C] mb-1">
                <CreditCard className="w-4 h-4" />
                <span>Caisse & Encaissement Direct</span>
              </div>
              <h2 className="text-xl font-bold text-white">Nouvel Encaissement</h2>
              <p className="text-xs text-stone-400 mt-1">
                Enregistrez un paiement par Mobile Money ou Espèces.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Optional Appointment link */}
              {unpaidAppointments.length > 0 && !preselectedAppointmentId && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                    Lier à un RDV en cours / terminé (Optionnel)
                  </label>
                  <select
                    value={linkedAptId}
                    onChange={(e) => handleSelectApt(e.target.value)}
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="">-- Vente libre / Client comptoir --</option>
                    {unpaidAppointments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.clientName} - {apt.serviceName} ({formatPrice(apt.price)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Nom du client / Référence
                </label>
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
                  Montant encaissé (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2.5 text-base font-extrabold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1.5">
                  Moyen de paiement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'wave', label: 'Wave Mobile Money' },
                    { id: 'orange_money', label: 'Orange Money' },
                    { id: 'cash', label: 'Espèces au comptoir' },
                    { id: 'mtn_momo', label: 'MTN Mobile Money' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id as PaymentMethod)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                        method === m.id
                          ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                          : 'bg-[#111113] border-[#29292e] text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                {paymentError && <p role="alert" className="mb-3 text-xs text-red-300">{paymentError}</p>}
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider l'encaissement{amount ? ` de ${formatPrice(Number(amount))}` : ''}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* RECEIPT PREVIEW */
          <div className="space-y-4 text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                ENCAISSEMENT RÉUSSI
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Ticket de caisse #{createdReceipt.reference}</h3>
            </div>

            {/* Receipt Box styled like thermal paper */}
            <div className="bg-[#101012] border border-[#26262a] rounded-2xl p-4 text-xs text-left space-y-2 text-stone-300 font-mono">
              <div className="text-center pb-2 border-b border-[#232326] font-sans">
                <div className="font-bold text-white text-sm">{activeSalon.name}</div>
                <div className="text-[10px] text-stone-500">{activeSalon.address}</div>
                <div className="text-[10px] text-stone-500">Tel: {activeSalon.phone}</div>
              </div>

              <div className="flex justify-between">
                <span>Date & Heure :</span>
                <span className="text-white">{createdReceipt.date} {createdReceipt.time}</span>
              </div>
              <div className="flex justify-between">
                <span>Client :</span>
                <span className="text-white font-bold">{createdReceipt.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span>Mode :</span>
                <span className="text-white font-bold uppercase">{createdReceipt.method.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Réf. Transaction :</span>
                <span className="text-[#C9A45C] font-bold">{createdReceipt.reference}</span>
              </div>
              <div className="pt-2 border-t border-[#232326] flex justify-between text-sm font-sans font-extrabold text-white">
                <span>TOTAL PAYÉ :</span>
                <span className="text-[#E5C378]">{formatPrice(createdReceipt.amount)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#222226] hover:bg-[#2b2b30] text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4 text-[#C9A45C]" />
                <span>Imprimer</span>
              </button>

              <button
                onClick={() => {
                  setCreatedReceipt(null);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold transition-colors"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
