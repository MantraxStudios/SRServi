#!/bin/bash

# SRServi Restart Script
# Usage: ./restart.sh

echo "Reiniciando SRServi..."

# Stop first
./stop.sh

# Wait a moment
sleep 2

# Start
./start.sh
