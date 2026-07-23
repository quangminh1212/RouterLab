"""OpenAI-compatible shim that forwards Hermes requests to `copilot --acp`.

This adapter lets Hermes treat the GitHub Copilot ACP server as a chat-style
backend. Each request starts a short-lived ACP session, sends the formatted
conversation as a single prompt, collects text chunks, and converts the result
back into the minimal shape Hermes expects from an OpenAI client.
"""

from __future__ import annotations

import json
import os
import queue
import re
import shlex
import subprocess
import threading
import time
from collections import deque
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from openai.types.chat.chat_completion_message_tool_call import (
    ChatCompletionMessageToolCall,
    Function,
)

from agent.file_safety import get_read_block_error, get_write_denied_error
from agent.redact import redact_sensitive_text
from tools.environments.local import hermes_subprocess_env
from hermes_cli._subprocess_compat import windows_hide_flags

ACP_MARKER_BASE_URL = "acp://copilot"
_DEFAULT_TIMEOUT_SECONDS = 900.0

# Park live ACP subprocesses across short-lived client instances so Windows
# does not flash a console on every Hermes turn (per-request clients close
# immediately after chat.completions). Keyed by (cmd, args, cwd).
_ACP_PROC_POOL_LOCK = threading.RLock()
_ACP_PROC_POOL: dict[tuple[str, tuple[str, ...], str], dict[str, Any]] = {}


def _acp_pool_key(command: str, args: list[str], cwd: str) -> tuple[str, tuple[str, ...], str]:
    return (command, tuple(args), cwd)


def _acp_pool_take(key: tuple[str, tuple[str, ...], str]) -> dict[str, Any] | None:
    with _ACP_PROC_POOL_LOCK:
        slot = _ACP_PROC_POOL.pop(key, None)
    if not slot:
        return None
    proc = slot.get("proc")
    if proc is None or proc.poll() is not None:
        try:
            if proc is not None:
                proc.kill()
        except Exception:
            pass
        return None
    return slot


def _acp_pool_put(key: tuple[str, tuple[str, ...], str], slot: dict[str, Any]) -> None:
    proc = slot.get("proc")
    if proc is None or proc.poll() is not None:
        return
    with _ACP_PROC_POOL_LOCK:
        old = _ACP_PROC_POOL.pop(key, None)
        _ACP_PROC_POOL[key] = slot
    if old and old.get("proc") is not None and old["proc"] is not proc:
        try:
            old["proc"].kill()
        except Exception:
            pass


_TOOL_CALL_BLOCK_RE = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)
_TOOL_CALL_JSON_RE = re.compile(r"\{\s*\"id\"\s*:\s*\"[^\"]+\"\s*,\s*\"type\"\s*:\s*\"function\"\s*,\s*\"function\"\s*:\s*\{.*?\}\s*\}", re.DOTALL)

# Stderr fingerprint of the deprecated `gh copilot` CLI extension
# (https://github.blog/changelog/2025-09-25-upcoming-deprecation-of-gh-copilot-cli-extension).
# We require BOTH the literal product name ("gh-copilot") AND a deprecation
# marker, so generic stderr from the NEW `@github/copilot` CLI ΓÇö whose repo
# is github.com/github/copilot-cli and which legitimately mentions "copilot-cli"
# in its own banners and error messages ΓÇö doesn't get misclassified as the
# deprecated extension.
_DEPRECATION_REQUIRED = ("gh-copilot",)
_DEPRECATION_MARKERS = (
    "has been deprecated",
    "no commands will be executed",
)


def _is_gh_copilot_deprecation_message(stderr_text: str) -> bool:
    """True iff stderr looks like the deprecated gh-copilot extension's banner."""

    lower = stderr_text.lower()
    if not any(req in lower for req in _DEPRECATION_REQUIRED):
        return False
    return any(marker in lower for marker in _DEPRECATION_MARKERS)


def _resolve_command() -> str:
    return (
        os.getenv("HERMES_COPILOT_ACP_COMMAND", "").strip()
        or os.getenv("COPILOT_CLI_PATH", "").strip()
        or "copilot"
    )


def _resolve_args() -> list[str]:
    raw = os.getenv("HERMES_COPILOT_ACP_ARGS", "").strip()
    if not raw:
        return ["--acp", "--stdio"]
    return shlex.split(raw)


def _is_devin_acp_base_url(base_url: str | None) -> bool:
    marker = str(base_url or "").strip().lower()
    return marker.startswith("acp://devin")


# Devin ACP `session/set_config_option` rejects CLI family aliases (opus/sonnet/ΓÇª).
# Map short names ΓåÆ family base; effort applied via Hermes OPTIONS (reasoning_effort).
_DEVIN_MODEL_ALIASES = {
    "opus": "claude-opus-4-8",
    "sonnet": "claude-sonnet-5",
    "claude": "claude-sonnet-5",
    "swe": "swe-1-7-lightning",
    "codex": "gpt-5-3-codex",
    "gpt": "gpt-5-6-terra",
    "gemini": "gemini-3-5-flash",
    # Hermes free: base swe-1-6 often thinks but emits no <tool_call>; fast variant does.
    "swe-1-6": "swe-1-6-fast",
}

# Models that chat fine via Devin ACP but often fail Hermes <tool_call> text when tools
# are present (empty agent_message). Empty tool turns retry on HERMES_DEVIN_TOOL_FALLBACK_MODEL.
_DEVIN_TOOL_WEAK_MODELS = frozenset({
    "glm-5-2",
    "glm-5-2-none",
    "glm-5-2-max",
    "glm-5-2-1m",
    "glm-5-2-max-1m",
    "glm-5-2-none-1m",
    "swe-1-6",
    "swe-1-6-fast",  # usually OK; still allow emptyΓåÆfallback once
})

# Free models proven to emit Hermes tool_calls reliably via Devin ACP (stability suite).
# Max first ΓÇö 100% free quality bench; medium is backup for rate-limit/failover.
_DEVIN_TOOL_STRONG_MODELS = (
    "swe-1-7",
    "swe-1-7-medium",
)

_DEVIN_EFFORT_SUFFIX_RE = re.compile(
    r"-(none|minimal|low|medium|high|xhigh|max)(-priority|-fast)?$",
    re.IGNORECASE,
)

# Hermes OPTIONS Effort ΓåÆ preferred Devin model_uid suffixes (in order).
_DEVIN_EFFORT_TO_SUFFIXES: dict[str, tuple[str, ...]] = {
    "none": ("none", "minimal", "low", "medium"),
    "minimal": ("none", "minimal", "low", "medium"),
    "low": ("low", "medium", "none"),
    "medium": ("medium", "high", "low"),
    "high": ("high", "xhigh", "medium", "max"),
    "xhigh": ("xhigh", "max", "high"),
    "max": ("max", "xhigh", "high"),
    "ultra": ("max", "xhigh", "high"),
}


def _hermes_reasoning_effort() -> str:
    """Read Hermes agent.reasoning_effort (OPTIONS panel / config)."""
    for key in ("HERMES_REASONING_EFFORT", "REASONING_EFFORT"):
        val = os.getenv(key, "").strip().lower()
        if val:
            return val
    try:
        from hermes_cli.config import load_config_readonly

        cfg = load_config_readonly() or {}
        agent = cfg.get("agent") if isinstance(cfg, dict) else {}
        if isinstance(agent, dict):
            return str(agent.get("reasoning_effort") or "").strip().lower()
    except Exception:
        pass
    return ""


