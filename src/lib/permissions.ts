const MEMBER_PERMISSIONS = [
  'dashboard.read',
  'services.read',
  'staff.read',
  'clients.read',
  'loyalty.read',
  'reviews.read',
  'salon.read',
] as const;

// Aligné sur private.has_salon_permission (migrations canoniques Supabase).
const FINANCE_READ = ['payments.read', 'cash.read'] as const;
const FINANCE_RECORD = ['payments.record', 'cash.open', 'cash.close'] as const;
const FINANCE_CORRECT = ['payments.correct'] as const;
const REPORTS = ['reports.read'] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    ...MEMBER_PERMISSIONS,
    'clients.write',
    'appointments.read',
    'appointments.write',
    'catalog.write',
    'team.write',
    'expenses.read',
    'expenses.manage',
    'stock.read',
    'stock.write',
    'loyalty.write',
    'members.read',
    'members.manage',
    'salon.update',
    'branch.create',
    'branch.update',
    ...FINANCE_READ,
    ...FINANCE_RECORD,
    ...FINANCE_CORRECT,
    'cash.reconcile',
    ...REPORTS,
    'subscriptions.read',
    'display.update',
  ],
  manager: [
    ...MEMBER_PERMISSIONS,
    'clients.write',
    'appointments.read',
    'appointments.write',
    'catalog.write',
    'team.write',
    'expenses.read',
    'expenses.manage',
    'stock.read',
    'stock.write',
    'loyalty.write',
    'members.read',
    'branch.create',
    'branch.update',
    ...FINANCE_READ,
    ...FINANCE_RECORD,
    ...FINANCE_CORRECT,
    ...REPORTS,
    'display.update',
  ],
  receptionist: [
    ...MEMBER_PERMISSIONS,
    'clients.write',
    'appointments.read',
    'appointments.write',
    'stock.read',
    'payments.read',
  ],
  barber: [...MEMBER_PERMISSIONS, 'appointments.read', 'stock.read'],
  cashier: [...MEMBER_PERMISSIONS, 'appointments.read', 'stock.read', ...FINANCE_READ, ...FINANCE_RECORD],
  accountant: [...MEMBER_PERMISSIONS, 'expenses.read', ...FINANCE_READ, ...REPORTS],
};

export function getRolePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

export function roleHasPermission(role: string, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
