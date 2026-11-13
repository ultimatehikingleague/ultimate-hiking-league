const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const file = (name) => readFileSync(join(__dirname, name), 'utf8');
const payload = JSON.parse(file('anfrage.json'));
const snapshot = JSON.parse(readFileSync(process.argv[2] || join(__dirname, 'kalenderstand.json'), 'utf8'));
const countDistances = (candidates) =>
  candidates.reduce((count, candidate) => count + candidate.distances.length, 0);
const admin = '10000000-0000-0000-0000-000000000001';
const nonAdmin = '10000000-0000-0000-0000-000000000002';

async function main() {
  const db = new PGlite();
  const result = {};
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      grant usage on schema auth to anon, authenticated;
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create table public.admin_users (user_id uuid primary key);
      insert into public.admin_users values ('${admin}');
      alter table public.admin_users enable row level security;
      grant select on public.admin_users to authenticated;
      create policy admin_self on public.admin_users for select to authenticated using (user_id = auth.uid());
      create table public.events_master (
        id bigserial primary key, slug text not null unique, title text not null,
        city text, country text, country_code text, event_date date, brand text, description text,
        official_url text, booking_url text, status text not null default 'upcoming'
      );
      create table public.event_distances (
        id bigserial primary key, event_id bigint not null references public.events_master(id) on delete cascade,
        distance_km numeric not null, label text
      );
      create index on public.event_distances(event_id);
      alter table public.events_master enable row level security;
      alter table public.event_distances enable row level security;
      grant select on public.events_master, public.event_distances to anon, authenticated;
      grant insert, update on public.events_master, public.event_distances to authenticated;
      grant usage on all sequences in schema public to authenticated;
      create policy read_master on public.events_master for select to anon, authenticated using (true);
      create policy read_distances on public.event_distances for select to anon, authenticated using (true);
      create policy insert_master on public.events_master for insert to authenticated
        with check (auth.uid() in (select user_id from public.admin_users));
      create policy insert_distances on public.event_distances for insert to authenticated with check (true);
    `);
    await db.query(`
      insert into public.events_master (id, slug, title, city, country, country_code, event_date, brand, official_url, status)
      select * from jsonb_to_recordset($1) as e(
        id bigint, slug text, title text, city text, country text, country_code text,
        event_date date, brand text, official_url text, status text
      )
    `, [JSON.stringify(snapshot)]);
    await db.query(`
      insert into public.event_distances (id, event_id, distance_km, label)
      select d.id, e.id, d.distance_km, d.label
      from jsonb_to_recordset($1) as e(id bigint, event_distances jsonb)
      cross join lateral jsonb_to_recordset(e.event_distances) as d(id bigint, distance_km numeric, label text)
    `, [JSON.stringify(snapshot)]);
    await db.exec(`
      select setval('public.events_master_id_seq', (select max(id) from public.events_master));
      select setval('public.event_distances_id_seq', (select max(id) from public.event_distances));
    `);
    const baseline = (await db.query(file('bestand.sql'))).rows[0];
    assert.equal(Number(baseline.event_count), 214);
    assert.equal(baseline.fingerprint, payload.reviewed_fingerprint);
    result.baseline = baseline;
    await db.exec(file('import.sql'));
    const rpc = (candidates = payload.candidates, fingerprint = payload.reviewed_fingerprint) =>
      db.query('select * from public.import_reviewed_uhl_events_2027($1::jsonb, $2)', [
        JSON.stringify(candidates), fingerprint
      ]);
    const setRole = async (role, uid = '') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
      await db.exec(`set role ${role}`);
    };
    const rollbackSql = require('./rollback-sql.cjs');
    await db.exec(rollbackSql(admin));
    const runRollback = () => db.query('select public.test_reviewed_uhl_events_2027() as result');
    for (const role of ['anon', 'service_role']) {
      await setRole(role, admin);
      await assert.rejects(runRollback(), { code: '42501' });
    }
    for (const uid of ['', nonAdmin]) {
      await setRole('authenticated', uid);
      await assert.rejects(runRollback(), { code: '42501' });
    }
    await setRole('authenticated', admin);
    assert.deepEqual((await runRollback()).rows[0].result, {
      rolled_back: true, events: 61, distances: 316
    });
    assert.deepEqual((await db.query(file('bestand.sql'))).rows[0], baseline);
    await db.exec('reset role');
    const lastDistance = payload.candidates.at(-1).distances.at(-1);
    await db.exec(`alter table public.event_distances add constraint fail_test_distance
      check (distance_km <> ${lastDistance}) not valid`);
    await setRole('authenticated', admin);
    await assert.rejects(runRollback(), { code: '23514' });
    assert.deepEqual((await db.query(file('bestand.sql'))).rows[0], baseline);
    await db.exec('reset role');
    await db.exec('alter table public.event_distances drop constraint fail_test_distance');
    await db.exec('drop function public.test_reviewed_uhl_events_2027()');
    result.authenticatedRollbackTest = { events: 61, distances: 316, deniedRoles: true, failureRolledBack: true };

    for (const role of ['anon', 'service_role']) {
      await setRole(role, admin);
      await assert.rejects(rpc(), { code: '42501' });
    }
    for (const uid of ['', nonAdmin]) {
      await setRole('authenticated', uid);
      await assert.rejects(rpc(), { code: '42501' });
    }
    result.rolesDenied = ['anon', 'service_role', 'authenticated without UID', 'non-admin'];
    await setRole('authenticated', admin);
    await assert.rejects(rpc(payload.candidates, '0'.repeat(32)), /calendar changed/);
    await assert.rejects(rpc([payload.candidates[0], payload.candidates[0]]), /Invalid or duplicate/);
    await assert.rejects(rpc([{ ...payload.candidates[0], distances: [0] }]), /Invalid or duplicate/);
    assert.deepEqual((await db.query(file('bestand.sql'))).rows[0], baseline);
    result.badFingerprintAndPayloadRejected = true;

    // A local-only constraint fails on a distance after earlier inserts in this batch.
    await db.exec('reset role');
    const last = payload.candidates.at(-1);
    await db.exec(`
      create function fail_test_distance() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from public.events_master where id = new.event_id and slug = '${last.slug}') then
          raise exception 'Injected distance error';
        end if;
        return new;
      end $$;
      create trigger fail_test_distance before insert on public.event_distances
      for each row execute function fail_test_distance();
    `);
    await setRole('authenticated', admin);
    await assert.rejects(rpc(), /Injected distance error/);
    assert.deepEqual((await db.query(file('bestand.sql'))).rows[0], baseline);
    await db.exec('reset role; drop trigger fail_test_distance on public.event_distances');
    result.masterAndDistancesRolledBack = true;

    await setRole('authenticated', admin);
    const created = (await rpc()).rows;
    assert.equal(created.length, payload.candidates.length);
    assert.ok(created.every((row) => row.outcome === 'created'));
    assert.equal(created.reduce((n, row) => n + row.new_distances, 0), countDistances(payload.candidates));
    const expected = payload.candidates.map(({ slug, distances }) => ({ slug, distances }));
    const actual = (await db.query(`
      select e.slug, jsonb_agg(d.distance_km order by d.distance_km) as distances
      from public.events_master e join public.event_distances d on e.id = d.event_id
      where e.slug = any($1::text[]) group by e.slug
    `, [expected.map((row) => row.slug)])).rows;
    const bySlug = (left, right) => left.slug.localeCompare(right.slug);
    assert.deepEqual(actual.sort(bySlug), expected.sort(bySlug));
    const repeated = (await rpc()).rows;
    assert.deepEqual(repeated, created.map((row) => ({ ...row, outcome: 'already_present', new_distances: 0 })));
    const altered = payload.candidates.map((row) =>
      row === last ? { ...row, city: 'Local conflicting fixture' } : row
    );
    await assert.rejects(rpc(altered), /Slug occupied/);
    const after = (await db.query(file('bestand.sql'))).rows[0];
    assert.equal(Number(after.event_count), 214 + created.length);
    result.plannedEvents = created.length;
    result.plannedDistances = countDistances(payload.candidates);
    result.repeatSkipped = repeated.length;
    result.occupiedSlugRejected = true;
    result.finalCalendarCount = Number(after.event_count);
    const originalAfter = (await db.query(`
      select md5(coalesce(jsonb_agg(jsonb_build_array(
        e.id, e.slug, e.title, e.city, e.country, e.country_code, e.event_date,
        e.brand, e.official_url, e.status,
        (select coalesce(jsonb_agg(trim_scale(d.distance_km) order by d.distance_km), '[]'::jsonb)
         from public.event_distances d where d.event_id = e.id)
      ) order by e.id)::text, '[]')) as fingerprint
      from public.events_master e where e.slug <> all($1::text[])
    `, [payload.candidates.map((row) => row.slug)])).rows[0];
    assert.equal(originalAfter.fingerprint, baseline.fingerprint);
    result.originalCalendarUnchanged = true;

    await db.exec('reset role');
    const first = payload.candidates[0];
    await db.query(`
      insert into public.events_master (slug, title, city, country_code, event_date, brand)
      values ('local-content-duplicate', $1, $2, $3, $4, $5)
    `, [first.title, first.city, first.country_code, first.event_date, first.brand]);
    const changedFingerprint = (await db.query(`
      select md5(coalesce(jsonb_agg(jsonb_build_array(
        e.id, e.slug, e.title, e.city, e.country, e.country_code, e.event_date,
        e.brand, e.official_url, e.status,
        (select coalesce(jsonb_agg(trim_scale(d.distance_km) order by d.distance_km), '[]'::jsonb)
         from public.event_distances d where d.event_id = e.id)
      ) order by e.id)::text, '[]')) as fingerprint
      from public.events_master e
      where e.event_date >= date '2027-01-01' and e.event_date < date '2028-01-01'
        and e.slug <> all($1::text[])
    `, [[first.slug]])).rows[0].fingerprint;
    await db.query('delete from public.events_master where slug = $1', [first.slug]);
    await setRole('authenticated', admin);
    await assert.rejects(rpc([first], changedFingerprint), /Possible content duplicate/);
    result.contentDuplicateRejected = true;


  } finally {
    await db.close();
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