_DEVIN_LIVE_UIDS_CACHE: set[str] | None = None
_DEVIN_LIVE_UIDS_TS: float = 0.0
_DEVIN_LIVE_UIDS_TTL = 300.0  # 5 min ΓÇö avoid `devin models list` every turn


def _devin_live_uids() -> set[str] | None:
    """Best-effort live model_uid set from `devin models list --format json`."""
    global _DEVIN_LIVE_UIDS_CACHE, _DEVIN_LIVE_UIDS_TS
    now = time.monotonic()
    if _DEVIN_LIVE_UIDS_CACHE is not None and (now - _DEVIN_LIVE_UIDS_TS) < _DEVIN_LIVE_UIDS_TTL:
        return _DEVIN_LIVE_UIDS_CACHE

    import json
    import shutil
    import subprocess

    command = (
        os.getenv("HERMES_DEVIN_ACP_COMMAND", "").strip()
        or os.getenv("DEVIN_CLI_PATH", "").strip()
        or "devin"
    )
    resolved = shutil.which(command) if command else None
    if not resolved and command and (os.path.isfile(command) or os.path.isfile(command + ".exe")):
        resolved = command if os.path.isfile(command) else command + ".exe"
    if not resolved:
        return _DEVIN_LIVE_UIDS_CACHE
    try:
        from hermes_cli._subprocess_compat import windows_hide_flags

        run_kwargs: dict[str, Any] = {
            "capture_output": True,
            "text": True,
            "timeout": 12.0,
            "check": False,
        }
        hide = windows_hide_flags()
        if hide:
            run_kwargs["creationflags"] = hide
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0
            run_kwargs["startupinfo"] = si
        proc = subprocess.run([resolved, "models", "list", "--format", "json"], **run_kwargs)
    except Exception:
        return _DEVIN_LIVE_UIDS_CACHE
    if proc.returncode != 0 or not (proc.stdout or "").strip():
        return _DEVIN_LIVE_UIDS_CACHE
    try:
        data = json.loads(proc.stdout)
    except Exception:
        return _DEVIN_LIVE_UIDS_CACHE
    uids: set[str] = set()
    for fam in data.get("families") or []:
        if not isinstance(fam, dict):
            continue
        for variant in fam.get("variants") or []:
            if not isinstance(variant, dict):
                continue
            uid = str(variant.get("model_uid") or "").strip()
            if uid:
                uids.add(uid)
    if uids:
        _DEVIN_LIVE_UIDS_CACHE = uids
        _DEVIN_LIVE_UIDS_TS = now
    return _DEVIN_LIVE_UIDS_CACHE


def _apply_devin_effort(base_or_uid: str, effort: str, live: set[str] | None) -> str:
    """Map family base + Hermes effort ΓåÆ concrete Devin model_uid."""
    raw = str(base_or_uid or "").strip()
    if not raw:
        return raw
    effort = (effort or "").strip().lower()
    base = _DEVIN_EFFORT_SUFFIX_RE.sub("", raw)

    # Free SWE: only medium vs max (no low/high ladder).
    if base == "swe-1-7" or raw in {"swe-1-7", "swe-1-7-medium"}:
        if effort in {"none", "minimal", "low", "medium"}:
            cand = "swe-1-7-medium"
        else:
            cand = "swe-1-7"  # Max free
        if live is None or cand in live:
            return cand
        return "swe-1-7" if "swe-1-7" in (live or {raw}) else raw

    # Single-variant / free singles ΓÇö keep as-is
    singles = {
        "swe-1-6",
        "swe-1-6-fast",
        "swe-1-7-lightning",
        "adaptive",
        "kimi-k2-7",
        "kimi-k2-6",
        "deepseek-v4",
        "nemotron-3-ultra-nvfp4",
        "MODEL_PRIVATE_11",
        "glm-5-2",  # free High; other glm tiers are paid
    }
    if base in singles or raw in singles:
        if live is None or raw in live or base in (live or set()):
            return raw if (live is None or raw in live) else base
        return raw

    if not effort or effort in {"default", "auto", ""}:
        suffixes = ("medium", "high", "low", "none")
    else:
        suffixes = _DEVIN_EFFORT_TO_SUFFIXES.get(effort, ("medium", "high"))

    if live is None:
        return f"{base}-{suffixes[0]}"

    for suf in suffixes:
        cand = f"{base}-{suf}"
        if cand in live:
            return cand
    # Fallbacks: any live variant for base, then original
    for uid in sorted(live):
        if uid == base or uid.startswith(base + "-"):
            return uid
    if raw in live:
        return raw
    if base in live:
        return base
    return f"{base}-{suffixes[0]}"


def _resolve_devin_model_id(model: str | None) -> str | None:
    """Resolve picker base/alias + Hermes Effort ΓåÆ Devin ACP model_uid."""
    raw = str(model or "").strip()
    if not raw:
        return None
    mapped = _DEVIN_MODEL_ALIASES.get(raw.lower(), raw)
    effort = _hermes_reasoning_effort()
    live = None
    try:
        live = _devin_live_uids()
    except Exception:
        live = None

    # Concrete free product UIDs ΓÇö never rewrite via effort ladder.
    # (Previously reasoning_effort=low remapped swe-1-7 Max ΓåÆ swe-1-7-medium,
    # collapsing the strong tool chain and hurting tool-XML reliability.)
    _FREE_CONCRETE = frozenset({
        "swe-1-7",
        "swe-1-7-medium",
        "swe-1-6",
        "swe-1-6-fast",
        "glm-5-2",
        "swe-1-7-lightning",
    })
    if mapped in _FREE_CONCRETE:
        if live is None or mapped in live or not live:
            return mapped

    # Exact live UID (paid or free): honor the pick as-is.
    if live and mapped in live:
        return mapped

    # Family base / alias (e.g. sonnet, claude-sonnet-5) ΓåÆ apply effort ladder.
    return _apply_devin_effort(mapped, effort, live)


def _devin_tool_fallback_model() -> str:
    """Free model used when a weak chat model fails to emit Hermes tool calls."""
    return (
        os.getenv("HERMES_DEVIN_TOOL_FALLBACK_MODEL", "").strip()
        or "swe-1-7"
    )


def _devin_tool_strong_chain() -> list[str]:
    """Ordered free models for tool turns (primary then fallbacks).

    Prefer Max free first (tool XML reliable), then Medium. Do not resolve
    through effort remapping ΓÇö these IDs are concrete products.
    """
    primary = _devin_tool_fallback_model()
    chain: list[str] = []
    for mid in (primary, "swe-1-7", "swe-1-7-medium"):
        mid = str(mid or "").strip()
        if mid and mid not in chain:
            chain.append(mid)
    return chain


def _devin_is_tool_strong_model(model: str | None) -> bool:
    resolved = _resolve_devin_model_id(model) or str(model or "").strip()
    if not resolved:
        return False
    base = _DEVIN_EFFORT_SUFFIX_RE.sub("", resolved)
    strong = set(_DEVIN_TOOL_STRONG_MODELS)
    return resolved in strong or base in {"swe-1-7"} or resolved.startswith("swe-1-7")


