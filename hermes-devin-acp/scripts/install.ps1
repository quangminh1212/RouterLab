# Install Hermes Devin ACP from RouterLab SoT into Hermes home.
# Safe: creates junction + copies config; merges .env keys without overwrite.
$ErrorActionPreference = "Stop"

$Pkg = Split-Path $PSScriptRoot -Parent
$Hermes = Join-Path $env:LOCALAPPDATA "hermes"
$PluginSrc = Join-Path $Pkg "plugin"
$PluginDst = Join-Path $Hermes "plugins\model-providers\devin-acp"
$ConfigSrc = Join-Path $Pkg "config\devin-hermes-acp.json"
$ConfigDst = Join-Path $Hermes "devin-hermes-acp.json"
$EnvExample = Join-Path $Pkg "config\.env.example"
$EnvFile = Join-Path $Hermes ".env"
$AcpCwd = Join-Path $Hermes "acp-cwd"

Write-Host "== Hermes Devin ACP install =="
Write-Host "SoT:    $Pkg"
Write-Host "Hermes: $Hermes"

if (-not (Test-Path $Hermes)) {
  throw "Hermes home not found: $Hermes"
}
if (-not (Test-Path (Join-Path $PluginSrc "plugin.yaml"))) {
  throw "Plugin missing: $PluginSrc"
}

# 1) Plugin junction
$mp = Join-Path $Hermes "plugins\model-providers"
New-Item -ItemType Directory -Force -Path $mp | Out-Null
if (Test-Path $PluginDst) {
  $item = Get-Item $PluginDst -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    cmd /c "rmdir `"$PluginDst`"" | Out-Null
  } else {
    $bak = "$PluginDst.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Move-Item $PluginDst $bak -Force
    Write-Host "backed up old plugin -> $bak"
  }
}
cmd /c "mklink /J `"$PluginDst`" `"$PluginSrc`"" | Out-Null
Write-Host "plugin junction: $PluginDst -> $PluginSrc"

# 2) ACP config
Copy-Item $ConfigSrc $ConfigDst -Force
Write-Host "config: $ConfigDst"

# 3) ACP cwd
New-Item -ItemType Directory -Force -Path $AcpCwd | Out-Null

# 4) Merge env keys (append missing only)
if (Test-Path $EnvExample) {
  $existing = @{}
  if (Test-Path $EnvFile) {
    Get-Content $EnvFile -Encoding UTF8 | ForEach-Object {
      if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') { $existing[$Matches[1]] = $true }
    }
  }
  $toAdd = @()
  Get-Content $EnvExample -Encoding UTF8 | ForEach-Object {
    $line = $_.TrimEnd()
    if (-not $line -or $line.StartsWith("#")) { return }
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
      $k = $Matches[1]
      if (-not $existing.ContainsKey($k)) { $toAdd += $line }
    }
  }
  if ($toAdd.Count -gt 0) {
    Add-Content -Path $EnvFile -Value ""
    Add-Content -Path $EnvFile -Value "# --- hermes-devin-acp (RouterLab) ---"
    Add-Content -Path $EnvFile -Value $toAdd
    Write-Host "env: appended $($toAdd.Count) keys"
  } else {
    Write-Host "env: all keys already present"
  }
}

# 5) Patches
$apply = Join-Path $PSScriptRoot "apply-patches.ps1"
if (Test-Path $apply) {
  & $apply
}

Write-Host "OK. Restart Hermes Desktop / gateway."
