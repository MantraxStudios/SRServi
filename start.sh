#!/bin/bash

# SRServi Deployment Script
# Usage: ./start.sh          → producción (usa .env.production)
#        ./start.sh local    → pruebas locales (usa .env.development, todo en 0.0.0.0)

set -e

# Auto-elevar a root: las instalaciones (Ollama, drivers NVIDIA, python3)
# corren dentro del proceso de Node y necesitan permisos de root.
if [ "$(id -u)" != "0" ]; then
    if command -v sudo >/dev/null 2>&1; then
        echo "Elevando permisos con sudo (necesario para instalar Ollama/drivers/python3)..."
        exec sudo -E bash "$0" "$@"
    else
        echo "ERROR: ejecuta este script como root (no hay sudo disponible):"
        echo "  su -c \"$0 $*\""
        exit 1
    fi
fi

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

# Seleccionar .env según el modo
echo "[1/7] Configurando entorno ($ENV_FILE)..."
if [ -f "server/$ENV_FILE" ]; then
    cp "server/$ENV_FILE" server/.env
    echo "  server/.env ← server/$ENV_FILE"
else
    echo "  ⚠ No existe server/$ENV_FILE — se mantiene server/.env actual"
fi

# Kill existing screens if running
echo "[2/7] Limpiando pantallas existentes..."
screen -S srservi-server -X quit 2>/dev/null || true
screen -S srservi-client -X quit 2>/dev/null || true

# Python3 — requerido por León IA (Ollama). Se instala si falta.
echo "[3/7] Verificando Python3 (León IA)..."
if ! command -v python3 >/dev/null 2>&1; then
    echo "  Instalando python3..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y python3 python3-venv python3-pip
    elif command -v yum >/dev/null 2>&1; then
        yum install -y python3 python3-pip
    else
        echo "  ⚠ No se encontró apt/yum — instala python3 manualmente"
    fi
fi
if command -v python3 >/dev/null 2>&1; then
    echo "  Python3 disponible ✓ ($(python3 --version 2>&1))"
fi

# python3-venv (ensurepip) — sin él los venvs se crean SIN pip y fallan
if command -v python3 >/dev/null 2>&1 && ! python3 -c "import ensurepip" >/dev/null 2>&1; then
    echo "  Instalando python3-venv..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y python3-venv python3-pip
    elif command -v yum >/dev/null 2>&1; then
        yum install -y python3-pip
    fi
fi

# Limpiar venvs rotos (existen pero sin pip) para que se recreen solos
for VENV in server/leon_ia/venv server/instagram_venv; do
    if [ -d "$VENV" ] && [ ! -x "$VENV/bin/pip" ]; then
        echo "  ⚠ Venv incompleto en $VENV — se elimina para recrearlo"
        rm -rf "$VENV"
    fi
done

# GPU NVIDIA — informativo; autostart.js instala drivers si hace falta
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
    echo "  GPU NVIDIA detectada ✓ — Ollama la usará automáticamente:"
    nvidia-smi -L | sed 's/^/    /'
elif lspci 2>/dev/null | grep -qi nvidia; then
    echo "  ⚠ Hardware NVIDIA sin drivers — León IA intentará instalarlos al arrancar"
else
    echo "  Sin GPU NVIDIA — Ollama correrá en CPU"
fi

