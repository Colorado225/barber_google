const MEMBER_PERMISSIONS = [
  'dashboard.read',
  'services.read',
  'staff.read',
  'clients.read',
  'loyalty.read',
  'reviews.read',
  'salon.read',
] as const;

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
    'payments.read',
    'payments.write',
    'payments.refund.read',
    'payments.refund.write',
    'cashier.read',
    'cashier.write',
    'display.update',  // vitrine/modifications
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
    'payments.read',
    'payments.write',
    'payments.refund.read',
    'payments.refund.write',
    'cashier.read',
    'cashier.write',
    'display.update',  // vitrine/modifications
  ],
  receptionist: [
    ...MEMBER_PERMISSIONS,
    'clients.write',
    'appointments.read',
    'appointments.write',
    'stock.read',
    'payments.read',  // Lectures paiement pour receptionniste
  ],
  barber: [...MEMBER_PERMISSIONS, 'appointments.read', 'stock.read'],
  cashier: [
    ...MEMBER_PERMISSIONS,
    'appointments.read',
    'stock.read',
    'payments.read',
    'payments.write',
    'cashier.read',
    'cashier.write',
  ],
  accountant: [
    ...MEMBER_PERMISSIONS,
    'expenses.read',
    'payments.read',
    'payments.write',
  ],
};

export function getRolePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

export function roleHasPermission(role: string, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
