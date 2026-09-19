@echo off
title WebMouse V1 — Windows Zero-CMD Setup
color 0A
cd /d "%~dp0"

echo =========================================================
echo              WEBMOUSE V1 — ZERO-CMD INSTALLER
echo =========================================================
echo.
echo Installing WebMouse Background Helper for Windows...
echo Window will STAY OPEN so you can see your 6-Digit PIN!
echo.

:: 1. Detect Python
set PYTHON_CMD=
python --version >nul 2>&1
if %errorlevel% equ 0 set PYTHON_CMD=python

if not defined PYTHON_CMD (
    py --version >nul 2>&1
    if %errorlevel% equ 0 set PYTHON_CMD=py
)

if not defined PYTHON_CMD goto NO_PYTHON

echo [*] Python detected:
%PYTHON_CMD% --version
echo.
goto CHECK_FILES

:NO_PYTHON
echo ================================================================
echo [ERROR] Python was not found in your system PATH!
echo ================================================================
echo.
echo Step 1: Download Python from https://www.python.org/downloads/
echo Step 2: IMPORTANT - Check the box: "Add python.exe to PATH"
echo Step 3: Run this installer again!
echo.
echo ================================================================
pause
goto END_HANG

:CHECK_FILES
if exist "%~dp0webmouse_server.py" goto INSTALL_DEPS
if exist "%~dp0windows-helper\webmouse_server.py" (
    copy /y "%~dp0windows-helper\webmouse_server.py" "%~dp0webmouse_server.py" >nul
    goto INSTALL_DEPS
)

echo [*] Downloading latest webmouse_server.py...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py', '%~dp0webmouse_server.py')" >nul 2>&1

:INSTALL_DEPS
:: Optional pip install - WebMouse runs even if pip fails!
echo [*] Checking Python libraries...
%PYTHON_CMD% -m pip install websockets pyautogui >nul 2>&1

:: Create Desktop Shortcut to run_webmouse.bat if possible
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'WebMouse.lnk')); $s.TargetPath = '%~dp0run_webmouse.bat'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'WebMouse V1 — Remote Mouse & Keyboard'; $s.Save()" >nul 2>&1

echo =========================================================
echo [SUCCESS] WebMouse Installed! Starting Server...
echo =========================================================
echo.
echo - You will see your Laptop IP and 6-Digit Pairing PIN below!
echo - THIS WINDOW WILL STAY OPEN SO YOU CAN ENTER THE PIN.
echo.

:INSTALL_SERVER_LOOP
%PYTHON_CMD% "%~dp0webmouse_server.py"

echo.
echo =========================================================
echo WebMouse server stopped. Window will NOT close!
echo Press any key to restart server...
echo =========================================================
pause
goto INSTALL_SERVER_LOOP

:END_HANG
echo Press any key to retry...
pause >nul
goto INSTALL_SERVER_LOOP
