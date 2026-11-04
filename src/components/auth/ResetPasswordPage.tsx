import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Supabase Auth exchanges the recovery callback for a session before this page
 * updates the password.
 */
export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      await resetPassword(password);
      setDone(true);
      setTimeout(() => navigate('/connexion'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-5">
        <h1 className="text-2xl font-bold text-[#f7f6f2] text-center">Nouveau mot de passe</h1>
        {error && (
          <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {done ? (
          <p className="text-sm text-emerald-300">
            Mot de passe mis à jour. Redirection vers la connexion…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Nouveau mot de passe', value: password, set: setPassword },
              { label: 'Confirmer', value: confirm, set: setConfirm },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm text-[#f7f6f2] mb-2">{field.label}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                  <input
                    type="password"
                    required
                    minLength={12}
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
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a] disabled:opacity-50"
            >
              Mettre à jour
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
