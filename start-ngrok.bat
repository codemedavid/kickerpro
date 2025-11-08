@echo off
echo ========================================
echo Starting ngrok tunnel...
echo ========================================
echo.

cd /d "%~dp0"
npx ngrok http 3000

echo.
echo If you see an error, make sure:
echo 1. Port 3000 is free (dev server should be running on it)
echo 2. You have internet connection
echo.
pause




