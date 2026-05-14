@echo off
cd /d "%~dp0"
echo Starting local video downloader...
start "" http://127.0.0.1:3218
node server.js
