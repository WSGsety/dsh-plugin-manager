/**
 * Loader entry surface: projection of every non-group entry in the live
 * Cordis loader, plus live enable/disable through `entry.update`.
 *
 * Bundle-layer trees (the web profile) are in-memory: `update` restarts the
 * entry fiber immediately but its persistence is a no-op, so the durable
 * side lives in the user patch layer (see patch.d.ts). This module only
 * reads package manifests for the source-repository lookup.
 */

/** One non-group loader entry as projected by `listEntries`. */
export interface EntryRow {
  entryId: string
  /** Package module name (e.g. `@deepseek-ai/cordis-plugin-timer`). */
  name: string
  enabled: boolean
  /** Runtime fiber phase, or null when no fiber is present. */
  fiberPhase: 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null
  /** Whether the entry is official (`@deepseek-ai/*` or `cordis:` builtin). */
  official: boolean
  /** Whether the entry is protected from toggling by the web shell. */
  protected: boolean
  /** Source repository URL for third-party entries, or null. */
  source: { url: string } | null
}

/** The minimal loader entry surface the manager reads and mutates. */
export interface LoaderEntry {
  id: string
  /** Effective disabled flag across all layers. */
  disabled?: boolean
  options?: {
    name?: string
    /** Group container entries are skipped by the projection. */
    group?: boolean
  }
  fiber?: {
    /** Cordis Fiber state enum: 0 pending, 1 loading, 2 active, 3 failed,
     * 4 disposed, 5 unloading. */
    state: number
  }
  update?(options: { disabled: boolean }, force?: boolean, restart?: boolean): Promise<unknown>
}

/** The Cordis loader service surface. */
export interface LoaderLike {
  entries(): Iterable<LoaderEntry>
}

/** Result of a live toggle; adds the pre-toggle state and convergence flag.
 * The failure branch is `ToggleError` — the success projection never carries
 * an `error` field, so the union discriminates on it. */
export interface ToggleResult extends EntryRow {
  /** Effective disabled flag before this toggle (drives patch writes). */
  prevDisabled?: boolean
  /** Whether the live fiber converged within the retry window. */
  settled?: boolean
}

/** Entries the web shell cannot survive without; toggles are hidden for them. */
export declare const PROTECTED_IDS: ReadonlySet<string>

/** Official plugins are packages published by the DSH team under this scope. */
export declare const OFFICIAL_SCOPE: string

/** Whether a plugin is official (`@deepseek-ai/*` scope or `cordis:` builtin). */
export declare function isOfficial(name: string): boolean

/** Whether a loader entry id may be toggled at all (matches last id segment). */
export declare function isProtected(entryId: string): boolean

/**
 * Resolve the source repository of an installed package.
 * Returns a clickable URL or null.
 */
export declare function packageSource(
  profileDir: string,
  name: string,
  spec?: string,
): { url: string } | null

/** Project the live loader entries into plain, serializable rows. */
export declare function listEntries(
  loader: LoaderLike,
  profileDir: string,
  specs?: Record<string, string>,
): EntryRow[]

/** The live toggle failed: the entry is left in its previous state. */
export interface ToggleError {
  error: string
}

/**
 * Live-toggle one entry through the loader.
 * @returns the entry's new live projection, `{ error }` when the live
 * `entry.update` threw, or null when no entry matched.
 */
export declare function setEntryEnabled(
  loader: LoaderLike,
  entryId: string,
  enabled: boolean,
  profileDir: string,
  specs?: Record<string, string>,
): Promise<ToggleResult | ToggleError | null>
