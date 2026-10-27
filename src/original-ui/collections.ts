// 收藏夹: user-made collections of designs ("save it for reference").
// Stored in plugin settings as ordered lists of design keys, newest first.

import { App, Menu, Modal, Notice, setIcon } from "../harness-ui";
import { t } from "./i18n";
import type QiaomuProductGalleryPlugin from "./main";

export interface Collection {
  id: string;
  name: string;
  items: string[]; // design keys, newest first
  created: string;
}

export function collectionsOf(plugin: QiaomuProductGalleryPlugin): Collection[] {
  return plugin.settings.collections;
}

export function collectionsContaining(plugin: QiaomuProductGalleryPlugin, key: string): Collection[] {
  return plugin.settings.collections.filter((c) => c.items.includes(key));
}

export function createCollection(plugin: QiaomuProductGalleryPlugin, name: string): Collection {
  const c: Collection = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: name.trim() || t("collection.untitled"),
    items: [],
    created: new Date().toISOString(),
  };
  plugin.settings.collections.push(c);
  return c;
}

/** Returns true when the item was added, false when removed. */
export function toggleInCollection(c: Collection, key: string): boolean {
  const i = c.items.indexOf(key);
  if (i >= 0) {
    c.items.splice(i, 1);
    return false;
  }
  c.items.unshift(key);
  return true;
}

class NameModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private initial: string,
    private onSubmit: (name: string) => void,
  ) {
    super(app);
    this.modalEl.addClass("qpg-name-modal");
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createDiv("qpg-name-title").setText(this.title);
    const input = contentEl.createEl("input", { cls: "qpg-name-input", type: "text", placeholder: t("collection.namePlaceholder") });
    input.value = this.initial;
    const row = contentEl.createDiv("qpg-name-actions");
    const cancel = row.createEl("button", { cls: "qpg-name-btn" });
    cancel.setText(t("collection.cancel"));
    cancel.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { cls: "qpg-name-btn is-primary" });
    ok.setText(t("collection.save"));
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      this.close();
      this.onSubmit(v);
    };
    ok.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

export function promptName(app: App, title: string, initial: string, cb: (name: string) => void): void {
  new NameModal(app, title, initial, cb).open();
}

/** "Save to…" menu for one design: toggle membership, or create a new collection. */
export function openSaveMenu(
  plugin: QiaomuProductGalleryPlugin,
  at: MouseEvent | { x: number; y: number },
  key: string,
  onChange: () => void,
): void {
  const menu = new Menu();
  const list = collectionsOf(plugin);
  for (const c of list) {
    menu.addItem((it) =>
      it
        .setTitle(`${c.name}  ·  ${c.items.length}`)
        .setIcon(c.items.includes(key) ? "check" : "bookmark")
        .setChecked(c.items.includes(key))
        .onClick(() => {
          const added = toggleInCollection(c, key);
          void plugin.saveSettings();
          new Notice(t(added ? "collection.added" : "collection.removed", { name: c.name }));
          onChange();
        }),
    );
  }
  if (list.length) menu.addSeparator();
  menu.addItem((it) =>
    it
      .setTitle(t("collection.new"))
      .setIcon("plus")
      .onClick(() =>
        promptName(plugin.app, t("collection.new"), "", (name) => {
          const c = createCollection(plugin, name);
          toggleInCollection(c, key);
          void plugin.saveSettings();
          new Notice(t("collection.added", { name: c.name }));
          onChange();
        }),
      ),
  );
  if (at instanceof MouseEvent) menu.showAtMouseEvent(at);
  else menu.showAtPosition(at);
}

export function bookmarkIcon(el: HTMLElement, saved: boolean): void {
  setIcon(el, "bookmark");
  el.toggleClass("is-saved", saved);
}

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private text: string,
    private onYes: () => void,
  ) {
    super(app);
    this.modalEl.addClass("qpg-name-modal");
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createDiv("qpg-name-title").setText(this.text);
    const row = contentEl.createDiv("qpg-name-actions");
    const no = row.createEl("button", { cls: "qpg-name-btn" });
    no.setText(t("collection.cancel"));
    no.addEventListener("click", () => this.close());
    const yes = row.createEl("button", { cls: "qpg-name-btn is-danger" });
    yes.setText(t("collection.delete"));
    yes.addEventListener("click", () => {
      this.close();
      this.onYes();
    });
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

/** Right-click menu for a collection row: rename / delete. */
export function openCollectionMenu(
  plugin: QiaomuProductGalleryPlugin,
  c: Collection,
  evt: MouseEvent,
  onChange: () => void,
  onDeleted: () => void,
): void {
  const menu = new Menu();
  menu.addItem((it) =>
    it
      .setTitle(t("collection.rename"))
      .setIcon("pencil")
      .onClick(() =>
        promptName(plugin.app, t("collection.rename"), c.name, (name) => {
          c.name = name;
          void plugin.saveSettings();
          onChange();
        }),
      ),
  );
  menu.addItem((it) =>
    it
      .setTitle(t("collection.delete"))
      .setIcon("trash-2")
      .onClick(() =>
        new ConfirmModal(plugin.app, t("collection.deleteAsk", { name: c.name }), () => {
          plugin.settings.collections = plugin.settings.collections.filter((x) => x.id !== c.id);
          void plugin.saveSettings();
          new Notice(t("collection.deleted"));
          onDeleted();
        }).open(),
      ),
  );
  menu.showAtMouseEvent(evt);
}
