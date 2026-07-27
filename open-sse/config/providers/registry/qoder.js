/** Provider module: qoder — COSY-signed inference on api3.qoder.sh */
export const id = "qoder";
export default {
  baseUrl: "https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation",
  format: "openai",
  headers: {},
  timeoutMs: 120000,
  // Device-token OAuth (COSY chat needs userId + accessToken)
  clientId: process.env.QODER_OAUTH_CLIENT_ID || "",
  tokenUrl: "https://openapi.qoder.sh/api/v1/deviceToken/poll",
  authUrl: "https://qoder.com/device/selectAccounts",
  openApiBaseUrl: "https://openapi.qoder.sh",
  centerBaseUrl: "https://center.qoder.sh",
  chatBaseUrl: "https://api3.qoder.sh",
};
