import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const accountantA = '33333333-3333-4333-8333-333333333333';
const barberA = '44444444-4444-4444-8444-444444444444';
const ownerB = '55555555-5555-4555-8555-555555555555';

let salonA;
let branchA;
let salonB;
let supplierAId;
let supplierBId;
let stockItemId;
let exp1Id;
let exp2Id;

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

async function asAdmin() {
  await db.exec('reset role');
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

async function rpcRow(sql, params = []) {
  const row = (await db.query(`select * from public.${sql}`, params)).rows[0];
  return row;
}

async function rpcJson(sql, params = []) {
  const res = await db.query(`select public.${sql} as value`, params);
  return res.rows[0].value;
}

after(async () => {
  await db.close();
});

test('toutes les migrations P2 opérationnelles s’appliquent et isolent les tenants', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query(
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now())',
    [ownerA, managerA, accountantA, barberA, ownerB],
  );

  const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    await db.exec(await readFile(new URL(name, migrationsDir), 'utf8'));
  }

  await asUser(ownerA);
  const resA = await db.query("select * from public.create_salon('Org A', 'Salon A', 'Plateau')");
  salonA = resA.rows[0].salon_id;
  branchA = resA.rows[0].branch_id;

  await asUser(ownerB);
  const resB = await db.query("select * from public.create_salon('Org B', 'Salon B', 'Marcory')");
  salonB = resB.rows[0].salon_id;

  await asAdmin();
  await db.query(
    `insert into public.memberships(salon_id, user_id, role)
     values ($1, $2, 'manager'), ($1, $3, 'accountant'), ($1, $4, 'barber')`,
    [salonA, managerA, accountantA, barberA],
  );

  // Vérifie le durcissement des droits directs
  await asUser(ownerA);
  await expectCode(db.query('delete from public.suppliers where salon_id = $1', [salonA]), '42501');
  await expectCode(db.query('delete from public.stock_movements where salon_id = $1', [salonA]), '42501');
});

test('fournisseurs : création, mise à jour, unicité, permissions et refus de suppression physique', async () => {
  await asUser(managerA);
  const created = await rpcRow('upsert_supplier($1, $2, $3, $4, $5, $6, $7, $8, null)', [
    salonA,
    'AfroBeauté Pro',
    'Koffi Yao',
    '+22507000001',
    'Commandes@AfroBeaute.CI',
    'Cocody Riviera',
    'Livraison 48h',
    true,
  ]);
  supplierAId = created.id;
  assert.equal(created.name, 'AfroBeauté Pro');
  assert.equal(created.email, 'commandes@afrobeaute.ci');

  // Doublon insensible à la casse dans le même salon -> 23505
  await expectCode(
    db.query(
      "select * from public.upsert_supplier($1, '  afrobeauté pro ', '', '', null, '', '', true, null)",
      [salonA],
    ),
    '23505',
  );

  // Barbier : ni lecture, ni écriture
  await asUser(barberA);
  await expectCode(db.query('select public.list_suppliers($1, true)', [salonA]), '42501');
  await expectCode(db.query("select * from public.upsert_supplier($1, 'Test')", [salonA]), '42501');

  // Comptable : lecture autorisée, écriture refusée
  await asUser(accountantA);
  const listForAccountant = await rpcJson('list_suppliers($1, true)', [salonA]);
  assert.equal(listForAccountant.length, 1);
  await expectCode(db.query("select * from public.upsert_supplier($1, 'Test')", [salonA]), '42501');

  // Tenant B crée son propre fournisseur sans collision ni fuite
  await asUser(ownerB);
  const supB = await rpcRow("upsert_supplier($1, 'AfroBeauté Pro')", [salonB]);
  supplierBId = supB.id;
  await expectCode(db.query('select public.list_suppliers($1, true)', [salonA]), '42501');
});

