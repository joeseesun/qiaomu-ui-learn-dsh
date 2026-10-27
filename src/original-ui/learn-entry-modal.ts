// UI 词典词条详情：双语名称/简介、组件解剖、API 速查、AI/Debug Prompt、
// 交互式 demo、关联词条、点评与笔记。

import { Modal } from "../harness-ui";
import { t } from "./i18n";
import { LearnEntry } from "./learnui-data";
import { exportEntryNote, entryInsertMd, insertIntoEditor, renderReviewEditor, reviewKey } from "./learn-review";
import { chip, promptBlock, renderDemoFrame, sectionTitle } from "./learn-shared";
import type QiaomuProductGalleryPlugin from "./main";

export class LearnEntryModal extends Modal {
  private plugin: QiaomuProductGalleryPlugin;
  private entry: LearnEntry;

  constructor(plugin: QiaomuProductGalleryPlugin, entry: LearnEntry) {
    super(plugin.app);
    this.plugin = plugin;
    this.entry = entry;
    this.modalEl.addClass("qpg-learn-modal");
  }

  onOpen(): void {
    const e = this.entry;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qpg-learn-content");

    // Header
    const head = contentEl.createDiv("qpg-learn-head");
    const title = head.createDiv("qpg-learn-title");
    if (e.nameZh) title.createSpan("qpg-learn-title-zh").setText(e.nameZh);
    title.createSpan("qpg-learn-title-en").setText(e.name);
    chip(title, e.platform, "qpg-chip-platform");
    head.createDiv("qpg-learn-tagline").setText(e.taglineZh ?? e.tagline);
    if (e.taglineZh && e.tagline) head.createDiv("qpg-learn-tagline-en").setText(e.tagline);

    // Aliases
    const aka = [...e.akaZh, ...e.aka];
    if (aka.length) {
      const akaRow = contentEl.createDiv("qpg-learn-aka");
      akaRow.createSpan("qpg-learn-aka-label").setText(t("learn.entry.aka"));
      for (const a of aka) chip(akaRow, a, "qpg-chip-aka");
    }

    // Live specimen
    const demoWrap = contentEl.createDiv("qpg-learn-demo");
    void renderDemoFrame(demoWrap, this.plugin, "entry", e.slug, 340);
    demoWrap.createDiv("qpg-learn-demo-hint").setText(t("learn.demoHint"));

    // Description
    if (e.descriptionZh || e.description) {
      const desc = contentEl.createDiv("qpg-learn-desc");
      if (e.descriptionZh) desc.createDiv("qpg-learn-desc-zh").setText(e.descriptionZh);
      if (e.description) desc.createDiv("qpg-learn-desc-en").setText(e.description);
    }

    // Parts (anatomy)
    if (e.parts.length) {
      const parts = contentEl.createDiv("qpg-learn-parts");
      sectionTitle(parts, t("learn.entry.parts"));
      for (const p of e.parts) {
        const row = parts.createDiv("qpg-part");
        const rowHead = row.createDiv("qpg-part-head");
        rowHead.createSpan("qpg-part-name").setText([p.nameZh, p.name].filter(Boolean).join(" / "));
        if (p.api) rowHead.createSpan("qpg-part-api").setText(p.api);
        row.createDiv("qpg-part-desc").setText(p.descriptionZh ?? p.description);
      }
    }

    // API cheat sheet
    if (e.api.length) {
      const api = contentEl.createDiv("qpg-learn-api");
      sectionTitle(api, t("learn.entry.api"));
      e.api.forEach((a, i) => {
        const row = api.createDiv("qpg-api-row");
        row.createSpan("qpg-api-fw").setText(a.framework);
        row.createSpan("qpg-api-symbol").setText(a.symbol);
        const note = a.note ?? e.apiNotesZh[i];
        if (note) row.createSpan("qpg-api-note").setText(note);
      });
    }

    // Prompts
    if (e.promptZh || e.prompt) {
      const prompts = contentEl.createDiv("qpg-learn-prompts");
      sectionTitle(prompts, t("learn.entry.prompt"));
      promptBlock(prompts, e.promptZh ?? e.prompt);
    }
    if (e.debugPromptZh || e.debugPrompt) {
      const dbg = contentEl.createDiv("qpg-learn-prompts");
      sectionTitle(dbg, t("learn.entry.debugPrompt"));
      promptBlock(dbg, e.debugPromptZh ?? e.debugPrompt, "qpg-prompt qpg-prompt-debug", 8);
    }

    // Related entries
    if (e.related.length) {
      const rel = contentEl.createDiv("qpg-learn-related");
      sectionTitle(rel, t("learn.entry.related"));
      const row = rel.createDiv("qpg-chip-row");
      for (const slug of e.related) {
        const other = this.plugin.learnui?.entries.find((x) => x.slug === slug);
        if (!other) continue;
        chip(row, [other.nameZh, other.name].filter(Boolean).join(" / "), "qpg-chip-link").addEventListener(
          "click",
          () => {
            this.close();
            new LearnEntryModal(this.plugin, other).open();
          },
        );
      }
    }

    // Review + notes
    const reviewWrap = contentEl.createDiv("qpg-learn-review");
    renderReviewEditor(reviewWrap, this.plugin, reviewKey("entry", e.slug), {
      onInsert: () => void insertIntoEditor(this.plugin, entryInsertMd(e)),
      onExport: () => void exportEntryNote(this.plugin, e),
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
