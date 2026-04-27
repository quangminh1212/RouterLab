@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo xlabrouter Project Startup
echo ========================================
echo.

set LOG_FILE=log.txt
set DEV_RUN_LOG=next-dev.log
set MAX_LOG_BYTES=104857600
if exist "%LOG_FILE%" (
    for %%I in ("%LOG_FILE%") do set LOG_SIZE=%%~zI
    if !LOG_SIZE! GEQ %MAX_LOG_BYTES% (
        del /f /q "%LOG_FILE%" >nul 2>&1
        echo [INFO] Deleted %LOG_FILE% because it reached 100MB.
    )
)

echo [INFO] Log file: %LOG_FILE%
echo [INFO] Starting at %date% %time%
echo [INFO] Starting at %date% %time% > %LOG_FILE%
echo.

echo [STEP 1/6] Checking for existing server on port 1212...
echo [STEP 1/6] Checking for existing server on port 1212... >> %LOG_FILE%
netstat -ano | findstr /R /C:":1212 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port 1212 is in use. Stopping existing process...
    echo [WARN] Port 1212 is in use. Stopping existing process... >> %LOG_FILE%
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":1212 .*LISTENING"') do (
        echo [INFO] Killing process ID: %%a
        echo [INFO] Killing process ID: %%a >> %LOG_FILE%
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo [OK] Existing process stopped.
    echo [OK] Existing process stopped. >> %LOG_FILE%
) else (
    echo [OK] Port 1212 is free.
    echo [OK] Port 1212 is free. >> %LOG_FILE%
)
echo.

echo [STEP 2/6] Checking Node.js installation...
echo [STEP 2/6] Checking Node.js installation... >> %LOG_FILE%
node --version >> %LOG_FILE% 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    echo [ERROR] Node.js not found! >> %LOG_FILE%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js version: %NODE_VERSION%
echo [OK] Node.js version: %NODE_VERSION% >> %LOG_FILE%
echo.

echo [STEP 3/6] Checking npm installation...
echo [STEP 3/6] Checking npm installation... >> %LOG_FILE%
call npm --version > nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found!
    echo [ERROR] npm not found! >> %LOG_FILE%
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VERSION=%%i
if not defined NPM_VERSION (
    echo [WARN] Cannot detect npm version, but npm is available.
    echo [WARN] Cannot detect npm version, but npm is available. >> %LOG_FILE%
    set NPM_VERSION=unknown
)
echo [OK] npm version: %NPM_VERSION%
echo [OK] npm version: %NPM_VERSION% >> %LOG_FILE%
echo.

echo [STEP 4/6] Checking node_modules...
echo [STEP 4/6] Checking node_modules... >> %LOG_FILE%
if not exist "node_modules" (
    echo [WARN] node_modules not found. Installing dependencies...
    echo [WARN] node_modules not found. Installing dependencies... >> %LOG_FILE%
    echo [INFO] Running npm install...
    echo [INFO] Running npm install... >> %LOG_FILE%
    call npm install >> %LOG_FILE% 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install failed! Check %LOG_FILE% for details.
        echo [ERROR] npm install failed! >> %LOG_FILE%
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo [OK] Dependencies installed successfully. >> %LOG_FILE%
) else (
    echo [OK] node_modules found.
    echo [OK] node_modules found. >> %LOG_FILE%
)
echo.

echo [STEP 5/6] Checking .env file...
echo [STEP 5/6] Checking .env file... >> %LOG_FILE%
if not exist ".env" (
    if exist ".env.example" (
        echo [WARN] .env not found. Copying from .env.example...
        echo [WARN] .env not found. Copying from .env.example... >> %LOG_FILE%
        copy .env.example .env >> %LOG_FILE% 2>&1
        echo [OK] .env created. Please configure it if needed.
        echo [OK] .env created. >> %LOG_FILE%
    ) else (
        echo [WARN] .env and .env.example not found.
        echo [WARN] .env and .env.example not found. >> %LOG_FILE%
    )
) else (
    echo [OK] .env file exists.
    echo [OK] .env file exists. >> %LOG_FILE%
)
echo.

echo [STEP 6/6] Skipping production build for development mode...
echo [STEP 6/6] Skipping production build for development mode... >> %LOG_FILE%
echo [INFO] Build step removed to speed up startup and route switching in dev.
echo [INFO] Build step removed to speed up startup and route switching in dev. >> %LOG_FILE%
echo.

