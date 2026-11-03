import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StaffMember, StaffRole } from '../../types';
import {
  Users,
  Plus,
  Star,
  Phone,
  Scissors,
  CheckCircle,
  X,
  Edit,
  DollarSign,
  TrendingUp
} from 'lucide-react';

export const StaffView: React.FC = () => {
  const { activeSalon, staff, appointments, formatPrice, addStaff, updateStaff, deleteStaff } = useApp();

  const salonStaff = staff.filter((s) => s.salonId === activeSalon.id);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('barber');
  const [phone, setPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(30);
  const [specialtiesText, setSpecialtiesText] = useState('Dégradés, Barbe sculptée');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80');

  const handleOpenAdd = () => {
    setEditingStaffId(null);
    setName('');
    setRole('barber');
    setPhone('');
    setCommissionRate(30);
    setSpecialtiesText('Dégradés, Barbe sculptée');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: StaffMember) => {
    setEditingStaffId(st.id);
    setName(st.name);
    setRole(st.role);
    setPhone(st.phone);
    setCommissionRate(st.commissionRate);
    setSpecialtiesText(st.specialties.join(', '));
    setAvatar(st.avatar);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Veuillez renseigner le nom et le numéro de téléphone.');
      return;
    }

    const specialties = specialtiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingStaffId) {
      updateStaff(editingStaffId, {
        name: name.trim(),
        role,
        phone: phone.trim(),
        commissionRate: Number(commissionRate),
        specialties,
        avatar
      });
    } else {
      addStaff({
        salonId: activeSalon.id,
        name: name.trim(),
        role,
        phone: phone.trim(),
        commissionRate: Number(commissionRate),
        specialties,
        avatar,
        rating: 5.0,
        isAvailable: true
      });
    }

    setIsModalOpen(false);
  };

  const roleLabels: Record<StaffRole, string> = {
    master_barber: 'Master Barbier',
    barber: 'Barbier Confirmé',
    colorist: 'Coloriste & Soins',
    stylist: 'Coiffeur Styliste',
    manager: 'Responsable Salon'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161619] border border-[#27272c] rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#C9A45C]" />
            <span>Gestion de l'Équipe & Commissions</span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Gérez les barbiers, leurs plannings, spécialités et calcul automatique des commissions.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Ajouter un collaborateur</span>
        </button>
      </div>

      {/* Staff Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {salonStaff.map((member) => {
          // Calculate performance from completed appointments
          const staffApts = appointments.filter(
            (a) => a.staffId === member.id && a.salonId === activeSalon.id && a.status === 'completed'
          );
          const totalStaffRevenue = staffApts.reduce((acc, a) => acc + a.price, 0);
          const commissionEarned = Math.round((totalStaffRevenue * member.commissionRate) / 100);

          return (
            <div
              key={member.id}
              className="bg-[#161619] border border-[#27272c] hover:border-stone-500 rounded-2xl p-5 flex flex-col justify-between transition-colors shadow-sm"
            >
              <div className="space-y-4">
                {/* Profile Header */}
                <div className="flex items-center gap-3.5">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#C9A45C]/40"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-white text-base">{member.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{member.rating}</span>
                      </div>
                    </div>
                    <span className="text-xs text-[#C9A45C] font-medium block">
                      {roleLabels[member.role] || member.role}
                    </span>
                    <span className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-stone-500" />
                      <span>{member.phone}</span>
                    </span>
                  </div>
                </div>

                {/* Performance stats box */}
                <div className="p-3.5 rounded-xl bg-[#111113] border border-[#242428] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Prestations terminées :</span>
                    <span className="font-bold text-white">{staffApts.length} coupes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">CA Réalisé :</span>
                    <span className="font-bold text-white">{formatPrice(totalStaffRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Taux commission :</span>
                    <span className="font-semibold text-stone-300">{member.commissionRate}%</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#232328]">
                    <span className="text-emerald-400 font-bold">Commission à verser :</span>
                    <span className="font-extrabold text-[#E5C378]">
                      {formatPrice(commissionEarned)}
                    </span>
                  </div>
                </div>

                {/* Specialties */}
                <div>
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                    Spécialités
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.specialties.map((spec, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-[#222226] text-stone-300 px-2 py-0.5 rounded-md border border-[#2a2a2e]"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-[#232328] mt-4 flex items-center justify-between">
                <button
                  onClick={() => updateStaff(member.id, { isAvailable: !member.isAvailable })}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                    member.isAvailable
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}
                >
                  {member.isAvailable ? '● En service' : '○ En repos'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(member)}
                    className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Retirer ${member.name} de l'équipe ?`)) {
                        deleteStaff(member.id);
                      }
                    }}
                    className="text-xs text-stone-500 hover:text-red-400 ml-1"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD / EDIT STAFF MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingStaffId ? 'Modifier le collaborateur' : 'Nouveau collaborateur'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nom & Prénom *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ibrahim Touré"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffRole)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="master_barber">Master Barbier</option>
                    <option value="barber">Barbier</option>
                    <option value="colorist">Coloriste</option>
                    <option value="stylist">Styliste</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Commission (%)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-[#E5C378] font-bold focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Téléphone *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07 00 00 00 00"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Spécialités (séparées par une virgule)
                </label>
                <input
                  type="text"
                  value={specialtiesText}
                  onChange={(e) => setSpecialtiesText(e.target.value)}
                  placeholder="Ex: Dégradé laser, Rasage à l'ancienne, Coloration"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {editingStaffId ? 'Enregistrer les modifications' : 'Ajouter à l\'équipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
