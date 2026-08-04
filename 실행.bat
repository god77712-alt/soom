@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo   서버를 켜는 중입니다. 잠시 후 브라우저가 자동으로 열립니다.
echo   끄려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo.

start "" cmd /c "timeout /t 8 > nul && start http://localhost:3000"
call npm run dev
