// Learn pane: UI 词典 / 风格图鉴 as specimen galleries (every card shows the live
// component), a rotating daily pick, and the quiz host. Mode switching and the
// shared search box live in gallery-view.ts.

import { setIcon } from "../harness-ui";
import { t } from "./i18n";
import { dailyPick, LearnData, LearnEntry, LearnStyle, searchLearn } from "./learnui-data";
import { LearnEntryModal } from "./learn-entry-modal";
import { LearnStyleModal } from "./learn-style-modal";
import { LearnQuiz } from "./learn-quiz";
import { mountSpecimen, specimenSlot } from "./learn-shared";
import { segmented } from "./ui";
import type QiaomuProductGalleryPlugin from "./main";

export type LearnMode = "dictionary" | "styles" | "quiz";

export class LearnPane {
  private plugin: QiaomuProductGalleryPlugin;
  private root: HTMLElement;
  private mode: LearnMode = "dictionary";
  private queries: Record<"dictionary" | "styles", string> = { dictionary: "", styles: "" };
  private platform = "all";
  private onCount: (n: number, mode: LearnMode) => void;

  private barEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private subEl!: HTMLElement;
  private filterEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private quizHost!: HTMLElement;
  private quiz: LearnQuiz | null = null;
  private specObserver: IntersectionObserver | null = null;

  constructor(root: HTMLElement, plugin: QiaomuProductGalleryPlugin, onCount: (n: number, mode: LearnMode) => void) {
    this.root = root;
    this.plugin = plugin;
    this.onCount = onCount;
    this.build();
    if (!plugin.learnui) {
      plugin.onLearnuiReady.push(() => {
        if (this.mode === "quiz") this.quiz?.render();
        else this.renderContent();
        this.buildFilters();
      });
    }
  }

  private build(): void {
    this.root.empty();
    this.root.addClass("qpg-learn");

    this.barEl = this.root.createDiv("qpg-toolbar qpg-learn-bar");
    const heading = this.barEl.createDiv("qpg-heading");
    this.titleEl = heading.createDiv("qpg-heading-title");
    this.subEl = heading.createDiv("qpg-heading-sub");
    this.barEl.createDiv("qpg-top-spacer");
    this.filterEl = this.barEl.createDiv("qpg-learn-filters");

    this.contentEl = this.root.createDiv("qpg-learn-content qpg-learn-list");
    this.quizHost = this.root.createDiv("qpg-quiz-host is-hidden");
  }

  // ---- public API used by GalleryView ----------------------------------------

  setMode(mode: LearnMode): void {
    const prev = this.mode;
    this.mode = mode;
    const isQuiz = mode === "quiz";
    this.barEl.toggleClass("is-hidden", isQuiz);
    this.contentEl.toggleClass("is-hidden", isQuiz);
    this.quizHost.toggleClass("is-hidden", !isQuiz);
    if (isQuiz) {
      if (!this.quiz) this.quiz = new LearnQuiz(this.quizHost, this.plugin);
      this.quiz.setActive(true);
      return;
    }
    this.quiz?.setActive(false);
    if (prev !== mode) this.contentEl.scrollTop = 0;
    this.buildFilters();
    this.renderContent();
  }

  leaveQuiz(): void {
    this.quiz?.setActive(false);
  }

  setQuery(q: string): void {
    if (this.mode === "quiz") return;
    this.queries[this.mode] = q;
    this.renderContent();
  }

  getQuery(mode: ViewModeLike): string {
    return mode === "dictionary" || mode === "styles" ? this.queries[mode] : "";
  }

  refreshCount(): void {
    this.renderContent();
  }

  destroy(): void {
    this.specObserver?.disconnect();
    this.specObserver = null;
    this.quiz?.destroy();
    this.quiz = null;
  }

  // ---- rendering -------------------------------------------------------------

  private buildFilters(): void {
    this.filterEl.empty();
    const data = this.plugin.learnui;
    if (this.mode !== "dictionary" || !data) return;
    const platforms = ["all", ...Array.from(new Set(data.entries.map((e) => e.platform)))];
    if (platforms.length < 3) return;
    segmented<string>(
      this.filterEl,
      platforms.map((p) => ({ id: p, label: p === "all" ? t("learn.platform.all") : p === "macos" ? "macOS" : p === "web" ? "Web" : p })),
      this.platform,
      (id) => {
        this.platform = id;
        this.renderContent();
      },
      "qpg-seg-sm",
    );
  }

