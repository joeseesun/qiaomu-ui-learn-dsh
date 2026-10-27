// Learn review layer: per-item rating + tags + comment stored in plugin data,
// plus one-click export to an Obsidian markdown note and insert-into-editor.

import { Notice, normalizePath, setIcon, TFile } from "../harness-ui";
import { t } from "./i18n";
import type { LearnEntry, LearnStyle } from "./learnui-data";
import type QiaomuProductGalleryPlugin from "./main";

export interface ReviewData {
  rating?: number;
  tags?: string[];
  note?: string;
  updated?: string;
}

export type ReviewKind = "entry" | "style" | "design";

export function reviewKey(kind: ReviewKind, slug: string): string {
  return `${kind}:${slug}`;
}

export function getReview(plugin: QiaomuProductGalleryPlugin, key: string): ReviewData {
  return plugin.settings.learnReviews[key] ?? {};
}

// Timers belong to a mounted Harness view; never write from a disposed view.
const timersByPlugin = new WeakMap<object, Map<string, number>>();
export function cancelReviewTimers(plugin: object): void {
  const timers = timersByPlugin.get(plugin);
  timers?.forEach(timer => window.clearTimeout(timer));
  timersByPlugin.delete(plugin);
}

export function saveReview(plugin: QiaomuProductGalleryPlugin, key: string, patch: ReviewData): void {
  const cur = plugin.settings.learnReviews[key] ?? {};
  const next: ReviewData = { ...cur, ...patch, updated: new Date().toISOString() };
  // Drop empty fields so the store stays lean.
  if (!next.rating) delete next.rating;
  if (!next.tags || next.tags.length === 0) delete next.tags;
  if (!next.note || !next.note.trim()) delete next.note;
  if (Object.keys(next).length === 1 && next.updated) {
    delete plugin.settings.learnReviews[key];
  } else {
    plugin.settings.learnReviews[key] = next;
  }
  let saveTimers = timersByPlugin.get(plugin);
  if (!saveTimers) { saveTimers = new Map(); timersByPlugin.set(plugin, saveTimers); }
  const prev = saveTimers.get(key);
  if (prev) window.clearTimeout(prev);
  saveTimers.set(
    key,
    window.setTimeout(() => {
      saveTimers!.delete(key);
      void plugin.saveSettings();
    }, 600),
  );
}

// ---------------------------------------------------------------------------
// Review editor (stars + tags + comment) shared by all detail surfaces.
// ---------------------------------------------------------------------------

export interface ReviewEditorOpts {
  onExport?: () => void;
  onInsert?: () => void;
}

