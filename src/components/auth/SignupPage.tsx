import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Scissors, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseAuthErrorMessage } from '../../lib/auth-errors';
import {
  buildPlanSelectionQuery,
  formatSaasBillingPeriodLabel,
  parsePlanSelectionFromSearch,
  readPlanSelectionIntent,
  savePlanSelectionIntent,
} from '../../lib/saasPricing';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getPublicPlatformStatus } from '../../lib/platformSettings';

const KNOWN_PLAN_NAMES: Record<string, string> = {
  starter: 'Starter Solo',
  pro: 'Pro Équipe',
  prestige: 'Prestige & Chaînes',
};

export interface SignupPageProps {
  loadPlatformStatus?: typeof getPublicPlatformStatus;
}

export const SignupPage: React.FC<SignupPageProps> = ({ loadPlatformStatus = getPublicPlatformStatus }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supabaseConfigured = isSupabaseConfigured();

  const searchString = searchParams.toString();
  const urlIntent = parsePlanSelectionFromSearch(searchString ? `?${searchString}` : '');
  const planIntent = urlIntent ?? readPlanSelectionIntent();

  useEffect(() => {
    if (urlIntent) {
      savePlanSelectionIntent(urlIntent);
    }
  }, [urlIntent]);

  useEffect(() => {
    let cancelled = false;
    loadPlatformStatus()
      .then((status) => {
        if (!cancelled) {
          setMaintenanceMode(status.maintenanceMode);
        }
      })
      .catch(() => {
        // Ne pas bloquer l'affichage si la sonde publique échoue ponctuellement ;
        // create_salon() applique toujours maintenance_mode côté serveur.
      });
    return () => {
      cancelled = true;
    };
  }, [loadPlatformStatus]);

  const planQuerySuffix = buildPlanSelectionQuery(planIntent);
  const planDisplayName = planIntent?.planSlug
    ? (KNOWN_PLAN_NAMES[planIntent.planSlug] ?? planIntent.planSlug)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (maintenanceMode) {
      setError('Les nouvelles inscriptions sont temporairement suspendues (mode maintenance actif).');
      return;
    }
    if (!supabaseConfigured) {
      setError('La création de compte est momentanément indisponible. Supabase n’est pas configuré.');
      return;
    }

    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName) {
      setError('Veuillez saisir votre nom complet.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (planIntent) {
        savePlanSelectionIntent(planIntent);
      }
      const result = await signUp(normalizedName, normalizedEmail, password);
      if (result.status === 'authenticated') {
        navigate(planIntent ? `/app/abonnement${planQuerySuffix}` : '/app');
      } else {
        const verifyParams = new URLSearchParams({ email: normalizedEmail });
        if (planIntent?.planSlug) verifyParams.set('plan', planIntent.planSlug);
        if (planIntent?.billingPeriod) verifyParams.set('billing', planIntent.billingPeriod);
        navigate(`/verifier-email?${verifyParams.toString()}`);
      }
    } catch (err) {
      setError(getSupabaseAuthErrorMessage(err, 'sign-up'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-[calc(100dvh-4.5rem)] w-full bg-[#eee8dd] text-[#27251f] lg:grid-cols-[0.92fr_1.08fr]">
      <section
        aria-label="Barber Cuts"
        className="relative isolate flex flex-col justify-between overflow-hidden bg-[#171817] px-6 py-5 text-[#f0ece4] sm:px-10 lg:min-h-[calc(100dvh-4.5rem)] lg:px-14 lg:py-10 xl:px-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[13%] hidden w-14 opacity-35 lg:block"
        >
          <div className="absolute inset-y-[15%] left-0 w-px bg-[#b4975b]/70" />
          <div
            className="absolute inset-y-[15%] left-2 w-8 border-x border-[#b4975b]/30"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, transparent 0 7px, rgba(180, 151, 91, .55) 7px 8px, transparent 8px 15px)',
            }}
          />
          <div className="absolute inset-y-[15%] right-0 w-px bg-[#b4975b]/50" />
        </div>

        <Link
          to="/"
          className="relative z-10 inline-flex w-fit items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4975b]"
        >
          <span className="flex h-10 w-10 items-center justify-center border border-[#b4975b]/60 text-[#c2a266]">
            <Scissors aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f0ece4]">
            Barber <span className="text-[#c2a266]">Cuts</span>
          </span>
        </Link>

        <div className="relative z-10 hidden max-w-xl lg:block">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c2a266]">
            Création de compte
          </p>
          <h2 className="font-serif-luxury text-5xl font-medium leading-[1.12] text-[#f0ece4] xl:text-6xl">
            Entrez dans
            <br />
            <span className="italic text-[#c2a266]">votre espace.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#b8b6af]">
            Un accès pour suivre vos rendez-vous ou retrouver votre espace salon.
          </p>
        </div>

        <p className="relative z-10 hidden text-xs tracking-wide text-[#8d8d85] lg:block">
          Barber Cuts · Votre compte personnel
        </p>
        <p className="relative z-10 text-[11px] uppercase tracking-[0.2em] text-[#a39d90] lg:hidden">
          Création de compte
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-7 sm:px-10 lg:px-12 lg:py-10 xl:px-16">
        <div className="w-full max-w-[31rem]">
          <header className="mb-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d7545]">
              Inscription
            </p>
            <h1
              id="signup-title"
              className="font-serif-luxury text-4xl font-medium leading-tight tracking-[-0.03em] text-[#26251f] sm:text-[2.8rem]"
            >
              Créer un compte.
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#68645b]">
              Renseignez vos informations pour commencer.
            </p>
          </header>

          {planIntent && (
            <div
              data-testid="signup-selected-plan-banner"
              className="mb-4 flex items-center gap-2.5 border border-[#b4975b]/50 bg-[#ece3d1] px-4 py-2.5 text-xs font-medium text-[#3c3322]"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8d7545]" />
              <span>
                Formule sélectionnée : <strong>{planDisplayName ?? 'Abonnement salon'}</strong> ·{' '}
                <span>{formatSaasBillingPeriodLabel(planIntent.billingPeriod)}</span>
              </span>
            </div>
          )}

          <div
            role="note"
            className="mb-5 flex items-start gap-3 border-l-2 border-[#a98a52] bg-[#e6dece] px-4 py-3 text-sm leading-5 text-[#514a3c]"
          >
            <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#80683d]" />
            <p>
              Après votre inscription, vérifiez votre boîte e-mail (et les indésirables) pour confirmer votre
              adresse avant de vous connecter.
            </p>
          </div>

          {maintenanceMode && (
            <p
              data-testid="signup-maintenance-banner"
              role="alert"
              className="mb-5 border border-[#ae6258]/50 bg-[#f2e2dc] px-4 py-3 text-sm font-medium text-[#743a33]"
            >
              Mode maintenance actif : les nouvelles inscriptions et créations d’établissement sont
              temporairement suspendues.
            </p>
          )}
          {!supabaseConfigured && (
            <p
              role="alert"
              className="mb-5 border border-[#a97d31]/40 bg-[#e6dac4] px-4 py-3 text-sm text-[#62491e]"
            >
              La création de compte est momentanément indisponible : la configuration Supabase manque.
            </p>
          )}
          {error && (
            <p
              id="signup-error"
              role="alert"
              className="mb-5 border border-[#ae6258]/40 bg-[#f2e2dc] px-4 py-3 text-sm text-[#743a33]"
            >
              {error}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-describedby={error ? 'signup-error' : undefined}
            aria-busy={loading}
          >
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-sm font-semibold text-[#36342d]">
                Nom complet
              </label>
              <div className="relative">
                <User
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d877b]"
                />
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  className="w-full border border-[#d1c7b7] bg-[#f8f5ef] py-3 pl-11 pr-4 text-sm text-[#282720] placeholder:text-[#928d82] outline-none transition focus:border-[#917441] focus:ring-2 focus:ring-[#aa8d55]/20"
                  placeholder="Jean Kouassi"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-sm font-semibold text-[#36342d]">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d877b]"
                />
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  className="w-full border border-[#d1c7b7] bg-[#f8f5ef] py-3 pl-11 pr-4 text-sm text-[#282720] placeholder:text-[#928d82] outline-none transition focus:border-[#917441] focus:ring-2 focus:ring-[#aa8d55]/20"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-sm font-semibold text-[#36342d]">
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d877b]"
                />
                <input
                  id="signup-password"
                  name="new-password"
                  type={passwordVisible ? 'text' : 'password'}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  aria-describedby="password-hint"
                  className="w-full border border-[#d1c7b7] bg-[#f8f5ef] py-3 pl-11 pr-12 text-sm text-[#282720] placeholder:text-[#928d82] outline-none transition focus:border-[#917441] focus:ring-2 focus:ring-[#aa8d55]/20"
                  placeholder="12 caractères minimum"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={passwordVisible}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#6d675c] hover:text-[#403c33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#917441]"
                >
                  {passwordVisible ? (
                    <EyeOff aria-hidden="true" className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye aria-hidden="true" className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
              <p id="password-hint" className="mt-1.5 text-xs text-[#777166]">
                Utilisez au moins 12 caractères.
              </p>
            </div>

            <div>
              <label
                htmlFor="signup-confirm-password"
                className="mb-1.5 block text-sm font-semibold text-[#36342d]"
              >
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d877b]"
                />
                <input
                  id="signup-confirm-password"
                  name="confirm-password"
                  type={confirmationVisible ? 'text' : 'password'}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError(null);
                  }}
                  className="w-full border border-[#d1c7b7] bg-[#f8f5ef] py-3 pl-11 pr-12 text-sm text-[#282720] placeholder:text-[#928d82] outline-none transition focus:border-[#917441] focus:ring-2 focus:ring-[#aa8d55]/20"
                  placeholder="Saisissez à nouveau votre mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setConfirmationVisible((visible) => !visible)}
                  aria-label={
                    confirmationVisible
                      ? 'Masquer la confirmation du mot de passe'
                      : 'Afficher la confirmation du mot de passe'
                  }
                  aria-pressed={confirmationVisible}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#6d675c] hover:text-[#403c33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#917441]"
                >
                  {confirmationVisible ? (
                    <EyeOff aria-hidden="true" className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye aria-hidden="true" className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !supabaseConfigured || maintenanceMode}
              aria-busy={loading}
              className="group flex w-full items-center justify-center gap-2 border border-[#24241f] bg-[#24241f] px-4 py-3.5 text-sm font-semibold text-[#f4efe5] transition hover:border-[#8f7440] hover:bg-[#39362d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Création du compte…' : 'Créer mon compte'}
              {!loading && supabaseConfigured && !maintenanceMode && (
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              )}
            </button>
          </form>

          <p className="mt-6 border-t border-[#d8d0c3] pt-4 text-sm text-[#68645b]">
            Déjà un compte ?{' '}
            <Link
              to={`/connexion${planQuerySuffix}`}
              className="font-semibold text-[#775d2d] underline decoration-[#ad935e]/50 underline-offset-4 hover:text-[#42351d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441]"
            >
              Se connecter
            </Link>
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-xs text-[#777166] hover:text-[#35332c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441]"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
};
