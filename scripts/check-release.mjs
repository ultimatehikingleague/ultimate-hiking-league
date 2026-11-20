if(process.env.UHL_USE_EXISTING_BUILD==='1')throw Error('Release proof requires a fresh build')
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {sourceFiles} from './release-source.mjs'

const [baseline,output]=process.argv.slice(2)
if(!/^dpl_[A-Za-z0-9]+$/.test(baseline??'')||!output||!path.isAbsolute(output)||path.relative(process.cwd(),output).split(path.sep)[0]!=='..'){
  throw Error('Usage: node scripts/check-release.mjs LIVE_DEPLOYMENT /absolute/path/outside/repo.json')
}
if(!process.env.PGLITE_MODULE)throw Error('PGLITE_MODULE is required for the database regressions')

function run(command,args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:'inherit',env:process.env})
    child.once('error',reject)
    child.once('exit',code=>code===0?resolve():reject(Error(command+' failed ('+code+')')))
  })
}

const before=await sourceFiles(process.cwd())
const suite=(await readdir('tests')).filter(f=>/\.test\.[cm]?[jt]s$/.test(f)).map(f=>'tests/'+f)
if(!suite.length)throw Error('No release tests found')
await run(process.execPath,['--import','tsx','--test',...suite])
await run('bash',['scripts/check-release-browser.sh'])
const after=await sourceFiles(process.cwd())
assert.deepEqual(after,before,'Tested source tree changed during the checks')
await writeFile(output,JSON.stringify({baseline,createdAt:new Date().toISOString(),checks:['unit','postgresql','build','browser'],files:after},null,2)+'\n',{mode:0o600,flag:'wx'})
