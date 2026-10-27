import { createDiv } from "../harness-ui";
import { ItemView, WorkspaceLeaf, setIcon } from "../harness-ui";
import { openUrl } from "./catalog";
import { FlatItem, Kind, KIND_ORDER, sortedCats, thumbUrl } from "./catalog";
import { t } from "./i18n";
import { catSearchText, setCatTip } from "./cat-zh";
import { DesignModal } from "./design-modal";
import { LearnPane, LearnMode } from "./learn-view";
import { getReview, reviewKey } from "./learn-review";
import { installTooltips, segmented, Segmented } from "./ui";
import { collectionsContaining, collectionsOf, openCollectionMenu, openSaveMenu, promptName, createCollection } from "./collections";
import type QiaomuProductGalleryPlugin from "./main";

export const VIEW_TYPE_GALLERY = "qiaomu-ui-learn-view";

const RENDER_CAP = 600;
const BATCH = 80;
const IMAGE_ROOT_MARGIN = "700px";

type ViewMode = "gallery" | LearnMode;
type Density = "s" | "m" | "l";

const MODE_TABS: { id: ViewMode; icon: string; labelKey: string }[] = [
  { id: "gallery", icon: "layout-grid", labelKey: "tab.gallery" },
  { id: "dictionary", icon: "book-open", labelKey: "tab.dictionary" },
  { id: "styles", icon: "palette", labelKey: "tab.styles" },
  { id: "quiz", icon: "target", labelKey: "tab.quiz" },
];

export class GalleryView extends ItemView {
  private plugin: QiaomuProductGalleryPlugin;
  private state: "loading" | "ready" | "error" = "loading";
  private mode: ViewMode = "gallery";
  private learnPane: LearnPane | null = null;
  private nav: Segmented<ViewMode> | null = null;
  private disposeTips: (() => void) | null = null;

  private kind: Kind = "all";
  private catSlug: string | null = null; // null = all categories in kind
  private query = "";
  private reviewedOnly = false;
  private recentOnly = false;
  private collectionId: string | null = null;
  private catHay = new Map<string, string>();
  private recentBtn!: HTMLElement;
  private lastQueryToken = 0;

  private pool: FlatItem[] = [];
  private rendered = 0;
  private resultCount = 0;

  private rootEl!: HTMLElement;
  private searchEl!: HTMLInputElement;
  private searchCountEl!: HTMLElement;
  private galleryPane!: HTMLElement;
  private learnRoot!: HTMLElement;
  private titleEl!: HTMLElement;
  private subEl!: HTMLElement;
  private gridEl!: HTMLElement;
  private listEl!: HTMLElement;
  private mainEl!: HTMLElement;
  private noteEl!: HTMLElement;
  private emptyEl!: HTMLElement;
  private reviewedBtn!: HTMLElement;
  private bodyEl!: HTMLElement;

