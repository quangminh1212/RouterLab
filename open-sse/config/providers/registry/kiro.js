/** Provider module: kiro (RouterLab registry — OmniRoute-style) */
export const id = "kiro";
export default {
    baseUrl: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse",
    format: "kiro",
    retry: { 429: 2 },
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.amazon.eventstream",
      "X-Amz-Target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
      "User-Agent": "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
      "X-Amz-User-Agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0"
    },
    tokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
    authUrl: "https://prod.us-east-1.auth.desktop.kiro.dev"
  };
