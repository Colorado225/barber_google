import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailWarning, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Écran de vérification d'adresse e-mail.
 * - `/verifier-email?token_hash=…&type=signup` consomme le lien reçu par e-mail.
 * - `/verifier-email` (sans jeton) propose de renvoyer le lien.
 */
export const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const tokenHash = params.get('token_hash');
  const callbackError = params.get('error_description');
  const email = params.get('email') ?? '';
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(tokenHash ? 'loading' : callbackError ? 'error' : 'idle');
  const [message, setMessage] = useState<string | null>(callbackError);
  const [resendEmail, setResendEmail] = useState(email);
  const { verifyEmail, resendVerification } = useAuth();

  useEffect(() => {
    if (!tokenHash) return;
    let cancelled = false;
    verifyEmail(tokenHash)
      .then(() => {
        if (cancelled) return;
        setState('done');
        setMessage('Adresse e-mail vérifiée.');
      })
      .catch((e) => {
        if (cancelled) return;
        setState('error');
        setMessage(e instanceof Error ? e.message : 'Lien invalide ou expiré.');
      });
    return () => {
      cancelled = true;
    };
  }, [tokenHash, verifyEmail]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await resendVerification(resendEmail);
      setState('done');
      setMessage('Si un compte non vérifié existe, un e-mail a été envoyé.');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Envoi impossible.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-5">
        {state === 'loading' && (
          <div className="flex items-center gap-3 text-[#f7f6f2]">
            <Loader2 className="w-5 h-5 animate-spin text-[#C9A45C]" />
            <span>Vérification en cours…</span>
          </div>
        )}
        {state === 'done' && (
          <div className="flex items-start gap-3 text-[#f7f6f2]">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-semibold">E-mail vérifié</p>
              <p className="text-sm text-[#a9a9a9] mt-1">{message}</p>
            </div>
          </div>
        )}
        {state === 'error' && (
          <div className="flex items-start gap-3 text-[#f7f6f2]">
            <MailWarning className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-semibold">Vérification impossible</p>
              <p className="text-sm text-[#a9a9a9] mt-1">{message}</p>
            </div>
          </div>
        )}

        {state !== 'loading' && (
          <form onSubmit={handleResend} className="space-y-3">
            <label className="block text-sm text-[#f7f6f2]">Renvoyer le lien de vérification</label>
            <input
              type="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="w-full px-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a]"
            >
              Renvoyer l'e-mail
            </button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link to="/connexion" className="text-[#C9A45C] hover:underline">
            Aller à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
};
