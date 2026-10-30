@echo off
title Hospital Dietary Portal - Launcher
color 0b

echo ==============================================================================
echo    Hospital Dietary Department Meal Planning ^& Allergy Verification Portal
echo              Adaptive Explainable Allergy Risk Model (AEARM)
echo ==============================================================================
echo.
echo [1/3] Starting Django Backend Server (http://127.0.0.1:8000)...
start "AEARM Backend (Django)" /D "%~dp0backend" cmd /k python manage.py runserver 127.0.0.1:8000

echo [2/3] Starting React + Vite Frontend Server (http://localhost:5173)...
start "AEARM Frontend (React)" /D "%~dp0frontend" cmd /k npm run dev

echo [3/3] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul 2>&1

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ==============================================================================
echo  Portal started successfully!
echo ==============================================================================
echo.
echo  Authentic Credentials (Password is each user's name):
echo    - Doctor (CMO):     doctor1 or rajan     / rajan
echo    - Doctor (Gastro):  doctor2 or senthil   / senthil
echo    - Dietitian (Lead): dietitian1 or priya  / priya
echo    - Dietitian (Sr):   dietitian2 or kavitha / kavitha
echo    - Kitchen Staff:    kitchen1 or ramesh   / ramesh
echo    - Patient:          patient1 or aarthi   / aarthi
echo    - Administrator:    admin1 or admin      / admin
echo.
echo  Note: You can close this launcher window at any time.
echo  The two server terminal windows will remain running in the background.
echo  To stop all servers, run 'stop_project.bat'.
echo ==============================================================================
echo.
pause
