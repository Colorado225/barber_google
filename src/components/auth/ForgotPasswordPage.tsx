import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseAuthErrorMessage } from '../../lib/auth-errors';
import { isSupabaseConfigured } from '../../lib/supabase';

export interface ForgotPasswordPageProps {
  supabaseConfigured?: boolean;
}

/**
 * Demande de réinitialisation du mot de passe.
 * La réponse est toujours neutre : elle ne révèle pas si l'adresse existe.
 */
export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  supabaseConfigured = isSupabaseConfigured(),
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      setError('La réinitialisation est momentanément indisponible : la configuration Supabase manque.');
      return;
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(normalized);
      setSent(true);
    } catch (err) {
      setError(getSupabaseAuthErrorMessage(err, 'reset-request'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Mot de passe oublié</h1>
          <p className="text-sm text-[#a9a9a9] mt-2">Recevez un lien pour définir un nouveau mot de passe.</p>
        </div>
        {!supabaseConfigured && (
          <p
            role="alert"
            className="text-xs text-amber-200 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2"
          >
            La réinitialisation du mot de passe est momentanément indisponible : la configuration Supabase
            manque.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}
        {sent ? (
          <div className="space-y-3 text-sm text-[#a9a9a9]">
            <p>
              Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé. Pensez
              à vérifier vos courriers indésirables.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
              <input
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
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