# Nginx — solo producción: instala, configura el sitio principal y saca SSL
echo "[4/7] Configurando Nginx..."
if [ "$MODE" = "prod" ]; then
    # Instalar nginx si falta
    if ! command -v nginx >/dev/null 2>&1; then
        echo "  Instalando nginx..."
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update -qq
            apt-get install -y nginx
        elif command -v yum >/dev/null 2>&1; then
            yum install -y nginx
        else
            echo "  ⚠ No se encontró apt/yum — instala nginx manualmente"
        fi
    fi

    # Instalar certbot si falta (para SSL; también lo usa nginx-manager.js)
    if ! command -v certbot >/dev/null 2>&1; then
        echo "  Instalando certbot..."
        apt-get install -y certbot 2>/dev/null || yum install -y certbot 2>/dev/null || \
            echo "  ⚠ No se pudo instalar certbot — el sitio quedará en HTTP"
    fi

    if command -v nginx >/dev/null 2>&1; then
        # sites-available/enabled (en CentOS/RHEL no existen por defecto)
        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/certbot
        if ! grep -q 'sites-enabled' /etc/nginx/nginx.conf; then
            sed -i '/http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
        fi

        # Dominio principal (de BASE_URL) + dominios extra (EXTRA_DOMAINS) desde server/.env
        DOMAIN=$(grep -E '^BASE_URL=' server/.env | head -1 | sed -E 's|^BASE_URL=https?://||; s|/.*$||; s|:[0-9]+$||; s|\r$||')
        EXTRA_DOMAINS=$(grep -E '^EXTRA_DOMAINS=' server/.env | head -1 | cut -d= -f2- | tr -d '\r')
        CERT_EMAIL=$(grep -E '^EMAIL_USER=' server/.env | head -1 | cut -d= -f2 | tr -d '\r')
        NGINX_CONF="/etc/nginx/sites-available/srservi.conf"

        # ¿BASE_URL es una IP o localhost? → sin dominio: HTTP por IP, sin certbot
        NO_DOMAIN=0
        if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ] || \
           echo "$DOMAIN" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
            NO_DOMAIN=1
            echo "  Sin dominio (BASE_URL=$DOMAIN) — Nginx servirá por IP en HTTP, sin SSL"
            ALL_DOMAINS=""
        else
            ALL_DOMAINS="$DOMAIN $EXTRA_DOMAINS"
            echo "  Dominios a configurar: $ALL_DOMAINS"
        fi

        # Bloques de proxy (API/socket/archivos → 8888, resto → cliente 6666)
        # Mismo formato que la config manual de sites-available
        nginx_locations() {
            cat <<LOCS
    client_max_body_size 1024m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8888/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:8888/socket.io/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8888/uploads/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /downloads/ {
        proxy_pass http://127.0.0.1:8888/downloads/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:6666;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
LOCS
        }

        # Devuelve el directorio del certificado de un dominio (individual o
        # wildcard del dominio base), o nada si no hay
        cert_dir_for() {
            local d="$1" base="${1#*.}"
            if [ -f "/etc/letsencrypt/live/$d/fullchain.pem" ]; then
                echo "/etc/letsencrypt/live/$d"
            elif [ -f "/etc/letsencrypt/live/$base/fullchain.pem" ]; then
                echo "/etc/letsencrypt/live/$base"
            fi
        }

        emit_http_block() {  # $1 = dominio ("" = servir por IP)
            echo "server {"
            if [ "$NO_DOMAIN" = "1" ]; then
                echo "    listen 80 default_server;"
                echo "    server_name _;"
            else
                echo "    listen 80;"
                echo "    server_name $1;"
            fi
            nginx_locations
            echo "}"
        }

        emit_https_block() {  # $1 = dominio, $2 = dir del certificado
            echo "server {"
            echo "    listen 80;"
            echo "    server_name $1;"
            echo "    location /.well-known/acme-challenge/ { root /var/www/certbot; }"
            echo "    location / { return 301 https://$1\$request_uri; }"
            echo "}"
            echo ""
            echo "server {"
            echo "    listen 443 ssl;"
            echo "    server_name $1;"
            echo ""
            echo "    ssl_certificate     $2/fullchain.pem;"
            echo "    ssl_certificate_key $2/privkey.pem;"
            echo "    ssl_protocols TLSv1.2 TLSv1.3;"
            echo "    ssl_ciphers HIGH:!aNULL:!MD5;"
            echo "    ssl_session_cache shared:SSL:10m;"
            nginx_locations
            echo "}"
        }

        # Escribe la config de UN dominio en su propio archivo
        # (/etc/nginx/sites-available/<dominio>, igual que las configs manuales).
        # HTTPS si el dominio ya tiene certificado, HTTP si no.
        write_domain_conf() {  # $1 = dominio ("" = servir por IP)
            local name="${1:-srservi-default}"
            local conf="/etc/nginx/sites-available/$name"
            # Respetar configs escritas a mano
            if [ -f "$conf" ] && ! grep -q '# SRServi auto-generated' "$conf"; then
                echo "  Config manual en $conf — no se toca"
                ln -sf "$conf" "/etc/nginx/sites-enabled/$name"
                return
            fi
            local CERT_DIR=""
            [ -n "$1" ] && CERT_DIR=$(cert_dir_for "$1")
            {
                echo "# SRServi auto-generated — ${1:-acceso por IP}"
                if [ -n "$CERT_DIR" ]; then
                    emit_https_block "$1" "$CERT_DIR"
                else
                    emit_http_block "$1"
                fi
            } > "$conf"
            ln -sf "$conf" "/etc/nginx/sites-enabled/$name"
        }

        write_all_confs() {
            if [ "$NO_DOMAIN" = "1" ]; then
                # Sin dominio somos el sitio por defecto → quitar el default de nginx
                rm -f /etc/nginx/sites-enabled/default
                write_domain_conf ""
            else
                for d in $ALL_DOMAINS; do
                    write_domain_conf "$d"
                done
            fi
        }

        # Migración: borrar el archivo unificado de versiones previas del script
        if [ -f "$NGINX_CONF" ] && grep -q '# SRServi auto-generated' "$NGINX_CONF"; then
            rm -f "$NGINX_CONF" /etc/nginx/sites-enabled/srservi.conf
        fi

        write_all_confs

        if nginx -t >/dev/null 2>&1; then
            systemctl enable nginx >/dev/null 2>&1 || true
            systemctl restart nginx 2>/dev/null || nginx -s reload 2>/dev/null || nginx || true
            echo "  Nginx configurado para ${ALL_DOMAINS:-acceso por IP} ✓"
        else
            echo "  ⚠ nginx -t falló — revisa la config:"
            nginx -t || true
        fi

        # Obtener con certbot los certificados que falten y subir a HTTPS
        # (solo dominios reales; Let's Encrypt no emite certificados para IPs)
        if [ "$NO_DOMAIN" = "0" ] && command -v certbot >/dev/null 2>&1; then
            NEW_CERTS=0
            for d in $ALL_DOMAINS; do
                [ -n "$(cert_dir_for "$d")" ] && continue
                echo "  Obteniendo certificado SSL para $d..."
                if certbot certonly --webroot -w /var/www/certbot -d "$d" \
                     --email "$CERT_EMAIL" --agree-tos --non-interactive --quiet; then
                    echo "  SSL de $d obtenido ✓"
                    NEW_CERTS=1
                else
                    echo "  ⚠ certbot falló para $d (¿el DNS apunta a este servidor?) — queda en HTTP"
                fi
            done
            if [ "$NEW_CERTS" = "1" ]; then
                write_all_confs
                { nginx -t >/dev/null 2>&1 && { systemctl reload nginx 2>/dev/null || nginx -s reload; }; } || true
                echo "  HTTPS activo para los dominios con certificado ✓"
            fi
        fi
    fi
else
    echo "  Modo local — Nginx no es necesario (acceso directo por puertos)"
fi

# Install server dependencies if needed
echo "[5/7] Verificando dependencias del servidor..."
if [ ! -d "server/node_modules" ]; then
    echo "Instalando dependencias del servidor..."
    cd server && npm install && cd ..
fi

# Install client dependencies if needed
echo "[6/7] Verificando dependencias del cliente..."
if [ ! -d "client/node_modules" ]; then
    echo "Instalando dependencias del cliente..."
    cd client && npm install && cd ..
fi

# Build client
echo "[7/7] Compilando cliente (modo $VITE_MODE)..."
cd client
npm run build -- --mode "$VITE_MODE"
cd ..

# Log dentro del proyecto (en /tmp el kernel bloquea sobrescribir
# archivos de otro usuario aunque seas root — fs.protected_regular)
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
SERVER_LOG="$LOG_DIR/srservi-server.log"
rm -f "$SERVER_LOG" /tmp/srservi-server.log 2>/dev/null || true
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
if [ "$MODE" = "prod" ] && [ -n "$DOMAIN" ]; then
    if [ "${NO_DOMAIN:-0}" = "1" ]; then
        echo "Web:          http://$DOMAIN (sin dominio — HTTP por IP)"
    else
        for d in $ALL_DOMAINS; do
            echo "Web:          https://$d"
        done
    fi
fi
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
