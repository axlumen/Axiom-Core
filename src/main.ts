import { Plugin } from "obsidian";
import {
	createWindowTimerHost,
	TalosTaskRunner,
} from "./core/task-core/task-runner";
import { MemoryTaskStore } from "./core/task-core/task-store";
import { VaultRecoveryStore } from "./core/task-core/recovery-store";
import { TalosActionRegistry } from "./core/action-core/registry";
import type { TalosActionDefinition } from "./core/action-core/types";
import { ObsidianVaultAdapter } from "./adapters/vault-adapter";

/**
 * 冒烟测试动作：不产生任何文件改动，仅用于验证核心循环接线是否通畅。
 */
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

export default class AxiomCorePlugin extends Plugin {
	async onload(): Promise<void> {
		const vaultAdapter = new ObsidianVaultAdapter(this.app.vault.adapter);
		const recoveryStore = new VaultRecoveryStore(vaultAdapter);
		const taskStore = new MemoryTaskStore();
		const registry = new TalosActionRegistry([smokeAction]);
		const runner = new TalosTaskRunner(
			registry,
			taskStore,
			recoveryStore,
			createWindowTimerHost(window)
		);

		const task = await runner.run({
			actionId: smokeAction.id,
			idempotencyKey: "axiom-core-bootstrap",
			input: null,
			request: { readPaths: [], writePaths: [], effects: [] },
		});
		console.log(`[Axiom Core] 冒烟任务完成：${task.id} 状态=${task.state}`);
	}
}
