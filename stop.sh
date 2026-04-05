#!/bin/bash

# SRServi Stop Script
# Usage: ./stop.sh

echo "Deteniendo SRServi..."

# Kill screen sessions
screen -X -S srservi-server 2>/dev/null && screen -S -X srservi-server quit 2>/dev/null && echo "Servidor detenido" || echo "Servidor no estaba corriendo"
screen -X -S srservi-client 2>/dev/null && screen -S -X srservi-client quit 2>/dev/null && echo "Cliente detenido" || echo "Cliente no estaba corriendo"

echo "Listo!"
