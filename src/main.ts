import { Notice, Plugin } from "obsidian";
import {
	createWindowTimerHost,
	TalosTaskRunner,
} from "./core/task-core/task-runner";
import { MemoryTaskStore } from "./core/task-core/task-store";
import { VaultRecoveryStore } from "./core/task-core/recovery-store";
import { TalosActionRegistry } from "./core/action-core/registry";
import type { TalosActionDefinition } from "./core/action-core/types";
import { ObsidianVaultAdapter } from "./adapters/vault-adapter";
import { ObsidianIngestSource } from "./adapters/ingest-source";
import { compileInboxNote, readInboxNote } from "./core/ingest-service";
import { createWriteFileAction } from "./actions/write-file-action";

/** 冒烟测试动作：不产生任何文件改动，仅用于验证核心循环接线。 */
const smokeAction: TalosActionDefinition = {
	id: "axiom-smoke-noop",
	label: "空操作（冒烟测试）",
	description: "不产生任何文件改动的占位动作，用于验证任务循环与恢复存储的接线。",
	risk: "A",
	readScope: [],
	writeScope: [],
	timeoutMs: 1000,
	cancelable: false,
	reversible: false,
	execute: async () => null,
};

/** 摄取管道测试用的收件箱文件名（位于 00-Inbox/ 下） */
const INBOX_TEST_FILE = "inbox-test.md";
/** 编译结果输出路径（相对 Vault 根目录） */
const COMPILED_OUTPUT = "05-Wikis/compiled-test.md";

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export default class AxiomCorePlugin extends Plugin {
	private runner!: TalosTaskRunner;

	async onload(): Promise<void> {
		const vaultAdapter = new ObsidianVaultAdapter(this.app.vault.adapter);
		const recoveryStore = new VaultRecoveryStore(vaultAdapter);
		const taskStore = new MemoryTaskStore();
		const registry = new TalosActionRegistry([
			smokeAction,
			createWriteFileAction(vaultAdapter),
		]);
		this.runner = new TalosTaskRunner(
			registry,
			taskStore,
			recoveryStore,
			createWindowTimerHost(window)
		);

		this.addCommand({
			id: "axiom-compile-inbox",
			name: "编译收件箱测试笔记（写入 05-Wikis/compiled-test.md）",
			callback: () => {
				void this.compileInboxTest();
			},
		});

		const task = await this.runner.run({
			actionId: smokeAction.id,
			idempotencyKey: "axiom-core-bootstrap",
			input: null,
			request: { readPaths: [], writePaths: [], effects: [] },
		});
		console.log(`[Axiom Core] 冒烟任务完成：${task.id} 状态=${task.state}`);
		console.log("[Axiom Core] 命令已注册：axiom-compile-inbox");
	}

	/**
	 * 编译收件箱测试笔记：
	 * 读取 00-Inbox/<INBOX_TEST_FILE> → 附编译抬头 → 经任务管线调用 axiom-write-file
	 * 写入 05-Wikis/compiled-test.md。
	 */
	private async compileInboxTest(): Promise<void> {
		const source = new ObsidianIngestSource(this.app.vault.adapter);

		let content: string;
		try {
			content = await readInboxNote(source, INBOX_TEST_FILE);
		} catch (error) {
			new Notice(
				`[Axiom Core] 读取 00-Inbox/${INBOX_TEST_FILE} 失败：${errorMessage(error)}`
			);
			return;
		}

		const compiled = compileInboxNote(content);
		const task = await this.runner.run({
			actionId: "axiom-write-file",
			idempotencyKey: `axiom-compile-inbox-${Date.now()}`,
			input: { path: COMPILED_OUTPUT, content: compiled },
			request: {
				readPaths: [`00-Inbox/${INBOX_TEST_FILE}`],
				writePaths: [COMPILED_OUTPUT],
				effects: ["write"],
			},
		});

		console.log("[Axiom Core] compile-inbox 任务：", task);
		if (task.state === "completed") {
			new Notice(`[Axiom Core] 编译完成：${COMPILED_OUTPUT}`);
		} else {
			new Notice(`[Axiom Core] 任务状态：${task.state}`);
		}
	}
}
