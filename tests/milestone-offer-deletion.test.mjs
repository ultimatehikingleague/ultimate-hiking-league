import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// PostgreSQL engine required: do not silently skip the deletion safety tests.
const runtime = process.env.PGLITE_MODULE
if (!runtime) throw Error('PGLITE_MODULE is required for the isolated PostgreSQL deletion tests')
const { PGlite } = await import(runtime)
const admin = '11111111-1111-4111-8111-111111111111'
const member = '22222222-2222-4222-8222-222222222222'

test('Milestone offer deletion: isolated PostgreSQL regression', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table admin_users(user_id uuid primary key);
    create table hikers(id bigint primary key);
    create table reward_catalog(id bigint primary key,title text,partner_name text,reward_type text,
      points_cost integer,description text,image_url text,is_active boolean,created_at timestamptz default now(),
      updated_at timestamptz default now(),redemption_url text,redemption_instructions text,display_position integer);
    create table reward_voucher_codes(id bigint primary key,reward_id bigint references reward_catalog on delete restrict,
      code text unique,is_assigned boolean default false,assigned_hiker_id bigint references hikers,
      assigned_at timestamptz,created_at timestamptz default now());
    create table reward_redemptions(id bigint primary key,hiker_id bigint references hikers,
      reward_id bigint references reward_catalog,voucher_code_id bigint references reward_voucher_codes,
      points_spent integer,status text,created_at timestamptz default now(),fulfilled_at timestamptz,
      redemption_url text,redemption_instructions text);
    create table reward_points_ledger(id bigint primary key,hiker_id bigint,points integer);
    create table milestone_partner_benefits(id bigint primary key,title text,is_active boolean,shared_code text);
    create function prevent_assigned_voucher_deletion() returns trigger language plpgsql set search_path='' as $$
      begin if old.is_assigned=true then raise exception 'Assigned voucher'; end if; return old; end $$;
    create trigger trg_prevent_assigned_voucher_deletion before delete on reward_voucher_codes
      for each row execute function prevent_assigned_voucher_deletion();
    insert into hikers values(1);
    insert into reward_points_ledger values(1,1,1000);
    insert into admin_users values('${admin}');
    insert into reward_catalog(id,title,partner_name,reward_type,points_cost,is_active,display_position)
      select n,'Test '||n,'Isolierter Test','voucher',100,n=2,n from generate_series(1,12) n;
    insert into reward_voucher_codes(id,reward_id,code) values(1,1,'TEST-UNASSIGNED'),(2,2,'TEST-ACTIVE'),(3,3,'TEST-HISTORY'),(4,4,'TEST-ASSIGNED'),(5,5,'TEST-METADATA'),(6,6,'TEST-OTHER-REWARD'),(7,7,'TEST-ROLLBACK');
    update reward_voucher_codes set is_assigned=true,assigned_hiker_id=1,assigned_at=now() where id=4;
    update reward_voucher_codes set assigned_at=now() where id=5;
    insert into reward_redemptions(id,hiker_id,reward_id,voucher_code_id,status) values(1,1,3,3,'cancelled'),(2,1,12,6,'completed');
    insert into milestone_partner_benefits values(1,'Test benefit',false,'TEST-SHARED'),(2,'Active benefit',true,null);
  `)
  const protectedBefore = (await db.query("select pg_get_functiondef('prevent_assigned_voucher_deletion()'::regprocedure) as sql")).rows
  const backupDir = process.env.UHL_DELETION_TEST_BACKUPS || await mkdtemp(join(tmpdir(), 'uhl-deletion-test-'))
  // Fresh complete snapshot of synthetic data, before any migration/deletion.
  await writeFile(join(backupDir, 'before-migration.tar.gz'), Buffer.from(await (await db.dumpDataDir()).arrayBuffer()))
  await db.exec(await readFile(new URL('../supabase/migrations/20261204_milestone_offer_deletion.sql', import.meta.url), 'utf8'))
  const call = (id, table='reward_catalog', confirm=true) => db.query(
    'select public.delete_inactive_milestone_offer($1,$2,$3)', [table,id,confirm])
  const login = async (id=admin, role='authenticated') => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
    await db.exec('set role '+role)
  }
  const exists = async (table,id) => {
    await db.exec('reset role')
    return Number((await db.query(`select count(*) as n from ${table} where id=$1`,[id])).rows[0].n)
  }
  await t.test('anonymous cannot execute the function',async()=>{
    await login('', 'anon'); await assert.rejects(call(1),/permission denied/)
  })
  await t.test('authenticated non-admin cannot delete',async()=>{
    await login(member); await assert.rejects(call(1),/Admin-Zugriff/)
  })
  await t.test('confirmation and target validation are checked in the database',async()=>{
    await login(); await assert.rejects(call(1,'reward_catalog',false),/ausdrücklich/)
    await assert.rejects(call(1,'reward_catalog',null),/ausdrücklich/)
    await assert.rejects(call(1,'shop_orders'),/Ungültiges/)
    await assert.rejects(call(1,null),/Ungültiges/)
    await assert.rejects(call(999),/nicht gefunden/)
  })
  await t.test('active reward is preserved with all codes',async()=>{
    await login(); await assert.rejects(call(2),/zuerst deaktiviert/)
    assert.equal(await exists('reward_catalog',2),1);assert.equal(await exists('reward_voucher_codes',2),1)
  })
  await t.test('cancelled historical redemption blocks deletion',async()=>{
    await login();await assert.rejects(call(3),/historischen Einlösungen/)
    assert.equal(await exists('reward_redemptions',1),1)
  })
  await t.test('assigned codes and residual assignment metadata block deletion',async()=>{
    await login();await assert.rejects(call(4),/zugewiesenen/);await assert.rejects(call(5),/zugewiesenen/)
  })
  await t.test('indirect redemption through a voucher also blocks deletion',async()=>{
    await login();await assert.rejects(call(6),/historischen Einlösungen/)
  })
  await t.test('inactive reward and only its unused codes are deleted with a recoverable fresh copy',async()=>{
    await db.exec('reset role')
    const before=(await db.query('select to_jsonb(r) as value from reward_catalog r where id=1')).rows[0].value
    await login();await call(1)
    assert.equal(await exists('reward_catalog',1),0);assert.equal(await exists('reward_voucher_codes',1),0)
    const archive=(await db.query("select * from milestone_offer_deletion_backups where offer_table='reward_catalog' and offer_id=1")).rows[0]
    assert.deepEqual(archive.offer,before);assert.equal(archive.voucher_codes[0].code,'TEST-UNASSIGNED');assert.equal(archive.deleted_by,admin)
    assert.equal(await exists('reward_catalog',2),1)
    // Exercise reconstruction on the isolated fixture, not against production.
    await db.query('insert into reward_catalog select * from jsonb_populate_record(null::reward_catalog,$1)',[archive.offer])
    await db.query('insert into reward_voucher_codes select * from jsonb_populate_recordset(null::reward_voucher_codes,$1)',[JSON.stringify(archive.voucher_codes)])
    assert.deepEqual((await db.query('select to_jsonb(r) as value from reward_catalog r where id=1')).rows[0].value,before)
  })
  await t.test('active free partner benefit is blocked; inactive benefit is backed up and removed',async()=>{
    await login();await assert.rejects(call(2,'milestone_partner_benefits'),/zuerst deaktiviert/)
    await call(1,'milestone_partner_benefits');assert.equal(await exists('milestone_partner_benefits',1),0)
    assert.equal((await db.query("select offer->>'shared_code' as code from milestone_offer_deletion_backups where offer_table='milestone_partner_benefits'")).rows[0].code,'TEST-SHARED')
  })
  await t.test('unexpected cascading dependencies fail closed',async()=>{
    await db.exec('reset role');await db.exec('create table future_dependency(id bigint, reward_id bigint references reward_catalog on delete cascade); insert into future_dependency values(1,8)')
    await login();await assert.rejects(call(8),/Datenbankabhängigkeiten/)
    assert.equal(await exists('future_dependency',1),1)
    await db.exec('drop table future_dependency')
  })
  await t.test('failure rolls back both backup and code deletion',async()=>{
    await db.exec(`reset role; create function test_delete_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic failure'; end$$;
      create trigger test_delete_failure before delete on reward_catalog for each row when(old.id=7) execute function test_delete_failure()`)
    await login();await assert.rejects(call(7),/synthetic failure/)
    assert.equal(await exists('reward_voucher_codes',7),1)
    assert.equal(Number((await db.query('select count(*) as n from milestone_offer_deletion_backups where offer_id=7')).rows[0].n),0)
  })
  await t.test('backup archive and raw DELETE stay inaccessible to clients',async()=>{
    await login();await assert.rejects(db.query('select * from milestone_offer_deletion_backups'),/permission denied/)
    await assert.rejects(db.query('delete from reward_catalog where id=8'),/permission denied/)
    await assert.rejects(db.query('delete from milestone_partner_benefits where id=2'),/permission denied/)
    await login('', 'anon');await assert.rejects(db.query('select * from milestone_offer_deletion_backups'),/permission denied/)
  })
  await t.test('balance, history and pre-existing protection function are unchanged',async()=>{
    await db.exec('reset role')
    assert.equal((await db.query('select points from reward_points_ledger where id=1')).rows[0].points,1000)
    assert.equal(Number((await db.query('select count(*) as n from reward_redemptions')).rows[0].n),2)
    assert.deepEqual((await db.query("select pg_get_functiondef('prevent_assigned_voucher_deletion()'::regprocedure) as sql")).rows,protectedBefore)
  })
})
