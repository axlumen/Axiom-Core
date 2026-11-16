/**
 * HTTP 传输端口。
 *
 * LLM 客户端只依赖这个接口，具体传输方式（全局 fetch 或 Obsidian requestUrl）
 * 由 adapters 层注入，因此客户端逻辑保持纯净、可复用。
 */

export interface HttpResponse {
	status: number;
	text: string;
}

export interface HttpTransport {
	postJson(
		url: string,
		headers: Record<string, string>,
		body: string
	): Promise<HttpResponse>;
}
