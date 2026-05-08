@echo off
REM Run Claude Code CLI with correct local API endpoint.

set ANTHROPIC_BASE_URL=http://127.0.0.1:1212/v1
set ANTHROPIC_AUTH_TOKEN=sk-6520dcd38ef3521c-liwdr1-9137175c
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

echo ========================================
echo Claude Code CLI Launcher
echo ========================================
echo Base URL: %ANTHROPIC_BASE_URL%
echo Token: %ANTHROPIC_AUTH_TOKEN:~0,15%...
echo ========================================
echo.

claude %*
