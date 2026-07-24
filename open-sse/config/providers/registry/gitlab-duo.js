/** Provider module: gitlab-duo (Omni gap-fill) */
export const id = "gitlab-duo";
/** Alias of `gitlab` — same endpoint for Omni naming parity. */
export default {
  baseUrl: "https://gitlab.com/api/v4/chat/completions",
  format: "openai",
  aliasOf: "gitlab",
};
