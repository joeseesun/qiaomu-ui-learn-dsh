import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const p = JSON.parse(await readFile("package.json", "utf8"));
const c = await readFile("client.js", "utf8");
assert(c.includes("__ModuleLoader__.load"));
assert(c.includes(`id:${JSON.stringify(p.name)}`));
assert(!/require\(["']obsidian/.test(c));
assert(!/require\(["']@deepseek-ai/.test(c));
for (const f of [
  "index.js",
  "cordis.patch.yml",
  "icon.svg",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "locale/en.json",
  "locale/zh.json",
])
  assert((await readFile(f)).length > 0);
console.log("Package entry points and loader contract verified");
