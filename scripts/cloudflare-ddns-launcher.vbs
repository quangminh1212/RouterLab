Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Dev\XLab_Router"
shell.Run """C:\Program Files\nodejs\node.exe"" ""C:\Dev\XLab_Router\scripts\cloudflare-ddns.js""", 0, True
