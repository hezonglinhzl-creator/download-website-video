@echo off
setlocal
cd /d "%~dp0"
start "" /min "%~dp0node.exe" "%~dp0server.js"
exit /b 0
