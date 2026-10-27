import { App, Menu, Modal, Notice, setIcon } from "../harness-ui";
import { FlatItem, openUrl, pageUrl, thumbUrl } from "./catalog";
import {copyText} from "./learn-shared";
import { t } from "./i18n";
import { catZh } from "./cat-zh";
import { renderReviewEditor, reviewKey } from "./learn-review";
import { collectionsContaining, openSaveMenu } from "./collections";
import { buildPrompt, buildPromptWithSource, notifyCopied, saveReplicaNote, sourceUrl } from "./replicate";
import type QiaomuProductGalleryPlugin from "./main";

/**
 * Lightbox: the design on a dark stage, a calm side panel with the actions and
 * the review editor. ←/→ move through the current result pool.
 */
export class DesignModal extends Modal {
  private plugin: QiaomuProductGalleryPlugin;
  private items: FlatItem[];
  private index: number;
  private onDone?: () => void;

  constructor(app: App, plugin: QiaomuProductGalleryPlugin, items: FlatItem[], index: number, onDone?: () => void) {
    super(app);
    this.plugin = plugin;
    this.items = items;
    this.onDone = onDone;
    this.index = Math.max(0, Math.min(index, items.length - 1));
    this.modalEl.addClass("qpg-lightbox");
  }

  onOpen(): void {
    this.render();
    const typing = () => {
      const a = document.activeElement;
      return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
    };
    this.scope.register([], "ArrowRight", () => {
      if (typing()) return;
      this.navigate(1);
      return false;
    });
    this.scope.register([], "ArrowLeft", () => {
      if (typing()) return;
      this.navigate(-1);
      return false;
    });
    this.scope.register([], "Enter", () => {
      if (typing()) return;
      this.openOriginal(this.current());
      return false;
    });
  }

  private navigate(delta: number) {
    const n = this.items.length;
    if (n < 2) return;
    this.index = (this.index + delta + n) % n;
    this.render();
  }

  private current(): FlatItem {
    return this.items[this.index];
  }

  private openOriginal(item: FlatItem) {
    window.open(openUrl(item.row, item.cat.k), "_blank");
  }

