@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo xlabrouter Project Startup
echo ========================================
echo.

set LOG_FILE=log.txt
set MAX_LOG_BYTES=104857600
set "SYNC_CLI_ONLY=0"
if /I "%~1"=="--sync-cli-only" set "SYNC_CLI_ONLY=1"

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

if "%SYNC_CLI_ONLY%"=="1" goto :SYNC_ONLY_PREP
goto :CONTINUE_NORMAL

:SYNC_ONLY_PREP
echo [INFO] Sync-only mode enabled (--sync-cli-only^)
echo [INFO] Sync-only mode enabled (--sync-cli-only^) >> %LOG_FILE%
goto :AUTO_SYNC_CLI

:CONTINUE_NORMAL

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

:AUTO_SYNC_CLI
echo [STEP 6/8] Auto-configuring Claude/Codex CLI settings (optional)...
echo [STEP 6/8] Auto-configuring Claude/Codex CLI settings (optional)... >> %LOG_FILE%

set "AUTO_SYNC_CLI=0"

if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLI_BASE_URL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLI_API_KEY=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLAUDE_OPUS_MODEL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLAUDE_SONNET_MODEL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLAUDE_HAIKU_MODEL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLAUDE_DEFAULT_MODE=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLAUDE_EFFORT_LEVEL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CLAUDE_ALWAYS_THINKING=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CODEX_MODEL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_CODEX_SUBAGENT_MODEL=" ".env"') do set "%%A=%%B"
if exist ".env" for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"XLABROUTER_SHORTCUT_DIR=" ".env"') do set "%%A=%%B"

if defined XLABROUTER_CLAUDE_DEFAULT_MODE set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_EFFORT_LEVEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_ALWAYS_THINKING set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CODEX_MODEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_OPUS_MODEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_SONNET_MODEL set "AUTO_SYNC_CLI=1"
if defined XLABROUTER_CLAUDE_HAIKU_MODEL set "AUTO_SYNC_CLI=1"

