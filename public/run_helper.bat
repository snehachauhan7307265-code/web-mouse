@echo off
setlocal
title WebMouse Helper [Windows]
cd /d "%~dp0"

echo ================================================================
echo   WEBMOUSE HELPER — Starting Windows Helper
echo ================================================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python is not installed.
        echo Please install Python 3.8+ from https://www.python.org/downloads/
        echo Make sure to check "Add Python to PATH" during installation.
        pause
        exit /b 1
    ) else (
        set PY_CMD=py
    )
) else (
    set PY_CMD=python
)

echo Starting WebMouse Helper window with Pair QR Code...
%PY_CMD% webmouse_helper.py
if %errorlevel% neq 0 (
    echo.
    echo Helper stopped or error occurred.
    pause
)
