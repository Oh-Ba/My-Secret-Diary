@echo off
title My Secret Diary - create Desktop shortcut
setlocal

set "HERE=%~dp0"
set "HOME_DIR=%HERE:~0,-1%"

echo Creating a "My Secret Diary" shortcut on your Desktop...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$sh = New-Object -ComObject WScript.Shell; $lnk = $sh.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'My Secret Diary.lnk')); $lnk.TargetPath = '%HERE%start.bat'; $lnk.WorkingDirectory = '%HOME_DIR%'; $lnk.IconLocation = '%HERE%icons\diary.ico'; $lnk.WindowStyle = 7; $lnk.Description = 'My Secret Diary'; $lnk.Save(); Write-Host 'Done. Look on your Desktop for the yellow keyhole.'"

echo.
echo Double-click it to open the diary. A small black window opens with it —
echo that window IS the diary running. Close it when you are finished.
echo.
pause
