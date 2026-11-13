import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const production = 'dpl_6oA29jwa7ai8usbTHKDbYQBJh3vF'
const stage = '/private/tmp/uhl-performance-20261106'
const auth = JSON.parse(fs.readFileSync(path.join(os.homedir(),'Library/Application Support/com.vercel.cli/auth.json'),'utf8'))
const relevant = name => /^(app\/|public\/|middleware|next\.config|package|vercel\.json|tsconfig\.json|postcss|eslint)/.test(name)
const hash = p => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex')
const expected = ['app/shop/lib/products.ts', 'app/shop/schorschys-wanderkalender-2027/page.tsx']
async function deployed(id) {
  const res = await fetch('https://api.vercel.com/v6/deployments/'+id+'/files?teamId=team_KOoenx7C4xYAHYtDHZVgGQsu', {
    headers: {Authorization: 'Bearer '+auth.token}, signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw Error('Vercel source list HTTP '+res.status)
  const files = new Map()
  function walk(node, parent='') {
    const key=parent+node.name
    if(node.type==='directory') for(const child of node.children ?? []) walk(child,key+'/')
    else if(relevant(key.replace(/^src\//,''))) files.set(key.replace(/^src\//,''),node.uid)
    else if(/(^|\/)\.env[^/]*$/.test(key)) throw Error('Unexpected environment file in upload')
  }
  for (const node of await res.json()) walk(node)
  return files
}
const current = await deployed(production)
const candidate = process.argv[2]
const after = candidate ? await deployed(candidate) : new Map()
if (!candidate) {
  function walk(parent='') {
    for (const entry of fs.readdirSync(path.join(stage,parent),{withFileTypes:true})) {
      if(!parent && !relevant(entry.name+(entry.isDirectory()?'/':''))) continue
      const name = path.join(parent,entry.name)
      if(entry.isDirectory()) walk(name)
      else if(relevant(name)) after.set(name,hash(path.join(stage,name)))
    }
  }
  walk()
}
const changed = [...after].filter(([p,v])=>current.get(p)!==v).map(([p])=>p).sort()
const missing = [...current.keys()].filter(p=>!after.has(p))
if (missing.length || JSON.stringify(changed)!==JSON.stringify(expected)) throw Error(JSON.stringify({changed,missing}))
for (const name of expected) if (after.get(name)!==hash(path.join(stage,name))) throw Error('Unexpected content '+name)
const result={baseline:production,candidate:candidate??'local',runtimeFiles:after.size,changed,missing}
console.log(JSON.stringify(result))
if (candidate) fs.writeFileSync('docs/calendar-gallery-release-scope.json',JSON.stringify(result,null,2)+'\n')
