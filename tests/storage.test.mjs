import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { StateStore } from "../src/storage.js";
test("persistent projects and stale-window protection", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "qport-"));
  try {
    const store = new StateStore(dir);
    assert.deepEqual(await store.load(), { revision: 0, data: {} });
    await store.save({
      revision: 0,
      data: { title: "中文", notes: ["hello"] },
    });
    assert.equal((await new StateStore(dir).load()).data.title, "中文");
    await assert.rejects(
      store.save({ revision: 0, data: { title: "stale" } }),
      /Another window/,
    );
    assert.equal((await store.load()).data.title, "中文");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("corruption is preserved and oversized state is rejected", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "qport-"));
  try {
    const store = new StateStore(dir);
    await assert.rejects(
      store.save({ revision: 0, data: { text: "x".repeat(9 * 1024 * 1024) } }),
      /8 MB/,
    );
    await writeFile(store.file, "broken");
    await assert.rejects(store.load(), /preserved/);
    await assert.rejects(store.save({ revision: 0, data: {} }), /preserved/);
    assert.equal(await readFile(store.file, "utf8"), "broken");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("concurrent writes serialize read-check-write", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "qport-"));
  try {
    const store = new StateStore(dir);
    const r = await Promise.allSettled([
      store.save({ revision: 0, data: { n: 1 } }),
      store.save({ revision: 0, data: { n: 2 } }),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await store.load()).revision, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
