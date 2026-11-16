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
import { createLlmClient } from "./adapters/llm-client";
import { ObsidianRequestUrlTransport } from "./adapters/http-transport";
import {
	compileInboxNote,
	INBOX_DIR,
	readFirstInboxNote,
} from "./core/ingest-service";
import type { IngestNote } from "./core/ingest-service";
import { smartCompileInboxNote } from "./core/llm/compile-service";
import { createWriteFileAction } from "./actions/write-file-action";
import { AxiomSettingsTab, DEFAULT_SETTINGS } from "./settings";
import type { AxiomSettings } from "./settings";

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

const COMPILED_OUTPUT = "05-Wikis/compiled-test.md";
const SMART_COMPILED_OUTPUT = "05-Wikis/compiled-smart.md";

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export default class AxiomCorePlugin extends Plugin {
	private runner!: TalosTaskRunner;
	settings!: AxiomSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

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

		this.addSettingTab(new AxiomSettingsTab(this));

		this.addCommand({
			id: "axiom-compile-inbox",
			name: "编译收件箱笔记（原样写入 05-Wikis/compiled-test.md）",
			callback: () => {
				void this.compileInboxTest();
			},
		});

		this.addCommand({
			id: "axiom-smart-compile",
			name: "智能编译收件箱笔记（LLM 改写，写入 05-Wikis/compiled-smart.md）",
			callback: () => {
				void this.smartCompile();
			},
		});

		const task = await this.runner.run({
			actionId: smokeAction.id,
			idempotencyKey: "axiom-core-bootstrap",
			input: null,
			request: { readPaths: [], writePaths: [], effects: [] },
		});
		console.log(`[Axiom Core] 冒烟任务完成：${task.id} 状态=${task.state}`);
		console.log("[Axiom Core] 命令已注册：axiom-compile-inbox / axiom-smart-compile");
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** 扫描收件箱并返回第一个 .md 笔记；目录为空或读取失败时返回 null 并已提示 */
	private async readFirstInboxNoteOrNotify(): Promise<IngestNote | null> {
		const source = new ObsidianIngestSource(this.app.vault.adapter);
		try {
			const note = await readFirstInboxNote(source, INBOX_DIR);
			if (!note) {
				new Notice(`${INBOX_DIR}/ 为空，请放入 Markdown 文件`);
				return null;
			}
			return note;
		} catch (error) {
			new Notice(
				`[Axiom Core] 读取 ${INBOX_DIR}/ 失败：${errorMessage(error)}`
			);
			return null;
		}
	}

	/** 原样编译：读取 → 附抬头 → 写入 */
	private async compileInboxTest(): Promise<void> {
		const note = await this.readFirstInboxNoteOrNotify();
		if (!note) return;
		await this.writeCompiled(note.path, compileInboxNote(note.content));
	}

	/** 智能编译：读取 → 调用 LLM 改写 → 经任务管线写入 */
	private async smartCompile(): Promise<void> {
		const note = await this.readFirstInboxNoteOrNotify();
		if (!note) return;

		const { apiKey, baseUrl, model } = this.settings;
		if (!apiKey.trim()) {
			new Notice("[Axiom Core] 请先在「设置 → Axiom Core」中填写 API Key");
			return;
		}

		const llm = createLlmClient({
			apiKey,
			baseUrl,
			model,
			provider: this.settings.provider,
			transport: new ObsidianRequestUrlTransport(60_000),
		});
		let compiled: string;
		try {
			compiled = await smartCompileInboxNote(note.content, llm);
		} catch (error) {
			new Notice(`[Axiom Core] LLM 编译失败：${errorMessage(error)}`);
			return;
		}

		await this.writeCompiled(note.path, compiled, SMART_COMPILED_OUTPUT);
	}

	/** 通过 axiom-write-file 动作把内容写入 Wiki */
	private async writeCompiled(
		sourcePath: string,
		content: string,
		output: string = COMPILED_OUTPUT
	): Promise<void> {
		const task = await this.runner.run({
			actionId: "axiom-write-file",
			idempotencyKey: `axiom-write-${output}-${Date.now()}`,
			input: { path: output, content },
			request: {
				readPaths: [sourcePath],
				writePaths: [output],
				effects: ["write"],
			},
		});
		console.log("[Axiom Core] 写入任务：", task);
		if (task.state === "completed") {
			new Notice(`[Axiom Core] 编译完成：${output}（来源：${sourcePath}）`);
		} else {
			new Notice(`[Axiom Core] 任务状态：${task.state}`);
		}
	}
}