export function renderReviewEditor(
  container: HTMLElement,
  plugin: QiaomuProductGalleryPlugin,
  key: string,
  opts: ReviewEditorOpts = {},
): void {
  const wrap = container.createDiv("qpg-review");
  const head = wrap.createDiv("qpg-review-head");
  head.createDiv("qpg-review-title").setText(t("review.title"));

  const stars = head.createDiv("qpg-review-stars");
  const paint = () => {
    const cur = getReview(plugin, key).rating ?? 0;
    stars.querySelectorAll(".qpg-star").forEach((el, i) => {
      el.toggleClass("is-on", i < cur);
    });
  };
  for (let i = 1; i <= 5; i++) {
    const star = stars.createEl("button", { cls: "qpg-star", attr: { "aria-label": t("review.starN", { n: i }) } });
    star.setText("★");
    star.addEventListener("click", () => {
      const cur = getReview(plugin, key).rating ?? 0;
      saveReview(plugin, key, { rating: cur === i ? 0 : i });
      paint();
      new Notice(t("review.saved"));
    });
  }
  paint();

  const review = getReview(plugin, key);

  const tagsInput = wrap.createEl("input", {
    cls: "qpg-review-tags",
    type: "text",
    placeholder: t("review.tagsPlaceholder"),
    attr: { value: (review.tags ?? []).join(", ") },
  });

  const noteArea = wrap.createEl("textarea", {
    cls: "qpg-review-note",
    attr: { placeholder: t("review.notePlaceholder"), rows: "4" },
  });
  noteArea.value = review.note ?? "";

  const persist = () => {
    const tags = tagsInput.value
      .split(/[,，#]/)
      .map((s) => s.trim())
      .filter(Boolean);
    saveReview(plugin, key, { tags, note: noteArea.value });
  };
  tagsInput.addEventListener("input", persist);
  noteArea.addEventListener("input", persist);

  const foot = wrap.createDiv("qpg-review-foot");
  const save = foot.createEl("button", { cls: "qpg-btn-primary" });
  save.setText(t("review.save"));
  save.addEventListener("click", () => {
    const tags = tagsInput.value
      .split(/[,，#]/)
      .map((s) => s.trim())
      .filter(Boolean);
    saveReview(plugin, key, { tags, note: noteArea.value });
    new Notice(t("review.saved"));
  });

  if (opts.onInsert) {
    const insert = foot.createEl("button", { cls: "qpg-btn" });
    insert.setText(t("review.insert"));
    insert.addEventListener("click", () => opts.onInsert!());
  }
  if (opts.onExport) {
    const ex = foot.createEl("button", { cls: "qpg-btn" });
    ex.setText(t("review.export"));
    setIcon(ex, "file-down");
    ex.addEventListener("click", () => opts.onExport!());
  }

  if (review.updated) {
    foot.createDiv("qpg-review-updated").setText(t("review.updated", { time: review.updated.slice(0, 16).replace("T", " ") }));
  }
}

// ---------------------------------------------------------------------------
// Note export / insert
// ---------------------------------------------------------------------------

function sanitizeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function starsMd(rating?: number): string {
  return rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "";
}

function bilingual(zh: string | null | undefined, en: string | null | undefined): string {
  return [zh, en].filter((x) => x && x.trim()).join("\n\n");
}

function frontmatter(lines: string[]): string {
  return ["---", ...lines, "---", ""].join("\n");
}

async function writeNote(plugin: QiaomuProductGalleryPlugin, fileName: string, md: string): Promise<string> {
  return plugin.writeNote(`${plugin.settings.notesFolder || "Learn UI"}/${fileName}`, md);
}

function reviewSection(review: ReviewData): string {
  const bits: string[] = [];
  const stars = starsMd(review.rating);
  if (stars) bits.push(stars);
  if (review.tags?.length) bits.push(review.tags.map((tg) => `#${tg.replace(/\s+/g, "-")}`).join(" "));
  if (review.note?.trim()) bits.push("", review.note.trim());
  return bits.length ? bits.join("\n") : t("review.emptyExport");
}

function updatedLine(review: ReviewData): string {
  return review.updated ? `> ${t("review.updated", { time: review.updated.slice(0, 16).replace("T", " ") })}` : "";
}

export function entryNoteMd(plugin: QiaomuProductGalleryPlugin, entry: LearnEntry): string {
  const review = getReview(plugin, reviewKey("entry", entry.slug));
  const lines = [
    "tags:",
    "  - learn-ui",
    "  - ui-词典",
    `rating: ${review.rating ?? 0}`,
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    `learn-ui: ${entry.slug}`,
  ];
  const body: string[] = [];
  body.push(`# ${entry.nameZh ?? ""} ${entry.name}`.trim());
  body.push(bilingual(entry.taglineZh, entry.tagline) ?? "");
  body.push(`\n> ${t("learn.entry.platform")}: ${entry.platform}`);
  if (entry.descriptionZh || entry.description) {
    body.push(`## ${t("learn.entry.about")}`);
    body.push(bilingual(entry.descriptionZh, entry.description) ?? "");
  }
  if (entry.parts.length) {
    body.push(`## ${t("learn.entry.parts")}`);
    for (const p of entry.parts) {
      body.push(
        `- **${[p.nameZh, p.name].filter(Boolean).join(" / ")}**${p.api ? ` — \`${p.api}\`` : ""}: ${p.descriptionZh ?? p.description}`,
      );
    }
  }
  if (entry.api.length) {
    body.push(`## ${t("learn.entry.api")}`);
    entry.api.forEach((a, i) => {
      const note = a.note ?? entry.apiNotesZh[i] ?? "";
      body.push(`- ${a.framework} · \`${a.symbol}\`${note ? ` — ${note}` : ""}`);
    });
  }
  if (entry.promptZh || entry.prompt) {
    body.push(`## ${t("learn.entry.prompt")}`);
    body.push("```", entry.promptZh ?? entry.prompt, "```");
  }
  if (review.note?.trim() || review.rating || review.tags?.length) {
    body.push(`## ${t("review.sectionTitle")}`);
    body.push(reviewSection(review));
    const ul = updatedLine(review);
    if (ul) body.push(ul);
  }
  body.push("", `> ${t("review.exportSource")}`);
  return frontmatter(lines) + body.filter((x) => x !== undefined && x !== null).join("\n\n") + "\n";
}

export function styleNoteMd(plugin: QiaomuProductGalleryPlugin, style: LearnStyle): string {
  const review = getReview(plugin, reviewKey("style", style.slug));
  const lines = [
    "tags:",
    "  - learn-ui",
    "  - 视觉风格",
    `rating: ${review.rating ?? 0}`,
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    `learn-ui-style: ${style.slug}`,
  ];
  const body: string[] = [];
  body.push(`# ${style.nameZh ?? ""} ${style.name}`.trim());
  body.push(bilingual(style.taglineZh, style.tagline) ?? "");
  if (style.scopeZh || style.scope) {
    body.push(`## ${t("learn.style.scope")}`);
    body.push(bilingual(style.scopeZh, style.scope) ?? "");
  }
  if (style.signals.length) {
    body.push(`## ${t("learn.style.signals")}`);
    for (const sig of style.signals) {
      body.push(`- **${[sig.nameZh, sig.name].filter(Boolean).join(" / ")}**${sig.role === "defining" ? `（${t("learn.style.defining")}）` : ""}: ${sig.descriptionZh ?? sig.description}`);
    }
  }
  if (style.originZh || style.origin) {
    body.push(`## ${t("learn.style.origin")}`);
    body.push(bilingual(style.originZh, style.origin) ?? "");
  }
  if (style.accessibilityZh || style.accessibility) {
    body.push(`## ${t("learn.style.a11y")}`);
    body.push(bilingual(style.accessibilityZh, style.accessibility) ?? "");
  }
  if (style.confusedWith) {
    body.push(`## ${t("learn.style.confused")}`);
    body.push(`**${style.confusedWith.name}**`);
    body.push(bilingual(style.confusedWith.becauseZh, style.confusedWith.because) ?? "");
  }
  if (style.code.length) {
    body.push(`## ${t("learn.style.code")}`);
    for (const c of style.code) {
      body.push(`### ${c.title}`, "```" + c.language, c.code, "```");
    }
  }
  if (style.briefZh || style.brief) {
    body.push(`## ${t("learn.style.brief")}`);
    body.push("```", style.briefZh ?? style.brief, "```");
  }
  if (review.note?.trim() || review.rating || review.tags?.length) {
    body.push(`## ${t("review.sectionTitle")}`);
    body.push(reviewSection(review));
    const ul = updatedLine(review);
    if (ul) body.push(ul);
  }
  body.push("", `> ${t("review.exportSource")}`);
  return frontmatter(lines) + body.filter((x) => x !== undefined && x !== null).join("\n\n") + "\n";
}

export async function exportEntryNote(plugin: QiaomuProductGalleryPlugin, entry: LearnEntry): Promise<void> {
  const name = sanitizeName(`${entry.nameZh ?? entry.name} ${entry.name}`);
  const path = await writeNote(plugin, t("review.fileEntry", { name }) + ".md", entryNoteMd(plugin, entry));
  new Notice(t("review.exported", { path }));
}

export async function exportStyleNote(plugin: QiaomuProductGalleryPlugin, style: LearnStyle): Promise<void> {
  const name = sanitizeName(`${style.nameZh ?? style.name} ${style.name}`);
  const path = await writeNote(plugin, t("review.fileStyle", { name }) + ".md", styleNoteMd(plugin, style));
  new Notice(t("review.exported", { path }));
}

export function entryInsertMd(entry: LearnEntry): string {
  const title = [entry.nameZh, entry.name].filter(Boolean).join(" · ");
  const lines = [`**${title}**`, "", (entry.taglineZh ?? entry.tagline) ?? ""];
  if (entry.promptZh || entry.prompt) {
    lines.push("", "```", entry.promptZh ?? entry.prompt, "```");
  }
  return lines.join("\n");
}

export function styleInsertMd(style: LearnStyle): string {
  const title = [style.nameZh, style.name].filter(Boolean).join(" · ");
  const lines = [`**${title}**`, "", (style.taglineZh ?? style.tagline) ?? ""];
  if (style.briefZh || style.brief) {
    lines.push("", "```", style.briefZh ?? style.brief, "```");
  }
  return lines.join("\n");
}

export async function insertIntoEditor(plugin: QiaomuProductGalleryPlugin, md: string): Promise<boolean> {
  plugin.insertIntoNote(md); return true;
}

/** Bulk-export every reviewed learn item into the notes folder. */
export async function exportAllLearnNotes(plugin: QiaomuProductGalleryPlugin): Promise<number> {
  const data = plugin.learnui;
  if (!data) return 0;
  let n = 0;
  for (const [key] of Object.entries(plugin.settings.learnReviews)) {
    const [kind, slug] = key.split(":");
    if (kind === "entry") {
      const entry = data.entries.find((e) => e.slug === slug);
      if (entry) {
        await writeNote(plugin, t("review.fileEntry", { name: sanitizeName(`${entry.nameZh ?? entry.name} ${entry.name}`) }) + ".md", entryNoteMd(plugin, entry));
        n++;
      }
    } else if (kind === "style") {
      const style = data.styles.find((s) => s.slug === slug);
      if (style) {
        await writeNote(plugin, t("review.fileStyle", { name: sanitizeName(`${style.nameZh ?? style.name} ${style.name}`) }) + ".md", styleNoteMd(plugin, style));
        n++;
      }
    }
  }
  return n;
}
