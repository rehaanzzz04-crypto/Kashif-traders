@echo off
setlocal
title Kashif Traders - One-Item Physical Printer Test ONLY
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js LTS is required.
 pause
 exit /b 1
)
echo ====================================================
echo WARNING - PHYSICAL PRINTER TEST
echo ====================================================
echo This mode can send ONE short test slip to BlackCopper.
echo Stop the previous DRY_RUN server using Ctrl+C FIRST.
echo Ensure the printer queue is empty and paper is loaded.
echo Do not use this test until the printer supports ESC/POS.
echo Do not attempt a real customer invoice here.
echo If paper feeds unexpectedly, cancel job and power off.
echo.
set "CONFIRM="
set /p "CONFIRM=Type YES-TEST to allow ONE test print: "
if /I not "%CONFIRM%"=="YES-TEST" (
 echo Cancelled. Printer was NOT contacted.
 pause
 exit /b 0
)
set "KT_PRINT_DRY_RUN=0"
set "KT_PRINT_TEST_ONLY=1"
echo.
echo PHYSICAL TEST MODE ACTIVE. This is not unattended printing.
echo Now open print-one-thermal-test.cmd in a SECOND window.
echo Keep this window open; Ctrl+C to stop.
echo.
node local-server\thermal-print-bridge.mjs
pause
