import React from 'react';
import { Store } from 'lucide-react';

export const ShopView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Vitrine</h1>
        <p className="text-[#a9a9a9] mt-1">Publication sur la marketplace</p>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b]">
        <div className="p-6 text-center py-12 text-[#a9a9a9]">
          <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Vitrine en brouillon</p>
          <p className="text-sm mt-1">Publiez votre salon sur la marketplace</p>
        </div>
      </div>
    </div>
  );
};
