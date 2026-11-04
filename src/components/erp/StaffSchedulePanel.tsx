import React, { useCallback, useEffect, useState } from 'react';
import { Clock, CalendarOff, Trash2, Plus } from 'lucide-react';
import { salonApi, ApiError } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { inputClass } from './FormModal';
import type { StaffMember } from '../../types';

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface Schedule {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

interface Absence {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}

/**
 * Horaires et absences d'un collaborateur (Lot 3, section 3.2 / 3.4).
 * Chargées à la demande depuis l'API : ce sont elles qui déterminent la
 * disponibilité réelle calculée côté serveur.
 */
export const StaffSchedulePanel: React.FC<{ member: StaffMember; onClose: () => void }> = ({
  member,
  onClose,
}) => {
  const { activeSalon, addToast } = useApp();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState({ weekday: '', startsAt: '', endsAt: '' });
  const [absence, setAbsence] = useState({ startsOn: '', endsOn: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = salonApi(activeSalon.id);
      const [s, a] = await Promise.all([api.staff.schedule(member.id), api.staff.absences(member.id)]);
      setSchedules(s as Schedule[]);
      setAbsences(a as Absence[]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [activeSalon.id, member.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift.weekday || !shift.startsAt || !shift.endsAt) {
      addToast('Renseignez le jour et les deux horaires.', 'error');
      return;
    }
    try {
      const api = salonApi(activeSalon.id);
      await api.staff.addSchedule(member.id, {
        weekday: Number(shift.weekday),
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      });
      await load();
      addToast('Plage horaire enregistrée.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Enregistrement impossible.', 'error');
    }
  };

  const addAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const api = salonApi(activeSalon.id);
      await api.staff.addAbsence(member.id, {
        startsOn: absence.startsOn,
        endsOn: absence.endsOn || absence.startsOn,
        reason: absence.reason,
      });
      setAbsence({ startsOn: '', endsOn: '', reason: '' });
      await load();
      addToast('Absence enregistrée.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Enregistrement impossible.', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Horaires de ${member.name}`}
    >
      <div className="w-full max-w-lg bg-[#161619] border border-[#2b2b30] rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#f7f6f2]">Horaires & absences</h2>
            <p className="text-xs text-[#a9a9a9]">{member.name}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-sm cursor-pointer">
            Fermer
          </button>
        </div>

        {loading && <p className="text-xs text-[#a9a9a9]">Chargement…</p>}
        {error && (
          <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#a9a9a9] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Plages hebdomadaires
              </h3>
              <p className="text-[11px] text-stone-500">
                Sans plage définie, aucune contrainte horaire n'est appliquée à cet employé.
              </p>
              <ul className="space-y-1">
                {schedules.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-xs bg-[#0f0f11] border border-[#26262a] rounded-lg px-3 py-2"
                  >
                    <span className="text-stone-300">
                      {WEEKDAYS[s.weekday]} · {s.startsAt} – {s.endsAt}
                    </span>
                    <button
                      onClick={() => void salonApi(activeSalon.id).staff.removeSchedule(s.id).then(load)}
                      title="Supprimer cette plage"
                      className="text-stone-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
                {schedules.length === 0 && (
                  <li className="text-[11px] text-stone-500">Aucune plage définie.</li>
                )}
              </ul>
              <form onSubmit={addShift} className="flex flex-wrap items-end gap-2 pt-1">
                <select
                  aria-label="Jour"
                  className={inputClass}
                  value={shift.weekday}
                  onChange={(e) => setShift({ ...shift, weekday: e.target.value })}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  aria-label="Début"
                  className={inputClass}
                  value={shift.startsAt}
                  onChange={(e) => setShift({ ...shift, startsAt: e.target.value })}
                />
                <input
                  type="time"
                  aria-label="Fin"
                  className={inputClass}
                  value={shift.endsAt}
                  onChange={(e) => setShift({ ...shift, endsAt: e.target.value })}
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-2 bg-[#C9A45C] text-[#101010] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              </form>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#a9a9a9] flex items-center gap-2">
                <CalendarOff className="w-3.5 h-3.5" /> Absences
              </h3>
              <ul className="space-y-1">
                {absences.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between text-xs bg-[#0f0f11] border border-[#26262a] rounded-lg px-3 py-2"
                  >
                    <span className="text-stone-300">
                      {a.startsOn}
                      {a.endsOn !== a.startsOn ? ` → ${a.endsOn}` : ''}
                      {a.reason ? ` · ${a.reason}` : ''}
                    </span>
                    <button
                      onClick={() => void salonApi(activeSalon.id).staff.removeAbsence(a.id).then(load)}
                      title="Supprimer cette absence"
                      className="text-stone-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
                {absences.length === 0 && (
                  <li className="text-[11px] text-stone-500">Aucune absence enregistrée.</li>
                )}
              </ul>
              <form onSubmit={addAbsence} className="flex flex-wrap items-end gap-2 pt-1">
                <input
                  type="date"
                  required
                  aria-label="Début de l'absence"
                  className={inputClass}
                  value={absence.startsOn}
                  onChange={(e) => setAbsence({ ...absence, startsOn: e.target.value })}
                />
                <input
                  type="date"
                  aria-label="Fin de l'absence"
                  className={inputClass}
                  value={absence.endsOn}
                  onChange={(e) => setAbsence({ ...absence, endsOn: e.target.value })}
                />
                <input
                  aria-label="Motif"
                  placeholder="Motif"
                  className={inputClass}
                  value={absence.reason}
                  onChange={(e) => setAbsence({ ...absence, reason: e.target.value })}
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-2 bg-[#C9A45C] text-[#101010] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
