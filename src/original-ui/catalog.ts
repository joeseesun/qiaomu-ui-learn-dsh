// Catalog access: loads catalog.json (shipped next to main.js) and exposes
// typed helpers. Derived thumbnail URLs follow the observed patterns:
//  - standard rows [name, "prefix-web-123"]  -> screens/prefix/web2/123/thumbnail.webp
//  - special rows  [name, slug, path|url]    -> CDN base + path, or absolute URL
// Empty path means no thumbnail is known (rare, 1 of 13,561).

export const THUMB_BASE = "https://kombai-assets.b-cdn.net/examples/thumbnails/";
export const PAGE_BASE = "https://kombai.com/gallery/inspirations/";
export const LIB_BASE = "https://agent.kombai.com/kombai-inspiration-library/";

export interface CatEntry {
  s: string; // slug
  n: string; // display name
  k: string; // kind: pages | sections | animations | systems
  c: number; // item count
}

/** [styleName, urlSlug] for standard items; special items carry a thumbnail path (or
 *  absolute URL) and — when not derivable — an explicit live-preview URL. */
export type ItemRow = [string, string] | [string, string, string] | [string, string, string, string];

export interface Catalog {
  v: number;
  generated: string;
  total: number;
  cats: CatEntry[];
  items: Record<string, ItemRow[]>;
}

export interface FlatItem {
  key: string; // stable id: "{catSlug}:{index}"
  cat: CatEntry;
  row: ItemRow;
  lowerName: string;
  num: number;
}

const STD_RE = /^([a-z0-9-]+)-web-(\d+)$/;

export function thumbUrl(row: ItemRow): string | null {
  if (row.length >= 3) {
    const p = row[2];
    if (!p) return null;
    return /^https?:/.test(p) ? p : THUMB_BASE + p;
  }
  const m = STD_RE.exec(row[1]);
  return m ? `${THUMB_BASE}screens/${m[1]}/web2/${m[2]}/thumbnail.webp` : null;
}

export function pageUrl(row: ItemRow): string {
  return PAGE_BASE + row[1] + "/";
}

/**
 * Live preview (the original rendered site).
 * Special rows carry the URL explicitly (incl. Vimeo-backed designs); standard
 * pages/sections rows derive it from the url slug and category kind.
 */
export function previewUrl(row: ItemRow, kind?: string): string | null {
  if (row.length >= 4 && row[3]) return row[3];
  const m = STD_RE.exec(row[1]);
  if (!m) return null;
  const seg = kind === "pages" ? "app-pages" : kind === "sections" ? "sections" : null;
  return seg ? `${LIB_BASE}${seg}/${m[1]}/web/${m[2]}/index.html` : null;
}

/** Best URL to open for a design: live preview when known, else the design page. */
export function openUrl(row: ItemRow, kind?: string): string {
  return previewUrl(row, kind) ?? pageUrl(row);
}

export function itemNum(row: ItemRow): number {
  const m = STD_RE.exec(row[1]);
  return m ? parseInt(m[2], 10) : Number.MAX_SAFE_INTEGER;
}

export function flatten(catalog: Catalog): FlatItem[] {
  const out: FlatItem[] = [];
  for (const cat of catalog.cats) {
    const rows = catalog.items[cat.s] ?? [];
    rows.forEach((row, i) => {
      out.push({
        key: `${cat.s}:${i}`,
        cat,
        row,
        lowerName: row[0].toLowerCase(),
        num: itemNum(row),
      });
    });
  }
  return out;
}

/** Grouped category list ordered by kind, then count desc. */
export const KIND_ORDER = ["pages", "sections", "animations", "systems"] as const;
export type Kind = (typeof KIND_ORDER)[number] | "all";

export function sortedCats(catalog: Catalog): CatEntry[] {
  return [...catalog.cats].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.k as (typeof KIND_ORDER)[number]) -
        KIND_ORDER.indexOf(b.k as (typeof KIND_ORDER)[number]) || b.c - a.c,
  );
}
