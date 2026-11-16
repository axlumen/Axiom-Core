import { requestUrl } from "obsidian";
import type { HttpResponse, HttpTransport } from "../core/llm/http-transport";

/** 基于全局 fetch 的传输（Node / 浏览器环境） */
export class FetchTransport implements HttpTransport {
	constructor(private readonly timeoutMs: number = 60_000) {}

	async postJson(
		url: string,
		headers: Record<string, string>,
		body: string
	): Promise<HttpResponse> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body,
				signal: controller.signal,
			});
			return { status: response.status, text: await response.text() };
		} finally {
			clearTimeout(timer);
		}
	}
}

/**
 * 基于 Obsidian requestUrl 的传输。
 *
 * 请求从 Electron 主进程发出，不受渲染进程 CORS 策略限制——这是 Obsidian
 * 插件访问第三方 API 的推荐方式。
 */
export class ObsidianRequestUrlTransport implements HttpTransport {
	constructor(private readonly timeoutMs: number = 60_000) {}

	async postJson(
		url: string,
		headers: Record<string, string>,
		body: string
	): Promise<HttpResponse> {
		const request = requestUrl({
			url,
			method: "POST",
			headers,
			body,
			throw: false,
		});
		const response = await this.withTimeout(request);
		return { status: response.status, text: response.text };
	}

	private withTimeout(
		request: Promise<{ status: number; text: string }>
	): Promise<{ status: number; text: string }> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`LLM 请求超时（${this.timeoutMs}ms）`)),
				this.timeoutMs
			);
			request.then(
				(response) => {
					clearTimeout(timer);
					resolve(response);
				},
				(error: unknown) => {
					clearTimeout(timer);
					reject(error);
				}
			);
		});
	}
}
