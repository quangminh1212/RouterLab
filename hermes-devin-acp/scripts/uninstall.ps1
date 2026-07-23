# Remove Hermes Devin ACP junction/plugin from Hermes home (SoT stays in RouterLab).
$ErrorActionPreference = "Stop"

$Hermes = Join-Path $env:LOCALAPPDATA "hermes"
$PluginDst = Join-Path $Hermes "plugins\model-providers\devin-acp"

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
  Write-Host "nothing to remove at $PluginDst"
}

Write-Host "Note: config/env left intact. Switch Hermes model.provider away from devin-acp if needed."
