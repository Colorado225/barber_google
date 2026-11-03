import React from 'react';

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableCardProps<T> {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  emptyMessage: string;
  emptyHint?: string;
  action?: React.ReactNode;
}

/** Generic read-only table for ERP lists backed by the real store. */
export function DataTableCard<T>({
  title,
  description,
  icon: Icon,
  rows,
  columns,
  getRowKey,
  emptyMessage,
  emptyHint,
  action
}: DataTableCardProps<T>) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            {Icon && <Icon className="w-6 h-6 text-[#C9A45C]" />}
            {title}
          </h1>
          {description && <p className="text-[#a9a9a9] mt-1">{description}</p>}
        </div>
        {action}
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            {Icon && <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />}
            <p>{emptyMessage}</p>
            {emptyHint && <p className="text-sm mt-1">{emptyHint}</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2b] text-left">
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#a9a9a9] font-bold"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className="border-b border-[#232326] last:border-0 hover:bg-[#18181b] transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.header} className={`px-4 py-3 ${col.className || 'text-[#f7f6f2]'}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
