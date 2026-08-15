/**
 * Shared host helpers: profile directory resolution, minimal HTTP JSON
 * helpers, and the trusted-request fence used by every route.
 *
 * The fence mirrors the official DSH `/api` boundary: the Host header must
 * name the local loopback authority (defeating DNS rebinding),
 * `Sec-Fetch-Site: cross-site` requests are refused, and an attached Origin
 * must match the Host. Mutating routes additionally verify the TCP peer is
 * loopback whenever the socket is visible.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Resolve a profile name to its directory under DSH_HOME (default ~/.dsh). */
export declare function profileDir(profile: string): string

/** Whether the CLI invocation carries a `--profile` flag in either form. */
export declare function hasProfileFlag(): boolean

/**
 * The profile this host process actually booted. Returns undefined when no
 * flag is present OR when the flag is present but cannot be parsed.
 */
export declare function argvProfile(): string | undefined

/** Write a JSON payload with no-store caching. */
export declare function sendJson(response: ServerResponse, status: number, payload: unknown): void

/**
 * Whether a normalized WHATWG URL hostname names the local loopback
 * authority: `localhost`, `[::1]`, or any IPv4 address in 127/8.
 */
export declare function isLoopbackHostname(hostname: string): boolean

/**
 * The read-side trusted-request fence, mirroring the official `/api`
 * boundary. Requests without an Origin pass (browsers attach no Origin to
 * plain reads over plain HTTP; Host is the header DNS rebinding cannot
 * forge).
 */
export declare function trustedRequest(request: IncomingMessage): boolean

/** The write-side fence: `trustedRequest` plus the loopback guarantee of
 * the config plane. */
export declare function trustedWriteRequest(request: IncomingMessage): boolean

/**
 * Read and parse a JSON request body, rejecting anything over 16 KiB.
 */
export declare function readJsonBody(request: IncomingMessage): Promise<unknown>
