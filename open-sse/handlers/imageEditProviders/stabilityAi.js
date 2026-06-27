import { nowSec, toImageBlob } from "./_base.js";

export default {
  buildUrl: () => "https://api.stability.ai/v2beta/stable-image/edit/inpaint",
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return {
      "Authorization": `Bearer ${key}`,
      "Accept": "application/json",
    };
  },
  buildBody: async (_model, body) => {
    const form = new FormData();
    const image = await toImageBlob(body.image, "image/png");
    if (image) form.append("image", image, "image.png");
    const mask = await toImageBlob(body.mask, "image/png");
    if (mask) form.append("mask", mask, "mask.png");
    form.append("prompt", body.prompt);
    form.append("output_format", (body.output_format || "png").toLowerCase());
    if (body.strength != null) form.append("strength", String(body.strength));
    if (body.seed != null) form.append("seed", String(body.seed));
    return form;
  },
  normalize: (responseBody) => {
    if (responseBody.image) return { created: nowSec(), data: [{ b64_json: responseBody.image }] };
    return { created: nowSec(), data: [] };
  },
};