def _devin_is_tool_weak_model(model: str | None) -> bool:
    """True if the user-picked model is known to fail Hermes tool text emission."""
    raw = str(model or "").strip()
    if not raw:
        return False
    raw_base = _DEVIN_EFFORT_SUFFIX_RE.sub("", raw)
    if raw in _DEVIN_TOOL_WEAK_MODELS or raw_base in _DEVIN_TOOL_WEAK_MODELS:
        return True
    # After aliases (e.g. swe-1-6 ΓåÆ swe-1-6-fast) still treat family as soft-weak for retry.
    resolved = _resolve_devin_model_id(model) or raw
    res_base = _DEVIN_EFFORT_SUFFIX_RE.sub("", resolved)
    return resolved in _DEVIN_TOOL_WEAK_MODELS or res_base in _DEVIN_TOOL_WEAK_MODELS


def _devin_needs_tools(
    tools: list[dict[str, Any]] | None,
    tool_choice: Any,
) -> bool:
    if tools:
        return True
    if tool_choice == "required":
        return True
    if isinstance(tool_choice, dict) and tool_choice.get("type") == "function":
        return True
    return False


# Patterns that mean the model refused / simulated tools instead of emitting Hermes XML.
_DEVIN_TOOL_FAIL_MARKERS = (
    "ask mode",
    "read-only",
    "i don't have a tool",
    "i do not have a tool",
    "don't have a \"terminal\"",
    "don't have a tool named",
    "no tool named",
    "my available tool",
    "cannot run shell",
    "can't run shell",
    "i'm currently in **ask mode**",
    "i am currently in ask mode",
    "permission",
    "would you like me to",
    "here are the files",
    "here's a listing",
    "directory listing",
)


def _devin_tool_response_looks_failed(text: str) -> bool:
    """True if reply is prose/refusal instead of a Hermes <tool_call> emission."""
    t = (text or "").strip().lower()
    if not t:
        return True
    if "<tool_call>" in t or '"name"' in t:
        return False
    return any(m in t for m in _DEVIN_TOOL_FAIL_MARKERS)


def _devin_tool_repair_prompt(
    *,
    tools: list[dict[str, Any]] | None,
    last_user: str,
) -> str:
    """Ultra-strict one-shot repair: emit only flat Hermes tool XML."""
    names: list[str] = []
    first = "terminal"
    if isinstance(tools, list):
        for t in tools:
            if not isinstance(t, dict):
                continue
            fn = t.get("function") or {}
            if isinstance(fn, dict) and isinstance(fn.get("name"), str):
                n = fn["name"].strip()
                if n:
                    names.append(n)
        if names:
            first = names[0]
    name_list = ", ".join(names) if names else first
    user_snip = (last_user or "").strip()
    if len(user_snip) > 500:
        user_snip = user_snip[:500] + "ΓÇª"
    example = {"name": first, "arguments": {"command": "dir"} if first in {"terminal", "exec"} else {}}
    return (
        "CRITICAL REPAIR: Your previous reply did NOT include a valid Hermes tool call.\n"
        "Hermes owns tools. Output ONLY one block, no prose, no markdown:\n"
        f"<tool_call>\n{json.dumps(example, ensure_ascii=False)}\n</tool_call>\n"
        f"Allowed tool names: {name_list}\n"
        f"User request:\n{user_snip}\n"
        "Emit the tool_call now."
    )


def _devin_last_user_text(messages: list[dict[str, Any]] | None) -> str:
    if not messages:
        return ""
    for msg in reversed(messages):
        if not isinstance(msg, dict):
            continue
        if str(msg.get("role") or "").lower() != "user":
            continue
        return _render_message_content(msg.get("content"))
    return ""


def _resolve_command_for_base_url(base_url: str | None) -> str:
    if _is_devin_acp_base_url(base_url):
        return (
            os.getenv("HERMES_DEVIN_ACP_COMMAND", "").strip()
            or os.getenv("DEVIN_CLI_PATH", "").strip()
            or "devin"
        )
    return _resolve_command()


def _resolve_args_for_base_url(base_url: str | None) -> list[str]:
    """Resolve ACP argv; Windows .env paths must not go through posix shlex."""
    if _is_devin_acp_base_url(base_url):
        raw = os.getenv("HERMES_DEVIN_ACP_ARGS", "").strip()
        if not raw:
            return ["acp"]
        if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
            return [raw[1:-1]]
        # Single Windows path token (shim .py / .exe) ΓÇö keep whole string.
        if os.name == "nt" and " " not in raw and (":" in raw or raw.endswith((".py", ".exe", ".cmd", ".bat"))):
            return [raw]
        return shlex.split(raw, posix=False) if os.name == "nt" else shlex.split(raw)
    raw = os.getenv("HERMES_COPILOT_ACP_ARGS", "").strip()
    if not raw:
        return ["--acp", "--stdio"]
    return shlex.split(raw, posix=False) if os.name == "nt" else shlex.split(raw)


def _inject_devin_agent_type(args: list[str]) -> list[str]:
    """Attach --agent-type after the acp subcommand when HERMES_DEVIN_ACP_AGENT is set."""
    agent_type = os.getenv("HERMES_DEVIN_ACP_AGENT", "").strip()
    if not agent_type or agent_type.lower() in {"", "default", "none", "full", "agent"}:
        return list(args)
    out = list(args)
    if "--agent-type" in out:
        return out
    if "acp" in out:
        i = out.index("acp")
        out[i + 1 : i + 1] = ["--agent-type", agent_type]
    else:
        out.extend(["--agent-type", agent_type])
    return out


