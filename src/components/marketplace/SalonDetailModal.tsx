import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalApp } from '../../context/AppContext';
import { bookingPortalPath, bookingPortalUrl, saveBookingLink } from '../../lib/bookingVault';
import { Salon } from '../../types';
import {
  getMarketplaceSalonDetail,
  getMarketplaceAvailability,
  type PublicSalonDetail,
  type PublicAvailabilitySlot,
  type PublicBooking,
} from '../../lib/marketplace';
import {
  X,
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  Calendar as CalendarIcon,
  ShieldCheck,
  Send,
  Loader2,
  AlertTriangle,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface SalonDetailModalProps {
  salon: Salon;
  onClose: () => void;
}

function abidjanDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export const SalonDetailModal: React.FC<SalonDetailModalProps> = ({ salon, onClose }) => {
  const { formatPrice, bookPublicAppointment, cancelPublicBooking, addToast } = useOptionalApp();

  const [detail, setDetail] = useState<PublicSalonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'prestations' | 'equipe' | 'avis' | 'infos'>('prestations');
  const [activeImage, setActiveImage] = useState<string>(salon.coverImage ?? '');

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('any');
  const [selectedDate, setSelectedDate] = useState<string>(abidjanDate(0));
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PublicAvailabilitySlot | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const dateStr = abidjanDate(i);
        const label =
          i === 0
            ? 'Auj.'
            : i === 1
              ? 'Demain'
              : new Intl.DateTimeFormat('fr-FR', {
                  timeZone: 'Africa/Abidjan',
                  weekday: 'short',
                  day: 'numeric',
                }).format(new Date(`${dateStr}T12:00:00Z`));
        return { dateStr, label };
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMarketplaceSalonDetail(salon.slug || salon.id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setActiveImage(d.salon.coverImage ?? '');
        setSelectedServiceId(d.services[0]?.id ?? '');
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fiche publique indisponible.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salon.id, salon.slug]);

  useEffect(() => {
    if (!detail || !selectedServiceId) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    getMarketplaceAvailability(
      detail.salon.id,
      selectedDate,
      selectedServiceId,
      selectedStaffId === 'any' ? null : selectedStaffId,
    )
      .then((rows) => {
        if (!cancelled) setSlots(rows);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail, selectedServiceId, selectedDate, selectedStaffId]);

  const publicSalon = detail?.salon ?? salon;
  const services = detail?.services ?? [];
  const staff = detail?.staff ?? [];
  const reviews = detail?.reviews ?? [];
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  // Créneaux affichés : agrégés par heure si « sans préférence ».
  const timeSlots = useMemo(() => {
    const available = slots.filter((s) => s.available);
    if (selectedStaffId !== 'any') return available;
    const byTime = new Map<string, PublicAvailabilitySlot>();
    for (const slot of available) if (!byTime.has(slot.time)) byTime.set(slot.time, slot);
    return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
  }, [slots, selectedStaffId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    if (!selectedService || !selectedSlot) {
      setBookingError('Sélectionnez une prestation et un créneau disponible.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      setBookingError('Nom et téléphone requis.');
      return;
    }
    setSubmitting(true);
    const result = await bookPublicAppointment({
      salonId: publicSalon.id,
      serviceId: selectedService.id,
      startsAt: selectedSlot.startsAt,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim() || null,
      staffId: selectedStaffId === 'any' ? null : selectedStaffId,
      notes: 'Réservation en ligne Barber Cuts',
    });
    setSubmitting(false);
    if (result.success && result.booking) {
      setBooking(result.booking);
      // Le lien de survit à la fermeture de cette fenêtre : suivi, annulation
      // puis avis vérifié restent possibles sans compte client.
      saveBookingLink({
        token: result.booking.cancelToken,
        appointmentId: result.booking.id,
        salonId: result.booking.salonId,
        salonName: publicSalon.name,
        serviceName: result.booking.serviceName,
        startsAt: result.booking.startsAt,
      });
      addToast('Réservation envoyée au salon (en attente de confirmation).', 'success');
    } else {
      setBookingError(result.error || 'Réservation impossible.');
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    const result = await cancelPublicBooking(
      booking.salonId,
      booking.id,
      booking.cancelToken,
      'Annulé par le client',
    );
    if (result.success && result.booking) {
      setBooking(result.booking);
      addToast('Réservation annulée.', 'info');
    } else {
      addToast(result.error || 'Annulation impossible.', 'error');
    }
  };

  const copyBookingLink = async () => {
    if (!booking) return;
    try {
      await navigator.clipboard.writeText(bookingPortalUrl(booking.cancelToken));
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      addToast('Copie impossible : ouvrez le lien puis copiez la barre d’adresse.', 'error');
    }
  };

  const whatsappText = booking
    ? encodeURIComponent(
        `Bonjour ${publicSalon.name} ! Je confirme ma réservation Barber Cuts :\n✂️ ${booking.serviceName} (${formatPrice(booking.amount)})\n📅 ${booking.startsAt.slice(0, 10)} à ${booking.startsAt.slice(11, 16)}\n👤 ${booking.clientName}\n🔖 Réf : #${booking.id.slice(0, 8)}`,
      )
    : '';

  const galleryItems =
    publicSalon.galleryItems ??
    (publicSalon.gallery ?? []).map((url, i) => ({ id: `img-${i}`, url, title: '', description: '' }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in">
      <div className="relative w-full max-w-6xl bg-[#141416] border border-[#2a2a2e] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-[#1e1e22]/90 border border-white/10 text-stone-300 hover:text-white flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 lg:p-8">
          {loading && (
            <div className="flex items-center justify-center py-20 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement de la fiche publique…
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="text-sm text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-4"
            >
              {error}
            </p>
          )}

          {detail && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="md:col-span-2 relative aspect-[16/9] rounded-2xl overflow-hidden bg-stone-900 border border-[#26262a]">
                  {activeImage ? (
                    <img src={activeImage} alt={publicSalon.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-600">
                      Aucune photo
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h4 className="text-sm font-bold text-white">{publicSalon.name}</h4>
                    <p className="text-[11px] text-stone-300">{publicSalon.tagline}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5 overflow-y-auto max-h-[300px]">
                  {galleryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveImage(item.url)}
                      className={`relative aspect-[16/10] rounded-xl overflow-hidden border-2 ${activeImage === item.url ? 'border-[#C9A45C]' : 'border-transparent opacity-75 hover:opacity-100'}`}
                    >
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#C9A45C] font-semibold">
                      <ShieldCheck className="w-4 h-4" />{' '}
                      {publicSalon.type === 'barbershop' ? 'Barbershop' : 'Salon'}
                      {publicSalon.isVerified && (
                        <span className="text-[10px] bg-[#C9A45C]/20 px-2 py-0.5 rounded-full">Certifié</span>
                      )}
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mt-1">{publicSalon.name}</h1>
                    <p className="text-sm text-stone-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />{' '}
                      {[publicSalon.commune, publicSalon.quarter, publicSalon.city]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {detail.rating !== null && (
                      <p className="text-sm text-amber-300 mt-1 flex items-center gap-1">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {detail.rating.toFixed(1)}{' '}
                        · {detail.reviewCount} avis vérifiés
                      </p>
                    )}
                    <p className="text-sm text-stone-300 mt-3">{publicSalon.description}</p>
                  </div>

                  <div className="flex gap-2 border-b border-[#26262a] pb-2">
                    {(['prestations', 'equipe', 'avis', 'infos'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${activeTab === tab ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'prestations' && (
                    <div className="space-y-2">
                      {services.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedServiceId(s.id)}
                          className={`w-full text-left p-3 rounded-xl border ${selectedServiceId === s.id ? 'border-[#C9A45C] bg-[#C9A45C]/10' : 'border-[#26262a] bg-[#18181b]'}`}
                        >
                          <div className="flex justify-between">
                            <span className="text-sm font-bold text-white">{s.name}</span>
                            <span className="text-sm font-bold text-[#E5C378]">{formatPrice(s.price)}</span>
                          </div>
                          <p className="text-[11px] text-stone-400">
                            {s.durationMinutes} min · {s.category}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {activeTab === 'equipe' && (
                    <div className="grid grid-cols-2 gap-3">
                      {staff.map((m) => (
                        <div key={m.id} className="p-3 rounded-xl bg-[#18181b] border border-[#26262a]">
                          <p className="text-sm font-bold text-white">{m.name}</p>
                          <p className="text-[11px] text-stone-400 capitalize">{m.role.replace('_', ' ')}</p>
                          <p className="text-[10px] text-stone-500 mt-1">{m.specialties.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'avis' && (
                    <div className="space-y-3">
                      {reviews.length === 0 && (
                        <p className="text-sm text-stone-500">Aucun avis vérifié pour le moment.</p>
                      )}
                      {reviews.map((r) => (
                        <div key={r.id} className="p-3 rounded-xl bg-[#18181b] border border-[#26262a]">
                          <div className="flex justify-between">
                            <span className="text-sm font-bold text-white">{r.author}</span>
                            <span className="text-xs text-amber-300 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {r.rating}
                            </span>
                          </div>
                          <p className="text-xs text-stone-300 mt-1">{r.comment}</p>
                          <p className="text-[10px] text-emerald-400 mt-1">Client vérifié · {r.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'infos' && (
                    <div className="space-y-2 text-sm text-stone-300">
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#C9A45C]" />{' '}
                        {publicSalon.address || 'Adresse non renseignée'}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#C9A45C]" />{' '}
                        {publicSalon.phone || 'Téléphone non renseigné'}
                      </p>
                      {detail.branches.map((b) => (
                        <div key={b.id} className="mt-3">
                          <p className="font-semibold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#C9A45C]" /> {b.name}
                          </p>
                          <ul className="text-[11px] text-stone-400 mt-1 space-y-0.5">
                            {b.hours.map((h) => (
                              <li key={h.weekday}>
                                {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][h.weekday]} :{' '}
                                {h.isOpen
                                  ? `${h.opensAt?.slice(0, 5)} – ${h.closesAt?.slice(0, 5)}`
                                  : 'Fermé'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5">
                  <div className="sticky top-0 bg-[#18181b] border border-[#2a2a2e] rounded-2xl p-5 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-[#C9A45C]" /> Réserver en ligne
                    </h3>
                    <div>
                      <label className="text-xs font-semibold text-stone-300 block mb-1">Prestation</label>
                      <select
                        value={selectedServiceId}
                        onChange={(e) => setSelectedServiceId(e.target.value)}
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white"
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {formatPrice(s.price)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-300 block mb-1">Collaborateur</label>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="any">Sans préférence</option>
                        {staff
                          .filter(
                            (m) =>
                              !selectedService ||
                              (m.serviceIds?.length ?? 0) === 0 ||
                              m.serviceIds?.includes(selectedService.id),
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-300 block mb-1">Date</label>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {dateOptions.map((opt) => (
                          <button
                            key={opt.dateStr}
                            type="button"
                            onClick={() => setSelectedDate(opt.dateStr)}
                            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${selectedDate === opt.dateStr ? 'bg-[#C9A45C] text-[#101010] font-bold' : 'bg-[#141416] border border-[#29292e] text-stone-400'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-300 block mb-1">
                        Créneau {slotsLoading && <Loader2 className="inline w-3 h-3 animate-spin" />}
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.startsAt + slot.staffId}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`text-xs py-2 rounded-lg border ${selectedSlot?.startsAt === slot.startsAt ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]' : 'bg-[#141416] border-[#29292e] text-stone-300 hover:border-stone-500'}`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                      {!slotsLoading && timeSlots.length === 0 && (
                        <p className="text-xs text-stone-500 mt-2">Aucun créneau disponible ce jour-là.</p>
                      )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-[#26262a]">
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nom & prénom *"
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="tel"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Téléphone / WhatsApp *"
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="E-mail (optionnel, pour le rappel)"
                        className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white"
                      />
                      {bookingError && (
                        <p role="alert" className="text-xs text-red-300">
                          {bookingError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={submitting || !selectedSlot}
                        className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-60 text-[#101010] font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />{' '}
                        {submitting ? 'Envoi…' : 'Confirmer la réservation'}
                      </button>
                      <p className="text-[11px] text-center text-stone-500">
                        Paiement au salon · Annulation gratuite avec votre lien secret
                      </p>
                    </form>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {booking && (
          <div className="absolute inset-0 bg-[#0e0e10]/95 backdrop-blur-lg z-30 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[#18181b] border border-[#C9A45C]/40 rounded-3xl p-6 text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-full border mx-auto flex items-center justify-center ${booking.status === 'cancelled' ? 'bg-red-950 border-red-500/40 text-red-400' : 'bg-emerald-950 border-emerald-500/40 text-emerald-400'}`}
              >
                {booking.status === 'cancelled' ? (
                  <AlertTriangle className="w-9 h-9" />
                ) : (
                  <CheckCircle2 className="w-9 h-9" />
                )}
              </div>
              <div>
                <span className="text-xs font-semibold text-[#C9A45C] uppercase tracking-wider">
                  {booking.status === 'cancelled'
                    ? 'RÉSERVATION ANNULÉE'
                    : booking.status === 'pending'
                      ? 'EN ATTENTE DE CONFIRMATION'
                      : 'RÉSERVATION CONFIRMÉE'}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">Merci {booking.clientName} !</h3>
                <p className="text-xs text-stone-300 mt-1">
                  {booking.status === 'pending'
                    ? 'Le salon doit confirmer votre créneau. Vous serez notifié dès confirmation.'
                    : 'Votre rendez-vous chez ' + publicSalon.name + '.'}
                </p>
              </div>
              <div className="bg-[#111113] p-4 rounded-2xl border border-[#26262a] text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Prestation :</span>
                  <span className="font-bold text-white">{booking.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Date & heure :</span>
                  <span className="font-bold text-[#E5C378]">
                    {booking.startsAt.slice(0, 10)} à {booking.startsAt.slice(11, 16)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Collaborateur :</span>
                  <span className="font-bold text-white">{booking.staffName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Total à régler au salon :</span>
                  <span className="font-bold text-white">{formatPrice(booking.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Réf :</span>
                  <span className="font-mono text-stone-300">#{booking.id.slice(0, 8)}</span>
                </div>
              </div>
              <div className="bg-[#111113] border border-[#C9A45C]/30 rounded-2xl p-3 text-left space-y-2">
                <p className="text-[11px] font-bold text-[#C9A45C] uppercase tracking-wider">
                  Ma réservation — lien de suivi
                </p>
                <p className="text-[11px] text-stone-400">
                  Gardez ce lien : il permet de suivre, annuler, puis noter votre prestation, même après
                  fermeture de cette fenêtre.
                </p>
                <div className="flex gap-2">
                  <Link
                    to={bookingPortalPath(booking.cancelToken)}
                    onClick={onClose}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> Suivre ma réservation
                  </Link>
                  <button
                    onClick={() => void copyBookingLink()}
                    className="py-2 px-3 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-300 text-xs font-semibold flex items-center gap-1"
                  >
                    {linkCopied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {linkCopied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>
              {booking.status !== 'cancelled' && publicSalon.whatsapp && (
                <a
                  href={`https://wa.me/${publicSalon.whatsapp.replace(/[^0-9]/g, '')}?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Contacter le salon sur WhatsApp
                </a>
              )}
              {booking.status !== 'cancelled' && (
                <button
                  onClick={handleCancel}
                  className="w-full py-2.5 rounded-xl bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-semibold"
                >
                  Annuler ma réservation
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-300 text-xs font-semibold"
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
