import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { flatten, thumbUrl, openUrl } from "../src/original-ui/catalog.ts";
import { searchLearn } from "../src/original-ui/learnui-data.ts";
const catalog = JSON.parse(
  await readFile(new URL("../data/catalog.json", import.meta.url)),
);
const data = JSON.parse(
  await readFile(new URL("../data/learnui.json", import.meta.url)),
);
test("full catalogue has unique stable ids and safe external URLs", () => {
  const rows = flatten(catalog);
  assert.equal(rows.length, catalog.total);
  assert(rows.length > 13000);
  assert.equal(new Set(rows.map((x) => x.key)).size, rows.length);
  for (const x of rows) {
    assert.match(openUrl(x.row, x.cat.k), /^https:\/\//);
    const thumb = thumbUrl(x.row);
    if (thumb) assert.match(thumb, /^https:\/\//);
  }
});
test("dictionary searches real Chinese and English component entries", () => {
  assert(data.entries.length >= 60);
  assert(data.styles.length >= 40);
  assert(searchLearn(data, "button").entries.length > 0);
  assert(searchLearn(data, "按钮").entries.length > 0);
  assert.equal(searchLearn(data, "zzzz_no_such_component").entries.length, 0);
});
