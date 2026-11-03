import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SalonType, PaymentMethod } from '../../types';
import { X, Building2, User, Scissors, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export const RegisterSalonModal: React.FC = () => {
  const {
    isRegisterSalonOpen,
    setIsRegisterSalonOpen,
    createSalon,
    setMode,
    setIsOnboardingOpen
  } = useApp();

  const [step, setStep] = useState<number>(1);

  // Form State
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [salonName, setSalonName] = useState('');
  const [salonType, setSalonType] = useState<SalonType>('barbershop');
  const [commune, setCommune] = useState('Cocody');
  const [quarter, setQuarter] = useState('Angré');
  const [address, setAddress] = useState('Carrefour Duncan');
  const [tagline, setTagline] = useState('Barbershop & Coiffure de style');
  const [minPrice, setMinPrice] = useState(3000);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    'wave',
    'orange_money',
    'cash'
  ]);

  if (!isRegisterSalonOpen) return null;

  const togglePaymentMethod = (method: PaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonName.trim() || !ownerPhone.trim()) {
      alert('Veuillez renseigner le nom du salon et le numéro de téléphone.');
      return;
    }

    createSalon({
      name: salonName.trim(),
      type: salonType,
      commune,
      quarter,
      address,
      tagline,
      phone: ownerPhone,
      whatsapp: ownerPhone,
      email: ownerEmail || `contact@${salonName.toLowerCase().replace(/\s+/g, '')}.ci`,
      minPrice: Number(minPrice) || 3000,
      paymentMethods
    });

    setIsRegisterSalonOpen(false);
    setMode('erp');
    setIsOnboardingOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl bg-[#151518] border border-[#2b2b30] rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Close Button */}
        <button
          onClick={() => setIsRegisterSalonOpen(false)}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#202024] text-stone-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Wizard Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A45C] mb-1">
            <Building2 className="w-4 h-4" />
            <span>Onboarding Barber Cuts Business</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Inscrire mon établissement</h2>
          <p className="text-xs text-stone-400 mt-1">
            Étape {step} sur 3 — Configurez votre vitrine et votre logiciel de gestion en 2 minutes.
          </p>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-[#232328] rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-[#C9A45C] transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Owner Info */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-[#242428] pb-2">
              <User className="w-4 h-4 text-[#C9A45C]" />
              <span>Informations du gérant / propriétaire</span>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300 block mb-1">Nom complet *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex: Dominique Konan"
                className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300 block mb-1">
                Numéro WhatsApp professionnel *
              </label>
              <input
                type="tel"
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Ex: +225 07 08 09 10 11"
                className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300 block mb-1">
                Email de contact
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="Ex: contact@monsalon.ci"
                className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!ownerPhone.trim()) {
                    alert('Veuillez saisir votre numéro WhatsApp.');
                    return;
                  }
                  setStep(2);
                }}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Salon Details */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-[#242428] pb-2">
              <Scissors className="w-4 h-4 text-[#C9A45C]" />
              <span>Détails du salon & Localisation</span>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300 block mb-1">Nom de l'établissement *</label>
              <input
                type="text"
                required
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="Ex: Prestige Barber Lounge"
                className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Type d'activité</label>
                <select
                  value={salonType}
                  onChange={(e) => setSalonType(e.target.value as SalonType)}
                  className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="barbershop">Barbershop</option>
                  <option value="salon_femme">Salon femme</option>
                  <option value="salon_mixte">Salon mixte</option>
                  <option value="institut">Institut de beauté</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Commune</label>
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="Cocody">Cocody</option>
                  <option value="Marcory">Marcory</option>
                  <option value="Plateau">Plateau</option>
                  <option value="Treichville">Treichville</option>
                  <option value="Yopougon">Yopougon</option>
                  <option value="Koumassi">Koumassi</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Quartier</label>
                <input
                  type="text"
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  placeholder="Ex: Angré 8ème Tranche"
                  className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Tarif minimum (FCFA)</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  placeholder="3000"
                  className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300 block mb-1">Adresse précise / Repère</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: En face de la station Shell, Angré"
                className="w-full bg-[#111113] border border-[#2b2b30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-stone-400 hover:text-white text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!salonName.trim()) {
                    alert('Veuillez renseigner le nom de votre établissement.');
                    return;
                  }
                  setStep(3);
                }}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payments & Confirmation */}
        {step === 3 && (
          <form onSubmit={handleFinish} className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-[#242428] pb-2">
              <CheckCircle className="w-4 h-4 text-[#C9A45C]" />
              <span>Modes de paiement acceptés au salon</span>
            </div>

            <p className="text-xs text-stone-400">
              Sélectionnez les moyens de paiement acceptés pour vos clients et vos encaissements ERP :
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'wave', label: 'Wave Mobile Money' },
                { id: 'orange_money', label: 'Orange Money' },
                { id: 'mtn_momo', label: 'MTN Mobile Money' },
                { id: 'cash', label: 'Espèces (Comptoir)' },
                { id: 'card', label: 'Carte bancaire (TPE)' }
              ].map((item) => {
                const isSelected = paymentMethods.includes(item.id as PaymentMethod);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePaymentMethod(item.id as PaymentMethod)}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                        : 'bg-[#111113] border-[#29292e] text-stone-400 hover:border-stone-500'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-[#1a1914] border border-[#C9A45C]/30 text-xs text-amber-200/90 leading-relaxed">
              ✨ Votre établissement sera automatiquement activé sur la <span className="font-bold text-white">Marketplace publique</span> et pré-configuré avec l'ensemble des modules ERP : caisse, planning des barbiers et CRM clients.
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-stone-400 hover:text-white text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>

              <button
                type="submit"
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Créer mon salon & Ouvrir l'ERP</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
