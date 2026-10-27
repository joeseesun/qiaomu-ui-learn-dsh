import {copyText} from "./learn-shared";
import { App, Notice, PluginSettingTab, Setting, setIcon } from "../harness-ui";
import { exportAllLearnNotes } from "./learn-review";
import { t } from "./i18n";
import type QiaomuProductGalleryPlugin from "./main";

const DONATE_QR = "https://radio.qiaomu.ai/assets/qiaomu_reward_qr.png";
const FOLLOW_QR = "https://radio.qiaomu.ai/assets/qiaomu_wechat_public_account_qr.jpg";
const WECHAT_ID = "joeseesun";


const LINKS: { icon: string; label: string; href: string }[] = [
  { icon: "globe", label: "qiaomu.ai", href: "https://qiaomu.ai/" },
  { icon: "newspaper", label: "blog.qiaomu.ai", href: "https://blog.qiaomu.ai/" },
  { icon: "at-sign", label: "@vista8", href: "https://x.com/vista8" },
  { icon: "github", label: "@joeseesun", href: "https://github.com/joeseesun" },
];

export class GallerySettingTab extends PluginSettingTab {
  private plugin: QiaomuProductGalleryPlugin;

  constructor(app: App, plugin: QiaomuProductGalleryPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("qpg-settings");

    this.hero(containerEl);
    this.stats(containerEl);

    this.section(containerEl, t("settings.behavior"));
    new Setting(containerEl)
      .setName(t("settings.startTab"))
      .setDesc(t("settings.startTab.desc"))
      .addDropdown((drop) =>
        drop
          .addOption("gallery", t("tab.gallery"))
          .addOption("dictionary", t("tab.dictionary"))
          .addOption("styles", t("tab.styles"))
          .addOption("quiz", t("tab.quiz"))
          .setValue(this.plugin.settings.startMode)
          .onChange(async (value) => {
            this.plugin.settings.startMode = value as typeof this.plugin.settings.startMode;
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName(t("settings.clickAction"))
      .setDesc(t("settings.clickAction.desc"))
      .addDropdown((drop) =>
        drop
          .addOption("preview", t("settings.clickAction.preview"))
          .addOption("browser", t("settings.clickAction.browser"))
          .setValue(this.plugin.settings.clickAction)
          .onChange(async (value) => {
            this.plugin.settings.clickAction = value === "browser" ? "browser" : "preview";
            await this.plugin.saveSettings();
          }),
      );
    new Setting(containerEl)
      .setName(t("settings.appendSource"))
      .setDesc(t("settings.appendSource.desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.appendSource).onChange(async (value) => {
          this.plugin.settings.appendSource = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.stack"))
      .setDesc(t("settings.stack.desc"))
      .addText((text) =>
        text
          .setPlaceholder("React + Tailwind CSS")
          .setValue(this.plugin.settings.replicaStack)
          .onChange(async (value) => {
            this.plugin.settings.replicaStack = value.trim() || "React + Tailwind CSS";
            await this.plugin.saveSettings();
          }),
      );

    this.section(containerEl, t("settings.learn"));
    let folderText: import("obsidian").TextComponent | null = null;
    new Setting(containerEl)
      .setName(t("settings.notesFolder"))
      .setDesc(t("settings.folderHint"))
      .addText((text) => {
        text
          .setPlaceholder("Learn UI")
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value.trim() || "Learn UI";
            await this.plugin.saveSettings();
          });
        folderText = text;
      })
      .addButton((btn) =>
        btn
          .setButtonText(t("settings.browse"))
          .setIcon("folder-open")
          .onClick(() => {
            this.plugin.pickNotesFolder((path: string) => {
              this.plugin.settings.notesFolder = path;
              folderText?.setValue(path);
              void this.plugin.saveSettings();
            });
          }),
      );

    this.section(containerEl, t("settings.data"));
    new Setting(containerEl)
      .setName(t("settings.export"))
      .setDesc(t("settings.export.desc"))
      .addButton((btn) =>
        btn.setButtonText(t("settings.export.btn")).onClick(async () => {
          const n = await exportAllLearnNotes(this.plugin);
          new Notice(n > 0 ? t("command.exportDone", { n }) : t("review.exportEmpty"));
        }),
      );
    new Setting(containerEl)
      .setName(t("settings.clearRecents"))
      .setDesc(t("settings.clearRecents.desc"))
      .addButton((btn) =>
        btn.setButtonText(t("settings.clear.btn")).onClick(async () => {
          this.plugin.settings.recents = [];
          await this.plugin.saveSettings();
          new Notice(t("settings.done"));
        }),
      );
    new Setting(containerEl)
      .setName(t("settings.resetQuiz"))
      .setDesc(t("settings.resetQuiz.desc"))
      .addButton((btn) =>
        btn
          .setButtonText(t("settings.reset.btn"))
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.quizState = {};
            await this.plugin.saveSettings();
            new Notice(t("settings.done"));
            this.display();
          }),
      );

    this.section(containerEl, t("settings.author"));
    this.author(containerEl);

    this.section(containerEl, t("settings.support"));
    this.support(containerEl);

    this.section(containerEl, t("settings.about"));
    this.plugin.updateNotes.addButton(containerEl);
    new Setting(containerEl).setName(t("settings.about.source")).setDesc(t("settings.about.source.desc"));
    new Setting(containerEl).setName(t("settings.license")).setDesc(t("settings.license.desc"));
  }

  private section(parent: HTMLElement, title: string): void {
    parent.createDiv("qpg-set-section").setText(title);
  }

  private hero(parent: HTMLElement): void {
    const hero = parent.createDiv("qpg-set-hero");
    setIcon(hero.createDiv("qpg-set-logo"), "graduation-cap");
    const text = hero.createDiv("qpg-set-hero-text");
    const title = text.createDiv("qpg-set-title");
    title.createSpan().setText(t("ribbon.label"));
    title.createSpan("qpg-set-version").setText(`v${this.plugin.manifest.version}`);
    text.createDiv("qpg-set-tagline").setText(t("settings.hero.tagline"));
  }

  private stats(parent: HTMLElement): void {
    const s = this.plugin.settings;
    const reviews = Object.keys(s.learnReviews);
    const designs = reviews.filter((k) => k.startsWith("design:")).length;
    const notes = reviews.length - designs;
    const mastered = Object.values(s.quizState).filter((q) => q.m).length;
    const total = this.plugin.learnui ? this.plugin.learnui.entries.length + this.plugin.learnui.styles.length : 106;
    const row = parent.createDiv("qpg-set-stats");
    const stat = (value: string, label: string) => {
      const c = row.createDiv("qpg-set-stat");
      c.createDiv("qpg-set-stat-value").setText(value);
      c.createDiv("qpg-set-stat-label").setText(label);
    };
    stat(String(designs), t("settings.stats.designs"));
    stat(String(notes), t("settings.stats.notes"));
    stat(`${mastered}/${total}`, t("settings.stats.mastered"));
  }

  private author(parent: HTMLElement): void {
    const name = parent.createDiv("qpg-set-author");
    name.createSpan("qpg-set-author-name").setText(this.plugin.manifest.author);
    const row = parent.createDiv("qpg-set-links");
    for (const l of LINKS) {
      const a = row.createEl("a", { cls: "qpg-set-link", href: l.href, attr: { target: "_blank", rel: "noopener noreferrer" } });
      setIcon(a.createSpan("qpg-set-link-icon"), l.icon);
      a.createSpan().setText(l.label);
    }
    const wx = row.createEl("button", { cls: "qpg-set-link", attr: { "aria-label": t("settings.wechat") } });
    setIcon(wx.createSpan("qpg-set-link-icon"), "message-circle");
    wx.createSpan().setText(`${t("settings.wechat")} ${WECHAT_ID}`);
    wx.addEventListener("click", () => {
      void copyText(WECHAT_ID,t("settings.wechat.copied"));
    });
  }

  private support(parent: HTMLElement): void {
    const grid = parent.createDiv("qpg-set-qrs");
    const card = (src: string, title: string, desc: string) => {
      const c = grid.createDiv("qpg-set-qr");
      const frame = c.createDiv("qpg-set-qr-frame");
      const img = frame.createEl("img", { attr: { src, alt: title, loading: "lazy" } });
      img.addEventListener("error", () => {
        img.remove();
        frame.createDiv("qpg-set-qr-fail").setText(t("settings.support.qrFail"));
      });
      c.createDiv("qpg-set-qr-title").setText(title);
      c.createDiv("qpg-set-qr-desc").setText(desc);
    };
    card(DONATE_QR, t("settings.support.donate"), t("settings.support.donate.desc"));
    card(FOLLOW_QR, t("settings.support.follow"), t("settings.support.follow.desc"));
  }
}
