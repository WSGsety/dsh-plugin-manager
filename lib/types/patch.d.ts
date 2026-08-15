/**
 * User patch layer persistence (`cordis.patch.yml` in the profile dir).
 *
 * Editing is done with the comment-preserving `yaml` package so the user's
 * own annotations and `!!js` expressions survive untouched, and writes are
 * atomic (tmp file + rename) with the original file's permission bits
 * carried over.
 */
import type { Document } from 'yaml'

/** Result of a patch write; `entries` lists every id disabled by the user
 * layer after the write. */
export interface PatchResult {
  changed: boolean
  disabled: boolean
  entries: string[]
  /** Whether the patch file did not exist before this write. */
  created?: boolean
}

/** Locate the profile's user patch file. */
export declare function patchPath(profileDir: string): string

/**
 * Read the patch file into a mutable yaml document.
 * @returns the parsed Document, or null when the file does not exist yet.
 * @throws when the file exists but cannot be parsed (the file is left
 * untouched).
 */
export declare function readPatch(profileDir: string): Document | null

/**
 * Set (or clear) the persistent disabled flag for one loader entry id.
 * @throws on an invalid entry id or an unparsable patch file.
 */
export declare function setPatchDisabled(
  profileDir: string,
  entryId: string,
  disabled: boolean,
): PatchResult

/** Every id currently disabled by the user patch layer. */
export declare function listPatchDisabled(profileDir: string): string[]
