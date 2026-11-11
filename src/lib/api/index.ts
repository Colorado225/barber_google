// Façade publique de l'API salon — conservation des exports de l'ancien
// `src/lib/api.ts` : les importeurs (`../lib/api`, `./api`) restent inchangés.
export { ApiError } from '../apiError';
export { salonApi } from './salon';
export { mapAppointmentRow, mapErpDashboardMetrics, mapNotificationRow } from './mappers';
export type {
  AppointmentInput,
  Availability,
  ExpenseCorrectionInput,
  ExpenseInput,
  PaymentCorrectionInput,
  PaymentListParams,
  RecordPaymentInput,
  RecordStockMovementInput,
  RescheduleInput,
  ReviewInput,
  StaffAbsence,
  StaffInput,
  StaffSchedule,
  StockInput,
  SupplierInput,
  WalkInInput,
  ClientInput,
  ServiceInput,
} from './inputs';
