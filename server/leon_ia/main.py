#!/usr/bin/env python3
"""
León IA — Servicio Python con Ollama
Corre en: http://localhost:7777
"""

import json
import re
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from db import get_store_data

app = FastAPI(title="León IA Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434"
# Modelos recomendados (en orden de preferencia):
# qwen2.5:7b  → mejor español, ~4GB RAM
# qwen2.5:3b  → más rápido, ~2GB RAM
# llama3.2:3b → alternativa, ~2GB RAM
# mistral:7b  → buena opción, ~4GB RAM
DEFAULT_MODEL = "qwen2.5:7b"

SYSTEM_PROMPT = """Eres León IA 🦁, el asistente de negocios inteligente de SRServi para la tienda "{store_name}".

REGLAS IMPORTANTES:
- Responde SIEMPRE en español latinoamericano, de forma directa y amigable
- Usa los datos reales que se te proporcionan — NUNCA inventes números
- Si el usuario habla coloquial ("qué se mueve", "cuánta plata hice", "qué no sale"), entiéndelo y responde con los datos correspondientes
- Sé concreto: da números reales, no generalidades
- Máximo 4-5 oraciones salvo que pidan detalles
- Usa emojis con moderación

CUANDO EL USUARIO PIDA UN GRÁFICO o la respuesta tenga datos comparativos (ranking de productos, ventas por día/hora, etc.), AL FINAL DE TU RESPUESTA agrega una línea con este formato exacto:
CHART:{"type":"bar","title":"TÍTULO","labels":["etiqueta1","etiqueta2"],"values":[10,20],"unit":"pedidos","color":"#D4AF37"}

Tipos de chart válidos: "bar"
Colores sugeridos: "#D4AF37" (dorado), "#22c55e" (verde), "#ef4444" (rojo), "#a78bfa" (violeta)

DATOS ACTUALES DE LA TIENDA "{store_name}":
{datos}

Fecha y hora actual: {fecha}
"""

class HistoryMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    question: str
    store_id: int
    history: List[HistoryMessage] = []

class ChatResponse(BaseModel):
    answer: str
    chart: Optional[dict] = None
    intent: str = "ai"
    ai_powered: bool = True
    model: str = ""

def build_messages(question: str, store_data: dict, history: list) -> list:
    from datetime import datetime
    datos_str = json.dumps(store_data, ensure_ascii=False, indent=2, default=str)
    system = SYSTEM_PROMPT.format(
        store_name=store_data.get("store_name", "tu tienda"),
        datos=datos_str,
        fecha=datetime.now().strftime("%A %d/%m/%Y %H:%M")
    )
    messages = [{"role": "system", "content": system}]
    # Agregar historial (últimos 6 mensajes)
    for msg in history[-6:]:
        role = "assistant" if msg.role == "leon" else "user"
        messages.append({"role": role, "content": msg.text})
    messages.append({"role": "user", "content": question})
    return messages

def extract_chart(text: str):
    """Extrae el JSON del gráfico si el modelo lo incluyó."""
    match = re.search(r'CHART:(\{.*\})', text, re.DOTALL)
    if not match:
        return text, None
    try:
        chart = json.loads(match.group(1))
        clean_text = text[:match.start()].strip()
        return clean_text, chart
    except Exception:
        return text, None

async def call_ollama(messages: list, model: str) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 600,
        }
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]

async def get_available_model() -> str:
    """Devuelve el primer modelo disponible en Ollama."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                if not models:
                    return DEFAULT_MODEL
                # Preferir en este orden
                for preferred in ["qwen2.5:7b", "qwen2.5:3b", "llama3.2:3b",
                                   "mistral:7b", "llama3:8b", "qwen2.5:14b"]:
                    if any(preferred in m for m in models):
                        return preferred
                return models[0]
    except Exception:
        pass
    return DEFAULT_MODEL

@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in resp.json().get("models", [])] if resp.status_code == 200 else []
        return {"status": "ok", "ollama": True, "models": models}
    except Exception:
        return {"status": "ok", "ollama": False, "models": []}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # 1. Obtener datos de la tienda
    try:
        store_data = get_store_data(req.store_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error DB: {e}")

    # 2. Construir mensajes
    messages = build_messages(req.question, store_data, req.history)

    # 3. Llamar a Ollama
    model = await get_available_model()
    try:
        raw_answer = await call_ollama(messages, model)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama no está corriendo. Inicia Ollama con: ollama serve"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error Ollama: {e}")

    # 4. Extraer gráfico si lo hay
    answer, chart = extract_chart(raw_answer)

    return ChatResponse(
        answer=answer,
        chart=chart,
        intent="ai",
        ai_powered=True,
        model=model
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=7777, reload=False)
