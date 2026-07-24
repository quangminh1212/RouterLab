#!/usr/bin/env python3
"""Replace display string 'XLab Router' → 'RouterLab' on live VPS xlabrouter package."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

HOST = "36.50.26.247"
REMOTE = r'''
import os
import subprocess
from pathlib import Path

OLD = "XLab Router"
NEW = "RouterLab"
roots = [
    Path("/root/xlabrouter-pkg"),
    Path("/root/xlabrouter-pkg/.next/standalone"),
]
# Include RSC payloads, webmanifest, and other text artifacts from Next build.
exts = {
    ".js", ".mjs", ".cjs", ".json", ".html", ".md", ".txt", ".css", ".map",
    ".rsc", ".webmanifest", ".svg", ".xml", ".ts", ".tsx",
}
skip_dirs = {"node_modules", ".git", "coverage"}
changed = []
scanned = 0

for root in roots:
    if not root.exists():
        print("skip missing", root)
        continue
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for name in filenames:
            p = Path(dirpath) / name
            suffix = p.suffix.lower()
            # .rsc / segment files sometimes have multi-dot names: foo.segment.rsc
            is_rsc = ".rsc" in name.lower() or name.endswith(".rsc")
            if suffix not in exts and not is_rsc and name not in ("server.js", "manifest.webmanifest"):
                # still scan if likely text payload (segment files without known ext)
                if not any(name.endswith(s) for s in (".segment.rsc", ".rsc", ".html", ".js", ".json")):
                    continue
            try:
                if p.stat().st_size > 80_000_000:
                    continue
                raw = p.read_bytes()
            except Exception as e:
                print("read fail", p, e)
                continue
            scanned += 1
            if OLD.encode("utf-8") not in raw:
                continue
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("utf-8", "replace")
            if OLD not in text:
                continue
            new_text = text.replace(OLD, NEW)
            p.write_bytes(new_text.encode("utf-8"))
            changed.append(str(p))

print("SCANNED", scanned)
print("CHANGED", len(changed))
for c in changed[:80]:
    print(" ", c)
if len(changed) > 80:
    print(" ...", len(changed) - 80, "more")

# systemd unit description
unit = Path("/etc/systemd/system/xlabrouter.service")
if unit.exists():
    t = unit.read_text(encoding="utf-8", errors="replace")
    nt = t.replace("XLab Router", "RouterLab")
    if nt != t:
        unit.write_text(nt, encoding="utf-8")
        print("UPDATED systemd unit")
        subprocess.run(["systemctl", "daemon-reload"], check=False)

# source config if present
for cfg in [
    Path("/root/xlabrouter-pkg/src/shared/constants/config.js"),
    Path("/root/xlabrouter-pkg/.next/standalone/src/shared/constants/config.js"),
]:
    if cfg.exists():
        t = cfg.read_text(encoding="utf-8", errors="replace")
        nt = t.replace('name: "XLab Router"', 'name: "RouterLab"').replace("XLab Router", "RouterLab")
        if nt != t:
            cfg.write_text(nt, encoding="utf-8")
            print("UPDATED", cfg)

subprocess.run(["systemctl", "restart", "xlabrouter"], check=False)
import time
time.sleep(3)
print("active", subprocess.run(["systemctl", "is-active", "xlabrouter"], capture_output=True, text=True).stdout.strip())
# verify
count_old = subprocess.run(
    "grep -R 'XLab Router' /root/xlabrouter-pkg/.next/standalone/.next/server 2>/dev/null | wc -l",
    shell=True, capture_output=True, text=True,
).stdout.strip()
count_new = subprocess.run(
    "grep -R 'RouterLab' /root/xlabrouter-pkg/.next/standalone/.next/server 2>/dev/null | wc -l",
    shell=True, capture_output=True, text=True,
).stdout.strip()
print("server_chunks old_count", count_old, "RouterLab_count", count_new)
# HTML title sample
import urllib.request
try:
    html = urllib.request.urlopen("http://127.0.0.1:1212/login", timeout=15).read().decode("utf-8", "replace")
    print("login has XLab Router", "XLab Router" in html)
    print("login has RouterLab", "RouterLab" in html)
except Exception as e:
    print("login fetch", e)
print("OK")
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
    with sftp.file("/tmp/patch_display_name.py", "w") as f:
        f.write(REMOTE)
    sftp.close()
    _, so, se = c.exec_command("python3 /tmp/patch_display_name.py", timeout=180)
    sys.stdout.write(so.read().decode("utf-8", "replace"))
    err = se.read().decode("utf-8", "replace")
    if err.strip():
        sys.stderr.write(err)
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
