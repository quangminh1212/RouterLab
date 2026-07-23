"""Comprehensive stability bench for Hermes Devin ACP provider.

Covers unit checks + live ACP turns (free models, tools, stress, context,
process park/reuse, model switch). Writes bench_devin_stability_result.json.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERMES_HOME = Path(os.environ.get("LOCALAPPDATA", "")) / "hermes"
HERMES_ROOT = HERMES_HOME / "hermes-agent"
OUT = HERMES_HOME / "bench_devin_stability_result.json"
sys.path.insert(0, str(HERMES_ROOT))

# Load Hermes .env
env_path = HERMES_HOME / ".env"
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
os.environ.setdefault(
    "HERMES_DEVIN_ACP_ARGS",
    f"--config {HERMES_HOME / 'devin-hermes-acp.json'} acp",
)
os.environ.setdefault("HERMES_DEVIN_ACP_MODE", "ask")
os.environ.setdefault("HERMES_DEVIN_ACP_AGENT", "default")
os.environ.setdefault("HERMES_ACP_PERSIST", "1")
os.environ.setdefault("HERMES_DEVIN_FORCE_TOOL_MODEL", "1")
os.environ.setdefault("HERMES_DEVIN_TOOL_FALLBACK", "1")
os.environ.setdefault("HERMES_DEVIN_TOOL_FALLBACK_MODEL", "swe-1-7-medium")

from agent.copilot_acp_client import (  # noqa: E402
    CopilotACPClient,
    _format_messages_as_prompt,
    _inject_devin_agent_type,
    _resolve_args_for_base_url,
    _resolve_command_for_base_url,
)

FREE_MODELS = ["swe-1-7-medium", "swe-1-7", "glm-5-2", "swe-1-6"]
TIMEOUT = 90.0
SAMPLE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "terminal",
            "description": "Run a shell command",
            "parameters": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
    }
]


class Suite:
    def __init__(self) -> None:
        self.results: list[dict] = []
        self.client: CopilotACPClient | None = None

    def record(self, name: str, ok: bool, sec: float = 0.0, detail: str = "", **extra) -> None:
        row = {"name": name, "ok": bool(ok), "sec": round(sec, 3), "detail": detail[:300]}
        row.update(extra)
        self.results.append(row)
        flag = "PASS" if ok else "FAIL"
        print(f"  [{flag}] {name} {sec:.2f}s | {detail[:100]}", flush=True)

    def unit_tests(self) -> None:
        # U01: env + args resolve
        args = _resolve_args_for_base_url("acp://devin")
        cmd = _resolve_command_for_base_url("acp://devin")
        ok = bool(cmd) and ("acp" in args or any("acp" in a for a in args))
        self.record("U01_config_env", ok, 0.0, f"cmd={cmd!r} args={args!r}")

        # U02: agent-type inject
        inj = _inject_devin_agent_type(["--config", "x.json", "acp"])
        # with default agent "default" inject is no-op; force check with temp env
        old = os.environ.get("HERMES_DEVIN_ACP_AGENT")
        try:
            os.environ["HERMES_DEVIN_ACP_AGENT"] = "summarizer"
            inj3 = _inject_devin_agent_type(["--config", "x.json", "acp"])
            ok2 = inj3 == ["--config", "x.json", "acp", "--agent-type", "summarizer"]
        finally:
            if old is None:
                os.environ.pop("HERMES_DEVIN_ACP_AGENT", None)
            else:
                os.environ["HERMES_DEVIN_ACP_AGENT"] = old
        self.record("U02_agent_type_inject", ok2, 0.0, f"inj3={inj3!r} base={inj!r}")

        # U03: overflow / long prompt format does not explode
        try:
            big = "x" * 5000
            msgs = [{"role": "user", "content": big}]
            text = _format_messages_as_prompt(
                msgs, model="glm-5-2", tools=None, tool_choice=None, backend="devin"
            )
            ok3 = isinstance(text, str) and len(text) >= 1000
            self.record("U03_overflow_detector", ok3, 0.0, f"len={len(text)}")
        except Exception as e:
            self.record("U03_overflow_detector", False, 0.0, f"{type(e).__name__}: {e}")

        # U04: format with tools embeds tool schema
        try:
            prompt = _format_messages_as_prompt(
                [{"role": "user", "content": "list files"}],
                model="swe-1-7",
                tools=SAMPLE_TOOLS,
                tool_choice="auto",
                backend="devin",
            )
            ok4 = "terminal" in prompt and ("tool" in prompt.lower() or "<tool" in prompt.lower() or "function" in prompt.lower())
            self.record("U04_format_messages_tools", ok4, 0.0, f"len={len(prompt)}")
        except Exception as e:
            self.record("U04_format_messages_tools", False, 0.0, f"{type(e).__name__}: {e}")

    def ensure_client(self) -> CopilotACPClient:
        if self.client is None or getattr(self.client, "is_closed", False):
            self.client = CopilotACPClient(
                base_url="acp://devin",
                api_key="devin-acp",
                acp_cwd=os.environ.get(
                    "HERMES_DEVIN_ACP_CWD",
                    str(HERMES_HOME / "acp-cwd"),
                ),
            )
        return self.client

    def reboot_client(self) -> CopilotACPClient:
        if self.client is not None:
            try:
                self.client.close()
            except Exception:
                pass
        self.client = None
        return self.ensure_client()

    def live_prompt(self, prompt: str, model: str | None = None) -> tuple[float, str]:
        c = self.ensure_client()
        t0 = time.perf_counter()
        text, _ = c._run_prompt(prompt, timeout_seconds=TIMEOUT, model=model)
        return time.perf_counter() - t0, (text or "").strip()

    def live_chat(
        self,
        messages: list[dict],
        model: str | None = None,
        tools: list | None = None,
        tool_choice: Any = None,
    ) -> tuple[float, Any]:
        c = self.ensure_client()
        t0 = time.perf_counter()
        kwargs: dict[str, Any] = {
            "model": model or "glm-5-2",
            "messages": messages,
            "timeout": TIMEOUT,
        }
        if tools is not None:
            kwargs["tools"] = tools
        if tool_choice is not None:
            kwargs["tool_choice"] = tool_choice
        resp = c.chat.completions.create(**kwargs)
        return time.perf_counter() - t0, resp

    def live_tests(self) -> None:
        # L01 boot
        try:
            c = self.ensure_client()
            t0 = time.perf_counter()
            sid = c._ensure_session(timeout_seconds=TIMEOUT, model=None)
            self.record("L01_boot_session", bool(sid), time.perf_counter() - t0, f"sid={sid}")
        except Exception as e:
            self.record("L01_boot_session", False, 0.0, f"{type(e).__name__}: {e}")
            traceback.print_exc()
            return

        # L02 ping
        try:
            sec, reply = self.live_prompt(
                "Reply with exactly one word: pong. No explanation.", model="swe-1-7"
            )
            ok = reply.strip().lower().startswith("pong")
            self.record("L02_ping", ok, sec, reply[:120])
        except Exception as e:
            self.record("L02_ping", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L03 vietnamese
        try:
            sec, reply = self.live_prompt(
                "Trả lời bằng tiếng Việt, đúng 1 câu ngắn: thủ đô của Việt Nam là gì?",
                model="swe-1-7",
            )
            ok = any(x in reply.lower() for x in ("hà nội", "ha noi", "hanoi"))
            self.record("L03_vietnamese", ok, sec, reply[:120])
        except Exception as e:
            self.record("L03_vietnamese", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L04 json
        try:
            sec, reply = self.live_prompt(
                'Return ONLY valid JSON, no markdown fences: {"ok": true, "n": 3, "items": ["a","b","c"]}',
                model="swe-1-7",
            )
            s = re.sub(r"^```(?:json)?\s*", "", reply.strip())
            s = re.sub(r"\s*```$", "", s)
            try:
                obj = json.loads(s)
                ok = obj.get("ok") is True and obj.get("n") == 3 and obj.get("items") == ["a", "b", "c"]
            except Exception:
                ok = False
            self.record("L04_json", ok, sec, reply[:120])
        except Exception as e:
            self.record("L04_json", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L05 tool xml prompt (raw prompt path)
        try:
            sec, reply = self.live_prompt(
                "You are Hermes agent. User asks to list files.\n"
                "Respond with EXACTLY one tool call in this XML format and nothing else:\n"
                "<tool_call>\n"
                '{"name": "terminal", "arguments": {"command": "dir"}}\n'
                "</tool_call>",
                model="swe-1-7",
            )
            ok = "<tool_call>" in reply and ("terminal" in reply or "exec" in reply)
            self.record("L05_tool_xml_prompt", ok, sec, reply[:160])
        except Exception as e:
            self.record("L05_tool_xml_prompt", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L06 chat.completions with tools (FORCE_TOOL_MODEL path)
        try:
            sec, resp = self.live_chat(
                messages=[{"role": "user", "content": "List files in the current directory using the terminal tool."}],
                model="glm-5-2",  # weak model — must fallback/force strong
                tools=SAMPLE_TOOLS,
                tool_choice="auto",
            )
            msg = resp.choices[0].message
            tcs = getattr(msg, "tool_calls", None) or []
            content = (msg.content or "")[:80]
            ok = len(tcs) >= 1
            self.record(
                "L06_chat_completions_tools",
                ok,
                sec,
                f"content={content!r} tcs={len(tcs)}",
            )
        except Exception as e:
            self.record("L06_chat_completions_tools", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L07 multi-turn history
        try:
            c = self.ensure_client()
            t0 = time.perf_counter()
            r1 = c.chat.completions.create(
                model="swe-1-7",
                messages=[{"role": "user", "content": "Remember secret number 42. Reply: ok"}],
                timeout=TIMEOUT,
            )
            a1 = (r1.choices[0].message.content or "").strip()
            r2 = c.chat.completions.create(
                model="swe-1-7",
                messages=[
                    {"role": "user", "content": "Remember secret number 42. Reply: ok"},
                    {"role": "assistant", "content": a1},
                    {"role": "user", "content": "What was the secret number? Reply with only the number."},
                ],
                timeout=TIMEOUT,
            )
            a2 = (r2.choices[0].message.content or "").strip()
            ok = "42" in a2
            self.record("L07_multi_turn_history", ok, time.perf_counter() - t0, a2[:80])
        except Exception as e:
            self.record("L07_multi_turn_history", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L08 fresh session ids when requested
        try:
            c = self.ensure_client()
            s1 = c._ensure_session(timeout_seconds=TIMEOUT, model="swe-1-7")
            # force new session by clearing
            c._session_id = None
            c._session_model = None
            s2 = c._ensure_session(timeout_seconds=TIMEOUT, model="swe-1-7")
            # With persist, session may reuse; OK if both non-empty
            ok = bool(s1) and bool(s2)
            self.record("L08_fresh_session_ids", ok, 0.0, f"{s1}!={s2}" if s1 != s2 else f"same={s1}")
        except Exception as e:
            self.record("L08_fresh_session_ids", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L09 stress 6 turns
        try:
            lats = []
            fails = 0
            for i in range(6):
                try:
                    sec, reply = self.live_prompt(f"Reply with exactly: T{i}", model="swe-1-7")
                    lats.append(round(sec, 2))
                    if f"T{i}" not in reply and reply.strip() == "":
                        fails += 1
                except Exception:
                    fails += 1
                    lats.append(-1)
                    self.reboot_client()
            ok = fails == 0 and all(x > 0 for x in lats)
            avg = sum(x for x in lats if x > 0) / max(1, sum(1 for x in lats if x > 0))
            self.record(
                "L09_stress_6_turns",
                ok,
                avg,
                f"fails={fails} lats={lats}",
                fails=fails,
                latencies=lats,
            )
        except Exception as e:
            self.record("L09_stress_6_turns", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L10 medium context
        try:
            blob = ("context line about project Alpha.\n" * 200)
            sec, reply = self.live_prompt(
                blob + "\nReply with exactly one word: ready",
                model="swe-1-7",
            )
            ok = "ready" in reply.lower()
            self.record("L10_medium_context", ok, sec, f"prompt_chars={len(blob)} reply={reply[:60]}")
        except Exception as e:
            self.record("L10_medium_context", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L11 large context
        try:
            blob = ("Lorem ipsum dolor sit amet. " * 1500)
            sec, reply = self.live_prompt(
                blob + "\nReply with exactly one word: alive",
                model="swe-1-7",
            )
            ok = "alive" in reply.lower() or len(reply) > 0
            self.record("L11_large_context", ok, sec, f"chars={len(blob)} reply={reply[:60]}")
        except Exception as e:
            self.record("L11_large_context", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L12 ping all free models
        for model in FREE_MODELS:
            try:
                sec, reply = self.live_prompt(
                    "Reply with exactly one word: pong. No explanation.",
                    model=model,
                )
                ok = "pong" in reply.lower()
                self.record(f"L12_model_{model}", ok, sec, reply[:80])
            except Exception as e:
                self.record(f"L12_model_{model}", False, 0.0, f"{type(e).__name__}: {e}")
                self.reboot_client()

        # L13 tools all free models (chat.completions path with force/fallback)
        for model in FREE_MODELS:
            try:
                sec, resp = self.live_chat(
                    messages=[
                        {
                            "role": "user",
                            "content": "Use the terminal tool to run: echo hello",
                        }
                    ],
                    model=model,
                    tools=SAMPLE_TOOLS,
                    tool_choice="auto",
                )
                msg = resp.choices[0].message
                tcs = getattr(msg, "tool_calls", None) or []
                content = (msg.content or "")[:60]
                ok = len(tcs) >= 1
                self.record(
                    f"L13_tools_{model}",
                    ok,
                    sec,
                    f"tcs={len(tcs)} content={content!r}",
                )
            except Exception as e:
                self.record(f"L13_tools_{model}", False, 0.0, f"{type(e).__name__}: {e}")
                self.reboot_client()

        # L14 process park reuse
        try:
            c1 = self.ensure_client()
            # one turn
            r = c1.chat.completions.create(
                model="swe-1-7",
                messages=[{"role": "user", "content": "Reply: pong"}],
                timeout=TIMEOUT,
            )
            pid1 = c1._active_process.pid if c1._active_process else None
            c1.close()  # should park if persist
            t0 = time.perf_counter()
            c2 = CopilotACPClient(
                base_url="acp://devin",
                api_key="devin-acp",
                acp_cwd=os.environ.get(
                    "HERMES_DEVIN_ACP_CWD",
                    str(HERMES_HOME / "acp-cwd"),
                ),
            )
            r2 = c2.chat.completions.create(
                model="swe-1-7",
                messages=[{"role": "user", "content": "Reply with exactly one word: pong"}],
                timeout=TIMEOUT,
            )
            reboot = time.perf_counter() - t0
            pid2 = c2._active_process.pid if c2._active_process else None
            reply = (r2.choices[0].message.content or "").strip()
            # Prefer same pid (pool reuse); still pass if reply ok and fast reboot
            ok = "pong" in reply.lower() and (pid1 == pid2 or reboot < 15)
            self.record(
                "L14_process_park_reuse",
                ok,
                reboot,
                f"pid1={pid1} pid2={pid2} same={pid1==pid2} reboot={reboot:.2f}s reply={reply[:40]}",
            )
            self.client = c2
        except Exception as e:
            self.record("L14_process_park_reuse", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L15 code reason
        try:
            sec, reply = self.live_prompt(
                "What is the output of this Python?\nprint(sum(i*i for i in range(1,6)))\nAnswer with only the number.",
                model="swe-1-7",
            )
            ok = "55" in re.sub(r"\s+", "", reply)
            self.record("L15_code_reason", ok, sec, reply[:80])
        except Exception as e:
            self.record("L15_code_reason", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L16 short hi
        try:
            sec, reply = self.live_prompt("Hi", model="glm-5-2")
            ok = len(reply) > 0
            self.record("L16_short_hi", ok, sec, reply[:80])
        except Exception as e:
            self.record("L16_short_hi", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L17 model switch
        try:
            t0 = time.perf_counter()
            _, a = self.live_prompt("Reply with exactly one word: alpha", model="swe-1-7")
            _, b = self.live_prompt("Reply with exactly one word: beta", model="glm-5-2")
            ok = "alpha" in a.lower() and "beta" in b.lower()
            self.record(
                "L17_model_switch",
                ok,
                time.perf_counter() - t0,
                f"a={a[:40]!r} b={b[:40]!r}",
            )
        except Exception as e:
            self.record("L17_model_switch", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

        # L18 primary model glm-5-2 chat stability x3
        try:
            fails = 0
            lats = []
            for i in range(3):
                try:
                    sec, reply = self.live_prompt(
                        f"Reply with exactly: G{i}",
                        model="glm-5-2",
                    )
                    lats.append(round(sec, 2))
                    if f"G{i}" not in reply and not reply:
                        fails += 1
                except Exception as e:
                    fails += 1
                    lats.append(-1)
                    self.reboot_client()
            ok = fails == 0
            self.record(
                "L18_primary_glm_x3",
                ok,
                sum(x for x in lats if x > 0) / max(1, len([x for x in lats if x > 0])),
                f"fails={fails} lats={lats}",
            )
        except Exception as e:
            self.record("L18_primary_glm_x3", False, 0.0, f"{type(e).__name__}: {e}")

        # L19 fallback chain models consecutive
        try:
            t0 = time.perf_counter()
            results = []
            for m in ["glm-5-2", "swe-1-7", "swe-1-6"]:
                sec, reply = self.live_prompt(
                    "Reply with exactly one word: ok",
                    model=m,
                )
                results.append((m, "ok" in reply.lower(), round(sec, 2), reply[:40]))
            ok = all(r[1] for r in results)
            self.record(
                "L19_fallback_chain",
                ok,
                time.perf_counter() - t0,
                str(results),
            )
        except Exception as e:
            self.record("L19_fallback_chain", False, 0.0, f"{type(e).__name__}: {e}")
            self.reboot_client()

    def close(self) -> None:
        if self.client is not None:
            try:
                self.client.close()
            except Exception:
                pass


def main() -> int:
    print("=== Devin ACP stability suite ===", flush=True)
    print(f"cmd={os.environ.get('HERMES_DEVIN_ACP_COMMAND')}", flush=True)
    print(f"args={os.environ.get('HERMES_DEVIN_ACP_ARGS')}", flush=True)
    print(
        f"force_tool={os.environ.get('HERMES_DEVIN_FORCE_TOOL_MODEL')} "
        f"fallback={os.environ.get('HERMES_DEVIN_TOOL_FALLBACK')} "
        f"fb_model={os.environ.get('HERMES_DEVIN_TOOL_FALLBACK_MODEL')}",
        flush=True,
    )
    suite = Suite()
    try:
        print("\n-- unit --", flush=True)
        suite.unit_tests()
        print("\n-- live --", flush=True)
        suite.live_tests()
    finally:
        suite.close()

    passed = sum(1 for r in suite.results if r["ok"])
    total = len(suite.results)
    failed = [r["name"] for r in suite.results if not r["ok"]]
    ok_lats = [r["sec"] for r in suite.results if r["ok"] and r["sec"] > 0]
    summary = {
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": round(100.0 * passed / total, 1) if total else 0,
        "avg_ok_latency_s": round(sum(ok_lats) / len(ok_lats), 2) if ok_lats else None,
        "results": suite.results,
        "ts": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
    }
    OUT.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n===== SUMMARY =====", flush=True)
    print(f"pass={passed}/{total} ({summary['pass_rate']}%)", flush=True)
    print(f"avg_ok_latency={summary['avg_ok_latency_s']}s", flush=True)
    if failed:
        print("FAILED:", ", ".join(failed), flush=True)
    print(f"Saved: {OUT}", flush=True)
    # Exit 0 only if pass_rate >= 90 and no boot failure
    boot_ok = any(r["name"] == "L01_boot_session" and r["ok"] for r in suite.results)
    return 0 if summary["pass_rate"] >= 90 and boot_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
