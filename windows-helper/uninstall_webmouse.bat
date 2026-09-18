@echo off
title WebMouse V1 — Uninstall / Disable Auto-Start

echo =========================================================
echo      WEBMOUSE V1 — UNINSTALL / DISABLE AUTO-START
echo =========================================================
echo.

:: 1. Disable Windows Startup Registry
echo [*] Removing WebMouse from Windows Startup...
python -c "import sys; sys.path.insert(0, r'%~dp0'); from webmouse_server import set_startup_enabled; set_startup_enabled(False)" >nul 2>&1
echo [OK] Auto-start entry removed.

:: 2. Remove Firewall rule
echo [*] Cleaning up firewall rules...
netsh advfirewall firewall delete rule name="WebMouse Helper" >nul 2>&1

:: 3. Remove Desktop Shortcut
if exist "%USERPROFILE%\Desktop\WebMouse.lnk" (
    del /f /q "%USERPROFILE%\Desktop\WebMouse.lnk"
    echo [OK] Desktop shortcut removed.
)

:: 4. Stop running background helper processes
echo [*] Stopping running WebMouse helper processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*webmouse_server.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name 'WebMouseHelper' -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1

echo.
echo =========================================================
echo [SUCCESS] WebMouse Helper has been stopped and uninstalled.
echo =========================================================
echo.
pause
