// 风格图鉴详情：双语概述、识别信号、起源、无障碍、易混淆对比、代码配方、
// 生成 Prompt、交互 demo、点评与笔记。

import { Modal } from "../harness-ui";
import { t } from "./i18n";
import { LearnStyle } from "./learnui-data";
import { exportStyleNote, insertIntoEditor, renderReviewEditor, reviewKey, styleInsertMd } from "./learn-review";
import { chip, promptBlock, renderDemoFrame, sectionTitle } from "./learn-shared";
import type QiaomuProductGalleryPlugin from "./main";

export class LearnStyleModal extends Modal {
  private plugin: QiaomuProductGalleryPlugin;
  private style: LearnStyle;

  constructor(plugin: QiaomuProductGalleryPlugin, style: LearnStyle) {
    super(plugin.app);
    this.plugin = plugin;
    this.style = style;
    this.modalEl.addClass("qpg-learn-modal");
  }

  onOpen(): void {
    const s = this.style;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qpg-learn-content");

    const head = contentEl.createDiv("qpg-learn-head");
    const title = head.createDiv("qpg-learn-title");
    if (s.nameZh) title.createSpan("qpg-learn-title-zh").setText(s.nameZh);
    title.createSpan("qpg-learn-title-en").setText(s.name);
    head.createDiv("qpg-learn-tagline").setText(s.taglineZh ?? s.tagline);
    if (s.taglineZh && s.tagline) head.createDiv("qpg-learn-tagline-en").setText(s.tagline);

    const aliases = [...s.aliasesZh, ...s.aliases];
    if (aliases.length) {
      const aliasRow = contentEl.createDiv("qpg-learn-aka");
      aliasRow.createSpan("qpg-learn-aka-label").setText(t("learn.style.aliases"));
      for (const a of aliases) chip(aliasRow, a, "qpg-chip-aka");
    }

    const demoWrap = contentEl.createDiv("qpg-learn-demo");
    void renderDemoFrame(demoWrap, this.plugin, "style", s.slug, 380);
    demoWrap.createDiv("qpg-learn-demo-hint").setText(t("learn.demoHint"));

    if (s.scopeZh || s.scope) {
      const scope = contentEl.createDiv("qpg-learn-scope");
      scope.createDiv("qpg-learn-scope-text").setText(s.scopeZh ?? s.scope);
      if (s.scopeZh && s.scope) scope.createDiv("qpg-learn-scope-en").setText(s.scope);
    }

    if (s.signals.length) {
      const sig = contentEl.createDiv("qpg-learn-signals");
      sectionTitle(sig, t("learn.style.signals"));
      for (const g of s.signals) {
        const row = sig.createDiv("qpg-signal");
        const rowHead = row.createDiv("qpg-signal-head");
        rowHead.createSpan("qpg-signal-name").setText([g.nameZh, g.name].filter(Boolean).join(" / "));
        if (g.role === "defining") chip(rowHead, t("learn.style.defining"), "qpg-chip-defining");
        if (g.facet) chip(rowHead, g.facet, "qpg-chip-facet");
        row.createDiv("qpg-signal-desc").setText(g.descriptionZh ?? g.description);
      }
    }

    if (s.confusedWith) {
      const cw = contentEl.createDiv("qpg-learn-confused");
      sectionTitle(cw, t("learn.style.confused"));
      const card = cw.createDiv("qpg-confused-card");
      const other = this.plugin.learnui?.styles.find((x) => x.slug === s.confusedWith!.slug);
      const otherName = other ? [other.nameZh, other.name].filter(Boolean).join(" / ") : s.confusedWith.name;
      card.createDiv("qpg-confused-name").setText(`≠ ${otherName}`);
      card.createDiv("qpg-confused-because").setText(s.confusedWith.becauseZh ?? s.confusedWith.because);
      if (other) {
        card.addEventListener("click", () => {
          this.close();
          new LearnStyleModal(this.plugin, other).open();
        });
      }
    }

    if (s.originZh || s.origin) {
      const origin = contentEl.createDiv("qpg-learn-origin");
      sectionTitle(origin, t("learn.style.origin"));
      origin.createDiv("qpg-learn-origin-text").setText(s.originZh ?? s.origin);
      if (s.originZh && s.origin) origin.createDiv("qpg-learn-origin-en").setText(s.origin);
    }

    if (s.accessibilityZh || s.accessibility) {
      const a11y = contentEl.createDiv("qpg-learn-a11y");
      sectionTitle(a11y, t("learn.style.a11y"));
      a11y.createDiv("qpg-learn-a11y-text").setText(s.accessibilityZh ?? s.accessibility);
      if (s.accessibilityZh && s.accessibility) a11y.createDiv("qpg-learn-a11y-en").setText(s.accessibility);
    }

    if (s.code.length) {
      const code = contentEl.createDiv("qpg-learn-code");
      sectionTitle(code, t("learn.style.code"));
      for (const c of s.code) {
        code.createDiv("qpg-code-title").setText(c.title);
        promptBlock(code, c.code, "qpg-prompt qpg-prompt-code");
      }
    }

    if (s.briefZh || s.brief) {
      const brief = contentEl.createDiv("qpg-learn-prompts");
      sectionTitle(brief, t("learn.style.brief"));
      promptBlock(brief, s.briefZh ?? s.brief);
    }

    if (s.seeAlso.length) {
      const rel = contentEl.createDiv("qpg-learn-related");
      sectionTitle(rel, t("learn.entry.related"));
      const row = rel.createDiv("qpg-chip-row");
      for (const slug of s.seeAlso) {
        const other = this.plugin.learnui?.styles.find((x) => x.slug === slug);
        if (!other) continue;
        chip(row, [other.nameZh, other.name].filter(Boolean).join(" / "), "qpg-chip-link").addEventListener(
          "click",
          () => {
            this.close();
            new LearnStyleModal(this.plugin, other).open();
          },
        );
      }
    }

    const reviewWrap = contentEl.createDiv("qpg-learn-review");
    renderReviewEditor(reviewWrap, this.plugin, reviewKey("style", s.slug), {
      onInsert: () => void insertIntoEditor(this.plugin, styleInsertMd(s)),
      onExport: () => void exportStyleNote(this.plugin, s),
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
