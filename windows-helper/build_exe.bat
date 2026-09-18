@echo off
title WebMouse V1 — Build Standalone Windows EXE

echo =========================================================
echo       WEBMOUSE V1 — BUILD STANDALONE EXECUTABLE
echo =========================================================
echo.
echo Packaging WebMouse Helper into a single standalone .exe
echo with no console window and native tray icon...
echo.

pip install pyinstaller
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install PyInstaller.
    pause
    exit /b 1
)

echo.
echo [*] Compiling WebMouseHelper.exe (no console, single file)...
pyinstaller --noconsole --onefile --name WebMouseHelper --distpath "%~dp0dist" --workpath "%~dp0build" "%~dp0webmouse_server.py"

if %errorlevel% equ 0 (
    echo.
    echo =========================================================
    echo [SUCCESS] Built successfully!
    echo Executable location: windows-helper\dist\WebMouseHelper.exe
    echo =========================================================
) else (
    echo.
    echo [ERROR] PyInstaller compilation failed.
)

pause
