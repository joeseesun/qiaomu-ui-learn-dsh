import { flatten, previewUrl } from "./original-ui/catalog.ts";
import catalog from "../data/catalog.json" with { type: "json" };
const lookup = new Map(flatten(catalog).map((i) => [i.key, i]));
export async function fetchReference(request, fetcher = fetch) {
  const item = lookup.get(request?.key);
  const url = item && previewUrl(item.row, item.cat.k);
  if (
    !url ||
    !/^https:\/\/agent\.kombai\.com\/kombai-inspiration-library\/(?:app-pages|sections)\/[a-z0-9-]+\/web\/\d+\/index\.html$/.test(
      url,
    )
  )
    throw Error("This reference has no downloadable HTML source");
  const response = await fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(`Reference download failed (${response.status})`);
  if (Number(response.headers.get("content-length")) > 2 * 1024 * 1024)
    throw Error("Reference source exceeds 2 MB");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw Error("Reference source exceeds 2 MB");
    text += decoder.decode(chunk, { stream: true });
  }
  text += decoder.decode();
  return { url, text: text.slice(0, 120000), truncated: text.length > 120000 };
}
