@echo off
setlocal
title Commodity Desk Launcher
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm are required.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  where py >nul 2>&1
  if errorlevel 1 (
    echo Python 3 with the py launcher is required.
    pause
    exit /b 1
  )
  echo Creating Python environment...
  py -3 -m venv .venv
  if errorlevel 1 goto :setup_failed
)

".venv\Scripts\python.exe" -c "import flask, kiteconnect, dotenv, requests" >nul 2>&1
if errorlevel 1 (
  echo Installing Python dependencies...
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto :setup_failed
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing frontend dependencies...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto :setup_failed
)

if not defined KITE_SOURCE_ENV (
  if not exist "D:\stock-basket\.env" (
    echo Kite credentials were not found at D:\stock-basket\.env.
    echo EIA reports can still load. Set KITE_SOURCE_ENV for another Kite environment file.
  )
)

if /I "%~1"=="--check" (
  echo Commodity Desk launcher prerequisites are ready.
  exit /b 0
)

echo Starting Commodity Desk API on http://127.0.0.1:5004
start "Commodity Desk API" /D "%~dp0" "%ComSpec%" /k ".venv\Scripts\python.exe -m backend.app"
echo Starting Commodity Desk UI on http://127.0.0.1:4174
start "Commodity Desk UI" /D "%~dp0" "%ComSpec%" /k "npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:4174"
echo Close both service windows to stop Commodity Desk.
exit /b 0

:setup_failed
echo Setup failed. Review the error above, then run start.bat again.
pause
exit /b 1
