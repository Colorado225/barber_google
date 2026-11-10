/**
 * Clé d'idempotence d'une écriture. La base dédoublonne les envois répétés (double clic, reprise réseau) à
 * partir de cette clé. Utilisée par les passages sans rendez-vous et les encaissements.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
