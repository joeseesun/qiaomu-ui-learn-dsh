// Settings and quiz semantics preserve the Obsidian UI Learn data format.
export const defaults = {
  clickAction: "preview",
  appendSource: false,
  recents: [],
  notesFolder: "Learn UI",
  learnReviews: {},
  quizState: {},
  density: "m",
  sideCollapsed: false,
  startMode: "gallery",
  collections: [],
  replicaStack: "React + Tailwind CSS",
};
export const keyOf = (item) =>
  item.row
    ? `design:${item.key}`
    : `${item.signals ? "style" : "entry"}:${item.slug}`;
export function normalizeState(input, allItems) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid learning data");
  const s = { ...structuredClone(defaults), ...structuredClone(input) };
  if (
    !Array.isArray(s.collections) ||
    !Array.isArray(s.recents) ||
    !s.learnReviews ||
    typeof s.learnReviews !== "object" ||
    Array.isArray(s.learnReviews) ||
    !s.quizState ||
    typeof s.quizState !== "object" ||
    Array.isArray(s.quizState)
  )
    throw Error("Invalid collections, reviews or quiz data");
  if (
    s.collections.some(
      (c) =>
        !c ||
        typeof c.id !== "string" ||
        typeof c.name !== "string" ||
        !Array.isArray(c.items) ||
        c.items.some((k) => typeof k !== "string"),
    )
  )
    throw Error("Invalid collection");
  if (s.recents.some((k) => typeof k !== "string"))
    throw Error("Invalid recent item");
  for (const r of Object.values(s.learnReviews)) {
    if (
      !r ||
      typeof r !== "object" ||
      (r.rating != null &&
        (!Number.isInteger(r.rating) || r.rating < 0 || r.rating > 5)) ||
      (r.note != null && typeof r.note !== "string") ||
      (r.tags != null &&
        (!Array.isArray(r.tags) || r.tags.some((t) => typeof t !== "string")))
    )
      throw Error("Invalid review");
  }
  for (const q of Object.values(s.quizState))
    if (
      !q ||
      ["ok", "seen", "m", "last"].some(
        (k) => !Number.isFinite(q[k]) || q[k] < 0,
      )
    )
      throw Error("Invalid quiz progress");
  for (const k of ["notesFolder", "replicaStack"])
    if (typeof s[k] !== "string") throw Error(`Invalid ${k}`);
  if (!["gallery", "dictionary", "styles", "quiz"].includes(s.startMode))
    s.startMode = "gallery";
  if (!["s", "m", "l"].includes(s.density)) s.density = "m";
  // Import the early DSH prototype without dropping favorites or notes.
  if (allItems && (Array.isArray(input.stars) || input.notes)) {
    const lookup = new Map(allItems.flatMap((i) => [[i.key || i.slug, i]]));
    s.learnReviews = { ...s.learnReviews };
    for (const [key, note] of Object.entries(input.notes || {})) {
      const item = lookup.get(key);
      if (item && typeof note === "string" && !s.learnReviews[keyOf(item)])
        s.learnReviews[keyOf(item)] = { note };
    }
    if (
      input.stars?.length &&
      !s.collections.some((c) => c.id === "legacy-favorites")
    )
      s.collections = [
        ...s.collections,
        {
          id: "legacy-favorites",
          name: "收藏 / Favorites",
          items: input.stars.filter((k) => lookup.has(k)),
          created: new Date().toISOString(),
        },
      ];
    delete s.stars;
    delete s.notes;
  }
  return s;
}
// One in-flight write; edits arriving during a save are drained afterwards.
// On a revision conflict, keep local edits and stop; never silently overwrite.
export class SaveQueue {
  constructor(api, revision = 0, onSaved = () => {}) {
    this.api = api;
    this.revision = revision;
    this.onSaved = onSaved;
    this.pending = null;
    this.running = null;
    this.failure = null;
  }
  push(data) {
    this.pending = data;
  }
  async flush() {
    if (this.failure) throw this.failure;
    if (this.running) {
      await this.running;
      return this.pending ? this.flush() : undefined;
    }
    this.running = (async () => {
      while (this.pending) {
        const data = this.pending;
        this.pending = null;
        try {
          const r = await this.api.save({ revision: this.revision, data });
          this.revision = r.revision;
          this.onSaved(r);
        } catch (e) {
          if (!this.pending) this.pending = data;
          this.failure = e;
          throw e;
        }
      }
    })();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }
}
