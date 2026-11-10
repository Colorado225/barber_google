/**
 * Charge utile du profil salon (fonction pure). Seuls les champs présents dans la mise à jour sont envoyés.
 * Une chaîne vide efface le champ (null) pour le slug, le logo, la couverture et l'e-mail.
 */
import type { Salon } from '../../types';

export function toSalonProfilePayload(updates: Partial<Salon>): Record<string, unknown> {
  const profile: Record<string, unknown> = {};
  if (updates.name !== undefined) profile.name = updates.name;
  if (updates.slug !== undefined) profile.slug = updates.slug || null;
  if (updates.tagline !== undefined) profile.tagline = updates.tagline;
  if (updates.description !== undefined) profile.description = updates.description;
  if (updates.type !== undefined) profile.type = updates.type;
  if (updates.logo !== undefined) profile.logo_url = updates.logo || null;
  if (updates.coverImage !== undefined) profile.cover_url = updates.coverImage || null;
  if (updates.country !== undefined) profile.country = updates.country;
  if (updates.city !== undefined) profile.city = updates.city;
  if (updates.commune !== undefined) profile.commune = updates.commune;
  if (updates.quarter !== undefined) profile.quarter = updates.quarter;
  if (updates.address !== undefined) profile.address = updates.address;
  if (updates.phone !== undefined) profile.phone = updates.phone;
  if (updates.whatsapp !== undefined) profile.whatsapp = updates.whatsapp;
  if (updates.email !== undefined) profile.email = updates.email || null;
  if (updates.paymentMethods !== undefined) profile.payment_methods = updates.paymentMethods;
  if (updates.featuredPrestations !== undefined) profile.featured_service_ids = updates.featuredPrestations;
  // La galerie détaillée (titre, description) a priorité sur la galerie simple (URL seules).
  if (updates.galleryItems !== undefined) {
    profile.gallery = updates.galleryItems.map((item) => ({
      url: item.url,
      title: item.title,
      description: item.description,
    }));
  } else if (updates.gallery !== undefined) {
    profile.gallery = updates.gallery.map((url) => ({ url, title: '', description: '' }));
  }
  return profile;
}
