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

echo [STEP 6/7] Auto-configuring Claude/Codex CLI settings (optional)...
echo [STEP 6/7] Auto-configuring Claude/Codex CLI settings (optional)... >> %LOG_FILE%

set "AUTO_SYNC_CLI=0"

if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /R "^[A-Za-z_][A-Za-z0-9_]*=" ".env"`) do (
        set "ENV_KEY=%%A"
        set "ENV_VAL=%%B"
        set "!ENV_KEY!=!ENV_VAL!"
    )
)

if defined XLABROUTER_CODEX_MODEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_OPUS_MODEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_SONNET_MODEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_HAIKU_MODEL set "AUTO_SYNC_CLI=1"

if "%AUTO_SYNC_CLI%"=="1" (
    set "CLI_BASE_URL=%XLABROUTER_CLI_BASE_URL%"
    if not defined CLI_BASE_URL set "CLI_BASE_URL=http://localhost:20128/v1"
    if /I not "%CLI_BASE_URL:~-3%"=="/v1" set "CLI_BASE_URL=%CLI_BASE_URL%/v1"

    set "CLI_API_KEY=%XLABROUTER_CLI_API_KEY%"
    if not defined CLI_API_KEY set "CLI_API_KEY=sk_xlabrouter"

    set "CLAUDE_OPUS_MODEL=%XLABROUTER_CLAUDE_OPUS_MODEL%"
    set "CLAUDE_SONNET_MODEL=%XLABROUTER_CLAUDE_SONNET_MODEL%"
    set "CLAUDE_HAIKU_MODEL=%XLABROUTER_CLAUDE_HAIKU_MODEL%"

    set "CODEX_MODEL=%XLABROUTER_CODEX_MODEL%"
    set "CODEX_SUBAGENT_MODEL=%XLABROUTER_CODEX_SUBAGENT_MODEL%"
    if not defined CODEX_SUBAGENT_MODEL set "CODEX_SUBAGENT_MODEL=%CODEX_MODEL%"

    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $claudeDir=Join-Path $env:USERPROFILE '.claude'; New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null; $settingsPath=Join-Path $claudeDir 'settings.json'; $settings=@{hasCompletedOnboarding=$true; env=@{ANTHROPIC_BASE_URL=$env:CLI_BASE_URL; ANTHROPIC_AUTH_TOKEN=$env:CLI_API_KEY}}; if($env:CLAUDE_OPUS_MODEL){$settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL=$env:CLAUDE_OPUS_MODEL}; if($env:CLAUDE_SONNET_MODEL){$settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL=$env:CLAUDE_SONNET_MODEL}; if($env:CLAUDE_HAIKU_MODEL){$settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL=$env:CLAUDE_HAIKU_MODEL}; $settings | ConvertTo-Json -Depth 8 | Set-Content -Path $settingsPath -Encoding UTF8" >> %LOG_FILE% 2>&1
    if errorlevel 1 (
        echo [WARN] Failed to auto-write Claude settings. >> %LOG_FILE%
        echo [WARN] Failed to auto-write Claude settings.
    ) else (
        echo [OK] Claude settings synced to %USERPROFILE%\.claude\settings.json
        echo [OK] Claude settings synced. >> %LOG_FILE%
    )

    if defined CODEX_MODEL (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $codexDir=Join-Path $env:USERPROFILE '.codex'; New-Item -ItemType Directory -Force -Path $codexDir | Out-Null; $configPath=Join-Path $codexDir 'config.toml'; $authPath=Join-Path $codexDir 'auth.json'; $lines=@('# XLab Router Configuration for Codex CLI', ('model = \"' + $env:CODEX_MODEL + '\"'), 'model_provider = \"xlabrouter\"', '', '[model_providers.xlabrouter]', 'name = \"xlabrouter\"', ('base_url = \"' + $env:CLI_BASE_URL + '\"'), 'wire_api = \"responses\"', '', '[agents.subagent]', ('model = \"' + $env:CODEX_SUBAGENT_MODEL + '\"')); Set-Content -Path $configPath -Encoding UTF8 -Value $lines; @{OPENAI_API_KEY=$env:CLI_API_KEY} | ConvertTo-Json -Depth 5 | Set-Content -Path $authPath -Encoding UTF8" >> %LOG_FILE% 2>&1
        if errorlevel 1 (
            echo [WARN] Failed to auto-write Codex settings. >> %LOG_FILE%
            echo [WARN] Failed to auto-write Codex settings.
        ) else (
            echo [OK] Codex settings synced to %USERPROFILE%\.codex\config.toml and auth.json
            echo [OK] Codex settings synced. >> %LOG_FILE%
        )
    ) else (
        echo [INFO] XLABROUTER_CODEX_MODEL is empty. Skipped Codex auto-sync.
        echo [INFO] XLABROUTER_CODEX_MODEL is empty. Skipped Codex auto-sync. >> %LOG_FILE%
    )
) else (
    echo [INFO] No CLI sync variables found in .env. Skipping Claude/Codex auto-sync.
    echo [INFO] No CLI sync variables found in .env. Skipping Claude/Codex auto-sync. >> %LOG_FILE%
)
echo.

echo [STEP 7/7] Starting development server...
echo [STEP 7/7] Starting development server... >> %LOG_FILE%
set "XLABROUTER_WEB_MODE=production"
set "NODE_ENV=production"
set "XLABROUTER_FAST_STARTUP=1"
echo [INFO] Startup mode: %XLABROUTER_WEB_MODE%
echo [INFO] Startup mode: %XLABROUTER_WEB_MODE% >> %LOG_FILE%
echo [INFO] Fast startup: %XLABROUTER_FAST_STARTUP%
echo [INFO] Fast startup: %XLABROUTER_FAST_STARTUP% >> %LOG_FILE%
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
