@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

set LOG_FILE=logs\log.txt
set DEV_RUN_LOG=logs\next-dev.log
if not defined XLABROUTER_NEXT_DEV_ENGINE set XLABROUTER_NEXT_DEV_ENGINE=webpack
if not defined XLABROUTER_PORT set XLABROUTER_PORT=1212
set PORT=%XLABROUTER_PORT%
set NODE_ENV=development
set HOSTNAME=127.0.0.1
set CLOUDFLARED_PROCESS_MODE=true
set CLOUDFLARED_WINDOWS_SERVICE_MODE=false

echo Starting XLab Router...
echo.

REM Always clear old dev server processes before starting
call "%~dp0stop.bat"
if errorlevel 1 (
    echo [ERROR] Could not free port %PORT%. Please run run.bat as Administrator and try again.
    exit /b 1
)

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found!
    pause
    exit /b 1
)

REM Check PowerShell for realtime log tee
where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell not found!
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

if not exist "logs" (
    mkdir "logs" >nul 2>&1
)

REM Create .env if needed
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    )
)

echo Starting dev server on http://localhost:%PORT% using %XLABROUTER_NEXT_DEV_ENGINE%
echo Dev host is %HOSTNAME%
echo Logs are shown in realtime with colors and also saved to %DEV_RUN_LOG%
echo Press Ctrl+C to stop
echo.

if exist "%DEV_RUN_LOG%" del /f /q "%DEV_RUN_LOG%" >nul 2>&1

REM Start dev server in this console. Hidden wscript mode closes stdin and can make Next dev exit immediately.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0colorlog.ps1"
set EXIT_CODE=!ERRORLEVEL!

REM Always cleanup leftover processes after PowerShell exits (including Ctrl+C)
call "%~dp0stop.bat" >nul 2>&1

if exist "%DEV_RUN_LOG%" type "%DEV_RUN_LOG%" >> "%LOG_FILE%"

REM Check for cache errors
findstr /I /C:"build-manifest.json" "%DEV_RUN_LOG%" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto CACHE_ERROR

findstr /I /C:".next\dev\server" "%DEV_RUN_LOG%" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto CACHE_ERROR

findstr /I /C:"ENOENT: no such file or directory" "%DEV_RUN_LOG%" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo.
    echo [WARN] Next.js cache-related error detected in logs.
)

REM Normal exit
if !EXIT_CODE! EQU 0 (
    echo.
    echo Server stopped normally.
    exit /b 0
)

REM Exit on crash (no auto-restart)
echo.
echo [WARN] Server exited with code !EXIT_CODE!.
exit /b !EXIT_CODE!
