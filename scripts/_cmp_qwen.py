#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

HOST = "36.50.26.247"
REMOTE = r'''
import json, sqlite3
from pathlib import Path

def redact(d):
    if not isinstance(d, dict):
        return d
    out = {}
    for k, v in d.items():
        kl = k.lower()
        sensitive = any(x in kl for x in ["token", "apikey", "secret", "password", "cookie"]) or k in ("key",)
        if sensitive and isinstance(v, str) and v and k not in ("prefix", "apiType", "baseUrl", "nodeName", "defaultModel", "testStatus", "provider"):
            out[k] = v[:12] + "...len" + str(len(v))
        elif isinstance(v, dict):
            out[k] = redact(v)
        else:
            out[k] = v
    return out

print("=== 9router providers ===")
conn = sqlite3.connect("/root/.9router/db/data.sqlite")
cur = conn.cursor()
for row in cur.execute("SELECT id, provider, authType, name, isActive, data FROM providerConnections"):
    d = json.loads(row[5]) if isinstance(row[5], str) else (row[5] or {})
    print(json.dumps({
        "id": row[0], "provider": row[1], "authType": row[2], "name": row[3],
        "isActive": row[4], "data": redact(d)
    }, ensure_ascii=False, indent=2))
print("=== 9router combos ===")
for row in cur.execute("SELECT name, models FROM combos"):
    print(row[0], json.loads(row[1]) if isinstance(row[1], str) else row[1])
conn.close()

print("=== xlabrouter live ===")
d = json.loads(Path("/var/lib/xlabrouter/db.json").read_text(encoding="utf-8"))
for p in d.get("providerConnections") or []:
    print(json.dumps(redact(p), ensure_ascii=False, indent=2))
print("combos", [(c.get("name"), c.get("models")) for c in d.get("combos") or []])
ps = (d.get("settings") or {}).get("providerStrategies") or {}
print("ps.qwencoder", ps.get("qwencoder"))
print("ps.openai-compat-qwen", ps.get("openai-compatible-chat-1b2d65d3-4506-42b6-9e91-cf2ab38adb00"))
'''


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


def main() -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=password(), timeout=25)
    sftp = c.open_sftp()
    with sftp.file("/tmp/cmp_qwen.py", "w") as f:
        f.write(REMOTE)
    sftp.close()
    _, so, se = c.exec_command("python3 /tmp/cmp_qwen.py", timeout=60)
    sys.stdout.write(so.read().decode("utf-8", "replace"))
    err = se.read().decode("utf-8", "replace")
    if err.strip():
        sys.stderr.write(err)
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
