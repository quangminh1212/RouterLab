@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo XLab Router - NPM Global Install Test
echo ========================================
echo.

REM Clean old test artifacts
if exist ".tmp-global-test" (
    echo [1/6] Cleaning old test environment...
    rmdir /s /q ".tmp-global-test" 2>nul
)

REM Pack current version
echo [2/6] Packing current version...
call npm.cmd pack >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm pack failed!
    pause
    exit /b 1
)

REM Install to test prefix
echo [3/6] Installing to test global prefix...
call npm.cmd install -g xlabrouter-1.0.35.tgz --prefix .tmp-global-test --silent
if errorlevel 1 (
    echo [ERROR] npm install -g failed!
    pause
    exit /b 1
)

REM Test --version
echo [4/6] Testing xlabrouter --version...
call .tmp-global-test\xlabrouter.cmd --version
if errorlevel 1 (
    echo [ERROR] xlabrouter --version failed!
    pause
    exit /b 1
)

REM Test --help
echo.
echo [5/6] Testing xlabrouter --help...
call .tmp-global-test\xlabrouter.cmd --help | findstr /C:"xlab_router - XLab Router CLI" >nul
if errorlevel 1 (
    echo [ERROR] xlabrouter --help failed!
    pause
    exit /b 1
)

REM Test xlabuter alias
echo.
echo [6/6] Testing xlabuter alias...
call .tmp-global-test\xlabuter.cmd --version
if errorlevel 1 (
    echo [ERROR] xlabuter alias failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo All tests passed!
echo Package: xlabrouter-1.0.35.tgz
echo Tag: 1.0.35 (no v prefix)
echo Ready for: npm publish
echo ========================================
echo.
pause

