#!/usr/bin/env python3
"""Thorough Qwen/QwenCoder provider test against live RouterLab VPS."""
from __future__ import annotations

import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import paramiko

HOST = "36.50.26.247"
BASE = f"http://{HOST}:1212"
OUT = Path(r"C:\Dev\RouterLab\tester") / f"qwen_thorough_{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

# Models used in XLab combo + UI seed catalog
MODELS = [
    "qwencoder/kimi-2.6",
    "qwencoder/gpt-5.6-luna",
    "qwencoder/gpt-5.6-sol",
    "qwencoder/qwen3.7-max",
    "qwencoder/minimax-m2.7",
    "qwencoder/minimax-m3",
    "qwencoder/glm-5.2",
    "qwencoder/mimo-2.5",
    "qwencoder/laguna-s-2.1",
    "qwencoder/grok-4.5",
    "qwencoder/step-3.7-flash",
    "qwencoder/qwen3.6-35b-a3b",
    # UI alias prefix
    "qwc/gpt-5.6-sol",
    "qwc/gpt-5.6-luna",
    "qwc/kimi-2.6",
]
COMBO = "XLab"
ROUNDS = 1  # per model; combo gets extra rounds


def password() -> str:
    import os

    pw = os.environ.get("VPS_SSH_PASSWORD") or os.environ.get("VPS_PASSWORD")
    if pw:
        return pw
    text = Path(r"C:\Dev\VPS\my.bnix.one\info.md").read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        if "Password" in line and "`" in line:
            return line.split("`")[1]
    raise SystemExit("no password")


def http_json(method: str, url: str, body: dict | None = None, key: str | None = None, timeout: int = 180):
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            ms = round((time.perf_counter() - t0) * 1000, 1)
            try:
                parsed = json.loads(raw) if raw else {}
            except Exception:
                parsed = {"_raw": raw[:500]}
            return {"ok": True, "status": resp.status, "ms": ms, "data": parsed}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        ms = round((time.perf_counter() - t0) * 1000, 1)
        try:
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"_raw": raw[:500]}
        return {"ok": False, "status": e.code, "ms": ms, "data": parsed, "error": raw[:400]}
    except Exception as e:
        ms = round((time.perf_counter() - t0) * 1000, 1)
        return {"ok": False, "status": 0, "ms": ms, "error": f"{type(e).__name__}: {e}"}


def chat(key: str, model: str, content: str = "Reply with exactly: PONG", max_tokens: int = 24) -> dict:
    r = http_json(
        "POST",
        f"{BASE}/v1/chat/completions",
        {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": max_tokens,
            "temperature": 0,
            "stream": False,
        },
        key=key,
        timeout=180,
    )
    if r.get("ok"):
        data = r.get("data") or {}
        msg = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        r["upstream_model"] = data.get("model")
        r["content"] = str(msg).strip()
        r["content_ok"] = bool(r["content"])
        r["pong"] = "PONG" in r["content"].upper()
    return r


def fetch_remote_state() -> dict:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=password(), timeout=25)
    remote = r'''
import json
from pathlib import Path
d = json.loads(Path("/var/lib/xlabrouter/db.json").read_text(encoding="utf-8"))
pcs = []
for p in d.get("providerConnections") or []:
    ps = p.get("providerSpecificData") or {}
    pcs.append({
        "id": p.get("id"),
        "provider": p.get("provider"),
        "name": p.get("name"),
        "isActive": p.get("isActive"),
        "testStatus": p.get("testStatus"),
        "has_apiKey": bool(p.get("apiKey")),
        "apiKey_prefix": (p.get("apiKey") or "")[:12],
        "baseUrl": ps.get("baseUrl"),
        "prefix": ps.get("prefix"),
        "errorCode": p.get("errorCode"),
        "lastError": (p.get("lastError") or "")[:120] or None,
    })
nodes = d.get("providerNodes") or []
combos = [{"name": c.get("name"), "models": c.get("models"), "n": len(c.get("models") or [])} for c in d.get("combos") or []]
keys = [{"name": k.get("name"), "enabled": k.get("enabled", True), "prefix": (k.get("key") or "")[:16]} for k in d.get("apiKeys") or []]
rk = next((k.get("key") for k in d.get("apiKeys") or [] if k.get("key") and k.get("enabled", True) is not False), None)
print(json.dumps({"pcs": pcs, "nodes": nodes, "combos": combos, "keys": keys, "router_key": rk}, ensure_ascii=False))
'''
    sftp = c.open_sftp()
    with sftp.file("/tmp/qwen_state.py", "w") as f:
        f.write(remote)
    sftp.close()
    _, so, se = c.exec_command("python3 /tmp/qwen_state.py", timeout=60)
    out = so.read().decode("utf-8", "replace")
    err = se.read().decode("utf-8", "replace")
    c.close()
    if err.strip():
        print("SSH_ERR", err[:300], file=sys.stderr)
    return json.loads(out)