  private ensureObserver(): IntersectionObserver {
    if (!this.specObserver) {
      this.specObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            this.specObserver?.unobserve(e.target);
            void mountSpecimen(e.target as HTMLElement, this.plugin);
          }
        },
        { root: this.contentEl, rootMargin: "240px" },
      );
    }
    return this.specObserver;
  }

  private renderContent(): void {
    if (this.mode === "quiz") return;
    const data = this.plugin.learnui;
    this.specObserver?.disconnect();
    this.specObserver = null;
    this.contentEl.empty();
    this.titleEl.setText(this.mode === "styles" ? t("tab.styles") : t("tab.dictionary"));
    if (!data) {
      this.subEl.setText("");
      this.contentEl.createDiv("qpg-empty").createDiv(this.plugin.learnuiError ? "qpg-empty-title" : "qpg-spinner");
      if (!this.plugin.learnuiError) this.contentEl.querySelector(".qpg-empty")!.createDiv("qpg-empty-hint").setText(t("learn.loading"));
      else this.contentEl.querySelector(".qpg-empty-title")!.setText(t("view.error"));
      return;
    }
    if (this.mode === "styles") this.renderStyles(data);
    else this.renderEntries(data);
  }

  private feature(data: LearnData): void {
    const isStyle = this.mode === "styles";
    const item: LearnEntry | LearnStyle = isStyle ? dailyPick(data.styles, 17) : dailyPick(data.entries, 0);
    const open = () => (isStyle ? new LearnStyleModal(this.plugin, item as LearnStyle) : new LearnEntryModal(this.plugin, item as LearnEntry)).open();

    const card = this.contentEl.createDiv("qpg-feature");
    card.setAttr("tabindex", "0");
    card.setAttr("role", "button");
    const stage = card.createDiv("qpg-feature-stage");
    const slot = specimenSlot(stage, isStyle ? "style" : "entry", item.slug);
    this.ensureObserver().observe(slot);
    const body = card.createDiv("qpg-feature-body");
    body.createDiv("qpg-kicker").setText(t("learn.daily.label"));
    const title = body.createDiv("qpg-feature-title");
    if (item.nameZh) title.createSpan("qpg-feature-zh").setText(item.nameZh);
    title.createSpan("qpg-feature-en").setText(item.name);
    body.createDiv("qpg-feature-tag").setText((item.taglineZh ?? item.tagline) || "");
    const cta = body.createDiv("qpg-feature-cta");
    cta.createSpan().setText(isStyle ? t("learn.openStyle") : t("learn.open"));
    setIcon(cta.createSpan("qpg-feature-arrow"), "arrow-right");
    body.createDiv("qpg-feature-hint").setText(t("learn.daily.hint"));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  private card(grid: HTMLElement, i: number, o: {
    kind: "entry" | "style";
    slug: string;
    nameZh: string | null;
    name: string;
    tagline: string;
    tag?: string;
    open: () => void;
  }): void {
    const card = grid.createDiv("qpg-lcard");
    card.setAttr("tabindex", "0");
    card.setAttr("role", "button");
    card.style.setProperty("--qpg-i", String(Math.min(i, 12)));
    const stage = card.createDiv("qpg-lcard-stage");
    const slot = specimenSlot(stage, o.kind, o.slug);
    this.ensureObserver().observe(slot);
    if (o.tag) stage.createDiv("qpg-lcard-tag").setText(o.tag);
    const body = card.createDiv("qpg-lcard-body");
    const title = body.createDiv("qpg-lcard-title");
    if (o.nameZh) title.createSpan("qpg-lcard-zh").setText(o.nameZh);
    title.createSpan("qpg-lcard-en").setText(o.name);
    body.createDiv("qpg-lcard-tagline").setText(o.tagline);
    card.addEventListener("click", o.open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        o.open();
      }
    });
  }

  private renderEntries(data: LearnData): void {
    const q = this.queries.dictionary;
    let { entries } = searchLearn(data, q);
    if (this.platform !== "all") entries = entries.filter((e) => e.platform === this.platform);
    this.subEl.setText(t("learn.count.entries", { n: entries.length }));
    this.onCount(entries.length, "dictionary");
    if (!q && this.platform === "all") this.feature(data);

    const grid = this.contentEl.createDiv("qpg-lgrid");
    if (entries.length === 0) return this.empty();
    entries.forEach((e, i) =>
      this.card(grid, i, {
        kind: "entry",
        slug: e.slug,
        nameZh: e.nameZh,
        name: e.name,
        tagline: (e.taglineZh ?? e.tagline) || "",
        tag: e.platform === "macos" ? "macOS" : undefined,
        open: () => new LearnEntryModal(this.plugin, e).open(),
      }),
    );
  }

  private renderStyles(data: LearnData): void {
    const q = this.queries.styles;
    const { styles } = searchLearn(data, q);
    const sorted = [...styles].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    this.subEl.setText(t("learn.count.styles", { n: sorted.length }));
    this.onCount(sorted.length, "styles");
    if (!q) this.feature(data);

    const grid = this.contentEl.createDiv("qpg-lgrid");
    if (sorted.length === 0) return this.empty();
    sorted.forEach((s, i) => {
      const tag = (s.taglineZh ?? s.tagline) || "";
      this.card(grid, i, {
        kind: "style",
        slug: s.slug,
        nameZh: s.nameZh,
        name: s.name,
        tagline: tag.length > 70 ? tag.slice(0, 70) + "…" : tag,
        open: () => new LearnStyleModal(this.plugin, s).open(),
      });
    });
  }

  private empty(): void {
    const box = this.contentEl.createDiv("qpg-empty");
    setIcon(box.createDiv("qpg-empty-icon"), "search-x");
    box.createDiv("qpg-empty-title").setText(t("view.empty.title"));
    box.createDiv("qpg-empty-hint").setText(t("view.empty.hint"));
  }
}

type ViewModeLike = "gallery" | LearnMode;
