import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { checkGarminSamples } from '../app/lib/activity/garmin-private-samples'
import { normalizeGarminPush, type GarminActivityFeed } from '../app/lib/activity/garmin-push.server'

const start = 1_763_000_000
const summary = {
  userId: 'pilot-garmin', summaryId: 'summary', activityId: 1234, startTimeInSeconds: start,
  activityType: 'HIKING', deviceName: 'Garmin epix Pro (Gen 2)', isWebUpload: false,
  distanceInMeters: 915.52, totalElevationGainInMeters: 5.13,
}
const samples = [
  { startTimeInSeconds: start, clockDurationInSeconds: 0, latitudeInDegree: 50, longitudeInDegree: 12 },
  { startTimeInSeconds: start + 4283, clockDurationInSeconds: 4283, latitudeInDegree: 50.005, longitudeInDegree: 12 },
]

test('Garmin private samples check time, GPS jumps, segment speed and missing samples', () => {
  assert.equal(checkGarminSamples(samples, start, 4283), 'samples-consistent')
  assert.equal(checkGarminSamples(undefined, start, null), 'samples-missing')
  assert.equal(checkGarminSamples([samples[0], { ...samples[1], longitudeInDegree: undefined }], start, 4283),
    'samples-incomplete')
  assert.equal(checkGarminSamples(samples.toReversed(), start, 4283), 'sample-time-inconsistent')
  assert.equal(checkGarminSamples([samples[0], { ...samples[1], timerDurationInSeconds: 4284 }], start, 4283),
    'sample-time-inconsistent')
  assert.equal(checkGarminSamples([samples[0], { ...samples[1], latitudeInDegree: 51 }], start, 4283),
    'sample-gps-jump')
  assert.equal(checkGarminSamples([samples[0], {
    ...samples[1], startTimeInSeconds: start + 1, clockDurationInSeconds: 1,
  }], start, 1), 'sample-gps-jump')
})

test('Garmin private evidence detects conflicts inside a details envelope and omits raw samples', () => {
  const [item] = normalizeGarminPush('activityDetails', { activityDetails: [{
    userId: summary.userId, summaryId: 'details', activityId: 5678, samples, manual: false,
    summary: { ...summary, manual: true },
  }] })
  assert.equal(item.privateEvidence.identityConflict, true)
  assert.equal(item.privateEvidence.manual, 'conflict')
  assert.equal(item.privateEvidence.sampleCheck, 'samples-consistent')
  assert.equal('samples' in item, false)
  assert.ok(!JSON.stringify(item.privateEvidence).includes('latitudeInDegree'))
})

