# 乔木 UI 学习 DSH 适配

源仓库 https://github.com/joeseesun/qiaomu-ui-learn，冻结基线 `21d0d8e2f81bf8ef9128991cd2e6d35bba3d6233`。不修改原插件工作区及未提交内容。

目标 DSH 0.2.1-rc.3。客户端使用原生 main / sidebar.panellist Slot，Host Remote 持久化，直接复用原版 UI；仅 DOM 容器、弹窗、图标和文件 API 接入 Harness，不加载 Obsidian 运行时。

验收记录将在本目录追加。

## 完整功能对照（2026-10-27，发布候选）

本表以冻结来源代码为基线；“已实现”不等于全部端到端已验证。不得将待迁移项改写为不支持后发布精简版。

| 能力 | 原始证据 | DSH 等价行为 | 当前状态 |
| --- | --- | --- | --- |
| 设计图库 | catalog.ts、gallery-view.ts、cat-zh.ts | 13561 条、184 分类、中英检索、类型/密度/最近/收藏/评价筛选 | 已实现；中文“仪表盘”匹配 381 项、英文 Approva 匹配 1 项，分类与密度切换实测通过 |
| 收藏夹 | collections.ts | 新建、改名、删除、成员切换、原数据导入 | 已实现；新建、成员保存、改名及删除实测通过 |
| 完整词典与风格 | learn-entry-modal.ts、learn-style-modal.ts | 106 个原标本、全部描述/API/部件/调试与实现提示词/关联条目 | 已实现；212 个中英详情静态渲染通过，Tabs 交互实测通过 |
| 风格对比 | learn-style-modal.ts | 原版易混淆说明、关联风格跳转、来源、可访问性、代码 | 已实现；关联风格跳转与 sandbox 标本自动检查通过。原版没有并排比较器 |
| 复习测验 | learn-quiz.ts | 混合/组件/风格、四选一、2 连对掌握、15% 复习、最近4题避免重复、键盘、重置 | 已实现；算法测试与答题保存实测通过，数字键作答与 Enter 换题通过，重启后 quizState 保留 |
| 学习记录 | learn-review.ts | 星级、标签、评论自动保存、逐篇/批量 Markdown | 已实现；评分/标签/评论与单篇写文件实测通过，原版设置页批量导出 1 篇已实测 |
| 参考设计详情 | design-modal.ts、replicate.ts | 灯箱前后切换、交互预览、原站、复制图片/Markdown/提示词/源码 | 已实现；源码失败/限额自动测试及真实下载通过，复制 Markdown 核对剪贴板，方向键切换实测通过 |
| 笔记工作流 | learn-review.ts、settings.ts | Host Markdown 目录、浏览、新建、读取、光标插入、冲突保护 | 已实现；插入、保存、草稿正文和文件名跨面板恢复后保存实测通过 |
| 设置与数据 | main.ts、settings.ts | 默认页、点击动作、技术栈、源码、目录、密度、统计、清理、JSON导入备份 | 已实现；原格式迁移测试与 UI 导出、导入前备份、恢复实测通过 |
| Home 联动 | home.ts | 最近设计、浏览入口、全局搜索 | 已实现；组件库添加、搜索打开原版详情、最近设计卡片返回详情已实测；需支持 provider v1 的 Home 版本 |
| 命令入口 | main.ts | 打开图库/词典/风格/测验、导出学习记录 | 5 个 Harness 原生快捷操作已注册并在设置可见；自定义快捷键从其他插件切回词典实测通过 |
| 主题与键盘 | styles.css、gallery-view.ts、design-modal.ts | 亮暗、窄屏、焦点、搜索/灯箱/答题快捷键 | 原版亮色/深色与 720px 窗口已截图；无横向溢出，标本加载成功；方向键切换及 Esc 关闭后焦点返回设计卡片通过 |

## UI 迁移硬约束（用户 2026-10-27 明确要求）

尽可能直接复用 Obsidian 原版的布局、CSS、组件、图标、交互和设置界面，不自行重新设计。只改宿主 API、必要的容器与主题变量映射；不得以换宿主为理由重画 UI 或删减功能。逐项对照原版截图与真实交互验收。

## 原版 UI 验收记录

- 来源：上方冻结 SHA；运行 UI 为 src/original-ui，不是重画的 React 页面。原 styles.css SHA-256：`8e50e843e7ec3a9099265f19f61e12f939c45d77930d51d5fd9fd979d92260b7`，自动检查一致。
- 当前 `npm run check`：15 项通过，含原版 106 详情中英双语实际 DOM 挂载、原版测验/点评逻辑、数据迁移、保存冲突、真实 Markdown 文件路径保护；构建与包入口检查通过。
- 运行：DSH 0.2.1-rc.3，独立 ports-qa profile，端口 4382；测试包 /tmp/qport-candidates-r9/qiaomu-ui-learn-dsh-0.1.0.tgz。未更新日用 profile。
- 原版视图真实验收：图库、词典、详情、测验、设置；旧 5 星/标签/笔记读回，编辑落盘，设置页批量导出；宿主重启后 state.json revision 10 保留点评和 2 项测验记录。
- 命令：5 个操作在宿主快捷键设置可见；测试 profile 配置的 Option+Shift+Command+U 可从封面插件切换并打开词典。
- 截图：screenshots/original-gallery.png、original-dictionary.png、original-quiz.png、original-dictionary-dark.png、original-dictionary-narrow.png。720px 视口，文档 scrollWidth 为 720px，未横向溢出。
- 后续候选 r14：Home 最近设计卡片、组件库添加、全局搜索跳转已实测；复制 Markdown 后核对系统剪贴板，真实参考 HTML 下载成功（38,105 字符）。收藏夹新建/改名/删除、JSON 下载/导入前备份/恢复、笔记草稿正文与文件名跨面板恢复后保存通过。
- 自动检查现为 18 项通过。Windows/Linux 尚未实机验证；公开 Release 下载与日用安装将在发布后独立记录。原站网络可用性取决于外部服务。其他插件的发布状态不包含在本项目验收中。
