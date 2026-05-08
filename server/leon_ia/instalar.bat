@echo off
echo ============================================
echo  Leon IA - Instalacion de dependencias
echo ============================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Descargalo en: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Crear entorno virtual si no existe
if not exist "venv" (
    echo Creando entorno virtual...
    python -m venv venv
)

:: Activar e instalar
echo Instalando dependencias...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo.
echo ============================================
echo  Listo! Ahora instala Ollama si no lo tienes:
echo  https://ollama.com/download
echo.
echo  Luego descarga el modelo de IA:
echo  ollama pull qwen2.5:7b
echo.
echo  Y ejecuta: iniciar.bat
echo ============================================
pause
