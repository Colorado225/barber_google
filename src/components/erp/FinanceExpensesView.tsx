import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory } from '../../types';
import { paymentSignedAmount } from '../../lib/analytics';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  PieChart,
  X
} from 'lucide-react';

export const FinanceExpensesView: React.FC = () => {
  const {
    activeSalon,
    expenses,
    transactions,
    formatPrice,
    addExpense,
    deleteExpense
  } = useApp();

  const salonExpenses = useMemo(
    () => expenses.filter((e) => e.salonId === activeSalon.id),
    [expenses, activeSalon.id]
  );

  const salonTransactions = useMemo(
    () => transactions.filter((t) => t.salonId === activeSalon.id && t.status === 'completed'),
    [transactions, activeSalon.id]
  );

  const totalRevenue = useMemo(
    () => salonTransactions.reduce((acc, t) => acc + paymentSignedAmount(t), 0),
    [salonTransactions]
  );

  const totalExpenses = useMemo(
    () => salonExpenses.reduce((acc, e) => acc + e.amount, 0),
    [salonExpenses]
  );

  const netBalance = totalRevenue - totalExpenses;

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('products');
  const [amount, setAmount] = useState<number>(10000);
  const [receiptRef, setReceiptRef] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) {
      alert('Veuillez renseigner un titre et un montant.');
      return;
    }

    addExpense({
      salonId: activeSalon.id,
      title: title.trim(),
      category,
      amount: Number(amount),
      date: new Date().toISOString().slice(0, 10),
      receiptRef: receiptRef.trim(),
      notes: notes.trim()
    });

    setIsModalOpen(false);
    setTitle('');
    setAmount(10000);
    setReceiptRef('');
    setNotes('');
  };

  const categoryLabels: Record<ExpenseCategory, string> = {
    rent: 'Loyer du local',
    electricity: 'Électricité (CIE)',
    water: 'Eau (SODECI)',
    salaries: 'Salaires & Avances',
    products: 'Produits & Cosmétiques',
    maintenance: 'Maintenance & Réparations',
    marketing: 'Marketing & Publicité',
    other: 'Charges diverses'
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Recettes Totales Encaissées</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>+{formatPrice(totalRevenue)}</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {salonTransactions.length} transactions vérifiées
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Dépenses & Charges Décaissées</span>
          <div className="text-2xl font-extrabold text-red-400 mt-1 flex items-center gap-1.5">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span>-{formatPrice(totalExpenses)}</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {salonExpenses.length} postes de dépenses
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Résultat d'Exploitation Estimé</span>
          <div
            className={`text-2xl font-extrabold mt-1 ${
              netBalance >= 0 ? 'text-[#E5C378]' : 'text-red-400'
            }`}
          >
            {formatPrice(netBalance)}
          </div>
          <span className="text-[11px] text-stone-500">
            Marge brute dégagée sur la période
          </span>
        </div>
      </div>

      {/* Expense Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161619] border border-[#27272c] rounded-2xl p-4">
        <div>
          <h3 className="font-bold text-white text-base">Suivi des Dépenses & Factures</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Gardez le contrôle total sur vos coûts opérationnels pour maximiser la rentabilité.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Enregistrer une dépense</span>
        </button>
      </div>

      {/* Expenses List Table */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Libellé de la dépense</th>
                <th className="p-3.5">Catégorie</th>
                <th className="p-3.5">Justificatif</th>
                <th className="p-3.5">Montant</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222226]">
              {salonExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-stone-500">
                    Aucune dépense enregistrée.
                  </td>
                </tr>
              ) : (
                salonExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#1a1a1e] transition-colors">
                    <td className="p-3.5 font-mono text-stone-400">{exp.date}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-white">{exp.title}</div>
                      {exp.notes && (
                        <div className="text-[11px] text-stone-500 italic">{exp.notes}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="text-[10px] bg-[#222226] text-stone-300 px-2 py-0.5 rounded border border-[#2d2d33]">
                        {categoryLabels[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-stone-400 font-semibold text-[11px]">
                      {exp.receiptRef || '—'}
                    </td>
                    <td className="p-3.5 font-extrabold text-red-400">
                      -{formatPrice(exp.amount)}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Supprimer cette dépense ?')) {
                            deleteExpense(exp.id);
                          }
                        }}
                        className="text-stone-500 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Enregistrer une dépense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Motif / Titre *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Facture CIE Électricité Octobre"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="electricity">Électricité (CIE)</option>
                    <option value="water">Eau (SODECI)</option>
                    <option value="rent">Loyer</option>
                    <option value="salaries">Salaires</option>
                    <option value="products">Produits / Lames</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="marketing">Marketing</option>
                    <option value="other">Divers</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs font-bold text-red-400 focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Référence justificatif (reçu, facture)
                </label>
                <input
                  type="text"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder="Ex: FAC-2026-014"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Remarques / Justificatif
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Reçu #9842"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Enregistrer la dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
