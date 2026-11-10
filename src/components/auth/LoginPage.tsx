import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Scissors } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseAuthErrorCode, getSupabaseAuthErrorMessage } from '../../lib/auth-errors';
import {
  buildPlanSelectionQuery,
  parsePlanSelectionFromSearch,
  readPlanSelectionIntent,
  savePlanSelectionIntent,
} from '../../lib/saasPricing';
import { isSupabaseConfigured } from '../../lib/supabase';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supabaseConfigured = isSupabaseConfigured();

  const rawSearch = searchParams.toString();
  const urlIntent = parsePlanSelectionFromSearch(rawSearch ? `?${rawSearch}` : '');
  const planIntent = urlIntent ?? readPlanSelectionIntent();
  const planQuerySuffix = buildPlanSelectionQuery(planIntent);

  useEffect(() => {
    if (urlIntent) {
      savePlanSelectionIntent(urlIntent);
    }
  }, [urlIntent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      setError('La connexion est momentanément indisponible. Supabase n’est pas configuré.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    setError(null);
    try {
      if (planIntent) {
        savePlanSelectionIntent(planIntent);
      }
      await signIn(normalizedEmail, password);
      navigate(planIntent ? `/app/abonnement${planQuerySuffix}` : '/app');
    } catch (err) {
      const errorCode = getSupabaseAuthErrorCode(err);
      if (errorCode === 'email_not_confirmed' || errorCode === 'user_not_confirmed') {
        const verifyParams = new URLSearchParams({ email: normalizedEmail });
        if (planIntent?.planSlug) verifyParams.set('plan', planIntent.planSlug);
        if (planIntent?.billingPeriod) verifyParams.set('billing', planIntent.billingPeriod);
        navigate(`/verifier-email?${verifyParams.toString()}`);
        return;
      }
      setError(getSupabaseAuthErrorMessage(err, 'sign-in'));
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
            Votre espace personnel
          </p>
          <h2 className="font-serif-luxury text-5xl font-medium leading-[1.12] text-[#f0ece4] xl:text-6xl">
            Le rituel
            <br />
            <span className="italic text-[#c2a266]">continue.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#b8b6af]">
            Retrouvez votre espace Barber Cuts, côté rendez-vous comme côté salon.
          </p>
        </div>

        <p className="relative z-10 hidden text-xs tracking-wide text-[#8d8d85] lg:block">
          Un espace, à votre rythme.
        </p>
        <p className="relative z-10 text-[11px] uppercase tracking-[0.2em] text-[#a39d90] lg:hidden">
          Votre espace personnel
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-8 sm:px-10 lg:px-12 lg:py-12 xl:px-20">
        <div className="w-full max-w-[28rem]">
          <header className="mb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d7545]">
              Connexion
            </p>
            <h1 className="font-serif-luxury text-4xl font-medium leading-tight tracking-[-0.03em] text-[#26251f] sm:text-[2.8rem]">
              Heureux de vous revoir.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#68645b]">
              Connectez-vous pour retrouver votre espace.
            </p>
          </header>

          {!supabaseConfigured && (
            <p
              role="alert"
              className="mb-5 border border-[#a97d31]/40 bg-[#e6dac4] px-4 py-3 text-sm text-[#62491e]"
            >
              La connexion est momentanément indisponible : la configuration Supabase manque.
            </p>
          )}
          {error && (
            <p
              id="login-error"
              role="alert"
              className="mb-5 border border-[#ae6258]/40 bg-[#f2e2dc] px-4 py-3 text-sm text-[#743a33]"
            >
              {error}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            aria-describedby={error ? 'login-error' : undefined}
            aria-busy={loading}
          >
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-[#36342d]">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d877b]"
                />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  className="w-full border border-[#d1c7b7] bg-[#f8f5ef] py-3.5 pl-11 pr-4 text-sm text-[#282720] placeholder:text-[#928d82] outline-none transition focus:border-[#917441] focus:ring-2 focus:ring-[#aa8d55]/20"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-[#36342d]">
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8d877b]"
                />
                <input
                  id="login-password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full border border-[#d1c7b7] bg-[#f8f5ef] py-3.5 pl-11 pr-12 text-sm text-[#282720] placeholder:text-[#928d82] outline-none transition focus:border-[#917441] focus:ring-2 focus:ring-[#aa8d55]/20"
                  placeholder="••••••••"
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
            </div>

            <div className="flex justify-end">
              <Link
                to="/mot-de-passe-oublie"
                className="text-sm font-medium text-[#775d2d] underline decoration-[#ad935e]/50 underline-offset-4 hover:text-[#42351d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441]"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !supabaseConfigured}
              aria-busy={loading}
              className="group flex w-full items-center justify-center gap-2 border border-[#24241f] bg-[#24241f] px-4 py-3.5 text-sm font-semibold text-[#f4efe5] transition hover:border-[#8f7440] hover:bg-[#39362d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee8dd] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
              {!loading && supabaseConfigured && (
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              )}
            </button>
          </form>

          <p className="mt-7 border-t border-[#d8d0c3] pt-5 text-sm text-[#68645b]">
            Pas encore de compte ?{' '}
            <Link
              to={`/inscription${planQuerySuffix}`}
              className="font-semibold text-[#775d2d] underline decoration-[#ad935e]/50 underline-offset-4 hover:text-[#42351d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441]"
            >
              Créer un compte
            </Link>
          </p>
          <Link
            to="/"
            className="mt-5 inline-block text-xs text-[#777166] hover:text-[#35332c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#917441]"
          >
            ← Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
};
