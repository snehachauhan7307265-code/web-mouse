@echo off
title WebMouse V1 - Windows Helper Server [PORT 8765]
color 0A
cd /d "%~dp0"

echo ================================================================
echo           WEBMOUSE V1 - WINDOWS HELPER (CMD LAUNCHER)
echo ================================================================
echo.
echo [*] Initializing WebMouse Windows Helper...
echo [*] Window will STAY OPEN so you can read your 6-Digit PIN!
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
goto CHECK_SERVER_FILE

:NO_PYTHON
echo ================================================================
echo [ERROR] Python is not installed or not in PATH!
echo ================================================================
echo.
echo Step 1: Download Python from: https://www.python.org/downloads/
echo Step 2: During setup, CHECK the box: "Add python.exe to PATH"
echo Step 3: Run this file again!
echo.
echo ================================================================
echo Keeping window OPEN so you can read this message.
echo.
pause
goto END_LOOP

:CHECK_SERVER_FILE
if exist "%~dp0webmouse_server.py" goto RUN_SERVER_LOOP
if exist "%~dp0windows-helper\webmouse_server.py" (
    copy /y "%~dp0windows-helper\webmouse_server.py" "%~dp0webmouse_server.py" >nul
    goto RUN_SERVER_LOOP
)

echo [*] Downloading latest webmouse_server.py...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://ais-dev-6o3nmbyzug3q657ngky2wo-972641513496.asia-southeast1.run.app/webmouse_server.py', '%~dp0webmouse_server.py')" >nul 2>&1

if exist "%~dp0webmouse_server.py" goto RUN_SERVER_LOOP

echo.
echo ================================================================
echo [ERROR] webmouse_server.py was not found!
echo Please make sure webmouse_server.py is in the SAME folder.
echo (Or download WebMouse-Windows.zip to get all files together!)
echo ================================================================
pause
goto END_LOOP

:RUN_SERVER_LOOP
echo.
echo ================================================================
echo [*] Starting WebMouse Server on Port 8765...
echo ================================================================
echo.

%PYTHON_CMD% "%~dp0webmouse_server.py"

echo.
echo ================================================================
echo [NOTICE] WebMouse server stopped. Window will NOT close!
echo Press any key to restart WebMouse...
echo ================================================================
pause
goto RUN_SERVER_LOOP

:END_LOOP
echo.
echo Press any key to retry...
pause >nul
goto RUN_SERVER_LOOP
