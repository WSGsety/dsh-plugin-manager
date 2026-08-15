/**
 * Shared host helpers: profile directory resolution, minimal HTTP JSON
 * helpers, and the trusted-request fence used by every route.
 *
 * The fence mirrors the official DSH `/api` boundary
 * (dsh-client-connection's `isTrustedApiRequest`): the Host header must
 * name the local loopback authority (defeating DNS rebinding, where the
 * browser sends the attacker's domain), `Sec-Fetch-Site: cross-site`
 * requests are refused, and an attached Origin must match the Host.
 * Mutating routes additionally verify the TCP peer is loopback whenever the
 * socket is visible, which is the "config plane restricted to loopback"
 * guarantee the official WebServer leaves to binding policy.
 */

import { join } from 'node:path'
import { homedir } from 'node:os'

/** Resolve a profile name to its directory under DSH_HOME (default ~/.dsh). */
export function profileDir(profile) {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/** Whether the CLI invocation carries a `--profile` flag in either form. */
export function hasProfileFlag() {
  return process.argv.some((arg) => arg === '--profile' || arg.startsWith('--profile='))
}

/**
 * The profile this host process actually booted. Accepts both spellings the
 * dsh CLI accepts: `--profile <name>` and `--profile=<name>`. Returns
 * undefined when no flag is present OR when the flag is present but cannot
 * be parsed — callers that must never guess a profile should combine this
 * with {@link hasProfileFlag} and refuse to act instead of defaulting.
 */
export function argvProfile() {
  const argv = process.argv
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--profile') {
      const value = argv[i + 1]
      if (value !== undefined && !value.startsWith('-')) return value
      return undefined
    }
    if (arg.startsWith('--profile=')) {
      const value = arg.slice('--profile='.length)
      if (value !== '') return value
      return undefined
    }
  }
  return undefined
}

/** Write a JSON payload with no-store caching. */
export function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/**
 * Whether a normalized WHATWG URL hostname names the local loopback
 * authority: `localhost`, `[::1]`, or any IPv4 address in 127/8. Same
 * predicate as the official dsh-client-connection loopback classification.
 */
export function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Parse a Host-header authority into {hostname, host}, or null. */
function parseAuthority(authority) {
  try {
    const url = new URL(`http://${authority}`)
    return { hostname: url.hostname, host: url.host }
  } catch {
    return null
  }
}

/** Whether a TCP peer address is loopback (IPv4 127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false
  if (address === '::1' || address === '::ffff:127.0.0.1') return true
  if (address.startsWith('::ffff:127.')) return true
  if (address.startsWith('127.')) return true
  return false
}

/**
 * The read-side trusted-request fence, mirroring the official `/api`
 * boundary: the Host header must parse and name the loopback authority, a
 * `Sec-Fetch-Site: cross-site` marker is refused, and an attached Origin
 * must match the Host exactly. Requests without an Origin pass — over plain
 * HTTP browsers attach no Origin to plain reads, and Host is the header DNS
 * rebinding cannot forge.
 */
export function trustedRequest(request) {
  const host = request.headers.host
  if (typeof host !== 'string') return false
  const authority = parseAuthority(host)
  if (authority === null || !isLoopbackHostname(authority.hostname)) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === authority.host
  } catch {
    return false
  }
}

/**
 * The write-side fence: {@link trustedRequest} plus the loopback guarantee
 * of the config plane. When the TCP peer is visible it must be loopback, so
 * a raw client on the network cannot reach the write surface by forging a
 * loopback Host header; when no socket is exposed (in-process bridges) the
 * Host fence still applies.
 */
export function trustedWriteRequest(request) {
  if (!trustedRequest(request)) return false
  const remote = request.socket?.remoteAddress
  if (remote !== undefined && !isLoopbackAddress(remote)) return false
  return true
}

/** Read and parse a JSON request body, rejecting anything over 16 KiB. */
export async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 16 * 1024) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
