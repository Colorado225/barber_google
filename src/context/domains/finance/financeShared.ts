// Signatures transverses du domaine finance, partagées entre les modules
// d'opérations (paiement, caisse, dépenses, stock) et le contexte racine.

/** Rechargement de la source de vérité finance (état + cache domaine). */
export type LoadFinanceFn = (
  salonId: string,
  isGuardActive?: () => boolean,
  options?: { force?: boolean; timeZone?: string },
) => Promise<void>;

/** Resynchronisation inter-domaines après une écriture financière. */
export type SyncAfterFinanceFn = (appointmentId?: string) => Promise<void>;
