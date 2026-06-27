import { nowSec, sizeToAspectRatio, fileToDataUrl } from "./_base.js";

function modelToEndpoint(model) {
  const m = model.replace(/^fal-ai\//, "");
  if (m === "flux-inpaint") return "flux/dev/image-to-image";
  return m;
}

export default {
  buildUrl: (model) => `https://fal.run/fal-ai/${modelToEndpoint(model)}`,
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return { "Content-Type": "application/json", "Authorization": `Key ${key}` };
  },
  buildBody: async (_model, body) => {
    const req = { prompt: body.prompt, num_images: Number(body.n) || 1 };
    if (body.image) req.image_url = await fileToDataUrl(body.image, "image/png");
    if (body.mask) req.mask_url = await fileToDataUrl(body.mask, "image/png");
    if (body.size) req.image_size = sizeToAspectRatio(body.size);
    if (body.strength != null) req.strength = Number(body.strength);
    if (body.seed != null) req.seed = Number(body.seed);
    return req;
  },
  normalize: (responseBody) => {
    const images = Array.isArray(responseBody.images)
      ? responseBody.images
      : (responseBody.image ? [responseBody.image] : []);
    return { created: nowSec(), data: images.map((img) => ({ url: img.url || img })) };
  },
};
