// Chaque opération utilise une transaction et un rôle d'authentification limité.
// Accepte un pg.Pool (connect/query) ou un client unique type PGlite (query/exec).
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
          try { await db.exec('ROLLBACK'); } catch { /* preserve original error */ }
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
      try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    } finally { client.release(); }
  }
  return buildRepository(transaction);
}

function buildRepository(transaction) {
  return {
    createAccount: data => transaction(async client => {
      const user = await client.query('INSERT INTO public.bc_users DEFAULT VALUES RETURNING id');
      const id = user.rows[0].id;
      await client.query('INSERT INTO public.bc_auth_accounts(user_id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)', [id, data.email, data.name, data.passwordHash]);
      return { id, email: data.email, name: data.name };
    }),
    findAccount: email => transaction(async client => {
      const result = await client.query('SELECT user_id AS id, email, display_name AS name, password_hash AS "passwordHash" FROM public.bc_auth_accounts WHERE email=$1', [email]);
      return result.rows[0] || null;
    }),
    createSession: (userId, tokenHash, expiresAt) => transaction(async client => {
      await client.query('INSERT INTO public.bc_auth_sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [userId, tokenHash, expiresAt]);
    }),
    getSession: tokenHash => transaction(async client => {
      const result = await client.query('SELECT a.user_id AS id, a.email, a.display_name AS name FROM public.bc_auth_sessions s JOIN public.bc_auth_accounts a ON a.user_id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()', [tokenHash]);
      return result.rows[0] || null;
    }),
    deleteSession: tokenHash => transaction(async client => { await client.query('DELETE FROM public.bc_auth_sessions WHERE token_hash=$1', [tokenHash]); }),
  };
}
