# Axiom Core

轻量 Obsidian 插件核心：agent 任务循环、工具管线、从收件箱（Inbox）到 Wiki 的摄取管道。

## 开发与测试指南

### 构建

```bash
npm install
npm run build      # tsc 类型检查 + esbuild 打包，产出 main.js
npm run dev        # watch 模式，改代码自动重建 main.js
```

> `main.js` 与 `node_modules` 已被 `.gitignore` 忽略，不入库；换机器后需重新构建。

### 安装到 Obsidian

1. 找到仓库路径：Obsidian → 设置 → 关于 → 仓库路径（或在文件管理器搜索 `.obsidian` 目录）。
2. 创建目录 `<仓库>/.obsidian/plugins/axiom-core/`，放入两个文件：
   - `main.js`（构建产物）
   - `manifest.json`
3. 重启 Obsidian，或按 `Ctrl+R` 重新加载。
4. 设置 → 第三方插件 → 确认已关闭安全模式 → 启用 **Axiom Core**。

目录名必须与 manifest 的 `id`（`axiom-core`）一致。

### 测试编译命令

1. 在仓库根目录创建 `00-Inbox/inbox-test.md`，写入任意内容。
2. `Ctrl+P` 打开命令面板 → 输入 `编译收件箱测试笔记` → 回车。
3. 预期结果：右下角 Notice 提示编译完成，并生成 `05-Wikis/compiled-test.md`，
   内容为 `# 编译测试` + 空行 + 原文。

### 排错

- `Ctrl+Shift+I` 打开开发者工具 Console，过滤 `[Axiom Core]` 查看任务日志。
- 提示读取失败：确认文件名精确为 `inbox-test.md`（大小写、扩展名）。
- 命令不存在：插件未启用，或 `main.js` 是旧构建——重新 `npm run build` 并复制。

## 未来重构项

- **拆分读/写动作**：当前 `axiom-write-file` 的 `readScope` 放宽到了 `00-Inbox/**`，
  因为编译任务需要先读收件箱。这让「写文件」动作获得了本不需要的读取权限。
  后续应把「读取收件箱」与「写入 Wiki」拆成两个动作，由任务管线编排，
  使每个动作的声明范围（scope）最小化。
