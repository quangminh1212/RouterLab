"""Quality + latency bench for FREE Devin models only (Hermes brain path)."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import traceback
from pathlib import Path

HERMES_ROOT = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "hermes-agent"
sys.path.insert(0, str(HERMES_ROOT))

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
os.environ.setdefault("HERMES_ACP_PERSIST", "1")

from agent.copilot_acp_client import CopilotACPClient  # noqa: E402

# Catalog Free only (verified from `devin models list`)
FREE_MODELS = [
    "swe-1-7-medium",
    "swe-1-7",
    "swe-1-6",
    "glm-5-2",
]

TASKS = [
    {
        "id": "ping",
        "prompt": "Reply with exactly one word: pong. No explanation.",
        "check": lambda t: t.strip().lower().rstrip(".").startswith("pong")
        or t.strip().lower() == "pong",
        "weight": 1,
    },
    {
        "id": "vi_short",
        "prompt": (
            "Trả lời bằng tiếng Việt, đúng 1 câu ngắn: "
            "thủ đô của Việt Nam là gì?"
        ),
        "check": lambda t: any(
            x in t.lower() for x in ("hà nội", "ha noi", "hanoi")
        ),
        "weight": 2,
    },
    {
        "id": "json_only",
        "prompt": (
            'Return ONLY valid JSON, no markdown fences: '
            '{"ok": true, "n": 3, "items": ["a","b","c"]}'
        ),
        "check": lambda t: _json_ok(t),
        "weight": 2,
    },
    {
        "id": "tool_xml",
        "prompt": (
            "You are Hermes agent. User asks to list files in C:\\Dev\\AgentLab.\n"
            "Respond with EXACTLY one tool call in this XML format and nothing else:\n"
            "<tool_call>\n"
            '{"name": "terminal", "arguments": {"command": "dir"}}\n'
            "</tool_call>"
        ),
        "check": lambda t: _tool_xml_ok(t),
        "weight": 3,
    },
    {
        "id": "code_reason",
        "prompt": (
            "What is the output of this Python?\n"
            "print(sum(i*i for i in range(1,6)))\n"
            "Answer with only the number."
        ),
        "check": lambda t: "55" in re.sub(r"\s+", "", t),
        "weight": 2,
    },
]

TIMEOUT = 90.0
OUT = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "bench_devin_free_result.json"


def _json_ok(text: str) -> bool:
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    try:
        obj = json.loads(s)
        return obj.get("ok") is True and obj.get("n") == 3 and obj.get("items") == ["a", "b", "c"]
    except Exception:
        return False


def _tool_xml_ok(text: str) -> bool:
    t = text.strip()
    if "<tool_call>" not in t or "</tool_call>" not in t:
        return False
    if "terminal" not in t:
        return False
    # Prefer pure tool call (little prose)
    prose = re.sub(r"<tool_call>[\s\S]*?</tool_call>", "", t).strip()
    return len(prose) < 80


def one_prompt(client: CopilotACPClient, model: str, prompt: str) -> tuple[float, str]:
    t0 = time.perf_counter()
    text, _reason = client._run_prompt(prompt, timeout_seconds=TIMEOUT, model=model)
    return time.perf_counter() - t0, (text or "").strip()


def main() -> int:
    print(f"FREE models only: {FREE_MODELS}")
    print(f"Tasks: {[t['id'] for t in TASKS]}\n")
    client = CopilotACPClient(base_url="acp://devin", acp_cwd=str(Path.home()))
    all_rows = []
    try:
        t_boot = time.perf_counter()
        sid = client._ensure_session(timeout_seconds=TIMEOUT, model=None)
        boot_s = time.perf_counter() - t_boot
        print(f"[boot] {boot_s:.2f}s sid={sid[:16]}…\n")

        for model in FREE_MODELS:
            print(f"===== {model} =====", flush=True)
            mrow = {
                "model": model,
                "tasks": [],
                "pass_w": 0,
                "total_w": 0,
                "latencies": [],
                "errors": 0,
            }
            for task in TASKS:
                mrow["total_w"] += task["weight"]
                print(f"  [{task['id']}] …", end=" ", flush=True)
                try:
                    # warm-ish: 1 attempt
                    sec, reply = one_prompt(client, model, task["prompt"])
                    ok = bool(task["check"](reply))
                    if ok:
                        mrow["pass_w"] += task["weight"]
                    mrow["latencies"].append(sec)
                    mrow["tasks"].append(
                        {
                            "id": task["id"],
                            "ok": ok,
                            "sec": round(sec, 2),
                            "reply": reply[:200],
                            "weight": task["weight"],
                        }
                    )
                    flag = "PASS" if ok else "FAIL"
                    print(f"{flag} {sec:.2f}s | {reply[:80]!r}")
                except Exception as e:
                    mrow["errors"] += 1
                    mrow["tasks"].append(
                        {
                            "id": task["id"],
                            "ok": False,
                            "error": f"{type(e).__name__}: {e}",
                            "weight": task["weight"],
                        }
                    )
                    print(f"ERR {e}")
                    try:
                        client.close()
                    except Exception:
                        pass
                    client = CopilotACPClient(
                        base_url="acp://devin", acp_cwd=str(Path.home())
                    )
                    try:
                        client._ensure_session(timeout_seconds=TIMEOUT, model=None)
                    except Exception as e2:
                        print(f"  re-boot fail: {e2}")
            lats = mrow["latencies"]
            mrow["avg_s"] = round(sum(lats) / len(lats), 2) if lats else None
            mrow["score"] = (
                round(100.0 * mrow["pass_w"] / mrow["total_w"], 1)
                if mrow["total_w"]
                else 0
            )
            print(
                f"  >> score={mrow['score']}%  avg={mrow['avg_s']}s  "
                f"errors={mrow['errors']}\n"
            )
            all_rows.append(mrow)
            OUT.write_text(
                json.dumps({"boot_s": round(boot_s, 2), "results": all_rows}, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
    finally:
        try:
            client.close()
        except Exception:
            pass

    print("===== RANKING free models =====")
    # Prefer higher score, then lower avg latency, then fewer errors
    ranked = sorted(
        all_rows,
        key=lambda r: (-r["score"], r["avg_s"] if r["avg_s"] is not None else 999, r["errors"]),
    )
    for i, r in enumerate(ranked, 1):
        print(
            f"  #{i} {r['model']}: score={r['score']}% avg={r['avg_s']}s "
            f"errors={r['errors']}"
        )
    best = ranked[0]["model"] if ranked else None
    print(f"\nBEST FREE: {best}")
    print(f"Saved: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
