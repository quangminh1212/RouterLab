@echo off
:: Deploy flow:
:: 1) Run this file from repo root.
:: 2) Script clears stale local Next build lock/process, builds, packs, deploys.
:: 3) Pass condition: /v1/models returns 200 at the end.
:: 4) If deploy verify fails, inspect xlabrouter.service + journal on VPS.
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
echo ========================================
echo   Deploy XLab Router to vpssieutoc.vn
echo ========================================
echo   Source : %CD%
echo   Target : 157.66.100.194:1212
echo   Path   : /root/xlabrouter-pkg
echo ========================================
echo.
set "VPS_DIR=C:\Dev\vps\vpssieutoc.vn\xlabrouter"
set "DEPLOY_PY=%VPS_DIR%\python\deploy_source_157.py"
if not exist "%DEPLOY_PY%" goto missing_deploy_py
where npm >nul 2>&1
if errorlevel 1 goto missing_npm
where python >nul 2>&1
if errorlevel 1 goto missing_python
echo [*] Cleaning old .tgz packages...
del /q "%CD%\xlabrouter-*.tgz" 2>nul
echo [*] Clearing stale local Next build lock (if any)...
powershell -NoProfile -Command "$repo=(Resolve-Path '%CD%').Path; $buildIds=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine -like ('*'+$repo+'*next*build --webpack*') } | Select-Object -ExpandProperty ProcessId; foreach($id in $buildIds){ try { Stop-Process -Id $id -Force -ErrorAction Stop; Write-Output ('stopped stale build pid '+$id) } catch {} }; if (Test-Path '.next\lock') { Remove-Item -LiteralPath '.next\lock' -Force -ErrorAction SilentlyContinue; Write-Output 'removed .next\lock' }"
if /I "%SKIP_BUILD%"=="1" goto skip_build
echo [*] Building Next.js app (npm run build)...
call npm run build
if errorlevel 1 goto build_failed
goto after_build
:skip_build
echo [*] SKIP_BUILD=1 - Reusing existing .next artifacts...
:after_build
if not exist "%CD%\.next\BUILD_ID" goto missing_build
if not exist "%CD%\.next\standalone\server.js" goto missing_standalone
echo [*] Running npm pack ...
call npm pack --silent
if errorlevel 1 goto pack_failed
set "TGZ="
for /f "delims=" %%F in ('dir /b /a:-d /o:-d "%CD%\xlabrouter-*.tgz" 2^>nul') do if not defined TGZ set "TGZ=%CD%\%%F"
if not defined TGZ goto missing_tgz
echo [OK] Package: %TGZ%
if /I "%DRY_RUN%"=="1" goto dry_run_done
echo.
echo [*] Deploying to VPS via deploy_source_157.py ...
python -u "%DEPLOY_PY%" "%TGZ%"
if errorlevel 1 goto deploy_failed
echo.
echo [*] Verifying deployed endpoint /v1/models ...
set "VERIFY_OK="
for /l %%I in (1,1,20) do (
    for /f "delims=" %%R in ('powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri ''http://157.66.100.194:1212/v1/models'' -TimeoutSec 8; if ($r.StatusCode -eq 200 -and $r.Content -like ''*\"object\":\"list\"*'') { ''OK'' } else { ''HTTP '' + $r.StatusCode } } catch { ''ERR'' }"') do set "VERIFY_RESULT=%%R"
    echo     try %%I: !VERIFY_RESULT!
    if /I "!VERIFY_RESULT!"=="OK" set "VERIFY_OK=1"
    if /I "!VERIFY_RESULT!"=="OK" goto verify_done
    timeout /t 3 >nul
)
:verify_done
if not defined VERIFY_OK goto verify_failed
echo.
echo ========================================
echo [OK] Done. Web UI: http://157.66.100.194:1212
echo [OK] Verify: /v1/models returned 200
echo ========================================
endlocal
exit /b 0
:dry_run_done
echo [*] DRY_RUN=1 - skip upload/deploy
endlocal
exit /b 0
:missing_deploy_py
echo [!] Missing deploy script: %DEPLOY_PY%
endlocal
exit /b 1
:missing_npm
echo [!] npm not found in PATH
endlocal
exit /b 1
:missing_python
echo [!] python not found in PATH
endlocal
exit /b 1
:build_failed
echo [!] Build failed
endlocal
exit /b 1
:missing_build
echo [!] Missing .next\BUILD_ID - build artifacts are not ready
endlocal
exit /b 1
:missing_standalone
echo [!] Missing .next\standalone\server.js - standalone artifacts are not ready
endlocal
exit /b 1
:pack_failed
echo [!] npm pack failed
endlocal
exit /b 1
:missing_tgz
echo [!] No .tgz produced by npm pack
endlocal
exit /b 1
:deploy_failed
echo.
echo [!] Deploy failed
endlocal
exit /b 1
:verify_failed
echo [!] Deploy completed but endpoint verification failed
endlocal
exit /b 1
