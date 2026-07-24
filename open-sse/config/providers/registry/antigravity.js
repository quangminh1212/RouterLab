/** Provider module: antigravity (RouterLab registry — OmniRoute-style) */
import { platform, arch } from "os";

export const id = "antigravity";
export default {
    baseUrls: [
      "https://daily-cloudcode-pa.googleapis.com",
      "https://daily-cloudcode-pa.sandbox.googleapis.com",
    ],
    format: "antigravity",
    headers: { "User-Agent": `antigravity/1.107.0 ${platform()}/${arch()}` },
    clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    clientSecret: "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"
  };
