# dsh-plugin-manager

DSH 网页插件管理：在 Web 设置页直接启用/停用已安装插件。npm 包名 `@wsgsety/dsh-plugin-manager`，运行时条目 id `dsh-plugin-manager`。

- **设置 → 插件 → 插件管理**：搜索、按官方/第三方筛选，每个插件一行开关。切换**立即生效**（Cordis loader 热更新）并**写入用户 patch 层**（`~/.dsh/profiles/<profile>/cordis.patch.yml`），重启后保持。
- 插件卡片带运行状态点（运行中/已停用/挂载失败…）、「官方」徽标（`@deepseek-ai/*`）与「受保护」标记。
- 完全自研，不依赖 dshmarket。

## 安装

```bash
# npm registry（推荐）
dsh plugin --profile web add @wsgsety/dsh-plugin-manager
# 或从 GitHub 安装（pin 到具体 commit，保证可复现）
dsh plugin --profile web add github:WSGsety/dsh-plugin-manager#9cbbcdd59fdce3dd96879924b485ea3e8053d3c2
# 重启 dsh web（命令行或 DeepSeek Harness 桌面应用）后生效
```

- 运行时 loader 条目 id 带组前缀（`include:ssh`），patch 层写入时自动去掉前缀（`ssh`），与 bundle 层 id 对齐。
- 桌面应用（deepseek-harness-desktop）用 app 内置 dsh 启动 web profile、随机端口，profile 仍是 `~/.dsh/profiles/web`；改动后重启应用即可。

## Host 路由

| 路由 | 方法 | 说明 |
|---|---|---|
| `/dsh-plugin-manager/entries` | GET | loader 条目投影 + patch 停用列表 |
| `/dsh-plugin-manager/set-enabled` | POST | 实时启停 + 写 patch 持久化（可信请求栅栏） |
| `/dsh-plugin-manager/ping` | GET | 健康检查 |

## 安全

- 所有路由走官方 `dsh-client-connection` 同款**可信请求栅栏**：`Host` 必须是回环权威（`localhost` / `127.0.0.0/8` / `[::1]`，DNS 重绑定无法伪造）、`Sec-Fetch-Site: cross-site` 拒绝、携带的 `Origin` 必须与 `Host` 完全一致。写接口（`/set-enabled`）额外要求 TCP 对端可见时为回环地址，把配置平面限制在回环（与官方 WebServer 配置平面语义一致）。
- 写请求体积受限（16 KiB）JSON body，entry id 经白名单校验，杜绝 YAML 注入。
- 保护列表（`lib/entries.js`）禁止停用 web 外壳、插件自身与承载页面的核心条目：`webserver`、`web-runtime`、`modules`、`connection`、`client-runtime`、`locale`、`ui-layout`、`ui-sidebar`、`ui-settings`、`ui-settings-plugins`（本插件页面所在 slot 的所有者，防止 UI 自锁）、`settings`、`typert*`、`api-remotes`、`dsh-plugin-manager`。

## 设计要点

- **patch 层语义对齐 DSH 层叠规则**（Bundle → Profile Patch → Home Patch → `--patch`，后层覆盖前层）：每次启停都写入**显式** `disabled: true|false`，绝不删除字段——官方 bundle 自带 `disabled: true` 的条目（如 `skill-badge`）只有靠用户层显式 `false` 才能覆盖，删除字段会在重启后重新停用。启用已在运行中的条目不写 patch（无需覆盖）。
- patch 文件用 `yaml` 包做**保注释无损往返**（用户手写注释、`!!js` 表达式原样保留），写入为 tmp+rename 原子替换并**继承原文件权限位**（新文件默认 `0600`）；解析失败时拒绝写入并报错。
- 实时启停通过 `loader` 条目 `entry.update({disabled})` 热更——启用传显式 `false`（传 `null` 会删除字段、让底层 bundle 的 `true` 重新生效），fiber 状态带回执校验重试（与 dshmarket 皮肤切换同机制）。
- profile 定位同时识别 `--profile <name>` 与 `--profile=<name>`；CLI 带 `--profile` 但无法解析时拒绝挂载，绝不猜测默认写错 profile。

## 开发

```bash
node scripts/gates/run.mjs        # 门禁全量：语法 + manifest 契约 + 测试 + 非法样例自检
node scripts/gates/run.mjs --syntax     # 只查语法（最窄证据）
node scripts/gates/run.mjs --manifest   # 只查 package.json 契约
node scripts/gates/run.mjs --tests      # 只跑测试
node scripts/gates/run.mjs --self-test  # 只跑自检（证明门禁会拒绝坏包）
node test/patch.test.mjs   # patch 读写（显式布尔 + 权限保留）
node test/routes.test.mjs  # 路由（mock webServer/loader，含安全负向用例）
node test/util.test.mjs    # profile 解析 + 可信请求栅栏
node test/client.test.mjs  # client bundle 冒烟
# 或 npm test
```

非平凡改动的取舍记录在 `decisions/implemented/`（problem → decision →
alternatives → consequences）。

## 发布

```bash
npm login            # npm 账号（发布需 2FA / bypass-2FA token）
npm publish          # prepublishOnly 门禁自动把关，发布到官方源
```
