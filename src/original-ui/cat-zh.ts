// Chinese names for the gallery categories (keyed by catalog slug), shown as
// hover hints so the English taxonomy doubles as a vocabulary lesson.
import { lang } from "./i18n";

const ZH: Record<string, string> = {
  dashboard: "仪表盘", home: "首页", checkout: "结账", settings: "设置", "sign-in": "登录", pricing: "定价页",
  "acknowledgement-and-success": "确认与成功页", "account-setup": "账号设置引导", "landing-pages": "落地页",
  "user-profile": "用户主页", "shop-and-storefront": "商店与店面", calendar: "日历", "404": "404 页面",
  "blog-index": "博客列表", "case-studies": "案例研究", changelog: "更新日志", contact: "联系我们",
  "book-a-demo": "预约演示", "invite-and-refer-friends": "邀请好友", about: "关于我们", "resources-page": "资源页",
  "sign-up": "注册", "blog-post": "博客文章", careers: "招聘", "partners-page": "合作伙伴页", map: "地图",
  "song-and-podcast-detail": "歌曲与播客详情", "help-and-support": "帮助与支持", "magazine-pages": "杂志风页面",
  "portfolio-website": "作品集网站", misc: "其他", "project-tracker": "项目追踪", verification: "验证",
  "agency-websites": "设计/广告机构官网", crm: "客户关系管理", "parallax-effect": "视差效果", "personal-website": "个人网站",
  "sponsor-page": "赞助页", "technology-websites": "科技类网站", "rich-text-editor": "富文本编辑器", "text-particles": "文字粒子",
  error: "错误页", "retro-websites": "复古风网站", "news-feed": "资讯流", "reset-password": "重置密码",
  "achievements-and-awards": "成就与奖项", "audio-and-video-recorder": "音视频录制", "audio-player": "音频播放器",
  billing: "账单", "bookmarks-and-collections": "收藏与合集", call: "通话", canvas: "画布", "cart-and-bag": "购物车",
  "chat-bot": "聊天机器人", "chat-detail": "聊天详情", "class-lesson-detail": "课程详情", "code-editor": "代码编辑器",
  comments: "评论", "dark-mode": "深色模式", "delete-and-deactivate-account": "注销与停用账号", "emails-and-messages": "邮件与消息",
  "event-detail": "活动详情", "feature-info": "功能介绍", feedback: "反馈", "followers-and-following": "粉丝与关注",
  "goal-and-task": "目标与任务", "guided-tour-and-tutorial": "新手引导与教程", "internal-tool": "内部工具", "kanban-board": "看板",
  "media-editor": "媒体编辑器", "multi-column-layout": "多栏布局", "note-detail": "笔记详情", "order-detail": "订单详情",
  "order-history": "订单历史", "payment-method": "支付方式", permission: "权限", "post-detail": "帖子详情", progress: "进度",
  "qr-code": "二维码", quiz: "测验", search: "搜索", "subscription-and-paywall": "订阅与付费墙",
  "suggestions-and-similar-items": "推荐与相似内容", "timeline-and-history": "时间线与历史记录", "timer-and-clock": "计时器与时钟",
  "trash-and-archive": "回收站与归档", "wallet-and-balance": "钱包与余额", "tv-show-and-movie-detail": "剧集与电影详情",
  "community-websites": "社区网站", playlists: "播放列表", "add-and-create": "新增与创建", "empty-state": "空状态",
  loading: "加载中", notifications: "通知", "promotions-and-rewards": "促销与奖励", "recipe-detail": "食谱详情",
  "social-feed": "社交动态流", stories: "快拍/故事", leaderboard: "排行榜",
  hero: "首屏主视觉", testimonials: "用户评价", navbar: "导航栏", footer: "页脚", charts: "图表", features: "功能特性",
  table: "表格", faq: "常见问题", forms: "表单", card: "卡片", "cta-band": "行动号召条", stats: "数据统计", dialog: "对话框",
  carousel: "轮播", "reviews-and-ratings": "评价与评分", quotes: "引语", "bento-grid": "便当格布局", "logo-cloud": "客户 Logo 墙",
  waitlist: "候补名单", compare: "对比", "how-it-works": "工作原理", newsletter: "邮件订阅", "product-detail": "商品详情",
  "command-palette": "命令面板", header: "页头", "toggle-switch": "开关", "video-player": "视频播放器", "social-links": "社交链接",
  manifesto: "宣言", "timeline-roadmap": "路线图", avatar: "头像", button: "按钮", checkbox: "复选框",
  "floating-action-button": "悬浮操作按钮", "radio-button": "单选按钮", "segmented-control": "分段控件",
  "skeleton-loader": "骨架屏", slider: "滑块", "status-icon": "状态图标", team: "团队", "text-area": "多行文本框",
  "text-field": "文本输入框", menu: "菜单", widgets: "小组件", gallery: "画廊", checklist: "清单", accordion: "手风琴/折叠面板",
  "action-and-option": "操作与选项", breadcrumb: "面包屑", chat: "聊天", "coach-marks": "引导气泡", "code-snippet": "代码片段",
  "color-picker": "取色器", "context-menu": "右键菜单", "date-picker": "日期选择器", drawer: "抽屉", "dropdown-menu": "下拉菜单",
  "file-upload": "文件上传", "filter-chips": "筛选标签", "full-screen-overlay": "全屏浮层", "grid-list": "网格列表",
  "mega-menu": "大型导航菜单", pagination: "分页", popover: "气泡弹层", "search-bar": "搜索栏", "side-navigation": "侧边导航",
  "stacked-list": "堆叠列表", stepper: "步骤条", tabs: "标签页", "time-picker": "时间选择器", "toast-notification": "轻提示",
  toolbar: "工具栏", tree: "树形结构", "node-editor": "节点编辑器", "announcement-banner": "公告横幅",
  spline: "Spline 3D", "fan-carousel": "扇形轮播", "hero-scrub": "首屏滚动联动", marquee: "跑马灯", "page-scrub": "整页滚动联动",
  "scroll-deck": "滚动卡堆", "scroll-float": "滚动漂浮", "spotlight-reveal": "聚光灯显现", "wipe-reveal": "擦除显现",
  "design-systems": "设计系统",
};

/** Chinese name for a category slug (zh locale only). */
export function catZh(slug: string, name: string): string | null {
  if (lang() !== "zh") return null;
  const zh = ZH[slug];
  return zh && zh !== name ? zh : null;
}

/** Apply the instant tooltip (zh main line, English sub line) to an element. */
export function setCatTip(el: HTMLElement, slug: string, name: string, side: "right" | "top" = "top"): void {
  const zh = catZh(slug, name);
  el.setAttr("data-tip-side", side);
  if (zh) {
    el.setAttr("data-tip", zh);
    el.setAttr("data-tip-sub", name);
  } else {
    // No translation (English UI): only reveal the full name when it is truncated.
    el.setAttr("data-tip", name);
    el.setAttr("data-tip-if-truncated", "1");
  }
}

/** Lower-cased "english zh" haystack so category names are searchable in both languages. */
export function catSearchText(slug: string, name: string): string {
  const zh = catZh(slug, name);
  return (zh ? `${name} ${zh}` : name).toLowerCase();
}
