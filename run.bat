@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set LOG_FILE=log.txt
set DEV_RUN_LOG=next-dev.log

echo Starting XLab Router...
echo.

REM Kill existing node processes
taskkill /F /IM node.exe >nul 2>&1

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

REM Create .env if needed
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    )
)

echo Starting dev server on http://localhost:1212
echo Logs are shown in realtime with colors and also saved to %DEV_RUN_LOG%
echo Press Ctrl+C to stop
echo.

:DEV_LOOP
if exist "%DEV_RUN_LOG%" del /f /q "%DEV_RUN_LOG%" >nul 2>&1

REM Start dev server with realtime colored output
powershell.exe -NoProfile -ExecutionPolicy Bypass -File colorlog.ps1
set EXIT_CODE=!ERRORLEVEL!

if exist "%DEV_RUN_LOG%" type "%DEV_RUN_LOG%" >> "%LOG_FILE%"

REM Check for cache errors
findstr /I /C:"build-manifest.json" "%DEV_RUN_LOG%" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto CACHE_ERROR

findstr /I /C:".next\dev\server" "%DEV_RUN_LOG%" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto CACHE_ERROR

findstr /I /C:"ENOENT: no such file or directory" "%DEV_RUN_LOG%" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto CACHE_ERROR

REM Normal exit
if !EXIT_CODE! EQU 0 (
    echo.
    echo Server stopped normally.
    exit /b 0
)

REM Restart on crash
echo.
echo [WARN] Server crashed (exit code !EXIT_CODE!). Restarting in 3 seconds...
ping -n 4 127.0.0.1 >nul
goto DEV_LOOP

:CACHE_ERROR
echo.
echo [WARN] Next.js cache error detected. Clearing .next and restarting...
if exist ".next" rmdir /s /q ".next" >nul 2>&1
ping -n 2 127.0.0.1 >nul
goto DEV_LOOP