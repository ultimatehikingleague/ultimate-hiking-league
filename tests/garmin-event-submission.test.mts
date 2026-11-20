import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const engine = process.env.PGLITE_MODULE

test('Garmin event queue, admin approval, ranking assignment and shared duplicate claim', { skip: !engine }, async () => {
  const { PGlite } = await import(engine!)
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const admin = '00000000-0000-0000-0000-000000000002'
  const other = '00000000-0000-0000-0000-000000000003'
  const date = '2026-10-02'
  const query = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as
        'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create table public.admin_users(user_id uuid);
      insert into public.admin_users values ('${admin}');
      grant usage on schema auth to anon, authenticated;
      grant select on public.admin_users to authenticated;
      create table public.hikers(id bigint, claimed_by_user_id uuid, hide_private_records boolean);
      grant select on public.hikers to anon, authenticated;
      insert into public.hikers values (42, '${owner}', false), (43, '${other}', false);
      create table public.garmin_connections (
        user_id uuid, garmin_user_id text, connected_at timestamptz,
        activity_export_revoked_at timestamptz, deregistered_at timestamptz, disconnect_lease_until timestamptz
      );
      insert into public.garmin_connections values
        ('${owner}', 'source-account', '${date}', null, null, null),
        ('${other}', 'new-account', '${date}', null, null, null);
      create table public.garmin_activities (
        owner_id uuid, activity_id text, summary jsonb, details jsonb, file_metrics jsonb
      );
      create table public.garmin_private_reviews (
        owner_id uuid, activity_id text, status text default 'unresolved', evidence jsonb default '{}',
        conflicting_feeds text[] default '{}', reason text, distance_km numeric, ascent_m numeric, elapsed_hhmm text,
        primary key (owner_id, activity_id)
      );
      create table public.garmin_push_inbox(owner_id uuid, feed text, payload jsonb, received_at timestamptz default now());
      create function public.capture_garmin_private_review() returns trigger language plpgsql
        as 'begin return new; end;';
      create trigger garmin_private_review_on_push after insert on public.garmin_push_inbox
        for each row execute function public.capture_garmin_private_review();
      create table public.garmin_publications(source_key bytea primary key);
      create table public.events_master(id bigint primary key, title text, city text, country text, event_date date, brand text);
      insert into public.events_master values
        (10, 'Wanderung Nord', 'Kiel', 'DE', '${date}', 'UHL'),
        (11, 'Wanderung Nord', 'Hamburg', 'DE', '${date}', 'UHL'),
        (12, 'Wanderung Nord', 'Kiel', 'DE', '${date}'::date + 1, 'UHL');
      create table public.event_distances(id bigint primary key, event_id bigint, distance_km numeric(6,2));
      insert into public.event_distances values (100, 10, 10), (101, 10, 20), (110, 11, 10), (102, 10, 12);
      create table public.record_submissions(
        id bigint generated always as identity primary key, user_id uuid, hiker_id bigint, garmin_source_key text,
        proof_image_url text, is_public boolean, submission_type text, event_master_id bigint,
        event_distance_id bigint, activity_name text, activity_date date, official_distance_km numeric(6,2),
        actual_distance_km numeric(6,2), distance_km numeric, elapsed_time_text text, elevation_gain numeric,
        country text, location text, record_source text, status text, reviewed_at timestamptz,
        admin_note text check (admin_note <> 'rollback')
      );
      create function public.protect_garmin_submission() returns trigger language plpgsql as 'begin return new; end;';
      create trigger protect_garmin_submission before update on public.record_submissions
        for each row execute function public.protect_garmin_submission();
      grant select, update on public.record_submissions to authenticated;
      create table public.records(
        id bigint generated always as identity primary key,
        hiker_id bigint, event_master_id bigint, event_distance_id bigint, is_public boolean,
        distance_km numeric, elevation_gain numeric, time_text text, time_hours numeric, avg_speed numeric,
        activity_date date, verified boolean, record_status text, record_source text,
        is_corrected boolean, garmin_verified boolean, custom_title text, custom_location text,
        custom_country text, custom_description text
      );
      grant select on public.records to anon, authenticated;
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20261125_garmin_event_submission.sql', import.meta.url), 'utf8'))

    for (const migration of ['20261126_garmin_record_trigger_search_path', '20261127_garmin_record_attribution']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), 'utf8'))
    }

    await db.exec(await readFile(new URL('../supabase/migrations/20261201_garmin_private_walking.sql', import.meta.url), 'utf8'))

    async function activity(id: string, distanceKm: number, ascent: number, elapsedSeconds = 3719) {
      const summary = { type: 'HIKING', device: id === 'private' ? 'Garmin epix Pro (Gen 2)' : 'Forerunner 965', startTimeInSeconds: Date.parse(date) / 1000, distanceKm, ascent }
      const evidence = { activities: summary, activityFiles: { manual: false }, activityDetails: { elapsedSeconds } }
      await db.query('insert into public.garmin_activities values ($1,$2,$3,\'{}\',\'{}\')', [owner, id, summary])
      await db.query("insert into public.garmin_private_reviews(owner_id,activity_id,status,evidence,conflicting_feeds,reason) values ($1,$2,'consistent',$3,'{}',null)", [owner, id, evidence])
      return JSON.stringify([summary, {}, {}, ['consistent', evidence, [], null]])
    }

    const eventSnapshot = await activity('event', 9.995, 123.5)
    const privateSnapshot = await activity('private', 8.7949, 599.5, 7359)
    const rejectedSnapshot = await activity('reject', 11.966, 91.5)
    const fastSnapshot = await activity('fast', 20, 40, 3600)
    const privateMetadata = { activity_date: date, submission_type: 'private' }
    const eventMetadata = { ...privateMetadata, submission_type: 'official_event', event_master_id: 10,
      official_distance_km: 10, activity_name: 'Client-Titel', location: 'Client-Ort' }
    const submit = async (id: string, snapshot: string, metadata: object, hiker = 42) => {
      const [row] = await query(
        "select public.publish_garmin_activity($1,$2,$3,'source-account',$4,$5,$6) as result",
        [owner, hiker, id, date, snapshot, JSON.stringify(metadata)],
      ) as { result: string }[]
      return row.result
    }

    assert.equal(await submit('event', eventSnapshot, eventMetadata, 43), 'not-found')
    assert.equal(await submit('event', '[]', eventMetadata), 'changed')
    assert.equal(await submit('fast', fastSnapshot, eventMetadata), 'ineligible')
    assert.equal(await submit('event', eventSnapshot, { ...eventMetadata, official_distance_km: 10.32 }), 'ineligible')
    assert.equal(await submit('event', eventSnapshot, { ...eventMetadata, event_master_id: 12 }), 'ineligible')
    const shortSnapshot = await activity('short', 7.966, 91.5)
    assert.equal(await submit('short', shortSnapshot, privateMetadata), 'ineligible')
    assert.equal(await submit('short', shortSnapshot, { ...eventMetadata, official_distance_km: 8 }), 'ineligible')
    const rejections = await Promise.all([
      submit('event', eventSnapshot, eventMetadata),
      submit('event', eventSnapshot, eventMetadata),
    ])
    assert.deepEqual(rejections.sort(), ['duplicate-kind', 'submitted'])
    assert.equal(await submit('event', eventSnapshot, privateMetadata), 'duplicate-kind')
    assert.equal(await submit('reject', rejectedSnapshot, { ...eventMetadata, official_distance_km: 12 }), 'submitted')
    assert.deepEqual(await query('select * from public.records'), [])
    assert.deepEqual(await query('select * from public.garmin_record_attributions'), [])
    const [event] = await query("select id, status, location, activity_name, elapsed_time_text, elevation_gain from public.record_submissions where official_distance_km = 10") as { id: number }[]
    assert.deepEqual(event, { id: 1, status: 'pending', location: 'Kiel', activity_name: 'Wanderung Nord', elapsed_time_text: '01:01', elevation_gain: '124' })

    assert.equal(await submit('private', privateSnapshot, privateMetadata), 'published')
    assert.equal(await submit('private', privateSnapshot, privateMetadata), 'already-published')
    assert.equal(await submit('private', privateSnapshot, { ...eventMetadata, official_distance_km: 8 }), 'duplicate-kind')
    assert.deepEqual(await query('select event_master_id, distance_km, elevation_gain, time_text, verified from public.records'),
      [{ event_master_id: null, distance_km: '8.79', elevation_gain: '600', time_text: '02:02', verified: true }])

    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`)
    const approve = (eventId = 10, distanceId = 100, note: string | null = null) =>
      query('select public.approve_garmin_event_submission($1,$2,$3,10,$4)', [event.id, eventId, distanceId, note])
    await assert.rejects(approve(), { code: '42501' })
    await assert.rejects(db.exec('update public.record_submissions set status = \'approved\' where id = 1'), { code: '42501' })
    await db.exec(`set request.jwt.claim.sub = '${admin}'`)
    await assert.rejects(db.exec('update public.record_submissions set distance_km = 50 where id = 1'), { code: '42501' })
    await assert.rejects(approve(11, 110), /selected calendar event/)
    await assert.rejects(approve(10, 110), /97%/)
    await assert.rejects(approve(10, 101), /97%/)
    await assert.rejects(approve(10, 100, 'rollback'), { code: '23514' })
    await db.exec("update public.record_submissions set status = 'rejected', reviewed_at = now() where id = 2")
    await assert.rejects(query("select public.approve_garmin_event_submission(2,10,102,12,null)"), /no longer pending/)
    await db.exec('reset role')
    assert.deepEqual(await query('select count(*)::int as count from public.records where event_master_id is not null'), [{ count: 0 }])

    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${admin}'`)
    await approve()
    await assert.rejects(approve(), /no longer pending/)
    await db.exec('reset role')
    assert.deepEqual(await query(`select event_master_id, event_distance_id, distance_km, elevation_gain, time_text, verified, garmin_verified
      from public.records where event_master_id is not null`),
      [{ event_master_id: 10, event_distance_id: 100, distance_km: '10.00', elevation_gain: '124',
        time_text: '01:01', verified: true, garmin_verified: true }])
    assert.deepEqual(await query('select device_model from public.garmin_record_attributions order by record_id'),
      [{ device_model: 'Garmin epix Pro (Gen 2)' }, { device_model: 'Forerunner 965' }])
    await db.exec('update public.hikers set hide_private_records = true where id = 42; set role anon')
    assert.deepEqual(await query('select device_model from public.garmin_record_attributions'),
      [{ device_model: 'Forerunner 965' }])
    await assert.rejects(db.exec("update public.garmin_record_attributions set device_model = 'tampered'"), { code: '42501' })
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${owner}'`)
    assert.equal((await query('select device_model from public.garmin_record_attributions')).length, 2)
    await db.exec('reset role')
    assert.deepEqual(await query('select status, event_distance_id from public.record_submissions order by id'),
      [{ status: 'approved', event_distance_id: 100 }, { status: 'rejected', event_distance_id: null }])

    const walkingSnapshot = async (
      type: string, options: { distance?: number; ascent?: number; seconds?: number;
        conflict?: boolean; device?: string | null; legacy?: boolean } = {},
    ) => {
      const {
        distance = 11.46, ascent = 75, seconds = 7920, conflict = false, device = 'Garmin', legacy = false,
      } = options
      const id = 'walking-test'
      const summary = { type, device, startTimeInSeconds: Date.parse(date) / 1000,
        distanceKm: distance, ascent, isWebUpload: false }
      const evidence = {
        activities: summary,
        activityDetails: { ...summary, ascent: ascent + Number(conflict), elapsedSeconds: seconds,
          sampleCheck: 'samples-consistent' },
        activityFiles: { manual: false },
      }
      await db.query("insert into public.garmin_activities values ($1,$2,$3,'{}','{}')", [owner, id, summary])
      for (const [feed, privateEvidence] of Object.entries(evidence)) {
        await db.query('insert into public.garmin_push_inbox(owner_id,feed,payload) values ($1,$2,$3)',
          [owner, feed, { activityId: id, privateEvidence }])
      }
      if (legacy) {
        await db.query("update public.garmin_private_reviews set status = 'rejected', reason = 'not-hiking' where activity_id = $1", [id])
      }
      const [review] = await query(`select status, reason from public.garmin_private_publication_reviews
        where activity_id = $1`, [id]) as { status: string; reason: string }[]
      return { id, reason: review.reason, snapshot: JSON.stringify([summary, {}, {}, [review.status, evidence, [], review.reason]]) }
    }

    for (const [type, legacy] of [
      ['HIKING', false], ['WALKING', false], ['CASUAL_WALKING', false], ['SPEED_WALKING', false], ['WALKING', true],
    ] as const) {
      await db.exec('begin')
      try {
        const { id, reason, snapshot } = await walkingSnapshot(type, { legacy })
        assert.equal(reason, 'feed-checks-passed')
        if (legacy) {
          assert.deepEqual(await query('select reason from public.garmin_private_reviews where activity_id = $1', [id]),
            [{ reason: 'not-hiking' }])
        }
        if (type !== 'HIKING') assert.equal(await submit(id, snapshot, eventMetadata), 'ineligible', type)
        assert.equal(await submit(id, snapshot, privateMetadata), 'published', type)
        assert.equal(await submit(id, snapshot, privateMetadata), 'already-published', type)
        assert.deepEqual(await query(`select verified, garmin_verified, is_public, event_master_id,
          distance_km, elevation_gain, time_text, avg_speed from public.records where distance_km = 11.46`), [{
          verified: true, garmin_verified: true, is_public: true, event_master_id: null,
          distance_km: '11.46', elevation_gain: '75', time_text: '02:12', avg_speed: '5.21',
        }])
        assert.deepEqual(await query('select device_model from public.garmin_record_attributions order by record_id desc limit 1'),
          [{ device_model: 'Garmin' }])
      } finally {
        await db.exec('rollback')
      }
    }

    for (const [type, options, reason] of [
      ['WALKING', { seconds: 2700 }, 'average-speed-over-15-kmh'],
      ['CASUAL_WALKING', { distance: 9, ascent: 599 }, 'feed-checks-passed'],
      ['SPEED_WALKING', { conflict: true, legacy: true }, 'measurement-conflict'],
      ['WALKING', { device: null }, 'device-missing'],
      ['WALKING', { ascent: 6000 }, 'implausible-ascent-rate'],
      ['RUNNING', {}, 'not-hiking'],
    ] as const) {
      await db.exec('begin')
      try {
        const walking = await walkingSnapshot(type, options)
        assert.equal(walking.reason, reason)
        assert.equal(await submit(walking.id, walking.snapshot, privateMetadata), 'ineligible', reason)
      } finally {
        await db.exec('rollback')
      }
    }
    await db.exec('begin')
    try {
      const walking = await walkingSnapshot('WALKING')
      await db.exec(`update public.garmin_connections set activity_export_revoked_at = now() where user_id = '${owner}'`)
      assert.equal(await submit(walking.id, walking.snapshot, privateMetadata), 'revoked')
    } finally {
      await db.exec('rollback')
    }
    await db.exec('begin')
    try {
      const walking = await walkingSnapshot('CASUAL_WALKING')
      await db.query(`insert into public.records(hiker_id, activity_date, distance_km, time_text)
        values (42, $1, 11.46, '02:12')`, [date])
      await assert.rejects(submit(walking.id, walking.snapshot, privateMetadata), { code: '23505' })
    } finally {
      await db.exec('rollback')
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await assert.rejects(query('select * from public.garmin_private_publication_reviews'), { code: '42501' })
      await db.exec('reset role')
    }
  } finally {
    await db.close()
  }
})
