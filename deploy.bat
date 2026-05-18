@echo off
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
set "NPMIGNORE=%CD%\.npmignore"
set "NPMIGNORE_BAK=%CD%\.npmignore.deploybak"

if not exist "%DEPLOY_PY%" (
    echo [!] Missing deploy script: %DEPLOY_PY%
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [!] npm not found in PATH
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo [!] python not found in PATH
    exit /b 1
)

echo [*] Cleaning old .tgz packages...
del /q "%CD%\xlabrouter-*.tgz" 2>nul

echo [*] Building Next.js app (npm run build)...
call npm run build
if errorlevel 1 (
    echo [!] Build failed
    exit /b 1
)

if not exist "%CD%\.next\BUILD_ID" (
    echo [!] .next build artifacts missing
    exit /b 1
)

echo [*] Patching .npmignore to include .next ...
if exist "%NPMIGNORE%" (
    copy /y "%NPMIGNORE%" "%NPMIGNORE_BAK%" >nul
    powershell -NoProfile -Command "(Get-Content -LiteralPath '%NPMIGNORE%') | Where-Object { $_.Trim() -ne '.next/' -and $_.Trim() -ne '.next' } | Set-Content -LiteralPath '%NPMIGNORE%' -Encoding UTF8"
)

echo [*] Running npm pack ...
call npm pack
set "PACK_RC=%ERRORLEVEL%"

if exist "%NPMIGNORE_BAK%" (
    move /y "%NPMIGNORE_BAK%" "%NPMIGNORE%" >nul
)

if not "%PACK_RC%"=="0" (
    echo [!] npm pack failed (exit %PACK_RC%)
    exit /b %PACK_RC%
)

set "TGZ="
for /f "delims=" %%F in ('dir /b /a:-d /o:-d "%CD%\xlabrouter-*.tgz" 2^>nul') do (
    if not defined TGZ set "TGZ=%CD%\%%F"
)

if not defined TGZ (
    echo [!] No .tgz produced by npm pack
    exit /b 1
)

echo [OK] Package: %TGZ%
echo.
echo [*] Deploying to VPS via deploy_source_157.py ...
python -u "%DEPLOY_PY%" "%TGZ%"
set "DEPLOY_RC=%ERRORLEVEL%"

if not "%DEPLOY_RC%"=="0" (
    echo.
    echo [!] Deploy failed (exit %DEPLOY_RC%)
    exit /b %DEPLOY_RC%
)

echo.
echo ========================================
echo [OK] Done. Web UI: http://157.66.100.194:1212
echo ========================================
endlocal
exit /b 0