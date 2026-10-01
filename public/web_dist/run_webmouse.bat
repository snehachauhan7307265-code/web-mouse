@echo off
setlocal enabledelayedexpansion
title WebMouse V1 — Windows Helper Server [PORT 8765]
color 0A

:: Ensure working directory is the script folder
cd /d "%~dp0"

echo ================================================================
echo           WEBMOUSE V1 — WINDOWS HELPER (CMD LAUNCHER)
echo ================================================================
echo.
echo [*] Initializing WebMouse Windows Helper...
echo [*] THIS CMD WINDOW WILL STAY OPEN SO YOU CAN READ YOUR PAIRING PIN!
echo.

:: 1. Detect Python
set PYTHON_CMD=
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
) else (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py
    ) else (
        echo [ERROR] Python is not installed or not in PATH!
        echo.
        echo Please install Python 3.8+ from: https://www.python.org/downloads/
        echo (Make sure to check the box "Add Python to PATH" during installation)
        echo.
        echo Keeping window open so you can read this message.
        echo ================================================================
        pause
        goto END_HANG
    )
)

echo [*] Python detected:
%PYTHON_CMD% --version
echo.

:: 2. Ensure webmouse_server.py is present
if not exist "%~dp0webmouse_server.py" (
    echo [*] Locating webmouse_server.py...
    if exist "%~dp0windows-helper\webmouse_server.py" (
        copy /y "%~dp0windows-helper\webmouse_server.py" "%~dp0webmouse_server.py" >nul
    )
)

if not exist "%~dp0webmouse_server.py" (
    echo [*] Downloading latest webmouse_server.py...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py' -OutFile '%~dp0webmouse_server.py' -TimeoutSec 15 } catch { (New-Object Net.WebClient).DownloadFile('https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py', '%~dp0webmouse_server.py') }" >nul 2>&1
)

if not exist "%~dp0webmouse_server.py" (
    echo [ERROR] Could not find or download webmouse_server.py.
    echo Please ensure webmouse_server.py is in the same folder as this bat file.
    echo.
    pause
    goto END_HANG
)

:: 3. Check dependencies
%PYTHON_CMD% -c "import websockets" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Installing 'websockets' library (takes ~5 seconds)...
    %PYTHON_CMD% -m pip install websockets
)

:: 4. Run server in persistent loop - will NEVER close
:RUN_SERVER_LOOP
echo.
echo ================================================================
echo [*] Starting WebMouse Server on Port 8765...
echo ================================================================
echo.

%PYTHON_CMD% webmouse_server.py

echo.
echo ================================================================
echo [NOTICE] WebMouse server stopped. Window will NOT close!
echo Press any key to restart the server...
echo ================================================================
pause
goto RUN_SERVER_LOOP

:END_HANG
echo Press any key to exit...
pause >nul
exit /b 0
