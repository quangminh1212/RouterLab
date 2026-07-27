# Qwen Models Test Report — 9router Remote

## Summary

| Model | HTTP | Latency | Verdict |
|-------|------|---------|---------|
| qwencoder/qwen3.7-max | 200 | 5.7s | ✅ PASS |
| qwencoder/qwen3.8-max-preview | 500 | 34s | ❌ crash — empty body |
| qwencoder/qwen3.6-35b-a3b | 404 | 4.2s | ❌ not found |
| qwencoder/laguna-s-2.1 | 404 | 51s | ❌ not found |
| qwencoder/glm-5.2 | 404 | 71ms | ❌ not found |
| qwencoder/grok-4.5 | timeout | 10s | ❌ timeout |
| qwencoder/minimax-m3 | timeout | 10s | ❌ timeout |
| qwencoder/kimi-2.6 | 404 | — | ❌ not found |
| XLab combo (non-stream) | 200 | 43s | ❌ upstream overloaded + streaming leak |
| XLab combo (stream) | 200 | 10s | ❌ qoder 403 billing error code 112 |

## Issues Found

### Critical — 9router Instance
1. **qwencoder API key expired/quota depleted** — upstream qoder returns 403 code 112 ("pricingUrl")
2. **Most model names in XLab combo don't exist** — only `qwen3.7-max` works
3. **Resolved**: qwencoder breaker was `half_open` → manually reset, now clean

### Code Bugs — RouterLab
4. **Combo streaming leak** — when combo fallback triggers, non-streaming response body includes `data: [DONE]` SSE chunk delimiters. Root: `chatCore.js` should force `stream: true` for combo fallback responses regardless of original request's `stream: false`.
5. **Breaker config** — `failureThreshold: 5` + `resetTimeoutMs: 30000` is too aggressive for a multi-model combo. Should be `failureThreshold: 10` or more.
6. **qwen-cloud OAuth provider** — no `modelsFetcher` configured, relies on fallback static list

### Remote Instance Config Needed
- Refresh qwencoder API key at `https://api.qwencoder.cloud`
- Verify actual model names via `GET https://api.qwencoder.cloud/v1/models`
- Update XLab combo models to only valid IDs
- Consider removing `qwen3.6-35b-a3b` from combo (never existed on qwencoder)

## Feature Completeness (from working model qwen3.7-max)

| Feature | Status |
|---------|--------|
| Basic chat | ✅ 200 OK |
| Streaming | ✅ `data: [DONE]` present |
| Tools/functions | not tested |
| Vision | not tested |
| Thinking/reasoning | ✅ 83 reasoning tokens returned |
| Non-streaming | ⚠️ combo fallback leaks SSE chunks |
