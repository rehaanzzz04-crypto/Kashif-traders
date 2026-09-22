@echo off
title Kashif Traders Local Billing Server
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js install nahi hai. Pehle setup-windows.cmd chalayein.
  pause
  exit /b 1
)
node local-server\server.mjs
pause

