/**
 * User patch layer persistence (`cordis.patch.yml` in the profile dir).
 *
 * The loader's own persistence is a no-op for bundle-layer trees (the web
 * profile), so the durable side of an enable/disable is this file: dsh
 * applies it after every bundle layer at boot, and the last write wins per
 * entry. Layer order is Bundle → Profile Patch → Home Patch → `--patch`, so
 * overriding a lower layer's `disabled: true` (official bundles ship some,
 * e.g. `skill-badge`) requires an explicit `disabled: false` here — deleting
 * the pair would let the bundle's flag re-apply on the next boot. Every
 * toggle therefore writes an explicit `disabled: true|false` pair, never
 * removes one. Editing is done with the comment-preserving `yaml` package so
 * the user's own annotations and `!!js` expressions survive untouched, and
 * writes are atomic (tmp file + rename) with the original file's permission
 * bits carried over, so a crash never leaves a half-written patch that
 * bricks the next boot and a `0600` config stays `0600`.
 */

import { chmodSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'

const HEADER = [
  '# Your patch layer for this dsh profile, applied after every bundle layer:',
  '# a top-level YAML array of loader patch entries (id-targeted config',
  '# overrides, disables, and insert lists; `!!js` expressions allowed).',
  '# Managed by dsh-plugin-manager — every entry you toggle from the web UI',
  '# carries an explicit `disabled: true|false`, because a lower bundle layer',
  '# may set `disabled: true` and only an explicit `false` here overrides it.',
].join('\n')

/** Locate the profile's user patch file. */
export function patchPath(profileDir) {
  return join(profileDir, 'cordis.patch.yml')
}

/**
 * Read the patch file into a mutable yaml document.
 * @returns the parsed Document, or null when the file does not exist yet.
 * @throws when the file exists but cannot be parsed (the file is left untouched).
 */
export function readPatch(profileDir) {
  const path = patchPath(profileDir)
  if (!existsSync(path)) return null
  const doc = YAML.parseDocument(readFileSync(path, 'utf8'))
  if (doc.errors.length > 0) {
    throw new Error(`cordis.patch.yml 无法解析，已停止写入以免破坏配置: ${doc.errors[0].message}`)
  }
  if (doc.contents === null) {
    // Empty file — treat as an empty sequence.
    doc.contents = doc.createNode([])
  }
  return doc
}

/** Find a top-level patch entry node by its `id` pair, or null. */
function findEntry(doc, entryId) {
  const items = doc.contents?.items
  if (!Array.isArray(items)) return null
  return items.find(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      Array.isArray(item.items) &&
      item.items.some((pair) => pair.key?.value === 'id' && pair.value?.value === entryId),
  ) ?? null
}

/** Loader entry ids are dsh-generated tokens; anything else is refused so a
 * crafted id can never inject YAML into the user patch file. */
const ENTRY_ID_RE = /^[A-Za-z0-9_.-]+$/

/**
 * Set (or clear) the persistent disabled flag for one loader entry id.
 * The pair is always written with an explicit boolean — a disable writes
 * `disabled: true` even over an existing `disabled: false`, and an enable
 * writes `disabled: false` even when no pair exists, because only an
 * explicit `false` in this (later) layer overrides a `true` in a lower
 * bundle layer. The whole file is rewritten only when something actually
 * changed.
 * @returns {changed: boolean, disabled: boolean, entries: string[]} —
 *   `entries` lists every id currently disabled by the user layer.
 * @throws on an invalid entry id or an unparsable patch file.
 */
export function setPatchDisabled(profileDir, entryId, disabled) {
  if (!ENTRY_ID_RE.test(entryId)) {
    throw new Error(`invalid entry id: ${JSON.stringify(entryId)}`)
  }
  let doc = readPatch(profileDir)
  let created = false
  if (doc === null) {
    doc = YAML.parseDocument(`${HEADER}\n- id: ${entryId}\n  disabled: ${disabled}\n`)
    created = true
  } else {
    const entry = findEntry(doc, entryId)
    if (entry === null) {
      doc.contents.items.push(doc.createNode({ id: entryId, disabled }))
    } else {
      const pair = entry.items.find((p) => p.key?.value === 'disabled')
      if (pair === undefined) {
        entry.items.push(doc.createPair('disabled', disabled))
      } else if (pair.value?.value === disabled) {
        // The explicit flag is already in the requested state — nothing to do.
        return { changed: false, disabled, entries: disabledIds(doc) }
      } else {
        // Replace a stale `disabled: <other>` (including `!!js` expressions
        // whose value cannot be known statically) with the literal flag.
        pair.value = doc.createNode(disabled)
      }
    }
  }
  writePatch(profileDir, doc)
  return { changed: true, disabled, entries: disabledIds(doc), created }
}

/** Every id currently disabled by the user patch layer. */
export function listPatchDisabled(profileDir) {
  const doc = readPatch(profileDir)
  if (doc === null) return []
  return disabledIds(doc)
}

/** Collect `id` values of top-level entries carrying `disabled: true`. */
function disabledIds(doc) {
  const items = doc.contents?.items
  if (!Array.isArray(items)) return []
  const ids = []
  for (const item of items) {
    if (item === null || typeof item !== 'object' || !Array.isArray(item.items)) continue
    let id = null
    let disabled = null
    for (const pair of item.items) {
      if (pair.key?.value === 'id') id = pair.value?.value ?? null
      if (pair.key?.value === 'disabled') disabled = pair.value?.value ?? null
    }
    if (id !== null && disabled === true) ids.push(id)
  }
  return ids
}

/** Atomically write the document back to the patch file, preserving the
 * original file's permission bits (0600 for a brand-new file). */
function writePatch(profileDir, doc) {
  const path = patchPath(profileDir)
  let mode = 0o600
  try {
    // Carry the existing file's mode through the tmp+rename so a user's
    // restrictive permissions (e.g. 0600) survive a rewrite.
    mode = statSync(path).mode & 0o777
  } catch {
    /* new file: default to 0600 — this file may hold config overrides */
  }
  // An emptied sequence serializes as `[]` and drops its comments — keep the
  // header so the file still documents itself.
  const items = doc.contents?.items
  const text = Array.isArray(items) && items.length === 0
    ? `${HEADER}\n[]\n`
    : doc.toString().endsWith('\n') ? doc.toString() : doc.toString() + '\n'
  // Unique temp name so a stale tmp from a crashed process can never collide.
  const tmp = `${path}.dsh-pm.${process.pid}.tmp`
  writeFileSync(tmp, text, 'utf8')
  // chmod after write: umask cannot narrow the explicitly requested bits.
  chmodSync(tmp, mode)
  renameSync(tmp, path)
}