  private batchObserver: IntersectionObserver | null = null;
  private imageObserver: IntersectionObserver | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: QiaomuProductGalleryPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.mode = plugin.settings.startMode ?? "gallery";
    this.navigation = true;
  }

  getViewType(): string {
    return VIEW_TYPE_GALLERY;
  }
  getDisplayText(): string {
    return t("ribbon.label");
  }
  getIcon(): string {
    return "graduation-cap";
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    this.rootEl = root;
    root.empty();
    root.addClass("qpg");
    root.setAttr("tabindex", "-1");
    this.disposeTips = installTooltips(root);

    // ---- Top bar: mode switcher + one search that follows the mode ------------
    const top = root.createDiv("qpg-top");
    this.nav = segmented<ViewMode>(
      top,
      MODE_TABS.map((m) => ({
        id: m.id,
        label: t(m.labelKey),
        icon: (el) => setIcon(el, m.icon),
      })),
      this.mode,
      (id) => this.setMode(id),
      "qpg-nav",
    );
    top.createDiv("qpg-top-spacer");

    const searchWrap = top.createDiv("qpg-search");
    setIcon(searchWrap.createSpan("qpg-search-icon"), "search");
    this.searchEl = searchWrap.createEl("input", {
      cls: "qpg-search-input",
      type: "text",
      placeholder: t("view.search.placeholder"),
    });
    this.searchCountEl = searchWrap.createSpan("qpg-search-count");
    searchWrap.createSpan("qpg-search-kbd").setText("/");
    this.searchEl.addEventListener("input", () => this.onSearchInput(this.searchEl.value.trim()));
    this.searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.searchEl.value) {
          e.stopPropagation();
          this.searchEl.value = "";
          this.onSearchInput("");
        } else {
          this.searchEl.blur();
        }
      }
    });
    root.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
      if (this.mode === "quiz") return;
      e.preventDefault();
      this.searchEl.focus();
      this.searchEl.select();
    });

    // ---- Gallery pane --------------------------------------------------------
    const pane = root.createDiv("qpg-pane qpg-pane-gallery");
    this.galleryPane = pane;
    pane.addClass(`qpg-dens-${this.plugin.settings.density}`);
    if (this.plugin.settings.sideCollapsed) pane.addClass("is-side-collapsed");
    if (this.mode !== "gallery") pane.addClass("is-hidden");

    const bar = pane.createDiv("qpg-toolbar");
    const sideBtn = bar.createEl("button", { cls: "qpg-icon-btn", attr: { "aria-label": t("view.sidebar"), title: t("view.sidebar") } });
    setIcon(sideBtn, "panel-left");
    sideBtn.addEventListener("click", () => {
      const collapsed = !pane.hasClass("is-side-collapsed");
      pane.toggleClass("is-side-collapsed", collapsed);
      this.plugin.settings.sideCollapsed = collapsed;
      void this.plugin.saveSettings();
    });
    const heading = bar.createDiv("qpg-heading");
    this.titleEl = heading.createDiv("qpg-heading-title");
    this.subEl = heading.createDiv("qpg-heading-sub");
    bar.createDiv("qpg-top-spacer");

    this.recentBtn = bar.createEl("button", { cls: "qpg-chip-btn" });
    setIcon(this.recentBtn.createSpan("qpg-chip-btn-icon"), "history");
    this.recentBtn.createSpan().setText(t("view.recentOnly"));
    this.recentBtn.addEventListener("click", () => {
      this.recentOnly = !this.recentOnly;
      if (this.recentOnly) this.collectionId = null;
      this.recentBtn.toggleClass("is-on", this.recentOnly);
      this.buildCatList();
      this.requery();
      this.mainEl.scrollTop = 0;
    });

    this.reviewedBtn = bar.createEl("button", { cls: "qpg-chip-btn" });
    setIcon(this.reviewedBtn.createSpan("qpg-chip-btn-icon"), "star");
    this.reviewedBtn.createSpan().setText(t("view.reviewedOnly"));
    this.reviewedBtn.addEventListener("click", () => {
      this.reviewedOnly = !this.reviewedOnly;
      this.reviewedBtn.toggleClass("is-on", this.reviewedOnly);
      this.requery();
    });

    segmented<Density>(
      bar,
      (["s", "m", "l"] as Density[]).map((d) => ({
        id: d,
        title: `${t("view.density")} · ${t(`view.density.${d}`)}`,
        icon: (el) => el.setText(d === "s" ? "S" : d === "m" ? "M" : "L"),
      })),
      this.plugin.settings.density,
      (d) => {
        pane.removeClass("qpg-dens-s");
        pane.removeClass("qpg-dens-m");
        pane.removeClass("qpg-dens-l");
        pane.addClass(`qpg-dens-${d}`);
        this.plugin.settings.density = d;
        void this.plugin.saveSettings();
      },
      "qpg-seg-sm qpg-density",
    );

    const body = pane.createDiv("qpg-body");
    this.bodyEl = body;
    const side = body.createDiv("qpg-side");
    this.listEl = side.createDiv("qpg-cats");
    this.mainEl = body.createDiv("qpg-main");
    this.emptyEl = this.mainEl.createDiv("qpg-empty is-hidden");
    this.noteEl = this.mainEl.createDiv("qpg-note is-hidden");
    this.gridEl = this.mainEl.createDiv("qpg-grid");

    // ---- Learn pane (dictionary / styles / quiz) ------------------------------
    this.learnRoot = root.createDiv("qpg-pane qpg-pane-learn");
    if (this.mode === "gallery") this.learnRoot.addClass("is-hidden");
    this.learnPane = new LearnPane(this.learnRoot, this.plugin, (n, mode) => {
      if (mode === this.mode) this.setCount(n);
    });

    if (this.plugin.catalog) {
      this.state = "ready";
      this.buildSidebar();
      this.requery();
    } else if (this.plugin.catalogError) {
      this.state = "error";
      this.renderStatus();
    } else {
      this.state = "loading";
      this.renderStatus();
      this.plugin.onCatalogReady.push(() => {
        if (this.state !== "loading") return;
        this.state = this.plugin.catalog ? "ready" : "error";
        this.renderStatus();
        if (this.state === "ready") {
          this.buildSidebar();
          this.requery();
        }
      });
    }
    if (this.mode !== "gallery") this.learnPane.setMode(this.mode);
    this.applyModeChrome();
    this.nav?.set(this.mode);
  }

  private onSearchInput(value: string) {
    if (this.mode === "gallery") {
      this.query = value;
      this.requery();
    } else {
      this.learnPane?.setQuery(value);
    }
  }

  private setCount(n: number | null) {
    this.searchCountEl.setText(n === null ? "" : String(n));
  }

  /** Placeholder / value / visibility of the shared search follow the mode. */
  private applyModeChrome() {
    const m = this.mode;
    const searchWrap = this.searchEl.parentElement!;
    searchWrap.toggleClass("is-off", m === "quiz");
    this.searchEl.disabled = m === "quiz";
    this.searchEl.setAttr(
      "placeholder",
      m === "gallery" ? t("view.search.placeholder") : m === "dictionary" ? t("learn.search.placeholder") : m === "styles" ? t("learn.search.styles") : "",
    );
    this.searchEl.value = m === "gallery" ? this.query : (this.learnPane?.getQuery(m) ?? "");
    if (m === "gallery") this.setCount(this.state === "ready" ? this.resultCount : null);
    else if (m === "quiz") this.setCount(null);
  }

  /** Switch top-level mode; also used by plugin commands. */
  setMode(mode: ViewMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.nav?.set(mode);
    this.galleryPane.toggleClass("is-hidden", mode !== "gallery");
    this.learnRoot.toggleClass("is-hidden", mode === "gallery");
    if (mode !== "gallery") this.learnPane?.setMode(mode);
    else this.learnPane?.leaveQuiz();
    this.applyModeChrome();
    if (mode !== "gallery" && mode !== "quiz") this.learnPane?.refreshCount();
  }

  onClose(): Promise<void> {
    this.detachObservers();
    this.learnPane?.destroy();
    this.disposeTips?.();
    return Promise.resolve();
  }

  private detachObservers() {
    this.batchObserver?.disconnect();
    this.batchObserver = null;
    this.imageObserver?.disconnect();
    this.imageObserver = null;
  }

  private renderStatus() {
    this.gridEl.empty();
    this.emptyEl.empty();
    if (this.state === "loading") {
      this.emptyEl.removeClass("is-hidden");
      this.emptyEl.createDiv("qpg-spinner");
      this.emptyEl.createDiv("qpg-empty-hint").setText(t("view.loading"));
    } else if (this.state === "error") {
      this.emptyEl.removeClass("is-hidden");
      this.emptyEl.createDiv("qpg-empty-title").setText(t("view.error"));
    } else {
      this.emptyEl.addClass("is-hidden");
    }
  }

  // ---- Sidebar ----------------------------------------------------------------

  private buildSidebar() {
    this.buildCatList();
  }

  private buildCatList() {
    const catalog = this.plugin.catalog!;
    this.listEl.empty();
    const noFilter = !this.catSlug && !this.collectionId;
    const all = this.listEl.createEl("button", { cls: "qpg-cat" + (noFilter ? " is-active" : "") });
    all.createSpan("qpg-cat-name").setText(t("view.kind.all"));
    all.createSpan("qpg-cat-count").setText(String(this.kind === "all" ? catalog.total : this.kindTotal()));
    all.addEventListener("click", () => this.selectCat(all, null));

    // Collections (user-made)
    const head = this.listEl.createDiv("qpg-cat-group qpg-cat-group-row");
    head.createSpan().setText(t("collection.title"));
    const add = head.createEl("button", { cls: "qpg-mini-btn", attr: { "aria-label": t("collection.new"), title: t("collection.new") } });
    setIcon(add, "plus");
    add.addEventListener("click", () =>
      promptName(this.plugin.app, t("collection.new"), "", (name) => {
        const c = createCollection(this.plugin, name);
        void this.plugin.saveSettings();
        this.selectCollection(c.id);
      }),
    );
    for (const c of collectionsOf(this.plugin)) {
      const row = this.listEl.createEl("button", { cls: "qpg-cat" + (this.collectionId === c.id ? " is-active" : "") });
      setIcon(row.createSpan("qpg-cat-icon"), "bookmark");
      row.createSpan("qpg-cat-name").setText(c.name);
      row.createSpan("qpg-cat-count").setText(String(c.items.length));
      row.addEventListener("click", () => this.selectCollection(c.id));
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openCollectionMenu(
          this.plugin,
          c,
          e,
          () => {
            this.buildCatList();
            this.renderGrid(true);
          },
          () => {
            if (this.collectionId === c.id) this.collectionId = null;
            this.buildCatList();
            this.requery();
          },
        );
      });
    }

    const makeRow = (cat: { n: string; s: string; c: number }) => {
      const row = this.listEl.createEl("button", {
        cls: "qpg-cat" + (this.catSlug === cat.s ? " is-active" : ""),
        attr: { "data-slug": cat.s },
      });
      row.createSpan("qpg-cat-name").setText(cat.n);
      row.createSpan("qpg-cat-count").setText(String(cat.c));
      setCatTip(row, cat.s, cat.n, "right");
      row.setAttr("data-tip-anchor", ".qpg-cat-name");
      row.addEventListener("click", () => this.selectCat(row, cat.s));
    };

    const cats = sortedCats(catalog);
    for (const k of KIND_ORDER) {
      const group = cats.filter((c) => c.k === k && (this.kind === "all" || c.k === this.kind));
      if (group.length === 0) continue;
      this.listEl.createDiv("qpg-cat-group").setText(t(`view.kind.${k}`));
      for (const cat of group) makeRow(cat);
    }
  }

  private selectCollection(id: string) {
    this.collectionId = id;
    this.catSlug = null;
    this.recentOnly = false;
    this.recentBtn.removeClass("is-on");
    this.buildCatList();
    this.requery();
    this.mainEl.scrollTop = 0;
  }

  private kindTotal(): number {
    const catalog = this.plugin.catalog!;
    return catalog.cats.filter((c) => c.k === this.kind).reduce((acc, c) => acc + c.c, 0);
  }

  private selectCat(row: HTMLElement, slug: string | null) {
    this.catSlug = slug;
    this.collectionId = null;
    if (this.recentOnly) {
      this.recentOnly = false;
      this.recentBtn.removeClass("is-on");
    }
    this.listEl.querySelectorAll(".qpg-cat").forEach((el) => el.removeClass("is-active"));
    row.addClass("is-active");
    row.scrollIntoView({ block: "nearest" });
    this.requery();
    this.mainEl.scrollTop = 0;
  }

  // ---- Query / render ---------------------------------------------------------

  private requery() {
    const token = ++this.lastQueryToken;
    const catalog = this.plugin.catalog;
    if (!catalog) return;

    const q = this.query.toLowerCase();
    let pool: FlatItem[];
    const col = this.collectionId ? collectionsOf(this.plugin).find((c) => c.id === this.collectionId) : undefined;
    if (this.collectionId && !col) this.collectionId = null;
    if (col) pool = this.plugin.itemsByKeys(col.items);
    else if (this.recentOnly) pool = this.plugin.recentItems();
    else if (this.catSlug) pool = this.plugin.flatItems.filter((it) => it.cat.s === this.catSlug);
    else pool = this.plugin.flatItems;

    if (q) {
      // Name matches rank first (prefix, then contains); then category, then your own tags / notes.
      const scored: [FlatItem, number][] = [];
      for (const it of pool) {
        if (it.lowerName.startsWith(q)) scored.push([it, 0]);
        else if (it.lowerName.includes(q)) scored.push([it, 1]);
        else if (this.catText(it).includes(q)) scored.push([it, 2]);
        else if (this.reviewText(it).includes(q)) scored.push([it, 3]);
      }
      pool = scored.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    }

    if (this.reviewedOnly) {
      const reviews = this.plugin.settings.learnReviews;
      pool = pool.filter((it) => !!reviews[reviewKey("design", it.key)]);
    }

    this.pool = pool;
    this.resultCount = pool.length;
    this.rendered = 0;
    if (token !== this.lastQueryToken) return;
    this.renderGrid(true);
  }

  /** Your own tags and note for a design, so personal labels are searchable. */
  private reviewText(it: FlatItem): string {
    const r = this.plugin.settings.learnReviews[reviewKey("design", it.key)];
    return r ? `${(r.tags ?? []).join(" ")} ${r.note ?? ""}`.toLowerCase() : "";
  }

  private catText(it: FlatItem): string {
    let h = this.catHay.get(it.cat.s);
    if (h === undefined) {
      h = catSearchText(it.cat.s, it.cat.n);
      this.catHay.set(it.cat.s, h);
    }
    return h;
  }

  private headingText(): string {
    if (this.collectionId) return collectionsOf(this.plugin).find((c) => c.id === this.collectionId)?.name ?? "";
    if (this.recentOnly) return t("view.recentOnly");
    const catalog = this.plugin.catalog!;
    if (this.catSlug) return catalog.cats.find((c) => c.s === this.catSlug)?.n ?? "";
    return this.kind === "all" ? t("view.title.all") : t(`view.kind.${this.kind}`);
  }

  private renderGrid(reset: boolean) {
    if (reset) {
      this.gridEl.empty();
      this.batchObserver?.disconnect();
      this.batchObserver = null;
    }

    this.titleEl.setText(this.headingText());
    this.subEl.setText(t("view.count", { n: this.resultCount.toLocaleString() }));
    if (this.mode === "gallery") this.setCount(this.resultCount);

    const capped = this.resultCount > RENDER_CAP;
    if (capped && this.rendered === 0) {
      this.noteEl.setText(t("view.capNote", { n: RENDER_CAP, total: this.resultCount.toLocaleString() }));
      this.noteEl.removeClass("is-hidden");
    } else if (!capped) {
      this.noteEl.addClass("is-hidden");
    }

    if (this.resultCount === 0) {
      this.emptyEl.empty();
      this.emptyEl.removeClass("is-hidden");
      const special = this.reviewedOnly || this.recentOnly || !!this.collectionId;
      setIcon(this.emptyEl.createDiv("qpg-empty-icon"), this.reviewedOnly ? "star" : this.collectionId ? "bookmark" : this.recentOnly ? "history" : "search-x");
      this.emptyEl.createDiv("qpg-empty-title").setText(
        this.reviewedOnly ? t("view.reviewedEmpty") : this.collectionId ? t("collection.empty") : this.recentOnly ? t("view.recentEmpty") : t("view.empty.title"),
      );
      if (!special) this.emptyEl.createDiv("qpg-empty-hint").setText(t("view.empty.hint"));
      this.gridEl.addClass("is-hidden");
      this.noteEl.addClass("is-hidden");
      return;
    }
    this.emptyEl.addClass("is-hidden");
    this.gridEl.removeClass("is-hidden");

    const slice = this.pool.slice(this.rendered, Math.min(this.rendered + BATCH, RENDER_CAP));
    const frag = new DocumentFragment();
    slice.forEach((item, i) => frag.appendChild(this.buildCard(item, reset ? i : 0)));
    this.gridEl.appendChild(frag);
    this.rendered += slice.length;

    this.setupObservers();
  }

  private buildCard(item: FlatItem, i: number): HTMLElement {
    const card = createDiv("qpg-card");
    card.setAttr("data-key", item.key);
    card.setAttr("tabindex", "0");
    card.setAttr("role", "button");
    card.style.setProperty("--qpg-i", String(Math.min(i, 14)));
    const frame = card.createDiv("qpg-card-frame");
    const img = frame.createEl("img", { cls: "qpg-card-img" });
    img.decoding = "async";
    img.draggable = false;
    img.alt = "";
    const url = thumbUrl(item.row);
    if (url) {
      img.setAttr("data-src", url);
      img.addEventListener("load", () => frame.addClass("is-loaded"));
      img.addEventListener("error", () => {
        frame.addClass("is-empty");
        img.remove();
      });
    } else {
      frame.addClass("is-empty");
      img.remove();
    }
    frame.createDiv("qpg-card-missing").setText(item.row[0].slice(0, 1));

    const review = getReview(this.plugin, reviewKey("design", item.key));
    if (review.rating) {
      const badge = frame.createDiv("qpg-card-badge");
      setIcon(badge.createSpan("qpg-card-badge-icon"), "star");
      badge.createSpan().setText(String(review.rating));
    } else if (review.note || review.tags?.length) {
      setIcon(frame.createDiv("qpg-card-badge is-note"), "pencil");
    }

    const save = frame.createEl("button", { cls: "qpg-card-save", attr: { "aria-label": t("collection.add"), "data-tip": t("collection.add"), "data-tip-side": "top" } });
    const paintSave = () => {
      const saved = collectionsContaining(this.plugin, item.key).length > 0;
      setIcon(save, "bookmark");
      save.toggleClass("is-saved", saved);
    };
    paintSave();
    save.addEventListener("click", (e) => {
      e.stopPropagation();
      openSaveMenu(this.plugin, e, item.key, () => {
        paintSave();
        this.buildCatList();
        if (this.collectionId) this.requery();
      });
    });
    save.addEventListener("keydown", (e) => e.stopPropagation());

    const meta = card.createDiv("qpg-card-meta");
    meta.createDiv("qpg-card-name").setText(item.row[0]);
    const catEl = meta.createDiv("qpg-card-cat");
    catEl.setText(item.cat.n);
    setCatTip(catEl, item.cat.s, item.cat.n);
    card.addEventListener("click", () => { void this.openItem(item); });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void this.openItem(item);
      }
    });
    return card;
  }

  private setupObservers() {
    if (!this.imageObserver) {
      this.imageObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const img = entry.target as HTMLImageElement;
            this.imageObserver?.unobserve(img);
            const src = img.getAttr("data-src");
            if (src && !img.src) img.src = src;
          }
        },
        { root: this.mainEl, rootMargin: IMAGE_ROOT_MARGIN },
      );
    }
    if (!this.batchObserver) {
      this.batchObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.batchObserver?.unobserve(entry.target);
            if (this.rendered < Math.min(this.resultCount, RENDER_CAP)) this.renderGrid(false);
            break;
          }
        },
        { root: this.mainEl, rootMargin: "900px" },
      );
    }

    this.gridEl.querySelectorAll<HTMLImageElement>("img.qpg-card-img:not([src])").forEach((img) => {
      this.imageObserver!.observe(img);
    });
    const cards = this.gridEl.querySelectorAll<HTMLElement>(".qpg-card");
    const last = cards[cards.length - 1];
    if (last) this.batchObserver.observe(last);
  }

  async openItem(item: FlatItem) {
    if (this.plugin.settings.clickAction === "browser") {
      window.open(openUrl(item.row, item.cat.k), "_blank");
      return;
    }
    const idx = this.pool.indexOf(item);
    new DesignModal(this.app, this.plugin, this.pool, idx >= 0 ? idx : 0, () => this.refreshBadges()).open();
  }

  /** Reviews may change inside the lightbox; refresh badges when it closes. */
  private refreshBadges() {
    this.buildCatList();
    if (this.reviewedOnly || this.collectionId) {
      this.requery();
      return;
    }
    this.gridEl.querySelectorAll<HTMLElement>(".qpg-card").forEach((card) => {
      const key = card.getAttr("data-key");
      if (!key) return;
      const frame = card.querySelector<HTMLElement>(".qpg-card-frame");
      card.querySelector(".qpg-card-save")?.toggleClass("is-saved", collectionsContaining(this.plugin, key).length > 0);
      frame?.querySelector(".qpg-card-badge")?.remove();
      const review = getReview(this.plugin, reviewKey("design", key));
      if (!frame) return;
      if (review.rating) {
        const badge = frame.createDiv("qpg-card-badge");
        setIcon(badge.createSpan("qpg-card-badge-icon"), "star");
        badge.createSpan().setText(String(review.rating));
      } else if (review.note || review.tags?.length) {
        setIcon(frame.createDiv("qpg-card-badge is-note"), "pencil");
      }
    });
  }
}
