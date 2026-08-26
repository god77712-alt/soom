@echo off
REM ==========================================================
REM  Daily overview collection - called by Windows Task Scheduler.
REM
REM  data.go.kr caps each operation at 1,000 calls per day. A day we skip
REM  is a day lost, so keep banking 2,000 rows while approval is pending.
REM
REM  ASCII ONLY in this file. cmd.exe parses the batch byte-by-byte before
REM  chcp can take effect, so UTF-8 Korean comments break every line after
REM  them ("'...' is not recognized as an internal or external command").
REM
REM  Calls node directly, not npm: the scheduler's PATH differs from a
REM  logon session and often cannot find npm.
REM
REM  Safe to run repeatedly - the collector stops itself once the daily
REM  quota is gone.
REM ==========================================================

set NODE="C:\Program Files\nodejs\node.exe"
set PROJ=C:\Users\user\Desktop\TOUR DATA
set TSX=%PROJ%\node_modules\tsx\dist\cli.mjs
set LOG=%PROJ%\data\daily.log

cd /d "%PROJ%"

echo. >> "%LOG%"
echo ===== %DATE% %TIME% ===== >> "%LOG%"

echo [KO] >> "%LOG%"
%NODE% --env-file=.env "%TSX%" scripts\collect-overview.ts >> "%LOG%" 2>&1

echo [EN] >> "%LOG%"
%NODE% --env-file=.env "%TSX%" scripts\collect-overview.ts --en >> "%LOG%" 2>&1

REM Each operation has its OWN 1,000/day cap, so these do not compete
REM with the overview calls above. A day we skip is a day lost.
echo [IMAGE] >> "%LOG%"
%NODE% --env-file=.env "%TSX%" scripts\collect-image.ts >> "%LOG%" 2>&1

echo [INTRO KO] >> "%LOG%"
%NODE% --env-file=.env "%TSX%" scripts\collect-intro.ts >> "%LOG%" 2>&1

echo [INTRO EN] >> "%LOG%"
%NODE% --env-file=.env "%TSX%" scripts\collect-intro.ts --en >> "%LOG%" 2>&1

REM Leave a status snapshot so the tail of the log answers "how far along".
echo [STATUS] >> "%LOG%"
%NODE% --env-file=.env "%TSX%" scripts\report-stage1.ts >> "%LOG%" 2>&1

exit /b 0
