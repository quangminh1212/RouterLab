$ErrorActionPreference = "Continue"

$logPath = "next-dev.log"
$targetPort = 1212
$maxRetries = 3

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

function Kill-PortProcess {
    param([int]$Port)
    Write-Host "[WARN] Port $Port is in use. Attempting to kill process..." -ForegroundColor Yellow
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
        if ($conns) {
            foreach ($pid in $conns) {
                if ($pid -and $pid -ne $PID) {
                    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
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

$resolvedLogPath = Resolve-LogPath -PreferredPath $logPath

# Ensure cleanup even when PowerShell is interrupted (Ctrl+C / host exit)
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    try {
        $conns = Get-NetTCPConnection -LocalPort $using:targetPort -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
        if ($conns) {
            foreach ($pid in $conns) {
                if ($pid -and $pid -ne $PID) {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
} | Out-Null

$attempt = 0
$success = $false
$currentPort = $targetPort

# Pre-clear stale listeners before first start to avoid EADDRINUSE race
Kill-PortProcess -Port $currentPort | Out-Null

while ($attempt -lt $maxRetries -and -not $success) {
    $attempt++
    if ($attempt -gt 1) {
        Write-Host "[INFO] Retry attempt $attempt/$maxRetries" -ForegroundColor Cyan
    }

    Write-Host "[INFO] Starting dev server on port $currentPort" -ForegroundColor Cyan
    try {
        $output = npx next dev --port $currentPort 2>&1 | Tee-Object -FilePath $resolvedLogPath
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

        $currentPort++
        Write-Host "[WARN] Auto-switching to new port $currentPort" -ForegroundColor Yellow
        Start-Sleep -Seconds 1
        continue
    }

    $success = $true
}

exit $exitCode
