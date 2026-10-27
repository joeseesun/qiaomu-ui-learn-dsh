import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeState,
  SaveQueue,
} from "../src/learning.js";
import learn from "../data/learnui.json" with { type: "json" };
import demos from "../data/demos.json" with { type: "json" };
import { catZh } from "../src/original-ui/cat-zh.ts";
import { initI18n } from "../src/original-ui/i18n.ts";
import catalog from "../data/catalog.json" with { type: "json" };
import { flatten } from "../src/original-ui/catalog.ts";
const all = [...flatten(catalog), ...learn.entries, ...learn.styles];
test("Obsidian data retains all collections, reviews and quiz records; prototype data migrates", () => {
  const old = {
    collections: [
      {
        id: "a",
        name: "Dashboard",
        items: ["dashboard:0"],
        created: "2026-01-01",
      },
    ],
    learnReviews: {
      "entry:tabs": { rating: 5, tags: ["navigation"], note: "Keep this" },
    },
    quizState: { tabs: { ok: 2, seen: 3, m: 1, last: 123 } },
    notesFolder: "Notes",
    replicaStack: "Vue",
    startMode: "quiz",
  };
  assert.deepEqual(normalizeState(old, all).learnReviews, old.learnReviews);
  assert.deepEqual(normalizeState(old, all).quizState, old.quizState);
  const migrated = normalizeState(
    { stars: ["dashboard:0"], notes: { tabs: "legacy note" } },
    all,
  );
  assert.equal(migrated.collections[0].items[0], "dashboard:0");
  assert.equal(migrated.learnReviews["entry:tabs"].note, "legacy note");
  assert.throws(() => normalizeState({ ...old, collections: [{ id: "bad" }] }));
  assert.throws(() =>
    normalizeState({ ...old, learnReviews: { bad: { rating: 12 } } }),
  );
});
test("all 106 specimens are present and all 184 categories have Chinese labels", () => {
  for (const item of [...learn.entries, ...learn.styles])
    assert.equal(
      typeof demos[(item.signals ? "style-" : "") + item.slug + ".html"],
      "string",
      item.slug,
    );
  initI18n("zh");
  for (const cat of catalog.cats) assert.ok(catZh(cat.s, cat.s), cat.s);
});
test("autosave serializes rapid edits and keeps newer changes arriving during a save", async () => {
  let release;
  const written = [];
  const api = {
    save: async (r) => {
      written.push(r);
      if (written.length === 1)
        await new Promise((resolve) => (release = resolve));
      return { revision: r.revision + 1, data: r.data };
    },
  };
  const queue = new SaveQueue(api);
  queue.push({ text: "first" });
  const first = queue.flush();
  queue.push({ text: "second" });
  queue.push({ text: "newest" });
  release();
  await first;
  assert.deepEqual(
    written.map((r) => [r.revision, r.data.text]),
    [
      [0, "first"],
      [1, "newest"],
    ],
  );
  assert.equal(queue.revision, 2);
});
test("autosave preserves pending edits on conflict and does not retry with a guessed revision", async () => {
  let calls = 0;
  const queue = new SaveQueue({
    save: async () => {
      calls++;
      throw Error("conflict");
    },
  });
  queue.push({ note: "keep" });
  await assert.rejects(queue.flush(), /conflict/);
  assert.deepEqual(queue.pending, { note: "keep" });
  queue.push({ note: "newer" });
  await assert.rejects(queue.flush(), /conflict/);
  assert.equal(calls, 1);
  assert.deepEqual(queue.pending, { note: "newer" });
});
