# DeepSeek Harness rc.5 compatibility

日期：2026-10-31。插件版本：0.1.3。目标宿主：官方 `0.2.1-rc.5`（npm latest/next）。

## 变更 / Changes

公开上一版本的精确 `engines.dsh` 范围不包含 rc.4/rc.5；本次为它们增加显式支持，同时同步 DSH peers、锁文件、显示版本及分发说明。保持现有数据格式和产品界面，其他迁移分支不在本次范围。

Add explicit rc.4/rc.5 support to the existing host/peer ranges and synchronize the lockfile and published version. Existing data formats and UI are preserved.

## 上游核对

已核对 [rc.3 → rc.5 官方变更](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.2.1-rc.3...dsh-v0.2.1-rc.5) 和 [推理 Slot 迁移指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/guide.md)。本插件不替换 `conversation.chat.reasoning.body`，无需 rawText 迁移。

## 验证

- `npm ci`、项目 `npm run check` 及 `npm pack --json` 通过。
- 固定 dsh-plugin-health 0.5.0 检查 9 个插件 × rc.3/rc.4/rc.5：27 项声明判断通过，无豁免。声明判断不代替运行验证。
- 官方 rc.5 CLI 正常安装预构建 tgz，无版本豁免；全新 Web profile 启动，九包逐文件摘要与候选一致。
- 本轮实际操作：实际打开灵感图库、UI 词典和“文本乱序”词条详情及交互标本。未复测全部词条、导出与复习。
- 本轮维护更新只涉及兼容声明、版本显示与文档，不改变持久化格式。以上是指定核心路径的回归，不代表所有功能端到端验收。

## 边界与恢复

0.2.2-alpha.2 有独立的工具、会话投影及 Node 24.9 要求，本轮不声明支持。rc.4/旧版本保留声明，不等于本轮逐版本运行回归。Windows/Linux、手机及外部凭证服务未在本轮验收。更新保留数据，回退使用前一公开 Release tgz。
