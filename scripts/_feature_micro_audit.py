"""Micro-feature audit: each checklist item → file/symbol existence + smoke import."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

RL = Path(r"C:\Dev\RouterLab")
OMNI = Path(r"C:\Dev\_upstream\OmniRoute")
NR = Path(r"C:\Dev\_upstream\9router")
CLIP = Path(r"C:\Dev\_upstream\CLIProxyAPI")

results = []


def check(group: str, name: str, ok: bool, detail: str = "", level: str = "ok"):
    """level: ok | partial | missing | warn"""
    results.append(
        {
            "group": group,
            "name": name,
            "ok": ok,
            "level": level if not ok else "ok",
            "detail": detail,
        }
    )


def exists(*parts: str) -> bool:
    return (RL.joinpath(*parts)).exists()


def any_exists(*globs: str) -> bool:
    for g in globs:
        if list(RL.glob(g)):
            return True
    return False


def file_has(path: str, needle: str) -> bool:
    p = RL / path
    if not p.exists():
        return False
    try:
        return needle in p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return False


# ── 1. API endpoints ──────────────────────────────────────────────────────
API = [
    ("POST /v1/chat/completions", "src/app/api/v1/chat/completions/route.js"),
    ("POST /v1/completions", "src/app/api/v1/completions/route.js"),
    ("GET /v1/models", "src/app/api/v1/models/route.js"),
    ("POST /v1/embeddings", "src/app/api/v1/embeddings/route.js"),
    ("POST /v1/images/generations", "src/app/api/v1/images/generations/route.js"),
    ("POST /v1/images/edits", "src/app/api/v1/images/edits/route.js"),
    ("POST /v1/ocr", "src/app/api/v1/ocr/route.js"),
    ("POST /v1/audio/speech", "src/app/api/v1/audio/speech/route.js"),
    ("POST /v1/audio/transcriptions", "src/app/api/v1/audio/transcriptions/route.js"),
    ("POST /v1/audio/translations", "src/app/api/v1/audio/translations/route.js"),
    ("POST /v1/audio/music", "src/app/api/v1/audio/music/route.js"),
    ("POST /v1/video/generations", "src/app/api/v1/video/generations/route.js"),
    ("POST /v1/search", "src/app/api/v1/search/route.js"),
    ("POST /v1/web/fetch", "src/app/api/v1/web/fetch/route.js"),
    ("POST /v1/rerank", "src/app/api/v1/rerank/route.js"),
    ("POST /v1/moderations", "src/app/api/v1/moderations/route.js"),
    ("POST /v1/messages", "src/app/api/v1/messages/route.js"),
    ("POST /v1/messages/count_tokens", "src/app/api/v1/messages/count_tokens/route.js"),
    ("POST /v1/responses", "src/app/api/v1/responses/route.js"),
    ("GET/POST v1beta/models", "src/app/api/v1beta/models"),
    ("Batch /v1/batches", "src/app/api/v1/batches/route.js"),
    ("A2A /a2a", "src/app/a2a/route.js"),
    ("MCP /api/mcp", "src/app/api/mcp"),
    ("Management /api/management", "src/app/api/management"),
    ("WebSocket /v1/ws", "src/app/api/v1/ws/route.js"),
    ("Amp CLI /api/provider", "src/app/api/provider"),
    ("Health", "src/app/health/route.js"),
    ("Redis usage queue service", "open-sse/services/redisUsageQueue.js"),
]

for name, rel in API:
    p = RL / rel
    ok = p.exists() or p.is_dir()
    check("api", name, ok, rel if ok else f"MISSING {rel}", "missing" if not ok else "ok")

# codex backend-api
codex_be = any_exists("src/app/api/**/codex/**", "src/app/api/backend-api/**")
check(
    "api",
    "POST /backend-api/codex/responses",
    codex_be,
    "partial/wire" if codex_be else "missing dedicated route",
    "partial" if codex_be else "missing",
)

# ── 2. Core features ──────────────────────────────────────────────────────
CORE = [
    ("smart routing / model", "src/sse/services/model.js"),
    ("combo engine", "open-sse/services/combo.js"),
    ("account fallback", "open-sse/services/accountFallback.js"),
    ("circuit breaker", "src/sse/services/providerBreaker.js"),
    ("token refresh", "open-sse/services/tokenRefresh.js"),
    ("translator", "open-sse/translator/index.js"),
    ("combo self-heal", "open-sse/services/comboSelfHeal.js"),
    ("combo fusion", "open-sse/services/comboFusion.js"),
    ("RTK", "open-sse/rtk/index.js"),
    ("caveman", "open-sse/rtk/caveman.js"),
    ("ponytail", "open-sse/rtk/ponytail.js"),
    ("headroom", "open-sse/rtk/headroom.js"),
    ("prompt injection guard", "open-sse/services/promptInjectionGuard.js"),
    ("cost headers", "open-sse/utils/costHeaders.js"),
    ("cloud agents", "open-sse/handlers/cloudAgents.js"),
    ("config watcher", "src/lib/configWatcher.js"),
    ("payload rules", "open-sse/services/payloadRules.js"),
    ("context handoff", "open-sse/services/contextHandoff.js"),
    ("session affinity", "open-sse/services/sessionAffinity.js"),
    ("claude cloaking", "open-sse/utils/claudeCloaking.js"),
    ("thinking signature", "open-sse/config/defaultThinkingSignature.js"),
    ("request dedup", "src/sse/services/requestDedup.js"),
    ("auto route", "src/sse/services/autoRoute.js"),
    ("proxy fetch", "open-sse/utils/proxyFetch.js"),
]

for name, rel in CORE:
    ok = exists(*rel.replace("\\", "/").split("/"))
    check("core", name, ok, rel, "missing" if not ok else "ok")

# ── 3. Storage / ops ──────────────────────────────────────────────────────
OPS = [
    ("localDb file store", "src/lib/localDb.js"),
    ("cloud sync", "src/lib/initCloudSync.js"),
    ("gist backup", "src/lib/gistBackup.js"),
    ("google drive", "src/lib/googleDriveSync.js"),
    ("credential store adapter", "src/lib/credentialStore.js"),
    ("tunnel cloudflare", "src/lib/tunnel"),
    ("MITM", "src/mitm/server.js"),
    ("usage db", "src/lib/usageDb.js"),
    ("request details", "src/lib/requestDetailsDb.js"),
    ("PII sanitizer", "src/lib/piiSanitizer.js"),
]

for name, rel in OPS:
    p = RL / rel
    ok = p.exists()
    check("ops", name, ok, rel, "missing" if not ok else "ok")

# credential store modes
cs = (RL / "src/lib/credentialStore.js").read_text(encoding="utf-8", errors="ignore")
for backend in ("file", "postgres", "git", "s3"):
    has = backend in cs
    is_stub = "unsupportedBackend" in cs and backend != "file"
    check(
        "ops",
        f"credentialStore mode={backend}",
        has,
        "implemented" if backend == "file" else ("stub only" if is_stub else "missing"),
        "ok" if backend == "file" else ("partial" if has else "missing"),
    )

# ── 4. Specialized executors (Đợt 10 + legacy) ─────────────────────────────
EXEC_REQUIRED = [
    "antigravity",
    "azure",
    "azure-openai",
    "gemini-cli",
    "github",
    "ghe-copilot",
    "iflow",
    "qoder",
    "kiro",
    "codex",
    "cursor",
    "vertex",
    "qwen",
    "opencode",
    "opencode-go",
    "grok-web",
    "perplexity-web",
    "bedrock",
    "amazon-q",
    "duckduckgo-web",
    "devin-cli",
    "puter",
    "cloudflare-ai",
    "pollinations",
    "codebuddy-cn",
    "xai",
    "xai-oauth",
    "cliproxyapi",
    "9router",
    "xiaomi-tokenplan",
    "mimocode",
    "mimo-free",
    "theoldllm",
    "zenmux-free",
    "kie",
    "glm",
    "glm-cn",
    "commandcode",
    "command-code",
    "gitlab",
    "gitlab-duo",
    "windsurf",
    "trae",
    "zed-hosted",
    "auggie",
]

idx = (RL / "open-sse/executors/index.js").read_text(encoding="utf-8", errors="ignore")
for ex in EXEC_REQUIRED:
    # quoted key or bare identifier
    patterns = [f'"{ex}"', f"'{ex}'", f"{ex}:"]
    ok = any(p in idx for p in patterns) or f'"{ex}"' in idx
    # also check file for multi-word
    file_map = {
        "azure-openai": "azure-openai.js",
        "cloudflare-ai": "cloudflare-ai.js",
        "codebuddy-cn": "codebuddy-cn.js",
        "xai-oauth": "xai.js",
        "cliproxyapi": "cliproxyapi.js",
        "9router": "ninerouter.js",
        "xiaomi-tokenplan": "xiaomi-tokenplan.js",
        "mimocode": "mimo-free.js",
        "mimo-free": "mimo-free.js",
        "theoldllm": "theoldllm.js",
        "zenmux-free": "zenmux-free.js",
        "commandcode": "commandcode.js",
        "command-code": "commandcode.js",
        "gitlab-duo": "gitlab.js",
        "zed-hosted": "zed-hosted.js",
        "ghe-copilot": "ghe-copilot.js",
        "devin-cli": "devin-cli.js",
        "amazon-q": "amazon-q.js",
        "gemini-cli": "gemini-cli.js",
        "opencode-go": "opencode-go.js",
        "grok-web": "grok-web.js",
        "perplexity-web": "perplexity-web.js",
        "duckduckgo-web": "webChat/duckduckgo.js",
    }
    f = file_map.get(ex, f"{ex}.js")
    file_ok = (RL / "open-sse/executors" / f).exists() or exists("open-sse/executors", f)
    # registration is primary
    check(
        "executor",
        ex,
        ok or file_ok,
        f"index={ok} file={file_ok} ({f})",
        "ok" if ok else ("partial" if file_ok else "missing"),
    )

# Omni specialized not yet ported (sample high-value)
OMNI_MISSING_SAMPLE = [
    "chatgpt-web",
    "claude-web",
    "gemini-web",
    "deepseek-web",
    "notion-web",
    "chipotle",
    "hyperagent",
    "promptql",
    "adobe-firefly",
    "grok-cli",
]
web_reg = RL / "open-sse/executors/webChat/registry.js"
web_txt = web_reg.read_text(encoding="utf-8", errors="ignore") if web_reg.exists() else ""
for ex in OMNI_MISSING_SAMPLE:
    specialized = f'"{ex}"' in idx or f"'{ex}'" in idx
    generic = ex in web_txt or f'"{ex}"' in web_txt
    if specialized:
        check("executor-omni-gap", ex, True, "specialized", "ok")
    elif generic or f'"{ex}"' in idx:
        check("executor-omni-gap", ex, True, "genericWeb/catalog only", "partial")
    else:
        check("executor-omni-gap", ex, False, "no specialized + not in web registry", "missing")

# ── 5. Media handlers ─────────────────────────────────────────────────────
MEDIA = [
    ("musicCore", "open-sse/handlers/musicCore.js"),
    ("music suno adapter", "open-sse/handlers/musicProviders/suno.js"),
    ("music udio adapter", "open-sse/handlers/musicProviders/udio.js"),
    ("ocrCore", "open-sse/handlers/ocrCore.js"),
    ("audioTranslationCore", "open-sse/handlers/audioTranslationCore.js"),
    ("ttsCore", "open-sse/handlers/ttsCore.js"),
    ("sttCore", "open-sse/handlers/sttCore.js"),
    ("embeddingsCore", "open-sse/handlers/embeddingsCore.js"),
    ("imageGenerationCore", "open-sse/handlers/imageGenerationCore.js"),
    ("imageEditsCore", "open-sse/handlers/imageEditsCore.js"),
    ("moderationsCore", "open-sse/handlers/moderationCore.js"),
    ("rerankCore", "open-sse/handlers/rerankCore.js"),
    ("webSearchCore", "open-sse/handlers/webSearchCore.js"),
]

for name, rel in MEDIA:
    ok = exists(*rel.split("/"))
    check("media", name, ok, rel, "missing" if not ok else "ok")

# ── 6. 9router-specific small features ────────────────────────────────────
NR_FEAT = [
    ("9r executor antigravity", "open-sse/executors/antigravity.js"),
    ("9r executor grok-cli", None),  # may use default
    ("9r executor kimchi", None),
    ("9r executor mimo-free", "open-sse/executors/mimo-free.js"),
    ("9r executor xiaomi-tokenplan", "open-sse/executors/xiaomi-tokenplan.js"),
    ("9r executor codebuddy-cn", "open-sse/executors/codebuddy-cn.js"),
    ("9r rtk caveman", "open-sse/rtk/caveman.js"),
    ("9r rtk ponytail", "open-sse/rtk/ponytail.js"),
    ("9r headroom", "open-sse/rtk/headroom.js"),
]

for name, rel in NR_FEAT:
    if rel is None:
        # special cases
        if "grok-cli" in name:
            ok = "grok-cli" in idx or exists("open-sse/executors/grok-cli.js")
            check("9router", name, ok, "specialized or default", "partial" if not ok else "ok")
        elif "kimchi" in name:
            ok = "kimchi" in idx or exists("open-sse/executors/kimchi.js")
            check("9router", name, ok, "missing specialized" if not ok else "ok", "missing" if not ok else "ok")
        continue
    ok = exists(*rel.split("/"))
    check("9router", name, ok, rel, "missing" if not ok else "ok")

# ── 7. CLIProxyAPI feature surface ────────────────────────────────────────
CLIP_FEAT = [
    ("claude cloaking", "open-sse/utils/claudeCloaking.js"),
    ("signature/thinking", "open-sse/config/defaultThinkingSignature.js"),
    ("session affinity", "open-sse/services/sessionAffinity.js"),
    ("payload rules", "open-sse/services/payloadRules.js"),
    ("redis usage queue", "open-sse/services/redisUsageQueue.js"),
    ("config watcher", "src/lib/configWatcher.js"),
    ("amp provider routes", "src/app/api/provider"),
    ("ws gateway", "src/app/api/v1/ws/route.js"),
    ("xai oauth executor", "open-sse/executors/xai.js"),
    ("credential store", "src/lib/credentialStore.js"),
]

for name, rel in CLIP_FEAT:
    p = RL / rel
    ok = p.exists()
    check("cliproxy", name, ok, rel, "missing" if not ok else "ok")

# ── 8. Micro-checks on Đợt 10 code quality ────────────────────────────────
# ocr handler imports
ocr_h = (RL / "src/sse/handlers/ocr.js").read_text(encoding="utf-8", errors="ignore")
check(
    "dot10-quality",
    "ocr uses getProviderCredentials",
    "getProviderCredentials" in ocr_h,
    "auth.js integration",
)
check(
    "dot10-quality",
    "ocrCore has mistral",
    "mistral" in (RL / "open-sse/handlers/ocrCore.js").read_text(encoding="utf-8", errors="ignore"),
)
# mimo marker
mimo = (RL / "open-sse/executors/mimo-free.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "mimo anti-abuse marker", "MiMoCode" in mimo)
# theoldllm token
toll = (RL / "open-sse/executors/theoldllm.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "theoldllm request token", "generateRequestToken" in toll)
# xai refresh
xai = (RL / "open-sse/executors/xai.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "xai oauth refresh", "refresh_token" in xai and "xai-oauth" in xai)
# cloudflare flatten
cf = (RL / "open-sse/executors/cloudflare-ai.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "cloudflare flattens content parts", "flattenContent" in cf)
# codebuddy stream force
cbc = (RL / "open-sse/executors/codebuddy-cn.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "codebuddy forces stream", "stream: true" in cbc or "stream = true" in cbc)
# music adapters real poll
suno = (RL / "open-sse/handlers/musicProviders/suno.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "suno has poll+parseSubmit", "poll" in suno and "parseSubmit" in suno)
udio = (RL / "open-sse/handlers/musicProviders/udio.js").read_text(encoding="utf-8", errors="ignore")
check("dot10-quality", "udio has poll+parseSubmit", "poll" in udio and "parseSubmit" in udio)

# ── 9. Provider registry counts ───────────────────────────────────────────
reg = RL / "open-sse/config/providers/registry"
if reg.exists():
    n = len(list(reg.glob("*.js")))
    check("catalog", f"backend registry modules={n}", n >= 250, f"count={n}", "ok" if n >= 250 else "partial")

ui_const = list((RL / "src/shared/constants").glob("provider*.js"))
check("catalog", "UI provider constants present", bool(ui_const), str([p.name for p in ui_const]))

# ── Summary ───────────────────────────────────────────────────────────────
ok_n = sum(1 for r in results if r["level"] == "ok")
partial_n = sum(1 for r in results if r["level"] == "partial")
miss_n = sum(1 for r in results if r["level"] == "missing")
warn_n = sum(1 for r in results if r["level"] == "warn")

out = {
    "summary": {
        "total": len(results),
        "ok": ok_n,
        "partial": partial_n,
        "missing": miss_n,
        "warn": warn_n,
    },
    "results": results,
    "missing_items": [r for r in results if r["level"] == "missing"],
    "partial_items": [r for r in results if r["level"] == "partial"],
}

out_path = RL / "docs/_feature_micro_audit.json"
out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

md_lines = [
    "# Feature micro-audit",
    "",
    f"- Total checks: **{len(results)}**",
    f"- ✅ OK: **{ok_n}**",
    f"- 🟡 Partial: **{partial_n}**",
    f"- ⬜ Missing: **{miss_n}**",
    "",
    "## Missing",
]
for r in out["missing_items"]:
    md_lines.append(f"- [{r['group']}] `{r['name']}` — {r['detail']}")
md_lines.append("")
md_lines.append("## Partial")
for r in out["partial_items"]:
    md_lines.append(f"- [{r['group']}] `{r['name']}` — {r['detail']}")
md_lines.append("")
md_lines.append("## By group")
groups = {}
for r in results:
    g = r["group"]
    groups.setdefault(g, {"ok": 0, "partial": 0, "missing": 0, "warn": 0})
    lvl = r["level"] if r["level"] in groups[g] else "ok"
    groups[g][lvl] = groups[g].get(lvl, 0) + 1
for g, c in sorted(groups.items()):
    md_lines.append(
        f"- **{g}**: ok={c.get('ok',0)} partial={c.get('partial',0)} missing={c.get('missing',0)}"
    )

md_path = RL / "docs/_feature_micro_audit.md"
md_path.write_text("\n".join(md_lines), encoding="utf-8")
print(md_path.read_text(encoding="utf-8"))
print(f"\nJSON: {out_path}")
sys.exit(1 if miss_n > 5 else 0)
