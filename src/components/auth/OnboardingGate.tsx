import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Garde d'accès de l'ERP (Lot 2).
 *
 * Aucun écran métier n'est affiché tant que l'utilisateur n'a pas :
 *  1. une session valide,
 *  2. une adresse e-mail vérifiée,
 *  3. au moins un membership actif (donc un salon autorisé côté serveur).
 *
 * Ce garde complète — il ne remplace pas — les contrôles serveur : chaque
 * requête est de nouveau vérifiée côté backend (permissions + RLS).
 */
export const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    loading,
    error: authError,
    isAuthenticated,
    user,
    onboarding,
    hasWorkspace,
    createSalon,
    refreshSession,
  } = useAuth();
  const [form, setForm] = useState({ organizationName: '', salonName: '', branchName: 'Principal' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] text-[#a9a9a9]">
        Chargement de votre espace…
      </div>
    );
  }

  if (authError) {
    const retry = async () => {
      setBusy(true);
      setError(null);
      try {
        await refreshSession();
      } catch (retryError) {
        setError(retryError instanceof Error ? retryError.message : 'La vérification de session a échoué.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d0d0e] px-4 text-center">
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Vérification de session impossible</h1>
        <p role="alert" className="max-w-lg text-sm text-red-300">
          {error ?? authError}
        </p>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={busy}
          className="px-5 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold disabled:opacity-50"
        >
          {busy ? 'Vérification…' : 'Réessayer'}
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d0d0e] px-4 text-center">
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Connexion requise</h1>
        <p className="text-sm text-[#a9a9a9]">L'espace de gestion est réservé aux comptes authentifiés.</p>
        <Link
          to="/connexion"
          className="px-5 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold flex items-center gap-2"
        >
          Se connecter <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d0d0e] px-4 text-center">
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Vérifiez votre adresse e-mail</h1>
        <p className="text-sm text-[#a9a9a9]">
          Un lien de vérification a été envoyé à <strong>{user.email}</strong>.
        </p>
        <Link
          to={`/verifier-email?email=${encodeURIComponent(user.email)}`}
          className="text-[#C9A45C] underline"
        >
          Renvoyer le lien
        </Link>
      </div>
    );
  }

  if (!hasWorkspace) {
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        await createSalon(form);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Création impossible.');
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4">
        <form
          onSubmit={submit}
          className="max-w-md w-full bg-[#151516] rounded-xl border border-[#2a2a2b] p-8 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-[#C9A45C]" />
            <h1 className="text-xl font-bold text-[#f7f6f2]">Créer votre établissement</h1>
          </div>
          <p className="text-sm text-[#a9a9a9]">
            Votre compte n'est rattaché à aucun salon. Créez l'établissement pour accéder à l'espace de
            gestion.
          </p>
          {error && (
            <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {(
            [
              ['organizationName', 'Organisation', 'Mon groupe'],
              ['salonName', 'Nom du salon', 'Le Roi du Dégradé'],
              ['branchName', 'Succursale', 'Principal'],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className="block text-sm text-[#f7f6f2] mb-2">{label}</label>
              <input
                required
                maxLength={120}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-[#0d0d0e] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold hover:bg-[#d4b26a] disabled:opacity-50"
          >
            {busy ? 'Création…' : 'Créer mon salon'}
          </button>
          {onboarding && (
            <p className="text-[11px] text-[#6b6b6b]">Étape en cours : {onboarding.currentStep}</p>
          )}
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
