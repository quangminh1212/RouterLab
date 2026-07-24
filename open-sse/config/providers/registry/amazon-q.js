/** Provider module: amazon-q (RouterLab registry — OmniRoute-style) */
export const id = "amazon-q";
export default {
    // Amazon Q Developer shares the CodeWhisperer streaming backend with Kiro.
    baseUrl: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse",
    format: "kiro",
    retry: { 429: 2 },
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.amazon.eventstream",
      "X-Amz-Target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
      "User-Agent": "AWS-SDK-JS/3.0.0 amazon-q-developer/1.0.0",
      "X-Amz-User-Agent": "aws-sdk-js/3.0.0 amazon-q-developer/1.0.0"
    },
  };
