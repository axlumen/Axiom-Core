/**
 * 摄取管道核心逻辑（纯逻辑，不依赖 Obsidian 运行时）。
 *
 * 文件访问通过 IngestSource 端口注入，由 adapters 层桥接 Vault。
 */

import { normalizeVaultPath } from "./paths";

export interface IngestSource {
	/** 列出目录下的文件，返回相对 Vault 根目录的路径 */
	list(dir: string): Promise<string[]>;
	/** 读取相对 Vault 根目录路径的文本内容 */
	read(path: string): Promise<string>;
}

export interface IngestNote {
	path: string;
	content: string;
}

export const INBOX_DIR = "00-Inbox";

function inboxPath(filename: string): string {
	const normalized = normalizeVaultPath(filename);
	return normalized.includes("/") ? normalized : `${INBOX_DIR}/${normalized}`;
}

/** 读取收件箱中的单个笔记（默认 00-Inbox/） */
export async function readInboxNote(
	source: IngestSource,
	filename: string
): Promise<string> {
	return source.read(inboxPath(filename));
}

/** 读取收件箱目录下所有 .md 笔记 */
export async function readInboxMarkdown(
	source: IngestSource,
	dir: string = INBOX_DIR
): Promise<IngestNote[]> {
	const files = await source.list(dir);
	const notes: IngestNote[] = [];
	for (const file of files) {
		if (!file.toLowerCase().endsWith(".md")) continue;
		const path = normalizeVaultPath(file);
		notes.push({ path, content: await source.read(path) });
	}
	return notes;
}

/** 读取收件箱中第一个 Markdown 笔记；目录为空时返回 undefined */
export async function readFirstInboxNote(
	source: IngestSource,
	dir: string = INBOX_DIR
): Promise<IngestNote | undefined> {
	const notes = await readInboxMarkdown(source, dir);
	return notes[0];
}

/** 为编译结果附加抬头 */
export function compileInboxNote(
	content: string,
	header: string = "# 编译测试"
): string {
	return `${header}\n\n${content.trim()}\n`;
}
