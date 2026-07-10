# León IA — Servicio Python

IA local con Ollama. Sin costos, sin internet, entiende español natural.

## Instalación (solo una vez)

### 1. Instalar Ollama
Descarga e instala desde: https://ollama.com/download/windows

### 2. Descargar el modelo de IA
Abre una terminal y ejecuta:
```
ollama pull qwen2.5:7b
```
> Si tu PC tiene poca RAM, usa el modelo pequeño: `ollama pull qwen2.5:3b`

### 3. Instalar dependencias Python
Doble clic en `instalar.bat`

## Uso diario

1. Ollama se inicia automáticamente con Windows
2. Doble clic en `iniciar.bat` para arrancar León IA
3. El servidor SRServi usará León IA automáticamente

## Puerto y configuración
El servicio corre por defecto en: http://0.0.0.0:7777 (accesible desde la red local).

Variables de entorno (se leen del `.env` del servidor — ver `server/.env.production` y `server/.env.development`):
- `LEON_HOST` — IP de escucha (`127.0.0.1` en producción, `0.0.0.0` para pruebas locales)
- `LEON_PORT` — puerto (default 7777)
- `OLLAMA_URL` — URL de Ollama (default http://localhost:11434)
- `LEON_MODEL` — forzar un modelo específico
- `LEON_AUTOSTART=1` — forzar el autoarranque fuera de Linux
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — conexión MySQL

## GPU NVIDIA
En Linux, el autoarranque (`autostart.js`) detecta la GPU automáticamente:
- Si hay GPU con drivers → Ollama la usa y se descarga el modelo grande (qwen2.5:7b)
- Si hay GPU sin drivers → intenta instalarlos (puede requerir reinicio)
- Sin GPU → modelo ligero (qwen2.5:3b) en CPU

En Windows, instala los drivers NVIDIA normales (GeForce/Studio) y Ollama usa la GPU solo.

## Modelos compatibles
- `qwen2.5:7b` — Recomendado (~4GB RAM)
- `qwen2.5:3b` — Ligero (~2GB RAM)
- `llama3.2:3b` — Alternativa (~2GB RAM)
- `mistral:7b` — Buena opción (~4GB RAM)
