#!/usr/bin/env python3
"""Seed first-class QwenCoder provider connection on live 9router SQLite (VPS).

Keeps existing openai-compatible Qwencoder node working, and adds/updates a
native provider=qwencoder connection for catalog parity after RouterLab deploy.
"""
from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone

import paramiko

HOST = "36.50.26.247"
PASSWORD_ENV = "VPS_SSH_PASSWORD"

REMOTE = r'''
import json, sqlite3, shutil, uuid
from datetime import datetime, timezone
DB="/root/.9router/db/data.sqlite"
shutil.copy2(DB, f"{DB}.bak-seed-qwencoder-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
conn=sqlite3.connect(DB)
cur=conn.cursor()
now=datetime.now(timezone.utc).isoformat().replace("+00:00","Z")

# Read existing qwen openai-compatible connection for api key reuse
rows=list(cur.execute("SELECT id, provider, name, isActive, data FROM providerConnections"))
api_key=None
for rid, provider, name, active, data in rows:
    try:
        d=json.loads(data) if isinstance(data,str) else (data or {})
    except Exception:
        d={}
    blob=json.dumps(d).lower()
    if "qwencoder" in blob or "api.qwencoder" in (d.get("providerSpecificData") or {}).get("baseUrl","").lower() or str(name).lower()=="qwen":
        api_key=d.get("apiKey") or (d.get("providerSpecificData") or {}).get("apiKey")
        print("reuse_key_from", name, provider, bool(api_key))
        # ensure active
        cur.execute("UPDATE providerConnections SET isActive=1 WHERE id=?", (rid,))

if not api_key:
    print("NO_API_KEY_FOUND")
else:
    # Check if native qwencoder connection exists
    existing=cur.execute("SELECT id, data FROM providerConnections WHERE provider='qwencoder'").fetchone()
    payload={
        "apiKey": api_key,
        "testStatus": "active",
        "defaultModel": "gpt-5.6-sol",
        "providerSpecificData": {
            "baseUrl": "https://api.qwencoder.cloud/api/v1",
            "prefix": "qwencoder",
            "apiType": "chat",
        },
    }
    if existing:
        cur.execute(
            "UPDATE providerConnections SET isActive=1, name=?, data=?, updatedAt=? WHERE id=?",
            ("QwenCoder", json.dumps(payload, ensure_ascii=False), now, existing[0]),
        )
        print("UPDATED native qwencoder", existing[0])
    else:
        nid=str(uuid.uuid4())
        cur.execute(
            "INSERT INTO providerConnections (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (nid, "qwencoder", "apikey", "QwenCoder", None, 1, 1, json.dumps(payload, ensure_ascii=False), now, now),
        )
        print("INSERTED native qwencoder", nid)

# Settings: sticky strategy for qwencoder
raw=cur.execute("SELECT data FROM settings WHERE id=1").fetchone()[0]
settings=json.loads(raw)
ps=settings.get("providerStrategies") if isinstance(settings.get("providerStrategies"), dict) else {}
ps["qwencoder"]={
    "strategy": "sticky-round-robin",
    "fallbackStrategy": "fallback",
    "stickyRoundRobinLimit": 8,
    "preferHealthy": True,
}
settings["providerStrategies"]=ps
settings["comboStrategy"]=settings.get("comboStrategy") or "fallback"
cur.execute("UPDATE settings SET data=? WHERE id=1", (json.dumps(settings, ensure_ascii=False),))
conn.commit()
conn.close()
print("OK")
'''


def main() -> int:
    import os
    import re
    from pathlib import Path

    pw = os.environ.get(PASSWORD_ENV) or os.environ.get("VPS_PASSWORD")
    if not pw:
        readme = Path(r"C:\Dev\VPS\README.md")
        if readme.exists():
            text = readme.read_text(encoding="utf-8", errors="replace")
            m = re.search(r"a7xe\$[^\s`]+", text)
            if m:
                pw = m.group(0)
    if not pw:
        print("Set VPS_SSH_PASSWORD", file=sys.stderr)
        return 2

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=pw, timeout=25)
    sftp = c.open_sftp()
    with sftp.file("/tmp/seed_qwencoder.py", "w") as f:
        f.write(REMOTE)
    sftp.close()
    _, so, se = c.exec_command("python3 /tmp/seed_qwencoder.py", timeout=60)
    print(so.read().decode())
    err = se.read().decode()
    if err.strip():
        print(err, file=sys.stderr)
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
