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
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Horaires de ${member.name}`}
    >
      <div className="max-h-[calc(100dvh-0.75rem)] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-2xl border border-[#2b2b30] bg-[#161619] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#f7f6f2]">Horaires & absences</h2>
            <p className="text-xs text-[#a9a9a9]">{member.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les horaires"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm text-stone-400 transition-colors hover:bg-[#232328] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
          >
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
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#26262a] bg-[#0f0f11] px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 break-words text-stone-300">
                      {WEEKDAYS[s.weekday]} · {s.startsAt} – {s.endsAt}
                    </span>
                    <button
                      type="button"
                      onClick={() => void salonApi(activeSalon.id).staff.removeSchedule(s.id).then(load)}
                      title="Supprimer cette plage"
                      aria-label={`Supprimer la plage ${WEEKDAYS[s.weekday]} ${s.startsAt} à ${s.endsAt}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-red-950/40 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {schedules.length === 0 && (
                  <li className="text-[11px] text-stone-500">Aucune plage définie.</li>
                )}
              </ul>
              <form onSubmit={addShift} className="grid grid-cols-1 gap-2 pt-1 min-[480px]:grid-cols-2">
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
                  className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-[#C9A45C] px-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter
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
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#26262a] bg-[#0f0f11] px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 break-words text-stone-300">
                      {a.startsOn}
                      {a.endsOn !== a.startsOn ? ` → ${a.endsOn}` : ''}
                      {a.reason ? ` · ${a.reason}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => void salonApi(activeSalon.id).staff.removeAbsence(a.id).then(load)}
                      title="Supprimer cette absence"
                      aria-label={`Supprimer l'absence du ${a.startsOn}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-red-950/40 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {absences.length === 0 && (
                  <li className="text-[11px] text-stone-500">Aucune absence enregistrée.</li>
                )}
              </ul>
              <form onSubmit={addAbsence} className="grid grid-cols-1 gap-2 pt-1 min-[480px]:grid-cols-2">
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
                  className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-[#C9A45C] px-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
