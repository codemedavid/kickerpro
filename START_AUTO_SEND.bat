@echo off
echo.
echo =============================================
echo    AUTO-SEND BACKGROUND SERVICE
echo =============================================
echo.
echo This will run auto-send in the background.
echo Messages will send automatically even when
echo browser is closed!
echo.
echo Press Ctrl+C to stop
echo.
echo =============================================
echo.

powershell -ExecutionPolicy Bypass -File auto-send-cron.ps1

