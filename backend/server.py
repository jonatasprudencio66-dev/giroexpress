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
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("giroexpress")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "giroexpress")
JWT_SECRET = os.environ.get("JWT_SECRET", "supersecretkey")
JWT_ALG = "HS256"
admin_email_raw = os.environ.get("ADMIN_EMAIL", "admin@giroexpress.com")
ADMIN_EMAIL = admin_email_raw.lower() if admin_email_raw else "admin@giroexpress.com"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin")
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

DELIVERY_RATES = {
    "cidade": 8.00,
    "condominio_cidade": 10.00,
    "raizes_botanico": 12.00,
    "reserva_bosque": 15.00,
    "afastados": 20.00,
}

def calculate_delivery_price(delivery_type: str, custom_price: Optional[float] = None) -> dict:
    if delivery_type == "custom":
        gross = float(custom_price or 0.0)
    else:
        gross = DELIVERY_RATES.get(delivery_type, 8.00)
    
    net = round(gross - PLATFORM_FEE, 2)
    return {
        "delivery_type": delivery_type,
        "gross_price": gross,
        "platform_fee": PLATFORM_FEE,
        "net_courier": net
    }

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

LOCKOUT_MAX = 5
LOCKOUT_MIN = 15

async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"_id": identifier})
    if not rec:
        return
    if rec.get("locked_until"):
        locked = datetime.fromisoformat(rec["locked_until"])
        if datetime.now(timezone.utc) < locked:
            raise HTTPException(429, "Muitas tentativas. Tente novamente em alguns minutos.")

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

app = FastAPI(title="GiroExpress API")

from fastapi import Response as FastAPIResponse
from starlette.middleware.base import BaseHTTPMiddleware

class CustomCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS":
            response = FastAPIResponse(status_code=200)
        else:
            response = await call_next(request)
            
        origin = request.headers.get("origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With"
        
        return response

app.add_middleware(CustomCORSMiddleware)

api = APIRouter(prefix="/api")
app.include_router(api)

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

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.deliveries.create_index([("store_id", 1), ("created_at", -1)])
    await db.deliveries.create_index([("courier_id", 1), ("created_at", -1)])
    
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

@app.on_event("shutdown")
async def shutdown():
    client.close()

async def _do_register(body: RegisterIn, response: Response):
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

async def _do_login(body: LoginIn, request: Request, response: Response):
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

# Rotas dentro do APIRouter (/api/...)
@api.post("/auth/register")
async def register_api(body: RegisterIn, response: Response):
    return await _do_register(body, response)

@api.post("/auth/login")
async def login_api(body: LoginIn, request: Request, response: Response):
    return await _do_login(body, request, response)

@api.post("/auth/logout")
async def logout_api(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me_api(user: dict = Depends(get_current_user)):
    return {"user": user_to_public(user)}

@api.get("/pricing/table")
async def pricing_table():
    return {"rates": DELIVERY_RATES, "platform_fee": PLATFORM_FEE}

@api.post("/pricing/quote")
async def quote(body: dict):
    delivery_type = body.get("delivery_type", "cidade")
    custom_price = body.get("custom_price")
    return calculate_delivery_price(delivery_type, custom_price)

@api.post("/deliveries/{delivery_id}/accept")
async def accept_delivery_api(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    res = await db.deliveries.update_one(
        {"_id": ObjectId(delivery_id), "status": "pending"},
        {"$set": {"courier_id": str(user["_id"]), "courier_name": user["name"], "status": "accepted"}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Entrega não disponível ou já aceita.")
    return {"ok": True}

@app.post("/deliveries/{delivery_id}/accept")
@app.post("/api/deliveries/{delivery_id}/accept")
async def accept_delivery_direct(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    res = await db.deliveries.update_one(
        {"_id": ObjectId(delivery_id), "status": "pending"},
        {"$set": {"courier_id": str(user["_id"]), "courier_name": user["name"], "status": "accepted"}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Entrega não disponível ou já aceita.")
    return {"ok": True}

@app.get("/api/deliveries/{delivery_id}/chat")
async def get_delivery_chat(delivery_id: str, user: dict = Depends(get_current_user)):
    query = {"id": delivery_id}
    try:
        query = {"$or": [{"_id": ObjectId(delivery_id)}, {"id": delivery_id}]}
    except Exception:
        pass
        
    delivery = await db.deliveries.find_one(query)
    if not delivery:
        return []
    return delivery.get("chat", [])

@app.post("/api/deliveries/{delivery_id}/chat")
async def send_delivery_chat(delivery_id: str, body: dict, user: dict = Depends(get_current_user)):
    message_text = body.get("message")
    if not message_text:
        return {"error": "Mensagem vazia"}
    
    chat_message = {
        "sender_id": str(user.get("_id", user.get("id"))),
        "sender_name": user.get("name", "Usuário"),
        "message": message_text,
        "created_at": now_iso()
    }
    
    query = {"id": delivery_id}
    try:
        query = {"$or": [{"_id": ObjectId(delivery_id)}, {"id": delivery_id}]}
    except Exception:
        pass

    result = await db.deliveries.update_one(
        query,
        {"$push": {"chat": chat_message}}
    )
    
    if result.modified_count == 0:
        return {"error": "Entrega não encontrada para salvar mensagem"}
        
    return {"status": "ok", "message": chat_message}



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
        "status": d.get("status"),
        "courier_id": d.get("courier_id"),
        "courier_name": d.get("courier_name"),
        "batch_id": d.get("batch_id"),
        "notes": d.get("notes"),
        "created_at": d.get("created_at"),
    }

async def next_delivery_code() -> str:
    return f"DEL-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:5].upper()}"

@api.post("/deliveries")
async def create_delivery(body: DeliveryIn, user: dict = Depends(require_roles("store"))):
    p = calculate_delivery_price("cidade", None)
    code = await next_delivery_code()
    doc = {
        "code": code,
        "store_id": str(user["_id"]),
        "store_name": user["name"],
        "pickup_address": body.pickup_address,
        "dropoff_address": body.dropoff_address,
        "client_name": body.client_name,
        "client_phone": body.client_phone,
        "distance_km": body.distance_km or 0.0,
        "gross_price": p["gross_price"],
        "platform_fee": p["platform_fee"],
        "net_courier": p["net_courier"],
        "status": "pending",
        "courier_id": None,
        "courier_name": None,
        "batch_id": body.batch_id,
        "notes": body.notes or "",
        "created_at": now_iso(),
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
        if status == "available":
            q = {"status": "pending", "courier_id": None}
        else:
            q["$or"] = [{"courier_id": uid}, {"status": "pending", "courier_id": None}]
    if status and status != "available":
        q["status"] = status
    docs = await db.deliveries.find(q).sort("created_at", -1).to_list(500)
    return [delivery_to_public(d) for d in docs]

app.include_router(api)

# Espelho na raiz caso qualquer requisição bata fora do /api
@app.get("/me")
@app.get("/auth/me")
@app.get("/api/me")
@app.get("/api/auth/me")
async def me_direct(user: dict = Depends(get_current_user)):
    user_id = user.get("_id") or user.get("id")
    try:
        obj_id = ObjectId(user_id)
    except:
        obj_id = user_id
        
    latest_user = await db.users.find_one({"$or": [{"_id": obj_id}, {"id": str(user_id)}]})
    if latest_user:
        user = latest_user
        
    # Converte o objeto do banco para público
    public_data = user_to_public(user)
    
    # Força os sinalizadores de aprovação em todas as variações que o front-end pode ler
    status_val = str(user.get("status", "")).lower()
    if status_val in ["active", "approved", "ACTIVE", "APPROVED"]:
        public_data["status"] = "active"
        public_data["approved"] = True
        public_data["is_approved"] = True
        public_data["active"] = True
    else:
        # Se não estiver ativo, garante que o front saiba o motivo
        public_data["status"] = status_val or "pending"
        public_data["approved"] = False
        public_data["is_approved"] = False
    
    return {"user": public_data}

@app.post("/login")
@app.post("/auth/login")
@app.post("/api/login")
@app.post("/api/auth/login")
async def login_direct(body: LoginIn, request: Request, response: Response):
    return await _do_login(body, request, response)

@app.post("/register")
@app.post("/auth/register")
@app.post("/api/register")
@app.post("/api/auth/register")
async def register_direct(body: RegisterIn, response: Response):
    return await _do_register(body, response)

@app.post("/logout")
@app.post("/auth/logout")
@app.post("/api/logout")
@app.post("/api/auth/logout")
async def logout_direct(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@app.get("/admin/settings")
@app.get("/api/admin/settings")
async def admin_settings_direct(user: dict = Depends(require_roles("admin"))):
    settings = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "active": settings.get("active", True),
        "disabled_days": settings.get("disabled_days", []),
        "open_time": settings.get("open_time", "00:00"),
        "close_time": settings.get("close_time", "23:59"),
        "holidays": settings.get("holidays", [])
    }

@app.post("/admin/users/{user_id}/approve")
@app.post("/api/admin/users/{user_id}/approve")
async def approve_user(user_id: str, admin: dict = Depends(require_roles("admin"))):
    try:
        obj_id = ObjectId(user_id)
    except:
        obj_id = user_id

    result = await db.users.update_one(
        {"$or": [{"_id": obj_id}, {"id": user_id}]},
        {"$set": {
            "status": "active", 
            "approved": True, 
            "is_approved": True, 
            "active": True,
            "verified": True,
            "is_verified": True
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
  
    return {"ok": True, "message": "Usuário aprovado com sucesso"}

@app.post("/deliveries/{delivery_id}/accept")
@app.post("/api/deliveries/{delivery_id}/accept")
async def accept_delivery(delivery_id: str, user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(delivery_id)
    except:
        obj_id = delivery_id

    result = await db.deliveries.update_one(
        {"$or": [{"_id": obj_id}, {"id": delivery_id}], "status": "PENDING"},
        {
            "$set": {
                "status": "ACCEPTED",
                "courier_id": str(user.get("_id", user.get("id"))),
                "courier_name": user.get("name", "Entregador")
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Esta corrida já foi aceita por outro entregador.")

    return {"ok": True, "message": "Corrida aceita com sucesso!"}

@app.get("/tickets")
@app.get("/api/tickets")


@app.get("/tickets")
@app.get("/api/tickets")
async def get_tickets_direct(user: dict = Depends(get_current_user)):
    docs = await db.tickets.find().to_list(500)
    return docs 

@app.get("/admin/users")
@app.get("/api/admin/users")
async def admin_users_direct(user: dict = Depends(require_roles("admin"))):
    docs = await db.users.find().to_list(500)
    cleaned_docs = []
    for u in docs:
        try:
            u["_id"] = str(u["_id"])
            # Adiciona esta linha para garantir que o campo id exista para o front-end
            u["id"] = u.get("id") or u["_id"]
            
            status_val = u.get("status")
            u["status"] = str(status_val).lower() if status_val else "pending"
            cleaned_docs.append(u)
        except Exception:
            continue
    return cleaned_docs

@app.get("/admin/stats")
@app.get("/api/admin/stats")
async def admin_stats_direct(user: dict = Depends(require_roles("admin"))):
    total_users = await db.users.count_documents({})
    total_stores = await db.users.count_documents({"role": "store"})
    total_couriers = await db.users.count_documents({"role": "courier"})

    deliveries = await db.deliveries.find({"status": {"$in": ["completed", "delivered"]}}).to_list(None)
    total_delivered = len(deliveries)

    store_fees_map = {}
    for d in deliveries:
        store_id = str(d.get("store_id", "Desconhecida"))
        store_name = d.get("store_name", "Loja")
        raw_date = d.get("created_at")
        
        if isinstance(raw_date, datetime):
            br_date = raw_date.astimezone(timezone(timedelta(hours=-3)))
            date_str = br_date.strftime("%Y-%m-%d")
        else:
            date_str = str(raw_date)[:10]
            
        fee = float(d.get("platform_fee", 1.0))

        key = f"{store_id}_{date_str}"
        if key not in store_fees_map:
            store_fees_map[key] = {
                "store_name": store_name,
                "date": date_str,
                "deliveries_count": 0,
                "total_fee": 0.0
            }
        store_fees_map[key]["deliveries_count"] += 1
        store_fees_map[key]["total_fee"] += fee

    collected_fees = sum(item["total_fee"] for item in store_fees_map.values())

    return {
        "platform_fees_collected": collected_fees,
        "total_users": total_users,
        "total_stores": total_stores,
        "total_couriers": total_couriers,
        "total_deliveries": await db.deliveries.count_documents({}),
        "delivered": total_delivered,
        "open_tickets": await db.tickets.count_documents({"status": "open"}),
        "store_fees_details": list(store_fees_map.values())
    }

@app.get("/admin/settings/operations")
@app.get("/api/admin/settings/operations")

async def admin_operations_direct(user: dict = Depends(require_roles("admin"))):
    settings = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "active": settings.get("active", True),
        "disabled_days": settings.get("disabled_days", []),
        "open_time": settings.get("open_time", "00:00"),
        "close_time": settings.get("close_time", "23:59"),
        "holidays": settings.get("holidays", [])
    }

@app.patch("/admin/users/{user_id}")
@app.patch("/api/admin/users/{user_id}")
async def update_user_status_direct(user_id: str, request: Request, admin: dict = Depends(require_roles("admin"))):
    try:
        body = await request.json()
    except:
        body = {}
        
    try:
        obj_id = ObjectId(user_id)
    except:
        obj_id = user_id

    new_status = body.get("status", "BLOCKED")
    if isinstance(new_status, str):
        new_status = new_status.upper()

    result = await db.users.update_one(
        {"$or": [{"_id": obj_id}, {"id": user_id}]},
        {"$set": {"status": new_status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return {"ok": True, "message": "Status atualizado com sucesso"}

@app.get("/statements")
@app.get("/api/statements")
async def statements_store_direct(user: dict = Depends(get_current_user)):
    q = {"store_id": str(user["_id"])} if user["role"] == "store" else {}
    docs = await db.statements.find(q).to_list(500)
    return docs

@app.get("/system/status")
@app.get("/api/system/status")
async def system_status_direct():
    settings = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "active": settings.get("active", True),
        "maintenance": settings.get("maintenance", False)
    }

@app.post("/couriers/me/online")
@app.post("/api/couriers/me/online")
async def courier_online_direct(user: dict = Depends(require_roles("courier"))):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"online": True}})
    return {"ok": True}

@app.post("/deliveries/{delivery_id}/start")
@app.post("/api/deliveries/{delivery_id}/start")
async def start_delivery_direct(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    await db.deliveries.update_one({"_id": ObjectId(delivery_id)}, {"$set": {"status": "picked_up"}})
    return {"ok": True}

@app.post("/deliveries/{delivery_id}/complete")
@app.post("/api/deliveries/{delivery_id}/complete")
async def complete_delivery_direct(delivery_id: str, user: dict = Depends(require_roles("courier"))):
    await db.deliveries.update_one({"_id": ObjectId(delivery_id)}, {"$set": {"status": "completed"}})
    return {"ok": True}

from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)

@app.post("/api/messages")
@app.post("/admin/messages")
async def send_message(data: dict, user: dict = Depends(get_current_user)):
    sender_id = str(user.get("id") or user.get("_id"))
    recipient_id = data.get("recipient_id")
    delivery_id = data.get("delivery_id")
    text = data.get("text")
    
    message_doc = {
        "delivery_id": delivery_id,
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "text": text,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.messages.insert_one(message_doc)
    
    # Envia a notificação em tempo real via WebSocket para o destinatário, se ele estiver online
    await manager.send_personal_message({
        "sender_id": sender_id,
        "sender_name": user.get("name", "Usuário"),
        "delivery_id": delivery_id,
        "text": text,
        "created_at": message_doc["created_at"].isoformat()
    }, recipient_id)
    
    return {"ok": True, "message": "Mensagem enviada com sucesso"}