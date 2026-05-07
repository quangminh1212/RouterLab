# Performance Optimization Guide

## Đã Tối Ưu

### 1. Next.js Config (next.config.mjs)
- ✅ SWC Minification
- ✅ Code splitting aggressive cho Monaco, Recharts, XYFlow
- ✅ Webpack optimization với splitChunks
- ✅ Parallel builds
- ✅ Package imports optimization
- ✅ Production source maps disabled
- ✅ Standalone output mode

### 2. React Components
- ✅ React.memo cho Button, Card, Input, Toggle, Modal
- ✅ useCallback trong Toggle, Modal
- ✅ ThemeProvider optimized với selector

### 3. Code Splitting
- ✅ Dynamic imports cho modals (LazyModals.js)
- ✅ Dynamic imports cho heavy components (Monaco, ReactFlow, Recharts)
- ✅ SSR disabled cho client-only components
- ✅ Lazy loading cho 13 modals lớn:
  - ChangelogModal, OAuthModal, CursorAuthModal
  - KiroAuthModal, GitLabAuthModal, PricingModal
  - ModelSelectModal, EditConnectionModal
  - RamConfigModal, KiroSocialOAuthModal
  - AddCustomEmbeddingModal, NineRemotePromoModal
  - IFlowCookieModal

### 4. Font Loading
- ✅ Font display swap
- ✅ Preconnect to Google Fonts
- ✅ Material Icons lazy load

### 5. Performance Hooks
- ✅ useDebounce
- ✅ useThrottle  
- ✅ useIntersectionObserver

### 6. Security & Caching Headers
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- ✅ Referrer-Policy optimized
- ✅ CSRF protection với cross-site request validation

### 7. Build Optimization
- ✅ .gitignore updated để loại trừ:
  - Temporary log files (.tmp-*.log, tmp_*.log)
  - Next.js dev logs (next-dev*.log)
  - Lighthouse reports (.tmp-lighthouse*/)
  - OpenClaw captures (.tmp-openclaw-capture/)
  - Test artifacts (.tmp-global-test/)
  - Package archives (*.tgz)

## Cách Sử Dụng

### Lazy Components
```javascript
import { LazyMonacoEditor } from "@/shared/components/optimized/LazyHeavyComponents";
import { LazyChangelogModal, LazyOAuthModal } from "@/shared/components/optimized/LazyModals";
```

### Performance Hooks
```javascript
import { useDebounce, useThrottle } from "@/shared/hooks/usePerformance";

const debouncedSearch = useDebounce((value) => {
  // search logic
}, 300);
```

## Build & Test

```bash
# Development
npm run dev

# Production build
npm run build

# Start production
npm start
```

## Target Metrics
- TTI < 2500ms
- TBT < 800ms
- Lighthouse Score > 75
- Build time: ~40-75s
- Bundle size optimized với code splitting

## Maintenance

### Dọn dẹp định kỳ
```bash
# Xóa log files
Remove-Item .tmp-*.log, tmp_*.log, next-dev*.log -Force

# Xóa temporary directories
Remove-Item .tmp-* -Recurse -Force
```
