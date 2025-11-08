@echo off
echo ========================================
echo Fetching ngrok URL...
echo ========================================
echo.

powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels'; $httpsUrl = ($response.tunnels | Where-Object { $_.proto -eq 'https' }).public_url; if ($httpsUrl) { Write-Host ''; Write-Host 'SUCCESS! Your ngrok URL is:' -ForegroundColor Green; Write-Host $httpsUrl -ForegroundColor Cyan; Write-Host ''; Write-Host 'Copy this URL and:' -ForegroundColor Yellow; Write-Host '1. Add to Facebook App OAuth Redirect URIs:'; Write-Host "   $httpsUrl/api/auth/callback" -ForegroundColor Cyan; Write-Host ''; Write-Host '2. Update .env.local with:'; Write-Host "   NEXT_PUBLIC_APP_URL=$httpsUrl" -ForegroundColor Cyan; Write-Host ''; } else { Write-Host 'ngrok is running but no tunnels found.' -ForegroundColor Red; } } catch { Write-Host 'Error: ngrok is not running!' -ForegroundColor Red; Write-Host 'Please start ngrok first by running start-ngrok.bat' -ForegroundColor Yellow; }"

echo.
pause




