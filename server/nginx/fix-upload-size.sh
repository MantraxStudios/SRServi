#!/usr/bin/env bash
# SRServi — arregla el 413 al subir archivos en el CCTV, sin tocar nada a mano.
#
# Qué hace:
#   1. Quita el drop-in duplicado que rompía "nginx -t".
#   2. Busca el client_max_body_size que YA existe (nginx.conf u otro conf.d).
#   3. Si ese valor es menor a 100M, lo sube a 100M (nunca lo baja).
#      Si no existía ninguno, lo agrega dentro del bloque http {}.
#   4. Valida con nginx -t y recarga nginx.
#
# Uso (en el servidor):
#   sudo bash server/nginx/fix-upload-size.sh
#
set -euo pipefail

WANT_MB=100
DROPIN=/etc/nginx/conf.d/srservi-upload-size.conf
NGINXCONF=/etc/nginx/nginx.conf

if [ "$(id -u)" -ne 0 ]; then
  echo "✖ Ejecutá con sudo:  sudo bash $0"
  exit 1
fi

# Convierte "100M" / "1G" / "1024k" a MB (entero aprox).
to_mb() {
  local v num unit
  v="$(echo "$1" | tr -d '[:space:];')"
  num="$(echo "$v" | grep -oE '^[0-9]+')"
  unit="$(echo "$v" | grep -oE '[a-zA-Z]$' || true)"
  case "$unit" in
    g|G) echo $(( num * 1024 )) ;;
    k|K) echo $(( num / 1024 )) ;;
    m|M) echo "$num" ;;
    *)   echo $(( num / 1024 / 1024 )) ;;  # bytes sin unidad
  esac
}

echo "==> 1) Quitando drop-in duplicado (si existe)"
rm -f "$DROPIN" && echo "   ok" || true

echo "==> 2) Buscando client_max_body_size existente"
# Archivos candidatos: nginx.conf + conf.d (contexto http). Los sites-enabled son
# server blocks por-subdominio (1024M) y no entran en conflicto, no se tocan.
TARGET=""
for f in "$NGINXCONF" /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  if grep -qE '^[[:space:]]*client_max_body_size' "$f"; then
    TARGET="$f"
    break
  fi
done

if [ -n "$TARGET" ]; then
  CUR="$(grep -oE 'client_max_body_size[[:space:]]+[0-9]+[a-zA-Z]?' "$TARGET" | head -1 | grep -oE '[0-9]+[a-zA-Z]?$')"
  CUR_MB="$(to_mb "$CUR")"
  echo "   encontrado en $TARGET  ->  $CUR (~${CUR_MB}MB)"
  if [ "$CUR_MB" -lt "$WANT_MB" ]; then
    echo "==> 3) Es chico, lo subo a ${WANT_MB}M"
    sed -i -E "s/(client_max_body_size)[[:space:]]+[0-9]+[a-zA-Z]?/\1 ${WANT_MB}M/" "$TARGET"
  else
    echo "==> 3) Ya alcanza (>=${WANT_MB}M), no toco el valor"
  fi
else
  echo "==> 3) No había ninguno; lo agrego al bloque http {} de nginx.conf"
  sed -i -E "0,/^([[:space:]]*)http[[:space:]]*\{/s//&\n    client_max_body_size ${WANT_MB}M;/" "$NGINXCONF"
fi

echo "==> 4) Validando y recargando nginx"
nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload

echo "✔ Listo. Límite de subida en ${WANT_MB}M. Probá subir el archivo en el CCTV."
