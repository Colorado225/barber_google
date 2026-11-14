import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { expenseSignedAmount, paymentBusinessDate, paymentSignedAmount } from '../../lib/analytics';
import { resolveErpPeriodRange, zonedToday } from '../../lib/businessTime';
import { financeRange } from '../../context/domains/FinanceDomainContext';
import {
  createExpenseAttachmentSignedUrl,
  uploadExpenseAttachment,
  type UploadedExpenseAttachment,
} from '../../lib/storage';
import type { Expense, ExpenseCategory } from '../../types';
import {
  Edit3,
  ExternalLink,
  History,
  Paperclip,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Loyer du local',
  electricity: 'Électricité (CIE)',
  water: 'Eau (SODECI)',
  salaries: 'Salaires & Avances',
  products: 'Produits & Cosmétiques',
  maintenance: 'Maintenance & Réparations',
  marketing: 'Marketing & Publicité',
  other: 'Charges diverses',
};

export const FinanceExpensesView: React.FC = () => {
  const {
    activeSalon,
    salonTimezone,
    financialSummary,
    expenses,
    expenseEvents,
    suppliers,
    transactions,
    formatPrice,
    addExpense,
    attachExpenseReceipt,
    reverseExpense,
    correctExpense,
    addToast,
  } = useApp();
  const { hasPermission } = useOptionalAuth();
  const canManage = hasPermission('expenses.manage', activeSalon?.id);
  const [kpiScope, setKpiScope] = useState<'month' | '12m'>('12m');

  const kpiWindow = useMemo(() => {
    if (kpiScope === 'month') {
      const r = resolveErpPeriodRange('month', salonTimezone);
      return { from: r.from, to: r.to, label: `Mois en cours (${r.from} → ${r.to})` };
    }
    const r = financeRange(salonTimezone);
    return { from: r.from, to: r.to, label: `12 mois glissants (${r.from} → ${r.to})` };
  }, [kpiScope, salonTimezone]);

  const salonExpenses = useMemo(
    () => (activeSalon ? expenses.filter((e) => e.salonId === activeSalon.id) : []),
    [expenses, activeSalon],
  );

  const salonTransactions = useMemo(
    () =>
      activeSalon ? transactions.filter((t) => t.salonId === activeSalon.id && t.status === 'completed') : [],
    [transactions, activeSalon],
  );

  const activeSuppliers = useMemo(
    () => (activeSalon ? suppliers.filter((s) => s.salonId === activeSalon.id && s.isActive) : []),
    [suppliers, activeSalon],
  );

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sup of suppliers) {
      if (activeSalon && sup.salonId === activeSalon.id) map.set(sup.id, sup.name);
    }
    return map;
  }, [suppliers, activeSalon]);

  const scopedTransactions = useMemo(
    () =>
      salonTransactions.filter((t) => {
        const d = paymentBusinessDate(t, salonTimezone);
        return d >= kpiWindow.from && d <= kpiWindow.to;
      }),
    [salonTransactions, salonTimezone, kpiWindow],
  );

  const scopedExpenses = useMemo(
    () => salonExpenses.filter((e) => e.date >= kpiWindow.from && e.date <= kpiWindow.to),
    [salonExpenses, kpiWindow],
  );

  const totalRevenue = useMemo(() => {
    if (kpiScope === 'month' && financialSummary) {
      return financialSummary.revenueCollected;
    }
    return scopedTransactions.reduce((acc, t) => acc + paymentSignedAmount(t), 0);
  }, [kpiScope, financialSummary, scopedTransactions]);

  const totalExpenses = useMemo(() => {
    if (kpiScope === 'month' && financialSummary) {
      return financialSummary.expenses;
    }
    return scopedExpenses.reduce((acc, e) => acc + expenseSignedAmount(e), 0);
  }, [kpiScope, financialSummary, scopedExpenses]);

  const netBalance = totalRevenue - totalExpenses;

  // Modal création dépense
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('products');
  const [amount, setAmount] = useState<number>(10000);
  const [spentOn, setSpentOn] = useState<string>(() => zonedToday(salonTimezone));
  const [supplierId, setSupplierId] = useState<string>('');
  const [receiptRef, setReceiptRef] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal correction auditée
  const [correctTarget, setCorrectTarget] = useState<Expense | null>(null);
  const [corrTitle, setCorrTitle] = useState('');
  const [corrCategory, setCorrCategory] = useState<ExpenseCategory>('products');
  const [corrAmount, setCorrAmount] = useState<number>(0);
  const [corrDate, setCorrDate] = useState<string>('');
  const [corrSupplierId, setCorrSupplierId] = useState<string>('');
  const [corrReceiptRef, setCorrReceiptRef] = useState('');
  const [corrNotes, setCorrNotes] = useState('');
  const [corrReason, setCorrReason] = useState('');

  // Modal contrepassation
  const [reverseTarget, setReverseTarget] = useState<Expense | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  // Pièce jointe ajoutée après coup
  const [attachingExpenseId, setAttachingExpenseId] = useState<string | null>(null);

  if (!activeSalon) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0 || submitting) return;
    setSubmitting(true);
    try {
      let uploaded: UploadedExpenseAttachment | null = null;
      if (pendingFile) {
        uploaded = await uploadExpenseAttachment(activeSalon.id, pendingFile);
      }
      await addExpense({
        salonId: activeSalon.id,
        title: title.trim(),
        category,
        amount: Math.trunc(Number(amount)),
        date: spentOn,
        supplierId: supplierId || null,
        receiptRef: receiptRef.trim(),
        notes: notes.trim(),
        attachmentPath: uploaded?.path ?? null,
        attachmentName: uploaded?.name ?? null,
        attachmentMime: uploaded?.mime ?? null,
        attachmentSize: uploaded?.size ?? null,
      });

      setIsModalOpen(false);
      setTitle('');
      setAmount(10000);
      setSupplierId('');
      setReceiptRef('');
      setNotes('');
      setPendingFile(null);
    } catch (err) {
      if (pendingFile && err instanceof Error) {
        addToast(err.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openCorrectModal = (exp: Expense) => {
    setCorrectTarget(exp);
    setCorrTitle(exp.title);
    setCorrCategory(exp.category);
    setCorrAmount(exp.amount);
    setCorrDate(exp.date);
    setCorrSupplierId(exp.supplierId ?? '');
    setCorrReceiptRef(exp.receiptRef ?? '');
    setCorrNotes(exp.notes ?? '');
    setCorrReason('');
  };

  const handleCorrectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctTarget || corrReason.trim().length < 3 || corrAmount <= 0 || submitting) return;
    setSubmitting(true);
    try {
      await correctExpense({
        originalExpenseId: correctTarget.id,
        title: corrTitle.trim(),
        category: corrCategory,
        amount: Math.trunc(Number(corrAmount)),
        date: corrDate,
        reason: corrReason.trim(),
        branchId: correctTarget.branchId ?? null,
        notes: corrNotes.trim(),
        receiptRef: corrReceiptRef.trim() || null,
        supplierId: corrSupplierId || null,
      });
      setCorrectTarget(null);
    } catch {
      // Toast remonté
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseTarget || reverseReason.trim().length < 3 || submitting) return;
    setSubmitting(true);
    try {
      await reverseExpense(reverseTarget.id, reverseReason.trim());
      setReverseTarget(null);
      setReverseReason('');
    } catch {
      // Toast remonté
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachFileToExisting = async (expenseId: string, file: File | undefined) => {
    if (!file) return;
    setAttachingExpenseId(expenseId);
    try {
      const uploaded = await uploadExpenseAttachment(activeSalon.id, file);
      await attachExpenseReceipt(expenseId, uploaded);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Envoi de pièce jointe impossible.', 'error');
    } finally {
      setAttachingExpenseId(null);
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const url = await createExpenseAttachmentSignedUrl(activeSalon.id, path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ouverture impossible.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Période & Fuseau des indicateurs financiers */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161619] border border-[#27272c] rounded-2xl px-4 py-3 text-xs">
        <div className="text-stone-300">
          <span className="font-semibold text-white">Périmètre comparé :</span> {kpiWindow.label} · Fuseau{' '}
          <span className="text-[#E5C378] font-mono">{salonTimezone}</span>
          {kpiScope === '12m' && scopedTransactions.length >= 500 && (
            <span className="ml-2 text-amber-300">
              (fenêtre plafonnée à 500 paiements chargés ; passez sur « Mois en cours » pour le total serveur)
            </span>
          )}
        </div>
        <div className="flex bg-[#111113] p-1 rounded-xl border border-[#27272c]">
          <button
            type="button"
            onClick={() => setKpiScope('month')}
            className={`px-3 py-1 rounded-lg font-semibold ${
              kpiScope === 'month' ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'
            }`}
          >
            Mois en cours
          </button>
          <button
            type="button"
            onClick={() => setKpiScope('12m')}
            className={`px-3 py-1 rounded-lg font-semibold ${
              kpiScope === '12m' ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'
            }`}
          >
            12 mois glissants
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Encaissements Nets Confirmés</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>+{formatPrice(totalRevenue)}</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {kpiScope === 'month' && financialSummary
              ? `${financialSummary.paymentCount} paiement(s) confirmé(s) · remboursements déduits`
              : `${scopedTransactions.length} écritures confirmées sur la période`}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Dépenses Nettes Décaissées</span>
          <div className="text-2xl font-extrabold text-red-400 mt-1 flex items-center gap-1.5">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span>-{formatPrice(totalExpenses)}</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {scopedExpenses.filter((e) => e.entryKind !== 'expense_reversal' && e.status === 'active').length}{' '}
            écritures actives sur la période · contrepassations déduites
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Résultat d'Exploitation</span>
          <div
            className={`text-2xl font-extrabold mt-1 ${netBalance >= 0 ? 'text-[#E5C378]' : 'text-red-400'}`}
          >
            {formatPrice(netBalance)}
          </div>
          <span className="text-[11px] text-stone-500">
            Encaissements nets − Dépenses nettes ({kpiWindow.from} → {kpiWindow.to})
          </span>
        </div>
      </div>

      {/* Expense Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161619] border border-[#27272c] rounded-2xl p-4">
        <div>
          <h3 className="font-bold text-white text-base">Suivi des Dépenses, Justificatifs & Corrections</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Journal audité : aucune suppression silencieuse. Toute annulation ou rectification crée une
            écriture liée.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer une dépense</span>
          </button>
        )}
      </div>

      {/* Expenses List Table */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Libellé & Fournisseur</th>
                <th className="p-3.5">Catégorie & État</th>
                <th className="p-3.5">Justificatif & Pièce jointe</th>
                <th className="p-3.5">Montant</th>
                <th className="p-3.5 text-right">Actions</th>
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
                salonExpenses.map((exp) => {
                  const isReversal = exp.entryKind === 'expense_reversal';
                  const isActiveExpense = !isReversal && (exp.status ?? 'active') === 'active';
                  const supplierName = exp.supplierId ? supplierNameById.get(exp.supplierId) : undefined;
                  const signed = expenseSignedAmount(exp);

                  return (
                    <tr
                      key={exp.id}
                      className={`hover:bg-[#1a1a1e] transition-colors ${
                        !isActiveExpense ? 'opacity-75' : ''
                      }`}
                    >
                      <td className="p-3.5 font-mono text-stone-400 whitespace-nowrap">{exp.date}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-white">{exp.title}</div>
                        {supplierName && (
                          <div className="text-[11px] text-[#E5C378]">Fournisseur : {supplierName}</div>
                        )}
                        {exp.reason && <div className="text-[11px] text-amber-300">Motif : {exp.reason}</div>}
                        {exp.notes && <div className="text-[11px] text-stone-500 italic">{exp.notes}</div>}
                      </td>
                      <td className="p-3.5 space-y-1">
                        <div>
                          <span className="text-[10px] bg-[#222226] text-stone-300 px-2 py-0.5 rounded border border-[#2d2d33]">
                            {CATEGORY_LABELS[exp.category] || exp.category}
                          </span>
                        </div>
                        {isReversal ? (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Contrepassation
                          </span>
                        ) : exp.status === 'reversed' ? (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                            Annulée
                          </span>
                        ) : exp.status === 'superseded' ? (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                            Corrigée
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3.5 text-stone-400 text-[11px] space-y-1">
                        <div className="font-semibold">{exp.receiptRef || '—'}</div>
                        {exp.attachmentPath ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(exp.attachmentPath!)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#E5C378] hover:underline cursor-pointer"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{exp.attachmentName || 'Ouvrir justificatif'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          canManage &&
                          isActiveExpense && (
                            <label className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-white cursor-pointer">
                              <Upload className="w-3 h-3" />
                              <span>{attachingExpenseId === exp.id ? 'Envoi...' : 'Joindre photo/PDF'}</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                disabled={attachingExpenseId === exp.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  void handleAttachFileToExisting(exp.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )
                        )}
                      </td>
                      <td
                        className={`p-3.5 font-extrabold whitespace-nowrap ${
                          signed < 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {signed < 0 ? `+${formatPrice(Math.abs(signed))}` : `-${formatPrice(signed)}`}
                      </td>
                      <td className="p-3.5 text-right">
                        {canManage && isActiveExpense ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openCorrectModal(exp)}
                              title="Corriger via écriture liée"
                              className="p-1.5 rounded-lg text-stone-300 hover:text-white bg-[#222226] border border-[#2d2d33] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReverseTarget(exp);
                                setReverseReason('');
                              }}
                              title="Contrepasser (annulation auditée)"
                              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 bg-[#111113] border border-[#28282d] cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-500">Figée</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Journal d'audit des dépenses */}
      {expenseEvents.length > 0 && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <History className="w-4 h-4 text-[#C9A45C]" />
            <span>Journal d’audit des dépenses ({expenseEvents.length})</span>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
            {expenseEvents.slice(0, 20).map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-[#111113] border border-[#242429] rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-stone-500">
                    {ev.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#222226] text-[10px] font-semibold text-stone-200">
                    {ev.eventType}
                  </span>
                  {ev.reason && <span className="text-stone-300">« {ev.reason} »</span>}
                </div>
                <span className="font-bold text-[#E5C378]">{formatPrice(ev.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Enregistrer une dépense</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Motif / Titre *</label>
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
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Montant (FCFA) *</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={spentOn}
                    onChange={(e) => setSpentOn(e.target.value)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-200"
                  >
                    <option value="">— Aucun —</option>
                    {activeSuppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
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
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Pièce jointe (JPG, PNG, WebP ou PDF · max 10 Mo)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Remarques</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Reçu #9842"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-50 text-[#101010] font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer la dépense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CORRECTION AUDITÉE */}
      {correctTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Corriger une dépense</h3>
              <button
                type="button"
                onClick={() => setCorrectTarget(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-stone-400 bg-[#111113] border border-[#28282d] rounded-xl p-2.5">
              L’écriture d’origine ({formatPrice(correctTarget.amount)}) sera conservée comme « Corrigée »,
              annulée par contrepassation liée et remplacée par la nouvelle écriture.
            </p>
            <form onSubmit={handleCorrectSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Motif de correction *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie du montant sur la facture"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nouveau libellé *</label>
                <input
                  type="text"
                  required
                  value={corrTitle}
                  onChange={(e) => setCorrTitle(e.target.value)}
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={corrCategory}
                    onChange={(e) => setCorrCategory(e.target.value as ExpenseCategory)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Nouveau montant *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={corrAmount}
                    onChange={(e) => setCorrAmount(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={corrDate}
                    onChange={(e) => setCorrDate(e.target.value)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                  <select
                    value={corrSupplierId}
                    onChange={(e) => setCorrSupplierId(e.target.value)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">— Aucun —</option>
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || corrReason.trim().length < 3}
                className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-50 text-[#101010] font-bold text-xs py-3 rounded-xl cursor-pointer"
              >
                {submitting ? 'Correction...' : 'Valider la correction auditée'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONTREPASSATION */}
      {reverseTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Contrepasser la dépense</h3>
              <button
                type="button"
                onClick={() => setReverseTarget(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-400">
              Annulation comptable de <strong className="text-white">{reverseTarget.title}</strong> (
              {formatPrice(reverseTarget.amount)}). L’écriture initiale est conservée dans l’historique.
            </p>
            <form onSubmit={handleReverseSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Motif obligatoire (min 3 car.) *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="Ex: Facture annulée / Saisie en double"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || reverseReason.trim().length < 3}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#101010] font-bold text-xs py-3 rounded-xl cursor-pointer"
              >
                {submitting ? 'Contrepassation...' : 'Confirmer la contrepassation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
