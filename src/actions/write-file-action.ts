import type {
	TalosActionDefinition,
} from "../core/action-core/types";
import type { RecoveryFileAdapter } from "../core/task-core/recovery-store";

export interface WriteFileInput {
	/** 相对 Vault 根目录的路径 */
	path: string;
	content: string;
}

/**
 * axiom-write-file：在预先允许的范围内写入一篇 Vault 笔记。
 * 风险等级 B（范围固定、可恢复），文件写入通过注入的适配器完成。
 */
export function createWriteFileAction(
	adapter: RecoveryFileAdapter
): TalosActionDefinition<WriteFileInput> {
	return {
		id: "axiom-write-file",
		label: "写入文件",
		description: "在预先允许的 Wiki 范围内写入一篇笔记，写入前自动建立恢复点。",
		risk: "B",
		readScope: ["00-Inbox/**"],
		writeScope: ["05-Wikis/**"],
		timeoutMs: 15_000,
		cancelable: false,
		reversible: true,
		execute: async (_context, input) => {
			await adapter.write(input.path, input.content);
			return { path: input.path, written: true };
		},
	};
}
