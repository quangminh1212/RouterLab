$ErrorActionPreference = "Continue"

$logPath = "next-dev.log"

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

npm run dev 2>&1 |
    Tee-Object -FilePath $logPath |
    ForEach-Object { Write-ColoredLine $_.ToString() }

exit $LASTEXITCODE
