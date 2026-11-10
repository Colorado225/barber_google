/**
 * Règles du personnel (fonctions pures). Le serveur reste la référence.
 */
import type { StaffMember } from '../../types';

export type StaffFields = Pick<
  StaffMember,
  'name' | 'role' | 'phone' | 'specialties' | 'commissionRate' | 'isAvailable'
>;

/** Charge utile : les six champs éditables, sans identifiant ni rattachement. */
export function toStaffPayload(member: StaffFields): StaffFields {
  return {
    name: member.name,
    role: member.role,
    phone: member.phone,
    specialties: member.specialties,
    commissionRate: member.commissionRate,
    isAvailable: member.isAvailable,
  };
}
