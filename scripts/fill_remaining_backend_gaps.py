#!/usr/bin/env python3
"""Fill remaining Omni top-level registry IDs missing from open-sse backend."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / "open-sse/config/providers/registry"
IDX = ROOT / "open-sse/config/providers/index.js"

# id -> backend config (from Omni + known defaults)
GAPS = {
    "agy": {
        "baseUrl": "https://daily-cloudcode-pa.googleapis.com",
        "format": "antigravity",
    },
    "clinepass": {
        "baseUrl": "https://api.cline.bot/v1/chat/completions",
        "format": "openai",
    },
    "grok-cli": {
        "baseUrl": "https://api.x.ai/v1/chat/completions",
        "format": "openai",
    },
    "huggingface": {
        "baseUrl": "https://router.huggingface.co/v1/chat/completions",
        "format": "openai",
    },
    "trae": {
        "baseUrl": "https://api.trae.ai/v1/chat/completions",
        "format": "openai",
    },
    "windsurf": {
        "baseUrl": "https://server.codeium.com/exa.api_server_pb.ApiServerService",
        "format": "openai",
    },
    "zed-hosted": {
        "baseUrl": "https://cloud.zed.dev/v1/chat/completions",
        "format": "openai",
    },
    # aliases → same endpoints as canonical ids
    "command-code": {
        "baseUrl": "https://api.commandcode.ai/alpha/generate",
        "format": "commandcode",
        "aliasOf": "commandcode",
    },
    "gitlab-duo": {
        "baseUrl": "https://gitlab.com/api/v4/chat/completions",
        "format": "openai",
        "aliasOf": "gitlab",
    },
}


def write_module(pid: str, cfg: dict) -> None:
    alias = cfg.get("aliasOf")
    lines = [f"/** Provider module: {pid} (Omni gap-fill) */"]
    if alias:
        lines.append(f'export const id = "{pid}";')
        lines.append(f'/** Alias of `{alias}` — same endpoint for Omni naming parity. */')
        lines.append("export default {")
    else:
        lines.append(f'export const id = "{pid}";')
        lines.append("export default {")
    lines.append(f'  baseUrl: "{cfg["baseUrl"]}",')
    lines.append(f'  format: "{cfg["format"]}",')
    if alias:
        lines.append(f'  aliasOf: "{alias}",')
    lines.append("};")
    lines.append("")
    (REG / f"{pid}.js").write_text("\n".join(lines), encoding="utf-8")


def rebuild_index_append(new_ids: list[str]) -> None:
    text = IDX.read_text(encoding="utf-8")
    imports = []
    assigns = []
    for pid in new_ids:
        safe = re.sub(r"[^\w.-]+", "_", pid)
        var = "p_" + re.sub(r"[^A-Za-z0-9_]", "_", pid)
        if f'from "./registry/{safe}.js"' in text or f'from "./registry/{pid}.js"' in text:
            continue
        imports.append(f'import {var} from "./registry/{pid}.js";')
        assigns.append(f'  "{pid}": {var},')
    if not imports:
        print("index already has all")
        return
    last_imp = 0
    for m in re.finditer(r"^import .+$", text, re.M):
        last_imp = m.end()
    text = text[:last_imp] + "\n" + "\n".join(imports) + text[last_imp:]
    m = re.search(r"export const PROVIDERS\s*=\s*\{", text)
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
    text = text[:end] + "\n" + "\n".join(assigns) + "\n" + text[end:]
    IDX.write_text(text, encoding="utf-8")
    print("index +", len(imports))


def add_ui_aliases() -> None:
    """Surface command-code / gitlab-duo as UI alias entries (hidden, map to real ids via alias field)."""
    oauth = ROOT / "src/shared/constants/providers/oauth.js"
    t = oauth.read_text(encoding="utf-8")
    added = []
    if 'id: "command-code"' not in t and '"command-code"' not in t:
        # commandcode is apikey/oauth? it's oauth-ish but in APIKEY in some systems - in RL commandcode is in apikey
        pass
    # put aliases into helpers ALIAS if needed — model.js already maps them
    apikey = ROOT / "src/shared/constants/providers/apikey.js"
    at = apikey.read_text(encoding="utf-8")
    if 'id: "command-code"' not in at:
        # add as hidden alias entry pointing same name as commandcode
        insert = (
            '  "command-code": { id: "command-code", alias: "command-code", name: "Command Code (alias)", '
            'icon: "code", color: "#6366F1", textIcon: "CC", website: "https://commandcode.ai", '
            'notice: { text: "Alias of commandcode for OmniRoute naming." }, serviceKinds: ["llm"], hidden: true },\n'
        )
        idx = at.rfind("};")
        at = at[:idx] + insert + at[idx:]
        apikey.write_text(at, encoding="utf-8")
        added.append("command-code")
    if 'id: "gitlab-duo"' not in t:
        insert = (
            '  "gitlab-duo": { id: "gitlab-duo", alias: "gitlab-duo", name: "GitLab Duo (alias)", '
            'icon: "hub", color: "#FC6D26", textIcon: "GD", website: "https://docs.gitlab.com", '
            'notice: { text: "Alias of gitlab for OmniRoute naming." }, serviceKinds: ["llm"], hidden: true },\n'
        )
        idx = t.rfind("};")
        t = t[:idx] + insert + t[idx:]
        oauth.write_text(t, encoding="utf-8")
        added.append("gitlab-duo")
    print("ui aliases", added)


def main() -> int:
    new = []
    for pid, cfg in GAPS.items():
        if not (REG / f"{pid}.js").exists():
            write_module(pid, cfg)
            new.append(pid)
            print("wrote", pid)
        else:
            print("exists", pid)
    rebuild_index_append(list(GAPS.keys()))
    add_ui_aliases()
    print(json.dumps({"newModules": new}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
