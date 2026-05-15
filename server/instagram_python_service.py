"""
Instagram microservice usando instagrapi.
Corre con: uvicorn instagram_python_service:app --host 127.0.0.1 --port 8787
"""

import os
import time
import threading
import queue as q
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    BadCredentials,
    ChallengeRequired,
    TwoFactorRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
    ClientThrottledError,
    FeedbackRequired,
)

try:
    from instagrapi.exceptions import ChallengeResolveRequired
except ImportError:
    ChallengeResolveRequired = None

# ─── Config ───────────────────────────────────────────────────────────────────

SESSIONS_DIR = Path(os.environ.get("IG_SESSIONS_DIR", "./instagram_sessions"))
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="SRServi Instagram Service")

# Contextos activos por store_id (login pausado esperando código)
_contexts: dict[str, "LoginCtx"] = {}
_ctx_lock = threading.Lock()


# ─── Contexto de login ────────────────────────────────────────────────────────

class LoginCtx:
    def __init__(self):
        self.init_event  = threading.Event()   # Señal: ya sabemos qué tipo de auth pide
        self.final_event = threading.Event()   # Señal: proceso terminado (ok o error)
        self.code_queue: q.Queue = q.Queue()
        self.result: str = "pending"           # pending | ok | 2fa_required | challenge_required | error
        self.error: Optional[str] = None
        self.info: dict = {}
        self.ts: float = time.time()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def sf(store_id: str) -> Path:
    return SESSIONS_DIR / f"session_{store_id}.json"


def make_client() -> Client:
    cl = Client()
    cl.delay_range = [1, 3]
    return cl


# ─── Worker thread ────────────────────────────────────────────────────────────

def _bloks_challenge_msg():
    return (
        "Instagram requiere verificación especial para esta cuenta. "
        "Abre la app de Instagram en tu teléfono, "
        "completa cualquier verificación que te pida (email o SMS), "
        "y luego vuelve a intentar conectar aquí."
    )


def _login_worker(store_id: str, username: str, password: str, ctx: LoginCtx):
    cl = make_client()
    session = sf(store_id)

    # Cargar sesión existente para mantener el mismo device fingerprint
    if session.exists():
        try:
            cl.load_settings(str(session))
        except Exception:
            pass

    # ── Challenge handler: instagrapi lo llama DESPUÉS de que Instagram envió el código ──
    def challenge_handler(uname, choice):
        ctx.info = {"choice": str(choice)}
        ctx.result = "challenge_required"
        ctx.init_event.set()                    # Notificar al endpoint /login
        code = ctx.code_queue.get(timeout=600)  # Bloquear hasta que el usuario ingrese el código
        if code is None:
            raise RuntimeError("Cancelado")
        return code

    cl.challenge_code_handler = challenge_handler

    try:
        cl.login(username, password)
        cl.dump_settings(str(session))
        ctx.result = "ok"
        ctx.init_event.set()
        ctx.final_event.set()

    except TwoFactorRequired:
        ctx.info = cl.last_json.get("two_factor_info", {})
        ctx.result = "2fa_required"
        ctx.init_event.set()    # Notificar al endpoint /login

        # Esperar que el usuario ingrese el código 2FA
        code = ctx.code_queue.get(timeout=600)
        if code is None:
            ctx.result = "error"
            ctx.error = "Cancelado"
            ctx.final_event.set()
            return

        try:
            # instagrapi maneja internamente el two_factor_identifier en este segundo login
            cl.login(username, password, verification_code=code)
            cl.dump_settings(str(session))
            ctx.result = "ok"
        except TwoFactorRequired:
            ctx.result = "error"
            ctx.error = "Código 2FA incorrecto. Verificá el código en tu app e intentá de nuevo."
        except Exception as e:
            ctx.result = "error"
            ctx.error = str(e)
        finally:
            ctx.final_event.set()

    except (BadPassword, BadCredentials):
        ctx.result = "error"
        ctx.error = "Usuario o contraseña incorrectos"
        ctx.init_event.set()
        ctx.final_event.set()

    except (PleaseWaitFewMinutes, ClientThrottledError):
        ctx.result = "error"
        ctx.error = "Instagram está limitando los intentos. Esperá unos minutos e intentá de nuevo."
        ctx.init_event.set()
        ctx.final_event.set()

    except FeedbackRequired:
        msg = cl.last_json.get("feedback_message", "")
        ctx.result = "error"
        ctx.error = msg or "Instagram bloqueó el inicio de sesión. La cuenta puede necesitar verificación manual."
        ctx.init_event.set()
        ctx.final_event.set()

    except TypeError:
        # instagrapi ignora el 429 de rate-limit y sigue intentando; el response
        # viene vacío y int(None) explota aquí. Lo tratamos como throttle.
        ctx.result = "error"
        ctx.error = "Instagram limitó los intentos desde este servidor. Esperá 5-10 minutos e intentá de nuevo."
        ctx.init_event.set()
        ctx.final_event.set()

    except Exception as e:
        err_str = str(e)
        # Challenge de tipo Bloks (cuentas nuevas) — instagrapi no puede resolverlo automáticamente
        if (
            "Unknown step_name" in err_str
            or "STEP_NAME" in err_str
            or "bloks_action" in err_str
            or "ChallengeResolve" in err_str
            or (ChallengeResolveRequired and isinstance(e, ChallengeResolveRequired))
        ):
            ctx.error = _bloks_challenge_msg()
        else:
            ctx.error = err_str
        ctx.result = "error"
        ctx.init_event.set()
        ctx.final_event.set()


