import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import path from "node:path";
import { homedir } from "node:os";
import { StateStore } from "./storage.js";
import { NotesStore } from "./notes.js";
import { fetchReference } from "./source.js";
import { NAME, SERVICE } from "./meta.js";
export const Config = {
  "~standard": {
    version: 1,
    vendor: NAME,
    validate(value) {
      if (value == null) return { value: {} };
      if (
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some((k) => !["dataDir", "notesRoot"].includes(k)) ||
        (value.dataDir !== undefined &&
          (typeof value.dataDir !== "string" ||
            !path.isAbsolute(value.dataDir))) ||
        (value.notesRoot !== undefined &&
          (typeof value.notesRoot !== "string" ||
            !path.isAbsolute(value.notesRoot)))
      )
        return {
          issues: [{ message: "dataDir must be an absolute directory" }],
        };
      return { value };
    },
  },
};
export default class PluginService extends TypertRemoteService {
  constructor(ctx, config = {}) {
    super(ctx, SERVICE);
    this.store = new StateStore(
      config.dataDir ||
        path.join(
          process.env.DSH_HOME || path.join(homedir(), ".dsh"),
          "qiaomu",
          NAME,
        ),
    );
    this.notes = new NotesStore(
      config.notesRoot || path.join(path.dirname(this.store.file), "notes"),
    );
  }
  notesList(request) {
    return this.notes.list(request?.folder || "");
  }
  notesRead(request) {
    return this.notes.read(request.path);
  }
  notesWrite(request) {
    return this.notes.write(request);
  }
  referenceSource(request) {
    return fetchReference(request);
  }
  load() {
    return this.store.load();
  }
  save(request) {
    return this.store.save(request);
  }
}
for (const name of [
  "load",
  "save",
  "notesList",
  "notesRead",
  "notesWrite",
  "referenceSource",
])
  Remote(name)(PluginService.prototype[name], {
    name,
    private: false,
    static: false,
    addInitializer(fn) {
      fn.call(Object.create(PluginService.prototype));
    },
  });
