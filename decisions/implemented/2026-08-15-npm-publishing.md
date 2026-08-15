# 决策记录：npm 发布形态与包名更名（dsh-plugin-manager → dsh-plugin-manager-web）

- 日期：2026-08-15
- 状态：implemented

## Problem

对外分发时发现两个问题：

1. README 安装节包含本地开发路径（`link:/Users/<user>/...`），属于个人环境痕迹，
   不适合对外发布。
2. 生态里主流插件走 npm registry 分发（`dsh plugin --profile web add <包名>`，
   如 dshmarket、dsh-find-plugin），而本插件只有 link / GitHub 源两种安装通道。
   检查 npm 官方源发现 `dsh-plugin-manager` 已被他人占用（hrhgit 的
   deepseek-harness-plugin-manager@0.1.0），无法以原名发布。

## Decision

1. **包名更名**为 `dsh-plugin-manager-web`（官方源验证可用，非 scoped，发布门槛
   最低；与已占用的 `dsh-web-plugin-manager` 区分度好）。
2. **运行标识与包名解耦**：运行时条目 id、路由前缀、client row id、保护列表、
   Cordis entry name 全部保持 `dsh-plugin-manager` 不变（与 dshmarket 先例一致：
   entry name `dsh-market` ≠ 包名 `dshmarket`）。只有模块解析层改：
   `cordis.patch.yml` 的 insert `name`（loader 按模块名解析安装的包）与
   `package.json#name` 同步为 `dsh-plugin-manager-web`。
3. **发布配置**：`publishConfig.registry` 固定官方源（本机 registry 配置了
   npmmirror 镜像，防止误发镜像）；`prepublishOnly` 挂门禁（发布前 27+ 项检查
   必须全绿）。
4. **门禁增强**：`checkManifest` 新增「patch insert `name` 必须等于
   `package.json#name`」检查——包名与组合层模块名漂移会直接导致挂载失败
   （找不到模块），正是本次改名最容易漏的点，配非法样例自证。
5. **README 净化**：移除本地 link 路径；安装节改为 npm registry 优先 + GitHub
   源备选（pin commit）；标题下注明「npm 包名 / 运行时条目 id」两个标识。
6. 新增决策记录（本文件）与后续更新 README 的 pin commit。

## Alternatives

- **保持 GitHub 源分发**：官方支持（dsh-mcp-manager 即此形态）——拒绝：用户
  明确要 npm 发布；npm 形态 `dsh plugin add` 一行且无 commit 维护成本。
- **scoped 包名 `@wsgsety/dsh-plugin-manager`**：保留原名——拒绝：需要 npm 账号
  持有该 scope（发布权限要求更高），且 scoped 名不如裸名好记。
- **包名改为 `dsh-plugin-manager-ui` 等**：可用但语义弱于 `-web`（本插件定位
  web 设置页插件管理）。

## Consequences

- 对外安装命令变为 `dsh plugin --profile web add dsh-plugin-manager-web`；
  已安装用户（link/GitHub 旧形态）不受影响，重装时才用新名。
- 改名后组合层模块名必须与包名同步——门禁保证（自检用例证明漂移会被拒绝）。
- npm 发布需 npm 账号（`npm login`），门禁在 `prepublishOnly` 自动把关；
  发布内容由 `files` 白名单控制（lib/types、client、cordis.patch.yml、README、
  LICENSE），test/scripts/decisions 不进包。
- README pin 的 GitHub ref 更新到包含改名的新 commit，保证 GitHub 安装路径
  拿到与 npm 一致的产物。
