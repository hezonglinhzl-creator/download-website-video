@echo off
cd /d "%~dp0"
node -e "process.exit(0)" >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to build this project.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "build\build-portable-win.ps1"
pause
