// 审美测验：看交互标本猜名字。间隔重复（连对 2 次算掌握、15% 概率复习、
// 最近 4 题不重复），掌握度持久化在插件设置里。移植自 learnui 的 quiz.js。
// 键盘：1–4 作答，Enter / 空格 下一题。

import { setIcon } from "../harness-ui";
import { t } from "./i18n";
import { LearnEntry, LearnStyle } from "./learnui-data";
import { renderDemoFrame } from "./learn-shared";
import { LearnEntryModal } from "./learn-entry-modal";
import { LearnStyleModal } from "./learn-style-modal";
import { segmented } from "./ui";
import type QiaomuProductGalleryPlugin from "./main";

interface QuizItem {
  key: string; // quizState key
  kind: "entry" | "style";
  entry?: LearnEntry;
  style?: LearnStyle;
  nameZh: string | null;
  name: string;
  full: string; // bilingual display name
  hint: string; // one-line takeaway shown after answering
}

interface QuizStat {
  ok: number; // consecutive correct
  seen: number;
  m: number; // mastered
  last: number;
}

type QuizMode = "components" | "styles" | "mixed";

const MASTER_STREAK = 2;
const REVIEW_RATIO = 0.15;
const RECENT = 4;

export class LearnQuiz {
  private plugin: QiaomuProductGalleryPlugin;
  private host: HTMLElement;
  private mode: QuizMode = "mixed";
  private session = { n: 0, ok: 0, streak: 0 };
  private recent: string[] = [];
  private current: { item: QuizItem; choices: QuizItem[]; answered: boolean } | null = null;
  private active = false;
  private armedReset: number | null = null;
  private onKey = (e: KeyboardEvent) => this.handleKey(e);

  // UI refs (rebuilt by render())
  private kickerEl!: HTMLElement;
  private qEl!: HTMLElement;
  private stageEl!: HTMLElement;
  private choicesEl!: HTMLElement;
  private resultEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private accEl!: HTMLElement;
  private streakEl!: HTMLElement;
  private masteryFillEl!: HTMLElement;
  private masteryNEl!: HTMLElement;

  constructor(host: HTMLElement, plugin: QiaomuProductGalleryPlugin) {
    this.host = host;
    this.plugin = plugin;
    document.addEventListener("keydown", this.onKey, true);
    this.render();
  }

  setActive(on: boolean): void {
    this.active = on;
  }

  destroy(): void {
    document.removeEventListener("keydown", this.onKey, true);
  }

  // ---- data ----------------------------------------------------------------

  private items(): QuizItem[] {
    const data = this.plugin.learnui;
    if (!data) return [];
    const out: QuizItem[] = [];
    for (const e of data.entries) {
      out.push({
        key: e.slug,
        kind: "entry",
        entry: e,
        nameZh: e.nameZh,
        name: e.name,
        full: [e.nameZh, e.name].filter(Boolean).join(" · "),
        hint: (e.taglineZh ?? e.tagline) || "",
      });
    }
    for (const s of data.styles) {
      out.push({
        key: `style-${s.slug}`,
        kind: "style",
        style: s,
        nameZh: s.nameZh,
        name: s.name,
        full: [s.nameZh, s.name].filter(Boolean).join(" · "),
        hint: (s.taglineZh ?? s.tagline) || "",
      });
    }
    return out;
  }

  private stat(key: string): QuizStat {
    return this.plugin.settings.quizState[key] ?? { ok: 0, seen: 0, m: 0, last: 0 };
  }

