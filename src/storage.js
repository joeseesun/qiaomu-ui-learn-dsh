import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export class StateStore {
  constructor(directory) {
    this.file = path.join(directory, "state.json");
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8"));
      if (
        !Number.isSafeInteger(raw.revision) ||
        raw.revision < 0 ||
        !raw.data ||
        typeof raw.data !== "object" ||
        Array.isArray(raw.data)
      )
        throw Error("Invalid saved data");
      return raw;
    } catch (e) {
      if (e.code === "ENOENT") return { revision: 0, data: {} };
      throw Error("Saved data could not be read. Original file preserved.", {
        cause: e,
      });
    }
  }
  save(input) {
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (
          !input ||
          !Number.isSafeInteger(input.revision) ||
          !input.data ||
          typeof input.data !== "object" ||
          Array.isArray(input.data)
        )
          throw Error("Invalid state");
        const current = await this.load();
        if (input.revision !== current.revision)
          throw Error(
            "Another window saved changes. Reopen this panel before saving.",
          );
        const next = { revision: current.revision + 1, data: input.data };
        const text = JSON.stringify(next);
        if (Buffer.byteLength(text) > 8 * 1024 * 1024)
          throw Error(
            "Saved project exceeds 8 MB. Export it as a file instead.",
          );
        await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
        const temp = this.file + "." + randomUUID() + ".tmp";
        await writeFile(temp, text, { mode: 0o600 });
        await rename(temp, this.file);
        return next;
      });
    this.queue = task;
    return task;
  }
}
