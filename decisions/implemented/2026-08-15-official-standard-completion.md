# 决策记录：补全官方标准形态（types / 门禁 / 决策记录 / 安装 pin）

- 日期：2026-08-15
- 状态：implemented

## Problem

对照官方契约（[publish.md](https://github.com/deepseek-ai/deepseek-harness/blob/HEAD/docs/user/develop/basic/publish.md) 与
make-dsh-plugin 的 bundle/entry 契约）审计确认：插件的功能形态已满足 0811 标准并
实机运行正常，但缺四块发布/工程配套，与同生态参考实现（dshmarket、dsh-find-plugin）
差一档：

1. 无 `types` 类型声明——TS 消费者无任何提示。
2. 无门禁脚本——语法、manifest 契约、测试没有一条命令的机械检查。
3. 无决策记录目录——非平凡改动的取舍不可追溯。
4. GitHub 安装说明未 pin commit——安装不可复现。

## Decision

1. **类型声明**：新增 `lib/types/*.d.ts`（`index` / `routes` / `entries` / `patch` /
   `util` 五份，按 dshmarket 的结构化风格：入口 entry 类型 + 服务接口 + 数据行类型），
   `package.json` 增加 `types` 字段，`exports["."]` 改为条件导出
   `{ types, default }`。类型与实现分离，纯手写、不引入构建链。
2. **门禁**：新增 `scripts/gates/run.mjs`，四组检查可按改动面选择最窄证据：
   - `--syntax`：所有 JS/MJS 源文件 `node --check`；
   - `--manifest`：package.json 对照 DSH bundle 契约逐项验证（main/exports 指向
     真实文件、`dsh.bundle.patch`、`dsh.client.platform: "web"`、cordis peerDependency、
     `files` 存在性、homepage URL、patch 层含 insert 行）；
   - `--tests`：直接以 node 跑 `test/*.test.mjs`（不依赖 npm 命令）；
   - `--self-test`：非法样例自证——在临时目录构造 9 种坏包断言检查拒绝、真实包
     断言通过，防止门禁本身悄悄失效。
   `package.json#scripts.gate` 一键运行全量。
3. **决策记录**：新增 `decisions/implemented/` 目录，本文件为首篇记录；后续每个
   非平凡改动沿用（problem → decision → alternatives → consequences）。
4. **安装 pin**：`package.json` 增加 `homepage` 字段；README 的 GitHub 安装命令
   pin 到具体 commit（新提交后更新 pin，保证安装可复现）。

## Alternatives

- **不做 types**：纯 JS 可运行，零成本——拒绝：TS 消费者零提示，且 `exports["."]`
  条件导出是官方样例（dshmarket/dsh-find-plugin）的标配。
- **全量迁移 TypeScript + tsup/tsc 构建**：获得编译期类型验证——拒绝：项目刻意
  保持零构建（client.js 手写产物，改动即生效，改完重启即用）；引入构建链违背
  项目当前形态，收益不成比例。
- **门禁只并入 `package.json#scripts`**：零新文件——拒绝：无法做非法样例自证与
  结构化输出；`scripts.test` 保留原样，gate 在其上聚合。
- **决策记录用 CHANGELOG 代替**：拒绝：CHANGELOG 记版本变更，决策记录记取舍
  （含被否方案），两者职责不同。

## Consequences

- TS 消费者获得完整类型提示（含 `ToggleResult`/`ToggleError` 错误分支、`LoaderEntry`
  最小面）；改公共 API 需同步 d.ts——门禁 manifest 检查保证 types 文件存在，但
  不做类型级验证（未引入 tsc），API 漂移靠 review。
- 门禁一条命令全量验证（26 项检查），CI/本地开发共用；自检保证门禁拒绝逻辑
  不失效。
- 决策历史可追溯，后续改动沿用本模板。
- README pin commit 后安装可复现；副作用是每次发布需同步 pin（仓库维护惯例，
  已写入 README 注释）。
