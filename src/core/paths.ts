/**
 * Vault 相对路径规范化。
 *
 * 所有传给 `app.vault.adapter` 的路径都应经过这里，统一为：
 * - 使用 `/` 作为分隔符
 * - 不带开头的 `/`、也不带盘符（如 `C:`）
 * - 不含空片段与 `.`，`..` 就近消解
 */
export function normalizeVaultPath(path: string): string {
	const slashed = path.trim().replace(/\\/g, "/");
	const withoutDrive = slashed.replace(/^[a-zA-Z]:/, "");
	const segments: string[] = [];
	for (const segment of withoutDrive.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments.join("/");
}
