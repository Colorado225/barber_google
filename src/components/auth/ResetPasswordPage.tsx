import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseAuthErrorMessage } from '../../lib/auth-errors';
import { isSupabaseConfigured } from '../../lib/supabase';

export interface ResetPasswordPageProps {
  supabaseConfigured?: boolean;
}

/**
 * Supabase Auth exchanges the recovery callback for a session before this page
 * updates the password.
 */
export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  supabaseConfigured = isSupabaseConfigured(),
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword, exchangeAuthCode } = useAuth();

  useEffect(() => {
    const hashParams =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
        : new URLSearchParams();
    const errorCode = searchParams.get('error_code') ?? hashParams.get('error_code');
    const errorDescription =
      searchParams.get('error_description') ??
      hashParams.get('error_description') ??
      searchParams.get('error') ??
      hashParams.get('error');

    if (errorCode || errorDescription) {
      setError(
        getSupabaseAuthErrorMessage(
          { code: errorCode ?? undefined, message: errorDescription ?? '' },
          'reset-password',
        ),
      );
      return;
    }

    const code = searchParams.get('code');
    if (code && supabaseConfigured && exchangeAuthCode) {
      void exchangeAuthCode(code).catch((err) => {
        setError(getSupabaseAuthErrorMessage(err, 'reset-password'));
      });
    }
  }, [exchangeAuthCode, searchParams, supabaseConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      setError('La réinitialisation est momentanément indisponible : la configuration Supabase manque.');
      return;
    }
    setError(null);
    if (password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(password);
      setDone(true);
      setTimeout(() => navigate('/connexion'), 1500);
    } catch (err) {
      setError(getSupabaseAuthErrorMessage(err, 'reset-password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-5">
        <h1 className="text-2xl font-bold text-[#f7f6f2] text-center">Nouveau mot de passe</h1>
        {!supabaseConfigured && (
          <p
            role="alert"
            className="text-xs text-amber-200 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2"
          >
            La réinitialisation est momentanément indisponible : la configuration Supabase manque.
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2 space-y-1.5"
          >
            <p>{error}</p>
            <Link to="/mot-de-passe-oublie" className="inline-block text-[#C9A45C] underline">
              Demander un nouveau lien
            </Link>
          </div>
        )}
        {done ? (
          <p className="text-sm text-emerald-300">Mot de passe mis à jour. Redirection vers la connexion…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            {[
              { id: 'reset-password', label: 'Nouveau mot de passe', value: password, set: setPassword },
              { id: 'reset-confirm', label: 'Confirmer', value: confirm, set: setConfirm },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm text-[#f7f6f2] mb-2">
                  {field.label}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                  <input
                    id={field.id}
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-[#a9a9a9]">12 caractères minimum.</p>
            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Mise à jour…' : 'Mettre à jour'}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>
        )}
        <div className="text-center text-sm">
          <Link to="/connexion" className="text-[#C9A45C] hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
};
