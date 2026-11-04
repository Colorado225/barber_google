import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRolePermissions, roleHasPermission } from '../src/lib/permissions';

test('les permissions UI reprennent strictement le contrat Supabase par rôle', () => {
  assert.deepEqual(
    getRolePermissions('owner').sort(),
    [
      'appointments.read',
      'appointments.write',
      'branch.create',
      'branch.update',
      'cash.close',
      'cash.open',
      'cash.read',
      'cash.reconcile',
      'catalog.write',
      'clients.read',
      'clients.write',
      'dashboard.read',
      'display.update',
      'expenses.manage',
      'expenses.read',
      'loyalty.read',
      'loyalty.write',
      'members.manage',
      'members.read',
      'payments.correct',
      'payments.read',
      'payments.record',
      'reports.read',
      'reviews.read',
      'salon.read',
      'salon.update',
      'services.read',
      'staff.read',
      'stock.read',
      'stock.write',
      'subscriptions.read',
      'team.write',
    ].sort(),
  );

  assert.equal(roleHasPermission('manager', 'members.manage'), false);
  assert.equal(roleHasPermission('receptionist', 'catalog.write'), false);
  assert.equal(roleHasPermission('accountant', 'expenses.read'), true);
  assert.equal(roleHasPermission('accountant', 'appointments.read'), false);
  assert.equal(roleHasPermission('cashier', 'payments.create'), false);
  assert.equal(roleHasPermission('owner', 'reports.read'), true);
  assert.equal(roleHasPermission('unknown', 'dashboard.read'), false);
});
