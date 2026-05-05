export function buildCliApplyBat({ appUrl, endpoint, payload, toolName }) {
  const url = new URL(endpoint, appUrl).toString();
  const escapedToolName = String(toolName || "CLI tool").replace(/'/g, "''");
  const escapedUrl = url.replace(/'/g, "''");
  const json = JSON.stringify(payload, null, 2).replace(/\r\n/g, "\n");

  return `@echo off
setlocal
chcp 65001 >nul
echo Applying ${toolName} settings...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$ProgressPreference = 'SilentlyContinue';" ^
  "$uri = '${escapedUrl}';" ^
  "$json = @'\n${json}\n'@;" ^
  "$response = Invoke-RestMethod -Method POST -Uri $uri -ContentType 'application/json' -Body $json;" ^
  "if ($response.error) { throw $response.error }" ^
  "Write-Host '${escapedToolName} settings applied successfully.'"
if errorlevel 1 (
  echo Failed to apply ${toolName} settings.
  pause
  exit /b 1
)
echo Done.
pause
`;
}

export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCliApplyBat({ appUrl, endpoint, payload, toolName, filename }) {
  const content = buildCliApplyBat({ appUrl, endpoint, payload, toolName });
  downloadTextFile(filename, content, "application/x-bat;charset=utf-8");
}

/**
 * Build CLI setup script for cross-machine deployment
 * @param {object} options
 * @param {string} options.endpoint - Full endpoint URL (e.g. https://tunnel.example.com/v1)
 * @param {string} options.apiKey - API key for authentication
 * @param {string} options.os - Target OS: "windows" or "unix"
 * @param {string} options.installCmd - Install command (e.g. "npm i -g xlabrouter")
 * @returns {string} Script content
 */
export function buildCliSetupScript({ endpoint, apiKey, os, installCmd }) {
  const escapedEndpoint = endpoint.replace(/'/g, "'\\''");
  const escapedApiKey = apiKey.replace(/'/g, "'\\''");

  if (os === "windows") {
    return `@echo off
setlocal
chcp 65001 >nul
echo ========================================
echo XLab Router CLI Setup
echo ========================================
echo.
echo [1/3] Installing XLab Router CLI globally...
call ${installCmd}
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to install XLab Router CLI.
  echo Please run manually: ${installCmd}
  pause
  exit /b 1
)
echo [OK] CLI installed successfully.
echo.
echo [2/3] Configuring Claude CLI settings...
if not exist "%USERPROFILE%\\.claude" mkdir "%USERPROFILE%\\.claude"
(
  echo {
  echo   "env": {
  echo     "ANTHROPIC_BASE_URL": "${escapedEndpoint}",
  echo     "ANTHROPIC_AUTH_TOKEN": "${escapedApiKey}"
  echo   }
  echo }
) > "%USERPROFILE%\\.claude\\settings.json"
echo [OK] Claude CLI configured.
echo.
echo [3/3] Setup complete!
echo.
echo You can now run: claude
echo.
pause
`;
  } else {
    return `#!/bin/bash
set -e

echo "========================================"
echo "XLab Router CLI Setup"
echo "========================================"
echo ""
echo "[1/3] Installing XLab Router CLI globally..."
${installCmd}
echo "[OK] CLI installed successfully."
echo ""
echo "[2/3] Configuring Claude CLI settings..."
mkdir -p ~/.claude
cat > ~/.claude/settings.json <<'EOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "${escapedEndpoint}",
    "ANTHROPIC_AUTH_TOKEN": "${escapedApiKey}"
  }
}
EOF
echo "[OK] Claude CLI configured."
echo ""
echo "[3/3] Setup complete!"
echo ""
echo "You can now run: claude"
echo ""
`;
  }
}

/**
 * Download CLI setup script
 * @param {object} options
 * @param {string} options.endpoint - Full endpoint URL
 * @param {string} options.apiKey - API key
 * @param {string} options.os - "windows" or "unix"
 * @param {string} options.installCmd - Install command
 * @param {string} options.filename - Output filename
 */
export function downloadCliSetupScript({ endpoint, apiKey, os, installCmd, filename }) {
  const content = buildCliSetupScript({ endpoint, apiKey, os, installCmd });
  const mimeType = os === "windows" ? "application/x-bat;charset=utf-8" : "text/x-shellscript;charset=utf-8";
  downloadTextFile(filename, content, mimeType);
}
