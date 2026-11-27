import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const readMigration = file => readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')
test('Milestone activation and idempotent voucher retrieval respect the global shop gate', async () => {
  assert.ok(process.env.PGLITE_MODULE, 'PGLITE_MODULE is required')
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
  const db = new PGlite()
  const member = '11111111-1111-4111-8111-111111111111'
  const admin = '99999999-9999-4999-8999-999999999999'
  const oldRequest = '22222222-2222-4222-8222-222222222222'
  const newRequest = '33333333-3333-4333-8333-333333333333'
  const query = async sql => (await db.query(sql)).rows
  try {
    await db.exec(`
     create role anon; create role authenticated; create role service_role;
     create schema auth; grant usage on schema auth to authenticated, anon;
     create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
     create table admin_users(user_id uuid);
     grant select on admin_users to authenticated, anon;
     insert into admin_users values ('${admin}');
     create table hikers(id bigint, claimed_by_user_id uuid, claimed_profile boolean);
     insert into hikers values(1,'${member}',true);
     create table reward_catalog(id bigint primary key, title text, description text, partner_name text, reward_type text, points_cost integer, image_url text, is_active boolean, display_position int, redemption_url text, redemption_instructions text, redeem_until timestamptz);
     alter table reward_catalog enable row level security;
     create policy fixture_catalog_select on reward_catalog for select using(true);
     grant select on reward_catalog to anon, authenticated;
     create table reward_points_ledger(delta int);
     alter table reward_points_ledger enable row level security;
     create table reward_redemptions(id bigint, hiker_id bigint, reward_id bigint, voucher_code_id bigint, request_user_id uuid, request_id uuid, remaining_points_after bigint);
     alter table reward_redemptions enable row level security;
     create unique index request_fixture_key on reward_redemptions(request_user_id,request_id);
     create table reward_voucher_codes(id bigint, reward_id bigint, assigned_hiker_id bigint, code text, is_assigned boolean);
     create function reward_hiker_lock(bigint) returns void language sql as $$ select $$;
    `)
    await db.exec(await readMigration('20261105_milestone_backstage.sql'))
    await db.exec(await readMigration('20261110_milestone_partner_benefits.sql'))
    await db.exec(await readMigration('20261206_milestone_scheduled_launch.sql'))
    const safety = await readMigration('20261207_milestone_redemption_safety.sql')
    await db.exec(safety.slice(safety.indexOf('create function public.redeem_reward'),safety.indexOf('-- Apply the same deadline')))
    await db.exec(await readMigration('20261208_milestone_redemption_retry_gate.sql'))
    // Record the writes the existing private transaction would make. The public wrapper decides whether to invoke it.
    await db.exec(`
     create function milestone_private.redeem_reward(bigint)
     returns table(redemption_id bigint, voucher_code text, remaining_points bigint)
     language plpgsql as $$
     begin
       update public.reward_voucher_codes set is_assigned=true, assigned_hiker_id=1 where id=2 and not is_assigned;
       if not found then raise exception 'The fixture voucher was already assigned'; end if;
       insert into public.reward_points_ledger values(-10);
       insert into public.reward_redemptions(id,hiker_id,reward_id,voucher_code_id) values(2,1,$1,2);
       return query select 2::bigint,'TEST-AVAILABLE'::text,0::bigint;
     end;
     $$;
    `)
    await db.exec(safety.slice(safety.indexOf('create or replace function public.get_ordered'),safety.indexOf("notify pgrst")))
    await db.exec(`
     insert into reward_catalog(id,title,points_cost,is_active) values(1,'Test reward',10,true);
     insert into milestone_partner_benefits(title,partner_name,reward_type,redemption_url,shared_code,is_active)
     values('Test benefit','Test partner','benefit','https://example.invalid','TEST-BENEFIT',true);
     insert into reward_voucher_codes values(1,1,1,'TEST-ASSIGNED',true),(2,1,null,'TEST-AVAILABLE',false);
     insert into reward_redemptions values(1,1,1,1,'${member}','${oldRequest}',5);
    `)
    assert.deepEqual(await query("select (timestamptz '2026-12-01 00:01:00 Europe/Berlin' at time zone 'UTC')::text as utc"),[{utc:'2026-11-30 23:01:00'}])
    const live = await query('select milestone_shop_is_live() as live')
    if (live[0].live) await db.exec('update milestone_shop_settings set emergency_closed=true')
    assert.deepEqual(await query('select milestone_shop_is_live() as live'),[{live:false}])
    await db.exec(`set role authenticated; set app.uid='${member}'`)
    assert.deepEqual(await query('select id from reward_catalog'),[])
    assert.deepEqual(await query('select id from milestone_partner_benefits'),[])
    assert.deepEqual(await query('select get_ordered_milestone_shop_catalog() as offers'),[{offers:[]}])
    await assert.rejects(query(`select * from redeem_reward(1,'${newRequest}')`),{code:'42501'})
    await assert.rejects(query(`select * from redeem_reward(1,'${oldRequest}')`),{code:'42501'})
    await db.exec(`set app.uid='${admin}'`)
    assert.equal((await query('select id from reward_catalog')).length,1)
    assert.equal((await query('select id from milestone_partner_benefits')).length,1)
    assert.equal((await query('select get_ordered_milestone_shop_catalog() as offers'))[0].offers.length,1)
    await db.exec("reset role; update milestone_shop_settings set emergency_closed=false")
    const scheduledSql = await readMigration('20261206_milestone_scheduled_launch.sql')
    const predicate = scheduledSql.slice(scheduledSql.indexOf('create or replace'),scheduledSql.indexOf('-- Keep the existing'))
    for (const [time, expected] of [['2026-11-30 23:00:59 UTC',false],['2026-11-30 23:01:00 UTC',true]]) {
     await db.exec(predicate.replace('pg_catalog.statement_timestamp()',`timestamptz '${time}'`))
     await db.exec(`set role authenticated; set app.uid='${member}'`)
     assert.deepEqual(await query('select milestone_shop_is_live() as live'),[{live:expected}])
     assert.equal((await query('select id from reward_catalog')).length,Number(expected))
     assert.equal((await query('select id from milestone_partner_benefits')).length,Number(expected))
     await db.exec('reset role')
    }
    await db.exec("update milestone_shop_settings set emergency_closed=true")
    assert.deepEqual(await query('select milestone_shop_is_live() as live'),[{live:false}])
    async function redeem(request) {
      return query(`select * from redeem_reward(1,'${request}')`)
    }
    await db.exec(`set role authenticated; set app.uid='${member}'`)
    await assert.rejects(redeem(oldRequest), { code: '42501' })
    await assert.rejects(redeem(newRequest), { code: '42501' })
    await db.exec('reset role; update milestone_shop_settings set emergency_closed=false')
    await db.exec(`set role authenticated; set app.uid='${member}'`)
    assert.deepEqual(await redeem(oldRequest), [{ redemption_id: 1, voucher_code: 'TEST-ASSIGNED', remaining_points: 5 }])
    const first = await redeem(newRequest)
    assert.deepEqual(first, [{ redemption_id: 2, voucher_code: 'TEST-AVAILABLE', remaining_points: 0 }])
    assert.deepEqual(await redeem(newRequest), first)
    await assert.rejects(query(`select * from redeem_reward(9,'${newRequest}')`), { code: '22023' })
    await db.exec('reset role; update milestone_shop_settings set emergency_closed=true')
    await db.exec(`set role authenticated; set app.uid='${member}'`)
    await assert.rejects(redeem(newRequest), { code: '42501' })
    await db.exec('reset role; update milestone_shop_settings set emergency_closed=false; update reward_catalog set is_active=false')
    await db.exec(`set role authenticated; set app.uid='${member}'`)
    assert.deepEqual(await redeem(newRequest), first)
    await db.exec('reset role')
    assert.deepEqual(await query('select delta from reward_points_ledger'), [{ delta: -10 }])
    assert.equal((await query('select id from reward_redemptions')).length, 2)
    assert.deepEqual(await query('select count(*)::int as count from reward_voucher_codes where is_assigned'), [{ count: 2 }])
  } finally {
    await db.close()
  }
})
