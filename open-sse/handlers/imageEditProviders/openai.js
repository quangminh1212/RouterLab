import { toImageBlob } from "./_base.js";

export default {
  buildUrl: () => "https://api.openai.com/v1/images/edits",
  buildHeaders: (creds) => {
    const headers = {};
    const key = creds?.apiKey || creds?.accessToken;
    if (key) headers["Authorization"] = `Bearer ${key}`;
    return headers;
  },
  buildBody: async (_model, body) => {
    const form = new FormData();
    const image = await toImageBlob(body.image, "image/png");
    if (image) form.append("image", image, "image.png");
    const mask = await toImageBlob(body.mask, "image/png");
    if (mask) form.append("mask", mask, "mask.png");
    form.append("model", _model);
    form.append("prompt", body.prompt);
    form.append("n", String(body.n || 1));
    if (body.size) form.append("size", body.size);
    if (body.response_format) form.append("response_format", body.response_format);
    return form;
  },
  normalize: (responseBody) => responseBody,
};
