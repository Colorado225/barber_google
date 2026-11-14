import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  cancelMarketplaceBooking,
  getBookingPortal,
  revokeBookingToken,
  rotateBookingToken,
  submitBookingReview,
  type BookingPortal,
} from '../../lib/marketplace';
import {
  bookingPortalUrl,
  clearActiveBookingToken,
  forgetBookingLink,
  isBookingSavedOnDevice,
  redactBookingSecrets,
  replaceSavedBookingToken,
  resolveBookingToken,
  saveBookingLink,
  setActiveBookingToken,
} from '../../lib/bookingVault';
import { applyStrictPortalPrivacy } from '../../lib/portalIsolation';
import { useUI } from '../../context/UIContext';

export interface BookingPortalApi {
  getBookingPortal: typeof getBookingPortal;
  cancelMarketplaceBooking: typeof cancelMarketplaceBooking;
  submitBookingReview: typeof submitBookingReview;
  rotateBookingToken: typeof rotateBookingToken;
  revokeBookingToken: typeof revokeBookingToken;
}

const DEFAULT_PORTAL_API: BookingPortalApi = {
  getBookingPortal,
  cancelMarketplaceBooking,
  submitBookingReview,
  rotateBookingToken,
  revokeBookingToken,
};

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

export const BookingPortalView: React.FC<{ api?: BookingPortalApi }> = ({ api = DEFAULT_PORTAL_API }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token: paramToken = '' } = useParams();
  const { formatPrice, addToast } = useUI();

  const stateToken = ((location.state as { bookingToken?: string } | null)?.bookingToken ?? '').trim();
  const resolvedToken = useMemo(
    () =>
      resolveBookingToken({
        stateToken,
        hash: location.hash,
        search: location.search,
        paramToken,
      }),
    [stateToken, location.hash, location.search, paramToken],
  );

  const [activeToken, setActiveToken] = useState<string>(() => resolvedToken);
  const [portal, setPortal] = useState<BookingPortal | null>(null);
  const [loading, setLoading] = useState(Boolean(resolvedToken));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedOnDevice, setSavedOnDevice] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'rotate' | 'revoke' | null>(null);
  const [rotatedNotice, setRotatedNotice] = useState(false);
  const [revokedSalonName, setRevokedSalonName] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Politique de référent stricte (`no-referrer`), désindexation (`noindex`) et
  // suppression des ressources tierces (polices externes) sur le portail.
  useEffect(() => applyStrictPortalPrivacy({ title: 'Ma réservation — Barber Cuts' }), []);

  // Dès qu'un jeton arrive via l'URL (#fragment, :token historique ou ?token=),
  // on le place dans `sessionStorage` et on nettoie immédiatement la barre d'adresse
  // pour éviter son exposition dans l'historique, les journaux ou les outils analytiques.
  useEffect(() => {
    if (!resolvedToken) return;
    setActiveToken((prev) => (prev === resolvedToken ? prev : resolvedToken));
    setActiveBookingToken(resolvedToken);

    const hasTokenInUrl = Boolean(paramToken) || Boolean(location.hash) || Boolean(location.search);
    if (hasTokenInUrl) {
      navigate('/reservation', {
        replace: true,
        state: { bookingToken: resolvedToken },
      });
    }
  }, [resolvedToken, paramToken, location.hash, location.search, navigate]);

  const load = useCallback(
    async (targetToken: string, options?: { background?: boolean }) => {
      if (!targetToken) {
        setLoading(false);
        return;
      }
      if (!options?.background) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await api.getBookingPortal(targetToken);
        setPortal(data);
        const alreadySaved = isBookingSavedOnDevice({
          token: targetToken,
          appointmentId: data.booking.id,
        });
        setSavedOnDevice(alreadySaved);
        // N'écrit dans `localStorage` que si cet appareil avait déjà mémorisé cette réservation.
        if (alreadySaved) {
          saveBookingLink({
            token: targetToken,
            appointmentId: data.booking.id,
            salonId: data.salon.id,
            salonName: data.salon.name,
            serviceName: data.booking.serviceName,
            startsAt: data.booking.startsAt,
          });
        }
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'Réservation introuvable.';
        setError(redactBookingSecrets(rawMessage, targetToken));
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const portalLoadedRef = React.useRef(false);
  portalLoadedRef.current = Boolean(portal);

  useEffect(() => {
    if (revokedSalonName) return;
    if (!activeToken) {
      setLoading(false);
      return;
    }
    void load(activeToken, { background: portalLoadedRef.current });
  }, [activeToken, load, revokedSalonName]);

  const handleCancel = async () => {
    if (!portal || !activeToken) return;
    setBusy(true);
    try {
      await api.cancelMarketplaceBooking(
        portal.salon.id,
        portal.booking.id,
        activeToken,
        'Annulée par le client depuis son lien de suivi',
      );
      await load(activeToken);
      addToast('Votre réservation est annulée.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Annulation impossible.';
      addToast(redactBookingSecrets(msg, activeToken), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeToken) return;
    setBusy(true);
    try {
      await api.submitBookingReview(activeToken, rating, comment.trim());
      setComment('');
      await load(activeToken);
      addToast('Merci ! Votre avis vérifié est publié.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Envoi de l’avis impossible.';
      addToast(redactBookingSecrets(msg, activeToken), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!activeToken) return;
    const url = bookingPortalUrl(activeToken);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Copie impossible sur ce navigateur.', 'error');
    }
  };

  const handleToggleSaveOnDevice = () => {
    if (!portal || !activeToken) return;
    if (savedOnDevice) {
      forgetBookingLink(activeToken, portal.booking.id);
      setSavedOnDevice(false);
      addToast('Lien retiré de cet appareil.', 'success');
    } else {
      saveBookingLink({
        token: activeToken,
        appointmentId: portal.booking.id,
        salonId: portal.salon.id,
        salonName: portal.salon.name,
        serviceName: portal.booking.serviceName,
        startsAt: portal.booking.startsAt,
      });
      setSavedOnDevice(true);
      addToast('Lien mémorisé sur cet appareil uniquement.', 'success');
    }
  };

  const handleRotateToken = async () => {
    if (!portal || !activeToken) return;
    setBusy(true);
    try {
      const result = await api.rotateBookingToken(activeToken);
      const nextToken = result.token;
      setActiveBookingToken(nextToken);
      replaceSavedBookingToken(activeToken, nextToken, portal.booking.id);
      setActiveToken(nextToken);
      setConfirmAction(null);
      setRotatedNotice(true);
      navigate('/reservation', {
        replace: true,
        state: { bookingToken: nextToken },
      });
      addToast('Nouveau lien secret généré : l’ancien lien est désormais invalide.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Renouvellement du lien impossible.';
      addToast(redactBookingSecrets(msg, activeToken), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!portal || !activeToken) return;
    setBusy(true);
    try {
      await api.revokeBookingToken(activeToken);
      clearActiveBookingToken();
      forgetBookingLink(activeToken, portal.booking.id);
      setSavedOnDevice(false);
      setConfirmAction(null);
      setRevokedSalonName(portal.salon.name);
      setPortal(null);
      setActiveToken('');
      navigate('/reservation', { replace: true, state: null });
      addToast('Accès par lien révoqué définitivement.', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Révocation du lien impossible.';
      addToast(redactBookingSecrets(msg, activeToken), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (revokedSalonName) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-20 text-center space-y-4">
        <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Lien secret révoqué</h1>
        <p className="text-sm text-stone-300">
          L’accès autonome par lien pour votre réservation chez{' '}
          <strong className="text-white">{revokedSalonName}</strong> a été désactivé. L’ancien lien ne permet
          plus de consulter ni d’annuler ce rendez-vous.
        </p>
        <p className="text-xs text-stone-400">
          Si vous devez modifier ou annuler votre créneau ensuite, contactez directement le salon.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 text-[#C9A45C] text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Retour à la marketplace
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-stone-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement de votre réservation…
      </div>
    );
  }

  if (error || !portal || !activeToken) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Réservation introuvable</h1>
        <p className="text-sm text-stone-400">
          {error ?? 'Ce lien de suivi n’est plus valide ou a été révoqué.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/mes-reservations"
            className="inline-flex items-center gap-2 text-stone-300 hover:text-white text-sm font-semibold"
          >
            Mes réservations mémorisées
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-[#C9A45C] text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Retour à la marketplace
          </Link>
        </div>
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
          type="button"
          onClick={() => void load(activeToken)}
          className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <header className="bg-[#18181b] border border-[#26262a] rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
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
              type="button"
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
              referrerPolicy="no-referrer"
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Contacter le salon
            </a>
          )}
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="px-4 py-2 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-300 text-xs font-semibold inline-flex items-center gap-2"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Lien copié' : 'Copier mon lien secret'}
          </button>
          <button
            type="button"
            onClick={handleToggleSaveOnDevice}
            className="px-4 py-2 rounded-xl bg-[#232328] hover:bg-[#2c2c32] text-stone-300 text-xs font-semibold inline-flex items-center gap-2"
          >
            {savedOnDevice ? (
              <>
                <BookmarkCheck className="w-4 h-4 text-[#C9A45C]" /> Retirer de cet appareil
              </>
            ) : (
              <>
                <BookmarkPlus className="w-4 h-4" /> Mémoriser sur cet appareil
              </>
            )}
          </button>
        </div>

        <div
          role="note"
          aria-label="Sécurité du lien de réservation"
          className="rounded-2xl border border-amber-500/35 bg-amber-950/20 p-3.5 text-xs space-y-1.5"
        >
          <p className="font-bold text-amber-200 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            Ce lien est un secret d’accès
          </p>
          <p className="text-stone-300 leading-relaxed">
            Toute personne possédant ce lien peut consulter les détails de votre rendez-vous, l’annuler ou
            déposer un avis en votre nom — sans mot de passe. Ne le partagez pas et ne le mémorisez pas sur un
            appareil partagé.
          </p>
        </div>
      </header>

      <section
        aria-label="Gestion du lien secret"
        className="bg-[#18181b] border border-[#26262a] rounded-3xl p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#C9A45C]" /> Contrôle de votre lien d’accès
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Si ce lien a été partagé par erreur ou ouvert sur un autre appareil, vous pouvez le renouveler
              ou le révoquer immédiatement.
            </p>
          </div>
          {booking.tokenRotatedAt && (
            <span className="text-[11px] text-stone-400">
              Dernier renouvellement : {formatWhen(booking.tokenRotatedAt)}
            </span>
          )}
        </div>

        {rotatedNotice && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              Nouveau lien secret actif : l’ancien lien ne fonctionne plus. Pensez à copier ce nouveau lien.
            </span>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
            >
              Copier le nouveau lien
            </button>
          </div>
        )}

        {confirmAction === null && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction('rotate')}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-[#232328] hover:bg-[#2c2c32] disabled:opacity-50 text-stone-200 text-xs font-semibold inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C9A45C]" /> Renouveler le lien secret
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('revoke')}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 disabled:opacity-50 border border-red-500/30 text-red-300 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Révoquer définitivement le lien
            </button>
          </div>
        )}

        {confirmAction === 'rotate' && (
          <div className="rounded-2xl border border-[#C9A45C]/40 bg-[#111113] p-4 space-y-3 text-xs">
            <p className="text-white font-semibold">Générer un nouveau lien secret et invalider l’ancien ?</p>
            <p className="text-stone-400">
              L’ancien lien (y compris dans les e-mails ou messages déjà envoyés) cessera immédiatement de
              fonctionner. Les prochains rappels automatiques utiliseront le nouveau lien.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleRotateToken()}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] disabled:opacity-50 text-[#101010] font-bold"
              >
                {busy ? 'Renouvellement…' : 'Confirmer le renouvellement'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-[#232328] text-stone-300 font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {confirmAction === 'revoke' && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 space-y-3 text-xs">
            <p className="text-red-200 font-semibold">
              Désactiver définitivement l’accès par lien pour cette réservation ?
            </p>
            <p className="text-stone-300">
              Une fois révoqué, ni vous ni personne d’autre ne pourrez plus consulter, annuler ou noter ce
              rendez-vous via un lien. Pour toute modification ultérieure, il faudra contacter le salon
              directement.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleRevokeToken()}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold"
              >
                {busy ? 'Révocation…' : 'Confirmer la révocation'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-[#232328] text-stone-300 font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

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
    </div>
  );
};
