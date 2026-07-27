# Qwen Models Test Report — 9router Remote (36.50.26.247:1212)

Tested: 2026-07-27 04:20-04:30 UTC  
Method: 5 parallel subagents + 17 sequential curl tests  
Gateway health: `degraded` (qwencoder breaker open)

---

## Individual Model Results

| Model | HTTP | Latency | Content | Verdict |
|-------|------|---------|---------|---------|
| qwencoder/qwen3.7-max | 200 | 1.9-8.4s | ✅ exact "OK" | ✅ **PASS** |
| qwencoder/qwen3.8-max-preview | 500 | 28-34s | empty body (crash) | ❌ **FAIL** |
| qwencoder/qwen3.6-35b-a3b | 404 | 4.2s | MODEL_NOT_FOUND | ❌ not deployed |
| qwencoder/laguna-s-2.1 | 404 | 51s | model not found | ❌ not deployed |
| qwencoder/glm-5.2 | 404 | 71ms | not found | ❌ not deployed |
| qwencoder/grok-4.5 | timeout | 10s+ | — | ❌ timeout |
| qwencoder/minimax-m3 | timeout | 10s+ | — | ❌ timeout |
| qwencoder/kimi-2.6 | 404 | — | not found | ❌ not deployed |
| qwencoder/qwen3.8-max-standard | 404 | 0.3s | not found | ❌ not deployed |
| qwencoder/qwen3.8-max | 404 | 0.3s | not found | ❌ not deployed |
| qwencoder/qwen-max-2025-01-25 | 404 | 0.2s | not found | ❌ not deployed |
| qwencoder/deepseek-coder | 404 | 0.2s | not found | ❌ not deployed |

**Result: Only 1/12 models works.**

## XLab Combo (6-model fallback)

| Test | HTTP | Serving Model | Content | Latency |
|------|------|--------------|---------|---------|
| Non-streaming | 200 | grok-4.5 (final fallback) | "Hi." / "test1-3" | 33-42s |
| Streaming | 200 | qwen3.8-max-preview (1st) | qoder 403 error | 30s |

- **3/3 non-streaming calls** = all succeed via grok-4.5 fallback ✅
- Combo chain: qwen3.8-max-preview (500) → grok-4.5 (✅)
- **Latency high** (~35s) because first model always fails before fallback

## Feature Completeness — qwen3.7-max

| Feature | Status | Test |
|---------|--------|------|
| Basic chat | ✅ | "OK" exact match |
| Non-streaming | ✅ | 200 JSON |
| Streaming | ✅ | SSE chunks with `data:[DONE]` |
| Reasoning | ✅ | `reasoning_content` present, `reasoning_effort` param works |
| Tool calling (non-stream) | ✅ | `finish_reason: "tool_calls"`, correct function call |
| Tool calling (streaming) | ✅ | Reasoning chunks stream correctly |
| Code generation | ✅ | Clean Python output |
| Vietnamese | ✅ | Natural Vietnamese response |
| Long context | ✅ | 2000 chars processed fine |
| Repeated calls | ✅ | 3/3 rapid succession |
| Vision (image) | ❌ | "Vision unsupported" — model doesn't support via this API |

## Root Causes

1. **qwencoder API key** — likely expired/quota depleted → only qwen3.7-max still works (might be free tier)
2. **qwen3.8-max-preview** — server crash (500 empty body, 30s processing). Either model not loaded or OOM
3. **Model names wrong** — `qwen3.6-35b-a3b`, `laguna-s-2.1` etc. don't exist on qwencoder API
4. **Gateway status: degraded** — qwencoder breaker is open due to repeated 500s

## Recommended Actions

### Remote 9router (requires admin access)
1. **Refresh qwencoder API key** at `https://api.qwencoder.cloud`
2. **Check model list** — `GET https://api.qwencoder.cloud/v1/models` to see what's actually available
3. **Update XLab combo** — remove non-existent models, add qwen3.7-max as first choice
4. **Check qwen3.8-max-preview** — why does it crash? Check qwencoder upstream logs

### RouterLab Code (optional improvements)
5. **Combo first-model skip** — if qwen3.8-max-preview always 500, combo should skip it faster (reduce wait)
6. **Breaker threshold** — 5 failures is too aggressive for multi-model combos; consider per-model breakers
