# P1/P2 Hardening Milestone Report

**Date:** 2026-05-09  
**Commits:** `4e45452`, `bc6749f`, `6154431`  
**Status:** ✅ Complete

---

## Objective

Tiếp tục hardening sau feature parity completion:
1. ✅ Chuyển moderation/rerank từ stub sang production handler
2. ✅ Thêm UI controls cho combo sticky round-robin limit
3. 🔍 Audit advanced routing strategies (cost/latency/canary)

---

## Completed Work

### 1. Moderation & Rerank Production Handlers

**Commit:** `6154431` - `feat: add provider-backed moderation and rerank endpoints`

#### Core Handlers
- `open-sse/handlers/moderationCore.js` - Config-driven moderation với format dispatch (openai, azure)
- `open-sse/handlers/rerankCore.js` - Config-driven rerank với format dispatch (cohere, jina, voyage)

#### SSE Handlers
- `src/sse/handlers/moderation.js` - Auth + credential fallback loop
- `src/sse/handlers/rerank.js` - Auth + credential fallback loop

#### Route Wiring
- `src/app/api/v1/moderations/route.js` - Real handler với `withRouteGuard`
- `src/app/api/v1/rerank/route.js` - Real handler với `withRouteGuard`

#### Provider Config
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
  format: "azure"
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

#### Tests
- `tests/unit/moderation-rerank-routes.test.js` - 5 test cases
  - ✅ Moderation returns OpenAI-compatible response
  - ✅ Moderation validates input field
  - ✅ Rerank returns Cohere-compatible response
  - ✅ Rerank validates query and documents
  - ✅ Rerank defaults to cohere/rerank-v3.5

**Test Results:**
- Isolated: 5 passed
- Full suite: 239 passed, 19 skipped

**Build:**
- ✅ Compiled successfully
- ✅ TypeScript PASS
- ✅ Static generation PASS (149 routes)

**Report:** `MODERATION_RERANK_IMPLEMENTATION_REPORT.md`

---

### 2. Combo Sticky Round-Robin UI Controls

**Commit:** `4e45452` - `feat: add combo sticky round-robin limit UI controls`

#### Changes
**File:** `src/app/(dashboard)/dashboard/combos/page.js`

**Added:**
- `savingStrategy` state để track save status per combo
- `persistComboStrategies(updated)` helper function
- `handleStickyLimitChange(comboName, value)` handler
- UI input cho sticky limit (hiển thị khi round-robin enabled)

**UI Components:**
```jsx
{roundRobinEnabled && (
  <div className="flex items-center gap-2 rounded-lg border ...">
    <span className="text-xs text-text-muted font-medium">Sticky</span>
    <input
      type="number"
      min="1"
      step="1"
      value={stickyLimit}
      onChange={(e) => onStickyLimitChange?.(e.target.value)}
      className="w-16 rounded border ... text-xs"
      title="Giữ cùng model trong N requests trước khi rotate"
    />
    <span className="text-[11px] text-text-muted">req</span>
  </div>
)}
```

**Behavior:**
- Sticky limit input chỉ hiển thị khi round-robin toggle ON
- Default value: 1 (rotate mỗi request)
- Persist vào `settings.comboStrategies[comboName].stickyRoundRobinLimit`
- Runtime đã support từ commit trước (`fc56a9a`)

**Build:**
- ✅ Compiled successfully in 86s
- ✅ TypeScript PASS
- ✅ Static generation PASS (149 routes)

---

### 3. Advanced Routing Audit

#### Current State

**Implemented Strategies:**
- ✅ `fill-first` (priority-based, default)
- ✅ `round-robin` (với sticky limit support)
- ✅ Provider-level strategy override (`providerStrategies[providerId]`)
- ✅ Combo-level strategy override (`comboStrategies[comboName]`)

**Strategy Layers:**
1. **Account/Connection routing** (`src/sse/services/auth.js`)
   - `fill-first`: Dùng connection có priority thấp nhất (default)
   - `round-robin`: Rotate giữa các connections với sticky limit
   - Per-provider override: `settings.providerStrategies[providerId].fallbackStrategy`

2. **Combo model routing** (`open-sse/services/combo.js`)
   - `fallback`: Thử models theo thứ tự (default)
   - `round-robin`: Rotate giữa models với sticky limit
   - Per-combo override: `settings.comboStrategies[comboName].fallbackStrategy`

**Config Schema:**
```js
// src/lib/localDb.js DEFAULT_SETTINGS
{
  fallbackStrategy: "fill-first",              // Global account routing
  stickyRoundRobinLimit: 3,                    // Global account sticky
  providerStrategies: {                        // Per-provider override
    [providerId]: {
      fallbackStrategy: "round-robin",
      stickyRoundRobinLimit: 5,
      proxyPoolId: "..."
    }
  },
  comboStrategy: "fallback",                   // Global combo routing
  comboStickyRoundRobinLimit: 1,               // Global combo sticky
  comboStrategies: {                           // Per-combo override
    [comboName]: {
      fallbackStrategy: "round-robin",
      stickyRoundRobinLimit: 2
    }
  }
}
```

