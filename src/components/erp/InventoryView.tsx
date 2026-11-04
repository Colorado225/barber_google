import React from 'react';
import { useApp } from '../../context/AppContext';
import { DataTableCard } from './DataTableCard';
import { Package } from 'lucide-react';
import { StockItem } from '../../types';

export const InventoryView: React.FC = () => {
  const { activeSalon, stocks, formatPrice } = useApp();

  const rows = stocks.filter((s) => s.salonId === activeSalon.id);

  return (
    <DataTableCard<StockItem>
      title="Stocks"
      description="Inventaire et mouvements"
      icon={Package}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="Aucun produit en stock"
      emptyHint="Gérez votre inventaire"
      columns={[
        { header: 'Produit', render: (r) => <span className="font-semibold">{r.name}</span> },
        { header: 'Quantité', render: (r) => String(r.quantity), className: 'text-[#f7f6f2]' },
        { header: 'Catégorie', render: (r) => r.category, className: 'text-[#a9a9a9]' },
        {
          header: 'Seuil',
          render: (r) => {
            const low = r.quantity <= r.minThreshold;
            return (
              <span className={low ? 'text-amber-400 font-semibold' : 'text-[#a9a9a9]'}>
                {r.minThreshold}
                {low ? ' · à réapprovisionner' : ''}
              </span>
            );
          },
        },
        {
          header: 'Coût unitaire',
          render: (r) => (r.unitCost ? formatPrice(r.unitCost) : '—'),
          className: 'text-[#E5C378] font-semibold',
        },
      ]}
    />
  );
};