  private itemsForMode(): QuizItem[] {
    const all = this.items();
    if (this.mode === "components") return all.filter((i) => i.kind === "entry");
    if (this.mode === "styles") return all.filter((i) => i.kind === "style");
    return all;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private pickNext(): { item: QuizItem; choices: QuizItem[] } | null {
    const all = this.itemsForMode();
    if (all.length < 4) return null;
    const unmastered = all.filter((i) => !this.stat(i.key).m);
    let pool = unmastered.filter((i) => !this.recent.includes(i.key));
    const mastered = all.filter((i) => this.stat(i.key).m && !this.recent.includes(i.key));
    if (Math.random() < REVIEW_RATIO && mastered.length > 0) pool = mastered;
    if (pool.length === 0) pool = unmastered;
    if (pool.length === 0) return null; // all mastered
    const item = pool[Math.floor(Math.random() * pool.length)];

    // Distractors: same kind first, fall back to any.
    const sameKind = this.shuffle(all.filter((i) => i.key !== item.key && i.kind === item.kind));
    const others = this.shuffle(all.filter((i) => i.key !== item.key && i.kind !== item.kind));
    const picks = [...sameKind, ...others].slice(0, 3);
    return { item, choices: this.shuffle([...picks, item]) };
  }

  private record(key: string, correct: boolean): void {
    const st = this.stat(key);
    this.plugin.settings.quizState[key] = {
      ok: correct ? st.ok + 1 : 0,
      seen: st.seen + 1,
      m: correct && st.ok + 1 >= MASTER_STREAK ? 1 : 0,
      last: Date.now(),
    };
    void this.plugin.saveSettings();
  }

  // ---- rendering -----------------------------------------------------------

  render(): void {
    const host = this.host;
    host.empty();
    const root = host.createDiv("qpg-quiz");

    // Top bar: mode switch + live stats
    const bar = root.createDiv("qpg-quiz-top");
    segmented<QuizMode>(
      bar,
      [
        { id: "mixed", label: t("quiz.modeMixed") },
        { id: "components", label: t("quiz.modeComponents") },
        { id: "styles", label: t("quiz.modeStyles") },
      ],
      this.mode,
      (m) => {
        this.mode = m;
        this.render();
      },
      "qpg-seg-sm",
    );
    bar.createDiv("qpg-top-spacer");

    const stats = bar.createDiv("qpg-quiz-stats");
    const mkStat = (label: string) => {
      const s = stats.createDiv("qpg-quiz-stat");
      s.createSpan("qpg-quiz-stat-label").setText(label);
      return s.createSpan("qpg-quiz-stat-value");
    };
    this.accEl = mkStat(t("quiz.accuracy"));
    this.streakEl = mkStat(t("quiz.streak"));

    const mastery = stats.createDiv("qpg-quiz-stat qpg-quiz-mastery");
    mastery.createSpan("qpg-quiz-stat-label").setText(t("quiz.mastery"));
    const track = mastery.createSpan("qpg-quiz-track");
    this.masteryFillEl = track.createSpan("qpg-quiz-fill");
    this.masteryNEl = mastery.createSpan("qpg-quiz-stat-value");

    const reset = stats.createEl("button", { cls: "qpg-icon-btn", attr: { "aria-label": t("quiz.reset"), title: t("quiz.reset") } });
    setIcon(reset, "rotate-ccw");
    reset.addEventListener("click", () => {
      if (this.armedReset === null) {
        reset.addClass("is-armed");
        reset.setAttr("title", t("quiz.resetAsk"));
        this.armedReset = window.setTimeout(() => {
          this.armedReset = null;
          reset.removeClass("is-armed");
          reset.setAttr("title", t("quiz.reset"));
        }, 3000);
        return;
      }
      window.clearTimeout(this.armedReset);
      this.armedReset = null;
      this.resetProgress();
    });

    const scroll = root.createDiv("qpg-quiz-scroll");
    if (this.itemsForMode().length === 0) {
      const empty = scroll.createDiv("qpg-empty");
      empty.createDiv("qpg-spinner");
      empty.createDiv("qpg-empty-hint").setText(this.plugin.learnuiError ? t("view.error") : t("learn.loading"));
      this.updateStats();
      return;
    }

    this.cardEl = scroll.createDiv("qpg-quiz-card");
    const head = this.cardEl.createDiv("qpg-quiz-head");
    this.kickerEl = head.createDiv("qpg-kicker");
    this.qEl = head.createDiv("qpg-quiz-q");
    this.stageEl = this.cardEl.createDiv("qpg-quiz-stage");
    this.choicesEl = this.cardEl.createDiv("qpg-quiz-choices");
    this.resultEl = this.cardEl.createDiv("qpg-quiz-result");
    scroll.createDiv("qpg-quiz-keys").setText(t("quiz.keys"));

    this.updateStats();
    this.ask();
  }

  private resetProgress(): void {
    this.plugin.settings.quizState = {};
    void this.plugin.saveSettings();
    this.session = { n: 0, ok: 0, streak: 0 };
    this.recent = [];
    this.render();
  }

  private updateStats(): void {
    const all = this.itemsForMode();
    const masteredN = all.filter((i) => this.stat(i.key).m).length;
    this.accEl.setText(this.session.n ? `${this.session.ok}/${this.session.n}` : "–");
    this.streakEl.setText(String(this.session.streak));
    this.masteryFillEl.style.width = `${all.length ? (100 * masteredN) / all.length : 0}%`;
    this.masteryNEl.setText(`${masteredN}/${all.length}`);
  }

  private ask(): void {
    this.resultEl.empty();
    this.resultEl.removeClass("is-shown");
    this.resultEl.removeClass("is-ok");
    this.resultEl.removeClass("is-bad");
    const picked = this.pickNext();
    if (!picked) {
      this.current = null;
      this.cardEl.addClass("is-done");
      this.cardEl.empty();
      const done = this.cardEl.createDiv("qpg-quiz-done");
      setIcon(done.createDiv("qpg-quiz-done-icon"), "trophy");
      done.createDiv("qpg-quiz-done-title").setText(t("quiz.allDoneTitle"));
      done.createDiv("qpg-quiz-done-text").setText(t("quiz.allDone"));
      const again = done.createEl("button", { cls: "qpg-btn-primary" });
      again.setText(t("quiz.restart"));
      again.addEventListener("click", () => this.resetProgress());
      return;
    }
    const { item, choices } = picked;
    this.current = { item, choices, answered: false };
    this.kickerEl.setText(t("quiz.kicker", { n: this.session.n + 1 }));
    this.qEl.setText(item.kind === "entry" ? t("quiz.whatIs") : t("quiz.whichStyle"));

    this.stageEl.empty();
    void renderDemoFrame(this.stageEl, this.plugin, item.kind, item.kind === "entry" ? item.entry!.slug : item.style!.slug, 280);

    this.choicesEl.empty();
    choices.forEach((ch, i) => {
      const b = this.choicesEl.createEl("button", { cls: "qpg-quiz-choice", attr: { "data-key": ch.key } });
      b.createSpan("qpg-key").setText(String(i + 1));
      const label = b.createSpan("qpg-quiz-choice-label");
      if (ch.nameZh) {
        label.createSpan("qpg-quiz-choice-zh").setText(ch.nameZh);
        label.createSpan("qpg-quiz-choice-en").setText(ch.name);
      } else {
        label.createSpan("qpg-quiz-choice-zh").setText(ch.name);
      }
      b.addEventListener("click", () => this.answer(ch.key));
    });
  }

  private answer(key: string): void {
    const cur = this.current;
    if (!cur || cur.answered) return;
    cur.answered = true;
    const correct = key === cur.item.key;
    const wasMastered = this.stat(cur.item.key).m === 1;
    this.record(cur.item.key, correct);
    const justMastered = !wasMastered && this.stat(cur.item.key).m === 1;
    this.recent.push(cur.item.key);
    this.recent = this.recent.slice(-RECENT);

    this.session.n++;
    if (correct) {
      this.session.ok++;
      this.session.streak++;
    } else {
      this.session.streak = 0;
    }

    this.choicesEl.querySelectorAll<HTMLButtonElement>(".qpg-quiz-choice").forEach((b) => {
      b.disabled = true;
      const k = b.getAttr("data-key");
      if (k === cur.item.key) b.addClass("is-correct");
      else if (k === key) b.addClass("is-wrong");
      else b.addClass("is-dim");
    });

    const r = this.resultEl;
    r.empty();
    r.addClass(correct ? "is-ok" : "is-bad");
    const line = r.createDiv("qpg-quiz-result-line");
    setIcon(line.createSpan("qpg-quiz-result-icon"), correct ? "check" : "x");
    line.createSpan("qpg-quiz-result-text").setText(
      correct ? (justMastered ? t("quiz.mastered") : t("quiz.correct")) : t("quiz.wrong", { answer: cur.item.full }),
    );
    if (cur.item.hint) r.createDiv("qpg-quiz-result-hint").setText(cur.item.hint);

    const actions = r.createDiv("qpg-quiz-result-actions");
    const link = actions.createEl("button", { cls: "qpg-link-btn" });
    link.setText(t("quiz.viewEntry"));
    link.addEventListener("click", () => {
      if (cur.item.entry) new LearnEntryModal(this.plugin, cur.item.entry).open();
      else if (cur.item.style) new LearnStyleModal(this.plugin, cur.item.style).open();
    });
    const next = actions.createEl("button", { cls: "qpg-btn-primary" });
    next.createSpan().setText(t("quiz.next"));
    next.createSpan("qpg-key qpg-key-inv").setText("⏎");
    next.addEventListener("click", () => this.ask());
    r.addClass("is-shown");
    window.requestAnimationFrame(() => {
      next.focus({ preventScroll: true });
      r.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    this.updateStats();
  }

  private handleKey(e: KeyboardEvent): void {
    if (!this.active || !this.host.isConnected || this.host.offsetParent === null) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector(".modal-container")) return;
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
    const cur = this.current;
    if (!cur) return;
    if (!cur.answered && /^[1-4]$/.test(e.key)) {
      const ch = cur.choices[Number(e.key) - 1];
      if (ch) {
        e.preventDefault();
        this.answer(ch.key);
      }
    } else if (cur.answered && (e.key === "Enter" || e.key === " ")) {
      // The focused "Next" button also handles Enter; avoid double-firing.
      if (tg && tg.tagName === "BUTTON") return;
      e.preventDefault();
      this.ask();
    }
  }
}
