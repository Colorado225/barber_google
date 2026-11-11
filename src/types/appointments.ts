// Types du domaine rendez-vous : statuts et fiche de rendez-vous.

import type { PaymentMethod } from './finance';

export type AppointmentStatus =
  'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'refunded';

export interface Appointment {
  id: string;
  salonId: string;
  branchId?: string;
  clientId?: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  serviceName: string;
  price: number;
  staffId: string | null;
  staffName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  source: 'marketplace' | 'direct' | 'whatsapp' | 'phone' | 'walk_in';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  /** Horodatages serveur (source de vérité du calendrier). */
  startsAt?: string;
  endsAt?: string;
  /** Clients de passage : arrivée, début et fin réels de la prestation. */
  arrivalAt?: string;
  serviceStartedAt?: string;
  serviceCompletedAt?: string;
}
