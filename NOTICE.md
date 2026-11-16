# NOTICE

This project contains code extracted and adapted from **talos-plugin**.

## Copyright

Original code copyright (c) the talos-plugin authors. All rights reserved.
The extracted files listed below were modified to fit the Axiom-Core directory
layout and integration; such modifications are provided under the same terms as
the original work.

## Extracted / modified files

The following files were copied from `talos-plugin/src/` into `src/core/` and
adapted (directory layout preserved; import paths adjusted where necessary).
They contain no Obsidian runtime dependencies and are pure logic:

| Axiom-Core path | Original path |
| --- | --- |
| `src/core/task-core/task-runner.ts` | `talos-plugin/src/task-core/task-runner.ts` |
| `src/core/task-core/task-store.ts` | `talos-plugin/src/task-core/task-store.ts` |
| `src/core/task-core/recovery-store.ts` | `talos-plugin/src/task-core/recovery-store.ts` |
| `src/core/task-core/types.ts` | `talos-plugin/src/task-core/types.ts` |
| `src/core/action-core/types.ts` | `talos-plugin/src/action-core/types.ts` |
| `src/core/action-core/risk-policy.ts` | `talos-plugin/src/action-core/risk-policy.ts` |
| `src/core/action-core/registry.ts` | `talos-plugin/src/action-core/registry.ts` |

## License

本项目以 **TALOS Personal Use Source License 1.0** 分发，全文见 [LICENSE](LICENSE)，
该许可证文本原样复制自 talos-plugin。

> 提示：`package.json` 的 `license` 字段目前指向 `NOTICE.md`，与 `LICENSE` 文件并存，
> 如需统一可将其改为 `SEE LICENSE IN LICENSE`。
