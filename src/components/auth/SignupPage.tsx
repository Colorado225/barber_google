import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Scissors } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'client' as 'client' | 'professional',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    if (formData.password.length < 12) {
      alert('Le mot de passe doit contenir au moins 12 caractères');
      return;
    }
    setLoading(true);
    try {
      // TODO: Connect to auth
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#C9A45C] mb-2">Barber Cuts</h1>
          <h2 className="text-2xl font-bold text-[#f7f6f2] mb-2">Créer un compte</h2>
          <p className="text-[#a9a9a9]">Rejoignez la plateforme Barber Cuts</p>
        </div>

        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#f7f6f2] mb-2">
                Type de compte
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, accountType: 'client' })}
                  className={`p-4 rounded-lg border transition-colors ${
                    formData.accountType === 'client'
                      ? 'border-[#C9A45C] bg-[#C9A45C]/10 text-[#C9A45C]'
                      : 'border-[#2a2a2b] text-[#a9a9a9] hover:border-[#3a3a3b]'
                  }`}
                >
                  <User className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Client</p>
                  <p className="text-xs mt-1">Réserver un RDV</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, accountType: 'professional' })}
                  className={`p-4 rounded-lg border transition-colors ${
                    formData.accountType === 'professional'
                      ? 'border-[#C9A45C] bg-[#C9A45C]/10 text-[#C9A45C]'
                      : 'border-[#2a2a2b] text-[#a9a9a9] hover:border-[#3a3a3b]'
                  }`}
                >
                  <Scissors className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">Professionnel</p>
                  <p className="text-xs mt-1">Gérer mon salon</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f7f6f2] mb-2">
                Nom complet
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C] transition-colors"
                  placeholder="Jean Kouassi"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f7f6f2] mb-2">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  minLength={12}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C] transition-colors"
                  placeholder="Minimum 12 caractères"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f7f6f2] mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C] transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Création...' : "Créer mon compte"}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#a9a9a9]">
              Déjà un compte ?{' '}
              <Link to="/connexion" className="text-[#C9A45C] hover:underline font-medium">
                Se connecter
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
