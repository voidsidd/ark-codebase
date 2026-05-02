@echo off
title Vanguard Frontend Dev Server
echo [SYSTEM] Navigating to frontend directory...
cd /d "%~dp0frontend"
echo [SYSTEM] Starting Vanguard Frontend on http://localhost:5173...
set PATH=%~dp0node;%PATH%
call npm.cmd run dev
pause
