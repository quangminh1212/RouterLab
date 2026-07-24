#!/usr/bin/env python3
"""
Split RouterLab provider definitions into maintainable modules
(OmniRoute-style registry folders) and report upstream gaps.

- UI catalog: src/shared/constants/providers/{group}.js + index.js
- Backend: open-sse/config/providers/registry/<id>.js + index.js
- Keep backward-compatible re-export shims for existing import paths.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UI_SRC = ROOT / "src" / "shared" / "constants" / "providers.js"
UI_DIR = ROOT / "src" / "shared" / "constants" / "providers"
BE_SRC = ROOT / "open-sse" / "config" / "providers.js"
BE_DIR = ROOT / "open-sse" / "config" / "providers"
BE_REG = BE_DIR / "registry"
REPORT = ROOT / "docs" / "PROVIDER-MODULE-SPLIT.md"
DIFF_JSON = Path(r"c:\Dev\AgentLab\data\_upstream_provider_diff.json")


def extract_export_object(text: str, name: str) -> tuple[str, str, int, int]:
    """Return (full_match, body, start, end) for `export const NAME = { ... };`."""
    m = re.search(rf"export const {name}\s*=\s*\{{", text)
    if not m:
        raise RuntimeError(f"export const {name} not found")
    brace_start = m.end() - 1
    depth = 0
    i = brace_start
    while i < len(text):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                # include trailing semicolon if present
                end = i + 1
                if end < len(text) and text[end] == ";":
                    end += 1
                full = text[m.start() : end]
                body = text[brace_start + 1 : i]
                return full, body, m.start(), end
        i += 1
    raise RuntimeError(f"unclosed object for {name}")


def split_top_level_entries(body: str) -> list[tuple[str, str]]:
    """Split object body into (key, entry_source_including_key) pairs."""
    entries: list[tuple[str, str]] = []
    i = 0
    n = len(body)
    while i < n:
        # skip whitespace and comments
        while i < n and body[i] in " \t\r\n":
            i += 1
        if i >= n:
            break
        if body.startswith("//", i):
            while i < n and body[i] != "\n":
                i += 1
            continue
        if body.startswith("/*", i):
            endc = body.find("*/", i + 2)
            i = endc + 2 if endc != -1 else n
            continue

        # parse key
        if body[i] in "\"'":
            q = body[i]
            j = i + 1
            while j < n and body[j] != q:
                if body[j] == "\\":
                    j += 2
                    continue
                j += 1
            key = body[i + 1 : j]
            j += 1
        else:
            m = re.match(r"([A-Za-z0-9_.-]+)", body[i:])
            if not m:
                i += 1
                continue
            key = m.group(1)
            j = i + len(key)

        # skip space and colon
        while j < n and body[j] in " \t\r\n":
            j += 1
        if j >= n or body[j] != ":":
            i = j
            continue
        j += 1
        while j < n and body[j] in " \t\r\n":
            j += 1
        if j >= n or body[j] != "{":
            # non-object value — skip until comma at depth 0
            start_val = j
            depth = 0
            in_str = None
            while j < n:
                ch = body[j]
                if in_str:
                    if ch == "\\":
                        j += 2
                        continue
                    if ch == in_str:
                        in_str = None
                    j += 1
                    continue
                if ch in "\"'`":
                    in_str = ch
                    j += 1
                    continue
                if ch in "{[(":
                    depth += 1
                elif ch in "}])":
                    depth -= 1
                elif ch == "," and depth == 0:
                    break
                j += 1
            entry = body[i:j].rstrip().rstrip(",")
            entries.append((key, entry))
            i = j + 1
            continue

        # object value
        start_entry = i
        depth = 0
        in_str = None
        while j < n:
            ch = body[j]
            if in_str:
                if ch == "\\":
                    j += 2
                    continue
                if ch == in_str:
                    in_str = None
                j += 1
                continue
            if ch in "\"'`":
                in_str = ch
                j += 1
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        # optional trailing comma
        k = j
        while k < n and body[k] in " \t\r\n":
            k += 1
        if k < n and body[k] == ",":
            j = k + 1
        entry = body[start_entry:j].rstrip().rstrip(",")
        # include leading comment lines immediately above if any
        entries.append((key, entry))
        i = j
    return entries


def write_ui_modules(text: str) -> dict:
    UI_DIR.mkdir(parents=True, exist_ok=True)
    groups = [
        "FREE_PROVIDERS",
        "FREE_TIER_PROVIDERS",
        "OAUTH_PROVIDERS",
        "APIKEY_PROVIDERS",
        "WEB_COOKIE_PROVIDERS",
    ]
    group_files = {
        "FREE_PROVIDERS": "free.js",
        "FREE_TIER_PROVIDERS": "free-tier.js",
        "OAUTH_PROVIDERS": "oauth.js",
        "APIKEY_PROVIDERS": "apikey.js",
        "WEB_COOKIE_PROVIDERS": "web-cookie.js",
    }

    # Extract preamble (RISK_NOTICE, XIAOMI, THINKING_CONFIG, MINIMAX_TTS) for shared
    preamble_end = text.find("export const FREE_PROVIDERS")
    if preamble_end < 0:
        raise RuntimeError("FREE_PROVIDERS not found")
    preamble = text[:preamble_end]

    # Extract helpers after AI_PROVIDERS combine
    _, _, ai_start, ai_end = extract_export_object(text, "AI_PROVIDERS")
    # Actually AI_PROVIDERS is one-liner spread — find it
    m_ai = re.search(
        r"export const AI_PROVIDERS\s*=\s*\{[\s\S]*?\};",
        text,
    )
    if not m_ai:
        raise RuntimeError("AI_PROVIDERS combine not found")
    post = text[m_ai.end() :]

    # MEDIA_PROVIDER_KINDS and prefixes live before AI_PROVIDERS
    media_m = re.search(r"export const MEDIA_PROVIDER_KINDS\s*=", text)
    prefixes_block_start = media_m.start() if media_m else m_ai.start()
    mid = text[prefixes_block_start : m_ai.start()]

    # shared constants used by provider groups
    shared_path = UI_DIR / "_shared.js"
    # Keep RISK_NOTICE + XIAOMI + THINKING + MINIMAX from preamble; export symbols groups need
    shared_body = preamble.rstrip() + "\n"
    shared_body = re.sub(r"^const RISK_NOTICE\s*=", "export const RISK_NOTICE =", shared_body, count=1, flags=re.M)
    shared_body = re.sub(r"^const MINIMAX_TTS_MODELS\s*=", "export const MINIMAX_TTS_MODELS =", shared_body, count=1, flags=re.M)
    shared_path.write_text(shared_body, encoding="utf-8")

    counts = {}
    for gname in groups:
        full, body, _, _ = extract_export_object(text, gname)
        fname = group_files[gname]
        # need imports from shared for RISK_NOTICE / THINKING_CONFIG / MINIMAX / XIAOMI
        needs = []
        for sym in [
            "RISK_NOTICE",
            "THINKING_CONFIG",
            "MINIMAX_TTS_MODELS",
            "resolveXiaomiTokenPlanBaseUrl",
            "XIAOMI_TOKENPLAN_REGIONS",
        ]:
            if re.search(rf"\b{sym}\b", full):
                needs.append(sym)
        import_line = ""
        if needs:
            import_line = "import { " + ", ".join(needs) + " } from \"./_shared.js\";\n\n"
        # rewrite: keep export const NAME = { body };
        out = import_line + f"export const {gname} = {{{body}}};\n"
        (UI_DIR / fname).write_text(out, encoding="utf-8")
        entries = split_top_level_entries(body)
        counts[gname] = len(entries)

    # media + prefixes
    (UI_DIR / "media-kinds.js").write_text(mid.strip() + "\n", encoding="utf-8")

    # catalog combine only (breaks circular deps with helpers)
    (UI_DIR / "catalog.js").write_text(
        '''import { FREE_PROVIDERS } from "./free.js";
import { FREE_TIER_PROVIDERS } from "./free-tier.js";
import { OAUTH_PROVIDERS } from "./oauth.js";
import { APIKEY_PROVIDERS } from "./apikey.js";
import { WEB_COOKIE_PROVIDERS } from "./web-cookie.js";

/** Combined UI provider catalog */
export const AI_PROVIDERS = {
  ...FREE_PROVIDERS,
  ...FREE_TIER_PROVIDERS,
  ...OAUTH_PROVIDERS,
  ...APIKEY_PROVIDERS,
  ...WEB_COOKIE_PROVIDERS,
};
''',
        encoding="utf-8",
    )

    # helpers (icons, resolve, aliases…) reference AI_PROVIDERS
    helpers_body = post.lstrip()
    # drop duplicate AI_PROVIDERS one-liner if present at start of post
    helpers_body = re.sub(
        r"^export const AI_PROVIDERS\s*=\s*\{[\s\S]*?\};\s*",
        "",
        helpers_body,
        count=1,
    )
    helpers_src = 'import { AI_PROVIDERS } from "./catalog.js";\n\n' + helpers_body
    # if helpers re-exports AI_PROVIDERS somehow, fine
    (UI_DIR / "helpers.js").write_text(helpers_src if helpers_src.endswith("\n") else helpers_src + "\n", encoding="utf-8")

    index = '''/**
 * Modular provider catalog (RouterLab).
 * Split by auth group for maintainability (OmniRoute / 9router style).
 * Public API stays stable via this barrel + ../providers.js shim.
 */
export {
  RISK_NOTICE,
  XIAOMI_TOKENPLAN_REGIONS,
  resolveXiaomiTokenPlanBaseUrl,
  THINKING_CONFIG,
  MINIMAX_TTS_MODELS,
} from "./_shared.js";

export { FREE_PROVIDERS } from "./free.js";
export { FREE_TIER_PROVIDERS } from "./free-tier.js";
export { OAUTH_PROVIDERS } from "./oauth.js";
export { APIKEY_PROVIDERS } from "./apikey.js";
export { WEB_COOKIE_PROVIDERS } from "./web-cookie.js";

export {
  MEDIA_PROVIDER_KINDS,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
  CUSTOM_EMBEDDING_PREFIX,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  isCustomEmbeddingProvider,
} from "./media-kinds.js";

export { AI_PROVIDERS } from "./catalog.js";
export * from "./helpers.js";
'''
    (UI_DIR / "index.js").write_text(index, encoding="utf-8")

    # Shim: original providers.js becomes re-export
    shim = 'export * from "./providers/index.js";\n'
    UI_SRC.write_text(shim, encoding="utf-8")
    return counts


def write_backend_registry(text: str) -> int:
    BE_DIR.mkdir(parents=True, exist_ok=True)
    BE_REG.mkdir(parents=True, exist_ok=True)
    _full, body, start, end = extract_export_object(text, "PROVIDERS")
    entries = split_top_level_entries(body)
    preamble = text[:start]
    post = text[end:]

    # Export shared preamble symbols for per-provider imports
    shared_src = preamble.rstrip() + "\n"
    # export const for header objects / base urls used by providers
    for name in [
        "CLAUDE_API_HEADERS",
        "CLAUDE_CLI_SPOOF_HEADERS",
        "KIMI_CODING_BASE_URL",
    ]:
        shared_src = re.sub(
            rf"^const {name}\s*=",
            f"export const {name} =",
            shared_src,
            count=1,
            flags=re.M,
        )
    # export helper fns if present
    for name in ["mapStainlessOs", "mapStainlessArch"]:
        shared_src = re.sub(
            rf"^function {name}\s*\(",
            f"export function {name}(",
            shared_src,
            count=1,
            flags=re.M,
        )
    (BE_DIR / "_shared.js").write_text(shared_src if shared_src.endswith("\n") else shared_src + "\n", encoding="utf-8")

    shared_syms = [
        "CLAUDE_API_HEADERS",
        "CLAUDE_CLI_SPOOF_HEADERS",
        "KIMI_CODING_BASE_URL",
        "mapStainlessOs",
        "mapStainlessArch",
    ]

    id_list: list[str] = []
    for key, entry in entries:
        safe = re.sub(r"[^\w.-]+", "_", key)
        colon = entry.find(":")
        if colon < 0:
            continue
        obj_src = entry[colon + 1 :].strip()
        used = [s for s in shared_syms if re.search(rf"\b{s}\b", obj_src)]
        import_line = ""
        if used:
            import_line = "import { " + ", ".join(used) + ' } from "../_shared.js";\n\n'
        module = (
            f"/** Provider module: {key} (RouterLab registry — OmniRoute-style) */\n"
            f"{import_line}"
            f"export const id = {json.dumps(key)};\n"
            f"export default {obj_src};\n"
        )
        (BE_REG / f"{safe}.js").write_text(module, encoding="utf-8")
        id_list.append(key)

    imports = []
    assigns = []
    for key in id_list:
        safe = re.sub(r"[^\w.-]+", "_", key)
        var = "p_" + re.sub(r"[^A-Za-z0-9_]", "_", key)
        imports.append(f'import {var} from "./registry/{safe}.js";')
        assigns.append(f"  {json.dumps(key)}: {var},")

    index_body = (
        "/** Assembled PROVIDERS from per-provider registry modules. */\n"
        + "\n".join(imports)
        + "\n\nexport const PROVIDERS = {\n"
        + "\n".join(assigns)
        + "\n};\n"
        + post
    )
    (BE_DIR / "index.js").write_text(index_body, encoding="utf-8")
    BE_SRC.write_text('export * from "./providers/index.js";\n', encoding="utf-8")
    return len(id_list)


def write_report(ui_counts: dict, be_count: int) -> None:
    diff = {}
    if DIFF_JSON.exists():
        try:
            diff = json.loads(DIFF_JSON.read_text(encoding="utf-8"))
        except Exception:
            diff = {}

    missing = diff.get("missingInRouterLabFromOmni") or []
    # known aliases already in RouterLab under different ids
    alias_covered = {
        "command-code": "commandcode",
        "gitlab-duo": "gitlab",
        "xai-oauth": "xai / grok-cli (partial)",
    }
    true_missing = [m for m in missing if m not in alias_covered]

    lines = [
        "# Provider module split + upstream parity",
        "",
        "Nguồn đối chiếu:",
        "- OmniRoute: https://github.com/diegosouzapw/OmniRoute",
        "- 9router: https://github.com/decolua/9router",
        "- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI",
        "",
        "## Cấu trúc module (sau tách)",
        "",
        "### UI catalog",
        "```",
        "src/shared/constants/providers/",
        "  _shared.js          # RISK_NOTICE, THINKING_CONFIG, …",
        "  free.js",
        "  free-tier.js",
        "  oauth.js",
        "  apikey.js",
        "  web-cookie.js",
        "  media-kinds.js",
        "  helpers.js          # icons, resolve, favicon, aliases…",
        "  index.js            # AI_PROVIDERS barrel",
        "src/shared/constants/providers.js  # re-export shim",
        "```",
        "",
        "### Backend open-sse",
        "```",
        "open-sse/config/providers/",
        "  registry/<provider-id>.js   # 1 module / provider (OmniRoute style)",
        "  index.js                    # assemble PROVIDERS",
        "open-sse/config/providers.js  # re-export shim",
        "```",
        "",
        "## Counts",
        "",
    ]
    for k, v in ui_counts.items():
        lines.append(f"- UI `{k}`: **{v}**")
    lines.append(f"- Backend registry modules: **{be_count}**")
    lines.append(f"- OmniRoute registry (upstream): **{diff.get('omniRegistryCount', '?')}**")
    lines.append(f"- RouterLab UI ids: **{diff.get('routerLabUiCount', '?')}**")
    lines.append("")
    lines.append("## Gap vs OmniRoute (true missing, chưa alias)")
    lines.append("")
    if true_missing:
        for m in true_missing:
            lines.append(f"- `{m}`")
    else:
        lines.append("- (none)")
    lines.append("")
    lines.append("## Covered via alias / partial")
    for a, b in alias_covered.items():
        lines.append(f"- `{a}` → `{b}`")
    lines.append("")
    lines.append("## Best-of strategy")
    lines.append("")
    lines.append("| Vùng | Nguồn ưu tiên | Lý do |")
    lines.append("|------|---------------|-------|")
    lines.append("| Catalog provider rộng + UI | OmniRoute | Registry 200+ module, TS hiện đại |")
    lines.append("| Executor JS / RTK / combo | 9router + OmniRoute | RouterLab fork từ 9router, OmniRoute kế thừa |")
    lines.append("| Gateway resilience (session affinity, cloaking, Redis RESP, Amp CLI) | CLIProxyAPI | Go gateway patterns đã port |")
    lines.append("| Per-provider module layout | OmniRoute | `registry/<id>` dễ bảo trì |")
    lines.append("")
    lines.append("## Next (chưa làm trong đợt này)")
    lines.append("")
    lines.append("- Import full body config từ OmniRoute cho các id còn thiếu (agnes, freepik, g4f-*, …)")
    lines.append("- Tách thêm UI theo từng provider file nếu catalog >300")
    lines.append("- Port CLIProxyAPI auth modules còn thiếu (aistudio WS, xai-oauth full)")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    print("Reading UI…", UI_SRC)
    ui_text = UI_SRC.read_text(encoding="utf-8")
    if "export * from \"./providers/index.js\"" in ui_text or UI_DIR.joinpath("index.js").exists():
        # allow re-run: if already shim, load from modules? prefer original backup
        bak = UI_SRC.with_suffix(".js.pre-split")
        if bak.exists():
            ui_text = bak.read_text(encoding="utf-8")
            print("Using backup", bak)
        elif "FREE_PROVIDERS" not in ui_text:
            print("UI already split and no backup; skip UI rewrite")
            ui_counts = {}
        else:
            bak.write_text(ui_text, encoding="utf-8")
            print("Backup UI →", bak)
            ui_counts = write_ui_modules(ui_text)
    else:
        bak = UI_SRC.with_suffix(".js.pre-split")
        if not bak.exists():
            bak.write_text(ui_text, encoding="utf-8")
        ui_counts = write_ui_modules(ui_text)
    print("UI groups:", ui_counts)

    print("Reading backend…", BE_SRC)
    be_text = BE_SRC.read_text(encoding="utf-8")
    if "export * from \"./providers/index.js\"" in be_text:
        bakb = BE_SRC.with_suffix(".js.pre-split")
        if bakb.exists():
            be_text = bakb.read_text(encoding="utf-8")
            print("Using backend backup")
        else:
            print("Backend already split, no backup")
            be_count = len(list(BE_REG.glob("*.js"))) if BE_REG.exists() else 0
            write_report(ui_counts, be_count)
            return 0
    else:
        bakb = BE_SRC.with_suffix(".js.pre-split")
        if not bakb.exists():
            bakb.write_text(be_text, encoding="utf-8")

    be_count = write_backend_registry(be_text)
    print("Backend modules:", be_count)
    write_report(ui_counts, be_count)
    print("Report:", REPORT)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as ex:
        print("FATAL:", ex, file=sys.stderr)
        raise
