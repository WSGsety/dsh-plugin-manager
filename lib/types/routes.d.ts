/**
 * HTTP routes bridging the browser UI to the host. This layer only parses
 * requests, calls the service modules, and serializes responses.
 *
 * Security: every route sits behind the official trusted-request fence
 * (loopback Host + Origin match + Sec-Fetch-Site), mutating routes add the
 * loopback-TCP-peer check, and every POST payload is validated before
 * touching the loader, the patch file, or a child process.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { LoaderEntry } from './entries'

/** The webServer surface the manager routes are registered on. */
export interface WebServerService {
  register(route: {
    kind: 'exact'
    path: string
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  }): () => void
}

/** The services the manager consumes, acquired via `ctx.inject`. */
export interface ManagerHost {
  webServer: WebServerService
  loader: {
    entries(): Iterable<LoaderEntry>
  }
}

/** Resolved manager configuration (profile is never optional here). */
export interface ManagerConfig {
  /** Profile directory the manager reads and persists toggles to. */
  profile: string
}

/**
 * Mount the manager's HTTP routes.
 * @param host - acquired webServer + loader services.
 * @param config - resolved configuration.
 * @returns disposer removing every registered route.
 */
export declare function mountRoutes(host: ManagerHost, config: ManagerConfig): () => void
