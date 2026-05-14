#!/bin/bash

# SRServi Deployment Script
# Usage: ./start.sh

set -e

echo "=========================================="
echo "  SRServi - Starting Application"
echo "=========================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill existing screens if running
echo "[1/4] Limpiando pantallas existentes..."
screen -S srservi-server -X quit 2>/dev/null || true
screen -S srservi-client -X quit 2>/dev/null || true

# Install server dependencies if needed
echo "[2/4] Verificando dependencias del servidor..."
if [ ! -d "server/node_modules" ]; then
    echo "Instalando dependencias del servidor..."
    cd server && npm install && cd ..
fi

# Install client dependencies if needed
echo "[3/4] Verificando dependencias del cliente..."
if [ ! -d "client/node_modules" ]; then
    echo "Instalando dependencias del cliente..."
    cd client && npm install && cd ..
fi

# Build client for production
echo "[4/4] Compilando cliente para producción..."
cd client
npm run build
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
echo "  SRServi iniciado!"
echo "=========================================="
echo ""
echo "Servidor API: http://localhost:8888"
echo "Cliente:      http://localhost:6666"
echo ""
echo "--- LOGS EN TIEMPO REAL (Ctrl+C para salir, el servidor sigue corriendo) ---"
echo ""

tail -f "$SERVER_LOG"
