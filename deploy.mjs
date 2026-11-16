#!/usr/bin/env node
/**
 * 部署脚本：构建插件并复制到 Obsidian 仓库的 plugins 目录。
 *
 * 用法：
 *   node deploy.mjs                 # 使用默认目标路径
 *   node deploy.mjs <目标目录>      # 自定义目标路径
 */
import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const DEFAULT_TARGET = "E:/文档/Obsidian/.obsidian/plugins/axiom-core";
const FILES = ["main.js", "manifest.json"];

const root = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? DEFAULT_TARGET);

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: root,
		stdio: "inherit",
		shell: true,
	});
	if (result.status !== 0) {
		console.error(`\n[deploy] 命令失败：${command} ${args.join(" ")}`);
		process.exit(result.status ?? 1);
	}
}

async function main() {
	console.log(`[deploy] 项目目录：${root}`);
	console.log("[deploy] 构建中……");
	run("npm", ["run", "build"]);

	await mkdir(target, { recursive: true });
	for (const file of FILES) {
		await rm(join(target, file), { force: true });
	}
	for (const file of FILES) {
		await cp(join(root, file), join(target, file));
	}

	console.log(`[deploy] 已部署到：${target}`);
	for (const file of FILES) console.log(`         - ${file}`);
	console.log("[deploy] 请在 Obsidian 中按 Ctrl+R 重新加载，或重启 Obsidian。");
}

main().catch((error) => {
	console.error("[deploy] 部署失败：", error);
	process.exit(1);
});
