/**
 * Loader entry surface: projection of every non-group entry in the live
 * Cordis loader, plus live enable/disable through `entry.update`.
 *
 * Bundle-layer trees (the web profile) are in-memory: `update` restarts the
 * entry fiber immediately but its persistence is a no-op, so the durable
 * side lives in the user patch layer (see patch.js). This module only reads
 * package manifests for the source-repository lookup below.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Runtime mirror of Cordis Fiber states (same const enum as the inventory gateway). */
const FIBER_STATE = { PENDING: 0, LOADING: 1, ACTIVE: 2, FAILED: 3, DISPOSED: 4, UNLOADING: 5 }
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
}

/** Per-host cache of package manifests read for the source lookup. */
const manifestCache = new Map()

/**
 * Resolve the source repository of an installed package.
 * npm installs carry a `repository` field; git installs (`github:owner/repo`
 * specs) can be read from the profile dependency spec when the manifest
 * lacks one. Returns a clickable URL or null.
 * @param profileDir - resolved profile directory.
 * @param name - package name (loader entry module name).
 * @param spec - optional dependency spec from the profile manifest.
 */
export function packageSource(profileDir, name, spec) {
  if (name === '' || name.startsWith('cordis:')) return null
  let manifest = manifestCache.get(name)
  if (manifest === undefined) {
    // pnpm hoists shared deps to the profile root node_modules — check both.
    manifest = null
    for (const base of [profileDir, join(profileDir, '..')]) {
      try {
        manifest = JSON.parse(readFileSync(join(base, 'node_modules', name, 'package.json'), 'utf8'))
        break
      } catch { /* try the next base */ }
    }
    manifestCache.set(name, manifest)
  }
  const url = repositoryUrl(manifest?.repository) ?? homepageUrl(manifest?.homepage) ?? githubSpecUrl(spec)
  return url === null ? null : { url }
}

/** Normalize a `repository` field (string or {type,url}) into an http(s) URL. */
function repositoryUrl(repository) {
  if (typeof repository === 'string') return normalizeRepoUrl(repository)
  if (repository !== null && typeof repository === 'object' && typeof repository.url === 'string') {
    return normalizeRepoUrl(repository.url)
  }
  return null
}

