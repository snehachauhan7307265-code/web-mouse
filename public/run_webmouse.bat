@echo off
setlocal enabledelayedexpansion
title WebMouse V1 — Windows Helper Server [PORT 8765]
color 0A

echo ================================================================
echo           WEBMOUSE V1 — WINDOWS HELPER (CMD LAUNCHER)
echo ================================================================
echo.
echo [*] Starting WebMouse server for remote smartphone control...
cd /d "%~dp0"

:: 1. Detect Python
set PYTHON_CMD=python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py
    ) else (
        echo [ERROR] Python is not found in your system PATH!
        echo.
        echo Please install Python from https://www.python.org/downloads/
        echo (Check the box "Add Python to PATH" during installation)
        echo.
        pause
        exit /b 1
    )
)

echo [*] Python detected:
%PYTHON_CMD% --version
echo.

:: 2. Ensure webmouse_server.py exists
if not exist "%~dp0webmouse_server.py" (
    echo [*] Downloading latest webmouse_server.py...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py' -OutFile '%~dp0webmouse_server.py' -TimeoutSec 15 } catch { (New-Object Net.WebClient).DownloadFile('https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py', '%~dp0webmouse_server.py') }" >nul 2>&1
)

:: 3. Quick dependency check
%PYTHON_CMD% -c "import websockets, pyautogui" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Installing required Python libraries (websockets, pyautogui)...
    %PYTHON_CMD% -m pip install websockets pyautogui
)

:: 4. Run server directly in this window
echo.
echo [*] Launching WebMouse Server...
echo ================================================================
%PYTHON_CMD% webmouse_server.py

echo.
echo ================================================================
echo WebMouse server stopped.
echo ================================================================
pause
