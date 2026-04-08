@echo off
title Claude Launcher
color 0A

:menu
cls
echo ================================
echo   Claude Launcher
echo ================================
echo.
echo  1 - Bypass permissions on (BPO)
echo  2 - Telegram + BPO
echo  3 - Qwen 3.6 (OpenRouter) + BPO
echo  4 - GLM 4.7 / 5.1 (Z.ai) + BPO
echo  5 - Default (no settings)
echo  0 - Exit
echo.
choice /c 123450 /n /m "Select: "

if %errorlevel%==6 goto :eof
if %errorlevel%==5 call C:\Users\1\DEV\PROCONTENT\cc.bat %* & goto :menu
if %errorlevel%==4 call C:\Users\1\DEV\PROCONTENT\ccglm.bat %* & goto :menu
if %errorlevel%==3 call C:\Users\1\DEV\PROCONTENT\ccqwen.bat %* & goto :menu
if %errorlevel%==2 call C:\Users\1\DEV\PROCONTENT\ccst.bat %* & goto :menu
if %errorlevel%==1 call C:\Users\1\DEV\PROCONTENT\ccs.bat %* & goto :menu
