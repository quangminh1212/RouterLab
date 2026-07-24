#!/usr/bin/env python3
"""Rebuild providers/_shared.js with THINKING_CONFIG + MINIMAX from pre-split backup."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAK = ROOT / "src/shared/constants/providers.js.pre-split"
SHARED = ROOT / "src/shared/constants/providers/_shared.js"


def extract_object(text: str, pattern: str) -> str:
    m = re.search(pattern, text)
    if not m:
        raise RuntimeError(f"not found: {pattern}")
    start = m.start()
    # find first { or [ after match start
    brace_i = text.find("{", m.end() - 1)
    brack_i = text.find("[", m.end() - 1)
    if brace_i < 0 and brack_i < 0:
        raise RuntimeError("no container")
    if brace_i < 0:
        i0, open_c, close_c = brack_i, "[", "]"
    elif brack_i < 0:
        i0, open_c, close_c = brace_i, "{", "}"
    else:
        if brack_i < brace_i:
            i0, open_c, close_c = brack_i, "[", "]"
        else:
            i0, open_c, close_c = brace_i, "{", "}"
    depth = 0
    i = i0
    while i < len(text):
        ch = text[i]
        if ch == open_c:
            depth += 1
        elif ch == close_c:
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(text) and text[end] == ";":
                    end += 1
                return text[start:end]
        i += 1
    raise RuntimeError("unclosed")


def main() -> int:
    t = BAK.read_text(encoding="utf-8")
    risk = re.search(r'const RISK_NOTICE\s*=\s*"[^"]*";', t)
    if not risk:
        # try with emoji etc non-greedy
        risk = re.search(r"const RISK_NOTICE\s*=\s*[\s\S]*?;", t)
    risk_s = "export " + risk.group(0) if risk else ""

    xiaomi = extract_object(t, r"export const XIAOMI_TOKENPLAN_REGIONS\s*=")
    resolve_m = re.search(
        r"export function resolveXiaomiTokenPlanBaseUrl[\s\S]*?\n\}",
        t,
    )
    resolve_s = resolve_m.group(0) if resolve_m else ""
    thinking = extract_object(t, r"export const THINKING_CONFIG\s*=")
    minimax = extract_object(t, r"const MINIMAX_TTS_MODELS\s*=")
    minimax = minimax.replace("const MINIMAX_TTS_MODELS", "export const MINIMAX_TTS_MODELS", 1)

    out = "\n\n".join(
        [
            "// Shared provider constants (split from monolithic providers.js)",
            risk_s,
            xiaomi,
            resolve_s,
            thinking,
            minimax,
            "",
        ]
    )
    SHARED.write_text(out, encoding="utf-8")
    print("Wrote", SHARED, "bytes", SHARED.stat().st_size)
    # sanity
    text = SHARED.read_text(encoding="utf-8")
    for s in ["RISK_NOTICE", "THINKING_CONFIG", "MINIMAX_TTS_MODELS", "resolveXiaomiTokenPlanBaseUrl"]:
        print(s, "ok" if s in text else "MISSING")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
