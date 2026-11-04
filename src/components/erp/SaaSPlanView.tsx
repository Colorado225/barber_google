import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles } from 'lucide-react';

export const SaaSPlanView: React.FC = () => {
  const { activeSalon } = useApp();

  return (
    <section className="max-w-3xl rounded-2xl border border-[#27272c] bg-[#161619] p-6">
      <div className="flex items-center gap-2 text-[#C9A45C]">
        <Sparkles className="h-5 w-5" />
        <h1 className="text-xl font-bold text-white">Abonnement</h1>
      </div>
      <p className="mt-3 text-sm text-stone-400">
        {activeSalon.subscriptionPlanId
          ? `Offre enregistrée : ${activeSalon.subscriptionPlanId}`
          : "Aucune offre d'abonnement n'est enregistrée pour cet établissement."}
      </p>
      <p className="mt-2 text-xs text-stone-500">
        La gestion des offres et des paiements sera disponible lorsqu'un service de facturation
        persistant sera connecté.
      </p>
    </section>
  );
};
