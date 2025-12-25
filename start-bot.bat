@echo off
title Galaxy Discord Bot
cd /d "%~dp0"

:: Crash loop detection settings
set MAX_CRASHES=5
set CRASH_WINDOW=60
set CRASH_COUNT=0
set LAST_CRASH_TIME=0

:loop
echo.
echo [%date% %time%] Starting Galaxy Discord Bot...
echo ================================================

:: Record start time (in seconds since midnight, approximate)
for /f "tokens=1-3 delims=:." %%a in ("%time: =0%") do (
    set /a START_TIME=%%a*3600+%%b*60+%%c
)

node index.js
set EXIT_CODE=%ERRORLEVEL%

:: Calculate runtime
for /f "tokens=1-3 delims=:." %%a in ("%time: =0%") do (
    set /a END_TIME=%%a*3600+%%b*60+%%c
)
set /a RUNTIME=%END_TIME%-%START_TIME%
if %RUNTIME% lss 0 set /a RUNTIME+=86400

echo.
echo ================================================
echo [%date% %time%] Bot exited with code %EXIT_CODE% (runtime: %RUNTIME% seconds)

:: Handle exit codes
if %EXIT_CODE%==0 (
    echo [%date% %time%] Restart requested. Restarting in 2 seconds...
    set CRASH_COUNT=0
    timeout /t 2 /nobreak >nul
    goto loop
)

if %EXIT_CODE%==1 (
    echo [%date% %time%] Clean shutdown. Goodbye!
    echo.
    pause
    exit
)

:: Crash detected - increment counter
set /a CRASH_COUNT=%CRASH_COUNT%+1
echo [%date% %time%] Crash detected! Count: %CRASH_COUNT%/%MAX_CRASHES%

:: Check for crash loop
if %CRASH_COUNT% geq %MAX_CRASHES% (
    echo.
    echo ===============================================
    echo   *** CRASH LOOP DETECTED - STOPPING BOT ***
    echo ===============================================
    echo   %MAX_CRASHES% crashes detected.
    echo   Please check the logs and fix the issue.
    echo ===============================================
    echo.
    pause
    exit /b 1
)

:: Calculate remaining attempts
set /a REMAINING=%MAX_CRASHES%-%CRASH_COUNT%
echo [%date% %time%] Remaining restart attempts: %REMAINING%/%MAX_CRASHES%
echo [%date% %time%] Restarting in 5 seconds...
timeout /t 5 /nobreak >nul

:: Reset crash count if bot ran for more than CRASH_WINDOW seconds
if %RUNTIME% gtr %CRASH_WINDOW% (
    set CRASH_COUNT=0
)

goto loop