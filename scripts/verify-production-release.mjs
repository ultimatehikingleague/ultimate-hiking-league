import assert from 'node:assert/strict'
import {changesBetween,deployedFiles,requireApprovedChanges} from './release-source.mjs'
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
const proofPath = process.env.UHL_RELEASE_PROOF
if (!proofPath) throw Error('UHL_RELEASE_PROOF is required. Run scripts/check-release.mjs first.')
const proof = JSON.parse(await readFile(proofPath, 'utf8'))
assert.equal(proof.baseline, baseline, 'Test evidence belongs to a different production baseline')
assert.deepEqual(proof.checks, ['unit','postgresql','build','browser'])

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
  return deployedFiles(await api('/v6/deployments/' + id + '/files'))
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
const uploadedDrift = changesBetween(proof.files, after)
if (uploadedDrift.length) throw Error('Candidate differs from tested files: ' + uploadedDrift.join(', '))
const changes = requireApprovedChanges(before, after, files)

const settings = ['framework','rootDirectory','buildCommand','installCommand','outputDirectory','nodeVersion']
for (const field of settings) {
  assert.deepEqual(proposed.projectSettings?.[field] ?? null, existing.projectSettings?.[field] ?? null,
    'Build configuration changed: ' + field)
}
assert.deepEqual(proposed.regions, existing.regions, 'Deployment regions changed')
if (existing.crons !== undefined || proposed.crons !== undefined) {
  assert.deepEqual(proposed.crons, existing.crons, 'Deployment cron configuration changed')
}

const existingKeys = environmentKeys(existing)
const proposedKeys = environmentKeys(proposed)
const requiredSettings = [
  'SHOP_STATUS_SYNC_ENABLED', 'UHL_WAVE1_RELEASE_BUILD', 'NEXT_PUBLIC_UHL_WAVE1',
  'NEXT_PUBLIC_UHL_PL', 'NEXT_PUBLIC_UHL_IT', 'NEXT_PUBLIC_UHL_ES', 'NEXT_PUBLIC_UHL_CS',
]
const missingEnvironment = [...new Set([...existingKeys, ...requiredSettings])].filter(key => !proposedKeys.has(key))
if (missingEnvironment.length) throw Error('Missing production settings: ' + missingEnvironment.join(', '))

const lastLive = await liveId()
if (lastLive !== baseline) throw Error(`The live deployment moved to ${lastLive}. Rebase the candidate before continuing.`)
console.log(JSON.stringify({ baseline, candidate, changes, preservedEnvironmentKeys: existingKeys.size }))
