@echo off
title Kashif Traders - SAFE Thermal Bridge Check (No Paper)
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js missing. Install Node.js LTS and reopen Command Prompt.
 pause
 exit /b 1
)
echo.
echo This checks DRY RUN ONLY. It will REFUSE to send tests if physical printing is ON.
echo Keep the other start-thermal-test.cmd window open.
echo.
node local-server\check-thermal-dry-run.mjs
echo.
pause
