import assert from 'node:assert/strict'
import test from 'node:test'
import {changesBetween,deployedFiles,requireApprovedChanges} from '../scripts/release-source.mjs'

test('a missing unrelated feature blocks production promotion', () => {
  const live = {'app/home.tsx':'1','app/admin/GarminMonitoring.tsx':'2'}
  assert.throws(() => requireApprovedChanges(live, {'app/home.tsx':'3'}, ['app/home.tsx']), /GarminMonitoring/)
  assert.deepEqual(requireApprovedChanges(live, {...live,'app/home.tsx':'3'}, ['app/home.tsx']), ['app/home.tsx'])
})

test('deployment evidence ignores generated output and detects changes in uploaded bytes', () => {
  const uid='a'.repeat(40)
  const tree=[{name:'src',type:'directory',children:[{name:'app.tsx',type:'file',uid}]},
    {name:'out',type:'directory',children:[{name:'index',type:'file',uid}]}]
  assert.deepEqual(deployedFiles(tree),{'app.tsx':uid})
  assert.deepEqual(changesBetween({'app.tsx':'b'.repeat(40)},deployedFiles(tree)),['app.tsx'])
  assert.throws(() => deployedFiles([tree[1]]), /Empty/)
})
