import {createHash} from 'node:crypto'
import {readFile, readdir} from 'node:fs/promises'
import path from 'node:path'

const transport = new Set(['.git','.gitignore','.vercel','.next','out','node_modules','coverage','playwright-report','test-results'])

export async function sourceFiles(root) {
  const files = {}
  async function walk(dir, prefix='') {
    for (const item of await readdir(dir, {withFileTypes:true})) {
      const name=prefix+item.name
      if (transport.has(name) || item.name.startsWith('.env') || item.name.endsWith('.tsbuildinfo') || item.name==='next-env.d.ts' || item.name==='.DS_Store') continue
      const full=path.join(dir,item.name)
      if(item.isDirectory()) await walk(full,name+'/')
      else if(item.isFile()) files[name]=createHash('sha1').update(await readFile(full)).digest('hex')
      else throw Error('Unexpected source entry: '+name)
    }
  }
  await walk(root)
  return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)))
}

export function deployedFiles(tree) {
  const result={}
  function walk(nodes,prefix=''){
    for (const item of nodes) {
      const name=prefix+item.name
      if(item.type==='directory')walk(item.children??[],name+'/')
      if(item.type==='file'){
        const source=name.replace(/^src\//,'')
        if(!name.startsWith('src/') && name.startsWith('out/'))continue
        if(source==='.gitignore')continue
        if(Object.hasOwn(result,source)||!(/^[a-f0-9]{40}$/).test(item.uid))throw Error('Invalid deployment source: '+source)
        result[source]=item.uid
      }
    }
  }
  walk(tree)
  if(!Object.keys(result).length)throw Error('Empty deployment manifest')
  return result
}

export function changesBetween(before,after) {
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(name=>before[name]!==after[name]).sort()
}

export function requireApprovedChanges(before,after,approved) {
  if(!Array.isArray(approved)||approved.some(x=>typeof x!=='string')||approved.length!==new Set(approved).size)throw Error('Invalid approved file list')
  const changes=changesBetween(before,after)
  const unexpected=changes.filter(x=>!approved.includes(x))
  const absent=approved.filter(x=>!changes.includes(x))
  if(unexpected.length||absent.length)throw Error(JSON.stringify({unexpected,absent}))
  return changes
}
