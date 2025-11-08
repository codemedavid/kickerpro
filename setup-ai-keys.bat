@echo off
echo.
echo ========================================
echo   Adding OpenRouter API Keys
echo ========================================
echo.

:: Add OpenRouter API keys to .env.local
echo OPENROUTER_API_KEY_1=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 >> .env.local
echo OPENROUTER_API_KEY_2=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 >> .env.local

echo.
echo ✅ OpenRouter API keys added to .env.local
echo.
echo Next steps:
echo 1. Run: npm run dev
echo 2. The AI features are now active!
echo.
pause

