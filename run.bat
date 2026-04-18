@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo xlabrouter Project Startup
echo ========================================
echo.

set LOG_FILE=log.txt
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

echo [STEP 1/6] Checking for existing server on port 20128...
echo [STEP 1/6] Checking for existing server on port 20128... >> %LOG_FILE%
netstat -ano | findstr /R /C:":20128 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port 20128 is in use. Stopping existing process...
    echo [WARN] Port 20128 is in use. Stopping existing process... >> %LOG_FILE%
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":20128 .*LISTENING"') do (
        echo [INFO] Killing process ID: %%a
        echo [INFO] Killing process ID: %%a >> %LOG_FILE%
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo [OK] Existing process stopped.
    echo [OK] Existing process stopped. >> %LOG_FILE%
) else (
    echo [OK] Port 20128 is free.
    echo [OK] Port 20128 is free. >> %LOG_FILE%
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

echo [STEP 6/6] Starting development server...
echo [STEP 6/6] Starting development server... >> %LOG_FILE%
echo [INFO] Running: node .\bin\xlab_router.js --web
echo [INFO] Running: node .\bin\xlab_router.js --web >> %LOG_FILE%
echo [INFO] Server will start on http://localhost:20128
echo [INFO] Server will start on http://localhost:20128 >> %LOG_FILE%
echo [INFO] Press Ctrl+C to stop the server
echo [INFO] Press Ctrl+C to stop the server >> %LOG_FILE%
echo [INFO] Startup events are logged to %LOG_FILE%
echo [INFO] All server output will be logged to %LOG_FILE% and auto-delete at 100MB
echo [INFO] Server output is shown below (press Ctrl+C to stop)
echo ========================================
echo.

echo [INFO] Starting node .\bin\xlab_router.js --web... >> %LOG_FILE%
node .\bin\xlab_router.js --web
set DEV_EXIT_CODE=%ERRORLEVEL%

if not "%DEV_EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] Server stopped with exit code %DEV_EXIT_CODE%. Check %LOG_FILE% for startup details.
    echo [ERROR] Server stopped with exit code %DEV_EXIT_CODE%. >> %LOG_FILE%
    pause
    exit /b %DEV_EXIT_CODE%
)
