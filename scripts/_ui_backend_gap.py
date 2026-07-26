"""Find UI→backend gaps and backend features without UI entry points."""
from __future__ import annotations

import json
import re
from pathlib import Path

RL = Path(r"C:\Dev\RouterLab")
OUT = RL / "docs" / "_ui_backend_gap.json"


def route_files() -> set[str]:
    root = RL / "src" / "app" / "api"
    return {
        p.parent.relative_to(root).as_posix()
        for p in root.rglob("route.js")
    }


def collect_ui_api_calls() -> set[str]:
    calls: set[str] = set()
    roots = [
        RL / "src" / "app" / "(dashboard)",
        RL / "src" / "shared",
    ]
    pat = re.compile(r"""['"`]/api/([a-zA-Z0-9_\-./\[\]$\{}]+)""")
    for root in roots:
        if not root.exists():
            continue
        for p in root.rglob("*.js"):
            text = p.read_text(encoding="utf-8", errors="ignore")
            for m in pat.findall(text):
                path = m.split("?")[0].rstrip("/")
                # strip template endings
                path = re.sub(r"\$\{[^}]+\}", "[id]", path)
                calls.add(path)
    return calls


def normalize_route(r: str) -> str:
    return re.sub(r"\[[^\]]+\]", "[id]", r)


def route_matches(call: str, routes: set[str]) -> bool:
    c = normalize_route(call)
    for r in routes:
        rn = normalize_route(r)
        if c == rn:
            return True
        # prefix for nested dynamic
        if c.startswith(rn + "/") or rn.startswith(c + "/"):
            # only accept if remaining is single segment or dynamic
            pass
        cs, rs = c.split("/"), rn.split("/")
        if len(cs) != len(rs):
            continue
        ok = True
        for a, b in zip(cs, rs):
            if a == b or a == "[id]" or b == "[id]":
                continue
            ok = False
            break
        if ok:
            return True
    return False


def dashboard_pages() -> list[str]:
    dash = RL / "src" / "app" / "(dashboard)" / "dashboard"
    pages = []
    for p in dash.rglob("page.js"):
        rel = p.parent.relative_to(dash).as_posix()
        pages.append("/dashboard" if rel == "." else f"/dashboard/{rel}")
    return sorted(pages)


def sidebar_hrefs() -> list[str]:
    text = (RL / "src" / "shared" / "components" / "Sidebar.js").read_text(
        encoding="utf-8", errors="ignore"
    )
    return sorted(set(re.findall(r'href:\s*["\']([^"\']+)["\']', text)))


routes = route_files()
ui_calls = collect_ui_api_calls()
missing_backend = sorted([c for c in ui_calls if not route_matches(c, routes)])

# Backend features that should have UI (high value)
BACKEND_WITH_UI_EXPECTATION = {
    "v1/ocr": ["/dashboard/playground"],
    "v1/audio/translations": ["/dashboard/playground"],
    "v1/audio/music": ["/dashboard/playground", "/dashboard/media-providers/music"],
    "v1/videos/generations": ["/dashboard/playground", "/dashboard/media-providers/video"],
    "v1/agents/tasks": ["/dashboard/cloud-agents"],
    "management/combo-self-heal": ["/dashboard/ops", "/dashboard/combos"],
    "management/redis-usage-queue": ["/dashboard/ops"],
    "settings/payload-rules": ["/dashboard/ops"],
    "headroom/status": ["/dashboard/ops", "/dashboard/token-saver"],
    "combos": ["/dashboard/combos"],
    "cli-tools/all-statuses": ["/dashboard/cli-tools"],
    "mcp/sse": ["/dashboard/mcp-servers"],
    "usage/stats": ["/dashboard/usage"],
    "tunnel/status": ["/dashboard/endpoint"],
    "proxy-pools": ["/dashboard/proxy-pools"],
    "providers": ["/dashboard/providers"],
    "keys": ["/dashboard/endpoint"],
    "compression": ["/dashboard/token-saver"],
    "settings/ai-rules": ["/dashboard/rules"],
    "translator/translate": ["/dashboard/translator"],
    "a2a/tasks": None,  # optional
    "batches": None,
    "v1/moderations": None,
    "v1/rerank": None,
    "v1/embeddings": ["/dashboard/media-providers/embedding"],
    "v1/search": ["/dashboard/media-providers/web"],
    "v1/web/fetch": ["/dashboard/media-providers/web"],
    "v1/audio/speech": ["/dashboard/media-providers/tts"],
    "v1/audio/transcriptions": ["/dashboard/media-providers/stt"],
    "v1/images/generations": ["/dashboard/media-providers/image"],
}

