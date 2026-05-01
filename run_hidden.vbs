Set WshShell = CreateObject("WScript.Shell")
Dim cmd
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & WScript.Arguments(0) & """"
WshShell.Run cmd, 0, True
