import React, { useEffect, useMemo, useState } from 'react';
import type { PlatformAuditEntry } from '../../lib/superadmin';
import {
  grantPlatformAdmin,
  listPlatformAdmins,
  listPlatformAuditActions,
  revokePlatformAdmin,
  searchPlatformAuditLogs,
  type PlatformAdminRow,
} from '../../lib/platform-admin';
import { useOptionalApp } from '../../context/AppContext';

interface PlatformAdminsPanelProps {
  currentUserId: string;
  onRefresh: () => void | Promise<void>;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Export CSV des entrées affichées (téléchargement local, aucune donnée n'est conservée dans le navigateur). */
function downloadAuditCsv(entries: PlatformAuditEntry[]): void {
  const header = ['Horodatage', 'Action', 'Type de cible', 'Cible', 'Motif', 'Opérateur'];
  const rows = entries.map((e) => [
    e.createdAt,
    e.action,
    e.targetType,
    e.targetId,
    typeof e.details.reason === 'string' ? e.details.reason : '',
    e.actorEmail ?? 'Système',
  ]);
  const csv = [header, ...rows].map((row) => row.map((c) => csvCell(String(c))).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Gestion des administrateurs et journal d'audit filtrable (lecture serveur, export CSV).
 * Le rôle super administrateur n'est jamais attribuable ici : il est réservé à l'adresse autorisée côté serveur.
 */
export const PlatformAdminsPanel: React.FC<PlatformAdminsPanelProps> = ({ currentUserId, onRefresh }) => {
  const { addToast } = useOptionalApp();
  const [admins, setAdmins] = useState<PlatformAdminRow[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [journal, setJournal] = useState<PlatformAuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [since, setSince] = useState('');
  const [text, setText] = useState('');
  const [journalError, setJournalError] = useState<string | null>(null);

  const reloadAdmins = async () => {
    try {
      setAdmins(await listPlatformAdmins());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture des administrateurs impossible.');
    }
  };

  const reloadJournal = async () => {
    try {
      setJournal(
        await searchPlatformAuditLogs({
          action: actionFilter || null,
          since: since ? new Date(since).toISOString() : null,
          limit: 500,
        }),
      );
      setJournalError(null);
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : 'Lecture du journal impossible.');
    }
  };

  useEffect(() => {
    void reloadAdmins();
    listPlatformAuditActions()
      .then(setActions)
      .catch(() => setActions([]));
  }, []);

  useEffect(() => {
    void reloadJournal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, since]);

  const visibleJournal = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return journal;
    return journal.filter((e) =>
      [
        e.action,
        e.targetType,
        e.targetId,
        e.actorEmail ?? '',
        typeof e.details.reason === 'string' ? e.details.reason : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [journal, text]);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await grantPlatformAdmin(email.trim(), 'support_lead');
      setEmail('');
      addToast('Accès administrateur accordé.', 'success');
      await reloadAdmins();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attribution impossible.');
    }
  };

  const revoke = async (admin: PlatformAdminRow) => {
    if (!window.confirm(`Retirer l’accès administrateur de ${admin.email ?? 'ce compte'} ?`)) return;
    try {
      await revokePlatformAdmin(admin.user_id);
      addToast('Accès administrateur retiré.', 'info');
      await reloadAdmins();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retrait impossible.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-[#1f1f27]">
        <h2 className="text-xl font-black text-white">Administrateurs & journal d’audit</h2>
        <p className="text-xs text-stone-400 mt-1">
          Les rôles de support n’ont pas encore de droits distincts : seul le super administrateur accède aux
          opérations de la console.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">Accès administrateur</h3>
        <ul className="divide-y divide-[#15151c] rounded-2xl border border-[#1f1f27]">
          {admins.map((admin) => (
            <li
              key={admin.user_id}
              className="flex items-center justify-between px-4 py-3 text-xs text-stone-300"
            >
              <span>
                <span className="font-semibold text-white">{admin.email ?? 'Compte inconnu'}</span>
                <span className="ml-2 text-stone-500">({admin.role})</span>
              </span>
              {admin.user_id !== currentUserId && admin.role !== 'super_admin' && (
                <button
                  type="button"
                  onClick={() => void revoke(admin)}
                  className="px-2.5 py-1 rounded-lg bg-red-950/40 text-red-300 border border-red-800/40 font-semibold"
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={grant} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse e-mail d’un compte existant"
            className="flex-1 bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#C9A45C] text-[#101010] text-xs font-bold"
          >
            Ajouter comme support
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <h3 className="text-sm font-bold text-white flex-1">Journal d’audit</h3>
          <label className="text-[11px] text-stone-400 space-y-1">
            <span className="block">Action</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-[#181820] border border-[#2d2d38] rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="">Toutes</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-stone-400 space-y-1">
            <span className="block">Depuis le</span>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="bg-[#181820] border border-[#2d2d38] rounded-xl px-3 py-2 text-xs text-white"
            />
          </label>
          <label className="text-[11px] text-stone-400 space-y-1">
            <span className="block">Recherche</span>
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Salon, e-mail, motif…"
              className="bg-[#181820] border border-[#2d2d38] rounded-xl px-3 py-2 text-xs text-white"
            />
          </label>
          <button
            type="button"
            disabled={visibleJournal.length === 0}
            onClick={() => downloadAuditCsv(visibleJournal)}
            className="px-3 py-2 rounded-xl bg-[#1a1a22] hover:bg-[#242430] text-stone-200 text-xs font-semibold disabled:opacity-40"
          >
            Exporter CSV
          </button>
        </div>

        {journalError && (
          <p role="alert" className="text-xs text-red-300">
            {journalError}
          </p>
        )}

        {visibleJournal.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune décision ne correspond aux filtres.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#1f1f27]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a0a0d] text-stone-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Horodatage</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Cible</th>
                  <th className="py-2.5 px-4">Motif</th>
                  <th className="py-2.5 px-4">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#15151c] text-stone-300">
                {visibleJournal.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 text-stone-500">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-4 text-white">{log.action}</td>
                    <td className="py-2.5 px-4 text-[#E5C378]">{log.targetType}</td>
                    <td className="py-2.5 px-4">
                      {typeof log.details.reason === 'string' ? log.details.reason : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-stone-400">{log.actorEmail ?? 'Système'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-stone-500">
          500 entrées au maximum par consultation. Les filtres d’action et de date sont appliqués par la base.
        </p>
      </section>
    </div>
  );
};
