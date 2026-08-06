from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query, Header
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("giroexpress")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"].lower()
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin")
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
APP_NAME = os.environ.get("APP_NAME", "giroexpress")
PLATFORM_FEE = 1.00

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

PRICING_TABLE = [
    (0.5, 3.99, 12), (1.0, 3.99, 14), (1.5, 4.99, 16), (2.0, 4.99, 17),
    (2.5, 5.99, 18), (3.0, 5.99, 19), (3.5, 6.99, 20), (4.0, 6.99, 21),
    (4.5, 7.99, 22), (5.0, 7.99, 23), (5.5, 8.99, 24), (6.0, 9.99, 25),
    (6.5, 10.99, 26), (7.0, 11.99, 27), (7.5, 12.99, 29), (8.0, 13.99, 30),
    (8.5, 14.99, 31), (9.0, 15.99, 32), (9.5, 16.99, 33), (10.0, 17.99, 33),
    (10.5, 19.99, 34), (11.0, 19.99, 34), (11.5, 20.99, 35), (12.0, 22.99, 36),
    (12.5, 22.99, 37), (13.0, 24.99, 38), (13.5, 24.99, 39), (14.0, 24.99, 39),
    (14.5, 24.99, 40), (15.0, 24.99, 41),
]

def price_from_km(km: float) -> dict:
    km = max(0.1, float(km))
    matched = PRICING_TABLE[-1]
    for row in PRICING_TABLE:
        if km <= row[0]:
            matched = row
            break
    gross = matched[1]
    net = round(gross - PLATFORM_FEE, 2)
    return {"km_bracket": matched[0], "gross_price": gross, "platform_fee": PLATFORM_FEE, "net_courier": net, "estimated_min": matched[2]}

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1 = math.radians(lat1); p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1); dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def geocode_address(addr: str):
    if not addr or len(addr.strip()) < 3:
        return None
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": addr, "format": "json", "limit": 1, "countrycodes": "br"},
            headers={"User-Agent": "GiroExpress/1.0"},
            timeout=8,
        )
        arr = r.json()
        if arr:
            return float(arr[0]["lat"]), float(arr[0]["lon"])
    except Exception as e:
        logger.warning(f"geocode failed for '{addr}': {e}")
    return None

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def make_access(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def make_refresh(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh", "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def clear_auth_cookies(resp: Response):
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")

def user_to_public(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "role": u.get("role"),
        "status": u.get("status", "active"),
        "phone": u.get("phone"),
        "address": u.get("address"),
        "vehicle": u.get("vehicle"),
        "allow_batch": u.get("allow_batch", True),
        "online": u.get("online", False),
        "created_at": u.get("created_at"),
    }

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        u = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not u:
            raise HTTPException(401, "User not found")
        if u.get("status") == "blocked":
            raise HTTPException(403, "User blocked")
        return u
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, f"Requires role: {roles}")
        return user
    return dep

def oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:
        raise HTTPException(400, "ID inválido")

# Brute force protection
LOCKOUT_MAX = 5
LOCKOUT_MIN = 15

async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"_id": identifier})
    if not rec:
        return
    if rec.get("locked_until"):
        locked = datetime.fromisoformat(rec["locked_until"])
        if datetime.now(timezone.utc) < locked:
            raise HTTPException(429, f"Muitas tentativas. Tente novamente em alguns minutos.")

