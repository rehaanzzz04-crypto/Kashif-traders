@echo off
setlocal
title Kashif Traders - 1 Slip Hardware Cutter Test
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js LTS required.
 pause
 exit /b 1
)
echo ONE supervised physical TEST-1 receipt with FULL CUT.
echo Verify the BlackCopper printer HAS an auto cutter first.
echo Stop previous printer bridge with Ctrl+C and clear printer queue.
echo Keep printer in view and power off if unexpected feed occurs.
set "APPROVE="
set /p "APPROVE=Type YES-CUT-TEST to start controlled cut mode: "
if /I not "%APPROVE%"=="YES-CUT-TEST" (
 echo Cancelled - no job sent.
 pause
 exit /b 0
)
set "KT_PRINT_DRY_RUN=0"
set "KT_PRINT_TEST_ONLY=1"
set "KT_PRINT_CASHIER=0"
set "KT_PRINT_AUTOCUT=1"
set "KT_PRINT_CUT_TEST=1"
echo.
echo CUT TEST MODE ACTIVE - no print yet.
echo Open print-one-thermal-test.cmd separately, then confirm PRINT-ONE.
node local-server\thermal-print-bridge.mjs
pause
