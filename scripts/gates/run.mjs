#!/usr/bin/env node
/**
 * 门禁（gates）：机械检查 + 自证测试。
 *
 * 按改动面跑最窄证据：
 *   node scripts/gates/run.mjs              # 全量：语法 + manifest + 测试 + 自检
 *   node scripts/gates/run.mjs --syntax     # 所有 JS/MJS 源文件语法检查
 *   node scripts/gates/run.mjs --manifest   # package.json 契约完整性
 *   node scripts/gates/run.mjs --tests      # test/*.test.mjs 全量测试
 *   node scripts/gates/run.mjs --self-test  # 非法样例自证（manifest 检查会拒绝坏包）
 *
 * 每个门禁都有非法样例自证：--self-test 在临时目录构造坏包并断言检查拒绝，
 * 防止门禁本身悄悄失效。全部通过输出 PASS 并以 0 退出，任何失败以 1 退出。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NODE = process.execPath

let failures = 0
const results = []

/** Record one check result and tally failures. */
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures++
}

/** Syntax-check every JS/MJS file under the given roots. */
function checkSyntax() {
  const files = []
  for (const dir of ['lib', 'client', 'test', 'scripts/gates']) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    for (const name of readdirSync(base)) {
      if (name.endsWith('.js') || name.endsWith('.mjs')) files.push(join(base, name))
    }
  }
  for (const file of files) {
    try {
      execFileSync(NODE, ['--check', file], { stdio: 'pipe' })
      check(`syntax: ${relative(ROOT, file)}`, true)
    } catch (error) {
      const detail = error.stderr?.toString().trim().split('\n').pop() ?? String(error)
      check(`syntax: ${relative(ROOT, file)}`, false, detail)
    }
  }
}

/**
 * Validate the package manifest against the DSH bundle contract
 * (official publish.md + entry-contract):
 * main/exports resolve to real files, dsh.bundle.patch points at the
 * composed layer, dsh.client declares platform web, the cordis
 * peerDependency is declared, and `files` entries all exist on disk.
 * @param pkgDir - package root to validate.
 * @returns string[] of violations (empty when valid).
 */