async def register_failed(identifier: str):
    rec = await db.login_attempts.find_one({"_id": identifier}) or {"count": 0}
    count = rec.get("count", 0) + 1
    upd = {"count": count, "last_at": now_iso()}
    if count >= LOCKOUT_MAX:
        upd["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MIN)).isoformat()
        upd["count"] = 0
    await db.login_attempts.update_one({"_id": identifier}, {"$set": upd}, upsert=True)

async def clear_attempts(identifier: str):
    await db.login_attempts.delete_one({"_id": identifier})

def current_cycle_bounds(now: datetime = None):
    now = now or datetime.now(timezone.utc)
    days_since_sunday = (now.weekday() + 1) % 7
    start = (now - timedelta(days=days_since_sunday)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    due = start + timedelta(days=9, hours=23, minutes=59, seconds=59)
    return start, end, due

def cycle_label(start: datetime, end: datetime) -> str:
    return f"Domingo ({start.strftime('%d/%m')}) a Sábado ({end.strftime('%d/%m')})"

# ----- Operations schedule (open/close) -----
DEFAULT_OPS = {
    "enabled": True,
    "disabled_weekdays": [],  # e.g. [5] to disable Saturday (Mon=0..Sun=6)
    "open_time": "00:00",
    "close_time": "23:59",
    "holidays": [],           # ["YYYY-MM-DD", ...]
}

def _parse_hhmm(s: str):
    try:
        h, m = s.split(":")
        return int(h), int(m)
    except Exception:
        return None

def check_system_open(ops: dict, now: datetime = None):
    """Returns (open: bool, reason: Optional[str]) — in America/Sao_Paulo (UTC-3)."""
    now = now or datetime.now(timezone.utc)
    local = now - timedelta(hours=3)  # BR local
    if not ops.get("enabled", True):
        return False, "Plataforma temporariamente desativada pelo administrador."
    wd = local.weekday()
    if wd in (ops.get("disabled_weekdays") or []):
        return False, "Sem atendimento neste dia da semana (configuração do admin)."
    day = local.strftime("%Y-%m-%d")
    if day in (ops.get("holidays") or []):
        return False, f"Sem atendimento (feriado {day})."
    ot = _parse_hhmm(ops.get("open_time") or "00:00")
    ct = _parse_hhmm(ops.get("close_time") or "23:59")
    if ot and ct:
        mins = local.hour * 60 + local.minute
        om = ot[0] * 60 + ot[1]
        cm = ct[0] * 60 + ct[1]
        if not (om <= mins <= cm):
            return False, f"Fora do horário de atendimento ({ops['open_time']}–{ops['close_time']})."
    return True, None

async def get_ops():
    s = await db.admin_settings.find_one({"_id": "settings"}) or {}
    return {**DEFAULT_OPS, **(s.get("operations") or {})}

app = FastAPI(title="GiroExpress API")
api = APIRouter(prefix="/api")

class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    vehicle: Optional[str] = None
    allow_batch: Optional[bool] = True

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class DeliveryIn(BaseModel):
    pickup_address: str
    dropoff_address: str
    client_name: str
    client_phone: Optional[str] = None
    distance_km: Optional[float] = None
    batch_id: Optional[str] = None
    notes: Optional[str] = None

class QuoteIn(BaseModel):
    pickup_address: Optional[str] = None
    dropoff_address: Optional[str] = None
    distance_km: Optional[float] = None

class TicketIn(BaseModel):
    subject: str
    priority: str = "media"
    delivery_id: Optional[str] = None
    message: Optional[str] = None

class TicketMessageIn(BaseModel):
    text: str

class ChatMessageIn(BaseModel):
    text: str

class UserPatchIn(BaseModel):
    status: Optional[str] = None
    allow_batch: Optional[bool] = None
    name: Optional[str] = None

class OnlineIn(BaseModel):
    online: bool

class BankIn(BaseModel):
    bank: Optional[str] = None
    agency: Optional[str] = None
    account: Optional[str] = None
    pix_key: Optional[str] = None

class ApproveStatementIn(BaseModel):
    approved: bool

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=6)

class OperationsSettingsIn(BaseModel):
    disabled_weekdays: Optional[List[int]] = None   # 0=Mon..6=Sun
    open_time: Optional[str] = None                 # "HH:MM"
    close_time: Optional[str] = None                # "HH:MM"
    holidays: Optional[List[str]] = None            # ["YYYY-MM-DD", ...]
    enabled: Optional[bool] = None                  # master switch

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.deliveries.create_index([("store_id", 1), ("created_at", -1)])
    await db.deliveries.create_index([("courier_id", 1), ("created_at", -1)])
    await db.statements.create_index([("store_id", 1), ("period_start", -1)])
    await db.tickets.create_index([("created_at", -1)])
    await db.chat_messages.create_index([("delivery_id", 1), ("created_at", 1)])
    try:
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass

    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": ADMIN_NAME,
            "role": "admin",
            "status": "active",
            "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        logger.info(f"Admin password updated: {ADMIN_EMAIL}")

    if not await db.admin_settings.find_one({"_id": "settings"}):
        await db.admin_settings.insert_one({"_id": "settings", "bank": {"bank": "", "agency": "", "account": "", "pix_key": ""}, "platform_fee": PLATFORM_FEE})

    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    if body.role not in ("store", "courier"):
        raise HTTPException(400, "Role must be 'store' or 'courier'")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "E-mail já cadastrado")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "status": "active" if body.role == "store" else "pending",
        "phone": body.phone,
        "address": body.address,
        "vehicle": body.vehicle,
        "allow_batch": bool(body.allow_batch),
        "online": False,
        "created_at": now_iso(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    access = make_access(str(result.inserted_id), email, body.role)
    refresh = make_refresh(str(result.inserted_id))
    set_auth_cookies(response, access, refresh)
    return {"user": user_to_public(doc), "access_token": access}

@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    ident = f"{ip}:{email}"
    await check_lockout(ident)
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(body.password, u["password_hash"]):
        await register_failed(ident)
        raise HTTPException(401, "E-mail ou senha inválidos")
    if u.get("status") == "blocked":
        raise HTTPException(403, "Conta bloqueada. Contate o administrador.")
    await clear_attempts(ident)
    access = make_access(str(u["_id"]), email, u["role"])
    refresh = make_refresh(str(u["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": user_to_public(u), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user_to_public(user)}

@api.get("/pricing/table")
async def pricing_table():
    return {"table": [{"km": r[0], "price": r[1], "time_min": r[2]} for r in PRICING_TABLE], "platform_fee": PLATFORM_FEE}

@api.post("/pricing/quote")
async def quote(body: QuoteIn):
    km = body.distance_km
    geocoded = False
    if km is None and body.pickup_address and body.dropoff_address:
        a = geocode_address(body.pickup_address)
        b = geocode_address(body.dropoff_address)
        if a and b:
            km = round(haversine_km(a[0], a[1], b[0], b[1]) * 1.35, 2)
            geocoded = True
    if km is None:
        raise HTTPException(400, "Informe distance_km ou endereços válidos.")
    p = price_from_km(km)
    return {"distance_km": km, "geocoded": geocoded, **p}

def delivery_to_public(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "code": d.get("code"),
        "store_id": d.get("store_id"),
        "store_name": d.get("store_name"),
        "pickup_address": d.get("pickup_address"),
        "dropoff_address": d.get("dropoff_address"),
        "client_name": d.get("client_name"),
        "client_phone": d.get("client_phone"),
        "distance_km": d.get("distance_km"),
        "gross_price": d.get("gross_price"),
        "platform_fee": d.get("platform_fee"),
        "net_courier": d.get("net_courier"),
        "estimated_min": d.get("estimated_min"),
        "status": d.get("status"),
        "courier_id": d.get("courier_id"),
        "courier_name": d.get("courier_name"),
        "batch_id": d.get("batch_id"),
        "notes": d.get("notes"),
        "allow_batch": d.get("allow_batch"),
        "created_at": d.get("created_at"),
        "accepted_at": d.get("accepted_at"),
        "delivered_at": d.get("delivered_at"),
    }

async def next_delivery_code() -> str:
    return f"DEL-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:5].upper()}"

@api.post("/deliveries")
async def create_delivery(body: DeliveryIn, user: dict = Depends(require_roles("store"))):
    ops = await get_ops()
    is_open, reason = check_system_open(ops)
    if not is_open:
        raise HTTPException(400, reason or "Sistema fechado.")
    km = body.distance_km
    geocoded = False
    if km is None:
        a = geocode_address(body.pickup_address)
        b = geocode_address(body.dropoff_address)
        if a and b:
            km = round(haversine_km(a[0], a[1], b[0], b[1]) * 1.35, 2)
            geocoded = True
        else:
            raise HTTPException(400, "Não foi possível calcular a distância. Informe distance_km ou endereços mais completos.")
    p = price_from_km(km)

    batch_id = body.batch_id
    if batch_id:
        count = await db.deliveries.count_documents({"batch_id": batch_id, "store_id": str(user["_id"])})
        if count >= 3:
            raise HTTPException(400, "Lote já atingiu o limite de 3 entregas.")
        if not user.get("allow_batch", True):
            raise HTTPException(400, "Loja não autoriza lotes.")

    code = await next_delivery_code()
    doc = {
        "code": code,
        "store_id": str(user["_id"]),
        "store_name": user["name"],
        "pickup_address": body.pickup_address,
        "dropoff_address": body.dropoff_address,
        "client_name": body.client_name,
        "client_phone": body.client_phone,
        "distance_km": km,
        "gross_price": p["gross_price"],
        "platform_fee": p["platform_fee"],
        "net_courier": p["net_courier"],
        "estimated_min": p["estimated_min"],
        "status": "pending",
        "courier_id": None,
        "courier_name": None,
        "batch_id": batch_id,
        "notes": body.notes,
        "allow_batch": bool(user.get("allow_batch", True)),
        "created_at": now_iso(),
        "geocoded": geocoded,
    }
    r = await db.deliveries.insert_one(doc)
    doc["_id"] = r.inserted_id
    return delivery_to_public(doc)

@api.get("/deliveries")
async def list_deliveries(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    role = user["role"]
    uid = str(user["_id"])
    if role == "store":
        q["store_id"] = uid
    elif role == "courier":
        if user.get("status") != "active":
            # pending/blocked couriers only see their own history, no available leaks
            q["courier_id"] = uid
        elif status == "available":
            q = {"status": "pending", "courier_id": None}
        else:
            q["$or"] = [{"courier_id": uid}, {"status": "pending", "courier_id": None}]
    if status and status != "available":
        q["status"] = status
    docs = await db.deliveries.find(q).sort("created_at", -1).to_list(500)
    return [delivery_to_public(d) for d in docs]

@api.get("/deliveries/{delivery_id}")
async def get_delivery(delivery_id: str, user: dict = Depends(get_current_user)):
    try:
        d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    except Exception:
        raise HTTPException(400, "Invalid id")
    if not d:
        raise HTTPException(404, "Not found")
    if user["role"] == "store" and d.get("store_id") != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    if user["role"] == "courier" and d.get("courier_id") not in (str(user["_id"]), None):
        raise HTTPException(403, "Forbidden")
    return delivery_to_public(d)

@api.post("/deliveries/{delivery_id}/accept")
async def accept_delivery(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    if user.get("status") != "active":
        raise HTTPException(403, "Sua conta ainda não foi aprovada pelo administrador.")
    if not user.get("online"):
        raise HTTPException(400, "Fique online para aceitar corridas.")
    d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    if not d:
        raise HTTPException(404, "Not found")
    if d.get("status") != "pending":
        raise HTTPException(400, "Corrida indisponível.")

    active_same = await db.deliveries.count_documents({"courier_id": str(user["_id"]), "store_id": d["store_id"], "status": {"$in": ["accepted", "in_transit"]}})
    if active_same >= 3:
        raise HTTPException(400, "Limite de 3 entregas simultâneas da mesma loja atingido.")

    await db.deliveries.update_one({"_id": d["_id"]}, {"$set": {"status": "accepted", "courier_id": str(user["_id"]), "courier_name": user["name"], "accepted_at": now_iso()}})
    updated = await db.deliveries.find_one({"_id": d["_id"]})
    return delivery_to_public(updated)

@api.post("/deliveries/{delivery_id}/start")
async def start_delivery(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    if not d or d.get("courier_id") != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    if d.get("status") != "accepted":
        raise HTTPException(400, "Status inválido.")
    await db.deliveries.update_one({"_id": d["_id"]}, {"$set": {"status": "in_transit"}})
    updated = await db.deliveries.find_one({"_id": d["_id"]})
    return delivery_to_public(updated)

@api.post("/deliveries/{delivery_id}/complete")
async def complete_delivery(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    if not d or d.get("courier_id") != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    if d.get("status") not in ("accepted", "in_transit"):
        raise HTTPException(400, "Status inválido.")
    await db.deliveries.update_one({"_id": d["_id"]}, {"$set": {"status": "delivered", "delivered_at": now_iso()}})
    updated = await db.deliveries.find_one({"_id": d["_id"]})
    await accumulate_statement(updated)
    return delivery_to_public(updated)

@api.post("/deliveries/{delivery_id}/cancel")
async def cancel_delivery(delivery_id: str, user: dict = Depends(get_current_user)):
    d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    if not d:
        raise HTTPException(404, "Not found")
    allowed = user["role"] == "admin" or (user["role"] == "store" and d.get("store_id") == str(user["_id"]) and d.get("status") == "pending")
    if not allowed:
        raise HTTPException(403, "Forbidden")
    await db.deliveries.update_one({"_id": d["_id"]}, {"$set": {"status": "cancelled"}})
    return {"ok": True}

async def accumulate_statement(delivery: dict):
    start, end, due = current_cycle_bounds()
    key = {"store_id": delivery["store_id"], "period_start": start.isoformat()}
    stmt = await db.statements.find_one(key)
    if not stmt:
        await db.statements.insert_one({
            **key,
            "store_name": delivery.get("store_name"),
            "period_end": end.isoformat(),
            "due_date": due.isoformat(),
            "cycle_label": cycle_label(start, end),
            "total_gross": 0.0,
            "total_platform_fee": 0.0,
            "total_deliveries": 0,
            "delivery_ids": [],
            "status": "open",
            "proof_path": None,
            "proof_uploaded_at": None,
            "created_at": now_iso(),
        })
    await db.statements.update_one(key, {
        "$inc": {"total_gross": delivery["gross_price"], "total_platform_fee": delivery["platform_fee"], "total_deliveries": 1},
        "$push": {"delivery_ids": str(delivery["_id"])},
    })

def statement_public(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "store_id": s.get("store_id"),
        "store_name": s.get("store_name"),
        "period_start": s.get("period_start"),
        "period_end": s.get("period_end"),
        "due_date": s.get("due_date"),
        "cycle_label": s.get("cycle_label"),
        "total_gross": round(s.get("total_gross", 0.0), 2),
        "total_platform_fee": round(s.get("total_platform_fee", 0.0), 2),
        "total_deliveries": s.get("total_deliveries", 0),
        "status": s.get("status", "open"),
        "proof_path": s.get("proof_path"),
        "proof_uploaded_at": s.get("proof_uploaded_at"),
    }

@api.get("/statements")
async def list_statements(user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] == "store":
        q = {"store_id": str(user["_id"])}
    elif user["role"] == "courier":
        raise HTTPException(403, "Forbidden")
    docs = await db.statements.find(q).sort("period_start", -1).to_list(200)
    return [statement_public(s) for s in docs]

@api.post("/statements/{statement_id}/proof")
async def upload_proof(statement_id: str, file: UploadFile = File(...), user: dict = Depends(require_roles("store"))):
    s = await db.statements.find_one({"_id": oid(statement_id)})
    if not s or s.get("store_id") != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    if s.get("status") == "approved":
        raise HTTPException(400, "Fechamento já aprovado.")
    ext = (file.filename or "bin").split(".")[-1].lower()
    path = f"{APP_NAME}/receipts/{user['_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Arquivo maior que 8MB.")
    ctype = file.content_type or "application/octet-stream"
    res = put_object(path, data, ctype)
    await db.files.insert_one({
        "storage_path": res["path"],
        "content_type": ctype,
        "original_filename": file.filename,
        "size": res.get("size", len(data)),
        "user_id": str(user["_id"]),
        "kind": "receipt",
        "statement_id": str(s["_id"]),
        "created_at": now_iso(),
    })
    await db.statements.update_one({"_id": s["_id"]}, {"$set": {"proof_path": res["path"], "proof_uploaded_at": now_iso(), "status": "under_review"}})
    return {"ok": True, "proof_path": res["path"]}

@api.get("/files")
async def get_file(path: str = Query(...), user: dict = Depends(get_current_user)):
    rec = await db.files.find_one({"storage_path": path})
    if not rec:
        raise HTTPException(404, "Not found")
    if user["role"] != "admin" and rec.get("user_id") != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    data, ctype = get_object(path)
    return FastAPIResponse(content=data, media_type=rec.get("content_type", ctype))

@api.post("/statements/{statement_id}/approve")
async def approve_statement(statement_id: str, body: ApproveStatementIn, user: dict = Depends(require_roles("admin"))):
    s = await db.statements.find_one({"_id": oid(statement_id)})
    if not s:
        raise HTTPException(404, "Not found")
    new_status = "approved" if body.approved else "rejected"
    await db.statements.update_one({"_id": s["_id"]}, {"$set": {"status": new_status, "reviewed_at": now_iso(), "reviewed_by": str(user["_id"])}})
    return {"ok": True, "status": new_status}

def ticket_public(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "code": t.get("code"),
        "subject": t.get("subject"),
        "priority": t.get("priority"),
        "status": t.get("status"),
        "delivery_id": t.get("delivery_id"),
        "opened_by_id": t.get("opened_by_id"),
        "opened_by_name": t.get("opened_by_name"),
        "opened_by_role": t.get("opened_by_role"),
        "messages": t.get("messages", []),
        "created_at": t.get("created_at"),
    }

@api.post("/tickets")
async def create_ticket(body: TicketIn, user: dict = Depends(get_current_user)):
    code = f"TCK-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "code": code,
        "subject": body.subject,
        "priority": body.priority,
        "status": "open",
        "delivery_id": body.delivery_id,
        "opened_by_id": str(user["_id"]),
        "opened_by_name": user["name"],
        "opened_by_role": user["role"],
        "messages": [{"sender_id": str(user["_id"]), "sender_name": user["name"], "sender_role": user["role"], "text": body.message or body.subject, "created_at": now_iso()}],
        "created_at": now_iso(),
    }
    r = await db.tickets.insert_one(doc)
    doc["_id"] = r.inserted_id
    return ticket_public(doc)

@api.get("/tickets")
async def list_tickets(user: dict = Depends(get_current_user)):
    q = {} if user["role"] == "admin" else {"opened_by_id": str(user["_id"])}
    docs = await db.tickets.find(q).sort("created_at", -1).to_list(200)
    return [ticket_public(t) for t in docs]

@api.post("/tickets/{ticket_id}/message")
async def ticket_message(ticket_id: str, body: TicketMessageIn, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"_id": oid(ticket_id)})
    if not t:
        raise HTTPException(404, "Not found")
    if user["role"] != "admin" and t.get("opened_by_id") != str(user["_id"]):
        raise HTTPException(403, "Forbidden")
    msg = {"sender_id": str(user["_id"]), "sender_name": user["name"], "sender_role": user["role"], "text": body.text, "created_at": now_iso()}
    await db.tickets.update_one({"_id": t["_id"]}, {"$push": {"messages": msg}})
    return {"ok": True}

@api.post("/tickets/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, user: dict = Depends(require_roles("admin"))):
    await db.tickets.update_one({"_id": oid(ticket_id)}, {"$set": {"status": "resolved", "resolved_at": now_iso()}})
    return {"ok": True}

async def can_view_delivery(user: dict, d: dict) -> bool:
    if user["role"] == "admin":
        return True
    uid = str(user["_id"])
    return d.get("store_id") == uid or d.get("courier_id") == uid

@api.get("/deliveries/{delivery_id}/chat")
async def get_chat(delivery_id: str, user: dict = Depends(get_current_user)):
    d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    if not d:
        raise HTTPException(404, "Not found")
    if not await can_view_delivery(user, d):
        raise HTTPException(403, "Forbidden")
    msgs = await db.chat_messages.find({"delivery_id": delivery_id}).sort("created_at", 1).to_list(500)
    return [{"id": str(m["_id"]), "sender_id": m["sender_id"], "sender_name": m["sender_name"], "sender_role": m["sender_role"], "text": m["text"], "created_at": m["created_at"]} for m in msgs]

@api.post("/deliveries/{delivery_id}/chat")
async def send_chat(delivery_id: str, body: ChatMessageIn, user: dict = Depends(get_current_user)):
    d = await db.deliveries.find_one({"_id": oid(delivery_id)})
    if not d:
        raise HTTPException(404, "Not found")
    if not await can_view_delivery(user, d):
        raise HTTPException(403, "Forbidden")
    doc = {"delivery_id": delivery_id, "sender_id": str(user["_id"]), "sender_name": user["name"], "sender_role": user["role"], "text": body.text, "created_at": now_iso()}
    r = await db.chat_messages.insert_one(doc)
    return {"id": str(r.inserted_id), **{k: v for k, v in doc.items() if k != "_id"}}

@api.post("/couriers/me/online")
async def set_online(body: OnlineIn, user: dict = Depends(require_roles("courier"))):
    if user.get("status") != "active":
        raise HTTPException(403, "Aguardando aprovação do administrador para ficar online.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"online": body.online}})
    return {"ok": True, "online": body.online}

@api.post("/stores/me/allow-batch")
async def set_allow_batch(body: dict, user: dict = Depends(require_roles("store"))):
    val = bool(body.get("allow_batch", True))
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"allow_batch": val}})
    return {"ok": True, "allow_batch": val}

@api.get("/admin/users")
async def admin_list_users(user: dict = Depends(require_roles("admin"))):
    docs = await db.users.find({}).sort("created_at", -1).to_list(1000)
    return [user_to_public(u) for u in docs]

@api.patch("/admin/users/{user_id}")
async def admin_patch_user(user_id: str, body: UserPatchIn, user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd:
        return {"ok": True}
    await db.users.update_one({"_id": oid(user_id)}, {"$set": upd})
    return {"ok": True}

@api.post("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    await db.users.update_one({"_id": oid(user_id)}, {"$set": {"status": "active"}})
    return {"ok": True}

@api.get("/admin/settings")
async def admin_get_settings(user: dict = Depends(require_roles("admin"))):
    s = await db.admin_settings.find_one({"_id": "settings"})
    return {"bank": s.get("bank", {}), "platform_fee": s.get("platform_fee", PLATFORM_FEE)}

@api.put("/admin/settings/bank")
async def admin_set_bank(body: BankIn, user: dict = Depends(require_roles("admin"))):
    await db.admin_settings.update_one({"_id": "settings"}, {"$set": {"bank": body.dict()}}, upsert=True)
    return {"ok": True}

@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_roles("admin"))):
    total_users = await db.users.count_documents({})
    total_stores = await db.users.count_documents({"role": "store"})
    total_couriers = await db.users.count_documents({"role": "courier"})
    total_deliveries = await db.deliveries.count_documents({})
    delivered = await db.deliveries.count_documents({"status": "delivered"})
    total_fees_agg = await db.deliveries.aggregate([{"$match": {"status": "delivered"}}, {"$group": {"_id": None, "total": {"$sum": "$platform_fee"}}}]).to_list(1)
    fees = total_fees_agg[0]["total"] if total_fees_agg else 0.0
    open_tickets = await db.tickets.count_documents({"status": "open"})
    return {"total_users": total_users, "total_stores": total_stores, "total_couriers": total_couriers, "total_deliveries": total_deliveries, "delivered": delivered, "platform_fees_collected": round(fees, 2), "open_tickets": open_tickets}

import secrets as _secrets

@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    email = body.email.lower()
    u = await db.users.find_one({"email": email})
    # Never leak whether email exists
    if u:
        token = _secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": str(u["_id"]),
            "email": email,
            "expires_at": expires,
            "used": False,
            "created_at": now_iso(),
        })
        reset_link = f"{os.environ.get('FRONTEND_URL', '')}/reset-password?token={token}"
        logger.info(f"[PASSWORD RESET] {email} => {reset_link}")
        # In demo mode, return the link so it can be surfaced by admin/test.
        # In production, replace with email sending (Resend/SendGrid).
        return {"ok": True, "demo_reset_link": reset_link}
    return {"ok": True}

@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec:
        raise HTTPException(400, "Token inválido.")
    if rec.get("used"):
        raise HTTPException(400, "Token já utilizado.")
    expires = rec["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(400, "Token expirado.")
    await db.users.update_one({"_id": oid(rec["user_id"])}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True, "used_at": now_iso()}})
    return {"ok": True}