# ─── Modelos ──────────────────────────────────────────────────────────────────

class LoginReq(BaseModel):
    username: str
    password: str

class VerifyReq(BaseModel):
    code: str
    type: str = "challenge"   # "challenge" | "2fa"

class PostReq(BaseModel):
    image_path: str
    caption: str = ""


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True}


@app.post("/{store_id}/login")
def login(store_id: str, req: LoginReq):
    with _ctx_lock:
        # Cancelar login anterior si quedó colgado
        old = _contexts.get(store_id)
        if old and not old.final_event.is_set():
            old.code_queue.put(None)
            old.final_event.wait(timeout=3)

        ctx = LoginCtx()
        _contexts[store_id] = ctx

    t = threading.Thread(
        target=_login_worker,
        args=(store_id, req.username, req.password, ctx),
        daemon=True,
    )
    t.start()

    # Esperar hasta 35s para saber el tipo de autenticación que pide Instagram
    if not ctx.init_event.wait(timeout=35):
        raise HTTPException(408, "Tiempo de espera agotado conectando con Instagram")

    if ctx.result == "ok":
        return {"status": "ok"}

    if ctx.result == "2fa_required":
        totp_on = ctx.info.get("totp_two_factor_on", True)
        return {
            "status": "2fa_required",
            "info": ctx.info,
            "hint": "Ingresá el código de tu app de autenticación (TOTP)" if totp_on
                    else "Ingresá el código que llegó por SMS",
        }

    if ctx.result == "challenge_required":
        choice = str(ctx.info.get("choice", "")).upper()
        via = "SMS" if "SMS" in choice else "email"
        return {
            "status": "challenge_required",
            "hint": f"Instagram envió un código de verificación a tu {via}. Ingresalo a continuación.",
        }

    raise HTTPException(400, ctx.error or "Error desconocido de Instagram")


@app.post("/{store_id}/verify")
def verify(store_id: str, req: VerifyReq):
    with _ctx_lock:
        ctx = _contexts.get(store_id)

    if not ctx or ctx.final_event.is_set():
        raise HTTPException(400, "No hay verificación pendiente. Hacé clic en Conectar de nuevo.")

    if not req.code or not req.code.strip():
        raise HTTPException(400, "Código requerido")

    # Enviar el código al thread que está bloqueado esperándolo
    ctx.code_queue.put(req.code.replace(" ", "").strip())

    # Esperar resultado final
    if not ctx.final_event.wait(timeout=60):
        raise HTTPException(408, "Tiempo de espera agotado verificando el código")

    if ctx.result == "ok":
        with _ctx_lock:
            _contexts.pop(store_id, None)
        return {"status": "ok"}

    raise HTTPException(400, ctx.error or "Código incorrecto o expirado")


@app.post("/{store_id}/post")
def post_photo(store_id: str, req: PostReq):
    session = sf(store_id)
    if not session.exists():
        raise HTTPException(400, "Cuenta de Instagram no conectada")

    cl = make_client()
    try:
        cl.load_settings(str(session))
    except Exception as e:
        raise HTTPException(400, f"Error cargando sesión: {e}")

    img = Path(req.image_path)
    if not img.exists():
        raise HTTPException(400, f"Imagen no encontrada: {req.image_path}")

    try:
        media = cl.photo_upload(path=img, caption=req.caption)
        cl.dump_settings(str(session))
        return {"status": "ok", "media_id": str(media.pk)}
    except LoginRequired:
        session.unlink(missing_ok=True)
        raise HTTPException(401, "Sesión expirada. Reconectá la cuenta de Instagram.")
    except Exception as e:
        err_str = str(e)
        if (
            "Unknown step_name" in err_str
            or "STEP_NAME" in err_str
            or "bloks_action" in err_str
            or "ChallengeResolve" in err_str
        ):
            session.unlink(missing_ok=True)
            raise HTTPException(401, _bloks_challenge_msg())
        raise HTTPException(400, err_str)


@app.delete("/{store_id}/session")
def delete_session(store_id: str):
    session = sf(store_id)
    if session.exists():
        session.unlink()
    with _ctx_lock:
        old = _contexts.pop(store_id, None)
        if old and not old.final_event.is_set():
            old.code_queue.put(None)
    return {"status": "ok"}


@app.get("/{store_id}/status")
def get_status(store_id: str):
    session = sf(store_id)
    if not session.exists():
        return {"status": "not_connected"}
    cl = make_client()
    try:
        cl.load_settings(str(session))
        user = cl.account_info()
        return {"status": "connected", "username": user.username}
    except LoginRequired:
        return {"status": "session_expired"}
    except Exception:
        return {"status": "unknown"}
