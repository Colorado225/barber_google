import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface PublicPlatformStatus {
  defaultCurrency: string;
  maintenanceMode: boolean;
  autoApproveSalons: boolean;
}

export interface PlatformGlobalSettings extends PublicPlatformStatus {
  updatedAt: string | null;
  updatedBy: string | null;
  commissionRateAvailable: false;
}

export interface PlatformStatusRpcClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

const DEFAULT_PUBLIC_STATUS: PublicPlatformStatus = {
  defaultCurrency: 'XOF',
  maintenanceMode: false,
  autoApproveSalons: true,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function mapPublicPlatformStatus(raw: unknown): PublicPlatformStatus {
  const row = asRecord(raw);
  return {
    defaultCurrency:
      typeof row.default_currency === 'string' && row.default_currency ? row.default_currency : 'XOF',
    maintenanceMode: row.maintenance_mode === true,
    autoApproveSalons: row.auto_approve_salons !== false,
  };
}

export function mapPlatformGlobalSettings(raw: unknown): PlatformGlobalSettings {
  const row = asRecord(raw);
  const base = mapPublicPlatformStatus(raw);
  return {
    ...base,
    updatedAt: typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : null,
    updatedBy: typeof row.updated_by === 'string' && row.updated_by ? row.updated_by : null,
    commissionRateAvailable: false,
  };
}

/**
 * Lit le statut public minimal de la plateforme (mode maintenance, auto-publication).
 * En l'absence de configuration Supabase (mode local / tests), retourne les valeurs
 * neutres par défaut afin de ne pas bloquer l'interface.
 */
export async function getPublicPlatformStatus(
  clientOverride?: PlatformStatusRpcClient,
): Promise<PublicPlatformStatus> {
  if (!clientOverride && !isSupabaseConfigured()) {
    return DEFAULT_PUBLIC_STATUS;
  }
  const client = clientOverride ?? getSupabaseClient();
  const { data, error } = await client.rpc('get_public_platform_status');
  if (error) {
    throw new Error(error.message || 'Impossible de vérifier le statut de la plateforme.');
  }
  return mapPublicPlatformStatus(data);
}
