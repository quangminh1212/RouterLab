"""Set Hermes to Devin-only free model rotation (UI order, continuous per turn).

Order:
  glm-5-2 (Glm 5 2 Ultra)  -> primary
  swe-1-7 (Swe 1 7 Ultra)  -> fallback 1
  swe-1-6 (Swe 1 6 Ultra)  -> fallback 2

Hermes restores primary each turn via restore_primary_runtime(), so the
effective loop is: glm -> swe-1-7 -> swe-1-6 -> glm -> ...
"""
from __future__ import annotations

import json
import re
import shutil
import time
from pathlib import Path

import yaml

CFG = Path(r"C:\Users\GHC\AppData\Local\hermes\config.yaml")
ACP = Path(r"C:\Users\GHC\AppData\Local\hermes\devin-hermes-acp.json")
PROFILE = Path(r"C:\Dev\AgentLab\profile\config.yaml")

NEW_BLOCK = """# Devin-only free model rotation (UI order, continuous per turn):
#   glm-5-2 (Glm 5 2 Ultra)  -> primary
#   swe-1-7 (Swe 1 7 Ultra)  -> fallback 1
#   swe-1-6 (Swe 1 6 Ultra)  -> fallback 2
# Hermes restores primary each turn => loops: glm -> swe17 -> swe16 -> glm ...
fallback_providers:
  - provider: devin-acp
    model: swe-1-7
    base_url: acp://devin
  - provider: devin-acp
    model: swe-1-6
    base_url: acp://devin
providers:
  devin-acp:
    request_timeout_seconds: 45
    stale_timeout_seconds: 40
    models:
      glm-5-2:
        timeout_seconds: 50
        stale_timeout_seconds: 45
      swe-1-7:
        timeout_seconds: 50
        stale_timeout_seconds: 45
      swe-1-6:
        timeout_seconds: 50
        stale_timeout_seconds: 45
"""


def main() -> None:
    backup = CFG.with_suffix(f".yaml.bak-devin-rotate-{int(time.time())}")
    shutil.copy2(CFG, backup)
    print("backup", backup)

    text = CFG.read_text(encoding="utf-8")
    text2 = re.sub(r"(?m)^(  default:\s*).+$", r"\1glm-5-2", text, count=1)

    lines = text2.splitlines(keepends=True)
    start_i = None
    for i, line in enumerate(lines):
        if re.match(r"^fallback_providers:\s*$", line):
            start_i = i
            break
    if start_i is None:
        raise SystemExit("fallback_providers not found")

    end_i = None
    for i in range(start_i + 1, len(lines)):
        line = lines[i]
        if re.match(r"^(fallback_providers|providers):\s*$", line):
            continue
        if re.match(r"^[A-Za-z_#]", line):
            end_i = i
            break
    if end_i is None:
        end_i = len(lines)

    nl = "\r\n" if any(l.endswith("\r\n") for l in lines[:5]) else "\n"
    block = NEW_BLOCK.replace("\n", nl)
    if not block.endswith(nl):
        block += nl

    out = "".join(lines[:start_i] + [block] + lines[end_i:])
    CFG.write_text(out, encoding="utf-8")

    cfg = yaml.safe_load(CFG.read_text(encoding="utf-8"))
    print("default", cfg["model"]["default"], cfg["model"]["provider"])
    print("fallback", cfg["fallback_providers"])
    print("providers keys", list(cfg.get("providers", {}).keys()))

    assert cfg["model"]["default"] == "glm-5-2"
    assert all(e["provider"] == "devin-acp" for e in cfg["fallback_providers"])
    assert [e["model"] for e in cfg["fallback_providers"]] == ["swe-1-7", "swe-1-6"]
    assert "xai-oauth" not in [e["provider"] for e in cfg["fallback_providers"]]
    assert list(cfg["providers"].keys()) == ["devin-acp"]
    print("CONFIG_OK")

    if ACP.exists():
        data = json.loads(ACP.read_text(encoding="utf-8"))
        data.setdefault("agent", {})["model"] = "glm-5-2"
        ACP.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print("ACP_OK", data["agent"]["model"])

    if PROFILE.exists():
        ptext = PROFILE.read_text(encoding="utf-8")
        p2 = re.sub(r"(?m)^(  default:\s*).+$", r"\1glm-5-2", ptext, count=1)
        if p2 != ptext:
            PROFILE.write_text(p2, encoding="utf-8")
            print("PROFILE_OK default=glm-5-2")
        else:
            print("PROFILE unchanged or already glm-5-2")


if __name__ == "__main__":
    main()
