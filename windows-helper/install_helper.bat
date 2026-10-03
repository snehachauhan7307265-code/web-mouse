@echo off
setlocal enabledelayedexpansion
title WebMouse Helper Setup
color 0B
cd /d "%~dp0"

echo ================================================================
echo   WEBMOUSE HELPER SETUP
echo ================================================================
echo.
echo Installing WebMouse Helper to your Windows system...

set "TARGET_DIR=%LOCALAPPDATA%\WebMouseHelper"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [1/3] Copying application files to %TARGET_DIR%...
copy /y "webmouse_helper.py" "%TARGET_DIR%\" >nul
copy /y "run_helper.bat" "%TARGET_DIR%\" >nul

echo [2/3] Setting up Windows Auto-Start...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_SCRIPT=%TARGET_DIR%\start_silent.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo WshShell.Run "pythonw.exe """ ^& "%TARGET_DIR%\webmouse_helper.py""" , 0, False >> "%VBS_SCRIPT%"

:: Create startup shortcut
set "STARTUP_SHORTCUT=%STARTUP_FOLDER%\WebMouseHelper.vbs"
copy /y "%VBS_SCRIPT%" "%STARTUP_SHORTCUT%" >nul

echo [3/3] Launching WebMouse Helper...
echo.
echo ================================================================
echo   INSTALLATION COMPLETE!
echo   WebMouse Helper will now start automatically whenever Windows boots.
echo ================================================================
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    start "" python "%TARGET_DIR%\webmouse_helper.py"
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        start "" py "%TARGET_DIR%\webmouse_helper.py"
    ) else (
        echo Please ensure Python 3 is installed.
    )
)

exit /b 0
