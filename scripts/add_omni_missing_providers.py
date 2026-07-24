#!/usr/bin/env python3
"""Add missing OmniRoute providers into RouterLab UI catalog + open-sse registry."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OMNI_JSON = Path(r"c:\Dev\AgentLab\data\_omni_missing_providers.json")
UI_APIKEY = ROOT / "src/shared/constants/providers/apikey.js"
UI_OAUTH = ROOT / "src/shared/constants/providers/oauth.js"
UI_WEB = ROOT / "src/shared/constants/providers/web-cookie.js"
UI_FREE = ROOT / "src/shared/constants/providers/free.js"
BE_REG = ROOT / "open-sse/config/providers/registry"
BE_INDEX = ROOT / "open-sse/config/providers/index.js"
ICONS = ROOT / "public/providers"
LOG = ROOT / "docs/PROVIDER-MODULE-SPLIT.md"

# Display metadata when Omni source has little UI info
META: dict[str, dict] = {
    "agnes": {"name": "Agnes AI", "color": "#7C3AED", "website": "https://agnes-ai.com", "group": "apikey"},
    "aihorde": {"name": "AI Horde", "color": "#F59E0B", "website": "https://aihorde.net", "group": "apikey", "noAuth": True, "text": "Crowdsourced volunteer GPUs. Anonymous key 0000000000 works; account key gets higher priority."},
    "ainative": {"name": "AINative", "color": "#2563EB", "website": "https://ainative.studio", "group": "apikey"},
    "aion": {"name": "Aion Labs", "color": "#0EA5E9", "website": "https://aionlabs.ai", "group": "apikey"},
    "ant-ling": {"name": "Ant Ling", "color": "#1677FF", "website": "https://ling.antgroup.com", "group": "apikey"},
    "chenzk": {"name": "ChenZK", "color": "#111827", "website": "https://chenzk.com", "group": "apikey"},
    "chipotle": {"name": "Chipotle AI", "color": "#DC2626", "website": "https://chipotle.ai", "group": "apikey"},
    "clova-studio": {"name": "CLOVA Studio", "color": "#03C75A", "website": "https://clovastudio.ncloud.com", "group": "apikey"},
    "dahl": {"name": "Dahl", "color": "#6366F1", "website": "https://dahl.ai", "group": "apikey"},
    "felo-web": {"name": "Felo Web", "color": "#22C55E", "website": "https://felo.ai", "group": "web", "text": "Unofficial web endpoint — ToS risk."},
    "freepik": {"name": "Freepik (Magnific)", "color": "#1273EB", "website": "https://www.freepik.com", "group": "apikey", "kinds": ["image"], "text": "Image (Mystic). Header x-freepik-api-key."},
    "g4f-gemini": {"name": "g4f Gemini", "color": "#4285F4", "website": "https://g4f.space", "group": "apikey", "noAuth": True, "text": "No-key reverse proxy (gpt4free). Unofficial."},
    "g4f-groq": {"name": "g4f Groq", "color": "#F55036", "website": "https://g4f.space", "group": "apikey", "noAuth": True, "text": "No-key reverse proxy (gpt4free). Unofficial."},
    "g4f-nvidia": {"name": "g4f NVIDIA", "color": "#76B900", "website": "https://g4f.space", "group": "apikey", "noAuth": True, "text": "No-key reverse proxy (gpt4free). Unofficial."},
    "g4f-ollama": {"name": "g4f Ollama", "color": "#000000", "website": "https://g4f.space", "group": "apikey", "noAuth": True, "text": "No-key reverse proxy (gpt4free). Unofficial."},
    "g4f-pollinations": {"name": "g4f Pollinations", "color": "#EC4899", "website": "https://g4f.space", "group": "apikey", "noAuth": True, "text": "No-key reverse proxy (gpt4free). Unofficial."},
    "ghe-copilot": {"name": "GitHub Enterprise Copilot", "color": "#24292F", "website": "https://github.com/features/copilot", "group": "oauth", "text": "GHE Copilot proxy. Set providerSpecificData.gheUrl per connection."},
    "hyperagent": {"name": "HyperAgent", "color": "#8B5CF6", "website": "https://hyperagent.dev", "group": "apikey"},
    "inception": {"name": "Inception", "color": "#111827", "website": "https://inceptionlabs.ai", "group": "apikey"},
    "internlm": {"name": "InternLM", "color": "#1677FF", "website": "https://internlm.intern-ai.org.cn", "group": "apikey"},
    "nara": {"name": "Nara", "color": "#0EA5E9", "website": "https://nara.ai", "group": "apikey"},
    "navy": {"name": "Navy API", "color": "#1E3A8A", "website": "https://api.navy", "group": "apikey"},
    "notion-web": {"name": "Notion AI Web", "color": "#000000", "website": "https://www.notion.so", "group": "web", "text": "Unofficial Notion AI web. Cookie auth. ToS risk."},
    "plamo": {"name": "PLaMo", "color": "#E11D48", "website": "https://plamo.preferredai.jp", "group": "apikey"},
    "promptql": {"name": "PromptQL", "color": "#7C3AED", "website": "https://promptql.io", "group": "apikey"},
    "qwen-cloud": {"name": "Qwen Cloud (Intl)", "color": "#615CED", "website": "https://www.alibabacloud.com/product/modelstudio", "group": "apikey"},
    "qwen-cloud-token-plan": {"name": "Qwen Cloud Token Plan", "color": "#615CED", "website": "https://www.alibabacloud.com/product/modelstudio", "group": "apikey"},
    "routeway": {"name": "RouteWay", "color": "#F97316", "website": "https://routeway.ai", "group": "apikey"},
    "sarvam": {"name": "Sarvam AI", "color": "#FF6B35", "website": "https://www.sarvam.ai", "group": "apikey"},
    "sealion": {"name": "SEA-LION", "color": "#0F766E", "website": "https://sea-lion.ai", "group": "apikey"},
    "typhoon": {"name": "Typhoon", "color": "#2563EB", "website": "https://opentyphoon.ai", "group": "apikey"},
    "writer": {"name": "Writer", "color": "#111827", "website": "https://writer.com", "group": "apikey"},
    "xai-oauth": {"name": "xAI OAuth (Grok)", "color": "#000000", "website": "https://x.ai", "group": "oauth", "text": "Grok Build OAuth / PKCE. Prefer API key provider `xai` when possible."},
}


def extract_str(src: str, key: str) -> str | None:
    m = re.search(rf'{key}\s*:\s*["\']([^"\']+)["\']', src)
    return m.group(1) if m else None


def extract_alias(src: str, pid: str) -> str:
    return extract_str(src, "alias") or re.sub(r"[^a-z0-9]+", "", pid.lower())[:12] or pid[:8]


def extract_base_url(src: str, pid: str) -> str:
    # baseUrl: "..."
    m = re.search(r'baseUrl\s*:\s*["\']([^"\']+)["\']', src)
    if m:
        return m.group(1)
    # multiline baseUrl:
    m = re.search(r'baseUrl\s*:\s*\n\s*["\']([^"\']+)["\']', src)
    if m:
        return m.group(1)
    # freepik-style
    m = re.search(r'baseUrl\s*:\s*"([^"]+)"', src)
    if m:
        return m.group(1)
    # xai-oauth uses xaiProvider.baseUrl — resolve known
    if pid == "xai-oauth":
        return "https://api.x.ai/v1/chat/completions"
    if pid == "notion-web":
        return "https://app.notion.com/api/v3/runInferenceTranscript"
    return ""


def extract_format(src: str, pid: str) -> str:
    m = re.search(r'format\s*:\s*["\']([^"\']+)["\']', src)
    if m:
        return m.group(1)
    if pid == "freepik":
        return "openai"  # image path handled separately; chat core uses openai-compat stubs
    return "openai"


def extract_auth(src: str) -> str:
    m = re.search(r'authType\s*:\s*["\']([^"\']+)["\']', src)
    return m.group(1) if m else "apikey"


def text_icon(name: str) -> str:
    parts = re.findall(r"[A-Za-z0-9]+", name)
    if not parts:
        return "AI"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def js_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def ui_entry(pid: str, src: str) -> tuple[str, str]:
    meta = META[pid]
    alias = extract_alias(src, pid)
    name = meta["name"]
    color = meta["color"]
    website = meta.get("website", "")
    group = meta["group"]
    no_auth = meta.get("noAuth") or extract_auth(src) in ("none", "optional") and pid.startswith("g4f")
    if pid == "aihorde":
        no_auth = True
    kinds = meta.get("kinds") or ["llm"]
    notice_bits = []
    if meta.get("text"):
        notice_bits.append(f'text: "{js_escape(meta["text"])}"')
    if website:
        notice_bits.append(f'apiKeyUrl: "{website}"' if group == "apikey" else f'signupUrl: "{website}"')
    notice = ", ".join(notice_bits)
    fields = [
        f'id: "{pid}"',
        f'alias: "{alias}"',
        f'name: "{js_escape(name)}"',
        'icon: "smart_toy"',
        f'color: "{color}"',
        f'textIcon: "{text_icon(name)}"',
    ]
    if website:
        fields.append(f'website: "{website}"')
    if notice:
        fields.append(f"notice: {{ {notice} }}")
    fields.append(f"serviceKinds: {json.dumps(kinds)}")
    if no_auth:
        fields.append("noAuth: true")
    if extract_str(src, "passthroughModels") == "true" or "passthroughModels: true" in src:
        fields.append("passthroughModels: true")
    if group == "web":
        fields.append('authType: "cookie"')
    if group == "oauth":
        fields.append("hasProviderSpecificData: true")
    if pid == "freepik":
        fields.append("hasProviderSpecificData: true")
    if pid in ("ghe-copilot", "qwen-cloud", "qwen-cloud-token-plan", "navy", "routeway"):
        fields.append("hasProviderSpecificData: True".replace("True", "true"))

    key = f'"{pid}"' if "-" in pid else pid
    entry = f"  {key}: {{ {', '.join(fields)} }},"
    return group, entry


def backend_module(pid: str, src: str) -> str:
    base = extract_base_url(src, pid)
    fmt = extract_format(src, pid)
    # normalize freepik image to openai chat stub won't work for image gen —
    # still register base for validate connectivity
    if not base:
        base = "https://example.invalid/v1/chat/completions"
    # keep openai format for most; freepik custom stays as openai for generic path
    if fmt not in ("openai", "claude", "gemini", "openai-responses"):
        if "claude" in fmt:
            fmt = "claude"
        else:
            fmt = "openai"
    obj = {
        "baseUrl": base,
        "format": fmt,
    }
    auth = extract_auth(src)
    if auth == "none" or pid.startswith("g4f") or pid == "aihorde":
        # no special field; UI noAuth
        pass
    if pid == "aihorde":
        obj["anonymousApiKey"] = "0000000000"
    if pid == "freepik":
        obj["authHeader"] = "x-freepik-api-key"
        obj["format"] = "openai"
    if pid == "ghe-copilot":
        obj["forceStream"] = True
    if pid == "xai-oauth":
        obj["baseUrl"] = "https://api.x.ai/v1/chat/completions"
    # pretty js object
    lines = [f'/** Provider module: {pid} (from OmniRoute registry) */', f'export const id = "{pid}";', "export default {"]
    for k, v in obj.items():
        if isinstance(v, bool):
            lines.append(f"  {k}: {'true' if v else 'false'},")
        elif isinstance(v, (int, float)):
            lines.append(f"  {k}: {v},")
        else:
            lines.append(f'  {k}: "{v}",')
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def ensure_icon(pid: str, color: str, text: str) -> None:
    svg_path = ICONS / f"{pid}.svg"
    png_path = ICONS / f"{pid}.png"
    if svg_path.exists() or png_path.exists():
        return
    # simple monogram SVG
    t = (text or pid[:2])[:2].upper()
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="{color}"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#fff">{t}</text>
</svg>
'''
    svg_path.write_text(svg, encoding="utf-8")


def insert_entries(path: Path, entries: list[str]) -> int:
    text = path.read_text(encoding="utf-8")
    # before closing `};` of export const X = {
    m = re.search(r"(export const \w+_PROVIDERS\s*=\s*\{)", text)
    if not m:
        raise RuntimeError(f"no providers object in {path}")
    # find matching close at file end-ish
    last = text.rstrip()
    if not last.endswith("};"):
        # allow trailing newline
        if not last.endswith("}"):
            raise RuntimeError(f"unexpected end {path}")
    # insert before final `};`
    idx = text.rfind("};")
    if idx < 0:
        raise RuntimeError(f"no closing in {path}")
    block = "\n  // --- OmniRoute catch-up (auto) ---\n" + "\n".join(entries) + "\n"
    # skip already present ids
    filtered = []
    for e in entries:
        id_m = re.search(r'id:\s*"([^"]+)"', e)
        if not id_m:
            continue
        pid = id_m.group(1)
        if f'id: "{pid}"' in text or f'"{pid}":' in text or re.search(rf'\b{re.escape(pid)}\s*:\s*\{{', text):
            continue
        filtered.append(e)
    if not filtered:
        return 0
    block = "\n  // --- OmniRoute catch-up (auto) ---\n" + "\n".join(filtered) + "\n"
    new_text = text[:idx] + block + text[idx:]
    path.write_text(new_text, encoding="utf-8")
    return len(filtered)


def rebuild_backend_index(new_ids: list[str]) -> None:
    """Append imports/assigns for new ids if missing."""
    text = BE_INDEX.read_text(encoding="utf-8")
    imports = []
    assigns = []
    for pid in new_ids:
        safe = re.sub(r"[^\w.-]+", "_", pid)
        var = "p_" + re.sub(r"[^A-Za-z0-9_]", "_", pid)
        if f'from "./registry/{safe}.js"' in text:
            continue
        imports.append(f'import {var} from "./registry/{safe}.js";')
        assigns.append(f'  "{pid}": {var},')
    if not imports:
        return
    # insert imports after last import
    last_imp = 0
    for m in re.finditer(r"^import .+$", text, re.M):
        last_imp = m.end()
    text = text[:last_imp] + "\n" + "\n".join(imports) + text[last_imp:]
    # insert assigns before closing of PROVIDERS
    m = re.search(r"export const PROVIDERS\s*=\s*\{", text)
    if not m:
        raise RuntimeError("PROVIDERS missing")
    # find end of object
    start = m.end() - 1
    depth = 0
    end = None
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    assert end is not None
    text = text[:end] + "\n" + "\n".join(assigns) + "\n" + text[end:]
    BE_INDEX.write_text(text, encoding="utf-8")


def update_parity_test(ids: list[str]) -> None:
    test = ROOT / "tests/unit/provider-parity-omni.test.js"
    if not test.exists():
        return
    t = test.read_text(encoding="utf-8")
    # extend OMNI_WAVE array
    m = re.search(r"const OMNI_WAVE = \[([\s\S]*?)\];", t)
    if not m:
        return
    existing = set(re.findall(r'"([^"]+)"', m.group(1)))
    add = [i for i in ids if i not in existing]
    if not add:
        return
    extra = ",\n  " + ", ".join(f'"{i}"' for i in add)
    new_body = m.group(1).rstrip().rstrip(",") + extra + "\n"
    t = t[: m.start(1)] + new_body + t[m.end(1) :]
    # bump catalog threshold if present
    t = re.sub(
        r"toBeGreaterThanOrEqual\((\d+)\)",
        lambda mm: f"toBeGreaterThanOrEqual({max(int(mm.group(1)), 300)})",
        t,
        count=1,
    )
    test.write_text(t, encoding="utf-8")


def main() -> int:
    if not OMNI_JSON.exists():
        print("Missing", OMNI_JSON, file=sys.stderr)
        return 1
    data = json.loads(OMNI_JSON.read_text(encoding="utf-8"))
    by_group: dict[str, list[str]] = {"apikey": [], "oauth": [], "web": [], "free": []}
    be_ids = []
    for pid, src in data.items():
        if pid not in META:
            META[pid] = {"name": pid, "color": "#6366F1", "group": "apikey"}
        group, entry = ui_entry(pid, src)
        by_group.setdefault(group, []).append(entry)
        mod = backend_module(pid, src)
        (BE_REG / f"{pid}.js").write_text(mod, encoding="utf-8")
        be_ids.append(pid)
        ensure_icon(pid, META[pid]["color"], text_icon(META[pid]["name"]))
        print("module", pid, "group", group)

    n_api = insert_entries(UI_APIKEY, by_group.get("apikey", []))
    n_oauth = insert_entries(UI_OAUTH, by_group.get("oauth", []))
    n_web = insert_entries(UI_WEB, by_group.get("web", []))
    rebuild_backend_index(be_ids)
    update_parity_test(be_ids)

    # append report note
    if LOG.exists():
        note = (
            "\n## Omni catch-up wave (auto)\n\n"
            f"- Added backend modules: **{len(be_ids)}**\n"
            f"- UI apikey +{n_api}, oauth +{n_oauth}, web +{n_web}\n"
            f"- IDs: {', '.join(f'`{i}`' for i in be_ids)}\n"
        )
        LOG.write_text(LOG.read_text(encoding="utf-8") + note, encoding="utf-8")

    print(
        json.dumps(
            {"backend": len(be_ids), "ui": {"apikey": n_api, "oauth": n_oauth, "web": n_web}},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
