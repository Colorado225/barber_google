import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { JSDOM } from 'jsdom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../src/context/AuthContext';
import { VerifyEmailPage } from '../src/components/auth/VerifyEmailPage';
import { LoginPage } from '../src/components/auth/LoginPage';
import { SignupPage } from '../src/components/auth/SignupPage';
import { ForgotPasswordPage } from '../src/components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../src/components/auth/ResetPasswordPage';
import { getSupabaseAuthErrorMessage, isEmailNotConfirmedError } from '../src/lib/auth-errors';
import { resolveAuthRedirectUrl } from '../src/lib/supabase';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/verifier-email',
});
const win = dom.window as unknown as Window & typeof globalThis;
Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
Object.defineProperty(globalThis, 'document', { value: win.document, configurable: true, writable: true });
Object.defineProperty(globalThis, 'localStorage', {
  value: win.localStorage,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: win.sessionStorage,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: win.navigator,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', {
  value: win.HTMLElement,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'Node', {
  value: win.Node,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'CustomEvent', {
  value: win.CustomEvent,
  configurable: true,
  writable: true,
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ensureDom(url = 'http://localhost/verifier-email') {
  dom.reconfigure({ url });
  return dom;
}

const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react');

function makeAuthValue(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    memberships: [],
    activeMembership: null,
    activeSalonId: null,
    onboarding: null,
    loading: false,
    error: null,
    signIn: async () => undefined,
    signUp: async () => ({ status: 'confirmation-required' }),
    signOut: async () => undefined,
    refreshSession: async () => undefined,
    selectSalon: () => false,
    verifyEmail: async () => undefined,
    exchangeAuthCode: async () => undefined,
    resendVerification: async () => undefined,
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    createSalon: async () => 'salon-1',
    completeOnboarding: async () => undefined,
    isAuthenticated: false,
    hasWorkspace: false,
    hasPermission: () => false,
    ...overrides,
  };
}

test('auth-errors : traduit les codes et messages Supabase Auth en français', () => {
  assert.equal(isEmailNotConfirmedError({ code: 'email_not_confirmed' }), true);
  assert.equal(isEmailNotConfirmedError(new Error('Email not confirmed')), true);
  assert.equal(isEmailNotConfirmedError({ code: 'invalid_credentials' }), false);

  assert.match(
    getSupabaseAuthErrorMessage(
      {
        code: 'over_email_send_rate_limit',
        message: 'For security purposes, you can only request this after 45 seconds.',
      },
      'resend',
    ),
    /45 secondes/,
  );
  assert.match(
    getSupabaseAuthErrorMessage(
      { code: 'otp_expired', message: 'Email link is invalid or has expired' },
      'verify',
    ),
    /expiré/i,
  );
  assert.match(
    getSupabaseAuthErrorMessage({ code: 'user_already_exists' }, 'sign-up'),
    /Essayez de vous connecter/i,
  );
  assert.match(
    getSupabaseAuthErrorMessage({ code: 'same_password' }, 'reset-password'),
    /différent de l’ancien/i,
  );
});

test('resolveAuthRedirectUrl : construit une URL absolue basée sur window.location.origin', () => {
  ensureDom('https://ais-dev-iovdkz2gcmg7wjemzdw45p-638295687497.europe-west2.run.app/inscription');
  assert.equal(
    resolveAuthRedirectUrl('/verifier-email'),
    'https://ais-dev-iovdkz2gcmg7wjemzdw45p-638295687497.europe-west2.run.app/verifier-email',
  );
});

test('VerifyEmailPage : renvoyer l’e-mail affiche "E-mail renvoyé" (et non "E-mail vérifié") et gère les erreurs', async () => {
  ensureDom('http://localhost/verifier-email?email=aduerwins@gmail.com');
  const resentEmails: string[] = [];

  render(
    <MemoryRouter initialEntries={['/verifier-email?email=aduerwins@gmail.com']}>
      <AuthContext.Provider
        value={makeAuthValue({
          resendVerification: async (email) => {
            resentEmails.push(email);
          },
        })}
      >
        <VerifyEmailPage supabaseConfigured />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  const input = screen.getByLabelText(/Renvoyer le lien de vérification/i) as HTMLInputElement;
  assert.equal(input.value, 'aduerwins@gmail.com');

  fireEvent.click(screen.getByRole('button', { name: /Renvoyer l'e-mail/i }));

  await waitFor(() => {
    assert.deepEqual(resentEmails, ['aduerwins@gmail.com']);
    assert.ok(screen.getByText('E-mail renvoyé'));
  });
  assert.equal(screen.queryByText('E-mail vérifié'), null);
  cleanup();

  // Cas rate limit
  ensureDom('http://localhost/verifier-email?email=aduerwins@gmail.com');
  render(
    <MemoryRouter initialEntries={['/verifier-email?email=aduerwins@gmail.com']}>
      <AuthContext.Provider
        value={makeAuthValue({
          resendVerification: async () => {
            throw Object.assign(
              new Error('For security purposes, you can only request this after 58 seconds.'),
              {
                code: 'over_email_send_rate_limit',
                status: 429,
              },
            );
          },
        })}
      >
        <VerifyEmailPage supabaseConfigured />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /Renvoyer l'e-mail/i }));
  await waitFor(() => {
    const alert = screen.getByRole('alert');
    assert.match(alert.textContent ?? '', /58 secondes/);
  });
  cleanup();
});

test('VerifyEmailPage : prend en charge token_hash (+type=email), code PKCE et erreurs dans le fragment #', async () => {
  const verifyCalls: Array<{ tokenHash: string; type?: string }> = [];
  ensureDom('http://localhost/verifier-email?token_hash=tok-123&type=email');

  render(
    <MemoryRouter initialEntries={['/verifier-email?token_hash=tok-123&type=email']}>
      <AuthContext.Provider
        value={makeAuthValue({
          verifyEmail: async (tokenHash, type) => {
            verifyCalls.push({ tokenHash, type });
          },
        })}
      >
        <VerifyEmailPage supabaseConfigured />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.deepEqual(verifyCalls, [{ tokenHash: 'tok-123', type: 'email' }]);
    assert.ok(screen.getByText('E-mail vérifié'));
  });
  cleanup();

  // Cas PKCE ?code=...
  const codeCalls: string[] = [];
  ensureDom('http://localhost/verifier-email?code=pkce-abc');
  render(
    <MemoryRouter initialEntries={['/verifier-email?code=pkce-abc']}>
      <AuthContext.Provider
        value={makeAuthValue({
          isAuthenticated: true,
          user: { id: 'u-1', name: 'Test', email: 'aduerwins@gmail.com', emailVerified: true },
          exchangeAuthCode: async (code) => {
            codeCalls.push(code);
          },
        })}
      >
        <VerifyEmailPage supabaseConfigured />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.deepEqual(codeCalls, ['pkce-abc']);
    assert.ok(screen.getByText('E-mail vérifié'));
    assert.equal(
      screen.getByRole('link', { name: /Continuer vers mon espace/i }).getAttribute('href'),
      '/app',
    );
  });
  cleanup();

  // Cas erreur dans le hash (#error_code=otp_expired)
  ensureDom(
    'http://localhost/verifier-email#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );
  render(
    <MemoryRouter initialEntries={['/verifier-email']}>
      <AuthContext.Provider value={makeAuthValue()}>
        <VerifyEmailPage supabaseConfigured />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  const alert = screen.getByRole('alert');
  assert.match(alert.textContent ?? '', /expiré ou a déjà été utilisé/i);
  cleanup();
});

test('LoginPage : redirige vers /verifier-email si le compte n’est pas confirmé', async () => {
  ensureDom('http://localhost/connexion');

  render(
    <MemoryRouter initialEntries={['/connexion']}>
      <AuthContext.Provider
        value={makeAuthValue({
          signIn: async () => {
            throw new Error('Email not confirmed');
          },
        })}
      >
        <Routes>
          <Route path="/connexion" element={<LoginPage supabaseConfigured />} />
          <Route path="/verifier-email" element={<VerifyEmailPage supabaseConfigured />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText(/Adresse e-mail/i), { target: { value: 'aduerwins@gmail.com' } });
  fireEvent.change(screen.getByLabelText(/^Mot de passe$/i), { target: { value: 'motdepasse1234' } });
  fireEvent.submit(screen.getByRole('button', { name: /Se connecter/i }).closest('form')!);

  await waitFor(() => {
    const emailInput = screen.getByLabelText(/Renvoyer le lien de vérification/i) as HTMLInputElement;
    assert.equal(emailInput.value, 'aduerwins@gmail.com');
  });
  cleanup();
});

test('SignupPage : signale un compte déjà existant sans rediriger vers /verifier-email', async () => {
  ensureDom('http://localhost/inscription');

  render(
    <MemoryRouter initialEntries={['/inscription']}>
      <AuthContext.Provider
        value={makeAuthValue({
          signUp: async () => {
            throw Object.assign(new Error('User already registered'), {
              code: 'user_already_exists',
              status: 422,
            });
          },
        })}
      >
        <Routes>
          <Route
            path="/inscription"
            element={
              <SignupPage
                supabaseConfigured
                loadPlatformStatus={async () => ({
                  defaultCurrency: 'XOF',
                  maintenanceMode: false,
                  autoApproveSalons: true,
                })}
              />
            }
          />
          <Route path="/verifier-email" element={<div>VERIFY_SCREEN</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText(/Nom complet/i), { target: { value: 'Adou Erwins' } });
  fireEvent.change(screen.getByLabelText(/Adresse e-mail/i), { target: { value: 'aduerwins@gmail.com' } });
  fireEvent.change(screen.getByLabelText(/^Mot de passe$/i), { target: { value: 'MonMotDePasse2026!' } });
  fireEvent.change(screen.getByLabelText(/Confirmer le mot de passe/i), {
    target: { value: 'MonMotDePasse2026!' },
  });
  fireEvent.submit(screen.getByRole('button', { name: /Créer mon compte/i }).closest('form')!);

  await waitFor(() => {
    const alert = screen.getByRole('alert');
    assert.match(alert.textContent ?? '', /Essayez de vous connecter/i);
  });
  assert.equal(screen.queryByText('VERIFY_SCREEN'), null);
  cleanup();
});

test('ForgotPasswordPage et ResetPasswordPage : gèrent la configuration Supabase et la réinitialisation PKCE', async () => {
  ensureDom('http://localhost/mot-de-passe-oublie');
  render(
    <MemoryRouter initialEntries={['/mot-de-passe-oublie']}>
      <AuthContext.Provider value={makeAuthValue()}>
        <ForgotPasswordPage supabaseConfigured={false} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  assert.equal(
    (screen.getByRole('button', { name: /Envoyer le lien/i }) as HTMLButtonElement).disabled,
    true,
  );
  cleanup();

  const exchangedCodes: string[] = [];
  const resetPasswords: string[] = [];
  ensureDom('http://localhost/reinitialiser?code=reset-code-1');

  render(
    <MemoryRouter initialEntries={['/reinitialiser?code=reset-code-1']}>
      <AuthContext.Provider
        value={makeAuthValue({
          exchangeAuthCode: async (code) => {
            exchangedCodes.push(code);
          },
          resetPassword: async (password) => {
            resetPasswords.push(password);
          },
        })}
      >
        <ResetPasswordPage supabaseConfigured />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.deepEqual(exchangedCodes, ['reset-code-1']);
  });

  fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/i), {
    target: { value: 'NouveauMotDePasse2026!' },
  });
  fireEvent.change(screen.getByLabelText(/Confirmer/i), {
    target: { value: 'NouveauMotDePasse2026!' },
  });
  fireEvent.submit(screen.getByRole('button', { name: /Mettre à jour/i }).closest('form')!);

  await waitFor(() => {
    assert.deepEqual(resetPasswords, ['NouveauMotDePasse2026!']);
    assert.ok(screen.getByText(/Mot de passe mis à jour/i));
  });
  cleanup();
});

test('supabase/config.toml : autorise localhost et les URL de preview AI Studio', async () => {
  const configToml = await readFile('supabase/config.toml', 'utf8');
  assert.ok(configToml.includes('http://localhost:3000/**'));
  assert.ok(
    configToml.includes('https://ais-dev-iovdkz2gcmg7wjemzdw45p-638295687497.europe-west2.run.app/**'),
  );
  assert.ok(
    configToml.includes('https://ais-pre-iovdkz2gcmg7wjemzdw45p-638295687497.europe-west2.run.app/**'),
  );
});
