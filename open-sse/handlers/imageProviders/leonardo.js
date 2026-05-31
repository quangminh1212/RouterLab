// Leonardo AI — async submit + /generations/{id} polling
// Docs: https://docs.leonardo.ai/reference/creategeneration
import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";

const BASE_URL = "https://cloud.leonardo.ai/api/rest/v1";

// Leonardo wants explicit width/height (multiples of 8). Map common OpenAI sizes.
function sizeToWH(size) {
  if (typeof size === "string" && /^\d+x\d+$/.test(size)) {
    const [w, h] = size.split("x").map((n) => parseInt(n, 10));
    return { width: w, height: h };
  }
  return { width: 1024, height: 1024 };
}

export default {
  async: true,
  buildUrl: () => `${BASE_URL}/generations`,
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${key}`,
    };
  },
  buildBody: (model, body) => {
    const { width, height } = sizeToWH(body.size);
    const req = {
      prompt: body.prompt,
      num_images: body.n || 1,
      width,
      height,
    };
    // Allow passing a Leonardo model UUID via providerSpecificData/model; otherwise let account default apply.
    if (model && model !== "leonardo" && /^[0-9a-f-]{16,}$/i.test(model)) req.modelId = model;
    return req;
  },
  async parseResponse(response, { headers }) {
    const submit = await response.json();
    const genId = submit?.sdGenerationJob?.generationId;
    if (!genId) throw new Error("Leonardo: no generationId returned");
    const pollUrl = `${BASE_URL}/generations/${genId}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const r = await fetch(pollUrl, { headers });
      if (!r.ok) throw new Error(`Leonardo status ${r.status}`);
      const s = await r.json();
      const gen = s?.generations_by_pk;
      if (gen?.status === "COMPLETE") return gen;
      if (gen?.status === "FAILED") throw new Error("Leonardo generation failed");
    }
    throw new Error("Leonardo polling timeout");
  },
  normalize: (responseBody) => {
    const images = Array.isArray(responseBody.generated_images) ? responseBody.generated_images : [];
    return { created: nowSec(), data: images.map((img) => ({ url: img.url })) };
  },
};
