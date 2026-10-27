import { createEl, onRemove } from "../harness-ui";
// Shared render helpers for Learn UI surfaces (detail modals, quiz, lists).

import { Notice } from "../harness-ui";
import { t } from "./i18n";
import { LearnKind } from "./learnui-data";
import type QiaomuProductGalleryPlugin from "./main";

export async function copyText(text: string, message?: string | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    if(message!==null)new Notice(message ?? t("modal.copied"));
    return true;
  } catch { new Notice(t("modal.copyFailed")); return false; }
}

/**
 * Live interactive specimen inside a sandboxed iframe (srcdoc).
 * Lazy: the demo HTML is read from the plugin dir on demand.
 */
export async function renderDemoFrame(
  container: HTMLElement,
  plugin: QiaomuProductGalleryPlugin,
  kind: LearnKind,
  slug: string,
  height = 320,
): Promise<void> {
  const frame = container.createDiv("qpg-demo-frame");
  frame.style.height = `${height}px`;
  const loading = frame.createDiv("qpg-demo-loading");
  loading.setText(t("learn.demoLoading"));
  let html: string | null = null;
  try {
    html = await plugin.loadDemoHtml(kind, slug);
  } catch {
    html = null;
  }
  if (frame.isConnected === false) return; // modal closed while loading
  if (!html) {
    loading.setText(t("learn.demoMissing"));
    return;
  }
  loading.remove();
  const iframe = createEl("iframe");
  iframe.className = "qpg-demo-iframe";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.srcdoc = html;
  frame.appendChild(iframe);
}

/**
 * Non-interactive live specimen for list cards. Created on demand (the caller
 * passes an IntersectionObserver-driven `mount`), so 60+ cards stay cheap.
 */
export function specimenSlot(container: HTMLElement, kind: LearnKind, slug: string): HTMLElement {
  const slot = container.createDiv("qpg-spec");
  slot.setAttr("data-kind", kind);
  slot.setAttr("data-slug", slug);
  slot.createDiv("qpg-spec-skel");
  return slot;
}

export async function mountSpecimen(slot: HTMLElement, plugin: QiaomuProductGalleryPlugin): Promise<void> {
  const kind = slot.getAttr("data-kind") as LearnKind;
  const slug = slot.getAttr("data-slug") ?? "";
  let html: string | null = null;
  try {
    html = await plugin.loadDemoHtml(kind, slug, true);
  } catch {
    html = null;
  }
  if (!slot.isConnected) return;
  if (!html) {
    slot.empty();
    slot.addClass("is-missing");
    return;
  }
  const iframe = createEl("iframe");
  iframe.className = "qpg-spec-iframe";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("tabindex", "-1");
  iframe.setAttribute("aria-hidden", "true");
  // Render on a fixed virtual canvas (demos are designed for ~400px stages), then scale the
  // whole frame to the slot, so thumbnails show the specimen whole at any card size.
  const CANVAS_W = 420;
  const CANVAS_H = 289;
  const layout = () => {
    const w = slot.clientWidth;
    const h = slot.clientHeight;
    if (!w || !h) return;
    const scale = Math.min(w / CANVAS_W, h / CANVAS_H);
    const x = (w - CANVAS_W * scale) / 2;
    const y = (h - CANVAS_H * scale) / 2;
    iframe.style.width = `${CANVAS_W}px`;
    iframe.style.height = `${CANVAS_H}px`;
    iframe.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(slot);
  onRemove(slot, () => ro.disconnect());

  // Keep the shimmer until the specimen has actually painted.
  iframe.addEventListener("load", () => {
    slot.querySelector(".qpg-spec-skel")?.remove();
    slot.addClass("is-live");
  });
  iframe.srcdoc = html;
  slot.appendChild(iframe);
}

/** Bilingual section heading. */
export function sectionTitle(container: HTMLElement, text: string): void {
  container.createDiv("qpg-learn-section-title").setText(text);
}

/** Code/prompt block with a copy button. */
export function promptBlock(
  container: HTMLElement,
  code: string,
  cls = "qpg-prompt",
  maxLines = 0,
): void {
  const wrap = container.createDiv(cls);
  const pre = wrap.createEl("pre");
  const codeEl = pre.createEl("code");
  const trimmed = maxLines > 0 ? truncateLines(code, maxLines) : code;
  codeEl.setText(trimmed);
  if (trimmed !== code) {
    const more = wrap.createDiv("qpg-prompt-more");
    more.setText(t("learn.showAll"));
    more.addEventListener("click", () => {
      codeEl.setText(code);
      more.remove();
    });
  }
  const copy = wrap.createEl("button", { cls: "qpg-prompt-copy", attr: { "aria-label": t("modal.copyPrompt") } });
  copy.setText(t("modal.copyPrompt"));
  copy.addEventListener("click", () => copyText(code));
}

function truncateLines(s: string, max: number): string {
  const lines = s.split("\n");
  if (lines.length <= max) return s;
  return lines.slice(0, max).join("\n") + "\n…";
}

/** Small pill chip; returns the element so callers can wire clicks. */
export function chip(container: HTMLElement, text: string, cls = ""): HTMLElement {
  const el = container.createSpan("qpg-chip" + (cls ? ` ${cls}` : ""));
  el.setText(text);
  return el;
}
