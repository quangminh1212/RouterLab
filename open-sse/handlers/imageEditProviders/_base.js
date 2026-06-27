// Shared helpers for image edit provider adapters
export { nowSec, sizeToAspectRatio } from "../imageProviders/_base.js";

function isUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function parseDataUrl(v) {
  const m = v.match(/^data:([^;]+);base64,(.+)$/);
  return m ? { type: m[1], data: m[2] } : null;
}

function base64ToBlob(base64, type = "image/png") {
  const buf = Buffer.from(base64, "base64");
  return new Blob([buf], { type });
}

async function urlToBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return await res.blob();
}

export async function toImageBlob(input, defaultType = "image/png") {
  if (!input) return null;
  if (input instanceof Blob) return input;
  if (typeof input !== "string") return null;

  const dataUrl = parseDataUrl(input);
  if (dataUrl) return base64ToBlob(dataUrl.data, dataUrl.type || defaultType);
  if (isUrl(input)) return await urlToBlob(input);
  return base64ToBlob(input, defaultType);
}

export async function fileToDataUrl(input, defaultType = "image/png") {
  if (!input) return null;
  if (input instanceof Blob) {
    const buf = await input.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const type = input.type || defaultType;
    return `data:${type};base64,${b64}`;
  }
  if (typeof input !== "string") return null;
  if (isUrl(input) || parseDataUrl(input)) return input;
  return `data:${defaultType};base64,${input}`;
}
