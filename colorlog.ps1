$ErrorActionPreference = "Continue"

$logDir = "logs"
$logPath = Join-Path $logDir "next-dev.log"
$targetPort = 1212
$maxRetries = 3
$devEngine = if ($env:XLABROUTER_NEXT_DEV_ENGINE) { $env:XLABROUTER_NEXT_DEV_ENGINE } else { "webpack" }

function Resolve-LogPath {
    param([string]$PreferredPath)

    try {
        if (Test-Path $PreferredPath) {
            $stream = [System.IO.File]::Open($PreferredPath, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
            $stream.Close()
            return $PreferredPath
        }

        $stream = [System.IO.File]::Open($PreferredPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
        $stream.Close()
        return $PreferredPath
    } catch {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $fallback = [System.IO.Path]::GetFileNameWithoutExtension($PreferredPath) + "-$stamp" + [System.IO.Path]::GetExtension($PreferredPath)
        Write-Host "[WARN] Log file '$PreferredPath' is locked. Using '$fallback' instead." -ForegroundColor Yellow
        return $fallback
    }
}

function Write-ColoredLine {
    param([string]$Line)

    if (($Line -match "(?i)\b(error|failed|exception|unauthorized)\b") -or ($Line -match "\s5\d\d\s")) {
        Write-Host $Line -ForegroundColor Red
        return
    }

    if (($Line -match "(?i)\bwarn(ing)?\b") -or ($Line -match "\s4\d\d\s")) {
        Write-Host $Line -ForegroundColor Yellow
        return
    }

    if ($Line -match "(?i)\b(info|ready|compiled successfully|local services module loaded|outbound proxy module loaded)\b") {
        Write-Host $Line -ForegroundColor Cyan
        return
    }

    if ($Line -match "^\s*(GET|POST|PUT|PATCH|DELETE)\s") {
        if ($Line -match "\s2\d\d\s") {
            Write-Host $Line -ForegroundColor Green
            return
        }

        if ($Line -match "\s3\d\d\s") {
            Write-Host $Line -ForegroundColor DarkCyan
            return
        }
    }

    if ($Line -match "^\[(DASHBOARD_GUARD|InitApp|SSE)\]") {
        Write-Host $Line -ForegroundColor Magenta
        return
    }

    if ($Line -match "^\[[0-9]{4}-[0-9]{2}-[0-9]{2}") {
        Write-Host $Line -ForegroundColor DarkGray
        return
    }

    Write-Host $Line -ForegroundColor Gray
}


function Kill-StaleRouterProcesses {
    try {
        $repo = [regex]::Escape((Get-Location).Path)
        $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            ($_.Name -eq 'node.exe' -or $_.Name -eq 'nodew.exe') -and
            $_.CommandLine -and
            $_.CommandLine -match $repo -and
            ($_.CommandLine -match 'xlab_router\.js' -or $_.CommandLine -match 'next\s+dev' -or $_.CommandLine -match '\.next[\/]+standalone[\/]+server\.js')
        }
        foreach ($proc in $procs) {
            if ($proc.ProcessId -and $proc.ProcessId -ne $PID) {
                Write-Host "[INFO] Killing stale router process PID $($proc.ProcessId)" -ForegroundColor Cyan
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        Write-Host "[WARN] Failed to cleanup stale router processes: $_" -ForegroundColor Yellow
    }
}

function Kill-PortProcess {
    param([int]$Port)
    Write-Host "[WARN] Port $Port is in use. Attempting to kill process..." -ForegroundColor Yellow
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
        if ($conns) {
            foreach ($owningPid in $conns) {
                if ($owningPid -and $owningPid -ne $PID) {
                    $proc = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "[INFO] Killing process: $($proc.Name) (PID $($proc.Id))" -ForegroundColor Cyan
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    }
                }
            }
            Start-Sleep -Seconds 2
            return $true
        }
    } catch {
        Write-Host "[ERROR] Failed to kill port process: $_" -ForegroundColor Red
    }
    return $false
}

function Clear-NextCache {
    $nextDir = Join-Path (Get-Location).Path ".next"
    if (-not (Test-Path $nextDir)) { return }

    try {
        Write-Host "[INFO] Removing stale Next.js cache: $nextDir" -ForegroundColor Cyan
        Remove-Item -LiteralPath $nextDir -Recurse -Force -ErrorAction Stop
    } catch {
        Write-Host "[WARN] Could not remove .next cache. Close old node.exe processes or run as Administrator." -ForegroundColor Yellow
    }
}

function Has-NextCacheCorruption {
    param($Output)
    $text = ($Output | ForEach-Object { $_.ToString() }) -join "`n"
    return $text -match "Turbopack error|Failed to restore task data|Failed to open SST file|app-paths-manifest\.json|ChunkLoadError|ENOENT: no such file or directory"
}

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$resolvedLogPath = Resolve-LogPath -PreferredPath $logPath

# Ensure cleanup even when PowerShell is interrupted (Ctrl+C / host exit)
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    try {
        $conns = Get-NetTCPConnection -LocalPort $using:targetPort -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
        if ($conns) {
            foreach ($owningPid in $conns) {
                if ($owningPid -and $owningPid -ne $PID) {
                    Stop-Process -Id $owningPid -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
} | Out-Null

$attempt = 0
$success = $false
$currentPort = $targetPort

# Pre-clear stale router processes/listeners before first start
Kill-StaleRouterProcesses
Kill-PortProcess -Port $currentPort | Out-Null
Clear-NextCache

while ($attempt -lt $maxRetries -and -not $success) {
    $attempt++
    if ($attempt -gt 1) {
        Write-Host "[INFO] Retry attempt $attempt/$maxRetries" -ForegroundColor Cyan
    }

    Write-Host "[INFO] Starting dev server on port $currentPort using $devEngine" -ForegroundColor Cyan
    try {
       $engineFlag = if ($devEngine -eq "turbo" -or $devEngine -eq "turbopack") { "--turbo" } else { "--webpack" }
        $output = npx next dev --port $currentPort $engineFlag --no-server-fast-refresh 2>&1 | Tee-Object -FilePath $resolvedLogPath
        $output | ForEach-Object { Write-ColoredLine $_.ToString() }
        $exitCode = $LASTEXITCODE
    } finally {
        # Always clear listener after process exits or Ctrl+C interruption
        Kill-PortProcess -Port $targetPort | Out-Null
    }

    if ($exitCode -ne 0 -and ($output -match "EADDRINUSE")) {
        if (Kill-PortProcess -Port $currentPort) {
            Write-Host "[INFO] Port $currentPort cleared. Retrying..." -ForegroundColor Green
            Start-Sleep -Seconds 1
            continue
        }

        Write-Host "[ERROR] Port $currentPort is still busy after cleanup. Keep fixed port mode enabled." -ForegroundColor Red
        break
    }

    if ($exitCode -ne 0 -and (Has-NextCacheCorruption -Output $output)) {
        Write-Host "[WARN] Next.js cache corruption detected. Clearing cache before retry..." -ForegroundColor Yellow
        Clear-NextCache
        Start-Sleep -Seconds 1
        continue
    }

    $success = $true
}

exit $exitCode
