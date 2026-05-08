# Moderation & Rerank Implementation Report

**Date:** 2026-05-09  
**Commit:** `6154431` - `feat: add provider-backed moderation and rerank endpoints`  
**Status:** ✅ Complete

---

## Objective

Chuyển `/v1/moderations` và `/v1/rerank` từ **compatibility stub** sang **production-ready handler** với:
- Config-driven provider routing (giống TTS/STT/Search pattern)
- Auth + credential fallback (giống embeddings/chat)
- Provider config cho OpenAI, Azure, Cohere, Jina, Voyage
- Route-level regression tests

---

## Implementation Summary

### 1. Core Handlers (Config-Driven Pattern)

#### `open-sse/handlers/moderationCore.js`
- **Format dispatch:** `openai`, `azure`
- **Auth:** `buildAuthHeaders(cfg, credentials)` hỗ trợ `bearer`, `x-api-key`, `api-key`
- **Azure:** Dynamic endpoint từ `providerSpecificData.azureEndpoint` + `apiVersion`
- **Error handling:** HTTP status mapping, timeout, network errors

#### `open-sse/handlers/rerankCore.js`
- **Format dispatch:** `cohere`, `jina`, `voyage`
- **Auth:** Tương tự moderation
- **Voyage:** Dùng `top_k` thay vì `top_n`
- **Document normalization:** Hỗ trợ cả `string` và `{text: string}` format

### 2. SSE Handlers (Auth + Fallback)

#### `src/sse/handlers/moderation.js`
- Pattern giống `embeddings.js`:
  - `getProviderCredentials` + `excludeConnectionIds` loop
  - `markAccountUnavailable` + `shouldFallback`
  - `clearAccountError` on success
- Default model: `openai/text-moderation-latest`
- API key validation khi `requireApiKey=true`

#### `src/sse/handlers/rerank.js`
- Pattern giống `embeddings.js`
- Default model: `cohere/rerank-v3.5`
- Validate `query` và `documents` required

### 3. Route Wiring

#### `src/app/api/v1/moderations/route.js`
- Thay stub bằng `handleModeration(request)`
- `withRouteGuard("v1/moderations", postHandler, { timeoutMs: 30000 })`
- CORS OPTIONS handler

#### `src/app/api/v1/rerank/route.js`
- Thay stub bằng `handleRerank(request)`
- `withRouteGuard("v1/rerank", postHandler, { timeoutMs: 30000 })`
- CORS OPTIONS handler

### 4. Provider Config

#### `src/shared/constants/providers.js`

**OpenAI:**
```js
serviceKinds: [..., "moderation"]
moderationConfig: {
  baseUrl: "https://api.openai.com/v1/moderations",
  authType: "apikey",
  authHeader: "bearer",
  format: "openai",
  models: [
    { id: "text-moderation-latest", name: "Text Moderation Latest" },
    { id: "omni-moderation-latest", name: "Omni Moderation Latest" }
  ]
}
```

**Azure:**
```js
serviceKinds: ["llm", "moderation"]
moderationConfig: {
  baseUrl: "azure",  // Dynamic từ providerSpecificData
  authType: "apikey",
  authHeader: "api-key",
  format: "azure",
  models: [{ id: "text-moderation-latest", name: "Text Moderation Latest" }]
}
```

**Cohere:**
```js
serviceKinds: ["llm", "rerank"]
rerankConfig: {
  baseUrl: "https://api.cohere.com/v2/rerank",
  authType: "apikey",
  authHeader: "bearer",
  format: "cohere",
  models: [
    { id: "rerank-v3.5", name: "Rerank v3.5" },
    { id: "rerank-english-v3.0", name: "Rerank English v3.0" }
  ]
}
```

**Jina:**
```js
serviceKinds: ["embedding", "rerank"]
rerankConfig: {
  baseUrl: "https://api.jina.ai/v1/rerank",
  authType: "apikey",
  authHeader: "bearer",
  format: "jina",
  models: [{ id: "jina-reranker-v2-base-multilingual", name: "Jina Reranker v2 Base Multilingual" }]
}
```

**Voyage:**
```js
serviceKinds: ["embedding", "rerank"]
rerankConfig: {
  baseUrl: "https://api.voyageai.com/v1/rerank",
  authType: "apikey",
  authHeader: "bearer",
  format: "voyage",
  models: [
    { id: "rerank-2.5", name: "Rerank 2.5" },
    { id: "rerank-2.5-lite", name: "Rerank 2.5 Lite" }
  ]
}
```

**SERVICE_KINDS registry:**
```js
{ id: "moderation", label: "Moderation", icon: "verified_user", endpoint: { method: "POST", path: "/v1/moderations" } }
{ id: "rerank", label: "Rerank", icon: "sort", endpoint: { method: "POST", path: "/v1/rerank" } }
```

### 5. Tests

#### `tests/unit/moderation-rerank-routes.test.js`
- **Moderation:**
  - ✅ Returns OpenAI-compatible response
  - ✅ Validates `input` field
- **Rerank:**
  - ✅ Returns Cohere-compatible response
  - ✅ Validates `query` and `documents`
  - ✅ Defaults to `cohere/rerank-v3.5` when model omitted

**Test results:**
- Isolated: 5 passed
- Full suite: 239 passed, 19 skipped

---

## Verification

### Unit Tests
```bash
npm test --prefix C:\Dev\XLab_Router\tests -- moderation-rerank-routes.test.js
# ✓ 5 passed
```

