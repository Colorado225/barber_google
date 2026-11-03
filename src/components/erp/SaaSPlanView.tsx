import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SUBSCRIPTION_PLANS } from '../../data/mockData';
import { PaymentMethod } from '../../types';
import { ShieldCheck, Check, Sparkles, CreditCard, ArrowRight, Zap, X } from 'lucide-react';

export const SaaSPlanView: React.FC = () => {
  const { activeSalon, formatPrice, upgradePlan } = useApp();

  const currentPlanId = activeSalon.subscriptionPlanId || 'plan-pro';

  const [selectedPlanToUpgrade, setSelectedPlanToUpgrade] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleConfirmUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanToUpgrade) return;
    upgradePlan(activeSalon.id, selectedPlanToUpgrade, paymentMethod);
    setSelectedPlanToUpgrade(null);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-[#C9A45C]">
          ABONNEMENT SAAS BARBER CUTS
        </span>
        <h2 className="text-3xl font-extrabold text-white font-serif-luxury">
          Choisissez la puissance adaptée à votre salon
        </h2>
        <p className="text-xs text-stone-400">
          Des formules sans engagement, payables directement par Mobile Money (Wave, Orange Money, MTN) ou Carte Bancaire.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 flex flex-col justify-between border transition-all ${
                plan.isPopular
                  ? 'bg-gradient-to-b from-[#1c1914] to-[#141416] border-[#C9A45C] shadow-[0_0_30px_rgba(201,164,92,0.15)] scale-[1.02]'
                  : 'bg-[#161619] border-[#27272c]'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#C9A45C] text-[#101010] px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Plus Populaire
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-stone-400 min-h-[32px]">{plan.tagline}</p>

                <div className="my-5 pb-5 border-b border-[#26262a]">
                  <span className="text-3xl font-extrabold text-white">
                    {formatPrice(plan.priceMonth)}
                  </span>
                  <span className="text-xs text-stone-400 ml-1">/ mois</span>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 mb-6 text-xs text-stone-300">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#C9A45C] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-default"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Formule Active Actuelle</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedPlanToUpgrade(plan.id)}
                    className="w-full py-3 rounded-xl bg-[#25252b] hover:bg-[#C9A45C] hover:text-[#101010] text-white border border-[#3c3c44] hover:border-[#C9A45C] font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Choisir cette formule</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoices History Table */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-white text-sm">Historique de Facturation SaaS</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              <tr>
                <th className="p-3">Numéro Facture</th>
                <th className="p-3">Date</th>
                <th className="p-3">Formule</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Règlement</th>
                <th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222226]">
              <tr className="hover:bg-[#1a1a1e]">
                <td className="p-3 font-mono font-semibold text-white">#FAC-2026-10-01</td>
                <td className="p-3 text-stone-400">01/10/2026</td>
                <td className="p-3 font-bold text-white">Barber Cuts Pro</td>
                <td className="p-3 font-extrabold text-[#E5C378]">19 900 FCFA</td>
                <td className="p-3 uppercase">Wave CI</td>
                <td className="p-3">
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">
                    Payée
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-[#1a1a1e]">
                <td className="p-3 font-mono font-semibold text-white">#FAC-2026-09-01</td>
                <td className="p-3 text-stone-400">01/09/2026</td>
                <td className="p-3 font-bold text-white">Barber Cuts Pro</td>
                <td className="p-3 font-extrabold text-[#E5C378]">19 900 FCFA</td>
                <td className="p-3 uppercase">Orange Money</td>
                <td className="p-3">
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">
                    Payée
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* UPGRADE MODAL */}
      {selectedPlanToUpgrade && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Changer de formule SaaS</h3>
              <button
                onClick={() => setSelectedPlanToUpgrade(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-300">
              Activer instantanément la formule{' '}
              <span className="font-bold text-[#E5C378]">
                {SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanToUpgrade)?.name}
              </span>{' '}
              pour le salon {activeSalon.name}.
            </p>

            <form onSubmit={handleConfirmUpgrade} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">
                  Moyen de paiement Mobile Money
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'wave', label: 'Wave Mobile Money' },
                    { id: 'orange_money', label: 'Orange Money' },
                    { id: 'mtn_momo', label: 'MTN Mobile Money' },
                    { id: 'card', label: 'Carte Bancaire' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                        paymentMethod === m.id
                          ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                          : 'bg-[#111113] border-[#29292e] text-stone-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Numéro Mobile Money débité
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: 07 08 09 10 11"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlanToUpgrade(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#232328] text-stone-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold shadow-lg"
                >
                  Valider le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
