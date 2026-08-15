/**
 * routes.js integration test with a mocked webServer + loader. Simulates
 * HTTP requests against the registered handlers. Run:
 * node test/routes.test.mjs
 */

import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mountRoutes } from '../lib/routes.js'

let failed = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Fake loader with a handful of entries and a stateful update(). */
function makeLoader() {
  const entries = [
    { id: 'include', options: { name: 'cordis:include' }, disabled: false, fiber: { state: 2 } },
    { id: 'include:webserver', options: { name: '@deepseek-ai/dsh-host-webserver' }, disabled: false, fiber: { state: 2 } },
    { id: 'include:ssh', options: { name: '@linxin666/dsh-ssh' }, disabled: false, fiber: { state: 2 } },
    { id: 'include:pet', options: { name: '@linxin666/dsh-pet' }, disabled: true, fiber: undefined },
    { id: 'include:dsh-plugin-manager', options: { name: 'dsh-plugin-manager' }, disabled: false, fiber: { state: 2 } },
    { id: 'include:ui-settings-plugins', options: { name: '@deepseek-ai/dsh-client-ui-settings-plugins' }, disabled: false, fiber: { state: 2 } },
    { id: 'include:grp', options: { name: 'group-thing', group: true }, disabled: false, fiber: { state: 2 } },
  ]
  const entryById = (id) => entries.find((e) => e.id === id)
  const update = (id) => async (options) => {
    const entry = entryById(id)
    entry.disabled = options.disabled === true
    entry.fiber = options.disabled === true ? undefined : { state: 2 }
  }
  for (const e of entries) e.update = update(e.id)
  // A stubborn entry whose update never reaches the requested state —
  // used to exercise the settled:false path. Added AFTER the generic loop
  // so its custom update survives.
  const stubborn = { id: 'include:stubborn', options: { name: '@linxin666/dsh-stubborn' }, disabled: false, fiber: { state: 2 } }
  stubborn.update = async (options) => { stubborn.disabled = options.disabled !== true }
  entries.push(stubborn)
  return {
    entries() {
      return entries[Symbol.iterator]()
    },
    entryById,
  }
}

/** Fake webServer capturing registered routes. */
function makeWebServer() {
  const routes = new Map()
  return {
    routes,
    register({ path, handler }) {
      routes.set(path, handler)
      return () => routes.delete(path)
    },
  }
}

/** Drive one request through a handler. */
function call(handler, { method = 'GET', origin, host, socket, secFetchSite, body } = {}) {
  const headers = {}
  if (host !== undefined) headers.host = host
  else if (origin !== undefined) headers.host = new URL(origin).host
  if (origin !== undefined) headers.origin = origin
  if (secFetchSite !== undefined) headers['sec-fetch-site'] = secFetchSite
  if (body !== undefined) headers['content-type'] = 'application/json'
  const request = {
    method,
    headers,
    url: '/',
    socket: socket === undefined ? { remoteAddress: '127.0.0.1' } : socket,
    [Symbol.asyncIterator]() {
      const chunks = body !== undefined ? [Buffer.from(JSON.stringify(body))] : []
      let index = 0
      return {
        next() {
          return Promise.resolve(index < chunks.length ? { value: chunks[index++], done: false } : { done: true })
        },
      }
    },
  }
  const response = {
    status: null,
    payload: null,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(text) {
      this.payload = text === undefined ? null : JSON.parse(text)
    },
  }
  return Promise.resolve(handler(request, response)).then(() => response)
}

const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-route-'))
mkdirSync(join(dir, 'node_modules', '@linxin666'), { recursive: true })
mkdirSync(join(dir, 'node_modules', '@deepseek-ai', 'dsh-base'), { recursive: true })
// profile package.json — one installed community plugin + official bundle
writeFileSync(join(dir, 'package.json'), JSON.stringify({
  name: 'dsh-profile-test',
  private: true,
  dependencies: {
    '@linxin666/dsh-ssh': '^0.1.10',
    '@deepseek-ai/dsh-base': '^1.0.0',
  },
}))
writeFileSync(join(dir, 'node_modules', '@deepseek-ai', 'dsh-base', 'package.json'), JSON.stringify({
  name: '@deepseek-ai/dsh-base',
  version: '1.2.3',
  description: 'The shared dsh core as a profile bundle',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}))
