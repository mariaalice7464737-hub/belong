@echo off
REM Cape Town Dossier - sobe backend (8000) e frontend (5173) no Windows.
REM De dois cliques neste arquivo. Feche as janelas pretas para encerrar.
cd /d "%~dp0"

set PY=
python --version >nul 2>nul && set PY=python
if not defined PY py --version >nul 2>nul && set PY=py
if not defined PY (
  echo.
  echo [ERRO] Python nao encontrado.
  echo Instale em https://www.python.org/downloads/ e marque "Add python.exe to PATH".
  pause
  exit /b 1
)

%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)"
if errorlevel 1 (
  echo.
  echo [ERRO] Seu Python e antigo. Instale o Python 3.11 ou mais novo em https://www.python.org/downloads/
  pause
  exit /b 1
)

call npm --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao encontrado.
  echo Instale a versao LTS em https://nodejs.org/ e rode este arquivo de novo.
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  echo Criando ambiente Python e instalando dependencias...
  %PY% -m venv backend\.venv
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  if errorlevel 1 ( echo [ERRO] Falha ao instalar dependencias do backend. & pause & exit /b 1 )
)

if not exist "frontend\node_modules" (
  echo Instalando dependencias do frontend...
  pushd frontend
  call npm install
  if errorlevel 1 ( popd & echo [ERRO] Falha no npm install. & pause & exit /b 1 )
  popd
)

start "Cape Town - Backend" /D "%~dp0backend" cmd /k .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
start "Cape Town - Frontend" /D "%~dp0frontend" cmd /k npm run dev

echo Esperando o backend ligar...
set /a TRIES=0
:wait_backend
curl -s -o nul http://127.0.0.1:8000/api/health && goto backend_ok
set /a TRIES+=1
if %TRIES% GEQ 30 goto backend_fail
timeout /t 1 /nobreak >nul
goto wait_backend
:backend_fail
echo.
echo [ERRO] O backend nao respondeu. Olhe a janela "Cape Town - Backend" para ver a mensagem de erro.
pause
exit /b 1
:backend_ok
echo Backend ok. Abrindo o navegador...
timeout /t 3 /nobreak >nul
start "" http://localhost:5173
