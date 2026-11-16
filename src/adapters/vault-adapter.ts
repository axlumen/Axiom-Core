import type { DataAdapter } from "obsidian";
import type { RecoveryFileAdapter } from "../core/task-core/recovery-store";

/**
 * 基于 Obsidian Vault 文件系统的 RecoveryFileAdapter 实现。
 *
 * 核心层（task-core / action-core）只依赖 RecoveryFileAdapter 接口，
 * 不直接引用 App；由本适配器在边界处桥接 app.vault.adapter（DataAdapter）。
 */
export class ObsidianVaultAdapter implements RecoveryFileAdapter {
	constructor(private readonly adapter: DataAdapter) {}

	async exists(path: string): Promise<boolean> {
		return this.adapter.exists(path);
	}

	async read(path: string): Promise<string> {
		return this.adapter.read(path);
	}

	async write(path: string, value: string): Promise<void> {
		await this.adapter.write(path, value);
	}

	async remove(path: string): Promise<void> {
		await this.adapter.remove(path);
	}
}
