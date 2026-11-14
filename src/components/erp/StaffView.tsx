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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <UserCog className="w-6 h-6 text-[#C9A45C]" />
            Équipe
          </h1>
          <p className="text-[#a9a9a9] mt-1">Collaborateurs et rôles</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Ajouter un collaborateur
        </button>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun collaborateur</p>
            <p className="text-sm mt-1">Ajoutez votre équipe</p>
          </div>
        ) : (
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
                      className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#a9a9a9] font-bold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => (
                  <tr key={member.id} className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#f7f6f2]">{member.name}</span>
                      {member.phone && <div className="text-[11px] text-[#a9a9a9]">{member.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-[#a9a9a9]">{ROLE_LABELS[member.role]}</td>
                    <td className="px-4 py-3 text-[#a9a9a9] text-xs">
                      {member.specialties.length ? member.specialties.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#E5C378] font-semibold">{member.commissionRate} %</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
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
                          onClick={() => setScheduleFor(member)}
                          title="Horaires et absences"
                          className="text-stone-400 hover:text-[#C9A45C] p-1 rounded cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(member)}
                          title="Modifier"
                          className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <ConfirmDelete onConfirm={() => deleteStaff(member.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto rounded-lg border border-[#2a2a2b] p-2">
              {services
                .filter((s) => s.salonId === activeSalon.id && (s.isActive ?? true))
                .map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#C9A45C]"
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
                <span className="text-[11px] text-stone-500">Aucune prestation au catalogue.</span>
              )}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
              className="accent-[#C9A45C]"
            />
            Disponible pour les réservations
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-[#C9A45C]"
            />
            Profil actif (les profils inactifs ne sont jamais affectés)
          </label>
        </FormModal>
      )}
    </div>
  );
};