test('stocks : journal append-only des mouvements et blocage de toute réécriture directe de quantité', async () => {
  await asUser(managerA);
  const item = await rpcRow('create_stock_item($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [
    salonA,
    'Cire Mate 150ml',
    'gel_cire',
    10,
    3,
    2500,
    supplierAId,
    '',
    'Stock initial BL-01',
    branchA,
    4500,
  ]);
  stockItemId = item.id;
  assert.equal(item.quantity, 10);
  assert.equal(item.supplier, 'AfroBeauté Pro');

  // Le mouvement initial est créé automatiquement
  const initialMovements = await rpcJson('list_stock_movements($1, $2, 50)', [salonA, stockItemId]);
  assert.equal(initialMovements.length, 1);
  assert.equal(initialMovements[0].movement_type, 'initial');
  assert.equal(initialMovements[0].quantity_before, 0);
  assert.equal(initialMovements[0].quantity_after, 10);
  assert.equal(initialMovements[0].quantity_delta, 10);

  // Réapprovisionnement (+5) + Perte (-2) + Vente (-4) -> stock final = 9
  const restock = await rpcRow('record_stock_movement($1, $2, $3, $4, $5, $6, $7, $8, $9, null)', [
    salonA,
    stockItemId,
    'restock',
    5,
    'Réappro mensuel',
    branchA,
    supplierAId,
    2400,
    'BL-2026-02',
  ]);
  assert.equal(restock.quantity_before, 10);
  assert.equal(restock.quantity_after, 15);

  const loss = await rpcRow('record_stock_movement($1, $2, $3, $4, $5, $6, null, null, null, null)', [
    salonA,
    stockItemId,
    'loss',
    -2,
    '2 pots abîmés en réserve',
    branchA,
  ]);
  assert.equal(loss.quantity_before, 15);
  assert.equal(loss.quantity_after, 13);

  const sale = await rpcRow('record_stock_movement($1, $2, $3, $4, $5, $6, null, null, null, null)', [
    salonA,
    stockItemId,
    'sale',
    -4,
    'Vente comptoir client',
    branchA,
  ]);
  assert.equal(sale.quantity_after, 9);

  // Stock insuffisant refusé
  await expectCode(
    db.query("select * from public.record_stock_movement($1, $2, 'sale', -20, 'Impossible', $3)", [
      salonA,
      stockItemId,
      branchA,
    ]),
    '22023',
  );

  // Fournisseur d’un autre tenant refusé
  await expectCode(
    db.query("select * from public.record_stock_movement($1, $2, 'restock', 1, 'Cross-tenant', $3, $4)", [
      salonA,
      stockItemId,
      branchA,
      supplierBId,
    ]),
    '22023',
  );

  // Modification métadonnées sans altérer la quantité
  const metaUpdated = await rpcRow('update_stock_item_metadata($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [
    salonA,
    stockItemId,
    'Cire Mate Premium 150ml',
    'gel_cire',
    4,
    2400,
    supplierAId,
    '',
    5000,
    true,
  ]);
  assert.equal(metaUpdated.name, 'Cire Mate Premium 150ml');
  assert.equal(metaUpdated.quantity, 9);
  assert.equal(Number(metaUpdated.selling_price), 5000);

  // Même un update SQL direct par un rôle privilégié (trigger guard) sans GUC est bloqué
  await asAdmin();
  await expectCode(
    db.query('update public.stock_items set quantity = 999 where id = $1', [stockItemId]),
    '42501',
  );
  await expectCode(db.query('delete from public.stock_movements where salon_id = $1', [salonA]), '42501');

  // Barbier : lecture OK, écriture refusée
  await asUser(barberA);
  const movements = await rpcJson('list_stock_movements($1, $2, 50)', [salonA, stockItemId]);
  assert.equal(movements.length, 4);
  await expectCode(
    db.query("select * from public.record_stock_movement($1, $2, 'loss', -1, 'Test')", [salonA, stockItemId]),
    '42501',
  );
});

