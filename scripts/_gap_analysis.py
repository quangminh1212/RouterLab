"""Gap analysis: RouterLab vs OmniRoute / 9router / CLIProxyAPI."""
from pathlib import Path
import json

rl = Path(r"C:\Dev\RouterLab")
omni = Path(r"C:\Dev\_upstream\OmniRoute")
nr = Path(r"C:\Dev\_upstream\9router")
clip = Path(r"C:\Dev\_upstream\CLIProxyAPI")
out = Path(r"C:\Dev\RouterLab\docs\_gap_analysis_live.json")
md = Path(r"C:\Dev\RouterLab\docs\_gap_analysis_live.md")


def stems(d: Path, exts):
    if not d.exists():
        return set()
    result = set()
    for e in exts:
        for p in d.rglob(f"*{e}"):
            if p.name.startswith("_") or p.name.startswith("__"):
                continue
            if p.name in ("index.ts", "index.js"):
                continue
            result.add(p.stem)
    return result


def route_keys(api_root: Path, route_name: str):
    if not api_root.exists():
        return set()
    keys = set()
    for p in api_root.rglob(route_name):
        rel = p.parent.relative_to(api_root).as_posix()
        keys.add(rel)
    return keys


omni_exec = stems(omni / "open-sse" / "executors", [".ts"])
rl_exec = stems(rl / "open-sse" / "executors", [".js"])
omni_svc = stems(omni / "open-sse" / "services", [".ts"])
rl_svc = stems(rl / "open-sse" / "services", [".js"])
omni_h = stems(omni / "open-sse" / "handlers", [".ts"])
rl_h = stems(rl / "open-sse" / "handlers", [".js"])
omni_ids = stems(omni / "open-sse" / "config" / "providers" / "registry", [".ts"])
rl_ids = stems(rl / "open-sse" / "config" / "providers" / "registry", [".js"])
nr_exec = stems(nr / "open-sse" / "executors", [".js"])
nr_svc = stems(nr / "open-sse" / "services", [".js"])

omni_routes = route_keys(omni / "src" / "app" / "api", "route.ts")
rl_routes = route_keys(rl / "src" / "app" / "api", "route.js")
nr_routes = route_keys(nr / "src" / "app" / "api", "route.js")

# CLIProxyAPI high-level packages
clip_pkgs = []
for p in (clip / "internal").iterdir() if (clip / "internal").exists() else []:
    if p.is_dir():
        clip_pkgs.append(p.name)

clip_api_handlers = []
api_dir = clip / "internal" / "api"
if api_dir.exists():
    for p in sorted(api_dir.rglob("*.go")):
        if p.name.endswith("_test.go"):
            continue
        clip_api_handlers.append(p.relative_to(clip).as_posix())

data = {
    "executors": {
        "omni": sorted(omni_exec),
        "rl": sorted(rl_exec),
        "missing": sorted(omni_exec - rl_exec),
        "nr_missing": sorted(nr_exec - rl_exec),
    },
    "services": {
        "omni_count": len(omni_svc),
        "rl_count": len(rl_svc),
        "missing": sorted(omni_svc - rl_svc),
        "nr_missing": sorted(nr_svc - rl_svc),
    },
    "handlers": {
        "omni_count": len(omni_h),
        "rl_count": len(rl_h),
        "missing": sorted(omni_h - rl_h),
    },
    "providers": {
        "omni_count": len(omni_ids),
        "rl_count": len(rl_ids),
        "missing": sorted(omni_ids - rl_ids),
        "extra_rl": sorted(rl_ids - omni_ids),
    },
    "api_routes": {
        "omni_count": len(omni_routes),
        "rl_count": len(rl_routes),
        "nr_count": len(nr_routes),
        "missing_vs_omni": sorted(omni_routes - rl_routes),
        "missing_vs_nr": sorted(nr_routes - rl_routes),
    },
    "cliproxy": {
        "internal_pkgs": clip_pkgs,
        "api_go_files": clip_api_handlers[:200],
        "api_go_count": len(clip_api_handlers),
    },
}

out.write_text(json.dumps(data, indent=2), encoding="utf-8")

lines = []
lines.append("# Live gap analysis (RouterLab vs upstream main)")
lines.append("")
lines.append(f"- Omni executors: {len(omni_exec)} | RL: {len(rl_exec)} | **missing: {len(omni_exec - rl_exec)}**")
lines.append(f"- Omni services: {len(omni_svc)} | RL: {len(rl_svc)} | **missing: {len(omni_svc - rl_svc)}**")
lines.append(f"- Omni handlers: {len(omni_h)} | RL: {len(rl_h)} | **missing: {len(omni_h - rl_h)}**")
lines.append(f"- Omni providers: {len(omni_ids)} | RL: {len(rl_ids)} | **missing: {len(omni_ids - rl_ids)}**")
lines.append(f"- Omni API routes: {len(omni_routes)} | RL: {len(rl_routes)} | **missing: {len(omni_routes - rl_routes)}**")
lines.append(f"- 9router executors missing: {len(nr_exec - rl_exec)}")
lines.append(f"- 9router services missing: {len(nr_svc - rl_svc)}")
lines.append(f"- 9router API routes missing: {len(nr_routes - rl_routes)}")
lines.append(f"- CLIProxyAPI internal pkgs: {len(clip_pkgs)}, api go files: {len(clip_api_handlers)}")
lines.append("")
lines.append("## Missing executors (Omni)")
for m in sorted(omni_exec - rl_exec):
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing providers (Omni registry)")
for m in sorted(omni_ids - rl_ids):
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing handlers (Omni)")
for m in sorted(omni_h - rl_h):
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing API routes vs Omni (sample top 80)")
for m in sorted(omni_routes - rl_routes)[:80]:
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing services (Omni) — top-level names")
for m in sorted(omni_svc - rl_svc):
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing 9router executors")
for m in sorted(nr_exec - rl_exec):
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing 9router services")
for m in sorted(nr_svc - rl_svc):
    lines.append(f"- `{m}`")
lines.append("")
lines.append("## Missing 9router API routes")
for m in sorted(nr_routes - rl_routes):
    lines.append(f"- `{m}`")

md.write_text("\n".join(lines), encoding="utf-8")
print(md.read_text(encoding="utf-8")[:8000])
print("\n... written to", md, out)
