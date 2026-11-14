import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StaffMember, StaffRole } from '../../types';
import { FormModal, Field, inputClass, ConfirmDelete } from './FormModal';
import { UserCog, Plus, Pencil, Clock } from 'lucide-react';
import { StaffSchedulePanel } from './StaffSchedulePanel';

const ROLES: { id: StaffRole; label: string }[] = [
  { id: 'master_barber', label: 'Maître barbier' },
  { id: 'barber', label: 'Barbier' },
  { id: 'colorist', label: 'Coloriste' },
  { id: 'stylist', label: 'Styliste' },
  { id: 'manager', label: 'Manager' },
];

const ROLE_LABELS: Record<StaffRole, string> = {
  master_barber: 'Maître barbier',
  barber: 'Barbier',
  colorist: 'Coloriste',
  stylist: 'Styliste',
  manager: 'Manager',
};

type FormState = {
  name: string;
  role: StaffRole;
  phone: string;
  email: string;
  specialties: string;
  commissionRate: string;
  isAvailable: boolean;
  isActive: boolean;
  serviceIds: string[];
};

const emptyForm: FormState = {
  name: '',
  role: 'barber',
  phone: '',
  email: '',
  specialties: '',
  commissionRate: '25',
  isAvailable: true,
  isActive: true,
  serviceIds: [],
};

