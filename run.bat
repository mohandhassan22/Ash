@echo off
title Ash Pure ERP Launcher
echo ====================================================
echo          Starting Ash Pure ERP System...
echo ====================================================
echo.

if not exist node_modules (
    echo [1/3] Dependencies not found. Installing packages...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies. Please ensure Node.js is installed.
        pause
        exit /b %errorlevel%
    )
) else (
    echo [1/3] Dependencies are already installed.
)

echo.
echo [2/3] Starting Vite development server in the background...
start "Ash Pure ERP Server" cmd /k npm run dev

echo.
echo [3/3] Waiting for server to start...
timeout /t 3 /nobreak > nul

echo Opening browser...
start http://localhost:5173

echo.
echo ====================================================
echo Ash Pure ERP is now running!
echo You can view it in your browser: http://localhost:5173
echo.
echo Press any key to close this launcher helper.
echo ====================================================
pause