if "%AUTO_SYNC_CLI%"=="1" (
    set "CLI_BASE_URL=%XLABROUTER_CLI_BASE_URL%"
    if not defined CLI_BASE_URL set "CLI_BASE_URL=http://localhost:1212/v1"
    if /I not "!CLI_BASE_URL:~-3!"=="/v1" set "CLI_BASE_URL=!CLI_BASE_URL!/v1"

    set "CLI_API_KEY=%XLABROUTER_CLI_API_KEY%"
    if not defined CLI_API_KEY set "CLI_API_KEY=sk_xlabrouter"

    set "CLAUDE_OPUS_MODEL=%XLABROUTER_CLAUDE_OPUS_MODEL%"
    set "CLAUDE_SONNET_MODEL=%XLABROUTER_CLAUDE_SONNET_MODEL%"
    set "CLAUDE_HAIKU_MODEL=%XLABROUTER_CLAUDE_HAIKU_MODEL%"

    set "CLAUDE_DEFAULT_MODE=%XLABROUTER_CLAUDE_DEFAULT_MODE%"
    if not defined CLAUDE_DEFAULT_MODE set "CLAUDE_DEFAULT_MODE=acceptEdits"

    set "CLAUDE_EFFORT_LEVEL=%XLABROUTER_CLAUDE_EFFORT_LEVEL%"
    if not defined CLAUDE_EFFORT_LEVEL set "CLAUDE_EFFORT_LEVEL=high"
    if /I "%CLAUDE_EFFORT_LEVEL%"=="max" set "CLAUDE_EFFORT_LEVEL=high"

    set "CLAUDE_ALWAYS_THINKING=%XLABROUTER_CLAUDE_ALWAYS_THINKING%"
    if not defined CLAUDE_ALWAYS_THINKING set "CLAUDE_ALWAYS_THINKING=true"

    set "CODEX_MODEL=%XLABROUTER_CODEX_MODEL%"
    set "CODEX_SUBAGENT_MODEL=%XLABROUTER_CODEX_SUBAGENT_MODEL%"
    if not defined CODEX_SUBAGENT_MODEL set "CODEX_SUBAGENT_MODEL=%CODEX_MODEL%"

    if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude" >nul 2>&1
    > "%USERPROFILE%\.claude\settings.json" echo {
    >> "%USERPROFILE%\.claude\settings.json" echo   "hasCompletedOnboarding": true,
    >> "%USERPROFILE%\.claude\settings.json" echo   "defaultMode": "%CLAUDE_DEFAULT_MODE%",
    >> "%USERPROFILE%\.claude\settings.json" echo   "alwaysThinkingEnabled": %CLAUDE_ALWAYS_THINKING%,
    >> "%USERPROFILE%\.claude\settings.json" echo   "effortLevel": "%CLAUDE_EFFORT_LEVEL%",
    >> "%USERPROFILE%\.claude\settings.json" echo   "env": {
    >> "%USERPROFILE%\.claude\settings.json" echo     "ANTHROPIC_BASE_URL": "%CLI_BASE_URL%",
    >> "%USERPROFILE%\.claude\settings.json" echo     "ANTHROPIC_AUTH_TOKEN": "%CLI_API_KEY%",
    >> "%USERPROFILE%\.claude\settings.json" echo     "ANTHROPIC_DEFAULT_OPUS_MODEL": "%CLAUDE_OPUS_MODEL%",
    >> "%USERPROFILE%\.claude\settings.json" echo     "ANTHROPIC_DEFAULT_SONNET_MODEL": "%CLAUDE_SONNET_MODEL%",
    >> "%USERPROFILE%\.claude\settings.json" echo     "ANTHROPIC_DEFAULT_HAIKU_MODEL": "%CLAUDE_HAIKU_MODEL%"
    >> "%USERPROFILE%\.claude\settings.json" echo   }
    >> "%USERPROFILE%\.claude\settings.json" echo }
    if errorlevel 1 (
        echo [WARN] Failed to auto-write Claude settings. >> %LOG_FILE%
        echo [WARN] Failed to auto-write Claude settings.
    ) else (
        echo [OK] Claude settings synced to %USERPROFILE%\.claude\settings.json
        echo [OK] Claude settings synced. >> %LOG_FILE%
    )

    if defined CODEX_MODEL (
        if not exist "%USERPROFILE%\.codex" mkdir "%USERPROFILE%\.codex" >nul 2>&1
        > "%USERPROFILE%\.codex\config.toml" echo # XLab Router Configuration for Codex CLI
        >> "%USERPROFILE%\.codex\config.toml" echo model = "%CODEX_MODEL%"
        >> "%USERPROFILE%\.codex\config.toml" echo model_provider = "xlabrouter"
        >> "%USERPROFILE%\.codex\config.toml" echo.
        >> "%USERPROFILE%\.codex\config.toml" echo [model_providers.xlabrouter]
        >> "%USERPROFILE%\.codex\config.toml" echo name = "xlabrouter"
        >> "%USERPROFILE%\.codex\config.toml" echo base_url = "%CLI_BASE_URL%"
        >> "%USERPROFILE%\.codex\config.toml" echo wire_api = "responses"
        >> "%USERPROFILE%\.codex\config.toml" echo.
        >> "%USERPROFILE%\.codex\config.toml" echo [agents.subagent]
        >> "%USERPROFILE%\.codex\config.toml" echo model = "%CODEX_SUBAGENT_MODEL%"

        > "%USERPROFILE%\.codex\auth.json" echo {
        >> "%USERPROFILE%\.codex\auth.json" echo   "OPENAI_API_KEY": "%CLI_API_KEY%"
        >> "%USERPROFILE%\.codex\auth.json" echo }
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

set "CLI_SHORTCUT_DIR=%XLABROUTER_SHORTCUT_DIR%"
if not defined CLI_SHORTCUT_DIR set "CLI_SHORTCUT_DIR=C:\Dev\Work\2000\shortcut"

if not exist "%CLI_SHORTCUT_DIR%" mkdir "%CLI_SHORTCUT_DIR%" >nul 2>&1

set "SELF_BAT=%~f0"

> "%CLI_SHORTCUT_DIR%\claude-settings.cmd" echo @echo off
>> "%CLI_SHORTCUT_DIR%\claude-settings.cmd" echo call "%SELF_BAT%" --sync-cli-only
>> "%CLI_SHORTCUT_DIR%\claude-settings.cmd" echo start "" "%%USERPROFILE%%\.claude\settings.json"

> "%CLI_SHORTCUT_DIR%\codex-config.cmd" echo @echo off
>> "%CLI_SHORTCUT_DIR%\codex-config.cmd" echo call "%SELF_BAT%" --sync-cli-only
>> "%CLI_SHORTCUT_DIR%\codex-config.cmd" echo start "" "%%USERPROFILE%%\.codex\config.toml"

> "%CLI_SHORTCUT_DIR%\codex-auth.cmd" echo @echo off
>> "%CLI_SHORTCUT_DIR%\codex-auth.cmd" echo call "%SELF_BAT%" --sync-cli-only
>> "%CLI_SHORTCUT_DIR%\codex-auth.cmd" echo start "" "%%USERPROFILE%%\.codex\auth.json"

> "%CLI_SHORTCUT_DIR%\setup-claude-codex.cmd" echo @echo off
>> "%CLI_SHORTCUT_DIR%\setup-claude-codex.cmd" echo call "%SELF_BAT%" --sync-cli-only

echo [OK] Shortcut scripts synced in %CLI_SHORTCUT_DIR%
echo [OK] Shortcut scripts synced in %CLI_SHORTCUT_DIR% >> %LOG_FILE%
echo.

if "%SYNC_CLI_ONLY%"=="1" (
    echo [OK] Sync-only mode finished.
    echo [OK] Sync-only mode finished. >> %LOG_FILE%
    exit /b 0
)

echo [STEP 7/8] Skipping production build for development mode...
echo [STEP 7/8] Skipping production build for development mode... >> %LOG_FILE%
echo [INFO] Build step removed to speed up startup and route switching in dev.
echo [INFO] Build step removed to speed up startup and route switching in dev. >> %LOG_FILE%
echo.

echo [STEP 8/8] Starting development server with auto-restart...
echo [STEP 8/8] Starting development server with auto-restart... >> %LOG_FILE%
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
echo [INFO] All server output will be logged to %LOG_FILE% and auto-delete at 100MB
echo [INFO] Server output is shown below (press Ctrl+C to stop and cleanup)
echo ========================================
echo.

:DEV_LOOP
echo [INFO] Starting npm run dev... >> %LOG_FILE%
call npm run dev
set DEV_EXIT_CODE=%ERRORLEVEL%

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

if "%DEV_EXIT_CODE%"=="0" (
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

