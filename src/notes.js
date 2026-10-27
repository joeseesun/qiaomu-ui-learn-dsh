import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  lstat,
  unlink,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
const hash = (text) => createHash("sha256").update(text).digest("hex");
export class NotesStore {
  constructor(root) {
    this.root = path.resolve(root);
    this.queue = Promise.resolve();
    this.ready = mkdir(this.root, { recursive: true, mode: 0o700 })
      .then(() => realpath(this.root))
      .then((root) => {
        this.root = root;
      });
  }
  async resolve(relative, { directory = false } = {}) {
    await this.ready;
    if (
      typeof relative !== "string" ||
      relative.includes("\0") ||
      path.isAbsolute(relative) ||
      relative.split(/[\\/]/).some((x) => x === ".." || x.startsWith("."))
    )
      throw Error("Choose a relative path inside the notes folder");
    if (!directory && !relative.toLowerCase().endsWith(".md"))
      throw Error("Only Markdown notes are supported");
    const target = path.resolve(this.root, relative);
    if (target !== this.root && !target.startsWith(this.root + path.sep))
      throw Error("Invalid note path");
    // The explicit root is canonicalized (macOS /tmp and /var are symlinks).
    // Never follow user-controlled links beneath that root.
    let current = this.root;
    for (const part of target
      .slice(current.length)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, part);
      try {
        const stat = await lstat(current);
        if (stat.isSymbolicLink())
          throw Error("Symbolic links are not followed");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    return target;
  }
  async list(folder = "") {
    const dir = await this.resolve(folder, { directory: true });
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      return {
        root: this.root,
        folder,
        entries: entries
          .filter(
            (x) =>
              !x.name.startsWith(".") &&
              !x.isSymbolicLink() &&
              (x.isDirectory() || x.name.toLowerCase().endsWith(".md")),
          )
          .slice(0, 1000)
          .map((x) => ({ name: x.name, directory: x.isDirectory() }))
          .sort(
            (a, b) =>
              Number(b.directory) - Number(a.directory) ||
              a.name.localeCompare(b.name),
          ),
      };
    } catch (e) {
      if (e.code === "ENOENT") return { root: this.root, folder, entries: [] };
      throw e;
    }
  }
  async read(relative) {
    const filename = await this.resolve(relative);
    const s = await lstat(filename);
    if (!s.isFile() || s.size > 2 * 1024 * 1024)
      throw Error("Note exceeds 2 MB or is not a file");
    const text = await readFile(filename, "utf8");
    return { path: relative, text, etag: hash(text) };
  }
  write(request) {
    const work = this.queue
      .catch(() => {})
      .then(async () => {
        if (
          !request ||
          typeof request.text !== "string" ||
          Buffer.byteLength(request.text) > 2 * 1024 * 1024
        )
          throw Error("Invalid note or note exceeds 2 MB");
        const filename = await this.resolve(request.path);
        let existing = null;
        try {
          existing = await this.read(request.path);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        if ((existing?.etag ?? null) !== (request.etag ?? null))
          throw Error(
            "The note has changed or already exists. Open it again before saving.",
          );
        await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
        await this.resolve(request.path);
        const temp = filename + "." + randomUUID() + ".tmp";
        try {
          await writeFile(temp, request.text, { mode: 0o600, flag: "wx" });
          await rename(temp, filename);
        } catch (e) {
          await unlink(temp).catch(() => {});
          throw e;
        }
        return {
          path: request.path,
          text: request.text,
          etag: hash(request.text),
        };
      });
    this.queue = work;
    return work;
  }
}
