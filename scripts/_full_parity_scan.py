"""Full feature inventory: OmniRoute + 9router + CLIProxyAPI vs RouterLab."""
from __future__ import annotations

import json
import re
from pathlib import Path

RL = Path(r"C:\Dev\RouterLab")
OMNI = Path(r"C:\Dev\_upstream\OmniRoute")
NR = Path(r"C:\Dev\_upstream\9router")
CLIP = Path(r"C:\Dev\_upstream\CLIProxyAPI")
OUT = RL / "docs" / "_full_parity_scan.json"


def route_keys(root: Path, name: str) -> set[str]:
    if not root.exists():
        return set()
    return {p.parent.relative_to(root).as_posix() for p in root.rglob(name)}


def stems(d: Path, ext: str) -> set[str]:
    if not d.exists():
        return set()
    s: set[str] = set()
    for p in d.rglob(f"*{ext}"):
        if p.name.startswith(("_", "__")):
            continue
        if p.name in ("index.js", "index.ts"):
            continue
        s.add(p.stem)
    return s


def exec_keys_from_index(text: str) -> set[str]:
    keys = set(re.findall(r"['\"]([a-zA-Z0-9_.-]+)['\"]\s*:", text))
    keys |= set(re.findall(r"\n\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*new\s+", text))
    keys |= set(re.findall(r"\n\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*[a-zA-Z]", text))
    # drop non-provider noise
    noise = {
        "const",
        "export",
        "import",
        "return",
        "if",
        "for",
        "default",
        "super",
        "class",
        "async",
        "await",
        "true",
        "false",
        "null",
        "undefined",
    }
    return {k for k in keys if k not in noise and not k[0].isupper()}


# Omni provider IDs
omni_reg = OMNI / "open-sse" / "config" / "providers" / "registry"
omni_ids: set[str] = set()
if omni_reg.exists():
    for p in omni_reg.rglob("index.ts"):
        rel = p.parent.relative_to(omni_reg).as_posix()
        if rel != ".":
            omni_ids.add(rel.split("/")[0])
    for p in omni_reg.glob("*.ts"):
        if p.name != "index.ts":
            omni_ids.add(p.stem)

rl_reg = RL / "open-sse" / "config" / "providers" / "registry"
rl_ids = {p.stem for p in rl_reg.glob("*.js")} if rl_reg.exists() else set()

# Executor maps
omni_idx = (OMNI / "open-sse" / "executors" / "index.ts").read_text(
    encoding="utf-8", errors="ignore"
)
rl_idx = (RL / "open-sse" / "executors" / "index.js").read_text(
    encoding="utf-8", errors="ignore"
)
omni_exec = exec_keys_from_index(omni_idx)
rl_exec = exec_keys_from_index(rl_idx)
# webChat ids also specialized
web_reg = RL / "open-sse" / "executors" / "webChat" / "registry.js"
if web_reg.exists():
    web_txt = web_reg.read_text(encoding="utf-8", errors="ignore")
    rl_exec |= set(re.findall(r"['\"]([a-zA-Z0-9_.-]+)['\"]\s*:", web_txt))

nr_ex = stems(NR / "open-sse" / "executors", ".js")
rl_ex_files = stems(RL / "open-sse" / "executors", ".js")

# API routes
omni_api = route_keys(OMNI / "src" / "app" / "api", "route.ts")
rl_api = route_keys(RL / "src" / "app" / "api", "route.js")
nr_api = route_keys(NR / "src" / "app" / "api", "route.js")

# CLIProxy routes
clip_srv = (CLIP / "internal" / "api" / "server.go").read_text(
    encoding="utf-8", errors="ignore"
)
clip_paths = sorted(set(re.findall(r'\.(?:GET|POST|PUT|DELETE|PATCH)\("([^"]+)"', clip_srv)))

# UI ids
ui_text = ""
ui_dir = RL / "src" / "shared" / "constants" / "providers"
if ui_dir.exists():
    for f in ui_dir.glob("*.js"):
        ui_text += f.read_text(encoding="utf-8", errors="ignore") + "\n"
