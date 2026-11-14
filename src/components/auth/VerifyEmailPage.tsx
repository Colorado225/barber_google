import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck, MailWarning } from 'lucide-react';
import { useAuth, type EmailVerificationOtpType } from '../../context/AuthContext';
import { getSupabaseAuthErrorMessage } from '../../lib/auth-errors';
import {
  buildPlanSelectionQuery,
  parsePlanSelectionFromSearch,
  readPlanSelectionIntent,
  savePlanSelectionIntent,
} from '../../lib/saasPricing';
import { isSupabaseConfigured } from '../../lib/supabase';

const VALID_OTP_TYPES = new Set<EmailVerificationOtpType>(['signup', 'email', 'email_change', 'magiclink']);

function parseHashParams(hash: string): URLSearchParams {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(clean);
}

export interface VerifyEmailPageProps {
  supabaseConfigured?: boolean;
}

/**
 * Écran de vérification d'adresse e-mail.
 * - `/verifier-email?token_hash=…&type=signup|email` ou `?code=…` ou `#access_token=…` consomme le lien reçu par e-mail.
 * - `/verifier-email` (sans jeton) propose de renvoyer le lien.
 */
export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  supabaseConfigured = isSupabaseConfigured(),
}) => {
  const [params] = useSearchParams();
  const hashString = typeof window !== 'undefined' ? window.location.hash : '';

  const callback = useMemo(() => {
    const hashParams = parseHashParams(hashString);
    const tokenHash = params.get('token_hash') ?? hashParams.get('token_hash');
    const rawType = params.get('type') ?? hashParams.get('type');
    const otpType: EmailVerificationOtpType =
      rawType && VALID_OTP_TYPES.has(rawType as EmailVerificationOtpType)
        ? (rawType as EmailVerificationOtpType)
        : 'signup';
    const code = params.get('code');
    const hasImplicitToken = Boolean(hashParams.get('access_token'));
    const errorCode = params.get('error_code') ?? hashParams.get('error_code');
    const errorDescription =
      params.get('error_description') ??
      hashParams.get('error_description') ??
      params.get('error') ??
      hashParams.get('error');
    const hasCallbackError = Boolean(errorCode || errorDescription);

    return {
      tokenHash,
      otpType,
      code,
      hasImplicitToken,
      errorCode,
      errorDescription,
      hasCallbackError,
    };
  }, [hashString, params]);

  const email = params.get('email') ?? '';
  const rawSearch = params.toString();
  const urlIntent = parsePlanSelectionFromSearch(rawSearch ? `?${rawSearch}` : '');
  const planIntent = urlIntent ?? readPlanSelectionIntent();
  const planQuerySuffix = buildPlanSelectionQuery(planIntent);

  const initialCallbackError = callback.hasCallbackError
    ? getSupabaseAuthErrorMessage(
        { code: callback.errorCode ?? undefined, message: callback.errorDescription ?? '' },
        'verify',
      )
    : null;

  const [state, setState] = useState<'idle' | 'loading' | 'verified' | 'resent' | 'error'>(
    callback.tokenHash || callback.code ? 'loading' : callback.hasCallbackError ? 'error' : 'idle',
  );
  const [message, setMessage] = useState<string | null>(initialCallbackError);
  const [resendEmail, setResendEmail] = useState(email);
  const [resending, setResending] = useState(false);
  const { user, isAuthenticated, verifyEmail, exchangeAuthCode, resendVerification } = useAuth();

  useEffect(() => {
    if (urlIntent) {
      savePlanSelectionIntent(urlIntent);
    }
  }, [urlIntent]);

  useEffect(() => {
    if (email && !resendEmail) {
      setResendEmail(email);
    }
  }, [email, resendEmail]);

  useEffect(() => {
    if (callback.hasImplicitToken && isAuthenticated && user?.emailVerified && !callback.hasCallbackError) {
      setState('verified');
      setMessage('Votre adresse e-mail est confirmée. Vous pouvez accéder à votre espace.');
    }
  }, [callback.hasCallbackError, callback.hasImplicitToken, isAuthenticated, user?.emailVerified]);

  useEffect(() => {
    if (!callback.tokenHash && !callback.code) return;
    if (!supabaseConfigured) {
      setState('error');
      setMessage('La vérification est momentanément indisponible : la configuration Supabase manque.');
      return;
    }

    let cancelled = false;
    setState('loading');
    setMessage(null);

    const runVerification = async () => {
      if (callback.tokenHash) {
        await verifyEmail(callback.tokenHash, callback.otpType);
      } else if (callback.code) {
        if (exchangeAuthCode) {
          await exchangeAuthCode(callback.code);
        } else {
          throw new Error('PKCE exchange unavailable');
        }
      }
    };

    runVerification()
      .then(() => {
        if (cancelled) return;
        setState('verified');
        setMessage('Votre adresse e-mail est confirmée.');
      })
      .catch((e) => {
        if (cancelled) return;
        setState('error');
        setMessage(getSupabaseAuthErrorMessage(e, 'verify'));
      });

    return () => {
      cancelled = true;
    };
  }, [
    callback.code,
    callback.otpType,
    callback.tokenHash,
    exchangeAuthCode,
    supabaseConfigured,
    verifyEmail,
  ]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      setState('error');
      setMessage('L’envoi d’e-mail est momentanément indisponible : la configuration Supabase manque.');
      return;
    }

    const normalized = resendEmail.trim().toLowerCase();
    if (!normalized) {
      setState('error');
      setMessage('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setMessage(null);
    setResending(true);
    try {
      await resendVerification(normalized);
      setState('resent');
      setMessage(
        'Si un compte non vérifié existe pour cette adresse, un nouvel e-mail de confirmation vient d’être envoyé. Pensez à vérifier vos courriers indésirables.',
      );
    } catch (err) {
      setState('error');
      setMessage(getSupabaseAuthErrorMessage(err, 'resend'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-5">
        {!supabaseConfigured && (
          <p
            role="alert"
            className="text-xs text-amber-200 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2"
          >
            La vérification d’adresse e-mail est momentanément indisponible : la configuration Supabase
            manque.
          </p>
        )}

        {state === 'loading' && (
          <div className="flex items-center gap-3 text-[#f7f6f2]">
            <Loader2 className="w-5 h-5 animate-spin text-[#C9A45C]" />
            <span>Vérification en cours…</span>
          </div>
        )}

        {state === 'verified' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-[#f7f6f2]">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">E-mail vérifié</p>
                <p className="text-sm text-[#a9a9a9] mt-1">{message}</p>
              </div>
            </div>
            {isAuthenticated && user?.emailVerified && (
              <Link
                to={planIntent ? `/app/abonnement${planQuerySuffix}` : '/app'}
                className="block w-full text-center py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a]"
              >
                Continuer vers mon espace
              </Link>
            )}
          </div>
        )}

        {state === 'resent' && (
          <div className="flex items-start gap-3 text-[#f7f6f2]">
            <MailCheck className="w-5 h-5 text-[#C9A45C] mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">E-mail renvoyé</p>
              <p className="text-sm text-[#a9a9a9] mt-1">{message}</p>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div role="alert" className="flex items-start gap-3 text-[#f7f6f2]">
            <MailWarning className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Vérification impossible</p>
              <p className="text-sm text-[#a9a9a9] mt-1">{message}</p>
            </div>
          </div>
        )}

        {state !== 'loading' && state !== 'verified' && (
          <form onSubmit={handleResend} className="space-y-3" aria-busy={resending}>
            <label htmlFor="verify-resend-email" className="block text-sm text-[#f7f6f2]">
              Renvoyer le lien de vérification
            </label>
            <input
              id="verify-resend-email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="w-full px-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
            />
            <button
              type="submit"
              disabled={resending || !supabaseConfigured}
              aria-busy={resending}
              className="w-full py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? 'Envoi en cours…' : "Renvoyer l'e-mail"}
            </button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link to={`/connexion${planQuerySuffix}`} className="text-[#C9A45C] hover:underline">
            Aller à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
};
