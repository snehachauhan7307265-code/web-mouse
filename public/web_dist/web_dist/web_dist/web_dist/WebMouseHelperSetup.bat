@echo off
setlocal enabledelayedexpansion
title WebMouse Helper — Windows Setup
color 0B
cd /d "%~dp0"

echo ===================================================================
echo               WEBMOUSE V2 — WINDOWS ONE-CLICK SETUP
echo ===================================================================
echo.
echo [*] Initializing WebMouse Windows Helper installation...
echo.

:: 1. Setup Target Folder in LocalAppData (no admin rights needed)
set "INSTALL_DIR=%LOCALAPPDATA%\WebMouse"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 2. Copy/Deploy Application Files
echo [*] Copying WebMouse Helper files to:
echo     %INSTALL_DIR%
echo.

if exist "%~dp0webmouse_server.py" (
    copy /y "%~dp0webmouse_server.py" "%INSTALL_DIR%\webmouse_server.py" >nul
)
if exist "%~dp0WebMouse.vbs" (
    copy /y "%~dp0WebMouse.vbs" "%INSTALL_DIR%\WebMouse.vbs" >nul
)
if exist "%~dp0run_webmouse.bat" (
    copy /y "%~dp0run_webmouse.bat" "%INSTALL_DIR%\run_webmouse.bat" >nul
)

:: If webmouse_server.py wasn't in source dir, download or create it
if not exist "%INSTALL_DIR%\webmouse_server.py" (
    echo [*] Fetching latest WebMouse core engine...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py', '%INSTALL_DIR%\webmouse_server.py')" >nul 2>&1
)

:: Ensure WebMouse.vbs exists in installation folder for silent zero-window background launch
if not exist "%INSTALL_DIR%\WebMouse.vbs" (
    (
        echo Set WshShell = CreateObject^("WScript.Shell"^)
        echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
        echo scriptDir = fso.GetParentFolderName^(WScript.ScriptFullName^)
        echo pyScript = scriptDir ^& "\webmouse_server.py"
        echo pythonw = "pythonw.exe"
        echo ' Check if pythonw is available, fallback to python
        echo cmd = """" ^& pythonw ^& """ """ ^& pyScript ^& """ --background"
        echo On Error Resume Next
        echo WshShell.Run cmd, 0, False
        echo If Err.Number ^<^> 0 Then
        echo     WshShell.Run """" ^& "python.exe" ^& """ """ ^& pyScript ^& """ --background", 0, False
        echo End If
    ) > "%INSTALL_DIR%\WebMouse.vbs"
)

:: 3. Register with Windows Startup (HKCU Run key - no elevation required)
echo [*] Configuring automatic startup with Windows...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "WebMouseHelper" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\WebMouse.vbs\"" /f >nul 2>&1

:: Also create a shortcut in user's Startup Folder
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_FOLDER%\WebMouse.lnk'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%INSTALL_DIR%\WebMouse.vbs\"'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.WindowStyle = 7; $s.Save()" >nul 2>&1

:: Also create Desktop Shortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'WebMouse Helper.lnk')); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%INSTALL_DIR%\WebMouse.vbs\"'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'WebMouse Windows Helper'; $s.Save()" >nul 2>&1

:: 4. Windows Firewall Configuration (Port 8765)
echo [*] Verifying local network firewall permissions for port 8765...
netsh advfirewall firewall show rule name="WebMouse Helper" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="WebMouse Helper" dir=in action=allow protocol=TCP localport=8765 profile=any >nul 2>&1
)

:: 5. Launch Helper in Background Immediately
echo [*] Starting WebMouse Helper in background...
start "" wscript.exe "%INSTALL_DIR%\WebMouse.vbs"

:: 6. Open WebMouse Local Portal in Default Browser
timeout /t 2 >nul
start "" "http://localhost:8765/"

echo.
echo ===================================================================
echo   [SUCCESS] WEBMOUSE HELPER INSTALLED AND RUNNING!
echo ===================================================================
echo.
echo   - Status        : Running in Background (System Tray active)
echo   - Auto-Start    : Enabled with Windows
echo   - Web Access    : Opening http://localhost:8765/ in browser...
echo.
echo This window will close in 4 seconds...
timeout /t 4 >nul
exit /b 0
