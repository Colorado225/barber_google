import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Scissors,
  Star,
  XCircle,
} from 'lucide-react';
import {
  cancelMarketplaceBooking,
  getBookingPortal,
  submitBookingReview,
  type BookingPortal,
} from '../../lib/marketplace';
import { bookingPortalUrl, forgetBookingLink, saveBookingLink } from '../../lib/bookingVault';
import { useOptionalApp } from '../../context/AppContext';

const STATUS_LABEL: Record<string, { label: string; tone: string; hint: string }> = {
  pending: {
    label: 'En attente de confirmation',
    tone: 'bg-amber-950 text-amber-300 border-amber-500/40',
    hint: 'Le salon doit valider votre créneau.',
  },
  confirmed: {
    label: 'Confirmée',
    tone: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    hint: 'Votre créneau est réservé. Présentez-vous à l’heure indiquée.',
  },
  checked_in: {
    label: 'Arrivée enregistrée',
    tone: 'bg-sky-950 text-sky-300 border-sky-500/40',
    hint: 'Le salon a enregistré votre arrivée.',
  },
  in_progress: {
    label: 'Prestation en cours',
    tone: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
    hint: 'Votre prestation a commencé.',
  },
  completed: {
    label: 'Prestation terminée',
    tone: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    hint: 'Merci de votre visite !',
  },
  cancelled: {
    label: 'Annulée',
    tone: 'bg-red-950 text-red-300 border-red-500/40',
    hint: 'Cette réservation n’est plus active.',
  },
  no_show: {
    label: 'Non présenté',
    tone: 'bg-stone-800 text-stone-300 border-stone-600',
    hint: 'Le salon a signalé une absence.',
  },
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: 'À régler au salon',
  deposit_paid: 'Acompte versé',
  paid: 'Réglé',
  refunded: 'Remboursé',
};

