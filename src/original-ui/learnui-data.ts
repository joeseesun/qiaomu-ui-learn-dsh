// Learn UI data layer: types + load + search over the bundled learnui.json
// (62 UI component entries + 44 visual styles, merged EN/ZH at build time by
// scripts/build-learnui.mjs from vendor/learnui/).

export interface LearnApiNote {
  framework: string;
  symbol: string;
  note?: string;
}

export interface LearnPart {
  id: string;
  name: string;
  nameZh: string | null;
  api: string;
  description: string;
  descriptionZh: string | null;
  prompt: string;
  promptZh: string | null;
}

export interface LearnEntry {
  slug: string;
  platform: string; // "web" | "macos"
  name: string;
  nameZh: string | null;
  tagline: string;
  taglineZh: string | null;
  description: string;
  descriptionZh: string | null;
  aka: string[];
  akaZh: string[];
  fuzzy: string[];
  fuzzyZh: string[];
  api: LearnApiNote[];
  apiNotesZh: string[];
  prompt: string;
  promptZh: string | null;
  debugPrompt: string;
  debugPromptZh: string | null;
  parts: LearnPart[];
  related: string[];
}

export interface LearnSignal {
  id: string;
  facet: string;
  role: string;
  name: string;
  nameZh: string | null;
  description: string;
  descriptionZh: string | null;
}

export interface LearnStyle {
  slug: string;
  order: number | null;
  name: string;
  nameZh: string | null;
  tagline: string;
  taglineZh: string | null;
  scope: string;
  scopeZh: string | null;
  aliases: string[];
  aliasesZh: string[];
  signals: LearnSignal[];
  confusedWith: { slug: string; name: string; because: string; becauseZh: string | null } | null;
  seeAlso: string[];
  accessibility: string;
  accessibilityZh: string | null;
  origin: string;
  originZh: string | null;
  code: { title: string; language: string; code: string }[];
  brief: string;
  briefZh: string | null;
}

export interface LearnData {
  v: number;
  generated: string;
  source: string;
  entries: LearnEntry[];
  styles: LearnStyle[];
}

export type LearnKind = "entry" | "style";

export interface LearnHit {
  kind: LearnKind;
  entry?: LearnEntry;
  style?: LearnStyle;
  score: number;
}

export function demoFile(kind: LearnKind, slug: string): string {
  return kind === "entry" ? `${slug}.html` : `style-${slug}.html`;
}

/** Query terms: whitespace split + CJK bigrams so “乱闪字母” hits “乱闪的字母”. */
function queryTerms(rawQuery: string): string[] {
  const parts = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    if (/[\u4e00-\u9fff]/.test(p) && p.length > 2) {
      for (let i = 0; i + 2 <= p.length; i++) out.add(p.slice(i, i + 2));
    }
  }
  return [...out];
}

/** Search both languages + fuzzy vernacular descriptions; site.js-style scoring. */
export function searchLearn(data: LearnData, rawQuery: string): { entries: LearnEntry[]; styles: LearnStyle[] } {
  if (!rawQuery.trim()) return { entries: data.entries, styles: data.styles };
  const terms = queryTerms(rawQuery);
  const has = (s: string | null | undefined, q: string) => !!s && s.toLowerCase().includes(q);

  const scoreEntry = (e: LearnEntry, q: string): number => {
    let s = 0;
    if (has(e.name, q)) s += 100;
    if (has(e.nameZh, q)) s += 95;
    for (const a of e.aka) if (has(a, q)) s += 60;
    for (const a of e.akaZh) if (has(a, q)) s += 55;
    for (const f of e.fuzzy) if (has(f, q)) s += 30;
    for (const f of e.fuzzyZh) if (has(f, q)) s += 28;
    if (has(e.tagline, q)) s += 20;
    if (has(e.taglineZh, q)) s += 20;
    for (const p of e.parts) if (has(p.name, q) || has(p.nameZh, q)) s += 15;
    for (const a of e.api) if (has(a.framework, q) || has(a.symbol, q)) s += 12;
    return s;
  };
  const scoreStyle = (st: LearnStyle, q: string): number => {
    let s = 0;
    if (has(st.name, q)) s += 100;
    if (has(st.nameZh, q)) s += 95;
    for (const a of st.aliases) if (has(a, q)) s += 55;
    for (const a of st.aliasesZh) if (has(a, q)) s += 50;
    if (has(st.tagline, q) || has(st.taglineZh, q)) s += 20;
    for (const sig of st.signals) if (has(sig.name, q) || has(sig.nameZh, q)) s += 14;
    return s;
  };

  const scored: LearnHit[] = [];
  for (const e of data.entries) {
    const score = terms.reduce((acc, q) => acc + scoreEntry(e, q), 0);
    if (score > 0) scored.push({ kind: "entry", entry: e, score });
  }
  for (const st of data.styles) {
    const score = terms.reduce((acc, q) => acc + scoreStyle(st, q), 0);
    if (score > 0) scored.push({ kind: "style", style: st, score });
  }
  scored.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));
  return {
    entries: scored.filter((h) => h.kind === "entry").map((h) => h.entry!),
    styles: scored.filter((h) => h.kind === "style").map((h) => h.style!),
  };
}

/** Deterministic "today's pick" per kind, rotates daily. */
export function dailyPick<T>(items: T[], offset: number): T {
  if (items.length === 0) throw new Error("no items");
  const days = Math.floor(Date.now() / 86400000);
  return items[(((days + offset) % items.length) + items.length) % items.length];
}

export function findEntry(data: LearnData, slug: string): LearnEntry | undefined {
  return data.entries.find((e) => e.slug === slug);
}

export function findStyle(data: LearnData, slug: string): LearnStyle | undefined {
  return data.styles.find((s) => s.slug === slug);
}
