export function download(content, name, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readTextFile(file) {
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) throw Error("File exceeds 2 MB");
  return file.text();
}
