# Performance Optimization Guide

## Đã Tối Ưu

### 1. Next.js Config (next.config.mjs)
- ✅ SWC Minification
- ✅ Code splitting aggressive cho Monaco, Recharts, XYFlow
- ✅ Webpack optimization với splitChunks
- ✅ Parallel builds
- ✅ Package imports optimization
- ✅ Production source maps disabled

### 2. React Components
- ✅ React.memo cho Button, Card, Input, Toggle, Modal
- ✅ useCallback trong Toggle, Modal
- ✅ ThemeProvider optimized với selector

### 3. Code Splitting
- ✅ Dynamic imports cho modals (LazyModals.js)
- ✅ Dynamic imports cho heavy components (Monaco, ReactFlow, Recharts)
- ✅ SSR disabled cho client-only components

### 4. Font Loading
- ✅ Font display swap
- ✅ Preconnect to Google Fonts
- ✅ Material Icons lazy load

### 5. Performance Hooks
- ✅ useDebounce
- ✅ useThrottle  
- ✅ useIntersectionObserver

## Cách Sử Dụng

### Lazy Components
```javascript
import { LazyMonacoEditor } from "@/shared/components/optimized/LazyHeavyComponents";
import { LazyChangelogModal } from "@/shared/components/optimized/LazyModals";
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