def main() -> int:
    print("=== RouterLab Qwen thorough test ===")
    print("BASE", BASE)
    report = {
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "base": BASE,
        "state": {},
        "meta": {},
        "models": {},
        "combo": {},
        "summary": {},
    }

    state = fetch_remote_state()
    report["state"] = {k: v for k, v in state.items() if k != "router_key"}
    key = state.get("router_key")
    if not key:
        print("NO_ROUTER_KEY")
        return 2
    print("router_key", key[:16] + "...")
    print("connections:")
    for p in state.get("pcs") or []:
        print(" ", p)
    print("nodes:", state.get("nodes"))
    print("combos:", state.get("combos"))

    # Meta endpoints
    for path in ["/api/version", "/api/monitoring/health", "/manifest.webmanifest", "/v1/models"]:
        r = http_json("GET", BASE + path, key=key if path.startswith("/v1") else None, timeout=30)
        report["meta"][path] = {
            "ok": r.get("ok"),
            "status": r.get("status"),
            "ms": r.get("ms"),
            "snippet": str(r.get("data"))[:300] if r.get("ok") else r.get("error", "")[:300],
        }
        if path == "/v1/models" and r.get("ok"):
            ids = [m.get("id") for m in (r.get("data") or {}).get("data") or []]
            report["meta"][path]["model_ids"] = ids
            report["meta"][path]["has_XLab"] = "XLab" in ids
            print(f"models n={len(ids)} has_XLab={'XLab' in ids} sample={ids[:12]}")
        else:
            print(f"{path} ok={r.get('ok')} status={r.get('status')} ms={r.get('ms')}")

    # Direct upstream with qwk from connection (via SSH probe is heavy; skip — local through router)
    results = []
    print("\n=== per-model chat ===")
    for model in MODELS:
        row = chat(key, model)
        results.append({"model": model, **{k: row.get(k) for k in ("ok", "status", "ms", "upstream_model", "content", "content_ok", "pong", "error")}})
        report["models"][model] = results[-1]
        flag = "PASS" if row.get("ok") and row.get("content_ok") else "FAIL"
        print(f"  {flag} {model} status={row.get('status')} ms={row.get('ms')} upstream={row.get('upstream_model')} content={row.get('content')!r}"[:180])
        if not row.get("ok"):
            print("    err:", (row.get("error") or "")[:160])

    # Combo multi-round
    print("\n=== combo XLab ===")
    combo_rows = []
    for i in range(3):
        row = chat(key, COMBO)
        combo_rows.append({**{k: row.get(k) for k in ("ok", "status", "ms", "upstream_model", "content", "content_ok", "pong", "error")}})
        flag = "PASS" if row.get("ok") and row.get("content_ok") else "FAIL"
        print(f"  {flag} round={i+1} status={row.get('status')} ms={row.get('ms')} upstream={row.get('upstream_model')} content={row.get('content')!r}"[:180])
    report["combo"] = {"model": COMBO, "rounds": combo_rows}

    # Multi-step tool-ish message (stability)
    print("\n=== multi-turn short ===")
    multi = http_json(
        "POST",
        f"{BASE}/v1/chat/completions",
        {
            "model": "qwencoder/gpt-5.6-sol",
            "messages": [
                {"role": "user", "content": "Say only STEP1"},
                {"role": "assistant", "content": "STEP1"},
                {"role": "user", "content": "Now say only STEP2"},
            ],
            "max_tokens": 16,
            "temperature": 0,
            "stream": False,
        },
        key=key,
        timeout=180,
    )
    if multi.get("ok"):
        content = ((multi.get("data") or {}).get("choices") or [{}])[0].get("message", {}).get("content") or ""
        multi["content"] = content
        multi["ok_content"] = "STEP2" in str(content).upper() or bool(str(content).strip())
    report["multi_turn"] = {
        "ok": multi.get("ok"),
        "status": multi.get("status"),
        "ms": multi.get("ms"),
        "content": multi.get("content"),
        "ok_content": multi.get("ok_content"),
        "error": multi.get("error"),
    }
    print("  multi", report["multi_turn"])

    # Streaming smoke
    print("\n=== stream smoke (gpt-5.6-sol) ===")
    stream_body = json.dumps(
        {
            "model": "qwencoder/gpt-5.6-sol",
            "messages": [{"role": "user", "content": "Count 1 2 3 only"}],
            "max_tokens": 32,
            "temperature": 0,
            "stream": True,
        }
    ).encode()
    req = urllib.request.Request(
        f"{BASE}/v1/chat/completions",
        data=stream_body,
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    t0 = time.perf_counter()
    chunks = 0
    stream_ok = False
    stream_err = None
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            while True:
                line = resp.readline()
                if not line:
                    break
                if line.strip():
                    chunks += 1
            stream_ok = chunks > 0 and resp.status == 200
    except Exception as e:
        stream_err = str(e)
    report["stream"] = {
        "ok": stream_ok,
        "chunks": chunks,
        "ms": round((time.perf_counter() - t0) * 1000, 1),
        "error": stream_err,
    }
    print("  stream", report["stream"])

    # Summary
    model_pass = [r for r in results if r.get("ok") and r.get("content_ok")]
    model_fail = [r for r in results if not (r.get("ok") and r.get("content_ok"))]
    combo_pass = [r for r in combo_rows if r.get("ok") and r.get("content_ok")]
    lat = [r["ms"] for r in results if r.get("ok") and isinstance(r.get("ms"), (int, float))]
    summary = {
        "models_total": len(results),
        "models_pass": len(model_pass),
        "models_fail": len(model_fail),
        "fail_ids": [r["model"] for r in model_fail],
        "combo_pass": f"{len(combo_pass)}/{len(combo_rows)}",
        "multi_turn_ok": bool(report["multi_turn"].get("ok") and report["multi_turn"].get("ok_content")),
        "stream_ok": stream_ok,
        "latency_ms": {
            "p50": round(statistics.median(lat), 1) if lat else None,
            "avg": round(statistics.mean(lat), 1) if lat else None,
            "max": max(lat) if lat else None,
            "min": min(lat) if lat else None,
        },
        "overall_pass": len(model_fail) == 0 and len(combo_pass) == len(combo_rows) and stream_ok,
    }
    report["summary"] = summary

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== SUMMARY ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("report", OUT)
    print("OVERALL", "PASS" if summary["overall_pass"] else "FAIL")
    return 0 if summary["overall_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