const TIER_LABEL: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', vip: 'VIP' };

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${date} à ${time}`;
}

export const BookingPortalView: React.FC = () => {
  const { token = '' } = useParams();
  const { formatPrice, addToast } = useOptionalApp();
  const [portal, setPortal] = useState<BookingPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBookingPortal(token);
      setPortal(data);
      saveBookingLink({
        token,
        appointmentId: data.booking.id,
        salonId: data.salon.id,
        salonName: data.salon.name,
        serviceName: data.booking.serviceName,
        startsAt: data.booking.startsAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réservation introuvable.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async () => {
    if (!portal) return;
    setBusy(true);
    try {
      await cancelMarketplaceBooking(
        portal.salon.id,
        portal.booking.id,
        token,
        'Annulée par le client depuis son lien de suivi',
      );
      await load();
      addToast('Votre réservation est annulée.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Annulation impossible.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await submitBookingReview(token, rating, comment.trim());
      setComment('');
      await load();
      addToast('Merci ! Votre avis vérifié est publié.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Envoi de l’avis impossible.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const url = bookingPortalUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Copie impossible : sélectionnez le lien manuellement.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-stone-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement de votre réservation…
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Réservation introuvable</h1>
        <p className="text-sm text-stone-400">{error ?? 'Ce lien de suivi n’est plus valide.'}</p>
        <Link to="/" className="inline-flex items-center gap-2 text-[#C9A45C] text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Retour à la marketplace
        </Link>
      </div>
    );
  }

  const { booking, salon } = portal;
  const status = STATUS_LABEL[booking.status] ?? STATUS_LABEL.pending;
  const whatsapp = salon.whatsapp.replace(/[^0-9]/g, '');

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/mes-reservations"
          className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Mes réservations
        </Link>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <header className="bg-[#18181b] border border-[#26262a] rounded-3xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#C9A45C] font-semibold">
              Ma réservation
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">{salon.name}</h1>
            <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />{' '}
              {[salon.address, salon.commune, salon.city].filter(Boolean).join(', ')}
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${status.tone}`}
          >
            {status.label}
          </span>
        </div>
        <p className="text-xs text-stone-300">{status.hint}</p>

        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#111113] border border-[#26262a] rounded-2xl p-3">
            <p className="text-stone-500 flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5" /> Prestation
            </p>
            <p className="text-white font-bold mt-1">{booking.serviceName}</p>
            {booking.staffName && <p className="text-stone-400 mt-0.5">avec {booking.staffName}</p>}
          </div>
          <div className="bg-[#111113] border border-[#26262a] rounded-2xl p-3">
            <p className="text-stone-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Créneau
            </p>
            <p className="text-[#E5C378] font-bold mt-1">{formatWhen(booking.startsAt)}</p>
            <p className="text-stone-400 mt-0.5">
              {PAYMENT_LABEL[booking.paymentStatus] ?? booking.paymentStatus} · {formatPrice(booking.amount)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {portal.canCancel && (
            <button
              onClick={() => void handleCancel()}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 text-red-300 text-xs font-semibold inline-flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Annuler ma réservation
            </button>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Bonjour ${salon.name}, je vous contacte au sujet de ma réservation #${booking.id.slice(0, 8)}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Contacter le salon
            </a>
          )}
          <button
            onClick={() => void handleCopy()}
            className="px-4 py-2 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-300 text-xs font-semibold inline-flex items-center gap-2"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Lien copié' : 'Copier mon lien de suivi'}
          </button>
        </div>
        <p className="text-[11px] text-stone-500">
          Ce lien est personnel : il permet de suivre et d’annuler cette réservation sans créer de compte.
          Conservez-le.
        </p>
      </header>

      {portal.loyalty && (
        <section className="bg-[#18181b] border border-[#26262a] rounded-3xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Gift className="w-6 h-6 text-[#C9A45C]" />
            <div>
              <p className="text-sm font-bold text-white">
                Carte de fidélité — {TIER_LABEL[portal.loyalty.tier] ?? portal.loyalty.tier}
              </p>
              <p className="text-xs text-stone-400">
                {portal.loyalty.pointsEarned > 0
                  ? `+${portal.loyalty.pointsEarned} points crédités pour cette prestation réglée.`
                  : 'Les points sont crédités une fois la prestation terminée et réglée.'}
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold text-[#E5C378] whitespace-nowrap">
            {portal.loyalty.pointsBalance} pts
          </p>
        </section>
      )}

      {portal.canReview && (
        <section className="bg-[#18181b] border border-[#C9A45C]/30 rounded-3xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-white">Votre prestation est terminée : donnez votre avis</h2>
          <p className="text-xs text-stone-400">
            Votre avis sera marqué « vérifié » car il est rattaché à une prestation réellement réalisée.
          </p>
          <form onSubmit={handleReview} className="space-y-3">
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Note sur 5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} étoile${value > 1 ? 's' : ''}`}
                  onClick={() => setRating(value)}
                >
                  <Star
                    className={`w-7 h-7 ${value <= rating ? 'text-[#E5C378] fill-[#E5C378]' : 'text-stone-600'}`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              required
              placeholder="Décrivez votre expérience (accueil, ponctualité, résultat)…"
              className="w-full bg-[#121214] border border-[#2d2d33] rounded-xl px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              disabled={busy || comment.trim().length < 3}
              className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] disabled:opacity-50 text-[#101010] text-xs font-bold"
            >
              {busy ? 'Envoi…' : 'Publier mon avis vérifié'}
            </button>
          </form>
        </section>
      )}

      {portal.review && (
        <section className="bg-[#18181b] border border-[#26262a] rounded-3xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Votre avis</h2>
            {portal.review.verified && (
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                VÉRIFIÉ
              </span>
            )}
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <Star
                key={v}
                className={`w-4 h-4 ${v <= portal.review!.rating ? 'text-[#E5C378] fill-[#E5C378]' : 'text-stone-600'}`}
              />
            ))}
          </div>
          <p className="text-xs text-stone-300">{portal.review.comment}</p>
        </section>
      )}

      <section className="bg-[#18181b] border border-[#26262a] rounded-3xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-white">Historique</h2>
        <ol className="space-y-2">
          {portal.timeline.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="flex items-start gap-3 text-xs">
              <span className="mt-1 w-2 h-2 rounded-full bg-[#C9A45C] shrink-0" />
              <div>
                <p className="text-white font-semibold">
                  {STATUS_LABEL[event.status]?.label ?? event.status}
                </p>
                <p className="text-stone-500">
                  {formatWhen(event.createdAt)}
                  {event.reason ? ` — ${event.reason}` : ''}
                </p>
              </div>
            </li>
          ))}
          {portal.timeline.length === 0 && (
            <li className="text-xs text-stone-500">Aucun événement enregistré.</li>
          )}
        </ol>
      </section>

      <button
        onClick={() => {
          forgetBookingLink(token);
          addToast('Lien retiré de cet appareil.', 'success');
        }}
        className="text-[11px] text-stone-500 hover:text-stone-300"
      >
        Retirer ce lien de suivi de cet appareil
      </button>
    </div>
  );
};
