import { onRemove } from "../harness-ui";
// Small shared UI primitives: a segmented control with a sliding thumb.

export interface SegOption<T extends string> {
  id: T;
  label?: string;
  icon?: (el: HTMLElement) => void;
  title?: string;
}

export interface Segmented<T extends string> {
  el: HTMLElement;
  set(id: T): void;
}

/** Pill-shaped segmented control; the thumb glides to the active option. */
export function segmented<T extends string>(
  parent: HTMLElement,
  options: SegOption<T>[],
  active: T,
  onChange: (id: T) => void,
  cls = "",
): Segmented<T> {
  const el = parent.createDiv("qpg-seg" + (cls ? ` ${cls}` : ""));
  el.setAttr("role", "tablist");
  const thumb = el.createDiv("qpg-seg-thumb");
  const buttons = new Map<T, HTMLElement>();

  const place = () => {
    const btn = buttons.get(current);
    if (!btn || btn.offsetWidth === 0) return;
    thumb.style.width = `${btn.offsetWidth}px`;
    thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
    thumb.addClass("is-ready");
  };

  let current = active;
  for (const opt of options) {
    const btn = el.createEl("button", {
      cls: "qpg-seg-btn" + (opt.id === active ? " is-active" : ""),
      attr: { role: "tab", ...(opt.title ? { "aria-label": opt.title, title: opt.title } : {}) },
    });
    if (opt.icon) opt.icon(btn.createSpan("qpg-seg-icon"));
    if (opt.label) btn.createSpan("qpg-seg-label").setText(opt.label);
    btn.addEventListener("click", () => {
      if (current === opt.id) return;
      set(opt.id);
      onChange(opt.id);
    });
    buttons.set(opt.id, btn);
  }

  function set(id: T) {
    current = id;
    buttons.forEach((b, k) => {
      b.toggleClass("is-active", k === id);
      b.setAttr("aria-selected", String(k === id));
    });
    place();
  }

  // Re-measure when the control becomes visible / resizes (fonts, hidden panes).
  const ro = new ResizeObserver(() => place());
  ro.observe(el);
  onRemove(el, () => ro.disconnect());
  buttons.forEach((b) => ro.observe(b));
  (el.ownerDocument.defaultView ?? window).requestAnimationFrame(place);

  return { el, set };
}

/**
 * Instant, styled tooltip via event delegation. Mark any element with
 * `data-tip` (+ optional `data-tip-sub`, `data-tip-side="right"|"top"`).
 */
export function installTooltips(root: HTMLElement): () => void {
  const tip = root.createDiv("qpg-tip");
  const main = tip.createDiv("qpg-tip-main");
  const sub = tip.createDiv("qpg-tip-sub");
  let current: HTMLElement | null = null;

  const show = (el: HTMLElement) => {
    current = el;
    main.setText(el.getAttr("data-tip") ?? "");
    const s = el.getAttr("data-tip-sub") ?? "";
    sub.setText(s);
    sub.toggleClass("is-hidden", !s);
    tip.addClass("is-on");
    // Anchor to the label itself (tight text box), not the full-width row.
    const sel = el.getAttr("data-tip-anchor");
    const anchor = (sel ? el.querySelector<HTMLElement>(sel) : null) ?? el;
    let r: DOMRect;
    if (anchor.scrollWidth > anchor.clientWidth + 1) {
      r = anchor.getBoundingClientRect(); // truncated label: use its box, not the overflowing text
    } else {
      const range = document.createRange();
      range.selectNodeContents(anchor);
      r = range.getBoundingClientRect();
    }
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const gap = 6;
    let x: number;
    let y: number;
    if (el.getAttr("data-tip-side") === "right") {
      x = r.right + gap;
      y = r.top + r.height / 2 - th / 2;
      if (x + tw > window.innerWidth - 8) x = r.left - tw - gap;
    } else {
      x = r.left + r.width / 2 - tw / 2;
      y = r.top - th - gap;
      if (y < 8) y = r.bottom + gap;
    }
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - th - 8));
    // `position: fixed` may be relative to a transformed ancestor: measure the real origin.
    tip.style.removeProperty("transform");
    const o = tip.getBoundingClientRect();
    tip.style.transform = `translate(${Math.round(x - o.left)}px, ${Math.round(y - o.top)}px)`;
  };
  const hide = () => {
    current = null;
    tip.removeClass("is-on");
  };

  const over = (e: MouseEvent) => {
    let el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]") ?? null;
    if (el && el.hasAttribute("data-tip-if-truncated")) {
      const sel = el.getAttr("data-tip-anchor");
      const a = (sel ? el.querySelector<HTMLElement>(sel) : null) ?? el;
      if (a.scrollWidth <= a.clientWidth + 1) el = null;
    }
    if (el && el !== current && root.contains(el)) show(el);
    else if (!el && current) hide();
  };
  root.addEventListener("mouseover", over);
  root.addEventListener("mouseleave", hide);
  root.addEventListener("scroll", hide, true);
  root.addEventListener("mousedown", hide, true);
  return () => {
    root.removeEventListener("mouseover", over);
    tip.remove();
  };
}
