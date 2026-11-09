import React, { useEffect, useState } from 'react';
import type { PlatformAuditEntry } from '../../lib/superadmin';
import {
  grantPlatformAdmin,
  listPlatformAdmins,
  revokePlatformAdmin,
  type PlatformAdminRow,
} from '../../lib/platform-admin';
import { useOptionalApp } from '../../context/AppContext';

interface PlatformAdminsPanelProps {
  currentUserId: string;
  auditLogs: PlatformAuditEntry[];
  onRefresh: () => void | Promise<void>;
}

/**
 * Gestion des administrateurs de la plateforme et journal d'audit (lecture seule).
 * Le rôle super administrateur n'est jamais attribuable ici : il est réservé à l'adresse autorisée côté serveur.
 */
export const PlatformAdminsPanel: React.FC<PlatformAdminsPanelProps> = ({
  currentUserId,
  auditLogs,
  onRefresh,
}) => {
  const { addToast } = useOptionalApp();
  const [admins, setAdmins] = useState<PlatformAdminRow[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setAdmins(await listPlatformAdmins());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture des administrateurs impossible.');
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await grantPlatformAdmin(email.trim(), 'support_lead');
      setEmail('');
      addToast('Accès administrateur accordé.', 'success');
      await reload();
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
      await reload();
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
        <h3 className="text-sm font-bold text-white">Journal d’audit (100 dernières entrées)</h3>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune décision enregistrée.</p>
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
                {auditLogs.map((log) => (
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
      </section>
    </div>
  );
};
