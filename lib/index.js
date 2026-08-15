/**
 * dsh-plugin-manager host entry: mounts the manager's HTTP routes once the
 * profile composes the webServer and loader services.
 */

import { mountRoutes } from './routes.js'
import { argvProfile, hasProfileFlag } from './util.js'

export const name = 'dsh-plugin-manager'

export function apply(ctx, config) {
  // Profile resolution: the entry config wins, then the CLI invocation
  // (`--profile <name>` or `--profile=<name>`). If a `--profile` flag is
  // present but cannot be parsed, mounting would write patches to the wrong
  // profile — refuse to mount instead of guessing 'web'. With no flag at
  // all, 'web' is the dsh CLI's own default profile.
  const fromArgv = argvProfile()
  if (config?.profile === undefined && fromArgv === undefined && hasProfileFlag()) {
    console.warn('[dsh-plugin-manager] --profile 参数无法解析，跳过挂载以避免写入错误的 profile')
    return
  }
  const resolved = {
    profile: config?.profile ?? fromArgv ?? 'web',
  }
  ctx.inject(['webServer', 'loader'], (hostCtx) => {
    hostCtx.effect?.(() => mountRoutes(hostCtx, resolved), 'dsh-plugin-manager: http routes')
  })
}
