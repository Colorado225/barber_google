import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, SalonType, OpeningHour } from '../../types';
import {
  Store,
  Upload,
  Image as ImageIcon,
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
  Info
} from 'lucide-react';

export const SalonProfileSettingsView: React.FC = () => {
  const { activeSalon, updateSalonDetails, setSelectedSalonForModal, formatPrice } = useApp();

  // Basic Info
  const [name, setName] = useState(activeSalon.name);
  const [tagline, setTagline] = useState(activeSalon.tagline);
  const [description, setDescription] = useState(activeSalon.description);
  const [salonType, setSalonType] = useState<SalonType>(activeSalon.type);

  // Logo & Branding
  const [logo, setLogo] = useState(activeSalon.logo || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=128&q=80');
  const [coverImage, setCoverImage] = useState(activeSalon.coverImage);

  // Contacts
  const [phone, setPhone] = useState(activeSalon.phone);
  const [whatsapp, setWhatsapp] = useState(activeSalon.whatsapp);
  const [email, setEmail] = useState(activeSalon.email);

  // Localization
  const [country, setCountry] = useState(activeSalon.country || "Côte d'Ivoire");
  const [city, setCity] = useState(activeSalon.city || 'Abidjan');
  const [commune, setCommune] = useState(activeSalon.commune || 'Cocody');
  const [quarter, setQuarter] = useState(activeSalon.quarter || 'Riviera 2');
  const [address, setAddress] = useState(activeSalon.address || 'Rue des Jardins');

  // Commercial & Pricing
  const [minPrice, setMinPrice] = useState(activeSalon.minPrice || 3000);
  const [currency] = useState(activeSalon.currency || 'FCFA');

  // Opening hours
  const defaultHours: OpeningHour[] = [
    { day: 'Lundi', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Mardi', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Mercredi', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Jeudi', open: '09:00', close: '21:00', isOpen: true },
    { day: 'Vendredi', open: '08:30', close: '22:00', isOpen: true },
    { day: 'Samedi', open: '08:30', close: '22:00', isOpen: true },
    { day: 'Dimanche', open: '10:00', close: '18:00', isOpen: true }
  ];
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(
    activeSalon.openingHours && activeSalon.openingHours.length > 0 ? activeSalon.openingHours : defaultHours
  );

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(activeSalon.paymentMethods || ['wave', 'orange_money', 'cash']);

  const toggleMethod = (m: PaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const handleHourChange = (index: number, field: keyof OpeningHour, value: any) => {
    setOpeningHours((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setLogo(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setCoverImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSalonDetails(activeSalon.id, {
      name,
      tagline,
      description,
      type: salonType,
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
      minPrice: Number(minPrice),
      openingHours,
      paymentMethods
    });
  };

  const logoPresets = [
    { label: 'Doré Vintage', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=128&q=80' },
    { label: 'Ciseaux Or', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=128&q=80' },
    { label: 'Urban Black', url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=128&q=80' },
    { label: 'Classic Barber', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=128&q=80' }
  ];

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
            Configurez l'identité officielle de votre salon : logo, coordonnées professionnelles, horaires et tarifs.
          </p>
        </div>

        <button
          onClick={() => setSelectedSalonForModal({ ...activeSalon, name, logo, coverImage, tagline, description })}
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
              <label className="absolute -bottom-2 -right-2 bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] p-1.5 rounded-full cursor-pointer shadow-md transition-transform group-hover:scale-110">
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Logo Controls */}
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h4 className="text-sm font-bold text-white">Logo de l'établissement</h4>
              <p className="text-xs text-stone-400">
                Format carré recommandé (PNG, JPG ou SVG). Visible sur la Marketplace, les reçus et les tickets WhatsApp.
              </p>

              {/* Presets */}
              <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                {logoPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLogo(preset.url)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-stone-300 border border-[#2e2e34] transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Photo de couverture */}
          <div className="pt-4 border-t border-[#232328] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Bannière / Photo de couverture</h4>
                <p className="text-[11px] text-stone-400">Arrière-plan principal de votre établissement</p>
              </div>

              <label className="bg-[#242429] hover:bg-[#2c2c32] text-stone-200 border border-[#393940] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>Remplacer l'image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </label>
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
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Type d'établissement
              </label>
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
                onChange={(e) => setMinPrice(Number(e.target.value))}
                className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">
                Devise de facturation
              </label>
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
              { id: 'card', label: 'Carte Bancaire (TPE)' }
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
