"""Benchmark Devin CLI ACP model latency for Hermes (cold + warm).

Measures pure ACP brain turn cost with a short fixed prompt.
Does NOT load Hermes skills/tools context — isolates model+ACP overhead.
"""
from __future__ import annotations

import json
import os
import sys
import time
import traceback
from pathlib import Path

HERMES_ROOT = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "hermes-agent"
sys.path.insert(0, str(HERMES_ROOT))

# Load .env keys Hermes uses for Devin path
env_path = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v

os.environ.setdefault(
    "HERMES_DEVIN_ACP_COMMAND",
    str(Path(os.environ.get("LOCALAPPDATA", "")) / "devin" / "cli" / "bin" / "devin.exe"),
)
os.environ.setdefault("HERMES_DEVIN_ACP_ARGS", "acp")
os.environ.setdefault("HERMES_DEVIN_ACP_MODE", "ask")
# summarizer = faster chat-only path (Hermes owns tools)
os.environ.setdefault("HERMES_DEVIN_ACP_AGENT", "summarizer")
os.environ.setdefault("HERMES_ACP_PERSIST", "1")

from agent.copilot_acp_client import CopilotACPClient  # noqa: E402

# Representative set: current default + free + likely-fast + popular coding
MODELS = [
    "swe-1-7",  # current Hermes default (Max)
    "swe-1-7-medium",
    "swe-1-7-lightning",
    "swe-1-6-fast",
    "adaptive",
    "glm-5-2-none",
    "glm-5-2",
    "gemini-3-5-flash-minimal",
    "gemini-3-5-flash-high",
    "gpt-5-6-luna-none",
    "gpt-5-6-luna-high",
    "gpt-5-4-mini-low",
    "kimi-k2-7",
    "deepseek-v4",
    "grok-4-5-low",
    "grok-4-5-high",
    "claude-sonnet-5-medium",
    "claude-sonnet-5-high",
    "MODEL_PRIVATE_11",  # haiku alias in catalog
]

PROMPT = (
    "Reply with exactly one word: pong. No explanation, no tools, no markdown."
)
TIMEOUT = 120.0
OUT = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "bench_devin_models_result.json"


def one_turn(client: CopilotACPClient, model: str) -> tuple[float, str, str]:
    t0 = time.perf_counter()
    text, reasoning = client._run_prompt(PROMPT, timeout_seconds=TIMEOUT, model=model)
    dt = time.perf_counter() - t0
    return dt, (text or "").strip()[:120], (reasoning or "").strip()[:80]


def main() -> int:
    results = []
    print(f"Devin ACP bench | agent={os.environ.get('HERMES_DEVIN_ACP_AGENT')} "
          f"mode={os.environ.get('HERMES_DEVIN_ACP_MODE')} persist={os.environ.get('HERMES_ACP_PERSIST')}")
    print(f"cmd={os.environ.get('HERMES_DEVIN_ACP_COMMAND')}")
    print(f"models={len(MODELS)} prompt={PROMPT!r}\n")

    # One shared client so process warm path is realistic for Hermes gateway
    client = CopilotACPClient(base_url="acp://devin", acp_cwd=str(Path.home()))
    try:
        # Cold boot: first ensure_session without model switch cost measured separately
        t_boot = time.perf_counter()
        try:
            sid = client._ensure_session(timeout_seconds=TIMEOUT, model=None)
            boot_s = time.perf_counter() - t_boot
            print(f"[boot] session_new ok sid={sid[:12]}… in {boot_s:.2f}s\n")
        except Exception as e:
            boot_s = time.perf_counter() - t_boot
            print(f"[boot] FAILED in {boot_s:.2f}s: {e}")
            traceback.print_exc()
            return 1

        for i, model in enumerate(MODELS, 1):
            row = {"model": model, "ok": False}
            print(f"[{i:02d}/{len(MODELS)}] {model} …", flush=True)
            try:
                # Model switch + first prompt (semi-cold for that model)
                cold_s, text1, reason1 = one_turn(client, model)
                # Immediate second prompt (warm, same model/session)
                warm_s, text2, reason2 = one_turn(client, model)
                row.update(
                    {
                        "ok": True,
                        "cold_s": round(cold_s, 2),
                        "warm_s": round(warm_s, 2),
                        "cold_reply": text1,
                        "warm_reply": text2,
                        "cold_reasoning_len": len(reason1),
                        "warm_reasoning_len": len(reason2),
                    }
                )
                print(
                    f"       cold={cold_s:6.2f}s  warm={warm_s:6.2f}s  "
                    f"reply={text1!r}"
                )
            except Exception as e:
                row["error"] = f"{type(e).__name__}: {e}"
                print(f"       FAIL {row['error']}")
                # Reset client session after hard failure
                try:
                    client.close()
                except Exception:
                    pass
                client = CopilotACPClient(base_url="acp://devin", acp_cwd=str(Path.home()))
                try:
                    client._ensure_session(timeout_seconds=TIMEOUT, model=None)
                except Exception as e2:
                    print(f"       re-boot fail: {e2}")
            results.append(row)
            OUT.write_text(json.dumps({"boot_s": round(boot_s, 2), "results": results}, indent=2), encoding="utf-8")
    finally:
        try:
            client.close()
        except Exception:
            pass

    ok = [r for r in results if r.get("ok")]
    print("\n===== RANKING (warm_s ascending) =====")
    for r in sorted(ok, key=lambda x: x["warm_s"]):
        print(f"  {r['warm_s']:6.2f}s warm | {r['cold_s']:6.2f}s cold | {r['model']}")
    fail = [r for r in results if not r.get("ok")]
    if fail:
        print("\n===== FAILED =====")
        for r in fail:
            print(f"  {r['model']}: {r.get('error')}")
    print(f"\nSaved: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
