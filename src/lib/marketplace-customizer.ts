import type {
  SalonMarketplaceSettingsRecord,
  SalonMarketplaceViewConfig,
  SalonMarketplaceLayout,
  SalonCardStyle
} from '../types';
import { getSupabaseClient } from './supabase';
import { ApiError } from './api';

type DbRow = Record<string, unknown>;

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    const status = result.error.code === '42501' ? 403 : result.error.code === '23505' ? 409 : 400;
    throw new ApiError(result.error.message, status, result.error.code);
  }
  if (result.data === null) throw new ApiError('Supabase n’a retourné aucune donnée.');
  return result.data;
}

export function getDefaultCustomizerConfig(salonId?: string): SalonMarketplaceViewConfig {
  return {
    layout: 'classic',
    accentColor: '#C9A45C',
    cardStyle: 'rounded-3xl',
    sections: [
      { id: 'hero', enabled: true, position: 0 },
      { id: 'gallery', enabled: true, position: 1 },
      { id: 'featured_services', enabled: true, position: 2 },
      { id: 'team', enabled: true, position: 3 },
      { id: 'trust', enabled: true, position: 4 },
      { id: 'location_hours', enabled: true, position: 5 },
      { id: 'reviews', enabled: true, position: 6 },
    ],
    featuredServiceIds: [],
    visibleStaffIds: [],
    featuredGalleryImageIds: [],
    showAddress: true,
    showPhone: true,
    showWhatsapp: true,
    customTagline: '',
    customDescription: '',
    themeMode: 'dark',
  };
}

function mapSettingsRecord(data: DbRow): SalonMarketplaceSettingsRecord {
  const draft = (data.draft_config as SalonMarketplaceViewConfig) ?? getDefaultCustomizerConfig(String(data.salon_id));
  const published = (data.published_config as SalonMarketplaceViewConfig) ?? null;
  return {
    salonId: String(data.salon_id),
    layout: (data.layout as SalonMarketplaceLayout) ?? draft.layout ?? 'classic',
    accentColor: String(data.accent_color ?? draft.accentColor ?? '#C9A45C'),
    cardStyle: (data.card_style as SalonCardStyle) ?? draft.cardStyle ?? 'rounded-3xl',
    draftConfig: draft,
    publishedConfig: published,
    isPublished: data.is_published === true,
    publishedAt: data.published_at ? String(data.published_at) : null,
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
  };
}

export async function getCustomizerConfig(salonId: string): Promise<SalonMarketplaceSettingsRecord> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('get_marketplace_customizer_config', { p_salon_id: salonId });
  const data = unwrap(result) as DbRow;
  return mapSettingsRecord(data);
}

export async function saveCustomizerDraft(
  salonId: string,
  config: SalonMarketplaceViewConfig
): Promise<SalonMarketplaceSettingsRecord> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('save_marketplace_customizer_draft', {
    p_salon_id: salonId,
    p_config: config,
  });
  const data = unwrap(result) as DbRow;
  return mapSettingsRecord(data);
}

export async function publishCustomizer(salonId: string): Promise<SalonMarketplaceSettingsRecord> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('publish_marketplace_customizer', { p_salon_id: salonId });
  const data = unwrap(result) as DbRow;
  return mapSettingsRecord(data);
}

export async function unpublishCustomizer(
  salonId: string
): Promise<{ salonId: string; isPublished: boolean; updatedAt: string }> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('unpublish_marketplace_customizer', { p_salon_id: salonId });
  const data = unwrap(result) as DbRow;
  return {
    salonId: String(data.salon_id),
    isPublished: data.is_published === true,
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
  };
}

export async function revertCustomizerDraft(salonId: string): Promise<SalonMarketplaceSettingsRecord> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('revert_marketplace_customizer_draft', { p_salon_id: salonId });
  const data = unwrap(result) as DbRow;
  return mapSettingsRecord(data);
}
