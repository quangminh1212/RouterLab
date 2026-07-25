// Segmind — POST /v1/{model}, x-api-key, raw image bytes response
import { nowSec } from "./_base.js";

const BASE_URL = "https://api.segmind.com/v1";

function parseSize(size) {
  if (!size || typeof size !== "string" || !size.includes("x")) {
    return { width: 1024, height: 1024 };
  }
  const [w, h] = size.split("x").map((n) => parseInt(n, 10));
  return {
    width: Number.isFinite(w) ? w : 1024,
    height: Number.isFinite(h) ? h : 1024,
  };
}

export default {
  buildUrl: (model) => `${BASE_URL}/${model}`,
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return {
      "Content-Type": "application/json",
      "x-api-key": key,
      Accept: "image/*",
    };
  },
  buildBody: (_model, body) => {
    const { width, height } = parseSize(body.size);
    const req = {
      prompt: body.prompt,
      width,
      height,
      samples: body.n || 1,
    };
    if (body.negative_prompt) req.negative_prompt = body.negative_prompt;
    if (body.image) req.image = body.image;
    return req;
  },
  async parseResponse(response) {
    const ct = (response.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      return await response.json();
    }
    const buf = Buffer.from(await response.arrayBuffer());
    return { image_b64: buf.toString("base64") };
  },
  normalize: (responseBody) => {
    if (responseBody?.image_b64) {
      return { created: nowSec(), data: [{ b64_json: responseBody.image_b64 }] };
    }
    if (responseBody?.image) {
      return { created: nowSec(), data: [{ b64_json: responseBody.image }] };
    }
    if (Array.isArray(responseBody?.data)) {
      return { created: nowSec(), data: responseBody.data };
    }
    if (Array.isArray(responseBody?.images)) {
      return {
        created: nowSec(),
        data: responseBody.images.map((img) =>
          typeof img === "string"
            ? { b64_json: img }
            : { url: img.url, b64_json: img.b64_json || img.base64 }
        ),
      };
    }
    return { created: nowSec(), data: [] };
  },
};
