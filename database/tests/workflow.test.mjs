import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outsider = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const receptionist = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let salon, branch, otherBranch, appointment;
let keyCounter = 1;
const key = () => `00000000-0000-4000-8000-${String(keyCounter++).padStart(12, '0')}`;
async function user(id) { await db.exec('reset role'); await db.query("select set_config('barber.user_id',$1,false)",[id]); await db.exec('set role bc_app'); }
async function entry(kind, amount, method = 'cash', reason = null, id = key(), original = null) {
 return (await db.query('select public.bc_record_manual_entry($1,$2,$3,$4,$5,$6,$7) as id',[appointment,kind,amount,method,reason,id,original])).rows[0].id;
}

test('préparation et séparation par salon, succursale et action', async () => {
 await db.exec(await readFile(new URL('../migrations/20261102230000_postgresql_identity.sql', import.meta.url), 'utf8'));
 await db.query('insert into public.bc_users(id) values ($1), ($2), ($3)', [owner, outsider, receptionist]);
 for (const name of ['20261103000000_tenant_foundation.sql','20261103010000_operational_workflow.sql']) await db.exec(await readFile(new URL('../migrations/' + name, import.meta.url),'utf8'));
 await user(owner);
 const result = await db.query("select * from public.bc_create_salon('Organisation','Salon','Cocody')");
 salon = result.rows[0].salon_id; branch = result.rows[0].branch_id;
 otherBranch = (await db.query("insert into public.bc_branches(salon_id,name) values ($1,'Marcory') returning id",[salon])).rows[0].id;
 await db.exec('reset role');
 const member = (await db.query("insert into public.bc_memberships(salon_id,user_id,role) values ($1,$2,'receptionist') returning id",[salon,receptionist])).rows[0].id;
 await user(owner);
 await db.query('select public.bc_assign_member_to_branch($1,$2,$3)',[salon,branch,member]);
 await user(receptionist);
 assert.deepEqual((await db.query('select name from public.bc_branches')).rows,[{name:'Cocody'}]);
 await assert.rejects(db.query("select public.bc_create_appointment($1,$2,'Client','Coupe','2026-11-04 10:00Z','2026-11-04 11:00Z',5000,'XOF','phone')",[salon,otherBranch]));
 appointment = (await db.query("select public.bc_create_appointment($1,$2,'Client','Coupe','2026-11-04 10:00Z','2026-11-04 11:00Z',5000,'XOF','phone') as id",[salon,branch])).rows[0].id;
 assert.equal((await db.query('select status,source from public.bc_appointments where id=$1',[appointment])).rows[0].status,'confirmed');
 assert.equal((await db.query('select source from public.bc_appointments where id=$1',[appointment])).rows[0].source,'phone');
 await assert.rejects(entry('payment',1000));
 await user(outsider);
 assert.equal((await db.query('select * from public.bc_appointments')).rows.length,0);
 await assert.rejects(db.query("select public.bc_transition_appointment($1,'checked_in',null)",[appointment]));
 await assert.rejects(entry('payment',1000));
});

test('acompte, prestation et annulation restent des événements distincts', async () => {
 await user(owner);
 const paymentKey = key();
 await entry('payment',2000,'cash',null,paymentKey);
 await assert.rejects(entry('payment',2000,'cash',null,paymentKey));
 assert.equal((await db.query('select status from public.bc_appointments where id=$1',[appointment])).rows[0].status,'confirmed');
 await assert.rejects(db.query("select public.bc_transition_appointment($1,'completed',null)",[appointment]));
 await assert.rejects(db.query("select public.bc_transition_appointment($1,'cancelled',null)",[appointment]));
 await db.query("select public.bc_transition_appointment($1,'checked_in',null)",[appointment]);
 await db.query("select public.bc_transition_appointment($1,'in_progress',null)",[appointment]);
 await db.query("select public.bc_transition_appointment($1,'completed',null)",[appointment]);
 await assert.rejects(db.query("select public.bc_transition_appointment($1,'completed',null)",[appointment]));
 assert.equal((await db.query('select count(*)::int as n from public.bc_payment_entries where appointment_id=$1',[appointment])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int as n from public.bc_appointment_events where appointment_id=$1',[appointment])).rows[0].n,4);
 await assert.rejects(entry('payment',4000));
 await entry('payment',3000);
 await assert.rejects(entry('refund',6000,'cash','trop'));
 await entry('refund',1000,'cash','geste commercial');
 await assert.rejects(db.query('delete from public.bc_payment_entries'));
 await assert.rejects(db.query("update public.bc_appointment_events set reason='modifié'"));
});

test('annulation ne rembourse pas et les corrections sont traçables', async () => {
 await user(owner);
 appointment = (await db.query("select public.bc_create_appointment($1,$2,'Client B','Barbe','2026-11-04 12:00Z','2026-11-04 13:00Z',5000,'XOF','direct') as id",[salon,branch])).rows[0].id;
 const first = await entry('payment',2000);
 await db.query("select public.bc_transition_appointment($1,'cancelled','demande client')",[appointment]);
 assert.equal((await db.query('select count(*)::int as n from public.bc_payment_entries where appointment_id=$1',[appointment])).rows[0].n,1);
 await assert.rejects(entry('payment',1000));
 await entry('payment_reversal',2000,'cash','erreur de saisie',key(),first);
 await assert.rejects(entry('payment_reversal',2000,'cash','doublon',key(),first));
 const rows = (await db.query('select kind,reason from public.bc_payment_entries where appointment_id=$1 order by created_at,id',[appointment])).rows;
 assert.equal(rows.length,2);
 assert.ok(rows.some(r => r.kind === 'payment_reversal' && r.reason === 'erreur de saisie'));
});
after(async () => db.close());
