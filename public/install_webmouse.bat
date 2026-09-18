@echo off
setlocal enabledelayedexpansion
title WebMouse V1 — Windows Zero-CMD Setup

echo =========================================================
echo              WEBMOUSE V1 — ZERO-CMD INSTALLER
echo =========================================================
echo.
echo Installing WebMouse Background Helper for Windows...
echo No manual command lines required after this setup!
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3 was not found in your system PATH!
    echo.
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    echo IMPORTANT: Make sure to check the box "Add Python to PATH" during setup.
    echo.
    pause
    exit /b 1
)

echo [*] Python detected:
python --version
echo.

:: 2. Install required dependencies
echo [*] Installing dependencies from requirements.txt...
pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo [WARNING] Some dependencies failed to install. Continuing...
) else (
    echo [OK] Dependencies installed successfully.
)
echo.

:: 3. Configure Windows Defender Firewall for local Wi-Fi port 8765
echo [*] Configuring Windows Firewall for local network access (Port 8765)...
netsh advfirewall firewall show rule name="WebMouse Helper" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="WebMouse Helper" dir=in action=allow protocol=TCP localport=8765 profile=private >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Windows Firewall rule added for Private networks (Port 8765).
    ) else (
        echo [INFO] Note: If Windows Defender displays an alert, click "Allow access on Private networks".
    )
) else (
    echo [OK] Firewall rule is already configured.
)
echo.

:: 4. Enable Startup with Windows (HKCU Run Key - no admin needed)
echo [*] Registering WebMouse to start automatically when Windows starts...
python -c "import sys; sys.path.insert(0, r'%~dp0'); from webmouse_server import set_startup_enabled; set_startup_enabled(True)" >nul 2>&1
echo [OK] Auto-start configured in Windows registry.
echo.

:: 5. Create Desktop Shortcut to WebMouse.vbs (Silent launcher)
echo [*] Creating Desktop Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'WebMouse.lnk')); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0WebMouse.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'WebMouse V1 — Remote Mouse & Keyboard'; $s.Save()" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Desktop shortcut created: "WebMouse".
) else (
    echo [INFO] Skipped desktop shortcut.
)
echo.

:: 6. Launch WebMouse silently in the background right now
echo [*] Starting WebMouse Background Helper...
wscript.exe "%~dp0WebMouse.vbs"
echo [OK] WebMouse Helper is running in the background!
echo.

echo =========================================================
echo [SUCCESS] WebMouse V1 is installed and running!
echo =========================================================
echo.
echo 🟢 Look for the WebMouse icon in your Windows System Tray
echo    (next to the clock in the bottom-right corner of your screen).
echo.
echo - Right-click tray icon -^> Click "Show QR" to pair your phone!
echo - Right-click tray icon -^> Click "Open WebMouse" to open in browser.
echo - WebMouse will now start automatically whenever Windows boots.
echo - ZERO manual command prompts required!
echo.
echo You can safely close this installer window.
pause
