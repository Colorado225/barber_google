import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SalonType, PaymentMethod, OpeningHour } from '../../types';
import {
  Scissors,
  Building2,
  User,
  MapPin,
  Clock,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  Camera,
  Star,
  Sparkles,
  Phone,
  MessageCircle,
  Eye,
  X
} from 'lucide-react';

export const OnboardingWizardPage: React.FC = () => {
  const {
    activeSalon,
    updateSalonDetails,
    addStaff,
    addService,
    setIsOnboardingOpen,
    formatPrice,
    addToast
  } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Owner Profile
  const [ownerName, setOwnerName] = useState('Ibrahim Touré');
  const [ownerTitle, setOwnerTitle] = useState('Fondateur & Master Barber');
  const [ownerPhone, setOwnerPhone] = useState(activeSalon.phone || '+225 07 08 45 12 89');
  const [ownerEmail, setOwnerEmail] = useState(activeSalon.email || 'contact@barbercuts.ci');
  const [ownerAvatar, setOwnerAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80');

  // Step 2: Barbershop Identity
  const [salonName, setSalonName] = useState(activeSalon.name);
  const [tagline, setTagline] = useState(activeSalon.tagline || 'L\'art du rasage traditionnel et de la précision');
  const [salonType, setSalonType] = useState<SalonType>(activeSalon.type || 'barbershop');
  const [logo, setLogo] = useState(activeSalon.logo || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=128&q=80');
  const [coverImage, setCoverImage] = useState(activeSalon.coverImage);
  const [description, setDescription] = useState(
    activeSalon.description || 'Barbershop haut de gamme situé au cœur d\'Abidjan, offrant une expérience de coiffure masculine raffinée.'
  );

  // Step 3: Location
  const [commune, setCommune] = useState(activeSalon.commune || 'Cocody');
  const [quarter, setQuarter] = useState(activeSalon.quarter || 'Riviera 2');
  const [address, setAddress] = useState(activeSalon.address || 'Rue des Jardins, face Pharmacie');

  // Step 4: Core Services with customizable prices in FCFA
  const [servicesConfig, setServicesConfig] = useState([
    { name: 'Coupe classique aux ciseaux & tondeuse', category: 'coupe', price: 3000, duration: 30, selected: true },
    { name: 'Dégradé américain (Fade) & contours nets', category: 'coupe', price: 4000, duration: 40, selected: true },
    { name: 'Taille & traçage de barbe serviette chaude', category: 'barbe', price: 2500, duration: 25, selected: true },
    { name: 'Combo VIP Coupe + Barbe + Soin', category: 'combo', price: 6500, duration: 60, selected: true },
    { name: 'Soin du visage purifiant au charbon', category: 'visage', price: 5000, duration: 35, selected: false },
    { name: 'Coloration barbe / Bigen Black', category: 'coloration', price: 3500, duration: 30, selected: false }
  ]);

  // Step 5: Initial Team member
  const [hasExtraBarber, setHasExtraBarber] = useState(true);
  const [barberName, setBarberName] = useState('Serge Konan');
  const [barberRole, setBarberRole] = useState('Barbier Styliste');
  const [barberPhone, setBarberPhone] = useState('+225 05 11 22 33 44');
  const [barberCommission, setBarberCommission] = useState(30);

  // Step 6: Opening Hours & Payment
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(['wave', 'orange_money', 'cash']);
  const [openingTime, setOpeningTime] = useState('08:30');
  const [closingTime, setClosingTime] = useState('21:00');
  const [openSunday, setOpenSunday] = useState(true);

  const toggleMethod = (m: PaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const handleFinishOnboarding = () => {
    // 1. Update Salon with full personalized data
    const openingHours: OpeningHour[] = [
      { day: 'Lundi', open: openingTime, close: closingTime, isOpen: true },
      { day: 'Mardi', open: openingTime, close: closingTime, isOpen: true },
      { day: 'Mercredi', open: openingTime, close: closingTime, isOpen: true },
      { day: 'Jeudi', open: openingTime, close: closingTime, isOpen: true },
      { day: 'Vendredi', open: openingTime, close: closingTime, isOpen: true },
      { day: 'Samedi', open: openingTime, close: closingTime, isOpen: true },
      { day: 'Dimanche', open: '10:00', close: '18:00', isOpen: openSunday }
    ];

    updateSalonDetails(activeSalon.id, {
      name: salonName.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      type: salonType,
      logo,
      coverImage,
      phone: ownerPhone.trim(),
      whatsapp: ownerPhone.trim(),
      email: ownerEmail.trim(),
      commune,
      quarter,
      address,
      openingHours,
      paymentMethods,
      minPrice: Math.min(...servicesConfig.filter(s => s.selected).map(s => s.price)),
      isPublishedOnMarketplace: true,
      isRecommended: true
    });

    // 2. Add extra barber if specified
    if (hasExtraBarber && barberName.trim()) {
      addStaff({
        salonId: activeSalon.id,
        name: barberName.trim(),
        role: 'barber',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        specialties: ['Dégradés laser', 'Barbe sculptée'],
        rating: 4.9,
        commissionRate: Number(barberCommission),
        phone: barberPhone.trim(),
        isAvailable: true
      });
    }

    addToast(`Onboarding terminé avec succès ! Votre salon "${salonName}" est configuré et prêt à accueillir des clients !`, 'success');
    setIsOnboardingOpen(false);
  };

  const steps = [
    { num: 1, label: 'Propriétaire' },
    { num: 2, label: 'Identité Salon' },
    { num: 3, label: 'Emplacement' },
    { num: 4, label: 'Prestations' },
    { num: 5, label: 'Équipe' },
    { num: 6, label: 'Horaires & Caisse' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0c] text-stone-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-18 bg-[#121214] border-b border-[#222226] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1e1b14] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] font-bold shadow-md">
            <Scissors className="w-5 h-5 rotate-90" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-white">
              Barber<span className="text-[#C9A45C]">Cuts</span> Business
            </div>
            <div className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">
              Assistant de Configuration & Personnalisation Salon
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsOnboardingOpen(false)}
          className="text-xs text-stone-400 hover:text-white px-3 py-1.5 rounded-lg border border-[#2a2a2e] hover:bg-[#1a1a1d] transition-colors flex items-center gap-1.5"
        >
          <X className="w-4 h-4" />
          <span>Fermer / Reprendre plus tard</span>
        </button>
      </header>

      {/* Stepper Progress Bar */}
      <div className="bg-[#141417] border-b border-[#202025] px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((st) => (
              <div key={st.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === st.num
                      ? 'bg-[#C9A45C] text-[#101010] shadow-[0_0_15px_rgba(201,164,92,0.4)]'
                      : currentStep > st.num
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40'
                      : 'bg-[#222227] text-stone-400'
                  }`}
                >
                  {currentStep > st.num ? '✓' : st.num}
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    currentStep === st.num ? 'text-[#E5C378]' : 'text-stone-400'
                  }`}
                >
                  {st.label}
                </span>
                {st.num < 6 && <div className="hidden md:block w-8 h-[1px] bg-[#2d2d33] mx-2" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Wizard Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
        {/* STEP 1: PROPRIÉTAIRE & MAÎTRE BARBIER */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-[#222226] pb-4">
              <span className="text-xs uppercase font-bold text-[#C9A45C] tracking-wider">
                Étape 1 sur 6
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif-luxury">
                Faisons connaissance avec le Gérant / Maître Barbier
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Ces informations apparaîtront sur vos devis, reçus et communications officielles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Avatar preview */}
              <div className="flex flex-col items-center justify-center p-6 bg-[#161619] border border-[#27272c] rounded-2xl text-center space-y-3">
                <img
                  src={ownerAvatar}
                  alt={ownerName}
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#C9A45C] shadow-lg"
                />
                <div>
                  <div className="text-sm font-bold text-white">{ownerName || 'Votre Nom'}</div>
                  <div className="text-xs text-[#C9A45C]">{ownerTitle}</div>
                </div>
                <div className="flex gap-2">
                  {[
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80'
                  ].map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setOwnerAvatar(url)}
                      className="w-7 h-7 rounded-full overflow-hidden border border-[#2c2c33] hover:border-[#C9A45C]"
                    >
                      <img src={url} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Inputs */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Nom & Prénom du Responsable *
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ex: Ibrahim Touré"
                    className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Titre ou Rôle dans l'établissement
                  </label>
                  <input
                    type="text"
                    value={ownerTitle}
                    onChange={(e) => setOwnerTitle(e.target.value)}
                    placeholder="Ex: Propriétaire & Master Barber"
                    className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Numéro WhatsApp Professionnel *
                    </label>
                    <input
                      type="tel"
                      required
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-semibold focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Email professionnel
                    </label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="contact@salon.ci"
                      className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: IDENTITÉ & LOGO DU BARBERSHOP */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-[#222226] pb-4">
              <span className="text-xs uppercase font-bold text-[#C9A45C] tracking-wider">
                Étape 2 sur 6
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif-luxury">
                Identité Visuelle & Logo du Salon
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Définissez l'image de marque de votre établissement pour séduire les clients de la Marketplace.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Nom commercial du Barbershop *
                </label>
                <input
                  type="text"
                  required
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  placeholder="Ex: Le Baron Cut Lounge"
                  className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Type d'établissement
                </label>
                <select
                  value={salonType}
                  onChange={(e) => setSalonType(e.target.value as SalonType)}
                  className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="barbershop">Barbershop (Coupes hommes & barbes)</option>
                  <option value="salon_femme">Salon de coiffure Femme</option>
                  <option value="salon_mixte">Salon Mixte (Hommes & Femmes)</option>
                  <option value="institut">Institut de beauté & Esthétique</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Slogan de marque
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Ex: Coupes précises, rasage traditionnel et ambiance feutrée"
                className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            {/* Logo Selector */}
            <div className="p-4 bg-[#161619] border border-[#27272c] rounded-2xl space-y-3">
              <label className="text-xs font-bold text-white block">
                Logo officiel du salon
              </label>
              <div className="flex items-center gap-4">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-[#C9A45C]/50 shadow-md shrink-0"
                />
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="URL de votre logo ou choisir un blason ci-dessous..."
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {[
                      { label: 'Doré Vintage', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=128&q=80' },
                      { label: 'Ciseaux Noirs', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=128&q=80' },
                      { label: 'Urban Cut', url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=128&q=80' }
                    ].map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLogo(p.url)}
                        className="px-2.5 py-1 rounded bg-[#222227] hover:bg-[#2c2c34] text-stone-300 border border-[#2e2e34]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: EMPLACEMENT & REPÈRE */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-[#222226] pb-4">
              <span className="text-xs uppercase font-bold text-[#C9A45C] tracking-wider">
                Étape 3 sur 6
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif-luxury">
                Localisation à Abidjan & Repère
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Permettez aux clients de votre commune de vous localiser facilement sur la carte et la recherche.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Commune d'implantation *
                </label>
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="Cocody">Cocody</option>
                  <option value="Marcory">Marcory</option>
                  <option value="Plateau">Plateau</option>
                  <option value="Treichville">Treichville</option>
                  <option value="Yopougon">Yopougon</option>
                  <option value="Koumassi">Koumassi</option>
                  <option value="Port-Bouët">Port-Bouët</option>
                  <option value="Abobo">Abobo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Quartier précis *
                </label>
                <input
                  type="text"
                  required
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  placeholder="Ex: Riviera 2 / Zone 4 / Angré 8ème Tranche"
                  className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Adresse physique & Repère pour les clients *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Rue des Jardins, en face de la Pharmacie Sainte Cécile"
                className="w-full bg-[#161619] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#141416] border border-[#26262a] text-xs text-stone-400 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#C9A45C] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Précision géographique :</span> Votre salon sera automatiquement catégorisé sous la commune de <strong className="text-[#E5C378]">{commune}</strong> et visible dès qu'un client filtre par quartier.
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PRESTATIONS & TARIFS INITIAUX */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-[#222226] pb-4">
              <span className="text-xs uppercase font-bold text-[#C9A45C] tracking-wider">
                Étape 4 sur 6
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif-luxury">
                Catalogue de Prestations de Départ
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Ajustez les tarifs en FCFA pour vos services clés. Vous pourrez en ajouter d'autres à tout moment dans l'ERP.
              </p>
            </div>

            <div className="space-y-3">
              {servicesConfig.map((srv, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    srv.selected
                      ? 'bg-[#18181b] border-[#C9A45C]/50 shadow-sm'
                      : 'bg-[#121214] border-[#222226] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`srv-${idx}`}
                      checked={srv.selected}
                      onChange={(e) => {
                        const next = [...servicesConfig];
                        next[idx].selected = e.target.checked;
                        setServicesConfig(next);
                      }}
                      className="rounded border-[#29292e] bg-[#111113] text-[#C9A45C] focus:ring-0"
                    />
                    <div>
                      <label htmlFor={`srv-${idx}`} className="text-xs font-bold text-white cursor-pointer">
                        {srv.name}
                      </label>
                      <div className="text-[10px] text-stone-400">
                        Durée estimée : {srv.duration} minutes
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">Prix :</span>
                    <input
                      type="number"
                      step="500"
                      min="500"
                      value={srv.price}
                      onChange={(e) => {
                        const next = [...servicesConfig];
                        next[idx].price = Number(e.target.value);
                        setServicesConfig(next);
                      }}
                      className="w-28 bg-[#111113] border border-[#2a2a2e] rounded-lg px-2.5 py-1 text-xs font-bold text-[#E5C378] text-right focus:outline-none focus:border-[#C9A45C]"
                    />
                    <span className="text-xs text-stone-400 font-bold">FCFA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: VOTRE ÉQUIPE DE BARBIERS */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-[#222226] pb-4">
              <span className="text-xs uppercase font-bold text-[#C9A45C] tracking-wider">
                Étape 5 sur 6
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif-luxury">
                Votre Première Équipe de Barbiers
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Le gérant ({ownerName}) est déjà enregistré comme Master Barbier. Souhaitez-vous déclarer un second collaborateur ?
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#18181b] border border-[#242428] flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Barbier supplémentaire</h4>
                <p className="text-[11px] text-stone-400">Ajouter un barbier avec commission pour démarrer le planning</p>
              </div>
              <input
                type="checkbox"
                checked={hasExtraBarber}
                onChange={(e) => setHasExtraBarber(e.target.checked)}
                className="rounded border-[#29292e] bg-[#111113] text-[#C9A45C] focus:ring-0"
              />
            </div>

            {hasExtraBarber && (
              <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Nom du barbier *
                    </label>
                    <input
                      type="text"
                      value={barberName}
                      onChange={(e) => setBarberName(e.target.value)}
                      placeholder="Ex: Serge Konan"
                      className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={barberPhone}
                      onChange={(e) => setBarberPhone(e.target.value)}
                      placeholder="05 00 00 00 00"
                      className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Rôle / Spécialité
                    </label>
                    <input
                      type="text"
                      value={barberRole}
                      onChange={(e) => setBarberRole(e.target.value)}
                      placeholder="Ex: Barbier Styliste"
                      className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Commission (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={barberCommission}
                      onChange={(e) => setBarberCommission(Number(e.target.value))}
                      className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs font-bold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: HORAIRES & MOYENS DE PAIEMENT */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="border-b border-[#222226] pb-4">
              <span className="text-xs uppercase font-bold text-[#C9A45C] tracking-wider">
                Étape 6 sur 6
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif-luxury">
                Horaires d'Ouverture & Encaissements
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Configurez les heures de disponibilité des créneaux et les moyens de règlement en caisse.
              </p>
            </div>

            {/* Quick Hours */}
            <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C9A45C]" />
                Horaires standards de la semaine
              </h4>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-stone-400 block mb-1">Heure d'ouverture :</span>
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="bg-[#111113] border border-[#2a2a2e] rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <span className="text-stone-400 block mb-1">Heure de fermeture :</span>
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="bg-[#111113] border border-[#2a2a2e] rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="openSundayCheck"
                    checked={openSunday}
                    onChange={(e) => setOpenSunday(e.target.checked)}
                    className="rounded border-[#29292e] bg-[#111113] text-[#C9A45C] focus:ring-0"
                  />
                  <label htmlFor="openSundayCheck" className="text-xs text-stone-300 font-medium cursor-pointer">
                    Ouvert le Dimanche (10h - 18h)
                  </label>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div className="p-5 rounded-2xl bg-[#161619] border border-[#27272c] space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#C9A45C]" />
                Moyens de Paiement Autorisés
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'wave', label: 'Wave Mobile Money' },
                  { id: 'orange_money', label: 'Orange Money' },
                  { id: 'mtn_momo', label: 'MTN Mobile Money' },
                  { id: 'cash', label: 'Espèces au comptoir' }
                ].map((item) => {
                  const isChecked = paymentMethods.includes(item.id as PaymentMethod);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleMethod(item.id as PaymentMethod)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                        isChecked
                          ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                          : 'bg-[#111113] border-[#26262a] text-stone-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons Bottom Bar */}
        <div className="pt-8 border-t border-[#222226] mt-6 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#202024] text-stone-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="px-6 py-3 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Continuer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="px-8 py-3.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-sm font-extrabold flex items-center gap-2 transition-all shadow-xl hover:shadow-[0_0_25px_rgba(201,164,92,0.4)] cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Terminer la personnalisation & Ouvrir l'ERP</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
