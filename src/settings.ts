import { PluginSettingTab, Setting } from "obsidian";
import type AxiomCorePlugin from "./main";
import type { LlmProvider } from "./core/llm/compile-service";

export interface AxiomSettings {
	apiKey: string;
	baseUrl: string;
	model: string;
	provider: LlmProvider;
}

export const DEFAULT_SETTINGS: AxiomSettings = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	model: "deepseek-chat",
	provider: "auto",
};

/** 插件设置面板：API Key / Base URL / Model Name */
export class AxiomSettingsTab extends PluginSettingTab {
	plugin: AxiomCorePlugin;

	constructor(plugin: AxiomCorePlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Axiom Core 设置" });

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("大模型 API 密钥（DeepSeek / OpenAI / Anthropic 兼容服务）")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc(
				"API 接口地址，如 https://api.deepseek.com 或 https://api.openai.com/v1"
			)
			.addText((text) =>
				text
					.setPlaceholder("https://api.deepseek.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model Name")
			.setDesc("模型名称，如 deepseek-chat / gpt-4o-mini")
			.addText((text) =>
				text
					.setPlaceholder("deepseek-chat")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("协议（Provider）")
			.setDesc("auto 会依据 Base URL 自动判断；也可显式指定")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", "自动识别")
					.addOption("openai", "OpenAI 兼容")
					.addOption("anthropic", "Anthropic")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value as LlmProvider;
						await this.plugin.saveSettings();
					})
			);
	}
}
