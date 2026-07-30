@echo off
title DiepCustom Server - localhost:7192

:: Set the port for the server
if "%PORT%"=="" set PORT=7192

echo ===================================================
echo   Starting DiepCustom Server on http://localhost:%PORT%
echo ===================================================
echo.

:: Check if TypeScript / node_modules executables exist, install/repair if missing
if not exist node_modules\.bin\tsc.cmd (
    echo Dependencies or executables missing in node_modules. Running npm install...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Please check your Node.js setup.
        pause
        exit /b %errorlevel%
    )
    echo.
)

:: Compile tanks.spclng into TankDefinitions.json & tanks.json
echo [SPCLNG] Parsing tanks.spclng...
call npm run parse-spclng
if errorlevel 1 (
    echo [ERROR] SPCLNG compilation failed. Stopping server startup.
    pause
    exit /b %errorlevel%
)
echo.

:: Build and launch server
call npm run server

pause
