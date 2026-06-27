import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";

const SUBMIT_URL = "https://studio-api.suno.ai/api/generate/v2/";
const FEED_URL = "https://studio-api.suno.ai/api/feed/";

export default {
  buildUrl: () => SUBMIT_URL,
  buildHeaders: (creds) => {
    const cookie = creds?.providerSpecificData?.cookie || creds?.accessToken;
    return {
      "Content-Type": "application/json",
      "Cookie": cookie,
    };
  },
  buildBody: (model, body) => {
    const req = {
      prompt: body.prompt,
      make_instrumental: body.instrumental ?? false,
    };
    if (body.style) req.tags = body.style;
    if (body.duration) req.duration = body.duration;
    if (model && model !== "suno") req.model_version = model;
    return req;
  },
  async poll(taskId, headers, options = {}) {
    const pollInterval = options.pollIntervalMs || POLL_INTERVAL_MS;
    const deadline = Date.now() + (options.maxPollTimeMs || POLL_TIMEOUT_MS);
    while (Date.now() < deadline) {
      await sleep(pollInterval);
      const r = await fetch(`${FEED_URL}?ids=${taskId}`, { headers });
      if (!r.ok) throw new Error(`Suno feed status ${r.status}`);
      const data = await r.json();
      const clips = Array.isArray(data) ? data : (data.clips || []);
      const clip = clips.find((c) => c.id === taskId) || clips[0];
      if (!clip) continue;
      const status = clip.status;
      if (status === "complete") return clip;
      if (status === "error") throw new Error(clip.error_message || "Suno generation failed");
    }
    throw new Error("Suno polling timeout");
  },
  parseSubmit(responseBody) {
    const clips = responseBody?.clips || responseBody;
    const first = Array.isArray(clips) ? clips[0] : clips;
    const id = first?.id || responseBody?.id;
    if (!id) throw new Error("Suno: no task id returned");
    return id;
  },
  normalize(clip, provider) {
    return {
      url: clip.audio_url,
      title: clip.title || clip.metadata?.prompt?.slice(0, 60) || "Generated Track",
      duration: clip.metadata?.duration || null,
      provider,
    };
  },
};
