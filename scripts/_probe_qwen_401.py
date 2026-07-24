#!/usr/bin/env python3
"""Diagnose QwenCoder 401 on xlabrouter vs direct upstream vs 9router."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

import paramiko

HOST = "36.50.26.247"


def password() -> str:
    text = Path(r"C:\Dev\VPS\my.bnix.one\info.md").read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        if "Password" in line and "`" in line:
            return line.split("`")[1]
    raise SystemExit("no password")


def main() -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=password(), timeout=25)

    remote = r'''
import json, urllib.request, urllib.error
from pathlib import Path

d = json.loads(Path("/var/lib/xlabrouter/db.json").read_text(encoding="utf-8"))
qwk = None
base = None
for p in d.get("providerConnections") or []:
    if p.get("provider") == "qwencoder":
        qwk = p.get("apiKey")
        base = (p.get("providerSpecificData") or {}).get("baseUrl")
        print("native_qwencoder base", base, "key", (qwk or "")[:16], "len", len(qwk or ""))
    if str(p.get("provider") or "").startswith("openai-compatible") and p.get("name") == "qwen":
        print("openai_compat prefix", (p.get("providerSpecificData") or {}).get("prefix"),
              "base", (p.get("providerSpecificData") or {}).get("baseUrl"),
              "key", (p.get("apiKey") or "")[:16])

# local api key for router
rk = None
for k in d.get("apiKeys") or []:
    if k.get("key") and k.get("enabled", True) is not False:
        rk = k["key"]; break
print("router_key", (rk or "")[:16])

def post(url, key, model, timeout=90):
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "Reply with exactly: PONG"}],
        "max_tokens": 16,
        "temperature": 0,
        "stream": False,
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
            content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
            return f"OK {resp.status} model={data.get('model')} content={content!r}"[:200]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code} {e.read()[:300].decode('utf-8','replace')}"
    except Exception as e:
        return f"ERR {type(e).__name__}: {e}"

# Direct upstream with qwk key
if qwk:
    print("DIRECT", post("https://api.qwencoder.cloud/api/v1/chat/completions", qwk, "gpt-5.6-sol"))
    print("DIRECT_luna", post("https://api.qwencoder.cloud/api/v1/chat/completions", qwk, "gpt-5.6-luna"))

# Via xlabrouter with router key, various model ids
if rk:
    for m in [
        "XLab",
        "qwc/gpt-5.6-sol",
        "qwencoder/gpt-5.6-sol",
        "gpt-5.6-sol",
        "qwc/gpt-5.6-luna",
        "qwencoder/gpt-5.6-luna",
        "qwencoder/kimi-2.6",
    ]:
        print("XLAB", m, post("http://127.0.0.1:1212/v1/chat/completions", rk, m, timeout=120))

# Via 9router
if rk:
    for m in ["XLab", "qwencoder/gpt-5.6-sol", "qwencoder/gpt-5.6-luna", "qwc/gpt-5.6-sol"]:
        print("9R", m, post("http://127.0.0.1:20128/v1/chat/completions", rk, m, timeout=120))

# Check if package has qwencoder registry
import os
for root in ["/root/xlabrouter-pkg", "/usr/lib/node_modules/xlabrouter", "/usr/local/lib/node_modules/xlabrouter"]:
    p = os.path.join(root, "open-sse/config/providers/registry/qwencoder.js")
    print("has_registry", p, os.path.isfile(p))
    p2 = os.path.join(root, "package.json")
    if os.path.isfile(p2):
        print("pkg", root, json.load(open(p2)).get("version"))
'''
    sftp = c.open_sftp()
    with sftp.file("/tmp/probe_qwen_401.py", "w") as f:
        f.write(remote)
    sftp.close()
    _, so, se = c.exec_command("python3 /tmp/probe_qwen_401.py", timeout=300)
    print(so.read().decode("utf-8", "replace"))
    err = se.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err)
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
