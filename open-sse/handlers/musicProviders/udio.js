import { sleep, nowSec, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./_base.js";

const SUBMIT_URL = "https://www.udio.com/api/generate-proxy";
const SONGS_URL = "https://www.udio.com/api/songs";

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
      samplerOptions: {
        seed: -1,
      },
    };
    if (body.instrumental) {
      req.samplerOptions.audio_conditioning_type = "instrumental";
    }
    if (body.style) req.samplerOptions.custom_lyrics_style = body.style;
    return req;
  },
  async poll(taskId, headers, options = {}) {
    const pollInterval = options.pollIntervalMs || POLL_INTERVAL_MS;
    const deadline = Date.now() + (options.maxPollTimeMs || POLL_TIMEOUT_MS);
    while (Date.now() < deadline) {
      await sleep(pollInterval);
      const r = await fetch(`${SONGS_URL}?songIds=${taskId}`, { headers });
      if (!r.ok) throw new Error(`Udio songs status ${r.status}`);
      const data = await r.json();
      const songs = Array.isArray(data) ? data : (data.songs || []);
      const song = songs.find((s) => s.id === taskId) || songs[0];
      if (!song) continue;
      const status = song.finished ? "complete" : song.error_type ? "error" : "pending";
      if (status === "complete") return song;
      if (status === "error") throw new Error(song.error_message || "Udio generation failed");
    }
    throw new Error("Udio polling timeout");
  },
  parseSubmit(responseBody) {
    const songs = responseBody?.songs || responseBody;
    const first = Array.isArray(songs) ? songs[0] : songs;
    const id = first?.id || responseBody?.id;
    if (!id) throw new Error("Udio: no task id returned");
    return id;
  },
  normalize(song, provider) {
    return {
      url: song.song_path,
      title: song.title || song.prompt?.slice(0, 60) || "Generated Track",
      duration: song.duration || null,
      provider,
    };
  },
};
