import { ApiError } from './apiError';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export const SALON_MEDIA_BUCKET = 'salon-media';
export const EXPENSE_ATTACHMENTS_BUCKET = 'expense-attachments';

export const MAX_SALON_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_EXPENSE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_EXPENSE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type SalonMediaKind = 'logo' | 'cover' | 'gallery';

export interface UploadedSalonMedia {
  path: string;
  publicUrl: string;
}

export interface UploadedExpenseAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
}

export interface StorageLikeClient {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File | Blob,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ data: { path: string } | null; error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

export function sanitizeStorageFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'fichier';
  const cleaned = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.slice(0, 80) || 'fichier';
}

function generateUploadToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildSalonMediaPath(salonId: string, kind: SalonMediaKind, filename: string): string {
  return `${salonId}/${kind}/${generateUploadToken()}-${sanitizeStorageFilename(filename)}`;
}

export function buildExpenseAttachmentPath(salonId: string, filename: string): string {
  return `${salonId}/expenses/${generateUploadToken()}-${sanitizeStorageFilename(filename)}`;
}

function assertFileSizeAndMime(
  file: Pick<File, 'name' | 'type' | 'size'>,
  allowedMimes: readonly string[],
  maxBytes: number,
  label: string,
) {
  if (!file || file.size <= 0) {
    throw new ApiError(`Le fichier ${label} est vide ou introuvable.`, 400);
  }
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new ApiError(`Le fichier ${label} dépasse la taille maximale autorisée (${maxMb} Mo).`, 400);
  }
  if (!allowedMimes.includes(file.type)) {
    throw new ApiError(`Format non pris en charge pour ${label} (${file.type || 'inconnu'}).`, 400);
  }
}

export async function uploadSalonMedia(
  salonId: string,
  kind: SalonMediaKind,
  file: File,
  clientOverride?: StorageLikeClient,
): Promise<UploadedSalonMedia> {
  if (!salonId) throw new ApiError('Identifiant salon manquant.', 400);
  assertFileSizeAndMime(file, ALLOWED_IMAGE_MIME_TYPES, MAX_SALON_IMAGE_BYTES, 'visuel salon');

  if (!clientOverride && !isSupabaseConfigured()) {
    throw new ApiError("Supabase Storage n'est pas configuré sur cet environnement.", 503);
  }

  const client = clientOverride ?? (getSupabaseClient() as unknown as StorageLikeClient);
  const path = buildSalonMediaPath(salonId, kind, file.name);
  const bucket = client.storage.from(SALON_MEDIA_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new ApiError(`Échec de l’envoi vers Supabase Storage : ${error.message}`, 400);
  }

  const { data } = bucket.getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new ApiError('URL publique Storage introuvable après téléversement.', 500);
  }
  return { path, publicUrl: data.publicUrl };
}

export async function uploadExpenseAttachment(
  salonId: string,
  file: File,
  clientOverride?: StorageLikeClient,
): Promise<UploadedExpenseAttachment> {
  if (!salonId) throw new ApiError('Identifiant salon manquant.', 400);
  assertFileSizeAndMime(file, ALLOWED_EXPENSE_MIME_TYPES, MAX_EXPENSE_ATTACHMENT_BYTES, 'pièce jointe');

  if (!clientOverride && !isSupabaseConfigured()) {
    throw new ApiError("Supabase Storage n'est pas configuré sur cet environnement.", 503);
  }

  const client = clientOverride ?? (getSupabaseClient() as unknown as StorageLikeClient);
  const path = buildExpenseAttachmentPath(salonId, file.name);
  const bucket = client.storage.from(EXPENSE_ATTACHMENTS_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new ApiError(`Échec de l’envoi du justificatif : ${error.message}`, 400);
  }

  return {
    path,
    name: file.name.slice(0, 180),
    mime: file.type,
    size: file.size,
  };
}

export async function createExpenseAttachmentSignedUrl(
  salonId: string,
  attachmentPath: string,
  expiresInSeconds = 300,
  clientOverride?: StorageLikeClient,
): Promise<string> {
  if (!attachmentPath.startsWith(`${salonId}/expenses/`) || attachmentPath.includes('..')) {
    throw new ApiError('Chemin de pièce jointe invalide pour cet établissement.', 403);
  }
  if (!clientOverride && !isSupabaseConfigured()) {
    throw new ApiError("Supabase Storage n'est pas configuré sur cet environnement.", 503);
  }
  const client = clientOverride ?? (getSupabaseClient() as unknown as StorageLikeClient);
  const { data, error } = await client.storage
    .from(EXPENSE_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachmentPath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new ApiError(
      `Impossible d’ouvrir le justificatif : ${error?.message ?? 'lien signé indisponible'}.`,
      400,
    );
  }
  return data.signedUrl;
}
