@echo off
setlocal
title Kashif Traders - Direct Thermal Print
echo.
echo Kashif Traders Cashier Direct Print
echo -----------------------------------
echo IMPORTANT: Windows default printer must be your 80mm thermal printer.
echo Save the printer paper settings once in Windows printer preferences.
echo Use Google Chrome for a separate dedicated cashier printing window.
echo.
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome not found. Install Chrome once or use the documented Edge setup.
  pause
  exit /b 1
)
set "CASHIER_URL=https://kashif-traders-git-working-from-p-4c5db6-milkestone-enterprises.vercel.app/cashier-sales.html?directPrint=1"
start "Kashif Traders Cashier" "%CHROME%" --user-data-dir="%LOCALAPPDATA%\KashifTraders\CashierDirectPrintProfile" --no-first-run --app="%CASHIER_URL%"
echo Cashier launched. Sign in once in the dedicated window.
echo SAFETY NOTICE: Direct printing is paused due to excess blank paper. Use Print Receipt PDF until safe driver-specific printing is ready.
echo If print preview still opens, check Windows default printer and Chrome version.
endlocal
