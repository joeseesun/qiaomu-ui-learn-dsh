// 复刻 Prompt: turn a gallery design into a ready-to-paste vibe-coding brief.
// Pages/sections ship a public, self-contained HTML source — we link it (and can
// inline it) so the agent rebuilds from real markup instead of guessing from a PNG.

import { Notice, normalizePath, requestUrl } from "../harness-ui";
import { FlatItem, pageUrl, previewUrl, thumbUrl } from "./catalog";
import { lang, t } from "./i18n";
import type QiaomuProductGalleryPlugin from "./main";

const SOURCE_CAP = 120_000; // chars; keeps the clipboard payload sane

export function sourceUrl(item: FlatItem): string | null {
  const u = previewUrl(item.row, item.cat.k);
  return u && /\.html?($|\?)/i.test(u) ? u : null;
}

export function buildPrompt(item: FlatItem, plugin: QiaomuProductGalleryPlugin): string {
  const stack = plugin.settings.replicaStack.trim() || "React + Tailwind CSS";
  const name = item.row[0];
  const kind = t(`view.kind.${item.cat.k}`);
  const live = previewUrl(item.row, item.cat.k);
  const thumb = thumbUrl(item.row);
  const page = pageUrl(item.row);
  const src = sourceUrl(item);

  if (lang() === "zh") {
    const refs = [
      thumb && `- 设计截图：${thumb}`,
      live && `- 在线预览${src ? "（可直接读取 HTML 源码）" : ""}：${live}`,
      `- 设计详情页：${page}`,
    ].filter(Boolean);
    return [
      `请帮我复刻下面这个${kind}设计：「${name}」（分类：${item.cat.n}）。`,
      "",
      "【参考资料】",
      ...refs,
      "",
      "【做法】",
      "1. 先阅读参考（有源码就优先读源码），用几句话总结：整体布局与栅格、字体层级、配色、间距、圆角与阴影、关键交互。先给我这份设计 token 清单，再动手写代码。",
      `2. 技术栈：${stack}。按组件拆分，数据与样式分离，桌面 / 平板 / 手机都要响应式。`,
      "3. 视觉和交互细节要和参考一致：hover / focus / active 状态、过渡动画、空状态。",
      "4. 文案、品牌名、Logo、图片全部换成占位内容（我稍后替换）；这是学习参考，不要照搬原品牌与原文案。",
      "5. 写完后对照参考逐项自查差异（间距、字号、颜色），列出还不一致的地方并修正。",
    ].join("\n");
  }
  const refs = [
    thumb && `- Screenshot: ${thumb}`,
    live && `- Live preview${src ? " (readable HTML source)" : ""}: ${live}`,
    `- Design page: ${page}`,
  ].filter(Boolean);
  return [
    `Please recreate this ${kind.toLowerCase()} design: "${name}" (category: ${item.cat.n}).`,
    "",
    "REFERENCES",
    ...refs,
    "",
    "APPROACH",
    "1. Study the reference first (read the HTML source if available) and summarise in a few lines: layout and grid, type hierarchy, palette, spacing, radii and shadows, key interactions. Give me that token list before writing code.",
    `2. Stack: ${stack}. Split into components, keep data and styling separate, make it responsive across desktop / tablet / mobile.`,
    "3. Match the visual and interaction details: hover / focus / active states, transitions, empty states.",
    "4. Replace all copy, brand names, logos and images with placeholders — this is a learning reference, do not copy the original brand or text.",
    "5. When done, audit against the reference (spacing, font sizes, colours), list what still differs and fix it.",
  ].join("\n");
}

export async function fetchSource(item: FlatItem, plugin: QiaomuProductGalleryPlugin): Promise<string | null> {
  const url = sourceUrl(item);
  if (!url) return null;
  try {
    const res = await plugin.api.referenceSource({ key: item.key });
    const text = res.text;
    return res.truncated || text.length > SOURCE_CAP ? text.slice(0, SOURCE_CAP) + "\n<!-- truncated -->" : text;
  } catch {
    return null;
  }
}

/** Prompt plus the inlined HTML source (when one exists). */
export async function buildPromptWithSource(item: FlatItem, plugin: QiaomuProductGalleryPlugin): Promise<string | null> {
  const src = await fetchSource(item, plugin);
  if (!src) return null;
  const head = lang() === "zh" ? "【参考源码（HTML）】" : "REFERENCE SOURCE (HTML)";
  return `${buildPrompt(item, plugin)}\n\n${head}\n\`\`\`html\n${src}\n\`\`\``;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Save the brief as a note so it can be reused / tweaked later. */
export async function saveReplicaNote(item: FlatItem, plugin: QiaomuProductGalleryPlugin): Promise<string> {
  const folder = plugin.settings.notesFolder || "Learn UI";
  const path = `${folder}/${t("replica.filePrefix")} - ${safeName(item.row[0])}.md`;
  const thumb = thumbUrl(item.row);
  const md = [
    "---",
    "tags:",
    "  - learn-ui",
    "  - replica",
    `source: ${pageUrl(item.row)}`,
    `category: ${item.cat.n}`,
    "---",
    "",
    `# ${item.row[0]}`,
    "",
    thumb ? `![${item.row[0]}](${thumb})` : "",
    "",
    `## ${t("replica.noteHeading")}`,
    "",
    "```text",
    buildPrompt(item, plugin),
    "```",
    "",
  ].join("\n");
  await plugin.writeNote(path, md);
  return path;
}

export function notifyCopied(n?: number): void {
  new Notice(n ? t("replica.copiedSource", { kb: Math.max(1, Math.round(n / 1024)) }) : t("replica.copied"));
}
