@echo off
title Kashif Traders - 80mm RAW Thermal Test
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS first.
 pause
 exit /b 1
)
set "KT_PRINT_DRY_RUN=1"
if /I "%~1"=="print" set "KT_PRINT_DRY_RUN=0"
echo RAW PRINT TEST. Mode: %KT_PRINT_DRY_RUN% (1 is safe dry-run, 0 sends paper).
echo Windows default browser receipt printing remains unchanged.
echo Ctrl+C to stop.
node local-server\thermal-print-bridge.mjs
pause
