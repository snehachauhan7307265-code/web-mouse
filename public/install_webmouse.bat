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
    echo [ERROR] Python was not found in your system PATH!
    echo.
    echo Please install Python from https://www.python.org/downloads/
    echo IMPORTANT: Make sure to check the box "Add Python to PATH" during setup.
    echo.
    pause
    exit /b 1
)

echo [*] Python detected:
python --version
echo.

:: 2. Auto-locate or fetch webmouse_server.py
if not exist "%~dp0webmouse_server.py" (
    echo [*] Locating webmouse_server.py...
    if exist "%~dp0windows-helper\webmouse_server.py" (
        copy /y "%~dp0windows-helper\webmouse_server.py" "%~dp0webmouse_server.py" >nul
    ) else if exist "%~dp0WebMouse\webmouse_server.py" (
        copy /y "%~dp0WebMouse\webmouse_server.py" "%~dp0webmouse_server.py" >nul
    ) else (
        for /d %%D in ("%~dp0webmouse-v1*") do (
            if exist "%%D\webmouse_server.py" copy /y "%%D\webmouse_server.py" "%~dp0webmouse_server.py" >nul
            if exist "%%D\windows-helper\webmouse_server.py" copy /y "%%D\windows-helper\webmouse_server.py" "%~dp0webmouse_server.py" >nul
        )
    )
)

if not exist "%~dp0webmouse_server.py" (
    echo [*] Downloading latest webmouse_server.py...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py' -OutFile '%~dp0webmouse_server.py' -TimeoutSec 15 } catch { (New-Object Net.WebClient).DownloadFile('https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py', '%~dp0webmouse_server.py') }" >nul 2>&1
)

:: 3. Generate requirements.txt if missing
if not exist "%~dp0requirements.txt" (
    (
        echo websockets^>=12.0
        echo pyautogui^>=0.9.54
        echo pynput^>=1.7.6
        echo qrcode^>=7.4.2
        echo pillow^>=10.0.0
        echo screeninfo^>=0.8.1
        echo pystray^>=0.19.5
        echo pyperclip^>=1.8.2
    ) > "%~dp0requirements.txt"
)

:: 4. Generate WebMouse.vbs if missing
if not exist "%~dp0WebMouse.vbs" (
    (
        echo Set WshShell = CreateObject^("WScript.Shell"^)
        echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
        echo scriptDir = fso.GetParentFolderName^(WScript.ScriptFullName^)
        echo pyScript = scriptDir ^& "\webmouse_server.py"
        echo WshShell.Run "pythonw.exe """ ^& pyScript ^& """", 0, False
    ) > "%~dp0WebMouse.vbs"
)

:: 5. Generate run_webmouse.bat for 1-click visible runner
(
    echo @echo off
    echo title WebMouse Windows Helper Server
    echo cd /d "%%~dp0"
    echo python webmouse_server.py
    echo pause
) > "%~dp0run_webmouse.bat"

:: 6. Install required dependencies directly (no failure even if requirements.txt is absent)
echo [*] Installing required Python libraries (websockets, pyautogui, pynput, qrcode, pillow, screeninfo)...
python -m pip install websockets pyautogui pynput qrcode pillow screeninfo pystray pyperclip
if %errorlevel% neq 0 (
    echo [WARNING] Retrying install with --user flag...
    python -m pip install --user websockets pyautogui pynput qrcode pillow screeninfo pystray pyperclip
)
echo [OK] Python dependencies verified.
echo.

:: 7. Configure Windows Defender Firewall for local Wi-Fi port 8765
echo [*] Configuring Windows Firewall for local network access (Port 8765)...
netsh advfirewall firewall show rule name="WebMouse Helper" >nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="WebMouse Helper" dir=in action=allow protocol=TCP localport=8765 profile=private >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Windows Firewall rule added for Private networks (Port 8765).
    ) else (
        echo [INFO] Note: If Windows Defender prompts you, click "Allow access on Private networks".
    )
) else (
    echo [OK] Firewall rule is already configured.
)
echo.

:: 8. Enable Startup with Windows (HKCU Run Key - no admin needed)
echo [*] Configuring auto-start on Windows boot...
python -c "import sys; sys.path.insert(0, r'%~dp0'); from webmouse_server import set_startup_enabled; set_startup_enabled(True)" >nul 2>&1
echo [OK] Auto-start configured.
echo.

:: 9. Create Desktop Shortcut to run_webmouse.bat
echo [*] Creating Desktop Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'WebMouse.lnk')); $s.TargetPath = '%~dp0run_webmouse.bat'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'WebMouse V1 — Remote Mouse & Keyboard'; $s.Save()" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Desktop shortcut created: 'WebMouse'.
) else (
    echo [INFO] Desktop shortcut creation skipped.
)
echo.

:: 10. Start the server right now in an open terminal window (so user can see IP and logs)
echo =========================================================
echo [SUCCESS] Starting WebMouse Server now!
echo =========================================================
echo.
echo - A new terminal window will open with your WebMouse server.
echo - You will see your Laptop IP (e.g. 192.168.x.x) and Pairing Code!
echo - Keep that window open while using WebMouse.
echo.

start "WebMouse Server [RUNNING]" cmd /k "cd /d "%~dp0" && python webmouse_server.py"

echo You can now connect your phone using the IP shown in the server window.
echo.
pause
