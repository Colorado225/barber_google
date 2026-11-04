import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Appointment } from '../../types';
import { FormModal, Field, inputClass } from './FormModal';
import { DoorOpen, Play, Clock } from 'lucide-react';

interface WalkInModalProps {
  onClose: () => void;
  onCreated?: (appointment: Appointment) => void;
}

/** Accueil comptoir : client sans rendez-vous, avec ou sans démarrage immédiat. */
export const WalkInModal: React.FC<WalkInModalProps> = ({ onClose, onCreated }) => {
  const { activeSalon, services, staff, clients, formatPrice, registerWalkIn } = useApp();

  const salonServices = useMemo(
    () => services.filter((s) => s.salonId === activeSalon.id && s.isActive !== false),
    [services, activeSalon.id]
  );
  const salonStaff = useMemo(
    () => staff.filter((s) => s.salonId === activeSalon.id && s.isActive !== false && s.isAvailable),
    [staff, activeSalon.id]
  );
  const salonClients = useMemo(
    () => clients.filter((c) => c.salonId === activeSalon.id),
    [clients, activeSalon.id]
  );

  const [startMode, setStartMode] = useState<'wait' | 'now'>('now');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [serviceId, setServiceId] = useState(salonServices[0]?.id ?? '');
  const [staffId, setStaffId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = salonServices.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = salonStaff.filter(
    (m) => !serviceId || (m.serviceIds?.length ?? 0) === 0 || m.serviceIds?.includes(serviceId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!serviceId) {
      setError('Sélectionnez une prestation.');
      return;
    }
    setSubmitting(true);
    const result = await registerWalkIn({
      serviceId,
      clientId: clientId || null,
      clientName: clientName.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      staffId: staffId || null,
      startImmediately: startMode === 'now',
      notes: notes.trim(),
    });
    setSubmitting(false);
    if (result.success && result.appointment) {
      onCreated?.(result.appointment);
      onClose();
    } else {
      setError(result.error || 'Accueil du client impossible.');
    }
  };

  return (
    <FormModal
      title="Client de passage · sans rendez-vous"
      subtitle={activeSalon.name}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={submitting ? 'Enregistrement…' : startMode === 'now' ? 'Démarrer la prestation' : 'Mettre en attente'}
    >
      <div className="flex items-start gap-2 text-xs text-stone-300 bg-[#111113] border border-[#29292e] rounded-xl p-3">
        <DoorOpen className="w-4 h-4 text-[#C9A45C] shrink-0 mt-0.5" />
        <p>
          Aucun créneau futur n’est demandé. Le client est accueilli maintenant ;
          vous pouvez le mettre en attente si aucun coiffeur n’est libre.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setStartMode('now')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
            startMode === 'now' ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#E5C378]' : 'bg-[#111113] border-[#29292e] text-stone-400'
          }`}
        >
          <Play className="w-3.5 h-3.5" /> Démarrer maintenant
        </button>
        <button
          type="button"
          onClick={() => setStartMode('wait')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
            startMode === 'wait' ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#E5C378]' : 'bg-[#111113] border-[#29292e] text-stone-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Mettre en attente
        </button>
      </div>

      <Field label="Client existant (optionnel)">
        <select
          className={inputClass}
          value={clientId}
          onChange={(e) => {
            const id = e.target.value;
            setClientId(id);
            const client = salonClients.find((c) => c.id === id);
            if (client) {
              setClientName(client.name);
              setClientPhone(client.phone);
            }
          }}
        >
          <option value="">— Nouveau / non renseigné —</option>
          {salonClients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom (optionnel)">
          <input
            className={inputClass}
            value={clientName}
            onChange={(e) => { setClientName(e.target.value); setClientId(''); }}
            placeholder="Ex: Kouamé Marc"
          />
        </Field>
        <Field label="Téléphone (optionnel)">
          <input
            className={inputClass}
            type="tel"
            value={clientPhone}
            onChange={(e) => { setClientPhone(e.target.value); setClientId(''); }}
            placeholder="07 00 00 00 00"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prestation" required>
          <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {salonServices.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {formatPrice(s.price)}</option>
            ))}
          </select>
        </Field>
        <Field label="Coiffeur">
          <select className={inputClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">{startMode === 'now' ? 'Premier disponible' : 'Non attribué (file)'}</option>
            {eligibleStaff.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {selectedService && (
        <p className="text-[11px] text-stone-400">
          {selectedService.durationMinutes + (selectedService.prepMinutes ?? 0)} min ·{' '}
          <span className="text-[#E5C378] font-semibold">{formatPrice(selectedService.price)}</span> · paiement à la caisse après la prestation.
        </p>
      )}

      <Field label="Notes / préférences">
        <textarea
          rows={2}
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: contours fins, dégradé américain…"
        />
      </Field>
    </FormModal>
  );
};
