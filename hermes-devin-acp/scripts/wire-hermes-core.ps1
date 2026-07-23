# Minimal wiring so hermes-agent routes provider devin-acp like copilot-acp.
# Idempotent. Run after hermes-agent update if apply-patches warns about wiring.
$ErrorActionPreference = "Stop"
$Root = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent"
if (-not (Test-Path $Root)) { throw "hermes-agent missing: $Root" }

function Patch-File([string]$Rel, [scriptblock]$Fn) {
  $p = Join-Path $Root $Rel
  if (-not (Test-Path $p)) { Write-Warning "skip missing $Rel"; return }
  $c = Get-Content $p -Raw -Encoding UTF8
  $n = & $Fn $c
  if ($n -eq $c) { Write-Host "unchanged: $Rel" } else {
    $bak = "$p.bak-devin-wire-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item $p $bak -Force
    Set-Content $p $n -Encoding UTF8 -NoNewline
    Write-Host "patched: $Rel"
  }
}

Patch-File "agent\agent_runtime_helpers.py" {
  param($c)
  $old = 'if agent.provider == "copilot-acp" or str(client_kwargs.get("base_url", "")).startswith("acp://copilot"):'
  $new = @'
if (
        agent.provider in {"copilot-acp", "devin-acp"}
        or str(client_kwargs.get("base_url", "")).lower().startswith("acp://")
    ):
'@
  if ($c -match 'devin-acp' -and $c -match 'startswith\("acp://"\)') { return $c }
  if ($c.Contains($old)) { return $c.Replace($old, $new) }
  return $c
}

Patch-File "agent\agent_init.py" {
  param($c)
  $n = $c
  $n = $n.Replace(
    'and agent.provider != "copilot-acp"
        and not str(agent.base_url or "").lower().startswith("acp://copilot")',
    'and agent.provider not in {"copilot-acp", "devin-acp"}
        and not str(agent.base_url or "").lower().startswith("acp://")')
  $n = $n.Replace(
    'if agent.provider == "copilot-acp":',
    'if agent.provider in {"copilot-acp", "devin-acp"}:')
  return $n
}

Patch-File "agent\conversation_loop.py" {
  param($c)
  return $c.Replace(
    'agent.provider in {"copilot-acp"}
                    or str(agent.base_url or "").lower().startswith("acp://copilot")',
    'agent.provider in {"copilot-acp", "devin-acp"}
                    or str(agent.base_url or "").lower().startswith("acp://")')
}

Patch-File "hermes_cli\providers.py" {
  param($c)
  if ($c -match '"devin-acp":\s*HermesOverlay') { return $c }
  $m = [regex]::Match($c, '(?s)"copilot-acp":\s*HermesOverlay\(\s*transport="codex_responses",\s*auth_type="external_process",\s*base_url_override="acp://copilot",\s*base_url_env_var="COPILOT_ACP_BASE_URL",\s*\),')
  if (-not $m.Success) { Write-Warning "providers overlay pattern not found"; return $c }
  $extra = @'
"copilot-acp": HermesOverlay(
        transport="codex_responses",
        auth_type="external_process",
        base_url_override="acp://copilot",
        base_url_env_var="COPILOT_ACP_BASE_URL",
    ),
    "devin-acp": HermesOverlay(
        transport="codex_responses",
        auth_type="external_process",
        base_url_override="acp://devin",
        base_url_env_var="DEVIN_ACP_BASE_URL",
    ),
'@
  $n = $c.Remove($m.Index, $m.Length).Insert($m.Index, $extra)
  if ($n -notmatch '"devin":\s*"devin-acp"') {
    $n = $n.Replace(
      '"github-copilot-acp": "copilot-acp",',
      ("`"github-copilot-acp`": `"copilot-acp`",`r`n    `"devin`": `"devin-acp`",`r`n    `"devin-cli`": `"devin-acp`",`r`n    `"devin-acp-agent`": `"devin-acp`","))
  }
  if ($n -notmatch '"devin-acp":\s*"Devin CLI"') {
    $n = $n.Replace(
      '"copilot-acp": "GitHub Copilot ACP",',
      ("`"copilot-acp`": `"GitHub Copilot ACP`",`r`n    `"devin-acp`": `"Devin CLI`","))
  }
  return $n
}

Write-Host "wire-hermes-core done."
