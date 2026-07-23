# Hermes Devin ACP (RouterLab provider)

**SoT** nằm trong **RouterLab** — package provider `devin-acp` (Hermes plugin) + native OpenAI path `devin-cli`.

Không còn repo riêng `Hermes_DevinACP` / `C:\Dev\Hermes_DevinACP`.

## Layout

```
RouterLab/
├── hermes-devin-acp/          # Hermes plugin + patches + install scripts
│   ├── plugin/                # model-provider devin-acp
│   ├── config/                # lean Devin ACP config
│   ├── patches/               # re-apply after hermes-agent update
│   ├── scripts/               # install / uninstall / rotate
│   └── benches/
└── open-sse/
    ├── executors/devin-cli.js # native OpenAI-compatible executor
    └── config/providerModels.js  # free SWE/GLM catalog
```

## Requirements

- [Devin CLI](https://cli.devin.ai) installed and logged in (`devin auth`)
- Hermes Agent home: `%LOCALAPPDATA%\hermes`
- Free models used in Hermes UI: `swe-1-7`, `swe-1-7-medium`, `glm-5-2`, `swe-1-6`

## Install into Hermes (Windows)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\RouterLab\hermes-devin-acp\scripts\install.ps1
```

What it does:

1. Junction plugin → `%LOCALAPPDATA%\hermes\plugins\model-providers\devin-acp`
2. Copy lean ACP config → `%LOCALAPPDATA%\hermes\devin-hermes-acp.json`
3. Apply Hermes core patches (Devin ACP runtime + wiring)
4. Append missing env keys to `%LOCALAPPDATA%\hermes\.env` (does not overwrite secrets)

Restart Hermes Desktop / gateway after install.

## Env (Hermes `.env`)

```env
HERMES_DEVIN_ACP_COMMAND=%LOCALAPPDATA%\devin\cli\bin\devin.exe
HERMES_DEVIN_ACP_ARGS=--config %LOCALAPPDATA%\hermes\devin-hermes-acp.json acp
HERMES_DEVIN_ACP_MODE=ask
HERMES_ACP_PERSIST=1
HERMES_ACP_FRESH_SESSION=1
HERMES_DEVIN_ACP_CWD=%LOCALAPPDATA%\hermes\acp-cwd
HERMES_DEVIN_FORCE_TOOL_MODEL=1
HERMES_DEVIN_TOOL_FALLBACK=1
HERMES_DEVIN_TOOL_FALLBACK_MODEL=swe-1-7
```

## Hermes model config

```yaml
model:
  default: swe-1-7
  provider: devin-acp
  base_url: acp://devin
```

Or run:

```powershell
python C:\Dev\RouterLab\hermes-devin-acp\scripts\set_devin_rotate.py
```

## After `hermes` / agent update

Patches live outside upstream and are wiped on update. Re-run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\RouterLab\hermes-devin-acp\scripts\apply-patches.ps1
```

## RouterLab native path (no Hermes)

- Provider id: `devin-cli` (alias `dvcli`)
- Executor: `open-sse/executors/devin-cli.js` (local `devin -p --model …`)
- Models: free SWE / GLM catalog in `providerModels.js`

## Uninstall from Hermes

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\RouterLab\hermes-devin-acp\scripts\uninstall.ps1
```

Removes plugin junction, `devin-hermes-acp.json`, and **reverts** `hermes-agent` git patches.  
`.env` keys stay (harmless). Clear `providers.devin-acp` / fallbacks in `config.yaml` if present.
