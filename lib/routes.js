/**
 * HTTP routes bridging the browser UI to the host. This layer only parses
 * requests, calls the service modules, and serializes responses.
 *
 * Security: every route sits behind the official trusted-request fence
 * (loopback Host + Origin match + Sec-Fetch-Site), mutating routes add the
 * loopback-TCP-peer check, and every POST payload is validated before
 * touching the loader, the patch file, or a child process.
 */


import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readJsonBody, trustedRequest, trustedWriteRequest, sendJson, profileDir } from './util.js'
import { listEntries, setEntryEnabled, isProtected } from './entries.js'
import { listPatchDisabled, setPatchDisabled } from './patch.js'

/** Profile dependency specs `{ name: spec }` — source for github: installs. */
function readSpecs(profileDir) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
    return { ...(manifest.dependencies ?? {}) }
  } catch {
    return {}
  }
}

/**
 * Mount the manager's HTTP routes.
 * @param ctx - host context with `webServer` and `loader` services.
 * @param config - { profile } resolved by the plugin entry.
 * @returns disposer removing every registered route.
 */
export function mountRoutes(ctx, config) {
  const dir = profileDir(config.profile)
  // Read fresh on every request so specs reflect plugin installs made
  // outside the UI (dsh plugin add in a terminal).
  const specs = () => readSpecs(dir)

  const disposers = [
    ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-plugin-manager/entries',
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        if (!trustedRequest(request)) {
          sendJson(response, 403, { error: 'untrusted request' })
          return
        }
        try {
          let disabledByPatch = []
          let patchError = null
          try {
            disabledByPatch = listPatchDisabled(dir)
          } catch (error) {
            // A user-edited broken patch must not take the whole tab down;
            // report it and keep the live list working.
            patchError = error instanceof Error ? error.message : String(error)
          }
          sendJson(response, 200, {
            entries: listEntries(ctx.loader, dir, specs()),
            disabledByPatch,
            patchError,
          })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }),

    ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-plugin-manager/set-enabled',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (!trustedWriteRequest(request)) {
          sendJson(response, 403, { error: 'untrusted request' })
          return
        }
        try {
          const body = await readJsonBody(request)
          const entryId = typeof body.entryId === 'string' ? body.entryId : ''
          const enabled = body.enabled
          if (entryId === '') {
            sendJson(response, 400, { error: 'missing entryId' })
            return
          }
          if (typeof enabled !== 'boolean') {
            sendJson(response, 400, { error: 'enabled must be a boolean' })
            return
          }
          if (isProtected(entryId)) {
            sendJson(response, 403, { error: `entry ${entryId} is protected and cannot be toggled` })
            return
          }
          // Live toggle first — the durable patch write follows; if the
          // live side failed there is nothing worth persisting.
          const live = await setEntryEnabled(ctx.loader, entryId, enabled, dir, specs())
          if (live === null) {
            sendJson(response, 404, { error: `no loader entry matches ${entryId}` })
            return
          }
          if (live.error !== undefined) {
            sendJson(response, 502, { error: live.error })
            return
          }
          // Runtime loader ids are nested (`include:ssh`) while the user
          // patch layer addresses the flat bundle id (`ssh`) — persist the
          // last segment so the disable survives restarts. A disable always
          // writes `disabled: true`; an enable writes an explicit
          // `disabled: false` only when the entry was effectively disabled
          // before the toggle (a lower layer may carry `disabled: true`,
          // and only an explicit `false` in this later layer overrides it —
          // an already-enabled entry needs no override). A failed patch
          // write leaves the live state switched: report it as a warning
          // instead of a 500, so the UI can say "switched but not saved".
          let patch = null
          let patchError = null
          if (!enabled || live.prevDisabled === true) {
            try {
              patch = setPatchDisabled(dir, entryId.split(':').pop(), !enabled)
            } catch (error) {
              patchError = error instanceof Error ? error.message : String(error)
            }
          }
          sendJson(response, 200, {
            ok: true,
            entry: live,
            patch,
            patchError,
            // The requested flag is in effect, but the fiber is still
            // converging after the retry window — the UI tells the user to
            // re-check shortly instead of promising a settled state.
            settled: live.settled !== false,
          })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }),

    // Health probe used by the client to confirm the manager is mounted.
    ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-plugin-manager/ping',
      handler: (request, response) => {
        if (!trustedRequest(request)) {
          sendJson(response, 403, { error: 'untrusted request' })
          return
        }
        sendJson(response, 200, { ok: true })
      },
    }),
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