### Full Test Suite
```bash
npm test --prefix C:\Dev\XLab_Router\tests
# ✓ 239 passed | 19 skipped (258)
```

### Production Build
```bash
npm run build
# ✓ Compiled successfully in 2.8min
# ✓ TypeScript in 206ms
# ✓ Generating static pages (149/149) in 3.6s
# Exit code: 0
```

---

## Architecture Decisions

### 1. Config-Driven Dispatch
- **Rationale:** Giống TTS/STT/Search pattern đã có sẵn trong codebase
- **Benefit:** Dễ thêm provider mới chỉ bằng config, không cần sửa core logic
- **Trade-off:** Phải maintain format adapter cho mỗi provider variant

### 2. Auth + Fallback Pattern
- **Rationale:** Reuse pattern từ `embeddings.js` và `chat.js`
- **Benefit:** Automatic credential rotation, rate limit handling, error recovery
- **Trade-off:** Phức tạp hơn stub, nhưng production-ready

### 3. Default Models
- **Moderation:** `openai/text-moderation-latest` (most common)
- **Rerank:** `cohere/rerank-v3.5` (industry standard)
- **Rationale:** Sensible defaults cho user không chỉ định model

### 4. Route Guard Timeout
- **30000ms (30s)** cho cả moderation và rerank
- **Rationale:** Moderation/rerank thường nhanh hơn chat/embeddings, không cần 90s

---

## Provider Coverage

| Provider | Moderation | Rerank | Notes |
|----------|-----------|--------|-------|
| OpenAI | ✅ | ❌ | `text-moderation-latest`, `omni-moderation-latest` |
| Azure | ✅ | ❌ | Dynamic endpoint từ `providerSpecificData` |
| Cohere | ❌ | ✅ | `rerank-v3.5`, `rerank-english-v3.0` |
| Jina | ❌ | ✅ | `jina-reranker-v2-base-multilingual` |
| Voyage | ❌ | ✅ | `rerank-2.5`, `rerank-2.5-lite` |

**Future expansion:**
- Google Perspective API (moderation)
- Anthropic moderation (khi có API)
- More rerank providers (e.g., Mixedbread, BGE-reranker)

---

## API Examples

### Moderation
```bash
curl -X POST http://localhost:1212/v1/moderations \
  -H "Content-Type: application/json" \
  -d '{
    "input": "I want to kill them.",
    "model": "openai/text-moderation-latest"
  }'
```

**Response:**
```json
{
  "id": "modr-...",
  "model": "text-moderation-latest",
  "results": [{
    "flagged": true,
    "categories": { "violence": true, ... },
    "category_scores": { "violence": 0.95, ... }
  }]
}
```

### Rerank
```bash
curl -X POST http://localhost:1212/v1/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the capital of France?",
    "documents": [
      "Paris is the capital of France.",
      "London is the capital of England.",
      "Berlin is the capital of Germany."
    ],
    "model": "cohere/rerank-v3.5",
    "top_n": 2
  }'
```

**Response:**
```json
{
  "id": "rerank-...",
  "model": "rerank-v3.5",
  "results": [
    { "index": 0, "relevance_score": 0.98 },
    { "index": 2, "relevance_score": 0.12 }
  ]
}
```

---

## Files Changed

```
M  src/app/api/v1/moderations/route.js       (stub → real handler)
M  src/app/api/v1/rerank/route.js            (stub → real handler)
M  src/shared/constants/providers.js         (+moderation/rerank config)
A  open-sse/handlers/moderationCore.js       (new core handler)
A  open-sse/handlers/rerankCore.js           (new core handler)
A  src/sse/handlers/moderation.js            (new SSE handler)
A  src/sse/handlers/rerank.js                (new SSE handler)
A  tests/unit/moderation-rerank-routes.test.js (new tests)
```

**Stats:**
- 8 files changed
- 668 insertions(+)
- 133 deletions(-)

---

## Next Steps (Optional P2 Enhancements)

### 1. UI Integration
- [ ] Dashboard settings cho `moderationConfig` và `rerankConfig`
- [ ] Provider card hiển thị `serviceKinds: ["moderation", "rerank"]`
- [ ] Test UI cho moderation/rerank endpoints

### 2. Advanced Features
- [ ] Batch moderation (array of inputs)
- [ ] Rerank với metadata filtering
- [ ] Cache rerank results (content-based key)
- [ ] Usage tracking cho moderation/rerank

### 3. Provider Expansion
- [ ] Google Perspective API (moderation)
- [ ] Mixedbread rerank
- [ ] BGE-reranker (local/HuggingFace)

### 4. Documentation
- [ ] API docs cho `/v1/moderations` và `/v1/rerank`
- [ ] Provider setup guide (credentials, models)
- [ ] Migration guide từ stub sang real endpoints

---

## Conclusion

✅ **Moderation và Rerank endpoints giờ đã production-ready:**
- Config-driven provider routing
- Auth + credential fallback
- 5 providers configured (OpenAI, Azure, Cohere, Jina, Voyage)
- Route-level tests
- Full test suite PASS (239 passed)
- Production build PASS (149 routes)

**Impact:**
- XLab Router giờ có đầy đủ tính năng moderation/rerank như OmniRoute/9router
- Pattern config-driven có thể reuse cho future service kinds (e.g., OCR, translation)
- Codebase maintainable: thêm provider mới chỉ cần config, không sửa core

**Commit:** `6154431` - `feat: add provider-backed moderation and rerank endpoints`