test('storage : compartiments et politiques RLS multi-tenant s’appliquent quand storage existe', async () => {
  const storageDb = new PGlite();
  try {
    await storageDb.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create schema storage;
      create table storage.buckets (
        id text primary key,
        name text not null,
        public boolean not null default false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text not null references storage.buckets(id),
        name text not null
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated, anon;
      grant select, insert, update, delete on storage.objects to authenticated;
    `);
    await storageDb.query('insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now())', [
      ownerA,
      ownerB,
    ]);
    const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const name of files) {
      await storageDb.exec(await readFile(new URL(name, migrationsDir), 'utf8'));
    }

    const buckets = (
      await storageDb.query('select id, public, file_size_limit from storage.buckets order by id')
    ).rows;
    assert.deepEqual(
      buckets.map((b) => ({ id: b.id, public: b.public, limit: Number(b.file_size_limit) })),
      [
        { id: 'expense-attachments', public: false, limit: 10485760 },
        { id: 'salon-media', public: true, limit: 5242880 },
      ],
    );

    await storageDb.exec('reset role');
    await storageDb.query("select set_config('request.jwt.claim.sub', $1, false)", [ownerA]);
    await storageDb.exec('set role authenticated');
    const sA = (await storageDb.query("select * from public.create_salon('Org S', 'Salon S', 'Cocody')"))
      .rows[0].salon_id;

    // Upload dans son propre répertoire autorisé
    await storageDb.query("insert into storage.objects(bucket_id, name) values ('salon-media', $1)", [
      `${sA}/logo/logo.png`,
    ]);
    await storageDb.query("insert into storage.objects(bucket_id, name) values ('expense-attachments', $1)", [
      `${sA}/expenses/recu.pdf`,
    ]);

    // Chemin malformé ou d'un autre tenant rejeté proprement par RLS (42501, pas de crash UUID)
    await expectCode(
      storageDb.query(
        "insert into storage.objects(bucket_id, name) values ('salon-media', 'not-a-uuid/logo.png')",
      ),
      '42501',
    );
    await expectCode(
      storageDb.query("insert into storage.objects(bucket_id, name) values ('expense-attachments', $1)", [
        `${salonB}/expenses/leak.pdf`,
      ]),
      '42501',
    );
  } finally {
    await storageDb.close();
  }
});

test('dépenses : pièces jointes, contrepassation, correction auditée et bilan net dans financial_summary', async () => {
  await asUser(ownerA);
  // 1) Création avec fournisseur + pièce jointe Storage
  const path1 = `${salonA}/expenses/facture-cie.pdf`;
  const e1 = await rpcRow('record_expense($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)', [
    salonA,
    'Facture CIE Novembre',
    'electricity',
    10000,
    '2026-11-10',
    branchA,
    'Compteur principal',
    'CIE-2026-11',
    supplierAId,
    path1,
    'facture-cie.pdf',
    'application/pdf',
    245120,
  ]);
  exp1Id = e1.id;
  assert.equal(e1.entry_kind, 'expense');
  assert.equal(e1.status, 'active');
  assert.equal(e1.attachment_path, path1);

  // Chemin cross-tenant rejeté
  await expectCode(
    db.query(
      "select * from public.record_expense($1, 'Bad path', 'other', 1000, '2026-11-10', $2, '', null, null, $3, 'bad.pdf', 'application/pdf', 100)",
      [salonA, branchA, `${salonB}/expenses/hack.pdf`],
    ),
    '22023',
  );

  // 2) Création d’une 2e dépense puis rattachement ultérieur de pièce jointe
  const e2 = await rpcRow('record_expense($1, $2, $3, $4, $5, $6)', [
    salonA,
    'Achat ciseaux',
    'products',
    12000,
    '2026-11-10',
    branchA,
  ]);
  exp2Id = e2.id;

  const attached = await rpcRow('attach_expense_receipt($1, $2, $3, $4, $5, $6)', [
    salonA,
    exp2Id,
    `${salonA}/expenses/recu-ciseaux.png`,
    'recu-ciseaux.png',
    'image/png',
    180400,
  ]);
  assert.equal(attached.attachment_name, 'recu-ciseaux.png');

  // 3) Contrepassation de e1 (10 000 FCFA -> net = 0 pour e1)
  const reversal = await rpcRow('reverse_expense($1, $2, $3)', [salonA, exp1Id, 'Erreur double saisie CIE']);
  assert.equal(reversal.entry_kind, 'expense_reversal');
  assert.equal(Number(reversal.amount), 10000);
  assert.equal(reversal.original_expense_id, exp1Id);

  // Double contrepassation bloquée
  await expectCode(
    db.query("select * from public.reverse_expense($1, $2, 'Double annulation')", [salonA, exp1Id]),
    '22023',
  );

  // 4) Correction de e2 (12 000 FCFA -> 14 500 FCFA)
  const corrected = await rpcRow('correct_expense($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [
    salonA,
    exp2Id,
    'Achat ciseaux pro japonais',
    'products',
    14500,
    '2026-11-10',
    'Montant TTC rectifié après facture',
    branchA,
    'Inclut livraison',
    'FAC-99',
    supplierAId,
  ]);
  assert.equal(corrected.status, 'active');
  assert.equal(Number(corrected.amount), 14500);

  // L’écriture d’origine reste présente en base avec status = 'superseded'
  const origRow = (await db.query('select status from public.expenses where id = $1', [exp2Id])).rows[0];
  assert.equal(origRow.status, 'superseded');

  // Aucune suppression ni écrasement direct possible même en admin (trigger)
  await asAdmin();
  await expectCode(db.query('delete from public.expenses where id = $1', [corrected.id]), '42501');
  await expectCode(db.query('update public.expenses set amount = 1 where id = $1', [corrected.id]), '42501');

  // 5) financial_summary doit retourner exactement 14 500 FCFA net
  await asUser(accountantA);
  const summary = await rpcRow("financial_summary($1, '2026-11-01', '2026-11-30')", [salonA]);
  assert.equal(Number(summary.expenses), 14500);
  assert.equal(Number(summary.net_balance), -14500);

  // Journal d’audit des événements complet pour le comptable
  const events = await rpcJson('list_expense_events($1, null, 50)', [salonA]);
  assert.equal(events.length, 5); // recorded(e1), recorded(e2), attachment_updated(e2), reversed(e1), corrected(e2)

  // Comptable ne peut pas contrepasser, barbier ne peut ni lire ni écrire
  await expectCode(
    db.query("select * from public.reverse_expense($1, $2, 'Interdit')", [salonA, corrected.id]),
    '42501',
  );
  await asUser(barberA);
  await expectCode(db.query('select public.list_expense_events($1, null, 20)', [salonA]), '42501');
});
