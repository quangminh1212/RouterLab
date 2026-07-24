#!/usr/bin/env python3
"""Sync combos + providerConnections (+ apiKeys) from live 9router into xlabrouter.

Source of truth: /root/.9router/db/data.sqlite
Target (service DATA_DIR): /var/lib/xlabrouter/db.json

Also merges related combo/provider strategies from 9router settings.
Does not wipe unrelated xlabrouter keys (tunnel, usage, etc.).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

HOST = "36.50.26.247"
PASSWORD_ENV = "VPS_SSH_PASSWORD"

REMOTE = r'''
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SRC_DB = "/root/.9router/db/data.sqlite"
DST = Path("/var/lib/xlabrouter/db.json")
# Keep secondary path in sync if present (legacy symlink/alternate).
ALSO = [Path("/root/.xlabrouter/db.json")]

now = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {
            "providerConnections": [],
            "providerNodes": [],
            "proxyPools": [],
            "contextHandoffs": [],
            "modelAliases": {},
            "mitmAlias": {},
            "combos": [],
            "apiKeys": [],
            "settings": {},
            "pricing": {},
            "usageData": {"history": [], "totalRequestsLifetime": 0, "dailySummary": {}},
            "basicChatData": {},
        }
    return json.loads(path.read_text(encoding="utf-8"))


def flatten_provider(row) -> dict:
    """SQLite row -> xlabrouter flat providerConnections item."""
    (
        pid,
        provider,
        auth_type,
        name,
        email,
        priority,
        is_active,
        data_raw,
        created_at,
        updated_at,
    ) = row
    data = json.loads(data_raw) if isinstance(data_raw, str) else (data_raw or {})
    if not isinstance(data, dict):
        data = {}
    out = {
        "id": pid,
        "provider": provider,
        "authType": auth_type or "apikey",
        "name": name,
        "email": email,
        "priority": priority if priority is not None else 1,
        "isActive": bool(is_active),
        "createdAt": created_at,
        "updatedAt": updated_at,
    }
    # Flatten nested data fields onto the connection object.
    for k, v in data.items():
        if k in ("id", "provider"):
            continue
        out[k] = v
    return out


def upsert_by_id(existing: list, incoming: list, key: str = "id") -> tuple[list, dict]:
    by = {}
    order = []
    for item in existing or []:
        if not isinstance(item, dict):
            continue
        kid = item.get(key)
        if kid is None:
            continue
        by[kid] = item
        order.append(kid)
    stats = {"added": 0, "updated": 0, "kept": len(by)}
    for item in incoming:
        kid = item.get(key)
        if kid is None:
            continue
        if kid in by:
            # Preserve any xlab-only fields not present on source.
            merged = {**by[kid], **item}
            by[kid] = merged
            stats["updated"] += 1
        else:
            by[kid] = item
            order.append(kid)
            stats["added"] += 1
    # Also match providers by (provider, name) when ids differ but same logical node.
    name_index = {}
    for kid, item in by.items():
        name_index[(str(item.get("provider") or ""), str(item.get("name") or ""))] = kid
    for item in incoming:
        kid = item.get(key)
        if kid is None or kid in by:
            continue
        alt = name_index.get((str(item.get("provider") or ""), str(item.get("name") or "")))
        if alt:
            by[alt] = {**by[alt], **item, "id": alt}
            stats["updated"] += 1
    return [by[k] for k in order if k in by], stats


def upsert_combos(existing: list, incoming: list) -> tuple[list, dict]:
    by_id = {}
    by_name = {}
    order = []
    for item in existing or []:
        if not isinstance(item, dict):
            continue
        cid = item.get("id")
        name = item.get("name")
        if cid:
            by_id[cid] = item
            order.append(("id", cid))
        if name:
            by_name[name] = item
    stats = {"added": 0, "updated": 0}
    for item in incoming:
        cid = item.get("id")
        name = item.get("name")
        target = None
        if cid and cid in by_id:
            target = by_id[cid]
        elif name and name in by_name:
            target = by_name[name]
        if target is not None:
            tid = target.get("id") or cid
            merged = {**target, **item}
            # Keep stable id if target had one
            if target.get("id"):
                merged["id"] = target["id"]
            by_id[merged["id"]] = merged
            if name:
                by_name[name] = merged
            stats["updated"] += 1
        else:
            by_id[cid] = item
            if name:
                by_name[name] = item
            order.append(("id", cid))
            stats["added"] += 1
    # rebuild list preferring order of existing then new
    seen = set()
    out = []
    for kind, k in order:
        item = by_id.get(k)
        if item and item.get("id") not in seen:
            out.append(item)
            seen.add(item.get("id"))
    for item in by_id.values():
        if item.get("id") not in seen:
            out.append(item)
            seen.add(item.get("id"))
    return out, stats


# --- read source ---
conn = sqlite3.connect(SRC_DB)
cur = conn.cursor()
pc_rows = list(
    cur.execute(
        "SELECT id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt FROM providerConnections"
    )
)
combo_rows = list(cur.execute("SELECT id, name, kind, models, createdAt, updatedAt FROM combos"))
settings_raw = cur.execute("SELECT data FROM settings WHERE id=1").fetchone()
src_settings = json.loads(settings_raw[0]) if settings_raw else {}

# apiKeys schema varies by 9router version — inspect columns
ak_cols = [r[1] for r in cur.execute("PRAGMA table_info(apiKeys)")]
ak_rows = list(cur.execute("SELECT * FROM apiKeys")) if ak_cols else []
conn.close()

src_providers = [flatten_provider(r) for r in pc_rows]
src_combos = []
for row in combo_rows:
    models = json.loads(row[3]) if isinstance(row[3], str) else (row[3] or [])
    src_combos.append(
        {
            "id": row[0],
            "name": row[1],
            "kind": row[2],
            "models": models,
            "createdAt": row[4],
            "updatedAt": row[5],
            "showInModelsEndpoint": True,
        }
    )

src_api_keys = []
for row in ak_rows:
    item = dict(zip(ak_cols, row))
    key_val = item.get("key") or item.get("apiKey") or item.get("token")
    if not key_val:
        continue
    active = item.get("isActive", item.get("enabled", True))
    src_api_keys.append(
        {
            "id": item.get("id"),
            "name": item.get("name") or item.get("label") or "imported-9router",
            "key": key_val,
            "enabled": bool(active) if active is not None else True,
            "createdAt": item.get("createdAt"),
            "updatedAt": item.get("updatedAt"),
        }
    )

# related strategy keys
provider_ids = {p.get("provider") for p in src_providers if p.get("provider")}
provider_ids.update({"openai-compatible", "qwencoder", "xai"})
src_ps = src_settings.get("providerStrategies") if isinstance(src_settings.get("providerStrategies"), dict) else {}
src_cs = src_settings.get("comboStrategies") if isinstance(src_settings.get("comboStrategies"), dict) else {}
combo_names = {c.get("name") for c in src_combos if c.get("name")}

# --- write target ---
if not DST.exists():
    raise SystemExit(f"missing target {DST}")

bak = DST.with_name(f"db.json.bak-before-9router-sync-{now}")
shutil.copy2(DST, bak)
print("BACKUP", bak)

data = load_json(DST)
pcs, pc_stats = upsert_by_id(data.get("providerConnections") or [], src_providers)
combos, combo_stats = upsert_combos(data.get("combos") or [], src_combos)
data["providerConnections"] = pcs
data["combos"] = combos

# Upsert api keys (needed for /v1 clients)
if src_api_keys:
    existing_keys = data.get("apiKeys") if isinstance(data.get("apiKeys"), list) else []
    by_key = {}
    order = []
    for k in existing_keys:
        if not isinstance(k, dict):
            continue
        kid = k.get("id") or k.get("key")
        if not kid:
            continue
        by_key[kid] = k
        order.append(kid)
    ak_stats = {"added": 0, "updated": 0}
    for k in src_api_keys:
        kid = k.get("id") or k.get("key")
        if not kid:
            continue
        if kid in by_key:
            by_key[kid] = {**by_key[kid], **k}
            ak_stats["updated"] += 1
        else:
            by_key[kid] = k
            order.append(kid)
            ak_stats["added"] += 1
    data["apiKeys"] = [by_key[i] for i in order if i in by_key]
    print("APIKEY_STATS", ak_stats, "total", len(data["apiKeys"]))
else:
    print("APIKEY_STATS none_from_source total", len(data.get("apiKeys") or []))

settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
# core combo routing knobs from 9router
for k in (
    "comboStrategy",
    "comboStickyRoundRobinLimit",
    "stickyRoundRobinLimit",
    "comboSlowModelBiasEnabled",
    "comboSlowModelCooldownEnabled",
):
    if k in src_settings and src_settings[k] is not None:
        settings[k] = src_settings[k]

ps = settings.get("providerStrategies") if isinstance(settings.get("providerStrategies"), dict) else {}
for key, val in src_ps.items():
    if key in provider_ids or any(pid and (key == pid or key.startswith(str(pid))) for pid in provider_ids):
        ps[key] = val
# always take strategies for active source provider ids
for pid in provider_ids:
    if pid in src_ps:
        ps[pid] = src_ps[pid]
settings["providerStrategies"] = ps

cs = settings.get("comboStrategies") if isinstance(settings.get("comboStrategies"), dict) else {}
for name in combo_names:
    if name in src_cs:
        cs[name] = src_cs[name]
settings["comboStrategies"] = cs
data["settings"] = settings

text = json.dumps(data, ensure_ascii=False, indent=2)
DST.write_text(text + "\n", encoding="utf-8")
print("WROTE", DST, "bytes", DST.stat().st_size)
print("PC_STATS", pc_stats, "total", len(pcs))
print("COMBO_STATS", combo_stats, "total", len(combos))
for p in pcs:
    print(
        " pc",
        p.get("provider"),
        p.get("name"),
        "active=",
        p.get("isActive"),
        "has_key=",
        bool(p.get("apiKey") or p.get("accessToken")),
    )
for c in combos:
    print(" combo", c.get("name"), "n=", len(c.get("models") or []))

for alt in ALSO:
    if alt.exists() and alt.resolve() != DST.resolve():
        alt_bak = alt.with_name(f"db.json.bak-before-9router-sync-{now}")
        shutil.copy2(alt, alt_bak)
        alt.write_text(text + "\n", encoding="utf-8")
        print("ALSO_WROTE", alt)

print("OK")
'''


def password() -> str:
    import os

    pw = os.environ.get(PASSWORD_ENV) or os.environ.get("VPS_PASSWORD")
    if pw:
        return pw
    for p in (Path(r"C:\Dev\VPS\my.bnix.one\info.md"), Path(r"C:\Dev\VPS\README.md")):
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"Password:\s*`([^`]+)`", text)
        if m:
            return m.group(1)
        m = re.search(r"a7xe\$[^\s`]+", text)
        if m:
            return m.group(0)
    raise SystemExit(f"Set {PASSWORD_ENV}")


def main() -> int:
    apply = "--apply" in sys.argv
    restart = "--restart" in sys.argv or apply

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=password(), timeout=25)

    if not apply:
        print("DRY RUN inspect only. Pass --apply to write.")
        _, so, se = c.exec_command(
            "python3 - <<'PY'\n"
            "import json,sqlite3\n"
            "conn=sqlite3.connect('/root/.9router/db/data.sqlite');cur=conn.cursor()\n"
            "print('9router providers', list(cur.execute('SELECT provider,name,isActive FROM providerConnections')))\n"
            "print('9router combos', list(cur.execute('SELECT name,length(models) FROM combos')))\n"
            "d=json.load(open('/var/lib/xlabrouter/db.json'));print('xlab pc',len(d.get('providerConnections') or []),'combos',len(d.get('combos') or []))\n"
            "PY",
            timeout=60,
        )
        print(so.read().decode("utf-8", "replace"))
        err = se.read().decode("utf-8", "replace")
        if err.strip():
            print(err, file=sys.stderr)
        c.close()
        return 0

    sftp = c.open_sftp()
    with sftp.file("/tmp/sync_9router_to_xlabrouter.py", "w") as f:
        f.write(REMOTE)
    sftp.close()

    _, so, se = c.exec_command("python3 /tmp/sync_9router_to_xlabrouter.py", timeout=90)
    out = so.read().decode("utf-8", "replace")
    err = se.read().decode("utf-8", "replace")
    print(out)
    if err.strip():
        print(err, file=sys.stderr)
    if "OK" not in out:
        c.close()
        return 1

    if restart:
        print("=== restart xlabrouter")
        _, so, se = c.exec_command(
            "systemctl restart xlabrouter.service; sleep 2; systemctl is-active xlabrouter.service; "
            "curl -sS -m 10 http://127.0.0.1:1212/api/version 2>&1 || true; "
            "python3 - <<'PY'\n"
            "import json\n"
            "d=json.load(open('/var/lib/xlabrouter/db.json'))\n"
            "print('after_pc', len(d.get('providerConnections') or []))\n"
            "print('after_combo', len(d.get('combos') or []))\n"
            "for p in d.get('providerConnections') or []:\n"
            "  print(' ', p.get('provider'), p.get('name'), p.get('isActive'))\n"
            "for cb in d.get('combos') or []:\n"
            "  print(' ', cb.get('name'), len(cb.get('models') or []))\n"
            "PY",
            timeout=60,
        )
        print(so.read().decode("utf-8", "replace"))
        err = se.read().decode("utf-8", "replace")
        if err.strip():
            print(err, file=sys.stderr)

    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
