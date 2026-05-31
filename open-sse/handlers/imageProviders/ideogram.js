// Ideogram v3 — synchronous generate, returns { data: [{ url }] }
// Docs: https://developer.ideogram.ai/api-reference/api-reference/generate-v3
import { nowSec, sizeToAspectRatio } from "./_base.js";

const BASE_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate";

// Ideogram uses aspect ratio tokens like "1x1", "16x9"
function sizeToIdeogramAspect(size) {
  const ar = sizeToAspectRatio(size); // "1:1", "16:9", ...
  return ar.replace(":", "x");
}

export default {
  buildUrl: () => BASE_URL,
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return { "Content-Type": "application/json", "Api-Key": key };
  },
  buildBody: (model, body) => {
    const req = {
      prompt: body.prompt,
      num_images: body.n || 1,
      aspect_ratio: sizeToIdeogramAspect(body.size),
    };
    // model id like "ideogram-v3", "ideogram-v3-turbo" → rendering_speed
    if (/turbo/i.test(model)) req.rendering_speed = "TURBO";
    else if (/quality/i.test(model)) req.rendering_speed = "QUALITY";
    if (body.style) req.style_type = String(body.style).toUpperCase();
    return req;
  },
  normalize: (responseBody) => {
    const items = Array.isArray(responseBody.data) ? responseBody.data : [];
    return {
      created: nowSec(),
      data: items.map((it) => (it.url ? { url: it.url } : { b64_json: it.b64_json })).filter(Boolean),
    };
  },
};