@api.get("/system/status")
async def system_status():
    ops = await get_ops()
    is_open, reason = check_system_open(ops)
    return {"open": is_open, "reason": reason, "ops": ops}

@api.get("/admin/settings/operations")
async def admin_get_ops(user: dict = Depends(require_roles("admin"))):
    return await get_ops()

@api.put("/admin/settings/operations")
async def admin_set_ops(body: OperationsSettingsIn, user: dict = Depends(require_roles("admin"))):
    curr = await get_ops()
    upd = {k: v for k, v in body.dict().items() if v is not None}
    # validate weekdays
    if "disabled_weekdays" in upd:
        upd["disabled_weekdays"] = sorted({int(x) for x in upd["disabled_weekdays"] if 0 <= int(x) <= 6})
    # validate holiday format
    if "holidays" in upd:
        valid = []
        for h in upd["holidays"]:
            try:
                datetime.strptime(h, "%Y-%m-%d")
                valid.append(h)
            except Exception:
                pass
        upd["holidays"] = sorted(set(valid))
    if "open_time" in upd and not _parse_hhmm(upd["open_time"]):
        raise HTTPException(400, "open_time inválido (HH:MM)")
    if "close_time" in upd and not _parse_hhmm(upd["close_time"]):
        raise HTTPException(400, "close_time inválido (HH:MM)")
    merged = {**curr, **upd}
    await db.admin_settings.update_one({"_id": "settings"}, {"$set": {"operations": merged}}, upsert=True)
    return merged

@api.get("/")
async def root():
    return {"service": "giroexpress", "status": "ok"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
