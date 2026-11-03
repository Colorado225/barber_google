import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#C9A45C] mb-2">Barber Cuts</h1>
          <h2 className="text-2xl font-bold text-[#f7f6f2] mb-2">Connexion</h2>
          <p className="text-[#a9a9a9]">Accédez à votre espace professionnel ou client</p>
        </div>

        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-8">
          {error && (
            <p
              role="alert"
              className="mb-5 text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#f7f6f2] mb-2">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C] transition-colors"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f7f6f2] mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C] transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link to="/mot-de-passe-oublie" className="text-sm text-[#C9A45C] hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#a9a9a9]">
              Pas encore de compte ?{' '}
              <Link to="/inscription" className="text-[#C9A45C] hover:underline font-medium">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-[#a9a9a9] hover:text-[#f7f6f2]">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
};
