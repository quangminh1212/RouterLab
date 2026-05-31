import { KiroExecutor } from "./kiro.js";
import { PROVIDERS } from "../config/providers.js";

/**
 * AmazonQExecutor — Amazon Q Developer shares the AWS CodeWhisperer streaming
 * backend and AWS SSO OIDC auth model with Kiro, so it reuses KiroExecutor's
 * EventStream-to-SSE transform and token refresh logic. Only the provider id
 * and config (User-Agent / base URL) differ.
 */
export class AmazonQExecutor extends KiroExecutor {
  constructor() {
    super();
    this.provider = "amazon-q";
    this.config = PROVIDERS["amazon-q"] || PROVIDERS.kiro;
  }
}

export default AmazonQExecutor;
