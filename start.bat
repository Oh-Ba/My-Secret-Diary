@echo off
title My Secret Diary
cd /d "%~dp0"
set PORT=4173

echo.
echo   My Secret Diary is running at http://localhost:%PORT%
echo   This window IS the diary. Close it when you are finished.
echo.

rem Serve on 127.0.0.1 only: nothing else on the Wi-Fi can reach it.
rem The browser opens a couple of seconds later, once the server is listening.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:%PORT%/index.html"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
    start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:%PORT%/index.html"
    npx --yes http-server -p %PORT% -a 127.0.0.1 -c-1 .
    goto :eof
)

echo   Neither Python nor Node.js was found on this PC.
echo.
echo   Easiest fix: install Python from the Microsoft Store (search "Python"),
echo   then run this file again.
echo.
echo   Or open index.html directly in your browser — it works, but browsers
echo   treat file:// storage as throwaway and may wipe your pages.
echo.
pause
