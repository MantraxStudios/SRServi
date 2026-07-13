#!/usr/bin/env python3
"""
Servicio de generación de imágenes con IA (Stable Diffusion Turbo, open source).
Corre en: http://127.0.0.1:8788

El modelo se descarga automáticamente desde Hugging Face la primera vez que se
usa (o al arrancar, en background) y queda cacheado en disco para las próximas.
"""

import asyncio
import base64
import io
import os
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SRServi AI Image Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HOST = os.getenv("AI_IMAGE_HOST", "127.0.0.1")
PORT = int(os.getenv("AI_IMAGE_PORT", "8788"))
# stabilityai/sd-turbo: modelo open source distilado, genera en 1-4 pasos.
# Liviano (~2-3GB). Usa GPU automáticamente si hay una NVIDIA disponible
# (mucho más rápido), si no cae a CPU.
MODEL_ID = os.getenv("AI_IMAGE_MODEL", "stabilityai/sd-turbo")

_pipe = None
_loading = False
_load_error = None
_device = None
_lock = threading.Lock()


def _load_pipeline():
    global _pipe, _device
    import torch
    from diffusers import AutoPipelineForText2Image

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if _device == "cuda" else torch.float32

    pipe = AutoPipelineForText2Image.from_pretrained(
        MODEL_ID, torch_dtype=dtype
    )
    pipe.to(_device)
    _pipe = pipe


def ensure_pipeline():
    global _loading, _load_error
    if _pipe is not None:
        return
    with _lock:
        if _pipe is not None:
            return
        _loading = True
        try:
            _load_pipeline()
            _load_error = None
        except Exception as e:
            _load_error = str(e)
            raise
        finally:
            _loading = False


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "texto, letras, palabras, marca de agua, low quality, blurry, distorted"
    width: int = 512
    height: int = 512
    steps: int = 2


class GenerateResponse(BaseModel):
    image_base64: str


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "loaded": _pipe is not None,
        "loading": _loading,
        "error": _load_error,
        "device": _device,
    }


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    loop = asyncio.get_event_loop()

    def _run():
        ensure_pipeline()
        result = _pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            num_inference_steps=max(1, min(req.steps, 4)),
            guidance_scale=0.0,
            width=req.width,
            height=req.height,
        )
        return result.images[0]

    try:
        image = await loop.run_in_executor(None, _run)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"No se pudo generar la imagen: {e}")

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return GenerateResponse(image_base64=base64.b64encode(buf.getvalue()).decode())


@app.on_event("startup")
async def warmup():
    """Descarga/carga el modelo en background para que la primera petición
    real no tenga que esperar la descarga completa (puede tardar minutos)."""

    def _bg():
        try:
            print("[ai-image] Descargando/cargando modelo (puede tardar varios minutos la primera vez)...")
            ensure_pipeline()
            print("[ai-image] Modelo cargado y listo ✓")
        except Exception as e:
            print(f"[ai-image] No se pudo precargar el modelo: {e}")

    threading.Thread(target=_bg, daemon=True).start()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
