import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const project = 'prj_RcGB0GQCbVmqTMtOSzousYGfCktT'
const team = 'team_KOoenx7C4xYAHYtDHZVgGQsu'
const domain = 'www.ultimatehikingleague.com'
const idPattern = /^dpl_[A-Za-z0-9]+$/
const [baseline, candidate, ...files] = process.argv.slice(2)
if (!idPattern.test(baseline ?? '') || !idPattern.test(candidate ?? '') || baseline === candidate || !files.length) {
  throw Error('Usage: node scripts/verify-production-release.mjs <live deployment ID> <candidate deployment ID> <approved changed path> [...]')
}
const allowed = new Set(files)
if (allowed.size !== files.length) throw Error('The approved path list contains duplicates')

const token = process.env.VERCEL_TOKEN || JSON.parse(await readFile(
  join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'), 'utf8',
)).token
if (!token) throw Error('Vercel authentication required')

async function api(route) {
  const response = await fetch(`https://api.vercel.com${route}?teamId=${team}`, {
    headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw Error(`Vercel HTTP ${response.status} for ${route}`)
  return response.json()
}

async function liveId() {
  const alias = await api('/v4/aliases/' + domain)
  return alias.deployment?.id ?? alias.deploymentId
}

async function sourceFiles(id) {
  const result = new Map()
  function visit(node, prefix = '') {
    const path = prefix + node.name
    if (node.type === 'directory') {
      for (const child of node.children ?? []) visit(child, path + '/')
    } else if (node.type === 'file') {
      const name = path.replace(/^src\//, '')
      if (result.has(name) || typeof node.uid !== 'string') throw Error('Ambiguous deployment file: ' + name)
      result.set(name, node.uid)
    }
  }
  for (const node of await api('/v6/deployments/' + id + '/files')) visit(node)
  if (!result.size) throw Error('Empty deployment file manifest: ' + id)
  return result
}

function environmentKeys(deployment) {
  const env = deployment.env
  if (!env || typeof env !== 'object') throw Error('Deployment environment metadata is unavailable')
  return new Set(Array.isArray(env) ? env.map(entry => typeof entry === 'string' ? entry : entry.key) : Object.keys(env))
}

const firstLive = await liveId()
if (firstLive !== baseline) throw Error(`The live deployment moved to ${firstLive}. Rebase the candidate before continuing.`)
const [before, after, existing, proposed] = await Promise.all([
  sourceFiles(baseline), sourceFiles(candidate), api('/v13/deployments/' + baseline), api('/v13/deployments/' + candidate),
])
if (proposed.projectId !== project || proposed.target !== 'production' || proposed.readyState !== 'READY') {
  throw Error('Expected a ready production candidate in the ULTIMATE project')
}
const changes = [...new Set([...before.keys(), ...after.keys()])].filter(file => before.get(file) !== after.get(file)).sort()
const unapproved = changes.filter(file => !allowed.has(file))
const absent = [...allowed].filter(file => !changes.includes(file))
if (unapproved.length || absent.length) throw Error(JSON.stringify({ unapproved, approvedButNotChanged: absent }))

const existingKeys = environmentKeys(existing)
const proposedKeys = environmentKeys(proposed)
const missingEnvironment = [...new Set([...existingKeys, 'SHOP_STATUS_SYNC_ENABLED'])].filter(key => !proposedKeys.has(key))
if (missingEnvironment.length) throw Error('Missing production settings: ' + missingEnvironment.join(', '))

const lastLive = await liveId()
if (lastLive !== baseline) throw Error(`The live deployment moved to ${lastLive}. Rebase the candidate before continuing.`)
console.log(JSON.stringify({ baseline, candidate, changes, preservedEnvironmentKeys: existingKeys.size }))
