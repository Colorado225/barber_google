import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod } from '../../types';
import {
  Wallet,
  Smartphone,
  Banknote,
  Receipt,
  Plus,
  Lock,
  Unlock,
  Printer,
  CheckCircle2,
  TrendingDown,
  Clock,
  Search
} from 'lucide-react';

interface CashRegisterViewProps {
  onOpenNewPayment: () => void;
}

export const CashRegisterView: React.FC<CashRegisterViewProps> = ({ onOpenNewPayment }) => {
  const {
    activeSalon,
    cashSession,
    transactions,
    services,
    formatPrice,
    recordPayment,
    closeCurrentCashSession,
    openNewCashSession
  } = useApp();

  const salonTransactions = transactions.filter((t) => t.salonId === activeSalon.id);
  const salonServices = services.filter((s) => s.salonId === activeSalon.id);

  // Quick POS cart
  const [quickClientName, setQuickClientName] = useState('');
  const [quickAmount, setQuickAmount] = useState<number>(3000);
  const [quickMethod, setQuickMethod] = useState<PaymentMethod>('wave');
  const [quickItemLabel, setQuickItemLabel] = useState('Coupe classique');

  // Cash Session close modal
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [actualCashCounted, setActualCashCounted] = useState<number>(cashSession.theoreticalBalance);
  const [closeNotes, setCloseNotes] = useState('');

  // Re-open modal
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [newOpeningBalance, setNewOpeningBalance] = useState<number>(25000);

  const handleQuickCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientName.trim() || quickAmount <= 0) {
      alert('Veuillez renseigner le nom du client.');
      return;
    }

    recordPayment({
      clientName: `${quickClientName.trim()} (${quickItemLabel})`,
      amount: quickAmount,
      method: quickMethod,
      type: 'full'
    });

    setQuickClientName('');
  };

  const handleCloseSession = (e: React.FormEvent) => {
    e.preventDefault();
    closeCurrentCashSession(actualCashCounted, closeNotes);
    setIsClosingSession(false);
  };

  const handleOpenSession = (e: React.FormEvent) => {
    e.preventDefault();
    openNewCashSession(newOpeningBalance);
    setIsOpeningSession(false);
  };

  const methodColors: Record<PaymentMethod, { label: string; badge: string }> = {
    wave: { label: 'Wave', badge: 'bg-cyan-950 text-cyan-300 border-cyan-800/40' },
    orange_money: { label: 'Orange Money', badge: 'bg-orange-950 text-orange-300 border-orange-800/40' },
    mtn_momo: { label: 'MTN MoMo', badge: 'bg-yellow-950 text-yellow-300 border-yellow-800/40' },
    moov_money: { label: 'Moov Money', badge: 'bg-blue-950 text-blue-300 border-blue-800/40' },
    cash: { label: 'Espèces', badge: 'bg-emerald-950 text-emerald-300 border-emerald-800/40' },
    card: { label: 'Carte Bancaire', badge: 'bg-purple-950 text-purple-300 border-purple-800/40' }
  };

  return (
    <div className="space-y-6">
      {/* Session Status Banner */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
              cashSession.status === 'open'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            }`}
          >
            {cashSession.status === 'open' ? (
              <Unlock className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                Caisse {cashSession.status === 'open' ? 'Ouverte' : 'Clôturée'}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  cashSession.status === 'open'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                    : 'bg-stone-800 text-stone-400'
                }`}
              >
                {cashSession.status === 'open' ? 'En cours' : 'Fermée'}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Ouverture le {new Date(cashSession.openedAt).toLocaleDateString('fr-FR')} à{' '}
              {new Date(cashSession.openedAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          {cashSession.status === 'open' ? (
            <button
              onClick={() => {
                setActualCashCounted(cashSession.theoreticalBalance);
                setIsClosingSession(true);
              }}
              className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 text-xs font-bold transition-colors cursor-pointer"
            >
              Clôturer la journée
            </button>
          ) : (
            <button
              onClick={() => setIsOpeningSession(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Ouvrir nouvelle session
            </button>
          )}

          <button
            onClick={onOpenNewPayment}
            className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Encaisser client</span>
          </button>
        </div>
      </div>

      {/* Financial Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Fond de caisse initial</span>
          <div className="text-xl font-bold text-white mt-1">
            {formatPrice(cashSession.openingBalance)}
          </div>
          <span className="text-[11px] text-stone-500">Espèces au départ</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Entrées Espèces</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            +{formatPrice(cashSession.totalCashIn)}
          </div>
          <span className="text-[11px] text-stone-500">Paiements comptoir</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Mobile Money (Wave/OM)</span>
          <div className="text-xl font-bold text-cyan-400 mt-1">
            +{formatPrice(cashSession.totalMobileMoneyIn)}
          </div>
          <span className="text-[11px] text-stone-500">Direct compte bancaire/MM</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Solde Espèces Théorique</span>
          <div className="text-xl font-extrabold text-[#E5C378] mt-1">
            {formatPrice(cashSession.theoreticalBalance)}
          </div>
          <span className="text-[11px] text-stone-500">Attendu dans le tiroir-caisse</span>
        </div>
      </div>

      {/* POS Quick Terminal & Ledger Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Quick Cash Terminal (4 cols) */}
        <div className="lg:col-span-4 bg-[#161619] border border-[#27272c] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#242428] pb-3">
            <Receipt className="w-4 h-4 text-[#C9A45C]" />
            <h3 className="font-bold text-white text-sm">Terminal d'Encaissement Rapide</h3>
          </div>

          <form onSubmit={handleQuickCheckout} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                Client comptoir *
              </label>
              <input
                type="text"
                required
                value={quickClientName}
                onChange={(e) => setQuickClientName(e.target.value)}
                placeholder="Ex: Client sans RDV"
                className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                Prestations & Articles fréquents
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {salonServices.map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      setQuickItemLabel(srv.name);
                      setQuickAmount(srv.price);
                    }}
                    className={`p-2 rounded-lg border text-left text-[11px] truncate transition-colors ${
                      quickItemLabel === srv.name
                        ? 'bg-[#C9A45C]/20 border-[#C9A45C] text-[#E5C378] font-bold'
                        : 'bg-[#121214] border-[#242428] text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    <div>{srv.name}</div>
                    <div className="text-stone-400 font-mono text-[10px]">{formatPrice(srv.price)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                Montant total à encaisser (FCFA) *
              </label>
              <input
                type="number"
                required
                min="500"
                step="500"
                value={quickAmount}
                onChange={(e) => setQuickAmount(Number(e.target.value))}
                className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-base font-extrabold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                Mode de paiement
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'wave', label: 'Wave' },
                  { id: 'orange_money', label: 'Orange Money' },
                  { id: 'cash', label: 'Espèces' },
                  { id: 'mtn_momo', label: 'MTN MoMo' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setQuickMethod(m.id as PaymentMethod)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      quickMethod === m.id
                        ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                        : 'bg-[#111113] border-[#26262a] text-stone-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider l'encaissement</span>
            </button>
          </form>
        </div>

        {/* RIGHT: Transaction Ledger Table (8 cols) */}
        <div className="lg:col-span-8 bg-[#161619] border border-[#27272c] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#242428] pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#C9A45C]" />
              <h3 className="font-bold text-white text-sm">
                Journal des Paiements & Transactions ({salonTransactions.length})
              </h3>
            </div>
            <span className="text-xs text-stone-400 font-mono">Immuable & Auditable</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-3">Réf.</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Montant</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Date / Heure</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {salonTransactions.map((tx) => {
                  const methodBadge = methodColors[tx.method] || {
                    label: tx.method,
                    badge: 'bg-stone-800'
                  };
                  return (
                    <tr key={tx.id} className="hover:bg-[#1a1a1e] transition-colors">
                      <td className="p-3 font-mono font-bold text-[#C9A45C]">
                        #{tx.reference}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {tx.clientName}
                      </td>
                      <td className="p-3 font-extrabold text-[#E5C378]">
                        {formatPrice(tx.amount)}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${methodBadge.badge}`}>
                          {methodBadge.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-stone-400">
                        {tx.date} {tx.time}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => window.print()}
                          className="text-stone-400 hover:text-white p-1 rounded hover:bg-[#26262b] transition-colors"
                          title="Imprimer ticket"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CLOSE CASH SESSION MODAL */}
      {isClosingSession && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              <span>Clôture de Caisse Journalière</span>
            </h3>

            <div className="bg-[#111113] p-4 rounded-xl border border-[#25252a] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-400">Solde théorique attendu :</span>
                <span className="font-bold text-[#E5C378]">{formatPrice(cashSession.theoreticalBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Total Mobile Money encaissé :</span>
                <span className="font-bold text-cyan-400">{formatPrice(cashSession.totalMobileMoneyIn)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Espèces physiques comptées dans le tiroir (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(Number(e.target.value))}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-base font-bold text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              {/* Écart de caisse */}
              <div className="p-3 rounded-xl bg-[#141417] border border-[#28282d] text-xs flex justify-between items-center">
                <span className="text-stone-400">Écart de caisse :</span>
                <span
                  className={`font-bold ${
                    actualCashCounted - cashSession.theoreticalBalance === 0
                      ? 'text-emerald-400'
                      : actualCashCounted - cashSession.theoreticalBalance > 0
                      ? 'text-cyan-400'
                      : 'text-red-400'
                  }`}
                >
                  {actualCashCounted - cashSession.theoreticalBalance === 0
                    ? 'Aucun écart (0 FCFA)'
                    : formatPrice(actualCashCounted - cashSession.theoreticalBalance)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Notes de clôture
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ex: RAS, coffre verrouillé"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClosingSession(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232328] hover:bg-[#2b2b30] text-stone-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  Valider la clôture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPEN CASH SESSION MODAL */}
      {isOpeningSession && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-400" />
              <span>Ouvrir une nouvelle session de caisse</span>
            </h3>

            <form onSubmit={handleOpenSession} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Fond de caisse initial (Espèces dans le tiroir en FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(Number(e.target.value))}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-base font-bold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpeningSession(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232328] hover:bg-[#2b2b30] text-stone-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Ouvrir la caisse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
