import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Appointment, AppointmentStatus } from '../../types';
import { FormModal, Field, inputClass, ConfirmDelete } from './FormModal';
import { forwardStatus } from '../../lib/appointment-workflow';
import { Calendar as CalendarIcon, Plus, Pencil, Check, Ban } from 'lucide-react';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  checked_in: 'Arrivé',
  in_progress: 'Au fauteuil',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-950/80 text-amber-300',
  confirmed: 'bg-blue-950/80 text-blue-300',
  checked_in: 'bg-indigo-950/80 text-indigo-300',
  in_progress: 'bg-purple-950/80 text-purple-300',
  completed: 'bg-emerald-950/80 text-emerald-400',
  cancelled: 'bg-stone-800 text-stone-400',
  no_show: 'bg-red-950/80 text-red-400',
};

type FormState = {
  clientName: string;
  clientPhone: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  notes: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

interface PlanningViewProps {
  onOpenWalkIn?: () => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ onOpenWalkIn }) => {
  const {
    activeSalon,
    appointments,
    services,
    staff,
    clients,
    formatPrice,
    bookAppointment,
    updateAppointment,
    deleteAppointment,
    updateAppointmentStatus,
    startWalkIn,
    completeWalkIn,
    addToast,
  } = useApp();

  const [filterDate, setFilterDate] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'appointments' | 'walk_in' | 'marketplace'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const emptyForm = (): FormState => ({
    clientName: '',
    clientPhone: '',
    serviceId: '',
    // Employé choisi explicitement : le serveur refuse un identifiant inconnu
    // et vérifie lui-même la disponibilité et la maîtrise de la prestation.
    staffId: '',
    date: todayStr(),
    time: '',
    notes: '',
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  // Erreur affichée dans le formulaire : visible même si un toast est masqué.
  const [formError, setFormError] = useState<string | null>(null);

  const salonServices = useMemo(
    () => services.filter((s) => s.salonId === activeSalon.id),
    [services, activeSalon.id],
  );
  const salonStaff = useMemo(
    () => staff.filter((s) => s.salonId === activeSalon.id),
    [staff, activeSalon.id],
  );

  const rows = useMemo(() => {
    return appointments
      .filter((a) => a.salonId === activeSalon.id)
      .filter((a) => (filterDate ? a.date === filterDate : true))
      .filter((a) => (filterStaff ? a.staffId === filterStaff : true))
      .filter((a) => {
        if (filterType === 'all') return true;
        if (filterType === 'walk_in') return a.source === 'walk_in';
        if (filterType === 'marketplace') return a.source === 'marketplace';
        return a.source !== 'walk_in' && a.source !== 'marketplace';
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [appointments, activeSalon.id, filterDate, filterStaff, filterType]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    setFormError(null);
    setEditing(apt);
    setForm({
      clientName: apt.clientName,
      clientPhone: apt.clientPhone,
      serviceId: apt.serviceId,
      staffId: apt.staffId ?? '',
      date: apt.date,
      time: apt.time,
      notes: apt.notes || '',
    });
    setIsFormOpen(true);
  };

  /** Affiche l'erreur dans le formulaire (toujours visible) et en toast. */
  const fail = (message: string) => {
    setFormError(message);
    addToast(message, 'error');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.clientName.trim()) {
      fail('Le nom du client est obligatoire.');
      return;
    }
    if (!form.serviceId) {
      fail('Sélectionnez une prestation.');
      return;
    }
    if (!form.date || !form.time) {
      fail('La date et l’heure sont obligatoires.');
      return;
    }

    if (editing) {
      const service = salonServices.find((s) => s.id === form.serviceId);
      const member = salonStaff.find((s) => s.id === form.staffId);
      updateAppointment(editing.id, {
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        serviceId: form.serviceId,
        serviceName: service?.name || editing.serviceName,
        price: service?.price ?? editing.price,
        durationMinutes: service?.durationMinutes ?? editing.durationMinutes,
        staffId: member?.id || editing.staffId,
        staffName: member?.name || 'Sans préférence',
        date: form.date,
        time: form.time,
        notes: form.notes.trim(),
      });
      setIsFormOpen(false);
      return;
    }

    // Reuse the store's booking rules (availability check, queued staff, etc.).
    const result = await bookAppointment({
      salonId: activeSalon.id,
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      serviceId: form.serviceId,
      staffId: form.staffId,
      date: form.date,
      time: form.time,
      paymentMethod: 'cash',
      notes: form.notes.trim(),
    });

    if (!result.success) {
      // Le message vient du serveur (conflit de créneau, horaires, absence…).
      fail(result.error || 'Impossible de créer ce rendez-vous.');
      return;
    }
    setIsFormOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#C9A45C]" />
            Planning
          </h1>
          <p className="text-[#a9a9a9] mt-1">Gérer les rendez-vous</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            aria-label="Filtrer par date"
            className="bg-[#151516] border border-[#2a2a2b] rounded-lg px-3 py-2 text-xs text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
          />
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            aria-label="Filtrer par employé"
            className="bg-[#151516] border border-[#2a2a2b] rounded-lg px-3 py-2 text-xs text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
          >
            <option value="">Tous les employés</option>
            {salonStaff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            aria-label="Filtrer par type"
            className="bg-[#151516] border border-[#2a2a2b] rounded-lg px-3 py-2 text-xs text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
          >
            <option value="all">Tous</option>
            <option value="appointments">Rendez-vous</option>
            <option value="walk_in">Sans rendez-vous</option>
            <option value="marketplace">Réservations en ligne</option>
          </select>
          {(filterDate || filterStaff || filterType !== 'all') && (
            <button
              onClick={() => {
                setFilterDate('');
                setFilterStaff('');
                setFilterType('all');
              }}
              className="text-xs text-stone-400 hover:text-white px-2 py-2 cursor-pointer"
            >
              Réinitialiser
            </button>
          )}
          {onOpenWalkIn && (
            <button
              onClick={onOpenWalkIn}
              className="flex items-center gap-2 px-4 py-2 bg-[#242429] text-white border border-[#3b3b44] rounded-lg font-semibold hover:bg-[#2d2d34] cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-[#C9A45C]" />
              Client de passage
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouveau rendez-vous
          </button>
        </div>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun rendez-vous</p>
            <p>
              {filterDate || filterStaff
                ? 'Aucun rendez-vous pour ce filtre'
                : 'Créez votre premier rendez-vous'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-[#2a2a2b] text-left">
                {['Date', 'Heure', 'Client', 'Prestation', 'Barbier', 'Statut', 'Montant', ''].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-[11px] uppercase tracking-wider text-[#a9a9a9] font-bold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((apt) => (
                <tr key={apt.id} className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]">
                  <td className="px-3 py-3 text-[#a9a9a9] text-xs">{apt.date}</td>
                  <td className="px-3 py-3 text-[#C9A45C] font-mono text-xs">{apt.time}</td>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-[#f7f6f2]">{apt.clientName}</span>
                    {apt.source === 'walk_in' && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#C9A45C]/15 text-[#E5C378] border border-[#C9A45C]/30">
                        Sans RDV
                      </span>
                    )}
                    {apt.source === 'marketplace' && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        En ligne
                      </span>
                    )}
                    <div className="text-[11px] text-[#a9a9a9]">{apt.clientPhone}</div>
                  </td>
                  <td className="px-3 py-3 text-[#a9a9a9] text-xs">{apt.serviceName}</td>
                  <td className="px-3 py-3 text-[#a9a9a9] text-xs">{apt.staffName}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[apt.status]}`}
                    >
                      {STATUS_LABELS[apt.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#E5C378] font-semibold">{formatPrice(apt.price)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {apt.source !== 'walk_in' && (
                        <button
                          onClick={() => openEdit(apt)}
                          title="Modifier"
                          className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {forwardStatus(apt.status) && (
                        <button
                          onClick={() => {
                            if (apt.source === 'walk_in') {
                              if (apt.status === 'checked_in') void startWalkIn(apt.id, apt.staffId);
                              else if (apt.status === 'in_progress') void completeWalkIn(apt.id);
                              return;
                            }
                            const next = forwardStatus(apt.status);
                            if (next) updateAppointmentStatus(apt.id, next);
                          }}
                          title={`Passer à « ${STATUS_LABELS[forwardStatus(apt.status)!]} »`}
                          className="text-emerald-400 hover:text-emerald-300 p-1 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {apt.status !== 'cancelled' && (
                        <button
                          onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                          title="Annuler"
                          className="text-amber-400 hover:text-amber-300 p-1 rounded cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {apt.source !== 'walk_in' && (
                        <ConfirmDelete onConfirm={() => deleteAppointment(apt.id)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isFormOpen && (
        <FormModal
          wide
          title={editing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          subtitle={activeSalon.name}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={editing ? 'Enregistrer' : 'Créer'}
        >
          {formError && (
            <p
              role="alert"
              className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2"
            >
              {formError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom du client" required>
              <input
                className={inputClass}
                list="clients-list"
                value={form.clientName}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = clients.find((c) => c.salonId === activeSalon.id && c.name === name);
                  setForm({
                    ...form,
                    clientName: name,
                    clientPhone: match ? match.phone : form.clientPhone,
                  });
                }}
                placeholder="Ex: Awa Koné"
              />
              <datalist id="clients-list">
                {clients
                  .filter((c) => c.salonId === activeSalon.id)
                  .map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
              </datalist>
            </Field>

            <Field label="Téléphone">
              <input
                className={inputClass}
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                placeholder="+225 ..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prestation" required>
              <select
                className={inputClass}
                value={form.serviceId}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              >
                <option value="" className="bg-[#17171a]">
                  — Sélectionner —
                </option>
                {salonServices.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#17171a]">
                    {s.name} · {formatPrice(s.price)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Collaborateur">
              <select
                className={inputClass}
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              >
                {salonStaff
                  .filter((m) => m.isActive !== false && m.isAvailable)
                  .filter((m) => (m.serviceIds?.length ?? 0) === 0 || m.serviceIds!.includes(form.serviceId))
                  .map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#17171a]">
                      {m.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-stone-500 mt-1">
                Seuls les employés actifs maîtrisant la prestation sont proposés. La disponibilité réelle est
                vérifiée par le serveur à l'enregistrement.
              </p>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>

            <Field label="Heure" required>
              <input
                type="time"
                className={inputClass}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              rows={2}
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </FormModal>
      )}
    </div>
  );
};
