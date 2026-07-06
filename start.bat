@echo off
chcp 65001 >nul 2>&1

echo ==========================================
echo   SRServi - Inicio Local (Windows)
echo ==========================================

set SCRIPT_DIR=%~dp0

:: Instalar dependencias del servidor
echo [1/3] Instalando dependencias del servidor...
cd /d "%SCRIPT_DIR%server"
call npm install

:: Instalar dependencias del cliente
echo [2/3] Instalando dependencias del cliente...
cd /d "%SCRIPT_DIR%client"
call npm install

:: Compilar cliente
echo [3/3] Compilando cliente...
cd /d "%SCRIPT_DIR%client"
call npm run build

echo.
echo ==========================================
echo   Iniciando servicios...
echo ==========================================

:: Iniciar servidor en nueva ventana
start "SRServi - Server" cmd /k "cd /d %SCRIPT_DIR%server && npm run dev"

:: Iniciar cliente preview en nueva ventana
start "SRServi - Client" cmd /k "cd /d %SCRIPT_DIR%client && npx vite preview --host 0.0.0.0 --port 6666"

echo.
echo ==========================================
echo   SRServi iniciado!
echo ==========================================
echo.
echo Servidor API: http://localhost:8888
echo Cliente:      http://localhost:6666
echo.
echo Las ventanas del servidor y cliente estan abiertas por separado.
pause
