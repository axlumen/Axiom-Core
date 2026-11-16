import type {
	LlmClient,
	LlmMessage,
	LlmProvider,
} from "../core/llm/compile-service";
import type { HttpTransport } from "../core/llm/http-transport";
import { FetchTransport } from "./http-transport";

export interface LlmClientOptions {
	apiKey: string;
	baseUrl: string;
	model: string;
	provider?: LlmProvider;
	timeoutMs?: number;
	transport?: HttpTransport;
}

/** 按设置创建客户端：provider 为 auto 时依据 Base URL 判断协议 */
export function createLlmClient(options: LlmClientOptions): LlmClient {
	const transport =
		options.transport ?? new FetchTransport(options.timeoutMs ?? 60_000);
	const provider = resolveProvider(options.provider ?? "auto", options.baseUrl);
	return provider === "anthropic"
		? new AnthropicLlmClient(options, transport)
		: new OpenAiCompatibleLlmClient(options, transport);
}

function resolveProvider(
	provider: LlmProvider,
	baseUrl: string
): "openai" | "anthropic" {
	if (provider !== "auto") return provider;
	return /anthropic/i.test(baseUrl) ? "anthropic" : "openai";
}

/** OpenAI 兼容格式：POST <baseUrl>/chat/completions */
export class OpenAiCompatibleLlmClient implements LlmClient {
	private readonly endpoint: string;

	constructor(
		private readonly options: LlmClientOptions,
		private readonly transport: HttpTransport
	) {
		const base = options.baseUrl.trim().replace(/\/+$/, "");
		this.endpoint = `${base}/chat/completions`;
	}

	async chat(messages: LlmMessage[]): Promise<string> {
		this.assertApiKey();
		const { status, text } = await this.transport.postJson(
			this.endpoint,
			{
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.options.apiKey}`,
			},
			JSON.stringify({
				model: this.options.model,
				messages,
				temperature: 0.3,
			})
		);
		if (status < 200 || status >= 300) {
			throw new Error(`LLM 请求失败（HTTP ${status}）：${text.slice(0, 500)}`);
		}
		const content = extractOpenAiContent(text);
		if (content === undefined) {
			throw new Error(`LLM 返回中没有 content：${text.slice(0, 300)}`);
		}
		return content;
	}

	private assertApiKey(): void {
		if (!this.options.apiKey.trim()) {
			throw new Error("未配置 API Key");
		}
	}
}

function extractOpenAiContent(text: string): string | undefined {
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (!payload || typeof payload !== "object") return undefined;
	const choices = (payload as { choices?: unknown }).choices;
	if (!Array.isArray(choices) || choices.length === 0) return undefined;
	const first = choices[0] as { message?: { content?: unknown } };
	const content = first?.message?.content;
	return typeof content === "string" ? content : undefined;
}

/** Anthropic 格式：POST <baseUrl>/v1/messages */
export class AnthropicLlmClient implements LlmClient {
	private readonly endpoint: string;

	constructor(
		private readonly options: LlmClientOptions,
		private readonly transport: HttpTransport
	) {
		const base = options.baseUrl.trim().replace(/\/+$/, "");
		this.endpoint = /\/v\d+\/messages$/.test(base)
			? base
			: `${base}/v1/messages`;
	}

	async chat(messages: LlmMessage[]): Promise<string> {
		this.assertApiKey();
		const system = messages
			.filter((message) => message.role === "system")
			.map((message) => message.content)
			.join("\n\n");
		const conversation = messages
			.filter((message) => message.role !== "system")
			.map((message) => ({ role: message.role, content: message.content }));

		const { status, text } = await this.transport.postJson(
			this.endpoint,
			{
				"content-type": "application/json",
				"x-api-key": this.options.apiKey,
				"anthropic-version": "2023-06-01",
			},
			JSON.stringify({
				model: this.options.model,
				max_tokens: 4096,
				...(system ? { system } : {}),
				messages: conversation,
			})
		);
		if (status < 200 || status >= 300) {
			throw new Error(`LLM 请求失败（HTTP ${status}）：${text.slice(0, 500)}`);
		}
		return extractAnthropicText(text);
	}

	private assertApiKey(): void {
		if (!this.options.apiKey.trim()) {
			throw new Error("未配置 API Key");
		}
	}
}

function extractAnthropicText(text: string): string {
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		throw new Error(`LLM 返回非 JSON：${text.slice(0, 300)}`);
	}
	if (!payload || typeof payload !== "object") {
		throw new Error(`LLM 返回中没有 content：${text.slice(0, 300)}`);
	}
	const content = (payload as { content?: unknown }).content;
	if (!Array.isArray(content)) {
		throw new Error(`LLM 返回中没有 content：${text.slice(0, 300)}`);
	}
	const joined = content
		.map((item) => {
			if (
				item &&
				typeof item === "object" &&
				typeof (item as { text?: unknown }).text === "string"
			) {
				return (item as { text: string }).text;
			}
			return "";
		})
		.join("")
		.trim();
	if (!joined) {
		throw new Error(`LLM 返回中没有文本：${text.slice(0, 300)}`);
	}
	return joined;
}