echo [STEP 6/6] Starting development server with auto-restart...
echo [STEP 6/6] Starting development server with auto-restart... >> %LOG_FILE%
set "NODE_ENV=development"
echo [INFO] Startup mode: development (hot reload enabled)
echo [INFO] Startup mode: development (hot reload enabled) >> %LOG_FILE%
echo [INFO] Running: npm run dev
echo [INFO] Running: npm run dev >> %LOG_FILE%
echo [INFO] Server will start on http://localhost:1212
echo [INFO] Server will start on http://localhost:1212 >> %LOG_FILE%
echo [INFO] Hot reload is enabled - file changes will auto-restart
echo [INFO] Hot reload is enabled - file changes will auto-restart >> %LOG_FILE%
echo [INFO] Auto-restart is enabled - crashes will restart the server.
echo [INFO] Auto-restart is enabled - crashes will restart the server. >> %LOG_FILE%
echo [INFO] Press Ctrl+C to stop and cleanup.
echo [INFO] Press Ctrl+C to stop and cleanup. >> %LOG_FILE%
echo [INFO] Startup events are logged to %LOG_FILE%
echo [INFO] Dev session log: %DEV_RUN_LOG%
echo [INFO] All server output will be logged to %LOG_FILE% and auto-delete at 100MB
echo [INFO] Server output is shown below (press Ctrl+C to stop and cleanup)
echo ========================================
echo.

echo [STEP 1.5/6] Cleaning stale Next.js dev processes...
echo [STEP 1.5/6] Cleaning stale Next.js dev processes... >> %LOG_FILE%
taskkill /F /IM node.exe >nul 2>&1
echo [OK] Stale Next.js dev process cleanup done.
echo [OK] Stale Next.js dev process cleanup done. >> %LOG_FILE%
echo.

:DEV_LOOP
if exist "%DEV_RUN_LOG%" del /f /q "%DEV_RUN_LOG%" >nul 2>&1
echo [INFO] Starting npm run dev... >> %LOG_FILE%
call npm run dev > "%DEV_RUN_LOG%" 2>&1
set DEV_EXIT_CODE=%ERRORLEVEL%

type "%DEV_RUN_LOG%"
type "%DEV_RUN_LOG%" >> %LOG_FILE%

set CACHE_ERROR=0
findstr /I /C:"build-manifest.json" "%DEV_RUN_LOG%" >nul 2>&1 && set CACHE_ERROR=1
findstr /I /C:".next\dev\server" "%DEV_RUN_LOG%" >nul 2>&1 && set CACHE_ERROR=1
findstr /I /C:"ENOENT: no such file or directory, open" "%DEV_RUN_LOG%" >nul 2>&1 && set CACHE_ERROR=1

if "%CACHE_ERROR%"=="1" (
    echo [WARN] Detected stale Next.js dev cache error. Cleaning .next and preparing restart...
    echo [WARN] Detected stale Next.js dev cache error. Cleaning .next and preparing restart... >> %LOG_FILE%
    if exist ".next" (
        rmdir /s /q ".next" >nul 2>&1
        echo [OK] Cleared .next cache directory.
        echo [OK] Cleared .next cache directory. >> %LOG_FILE%
    )
)

echo.
echo [INFO] Cleaning up port 1212...
echo [INFO] Cleaning up port 1212... >> %LOG_FILE%
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":1212 .*LISTENING"') do (
    echo [INFO] Killing process ID: %%a
    echo [INFO] Killing process ID: %%a >> %LOG_FILE%
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Port 1212 cleaned up.
echo [OK] Port 1212 cleaned up. >> %LOG_FILE%

if "%DEV_EXIT_CODE%"=="0" if "%CACHE_ERROR%"=="0" (
    echo.
    echo [INFO] Server stopped normally.
    echo [INFO] Server stopped normally. >> %LOG_FILE%
    exit /b 0
)

echo.
echo [WARN] Server stopped with exit code %DEV_EXIT_CODE%. Restarting in 3 seconds...
echo [WARN] Server stopped with exit code %DEV_EXIT_CODE%. Restarting in 3 seconds... >> %LOG_FILE%
ping -n 4 127.0.0.1 >nul
goto :DEV_LOOP