@echo off
echo ====================================================
echo   NexusAI — One-Click Setup Script
echo ====================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [!] Node.js is NOT installed.
  echo.
  echo Please install Node.js from: https://nodejs.org
  echo Download the LTS version, install it, then run this script again.
  echo.
  pause
  start https://nodejs.org
  exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

echo [1/3] Installing dependencies...
npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/3] Dependencies installed!
echo.

echo [3/3] Starting NexusAI server...
echo.
echo ====================================================
echo   Server starting at: http://localhost:3000
echo   Open this URL in your browser!
echo ====================================================
echo.

npm start
pause