pages = set(dashboard_pages())
# also media dynamic counts as page
for kind in ["embedding", "image", "imageToText", "tts", "stt", "video", "music", "web"]:
    pages.add(f"/dashboard/media-providers/{kind}")

backend_missing_ui = []
for api, expected in BACKEND_WITH_UI_EXPECTATION.items():
    if expected is None:
        continue
    # check route exists
    if not route_matches(api, routes) and api not in routes:
        # try exact
        if api not in routes:
            continue  # backend missing entirely, separate issue
    has_ui = any(e in pages or e in sidebar_hrefs() for e in expected)
    # also check if playground covers
    if not has_ui:
        # soft check: any page exists
        has_ui = any(Path(str(RL / "src/app/(dashboard)") + e.replace("/dashboard", "/dashboard") + "/page.js").exists() if False else False for e in expected)
    # filesystem check for pages
    ok = False
    for e in expected:
        rel = e.replace("/dashboard/", "")
        if rel == "/dashboard" or e == "/dashboard":
            p = RL / "src/app/(dashboard)/dashboard/page.js"
        else:
            p = RL / "src/app/(dashboard)/dashboard" / rel / "page.js"
        if p.exists():
            ok = True
            break
        # media kind uses [kind]
        if "/media-providers/" in e:
            kind = e.split("/")[-1]
            if kind != "web":
                p2 = RL / "src/app/(dashboard)/dashboard/media-providers/[kind]/page.js"
                if p2.exists():
                    ok = True
                    break
            else:
                p2 = RL / "src/app/(dashboard)/dashboard/media-providers/web/page.js"
                if p2.exists():
                    ok = True
                    break
    if not ok:
        backend_missing_ui.append({"api": api, "expected_ui": expected})

# CLI tools: UI cards vs API settings
cli_ui = RL / "src/app/(dashboard)/dashboard/cli-tools"
cli_api = RL / "src/app/api/cli-tools"
cli_settings_apis = sorted(
    p.parent.name for p in cli_api.glob("*-settings/route.js")
)
# cards in components
cli_components = list((cli_ui / "components").glob("*ToolCard.js")) if (cli_ui / "components").exists() else []

# Combos strategy options in UI
combos_page = (RL / "src/app/(dashboard)/dashboard/combos/page.js").read_text(
    encoding="utf-8", errors="ignore"
)
has_fusion_ui = "fusion" in combos_page and "COMBO_STRATEGY" in combos_page
has_fallback_ui = "fallback" in combos_page

report = {
    "ui_api_calls": len(ui_calls),
    "api_routes": len(routes),
    "missing_backend_for_ui_calls": missing_backend,
    "backend_missing_ui": backend_missing_ui,
    "combo_strategy_ui": {
        "has_fusion": has_fusion_ui,
        "has_fallback": has_fallback_ui,
        "has_strategy_select": "COMBO_STRATEGY_OPTIONS" in combos_page or "Strategy" in combos_page,
    },
    "cli_settings_apis": cli_settings_apis,
    "cli_tool_cards": [p.name for p in cli_components],
    "dashboard_pages": dashboard_pages(),
    "sidebar_hrefs": sidebar_hrefs(),
}

OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2)[:6000])
print("\n... wrote", OUT)
