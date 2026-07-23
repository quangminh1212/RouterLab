# Hermes Devin ACP

**SoT** for Hermes `devin-acp` model provider + local Devin CLI wiring.

Lives in [RouterLab](https://github.com/quangminh1212/RouterLab) (`hermes-devin-acp/`).  
Not stored inside `%LOCALAPPDATA%\hermes` — only a junction/link is installed there.

## Layout

```
hermes-devin-acp/
├── plugin/           # Hermes model-provider plugin (devin-acp)
├── config/           # lean Devin ACP config (no MCP bloat)
├── patches/          # re-apply after hermes-agent update
├── scripts/          # install + rotate free models
├── benches/          # free-model latency / stability benches
└── README.md
```

## Requirements

- [Devin CLI](https://cli.devin.ai) installed and logged in (`devin auth`)
- Hermes Agent home: `%LOCALAPPDATA%\hermes`
- Free models used in Hermes UI: `swe-1-7`, `swe-1-7-medium`, `glm-5-2`, `swe-1-6`

## Install (Windows)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\RouterLab\hermes-devin-acp\scripts\install.ps1
```

What it does:

1. Junction plugin → `%LOCALAPPDATA%\hermes\plugins\model-providers\devin-acp`
2. Copy lean ACP config → `%LOCALAPPDATA%\hermes\devin-hermes-acp.json`
3. Apply Hermes core patches (Devin ACP runtime in `copilot_acp_client.py` + wiring)
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

## RouterLab native path

OpenAI-compatible access without Hermes:

- Provider id: `devin-cli` (alias `dvcli`)
- Executor: `open-sse/executors/devin-cli.js` (local `devin -p --model …`)
- Models: free SWE / GLM catalog in `providerModels.js`

## Uninstall from Hermes

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\RouterLab\hermes-devin-acp\scripts\uninstall.ps1
```
