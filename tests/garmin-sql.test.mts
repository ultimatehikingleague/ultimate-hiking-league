import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const engine = process.env.PGLITE_MODULE

test('Garmin migrations, private storage, queue and pilot isolation in isolated PostgreSQL', { skip: !engine }, async () => {
  const { PGlite } = await import(engine!)
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const admin = '00000000-0000-0000-0000-000000000002'
  try {
    // Stand-ins for the relevant Supabase and pre-existing UHL schema.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create schema storage;
      create function auth.uid() returns uuid language sql as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      create table auth.users(id uuid primary key);
      create table storage.buckets(id text primary key, name text, public boolean);
      create table storage.objects(
        bucket_id text, name text default 'placeholder', created_at timestamptz default now()
      );
      alter table storage.objects enable row level security;
      create policy broad_storage on storage.objects for all using (true) with check (true);
      create table public.hikers(id bigint primary key, claimed_by_user_id uuid);
      create table public.admin_users(user_id uuid primary key);
      create table public.record_submissions(
        id bigint generated always as identity primary key, user_id uuid, hiker_id bigint,
        submission_type text default 'private', is_public boolean default false, activity_name text,
        description text, activity_date date, actual_distance_km numeric, distance_km numeric,
        elapsed_time_text text, elevation_gain numeric, country text, location text, record_source text,
        proof_image_url text, notes text, admin_note text check (admin_note <> 'rollback'), status text default 'pending', reviewed_at timestamptz
      );
      create table public.records(
        id bigint generated always as identity primary key, event_id bigint, event_master_id bigint, event_distance_id bigint,
        division text, hiker_id bigint, is_public boolean, distance_km numeric, time_hours numeric, avg_speed numeric,
        activity_date date, record_status text, verified boolean, time_text text, record_source text,
        is_corrected boolean, elevation_gain numeric, custom_title text, custom_location text, custom_country text,
        unique(hiker_id, activity_date, distance_km, time_hours)
      );
      create table public.record_corrections(
        id bigint generated always as identity primary key, record_id bigint references public.records,
        hiker_id bigint, user_id uuid, status text, reviewed_at timestamptz, admin_note text check (admin_note <> 'rollback'),
        activity_name text, activity_date date, official_distance_km numeric, actual_distance_km numeric,
        proposed_time_text text, elevation_gain numeric, country text, location text, record_source text
      );
      grant select, insert, update on public.record_corrections to authenticated;
      -- Time and division functions from the 2026-11-14 read-only catalog check.
      create function public.parse_time_text_to_hours(p_time_text text) returns numeric language plpgsql as $$
      declare v_hours int; v_minutes int;
      begin
        if p_time_text is null or trim(p_time_text) = '' then return null; end if;
        v_hours := split_part(trim(p_time_text), ':', 1)::int;
        v_minutes := split_part(trim(p_time_text), ':', 2)::int;
        return round((v_hours + (v_minutes / 60.0))::numeric, 2);
      end;
      $$;
      create function public.calculate_avg_speed() returns trigger language plpgsql as $$
      begin
        if new.time_text is not null and trim(new.time_text) <> '' then
          new.time_hours := public.parse_time_text_to_hours(new.time_text);
        end if;
        if new.time_hours is not null and new.time_hours > 0 then
          new.avg_speed := round((new.distance_km / new.time_hours)::numeric, 2);
        else
          new.avg_speed := null;
        end if;
        return new;
      end;
      $$;
      create function public.set_record_division() returns trigger language plpgsql as $$
      begin
        new.division := case when new.avg_speed >= 5.80 then 'platinum'
          when new.avg_speed >= 4.80 then 'gold' else 'silver' end;
        return new;
      end;
      $$;
      create trigger trg_calculate_avg_speed before insert or update on public.records
        for each row execute function public.calculate_avg_speed();
      create trigger trg_set_record_division before insert or update on public.records
        for each row execute function public.set_record_division();
      alter table public.record_submissions enable row level security;
      alter table public.records enable row level security;
      create policy owner_insert on public.record_submissions for insert to authenticated with check (user_id = auth.uid());
      create policy admin_review on public.record_submissions for all to authenticated
        using (exists(select 1 from public.admin_users where user_id = auth.uid()));
      create policy admin_records on public.records for insert to authenticated
        with check (exists(select 1 from public.admin_users where user_id = auth.uid()));
      grant usage on schema auth, storage to anon, authenticated, service_role;
      grant select on public.hikers to authenticated;
      grant select, update on public.hikers to service_role;
      grant select on public.admin_users to authenticated;
      grant select, insert, update on public.record_submissions to authenticated, service_role;
      create policy select_records on public.records for select using (true);
      create policy update_records on public.records for update to authenticated using (true);
      grant select, insert, update on public.records to authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
      insert into auth.users values ('${owner}'), ('${admin}');
      insert into public.hikers values (42, '${owner}'), (43, '${admin}');
      insert into public.admin_users values ('${admin}');

      -- Mirror postgres's public-schema defaults read from production's pg_default_acl.
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    `)
    for (const file of ['20261114_garmin_oauth.sql', '20261115_garmin_push_inbox.sql', '20261116_garmin_activity_processing.sql', '20261117_garmin_permissions.sql', '20261118_garmin_oauth_handoff.sql', '20261119_garmin_submission.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    }
    const query = async (sql: string) => (await db.query(sql)).rows
    // Include all new relations and routines so future migrations cannot silently inherit browser access.
    assert.deepEqual(await query(`
      with browser_roles(role_name) as (values ('anon'), ('authenticated'))
      select c.relname as object, r.role_name
      from pg_class c cross join browser_roles r
      where c.relnamespace = 'public'::regnamespace and c.relname like 'garmin_%'
        and case c.relkind
          when 'r' then not c.relrowsecurity or has_table_privilege(r.role_name, c.oid,
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
            or has_any_column_privilege(r.role_name, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
          when 'S' then has_sequence_privilege(r.role_name, c.oid, 'SELECT, UPDATE, USAGE')
          else false
        end
      union all
      select p.proname, r.role_name
      from pg_proc p cross join browser_roles r
      where p.pronamespace = 'public'::regnamespace and p.proname like '%garmin%'
        and has_function_privilege(r.role_name, p.oid, 'EXECUTE')
        and not (p.proname = 'approve_garmin_submission' and r.role_name = 'authenticated')
    `), [])
    assert.deepEqual(await query(`
      select has_sequence_privilege('service_role', 'public.garmin_push_inbox_id_seq', 'USAGE') as usage,
        has_sequence_privilege('service_role', 'public.garmin_push_inbox_id_seq', 'SELECT, UPDATE') as extra
    `), [{ usage: true, extra: false }])
    assert.deepEqual(await query("select public from storage.buckets where id = 'garmin-activity-files'"), [{ public: false }])

    await db.exec(`
      set role service_role;
      insert into public.garmin_oauth_attempts(state_hash,browser_hash,user_id,verifier,expires_at)
        values ('state-hash','proof-hash','${owner}','synthetic-verifier',now() + interval '10 minutes');
    `)
    const stage = (value: string) => query(`update public.garmin_oauth_attempts set callback_result = '${value}'
      where state_hash = 'state-hash' and user_id = '${owner}' and expires_at > now()
        and callback_result is null returning state_hash`)
    assert.deepEqual(await stage('first-envelope'), [{ state_hash: 'state-hash' }])
    assert.deepEqual(await stage('duplicate-envelope'), [])
    const claim = (user: string) => query(`delete from public.garmin_oauth_attempts
      where browser_hash = 'proof-hash' and user_id = '${user}' and expires_at > now()
        and callback_result is not null returning callback_result`)
    assert.deepEqual(await claim(admin), [])
    assert.deepEqual(await claim(owner), [{ callback_result: 'first-envelope' }])
    assert.deepEqual(await claim(owner), [])
    await db.exec('reset role')

    await db.exec(`
      insert into storage.objects values ('garmin-activity-files');
      set role service_role;
      insert into public.garmin_connections(user_id,garmin_user_id,encrypted_tokens,connected_at)
        values ('${owner}', 'synthetic-garmin', 'ciphertext', now());
      select public.enqueue_garmin_push('activities', '[
        {"garmin_user_id":"synthetic-garmin","fingerprint":"same","payload":{"activityId":"123"}},
        {"garmin_user_id":"synthetic-garmin","fingerprint":"same","payload":{"activityId":"123"}},
        {"garmin_user_id":"unknown","fingerprint":"other","payload":{"activityId":"123"}}
      ]', '${owner}');
    `)
    assert.deepEqual(await query(`select id, attempts from public.claim_garmin_push('${owner}')`), [{ id: 1, attempts: 1 }])
    assert.deepEqual(await query(`select id from public.claim_garmin_push('${owner}')`), [])
    await db.exec("update public.garmin_push_inbox set lease_until = now() - interval '1 second'")
    assert.deepEqual(await query(`select id, attempts from public.claim_garmin_push('${owner}')`), [{ id: 1, attempts: 2 }])
    await db.exec("select public.finish_garmin_push(1,1,'123','{}',null)")
    assert.deepEqual(await query('select activity_id from public.garmin_activities'), [])
    await db.exec(`
      update public.garmin_connections set disconnect_lease_until = now() + interval '90 seconds';
      select public.finish_garmin_push(1,2,'123','{"distanceKm":10}',null);
      update public.garmin_connections set disconnect_lease_until = null;
      insert into public.record_submissions(user_id,hiker_id,garmin_source_key) values ('${owner}',42,'source');
    `)
    assert.deepEqual(await query('select summary from public.garmin_activities'), [{ summary: { distanceKm: 10 } }])
    assert.deepEqual(await query('select payload from public.garmin_push_inbox'), [{ payload: {} }])
    await assert.rejects(db.exec(`insert into public.record_submissions(user_id,garmin_source_key) values ('${owner}','source')`), { code: '23505' })
    const submit = (hiker: number, activity: string, distance: number, ascent: number) => query(`
      select public.submit_garmin_activity('${owner}', ${hiker}, '${activity}', 'synthetic-garmin',
        (select connected_at from public.garmin_connections where user_id = '${owner}'),
        '{"garmin_source_key":"valid-key","activity_date":"2026-10-10","distance_km":${distance},"elevation_gain":${ascent},"elapsed_time_text":"02:00"}') as result
    `)
    assert.deepEqual(await submit(43, '123', 10, 0), [{ result: 'not-found' }])
    assert.deepEqual(await submit(42, '124', 10, 0), [{ result: 'not-found' }])
    assert.deepEqual(await submit(42, '123', 9.9999, 599.99), [{ result: 'ineligible' }])
    assert.deepEqual(await submit(42, '123', 9.9999, 600), [{ result: 'submitted' }])
    assert.deepEqual(await submit(42, '123', 9.9999, 600), [{ result: 'already-submitted' }])
    const [valid] = await query("select id from public.record_submissions where garmin_source_key = 'valid-key'") as { id: number }[]
    const approve = (note: string) => db.exec(`select public.approve_garmin_submission(${valid.id},
      '{"activity_date":"2026-10-11","distance_km":100,"admin_note":"${note}"}')`)
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}; set request.jwt.claim.sub = '${owner}'`)
      for (const table of ['garmin_connections', 'garmin_activities', 'garmin_oauth_attempts', 'garmin_push_inbox', 'garmin_file_claims']) {
        await assert.rejects(query(`select * from public.${table}`), { code: '42501' })
      }
      await assert.rejects(query("select nextval('public.garmin_push_inbox_id_seq')"), { code: '42501' })
      await assert.rejects(query("select setval('public.garmin_push_inbox_id_seq', 42)"), { code: '42501' })
      await assert.rejects(query('select last_value from public.garmin_push_inbox_id_seq'), { code: '42501' })
      assert.deepEqual(await query("select * from storage.objects where bucket_id = 'garmin-activity-files'"), [])
      assert.deepEqual(await query("update storage.objects set name = 'changed' where bucket_id = 'garmin-activity-files' returning name"), [])
      assert.deepEqual(await query("delete from storage.objects where bucket_id = 'garmin-activity-files' returning name"), [])
      await assert.rejects(db.exec("insert into storage.objects values ('garmin-activity-files')"), { code: '42501' })
      await db.exec("insert into storage.objects values ('other-bucket')")
      await assert.rejects(query(`select public.claim_garmin_push('${owner}')`), { code: '42501' })
      await assert.rejects(approve('valid'), { code: '42501' })
    }
    await assert.rejects(db.exec(`insert into public.record_submissions(user_id,garmin_source_key) values ('${owner}','forged')`), { code: '42501' })
    await db.exec(`insert into public.record_submissions(user_id) values ('${owner}'); set request.jwt.claim.sub = '${admin}'`)
    await assert.rejects(approve('rollback'), { code: '23514' })
    await assert.rejects(db.exec('update public.record_submissions set is_public = true where id = 1'), { code: '42501' })
    await assert.rejects(db.exec('update public.record_submissions set garmin_source_key = null where id = 1'), { code: '42501' })
    await db.exec('reset role')
    assert.deepEqual(await query('select * from public.records'), [])
    await db.exec("set role authenticated")
    await approve('valid')
    await assert.rejects(approve('valid'), /no longer pending/)
    await db.exec('reset role')
    assert.deepEqual(await query('select * from public.records'), [])
    await db.exec(await readFile(new URL('./fixtures/20261120_garmin_publication.production.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20261121_garmin_common_webhooks.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('./fixtures/record_aggregations.production.sql', import.meta.url), 'utf8'))
    const privateSnapshot = `jsonb_build_array(summary,details,file_metrics,
      (select jsonb_build_array(status,evidence,conflicting_feeds,reason) from public.garmin_private_reviews
        where owner_id = '${owner}' and activity_id = '123'))`
    const publishPrivate = () => publish(42, '123', privateSnapshot)
    const publish = (hiker = 42, activity = '123', expected = 'jsonb_build_array(summary,details,file_metrics)') => query(`
      select public.publish_garmin_activity('${owner}', ${hiker}, '${activity}', 'synthetic-garmin',
        (select connected_at from public.garmin_connections where user_id = '${owner}'),
        (select ${expected} from public.garmin_activities where activity_id = '123'),
        '{"activity_date":"2026-10-10","activity_name":" Tour ","location":" Sassnitz ","country":" Deutschland ","description":"Text","distance_km":999,"elevation_gain":0,"time_text":"00:01"}') as result
    `)
    assert.deepEqual(await query('select id from public.records'), [])
    await db.exec(`
      set role service_role;
      update public.garmin_activities
      set summary = '{"type":"HIKING","device":"Garmin","manual":false,"isWebUpload":false,
        "startTimeInSeconds":1700000000,"distanceKm":9.994,"ascent":599.49}',
        file_metrics = '{"fitVerified":true,"fitStartTime":1700000000,"fitElapsedSeconds":7259.9,"warnings":[]}'
      where activity_id = '123';
    `)
    const measurements = (distance: number, ascent: number, elapsed = 7259.9) => db.query(
      `update public.garmin_activities set
        summary = summary || jsonb_build_object('distanceKm', $1::numeric, 'ascent', $2::numeric),
        file_metrics = file_metrics || jsonb_build_object('fitElapsedSeconds', $3::numeric)
        where activity_id = '123'`, [distance, ascent, elapsed],
    )
    await measurements(9.995, 599.5)
    assert.deepEqual(await publish(), [{ result: 'ineligible' }])
    await db.exec('reset role')
    const divisionCases = [
      { distance: 10.15, time: '02:07', hours: '2.12', legacySpeed: '4.79', legacy: 'silver' },
      { distance: 10.22, time: '02:08', hours: '2.13', legacySpeed: '4.80', legacy: 'gold' },
      { distance: 10.03, time: '01:44', hours: '1.73', legacySpeed: '5.80', legacy: 'platinum' },
      { distance: 10.24, time: '01:46', hours: '1.77', legacySpeed: '5.79', legacy: 'gold' },
    ]
    const eventRecord = (scenario: typeof divisionCases[number], eventId: number | null, time = scenario.time) =>
      db.query(`insert into public.records(hiker_id, event_master_id, activity_date, distance_km, time_text)
        values (43, $1, '2026-10-01', $2, $3)
        returning time_hours, avg_speed, division`, [eventId, scenario.distance, time])
    for (const scenario of divisionCases) {
      assert.deepEqual((await eventRecord(scenario, 1)).rows,
        [{ time_hours: scenario.hours, avg_speed: scenario.legacySpeed, division: scenario.legacy }])
    }
    await db.exec(await readFile(new URL('../supabase/migrations/20261123_garmin_private_review.sql', import.meta.url), 'utf8'))
    const publishDefinition = "select pg_get_functiondef('public.publish_garmin_activity(uuid,bigint,text,text,timestamptz,jsonb,jsonb)'::regprocedure)"
    const correctionDefinition = "select pg_get_functiondef('public.check_garmin_record_correction()'::regprocedure)"
    const definitions = await Promise.all([query(publishDefinition), query(correctionDefinition)])
    const followUp = await readFile(new URL('../supabase/migrations/20261122_garmin_publication_rounding.sql', import.meta.url), 'utf8')
    // Simulate a Garmin record written by the deployed function before the upgrade.
    await db.exec('begin')
    try {
      await db.exec('set role service_role')
      await measurements(10.155, 0, 7679.9)
      assert.deepEqual(await publish(), [{ result: 'published' }])
      await db.exec('reset role')
      assert.deepEqual(await query('select distance_km, custom_description, avg_speed, division from public.records where garmin_verified'),
        [{ distance_km: '10.155', custom_description: 'Text', avg_speed: '4.79', division: 'silver' }])
      await db.exec(followUp)
      await db.exec("update public.records set custom_title = 'Altdaten' where garmin_verified")
      assert.deepEqual(await query('select custom_title, custom_description, avg_speed, division from public.records where garmin_verified'),
        [{ custom_title: 'Altdaten', custom_description: 'Text', avg_speed: '4.79', division: 'silver' }])
    } finally {
      await db.exec('rollback')
    }
    assert.deepEqual(await Promise.all([query(publishDefinition), query(correctionDefinition)]), definitions)
    await db.exec(followUp)
    // Exercise the narrow post-commit rollback with the definitions captured from the baseline.
    await db.exec('begin')
    try {
      await db.exec(`
        drop trigger trg_calculate_record_speed_from_minutes on public.records;
        drop function public.calculate_record_speed_from_minutes();
        ${definitions.flat().map(row => (row as { pg_get_functiondef: string }).pg_get_functiondef + ';').join('\n')}
      `)
      assert.deepEqual(await Promise.all([query(publishDefinition), query(correctionDefinition)]), definitions)
      assert.deepEqual(await query("select to_regclass('public.garmin_private_reviews')::text as reviews"),
        [{ reviews: 'garmin_private_reviews' }])
    } finally {
      await db.exec('rollback')
    }
    const recordSpeed = 'select time_hours, avg_speed, division from public.records where hiker_id = 43 order by id'
    const legacySpeeds = divisionCases.map(scenario =>
      ({ time_hours: scenario.hours, avg_speed: scenario.legacySpeed, division: scenario.legacy }))
    assert.deepEqual(await query(recordSpeed), legacySpeeds)
    await db.exec("update public.records set custom_title = 'Metadaten' where hiker_id = 43")
    assert.deepEqual(await query(recordSpeed), legacySpeeds)
    await db.exec('delete from public.records where hiker_id = 43')
    await db.exec('begin')
    try {
      for (const [index, scenario] of divisionCases.entries()) {
        assert.deepEqual((await eventRecord(scenario, 1)).rows, [legacySpeeds[index]])
      }
    } finally {
      await db.exec('rollback')
    }
    for (const [eventId, time] of [[null, '02:07'], [1, '02:07:59']] as const) {
      assert.deepEqual((await eventRecord(divisionCases[0], eventId, time)).rows, [legacySpeeds[0]])
      await db.exec('delete from public.records where hiker_id = 43')
    }
    assert.deepEqual(await query(`insert into public.records(hiker_id, event_master_id, activity_date, distance_km, time_hours)
      values (43, 1, '2026-10-01', 10, 2) returning avg_speed, division`), [{ avg_speed: '5.00', division: 'gold' }])
    await db.exec('delete from public.records where hiker_id = 43')
    const capture = async (distance: number, ascent: number, seconds: number | null, manual: boolean | null, conflict = false, sampleCheck = 'samples-incomplete') => {
      await db.exec(`reset role; delete from public.garmin_private_reviews; update public.garmin_activities
        set file_metrics = '{}', summary = (summary - 'manual') ||
          jsonb_build_object('distanceKm',${distance},'ascent',${ascent}); set role service_role;`)
      const summary = { type: 'HIKING', device: 'Garmin', startTimeInSeconds: 1700000000,
        distanceKm: distance, ascent, isWebUpload: false }
      const feeds = {
        activities: summary,
        activityDetails: { ...summary, ...(conflict && { ascent: ascent + 1 }),
          elapsedSeconds: seconds, sampleCheck },
        activityFiles: { manual },
      }
      for (const [feed, privateEvidence] of Object.entries(feeds)) {
        await db.query('select public.enqueue_garmin_push($1, $2, $3)', [
          feed, JSON.stringify([{ garmin_user_id: 'synthetic-garmin',
            fingerprint: JSON.stringify([feed, distance, ascent, seconds, manual, conflict, sampleCheck]),
            payload: { activityId: '123', privateEvidence } }]), owner,
        ])
      }
    }
    await db.exec('set role service_role')
    await db.exec('begin')
    try {
      await capture(10.15, 0, 7679, false)
      assert.deepEqual(await publishPrivate(), [{ result: 'published' }])
      await db.exec('reset role')
      assert.deepEqual(await query('select time_text, time_hours, avg_speed, division from public.records'),
        [{ time_text: '02:07', time_hours: '2.12', avg_speed: '4.80', division: 'gold' }])
    } finally {
      await db.exec('rollback')
    }
    for (const scenario of [
      { distance: 9.994, ascent: 599.49, stored: null },
      { distance: 9.994, ascent: 599.5, stored: ['9.99', '600'] },
      { distance: 9.994, ascent: 600, stored: ['9.99', '600'] },
      { distance: 9.995, ascent: 599.49, stored: ['10.00', '599'] },
      { distance: 9.996, ascent: 0, stored: ['10.00', '0'] },
      { distance: 10.08765, ascent: 0, stored: ['10.09', '0'] },
    ]) {
      await db.exec('begin')
      try {
        await capture(scenario.distance, scenario.ascent, 7259, false)
        assert.deepEqual(await publishPrivate(), [{ result: scenario.stored ? 'published' : 'ineligible' }], JSON.stringify(scenario))
        await db.exec('reset role')
        assert.deepEqual(await query('select distance_km, elevation_gain, time_text from public.records'),
          scenario.stored ? [{ distance_km: scenario.stored[0], elevation_gain: scenario.stored[1], time_text: '02:00' }] : [])
      } finally {
        await db.exec('rollback')
      }
    }
    await capture(9.995, 599.5, 7259, false, false, 'samples-consistent')
    assert.deepEqual(await publish(43), [{ result: 'not-found' }])
    assert.deepEqual(await publish(42, '124'), [{ result: 'not-found' }])
    assert.deepEqual(await publish(42, '123', "'[]'::jsonb"), [{ result: 'changed' }])
    await db.exec(`reset role;
      insert into public.records(hiker_id, activity_date, distance_km, time_hours)
      values (42, '2026-10-10', 9.995, 2);
      set role service_role;`)
    await assert.rejects(publishPrivate(), { code: '23505' })
    await db.exec(`reset role; truncate public.records, public.record_corrections restart identity; set role service_role;`)
    for (const [distance, ascent, seconds, manual, conflict] of [
      [265.32875, 594.93, 14247, false, false],
      [0.91552, 5.13, 4283, false, false],
      [9.995, 599.5, 7259, null, false],
      [9.995, 599.5, 7259, false, true],
    ] as const) {
      await capture(distance, ascent, seconds, manual, conflict)
      assert.deepEqual(await publishPrivate(), [{ result: 'ineligible' }])
    }
    await capture(9.995, 599.5, null, false)
    assert.deepEqual(await publishPrivate(), [{ result: 'ineligible' }])
    await capture(9.995, 599.5, 7259, false, false, 'sample-gps-jump')
    assert.deepEqual(await publishPrivate(), [{ result: 'ineligible' }])
    await capture(9.995, 599.5, 7259, false)
    assert.deepEqual(await publish(), [{ result: 'changed' }])
    assert.deepEqual(await publishPrivate(), [{ result: 'published' }])
    assert.deepEqual(await publishPrivate(), [{ result: 'already-published' }])
    await db.exec('reset role')
    assert.deepEqual(await query('select sum(distance_km) as total from public.records where verified and is_public'),
      [{ total: '10.00' }])
    assert.deepEqual(await query(`select id, total_km, total_elevation_gain from public.hikers
      where total_km > 0 order by total_km desc`), [{ id: 42, total_km: '10.00', total_elevation_gain: '600' }])
    assert.deepEqual(await query(`select value_numeric from public.site_stats where key = 'total_km'`), [{ value_numeric: '10.00' }])
    const seasonStats = 'select hiker_id, season_year, season_km, season_elevation_gain, season_records from public.hiker_season_stats'
    assert.deepEqual(await query(seasonStats), [
      { hiker_id: 42, season_year: 2026, season_km: '10.00', season_elevation_gain: '600', season_records: 1 },
    ])
    await db.exec('begin')
    try {
      await db.exec(`insert into public.records(hiker_id, activity_date, distance_km, verified)
        values (43, '2026-10-10', 9.997, true)`)
      assert.deepEqual(await query('select id from public.hikers order by total_km desc limit 1'), [{ id: 42 }])
      assert.deepEqual(await query('select hiker_id from public.hiker_season_stats order by season_km desc, hiker_id limit 1'),
        [{ hiker_id: 42 }])
    } finally {
      await db.exec('rollback')
    }
    const rewards = 'select record_id, hiker_id, points, transaction_type from public.reward_points_ledger order by record_id'
    const expectedRewards = [{ record_id: 1, hiker_id: 42, points: 10, transaction_type: 'activity' }]
    assert.deepEqual(await query(rewards), expectedRewards)
    assert.deepEqual(await query("select summary->>'distanceKm' as raw from public.garmin_activities"),
      [{ raw: '9.995' }])
    await db.exec('set role service_role')
    await assert.rejects(submit(42, '123', 10, 0), { code: '42501' })
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${owner}'`)
    await assert.rejects(db.exec("select public.publish_garmin_activity(null,null,null,null,null,null,null)"), { code: '42501' })
    await assert.rejects(db.exec('insert into public.records(garmin_verified) values(true)'), { code: '42501' })
    await assert.rejects(db.exec('update public.records set elevation_gain = 700'), { code: '42501' })
    await assert.rejects(db.exec("update public.records set custom_title = 'Bypass'"), { code: '42501' })
    const request = (distance: string) => db.exec(`
      insert into public.record_corrections(record_id,hiker_id,user_id,status,activity_name,activity_date,actual_distance_km,location,country,description)
      select id,42,'${owner}','pending','Neuer Titel','2025-12-31',${distance},' Kreideküste ',' DE ','Alt-Feld' from public.records
    `)
    await assert.rejects(request('100'), { code: '42501' })
    await request('null')
    await assert.rejects(db.exec("update public.record_corrections set status = 'approved'"), { code: '42501' })
    await db.exec(`set request.jwt.claim.sub = '${admin}'`)
    await assert.rejects(db.exec("update public.record_corrections set status = 'approved', admin_note = 'rollback'"), { code: '23514' })
    assert.deepEqual(await query('select custom_title, custom_location, custom_country, custom_description from public.records'),
      [{ custom_title: 'Tour', custom_location: 'Sassnitz', custom_country: 'Deutschland', custom_description: 'Text' }])
    await db.exec("update public.record_corrections set status = 'approved'")
    assert.deepEqual(await query(`select custom_title, activity_date::text,
      distance_km, elevation_gain, time_text, is_public, is_corrected, division, custom_location, custom_country, custom_description from public.records`), [{
      custom_title: 'Neuer Titel', activity_date: '2025-12-31',
      custom_location: 'Kreideküste', custom_country: 'DE', custom_description: 'Text',
      distance_km: '10.00', elevation_gain: '600', time_text: '02:00', is_public: true, is_corrected: true, division: 'gold',
    }])
    await assert.rejects(db.exec("update public.record_corrections set status = 'rejected'"), { code: '42501' })
    await db.exec(`set request.jwt.claim.sub = '${owner}'`)
    await request('null')
    await db.exec(`set request.jwt.claim.sub = '${admin}'`)
    await db.exec("update public.record_corrections set status = 'rejected', activity_name = 'Nicht übernehmen' where status = 'pending'")
    assert.deepEqual(await query('select id, custom_title from public.records'), [{ id: 1, custom_title: 'Neuer Titel' }])
    await db.exec("update public.records set is_public = false")
    assert.deepEqual(await query('select is_public from public.records'), [{ is_public: false }])
    await db.exec('reset role')
    assert.deepEqual(await query(seasonStats), [])
    assert.deepEqual(await query(rewards), expectedRewards)
    assert.deepEqual(await query(`select value_numeric from public.site_stats where key = 'total_km'`), [{ value_numeric: '10.00' }])
    assert.deepEqual(await query(`select distance_km, is_public, record_source, activity_date::text, status
      from public.record_submissions where id = ${valid.id}`),
      [{ distance_km: '9.9999', is_public: false, record_source: 'Garmin', activity_date: '2026-10-10', status: 'approved' }])
    assert.deepEqual(await query('select status from public.record_submissions where id = 1'), [{ status: 'pending' }])
    await db.exec(`
      delete from storage.objects where name = 'placeholder';
      insert into storage.objects values
        ('garmin-activity-files', '${owner}/fresh.fit', now()),
        ('garmin-activity-files', '${owner}/expired.fit', now() - interval '25 hours'),
        ('other-bucket', '${owner}/keep.fit', now() - interval '25 hours');
      set role anon;
    `)
    await assert.rejects(query('select * from public.list_garmin_files_for_cleanup()'), { code: '42501' })
    await db.exec('set role service_role')
    assert.deepEqual(await query('select * from public.list_garmin_files_for_cleanup()'), [{ name: `${owner}/expired.fit` }])
    await db.exec('reset role')
    const change = (id: string, time: string, granted: string) =>
      query(`select public.apply_garmin_permissions('${id}', ${time}, ${granted}) as applied`)
    const seconds = 'floor(extract(epoch from clock_timestamp()))::bigint'
    await db.exec(`
      set role service_role;
      update public.garmin_connections set connected_at = now() - interval '1 hour';
      insert into public.garmin_connections(user_id,garmin_user_id,encrypted_tokens,connected_at)
        values ('${admin}', 'other-garmin', 'ciphertext', now());
      insert into public.record_submissions(user_id,hiker_id,garmin_source_key,activity_date,distance_km)
        values ('${owner}',42,'pending-at-revocation','2026-10-11',11);
      select public.enqueue_garmin_push('activities', '[
        {"garmin_user_id":"synthetic-garmin","fingerprint":"claimed","payload":{}},
        {"garmin_user_id":"synthetic-garmin","fingerprint":"waiting","payload":{}}
      ]', '${owner}');
    `)
    const [claimed] = await query(`select id from public.claim_garmin_push('${owner}')`) as { id: number }[]
    assert.deepEqual(await change('unmapped', seconds, 'false'), [{ applied: false }])
    assert.deepEqual(await change('synthetic-garmin', seconds, 'null'), [{ applied: false }])
    assert.deepEqual(await change('synthetic-garmin', seconds + ' - 7200', 'false'), [{ applied: false }])
    assert.deepEqual(await change('synthetic-garmin', seconds + ' - 2', 'true'), [{ applied: true }])
    assert.deepEqual(await change('synthetic-garmin', seconds + ' - 3', 'false'), [{ applied: false }])
    const common = async (feed: string, items: unknown[]) => (await db.query(
      'select public.apply_garmin_common_push($1, $2::jsonb, $3) as applied',
      [feed, JSON.stringify(items), owner],
    )).rows
    const currentSecond = Math.floor(Date.now() / 1000)
    const permission = { user_id: 'synthetic-garmin', change_time_seconds: currentSecond, has_activity_export: true }
    assert.deepEqual(await common('userPermissionsChange', [permission, { ...permission, has_activity_export: false }]), [{ applied: 1 }])
    assert.deepEqual(await common('userPermissionsChange', [permission, { ...permission, has_activity_export: false }]), [{ applied: 0 }])
    const pilotConnection = `from public.garmin_connections where user_id = '${owner}'`
    assert.deepEqual(await query(`select activity_export_revoked_at is not null as revoked,
      deregistered_at is not null as deregistered ${pilotConnection}`), [{ revoked: true, deregistered: false }])
    assert.deepEqual(await publish(), [{ result: 'revoked' }])
    assert.deepEqual(await common('deregistrations', [{ user_id: 'other-garmin' }]), [{ applied: 0 }])
    await db.exec(`update public.garmin_connections set activity_export_revoked_at = null where user_id = '${owner}'`)
    const deregistration = [{ user_id: 'synthetic-garmin' }, { user_id: 'synthetic-garmin' }]
    assert.deepEqual(await common('deregistrations', deregistration), [{ applied: 1 }])
    const blockedState = `select deregistered_at, activity_export_revoked_at ${pilotConnection}`
    const blocked = await query(blockedState) as { deregistered_at: Date; activity_export_revoked_at: Date }[]
    assert.ok(blocked[0].deregistered_at instanceof Date)
    assert.ok(blocked[0].activity_export_revoked_at instanceof Date)
    assert.deepEqual(await common('deregistrations', deregistration), [{ applied: 0 }])
    assert.deepEqual(await query(blockedState), blocked)
    assert.deepEqual(await publish(), [{ result: 'revoked' }])
    await db.exec(`
      select public.enqueue_garmin_push('activities', '[
        {"garmin_user_id":"synthetic-garmin","fingerprint":"after","payload":{}},
        {"garmin_user_id":"other-garmin","fingerprint":"other-account","payload":{}}
      ]', '${owner}');
      select public.finish_garmin_push(${claimed.id},1,'after','{}',null);
    `)
    assert.deepEqual(await query(`select fingerprint from public.claim_garmin_push('${owner}')`), [])
    assert.deepEqual(await query("select fingerprint from public.garmin_push_inbox where fingerprint = 'after'"), [])
    assert.deepEqual(await query('select activity_id from public.garmin_activities'), [{ activity_id: '123' }])
    await assert.rejects(db.exec(`insert into public.record_submissions(user_id,garmin_source_key) values ('${owner}','after')`), { code: '42501' })
    await db.exec('set role authenticated')
    await assert.rejects(common('deregistrations', deregistration), { code: '42501' })
    await assert.rejects(change('other-garmin', seconds, 'false'), { code: '42501' })
    const [pending] = await query("select id from public.record_submissions where garmin_source_key = 'pending-at-revocation'") as { id: number }[]
    await assert.rejects(db.exec(`select public.approve_garmin_submission(${pending.id}, '{}')`), { code: '42501' })
    await db.exec(`update public.record_submissions set status = 'rejected' where id = ${pending.id}`)
    await db.exec(`
      reset role;
      insert into storage.objects values ('garmin-activity-files', '${admin}/fresh.fit', now());
      delete from auth.users where id in ('${owner}', '${admin}');
      set role service_role;
    `)
    assert.deepEqual(await query('select * from public.garmin_activities'), [])
    assert.deepEqual(await query('select * from public.garmin_push_inbox'), [])
    assert.deepEqual((await query('select * from public.list_garmin_files_for_cleanup() order by name')), [
      { name: `${owner}/expired.fit` }, { name: `${owner}/fresh.fit` }, { name: `${admin}/fresh.fit` },
    ])
    await db.exec('reset role')
    assert.deepEqual(await query('select record_source from public.records'), [{ record_source: 'Garmin' }])
  } finally {
    await db.close()
  }
})
