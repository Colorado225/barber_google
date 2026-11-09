import React from 'react';
import { useApp } from '../../context/AppContext';
import { DataTableCard } from './DataTableCard';
import { Receipt } from 'lucide-react';
import { Expense } from '../../types';

export const ExpensesView: React.FC = () => {
  const { activeSalon, expenses, formatPrice } = useApp();

  const rows = expenses
    .filter((e) => e.salonId === activeSalon.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = rows.reduce((acc, e) => acc + e.amount, 0);

  return (
    <DataTableCard<Expense>
      title="Dépenses"
      description="Suivi des dépenses"
      icon={Receipt}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="Aucune dépense enregistrée"
      emptyHint="Enregistrez vos dépenses"
      action={
        <span className="text-sm text-[#a9a9a9]">
          Total : <strong className="text-[#E5C378]">{formatPrice(total)}</strong>
        </span>
      }
      columns={[
        { header: 'Libellé', render: (r) => <span className="font-semibold">{r.title}</span> },
        { header: 'Catégorie', render: (r) => r.category, className: 'text-[#a9a9a9]' },
        { header: 'Date', render: (r) => r.date, className: 'text-[#a9a9a9]' },
        {
          header: 'Montant',
          render: (r) => formatPrice(r.amount),
          className: 'text-[#E5C378] font-semibold',
        },
      ]}
    />
  );
};