ui_ids = set(re.findall(r"id:\s*['\"]([a-zA-Z0-9_.-]+)['\"]", ui_text))

# 9router services
nr_svc = stems(NR / "open-sse" / "services", ".js")
rl_svc = stems(RL / "open-sse" / "services", ".js")

# High-value Omni open-sse services (top-level files only)
omni_svc_top = (
    {p.stem for p in (OMNI / "open-sse" / "services").glob("*.ts")}
    if (OMNI / "open-sse" / "services").exists()
    else set()
)
rl_svc_top = (
    {p.stem for p in (RL / "open-sse" / "services").glob("*.js")}
    if (RL / "open-sse" / "services").exists()
    else set()
)

# Map Omni high-value services that should exist (functional categories)
CORE_OMNI_SERVICES = {
    "combo",
    "accountFallback",
    "tokenRefresh",
    "payloadRules",
    "contextHandoff",
    "sessionAffinity",
    "sessionManager",
    "usage",
    "model",
    "provider",
    "promptInjectionGuard",
    "comboSelfHeal",
    "comboFusion",
    "projectId",
    "kiroModels",
    "redisUsageQueue",
    "compact",
}

report = {
    "counts": {
        "omni_providers": len(omni_ids),
        "rl_providers": len(rl_ids),
        "omni_exec_keys": len(omni_exec),
        "rl_exec_keys": len(rl_exec),
        "omni_api": len(omni_api),
        "rl_api": len(rl_api),
        "nr_api": len(nr_api),
        "clip_paths": len(clip_paths),
        "ui_ids": len(ui_ids),
    },
    "providers_missing_vs_omni": sorted(omni_ids - rl_ids),
    "exec_missing_vs_omni": sorted(omni_exec - rl_exec),
    "nr_exec_missing": sorted(nr_ex - rl_ex_files),
    "nr_svc_missing": sorted(nr_svc - rl_svc),
    "api_missing_vs_nr": sorted(nr_api - rl_api),
    "api_missing_vs_omni": sorted(omni_api - rl_api),
    "core_omni_services": {
        s: (s in rl_svc_top or any(s in x for x in rl_svc) or (RL / "open-sse" / "services" / f"{s}.js").exists())
        for s in sorted(CORE_OMNI_SERVICES)
    },
    "clip_paths": clip_paths,
    "ui_missing_backend": sorted(ui_ids - rl_ids)[:50],
    "backend_missing_ui": sorted(rl_ids - ui_ids)[:50],
}

# Alias normalization for known renames
ALIASES = {
    "command-code": "commandcode",
    "gitlab-duo": "gitlab",
    "azure-openai": "azure",
    "ninerouter": "9router",
    "mimo-free": "mimocode",
}


def resolve(id_: str, pool: set[str]) -> bool:
    if id_ in pool:
        return True
    if ALIASES.get(id_) in pool:
        return True
    # reverse alias
    for a, b in ALIASES.items():
        if id_ == b and a in pool:
            return True
    return False


still_missing_exec = []
for e in report["exec_missing_vs_omni"]:
    if not resolve(e, rl_exec) and e not in rl_ex_files:
        still_missing_exec.append(e)
report["exec_still_missing_after_alias"] = still_missing_exec

still_missing_prov = []
for p in report["providers_missing_vs_omni"]:
    if not resolve(p, rl_ids) and not resolve(p, ui_ids):
        still_missing_prov.append(p)
report["providers_still_missing"] = still_missing_prov

OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
print("=== FULL PARITY SCAN ===")
print(json.dumps(report["counts"], indent=2))
print("providers_still_missing", len(still_missing_prov))
for x in still_missing_prov[:40]:
    print("  P", x)
print("exec_still_missing", len(still_missing_exec))
for x in still_missing_exec[:50]:
    print("  E", x)
print("nr_exec_missing", report["nr_exec_missing"])
print("nr_svc_missing", report["nr_svc_missing"])
print("api_missing_vs_nr", report["api_missing_vs_nr"])
print("core services", report["core_omni_services"])
print("wrote", OUT)
