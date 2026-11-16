# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质

轻量 Obsidian 插件核心（id `axiom-core`）：agent 任务循环 + 工具管线 + 收件箱（Inbox）→ Wiki 的摄取管道。核心逻辑（`src/core/`）提取自 **talos-plugin**，采用 TALOS Personal Use Source License 1.0；修改/新增文件沿用同一许可，见 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。**改动 `src/core/` 与 `src/core/action-core/` 时注意：这些文件源自上游，优先保持纯逻辑、不引入 Obsidian 运行时依赖。**

## 常用命令

```bash
npm install
npm run build      # tsc --noEmit 类型检查 + esbuild 生产打包 → main.js
npm run dev        # esbuild watch 模式（无类型检查），改代码自动重建
npm run deploy     # 先 build，再把 main.js + manifest.json 复制到 Obsidian 插件目录
```

- **没有测试框架，也没有 lint**。验证手段是 `npm run build` 的类型检查，以及在 Obsidian 里手动跑命令（见下方「验收」）。
- 打包格式为 **CJS**（`main.js`），`obsidian`、`electron`、CodeMirror/Lezer 系列与 Node builtin 全部为 `external`，不要打进 bundle。
- `main.js` 已 gitignore；换机器或克隆后必须先 `npm run build` 再 `deploy`。

### 部署目标

`deploy.mjs` 默认目标 `E:/文档/Obsidian/.obsidian/plugins/axiom-core`，可用 `node deploy.mjs <目标目录>` 覆盖。插件目录名必须等于 `manifest.json` 的 `id`（`axiom-core`），否则 Obsidian 不识别。

### 验收（唯一的手动测试路径）

1. 在 Vault 根建 `00-Inbox/inbox-test.md`，写入任意内容。
2. `Ctrl+P` → 运行命令 `编译收件箱测试笔记`。
3. 预期 Notice 提示完成，生成 `05-Wikis/compiled-test.md`，内容为 `# 编译测试` + 空行 + 原文。

日志统一走 `console.log`，在 Obsidian 开发者工具 Console 过滤 `[Axiom Core]`。

## 架构

### 分层与依赖方向

```
main.ts  ── 组装/接线（Plugin 生命周期、命令注册、Notice）
  ├─ adapters/         Obsidian 边界适配器（实现 core 定义的端口接口）
  ├─ actions/          具体动作定义（工厂函数，注入适配器）
  └─ core/
       ├─ task-core/    任务状态机 + 存储 + 恢复点（纯逻辑）
       ├─ action-core/  动作定义类型 + 注册表 + 风险策略（纯逻辑）
       └─ ingest-service.ts  摄取管道纯逻辑（IngestSource 端口）
```

**依赖只能从外向内**：`adapters/` 与 `actions/` 依赖 `core/`，`core/` 绝不 import `obsidian`。`core/` 只通过端口接口（`RecoveryFileAdapter`、`IngestSource`）访问文件系统，由 `adapters/` 桥接 `app.vault.adapter`。新增文件访问能力时，先在 core 定义接口、在 adapters 实现，不要在 core 里直接引用 `DataAdapter`。

### 任务执行模型（TalosTaskRunner）

- **幂等**：`run()` 先按 `idempotencyKey` 查 `MemoryTaskStore`，命中则直接返回既有任务，不重复执行。
- **状态机**：`ready → queued → running → completed/partial/failed`，`completed|partial|failed → reverted`；`queued|running → cancelled`。转换规则硬编码在 `task-store.ts` 的 `TRANSITIONS`，非法转换抛错。
- **风险决策前置**：`evaluateActionRisk(definition, request)` 在创建任务时求值。返回 `propose` 时任务停在 `ready`（`approvalRequired=true`），**不会执行**；`allow` 直接执行；`snapshot-and-run` 先建恢复点再执行。
- **执行期**：`executeWithTimeout` 用注入的 `TaskTimerHost`（默认 `window` 定时器）做超时；`cancelable` 动作由 `AbortController` 中止；恢复点在 `snapshot-and-run` 或动作 `reversible` 时捕获。
- **结果契约**：动作返回值若是 `{taskOutcome:"completed"|"partial", version:1, changes:[...]}` 则被识别为结构化结果；否则整个返回值作为 `result`、`changes` 记为空。`partial` 必须带 `error` 字符串与 `changes` 数组。

### 风险策略（risk-policy）

风险等级决定默认放行边界，**scope 匹配是安全边界**：

- `A`：只读。不得声明 `writeScope`，也不得请求写入或任何非 read 影响，否则 `propose`。
- `B`：可恢复的固定范围写入。**必须** `reversible` 且声明非空 `writeScope`，决策为 `snapshot-and-run`。
- `C`：一律 `propose`（必须人工提案）。
- 高风险影响（`delete`/`move`/`external-publish`/`shell`）、`touchesIdentity`、`touchesTopLevelStructure` 任一为真 → `propose`。
- 读/写路径超出动作声明 scope，或含不安全路径语法（绝对路径、盘符、`..`、`.`、空段、`\0`）→ `propose`。

新增动作时先在 `registry.register()` 通过 `validateActionDefinition`：A 类无 writeScope，B 类必 reversible + writeScope，C 类必 writeScope，timeoutMs 为正数。

### 恢复点（VaultRecoveryStore）

写入前对 `request.writePaths` 逐个快照（存在则存内容，不存在则记为「新建」），`restore` 逆序回滚：存在过的写回原内容，原本不存在的删除。**显式禁止 `.talos/private` 路径**（防止恢复逻辑读到私有数据）；路径同样经过 `recoveryPath` 安全校验。快照存于内存，**重启即失效**——当前 revert 能力仅限会话内。

### 当前已知耦合（重构项）

`axiom-write-file` 的 `readScope` 被放宽到 `00-Inbox/**`，因为编译任务需要先读收件箱再写 Wiki。这让「写文件」动作持有了本不需要的读权限。README 记录的后续方向是拆成「读收件箱」与「写 Wiki」两个动作，由管线编排，使每个动作 scope 最小化。

## 约定

- 源码用中文注释与中文 UI 文案（Notice、命令名），保持风格一致。
- 日志前缀统一 `[Axiom Core]`。
- 构建产物 `main.js` 不入库；提交只针对 `src/`、配置与文档。
- 仓库处于早期阶段（v0.1.0），无自动化测试，改动后至少跑 `npm run build` 并按「验收」步骤实测。
