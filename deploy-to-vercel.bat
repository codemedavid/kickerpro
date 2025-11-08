@echo off
echo ========================================
echo   DEPLOYING TO VERCEL
echo ========================================
echo.
echo This will:
echo 1. Link to your existing Vercel project
echo 2. Deploy to production
echo.
echo When prompted:
echo - Set up and deploy? Y
echo - Link to existing project? Y  
echo - Project name? kickerpro
echo.
pause
echo.
vercel --prod

