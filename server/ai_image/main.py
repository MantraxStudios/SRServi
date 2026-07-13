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
import tempfile
import threading
import uuid

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
# black-forest-labs/FLUX.1-schnell: modelo open source (Apache 2.0) de última
# generación, mucho más realista y fiel al prompt que SD-Turbo. Pesado (~30GB
# combinado) — usa offload secuencial a GPU para poder correr incluso con
# VRAM limitada o compartida con otro servicio (ej. Ollama de León IA).
# Repo "gated: auto" en Hugging Face: hace falta un HF_TOKEN con la licencia
# aceptada en https://huggingface.co/black-forest-labs/FLUX.1-schnell
# (aprobación automática) para poder descargarlo.
MODEL_ID = os.getenv("AI_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
# Stable Video Diffusion XT: anima una imagen fija en un clip corto (open
# source, no gated). Genera 25 frames; exportamos a 5fps → video de 5s exactos.
VIDEO_MODEL_ID = os.getenv("AI_VIDEO_MODEL", "stabilityai/stable-video-diffusion-img2vid-xt")
VIDEO_NUM_FRAMES = 25
VIDEO_EXPORT_FPS = 5  # 25 frames / 5fps = 5.0s

_pipe = None
_loading = False
_load_error = None
_device = None
_lock = threading.Lock()

_video_pipe = None
_video_loading = False
_video_load_error = None
_video_device = None
_video_lock = threading.Lock()


def _load_pipeline():
    global _pipe, _device
    import torch
    from diffusers import AutoPipelineForText2Image

    cuda = torch.cuda.is_available()
    dtype = torch.bfloat16 if cuda else torch.float32

    pipe = AutoPipelineForText2Image.from_pretrained(
        MODEL_ID, torch_dtype=dtype
    )

    if cuda:
        # FLUX ronda ~30GB combinado (transformer + T5-xxl + CLIP + VAE).
        # offload secuencial mueve cada CAPA a la GPU solo mientras se usa
        # (mucho menos pico de VRAM que el offload por módulo completo,
        # a costa de velocidad) — necesario en tarjetas de 16GB o compartidas
        # con otro servicio (ej. Ollama de León IA).
        pipe.enable_sequential_cpu_offload()
        _device = "cuda (sequential offload)"
    else:
        pipe.to("cpu")
        _device = "cpu"

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


def _load_video_pipeline():
    global _video_pipe, _video_device
    import torch
    from diffusers import StableVideoDiffusionPipeline

    cuda = torch.cuda.is_available()
    dtype = torch.float16 if cuda else torch.float32
    kwargs = {"torch_dtype": dtype}
    if cuda:
        kwargs["variant"] = "fp16"  # evita bajar los checkpoints fp32 (más pesados)

    pipe = StableVideoDiffusionPipeline.from_pretrained(VIDEO_MODEL_ID, **kwargs)

    if cuda:
        pipe.enable_sequential_cpu_offload()
        _video_device = "cuda (sequential offload)"
    else:
        pipe.to("cpu")
        _video_device = "cpu"

    _video_pipe = pipe


def ensure_video_pipeline():
    global _video_loading, _video_load_error
    if _video_pipe is not None:
        return
    with _video_lock:
        if _video_pipe is not None:
            return
        _video_loading = True
        try:
            _load_video_pipeline()
            _video_load_error = None
        except Exception as e:
            _video_load_error = str(e)
            raise
        finally:
            _video_loading = False


def _free_cuda_cache():
    """Libera memoria CUDA cacheada por PyTorch de vuelta al pool del driver.
    Importante en GPUs chicas/compartidas (ej. con Ollama de León IA)."""
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def _cuda_mem_info():
    """Memoria libre/total de la GPU (para diagnosticar sin acceso a nvidia-smi)."""
    try:
        import torch
        if not torch.cuda.is_available():
            return None
        free, total = torch.cuda.mem_get_info()
        return {"free_mb": round(free / 1024**2), "total_mb": round(total / 1024**2)}
    except Exception:
        return None


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "texto, letras, palabras, marca de agua, low quality, blurry, distorted"
    width: int = 512
    height: int = 512
    steps: int = 4


class GenerateResponse(BaseModel):
    image_base64: str


class GenerateVideoRequest(BaseModel):
    prompt: str
    negative_prompt: str = "texto, letras, palabras, marca de agua, low quality, blurry, distorted"
    steps: int = 4


class GenerateVideoResponse(BaseModel):
    video_base64: str


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "loaded": _pipe is not None,
        "loading": _loading,
        "error": _load_error,
        "device": _device,
        "video_model": VIDEO_MODEL_ID,
        "video_loaded": _video_pipe is not None,
        "video_loading": _video_loading,
        "video_error": _video_load_error,
        "video_device": _video_device,
        "cuda_memory": _cuda_mem_info(),
    }


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    loop = asyncio.get_event_loop()

    def _run():
        ensure_pipeline()
        kwargs = dict(
            prompt=req.prompt,
            num_inference_steps=max(1, min(req.steps, 4)),
            guidance_scale=0.0,
            width=req.width,
            height=req.height,
        )
        # FluxPipeline (schnell) no acepta negative_prompt — no hace CFG real.
        if _pipe.__class__.__name__ != "FluxPipeline":
            kwargs["negative_prompt"] = req.negative_prompt
        try:
            result = _pipe(**kwargs)
            return result.images[0]
        finally:
            _free_cuda_cache()

    try:
        image = await loop.run_in_executor(None, _run)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"No se pudo generar la imagen: {e}")

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return GenerateResponse(image_base64=base64.b64encode(buf.getvalue()).decode())


@app.post("/generate-video", response_model=GenerateVideoResponse)
async def generate_video(req: GenerateVideoRequest):
    from diffusers.utils import export_to_video

    loop = asyncio.get_event_loop()

    def _run():
        ensure_pipeline()
        ensure_video_pipeline()

        # Formato vertical (576x1024): el que mejor resultado da con SVD y el
        # más útil para redes sociales (historias/reels).
        img_kwargs = dict(
            prompt=req.prompt,
            num_inference_steps=max(1, min(req.steps, 4)),
            guidance_scale=0.0,
            width=576,
            height=1024,
        )
        if _pipe.__class__.__name__ != "FluxPipeline":
            img_kwargs["negative_prompt"] = req.negative_prompt
        image = _pipe(**img_kwargs).images[0]
        _free_cuda_cache()  # libera la memoria de FLUX antes de cargar SVD

        try:
            result = _video_pipe(
                image,
                decode_chunk_size=8,
                num_frames=VIDEO_NUM_FRAMES,
                fps=7,
                motion_bucket_id=127,
                noise_aug_strength=0.02,
            )
            return result.frames[0]
        finally:
            _free_cuda_cache()

    try:
        frames = await loop.run_in_executor(None, _run)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"No se pudo generar el video: {e}")

    tmp_path = os.path.join(tempfile.gettempdir(), f"aivideo_{uuid.uuid4().hex}.mp4")
    try:
        export_to_video(frames, tmp_path, fps=VIDEO_EXPORT_FPS)
        with open(tmp_path, "rb") as f:
            video_bytes = f.read()
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    return GenerateVideoResponse(video_base64=base64.b64encode(video_bytes).decode())


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
