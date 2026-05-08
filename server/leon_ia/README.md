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

## Puerto
El servicio corre en: http://localhost:7777

## Modelos compatibles
- `qwen2.5:7b` — Recomendado (~4GB RAM)
- `qwen2.5:3b` — Ligero (~2GB RAM)
- `llama3.2:3b` — Alternativa (~2GB RAM)
- `mistral:7b` — Buena opción (~4GB RAM)