// user patch: pet disabled
writeFileSync(join(dir, 'cordis.patch.yml'), '# test patch\n- id: pet\n  disabled: true\n')

const loader = makeLoader()
const web = makeWebServer()
const config = { profile: 'test' }

// The route handlers compute dir from config.profile against real DSH_HOME;
// point DSH_HOME at a wrapper dir that contains profiles/test.
const scratchHome = mkdtempSync(join(tmpdir(), 'dsh-pm-home-'))
const scratchProfile = join(scratchHome, 'profiles', 'test')
mkdirSync(scratchProfile, { recursive: true })
mkdirSync(join(scratchProfile, 'node_modules', '@linxin666', 'dsh-ssh'), { recursive: true })
mkdirSync(join(scratchProfile, 'node_modules', '@deepseek-ai', 'dsh-base'), { recursive: true })
writeFileSync(join(scratchProfile, 'package.json'), JSON.stringify({
  name: 'dsh-profile-test',
  private: true,
  dependencies: {
    '@linxin666/dsh-ssh': '^0.1.10',
    '@deepseek-ai/dsh-base': '^1.0.0',
  },
}))
writeFileSync(join(scratchProfile, 'node_modules', '@deepseek-ai', 'dsh-base', 'package.json'), JSON.stringify({
  name: '@deepseek-ai/dsh-base',
  version: '1.2.3',
  description: 'The shared dsh core as a profile bundle',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}))
// third-party package with a repository field → source link
writeFileSync(join(scratchProfile, 'node_modules', '@linxin666', 'dsh-ssh', 'package.json'), JSON.stringify({
  name: '@linxin666/dsh-ssh',
  version: '0.1.10',
  repository: { type: 'git', url: 'git+https://github.com/zhu1090093659/dsh-web-ui.git' },
}))
writeFileSync(join(scratchProfile, 'cordis.patch.yml'), '# test patch\n- id: pet\n  disabled: true\n')

process.env.DSH_HOME = scratchHome
mountRoutes({ loader, webServer: web }, { profile: 'test' })

console.log('routes: GET /entries')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/entries'), { origin: 'http://localhost:3080' })
  check('status 200', response.status === 200)
  check('entries length 7 (group filtered)', response.payload.entries.length === 7)
  const inc = response.payload.entries.find((e) => e.entryId === 'include')
  check('include builtin is official + protected', inc && inc.official === true && inc.protected === true)
  const ssh = response.payload.entries.find((e) => e.entryId === 'include:ssh')
  check('ssh projected', ssh && ssh.enabled === true && ssh.official === false && ssh.fiberPhase === 'active')
  check('ssh source from repository field', ssh.source && ssh.source.url === 'https://github.com/zhu1090093659/dsh-web-ui')
  const base = response.payload.entries.find((e) => e.name === '@deepseek-ai/dsh-host-webserver')
  check('official flag', base && base.official === true && base.protected === true)
  const plugins = response.payload.entries.find((e) => e.entryId === 'include:ui-settings-plugins')
  check('ui-settings-plugins protected (self-lock guard)', plugins && plugins.protected === true)
  const pet = response.payload.entries.find((e) => e.entryId === 'include:pet')
  check('pet disabled + phase null', pet && pet.enabled === false && pet.fiberPhase === null)
  check('disabledByPatch has pet', response.payload.disabledByPatch.includes('pet'))
}

console.log('routes: GET /entries with non-loopback Host (DNS rebinding) → 403')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/entries'), {
    origin: 'http://attacker.test:3080',
  })
  check('status 403', response.status === 403)
}

console.log('routes: POST /set-enabled (disable ssh)')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:ssh', enabled: false },
  })
  check('status 200', response.status === 200)
  check('entry disabled live', response.payload.entry.enabled === false)
  check('entry keeps source after toggle', response.payload.entry.source && response.payload.entry.source.url.startsWith('https://github.com/'))
  check('patch written', loader.entryById('include:ssh').disabled === true)
  const patchText = readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8')
  check('patch file has ssh disabled', /- id: ssh\n  disabled: true/.test(patchText))
  check('patch comments preserved', patchText.startsWith('# test patch'))
}

console.log('routes: POST /set-enabled (enable ssh again)')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:ssh', enabled: true },
  })
  check('status 200', response.status === 200)
  check('entry enabled live', response.payload.entry.enabled === true)
  check('prevDisabled reported true (override needed)', response.payload.entry.prevDisabled === true)
  const patchText = readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8')
  check('patch entry rewritten to explicit disabled: false', /- id: ssh\n  disabled: false/.test(patchText))
  check('pet still disabled in patch', /- id: pet\n  disabled: true/.test(patchText))
}

