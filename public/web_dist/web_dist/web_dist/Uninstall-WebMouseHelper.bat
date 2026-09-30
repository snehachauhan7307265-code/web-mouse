@echo off
title Uninstall WebMouse Helper
color 0C
cd /d "%~dp0"

echo ===================================================================
echo               UNINSTALL WEBMOUSE HELPER
echo ===================================================================
echo.
echo Removing WebMouse Helper from this computer...

:: 1. Stop background process
taskkill /f /im pythonw.exe /fi "WINDOWTITLE eq WebMouse*" >nul 2>&1

:: 2. Remove Windows Startup Registry Key
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "WebMouseHelper" /f >nul 2>&1

:: 3. Remove Startup and Desktop Shortcuts
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\WebMouse.lnk" >nul 2>&1
del /q "%USERPROFILE%\Desktop\WebMouse Helper.lnk" >nul 2>&1

:: 4. Remove Firewall rule
netsh advfirewall firewall delete rule name="WebMouse Helper" >nul 2>&1

:: 5. Remove Application directory
set "INSTALL_DIR=%LOCALAPPDATA%\WebMouse"
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" >nul 2>&1
)

echo.
echo [SUCCESS] WebMouse Helper has been completely uninstalled.
echo.
pause