export const StaffView: React.FC = () => {
  const { activeSalon, staff, services, addStaff, updateStaff, deleteStaff, addToast } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [scheduleFor, setScheduleFor] = useState<StaffMember | null>(null);

  const rows = useMemo(() => staff.filter((m) => m.salonId === activeSalon.id), [staff, activeSalon.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({
      name: member.name,
      role: member.role,
      phone: member.phone,
      email: member.email ?? '',
      specialties: member.specialties.join(', '),
      commissionRate: String(member.commissionRate),
      isAvailable: member.isAvailable,
      isActive: member.isActive ?? true,
      serviceIds: member.serviceIds ?? [],
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const commission = Number(form.commissionRate);

    if (!form.name.trim()) {
      addToast('Le nom du collaborateur est obligatoire.', 'error');
      return;
    }
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      addToast('La commission doit être comprise entre 0 et 100 %.', 'error');
      return;
    }

    const payload = {
      salonId: activeSalon.id,
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim(),
      email: form.email.trim(),
      avatar: editing?.avatar || '',
      specialties: form.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      rating: editing?.rating || 0,
      commissionRate: commission,
      isAvailable: form.isAvailable,
      isActive: form.isActive,
      serviceIds: form.serviceIds,
      branchId: editing?.branchId ?? null,
    };

    if (editing) {
      updateStaff(editing.id, payload);
    } else {
      addStaff(payload);
    }
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#f7f6f2]">
            <UserCog className="h-6 w-6 text-[#C9A45C]" aria-hidden="true" />
            Équipe
          </h1>
          <p className="mt-1 text-[#a9a9a9]">Collaborateurs et rôles</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 text-sm font-bold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-[480px]:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter un collaborateur
        </button>
      </div>

      <div className="rounded-xl border border-[#2a2a2b] bg-[#151516]">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#a9a9a9] sm:p-6 sm:py-12">
            <UserCog className="mx-auto mb-4 h-12 w-12 opacity-50" aria-hidden="true" />
            <p>Aucun collaborateur</p>
            <p className="mt-1 text-sm">Ajoutez votre équipe</p>
          </div>
        ) : (
          <>
            <section
              data-testid="staff-mobile-list"
              aria-label="Liste de l’équipe"
              className="space-y-3 p-3 md:hidden"
            >
              {rows.map((member) => {
                const isActive = member.isActive ?? true;
                const status = !isActive ? 'Inactif' : member.isAvailable ? 'Disponible' : 'Indisponible';
                const statusTone = !isActive
                  ? 'bg-red-950/80 text-red-400'
                  : member.isAvailable
                    ? 'bg-emerald-950/80 text-emerald-400'
                    : 'bg-stone-800 text-stone-400';

                return (
                  <article
                    key={member.id}
                    className="rounded-xl border border-[#2a2a2b] bg-[#19191b] p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-[#f7f6f2]">{member.name}</h2>
                        <p className="mt-0.5 text-xs text-[#a9a9a9]">{ROLE_LABELS[member.role]}</p>
                        {member.phone && <p className="mt-0.5 text-xs text-stone-500">{member.phone}</p>}
                        {member.email && (
                          <p className="mt-0.5 truncate text-xs text-stone-500">{member.email}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone}`}
                      >
                        {status}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-[#2a2a2b] py-3 text-xs">
                      <div>
                        <dt className="text-stone-500">Commission</dt>
                        <dd className="mt-0.5 font-semibold text-[#E5C378]">{member.commissionRate} %</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-stone-500">Prestations</dt>
                        <dd className="mt-0.5 font-semibold text-[#f7f6f2]">
                          {member.serviceIds?.length ?? 0}
                        </dd>
                      </div>
                      <div className="col-span-2 flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-stone-500">Spécialités</dt>
                        <dd className="truncate text-right text-[#a9a9a9]">
                          {member.specialties.length ? member.specialties.join(', ') : '—'}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleFor(member)}
                        aria-label={`Gérer les horaires de ${member.name}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#303036] bg-[#1c1c20] text-stone-300 transition-colors hover:bg-[#28282e] hover:text-[#E5C378] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                      >
                        <Clock className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(member)}
                        aria-label={`Modifier le collaborateur ${member.name}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#303036] bg-[#1c1c20] text-stone-300 transition-colors hover:bg-[#28282e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <ConfirmDelete
                        onConfirm={() => deleteStaff(member.id)}
                        className="min-h-11 border-[#5e2020] px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                      />
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="hidden md:block">
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Liste de l’équipe, défilement horizontal"
              >
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2b] text-left">
                      {['Collaborateur', 'Rôle', 'Spécialités', 'Commission', 'Statut', ''].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#a9a9a9]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]"
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[#f7f6f2]">{member.name}</span>
                          {member.phone && <div className="text-[11px] text-[#a9a9a9]">{member.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-[#a9a9a9]">{ROLE_LABELS[member.role]}</td>
                        <td className="px-4 py-3 text-xs text-[#a9a9a9]">
                          {member.specialties.length ? member.specialties.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#E5C378]">{member.commissionRate} %</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              member.isActive === false
                                ? 'bg-red-950/80 text-red-400'
                                : member.isAvailable
                                  ? 'bg-emerald-950/80 text-emerald-400'
                                  : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {member.isActive === false
                              ? 'Inactif'
                              : member.isAvailable
                                ? 'Disponible'
                                : 'Indisponible'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setScheduleFor(member)}
                              title="Horaires et absences"
                              aria-label={`Gérer les horaires de ${member.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-[#242429] hover:text-[#E5C378] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                            >
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(member)}
                              title="Modifier le collaborateur"
                              aria-label={`Modifier le collaborateur ${member.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-[#242429] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <ConfirmDelete onConfirm={() => deleteStaff(member.id)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {scheduleFor && <StaffSchedulePanel member={scheduleFor} onClose={() => setScheduleFor(null)} />}

      {isFormOpen && (
        <FormModal
          title={editing ? 'Modifier le collaborateur' : 'Nouveau collaborateur'}
          subtitle={activeSalon.name}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={editing ? 'Enregistrer' : 'Ajouter'}
        >
          <Field label="Nom complet" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Ibrahim Ouattara"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <Field label="Rôle">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#17171a]">
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Commission (%)">
              <input
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={form.commissionRate}
                onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Téléphone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+225 ..."
            />
          </Field>

          <Field label="Spécialités" hint="Séparez-les par une virgule">
            <input
              className={inputClass}
              value={form.specialties}
              onChange={(e) => setForm({ ...form, specialties: e.target.value })}
              placeholder="Dégradé américain, Barbe"
            />
          </Field>

          <Field label="Email" hint="Facultatif — distinct de l'identité de connexion">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="prenom@salon.ci"
            />
          </Field>

          <Field label="Prestations maîtrisées" hint="Seules celles-ci peuvent lui être affectées">
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-[#2a2a2b] p-2">
              {services
                .filter((s) => s.salonId === activeSalon.id && (s.isActive ?? true))
                .map((s) => (
                  <label
                    key={s.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-xs text-stone-300 hover:bg-[#202024]"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#C9A45C]"
                      checked={form.serviceIds.includes(s.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          serviceIds: e.target.checked
                            ? [...form.serviceIds, s.id]
                            : form.serviceIds.filter((id) => id !== s.id),
                        })
                      }
                    />
                    {s.name}
                  </label>
                ))}
              {services.filter((s) => s.salonId === activeSalon.id).length === 0 && (
                <span className="block px-2 py-2 text-[11px] text-stone-500">
                  Aucune prestation au catalogue.
                </span>
              )}
            </div>
          </Field>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#2a2a2b] px-3 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
              className="h-4 w-4 accent-[#C9A45C]"
            />
            Disponible pour les réservations
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#2a2a2b] px-3 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 accent-[#C9A45C]"
            />
            Profil actif (les profils inactifs ne sont jamais affectés)
          </label>
        </FormModal>
      )}
    </div>
  );
};
