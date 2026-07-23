# Remove Hermes Devin ACP external module from Hermes home.
# SoT stays in RouterLab; re-install anytime via install.ps1.
$ErrorActionPreference = "Stop"

$Hermes = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA "hermes" }
$HermesAgent = Join-Path $Hermes "hermes-agent"
$PluginDst = Join-Path $Hermes "plugins\model-providers\devin-acp"
$ConfigDst = Join-Path $Hermes "devin-hermes-acp.json"

Write-Host "== Hermes Devin ACP uninstall =="
Write-Host "Hermes: $Hermes"

# 1) Plugin junction / directory
if (Test-Path $PluginDst) {
  $item = Get-Item $PluginDst -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    cmd /c "rmdir `"$PluginDst`"" | Out-Null
    Write-Host "removed junction: $PluginDst"
  } else {
    Remove-Item $PluginDst -Recurse -Force
    Write-Host "removed directory: $PluginDst"
  }
} else {
  Write-Host "no plugin at $PluginDst"
}

# 2) Copied ACP config (env keys left intact — safe, optional)
if (Test-Path $ConfigDst) {
  Remove-Item $ConfigDst -Force
  Write-Host "removed $ConfigDst"
}

# 3) Revert hermes-agent core patches if git install
if (Test-Path (Join-Path $HermesAgent ".git")) {
  Push-Location $HermesAgent
  try {
    $files = @(
      "agent/agent_init.py",
      "agent/agent_runtime_helpers.py",
      "agent/conversation_loop.py",
      "agent/copilot_acp_client.py",
      "hermes_cli/providers.py"
    )
    git checkout -- @files 2>&1 | Out-Null
    Get-ChildItem "agent" -Filter "*.bak-devin*" -ErrorAction SilentlyContinue | Remove-Item -Force
    Write-Host "reverted hermes-agent Devin patches (git checkout)"
  } finally {
    Pop-Location
  }
} else {
  Write-Host "hermes-agent not a git tree — reinstall agent or restore stock copilot_acp_client.py manually"
}

Write-Host ""
Write-Host "OK. Optional manual cleanup in Hermes config.yaml:"
Write-Host "  - remove providers.devin-acp and fallback_providers entries for devin-acp"
Write-Host "  - set model.provider away from devin-acp"
Write-Host "Re-attach later: scripts\install.ps1"
