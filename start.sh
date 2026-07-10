#!/bin/bash

# SRServi Deployment Script
# Usage: ./start.sh          → producción (usa .env.production)
#        ./start.sh local    → pruebas locales (usa .env.development, todo en 0.0.0.0)

set -e

MODE="${1:-prod}"
case "$MODE" in
    local|dev|development) MODE="local"; ENV_FILE=".env.development"; VITE_MODE="development" ;;
    prod|production)       MODE="prod";  ENV_FILE=".env.production";  VITE_MODE="production" ;;
    *) echo "Modo desconocido: $MODE (usa: local | prod)"; exit 1 ;;
esac

echo "=========================================="
echo "  SRServi - Starting Application ($MODE)"
echo "=========================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Sudo solo si no somos root
SUDO=""
if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
fi

# Seleccionar .env según el modo
echo "[1/6] Configurando entorno ($ENV_FILE)..."
if [ -f "server/$ENV_FILE" ]; then
    cp "server/$ENV_FILE" server/.env
    echo "  server/.env ← server/$ENV_FILE"
else
    echo "  ⚠ No existe server/$ENV_FILE — se mantiene server/.env actual"
fi

# Kill existing screens if running
echo "[2/6] Limpiando pantallas existentes..."
screen -S srservi-server -X quit 2>/dev/null || true
screen -S srservi-client -X quit 2>/dev/null || true

# Python3 — requerido por León IA (Ollama). Se instala si falta.
echo "[3/6] Verificando Python3 (León IA)..."
if ! command -v python3 >/dev/null 2>&1; then
    echo "  Instalando python3..."
    if command -v apt-get >/dev/null 2>&1; then
        $SUDO apt-get update -qq
        $SUDO apt-get install -y python3 python3-venv python3-pip
    elif command -v yum >/dev/null 2>&1; then
        $SUDO yum install -y python3 python3-pip
    else
        echo "  ⚠ No se encontró apt/yum — instala python3 manualmente"
    fi
fi
if command -v python3 >/dev/null 2>&1; then
    echo "  Python3 disponible ✓ ($(python3 --version 2>&1))"
fi

# GPU NVIDIA — informativo; autostart.js instala drivers si hace falta
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
    echo "  GPU NVIDIA detectada ✓ — Ollama la usará automáticamente:"
    nvidia-smi -L | sed 's/^/    /'
elif lspci 2>/dev/null | grep -qi nvidia; then
    echo "  ⚠ Hardware NVIDIA sin drivers — León IA intentará instalarlos al arrancar"
else
    echo "  Sin GPU NVIDIA — Ollama correrá en CPU"
fi

# Install server dependencies if needed
echo "[4/6] Verificando dependencias del servidor..."
if [ ! -d "server/node_modules" ]; then
    echo "Instalando dependencias del servidor..."
    cd server && npm install && cd ..
fi

# Install client dependencies if needed
echo "[5/6] Verificando dependencias del cliente..."
if [ ! -d "client/node_modules" ]; then
    echo "Instalando dependencias del cliente..."
    cd client && npm install && cd ..
fi

# Build client
echo "[6/6] Compilando cliente (modo $VITE_MODE)..."
cd client
npm run build -- --mode "$VITE_MODE"
cd ..

SERVER_LOG="/tmp/srservi-server.log"
> "$SERVER_LOG"

# Start server in screen with logging
echo "Iniciando servidor..."
screen -dmS srservi-server bash -c "cd $SCRIPT_DIR/server && npm run dev 2>&1 | tee $SERVER_LOG; exec bash"

# Start client preview in screen
echo "Iniciando cliente..."
screen -dmS srservi-client bash -c "cd $SCRIPT_DIR/client && npm run preview -- --host 0.0.0.0 --port 6666; exec bash"

echo ""
echo "=========================================="
echo "  SRServi iniciado! (modo $MODE)"
echo "=========================================="
echo ""
echo "Servidor API: http://localhost:8888"
echo "Cliente:      http://localhost:6666"
echo "León IA:      http://localhost:7777/health"
if [ "$MODE" = "local" ]; then
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$LAN_IP" ]; then
        echo ""
        echo "Acceso desde la red local:"
        echo "  Cliente:  http://$LAN_IP:6666"
        echo "  API:      http://$LAN_IP:8888"
        echo "  León IA:  http://$LAN_IP:7777"
    fi
fi
echo ""
echo "--- LOGS EN TIEMPO REAL (Ctrl+C para salir, el servidor sigue corriendo) ---"
echo ""

tail -f "$SERVER_LOG"
