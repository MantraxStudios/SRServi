#!/usr/bin/env python3
"""
Eliminador de fondo con IA
Uso: python bg_remover.py <imagen> [salida]
"""

import sys
import os
from pathlib import Path

def instalar_dependencias():
    import subprocess
    print("📦 Instalando dependencias...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg", "pillow"])
    print("✅ Dependencias instaladas\n")

try:
    from rembg import remove
    from PIL import Image
except ImportError:
    instalar_dependencias()
    from rembg import remove
    from PIL import Image


def eliminar_fondo(entrada: str, salida: str = None) -> str:
    ruta_entrada = Path(entrada)

    if not ruta_entrada.exists():
        print(f"✗ Error: no se encontró el archivo '{entrada}'")
        sys.exit(1)

    # Generar nombre de salida automático si no se especificó
    if not salida:
        salida = ruta_entrada.stem + "_sin_fondo.png"

    ruta_salida = Path(salida)
    if ruta_salida.suffix.lower() != ".png":
        ruta_salida = ruta_salida.with_suffix(".png")

    print(f"🖼  Imagen   : {ruta_entrada}")
    print(f"💾 Salida   : {ruta_salida}")
    print("⏳ Procesando...\n")

    with open(ruta_entrada, "rb") as f:
        datos_entrada = f.read()

    datos_salida = remove(datos_entrada)

    with open(ruta_salida, "wb") as f:
        f.write(datos_salida)

    # Mostrar tamaño del archivo resultante
    tam = ruta_salida.stat().st_size / 1024
    print(f"✅ ¡Listo! Fondo eliminado correctamente.")
    print(f"   Guardado en: {ruta_salida}  ({tam:.1f} KB)")

    return str(ruta_salida)


def main():
    print("╔══════════════════════════════════════╗")
    print("║     Eliminador de Fondo con IA 🪄    ║")
    print("╚══════════════════════════════════════╝\n")

    if len(sys.argv) < 2:
        print("Uso:")
        print("  python bg_remover.py <imagen>")
        print("  python bg_remover.py <imagen> <salida.png>")
        print("\nEjemplos:")
        print("  python bg_remover.py foto.jpg")
        print("  python bg_remover.py foto.jpg resultado.png")
        sys.exit(0)

    entrada = sys.argv[1]
    salida  = sys.argv[2] if len(sys.argv) >= 3 else None

    eliminar_fondo(entrada, salida)


if __name__ == "__main__":
    main()
