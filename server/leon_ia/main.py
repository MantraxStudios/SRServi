#!/usr/bin/env python3
"""
León IA — Servicio Python con Ollama
Corre en: http://localhost:7777
"""

import json
import os
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

# Configurable vía .env del servidor (autostart.js propaga process.env)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
LEON_HOST = os.getenv("LEON_HOST", "0.0.0.0")
LEON_PORT = int(os.getenv("LEON_PORT", "7777"))
# Modelos recomendados (en orden de preferencia):
# qwen2.5:7b  → mejor español, ~4GB RAM
# qwen2.5:3b  → más rápido, ~2GB RAM
# llama3.2:3b → alternativa, ~2GB RAM
# mistral:7b  → buena opción, ~4GB RAM
DEFAULT_MODEL = os.getenv("LEON_MODEL", "qwen2.5:7b")

# keep_alive: Ollama acepta número (segundos, -1 = para siempre) o texto con
# unidad ("30m"). Si el valor es numérico hay que mandarlo como número, no texto.
_ka = os.getenv("LEON_KEEP_ALIVE", "-1")
KEEP_ALIVE = int(_ka) if _ka.lstrip("-").isdigit() else _ka

SYSTEM_PROMPT = """Eres León IA 🦁, el asistente de negocios inteligente de SRServi para la tienda "{store_name}".

REGLAS IMPORTANTES:
- Responde SIEMPRE en español latinoamericano, de forma directa y amigable
- Usa los datos reales que se te proporcionan — NUNCA inventes números
- Si el usuario habla coloquial ("qué se mueve", "cuánta plata hice", "qué no sale"), entiéndelo y responde con los datos correspondientes
- Sé concreto: da números reales, no generalidades
- Máximo 4-5 oraciones salvo que pidan detalles
- Usa emojis con moderación

CUANDO EL USUARIO PIDA UN GRÁFICO o la respuesta tenga datos comparativos (ranking de productos, ventas por día/hora, etc.), AL FINAL DE TU RESPUESTA agrega una línea con este formato exacto:
CHART:{{"type":"bar","title":"TÍTULO","labels":["etiqueta1","etiqueta2"],"values":[10,20],"unit":"pedidos","color":"#D4AF37"}}

Tipos de chart válidos: "bar"
Colores sugeridos: "#D4AF37" (dorado), "#22c55e" (verde), "#ef4444" (rojo), "#a78bfa" (violeta)

DATOS ACTUALES DE LA TIENDA "{store_name}":
{datos}

Fecha y hora actual: {fecha}
"""

# ─── Asistente de VENTAS (chat público tipo Vambe) ───────────────────────────
SALES_SYSTEM_PROMPT = """Eres "Sofía" 🤖, la asesora comercial de SRServi. Tu ÚNICO objetivo es
convertir a cada visitante en un cliente registrado: entender su negocio, mostrarle
cómo SRServi lo ayuda y llevarlo a registrarse o dejar sus datos de contacto.

QUÉ ES SRServi:
Plataforma todo-en-uno para restaurantes, cafeterías, minimarkets y locales de comida.
Incluye: punto de venta (POS) en Android y web, gestión de productos/combos/promos,
control de inventario, pedidos para delivery y mesas, pantalla de cocina (KDS),
TV de órdenes, cartelería CCTV, cupones y programa de fidelidad, analítica de ventas,
integración con Mercado Pago / Transbank / TUU / SumUp, WhatsApp integrado, y "León IA"
un asistente que analiza las ventas del negocio. Enfocado en Chile y Latinoamérica.

PLANES (precios en USD/mes, cobro mensual o anual):
- Gratis: US$0 — hasta 2 tiendas, productos y punto de venta. Ideal para empezar.
- SOLO: US$11 — hasta 10 tiendas, logo y colores propios, multi-tienda, soporte prioritario.
- Empresas: US$25 — hasta 25 tiendas, 5 impresoras Bluetooth, personalización y soporte.
- Personalizado: US$99 — funciones a medida, 10 impresoras, atención directa con desarrollo.

REGLAS DE CONVERSACIÓN:
- Español latinoamericano, cercano, entusiasta pero NO pesado. Máximo 3-4 oraciones por respuesta.
- Haz UNA pregunta a la vez para calificar: tipo de negocio, cuántas sucursales, qué problema
  quiere resolver (ordenar pedidos, cobrar rápido, controlar stock, delivery, etc.).
- Conecta siempre el beneficio con SU necesidad concreta. Maneja objeciones (precio, migración,
  hardware) con seguridad y datos reales de los planes.
- Cuando haya interés real, pide de forma natural NOMBRE y WHATSAPP (y opcionalmente email) para
  "coordinar una demo gratis y activar tu cuenta". Insiste con suavidad si aún no los da.
- Invita a registrarse gratis en el botón "Registrarse" / la página de registro cuando esté listo.
- NUNCA inventes funciones que no existen ni descuentos no autorizados.

EXTRACCIÓN DE DATOS (MUY IMPORTANTE):
En cuanto tengas AL MENOS un teléfono o un email del visitante, agrega al FINAL de tu respuesta
una línea EXACTA con este formato (el visitante NO la verá):
LEAD:{{"name":"...","phone":"...","email":"...","business_type":"...","country":"...","interest":"..."}}
Incluye solo los campos que conozcas; usa "" en los que no sepas. Actualiza la línea si el visitante
te da más datos en mensajes siguientes.

Fecha y hora actual: {fecha}
"""

class SalesHistoryMessage(BaseModel):
    role: str
    text: str

class SalesChatRequest(BaseModel):
    question: str
    history: List[SalesHistoryMessage] = []

