/**
 * LLM 编译核心逻辑（纯逻辑，不依赖 Obsidian 运行时，也不直接发请求）。
 *
 * 大模型访问通过 LlmClient 端口注入，由 adapters 层的 llm-client 实现。
 */

export interface LlmMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface LlmClient {
	chat(messages: LlmMessage[]): Promise<string>;
}

/** auto 表示依据 Base URL 自动判断 */
export type LlmProvider = "auto" | "openai" | "anthropic";

export const LLM_SYSTEM_PROMPT =
	"你是一个知识库助手。请阅读以下收件箱笔记，提炼核心内容，将其改写为结构化、带有适当标题的 Markdown 知识卡片。保留关键信息，去除冗余口语。";

/**
 * 把收件箱笔记交给大模型，改写为结构化 Markdown 知识卡片。
 * 只负责提示词编排与结果清洗，不关心 HTTP 细节。
 */
export async function smartCompileInboxNote(
	content: string,
	llm: LlmClient
): Promise<string> {
	const raw = await llm.chat([
		{ role: "system", content: LLM_SYSTEM_PROMPT },
		{ role: "user", content },
	]);
	return raw.trim().replace(/\n{3,}/g, "\n\n") + "\n";
}
