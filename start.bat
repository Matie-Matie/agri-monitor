@echo off
rem ============================================================
rem  Agri Monitor - Web-Based POS and Inventory System
rem  Mitch Agri Supply, Roxas, Isabela
rem  Double-click to start the system. No tech skills needed.
rem  1. Starts XAMPP MySQL automatically (Apache is not needed)
rem  2. Prepares / updates the database automatically
rem  3. Opens the system fullscreen when the server is ready
rem  Keep this black window OPEN while using the system.
rem  To stop: press CTRL+C in this window, then close it.
rem ============================================================
title Agri Monitor - Mitch Agri Supply
cd /d "%~dp0"
set PORT=5000

rem ---- Locate XAMPP (MySQL only; Apache is not used) ----
set "XAMPP_DIR="
if exist "C:\xampp\mysql\bin\mysqld.exe" set "XAMPP_DIR=C:\xampp"
if not defined XAMPP_DIR if exist "D:\xampp\mysql\bin\mysqld.exe" set "XAMPP_DIR=D:\xampp"
if not defined XAMPP_DIR if exist "E:\xampp\mysql\bin\mysqld.exe" set "XAMPP_DIR=E:\xampp"
if not defined XAMPP_DIR if exist "%SystemDrive%\xampp\mysql\bin\mysqld.exe" set "XAMPP_DIR=%SystemDrive%\xampp"

rem ---- Locate Chrome or Edge for the fullscreen window ----
set "BROWSER_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

rem ---- Already running? Just open it fullscreen ----
netstat -an | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto already_running
goto check_node

:already_running
echo.
echo  Agri Monitor is already running. Opening it fullscreen...
echo.
call :open_browser
exit /b 0

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
echo.
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
netstat -an | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto prepare_db
if not defined XAMPP_DIR goto mysql_missing
echo.
echo  Starting XAMPP MySQL automatically...
start "" /min "%XAMPP_DIR%\mysql\bin\mysqld.exe" --defaults-file="%XAMPP_DIR%\mysql\bin\my.ini" --standalone --console
call :wait_mysql
if errorlevel 1 goto mysql_manual
echo  Database is running.
goto prepare_db

:mysql_manual
echo.
echo  XAMPP MySQL did not start automatically.
if exist "%XAMPP_DIR%\xampp-control.exe" start "" "%XAMPP_DIR%\xampp-control.exe"
echo  The XAMPP Control Panel was opened. Press Start on MySQL
echo  (Apache is NOT needed), then press any key here to try again.
echo.
if defined MYSQL_RETRIED goto mysql_still_down
set "MYSQL_RETRIED=1"
pause >nul
goto check_mysql

:mysql_still_down
echo.
echo  [ERROR] MySQL is still not running.
echo  Close this window, open the XAMPP Control Panel, press Start
echo  on MySQL, then double-click start.bat again.
echo  If it still fails, take a photo of this window and send it to Mat.
echo.
pause
exit /b 1

:mysql_missing
echo.
echo  [ERROR] The database (MySQL) is not running and XAMPP was not found.
echo  Install XAMPP (only MySQL is needed) on C: or D:, then
echo  double-click this file again.
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
echo  1. Double-click start.bat again - it starts XAMPP MySQL for you.
echo  2. If it still fails, open XAMPP Control Panel, press Start on
echo     MySQL (Apache is not needed), then run start.bat again.
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
echo   A fullscreen window will open when the server is ready.
echo   Logins: admin / admin123   and   cashier / cashier123
echo   (change these passwords on day one)
echo   Keep this window OPEN while using the system.
echo   To stop: press CTRL+C here, then close the window.
echo  ============================================================
echo.
timeout /t 2 /nobreak >nul
pushd backend
set PORT=%PORT%
set OPEN_BROWSER=1
call node server.js
popd
echo.
echo  The system has stopped. You may close this window.
pause
exit /b 0

rem ---- Subroutines -------------------------------------------------

rem Opens the system: app-style window, fullscreen, when Chrome/Edge exists.
:open_browser
if not defined BROWSER_EXE goto open_browser_default
start "" "%BROWSER_EXE%" --app=http://localhost:%PORT% --start-fullscreen
exit /b 0

:open_browser_default
start "" "http://localhost:%PORT%"
exit /b 0

rem Waits up to 30 seconds for MySQL to accept connections on port 3306.
:wait_mysql
set /a MYSQL_WAIT=0
:wait_mysql_loop
netstat -an | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 exit /b 0
set /a MYSQL_WAIT+=1
if %MYSQL_WAIT% GEQ 30 exit /b 1
timeout /t 1 /nobreak >nul
goto wait_mysql_loop
