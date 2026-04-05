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
screen -X -S srservi-server 2>/dev/null && screen -S -X srservi-server quit 2>/dev/null || true
screen -X -S srservi-client 2>/dev/null && screen -S -X srservi-client quit 2>/dev/null || true

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

# Start server in screen
echo "Iniciando servidor en screen 'srservi-server'..."
screen -dmS srservi-server bash -c "cd $SCRIPT_DIR/server && npm run dev; exec bash"

sleep 2

# Start client preview in screen
echo "Iniciando cliente en screen 'srservi-client'..."
screen -dmS srservi-client bash -c "cd $SCRIPT_DIR/client && npm run preview -- --host 0.0.0.0 --port 6666; exec bash"

sleep 2

echo ""
echo "=========================================="
echo "  SRServi iniciado correctamente!"
echo "=========================================="
echo ""
echo "Servidor API: http://localhost:8888"
echo "Cliente:      http://localhost:6666"
echo ""
echo "Para ver los logs:"
echo "  screen -r srservi-server  (servidor)"
echo "  screen -r srservi-client  (cliente)"
echo ""
echo "Para salir de un screen: Ctrl+A, luego D"
echo ""
