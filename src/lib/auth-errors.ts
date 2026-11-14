export type AuthOperation = 'sign-in' | 'sign-up' | 'verify' | 'resend' | 'reset-request' | 'reset-password';

export function getSupabaseAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' && code ? code : undefined;
}

function getSupabaseAuthErrorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return error instanceof Error ? error.message : '';
}

export function isEmailNotConfirmedError(error: unknown): boolean {
  const code = getSupabaseAuthErrorCode(error);
  if (code === 'email_not_confirmed' || code === 'user_not_confirmed') return true;
  return /email not confirmed|user not confirmed/i.test(getSupabaseAuthErrorText(error));
}

export function getSupabaseAuthErrorMessage(error: unknown, operation: AuthOperation): string {
  const code = getSupabaseAuthErrorCode(error);
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message = getSupabaseAuthErrorText(error);

  if (
    code === 'invalid_credentials' ||
    code === 'user_not_found' ||
    /invalid login credentials/i.test(message)
  ) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (isEmailNotConfirmedError(error)) {
    return 'Votre adresse e-mail n’a pas encore été vérifiée.';
  }
  if (code === 'weak_password' || /password should be at least|weak password/i.test(message)) {
    return 'Choisissez un mot de passe plus sûr, avec au moins 12 caractères.';
  }
  if (code === 'same_password' || /new password should be different/i.test(message)) {
    return 'Le nouveau mot de passe doit être différent de l’ancien.';
  }
  if (
    code === 'email_address_invalid' ||
    code === 'invalid_email' ||
    /unable to validate email|invalid email/i.test(message)
  ) {
    return 'Veuillez saisir une adresse e-mail valide.';
  }
  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    code === 'email_already_exists' ||
    /user already registered|already been registered/i.test(message)
  ) {
    return 'Cette adresse ne peut pas être utilisée pour créer un compte. Essayez de vous connecter ou de réinitialiser votre mot de passe.';
  }
  if (
    code === 'otp_expired' ||
    code === 'otp_disabled' ||
    code === 'flow_state_expired' ||
    code === 'flow_state_not_found' ||
    code === 'bad_code_verifier' ||
    /email link is invalid or has expired|token has expired|otp.*expired|pkce|code verifier/i.test(message)
  ) {
    return operation === 'reset-password'
      ? 'Votre lien de réinitialisation a expiré ou a déjà été utilisé. Veuillez en demander un nouveau.'
      : 'Ce lien de vérification a expiré ou a déjà été utilisé. Demandez un nouvel e-mail ci-dessous.';
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'email_rate_limit_exceeded' ||
    code === 'over_request_rate_limit' ||
    status === 429 ||
    /rate limit|too many requests|for security purposes, you can only request this after/i.test(message)
  ) {
    const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i);
    if (waitMatch?.[1]) {
      return `Trop de tentatives. Patientez ${waitMatch[1]} secondes avant de réessayer.`;
    }
    return 'Trop de tentatives d’envoi d’e-mail. Patientez quelques instants avant de réessayer.';
  }
  if (
    code === 'signup_disabled' ||
    code === 'email_provider_disabled' ||
    /signups not allowed/i.test(message)
  ) {
    return 'La création de comptes est momentanément indisponible.';
  }
  if (code === 'user_banned') {
    return 'Ce compte est temporairement suspendu.';
  }
  if (/redirect.*not allowed|redirect_to/i.test(message)) {
    return 'L’URL de redirection de l’application n’est pas autorisée dans la configuration Supabase Auth.';
  }
  if (code === 'session_not_found' || /auth session missing|session.*missing/i.test(message)) {
    if (operation === 'reset-password') {
      return 'Votre lien de réinitialisation a expiré ou est invalide. Veuillez en demander un nouveau.';
    }
  }
  if (/network|fetch|timeout|temporar/i.test(message)) {
    return 'Le service est momentanément inaccessible. Vérifiez votre connexion et réessayez.';
  }
  if (status !== undefined && status >= 500) {
    return 'Le service d’authentification rencontre un problème. Réessayez dans quelques instants.';
  }

  switch (operation) {
    case 'sign-up':
      return 'Impossible de créer votre compte pour le moment. Vérifiez les informations et réessayez.';
    case 'verify':
      return 'Ce lien de vérification est invalide ou expiré. Demandez un nouvel e-mail ci-dessous.';
    case 'resend':
      return 'Impossible de renvoyer l’e-mail de vérification pour le moment. Réessayez dans quelques instants.';
    case 'reset-request':
      return 'Impossible d’envoyer le lien de réinitialisation pour le moment. Réessayez dans quelques instants.';
    case 'reset-password':
      return 'Impossible de mettre à jour le mot de passe. Demandez un nouveau lien de réinitialisation.';
    case 'sign-in':
    default:
      return 'Impossible de vous connecter pour le moment. Vérifiez vos identifiants et réessayez.';
  }
}
