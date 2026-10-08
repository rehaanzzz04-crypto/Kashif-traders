@echo off
setlocal
title Kashif Traders - Cashier USB Thermal Printing
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js LTS is required.
 pause
 exit /b 1
)
echo ===================================================
echo KASHIF TRADERS - CASHIER LIVE USB PRINTER
echo ===================================================
echo BlackCopper 80mm printer must be connected.
echo This avoids Chrome/Edge print settings and 3276mm blank forms.
echo Cancel any Windows pending printer jobs before continuing.
echo Stop any old test bridge window with Ctrl+C.
echo.
set "KT_PRINT_ORIGIN=https://kashif-traders-git-working-from-p-4c5db6-milkestone-enterprises.vercel.app"
echo Default Working URL: %KT_PRINT_ORIGIN%
set "USER_ORIGIN="
set /p "USER_ORIGIN=Different working URL? Paste only https://hostname (Enter for default): "
if not "%USER_ORIGIN%"=="" set "KT_PRINT_ORIGIN=%USER_ORIGIN%"
echo Allowed website: %KT_PRINT_ORIGIN%
set "APPROVE="
set /p "APPROVE=Type YES-CASHIER to allow real receipt printing: "
if /I not "%APPROVE%"=="YES-CASHIER" (
 echo CANCELLED. No printer contacted.
 pause
 exit /b 0
)
set "KT_PRINT_DRY_RUN=0"
set "KT_PRINT_TEST_ONLY=0"
set "KT_PRINT_CASHIER=1"
echo Cashier USB Print Mode ACTIVE. Keep this window open.
echo Stop with Ctrl+C after billing.
node local-server\thermal-print-bridge.mjs
pause
