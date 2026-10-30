@echo off
title Hospital Dietary Portal - Shutdown
color 0c

echo ==============================================================================
echo    Stopping Hospital Dietary Portal Servers...
echo ==============================================================================
echo.

echo Stopping Django Backend on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping Vite Frontend on port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ==============================================================================
echo  All portal servers have been stopped.
echo ==============================================================================
echo.
pause
