export type AuthOperation = 'sign-in' | 'sign-up';

export function getSupabaseAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

export function getSupabaseAuthErrorMessage(error: unknown, operation: AuthOperation): string {
  const code = getSupabaseAuthErrorCode(error);
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (code === 'invalid_credentials' || code === 'user_not_found') {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (code === 'email_not_confirmed' || code === 'user_not_confirmed') {
    return 'Votre adresse e-mail n’a pas encore été vérifiée.';
  }
  if (code === 'weak_password') {
    return 'Choisissez un mot de passe plus sûr, avec au moins 12 caractères.';
  }
  if (code === 'email_address_invalid' || code === 'invalid_email') {
    return 'Veuillez saisir une adresse e-mail valide.';
  }
  if (code === 'email_exists' || code === 'user_already_exists' || code === 'email_already_exists') {
    return 'Cette adresse ne peut pas être utilisée pour créer un compte. Essayez de vous connecter ou de réinitialiser votre mot de passe.';
  }
  if (code === 'over_email_send_rate_limit' || code === 'email_rate_limit_exceeded' || status === 429) {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return 'La création de comptes est momentanément indisponible.';
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : '';
  if (/network|fetch|timeout|temporar/i.test(message)) {
    return 'Le service est momentanément inaccessible. Vérifiez votre connexion et réessayez.';
  }
  if (status !== undefined && status >= 500) {
    return 'Le service d’authentification rencontre un problème. Réessayez dans quelques instants.';
  }

  return operation === 'sign-up'
    ? 'Impossible de créer votre compte pour le moment. Vérifiez les informations et réessayez.'
    : 'Impossible de vous connecter pour le moment. Vérifiez vos identifiants et réessayez.';
}
