@echo off
REM Wrapper omkring start-local.ps1 der kalder powershell med ExecutionPolicy Bypass.
REM Brugen er den samme som .ps1-scriptet - alle argumenter sendes uændret videre.
REM Eksempel: scripts\start-local.cmd -RobotIp 192.168.1.155
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-local.ps1" %*
