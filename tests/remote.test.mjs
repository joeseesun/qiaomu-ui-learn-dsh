import { test } from "node:test";
import assert from "node:assert/strict";
import { remoteApi } from "../src/remote.js";
test("DSH result envelopes are unwrapped and failed operations reject", async () => {
  let args;
  const api = remoteApi(
    {
      load: async (...v) => {
        args = v;
        return { ok: true, value: { revision: 0, data: {} } };
      },
      save: async () => ({ ok: false, error: { message: "conflict" } }),
    },
    ["load", "save"],
  );
  assert.deepEqual(await api.load(), { revision: 0, data: {} });
  assert.equal(args.length, 0);
  await assert.rejects(api.save({}), /conflict/);
});
