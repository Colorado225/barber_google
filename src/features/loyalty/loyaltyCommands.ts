/**
 * Commandes de fidélité : lecture gardée par permission, puis appels à la base. Les dépendances sont
 * injectées (port) pour tester chaque commande sans React ni réseau.
 * La base reste la source de vérité : aucun solde n'est calculé ici.
 */
import type { LoyaltyAccount, LoyaltyLedgerEntry, LoyaltySettings } from '../../types';

export interface LoyaltyCommandPort {
  program: () => Promise<LoyaltySettings>;
  accounts: () => Promise<LoyaltyAccount[]>;
  ledger: (limit?: number) => Promise<LoyaltyLedgerEntry[]>;
  setProgram: (settings: Partial<LoyaltySettings>) => Promise<LoyaltySettings>;
  redeem: (
    clientId: string,
    rewardId: string,
  ) => Promise<{ transaction_id: string; points_balance: number; tier: string; reward_name: string }>;
  adjust: (
    clientId: string,
    points: number,
    reason: string,
  ) => Promise<{ transaction_id: string; points_balance: number; tier: string }>;
}

/** Nombre maximal d'écritures du journal chargées pour l'affichage. */
export const LOYALTY_LEDGER_LIMIT = 150;

export type LoyaltySnapshot =
  | { readable: false }
  | {
      readable: true;
      program: LoyaltySettings;
      accounts: LoyaltyAccount[];
      ledger: LoyaltyLedgerEntry[];
    };

/**
 * Charge le programme, les soldes et le journal seulement si le rôle actif a `loyalty.read`.
 * Sans permission, ni le port ni la base ne sont sollicités : l'appelant vide les soldes et le journal.
 */
export async function fetchLoyaltySnapshot(
  getPort: () => LoyaltyCommandPort,
  canRead: boolean,
): Promise<LoyaltySnapshot> {
  if (!canRead) return { readable: false };
  const port = getPort();
  const [program, accounts, ledger] = await Promise.all([
    port.program(),
    port.accounts(),
    port.ledger(LOYALTY_LEDGER_LIMIT),
  ]);
  return { readable: true, program, accounts, ledger };
}

export function saveLoyaltyProgram(
  port: LoyaltyCommandPort,
  updates: Partial<LoyaltySettings>,
): Promise<LoyaltySettings> {
  return port.setProgram(updates);
}

export function redeemLoyaltyReward(port: LoyaltyCommandPort, clientId: string, rewardId: string) {
  return port.redeem(clientId, rewardId);
}

export function adjustLoyaltyPoints(
  port: LoyaltyCommandPort,
  clientId: string,
  points: number,
  reason: string,
) {
  return port.adjust(clientId, points, reason);
}
