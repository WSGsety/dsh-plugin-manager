/**
 * util.js unit tests — profile flag parsing (both CLI spellings) and the
 * trusted-request fence. Run: node test/util.test.mjs
 */

import { argvProfile, hasProfileFlag, isLoopbackHostname, trustedRequest, trustedWriteRequest } from '../lib/util.js'

let failed = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Run a function with a stubbed process.argv, restoring it afterwards. */
function withArgv(argv, fn) {
  const original = process.argv
  process.argv = argv
  try {
    return fn()
  } finally {
    process.argv = original
  }
}

function req({ host, origin, secFetchSite, socket }) {
  const headers = {}
  if (host !== undefined) headers.host = host
  if (origin !== undefined) headers.origin = origin
  if (secFetchSite !== undefined) headers['sec-fetch-site'] = secFetchSite
  return { headers, socket }
}

console.log('util: argvProfile space form')
{
  const value = withArgv(['node', 'dsh', 'web', '--profile', 'demo'], () => argvProfile())
  check('--profile demo → demo', value === 'demo')
}

console.log('util: argvProfile equals form')
{
  const value = withArgv(['node', 'dsh', 'web', '--profile=demo'], () => argvProfile())
  check('--profile=demo → demo', value === 'demo')
}

console.log('util: argvProfile absent')
{
  const value = withArgv(['node', 'dsh', 'web'], () => argvProfile())
  check('no flag → undefined', value === undefined)
  check('hasProfileFlag false', withArgv(['node', 'dsh', 'web'], () => hasProfileFlag()) === false)
}

console.log('util: argvProfile malformed flag')
{
  check('--profile with no value → undefined', withArgv(['node', 'dsh', '--profile'], () => argvProfile()) === undefined)
  check('--profile= empty → undefined', withArgv(['node', 'dsh', '--profile='], () => argvProfile()) === undefined)
  check('--profile --flag → undefined', withArgv(['node', 'dsh', '--profile', '--verbose'], () => argvProfile()) === undefined)
  check('hasProfileFlag still true (refuse to guess)', withArgv(['node', 'dsh', '--profile'], () => hasProfileFlag()) === true)
}

console.log('util: isLoopbackHostname')
{
  check('localhost', isLoopbackHostname('localhost') === true)
  check('[::1]', isLoopbackHostname('[::1]') === true)
  check('127.0.0.1', isLoopbackHostname('127.0.0.1') === true)
  check('127.8.1.2 (127/8)', isLoopbackHostname('127.8.1.2') === true)
  check('attacker.test rejected', isLoopbackHostname('attacker.test') === false)
  check('192.168.1.5 rejected', isLoopbackHostname('192.168.1.5') === false)
  check('127.1.2 rejected (3 parts)', isLoopbackHostname('127.1.2') === false)
  check('127.1.2.999 rejected (octet > 255)', isLoopbackHostname('127.1.2.999') === false)
}

console.log('util: trustedRequest loopback origin')
{
  const request = req({ host: 'localhost:3080', origin: 'http://localhost:3080' })
  check('localhost + matching origin → true', trustedRequest(request) === true)
  const ip = req({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' })
  check('127.0.0.1 + matching origin → true', trustedRequest(ip) === true)
  const ipv6 = req({ host: '[::1]:3080', origin: 'http://[::1]:3080' })
  check('[::1] + matching origin → true', trustedRequest(ipv6) === true)
}

console.log('util: trustedRequest DNS rebinding')
{
  const request = req({ host: 'attacker.test:3080', origin: 'http://attacker.test:3080' })
  check('attacker.test host → false', trustedRequest(request) === false)
}

console.log('util: trustedRequest origin mismatch / cross-site')
{
  const mismatch = req({ host: 'localhost:3080', origin: 'http://evil.example' })
  check('mismatched origin → false', trustedRequest(mismatch) === false)
  const crossSite = req({ host: 'localhost:3080', origin: 'http://localhost:3080', secFetchSite: 'cross-site' })
  check('sec-fetch-site cross-site → false', trustedRequest(crossSite) === false)
}

console.log('util: trustedRequest without origin (official fence allows)')
{
  const request = req({ host: 'localhost:3080' })
  check('loopback host, no origin → true', trustedRequest(request) === true)
}

console.log('util: trustedRequest missing/unparsable host')
{
  check('no host → false', trustedRequest(req({ origin: 'http://localhost:3080' })) === false)
  check('garbage host → false', trustedRequest(req({ host: '::not:: a host' })) === false)
}

console.log('util: trustedWriteRequest socket fence')
{
  const loopback = req({ host: 'localhost:3080', origin: 'http://localhost:3080', socket: { remoteAddress: '127.0.0.1' } })
  check('loopback peer → true', trustedWriteRequest(loopback) === true)
  const ipv6peer = req({ host: 'localhost:3080', origin: 'http://localhost:3080', socket: { remoteAddress: '::1' } })
  check('::1 peer → true', trustedWriteRequest(ipv6peer) === true)
  const lan = req({ host: 'localhost:3080', origin: 'http://localhost:3080', socket: { remoteAddress: '192.168.1.20' } })
  check('LAN peer forging loopback host → false', trustedWriteRequest(lan) === false)
  const hidden = req({ host: 'localhost:3080', origin: 'http://localhost:3080', socket: undefined })
  check('no visible socket (in-process bridge) → true', trustedWriteRequest(hidden) === true)
  const rebind = req({ host: 'attacker.test:3080', origin: 'http://attacker.test:3080', socket: { remoteAddress: '127.0.0.1' } })
  check('rebinding host even from loopback peer → false', trustedWriteRequest(rebind) === false)
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`)
process.exit(failed === 0 ? 0 : 1)
