const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const name = 'test_reviewed_uhl_events_2027'
const file = (name) => readFileSync(join(__dirname, name), 'utf8')

function rollbackSql(adminId) {
  assert.match(adminId ?? '', /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, 'UHL admin user UUID required')
  const { candidates, reviewed_fingerprint: fingerprint } = JSON.parse(file('anfrage.json'))
  assert.equal(candidates.length, 61)
  assert.equal(candidates.reduce((sum, event) => sum + event.distances.length, 0), 316)
  assert.match(fingerprint, /^[0-9a-f]{32}$/)
  const batch = JSON.stringify(candidates)
  assert.ok(!batch.includes('$batch$') && !batch.includes('$rollback$'))

  const source = file('import.sql')
  const original = source.split('as $$\n')[1]?.split('\n$$;')[0]
  assert.ok(original)
  const replaced = original
    .replace('declare\n', `declare
  candidates constant jsonb := $batch$${batch}$batch$::jsonb;
  reviewed_fingerprint constant text := '${fingerprint}';
  candidate_id text;
  event_id bigint;
  outcome text;
  new_distances integer;
  tested_events integer := 0;
  tested_distances integer := 0;
`)
    .replace('if auth.uid() is null or not exists (', `if auth.uid() is distinct from '${adminId}'::uuid or not exists (`)
    .replace('  for candidate in', '  begin\n  for candidate in')
    .replace('    return next;', `    if outcome <> 'created' then
      raise exception 'A reviewed candidate already exists (%)', candidate_id;
    end if;
    tested_events := tested_events + 1;
    tested_distances := tested_distances + new_distances;`)
    .replace('  end loop;\nend;', `  end loop;
  if tested_events <> 61 or tested_distances <> 316 then
    raise exception 'Unexpected rollback test counts';
  end if;
  raise sqlstate 'UH701';
  exception when sqlstate 'UH701' then
    return jsonb_build_object('rolled_back', true, 'events', tested_events, 'distances', tested_distances);
  end;
end;`)
  assert.ok(replaced.includes("raise sqlstate 'UH701'") && !replaced.includes('return next'))
  return `begin;
create function public.${name}()
returns jsonb language plpgsql security invoker set search_path = ''
as $rollback$
${replaced}
$rollback$;
revoke all on function public.${name}() from public, anon, authenticated, service_role;
grant execute on function public.${name}() to authenticated;
commit;
`
}

if (require.main === module) process.stdout.write(rollbackSql(process.argv[2]))
module.exports = rollbackSql
