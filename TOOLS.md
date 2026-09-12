# Loop Patch Resource Scout

Scouted: 2026-06-19

| Resource | Status | Verified command |
|---|---|---|
| Git | available: `git version 2.55.0.windows.2` | `git --version` |
| Python | available: `Python 3.11.15` | `python --version` |
| `_final_audit.py` | unavailable in project/PATH | `command -v _final_audit.py` |
| Word count | available: `/usr/bin/wc` | `wc -w FILE` |
| Repetition detector | no dedicated project tool found; Python stdlib fallback | `python -c "import re,sys,collections; w=re.findall(r'\\w+',open(sys.argv[1],encoding='utf-8').read().lower()); print(collections.Counter(zip(w,w[1:])).most_common(20))" FILE` |

Global `TOOLS.md`: absent during scout; no <7-day inventory reusable.
