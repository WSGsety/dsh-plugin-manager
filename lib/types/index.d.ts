/**
 * dsh-plugin-manager host entry: mounts the manager's HTTP routes once the
 * profile composes the webServer and loader services.
 */
import type { Context } from '@deepseek-ai/cordis'

export declare const name = 'dsh-plugin-manager'

/** Optional cordis.yml configuration. */
export interface Config {
  /** Profile whose user patch layer the manager persists toggles to.
   * Resolution order: this config, then the CLI `--profile` flag, then
   * `web`. When a `--profile` flag is present but unparsable the plugin
   * refuses to mount rather than guess. */
  profile?: string
}

export declare function apply(ctx: Context, config?: Config): void
