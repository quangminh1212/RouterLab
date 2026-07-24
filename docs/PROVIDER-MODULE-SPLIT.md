# Provider module split + upstream parity

Nguồn đối chiếu:
- OmniRoute: https://github.com/diegosouzapw/OmniRoute
- 9router: https://github.com/decolua/9router
- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI

## Cấu trúc module (sau tách)

### UI catalog
```
src/shared/constants/providers/
  _shared.js          # RISK_NOTICE, THINKING_CONFIG, …
  free.js
  free-tier.js
  oauth.js
  apikey.js
  web-cookie.js
  media-kinds.js
  helpers.js          # icons, resolve, favicon, aliases…
  index.js            # AI_PROVIDERS barrel
src/shared/constants/providers.js  # re-export shim
```

### Backend open-sse
```
open-sse/config/providers/
  registry/<provider-id>.js   # 1 module / provider (OmniRoute style)
  index.js                    # assemble PROVIDERS
open-sse/config/providers.js  # re-export shim
```

## Counts

- UI `FREE_PROVIDERS`: **6**
- UI `FREE_TIER_PROVIDERS`: **7**
- UI `OAUTH_PROVIDERS`: **19**
- UI `APIKEY_PROVIDERS`: **221**
- UI `WEB_COOKIE_PROVIDERS`: **27**
- Backend registry modules: **240** (deduped; pre-split had duplicate `opencode` / `veoaifree-web`)
- OmniRoute registry (upstream): **201** top-level modules (+ nested variants)
- RouterLab UI ids: **280**
- Smoke (node ESM): UI 280 · backend 240 · Omni wave 0 missing · alias `trk`→tokenrouter OK

## Gap vs OmniRoute (true missing, chưa alias)

- `agnes`
- `aihorde`
- `ainative`
- `aion`
- `ant-ling`
- `chenzk`
- `chipotle`
- `clova-studio`
- `dahl`
- `felo-web`
- `freepik`
- `g4f-gemini`
- `g4f-groq`
- `g4f-nvidia`
- `g4f-ollama`
- `g4f-pollinations`
- `ghe-copilot`
- `hyperagent`
- `inception`
- `internlm`
- `nara`
- `navy`
- `notion-web`
- `plamo`
- `promptql`
- `qwen-cloud`
- `qwen-cloud-token-plan`
- `routeway`
- `sarvam`
- `sealion`
- `typhoon`
- `writer`

## Covered via alias / partial
- `command-code` → `commandcode`
- `gitlab-duo` → `gitlab`
- `xai-oauth` → `xai / grok-cli (partial)`

## Best-of strategy

| Vùng | Nguồn ưu tiên | Lý do |
|------|---------------|-------|
| Catalog provider rộng + UI | OmniRoute | Registry 200+ module, TS hiện đại |
| Executor JS / RTK / combo | 9router + OmniRoute | RouterLab fork từ 9router, OmniRoute kế thừa |
| Gateway resilience (session affinity, cloaking, Redis RESP, Amp CLI) | CLIProxyAPI | Go gateway patterns đã port |
| Per-provider module layout | OmniRoute | `registry/<id>` dễ bảo trì |

## Next (chưa làm trong đợt này)

- Import full body config từ OmniRoute cho các id còn thiếu (agnes, freepik, g4f-*, …)
- Tách thêm UI theo từng provider file nếu catalog >300
- Port CLIProxyAPI auth modules còn thiếu (aistudio WS, xai-oauth full)

## Omni catch-up wave (auto)

- Added backend modules: **33**
- UI apikey +29, oauth +2, web +2
- IDs: `agnes`, `aihorde`, `ainative`, `aion`, `ant-ling`, `chenzk`, `chipotle`, `clova-studio`, `dahl`, `felo-web`, `freepik`, `g4f-gemini`, `g4f-groq`, `g4f-nvidia`, `g4f-ollama`, `g4f-pollinations`, `ghe-copilot`, `hyperagent`, `inception`, `internlm`, `nara`, `navy`, `notion-web`, `plamo`, `promptql`, `qwen-cloud`, `qwen-cloud-token-plan`, `routeway`, `sarvam`, `sealion`, `typhoon`, `writer`, `xai-oauth`