def _env_flag(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() not in {"0", "false", "no", "off", ""}


def _is_acp_context_overflow_error(exc: BaseException) -> bool:
    """True when Devin/backend rejected the prompt for size / invalid large payload."""
    msg = str(exc).lower()
    needles = (
        "prompt to the model was too long",
        "prompt is too long",
        "prompt too long",
        "input is too long",
        "context length",
        "context window",
        "invalid_argument",
        "maximum context",
        "token limit",
    )
    return any(n in msg for n in needles)

def _resolve_home_dir() -> str:
    """Return a stable HOME for child ACP processes."""
    home = os.environ.get("HOME", "").strip()
    if home:
        return home

    expanded = os.path.expanduser("~")
    if expanded and expanded != "~":
        return expanded

    try:
        import pwd

        resolved = pwd.getpwuid(os.getuid()).pw_dir.strip()  # windows-footgun: ok ΓÇö POSIX fallback inside try/except (pwd import fails on Windows)
        if resolved:
            return resolved
    except Exception:
        pass

    # Last resort: /tmp (writable on any POSIX system). Avoids crashing the
    # subprocess with no HOME; callers can set HERMES_HOME explicitly if they
    # need a different writable dir.
    return "/tmp"


def _build_subprocess_env() -> dict[str, str]:
    # Copilot ACP is a model-driving CLI executor: it legitimately needs LLM
    # provider credentials. Route through the central helper so Tier-1 secrets
    # (gateway bot tokens, GitHub auth, infra) are still stripped (#29157).
    env = hermes_subprocess_env(inherit_credentials=True)
    home = _resolve_home_dir()
    env["HOME"] = home
    from hermes_constants import apply_subprocess_home_env
    apply_subprocess_home_env(env)
    # Force UTF-8 I/O for ACP child processes. On Windows desktop backends the
    # process preferred encoding is often cp1252; without this, Devin/Copilot
    # UTF-8 JSON-RPC payloads get decoded as mojibake (Ch├áo ΓåÆ Ch├â o).
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env.setdefault("LANG", "en_US.UTF-8")
    env.setdefault("LC_ALL", "en_US.UTF-8")
    env.setdefault("LC_CTYPE", "en_US.UTF-8")
    return env


def _fix_utf8_mojibake(text: str) -> str:
    """Repair text that was UTF-8 bytes decoded as cp1252/latin-1.

    Classic symptom: "Ch├áo" becomes "Ch├â o" / "Ch├â┬áo". Safe no-op when the
    string is already valid Vietnamese/Unicode that isn't mojibake.
    """
    if not text or not isinstance(text, str):
        return text
    # Fast reject: no common mojibake markers.
    if not any(ch in text for ch in ("├â", "├é", "├à", "├ä", "├å", "├ç", "├ë", "├É", "├æ", "├ÿ", "├¥", "├₧", "├ƒ", "├í┬╗", "├äΓÇÿ", "├óΓé¼Γäó", "├óΓé¼")):
        return text
    for enc in ("cp1252", "latin-1"):
        try:
            repaired = text.encode(enc, errors="strict").decode("utf-8", errors="strict")
        except Exception:
            continue
        # Only accept if repair reduces mojibake markers or introduces VN letters.
        bad_before = sum(text.count(m) for m in ("├â", "├é", "├à", "├í┬╗", "├â┬í", "├â┬⌐", "├â┬¡", "├â┬│", "├â┬║", "├â "))
        bad_after = sum(repaired.count(m) for m in ("├â", "├é", "├à", "├í┬╗", "├â┬í", "├â┬⌐", "├â┬¡", "├â┬│", "├â┬║", "├â "))
        vn_after = sum(repaired.count(m) for m in ("─â", "├ó", "├¬", "├┤", "╞í", "╞░", "─æ", "├í", "├á", "ß║ú", "├ú", "ß║í", "├⌐", "├¿", "ß║╗", "ß║╜", "ß║╣", "├¡", "├¼", "ß╗ë", "─⌐", "ß╗ï", "├│", "├▓", "ß╗Å", "├╡", "ß╗ì", "├║", "├╣", "ß╗º", "┼⌐", "ß╗Ñ", "├╜", "ß╗│", "ß╗╖", "ß╗╣", "ß╗╡", "─é", "├é", "├è", "├ö", "╞á", "╞»", "─É"))
        if bad_after < bad_before or (bad_after == 0 and vn_after > 0):
            return repaired
    return text


def _jsonrpc_error(message_id: Any, code: int, message: str) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": message_id,
        "error": {
            "code": code,
            "message": message,
        },
    }


def _permission_denied(message_id: Any) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": message_id,
        "result": {
            "outcome": {
                "outcome": "cancelled",
            }
        },
    }


def _format_messages_as_prompt(
    messages: list[dict[str, Any]],
    model: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: Any = None,
    *,
    backend: str = "copilot",
) -> str:
    if backend == "devin":
        sections: list[str] = [
            "You are the LLM brain inside Hermes Agent (via Devin CLI ACP).",
            "Hermes owns tools, filesystem, terminal, and approvals.",
            "Do NOT use Devin-native tools, Devin shell, or Devin file edits.",
            "When Hermes tools are listed below, those tools ARE available ΓÇö call them by emitting "
            "text <tool_call> blocks (Hermes will execute them). Never claim a listed Hermes tool is unavailable.",
            "If no Hermes tool is needed, answer the user directly and concisely.",
        ]
    else:
        sections = [
            "You are being used as the active ACP agent backend for Hermes.",
            "Use ACP capabilities to complete tasks.",
            "IMPORTANT: If you take an action with a tool, you MUST output tool calls using <tool_call>{...}</tool_call> blocks with JSON exactly in OpenAI function-call shape.",
            "If no tool is needed, answer normally.",
        ]
    if model:
        # Model is also applied via session/set_config_option when supported;
        # keep a short hint for backends that only honor prompt text.
        sections.append(f"Active model: {model}")

    if isinstance(tools, list) and tools:
        tool_specs: list[dict[str, Any]] = []
        for t in tools:
            if not isinstance(t, dict):
                continue
            fn = t.get("function") or {}
            if not isinstance(fn, dict):
                continue
            name = fn.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            tool_specs.append(
                {
                    "name": name.strip(),
                    "description": fn.get("description", ""),
                    "parameters": fn.get("parameters", {}),
                }
            )
        if tool_specs:
            # Prefer flat Hermes shape ΓÇö weaker free models (glm / swe-1-6) follow it better
            # than nested OpenAI function form. Extractor accepts both.
            flat_example = {
                "name": tool_specs[0]["name"],
                "arguments": {},
            }
            openai_example = {
                "id": "call_1",
                "type": "function",
                "function": {
                    "name": tool_specs[0]["name"],
                    "arguments": "{}",
                },
            }
            sections.append(
                "Hermes tools ΓÇö AVAILABLE this turn (Hermes will execute; you only emit text).\n"
                "To call a tool, reply with ONLY one or more blocks. Preferred flat shape:\n"
                f"<tool_call>\n{json.dumps(flat_example, ensure_ascii=False)}\n</tool_call>\n"
                "Also accepted (OpenAI nested):\n"
                f"<tool_call>\n{json.dumps(openai_example, ensure_ascii=False)}\n</tool_call>\n"
                "Rules:\n"
                "- Prefer flat {\"name\",\"arguments\"} where arguments is a JSON object.\n"
                "- Do NOT use Devin tools (exec/Read/Write). Only names from the list below.\n"
                "- Do not wrap the block in markdown fences.\n"
                "- Do not narrate; emit the block(s) then stop.\n"
                f"Tool list JSON:\n{json.dumps(tool_specs, ensure_ascii=False)}"
            )

    if tool_choice is not None:
        choice_txt = json.dumps(tool_choice, ensure_ascii=False)
        sections.append(f"Tool choice requirement: {choice_txt}")
        if tool_choice == "required" or (
            isinstance(tool_choice, dict) and tool_choice.get("type") == "function"
        ):
            sections.append(
                "You MUST emit at least one <tool_call> block before any final answer."
            )

    transcript: list[str] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "unknown").strip().lower()
        if role == "tool":
            role = "tool"
        elif role not in {"system", "user", "assistant"}:
            role = "context"

        content = message.get("content")
        rendered = _render_message_content(content)
        if not rendered:
            continue

        label = {
            "system": "System",
            "user": "User",
            "assistant": "Assistant",
            "tool": "Tool",
            "context": "Context",
        }.get(role, role.title())
        transcript.append(f"{label}:\n{rendered}")

    if transcript:
        sections.append("Conversation transcript:\n\n" + "\n\n".join(transcript))

    sections.append("Continue the conversation from the latest user request.")
    return "\n\n".join(section.strip() for section in sections if section and section.strip())

def _render_message_content(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, dict):
        if "text" in content:
            return str(content.get("text") or "").strip()
        if "content" in content and isinstance(content.get("content"), str):
            return str(content.get("content") or "").strip()
        return json.dumps(content, ensure_ascii=True)
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        return "\n".join(parts).strip()
    return str(content).strip()


