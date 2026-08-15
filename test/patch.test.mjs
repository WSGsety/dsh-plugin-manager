/**
 * patch.js unit tests — cordis.patch.yml read/write on a scratch profile
 * directory. Run: node test/patch.test.mjs
 */

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setPatchDisabled, listPatchDisabled, readPatch } from '../lib/patch.js'

let failed = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-test-'))
const PATCH = [
  '# Your patch layer for this dsh profile, applied after every bundle layer:',
  '# pet 桌宠停用（重启后生效，bundle 层条目 id 为 pet）',
  '- id: pet',
  '  disabled: true',
  '- id: dsh-market',
  '  config:',
  '    allowRestart: false',
  '',
].join('\n')
writeFileSync(join(dir, 'cordis.patch.yml'), PATCH)

console.log('patch: disable an existing entry (pet already disabled → no-op)')
{
  const result = setPatchDisabled(dir, 'pet', true)
  check('no change reported', result.changed === false)
  check('pet listed disabled', result.entries.includes('pet'))
  check('file untouched', readFileSync(join(dir, 'cordis.patch.yml'), 'utf8') === PATCH)
}

console.log('patch: disable an entry carrying disabled: false → rewrites to true')
{
  const dirF = mkdtempSync(join(tmpdir(), 'dsh-pm-test-false-'))
  writeFileSync(join(dirF, 'cordis.patch.yml'), '# explicit false from an earlier enable\n- id: hmr\n  disabled: false\n')
  const result = setPatchDisabled(dirF, 'hmr', true)
  const text = readFileSync(join(dirF, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('pair rewritten to true', /- id: hmr\n  disabled: true/.test(text))
  check('hmr listed disabled', result.entries.includes('hmr'))
  rmSync(dirF, { recursive: true, force: true })
}

console.log('patch: disable dsh-market (existing entry with config)')
{
  const result = setPatchDisabled(dir, 'dsh-market', true)
  const text = readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('disabled pair added under existing entry', /- id: dsh-market\n  config:\n    allowRestart: false\n  disabled: true/.test(text))
  check('header comments preserved', text.startsWith('# Your patch layer'))
  check('pet block preserved', text.includes('- id: pet\n  disabled: true'))
  check('entries list', result.entries.length === 2 && result.entries.includes('pet') && result.entries.includes('dsh-market'))
}

console.log('patch: disable a new entry (my-plug appended)')
{
  const result = setPatchDisabled(dir, 'my-plug', true)
  const text = readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('entry appended', /- id: my-plug\n  disabled: true/.test(text))
  check('entries list', result.entries.length === 3)
}

console.log('patch: enable dsh-market (pair rewritten to explicit false, entry kept)')
{
  const result = setPatchDisabled(dir, 'dsh-market', false)
  const text = readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('disabled rewritten to false, config kept', /- id: dsh-market\n  config:\n    allowRestart: false\n  disabled: false/.test(text) && !/- id: dsh-market\n  config:\n    allowRestart: false\n  disabled: true/.test(text))
  check('my-plug still disabled', text.includes('- id: my-plug\n  disabled: true'))
  check('entries list shrunk', result.entries.length === 2 && !result.entries.includes('dsh-market'))
}

console.log('patch: enable my-plug (entry with only id gains explicit disabled: false)')
{
  const result = setPatchDisabled(dir, 'my-plug', false)
  const text = readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('entry kept with disabled: false', /- id: my-plug\n  disabled: false/.test(text))
  check('pet untouched', text.includes('- id: pet\n  disabled: true'))
  check('entries list', result.entries.length === 1 && result.entries.includes('pet'))
}

console.log('patch: enable a nonexistent entry → explicit disabled: false written (layer override)')
{
  const result = setPatchDisabled(dir, 'ghost', false)
  const text = readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('ghost entry with disabled: false', /- id: ghost\n  disabled: false/.test(text))
  check('ghost not listed disabled', !result.entries.includes('ghost'))
}

console.log('patch: listPatchDisabled')
{
  const ids = listPatchDisabled(dir)
  check('only pet disabled', ids.length === 1 && ids[0] === 'pet')
}

console.log('patch: !!js expression round-trip survives')
{
  const dir2 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-js-'))
  const src = ['- id: foo', '  config:', '    path: !!js dshHomePath(\'sessions\')', '- id: bar', '  disabled: true', ''].join('\n')
  writeFileSync(join(dir2, 'cordis.patch.yml'), src)
  setPatchDisabled(dir2, 'bar', false)
  const text = readFileSync(join(dir2, 'cordis.patch.yml'), 'utf8')
  check('js tag preserved', text.includes("!!js dshHomePath('sessions')"))
  check('bar entry rewritten to disabled: false', text.includes('- id: bar\n  disabled: false'))
  rmSync(dir2, { recursive: true, force: true })
}

console.log('patch: new file creation (disable first write)')
{
  const dir3 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-new-'))
  const result = setPatchDisabled(dir3, 'fresh', true)
  const text = readFileSync(join(dir3, 'cordis.patch.yml'), 'utf8')
  check('created with header', text.startsWith('# Your patch layer'))
  check('entry written', /- id: fresh\n  disabled: true/.test(text))
  check('entries list', result.entries.length === 1 && result.entries[0] === 'fresh')
  // enable on an entry that exists only in patch → explicit disabled: false override
  setPatchDisabled(dir3, 'fresh', false)
  const text2 = readFileSync(join(dir3, 'cordis.patch.yml'), 'utf8')
  check('file remains valid after re-enable', text2.includes('# Your patch layer') && text2.includes('- id: fresh\n  disabled: false'))
  rmSync(dir3, { recursive: true, force: true })
}

console.log('patch: enable with no file at all → file created with disabled: false (bundle-layer override)')
{
  const dir4 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-none-'))
  const result = setPatchDisabled(dir4, 'ghost', false)
  const text = readFileSync(join(dir4, 'cordis.patch.yml'), 'utf8')
  check('changed reported', result.changed === true)
  check('file created with explicit false', /- id: ghost\n  disabled: false/.test(text))
  check('ghost not listed disabled', result.entries.length === 0)
  rmSync(dir4, { recursive: true, force: true })
}

console.log('patch: atomic write preserves the original file permissions')
{
  const dir9 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-mode-'))
  const path = join(dir9, 'cordis.patch.yml')
  writeFileSync(path, '- id: a\n  disabled: true\n')
  chmodSync(path, 0o600)
  setPatchDisabled(dir9, 'a', false)
  check('0600 preserved through rewrite', (statSync(path).mode & 0o777) === 0o600)
  rmSync(dir9, { recursive: true, force: true })
}

console.log('patch: new file defaults to 0600')
{
  const dirA = mkdtempSync(join(tmpdir(), 'dsh-pm-test-mode-new-'))
  const path = join(dirA, 'cordis.patch.yml')
  setPatchDisabled(dirA, 'x', true)
  check('new file 0600', (statSync(path).mode & 0o777) === 0o600)
  rmSync(dirA, { recursive: true, force: true })
}

console.log('patch: unparsable file → throws, file untouched')
{
  const dir5 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-bad-'))
  const bad = '::not: :yaml::\n- id: [unclosed\n'
  writeFileSync(join(dir5, 'cordis.patch.yml'), bad)
  let threw = false
  try {
    setPatchDisabled(dir5, 'x', true)
  } catch {
    threw = true
  }
  check('throws on parse error', threw)
  check('file untouched', readFileSync(join(dir5, 'cordis.patch.yml'), 'utf8') === bad)
  rmSync(dir5, { recursive: true, force: true })
}

console.log('patch: invalid entry id rejected (YAML injection guard)')
{
  const dir7 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-inject-'))
  let threw = false
  try {
    setPatchDisabled(dir7, 'x\n  config:\n    evil: true', true)
  } catch {
    threw = true
  }
  check('throws on crafted id', threw)
  check('no file created', !exists(join(dir7, 'cordis.patch.yml')))
  rmSync(dir7, { recursive: true, force: true })
}

console.log('patch: empty file treated as empty sequence')
{
  const dir8 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-empty-'))
  writeFileSync(join(dir8, 'cordis.patch.yml'), '')
  const result = setPatchDisabled(dir8, 'fresh', true)
  check('disable writes into empty file', result.changed === true && /- id: fresh\n  disabled: true/.test(readFileSync(join(dir8, 'cordis.patch.yml'), 'utf8')))
  rmSync(dir8, { recursive: true, force: true })
}

console.log('patch: readPatch returns null when missing')
{
  const dir6 = mkdtempSync(join(tmpdir(), 'dsh-pm-test-missing-'))
  check('null doc', readPatch(dir6) === null)
  rmSync(dir6, { recursive: true, force: true })
}

function exists(path) {
  try { readFileSync(path); return true } catch { return false }
}

rmSync(dir, { recursive: true, force: true })
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`)
process.exit(failed === 0 ? 0 : 1)
