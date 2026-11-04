import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createSalonRepository } from '../../server/salon-repository.js';

const db = new PGlite();
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outsider = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let salon;

async function user(id) {
  await db.exec('reset role');
  await db.query("select set_config('barber.user_id',$1,false)", [id]);
  await db.exec('set role bc_app');
}

test('préparation du schéma et des ressources', async () => {
  await db.exec(await readFile(new URL('../migrations/20261102230000_postgresql_identity.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/20261103020000_auth_accounts.sql', import.meta.url), 'utf8'));
  await db.query('insert into public.bc_users(id) values ($1), ($2)', [owner, outsider]);
  await db.exec(await readFile(new URL('../migrations/20261103000000_tenant_foundation.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/20261103010000_operational_workflow.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/20261103020000_salon_resources.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/20261103030000_lot2_account_security.sql', import.meta.url), 'utf8'));
  await user(owner);
  salon = (await db.query("select * from public.bc_create_salon('Org','Salon','Cocody')")).rows[0].salon_id;
});

const repo = () => createSalonRepository(db, async (fn) => {
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE bc_app');
    const r = await fn();
    await db.exec('COMMIT');
    return r;
  } catch (e) {
    try { await db.exec('ROLLBACK'); } catch { /* transaction déjà terminée */ }
    throw e;
  }
});

test('CRUD client isolé par salon', async () => {
  await user(owner);
  const r = repo();
  const created = await r.createClient(salon, { name: 'Awa Koné', phone: '+225 0102', email: 'a@b.ci', segment: 'new', favoriteService: 'Coupe', notes: 'VIP possible' });
  assert.ok(created.id);

  let list = await r.listClients(salon);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Awa Koné');

  await r.updateClient(salon, created.id, { name: 'Awa K.', phone: '+225 0102', email: '', segment: 'loyal', favoriteService: 'Coupe', notes: '' });
  list = await r.listClients(salon);
  assert.equal(list[0].name, 'Awa K.');
  assert.equal(list[0].segment, 'loyal');

  await r.deleteClient(salon, created.id);
  assert.equal((await r.listClients(salon)).length, 0);
});

test('un outsider ne voit ni ne modifie les données du salon', async () => {
  await user(owner);
  const r = repo();
  await r.createClient(salon, { name: 'Privé', phone: '+225 9999', email: '', segment: 'new', favoriteService: '', notes: '' });

  await user(outsider);
  assert.equal((await r.listClients(salon)).length, 0);
  await assert.rejects(
    r.createClient(salon, { name: 'Intrus', phone: '+225 0000', email: '', segment: 'new', favoriteService: '', notes: '' })
  );
});

test('prestations, équipe, stocks et récompenses : validation serveur', async () => {
  await user(owner);
  const r = repo();

  await assert.rejects(r.saveService(salon, null, { name: '', category: 'coupe', description: '', price: 5000, durationMinutes: 30, popular: false }));
  await assert.rejects(r.saveService(salon, null, { name: 'Coupe', category: 'coupe', description: '', price: -1, durationMinutes: 30, popular: false }));
  const svc = await r.saveService(salon, null, { name: 'Coupe', category: 'coupe', description: 'x', price: 5000, durationMinutes: 30, popular: true });
  assert.ok(svc.id);
  await r.saveService(salon, svc.id, { name: 'Coupe+', category: 'coupe', description: '', price: 6000, durationMinutes: 35, popular: false });
  assert.equal((await r.listServices(salon))[0].price, 6000);

  await assert.rejects(r.saveStaff(salon, null, { name: 'X', role: 'barber', phone: '', specialties: [], commissionRate: 150, isAvailable: true }));
  const staff = await r.saveStaff(salon, null, { name: 'Kevin', role: 'barber', phone: '', specialties: ['Coupe'], commissionRate: 25, isAvailable: true });
  assert.ok(staff.id);

  const item = await r.saveStockItem(salon, null, { name: 'Shampoo', category: 'shampoing', quantity: 5, minThreshold: 2, unitCost: 3000, supplier: 'X' });
  assert.ok(item.id);
  await r.deleteStockItem(salon, item.id);

  await assert.rejects(r.saveReward(salon, null, { name: 'R', description: '', pointsCost: 0, category: 'free_service', active: true }));
  const reward = await r.saveReward(salon, null, { name: 'Coupe offerte', description: '', pointsCost: 100, category: 'free_service', freeServiceName: 'Coupe', active: true });
  assert.ok(reward.id);

  const exp = await r.addExpense(salon, { title: 'Loyer', category: 'rent', amount: 150000, date: '2026-11-01', notes: '' });
  assert.ok(exp.id);
});

test('workspace agrégé renvoie toutes les ressources', async () => {
  await user(owner);
  const r = repo();
  const ws = await r.workspace(salon);
  assert.ok(Array.isArray(ws.clients));
  assert.ok(Array.isArray(ws.services));
  assert.ok(Array.isArray(ws.staff));
  assert.ok(Array.isArray(ws.rewards));
  assert.ok(ws.services.length >= 1);
});

after(async () => { await db.close(); });
