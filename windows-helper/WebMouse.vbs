' ===================================================
' WebMouse V1 — Silent Background Launcher
' Runs with ZERO command prompt window (WindowStyle 0)
' ===================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if compiled WebMouseHelper.exe exists
exePath = scriptDir & "\dist\WebMouseHelper.exe"
If fso.FileExists(exePath) Then
    WshShell.Run """" & exePath & """ --background", 0, False
Else
    ' Run pythonw.exe (windowless python runner)
    pythonw = "pythonw.exe"
    pyScript = scriptDir & "\webmouse_server.py"
    cmd = """" & pythonw & """ """ & pyScript & """ --background"
    WshShell.Run cmd, 0, False
End If
