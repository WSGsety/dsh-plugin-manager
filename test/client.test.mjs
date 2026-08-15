/**
 * client.js smoke test — loads the ModuleLoader bundle in a stubbed
 * browser-like environment, runs apply(), and checks the slot registrations
 * that drive the 设置 → 插件 / 插件市场 surfaces. Run:
 * node test/client.test.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let failed = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client', 'client.js'), 'utf8')
const packageName = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).name

// --- stub browser + react -------------------------------------------------
const registered = { tabs: [] }
const styleTags = []
let registeredModuleId
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      registeredModuleId = id
      const module = { exports: {} }
      const require = (name) => {
        if (name === 'react' || name === 'react/jsx-runtime') return reactStub
        throw new Error(`unexpected require: ${name}`)
      }
      const result = factory(require)
      globalThis.__lastLoaded = result
      return result
    },
  },
}
const documentStub = {
  querySelector() { return null },
  createElement(tag) {
    return { tag, dataset: {}, textContent: '' }
  },
  head: {
    appendChild(node) { styleTags.push(node) },
  },
}
globalThis.document = documentStub
globalThis.window.document = documentStub
const reactStub = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children }
  },
  Fragment: Symbol('fragment'),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
  useCallback: (fn) => fn,
  useSyncExternalStore: () => null,
  useId: () => 'id',
}

// --- stub ctx --------------------------------------------------------------
const localeBundles = {}
const ctx = {
  effect(fn, label) { fn?.(); return () => {} },
  locale: {
    register(ns, dict) { localeBundles[ns] = dict },
    bind(ns) {
      return (key) => (localeBundles[ns]?.zh[key] ?? key)
    },
  },
  slots: {
    register(entry, component) {
      return { ...entry, component }
    },
    inject(target, factory) {
      const entry = factory()
      if (target === 'settings.plugins.tab') registered.tabs.push(entry)
    },
  },
}

// --- run -------------------------------------------------------------------
// Evaluate the bundle in the global scope: its top level calls
// window.__ModuleLoader__.load({id, factory}), and the stub below runs the
// factory with a react require shim, returning module.exports.
;(0, eval)(source)
const loaded = globalThis.__lastLoaded

check('ModuleLoader id matches package name', registeredModuleId === packageName, `${registeredModuleId} !== ${packageName}`)
check('exports.apply is a function', typeof loaded.apply === 'function')
check('exports.inject lists slots+locale', Array.isArray(loaded.inject) && loaded.inject.includes('slots') && loaded.inject.includes('locale'))

loaded.apply(ctx)

check('style tag injected', styleTags.length === 1 && styleTags[0].dataset.plugin === 'dsh-plugin-manager')
check('locale registered (zh)', typeof localeBundles.pluginManager?.zh?.tab === 'string')
check('locale registered (en)', typeof localeBundles.pluginManager?.en?.tab === 'string')

const tab = registered.tabs.find((e) => e.id === 'pm-manage')
check('manage tab registered', tab !== undefined)
check('manage tab order 9 (before official read-only list)', tab.order === 9)
check('manage tab label resolves', tab.label() === '插件管理')
check('manage tab component is function', typeof tab.component === 'function')
check('manage tab inject exposes t', typeof tab.inject().t === 'function')

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`)
process.exit(failed === 0 ? 0 : 1)
