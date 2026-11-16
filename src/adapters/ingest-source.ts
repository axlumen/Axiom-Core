import type { DataAdapter } from "obsidian";
import type { IngestSource } from "../core/ingest-service";
import { normalizeVaultPath } from "../core/paths";

/** 基于 Obsidian Vault 文件系统的 IngestSource 实现 */
export class ObsidianIngestSource implements IngestSource {
	constructor(private readonly adapter: DataAdapter) {}

	async list(dir: string): Promise<string[]> {
		const result = await this.adapter.list(normalizeVaultPath(dir));
		return result.files;
	}

	async read(path: string): Promise<string> {
		return this.adapter.read(normalizeVaultPath(path));
	}
}
