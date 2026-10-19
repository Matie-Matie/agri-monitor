@echo off
rem ============================================================
rem  Agri Monitor - Web-Based POS and Inventory System
rem  Mitch Agri Supply, Roxas, Isabela
rem  Double-click to start the system. No tech skills needed.
rem  1. Starts the database (XAMPP MySQL) if it is not running
rem  2. Prepares / updates the database automatically
rem  3. Opens the system in your browser
rem  Keep this window open while using the system.
rem  To stop: press CTRL+C in this window, then close it.
rem ============================================================
title Agri Monitor - Mitch Agri Supply
cd /d "%~dp0"
set PORT=5000
goto check_node

:check_node
where node >nul 2>nul
if errorlevel 1 goto no_node
goto check_modules

:no_node
echo.
echo  [ERROR] Node.js was not found on this computer.
echo  Install Node.js (the LTS version) from nodejs.org, then
echo  double-click this file again.
echo.
pause
exit /b 1

:check_modules
if exist "backend\node_modules\express\package.json" goto check_screens
echo.
echo  System files are missing - trying to install them (needs internet)...
echo.
pushd backend
call npm install --omit=dev
set NPMERR=%errorlevel%
popd
if not "%NPMERR%"=="0" goto modules_fail
goto check_screens

:modules_fail
echo.
echo  [ERROR] Could not install the system files (no internet?).
echo  Download a fresh ZIP of Agri Monitor from GitHub, extract it to a
echo  new folder, and run this file again. The ZIP already contains them.
echo  If it still fails, take a photo of this window and send it to Mat.
echo.
pause
exit /b 1

:check_screens
if exist "frontend\dist\index.html" goto check_env
echo.
echo  Screen files are missing - trying to build them (needs internet)...
echo.
pushd frontend
if not exist "node_modules" call npm install
call npm run build -- --mode handover
set BUILDERR=%errorlevel%
popd
if not "%BUILDERR%"=="0" goto screens_fail
goto check_env

:screens_fail
echo.
echo  [ERROR] Could not build the screen files (no internet?).
echo  Download a fresh ZIP of Agri Monitor from GitHub, extract it to a
echo  new folder, and run this file again. The ZIP already contains them.
echo  If it still fails, take a photo of this window and send it to Mat.
echo.
pause
exit /b 1

:check_env
if exist "backend\.env" goto check_mysql
if not exist "backend\.env.example" goto no_env
echo.
echo  First run - creating your settings file...
copy /y "backend\.env.example" "backend\.env" >nul
if errorlevel 1 goto no_env
goto check_mysql

:no_env
echo.
echo  [ERROR] The settings file (backend\.env) is missing.
echo  Please contact Mat to finish setup.
echo.
pause
exit /b 1

:check_mysql
netstat -an | findstr ":3306.*LISTENING" >nul 2>&1
if not errorlevel 1 goto prepare_db
if not exist "C:\xampp\mysql\bin\mysqld.exe" goto mysql_manual
echo.
echo  Starting the database...
start "" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone --console
timeout /t 5 /nobreak >nul
goto prepare_db

:mysql_manual
echo.
echo  The database (MySQL) is not running.
echo  Open XAMPP Control Panel and press Start on MySQL
echo  (Apache is NOT needed), then double-click this file again.
echo.
pause
exit /b 1

:prepare_db
echo.
echo  Preparing the database. The very first time takes about a minute...
echo.
pushd backend
call node db\setup.js
set DBERR=%errorlevel%
popd
if "%DBERR%"=="0" goto start_server
if "%DBERR%"=="2" goto db_down
goto db_fail

:db_down
echo.
echo  [ERROR] Could not reach the database.
echo  1. Open XAMPP Control Panel
echo  2. Press Start on MySQL (Apache is not needed)
echo  3. Double-click this file again
echo  If it still fails, take a photo of this window and send it to Mat.
echo.
pause
exit /b 1

:db_fail
echo.
echo  [ERROR] Database setup did not finish. Read the text above this message.
echo  Take a photo of this window and send it to Mat.
echo.
pause
exit /b 1

:start_server
echo.
echo  ============================================================
echo   Agri Monitor is starting...
echo   Opening http://localhost:%PORT% in your browser.
echo   Logins: admin / admin123   and   cashier / cashier123
echo   (change these passwords on day one)
echo   Keep this window OPEN while using the system.
echo   To stop: press CTRL+C here, then close the window.
echo  ============================================================
echo.
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%"
pushd backend
set PORT=%PORT%
call node server.js
popd
echo.
echo  The system has stopped. You may close this window.
pause
exit /b 0