  private render(): void {
    const item = this.current();
    this.plugin.rememberRecent(item);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qpg-lightbox-content");

    // ---- Stage -------------------------------------------------------------
    const url = thumbUrl(item.row);
    const stage = contentEl.createDiv("qpg-lightbox-stage");
    if (url) {
      const shell = stage.createDiv("qpg-lightbox-shell is-loading is-fit");
      const img = shell.createEl("img", { cls: "qpg-lightbox-img" });
      img.decoding = "async";
      img.draggable = false;
      img.addEventListener("load", () => shell.removeClass("is-loading"));
      img.src = url;

      // Fit = whole image visible; Fill = full width, scroll for tall pages.
      const zoom = stage.createEl("button", { cls: "qpg-zoom", attr: { "aria-label": t("modal.zoom"), title: t("modal.zoom") } });
      const paint = () => {
        const fit = shell.hasClass("is-fit");
        setIcon(zoom, fit ? "maximize-2" : "minimize-2");
        zoom.setAttr("title", fit ? t("modal.zoom") : t("modal.fit"));
      };
      const toggle = () => {
        shell.toggleClass("is-fit", !shell.hasClass("is-fit"));
        shell.toggleClass("is-fill", !shell.hasClass("is-fit"));
        shell.scrollTop = 0;
        paint();
      };
      paint();
      zoom.addEventListener("click", toggle);
      img.addEventListener("click", toggle);
    } else {
      stage.addClass("is-empty");
      stage.createDiv("qpg-lightbox-missing").setText(t("modal.missingImage"));
    }

    if (this.items.length > 1) {
      const mkNav = (dir: -1 | 1) => {
        const b = stage.createEl("button", {
          cls: `qpg-nav ${dir < 0 ? "qpg-nav-prev" : "qpg-nav-next"}`,
          attr: { "aria-label": t(dir < 0 ? "modal.prev" : "modal.next") },
        });
        setIcon(b, dir < 0 ? "chevron-left" : "chevron-right");
        b.addEventListener("click", () => this.navigate(dir));
      };
      mkNav(-1);
      mkNav(1);
      stage.createDiv("qpg-lightbox-counter").setText(`${this.index + 1} / ${this.items.length}`);
    }

    // ---- Side panel --------------------------------------------------------
    const panel = contentEl.createDiv("qpg-lightbox-panel");
    const head = panel.createDiv("qpg-lightbox-head");
    head.createDiv("qpg-lightbox-kicker").setText(t(`view.kind.${item.cat.k}`));
    head.createDiv("qpg-lightbox-title").setText(item.row[0]);
    head.createDiv("qpg-lightbox-sub").setText([item.cat.n, catZh(item.cat.s, item.cat.n)].filter(Boolean).join(" · "));

    const primary = panel.createEl("button", { cls: "qpg-btn-primary qpg-btn-block" });
    setIcon(primary.createSpan("qpg-btn-icon"), "external-link");
    primary.createSpan().setText(t("modal.openOriginal"));
    primary.addEventListener("click", () => this.openOriginal(item));

    // Save to a collection + vibe-coding replication prompt.
    const pair = panel.createDiv("qpg-lightbox-pair");
    const saveBtn = pair.createEl("button", { cls: "qpg-btn" });
    const saveIcon = saveBtn.createSpan("qpg-btn-icon");
    const saveLabel = saveBtn.createSpan();
    const paintSave = () => {
      const saved = collectionsContaining(this.plugin, item.key).length > 0;
      setIcon(saveIcon, "bookmark");
      saveBtn.toggleClass("is-saved", saved);
      saveLabel.setText(t(saved ? "collection.savedBtn" : "collection.saveBtn"));
    };
    paintSave();
    saveBtn.addEventListener("click", (e) => openSaveMenu(this.plugin, e, item.key, paintSave));

    const repBtn = pair.createEl("button", { cls: "qpg-btn" });
    setIcon(repBtn.createSpan("qpg-btn-icon"), "wand-sparkles");
    repBtn.createSpan().setText(t("replica.button"));
    repBtn.addEventListener("click", (e) => this.replicaMenu(item, e));
    panel.createDiv("qpg-lightbox-hint").setText(t("replica.hint"));

    const tools = panel.createDiv("qpg-lightbox-tools");
    const tool = (icon: string, label: string, fn: () => void) => {
      const b = tools.createEl("button", { cls: "qpg-btn" });
      setIcon(b.createSpan("qpg-btn-icon"), icon);
      b.createSpan().setText(label);
      b.addEventListener("click", fn);
    };
    tool("globe", t("modal.openPage"), () => window.open(pageUrl(item.row), "_blank"));
    if (url) {
      tool("link", t("modal.copyImage"), () => {
        void copyText(url);
      });
      tool("copy", t("modal.copyMd"), () => {
        void copyText(this.markdown(item));
      });
      tool("file-input", t("modal.insert"), () => void this.insert(item));
    }

    const reviewWrap = panel.createDiv("qpg-lightbox-review");
    renderReviewEditor(reviewWrap, this.plugin, reviewKey("design", item.key));

    panel.createDiv("qpg-lightbox-keys").setText(t("modal.keys"));
  }

  private replicaMenu(item: FlatItem, e: MouseEvent) {
    const menu = new Menu();
    menu.addItem((it) =>
      it
        .setTitle(t("replica.menu.prompt"))
        .setIcon("copy")
        .onClick(async () => {
          if(await copyText(buildPrompt(item, this.plugin),null))notifyCopied();
        }),
    );
    menu.addItem((it) =>
      it
        .setTitle(t("replica.menu.source"))
        .setIcon("file-code")
        .onClick(async () => {
          if (!sourceUrl(item)) {
            await copyText(buildPrompt(item, this.plugin),t("replica.noSource"));
            return;
          }
          const fetching = new Notice(t("replica.fetching"), 0);
          const full = await buildPromptWithSource(item, this.plugin);
          fetching.hide();
          if (!full) {
            await copyText(buildPrompt(item, this.plugin),t("replica.fetchFail"));
            return;
          }
          if(await copyText(full,null))notifyCopied(full.length);
        }),
    );
    menu.addItem((it) =>
      it
        .setTitle(t("replica.menu.note"))
        .setIcon("file-plus")
        .onClick(async () => {
          const path = await saveReplicaNote(item, this.plugin);
          new Notice(t("replica.saved", { path }));
        }),
    );
    menu.showAtMouseEvent(e);
  }

  private markdown(item: FlatItem): string {
    const alt = `${item.row[0]} · ${item.cat.n}`;
    return `![${alt}](${thumbUrl(item.row)})`;
  }

  private async insert(item: FlatItem) {
    let md = this.markdown(item);
    if (this.plugin.settings.appendSource) {
      md += `\n[${item.row[0]}](${pageUrl(item.row)})`;
    }
    this.close();
    this.plugin.insertIntoNote(md);
  }

  onClose(): void {
    this.contentEl.empty();
    this.onDone?.();
  }
}