def _build_openai_tool_call(
    *,
    call_id: str,
    name: str,
    arguments: str,
) -> ChatCompletionMessageToolCall:
    """Build an OpenAI-compatible tool-call object for downstream handling."""
    return ChatCompletionMessageToolCall(
        id=call_id,
        call_id=call_id,
        response_item_id=None,
        type="function",
        function=Function(name=name, arguments=arguments),
    )


def _completion_to_stream_chunks(completion: SimpleNamespace) -> list[SimpleNamespace]:
    """Convert a one-shot ACP response into OpenAI-style stream chunks."""
    choice = completion.choices[0]
    message = choice.message
    tool_call_deltas = None
    if message.tool_calls:
        tool_call_deltas = []
        for index, tool_call in enumerate(message.tool_calls):
            tool_call_deltas.append(
                SimpleNamespace(
                    index=index,
                    id=getattr(tool_call, "id", None),
                    type=getattr(tool_call, "type", "function"),
                    function=SimpleNamespace(
                        name=getattr(tool_call.function, "name", None),
                        arguments=getattr(tool_call.function, "arguments", None),
                    ),
                )
            )

    delta = SimpleNamespace(
        role="assistant",
        content=message.content or None,
        tool_calls=tool_call_deltas,
        reasoning_content=message.reasoning_content,
        reasoning=message.reasoning,
    )
    data_chunk = SimpleNamespace(
        choices=[
            SimpleNamespace(
                index=0,
                delta=delta,
                finish_reason=choice.finish_reason,
            )
        ],
        model=completion.model,
        usage=None,
    )
    usage_chunk = SimpleNamespace(
        choices=[],
        model=completion.model,
        usage=completion.usage,
    )
    return [data_chunk, usage_chunk]


def _extract_tool_calls_from_text(text: str) -> tuple[list[ChatCompletionMessageToolCall], str]:
    if not isinstance(text, str) or not text.strip():
        return [], ""

    extracted: list[ChatCompletionMessageToolCall] = []
    consumed_spans: list[tuple[int, int]] = []

    def _try_add_tool_call(raw_json: str) -> None:
        try:
            obj = json.loads(raw_json)
        except Exception:
            return
        if not isinstance(obj, dict):
            return
        # OpenAI nested: {"id","type","function":{"name","arguments"}}
        fn = obj.get("function")
        fn_name: Any = None
        fn_args: Any = "{}"
        if isinstance(fn, dict):
            fn_name = fn.get("name")
            fn_args = fn.get("arguments", "{}")
        # Hermes flat: {"name","arguments"} (common with weaker free models)
        elif isinstance(obj.get("name"), str):
            fn_name = obj.get("name")
            fn_args = obj.get("arguments", "{}")
        else:
            return
        if not isinstance(fn_name, str) or not fn_name.strip():
            return
        if not isinstance(fn_args, str):
            fn_args = json.dumps(fn_args, ensure_ascii=False)
        call_id = obj.get("id")
        if not isinstance(call_id, str) or not call_id.strip():
            call_id = f"acp_call_{len(extracted)+1}"

        extracted.append(
            _build_openai_tool_call(
                call_id=call_id,
                name=fn_name.strip(),
                arguments=fn_args,
            )
        )

    for m in _TOOL_CALL_BLOCK_RE.finditer(text):
        raw = m.group(1)
        _try_add_tool_call(raw)
        consumed_spans.append((m.start(), m.end()))

    # Only try bare-JSON fallback when no XML blocks were found.
    if not extracted:
        for m in _TOOL_CALL_JSON_RE.finditer(text):
            raw = m.group(0)
            _try_add_tool_call(raw)
            consumed_spans.append((m.start(), m.end()))

    # Weaker free models sometimes emit flat Hermes JSON without <tool_call> tags:
    # {"name":"terminal","arguments":{...}}
    if not extracted:
        stripped = text.strip()
        # strip optional markdown fences
        if stripped.startswith("```"):
            stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
            stripped = re.sub(r"\s*```$", "", stripped).strip()
        try:
            obj = json.loads(stripped)
        except Exception:
            obj = None
        if isinstance(obj, dict) and isinstance(obj.get("name"), str):
            before = len(extracted)
            _try_add_tool_call(json.dumps(obj, ensure_ascii=False))
            if len(extracted) > before:
                consumed_spans.append((0, len(text)))
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, dict) and isinstance(item.get("name"), str):
                    before = len(extracted)
                    _try_add_tool_call(json.dumps(item, ensure_ascii=False))
                    if len(extracted) > before:
                        consumed_spans.append((0, len(text)))

    if not consumed_spans:
        return extracted, text.strip()

    consumed_spans.sort()
    merged: list[tuple[int, int]] = []
    for start, end in consumed_spans:
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
        else:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))

    parts: list[str] = []
    cursor = 0
    for start, end in merged:
        if cursor < start:
            parts.append(text[cursor:start])
        cursor = max(cursor, end)
    if cursor < len(text):
        parts.append(text[cursor:])

    cleaned = "\n".join(p.strip() for p in parts if p and p.strip()).strip()
    return extracted, cleaned



def _ensure_path_within_cwd(path_text: str, cwd: str) -> Path:
    candidate = Path(path_text)
    if not candidate.is_absolute():
        raise PermissionError("ACP file-system paths must be absolute.")
    resolved = candidate.resolve()
    root = Path(cwd).resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise PermissionError(f"Path '{resolved}' is outside the session cwd '{root}'.") from exc
    return resolved


class _ACPChatCompletions:
    def __init__(self, client: "CopilotACPClient"):
        self._client = client

    def create(self, **kwargs: Any) -> Any:
        return self._client._create_chat_completion(**kwargs)


class _ACPChatNamespace:
    def __init__(self, client: "CopilotACPClient"):
        self.completions = _ACPChatCompletions(client)


