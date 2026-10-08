@echo off
title Kashif Traders - ONE Supervised Printer Test
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js LTS is required.
 pause
 exit /b 1
)
echo WARNING: THIS WILL SEND A REAL, SHORT PRINT JOB AFTER CONFIRMATION.
echo Keep start-thermal-physical-test.cmd open in a separate window.
echo.
node local-server\print-one-thermal-test.mjs
echo.
pause
