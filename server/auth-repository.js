// Chaque opération utilise une transaction et un rôle d'authentification limité.
// Accepte un pg.Pool (connect/query) ou un client unique type PGlite (query/exec).
//
// LOT 2 — ajoute la vérification e-mail, la réinitialisation de mot de passe,
// l'expiration glissante, la révocation de toutes les sessions d'un compte et
// l'état d'onboarding. Les jetons sont toujours stockés hachés (SHA-256).

const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function createAuthRepository(db) {
  if (typeof db.connect !== 'function') {
    // PGlite : une seule connexion, exécution sérialisée.
    let queue = Promise.resolve();
    const transaction = (fn) => {
      const task = queue.then(async () => {
        await db.exec('BEGIN');
        try {
          await db.exec('SET LOCAL ROLE bc_auth');
          const result = await fn(db);
          await db.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            await db.exec('ROLLBACK');
          } catch {
            /* preserve original error */
          }
          throw error;
        }
      });
      queue = task.catch(() => {});
      return task;
    };
    return buildRepository(transaction);
  }

  async function transaction(fn) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE bc_auth');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* preserve original error */
      }
      throw error;
    } finally {
      client.release();
    }
  }
  return buildRepository(transaction);
}

function buildRepository(transaction) {
  return {
    createAccount: (data) =>
      transaction(async (client) => {
        const user = await client.query('INSERT INTO public.bc_users DEFAULT VALUES RETURNING id');
        const id = user.rows[0].id;
        await client.query(
          'INSERT INTO public.bc_auth_accounts(user_id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)',
          [id, data.email, data.name, data.passwordHash],
        );
        return { id, email: data.email, name: data.name };
      }),
    findAccount: (email) =>
      transaction(async (client) => {
        const result = await client.query(
          'SELECT user_id AS id, email, display_name AS name, password_hash AS "passwordHash", email_verified_at AS "emailVerifiedAt" FROM public.bc_auth_accounts WHERE email=$1',
          [email],
        );
        return result.rows[0] || null;
      }),
    createSession: (userId, tokenHash, expiresAt, metadata = {}) =>
      transaction(async (client) => {
        await client.query(
          'INSERT INTO public.bc_auth_sessions(user_id,token_hash,expires_at,user_agent,ip_hash) VALUES($1,$2,$3,$4,$5)',
          [userId, tokenHash, expiresAt, metadata.userAgent ?? null, metadata.ipHash ?? null],
        );
      }),
    /**
     * Session valide = non expirée. `touch` prolonge l'expiration (session
     * persistante) au plus une fois par heure pour éviter une écriture par requête.
     */
    getSession: (tokenHash, { touch = true, extendMs = 0 } = {}) =>
      transaction(async (client) => {
        const result = await client.query(
          `SELECT a.user_id AS id, a.email, a.display_name AS name, a.email_verified_at AS "emailVerifiedAt",
                s.last_used_at AS "lastUsedAt"
           FROM public.bc_auth_sessions s
           JOIN public.bc_auth_accounts a ON a.user_id=s.user_id
          WHERE s.token_hash=$1 AND s.expires_at > now()`,
          [tokenHash],
        );
        const user = result.rows[0];
        if (!user) return null;
        const lastUsed = user.lastUsedAt ? new Date(user.lastUsedAt).getTime() : 0;
        if (touch && Date.now() - lastUsed > SESSION_TOUCH_INTERVAL_MS) {
          await client.query(
            "UPDATE public.bc_auth_sessions SET last_used_at = now(), expires_at = now() + ($2 || ' milliseconds')::interval WHERE token_hash=$1",
            [tokenHash, String(extendMs)],
          );
        }
        delete user.lastUsedAt;
        // Normalise la présence de la colonne (null si vérification absente).
        return { ...user, emailVerifiedAt: user.emailVerifiedAt ?? null };
      }),
    deleteSession: (tokenHash) =>
      transaction(async (client) => {
        await client.query('DELETE FROM public.bc_auth_sessions WHERE token_hash=$1', [tokenHash]);
      }),
    deleteAllSessions: (userId) =>
      transaction(async (client) => {
        const result = await client.query('DELETE FROM public.bc_auth_sessions WHERE user_id=$1', [userId]);
        return result.rowCount ?? 0;
      }),
    /** Purge des sessions expirées (à appeler périodiquement). */
    purgeExpiredSessions: () =>
      transaction(async (client) => {
        const result = await client.query('DELETE FROM public.bc_auth_sessions WHERE expires_at <= now()');
        return result.rowCount ?? 0;
      }),

    // ----- Jetons à usage unique -----
    /** Invalide les jetons précédents du même type puis enregistre le nouveau. */
    issueToken: (userId, tokenHash, purpose, expiresAt) =>
      transaction(async (client) => {
        await client.query(
          'UPDATE public.bc_auth_tokens SET used_at = now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL',
          [userId, purpose],
        );
        await client.query(
          'INSERT INTO public.bc_auth_tokens(token_hash,user_id,purpose,expires_at) VALUES ($1,$2,$3,$4)',
          [tokenHash, userId, purpose, expiresAt],
        );
      }),
    /** Consomme le jeton : il ne peut être utilisé qu'une seule fois. */
    consumeToken: (tokenHash, purpose) =>
      transaction(async (client) => {
        const result = await client.query(
          `UPDATE public.bc_auth_tokens SET used_at = now()
          WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at > now()
          RETURNING user_id AS id`,
          [tokenHash, purpose],
        );
        return result.rows[0]?.id ?? null;
      }),
    markEmailVerified: (userId) =>
      transaction(async (client) => {
        await client.query(
          'UPDATE public.bc_auth_accounts SET email_verified_at = coalesce(email_verified_at, now()) WHERE user_id=$1',
          [userId],
        );
      }),
    updatePassword: (userId, passwordHash) =>
      transaction(async (client) => {
        await client.query('UPDATE public.bc_auth_accounts SET password_hash=$2 WHERE user_id=$1', [
          userId,
          passwordHash,
        ]);
      }),

    // ----- Onboarding -----
    getOnboarding: (userId) =>
      transaction(async (client) => {
        const result = await client.query(
          'SELECT email_verified AS "emailVerified", salon_created AS "salonCreated", setup_completed AS "setupCompleted", current_step AS "currentStep" FROM public.bc_onboarding_state WHERE user_id=$1',
          [userId],
        );
        return result.rows[0] || null;
      }),
    setOnboarding: (userId, state) =>
      transaction(async (client) => {
        await client.query(
          `INSERT INTO public.bc_onboarding_state(user_id, email_verified, salon_created, setup_completed, current_step, completed_at)
         VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 = 'completed' THEN now() END)
         ON CONFLICT (user_id) DO UPDATE SET
           email_verified = public.bc_onboarding_state.email_verified OR excluded.email_verified,
           salon_created = public.bc_onboarding_state.salon_created OR excluded.salon_created,
           setup_completed = public.bc_onboarding_state.setup_completed OR excluded.setup_completed,
           current_step = excluded.current_step,
           completed_at = coalesce(public.bc_onboarding_state.completed_at, excluded.completed_at),
           updated_at = now()`,
          [
            userId,
            Boolean(state.emailVerified),
            Boolean(state.salonCreated),
            Boolean(state.setupCompleted),
            state.currentStep,
          ],
        );
      }),
  };
}
