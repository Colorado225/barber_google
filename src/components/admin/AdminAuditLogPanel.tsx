import React, { useMemo, useState } from 'react';
import { FileText, RotateCcw, Search } from 'lucide-react';
import type { AuditLogEntry } from '../../lib/superadmin';

interface AdminAuditLogPanelProps {
  logs: AuditLogEntry[];
  onRefresh: () => Promise<void> | void;
}

function formatValuesSummary(values: Record<string, unknown> | null): string {
  if (!values || Object.keys(values).length === 0) return '—';
  return Object.entries(values)
    .map(([k, v]) => `${k}: ${v === null || v === undefined ? 'null' : JSON.stringify(v)}`)
    .join(', ');
}

export const AdminAuditLogPanel: React.FC<AdminAuditLogPanelProps> = ({ logs, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<string>('all');

  const targetTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.targetType) set.add(l.targetType);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      if (targetFilter !== 'all' && entry.targetType !== targetFilter) return false;
      if (!q) return true;
      const salonName =
        typeof entry.details?.salon_name === 'string' ? entry.details.salon_name.toLowerCase() : '';
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.targetId.toLowerCase().includes(q) ||
        entry.targetType.toLowerCase().includes(q) ||
        (entry.reason && entry.reason.toLowerCase().includes(q)) ||
        (entry.actorEmail && entry.actorEmail.toLowerCase().includes(q)) ||
        salonName.includes(q)
      );
    });
  }, [logs, targetFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f1f27]">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#C9A45C] flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            TRAÇABILITÉ SERVEUR · SUPERADMIN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">Journal d’Audit de la Plateforme</h2>
          <p className="text-xs text-stone-400 mt-1">
            Historique immuable enregistré côté serveur : acteur, date, cible, valeurs avant/après et motif.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          className="px-3.5 py-2 rounded-xl bg-[#17171d] hover:bg-[#22222a] border border-[#2c2c36] text-xs font-bold text-stone-300 hover:text-white flex items-center gap-2 self-start sm:self-auto transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Actualiser le journal</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par action, cible, acteur ou motif..."
            className="w-full bg-[#18181f] border border-[#2b2b36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C]"
          />
        </div>

        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="bg-[#18181f] border border-[#2b2b36] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
        >
          <option value="all">Toutes cibles ({logs.length})</option>
          {targetTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#121216] border border-[#22222a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#16161c] border-b border-[#22222a] text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-4">Acteur</th>
                <th className="py-3 px-4">Action & Cible</th>
                <th className="py-3 px-4">Avant → Après</th>
                <th className="py-3 px-4">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1d1d26]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-stone-400">
                    Aucune entrée d’audit enregistrée.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const targetName =
                    typeof log.details?.salon_name === 'string' ? log.details.salon_name : null;
                  return (
                    <tr key={log.id} className="hover:bg-[#17171e] align-top">
                      <td className="py-3 px-4 text-stone-400 font-mono text-[11px] whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="py-3 px-4 text-stone-300">
                        <div className="font-semibold text-white">
                          {log.actorEmail || log.actorUserId?.slice(0, 8) || 'Système'}
                        </div>
                        {log.actorRole && (
                          <div className="text-[10px] text-[#C9A45C] uppercase font-bold">
                            {log.actorRole}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{log.action}</div>
                        <div className="text-[11px] text-[#E5C378]">
                          {log.targetType} · {targetName || log.targetId}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[11px] font-mono text-stone-300 space-y-1 max-w-md">
                        <div className="text-stone-400">
                          <span className="text-stone-500">Avant :</span>{' '}
                          {formatValuesSummary(log.beforeValues)}
                        </div>
                        <div className="text-emerald-300">
                          <span className="text-stone-500">Après :</span>{' '}
                          {formatValuesSummary(log.afterValues)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-stone-200 max-w-xs">{log.reason || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