export function checkManifest(pkgDir) {
  const errors = []
  const read = (rel) => {
    try {
      return JSON.parse(readFileSync(join(pkgDir, rel), 'utf8'))
    } catch {
      return null
    }
  }
  const manifest = read('package.json')
  if (manifest === null) return ['package.json missing or unparsable']
  const has = (rel) => existsSync(join(pkgDir, rel))
  const target = (exp) => {
    if (typeof exp === 'string') return exp
    if (exp !== null && typeof exp === 'object') return exp.default ?? exp.types ?? null
    return null
  }

  if (typeof manifest.name !== 'string' || manifest.name === '') {
    errors.push('name must be a non-empty string')
  }
  if (manifest.type !== 'module') errors.push('type must be "module"')

  const main = manifest.main
  if (typeof main !== 'string' || !has(main)) {
    errors.push(`main ${JSON.stringify(main)} does not resolve to a file`)
  }
  const types = manifest.types
  if (types !== undefined && (typeof types !== 'string' || !has(types))) {
    errors.push(`types ${JSON.stringify(types)} does not resolve to a file`)
  }

  const exportsMap = manifest.exports
  if (exportsMap === null || typeof exportsMap !== 'object') {
    errors.push('exports must be declared')
  } else {
    for (const subpath of ['.', './client', './cordis.patch.yml', './package.json']) {
      const exp = exportsMap[subpath]
      if (exp === undefined) {
        errors.push(`exports[${JSON.stringify(subpath)}] is missing`)
        continue
      }
      const file = target(exp)
      if (file === null) {
        errors.push(`exports[${JSON.stringify(subpath)}] has no resolvable target`)
      } else if (!has(file)) {
        errors.push(`exports[${JSON.stringify(subpath)}] -> ${file} does not exist`)
      }
      if (subpath === '.' && typeof exp === 'object' && typeof exp.types === 'string' && !has(exp.types)) {
        errors.push(`exports["."].types -> ${exp.types} does not exist`)
      }
    }
  }

  const dsh = manifest.dsh
  if (dsh === null || typeof dsh !== 'object') {
    errors.push('dsh manifest is missing (bundle plugins must declare dsh.bundle)')
  } else {
    const patch = dsh.bundle?.patch
    if (typeof patch !== 'string' || !has(patch)) {
      errors.push(`dsh.bundle.patch ${JSON.stringify(patch)} does not resolve to a file`)
    }
    if (dsh.client?.platform !== 'web') {
      errors.push(`dsh.client.platform must be "web" (got ${JSON.stringify(dsh.client?.platform)})`)
    }
  }

  const peer = manifest.peerDependencies
  if (peer === null || typeof peer !== 'object' || typeof peer['@deepseek-ai/cordis'] !== 'string') {
    errors.push('peerDependencies["@deepseek-ai/cordis"] must be declared')
  }

  const files = manifest.files
  if (!Array.isArray(files)) {
    errors.push('files must be an array')
  } else {
    for (const item of files) {
      if (typeof item !== 'string' || !has(item)) {
        errors.push(`files entry ${JSON.stringify(item)} does not exist`)
      }
    }
  }

  const homepage = manifest.homepage
  if (homepage !== undefined && (typeof homepage !== 'string' || !/^https?:\/\//.test(homepage))) {
    errors.push(`homepage must be an http(s) URL (got ${JSON.stringify(homepage)})`)
  }

  // The composed layer must be a YAML sequence containing an insert row —
  // the bundle's own mount line (parse with the project's yaml dep).
  const patchPath = dsh?.bundle?.patch
  if (typeof patchPath === 'string' && has(patchPath)) {
    try {
      const doc = parseYaml(readFileSync(join(pkgDir, patchPath), 'utf8'))
      const rows = Array.isArray(doc) ? doc : []
      const insertNames = []
      for (const row of rows) {
        if (row === null || typeof row !== 'object' || !Array.isArray(row.insert)) continue
        for (const item of row.insert) {
          if (item !== null && typeof item === 'object' && typeof item.name === 'string') {
            insertNames.push(item.name)
          }
        }
      }
      if (insertNames.length === 0) {
        errors.push(`${patchPath} insert rows must carry a "name"`)
      }
      // The loader resolves `name` as a module: a drift between the patch
      // names and package.json#name breaks mounting after a rename.
      for (const insertName of insertNames) {
        if (insertName !== manifest.name) {
          errors.push(`${patchPath} insert row names ${JSON.stringify(insertName)} but package.json name is ${JSON.stringify(manifest.name)}`)
        }
      }
    } catch (error) {
      errors.push(`${patchPath} unparsable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return errors
}

/** Validate this repository's own manifest. */
function checkManifestGate() {
  const errors = checkManifest(ROOT)
  if (errors.length === 0) {
    check('manifest: package.json conforms to the DSH bundle contract', true)
  } else {
    check('manifest: package.json conforms to the DSH bundle contract', false, errors.join('; '))
  }
}

/** Run every test/*.test.mjs file with node directly (no npm needed). */
function checkTests() {
  const dir = join(ROOT, 'test')
  if (!existsSync(dir)) {
    check('tests: no test directory', false)
    return
  }
  const tests = readdirSync(dir).filter((name) => name.endsWith('.test.mjs'))
  if (tests.length === 0) {
    check('tests: no test files found', false)
    return
  }
  for (const name of tests) {
    try {
      execFileSync(NODE, [join(dir, name)], { stdio: 'pipe' })
      check(`tests: ${name}`, true)
    } catch (error) {
      const detail = error.stdout?.toString().trim().split('\n').pop() ?? String(error)
      check(`tests: ${name}`, false, detail)
    }
  }
}

/**
 * Self-test: every manifest violation above must be caught. Bad packages
 * are built in a temp dir, and the good sample is this repository itself.
 */
function checkSelfTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'dsh-plugin-manager-gates-'))
  const badCases = [
    ['no dsh manifest', (pkg) => { delete pkg.dsh }],
    ['bad dsh.bundle.patch target', (pkg) => { pkg.dsh.bundle.patch = './missing.yml' }],
    ['bad dsh.client.platform', (pkg) => { pkg.dsh.client.platform = 'ios' }],
    ['missing cordis peerDependency', (pkg) => { delete pkg.peerDependencies['@deepseek-ai/cordis'] }],
    ['main resolves to nothing', (pkg) => { pkg.main = './lib/ghost.js' }],
    ['exports["."] resolves to nothing', (pkg) => { pkg.exports['.'] = { types: './lib/types/index.d.ts', default: './lib/ghost.js' } },
    ],
    ['missing exports["./package.json"]', (pkg) => { delete pkg.exports['./package.json'] }],
    ['files entry missing on disk', (pkg) => { pkg.files = [...pkg.files, 'no-such-dir'] }],
    ['homepage not an http(s) URL', (pkg) => { pkg.homepage = 'not-a-url' }],
    ['patch layer without insert row', (pkg, dir) => {
      writeFileSync(join(dir, 'cordis.patch.yml'), '- id: broken\n  disabled: true\n')
    }],
    ['patch insert name drifts from package name', (pkg, dir) => {
      writeFileSync(join(dir, 'cordis.patch.yml'), '- insert:\n    - id: some-id\n      name: other-package\n')
    }],
  ]
  try {
    for (const [name, mutate] of badCases) {
      const dir = mkdtempSync(join(tmp, 'bad-'))
      // Snapshot the real manifest so mutations stay minimal and realistic.
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
      writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
      // Copy the real files the snapshot manifest references.
      for (const rel of ['lib/index.js', 'lib/types/index.d.ts', 'client/client.js', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
        const src = join(ROOT, rel)
        if (existsSync(src)) {
          const dest = join(dir, rel)
          mkdirSync(dirname(dest), { recursive: true })
          writeFileSync(dest, readFileSync(src))
        }
      }
      mutate(pkg, dir)
      writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
      const errors = checkManifest(dir)
      if (errors.length > 0) {
        check(`self-test: rejects "${name}"`, true)
      } else {
        check(`self-test: rejects "${name}"`, false, 'violation went unnoticed')
      }
    }
    // The repository itself is the good sample: no violations expected.
    const errors = checkManifest(ROOT)
    check('self-test: accepts the real package', errors.length === 0, errors.join('; '))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/** Run the requested gates. */
export function main(args) {
  const only = new Set(args)
  const all = only.size === 0
  if (all || only.has('--syntax')) checkSyntax()
  if (all || only.has('--manifest')) checkManifestGate()
  if (all || only.has('--tests')) checkTests()
  if (all || only.has('--self-test')) checkSelfTest()
  if (results.length === 0) {
    console.error(`usage: node ${relative(ROOT, fileURLToPath(import.meta.url))} [--syntax|--manifest|--tests|--self-test]`)
    process.exit(2)
  }
  for (const { name, ok, detail } of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}`)
  }
  console.log(failures === 0 ? `\n${results.length} checks, all passed.` : `\n${results.length} checks, ${failures} failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main(process.argv.slice(2))
