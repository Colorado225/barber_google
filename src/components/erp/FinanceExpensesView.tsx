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
    <div className="space-y-4 sm:space-y-6">
      {/* Période & Fuseau des indicateurs financiers */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#27272c] bg-[#161619] px-4 py-3 text-xs min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div className="text-stone-300">
          <span className="font-semibold text-white">Périmètre comparé :</span> {kpiWindow.label} · Fuseau{' '}
          <span className="font-mono text-[#E5C378]">{salonTimezone}</span>
          {kpiScope === '12m' && scopedTransactions.length >= 500 && (
            <span className="mt-1 block text-amber-300 min-[480px]:ml-2 min-[480px]:mt-0 min-[480px]:inline">
              (fenêtre plafonnée à 500 paiements chargés ; passez sur « Mois en cours » pour le total serveur)
            </span>
          )}
        </div>
        <div className="grid w-full grid-cols-2 rounded-xl border border-[#27272c] bg-[#111113] p-1 min-[480px]:w-auto">
          <button
            type="button"
            onClick={() => setKpiScope('month')}
            aria-pressed={kpiScope === 'month'}
            className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] ${
              kpiScope === 'month' ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'
            }`}
          >
            Mois en cours
          </button>
          <button
            type="button"
            onClick={() => setKpiScope('12m')}
            aria-pressed={kpiScope === '12m'}
            className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] ${
              kpiScope === '12m' ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'
            }`}
          >
            12 mois glissants
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-4">
        <div className="rounded-2xl border border-[#27272c] bg-[#161619] p-4 sm:p-5">
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

        <div className="rounded-2xl border border-[#27272c] bg-[#161619] p-4 sm:p-5">
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

        <div className="rounded-2xl border border-[#27272c] bg-[#161619] p-4 sm:p-5">
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
      <div className="flex flex-col gap-4 rounded-2xl border border-[#27272c] bg-[#161619] p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Suivi des Dépenses, Justificatifs & Corrections</h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Journal audité : aucune suppression silencieuse. Toute annulation ou rectification crée une
            écriture liée.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#C9A45C] px-4 text-sm font-bold text-[#101010] shadow-md transition-colors hover:bg-[#d8b56d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4d28c] min-[480px]:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Enregistrer une dépense</span>
          </button>
        )}
      </div>

      {/* Expenses List Table */}
      <div className="overflow-hidden rounded-2xl border border-[#27272c] bg-[#161619] shadow-sm">
        <div
          role="region"
          aria-label="Liste des dépenses, défilement horizontal"
          tabIndex={0}
          className="md:overflow-x-auto"
        >
          <table className="block w-full text-left text-xs text-stone-300 md:table md:min-w-[760px]">
            <thead className="sr-only border-b border-[#26262a] bg-[#111113] text-[11px] font-semibold uppercase tracking-wider text-stone-400 md:table-header-group">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Libellé & Fournisseur</th>
                <th className="p-3.5">Catégorie & État</th>
                <th className="p-3.5">Justificatif & Pièce jointe</th>
                <th className="p-3.5">Montant</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="block divide-y divide-[#222226] md:table-row-group">
              {salonExpenses.length === 0 ? (
                <tr className="block md:table-row">
                  <td colSpan={6} className="block py-8 text-center text-stone-500 md:table-cell">
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
                      className={`block space-y-3 p-4 transition-colors hover:bg-[#1a1a1e] md:table-row md:space-y-0 md:p-0 ${
                        !isActiveExpense ? 'opacity-75' : ''
                      }`}
                    >
                      <td className="flex items-center justify-between font-mono text-stone-400 md:table-cell md:p-3.5 md:whitespace-nowrap">
                        <span className="text-[10px] font-sans font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                          Date
                        </span>
                        {exp.date}
                      </td>
                      <td className="block md:table-cell md:p-3.5">
                        <div className="break-words font-bold text-white">{exp.title}</div>
                        {supplierName && (
                          <div className="text-[11px] text-[#E5C378]">Fournisseur : {supplierName}</div>
                        )}
                        {exp.reason && <div className="text-[11px] text-amber-300">Motif : {exp.reason}</div>}
                        {exp.notes && <div className="text-[11px] italic text-stone-500">{exp.notes}</div>}
                      </td>
                      <td className="flex flex-wrap items-center gap-2 md:table-cell md:space-y-1 md:p-3.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                          Catégorie
                        </span>
                        <span className="rounded border border-[#2d2d33] bg-[#222226] px-2 py-0.5 text-[10px] text-stone-300">
                          {CATEGORY_LABELS[exp.category] || exp.category}
                        </span>
                        {isReversal ? (
                          <span className="inline-block rounded border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                            Contrepassation
                          </span>
                        ) : exp.status === 'reversed' ? (
                          <span className="inline-block rounded border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">
                            Annulée
                          </span>
                        ) : exp.status === 'superseded' ? (
                          <span className="inline-block rounded border border-stone-700 bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300">
                            Corrigée
                          </span>
                        ) : null}
                      </td>
                      <td className="flex flex-col gap-1 text-[11px] text-stone-400 md:table-cell md:space-y-1 md:p-3.5">
                        <div className="flex items-center justify-between gap-2 md:block">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                            Justificatif
                          </span>
                          <span className="font-semibold">{exp.receiptRef || '—'}</span>
                        </div>
                        {exp.attachmentPath ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(exp.attachmentPath!)}
                            className="inline-flex min-h-10 items-center gap-1 self-start text-left text-xs text-[#E5C378] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="break-all">{exp.attachmentName || 'Ouvrir justificatif'}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          </button>
                        ) : (
                          canManage &&
                          isActiveExpense && (
                            <label className="inline-flex min-h-11 cursor-pointer items-center gap-1 self-start text-xs text-stone-400 hover:text-white focus-within:outline-none focus-within:ring-2 focus-within:ring-[#C9A45C]">
                              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
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
                        className={`flex items-center justify-between font-extrabold md:table-cell md:p-3.5 md:whitespace-nowrap ${
                          signed < 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                          Montant
                        </span>
                        {signed < 0 ? `+${formatPrice(Math.abs(signed))}` : `-${formatPrice(signed)}`}
                      </td>
                      <td className="flex items-center justify-between gap-3 border-t border-[#27272c] pt-3 md:table-cell md:border-0 md:p-3.5 md:text-right">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                          Actions
                        </span>
                        {canManage && isActiveExpense ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openCorrectModal(exp)}
                              title="Corriger via écriture liée"
                              aria-label={`Corriger la dépense ${exp.title}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#2d2d33] bg-[#222226] text-stone-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                            >
                              <Edit3 className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReverseTarget(exp);
                                setReverseReason('');
                              }}
                              title="Contrepasser (annulation auditée)"
                              aria-label={`Contrepasser la dépense ${exp.title}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#28282d] bg-[#111113] text-stone-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
        <div className="space-y-3 rounded-2xl border border-[#27272c] bg-[#161619] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <History className="h-4 w-4 text-[#C9A45C]" aria-hidden="true" />
            <span>Journal d’audit des dépenses ({expenseEvents.length})</span>
          </div>
          <div className="max-h-56 space-y-1.5 overflow-y-auto text-xs">
            {expenseEvents.slice(0, 20).map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col gap-2 rounded-xl border border-[#242429] bg-[#111113] px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-stone-500">
                      {ev.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                    <span className="rounded bg-[#222226] px-2 py-0.5 text-[10px] font-semibold text-stone-200">
                      {ev.eventType}
                    </span>
                  </div>
                  {ev.reason && (
                    <span className="mt-1 block break-words text-stone-300">« {ev.reason} »</span>
                  )}
                </div>
                <span className="self-start font-bold text-[#E5C378] min-[420px]:self-auto">
                  {formatPrice(ev.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/85 p-3 pt-8 backdrop-blur-md sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.75rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-[#2b2b30] bg-[#161619] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Enregistrer une dépense</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fermer"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
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
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-stone-200 outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
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
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base font-bold text-red-400 outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={spentOn}
                    onChange={(e) => setSpentOn(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-stone-200 outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
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
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
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
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-stone-300 outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Remarques</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Reçu #9842"
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 w-full rounded-xl bg-[#C9A45C] py-3 text-sm font-bold text-[#101010] shadow-md transition-colors hover:bg-[#d8b56d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4d28c] disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/85 p-3 pt-8 backdrop-blur-md sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.75rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-[#2b2b30] bg-[#161619] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Corriger une dépense</h3>
              <button
                type="button"
                onClick={() => setCorrectTarget(null)}
                aria-label="Fermer"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
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
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nouveau libellé *</label>
                <input
                  type="text"
                  required
                  value={corrTitle}
                  onChange={(e) => setCorrTitle(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={corrCategory}
                    onChange={(e) => setCorrCategory(e.target.value as ExpenseCategory)}
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
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
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={corrDate}
                    onChange={(e) => setCorrDate(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                  <select
                    value={corrSupplierId}
                    onChange={(e) => setCorrSupplierId(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
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
                className="min-h-11 w-full rounded-xl bg-[#C9A45C] py-3 text-sm font-bold text-[#101010] transition-colors hover:bg-[#d8b56d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4d28c] disabled:opacity-50"
              >
                {submitting ? 'Correction...' : 'Valider la correction auditée'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONTREPASSATION */}
      {reverseTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/85 p-3 pt-8 backdrop-blur-md sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.75rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-[#2b2b30] bg-[#161619] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Contrepasser la dépense</h3>
              <button
                type="button"
                onClick={() => setReverseTarget(null)}
                aria-label="Fermer"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
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
                  className="min-h-11 w-full rounded-xl border border-[#28282d] bg-[#111113] px-3 text-base text-white outline-none focus:border-[#C9A45C] focus:ring-1 focus:ring-[#C9A45C] sm:text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || reverseReason.trim().length < 3}
                className="min-h-11 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-[#101010] transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-50"
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
