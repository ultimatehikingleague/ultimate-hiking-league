import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8')

async function render(source, year, sequential = false, empty = false) {
  const calls=[]; let active=0, maximum=0
  const fixtures={
    challenges:[{id:1,title:'Challenge',slug:'christmas-challenge-2026'}],
    site_stats:[{key:'total_km',value_numeric:321}], challenge_participants:[{hiker_id:1}],
    hikers:[{id:1,display_name:'A',country:'DE',profile_status:'active',division:'gold',total_km:200},{id:2,display_name:'B',country:'AT',profile_status:'active',division:'gold',total_km:100},{id:3,display_name:'Hidden',profile_status:'inactive',division:'silver',total_km:999}],
    hiker_season_stats:[{hiker_id:1,season_km:10,season_year:year},{hiker_id:2,season_km:50,season_year:year}],
    records:[{id:1,hiker_id:2,event_id:4,distance_km:42,division:'gold',activity_date:'2026-11-01',record_status:'verified',is_corrected:false}],
    events:[{id:4,event_name:'Event',location:'City',country:'AT'}],
    events_master:[{id:4,slug:'event',title:'Event',country:'AT',event_date:'2028-01-01'}],
  }
  const db={from(table){const operations=[];let single=false;const q={}
    for(const name of ['select','eq','in','gte','order','limit'])q[name]=(...args)=>{operations.push([name,...args]);return q}
    q.single=()=>{single=true;operations.push(['single']);return q}
    q.then=(resolve,reject)=>{calls.push({table,operations});active++;maximum=Math.max(maximum,active)
      return new Promise(done=>setImmediate(done)).then(()=>{
        let data=empty?[]:[...(fixtures[table]||[])]
        for(const [op,key,value] of operations){if(op==='eq')data=data.filter(r=>r[key]===value);if(op==='in')data=data.filter(r=>value.includes(r[key]));if(op==='gte')data=data.filter(r=>r[key]>=value);if(op==='order')data.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(value.ascending?1:-1));if(op==='limit')data=data.slice(0,key)}
        active--;return {data:single?(data[0]||null):data,error:null}
      }).then(resolve,reject)};return q}}
  const jsx=(type,props,key)=>({type:typeof type==='function'?type.name:type,props,key})
  const fakeRequire=name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx}
    if(name==='./lib/supabase')return {supabase:db}
    if(name==='./lib/partnerBookings')return {getPartnerAds:async()=>[]}
    return new Proxy({__esModule:true,default:'Component'},{get:(object,key)=>key in object?object[key]:String(key)})
  }
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:[`${year}-11-06T12:00:00Z`]))}}
  const exports={}
  const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  new Function('require','exports','Promise','Date',code)(fakeRequire,exports,sequential?{all:async jobs=>{const results=[];for(const job of jobs)results.push(await job);return results}}:Promise,FixedDate)
  const tree=await exports.default()
  return {tree:JSON.parse(JSON.stringify(tree)),calls: calls.map(c=>JSON.stringify(c)).sort(),maximum}
}
for(const year of [2026,2027])for(const empty of [false,true])test(`homepage keeps query contracts and rendered data with bounded concurrency (${year}, empty=${empty})`,async()=>{
  const parallel=await render(source,year,false,empty)
  const serial=await render(source,year,true,empty)
  assert.deepEqual(parallel.tree,serial.tree);assert.deepEqual(parallel.calls,serial.calls)
  assert.equal(parallel.maximum,2);assert.equal(serial.maximum,1)
  const baseline=process.env.PERFORMANCE_BASELINE
  if(baseline){const before=await render(fs.readFileSync(baseline,'utf8'),year,false,empty);assert.deepEqual(parallel.tree,before.tree);assert.deepEqual(parallel.calls,before.calls)}
  const calls=parallel.calls.join('\n')
  assert.match(calls,/profile_status/)
  assert.equal(calls.includes('hiker_season_stats'),year>=2027)
})
