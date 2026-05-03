@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "PORT=1212"
set "FOUND=0"
set "PIDS= "

echo Stopping XLab Router on port %PORT%...

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
    echo [INFO] No active XLab Router process found on port %PORT%.
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
        echo [WARN] If this keeps happening, run this file as Administrator.
        exit /b 1
    )
)

:STOPPED
echo [OK] XLab Router stopped completely.
exit /b 0
