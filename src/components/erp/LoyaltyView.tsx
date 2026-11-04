import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { Heart, Gift, Settings2, TrendingUp, TrendingDown, RefreshCw, Award } from 'lucide-react';

const TIER_LABEL: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', vip: 'VIP' };
const TIER_TONE: Record<string, string> = {
  bronze: 'border-stone-600 bg-stone-800 text-stone-300',
  silver: 'border-slate-400/40 bg-slate-800 text-slate-200',
  gold: 'border-[#C9A45C]/50 bg-[#2a2317] text-[#E5C378]',
  vip: 'border-purple-400/40 bg-purple-950 text-purple-200',
};

const KIND_LABEL: Record<string, string> = {
  earned_service: 'Prestation réglée',
  redeemed_reward: 'Récompense utilisée',
  welcome_bonus: 'Bonus de bienvenue',
  manual_adjustment: 'Ajustement manuel',
  reversal: 'Reprise (remboursement)',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export const LoyaltyView: React.FC = () => {
  const {
    activeSalon, clients, loyaltyRewards, loyaltyAccounts, loyaltyTransactions, loyaltySettings,
    updateLoyaltySettings, redeemRewardForClient, creditPointsToClient, refreshLoyalty,
  } = useApp();
  const { hasPermission } = useOptionalAuth();
  const canWrite = hasPermission('loyalty.write', activeSalon.id);

  const [pointsPer100, setPointsPer100] = useState<string>('');
  const [welcomeBonus, setWelcomeBonus] = useState<string>('');
  const [silver, setSilver] = useState<string>('');
  const [gold, setGold] = useState<string>('');
  const [vip, setVip] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [redeemFor, setRedeemFor] = useState<string | null>(null);
  const [rewardChoice, setRewardChoice] = useState('');
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const settings = loyaltySettings;
  const rewards = loyaltyRewards.filter((r) => r.salonId === activeSalon.id && r.isActive);
  const accounts = useMemo(() => loyaltyAccounts.filter((a) => a.salonId === activeSalon.id), [loyaltyAccounts, activeSalon.id]);
  const ledger = useMemo(() => loyaltyTransactions.filter((t) => t.salonId === activeSalon.id).slice(0, 40), [loyaltyTransactions, activeSalon.id]);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client';
  const totalPoints = accounts.reduce((sum, a) => sum + a.pointsBalance, 0);

  const value = (typed: string, fallback: number | undefined) => (typed === '' ? String(fallback ?? 0) : typed);

  const saveSettings = async () => {
    setSaving(true);
    await updateLoyaltySettings({
      programEnabled: settings?.programEnabled ?? true,
      pointsPer100Fcfa: Number(value(pointsPer100, settings?.pointsPer100Fcfa)),
      welcomeBonus: Number(value(welcomeBonus, settings?.welcomeBonus)),
      silverThreshold: Number(value(silver, settings?.silverThreshold)),
      goldThreshold: Number(value(gold, settings?.goldThreshold)),
      vipThreshold: Number(value(vip, settings?.vipThreshold)),
    });
    setPointsPer100(''); setWelcomeBonus(''); setSilver(''); setGold(''); setVip('');
    setSaving(false);
  };

  const toggleProgram = async () => {
    setSaving(true);
    await updateLoyaltySettings({ programEnabled: !(settings?.programEnabled ?? true) });
    setSaving(false);
  };

  const doRedeem = async (clientId: string) => {
    if (!rewardChoice) return;
    const result = await redeemRewardForClient(clientId, rewardChoice);
    if (result.success) { setRedeemFor(null); setRewardChoice(''); }
  };

  const doAdjust = async (clientId: string) => {
    const points = Number(adjustPoints);
    if (!Number.isInteger(points) || points === 0 || adjustReason.trim().length < 3) return;
    await creditPointsToClient(clientId, points, adjustReason.trim());
    setAdjustFor(null); setAdjustPoints(''); setAdjustReason('');
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-[#C9A45C]" />
          <div>
            <h1 className="text-xl font-bold text-white">Fidélité</h1>
            <p className="text-sm text-stone-400">
              Points attribués automatiquement sur prestation terminée <strong>et</strong> encaissée — {activeSalon.name}
            </p>
          </div>
        </div>
        <button onClick={() => void refreshLoyalty()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2b] bg-[#161619] px-3 py-2 text-xs font-semibold text-stone-300 hover:text-white">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-4">
          <p className="text-xs text-stone-400">Clients fidélisés</p>
          <p className="mt-1 text-2xl font-bold text-white">{accounts.length}</p>
        </div>
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-4">
          <p className="text-xs text-stone-400">Points en circulation</p>
          <p className="mt-1 text-2xl font-bold text-[#E5C378]">{totalPoints}</p>
        </div>
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-4">
          <p className="text-xs text-stone-400">Programme</p>
          <p className={`mt-1 text-2xl font-bold ${settings?.programEnabled === false ? 'text-stone-400' : 'text-emerald-300'}`}>
            {settings?.programEnabled === false ? 'Désactivé' : 'Actif'}
          </p>
        </div>
      </div>

      {canWrite && (
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Settings2 className="h-4 w-4" /> Règle d’attribution</h2>
            <button onClick={() => void toggleProgram()} disabled={saving}
              className="rounded-xl bg-[#232328] px-3 py-1.5 text-xs font-semibold text-stone-300 hover:text-white disabled:opacity-50">
              {settings?.programEnabled === false ? 'Activer le programme' : 'Désactiver'}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              { label: 'Points / 100 FCFA', val: pointsPer100, set: setPointsPer100, fallback: settings?.pointsPer100Fcfa },
              { label: 'Bonus bienvenue', val: welcomeBonus, set: setWelcomeBonus, fallback: settings?.welcomeBonus },
              { label: 'Seuil Argent', val: silver, set: setSilver, fallback: settings?.silverThreshold },
              { label: 'Seuil Or', val: gold, set: setGold, fallback: settings?.goldThreshold },
              { label: 'Seuil VIP', val: vip, set: setVip, fallback: settings?.vipThreshold },
            ].map((field) => (
              <label key={field.label} className="text-xs text-stone-400">
                {field.label}
                <input type="number" min={0} value={value(field.val, field.fallback)}
                  onChange={(e) => field.set(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#2d2d33] bg-[#121214] px-3 py-2 text-sm text-white" />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-stone-500">
              Exemple : une prestation de 4 000 FCFA à {settings?.pointsPer100Fcfa ?? 1} point(s)/100 FCFA crédite {40 * (settings?.pointsPer100Fcfa ?? 1)} points.
            </p>
            <button onClick={() => void saveSettings()} disabled={saving}
              className="rounded-xl bg-[#C9A45C] px-4 py-2 text-xs font-bold text-[#101010] hover:bg-[#d8b46c] disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Award className="h-4 w-4" /> Soldes clients</h2>
        {accounts.length === 0 ? (
          <p className="rounded-xl border border-[#27272c] bg-[#161619] p-5 text-sm text-stone-400">
            Aucun point attribué pour l’instant. Les points apparaissent dès qu’une prestation terminée est encaissée
            pour un client rattaché au CRM.
          </p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li key={account.clientId} className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{clientName(account.clientId)}</p>
                    <p className="text-[11px] text-stone-500">
                      {account.totalEarned} gagnés · {account.totalRedeemed} utilisés
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${TIER_TONE[account.tier]}`}>
                      {TIER_LABEL[account.tier]}
                    </span>
                    <span className="text-lg font-bold text-[#E5C378]">{account.pointsBalance} pts</span>
                    {canWrite && (
                      <>
                        <button onClick={() => { setRedeemFor(redeemFor === account.clientId ? null : account.clientId); setRewardChoice(''); }}
                          className="rounded-xl bg-[#232328] px-3 py-1.5 text-[11px] font-semibold text-stone-300 hover:text-white">
                          Récompense
                        </button>
                        <button onClick={() => { setAdjustFor(adjustFor === account.clientId ? null : account.clientId); setAdjustPoints(''); setAdjustReason(''); }}
                          className="rounded-xl bg-[#232328] px-3 py-1.5 text-[11px] font-semibold text-stone-300 hover:text-white">
                          Ajuster
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {redeemFor === account.clientId && (
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[#2d2d33] bg-[#111113] p-3">
                    <label className="flex-1 text-xs text-stone-400">
                      Récompense à consommer
                      <select value={rewardChoice} onChange={(e) => setRewardChoice(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#2d2d33] bg-[#121214] px-3 py-2 text-sm text-white">
                        <option value="">Choisir…</option>
                        {rewards.map((reward) => (
                          <option key={reward.id} value={reward.id} disabled={reward.pointsCost > account.pointsBalance}>
                            {reward.name} — {reward.pointsCost} pts{reward.pointsCost > account.pointsBalance ? ' (solde insuffisant)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button onClick={() => void doRedeem(account.clientId)} disabled={!rewardChoice}
                      className="rounded-xl bg-[#C9A45C] px-4 py-2 text-xs font-bold text-[#101010] disabled:opacity-50">
                      Valider
                    </button>
                  </div>
                )}

                {adjustFor === account.clientId && (
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[#2d2d33] bg-[#111113] p-3">
                    <label className="text-xs text-stone-400">
                      Points (+/-)
                      <input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)}
                        className="mt-1 w-28 rounded-lg border border-[#2d2d33] bg-[#121214] px-3 py-2 text-sm text-white" />
                    </label>
                    <label className="flex-1 text-xs text-stone-400">
                      Motif (obligatoire, tracé)
                      <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#2d2d33] bg-[#121214] px-3 py-2 text-sm text-white" />
                    </label>
                    <button onClick={() => void doAdjust(account.clientId)}
                      className="rounded-xl bg-[#C9A45C] px-4 py-2 text-xs font-bold text-[#101010]">
                      Appliquer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Gift className="h-4 w-4" /> Récompenses</h2>
        {rewards.length === 0 ? (
          <p className="rounded-xl border border-[#27272c] bg-[#161619] p-5 text-sm text-stone-400">
            Aucune récompense active. Créez-en depuis la gestion des récompenses pour permettre la consommation des points.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => (
              <li key={reward.id} className="rounded-xl border border-[#27272c] bg-[#161619] p-5">
                <h3 className="font-semibold text-white">{reward.name}</h3>
                <p className="mt-1 text-sm text-stone-400">{reward.description}</p>
                <p className="mt-3 text-xs text-[#C9A45C]">
                  {reward.pointsCost} points · utilisée {reward.timesRedeemed ?? 0} fois
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white">Journal des mouvements</h2>
        {ledger.length === 0 ? (
          <p className="rounded-xl border border-[#27272c] bg-[#161619] p-5 text-sm text-stone-400">Aucun mouvement enregistré.</p>
        ) : (
          <ul className="divide-y divide-[#222226] rounded-xl border border-[#27272c] bg-[#161619]">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{entry.clientName}</p>
                  <p className="truncate text-[11px] text-stone-500">
                    {KIND_LABEL[entry.type] ?? entry.type} · {entry.description} · {formatDate(entry.createdAt)}
                  </p>
                </div>
                <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${entry.points > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {entry.points > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {entry.points > 0 ? '+' : ''}{entry.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-stone-500">
        Journal en écriture seule côté base : aucun mouvement ne peut être modifié ou supprimé. Un remboursement
        reprend automatiquement les points de la prestation, sans jamais rendre un solde négatif.
      </p>
    </section>
  );
};
