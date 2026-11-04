// Connexion applicative : chaque requête authentifiée s'exécute dans une
// transaction avec SET LOCAL ROLE bc_app et l'identité de l'utilisateur, afin
// que les politiques RLS s'appliquent réellement côté base.

/**
 * @param {object} db pg.Pool ou PGlite (expose connect/query/exec)
 */
export function createSessionRunner(db) {
  // PGlite n'expose pas de pool : une seule connexion, sérialisée.
  const isPool = typeof db.connect === 'function';

  async function runAs(userId, fn) {
    if (!isPool) return runSerialized(db, userId, fn);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['barber.user_id', userId]);
      await client.query('SET LOCAL ROLE bc_app');
      const result = await fn({ query: (text, params) => client.query(text, params) });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* l'erreur d'origine est conservée */
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return { runAs };
}

// PGlite : les transactions ne sont pas concurrentes, on sérialise les appels.
let queue = Promise.resolve();
function runSerialized(db, userId, fn) {
  const task = queue.then(async () => {
    await db.exec('BEGIN');
    try {
      await db.query('SELECT set_config($1, $2, true)', ['barber.user_id', userId]);
      await db.exec('SET LOCAL ROLE bc_app');
      const result = await fn({ query: (text, params) => db.query(text, params) });
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw error;
    }
  });
  queue = task.catch(() => { });
  return task;
}
