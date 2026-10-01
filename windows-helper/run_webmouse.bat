@echo off
setlocal enabledelayedexpansion
title WebMouse V1 — Windows Helper Server [PORT 8765]
color 0A

:: Ensure working directory is this script folder
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
    echo [ERROR] Could not find webmouse_server.py.
    echo Please ensure webmouse_server.py is in the same folder as this bat file.
    echo.
    pause
    goto END_HANG
)

:: 3. Check and install dependencies
%PYTHON_CMD% -c "import websockets" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Installing required 'websockets' library (takes ~5 seconds)...
    %PYTHON_CMD% -m pip install websockets
)

%PYTHON_CMD% -c "import pyautogui" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Installing 'pyautogui' and 'pyperclip' for Windows mouse control...
    %PYTHON_CMD% -m pip install pyautogui pyperclip
)

:: 4. Run server in persistent loop - will NEVER close accidentally
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
