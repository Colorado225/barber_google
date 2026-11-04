import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Demande de réinitialisation du mot de passe.
 * La réponse est toujours neutre : elle ne révèle pas si l'adresse existe.
 */
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demande impossible.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Mot de passe oublié</h1>
          <p className="text-sm text-[#a9a9a9] mt-2">
            Recevez un lien pour définir un nouveau mot de passe.
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {sent ? (
          <div className="space-y-3 text-sm text-[#a9a9a9]">
            <p>
              Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a]"
            >
              Envoyer le lien
              <ArrowRight className="w-5 h-5" />
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