class CopilotACPClient:
    """Minimal OpenAI-client-compatible facade for Copilot/Devin ACP.

    Fast path (especially Devin CLI): keep one ACP subprocess + session alive
    across chat.completions.create calls on the same client instance ΓÇö same
    idea as HTTP keepalive used by xAI/OpenRouter. Cold start pays process
    boot + session/new once; later turns only session/prompt.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        default_headers: dict[str, str] | None = None,
        acp_command: str | None = None,
        acp_args: list[str] | None = None,
        acp_cwd: str | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        **_: Any,
    ):
        self.api_key = api_key or "copilot-acp"
        self.base_url = base_url or ACP_MARKER_BASE_URL
        self._default_headers = dict(default_headers or {})
        self._acp_command = acp_command or command or _resolve_command_for_base_url(self.base_url)
        base_args = list(acp_args or args or _resolve_args_for_base_url(self.base_url))
        # Optional Devin ACP agent-type override (e.g. summarizer/review).
        # Default stays full agent so Hermes <tool_call> XML still works.
        # Set HERMES_DEVIN_ACP_AGENT=summarizer only for chat-only speed experiments.
        if _is_devin_acp_base_url(self.base_url):
            self._acp_args = _inject_devin_agent_type(base_args)
        else:
            self._acp_args = base_args
        # Optional neutral cwd so Devin does not load project .windsurf rules / huge trees.
        # Hermes already owns tools + context; Devin is brain-only.
        cwd_override = ""
        if _is_devin_acp_base_url(self.base_url):
            cwd_override = os.getenv("HERMES_DEVIN_ACP_CWD", "").strip()
        self._acp_cwd = str(Path(cwd_override or acp_cwd or os.getcwd()).resolve())
        self.chat = _ACPChatNamespace(self)
        self.is_closed = False
        self._active_process: subprocess.Popen[str] | None = None
        self._active_process_lock = threading.RLock()
        self._inbox: queue.Queue[dict[str, Any]] | None = None
        self._stderr_tail: deque[str] = deque(maxlen=40)
        self._next_id = 0
        self._session_id: str | None = None
        self._session_model: str | None = None
        self._session_mode: str | None = None
        self._initialized = False
        # Persist process across turns by default for Devin (big win). Copilot
        # keeps previous one-shot behaviour unless HERMES_ACP_PERSIST=1.
        default_persist = "1" if _is_devin_acp_base_url(self.base_url) else "0"
        self._persist = _env_flag("HERMES_ACP_PERSIST", default_persist)
        # Hermes already sends the full transcript each turn. Reusing one Devin
        # ACP session stacks history twice ΓåÆ prompt-too-long / invalid_argument.
        # Default: warm process, fresh session every prompt (Devin only).
        default_fresh = "1" if _is_devin_acp_base_url(self.base_url) else "0"
        self._fresh_session = _env_flag("HERMES_ACP_FRESH_SESSION", default_fresh)

    def close(self) -> None:
        proc: subprocess.Popen[str] | None
        park_slot: dict[str, Any] | None = None
        with self._active_process_lock:
            proc = self._active_process
            inbox = self._inbox
            if (
                self._persist
                and proc is not None
                and proc.poll() is None
                and inbox is not None
            ):
                # Fresh-session mode parks a warm process only ΓÇö never a fat session.
                park_session = None if self._fresh_session else self._session_id
                park_slot = {
                    "proc": proc,
                    "inbox": inbox,
                    "stderr_tail": self._stderr_tail,
                    "session_id": park_session,
                    "session_model": None if self._fresh_session else self._session_model,
                    "session_mode": None if self._fresh_session else self._session_mode,
                    "initialized": self._initialized,
                    "next_id": self._next_id,
                }
                proc = None  # owned by pool now
            self._active_process = None
            self._inbox = None
            self._session_id = None
            self._session_model = None
            self._session_mode = None
            self._initialized = False
            self._next_id = 0
        self.is_closed = True
        if park_slot is not None:
            key = _acp_pool_key(self._acp_command, self._acp_args, self._acp_cwd)
            _acp_pool_put(key, park_slot)
            return
        if proc is None:
            return
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def _create_chat_completion(
        self,
        *,
        model: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        timeout: float | None = None,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: Any = None,
        stream: bool = False,
        **_: Any,
    ) -> Any:
        is_devin = _is_devin_acp_base_url(self.base_url)
        needs_tools = is_devin and _devin_needs_tools(tools, tool_choice)
        force_strong = is_devin and needs_tools and _env_flag(
            "HERMES_DEVIN_FORCE_TOOL_MODEL", "1"
        )

        # Resolve aliases (e.g. swe-1-6 ΓåÆ swe-1-6-fast). Tool turns: pin strong free models
        # first so Hermes never depends on glm/swe-1-6 text-tool luck.
        resolved_pick = (
            _resolve_devin_model_id(model) if is_devin else model
        ) or model
        if force_strong and not _devin_is_tool_strong_model(resolved_pick):
            effective_model = _devin_tool_strong_chain()[0]
        else:
            effective_model = resolved_pick

        if timeout is None:
            _effective_timeout = _DEFAULT_TIMEOUT_SECONDS
        elif isinstance(timeout, (int, float)):
            _effective_timeout = float(timeout)
        else:
            _candidates = [
                getattr(timeout, attr, None)
                for attr in ("read", "write", "connect", "pool", "timeout")
            ]
            _numeric = [float(v) for v in _candidates if isinstance(v, (int, float))]
            _effective_timeout = max(_numeric) if _numeric else _DEFAULT_TIMEOUT_SECONDS

        # Build candidate chain for tool turns: primary (+ strong backups). Chat: single model.
        if needs_tools and _env_flag("HERMES_DEVIN_TOOL_FALLBACK", "1"):
            candidates: list[str] = []
            for mid in (effective_model, *_devin_tool_strong_chain()):
                if mid and mid not in candidates:
                    candidates.append(mid)
        else:
            candidates = [effective_model]

        response_text = ""
        reasoning_text = ""
        tool_calls: list[Any] = []
        cleaned_text = ""
        last_exc: BaseException | None = None
        last_user = _devin_last_user_text(messages) if needs_tools else ""
        for cand_i, cand in enumerate(candidates):
            try:
                prompt_text = _format_messages_as_prompt(
                    messages or [],
                    model=cand,
                    tools=tools,
                    tool_choice=tool_choice,
                    backend="devin" if is_devin else "copilot",
                )
                # Weak free models: tighten tool_choice to required so they stop narrating.
                effective_choice = tool_choice
                if (
                    needs_tools
                    and is_devin
                    and _devin_is_tool_weak_model(cand)
                    and tool_choice in (None, "auto")
                ):
                    effective_choice = "required"
                    prompt_text = _format_messages_as_prompt(
                        messages or [],
                        model=cand,
                        tools=tools,
                        tool_choice=effective_choice,
                        backend="devin",
                    )

                response_text, reasoning_text = self._run_prompt(
                    prompt_text,
                    timeout_seconds=_effective_timeout,
                    model=cand,
                )
                tool_calls, cleaned_text = _extract_tool_calls_from_text(response_text)
                effective_model = cand
                # Chat-only turns: accept first success.
                if not needs_tools:
                    break
                if tool_calls:
                    break

                # One-shot repair: same model, ultra-strict "emit only tool_call".
                if _env_flag("HERMES_DEVIN_TOOL_REPAIR", "1") and (
                    not (response_text or "").strip()
                    or _devin_tool_response_looks_failed(response_text)
                    or effective_choice == "required"
                    or (
                        isinstance(effective_choice, dict)
                        and effective_choice.get("type") == "function"
                    )
                    or _devin_is_tool_weak_model(cand)
                ):
                    repair = _devin_tool_repair_prompt(tools=tools, last_user=last_user)
                    response_text, reasoning_text = self._run_prompt(
                        repair,
                        timeout_seconds=min(_effective_timeout, 60.0),
                        model=cand,
                    )
                    tool_calls, cleaned_text = _extract_tool_calls_from_text(response_text)
                    if tool_calls:
                        break

                # Still no tool_call: never accept ask-mode / prose simulation as success
                # while stronger free candidates remain (smooth Hermes tool loop).
                has_more = cand_i < len(candidates) - 1
                if has_more and (
                    not (response_text or "").strip()
                    or _devin_tool_response_looks_failed(response_text)
                    or effective_choice == "required"
                    or (
                        isinstance(effective_choice, dict)
                        and effective_choice.get("type") == "function"
                    )
                    or force_strong
                    or _devin_is_tool_weak_model(cand)
                ):
                    continue
                # Last candidate or ambiguous final answer with tools listed (auto).
                break
            except Exception as exc:
                last_exc = exc
                # Rate-limit / transient: try next strong free model
                msg = str(exc).lower()
                if any(
                    x in msg
                    for x in (
                        "rate limit",
                        "too many",
                        "quota",
                        "timeout",
                        "temporarily",
                        "invalid_argument",
                        "too long",
                    )
                ) and cand != candidates[-1]:
                    continue
                if cand == candidates[-1]:
                    raise
                continue
        else:
            if last_exc is not None:
                raise last_exc

        usage = SimpleNamespace(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            prompt_tokens_details=SimpleNamespace(cached_tokens=0),
        )
        assistant_message = SimpleNamespace(
            content=cleaned_text,
            tool_calls=tool_calls,
            reasoning=reasoning_text or None,
            reasoning_content=reasoning_text or None,
            reasoning_details=None,
        )
        finish_reason = "tool_calls" if tool_calls else "stop"
        choice = SimpleNamespace(message=assistant_message, finish_reason=finish_reason)
        completion = SimpleNamespace(
            choices=[choice],
            usage=usage,
            model=effective_model or model or ("devin-acp" if is_devin else "copilot-acp"),
        )
        if stream:
            return _completion_to_stream_chunks(completion)
        return completion

    def _backend_label(self) -> str:
        return "Devin CLI ACP" if _is_devin_acp_base_url(self.base_url) else "Copilot ACP"

    def _ensure_process(self) -> subprocess.Popen[str]:
        is_devin = _is_devin_acp_base_url(self.base_url)
        label = self._backend_label()
        # Re-read command/args from env on every ensure so `.env` /reload
        # (and HERMES_DEVIN_ACP_COMMAND hidden shim) apply without Desktop restart.
        if is_devin:
            new_cmd = _resolve_command_for_base_url(self.base_url)
            new_args = _inject_devin_agent_type(_resolve_args_for_base_url(self.base_url))
            if (new_cmd, tuple(new_args)) != (self._acp_command, tuple(self._acp_args)):
                self._acp_command = new_cmd
                self._acp_args = list(new_args)
                proc_old = self._active_process
                self._active_process = None
                self._inbox = None
                self._session_id = None
                self._session_model = None
                self._session_mode = None
                self._initialized = False
                self._next_id = 0
                if proc_old is not None:
                    try:
                        proc_old.terminate()
                    except Exception:
                        pass
        with self._active_process_lock:
            proc = self._active_process
            if proc is not None and proc.poll() is None and self._inbox is not None:
                return proc
            self._session_id = None
            self._session_model = None
            self._session_mode = None
            self._initialized = False
            self._next_id = 0
            if proc is not None:
                try:
                    proc.kill()
                except Exception:
                    pass
            try:
                # Prefer a parked process from a previous short-lived client
                # (HERMES_ACP_PERSIST) so Windows does not flash cmd each turn.
                pool_key = _acp_pool_key(self._acp_command, self._acp_args, self._acp_cwd)
                parked = _acp_pool_take(pool_key) if self._persist else None
                if parked is not None:
                    self._active_process = parked["proc"]
                    self._inbox = parked["inbox"]
                    self._stderr_tail = parked.get("stderr_tail") or deque(maxlen=40)
                    self._session_id = parked.get("session_id")
                    self._session_model = parked.get("session_model")
                    self._session_mode = parked.get("session_mode")
                    self._initialized = bool(parked.get("initialized"))
                    self._next_id = int(parked.get("next_id") or 0)
                    self.is_closed = False
                    return self._active_process

                popen_kwargs: dict[str, Any] = {
                    "stdin": subprocess.PIPE,
                    "stdout": subprocess.PIPE,
                    "stderr": subprocess.PIPE,
                    "text": True,
                    "encoding": "utf-8",
                    "errors": "replace",
                    "bufsize": 1,
                    "cwd": self._acp_cwd,
                    "env": _build_subprocess_env(),
                }
                hide = windows_hide_flags()
                if hide:
                    # CREATE_NO_WINDOW ΓÇö stop intermittent cmd flash on Windows
                    # when spawning console-subsystem devin.exe / copilot.
                    popen_kwargs["creationflags"] = hide
                    # Belt-and-braces: also mark the startup window hidden.
                    si = subprocess.STARTUPINFO()
                    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    si.wShowWindow = 0  # SW_HIDE
                    popen_kwargs["startupinfo"] = si
                proc = subprocess.Popen(
                    [self._acp_command] + self._acp_args,
                    **popen_kwargs,
                )
            except FileNotFoundError as exc:
                if is_devin:
                    raise RuntimeError(
                        f"Could not start Devin CLI ACP command '{self._acp_command}'. "
                        "Install Devin CLI or set HERMES_DEVIN_ACP_COMMAND/DEVIN_CLI_PATH."
                    ) from exc
                raise RuntimeError(
                    f"Could not start Copilot ACP command '{self._acp_command}'. "
                    "Install GitHub Copilot CLI or set HERMES_COPILOT_ACP_COMMAND/COPILOT_CLI_PATH."
                ) from exc

            if proc.stdin is None or proc.stdout is None:
                proc.kill()
                raise RuntimeError(f"{label} process did not expose stdin/stdout pipes.")

            inbox: queue.Queue[dict[str, Any]] = queue.Queue()
            stderr_tail: deque[str] = deque(maxlen=40)
            self._stderr_tail = stderr_tail

            def _stdout_reader() -> None:
                if proc.stdout is None:
                    return
                for line in proc.stdout:
                    try:
                        inbox.put(json.loads(line))
                    except Exception:
                        inbox.put({"raw": line.rstrip("\n")})

            def _stderr_reader() -> None:
                if proc.stderr is None:
                    return
                for line in proc.stderr:
                    stderr_tail.append(line.rstrip("\n"))

            threading.Thread(target=_stdout_reader, daemon=True).start()
            threading.Thread(target=_stderr_reader, daemon=True).start()
            self._active_process = proc
            self._inbox = inbox
            self.is_closed = False
            return proc

    def _request(
        self,
        method: str,
        params: dict[str, Any],
        *,
        timeout_seconds: float,
        text_parts: list[str] | None = None,
        reasoning_parts: list[str] | None = None,
        soft_error: bool = False,
    ) -> Any:
        is_devin = _is_devin_acp_base_url(self.base_url)
        label = self._backend_label()
        with self._active_process_lock:
            proc = self._ensure_process()
            inbox = self._inbox
            if proc.stdin is None or inbox is None:
                raise RuntimeError(f"{label} process pipes unavailable.")
            self._next_id += 1
            request_id = self._next_id
            payload = {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params,
            }
            proc.stdin.write(json.dumps(payload) + "\n")
            proc.stdin.flush()

        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                break
            try:
                msg = inbox.get(timeout=0.1)
            except queue.Empty:
                continue

            if self._handle_server_message(
                msg,
                process=proc,
                cwd=self._acp_cwd,
                text_parts=text_parts,
                reasoning_parts=reasoning_parts,
            ):
                continue

            if msg.get("id") != request_id:
                continue
            if "error" in msg:
                err = msg.get("error") or {}
                if soft_error:
                    return {"__error__": err}
                raise RuntimeError(
                    f"{label} {method} failed: {err.get('message') or err}"
                )
            return msg.get("result")

        stderr_text = "\n".join(self._stderr_tail).strip()
        if proc.poll() is not None and stderr_text:
            if (not is_devin) and _is_gh_copilot_deprecation_message(stderr_text):
                raise RuntimeError(
                    "Hermes ACP mode requires the NEW GitHub Copilot CLI "
                    "(github.com/github/copilot-cli), but the binary it just "
                    "spawned is the deprecated `gh copilot` extension.\n\n"
                    "Install the new CLI:\n"
                    "  npm install -g @github/copilot\n"
                    "  # then verify with: copilot --help\n\n"
                    "If `copilot` already resolves to the new CLI but you still see this,\n"
                    "point Hermes at it explicitly:\n"
                    "  export HERMES_COPILOT_ACP_COMMAND=/path/to/new/copilot\n\n"
                    "Alternative: use the `copilot` provider (no ACP, hits the Copilot API\n"
                    "directly with a Copilot subscription token) via `hermes setup`.\n\n"
                    f"Original error:\n{stderr_text}"
                )
            self.close()
            self.is_closed = False
            raise RuntimeError(f"{label} process exited early: {stderr_text}")
        raise TimeoutError(f"Timed out waiting for {label} response to {method}.")

    def _ensure_session(self, *, timeout_seconds: float, model: str | None) -> str:
        is_devin = _is_devin_acp_base_url(self.base_url)
        label = self._backend_label()
        if not self._initialized:
            self._request(
                "initialize",
                {
                    "protocolVersion": 1,
                    "clientCapabilities": {
                        "fs": {
                            "readTextFile": True,
                            "writeTextFile": True,
                        }
                    },
                    "clientInfo": {
                        "name": "hermes-agent",
                        "title": "Hermes Agent",
                        "version": "0.0.0",
                    },
                },
                timeout_seconds=min(timeout_seconds, 60.0),
            )
            self._initialized = True

        if not self._session_id:
            session = self._request(
                "session/new",
                {
                    "cwd": self._acp_cwd,
                    "mcpServers": [],
                },
                timeout_seconds=timeout_seconds,
            ) or {}
            session_id = str(session.get("sessionId") or "").strip()
            if not session_id:
                raise RuntimeError(f"{label} did not return a sessionId.")
            self._session_id = session_id
            self._session_model = None
            self._session_mode = None

        session_id = self._session_id
        assert session_id

        if is_devin:
            desired_mode = (
                os.getenv("HERMES_DEVIN_ACP_MODE", "ask").strip() or "ask"
            )
            if (
                desired_mode.lower() not in {"", "default", "none", "keep"}
                and desired_mode != self._session_mode
            ):
                self._request(
                    "session/set_config_option",
                    {
                        "sessionId": session_id,
                        "configId": "mode",
                        "value": desired_mode,
                    },
                    timeout_seconds=min(timeout_seconds, 30.0),
                    soft_error=True,
                )
                self._session_mode = desired_mode
            resolved_model = _resolve_devin_model_id(model)
            if resolved_model and resolved_model != self._session_model:
                set_result = self._request(
                    "session/set_config_option",
                    {
                        "sessionId": session_id,
                        "configId": "model",
                        "value": resolved_model,
                    },
                    timeout_seconds=min(timeout_seconds, 30.0),
                    soft_error=True,
                )
                if not (isinstance(set_result, dict) and set_result.get("__error__")):
                    self._session_model = resolved_model
        return session_id

    def _drop_session(self) -> None:
        """Drop ACP session state while keeping a warm process (if any)."""
        self._session_id = None
        self._session_model = None
        self._session_mode = None

    def _run_prompt(
        self,
        prompt_text: str,
        *,
        timeout_seconds: float,
        model: str | None = None,
    ) -> tuple[str, str]:
        last_exc: BaseException | None = None
        try:
            # Attempt 0: normal path. Attempt 1: only after context-overflow errors.
            for attempt in range(2):
                try:
                    if self._fresh_session or attempt > 0:
                        self._drop_session()
                    session_id = self._ensure_session(
                        timeout_seconds=timeout_seconds, model=model
                    )
                    text_parts: list[str] = []
                    reasoning_parts: list[str] = []
                    self._request(
                        "session/prompt",
                        {
                            "sessionId": session_id,
                            "prompt": [
                                {
                                    "type": "text",
                                    "text": prompt_text,
                                }
                            ],
                        },
                        timeout_seconds=timeout_seconds,
                        text_parts=text_parts,
                        reasoning_parts=reasoning_parts,
                    )
                    return (
                        _fix_utf8_mojibake("".join(text_parts)),
                        _fix_utf8_mojibake("".join(reasoning_parts)),
                    )
                except Exception as exc:
                    last_exc = exc
                    if attempt == 0 and _is_acp_context_overflow_error(exc):
                        # New empty session; Hermes already embeds full transcript.
                        self._drop_session()
                        continue
                    try:
                        self.close()
                    except Exception:
                        pass
                    self.is_closed = False
                    raise
            assert last_exc is not None
            raise last_exc
        finally:
            if not self._persist:
                self.close()

    def _handle_server_message(
        self,
        msg: dict[str, Any],
        *,
        process: subprocess.Popen[str],
        cwd: str,
        text_parts: list[str] | None,
        reasoning_parts: list[str] | None,
    ) -> bool:
        method = msg.get("method")
        if not isinstance(method, str):
            return False

        if method == "session/update":
            params = msg.get("params") or {}
            update = params.get("update") or {}
            kind = str(update.get("sessionUpdate") or "").strip()
            content = update.get("content") or {}
            chunk_text = ""
            if isinstance(content, dict):
                chunk_text = str(content.get("text") or "")
            if kind == "agent_message_chunk" and chunk_text and text_parts is not None:
                text_parts.append(_fix_utf8_mojibake(chunk_text))
            elif kind == "agent_thought_chunk" and chunk_text and reasoning_parts is not None:
                reasoning_parts.append(_fix_utf8_mojibake(chunk_text))
            return True

        if process.stdin is None:
            return True

        message_id = msg.get("id")
        params = msg.get("params") or {}

        if method == "session/request_permission":
            response = _permission_denied(message_id)
        elif method == "fs/read_text_file":
            try:
                path = _ensure_path_within_cwd(str(params.get("path") or ""), cwd)
                block_error = get_read_block_error(str(path))
                if block_error:
                    raise PermissionError(block_error)
                try:
                    content = path.read_text()
                except FileNotFoundError:
                    content = ""
                line = params.get("line")
                limit = params.get("limit")
                if isinstance(line, int) and line > 1:
                    lines = content.splitlines(keepends=True)
                    start = line - 1
                    end = start + limit if isinstance(limit, int) and limit > 0 else None
                    content = "".join(lines[start:end])
                if content:
                    content = redact_sensitive_text(content, force=True)
                response = {
                    "jsonrpc": "2.0",
                    "id": message_id,
                    "result": {
                        "content": content,
                    },
                }
            except Exception as exc:
                response = _jsonrpc_error(message_id, -32602, str(exc))
        elif method == "fs/write_text_file":
            try:
                path = _ensure_path_within_cwd(str(params.get("path") or ""), cwd)
                denied = get_write_denied_error(str(path))
                if denied:
                    raise PermissionError(denied)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(str(params.get("content") or ""))
                response = {
                    "jsonrpc": "2.0",
                    "id": message_id,
                    "result": None,
                }
            except Exception as exc:
                response = _jsonrpc_error(message_id, -32602, str(exc))
        else:
            response = _jsonrpc_error(
                message_id,
                -32601,
                f"ACP client method '{method}' is not supported by Hermes yet.",
            )

        process.stdin.write(json.dumps(response) + "\n")
        process.stdin.flush()
        return True
