import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Appointment, AppointmentStatus } from '../../types';
import { FormModal, Field, inputClass, ConfirmDelete } from './FormModal';
import { forwardStatus } from '../../lib/appointment-workflow';
import { zonedToday } from '../../lib/businessTime';
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

interface PlanningViewProps {
  onOpenWalkIn?: () => void;
}

interface AppointmentActionsProps {
  appointment: Appointment;
  density: 'table' | 'touch';
  onEdit: (appointment: Appointment) => void;
  onAdvance: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
}

/**
 * The same domain callbacks power compact desktop controls and 44px mobile controls.
 * Keeping this presentational component local prevents a mobile-only action from drifting
 * from the established appointment workflow.
 */
const AppointmentActions: React.FC<AppointmentActionsProps> = ({
  appointment,
  density,
  onEdit,
  onAdvance,
  onCancel,
  onDelete,
}) => {
  const nextStatus = forwardStatus(appointment.status);
  const isTouch = density === 'touch';
  const iconButtonClass = isTouch
    ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#303036] bg-[#1c1c20] text-stone-300 transition-colors hover:bg-[#28282e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]'
    : 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-[#242429] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]';

  return (
    <div className={`flex flex-wrap items-center ${isTouch ? 'gap-2' : 'justify-end gap-1.5'}`}>
      {appointment.source !== 'walk_in' && (
        <button
          type="button"
          onClick={() => onEdit(appointment)}
          title="Modifier le rendez-vous"
          aria-label={`Modifier le rendez-vous de ${appointment.clientName}`}
          className={iconButtonClass}
        >
          <Pencil className={isTouch ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        </button>
      )}

      {nextStatus && (
        <button
          type="button"
          onClick={() => onAdvance(appointment)}
          title={`Passer à « ${STATUS_LABELS[nextStatus]} »`}
          aria-label={`Passer le rendez-vous de ${appointment.clientName} à ${STATUS_LABELS[nextStatus]}`}
          className={`${iconButtonClass} text-emerald-400 hover:text-emerald-300`}
        >
          <Check className={isTouch ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        </button>
      )}

      {appointment.status !== 'cancelled' && (
        <button
          type="button"
          onClick={() => onCancel(appointment)}
          title="Annuler le rendez-vous"
          aria-label={`Annuler le rendez-vous de ${appointment.clientName}`}
          className={`${iconButtonClass} text-amber-400 hover:text-amber-300`}
        >
          <Ban className={isTouch ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        </button>
      )}

      {appointment.source !== 'walk_in' && (
        <ConfirmDelete
          onConfirm={() => onDelete(appointment)}
          className={
            isTouch
              ? 'min-h-11 border-[#5e2020] px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]'
              : undefined
          }
        />
      )}
    </div>
  );
};

export const PlanningView: React.FC<PlanningViewProps> = ({ onOpenWalkIn }) => {
  const {
    activeSalon,
    salonTimezone,
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
    date: zonedToday(salonTimezone),
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

  const groupedRows = useMemo(() => {
    const rowsByDate = rows.reduce<Record<string, Appointment[]>>((groups, appointment) => {
      (groups[appointment.date] ??= []).push(appointment);
      return groups;
    }, {});
    return Object.entries(rowsByDate);
  }, [rows]);

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

  const handleAdvance = (apt: Appointment) => {
    if (apt.source === 'walk_in') {
      if (apt.status === 'checked_in') void startWalkIn(apt.id, apt.staffId);
      else if (apt.status === 'in_progress') void completeWalkIn(apt.id);
      return;
    }

    const next = forwardStatus(apt.status);
    if (next) updateAppointmentStatus(apt.id, next);
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

  const hasFilters = Boolean(filterDate || filterStaff || filterType !== 'all');
  const controlClass =
    'min-h-11 min-w-0 rounded-xl border border-[#2a2a2b] bg-[#151516] px-3 text-sm text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]';

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#f7f6f2]">
            <CalendarIcon className="h-6 w-6 text-[#C9A45C]" />
            Planning
          </h1>
          <p className="mt-1 text-[#a9a9a9]">Gérer les rendez-vous</p>
        </div>

        <div className="w-full space-y-2 xl:w-auto">
          <div
            aria-label="Filtres du planning"
            className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 xl:flex xl:flex-wrap xl:items-center"
          >
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              aria-label="Filtrer par date"
              className={`${controlClass} col-span-2 min-[480px]:col-span-1 xl:w-auto`}
            />
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              aria-label="Filtrer par employé"
              className={`${controlClass} col-span-1 w-full xl:w-auto`}
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
              className={`${controlClass} col-span-1 w-full xl:w-auto`}
            >
              <option value="all">Tous</option>
              <option value="appointments">Rendez-vous</option>
              <option value="walk_in">Sans rendez-vous</option>
              <option value="marketplace">Réservations en ligne</option>
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterDate('');
                  setFilterStaff('');
                  setFilterType('all');
                }}
                className="col-span-2 min-h-11 rounded-xl px-3 text-sm font-semibold text-stone-300 transition-colors hover:bg-[#202024] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[480px]:col-span-1 xl:col-auto"
              >
                Réinitialiser
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2 xl:flex xl:justify-end">
            {onOpenWalkIn && (
              <button
                type="button"
                onClick={onOpenWalkIn}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#3b3b44] bg-[#242429] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2d2d34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] xl:w-auto"
              >
                <Plus className="h-4 w-4 text-[#C9A45C]" aria-hidden="true" />
                Client de passage
              </button>
            )}
            <button
              type="button"
              onClick={openCreate}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 text-sm font-bold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white xl:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau rendez-vous
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#2a2a2b] bg-[#151516]">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-[#a9a9a9]">
            <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Aucun rendez-vous</p>
            <p>{hasFilters ? 'Aucun rendez-vous pour ce filtre' : 'Créez votre premier rendez-vous'}</p>
          </div>
        ) : (
          <>
            <section
              data-testid="planning-mobile-list"
              aria-label="Liste chronologique des rendez-vous"
              className="space-y-4 p-3 md:hidden"
            >
              {groupedRows.map(([date, appointmentsForDate]) => (
                <div key={date} className="space-y-2">
                  <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[#C9A45C]">{date}</h2>
                  {appointmentsForDate.map((apt) => (
                    <article
                      key={apt.id}
                      className="rounded-xl border border-[#2a2a2b] bg-[#19191b] p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <time
                            dateTime={`${apt.date}T${apt.time}`}
                            className="shrink-0 rounded-lg bg-[#27231a] px-2 py-1.5 font-mono text-sm font-bold text-[#E5C378]"
                          >
                            {apt.time}
                          </time>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate font-semibold text-[#f7f6f2]">{apt.clientName}</h3>
                              {apt.source === 'walk_in' && (
                                <span className="rounded-full border border-[#C9A45C]/30 bg-[#C9A45C]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#E5C378]">
                                  Sans RDV
                                </span>
                              )}
                              {apt.source === 'marketplace' && (
                                <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                                  En ligne
                                </span>
                              )}
                            </div>
                            {apt.clientPhone && (
                              <p className="mt-0.5 text-xs text-[#a9a9a9]">{apt.clientPhone}</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[apt.status]}`}
                        >
                          {STATUS_LABELS[apt.status]}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-y border-[#2a2a2b] py-3 text-xs">
                        <p className="truncate text-[#a9a9a9]">{apt.serviceName}</p>
                        <p className="font-semibold text-[#E5C378]">{formatPrice(apt.price)}</p>
                        <p className="truncate text-[#a9a9a9]">{apt.staffName}</p>
                        <p className="text-right text-stone-500">{apt.durationMinutes} min</p>
                      </div>

                      <div className="mt-3">
                        <AppointmentActions
                          appointment={apt}
                          density="touch"
                          onEdit={openEdit}
                          onAdvance={handleAdvance}
                          onCancel={(appointment) => updateAppointmentStatus(appointment.id, 'cancelled')}
                          onDelete={(appointment) => deleteAppointment(appointment.id)}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </section>

            <div
              className="hidden overflow-x-auto md:block"
              role="region"
              aria-label="Liste des rendez-vous, défilement horizontal"
              tabIndex={0}
            >
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2b] text-left">
                    {['Date', 'Heure', 'Client', 'Prestation', 'Barbier', 'Statut', 'Montant', ''].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-[#a9a9a9]"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((apt) => (
                    <tr key={apt.id} className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]">
                      <td className="px-3 py-3 text-xs text-[#a9a9a9]">{apt.date}</td>
                      <td className="px-3 py-3 font-mono text-xs text-[#C9A45C]">{apt.time}</td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-[#f7f6f2]">{apt.clientName}</span>
                        {apt.source === 'walk_in' && (
                          <span className="ml-2 rounded-full border border-[#C9A45C]/30 bg-[#C9A45C]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#E5C378]">
                            Sans RDV
                          </span>
                        )}
                        {apt.source === 'marketplace' && (
                          <span className="ml-2 rounded-full border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                            En ligne
                          </span>
                        )}
                        <div className="text-[11px] text-[#a9a9a9]">{apt.clientPhone}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#a9a9a9]">{apt.serviceName}</td>
                      <td className="px-3 py-3 text-xs text-[#a9a9a9]">{apt.staffName}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[apt.status]}`}
                        >
                          {STATUS_LABELS[apt.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#E5C378]">{formatPrice(apt.price)}</td>
                      <td className="px-3 py-3">
                        <AppointmentActions
                          appointment={apt}
                          density="table"
                          onEdit={openEdit}
                          onAdvance={handleAdvance}
                          onCancel={(appointment) => updateAppointmentStatus(appointment.id, 'cancelled')}
                          onDelete={(appointment) => deleteAppointment(appointment.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
              className="rounded-lg border border-red-800/50 bg-red-950/50 px-3 py-2 text-xs text-red-300"
            >
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
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
              <p className="mt-1 text-[11px] text-stone-500">
                Seuls les employés actifs maîtrisant la prestation sont proposés. La disponibilité réelle est
                vérifiée par le serveur à l'enregistrement.
              </p>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
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
