import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NotesStore } from "../src/notes.js";
import { fetchReference } from "../src/source.js";
test("notes retain file changes, reject traversal and do not follow symlinks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ui-notes-"));
  try {
    const store = new NotesStore(root);
    const saved = await store.write({
      path: "Learn UI/Tabs.md",
      text: "# Tabs",
    });
    assert.equal((await store.list("Learn UI")).entries[0].name, "Tabs.md");
    await assert.rejects(
      store.write({ path: saved.path, text: "overwrite" }),
      /changed|exists/,
    );
    assert.equal((await store.read(saved.path)).text, "# Tabs");
    const updated = await store.write({ ...saved, text: "# Tabs\nMy notes" });
    assert.notEqual(updated.etag, saved.etag);
    await assert.rejects(store.write({ ...saved, text: "stale" }), /changed/);
    await assert.rejects(store.read("../escape.md"));
    await assert.rejects(store.write({ path: "script.js", text: "x" }));
    await symlink(root, path.join(root, "link"));
    await assert.rejects(store.read("link/Learn UI/Tabs.md"), /Symbolic/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("source fetch derives only a trusted catalogue URL, bounds output and reports failures", async () => {
  let fetched;
  const r = await fetchReference(
    { key: "dashboard:0" },
    async (url, options) => {
      fetched = { url, options };
      return new Response("x".repeat(130000));
    },
  );
  assert.match(fetched.url, /^https:\/\/agent\.kombai\.com\//);
  assert.equal(fetched.options.redirect, "error");
  assert.equal(r.text.length, 120000);
  assert.equal(r.truncated, true);
  await assert.rejects(
    fetchReference({ key: "http://127.0.0.1" }, () => {
      throw Error("Must not fetch");
    }),
    /no downloadable/,
  );
  await assert.rejects(
    fetchReference(
      { key: "dashboard:0" },
      async () => new Response("bad", { status: 503 }),
    ),
    /503/,
  );
});
