@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

if /I "%~1"=="--elevated" shift

cd /d "%~dp0"

if not defined XLABROUTER_PORT set XLABROUTER_PORT=1212
set "PORT=%XLABROUTER_PORT%"
set "FOUND=0"
set "PIDS= "

echo Stopping RouterLab on port %PORT%...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "PID=%%P"
    if not "!PID!"=="0" (
        echo !PIDS! | findstr /C:" !PID! " >nul
        if errorlevel 1 (
            set "PIDS=!PIDS!!PID! "
            set "FOUND=1"
            echo [INFO] Stopping PID !PID! ...
            taskkill /F /T /PID !PID! >nul 2>&1
        )
    )
)

if "%FOUND%"=="0" (
    echo [INFO] No active RouterLab process found on port %PORT%.
    exit /b 0
)

for /L %%I in (1,1,8) do (
    set "STILL_LISTENING=0"
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
        set "STILL_LISTENING=1"
    )
    if "!STILL_LISTENING!"=="0" goto STOPPED
    timeout /t 1 /nobreak >nul
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    if not "%%P"=="0" (
        echo [WARN] Port %PORT% is still in use by PID %%P.
        net session >nul 2>&1
        if errorlevel 1 (
            echo [INFO] Requesting Administrator rights to stop protected process...
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '--elevated' -Verb RunAs -Wait"
            exit /b %ERRORLEVEL%
        )
        echo [WARN] Administrator rights are already active but PID %%P is still holding port %PORT%.
        exit /b 1
    )
)

:STOPPED
echo [OK] RouterLab stopped completely.
exit /b 0
