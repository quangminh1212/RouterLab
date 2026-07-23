# Re-apply Devin ACP core patch to hermes-agent after upstream update.
# Replaces agent/copilot_acp_client.py with the Devin-aware build from RouterLab SoT.
$ErrorActionPreference = "Stop"

$Pkg = Split-Path $PSScriptRoot -Parent
$HermesAgent = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent"
$Src = Join-Path $Pkg "patches\copilot_acp_client.devin.py"
$Dst = Join-Path $HermesAgent "agent\copilot_acp_client.py"

if (-not (Test-Path $HermesAgent)) {
  throw "hermes-agent not found: $HermesAgent"
}
if (-not (Test-Path $Src)) {
  throw "patch source missing: $Src"
}
if (-not (Test-Path $Dst)) {
  throw "target missing: $Dst"
}

$bak = "$Dst.bak-devin-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $Dst $bak -Force
Copy-Item $Src $Dst -Force
Write-Host "patched copilot_acp_client.py (backup $bak)"

# Marker check
$txt = Get-Content $Dst -Raw -Encoding UTF8
if ($txt -notmatch "acp://devin" -and $txt -notmatch "HERMES_DEVIN_ACP") {
  Write-Warning "Patched file may be incomplete (no HERMES_DEVIN / acp://devin markers)."
} else {
  Write-Host "markers OK (Devin ACP)"
}

# Other wiring files should mention devin-acp
$wire = @(
  "agent\agent_runtime_helpers.py",
  "agent\agent_init.py",
  "agent\conversation_loop.py"
)
foreach ($rel in $wire) {
  $p = Join-Path $HermesAgent $rel
  if (-not (Test-Path $p)) { continue }
  $c = Get-Content $p -Raw -Encoding UTF8
  if ($c -match "devin-acp") {
    Write-Host "wiring OK: $rel"
  } else {
    Write-Warning "Missing devin-acp in $rel - re-apply full stash or manual wire."
  }
}

# Wire other hermes-agent files (idempotent)
$wire = Join-Path $PSScriptRoot "wire-hermes-core.ps1"
if (Test-Path $wire) {
  & $wire
}

Write-Host "apply-patches done."