console.log('routes: POST /set-enabled (enable already-enabled entry → patch untouched)')
{
  const before = readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8')
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:ssh', enabled: true },
  })
  check('status 200', response.status === 200)
  check('no patch write attempted (no override needed)', response.payload.patch === null)
  check('patch file untouched', readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8') === before)
}

console.log('routes: POST /set-enabled on protected entry')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:webserver', enabled: false },
  })
  check('status 403', response.status === 403)
  check('loader untouched', loader.entryById('include:webserver').disabled === false)
}

console.log('routes: POST /set-enabled on ui-settings-plugins (self-lock guard)')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:ui-settings-plugins', enabled: false },
  })
  check('status 403', response.status === 403)
  check('loader untouched', loader.entryById('include:ui-settings-plugins').disabled === false)
}

console.log('routes: POST /set-enabled with non-boolean enabled')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:ssh', enabled: 'false' },
  })
  check('status 400', response.status === 400)
  check('loader untouched', loader.entryById('include:ssh').disabled === false)
}

console.log('routes: POST /set-enabled with crafted entry id (injection guard)')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'x\n  config:\n    evil: true', enabled: false },
  })
  check('status 404 (no loader match, patch never touched)', response.status === 404)
}

console.log('routes: POST /set-enabled with DNS-rebinding Host (attacker.test) → 403')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://attacker.test:3080',
    body: { entryId: 'include:ssh', enabled: false },
  })
  check('status 403', response.status === 403)
  check('loader untouched', loader.entryById('include:ssh').disabled === false)
}

console.log('routes: POST /set-enabled from non-loopback TCP peer (LAN) → 403')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    socket: { remoteAddress: '192.168.1.20' },
    body: { entryId: 'include:ssh', enabled: false },
  })
  check('status 403', response.status === 403)
  check('loader untouched', loader.entryById('include:ssh').disabled === false)
}

console.log('routes: POST /set-enabled with sec-fetch-site cross-site → 403')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    secFetchSite: 'cross-site',
    body: { entryId: 'include:ssh', enabled: false },
  })
  check('status 403', response.status === 403)
  check('loader untouched', loader.entryById('include:ssh').disabled === false)
}

console.log('routes: POST /set-enabled with missing origin + missing host')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    body: { entryId: 'include:ssh', enabled: false },
  })
  check('status 403', response.status === 403)
}

console.log('routes: POST /set-enabled unknown entry')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'ghost', enabled: false },
  })
  check('status 404', response.status === 404)
}

console.log('routes: GET /ping')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/ping'), { origin: 'http://localhost:3080' })
  check('status 200 + ok', response.status === 200 && response.payload.ok === true)
}

console.log('routes: POST /set-enabled on non-converging entry → settled:false')
{
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:stubborn', enabled: false },
  })
  check('status 200', response.status === 200)
  check('settled false reported', response.payload.settled === false)
  check('patch still written (requested flag persisted)', /- id: stubborn\n  disabled: true/.test(readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8')))
}

console.log('routes: POST /set-enabled with broken patch file → 200 + patchError')
{
  const backup = readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8')
  writeFileSync(join(scratchProfile, 'cordis.patch.yml'), '::broken::\n- id: [oops\n')
  const response = await call(web.routes.get('/dsh-plugin-manager/set-enabled'), {
    method: 'POST',
    origin: 'http://localhost:3080',
    body: { entryId: 'include:ssh', enabled: false },
  })
  check('status 200 (live switch still reported)', response.status === 200)
  check('patchError present', typeof response.payload.patchError === 'string')
  check('entry switched live', response.payload.entry.enabled === false)
  check('broken file untouched', readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8') === '::broken::\n- id: [oops\n')
  writeFileSync(join(scratchProfile, 'cordis.patch.yml'), backup)
  check('patch restored for later tests', readFileSync(join(scratchProfile, 'cordis.patch.yml'), 'utf8') === backup)
}



rmSync(scratchHome, { recursive: true, force: true })
rmSync(dir, { recursive: true, force: true })
delete process.env.DSH_HOME
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`)
process.exit(failed === 0 ? 0 : 1)
