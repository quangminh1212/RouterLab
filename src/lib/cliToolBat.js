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
