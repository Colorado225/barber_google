// Types du domaine fidélité : récompenses, transactions, comptes et réglages.

export type RewardCategory = 'free_service' | 'discount' | 'product' | 'vip_upgrade';

export interface LoyaltyReward {
  id: string;
  salonId: string;
  name: string;
  description: string;
  pointsCost: number;
  category: RewardCategory;
  isActive: boolean;
  timesRedeemed?: number;
  discountPercentage?: number;
  freeServiceName?: string;
  createdAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  salonId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  points: number; // positive for earn, negative for redeem
  type: 'earned_service' | 'redeemed_reward' | 'welcome_bonus' | 'manual_adjustment' | 'reversal';
  description: string;
  rewardId?: string;
  rewardName?: string;
  appointmentId?: string;
  createdAt: string;
}

// Solde de fidélité tenu par la base (journal append-only), jamais par le navigateur.
export interface LoyaltyAccount {
  salonId: string;
  clientId: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  tier: 'bronze' | 'silver' | 'gold' | 'vip';
  updatedAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  salonId: string;
  clientId: string;
  appointmentId?: string | null;
  rewardId?: string | null;
  kind: 'earned_service' | 'redeemed_reward' | 'welcome_bonus' | 'manual_adjustment' | 'reversal';
  points: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export interface LoyaltySettings {
  salonId: string;
  pointsPer100Fcfa: number; // e.g. 1 point for every 100 FCFA spent
  welcomeBonus: number; // e.g. 25 points
  silverThreshold: number; // e.g. 100 points
  goldThreshold: number; // e.g. 250 points
  vipThreshold: number; // e.g. 500 points
  programEnabled: boolean;
}
