import React, { useState } from 'react';
import { useOptionalApp } from '../../context/AppContext';
import { Salon, Service, PaymentMethod } from '../../types';
import {
  X,
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  Calendar as CalendarIcon,
  User,
  ShieldCheck,
  CreditCard,
  Banknote,
  Send
} from 'lucide-react';

interface SalonDetailModalProps {
  salon: Salon;
  onClose: () => void;
}

export const SalonDetailModal: React.FC<SalonDetailModalProps> = ({ salon, onClose }) => {
  const {
    services,
    staff,
    reviews,
    formatPrice,
    bookAppointment,
    addReview
  } = useOptionalApp();

  const salonServices = services.filter((s) => s.salonId === salon.id);
  const salonStaff = staff.filter((s) => s.salonId === salon.id);
  const salonReviews = reviews.filter((r) => r.salonId === salon.id);

  // Rating shown publicly is computed from real reviews (no invented value).
  const averageRating = salonReviews.length
    ? Math.round((salonReviews.reduce((acc, r) => acc + r.rating, 0) / salonReviews.length) * 10) / 10
    : null;

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'prestations' | 'equipe' | 'avis' | 'infos'>('prestations');

  // Review form state (real reviews, persisted in the store).
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Selected gallery image
  const [activeImage, setActiveImage] = useState<string>(salon.coverImage ?? '');

  // Booking state
  const [selectedService, setSelectedService] = useState<Service | null>(salonServices[0] ?? null);

  const [selectedStaffId, setSelectedStaffId] = useState<string>('any');

  // Generate 5 days starting today
  const today = new Date();
  const dateOptions = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName =
      i === 0
        ? 'Auj.'
        : i === 1
        ? 'Demain'
        : new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(d);
    return { dateStr, label: dayName };
  });

  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0].dateStr);

  const timeSlots: string[] = [];

  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentMethod>('cash');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingSuccessData, setBookingSuccessData] = useState<{
    id: string;
    clientName: string;
    date: string;
    time: string;
    serviceName: string;
    staffName: string;
    price: number;
    paymentMethod: PaymentMethod;
  } | null>(null);

  // Group services by category
  const categories = [
    { key: 'coupe', label: 'COUPE' },
    { key: 'barbe', label: 'BARBE' },
    { key: 'combo', label: 'FORMULES & COMBOS' },
    { key: 'visage', label: 'SOIN DU VISAGE' },
    { key: 'soins', label: 'SOINS CAPILLAIRES' },
    { key: 'coloration', label: 'COLORATION' }
  ];

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedTime) {
      alert('Aucune prestation ou disponibilité réelle n’est actuellement chargée.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Veuillez renseigner votre nom et votre numéro de téléphone.');
      return;
    }

    setIsBookingSubmitting(true);

    const result = await bookAppointment({
      salonId: salon.id,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      serviceId: selectedService.id,
      staffId: selectedStaffId,
      date: selectedDate,
      time: selectedTime,
      paymentMethod: paymentChoice,
      notes: `Réservé sur la marketplace Barber Cuts`
    });

    setIsBookingSubmitting(false);

    if (result.success && result.appointment) {
      setBookingSuccessData({
        id: result.appointment.id,
        clientName: result.appointment.clientName,
        date: result.appointment.date,
        time: result.appointment.time,
        serviceName: result.appointment.serviceName,
        staffName: result.appointment.staffName,
        price: result.appointment.price,
        paymentMethod: result.appointment.paymentMethod || paymentChoice
      });
    } else {
      alert(result.error || 'Erreur lors de la réservation.');
    }
  };

  const getWhatsAppBookingText = () => {
    if (!bookingSuccessData) return '';
    const text = `Bonjour ${salon.name} ! Je confirme mon rendez-vous pris sur Barber Cuts :
✂️ Prestation : ${bookingSuccessData.serviceName} (${formatPrice(bookingSuccessData.price)})
📅 Date : ${bookingSuccessData.date} à ${bookingSuccessData.time}
💈 Barbier : ${bookingSuccessData.staffName}
👤 Client : ${bookingSuccessData.clientName}
💳 Réf : #${bookingSuccessData.id}`;
    return encodeURIComponent(text);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl bg-[#141416] border border-[#2a2a2e] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Close Button Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-[#1e1e22]/90 border border-white/10 text-stone-300 hover:text-white flex items-center justify-center transition-all hover:scale-105"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scrollable Container */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 lg:p-8">
          {/* Top Gallery Row */}
          {(() => {
            const currentItem = salon.galleryItems?.find((g) => g.url === activeImage);
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="md:col-span-2 relative aspect-[16/9] rounded-2xl overflow-hidden bg-stone-900 border border-[#26262a]">
                  <img
                    src={activeImage}
                    alt={salon.name}
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

                  {/* Title and Description of the selected photo */}
                  <div className="absolute bottom-3 left-3 right-3 bg-[#111114]/90 backdrop-blur-md p-3.5 rounded-xl border border-white/10 shadow-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#C9A45C] text-[#101010]">
                        Photo Vitrine
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">
                        {currentItem?.title || salon.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-snug line-clamp-2">
                      {currentItem?.description || salon.tagline}
                    </p>
                  </div>
                </div>

                {/* Gallery Thumbnails */}
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5 h-full overflow-y-auto max-h-[300px] md:max-h-none pr-1">
                  {(salon.galleryItems || (salon.gallery ?? []).map((url, i) => ({ id: `img-${i}`, url, title: '', description: '' }))).map((item, idx) => (
                    <button
                      key={item.id || idx}
                      onClick={() => setActiveImage(item.url)}
                      className={`relative aspect-[16/10] md:aspect-auto md:h-full rounded-xl overflow-hidden border-2 transition-all group text-left ${
                        activeImage === item.url ? 'border-[#C9A45C] scale-[0.98]' : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-[10px] font-bold text-white truncate">{item.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Main Content Layout: Left Details / Right Booking Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Salon Info, Tabs & Catalog */}
            <div className="lg:col-span-7 space-y-6">
              {/* Salon Header with Logo */}
              <div className="flex items-start gap-4">
                {salon.logo && (
                  <img
                    src={salon.logo}
                    alt={salon.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#C9A45C]/50 shadow-md shrink-0 mt-1"
                  />
                )}
                <div className="flex-1">
                  <span className="text-xs uppercase tracking-wider text-[#C9A45C] font-semibold">
                    {salon.type === 'barbershop' ? 'Barbershop' : 'Salon de beauté'}
                  </span>
                  <h1 className="text-3xl font-extrabold text-white mt-0.5 mb-2 font-serif-luxury">
                    {salon.name}
                  </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-stone-300">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{averageRating === null ? '—' : averageRating.toFixed(1)}</span>
                    <span className="text-stone-400 font-normal">
                      ({salonReviews.length} avis)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-stone-400">
                    <MapPin className="w-4 h-4 text-stone-500" />
                    <span>{salon.address}</span>
                  </div>
                </div>

                <p className="mt-3 text-stone-300 text-sm leading-relaxed">
                  {salon.description}
                </p>

                {/* Direct Contact Buttons */}
                <div className="flex items-center gap-3 mt-4">
                  <a
                    href={`tel:${salon.phone}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202024] border border-[#2f2f35] text-xs font-semibold text-stone-200 hover:text-white hover:border-stone-400 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#C9A45C]" />
                    <span>Appeler</span>
                  </a>

                  {salon.whatsapp && (
                    <a
                      href={`https://wa.me/${salon.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202024] border border-[#2f2f35] text-xs font-semibold text-stone-200 hover:text-white hover:border-emerald-500 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

              {/* Sub-Tabs Nav */}
              <div className="flex items-center gap-2 border-b border-[#26262a] pb-2">
                {[
                  { key: 'prestations', label: 'Prestations' },
                  { key: 'equipe', label: 'Équipe' },
                  { key: 'avis', label: 'Avis' },
                  { key: 'infos', label: 'Infos' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === tab.key
                        ? 'bg-[#242429] text-[#C9A45C] border border-[#C9A45C]/30 shadow-sm'
                        : 'text-stone-400 hover:text-white hover:bg-[#1a1a1d]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: PRESTATIONS */}
              {activeTab === 'prestations' && (
                <div className="space-y-6">
                  {categories.map((cat) => {
                    const servicesInCat = salonServices.filter((s) => s.category === cat.key);
                    if (servicesInCat.length === 0) return null;

                    return (
                      <div key={cat.key} className="space-y-2.5">
                        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                          {cat.label}
                        </h3>
                        <div className="space-y-2">
                          {servicesInCat.map((srv) => {
                            const isSelected = selectedService?.id === srv.id;
                            return (
                              <div
                                key={srv.id}
                                onClick={() => setSelectedService(srv)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                                  isSelected
                                    ? 'bg-[#1e1c18] border-[#C9A45C] shadow-[0_0_15px_rgba(201,164,92,0.15)]'
                                    : 'bg-[#18181b] border-[#27272c] hover:border-stone-500 hover:bg-[#1d1d21]'
                                }`}
                              >
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white">{srv.name}</h4>
                                    {srv.popular && (
                                      <span className="text-[10px] bg-[#C9A45C]/20 text-[#E5C378] font-semibold px-2 py-0.5 rounded-full">
                                        Populaire
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-stone-400 line-clamp-2">
                                    {srv.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                                    <Clock className="w-3 h-3 text-stone-500" />
                                    <span>{srv.durationMinutes} min</span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                                  <span className="text-sm font-extrabold text-[#E5C378]">
                                    {formatPrice(srv.price)}
                                  </span>
                                  <span
                                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                                      isSelected
                                        ? 'bg-[#C9A45C] text-[#101010] font-bold'
                                        : 'bg-[#27272c] text-stone-300'
                                    }`}
                                  >
                                    {isSelected ? 'Sélectionnée' : 'Choisir'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab: ÉQUIPE */}
              {activeTab === 'equipe' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {salonStaff.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedStaffId(member.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        selectedStaffId === member.id
                          ? 'bg-[#1e1c18] border-[#C9A45C]'
                          : 'bg-[#18181b] border-[#27272c] hover:border-stone-500'
                      }`}
                    >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-13 h-13 rounded-full object-cover border border-[#C9A45C]/30 shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">{member.name}</h4>
                          <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{member.rating}</span>
                          </div>
                        </div>
                        <span className="text-xs text-[#C9A45C] block capitalize font-medium">
                          {member.role.replace('_', ' ')}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {member.specialties.map((spec, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-[#232328] text-stone-400 px-1.5 py-0.5 rounded"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: AVIS */}
              {activeTab === 'avis' && (
                <div className="space-y-3">
                  {/* Add review */}
                  <div className="p-4 rounded-xl bg-[#18181b] border border-[#27272c]">
                    {!isReviewFormOpen ? (
                      <button
                        onClick={() => setIsReviewFormOpen(true)}
                        className="w-full text-xs font-semibold text-[#C9A45C] hover:text-[#E5C378] transition-colors flex items-center justify-center gap-1.5 py-1 cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Laisser un avis
                      </button>
                    ) : (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!reviewAuthor.trim() || !reviewComment.trim()) return;
                          try {
                            await addReview({
                              salonId: salon.id,
                              author: reviewAuthor.trim(),
                              rating: reviewRating,
                              comment: reviewComment.trim()
                            });
                            setReviewAuthor('');
                            setReviewComment('');
                            setReviewRating(5);
                            setIsReviewFormOpen(false);
                          } catch {
                            // The context reports the API error; keep the draft available.
                          }
                        }}
                        className="space-y-3"
                      >
                        <input
                          type="text"
                          required
                          value={reviewAuthor}
                          onChange={(e) => setReviewAuthor(e.target.value)}
                          placeholder="Votre nom"
                          className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C]"
                        />
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setReviewRating(n)}
                              aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                              className="cursor-pointer"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  n <= reviewRating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-stone-600'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          required
                          rows={3}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Votre expérience dans ce salon…"
                          className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C]"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsReviewFormOpen(false)}
                            className="px-3 py-1.5 rounded-lg bg-[#232328] text-stone-400 hover:text-white text-xs font-semibold cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold cursor-pointer"
                          >
                            Publier
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {salonReviews.length === 0 && (
                    <p className="text-center text-xs text-stone-500 py-6">
                      Aucun avis pour ce salon. Soyez le premier à partager votre expérience.
                    </p>
                  )}

                  {salonReviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-xl bg-[#18181b] border border-[#27272c]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{rev.author}</span>
                          {rev.verified && (
                            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              Client Vérifié
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400">{rev.date}</span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-xs text-stone-300 leading-relaxed italic">
                        « {rev.comment} »
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: INFOS */}
              {activeTab === 'infos' && (
                <div className="space-y-4 text-xs text-stone-300 bg-[#18181b] p-5 rounded-2xl border border-[#27272c]">
                  <h4 className="font-bold text-white text-sm">Horaires d'ouverture</h4>
                  <div className="space-y-1.5">
                    {(salon.openingHours ?? []).map((h, i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-[#232326]">
                        <span className="font-medium text-stone-400">{h.day}</span>
                        <span className={h.isOpen ? 'text-white' : 'text-stone-500'}>
                          {h.isOpen ? `${h.open} - ${h.close}` : 'Fermé'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <h4 className="font-bold text-white text-sm pt-2">Moyens de paiement acceptés</h4>
                  <div className="flex flex-wrap gap-2">
                    {(salon.paymentMethods ?? []).map((m) => (
                      <span
                        key={m}
                        className="px-2.5 py-1 rounded-lg bg-[#222226] text-stone-200 border border-[#303036] font-semibold uppercase text-[10px]"
                      >
                        {m.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: BOOKING WIDGET (RÉSERVER) */}
            <div className="lg:col-span-5 sticky top-4">
              <div className="bg-[#19191c] border border-[#2a2a2f] rounded-2xl p-5 shadow-xl space-y-4">
                <div className="border-b border-[#28282d] pb-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#C9A45C]">
                    RÉSERVER
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <h3 className="font-bold text-white text-base">{selectedService?.name ?? 'Aucune prestation renseignée'}</h3>
                    <span className="font-extrabold text-[#E5C378] text-base">
                      {selectedService ? formatPrice(selectedService.price) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-1">
                    <Clock className="w-3.5 h-3.5 text-stone-500" />
                    {selectedService && <span>Durée : {selectedService.durationMinutes} minutes</span>}
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  {/* Step 1: Select Staff */}
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-2">
                      Collaborateur
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStaffId('any')}
                        className={`text-xs p-2 rounded-xl border text-center transition-all ${
                          selectedStaffId === 'any'
                            ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C] font-bold'
                            : 'bg-[#141416] border-[#29292e] text-stone-400 hover:text-white'
                        }`}
                      >
                        Sans préférence
                      </button>
                      {salonStaff.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedStaffId(st.id)}
                          className={`text-xs p-2 rounded-xl border text-center truncate transition-all ${
                            selectedStaffId === st.id
                              ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C] font-bold'
                              : 'bg-[#141416] border-[#29292e] text-stone-400 hover:text-white'
                          }`}
                        >
                          {st.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Select Date */}
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-2">
                      Date
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {dateOptions.map((opt) => (
                        <button
                          key={opt.dateStr}
                          type="button"
                          onClick={() => setSelectedDate(opt.dateStr)}
                          className={`text-xs py-2 px-1 rounded-xl border text-center font-medium transition-all ${
                            selectedDate === opt.dateStr
                              ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]'
                              : 'bg-[#141416] border-[#29292e] text-stone-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: Select Time Slot */}
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-2">
                      Créneau horaire
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {timeSlots.map((slot) => {
                        const isSelected = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`text-xs py-2 rounded-lg border text-center transition-all ${
                              isSelected
                                ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]'
                                : 'bg-[#141416] border-[#29292e] text-stone-300 hover:border-stone-500'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                    {timeSlots.length === 0 && (
                      <p className="mt-2 text-xs text-stone-500">
                        Les disponibilités réelles ne sont pas accessibles pour cette réservation publique.
                      </p>
                    )}
                  </div>

                  {/* Step 4: Client Coordinates */}
                  <div className="space-y-2 pt-2 border-t border-[#26262a]">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                        Votre Nom & Prénom *
                      </label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ex: Armand Kouadio"
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                        Numéro WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Ex: 07 49 10 20 30"
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
                      />
                    </div>
                  </div>

                  {/* Step 5: Payment method */}
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1.5">
                      Mode de règlement
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentChoice('cash')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          paymentChoice === 'cash'
                            ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                            : 'bg-[#141416] border-[#29292e] text-stone-400'
                        }`}
                      >
                        <Banknote className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-white">Sur place</div>
                          <div className="text-[10px] text-stone-400">Espèces au salon</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentChoice('wave')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          paymentChoice === 'wave' || paymentChoice === 'orange_money'
                            ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                            : 'bg-[#141416] border-[#29292e] text-stone-400'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 shrink-0 text-cyan-400" />
                        <div>
                          <div className="text-xs font-bold text-white">Mobile Money</div>
                          <div className="text-[10px] text-stone-400">Wave / Orange</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <button
                    type="submit"
                    disabled={isBookingSubmitting}
                    className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm py-3.5 rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmer la réservation</span>
                  </button>

                  <p className="text-[11px] text-center text-stone-500">
                    Paiement sur place ou par Mobile Money • Annulation gratuite
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* BOOKING SUCCESS MODAL OVERLAY */}
        {bookingSuccessData && (
          <div className="absolute inset-0 bg-[#0e0e10]/95 backdrop-blur-lg z-30 flex items-center justify-center p-6 animate-in zoom-in-95">
            <div className="max-w-md w-full bg-[#18181b] border border-[#C9A45C]/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-xs font-semibold text-[#C9A45C] uppercase tracking-wider">
                  RÉSERVATION CONFIRMÉE
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  Merci {bookingSuccessData.clientName} !
                </h3>
                <p className="text-xs text-stone-300 mt-1">
                  Votre créneau a été réservé avec succès chez <span className="font-semibold text-white">{salon.name}</span>.
                </p>
              </div>

              {/* Booking Recap Card */}
              <div className="bg-[#111113] p-4 rounded-2xl border border-[#26262a] text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Prestation :</span>
                  <span className="font-bold text-white">{bookingSuccessData.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Date & Heure :</span>
                  <span className="font-bold text-[#E5C378]">{bookingSuccessData.date} à {bookingSuccessData.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Collaborateur :</span>
                  <span className="font-bold text-white">{bookingSuccessData.staffName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Total à régler :</span>
                  <span className="font-bold text-white">{formatPrice(bookingSuccessData.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Règlement :</span>
                  <span className="font-bold uppercase text-stone-200">
                    {bookingSuccessData.paymentMethod.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* WhatsApp notification action */}
              <a
                href={salon.whatsapp ? `https://wa.me/${salon.whatsapp.replace(/[^0-9]/g, '')}?text=${getWhatsAppBookingText()}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer confirmation sur WhatsApp au salon</span>
              </a>

              <button
                onClick={() => {
                  setBookingSuccessData(null);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-300 text-xs font-semibold transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