/** Normalize `git+https://…` / `git://…` / `ssh://…` repo strings to https. */
function normalizeRepoUrl(url) {
  let match = /^git\+?(https?:\/\/[^\s]+)/.exec(url)
  if (match !== null) return trimRepo(match[1])
  match = /^git@([^:]+):([^\s]+)$/.exec(url)
  if (match !== null) return `https://${match[1]}/${trimRepo(match[2])}`
  if (/^https?:\/\//.test(url)) return trimRepo(url)
  return null
}

/** Strip trailing `.git` and whitespace from a repo URL. */
function trimRepo(url) {
  return url.replace(/\.git$/, '').trim()
}

/** A github: dependency spec already carries the repository location. */
function githubSpecUrl(spec) {
  if (typeof spec !== 'string') return null
  const match = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/.exec(spec)
  return match === null ? null : `https://github.com/${match[1]}`
}

/** A github homepage is a fine fallback when no repository is declared. */
function homepageUrl(homepage) {
  if (typeof homepage !== 'string') return null
  const match = /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/.exec(homepage)
  return match === null ? null : match[1]
}

/**
 * Entries the web shell cannot survive without. Disabling any of these
 * breaks the page that hosts the manager (or the manager itself), so the
 * UI hides the toggle for them.
 */
export const PROTECTED_IDS = new Set([
  'dsh-plugin-manager', // this plugin itself
  'include', // config-tree container (cordis-plugin-include) — disabling it unloads every configured plugin
  'webserver', // host HTTP routes (this plugin's own transport)
  'web-runtime', // browser shell bootstrap
  'modules', // client module system (serves every client bundle)
  'connection', // client<->host wire
  'client-runtime', // client core services (slots, session runtime)
  'client-hmr', // dev hot-reload driver
  'locale', // client locale service
  'ui-layout', // AppFrame shell
  'ui-sidebar', // sidebar navigation
  'ui-settings', // settings domain base
  'ui-settings-plugins', // owns the settings.plugins.tab slot that hosts this manager's page — disabling it locks the UI shut
  'settings', // host settings service (dsh-settings-file)
  'typert', // typert registry
  'typert-loader', // typert reflection loader
  'typert-gateway', // API gateway
  'api-remotes', // remote BFF assembly
])

/** Official plugins are packages published by the DSH team under this scope. */
export const OFFICIAL_SCOPE = '@deepseek-ai'

/**
 * Whether a plugin is official: packages published under the DSH scope,
 * plus `cordis:` builtin entries (config-tree containers like
 * `cordis:include` — dsh core machinery, not third-party packages).
 */
export function isOfficial(name) {
  return name.startsWith(`${OFFICIAL_SCOPE}/`) || name.startsWith('cordis:')
}

/**
 * Whether a loader entry id may be toggled at all. Loader ids are nested
 * (e.g. `include:webserver`), so protection matches the last id segment.
 */
export function isProtected(entryId) {
  if (PROTECTED_IDS.has(entryId)) return true
  const last = entryId.split(':').pop()
  return last !== entryId && PROTECTED_IDS.has(last)
}

/**
 * Project the live loader entries into plain, serializable rows.
 * @param loader - the Cordis loader service (entries() iterator).
 * @param profileDir - resolved profile directory (for source lookup).
 * @param specs - optional profile dependency spec map { name: spec }.
 * @returns entries in loader order, newest fiber info only.
 */
export function listEntries(loader, profileDir, specs = {}) {
  const entries = []
  for (const entry of loader.entries()) {
    // Defensive: a malformed entry must never take the whole list down.
    if (entry === null || typeof entry !== 'object' || entry.options == null || entry.options.group) continue
    const name = entry.options.name ?? ''
    entries.push({
      entryId: entry.id,
      name,
      enabled: !entry.disabled,
      fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      official: isOfficial(name),
      protected: isProtected(entry.id),
      source: packageSource(profileDir, name, specs[name]),
    })
  }
  return entries
}

/**
 * Live-toggle one entry through the loader. The `update` restart is
 * asynchronous: an in-flight init can finish after the options flip, so the
 * live fiber state is verified and the update retried until it matches.
 * Convergence is judged by the entry's effective `disabled` flag (which the
 * projection reports), not by fiber presence — a fiber mid-unload must not
 * look like a failed toggle. When the retries run out the projection still
 * reflects the requested flag, and `settled: false` tells the route the
 * live side is still converging.
 * @param loader - the Cordis loader service.
 * @param entryId - loader entry id to toggle.
 * @param enabled - desired state.
 * @param profileDir - resolved profile directory (for source lookup).
 * @param specs - optional profile dependency spec map { name: spec }.
 * @returns the entry's new live projection, or null when no entry matched.
 */
export async function setEntryEnabled(loader, entryId, enabled, profileDir, specs = {}) {
  for (const entry of loader.entries()) {
    if (entry.id !== entryId || entry.options == null || entry.options.group) continue
    // The effective state before this toggle: the patch write needs to know
    // whether an explicit `disabled: false` override is required.
    const prevDisabled = entry.disabled
    let settled = false
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // `disabled: false` is passed explicitly (never `null`, which deletes
        // the flag and lets a lower bundle layer's `disabled: true` re-apply
        // — the loader merges layers with the last write winning, exactly
        // like the user patch file).
        await entry.update({ disabled: enabled ? false : true }, false, true)
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
      settled = !entry.disabled === enabled
      if (settled) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const name = entry.options.name ?? ''
    return {
      entryId: entry.id,
      name,
      enabled: !entry.disabled,
      fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      official: isOfficial(name),
      protected: isProtected(entry.id),
      source: packageSource(profileDir, name, specs[name]),
      prevDisabled,
      settled,
    }
  }
  return null
}
