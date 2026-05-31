// Haiper — text-to-video, async submit + job polling
// Docs: https://docs.haiper.ai (OpenAI-style /v1 surface, task-based)
import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";

const BASE_URL = "https://api.haiper.ai/v1";

export default {
  async: true,
  buildUrl: () => `${BASE_URL}/video/generation`,
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    };
  },
  buildBody: (model, body) => {
    const req = {
      prompt: body.prompt,
      duration: body.duration || 4,
    };
    if (model && model !== "haiper") req.model = model;
    if (body.image) req.image_url = body.image;
    if (body.size) req.aspect_ratio = body.size;
    return req;
  },
  async parseResponse(response, { headers }) {
    const submit = await response.json();
    const jobId = submit?.id || submit?.job_id || submit?.data?.id;
    if (!jobId) throw new Error("Haiper: no job id returned");
    const pollUrl = `${BASE_URL}/video/generation/${jobId}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const r = await fetch(pollUrl, { headers });
      if (!r.ok) throw new Error(`Haiper status ${r.status}`);
      const s = await r.json();
      const status = s?.status || s?.data?.status;
      if (status === "succeeded" || status === "completed") return s;
      if (status === "failed") throw new Error(s?.error || "Haiper generation failed");
    }
    throw new Error("Haiper polling timeout");
  },
  normalize: (responseBody) => {
    const d = responseBody?.data || responseBody;
    const urls = [];
    if (Array.isArray(d?.video_urls)) urls.push(...d.video_urls);
    else if (d?.video_url) urls.push(d.video_url);
    else if (d?.url) urls.push(d.url);
    return { created: nowSec(), data: urls.map((url) => ({ url })) };
  },
};
