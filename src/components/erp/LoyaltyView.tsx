import React from 'react';
import { useApp } from '../../context/AppContext';
import { Heart } from 'lucide-react';

export const LoyaltyView: React.FC = () => {
  const { activeSalon, loyaltyRewards } = useApp();
  const rewards = loyaltyRewards.filter((reward) => reward.salonId === activeSalon.id);

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-[#C9A45C]" />
        <div>
          <h1 className="text-xl font-bold text-white">Fidélité</h1>
          <p className="text-sm text-stone-400">Récompenses enregistrées pour {activeSalon.name}</p>
        </div>
      </header>

      {rewards.length === 0 ? (
        <p className="rounded-xl border border-[#27272c] bg-[#161619] p-5 text-sm text-stone-400">
          Aucune récompense n'est enregistrée.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rewards.map((reward) => (
            <li key={reward.id} className="rounded-xl border border-[#27272c] bg-[#161619] p-5">
              <h2 className="font-semibold text-white">{reward.name}</h2>
              <p className="mt-1 text-sm text-stone-400">{reward.description}</p>
              <p className="mt-3 text-xs text-[#C9A45C]">{reward.pointsCost} points</p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-stone-500">
        Le paramétrage des points et leur attribution sont indisponibles tant qu'une API persistante
        n'est pas configurée.
      </p>
    </section>
  );
};
