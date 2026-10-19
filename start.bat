@echo off
setlocal
title Agri Monitor - Launcher
echo.
echo  =============================================
echo    AGRI MONITOR  -  one-click launcher
echo  =============================================
echo.

set ROOT=C:\Projects\Clients\Roan\agri-monitor
set MYSQLD=C:\xampp\mysql\bin\mysqld.exe
set BACKEND=%ROOT%\backend
set FRONTEND=%ROOT%\frontend

echo  [1/4] Starting MariaDB (database)...
if not exist "%MYSQLD%" goto :nomysql

netstat -an | findstr ":3306.*LISTENING" >nul 2>&1
if %errorlevel%==0 goto :mysqlup

start "" "%MYSQLD%" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone --console
ping -n 5 127.0.0.1 >nul
echo         Started.
goto :mysqlup

:nomysql
echo         ERROR: mysqld.exe not found at %MYSQLD%
pause
exit /b 1

:mysqlup
echo         MariaDB ready.

echo  [2/4] Starting backend API  (port 5000)...
start "AgriMonitor-Backend" /D "%BACKEND%" cmd /c "npm run start"

echo  [3/4] Starting frontend      (port 5173)...
start "AgriMonitor-Frontend" /D "%FRONTEND%" cmd /c "npm run dev"

echo  [4/4] Opening the app...
ping -n 6 127.0.0.1 >nul
start "" "http://localhost:5173"

echo.
echo  Done! If the browser didn't open, go to:  http://localhost:5173
echo  Backend logs will appear in the two new windows.
echo  To stop everything: close those two command windows, then close mysqld.
echo.
pause >nul 2>&1