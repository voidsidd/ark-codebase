@echo off
title Vanguard Backend Server
echo [SYSTEM] Navigating to backend directory...
cd /d "%~dp0backend"
echo [SYSTEM] Starting Vanguard API Backend on port 3333...
"%~dp0node\node.exe" server.js
pause