#### Missing Advanced Strategies

**1. Cost-Based Routing**
- **Goal:** Route requests to cheapest available provider/model
- **Requirements:**
  - Real-time cost tracking per connection (đã có `usageDb` nhưng chưa wire vào routing)
  - Model pricing data (đã có `src/shared/constants/pricing.js`)
  - Cost threshold config per connection
- **Implementation complexity:** Medium
- **Blocker:** Cần schema cho cost limits + runtime cost aggregation

**2. Latency-Based Routing**
- **Goal:** Route requests to fastest provider/model
- **Requirements:**
  - Persistent latency tracking per connection (chưa có)
  - Moving average window (e.g., last 100 requests)
  - Latency threshold config
- **Implementation complexity:** Medium
- **Blocker:** Cần persistent store cho latency metrics

**3. Canary/A-B Testing**
- **Goal:** Split traffic % giữa stable và canary connections
- **Requirements:**
  - Traffic split config (e.g., 90% stable, 10% canary)
  - Connection tagging (stable/canary/experimental)
  - Metrics comparison dashboard
- **Implementation complexity:** High
- **Blocker:** Cần schema + UI cho canary config

**4. Circuit Breaker**
- **Goal:** Tự động disable connection khi error rate cao
- **Requirements:**
  - Error rate tracking per connection
  - Threshold config (e.g., 50% errors in 10 requests)
  - Auto-recovery logic
- **Implementation complexity:** Medium
- **Blocker:** Đã có `modelLock_*` mechanism, cần extend thành circuit breaker pattern

#### Recommendation

**Defer advanced routing to separate milestone:**
- Cost/latency/canary cần schema design + persistent storage
- Circuit breaker có thể extend từ `modelLock_*` hiện có
- Ưu tiên làm spec riêng thay vì implement nửa vời

**Immediate next steps (if needed):**
1. Add circuit breaker pattern (extend `modelLock_*`)
2. Add latency tracking middleware
3. Wire cost data vào routing decision

---

## Files Changed

### Moderation/Rerank
```
M  src/app/api/v1/moderations/route.js
M  src/app/api/v1/rerank/route.js
M  src/shared/constants/providers.js
A  open-sse/handlers/moderationCore.js
A  open-sse/handlers/rerankCore.js
A  src/sse/handlers/moderation.js
A  src/sse/handlers/rerank.js
A  tests/unit/moderation-rerank-routes.test.js
A  MODERATION_RERANK_IMPLEMENTATION_REPORT.md
```

### Combo UI
```
M  src/app/(dashboard)/dashboard/combos/page.js
```

**Total:**
- 10 files changed
- 741 insertions(+)
- 146 deletions(-)

---

## Test Results

### Unit Tests
```bash
npm test --prefix C:\Dev\XLab_Router\tests
# ✓ 239 passed | 19 skipped (258)
```

### Production Build
```bash
npm run build
# ✓ Compiled successfully
# ✓ TypeScript PASS
# ✓ Static generation PASS (149 routes)
```

---

## Git Status

```
Branch: main
Status: clean
Ahead of origin/main: 14 commits

Recent commits:
4e45452 feat: add combo sticky round-robin limit UI controls
bc6749f docs: add moderation and rerank implementation report
6154431 feat: add provider-backed moderation and rerank endpoints
```

---

## Summary

✅ **Moderation/Rerank endpoints production-ready:**
- Config-driven provider routing
- Auth + credential fallback
- 5 providers configured (OpenAI, Azure, Cohere, Jina, Voyage)
- Route-level tests PASS
- Full test suite PASS (239 passed)
- Production build PASS (149 routes)

✅ **Combo sticky round-robin UI complete:**
- Input control cho sticky limit
- Persist vào `comboStrategies`
- Runtime đã support từ trước
- Build PASS

🔍 **Advanced routing audit complete:**
- Current: fill-first + round-robin (với sticky)
- Missing: cost-based, latency-based, canary, circuit breaker
- Recommendation: Defer to separate milestone với spec riêng

---

## Next Steps (Optional)

### P2 Enhancements
1. Circuit breaker pattern (extend `modelLock_*`)
2. Latency tracking middleware
3. Cost-based routing (wire `usageDb` vào decision)
4. Canary/A-B testing schema + UI

### Documentation
1. API docs cho `/v1/moderations` và `/v1/rerank`
2. Provider setup guide (credentials, models)
3. Routing strategy guide (fill-first vs round-robin vs advanced)

### Provider Expansion
1. Google Perspective API (moderation)
2. Mixedbread rerank
3. BGE-reranker (local/HuggingFace)

---

## Conclusion

Milestone này đã hoàn tất 2/3 mục tiêu chính:
1. ✅ Moderation/rerank production handlers
2. ✅ Combo sticky UI controls
3. 🔍 Advanced routing audit (defer implementation)

**Impact:**
- XLab Router giờ có moderation/rerank đầy đủ như OmniRoute/9router
- Combo routing có UI control hoàn chỉnh
- Advanced routing có roadmap rõ ràng cho milestone sau

**Commits:** `4e45452`, `bc6749f`, `6154431`
