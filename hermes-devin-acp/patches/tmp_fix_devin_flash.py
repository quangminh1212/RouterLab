from pathlib import Path
import ast

ROOT = Path(r"C:/Users/GHC/AppData/Local/hermes/hermes-agent")

# --- 1) copilot_acp_client.py ---
p = ROOT / "agent/copilot_acp_client.py"
t = p.read_text(encoding="utf-8")

old_import = (
    "from tools.environments.local import hermes_subprocess_env\n"
    "\n"
    'ACP_MARKER_BASE_URL = "acp://copilot"\n'
)
new_import = (
    "from tools.environments.local import hermes_subprocess_env\n"
    "from hermes_cli._subprocess_compat import windows_hide_flags\n"
    "\n"
    'ACP_MARKER_BASE_URL = "acp://copilot"\n'
)
if old_import not in t:
    raise SystemExit("import block missing")
t = t.replace(old_import, new_import, 1)

marker = "_DEFAULT_TIMEOUT_SECONDS = 900.0\n"
pool_code = '''_DEFAULT_TIMEOUT_SECONDS = 900.0

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

'''
if marker not in t:
    raise SystemExit("timeout marker missing")
if "_ACP_PROC_POOL" not in t:
    t = t.replace(marker, pool_code, 1)

old_popen = '''            try:
                proc = subprocess.Popen(
                    [self._acp_command] + self._acp_args,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    cwd=self._acp_cwd,
                    env=_build_subprocess_env(),
                )
'''
new_popen = '''            try:
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
                    # CREATE_NO_WINDOW — stop intermittent cmd flash on Windows
                    # when spawning console-subsystem devin.exe / copilot.
                    popen_kwargs["creationflags"] = hide
                proc = subprocess.Popen(
                    [self._acp_command] + self._acp_args,
                    **popen_kwargs,
                )
'''
if old_popen not in t:
    raise SystemExit("popen block missing")
t = t.replace(old_popen, new_popen, 1)

old_close = '''    def close(self) -> None:
        proc: subprocess.Popen[str] | None
        with self._active_process_lock:
            proc = self._active_process
            self._active_process = None
            self._inbox = None
            self._session_id = None
            self._session_model = None
            self._session_mode = None
            self._initialized = False
            self._next_id = 0
        self.is_closed = True
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
'''
new_close = '''    def close(self) -> None:
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
                park_slot = {
                    "proc": proc,
                    "inbox": inbox,
                    "stderr_tail": self._stderr_tail,
                    "session_id": self._session_id,
                    "session_model": self._session_model,
                    "session_mode": self._session_mode,
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
'''
if old_close not in t:
    raise SystemExit("close block missing")
t = t.replace(old_close, new_close, 1)

p.write_text(t, encoding="utf-8")
ast.parse(t)
print("copilot_acp_client.py OK")

# --- 2) run_agent.py ---
p2 = ROOT / "run_agent.py"
t2 = p2.read_text(encoding="utf-8")
old_create = '''        primary_client = self._ensure_primary_openai_client(reason=reason)
        if self.provider == "moa":
            return primary_client
        if isinstance(primary_client, Mock):
            return primary_client
'''
new_create = '''        primary_client = self._ensure_primary_openai_client(reason=reason)
        if self.provider == "moa":
            return primary_client
        # Local ACP subprocess backends (Devin CLI / Copilot ACP): reuse the
        # shared primary client. A per-request client would spawn+kill
        # devin.exe every turn → intermittent Windows cmd flash + cold start.
        if self.provider in {"copilot-acp", "devin-acp"}:
            return primary_client
        if isinstance(primary_client, Mock):
            return primary_client
        try:
            from agent.copilot_acp_client import CopilotACPClient
            if isinstance(primary_client, CopilotACPClient):
                return primary_client
        except Exception:
            pass
'''
if old_create not in t2:
    raise SystemExit("create_request block missing")
t2 = t2.replace(old_create, new_create, 1)

old_close_req = '''    def _close_request_openai_client(self, client: Any, *, reason: str) -> None:
        self._close_openai_client(client, reason=reason, shared=False)
'''
new_close_req = '''    def _close_request_openai_client(self, client: Any, *, reason: str) -> None:
        # Never tear down the shared primary ACP client from the per-request path.
        primary = getattr(self, "client", None)
        if client is not None and primary is not None and client is primary:
            return
        self._close_openai_client(client, reason=reason, shared=False)
'''
if old_close_req not in t2:
    raise SystemExit("close_request block missing")
t2 = t2.replace(old_close_req, new_close_req, 1)
p2.write_text(t2, encoding="utf-8")
ast.parse(t2)
print("run_agent.py OK")

# --- 3) models.py ---
p3 = ROOT / "hermes_cli/models.py"
t3 = p3.read_text(encoding="utf-8")
old_run = '''    try:
        proc = subprocess.run(
            [resolved, "models", "list", "--format", "json"],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except Exception:
        return None
'''
new_run = '''    try:
        from hermes_cli._subprocess_compat import windows_hide_flags

        run_kwargs = {
            "capture_output": True,
            "text": True,
            "timeout": timeout,
            "check": False,
        }
        hide = windows_hide_flags()
        if hide:
            run_kwargs["creationflags"] = hide
        proc = subprocess.run(
            [resolved, "models", "list", "--format", "json"],
            **run_kwargs,
        )
    except Exception:
        return None
'''
if old_run not in t3:
    raise SystemExit("models run block missing")
t3 = t3.replace(old_run, new_run, 1)
p3.write_text(t3, encoding="utf-8")
ast.parse(t3)
print("models.py OK")
print("ALL PATCHED")
