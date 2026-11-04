import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, SalonType, OpeningHour } from '../../types';
import { BranchHoursManager } from './BranchHoursManager';
import { useOptionalAuth } from '../../context/AuthContext';
import { listSalonBranches, type SalonBranch } from '../../lib/branch-hours';
import {
  Store,
  CheckCircle2,
  Eye,
  Camera,
  MapPin,
  Clock,
  CreditCard,
  Building2,
  Phone,
  MessageCircle,
  Mail,
  Info,
} from 'lucide-react';

export const SalonProfileSettingsView: React.FC = () => {
  const { activeSalon, updateSalonDetails, setSelectedSalonForModal, formatPrice } = useApp();
  const { isAuthenticated } = useOptionalAuth();

  // Basic Info
  const [name, setName] = useState(activeSalon.name);
  const [tagline, setTagline] = useState(activeSalon.tagline ?? '');
  const [description, setDescription] = useState(activeSalon.description ?? '');
  const [salonType, setSalonType] = useState<SalonType | ''>(activeSalon.type ?? '');

  // Logo & Branding
  const [logo, setLogo] = useState(activeSalon.logo ?? '');
  const [coverImage, setCoverImage] = useState(activeSalon.coverImage ?? '');

  // Contacts
  const [phone, setPhone] = useState(activeSalon.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(activeSalon.whatsapp ?? '');
  const [email, setEmail] = useState(activeSalon.email ?? '');

  // Localization
  const [country, setCountry] = useState(activeSalon.country ?? '');
  const [city, setCity] = useState(activeSalon.city ?? '');
  const [commune, setCommune] = useState(activeSalon.commune ?? '');
  const [quarter, setQuarter] = useState(activeSalon.quarter ?? '');
  const [address, setAddress] = useState(activeSalon.address ?? '');

  // Commercial & Pricing
  const [minPrice, setMinPrice] = useState(String(activeSalon.minPrice ?? ''));
  const [currency] = useState(activeSalon.currency ?? '');

  // Succursales et horaires d'ouverture
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<SalonBranch | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadBranches = async () => {
      if (!activeSalon?.id) return;
      if (!isAuthenticated) {
        setBranches([]);
        setSelectedBranch(null);
        setBranchesError(null);
        setBranchesLoading(false);
        return;
      }
      setBranchesLoading(true);
      setBranchesError(null);
      try {
        const list = await listSalonBranches(activeSalon.id);
        if (mounted) {
          setBranches(list);
          setSelectedBranch((current) => list.find((branch) => branch.id === current?.id) ?? list[0] ?? null);
        }
      } catch (error) {
        if (mounted)
          setBranchesError(error instanceof Error ? error.message : 'Impossible de charger les succursales.');
      } finally {
        if (mounted) setBranchesLoading(false);
      }
    };
    void loadBranches();
    return () => {
      mounted = false;
    };
  }, [activeSalon?.id, isAuthenticated]);

  const reloadBranches = async () => {
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const list = await listSalonBranches(activeSalon.id);
      setBranches(list);
      setSelectedBranch((current) => list.find((branch) => branch.id === current?.id) ?? list[0] ?? null);
    } catch (error) {
      setBranchesError(error instanceof Error ? error.message : 'Impossible de charger les succursales.');
    } finally {
      setBranchesLoading(false);
    }
  };

  // Opening hours
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(activeSalon.openingHours ?? []);

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(activeSalon.paymentMethods ?? []);

  const toggleMethod = (m: PaymentMethod) => {
    setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]));
  };

  const handleHourChange = <K extends keyof OpeningHour>(index: number, field: K, value: OpeningHour[K]) => {
    setOpeningHours((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Les images sont persistées sous forme d'URL HTTPS (pas de base64 en base).
  const handleLogoUrl = (value: string) => setLogo(value.trim());
  const handleCoverUrl = (value: string) => setCoverImage(value.trim());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSalonDetails(activeSalon.id, {
      name,
      tagline,
      description,
      type: salonType || activeSalon.type,
      logo,
      coverImage,
      phone,
      whatsapp,
      email,
      country,
      city,
      commune,
      quarter,
      address,
      minPrice: minPrice ? Number(minPrice) : undefined,
      openingHours,
      paymentMethods,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161619] border border-[#27272c] rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-[#C9A45C]" />
            <span>Personnalisation de l'Établissement</span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Configurez l'identité officielle de votre salon : logo, coordonnées professionnelles, horaires et
            tarifs.
          </p>
        </div>

        <button
          onClick={() =>
            setSelectedSalonForModal({ ...activeSalon, name, logo, coverImage, tagline, description })
          }
          className="bg-[#242429] hover:bg-[#2e2e34] text-white border border-[#3c3c44] font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Eye className="w-4 h-4 text-[#C9A45C]" />
          <span>Aperçu de la fiche</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: LOGO & IDENTITÉ VISUELLE */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <Camera className="w-4 h-4 text-[#C9A45C]" />
            <span>Logo & Visuel Officiel</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Logo Preview */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#101012] border-2 border-[#C9A45C]/50 shadow-lg flex items-center justify-center">
                {logo ? (
                  <img src={logo} alt="Logo salon" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-10 h-10 text-stone-500" />
                )}
              </div>
            </div>

            {/* Logo Controls */}
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h4 className="text-sm font-bold text-white">Logo de l'établissement</h4>
              <p className="text-xs text-stone-400">
                Collez l'URL HTTPS de votre logo (hébergement public ou Supabase Storage). Les fichiers base64
                ne sont pas persistés.
              </p>
              <input
                type="url"
                value={logo}
                onChange={(e) => handleLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className="w-full bg-[#121214] border border-[#2d2d33] rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* Photo de couverture */}
          <div className="pt-4 border-t border-[#232328] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Bannière / Photo de couverture</h4>
                <p className="text-[11px] text-stone-400">Arrière-plan principal de votre établissement</p>
              </div>

              <input
                type="url"
                value={coverImage}
                onChange={(e) => handleCoverUrl(e.target.value)}
                placeholder="https://…/couverture.jpg"
                className="w-full max-w-xs bg-[#121214] border border-[#2d2d33] rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="relative aspect-[21/9] sm:aspect-[24/8] rounded-xl overflow-hidden bg-black/50 border border-[#28282d]">
              <img src={coverImage} alt="Couverture" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-4">
                <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  Aperçu de la couverture actuelle
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: INFOS OFFICIELLES DU SALON */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <Building2 className="w-4 h-4 text-[#C9A45C]" />
            <span>Informations Légales & Présentation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Nom officiel du salon *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Le Gentleman Barbershop"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Type d'établissement</label>
              <select
                value={salonType}
                onChange={(e) => setSalonType(e.target.value as SalonType)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                <option value="barbershop">Barbershop (Coiffure Homme & Barbe)</option>
                <option value="salon_femme">Salon de coiffure Femme</option>
                <option value="salon_mixte">Salon Mixte (Hommes & Femmes)</option>
                <option value="institut">Institut de beauté & Esthétique</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Slogan accrocheur (Marketplace)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ex: Barbershop haut de gamme au cœur de la Riviera"
              className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">
              Description complète de l'établissement
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Présentez l'histoire de votre salon, votre expertise, vos produits et le confort réservé à vos clients..."
              className="w-full bg-[#111113] border border-[#29292e] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Tarif minimum de départ (FCFA)
              </label>
              <input
                type="number"
                required
                min="500"
                step="500"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Devise de facturation</label>
              <input
                type="text"
                disabled
                value="FCFA (XOF) - Franc CFA Ouest Africain"
                className="w-full bg-[#161619] border border-[#252528] rounded-xl px-3.5 py-2.5 text-xs text-stone-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: COORDONNÉES PROFESSIONNELLES */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <Phone className="w-4 h-4 text-[#C9A45C]" />
            <span>Coordonnées Professionnelles & Canaux Directs</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Téléphone professionnel (Appels) *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 07 08 45 12 89"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Numéro WhatsApp Business *
              </label>
              <input
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+225 07 08 45 12 89"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-medium focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Email professionnel de contact
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@legentleman.ci"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: LOCALISATION GÉOGRAPHIQUE */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <MapPin className="w-4 h-4 text-[#C9A45C]" />
            <span>Localisation Géographique (Abidjan)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Pays</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Ville</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Commune *</label>
              <select
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
              >
                <option value="Cocody">Cocody</option>
                <option value="Marcory">Marcory</option>
                <option value="Plateau">Plateau</option>
                <option value="Treichville">Treichville</option>
                <option value="Yopougon">Yopougon</option>
                <option value="Koumassi">Koumassi</option>
                <option value="Port-Bouët">Port-Bouët</option>
                <option value="Abobo">Abobo</option>
                <option value="Adjamé">Adjamé</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Quartier</label>
              <input
                type="text"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="Ex: Riviera 2 / Zone 4 / Vallon"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Adresse précise & Repère
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Rue des Jardins, en face de la pharmacie"
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: HORAIRES D'OUVERTURE */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <Clock className="w-4 h-4 text-[#C9A45C]" />
            <span>Horaires d'Ouverture du Salon</span>
          </div>

          <div className="space-y-2">
            {openingHours.map((hour, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#111113] border border-[#242428]"
              >
                <div className="flex items-center gap-3 sm:w-40">
                  <input
                    type="checkbox"
                    id={`open-${idx}`}
                    checked={hour.isOpen}
                    onChange={(e) => handleHourChange(idx, 'isOpen', e.target.checked)}
                    className="rounded border-[#29292e] bg-[#1a1a1d] text-[#C9A45C] focus:ring-0"
                  />
                  <label htmlFor={`open-${idx}`} className="text-xs font-bold text-white cursor-pointer">
                    {hour.day}
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {hour.isOpen ? (
                    <>
                      <input
                        type="time"
                        value={hour.open}
                        onChange={(e) => handleHourChange(idx, 'open', e.target.value)}
                        className="bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                      />
                      <span className="text-stone-500">à</span>
                      <input
                        type="time"
                        value={hour.close}
                        onChange={(e) => handleHourChange(idx, 'close', e.target.value)}
                        className="bg-[#18181b] border border-[#2a2a2e] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                      />
                    </>
                  ) : (
                    <span className="text-xs text-stone-500 italic">Fermé toute la journée</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 6: MODES DE PAIEMENT */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <CreditCard className="w-4 h-4 text-[#C9A45C]" />
            <span>Moyens de Paiement Autorisés</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { id: 'wave', label: 'Wave Mobile Money' },
              { id: 'orange_money', label: 'Orange Money' },
              { id: 'mtn_momo', label: 'MTN Mobile Money' },
              { id: 'moov_money', label: 'Moov Money' },
              { id: 'cash', label: 'Espèces (Au salon)' },
              { id: 'card', label: 'Carte Bancaire (TPE)' },
            ].map((item) => {
              const isChecked = paymentMethods.includes(item.id as PaymentMethod);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleMethod(item.id as PaymentMethod)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                    isChecked
                      ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                      : 'bg-[#111113] border-[#29292e] text-stone-400 hover:border-stone-500'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 7: GESTION DES SUCCURSALES */}
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#242428] pb-3">
            <Building2 className="w-4 h-4 text-[#C9A45C]" />
            <span>Gestion des Succursales</span>
          </div>
          {!isAuthenticated ? (
            <p className="text-xs text-stone-400">
              La gestion des succursales est disponible dans un espace authentifié.
            </p>
          ) : branchesLoading ? (
            <p className="text-xs text-stone-400">Chargement des succursales…</p>
          ) : branchesError ? (
            <div className="space-y-3">
              <p role="alert" className="text-xs text-red-300">
                {branchesError}
              </p>
              <button
                type="button"
                onClick={() => void reloadBranches()}
                className="text-xs text-[#C9A45C] underline"
              >
                Réessayer
              </button>
            </div>
          ) : branches.length === 0 ? (
            <p className="text-xs text-stone-400">Aucune succursale configurée.</p>
          ) : (
            <>
              <label className="text-[11px] font-semibold text-stone-300 block mb-2">Succursale</label>
              <select
                value={selectedBranch?.id || ''}
                onChange={(e) => {
                  const b = branches.find((x) => x.id === e.target.value);
                  setSelectedBranch(b ?? null);
                }}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C] mb-4"
              >
                <option value="">— Choisir une succursale —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {selectedBranch && (
                <BranchHoursManager
                  salonId={activeSalon.id}
                  branchId={selectedBranch.id}
                  branchName={selectedBranch.name}
                />
              )}
            </>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm py-4 rounded-2xl shadow-xl hover:shadow-[0_0_25px_rgba(201,164,92,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Enregistrer toutes les modifications du salon</span>
          </button>
        </div>
      </form>
    </div>
  );
};
