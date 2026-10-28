# DeepSeek Harness rc3 验证记录

日期：2026-10-28。插件：`qiaomu-ui-learn-dsh@0.1.2`。宿主：官方 macOS DeepSeek Harness **0.2.1-rc.3**，使用应用内自带 CLI 和 runtime。

## 本次变更

更新前 main 的 manifest 已被 rc3 官方兼容性检查接受；本次是显式声明与依赖范围对齐及 rc3 验收维护更新，不将它描述为已复现的安装拒绝。

- `engines.dsh`：`0.2.1-rc.3`。
- 本包声明的 `@deepseek-ai/dsh*` peer 版本与宿主范围一致；版本号与锁文件同步。
- 原版适配层显示版本改为读取本包 `package.json`，避免更新后仍展示旧版号。
- 保持现有产品功能、样式与数据协议；不合并另行开发中的完整迁移分支。

## 已验证

- `npm ci`、`npm run check`（构建、现有测试及包结构检查）通过。
- 通过官方 rc3 兼容性评估器，正常 `dsh plugin ... add` 安装预构建 tgz，无 `allow-version` 豁免。
- 使用新建 `DSH_HOME` 和独立测试 profile 启动 rc3，完成以下 UI 操作：灵感图库加载；切换 UI 词典，显示 62 个组件及详情入口。
- 截图及本机检查日志保留于本次 QA 目录；不包含用户的日常 profile 或凭证。

## 验证边界

上述是 rc3 的安装、启动及核心页面操作验收，不代表所有功能的端到端回归。Windows/Linux、移动端、此前宿主版本未在本轮重新验收；真实模型响应、外部发布和需凭证的服务也未验收。保留的 rc2 声明不是本轮 rc2 运行证据。

## 安装发布包

从 [v0.1.2 Release](https://github.com/joeseesun/qiaomu-ui-learn-dsh/releases/tag/v0.1.2) 下载预构建 `.tgz` 和 `SHA256SUMS`：

```bash
shasum -a 256 -c SHA256SUMS
dsh plugin --profile desktop add /absolute/path/qiaomu-ui-learn-dsh-0.1.2.tgz
```

Web 用户使用 `--profile web`。更新后重载对应 profile，保留既有数据；无需强制忽略版本校验。

## 官方规则

rc3 优先使用 `engines.dsh`；仅当其缺失时回退检查 DSH peer dependencies，semver 使用 `includePrerelease: true`。因此不能仅凭 peer 与宿主字面版本不同断定加载失败。

来源：[rc3 官方兼容性实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/boot/app-boot/src/plugin-compatibility.ts)。
