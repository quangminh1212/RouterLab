#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / "open-sse" / "config" / "providers" / "registry"
IDX = ROOT / "open-sse" / "config" / "providers" / "index.js"
PRE = ROOT / "open-sse" / "config" / "providers.js.pre-split"


def extract_order(text: str) -> list[str]:
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
    body = text[start + 1 : end]
    order = []
    for mm in re.finditer(
        r'^\s*(?:"([^"]+)"|\'([^\']+)\'|([A-Za-z0-9_.-]+))\s*:\s*\{',
        body,
        re.M,
    ):
        order.append(mm.group(1) or mm.group(2) or mm.group(3))
    return order


def main() -> int:
    pre = PRE.read_text(encoding="utf-8")
    order = extract_order(pre)
    files = {p.stem: p for p in REG.glob("*.js")}

    od: OrderedDict[str, str] = OrderedDict()
    for key in order:
        safe = re.sub(r"[^\w.-]+", "_", key)
        if safe in files:
            od[key] = safe  # last wins

    for stem in sorted(files):
        if stem not in od.values():
            od[stem] = stem

    imports = []
    assigns = []
    seen_vars: set[str] = set()
    for key, safe in od.items():
        var = "p_" + re.sub(r"[^A-Za-z0-9_]", "_", key)
        if var in seen_vars:
            continue
        seen_vars.add(var)
        imports.append(f'import {var} from "./registry/{safe}.js";')
        assigns.append(f"  {json.dumps(key)}: {var},")

    old = IDX.read_text(encoding="utf-8") if IDX.exists() else ""
    post_m = re.search(r"export const PROVIDERS\s*=\s*\{[\s\S]*?\n\};\n?", old)
    post = old[post_m.end() :] if post_m else "\n"

    out = (
        "/** Assembled PROVIDERS from per-provider registry modules. */\n"
        + "\n".join(imports)
        + "\n\nexport const PROVIDERS = {\n"
        + "\n".join(assigns)
        + "\n};\n"
        + post
    )
    IDX.write_text(out, encoding="utf-8")
    print("wrote", IDX)
    print("unique", len(od), "imports", len(imports))
    # verify no duplicate import lines
    lines = [ln for ln in out.splitlines() if ln.startswith("import ")]
    print("import lines", len(lines), "unique", len(set(lines)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