class SalesLead(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""
    business_type: str = ""
    country: str = ""
    interest: str = ""

class SalesChatResponse(BaseModel):
    answer: str
    lead: Optional[dict] = None
    ai_powered: bool = True
    model: str = ""

def extract_lead(text: str):
    """Extrae el JSON del lead si el modelo lo incluyó (marcador LEAD:...)."""
    match = re.search(r'LEAD:(\{.*\})', text, re.DOTALL)
    if not match:
        return text, None
    try:
        lead = json.loads(match.group(1))
        clean_text = text[:match.start()].strip()
        # Solo devolver lead si trae algún dato de contacto
        if lead.get("phone") or lead.get("email"):
            return clean_text, lead
        return clean_text, None
    except Exception:
        return text, None

@app.post("/sales-chat", response_model=SalesChatResponse)
async def sales_chat(req: SalesChatRequest):
    from datetime import datetime
    system = SALES_SYSTEM_PROMPT.format(fecha=datetime.now().strftime("%A %d/%m/%Y %H:%M"))
    messages = [{"role": "system", "content": system}]
    for msg in req.history[-8:]:
        role = "assistant" if msg.role in ("sofia", "leon", "assistant") else "user"
        messages.append({"role": role, "content": msg.text})
    messages.append({"role": "user", "content": req.question})

    model = await get_available_model()
    try:
        raw_answer = await call_ollama(messages, model)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama no está corriendo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error Ollama: {e}")

    answer, lead = extract_lead(raw_answer)
    return SalesChatResponse(answer=answer, lead=lead, ai_powered=True, model=model)

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
        # Mantener el modelo cargado en RAM/VRAM entre consultas
        # (sin esto Ollama lo descarga a los 5 min y recargarlo tarda 10-30s)
        "keep_alive": KEEP_ALIVE,
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

@app.on_event("startup")
async def warmup():
    """Carga el modelo en RAM/VRAM al arrancar para que la primera
    consulta real no espere los 10-30s de carga."""
    import asyncio

    async def _load():
        try:
            model = await get_available_model()
            async with httpx.AsyncClient(timeout=300.0) as client:
                await client.post(f"{OLLAMA_URL}/api/chat", json={
                    "model": model,
                    "messages": [{"role": "user", "content": "hola"}],
                    "stream": False,
                    "keep_alive": KEEP_ALIVE,
                    "options": {"num_predict": 1}
                })
            print(f"[warmup] Modelo {model} cargado y fijado en memoria")
        except Exception as e:
            print(f"[warmup] No se pudo precargar el modelo: {e}")

    asyncio.create_task(_load())

@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in resp.json().get("models", [])] if resp.status_code == 200 else []
        ollama_ok = True
    except Exception:
        ollama_ok, models = False, []

    # Chequear también la DB — el chat la necesita antes que Ollama
    try:
        from db import get_conn
        conn = get_conn()
        conn.close()
        db_ok, db_error = True, None
    except Exception as e:
        db_ok, db_error = False, str(e)

    return {"status": "ok", "ollama": ollama_ok, "models": models,
            "db": db_ok, "db_error": db_error}

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

# ─── Extracción de productos desde el texto/HTML de una web ───────────────────
class ExtractProductsRequest(BaseModel):
    text: str

class ExtractedProduct(BaseModel):
    name: str
    price: float = 0

class ExtractProductsResponse(BaseModel):
    products: List[dict] = []
    model: str = ""

EXTRACT_SYSTEM_PROMPT = (
    "Eres un extractor de datos de tiendas online. Recibirás el texto de una página web. "
    "Devuelve ÚNICAMENTE un array JSON válido (sin explicaciones, sin markdown) con los productos "
    "que aparezcan, cada uno como {\"name\": string, \"price\": number}. "
    "El precio debe ser un número sin símbolo de moneda ni separadores de miles "
    "(por ejemplo 12990, no \"$12.990\"). Si un producto no tiene precio claro, usa 0. "
    "Ignora menús, banners, categorías y textos que no sean productos. "
    "Si no hay productos, devuelve []."
)

def _parse_products_json(raw: str):
    txt = raw.replace("```json", "").replace("```", "").strip()
    start = txt.find("[")
    end = txt.rfind("]")
    if start == -1 or end == -1 or end < start:
        return []
    try:
        arr = json.loads(txt[start:end + 1])
    except Exception:
        return []
    if not isinstance(arr, list):
        return []
    out = []
    seen = set()
    for p in arr:
        if not isinstance(p, dict):
            continue
        name = str(p.get("name", "")).strip()
        if len(name) < 2:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            price = float(p.get("price", 0) or 0)
        except Exception:
            price = 0
        out.append({"name": name, "price": price})
    return out

@app.post("/extract-products", response_model=ExtractProductsResponse)
async def extract_products(req: ExtractProductsRequest):
    text = (req.text or "").strip()
    if not text:
        return ExtractProductsResponse(products=[], model="")
    # Acotar el tamaño para no saturar el modelo local
    text = text[:12000]
    messages = [
        {"role": "system", "content": EXTRACT_SYSTEM_PROMPT},
        {"role": "user", "content": text},
    ]
    model = await get_available_model()
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "keep_alive": KEEP_ALIVE,
        "format": "json",
        "options": {"temperature": 0, "num_predict": 2048},
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            resp.raise_for_status()
            raw = resp.json()["message"]["content"]
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama no está corriendo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error Ollama: {e}")

    # Con format=json el modelo puede devolver {"products":[...]} o directamente [...]
    products = _parse_products_json(raw)
    if not products:
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                for v in obj.values():
                    if isinstance(v, list):
                        products = _parse_products_json(json.dumps(v))
                        if products:
                            break
        except Exception:
            pass
    return ExtractProductsResponse(products=products, model=model)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=LEON_HOST, port=LEON_PORT, reload=False)