const engine = process.env.PGLITE_MODULE
test('Garmin inbox persists private review independently of FIT', { skip: !engine }, async () => {
  const { PGlite } = await import(engine!)
  const db = new PGlite()
  const pilot = '00000000-0000-0000-0000-000000000001'
  const other = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.garmin_connections (
        user_id uuid primary key, garmin_user_id text, connected_at timestamptz default now(),
        activity_export_revoked_at timestamptz, deregistered_at timestamptz,
        disconnect_lease_until timestamptz, permissions_changed_at timestamptz
      );
      create table public.garmin_file_claims(claimed_at timestamptz);
      insert into public.garmin_connections(user_id, garmin_user_id) values
        ('${pilot}', 'pilot-garmin'), ('${other}', 'other-garmin');
    `)
    const migration = (file: string) => readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8')
    await db.exec(await migration('20261115_garmin_push_inbox'))
    await db.exec(`
      alter table public.garmin_push_inbox add column processed_at timestamptz,
        add column lease_until timestamptz, add column attempts integer not null default 0;
    `)
    const permissions = await migration('20261117_garmin_permissions')
    await db.exec(permissions.slice(permissions.indexOf('create function public.apply_garmin_permissions'),
      permissions.indexOf('drop function public.claim_garmin_push')))
    await db.exec(await migration('20261123_garmin_private_review'))
    await db.exec(await migration('20261124_garmin_all_members'))

    let fingerprint = 0
    const push = async (feed: GarminActivityFeed, entry: Record<string, unknown>, hash = String(++fingerprint)) => {
      const [item] = normalizeGarminPush(feed, { [feed]: [entry] })
      const { userId, activityId, privateEvidence } = item
      const payload = { activityId, privateEvidence }
      await db.query('select public.enqueue_garmin_push($1, $2, $3)', [
        feed, JSON.stringify([{ garmin_user_id: userId, fingerprint: hash, payload }]), pilot,
      ])
    }
    const pair = async (data: typeof summary, detailFields = {}, detailSamples: unknown[] = samples) => {
      await push('activities', data)
      await push('activityDetails', {
        userId: data.userId, summaryId: 'details', activityId: data.activityId,
        summary: { ...data, ...detailFields }, samples: detailSamples,
      })
    }
    const file = (id: number, manual: unknown, hash?: string) => push('activityFiles', {
      userId: summary.userId, summaryId: 'file', activityId: id, manual, fileType: 'FIT',
      callbackURL: 'https://apis.garmin.com/wellness-api/rest/activityFile?id=1234&token=synthetic',
    }, hash)
    const review = async (id: number) => (await db.query(`
      select status, reason, distance_km::text, ascent_m::text, elapsed_hhmm
      from public.garmin_private_reviews where owner_id = $1 and activity_id = $2
    `, [pilot, String(id)])).rows[0]

    await pair(summary)
    assert.deepEqual(await review(1234), {
      status: 'unresolved', reason: 'manual-missing', distance_km: '0.92', ascent_m: '5', elapsed_hhmm: '01:11',
    })
    await file(1234, false, 'file-1234')
    await file(1234, false, 'file-1234')
    await file(1234, false)
    assert.equal((await review(1234))?.status, 'consistent')
    await file(1234, true)
    assert.equal((await review(1234))?.reason, 'redelivery-conflict')
    await file(1234, false)
    assert.equal((await review(1234))?.status, 'unresolved')

    await file(2000, 'false')
    await pair({ ...summary, activityId: 2000 })
    assert.equal((await review(2000))?.reason, 'manual-invalid')

    await file(2001, false)
    await pair({ ...summary, activityId: 2001 }, { manual: true })
    assert.equal((await review(2001))?.reason, 'manual-conflict')
    assert.equal((await review(2001))?.status, 'unresolved')

    await pair({ ...summary, activityId: 2002 }, { distanceInMeters: 123 })
    assert.equal((await review(2002))?.reason, 'measurement-conflict')
    await pair({ ...summary, activityId: 2003 }, { startTimeInSeconds: start + 1 })
    assert.equal((await review(2003))?.reason, 'start-time-conflict')
    await pair({ ...summary, activityId: 2004, distanceInMeters: 265328.75, totalElevationGainInMeters: 594.93 },
      {}, [samples[0], { startTimeInSeconds: start + 14247, clockDurationInSeconds: 14247 }])
    await file(2004, false)
    assert.deepEqual(await review(2004), {
      status: 'rejected', reason: 'average-speed-over-15-kmh', distance_km: '265.33', ascent_m: '595', elapsed_hhmm: '03:57',
    })

    await file(2005, false)
    await pair({ ...summary, activityId: 2005 }, {}, [samples[0], { ...samples[1], latitudeInDegree: undefined }])
    assert.equal((await review(2005))?.reason, 'samples-incomplete')

    await pair({ ...summary, activityId: 2006, userId: 'other-garmin' })
    assert.equal(await review(2006), undefined)
    const mixedBatch = JSON.stringify(['pilot-garmin', 'other-garmin', 'unknown'].map(garmin_user_id => ({
      garmin_user_id, fingerprint: 'shared', payload: { activityId: '3000' },
    })))
    await db.query("select public.enqueue_garmin_push('activities', $1)", [mixedBatch])
    assert.deepEqual((await db.query("select owner_id from public.garmin_push_inbox where fingerprint = 'shared' order by owner_id")).rows,
      [{ owner_id: pilot }, { owner_id: other }])
    const changed = Math.floor(Date.now() / 1000)
    await db.query("select public.apply_garmin_common_push('userPermissionsChange', $1)", [JSON.stringify([
      { user_id: 'pilot-garmin', change_time_seconds: changed, has_activity_export: false },
      { user_id: 'other-garmin', change_time_seconds: changed, has_activity_export: true },
    ])])
    assert.deepEqual((await db.query('select owner_id from public.claim_garmin_push()')).rows, [{ owner_id: other }])
    await db.query("select public.apply_garmin_common_push('deregistrations', $1)", [JSON.stringify([
      { user_id: 'pilot-garmin' }, { user_id: 'other-garmin' },
    ])])
    assert.deepEqual((await db.query('select owner_id from public.claim_garmin_push()')).rows, [])
    await db.exec('set role authenticated')
    await assert.rejects(db.query('select public.claim_garmin_push()'), /permission denied/)
    await assert.rejects(db.query("select public.enqueue_garmin_push('activities', '[]')"), /permission denied/)
    await assert.rejects(db.query("select public.apply_garmin_common_push('deregistrations', '[]')"), /permission denied/)
    await assert.rejects(db.query('select * from public.garmin_private_reviews'), /permission denied/)
    await db.exec('reset role')
    await db.query('update public.garmin_connections set activity_export_revoked_at = now() where user_id = $1', [pilot])
    assert.equal(await review(1234), undefined)
    await pair({ ...summary, activityId: 2007 })
    assert.equal(await review(2007), undefined)
  } finally {
    await db.close()
  }
})
