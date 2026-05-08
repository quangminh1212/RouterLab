# XLab Router Deep Test Report - 2026-05-09

**[PM]**: Báo cáo tổng hợp deep-test XLab Router sau hardening session.

---

## Test Coverage

### ✅ Git State
- Branch: `main`
- Status: clean
- Commits ahead: 8
- Latest: `b2f4391` - docs: add hardening session summary report

### ✅ Unit Test Suite
```
Test Files: 20 passed | 3 skipped (23)
Tests: 239 passed | 19 skipped (258)
Duration: 3.42s
```

**Key suites:**
- ✅ claude-header-forwarding: 17 passed
- ✅ moderation-rerank-routes: 5 passed
- ✅ combo-round-robin: 4 passed (sticky limit regression)
- ✅ usage-summary-backup: 2 passed
- ⏭️ rtk.e2e: 4 skipped (requires server config)
- ⏭️ rtk.multi-provider.e2e: 9 skipped (requires server config)

### ✅ Production Build
```
✓ Compiled successfully in 81s
✓ TypeScript PASS (107ms)
✓ Static generation PASS (149 routes)
Exit code: 0
```

### ⚠️ Runtime Smoke Test

**[Backend]**: Server khởi động thành công:
- `/api/health` ✅ `{"ok":true,"status":"ok"}`
- `/api/version` ✅ `{"currentVersion":"1.0.47"}`

**[QA/Security]**: API endpoint smoke (authenticated):
- `/api/v1/chat/completions` ⏳ (đang chạy)
- `/v1/moderations` ⚠️ 400 Bad Request
- `/v1/rerank` ⚠️ 400 Bad Request
- `/v1/video/generations` ⚠️ 400 Bad Request

**Root cause 400:**
- Auth đã pass (không còn 401)
- Khả năng cao: **provider credentials thiếu** hoặc **payload format mismatch**
- Cần kiểm tra provider config cho `openai/text-moderation-latest`, `cohere/rerank-v3.5`, `runwayml/gen4_turbo`

---

## Findings

### 🟢 P0 Stability
- Test suite: **PASS** (239/258 active)
- Build: **PASS** (149 routes)
- Core health: **PASS**

### 🟡 P1 Runtime Issues

**[DevOps]**: `run.bat` startup flow:
- ⚠️ Double-start detection: script thử kill port 1212 hai lần
- ⚠️ Process exit `-1` sau khi server ready
- **Impact:** UX/dev-run issue, không phải core runtime fail
- **Recommendation:** Hardening startup script logic

**[Backend]**: New endpoint smoke:
- ⚠️ `/v1/moderations`, `/v1/rerank`, `/v1/video/generations` trả 400
- **Likely cause:** Provider credentials chưa config hoặc payload validation strict
- **Recommendation:** 
  1. Kiểm tra provider connections cho `openai`, `cohere`, `runwayml`
  2. Validate request payload format với schema thật
  3. Thêm route-level tests cho 3 endpoint này

### 🟢 Feature Parity Status
- ✅ RTK compression: enabled by default
- ✅ Combo sticky round-robin: wired + UI
- ✅ Moderation/rerank: provider-backed handlers
- ✅ Video generations: compatibility route
- ✅ Legacy routes: `/api/usage/summary`, `/api/quota`

---

## Blockers

### 🔴 Gateway Subagent Runtime
**[PM]**: Không thể spawn subagent thật do:
- Gateway `main` agent: `configured: false`
- Config file bị ghi đè bởi placeholder `__OPENCLAW_REDACTED__` nhiều lần
- Đã restore từ backup nhưng vẫn không ổn định

**Impact:** Không thể vận hành theo mô hình phòng R&D đa vai thật như yêu cầu

**Workaround hiện tại:** Chạy test bằng process chính thay vì subagent

---

## Recommendations

### Immediate (P0)
1. **[DevOps]**: Sửa `run.bat` startup flow để tránh double-start/exit -1
2. **[Backend]**: Validate provider credentials cho moderation/rerank/video
3. **[QA/Security]**: Thêm route-level tests cho 3 endpoint mới

### Short-term (P1)
1. **[Backend]**: Thêm error message rõ hơn cho 400 Bad Request (thiếu provider vs payload invalid)
2. **[QA/Security]**: E2E test với provider credentials thật (CI/staging)
3. **[DevOps]**: Fix Gateway config persistence issue (placeholder redacted)

### Long-term (P2)
1. **[Architect]**: Circuit breaker pattern cho advanced routing
2. **[Backend]**: Provider validation probe cho moderation/rerank
3. **[QA/Security]**: Automated regression suite cho new endpoints

---

## Summary

**[PM]**: XLab Router sau hardening session:
- ✅ **Core stability:** Test suite + build PASS
- ✅ **Feature parity:** RTK, sticky routing, moderation/rerank, video route
- ⚠️ **Runtime smoke:** 3/4 new endpoints trả 400 (likely provider config)
- 🔴 **Blocker:** Gateway subagent runtime không ổn định

**Next milestone:** Fix P0 runtime issues + provider config validation + subagent stability.

---

**Report generated:** 2026-05-09 02:38 GMT+7  
**Session:** XLab Router Deep Test  
**Status:** ⚠️ Partial PASS (core stable, runtime smoke needs provider config)
