'use strict'
const year = Number(process.env.UHL_FIXTURE_YEAR || 2026)
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid' }
const hikers = [
  { id: 1, display_name: 'Alma Lifetime', country: 'DE', profile_status: 'active', division: 'gold', total_km: 14000, total_elevation_gain: 4000, claimed_by_user_id: user.id },
  { id: 2, display_name: 'Zora Season', country: 'DE', profile_status: 'active', division: 'gold', total_km: 200, total_elevation_gain: 3000 },
  { id: 3, display_name: 'Inactive Fixture', country: 'DE', profile_status: 'paused', division: 'gold', total_km: 99999, total_elevation_gain: 10000 },
]
const seasons = [2026, 2027].flatMap(y => hikers.map((h, i) => ({
  hiker_id: h.id, season_year: y, season_km: i === 0 ? (y === 2026 ? 33 : 10) : i === 1 ? 80 : 300,
  season_elevation_gain: i === 0 ? 1600 : i === 1 ? 2300 : 9000,
})))
function response(url, headers = new Headers()) {
  const name = url.pathname.split('/').at(-1)
  if (url.pathname === '/auth/v1/user') return { body: user }
  if (process.env.UHL_REVIEW_FIXTURE === '1') {
    const review = { id: 9, stars: [1,2,3,4,5,3], comments: ['Fixture route comment',null,null,null,null,null], author_name: null }
    const ratings = { score: 3, review_count: 5, category_scores: [1,2,3,4,5,3] }
    const edition = id => ({ id, event_id: id, score: 3, review_count: 5, organizer_slug: 'fixture-organizer', organizer_name: 'Fixture Organizer' })
    const fixture = {
      uhl_event_review_summaries: [edition(700),edition(701)],
      uhl_public_reviews: [review],
      uhl_organizer_review_summary: [{ ...ratings, name: 'Fixture Organizer' }],
      uhl_review_rankings: [{ ...ratings, rank_number: 1, slug: 'fixture-organizer', name: 'Fixture Organizer', event_slug: null }],
      uhl_review_options: [{ record_id: 770, distance_km: 50, existing_status: '' }],
      uhl_submit_review: null,
      uhl_moderation_queue: [],
      events_master: [
        { id: 700, title: 'Fixture Trail', slug: 'fixture-trail', city: 'Fixture City', country: 'Germany', country_code: 'DE', event_date: '2026-06-01', brand: 'Fixture Organizer', event_distances: [] },
        { id: 701, title: 'Fixture Trail 2027', slug: 'fixture-trail-2027', city: 'Fixture City', country: 'Germany', country_code: 'DE', event_date: '2027-07-01', brand: 'Fixture Organizer', event_distances: [] },
      ],
    }
    if (Object.hasOwn(fixture,name)) {
      const data = fixture[name]
      const slug = url.searchParams.get('slug')?.replace(/^eq\./,'')
      return {body: slug ? data.filter(row => row.slug === slug) : data}
    }
  }

  if (name === 'milestone_shop_is_live') return { body: false }
  if (name === 'garmin_admin_monitoring') return { body: {
    active:9,registered:9,retained_deregistered:0,private_published:1,event_published:0,
    event_pending:0,published_today:1,distance_km:10,elevation_gain:600,
    recent:[{ id:1,hiker_id:1,hiker_name:'Alma Lifetime',activity_date:'2026-10-01',published_at:'2026-10-03T14:00:00Z',distance_km:10,device_model:'Test Model',is_event:false }],
  }}
  let data = ({
    hikers, hiker_season_stats:seasons, site_stats:[{key:'total_km',value_numeric:14300}],
    admin_users:[{user_id:user.id,email:user.email}], partners:[{id:'test-partner',name:'Fixture Partner',partner_type:'both'}],
  })[name] ?? []
  for (const [key,value] of url.searchParams) {
    if (value.startsWith('eq.')) data=data.filter(r=>String(r[key])===value.slice(3))
    if (value.startsWith('in.(')) data=data.filter(r=>value.slice(4,-1).split(',').includes(String(r[key])))
    if (value.startsWith('gt.')) data=data.filter(r=>Number(r[key])>Number(value.slice(3)))
  }
  const offset=Number(url.searchParams.get('offset')??0)
  const limit=Number(url.searchParams.get('limit')??1000)
  data=data.slice(offset,offset+limit)
  return {body:headers.get('accept')?.includes('vnd.pgrst.object')?data[0]??null:data}
}
if (process.env.UHL_FIXTURE_SERVER === '1') {
  const instant=Date.parse(year===2026?'2026-12-31T22:59:59Z':'2026-12-31T23:00:00Z')
  const OriginalDate=Date
  const FixedDate=class extends OriginalDate {
    constructor(...args){super(...(args.length?args:[instant]))}
    static now(){return instant}
  }
  FixedDate.parse=OriginalDate.parse
  FixedDate.UTC=OriginalDate.UTC
  global.Date=FixedDate
}
if (process.env.UHL_FIXTURE_SERVER === '1' || process.env.UHL_FIXTURE_NETWORK === '1') {
  const originalFetch=global.fetch
  global.fetch=async (input,opts)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
    if(url.hostname==='build-fixture.invalid'||url.hostname.endsWith('.supabase.co')) {
      const {body}=response(url,new Headers(opts?.headers))
      return Response.json(body)
    }
    if (url.hostname==='127.0.0.1'||url.hostname==='localhost')return originalFetch(input,opts)
    throw new Error('Release test does not allow external requests')
  }
}
module.exports={response,user}
