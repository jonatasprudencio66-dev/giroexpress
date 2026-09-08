
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional
from zoneinfo import ZoneInfo

import bcrypt
import jwt
import requests

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Request,
    Response,
    Depends,
    WebSocket,
    WebSocketDisconnect,
)

from fastapi.responses import Response as FastAPIResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.base import BaseHTTPMiddleware


# =========================================================
# LOG
# =========================================================

logger = logging.getLogger("giroexpress")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


# =========================================================
# CONFIGURAÇÃO
# =========================================================

MONGO_URL = os.environ.get(
    "MONGO_URL",
    "mongodb://localhost:27017",
)

DB_NAME = os.environ.get(
    "DB_NAME",
    "giroexpress",
)

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "supersecretkey",
)

JWT_ALG = "HS256"

admin_email_raw = os.environ.get(
    "ADMIN_EMAIL",
    "admin@giroexpress.com",
)

ADMIN_EMAIL = (
    admin_email_raw.lower()
    if admin_email_raw
    else "admin@giroexpress.com"
)

ADMIN_PASSWORD = os.environ.get(
    "ADMIN_PASSWORD",
    "admin123",
)

ADMIN_NAME = os.environ.get(
    "ADMIN_NAME",
    "Admin",
)

APP_NAME = os.environ.get(
    "APP_NAME",
    "giroexpress",
)


# =========================================================
# TAXA DA PLATAFORMA
# =========================================================

# R$ 1,00 por entrega concluída.
PLATFORM_FEE = 1.00


# =========================================================
# LIMITE DE PEDIDOS POR ENTREGADOR
# =========================================================

MAX_ACTIVE_DELIVERIES_PER_COURIER = 8

ACTIVE_COURIER_DELIVERY_STATUSES = [
    "accepted",
    "picked_up",
    "in_progress",
]


# =========================================================
# FUSO HORÁRIO / FATURAMENTO
# =========================================================

BRAZIL_TZ = ZoneInfo("America/Sao_Paulo")

BILLING_WEEKDAYS = [
    {"i": 0, "label": "Segunda-feira"},
    {"i": 1, "label": "Terça-feira"},
    {"i": 2, "label": "Quarta-feira"},
    {"i": 3, "label": "Quinta-feira"},
    {"i": 4, "label": "Sexta-feira"},
    {"i": 5, "label": "Sábado"},
    {"i": 6, "label": "Domingo"},
]

DEFAULT_BILLING_WEEKDAY = 6


# =========================================================
# STORAGE
# =========================================================

STORAGE_BASE = (
    os.environ.get("INTEGRATION_PROXY_URL") or ""
).strip() or "https://integrations.emergentagent.com"

STORAGE_URL = (
    STORAGE_BASE.rstrip("/")
    + "/objstore/api/v1/storage"
)

EMERGENT_KEY = os.environ.get(
    "EMERGENT_LLM_KEY",
    "",
)


# =========================================================
# MONGODB
# =========================================================

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

storage_key = None


def init_storage(force: bool = False):
    global storage_key

    if storage_key and not force:
        return storage_key

    resp = requests.post(
        f"{STORAGE_URL}/init",
        json={
            "emergent_key": EMERGENT_KEY
        },
        timeout=30,
    )

    resp.raise_for_status()

    storage_key = resp.json()["storage_key"]

    return storage_key


# =========================================================
# PREÇOS
# =========================================================

DELIVERY_RATES = {
    "cidade": 8.00,
    "condominio_cidade": 10.00,
    "raizes_botanico": 12.00,
    "reserva_bosque": 15.00,
    "afastados": 20.00,
}

DELIVERY_TYPE_ALIASES = {
    "city": "cidade",
    "cidade": "cidade",
    "city_condominium": "condominio_cidade",
    "condominio_cidade": "condominio_cidade",
    "nearby_condominium": "raizes_botanico",
    "raizes_botanico": "raizes_botanico",
    "reserva_bosque": "reserva_bosque",
    "distant_condominium": "afastados",
    "afastados": "afastados",
    "custom": "custom",
}


def normalize_delivery_type(
    delivery_type: Optional[str],
) -> str:

    value = str(
        delivery_type or "cidade"
    ).strip().lower()

    return DELIVERY_TYPE_ALIASES.get(
        value,
        "cidade",
    )


def calculate_delivery_price(
    delivery_type: str,
    custom_price: Optional[float] = None,
) -> dict:

    normalized_type = normalize_delivery_type(
        delivery_type
    )

    if normalized_type == "custom":
        gross = float(
            custom_price or 0.0
        )
    else:
        gross = DELIVERY_RATES.get(
            normalized_type,
            8.00,
        )

    gross = round(
        max(gross, 0.0),
        2,
    )

    net = round(
        max(
            gross - PLATFORM_FEE,
            0.0,
        ),
        2,
    )

    return {
        "delivery_type": normalized_type,
        "gross_price": gross,
        "platform_fee": PLATFORM_FEE,
        "net_courier": net,
    }


# =========================================================
# AUTENTICAÇÃO
# =========================================================

def hash_password(
    pw: str,
) -> str:

    return bcrypt.hashpw(
        pw.encode(),
        bcrypt.gensalt(),
    ).decode()


def verify_password(
    pw: str,
    hashed: str,
) -> bool:

    try:
        return bcrypt.checkpw(
            pw.encode(),
            hashed.encode(),
        )
    except Exception:
        return False


def now_iso():

    return datetime.now(
        timezone.utc
    ).isoformat()


def make_access(
    user_id: str,
    email: str,
    role: str,
) -> str:

    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": datetime.now(
            timezone.utc
        ) + timedelta(hours=12),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def make_refresh(
    user_id: str,
) -> str:

    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(
            timezone.utc
        ) + timedelta(days=7),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def set_auth_cookies(
    resp: Response,
    access: str,
    refresh: str,
):

    resp.set_cookie(
        "access_token",
        access,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=43200,
        path="/",
    )

    resp.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=604800,
        path="/",
    )


def clear_auth_cookies(
    resp: Response,
):

    resp.delete_cookie(
        "access_token",
        path="/",
    )

    resp.delete_cookie(
        "refresh_token",
        path="/",
    )


# =========================================================
# CONTA DE PAGAMENTO
# =========================================================

def _clean_account_value(
    value,
    max_len=120,
):

    if value is None:
        return ""

    return str(value).strip()[:max_len]


def _public_payment_account(
    user: dict,
) -> dict:

    account = user.get(
        "payment_account"
    ) or {}

    return {
        "holder_name": _clean_account_value(
            account.get("holder_name")
        ),
        "document": _clean_account_value(
            account.get("document"),
            30,
        ),
        "pix_key": _clean_account_value(
            account.get("pix_key")
        ),
        "pix_key_type": _clean_account_value(
            account.get("pix_key_type"),
            20,
        ),
        "bank": _clean_account_value(
            account.get("bank"),
            100,
        ),
        "agency": _clean_account_value(
            account.get("agency"),
            30,
        ),
        "account": _clean_account_value(
            account.get("account"),
            40,
        ),
        "account_type": _clean_account_value(
            account.get("account_type"),
            30,
        ),
        "updated_at": account.get(
            "updated_at"
        ),
    }


def user_to_public(
    u: dict,
) -> dict:

    return {
        "id": str(u["_id"]),
        "_id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "role": u.get("role"),
        "status": u.get(
            "status",
            "active",
        ),
        "phone": u.get("phone"),
        "address": u.get("address"),
        "vehicle": u.get("vehicle"),
        "allow_batch": u.get(
            "allow_batch",
            True,
        ),
        "online": u.get(
            "online",
            False,
        ),
        "approved": u.get(
            "approved",
            False,
        ),
        "is_approved": u.get(
            "is_approved",
            False,
        ),
        "active": u.get(
            "active",
            False,
        ),
        "created_at": u.get(
            "created_at"
        ),
        "payment_account": _public_payment_account(
            u
        ),
    }


# =========================================================
# AUTENTICAÇÃO DO USUÁRIO
# =========================================================

async def get_current_user(
    request: Request,
) -> dict:

    token = request.cookies.get(
        "access_token"
    )

    if not token:
        auth = request.headers.get(
            "Authorization",
            "",
        )

        if auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG],
        )

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=401,
                detail="Invalid token type",
            )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
            )

        try:
            object_id = ObjectId(user_id)
            query = {
                "_id": object_id
            }
        except Exception:
            query = {
                "id": str(user_id)
            }

        u = await db.users.find_one(
            query
        )

        if not u:
            raise HTTPException(
                status_code=401,
                detail="User not found",
            )

        if str(
            u.get(
                "status",
                "active",
            )
        ).lower() == "blocked":

            raise HTTPException(
                status_code=403,
                detail="User blocked",
            )

        return u

    except jwt.ExpiredSignatureError:

        raise HTTPException(
            status_code=401,
            detail="Token expired",
        )

    except jwt.InvalidTokenError:

        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        )


def require_roles(*roles):

    async def dep(
        user: dict = Depends(
            get_current_user
        ),
    ):

        if user.get("role") not in roles:

            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {roles}",
            )

        return user

    return dep


# =========================================================
# LOCKOUT
# =========================================================

LOCKOUT_MAX = 5
LOCKOUT_MIN = 15


async def check_lockout(
    identifier: str,
):

    rec = await db.login_attempts.find_one(
        {"_id": identifier}
    )

    if not rec:
        return

    if rec.get("locked_until"):

        try:

            locked = datetime.fromisoformat(
                rec["locked_until"]
            )

            if datetime.now(
                timezone.utc
            ) < locked:

                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Muitas tentativas. "
                        "Tente novamente em alguns minutos."
                    ),
                )

        except ValueError:
            pass


async def register_failed(
    identifier: str,
):

    rec = (
        await db.login_attempts.find_one(
            {"_id": identifier}
        )
        or {
            "count": 0
        }
    )

    count = (
        rec.get(
            "count",
            0,
        )
        + 1
    )

    upd = {
        "count": count,
        "last_at": now_iso(),
    }

    if count >= LOCKOUT_MAX:

        upd["locked_until"] = (
            datetime.now(
                timezone.utc
            )
            + timedelta(
                minutes=LOCKOUT_MIN
            )
        ).isoformat()

        upd["count"] = 0

    await db.login_attempts.update_one(
        {"_id": identifier},
        {"$set": upd},
        upsert=True,
    )


async def clear_attempts(
    identifier: str,
):

    await db.login_attempts.delete_one(
        {"_id": identifier}
    )


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="GiroExpress API"
)


# =========================================================
# CORS
# =========================================================

class CustomCORSMiddleware(
    BaseHTTPMiddleware
):

    async def dispatch(
        self,
        request,
        call_next,
    ):

        if request.method == "OPTIONS":

            response = FastAPIResponse(
                status_code=200
            )

        else:

            response = await call_next(
                request
            )

        origin = request.headers.get(
            "origin",
            "*",
        )

        response.headers[
            "Access-Control-Allow-Origin"
        ] = origin

        response.headers[
            "Access-Control-Allow-Credentials"
        ] = "true"

        response.headers[
            "Access-Control-Allow-Methods"
        ] = (
            "GET, POST, PUT, DELETE, "
            "OPTIONS, PATCH"
        )

        response.headers[
            "Access-Control-Allow-Headers"
        ] = (
            "Authorization, Content-Type, "
            "Accept, Origin, X-Requested-With"
        )

        return response


app.add_middleware(
    CustomCORSMiddleware
)

api = APIRouter(
    prefix="/api"
)


# =========================================================
# MODELOS
# =========================================================

class RegisterIn(BaseModel):

    name: str
    email: EmailStr
    password: str = Field(
        min_length=6
    )
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
    delivery_type: Optional[str] = "city"
    custom_price: Optional[float] = None
    price: Optional[float] = None


class CourierOnlineIn(BaseModel):

    online: bool


class ProductIn(BaseModel):

    name: str
    price: float = Field(
        ge=0
    )
    description: Optional[str] = ""
    image_url: Optional[str] = None
    active: Optional[bool] = True


class ProductUpdateIn(BaseModel):

    name: Optional[str] = None
    price: Optional[float] = Field(
        default=None,
        ge=0,
    )
    description: Optional[str] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None


class BillingClosingDayIn(BaseModel):

    closing_weekday: int = Field(
        ge=0,
        le=6,
    )


# =========================================================
# PRODUTOS
# =========================================================

def product_to_public(
    p: dict,
) -> dict:

    product_id = str(
        p["_id"]
    )

    return {
        "id": product_id,
        "_id": product_id,
        "store_id": p.get(
            "store_id"
        ),
        "name": p.get(
            "name",
            "",
        ),
        "price": float(
            p.get(
                "price",
                0,
            )
        ),
        "description": p.get(
            "description",
            "",
        ),
        "image_url": p.get(
            "image_url"
        ),
        "image": p.get(
            "image_url"
        ),
        "active": p.get(
            "active",
            True,
        ),
        "available": p.get(
            "active",
            True,
        ),
        "created_at": p.get(
            "created_at"
        ),
        "updated_at": p.get(
            "updated_at"
        ),
    }


def product_query(
    product_id: str,
) -> dict:

    try:
        return {
            "_id": ObjectId(
                product_id
            )
        }
    except Exception:
        return {
            "id": product_id
        }


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
async def startup():

    logger.info(
        "GiroExpress iniciando | DB=%s",
        DB_NAME,
    )

    await db.users.create_index(
        "email",
        unique=True,
    )

    await db.deliveries.create_index(
        [
            ("store_id", 1),
            ("created_at", -1),
        ]
    )

    await db.deliveries.create_index(
        [
            ("courier_id", 1),
            ("created_at", -1),
        ]
    )

    await db.deliveries.create_index(
        [
            ("status", 1),
            ("created_at", -1),
        ]
    )

    await db.deliveries.create_index(
        [
            ("courier_id", 1),
            ("completed_at", -1),
        ]
    )

    await db.products.create_index(
        [
            ("store_id", 1),
            ("created_at", -1),
        ]
    )

    await db.store_billing_cycles.create_index(
        [
            ("store_id", 1),
            ("period_start", 1),
            ("period_end", 1),
        ],
        unique=True,
    )

    await db.store_billing_cycles.create_index(
        [
            ("store_id", 1),
            ("created_at", -1),
        ]
    )

    # NOVO:
    # Índices para faturamento dos entregadores.
    await db.courier_billing_cycles.create_index(
        [
            ("courier_id", 1),
            ("period_start", 1),
            ("period_end", 1),
        ],
        unique=True,
    )

    await db.courier_billing_cycles.create_index(
        [
            ("courier_id", 1),
            ("created_at", -1),
        ]
    )

    await db.courier_billing_cycles.create_index(
        [
            ("status", 1),
            ("period_end", -1),
        ]
    )

    existing = await db.users.find_one(
        {
            "email": ADMIN_EMAIL
        }
    )

    if not existing:

        await db.users.insert_one(
            {
                "email": ADMIN_EMAIL,
                "password_hash": hash_password(
                    ADMIN_PASSWORD
                ),
                "name": ADMIN_NAME,
                "role": "admin",
                "status": "active",
                "approved": True,
                "is_approved": True,
                "active": True,
                "created_at": now_iso(),
            }
        )

        logger.info(
            "Admin criado: %s",
            ADMIN_EMAIL,
        )

    total_users = await db.users.count_documents({})

    logger.info(
        "MongoDB conectado | banco=%s | usuários=%s",
        DB_NAME,
        total_users,
    )


@app.on_event("shutdown")
async def shutdown():

    client.close()


# =========================================================
# AUTENTICAÇÃO INTERNA
# =========================================================

async def _do_register(
    body: RegisterIn,
    response: Response,
):

    if body.role not in (
        "store",
        "courier",
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Role must be "
                "'store' or 'courier'"
            ),
        )

    email = body.email.lower().strip()

    existing = await db.users.find_one(
        {
            "email": email
        }
    )

    if existing:

        raise HTTPException(
            status_code=400,
            detail="E-mail já cadastrado",
        )

    doc = {
        "email": email,
        "password_hash": hash_password(
            body.password
        ),
        "name": body.name.strip(),
        "role": body.role,
        "status": (
            "active"
            if body.role == "store"
            else "pending"
        ),
        "phone": body.phone,
        "address": body.address,
        "vehicle": body.vehicle,
        "allow_batch": bool(
            body.allow_batch
        ),
        "online": False,
        "approved": (
            body.role == "store"
        ),
        "is_approved": (
            body.role == "store"
        ),
        "active": (
            body.role == "store"
        ),
        "created_at": now_iso(),
    }

    try:

        result = await db.users.insert_one(
            doc
        )

    except DuplicateKeyError:

        raise HTTPException(
            status_code=400,
            detail="E-mail já cadastrado",
        )

    doc["_id"] = result.inserted_id

    access = make_access(
        str(result.inserted_id),
        email,
        body.role,
    )

    refresh = make_refresh(
        str(result.inserted_id)
    )

    set_auth_cookies(
        response,
        access,
        refresh,
    )

    return {
        "user": user_to_public(doc),
        "access_token": access,
    }


async def _do_login(
    body: LoginIn,
    request: Request,
    response: Response,
):

    email = body.email.lower()

    xff = request.headers.get(
        "x-forwarded-for",
        "",
    )

    ip = (
        xff.split(",")[0].strip()
        if xff
        else (
            request.client.host
            if request.client
            else "unknown"
        )
    )

    ident = f"{ip}:{email}"

    await check_lockout(
        ident
    )

    u = await db.users.find_one(
        {
            "email": email
        }
    )

    if (
        not u
        or not verify_password(
            body.password,
            u.get(
                "password_hash",
                "",
            ),
        )
    ):

        await register_failed(
            ident
        )

        raise HTTPException(
            status_code=401,
            detail="E-mail ou senha inválidos",
        )

    if str(
        u.get(
            "status",
            "active",
        )
    ).lower() == "blocked":

        raise HTTPException(
            status_code=403,
            detail=(
                "Conta bloqueada. "
                "Contate o administrador."
            ),
        )

    await clear_attempts(
        ident
    )

    access = make_access(
        str(u["_id"]),
        email,
        u["role"],
    )

    refresh = make_refresh(
        str(u["_id"])
    )

    set_auth_cookies(
        response,
        access,
        refresh,
    )

    return {
        "user": user_to_public(u),
        "access_token": access,
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
async def root():

    return {
        "app": APP_NAME,
        "status": "online",
        "message": "GiroExpress API funcionando",
    }


@app.get("/api/health")
async def health():

    return {
        "ok": True,
        "app": APP_NAME,
        "status": "online",
    }


# =========================================================
# API AUTH
# =========================================================

@api.post("/auth/register")
async def register_api(
    body: RegisterIn,
    response: Response,
):

    return await _do_register(
        body,
        response,
    )


@api.post("/auth/login")
async def login_api(
    body: LoginIn,
    request: Request,
    response: Response,
):

    return await _do_login(
        body,
        request,
        response,
    )


@api.post("/auth/logout")
async def logout_api(
    response: Response,
):

    clear_auth_cookies(
        response
    )

    return {
        "ok": True
    }


@api.get("/auth/me")
async def me_api(
    user: dict = Depends(
        get_current_user
    ),
):

    return {
        "user": user_to_public(
            user
        )
    }


# =========================================================
# PRICING
# =========================================================

@api.get("/pricing/table")
async def pricing_table():

    return {
        "rates": DELIVERY_RATES,
        "platform_fee": PLATFORM_FEE,
    }


@api.post("/pricing/quote")
async def quote(
    body: dict,
):

    delivery_type = body.get(
        "delivery_type",
        "cidade",
    )

    custom_price = body.get(
        "custom_price"
    )

    return calculate_delivery_price(
        delivery_type,
        custom_price,
    )


# =========================================================
# PRODUTOS
# =========================================================

@app.get("/products")
@app.get("/api/products")
async def get_products(
    user: dict = Depends(
        get_current_user
    ),
):

    role = user.get("role")

    user_id = str(
        user["_id"]
    )

    if role == "admin":
        query = {}

    elif role == "store":
        query = {
            "store_id": user_id
        }

    else:
        query = {
            "active": True
        }

    docs = (
        await db.products
        .find(query)
        .sort(
            "created_at",
            -1,
        )
        .to_list(500)
    )

    return [
        product_to_public(product)
        for product in docs
    ]


@app.post("/products")
@app.post("/api/products")
async def create_product(
    body: ProductIn,
    user: dict = Depends(
        require_roles(
            "store",
            "admin",
        )
    ),
):

    store_id = (
        str(user["_id"])
        if user.get("role") == "store"
        else None
    )

    now = now_iso()

    doc = {
        "store_id": store_id,
        "name": body.name.strip(),
        "price": round(
            float(body.price),
            2,
        ),
        "description": (
            body.description
            or ""
        ),
        "image_url": body.image_url,
        "active": bool(
            body.active
        ),
        "created_at": now,
        "updated_at": now,
    }

    result = await db.products.insert_one(
        doc
    )

    doc["_id"] = result.inserted_id

    return product_to_public(
        doc
    )


@app.put("/products/{product_id}")
@app.put("/api/products/{product_id}")
async def update_product(
    product_id: str,
    body: ProductUpdateIn,
    user: dict = Depends(
        require_roles(
            "store",
            "admin",
        )
    ),
):

    query = product_query(
        product_id
    )

    product = await db.products.find_one(
        query
    )

    if not product:

        raise HTTPException(
            status_code=404,
            detail="Produto não encontrado",
        )

    if user.get("role") == "store":

        if product.get(
            "store_id"
        ) != str(user["_id"]):

            raise HTTPException(
                status_code=403,
                detail=(
                    "Você não pode "
                    "alterar este produto"
                ),
            )

    updates = {}

    if body.name is not None:
        updates["name"] = (
            body.name.strip()
        )

    if body.price is not None:
        updates["price"] = round(
            float(body.price),
            2,
        )

    if body.description is not None:
        updates["description"] = (
            body.description
        )

    if body.image_url is not None:
        updates["image_url"] = (
            body.image_url
        )

    if body.active is not None:
        updates["active"] = bool(
            body.active
        )

    updates["updated_at"] = now_iso()

    await db.products.update_one(
        query,
        {
            "$set": updates
        },
    )

    updated = await db.products.find_one(
        query
    )

    return product_to_public(
        updated
    )


@app.patch("/products/{product_id}")
@app.patch("/api/products/{product_id}")
async def patch_product(
    product_id: str,
    body: ProductUpdateIn,
    user: dict = Depends(
        require_roles(
            "store",
            "admin",
        )
    ),
):

    return await update_product(
        product_id,
        body,
        user,
    )


@app.delete("/products/{product_id}")
@app.delete("/api/products/{product_id}")
async def delete_product(
    product_id: str,
    user: dict = Depends(
        require_roles(
            "store",
            "admin",
        )
    ),
):

    query = product_query(
        product_id
    )

    product = await db.products.find_one(
        query
    )

    if not product:

        raise HTTPException(
            status_code=404,
            detail="Produto não encontrado",
        )

    if user.get("role") == "store":

        if product.get(
            "store_id"
        ) != str(user["_id"]):

            raise HTTPException(
                status_code=403,
                detail=(
                    "Você não pode "
                    "excluir este produto"
                ),
            )

    result = await db.products.delete_one(
        query
    )

    if result.deleted_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Produto não encontrado",
        )

    return {
        "ok": True,
        "message": (
            "Produto excluído com sucesso"
        ),
    }


# =========================================================
# ENTREGAS
# =========================================================

def delivery_to_public(
    d: dict,
) -> dict:

    return {
        "id": str(
            d["_id"]
        ),
        "code": d.get(
            "code"
        ),
        "store_id": d.get(
            "store_id"
        ),
        "store_name": d.get(
            "store_name"
        ),
        "pickup_address": d.get(
            "pickup_address"
        ),
        "dropoff_address": d.get(
            "dropoff_address"
        ),
        "client_name": d.get(
            "client_name"
        ),
        "client_phone": d.get(
            "client_phone"
        ),
        "distance_km": d.get(
            "distance_km"
        ),
        "delivery_type": d.get(
            "delivery_type"
        ),
        "gross_price": d.get(
            "gross_price"
        ),
        "price": d.get(
            "gross_price"
        ),
        "platform_fee": d.get(
            "platform_fee"
        ),
        "net_courier": d.get(
            "net_courier"
        ),
        "status": d.get(
            "status"
        ),
        "courier_id": d.get(
            "courier_id"
        ),
        "courier_name": d.get(
            "courier_name"
        ),
        "batch_id": d.get(
            "batch_id"
        ),
        "notes": d.get(
            "notes"
        ),
        "created_at": d.get(
            "created_at"
        ),
        "completed_at": d.get(
            "completed_at"
        ),
    }


async def next_delivery_code() -> str:

    return (
        f"DEL-"
        f"{datetime.now().strftime('%y%m%d')}-"
        f"{uuid.uuid4().hex[:5].upper()}"
    )


@api.post("/deliveries")
async def create_delivery(
    body: DeliveryIn,
    user: dict = Depends(
        require_roles("store")
    ),
):

    delivery_type = normalize_delivery_type(
        body.delivery_type
    )

    if delivery_type == "custom":

        custom_price = (
            body.custom_price
            if body.custom_price is not None
            else body.price
        )

    else:
        custom_price = None

    p = calculate_delivery_price(
        delivery_type,
        custom_price,
    )

    code = await next_delivery_code()

    doc = {
        "code": code,
        "store_id": str(
            user["_id"]
        ),
        "store_name": user.get(
            "name",
            "Loja",
        ),
        "pickup_address": body.pickup_address,
        "dropoff_address": body.dropoff_address,
        "client_name": body.client_name,
        "client_phone": body.client_phone,
        "distance_km": (
            body.distance_km
            if body.distance_km is not None
            else 0.0
        ),
        "delivery_type": p[
            "delivery_type"
        ],
        "gross_price": p[
            "gross_price"
        ],
        "platform_fee": p[
            "platform_fee"
        ],
        "net_courier": p[
            "net_courier"
        ],
        "status": "pending",
        "courier_id": None,
        "courier_name": None,
        "batch_id": body.batch_id,
        "notes": body.notes or "",
        "created_at": now_iso(),
    }

    r = await db.deliveries.insert_one(
        doc
    )

    doc["_id"] = r.inserted_id

    return delivery_to_public(
        doc
    )


@api.get("/deliveries")
async def list_deliveries(
    status: Optional[str] = None,
    user: dict = Depends(
        get_current_user
    ),
):

    q = {}

    role = user["role"]

    uid = str(
        user["_id"]
    )

    normalized_status = (
        status.lower()
        if isinstance(
            status,
            str,
        )
        else None
    )

    if role == "store":

        q["store_id"] = uid

    elif role == "courier":

        if normalized_status == "available":

            q = {
                "status": {
                    "$in": [
                        "pending",
                        "PENDING",
                    ]
                },
                "courier_id": None,
            }

        else:

            q["$or"] = [
                {
                    "courier_id": uid
                },
                {
                    "status": {
                        "$in": [
                            "pending",
                            "PENDING",
                        ]
                    },
                    "courier_id": None,
                },
            ]

    if (
        normalized_status
        and normalized_status != "available"
    ):

        q["status"] = normalized_status

    docs = (
        await db.deliveries
        .find(q)
        .sort(
            "created_at",
            -1,
        )
        .to_list(500)
    )

    return [
        delivery_to_public(d)
        for d in docs
    ]


# =========================================================
# ACEITAR ENTREGA
# =========================================================

async def get_courier_active_delivery_count(
    courier_id: str,
) -> int:

    return await db.deliveries.count_documents(
        {
            "courier_id": str(courier_id),
            "status": {
                "$in": ACTIVE_COURIER_DELIVERY_STATUSES,
            },
        }
    )


async def perform_accept_delivery(
    delivery_id: str,
    user: dict,
):

    courier_id = str(
        user["_id"]
    )

    active_count = await get_courier_active_delivery_count(
        courier_id
    )

    if active_count >= MAX_ACTIVE_DELIVERIES_PER_COURIER:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Você já possui "
                f"{MAX_ACTIVE_DELIVERIES_PER_COURIER} "
                "pedidos ativos. Conclua pelo menos um "
                "pedido antes de aceitar outro."
            ),
        )

    try:

        object_id = ObjectId(
            delivery_id
        )

        query = {
            "_id": object_id,
            "status": {
                "$in": [
                    "pending",
                    "PENDING",
                ]
            },
            "courier_id": None,
        }

    except Exception:

        query = {
            "id": delivery_id,
            "status": {
                "$in": [
                    "pending",
                    "PENDING",
                ]
            },
            "courier_id": None,
        }

    result = await db.deliveries.update_one(
        query,
        {
            "$set": {
                "status": "accepted",
                "courier_id": courier_id,
                "courier_name": user.get(
                    "name",
                    "Entregador",
                ),
            }
        },
    )

    if result.modified_count == 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Esta corrida já foi "
                "aceita por outro entregador "
                "ou não está disponível."
            ),
        )

    new_active_count = active_count + 1

    return {
        "ok": True,
        "message": "Corrida aceita com sucesso!",
        "active_deliveries": new_active_count,
        "max_active_deliveries": (
            MAX_ACTIVE_DELIVERIES_PER_COURIER
        ),
        "remaining_slots": max(
            MAX_ACTIVE_DELIVERIES_PER_COURIER
            - new_active_count,
            0,
        ),
    }


@api.post(
    "/deliveries/{delivery_id}/accept"
)
async def accept_delivery_api(
    delivery_id: str,
    user: dict = Depends(
        require_roles("courier")
    ),
):

    return await perform_accept_delivery(
        delivery_id,
        user,
    )


@app.post(
    "/deliveries/{delivery_id}/accept"
)
async def accept_delivery_direct(
    delivery_id: str,
    user: dict = Depends(
        require_roles("courier")
    ),
):

    return await perform_accept_delivery(
        delivery_id,
        user,
    )


# =========================================================
# CHAT
# =========================================================

def delivery_query(
    delivery_id: str,
) -> dict:

    try:

        return {
            "$or": [
                {
                    "_id": ObjectId(
                        delivery_id
                    )
                },
                {
                    "id": delivery_id
                },
            ]
        }

    except Exception:

        return {
            "id": delivery_id
        }


@app.get(
    "/api/deliveries/{delivery_id}/chat"
)
async def get_delivery_chat(
    delivery_id: str,
    user: dict = Depends(
        get_current_user
    ),
):

    delivery = await db.deliveries.find_one(
        delivery_query(
            delivery_id
        )
    )

    if not delivery:
        return []

    return delivery.get(
        "chat",
        [],
    )


@app.post(
    "/api/deliveries/{delivery_id}/chat"
)
async def send_delivery_chat(
    delivery_id: str,
    body: dict,
    user: dict = Depends(
        get_current_user
    ),
):

    message_text = str(
        body.get(
            "message",
            "",
        )
    ).strip()

    if not message_text:

        raise HTTPException(
            status_code=400,
            detail="Mensagem vazia",
        )

    delivery = await db.deliveries.find_one(
        delivery_query(
            delivery_id
        )
    )

    if not delivery:

        raise HTTPException(
            status_code=404,
            detail="Entrega não encontrada",
        )

    sender_id = str(
        user.get(
            "_id",
            user.get("id"),
        )
    )

    sender_role = str(
        user.get(
            "role",
            "",
        )
    ).lower()

    sender_name = user.get(
        "name",
        "Usuário",
    )

    store_id = delivery.get(
        "store_id"
    )

    courier_id = delivery.get(
        "courier_id"
    )

    recipient_id = None

    if sender_role == "store":

        if courier_id:
            recipient_id = str(
                courier_id
            )

    elif sender_role == "courier":

        if store_id:
            recipient_id = str(
                store_id
            )

    chat_message = {
        "sender_id": sender_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "message": message_text,
        "created_at": now_iso(),
    }

    result = await db.deliveries.update_one(
        delivery_query(
            delivery_id
        ),
        {
            "$push": {
                "chat": chat_message
            }
        },
    )

    if result.modified_count == 0:

        raise HTTPException(
            status_code=500,
            detail=(
                "Não foi possível "
                "salvar a mensagem"
            ),
        )

    notification_sent = False

    if recipient_id:

        websocket_payload = {
            "type": "chat_message",
            "sender_id": sender_id,
            "sender_name": sender_name,
            "sender_role": sender_role,
            "delivery_id": str(
                delivery.get(
                    "_id",
                    delivery_id,
                )
            ),
            "text": message_text,
            "message": message_text,
            "created_at": chat_message[
                "created_at"
            ],
        }

        notification_sent = (
            await manager.send_personal_message(
                websocket_payload,
                recipient_id,
            )
        )

    return {
        "status": "ok",
        "message": chat_message,
        "recipient_id": recipient_id,
        "notification_sent": notification_sent,
    }


# =========================================================
# CONTA DE RECEBIMENTO / PIX
# =========================================================

@app.get("/me/account")
@app.get("/api/me/account")
async def get_my_account(
    user: dict = Depends(
        get_current_user
    ),
):

    return {
        "ok": True,
        "account": _public_payment_account(
            user
        ),
        "role": user.get("role"),
    }


@app.put("/me/account")
@app.put("/api/me/account")
async def update_my_account(
    request: Request,
    user: dict = Depends(
        require_roles(
            "store",
            "courier",
        )
    ),
):

    try:
        body = await request.json()
    except Exception:
        body = {}

    pix_key_type = _clean_account_value(
        body.get("pix_key_type"),
        20,
    ).lower()

    allowed_pix_types = {
        "cpf",
        "cnpj",
        "email",
        "phone",
        "telefone",
        "random",
        "aleatoria",
        "aleatória",
    }

    if (
        pix_key_type
        and pix_key_type not in allowed_pix_types
    ):

        raise HTTPException(
            status_code=400,
            detail="Tipo de chave PIX inválido.",
        )

    pix_key = _clean_account_value(
        body.get("pix_key"),
        120,
    )

    holder_name = _clean_account_value(
        body.get("holder_name"),
        120,
    )

    document = _clean_account_value(
        body.get("document"),
        30,
    )

    if not holder_name:

        raise HTTPException(
            status_code=400,
            detail="Informe o titular da conta.",
        )

    if not pix_key:

        raise HTTPException(
            status_code=400,
            detail="Informe a chave PIX.",
        )

    if not pix_key_type:

        raise HTTPException(
            status_code=400,
            detail="Informe o tipo da chave PIX.",
        )

    account = {
        "holder_name": holder_name,
        "document": document,
        "pix_key": pix_key,
        "pix_key_type": pix_key_type,
        "bank": _clean_account_value(
            body.get("bank"),
            100,
        ),
        "agency": _clean_account_value(
            body.get("agency"),
            30,
        ),
        "account": _clean_account_value(
            body.get("account"),
            40,
        ),
        "account_type": _clean_account_value(
            body.get("account_type"),
            30,
        ),
        "updated_at": now_iso(),
    }

    if not account["bank"]:

        raise HTTPException(
            status_code=400,
            detail="Informe o banco da conta de recebimento.",
        )

    result = await db.users.update_one(
        {
            "_id": user["_id"]
        },
        {
            "$set": {
                "payment_account": account
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado.",
        )

    return {
        "ok": True,
        "message": "Conta de recebimento salva com sucesso.",
        "account": account,
    }


@app.get("/me")
@app.get("/auth/me")
@app.get("/api/me")
async def me_direct(
    user: dict = Depends(
        get_current_user
    ),
):

    user_id = user.get(
        "_id",
        user.get("id"),
    )

    try:

        obj_id = ObjectId(
            user_id
        )

        latest_user = await db.users.find_one(
            {
                "_id": obj_id
            }
        )

    except Exception:

        latest_user = await db.users.find_one(
            {
                "id": str(user_id)
            }
        )

    if latest_user:
        user = latest_user

    public_data = user_to_public(
        user
    )

    status_val = str(
        user.get(
            "status",
            "",
        )
    ).lower()

    if status_val in (
        "active",
        "approved",
    ):

        public_data["status"] = "active"
        public_data["approved"] = True
        public_data["is_approved"] = True
        public_data["active"] = True

    else:

        public_data["status"] = (
            status_val
            or "pending"
        )

        public_data["approved"] = False
        public_data["is_approved"] = False
        public_data["active"] = False

    return {
        "user": public_data
    }


# =========================================================
# COMPATIBILIDADE LOGIN / REGISTER / LOGOUT
# =========================================================

@app.post("/login")
@app.post("/auth/login")
@app.post("/api/login")
async def login_direct(
    body: LoginIn,
    request: Request,
    response: Response,
):

    return await _do_login(
        body,
        request,
        response,
    )


@app.post("/register")
@app.post("/auth/register")
@app.post("/api/register")
async def register_direct(
    body: RegisterIn,
    response: Response,
):

    return await _do_register(
        body,
        response,
    )


@app.post("/logout")
@app.post("/auth/logout")
@app.post("/api/logout")
async def logout_direct(
    response: Response,
):

    clear_auth_cookies(
        response
    )

    return {
        "ok": True
    }


# =========================================================
# ADMIN SETTINGS
# =========================================================

@app.get("/admin/settings")
@app.get("/api/admin/settings")
async def admin_settings_direct(
    user: dict = Depends(
        require_roles("admin")
    ),
):

    settings = (
        await db.settings.find_one(
            {
                "_id": "global"
            }
        )
        or {}
    )

    return {
        "active": settings.get(
            "active",
            True,
        ),
        "disabled_days": settings.get(
            "disabled_days",
            [],
        ),
        "open_time": settings.get(
            "open_time",
            "00:00",
        ),
        "close_time": settings.get(
            "close_time",
            "23:59",
        ),
        "holidays": settings.get(
            "holidays",
            [],
        ),
    }


# =========================================================
# ADMIN APROVAR USUÁRIO
# =========================================================

@app.post(
    "/admin/users/{user_id}/approve"
)
@app.post(
    "/api/admin/users/{user_id}/approve"
)
async def approve_user(
    user_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        obj_id = ObjectId(
            user_id
        )

        query = {
            "_id": obj_id
        }

    except Exception:

        query = {
            "id": user_id
        }

    result = await db.users.update_one(
        query,
        {
            "$set": {
                "status": "active",
                "approved": True,
                "is_approved": True,
                "active": True,
                "verified": True,
                "is_verified": True,
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado",
        )

    return {
        "ok": True,
        "message": (
            "Usuário aprovado com sucesso"
        ),
    }


# =========================================================
# TICKETS
# =========================================================

@app.get("/tickets")
@app.get("/api/tickets")
async def get_tickets_direct(
    user: dict = Depends(
        get_current_user
    ),
):

    docs = await db.tickets.find().sort(
        "created_at",
        -1,
    ).to_list(500)

    for doc in docs:

        if "_id" in doc:
            doc["_id"] = str(
                doc["_id"]
            )

    return docs


@app.post(
    "/tickets/{ticket_id}/resolve"
)
@app.post(
    "/api/tickets/{ticket_id}/resolve"
)
async def resolve_ticket(
    ticket_id: str,
    request: Request,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:
        body = await request.json()
    except Exception:
        body = {}

    try:

        query = {
            "_id": ObjectId(
                ticket_id
            )
        }

    except Exception:

        query = {
            "id": ticket_id
        }

    now = now_iso()

    update = {
        "$set": {
            "status": "resolved",
            "resolved_at": now,
            "updated_at": now,
        }
    }

    if body.get("resolution"):
        update["$set"]["resolution"] = (
            body.get("resolution")
        )

    result = await db.tickets.update_one(
        query,
        update,
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Ticket não encontrado",
        )

    return {
        "ok": True,
        "message": "Ticket resolvido com sucesso",
    }


# =========================================================
# ADMIN USERS
# =========================================================

@app.get("/admin/users")
@app.get("/api/admin/users")
async def admin_users_direct(
    user: dict = Depends(
        require_roles("admin")
    ),
):

    docs = (
        await db.users
        .find({})
        .sort(
            "created_at",
            -1,
        )
        .to_list(500)
    )

    cleaned_docs = []

    for u in docs:

        try:

            mongo_id = u.get(
                "_id"
            )

            public_id = (
                str(mongo_id)
                if mongo_id is not None
                else str(
                    u.get(
                        "id",
                        "",
                    )
                )
            )

            status_val = u.get(
                "status"
            )

            status = (
                str(
                    status_val
                ).lower()
                if status_val
                else "pending"
            )

            cleaned_docs.append(
                {
                    "id": public_id,
                    "_id": public_id,
                    "name": u.get(
                        "name",
                        "",
                    ),
                    "email": u.get(
                        "email",
                        "",
                    ),
                    "role": u.get(
                        "role",
                        "",
                    ),
                    "status": status,
                    "phone": u.get(
                        "phone"
                    ),
                    "address": u.get(
                        "address"
                    ),
                    "vehicle": u.get(
                        "vehicle"
                    ),
                    "allow_batch": u.get(
                        "allow_batch",
                        True,
                    ),
                    "online": u.get(
                        "online",
                        False,
                    ),
                    "approved": u.get(
                        "approved",
                        False,
                    ),
                    "is_approved": u.get(
                        "is_approved",
                        False,
                    ),
                    "active": u.get(
                        "active",
                        False,
                    ),
                    "created_at": u.get(
                        "created_at"
                    ),
                    "payment_account": _public_payment_account(
                        u
                    ),
                }
            )

        except Exception as exc:

            logger.exception(
                "ADMIN USERS | erro: %s",
                exc,
            )

    return cleaned_docs


# =========================================================
# ADMIN - EXCLUIR CONTA DE LOJA / ENTREGADOR
# =========================================================

@app.delete("/admin/users/{user_id}")
@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):
    """
    Exclui definitivamente uma conta de loja ou entregador.

    Por segurança, contas de administrador nunca podem ser excluídas
    por este endpoint. Os históricos de entregas e faturamento são
    preservados para não apagar informações financeiras já registradas.
    """

    try:
        object_id = ObjectId(user_id)
        query = {"_id": object_id}
    except Exception:
        query = {"id": str(user_id)}

    target = await db.users.find_one(query)

    if not target:
        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado",
        )

    target_role = str(
        target.get("role", "")
    ).lower()

    if target_role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Contas de administrador não podem ser excluídas.",
        )

    if target_role not in {"store", "courier"}:
        raise HTTPException(
            status_code=400,
            detail="Somente contas de loja ou entregador podem ser excluídas.",
        )

    result = await db.users.delete_one(query)

    if result.deleted_count != 1:
        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado ou já excluído.",
        )

    return {
        "ok": True,
        "message": "Conta excluída com sucesso.",
        "user_id": user_id,
        "role": target_role,
        "name": target.get("name", ""),
        "email": target.get("email", ""),
        "history_preserved": True,
    }


# =========================================================
# ADMIN STATS
# =========================================================

@app.get("/admin/stats")
@app.get("/api/admin/stats")
async def admin_stats_direct(
    user: dict = Depends(
        require_roles("admin")
    ),
):

    total_users = (
        await db.users.count_documents({})
    )

    total_stores = (
        await db.users.count_documents(
            {
                "role": "store"
            }
        )
    )

    total_couriers = (
        await db.users.count_documents(
            {
                "role": "courier"
            }
        )
    )

    completed_statuses = [
        "completed",
        "delivered",
        "COMPLETED",
        "DELIVERED",
    ]

    deliveries = (
        await db.deliveries.find(
            {
                "status": {
                    "$in": completed_statuses
                }
            }
        )
        .sort(
            "completed_at",
            -1,
        )
        .to_list(None)
    )

    total_delivered = len(
        deliveries
    )

    courier_ids = set()

    for delivery in deliveries:

        courier_id = delivery.get(
            "courier_id"
        )

        if courier_id:
            courier_ids.add(
                str(courier_id)
            )

    courier_names = {}

    for courier_id in courier_ids:

        try:

            courier_doc = await db.users.find_one(
                {
                    "_id": ObjectId(
                        courier_id
                    ),
                    "role": "courier",
                }
            )

        except Exception:

            courier_doc = await db.users.find_one(
                {
                    "id": courier_id,
                    "role": "courier",
                }
            )

        if courier_doc:

            courier_names[courier_id] = courier_doc.get(
                "name",
                "Entregador",
            )

    store_fees_map = {}

    delivery_details = []

    for d in deliveries:

        store_id = str(
            d.get(
                "store_id",
                "Desconhecida",
            )
        )

        store_name = d.get(
            "store_name",
            "Loja",
        )

        courier_id_raw = d.get(
            "courier_id"
        )

        courier_id = (
            str(courier_id_raw)
            if courier_id_raw
            else None
        )

        courier_name = d.get(
            "courier_name"
        )

        if not courier_name and courier_id:

            courier_name = courier_names.get(
                courier_id
            )

        if not courier_name:
            courier_name = "Não informado"

        raw_date = d.get(
            "created_at"
        )

        parsed = parse_iso_datetime(
            raw_date
        )

        if parsed:

            date_str = parsed.strftime(
                "%Y-%m-%d"
            )

            date_display = parsed.strftime(
                "%d/%m/%Y"
            )

        else:

            date_str = str(
                raw_date or ""
            )[:10]

            date_display = date_str

        fee = PLATFORM_FEE

        try:

            gross_price = round(
                float(
                    d.get(
                        "gross_price",
                        d.get(
                            "price",
                            0,
                        ),
                    )
                    or 0
                ),
                2,
            )

        except Exception:

            gross_price = 0.0

        try:

            stored_net = d.get(
                "net_courier"
            )

            if stored_net is not None:

                net_courier = round(
                    float(stored_net),
                    2,
                )

            else:

                net_courier = round(
                    max(
                        gross_price - fee,
                        0.0,
                    ),
                    2,
                )

        except Exception:

            net_courier = round(
                max(
                    gross_price - fee,
                    0.0,
                ),
                2,
            )

        delivery_id = str(
            d.get(
                "_id",
                d.get(
                    "id",
                    "",
                ),
            )
        )

        delivery_code = d.get(
            "code"
        ) or delivery_id

        status_value = str(
            d.get(
                "status",
                "",
            )
        ).lower()

        delivery_details.append(
            {
                "id": delivery_id,
                "_id": delivery_id,
                "code": delivery_code,
                "store_id": store_id,
                "store_name": store_name,
                "courier_id": courier_id,
                "courier_name": courier_name,
                "gross_price": gross_price,
                "price": gross_price,
                "platform_fee": fee,
                "admin_fee": fee,
                "net_courier": net_courier,
                "status": status_value,
                "created_at": d.get(
                    "created_at"
                ),
                "completed_at": d.get(
                    "completed_at"
                ),
                "date": date_str,
                "date_display": date_display,
                "client_name": d.get(
                    "client_name"
                ),
                "pickup_address": d.get(
                    "pickup_address"
                ),
                "dropoff_address": d.get(
                    "dropoff_address"
                ),
                "delivery_type": d.get(
                    "delivery_type"
                ),
                "distance_km": d.get(
                    "distance_km"
                ),
            }
        )

        key = (
            f"{store_id}_"
            f"{date_str}"
        )

        if key not in store_fees_map:

            store_fees_map[key] = {
                "store_id": store_id,
                "store_name": store_name,
                "date": date_str,
                "deliveries_count": 0,
                "total_fee": 0.0,
            }

        store_fees_map[key][
            "deliveries_count"
        ] += 1

        store_fees_map[key][
            "total_fee"
        ] += fee

    collected_fees = round(
        sum(
            item["total_fee"]
            for item in store_fees_map.values()
        ),
        2,
    )

    delivery_details.sort(
        key=lambda item: (
            item.get(
                "completed_at"
            )
            or item.get(
                "created_at"
            )
            or ""
        ),
        reverse=True,
    )

    store_fees_details = list(
        store_fees_map.values()
    )

    store_fees_details.sort(
        key=lambda item: (
            item.get(
                "date",
                "",
            ),
            item.get(
                "store_name",
                "",
            ),
        ),
        reverse=True,
    )

    return {
        "platform_fees_collected": collected_fees,
        "platform_fee_per_delivery": PLATFORM_FEE,
        "total_users": total_users,
        "total_stores": total_stores,
        "total_couriers": total_couriers,
        "total_deliveries": (
            await db.deliveries.count_documents({})
        ),
        "delivered": total_delivered,
        "open_tickets": (
            await db.tickets.count_documents(
                {
                    "status": "open"
                }
            )
        ),
        "store_fees_details": store_fees_details,
        "delivery_details": delivery_details,
        "deliveries_details": delivery_details,
    }


# =========================================================
# ADMIN OPERAÇÕES
# =========================================================

@app.get(
    "/admin/settings/operations"
)
@app.get(
    "/api/admin/settings/operations"
)
async def admin_operations_direct(
    user: dict = Depends(
        require_roles("admin")
    ),
):

    settings = (
        await db.settings.find_one(
            {
                "_id": "global"
            }
        )
        or {}
    )

    return {
        "active": settings.get(
            "active",
            True,
        ),
        "disabled_days": settings.get(
            "disabled_days",
            [],
        ),
        "open_time": settings.get(
            "open_time",
            "00:00",
        ),
        "close_time": settings.get(
            "close_time",
            "23:59",
        ),
        "holidays": settings.get(
            "holidays",
            [],
        ),
    }


@app.put(
    "/admin/settings/operations"
)
@app.put(
    "/api/admin/settings/operations"
)
async def update_admin_operations(
    request: Request,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:
        body = await request.json()
    except Exception:
        body = {}

    updates = {
        "active": bool(
            body.get(
                "active",
                True,
            )
        ),
        "disabled_days": body.get(
            "disabled_days",
            [],
        ),
        "open_time": body.get(
            "open_time",
            "00:00",
        ),
        "close_time": body.get(
            "close_time",
            "23:59",
        ),
        "holidays": body.get(
            "holidays",
            [],
        ),
        "updated_at": now_iso(),
    }

    await db.settings.update_one(
        {
            "_id": "global"
        },
        {
            "$set": updates
        },
        upsert=True,
    )

    return {
        "ok": True,
        **updates,
    }


# =========================================================
# ADMIN ALTERAR STATUS
# =========================================================

@app.patch(
    "/admin/users/{user_id}"
)
@app.patch(
    "/api/admin/users/{user_id}"
)
async def update_user_status_direct(
    user_id: str,
    request: Request,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:
        body = await request.json()
    except Exception:
        body = {}

    try:

        obj_id = ObjectId(
            user_id
        )

        query = {
            "_id": obj_id
        }

    except Exception:

        query = {
            "id": user_id
        }

    new_status = body.get(
        "status",
        "blocked",
    )

    if isinstance(
        new_status,
        str,
    ):

        new_status = new_status.lower()

    update_data = {
        "status": new_status
    }

    if new_status in (
        "active",
        "approved",
    ):

        update_data.update(
            {
                "approved": True,
                "is_approved": True,
                "active": True,
            }
        )

    elif new_status in (
        "pending",
        "blocked",
    ):

        update_data.update(
            {
                "approved": False,
                "is_approved": False,
                "active": False,
            }
        )

    result = await db.users.update_one(
        query,
        {
            "$set": update_data
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado",
        )

    return {
        "ok": True,
        "message": (
            "Status atualizado com sucesso"
        ),
    }


# =========================================================
# EXTRATOS
# =========================================================

@app.get("/statements")
@app.get("/api/statements")
async def statements_store_direct(
    user: dict = Depends(
        get_current_user
    ),
):

    q = (
        {
            "store_id": str(
                user["_id"]
            )
        }
        if user["role"] == "store"
        else {}
    )

    docs = (
        await db.statements
        .find(q)
        .sort(
            "created_at",
            -1,
        )
        .to_list(500)
    )

    for doc in docs:

        if "_id" in doc:

            doc["_id"] = str(
                doc["_id"]
            )

    return docs


@app.post(
    "/statements/{statement_id}/approve"
)
@app.post(
    "/api/statements/{statement_id}/approve"
)
async def approve_statement(
    statement_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        query = {
            "_id": ObjectId(
                statement_id
            )
        }

    except Exception:

        query = {
            "id": statement_id
        }

    result = await db.statements.update_one(
        query,
        {
            "$set": {
                "status": "approved",
                "approved_at": now_iso(),
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Extrato não encontrado",
        )

    return {
        "ok": True,
        "message": "Extrato aprovado com sucesso",
    }


# =========================================================
# SYSTEM STATUS
# =========================================================

@app.get("/system/status")
@app.get("/api/system/status")
async def system_status_direct():

    settings = (
        await db.settings.find_one(
            {
                "_id": "global"
            }
        )
        or {}
    )

    return {
        "active": settings.get(
            "active",
            True,
        ),
        "maintenance": settings.get(
            "maintenance",
            False,
        ),
    }


# =========================================================
# ENTREGADOR ONLINE / OFFLINE
# =========================================================

@app.post(
    "/couriers/me/online"
)
@app.post(
    "/api/couriers/me/online"
)
async def courier_online_direct(
    body: CourierOnlineIn,
    user: dict = Depends(
        require_roles("courier")
    ),
):

    requested_online = bool(
        body.online
    )

    if requested_online:

        status = str(
            user.get(
                "status",
                "",
            )
        ).lower()

        is_approved = (
            user.get("approved") is True
            or user.get("is_approved") is True
            or status in (
                "active",
                "approved",
            )
        )

        if not is_approved:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Aguardando aprovação "
                    "do administrador para "
                    "ficar online."
                ),
            )

    result = await db.users.update_one(
        {
            "_id": user["_id"]
        },
        {
            "$set": {
                "online": requested_online
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado.",
        )

    return {
        "ok": True,
        "online": requested_online,
    }


# =========================================================
# INICIAR ENTREGA
# =========================================================

@app.post(
    "/deliveries/{delivery_id}/start"
)
@app.post(
    "/api/deliveries/{delivery_id}/start"
)
async def start_delivery_direct(
    delivery_id: str,
    user: dict = Depends(
        require_roles("courier")
    ),
):

    try:

        object_id = ObjectId(
            delivery_id
        )

        query = {
            "_id": object_id,
            "courier_id": str(
                user["_id"]
            ),
        }

    except Exception:

        query = {
            "id": delivery_id,
            "courier_id": str(
                user["_id"]
            ),
        }

    result = await db.deliveries.update_one(
        query,
        {
            "$set": {
                "status": "picked_up"
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Entrega não encontrada",
        )

    return {
        "ok": True
    }


# =========================================================
# CONCLUIR ENTREGA
# =========================================================

@app.post(
    "/deliveries/{delivery_id}/complete"
)
@app.post(
    "/api/deliveries/{delivery_id}/complete"
)
async def complete_delivery_direct(
    delivery_id: str,
    user: dict = Depends(
        require_roles("courier")
    ),
):

    try:

        object_id = ObjectId(
            delivery_id
        )

        query = {
            "_id": object_id,
            "courier_id": str(
                user["_id"]
            ),
        }

    except Exception:

        query = {
            "id": delivery_id,
            "courier_id": str(
                user["_id"]
            ),
        }

    query["status"] = {
        "$in": [
            "accepted",
            "picked_up",
            "in_progress",
        ]
    }

    completed_at = now_iso()

    result = await db.deliveries.update_one(
        query,
        {
            "$set": {
                "status": "completed",
                "completed_at": completed_at,
                "courier_id": str(
                    user["_id"]
                ),
                "courier_name": user.get(
                    "name",
                    "Entregador",
                ),
                "platform_fee": PLATFORM_FEE,
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Entrega não encontrada",
        )

    return {
        "ok": True,
        "platform_fee": PLATFORM_FEE,
        "courier_id": str(
            user["_id"]
        ),
        "courier_name": user.get(
            "name",
            "Entregador",
        ),
    }


# =========================================================
# FUNÇÕES DO FATURAMENTO
# =========================================================

def billing_weekday_label(
    weekday: int,
) -> str:

    for item in BILLING_WEEKDAYS:

        if item["i"] == int(
            weekday
        ):

            return item["label"]

    return "Domingo"


def parse_iso_datetime(
    value,
) -> Optional[datetime]:

    if isinstance(
        value,
        datetime,
    ):

        dt = value

    else:

        text = str(
            value or ""
        ).strip()

        if not text:
            return None

        try:

            dt = datetime.fromisoformat(
                text.replace(
                    "Z",
                    "+00:00",
                )
            )

        except Exception:

            return None

    if dt.tzinfo is None:

        dt = dt.replace(
            tzinfo=timezone.utc
        )

    return dt.astimezone(
        BRAZIL_TZ
    )


def cycle_for_date(
    target_date: date,
    closing_weekday: int,
):
    # O período atual começa no dia seguinte ao último fechamento
    # e termina no próximo dia de fechamento.
    # Ex.: fechamento no domingo e hoje terça-feira 08/09/2026
    # => período atual = 07/09/2026 até 13/09/2026.
    days_until_closing = (
        closing_weekday
        - target_date.weekday()
    ) % 7

    period_end = (
        target_date
        + timedelta(
            days=days_until_closing
        )
    )

    period_start = (
        period_end
        - timedelta(days=6)
    )

    return (
        period_start,
        period_end,
    )


async def get_store_billing_weekday(
    store_id: str,
) -> int:

    try:

        object_id = ObjectId(
            store_id
        )

        query = {
            "_id": object_id,
            "role": "store",
        }

    except Exception:

        query = {
            "id": store_id,
            "role": "store",
        }

    store = await db.users.find_one(
        query
    )

    if not store:

        raise HTTPException(
            status_code=404,
            detail="Loja não encontrada",
        )

    value = store.get(
        "billing_closing_weekday",
        DEFAULT_BILLING_WEEKDAY,
    )

    try:
        value = int(value)
    except Exception:
        value = DEFAULT_BILLING_WEEKDAY

    if value < 0 or value > 6:
        value = DEFAULT_BILLING_WEEKDAY

    return value


# =========================================================
# CÁLCULO DO CICLO DA LOJA
# =========================================================

async def calculate_store_cycle(
    store_id: str,
    period_start: date,
    period_end: date,
) -> dict:

    deliveries = (
        await db.deliveries.find(
            {
                "store_id": str(
                    store_id
                ),
                "status": {
                    "$in": [
                        "completed",
                        "delivered",
                        "COMPLETED",
                        "DELIVERED",
                    ]
                },
            }
        ).to_list(None)
    )

    count = 0

    for delivery in deliveries:

        created_at = parse_iso_datetime(
            delivery.get(
                "created_at"
            )
        )

        if not created_at:
            continue

        delivery_date = (
            created_at.date()
        )

        if (
            period_start
            <= delivery_date
            <= period_end
        ):

            count += 1

    total_fee = round(
        count * PLATFORM_FEE,
        2,
    )

    return {
        "total_deliveries": count,
        "total_fee": total_fee,
    }


# =========================================================
# NOVO:
# CÁLCULO DO CICLO DO ENTREGADOR
# =========================================================

def courier_id_query_values(courier_id: str) -> list:
    """Aceita IDs de entregador salvos como string ou ObjectId."""
    values = [str(courier_id)]
    try:
        values.append(ObjectId(str(courier_id)))
    except Exception:
        pass
    return values


async def calculate_courier_cycle(
    courier_id: str,
    period_start: date,
    period_end: date,
) -> dict:

    deliveries = (
        await db.deliveries.find(
            {
                "courier_id": {
                    "$in": courier_id_query_values(
                        courier_id
                    )
                },
                "status": {
                    "$in": [
                        "completed",
                        "delivered",
                        "COMPLETED",
                        "DELIVERED",
                    ]
                },
            }
        )
        .sort(
            "completed_at",
            1,
        )
        .to_list(None)
    )

    total_deliveries = 0
    total_gross = 0.0
    total_platform_fee = 0.0
    total_courier = 0.0

    delivery_details = []

    for delivery in deliveries:

        # Para o pagamento do entregador usamos
        # a data em que a entrega foi concluída.
        completed_at = parse_iso_datetime(
            delivery.get(
                "completed_at"
            )
        )

        if not completed_at:
            continue

        delivery_date = completed_at.date()

        if not (
            period_start
            <= delivery_date
            <= period_end
        ):
            continue

        try:

            gross_price = round(
                float(
                    delivery.get(
                        "gross_price",
                        delivery.get(
                            "price",
                            0,
                        ),
                    )
                    or 0
                ),
                2,
            )

        except Exception:

            gross_price = 0.0

        try:

            platform_fee = round(
                float(
                    delivery.get(
                        "platform_fee",
                        PLATFORM_FEE,
                    )
                    or PLATFORM_FEE
                ),
                2,
            )

        except Exception:

            platform_fee = PLATFORM_FEE

        # Corrige entregas antigas que não possuam
        # net_courier salvo no MongoDB.
        try:

            net_courier_raw = delivery.get(
                "net_courier"
            )

            if net_courier_raw is not None:

                net_courier = round(
                    float(
                        net_courier_raw
                    ),
                    2,
                )

            else:

                net_courier = round(
                    max(
                        gross_price
                        - platform_fee,
                        0.0,
                    ),
                    2,
                )

        except Exception:

            net_courier = round(
                max(
                    gross_price
                    - platform_fee,
                    0.0,
                ),
                2,
            )

        total_deliveries += 1
        total_gross += gross_price
        total_platform_fee += platform_fee
        total_courier += net_courier

        delivery_id = str(
            delivery.get(
                "_id",
                delivery.get(
                    "id",
                    "",
                ),
            )
        )

        delivery_details.append(
            {
                "id": delivery_id,
                "_id": delivery_id,
                "code": delivery.get(
                    "code"
                ) or delivery_id,
                "store_id": delivery.get(
                    "store_id"
                ),
                "store_name": delivery.get(
                    "store_name",
                    "Loja",
                ),
                "gross_price": gross_price,
                "platform_fee": platform_fee,
                "net_courier": net_courier,
                "delivery_type": delivery.get(
                    "delivery_type"
                ),
                "completed_at": delivery.get(
                    "completed_at"
                ),
                "created_at": delivery.get(
                    "created_at"
                ),
                "client_name": delivery.get(
                    "client_name"
                ),
                "pickup_address": delivery.get(
                    "pickup_address"
                ),
                "dropoff_address": delivery.get(
                    "dropoff_address"
                ),
            }
        )

    total_gross = round(
        total_gross,
        2,
    )

    total_platform_fee = round(
        total_platform_fee,
        2,
    )

    total_courier = round(
        total_courier,
        2,
    )

    return {
        "total_deliveries": total_deliveries,
        "total_gross": total_gross,
        "total_platform_fee": total_platform_fee,
        "total_courier": total_courier,
        "delivery_details": delivery_details,
    }


# =========================================================
# PUBLICAÇÃO CICLO DA LOJA
# =========================================================

def billing_cycle_to_public(
    cycle: dict,
) -> dict:

    closing_weekday = int(
        cycle.get(
            "closing_weekday",
            DEFAULT_BILLING_WEEKDAY,
        )
    )

    cycle_id = cycle.get(
        "_id"
    )

    return {
        "id": (
            str(cycle_id)
            if cycle_id is not None
            else None
        ),
        "store_id": str(
            cycle.get(
                "store_id",
                "",
            )
        ),
        "store_name": cycle.get(
            "store_name",
            "Loja",
        ),
        "closing_weekday": (
            closing_weekday
        ),
        "closing_weekday_label": (
            billing_weekday_label(
                closing_weekday
            )
        ),
        "period_start": cycle.get(
            "period_start"
        ),
        "period_end": cycle.get(
            "period_end"
        ),
        "total_deliveries": int(
            cycle.get(
                "total_deliveries",
                0,
            )
        ),
        "total_fee": round(
            float(
                cycle.get(
                    "total_fee",
                    0,
                )
            ),
            2,
        ),
        "status": cycle.get(
            "status",
            "closed",
        ),
        "closed_at": cycle.get(
            "closed_at"
        ),
        "paid_at": cycle.get(
            "paid_at"
        ),
        "created_at": cycle.get(
            "created_at"
        ),
        "updated_at": cycle.get(
            "updated_at"
        ),
    }


# =========================================================
# NOVO:
# PUBLICAÇÃO CICLO DO ENTREGADOR
# =========================================================

def courier_billing_cycle_to_public(
    cycle: dict,
) -> dict:

    cycle_id = cycle.get(
        "_id"
    )

    total_courier = round(
        float(
            cycle.get(
                "total_courier",
                cycle.get(
                    "total_amount",
                    0,
                ),
            )
            or 0
        ),
        2,
    )

    total_gross = round(
        float(
            cycle.get(
                "total_gross",
                0,
            )
            or 0
        ),
        2,
    )

    total_platform_fee = round(
        float(
            cycle.get(
                "total_platform_fee",
                0,
            )
            or 0
        ),
        2,
    )

    return {
        "id": (
            str(cycle_id)
            if cycle_id is not None
            else None
        ),
        "courier_id": str(
            cycle.get(
                "courier_id",
                "",
            )
        ),
        "courier_name": cycle.get(
            "courier_name",
            "Entregador",
        ),
        "period_start": cycle.get(
            "period_start"
        ),
        "period_end": cycle.get(
            "period_end"
        ),
        "total_deliveries": int(
            cycle.get(
                "total_deliveries",
                0,
            )
        ),
        "total_gross": total_gross,
        "total_platform_fee": total_platform_fee,
        "total_courier": total_courier,

        # Aliases para facilitar o frontend.
        "total_amount": total_courier,
        "amount": total_courier,
        "total_to_pay": total_courier,
        "value_to_pay": total_courier,

        "status": cycle.get(
            "status",
            "closed",
        ),
        "closed_at": cycle.get(
            "closed_at"
        ),
        "paid_at": cycle.get(
            "paid_at"
        ),
        "created_at": cycle.get(
            "created_at"
        ),
        "updated_at": cycle.get(
            "updated_at"
        ),
        "delivery_details": cycle.get(
            "delivery_details",
            [],
        ),
    }


# =========================================================
# ADMIN FATURAMENTO
# LOJAS + ENTREGADORES
# =========================================================

@app.get("/admin/billing")
@app.get("/api/admin/billing")
async def admin_billing(
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    # =====================================================
    # LOJAS
    # =====================================================

    stores = (
        await db.users.find(
            {
                "role": "store"
            }
        )
        .sort(
            "name",
            1,
        )
        .to_list(500)
    )

    today = datetime.now(
        BRAZIL_TZ
    ).date()

    current_cycles = []

    store_public = []

    for store in stores:

        store_id = str(
            store["_id"]
        )

        closing_weekday = int(
            store.get(
                "billing_closing_weekday",
                DEFAULT_BILLING_WEEKDAY,
            )
        )

        if (
            closing_weekday < 0
            or closing_weekday > 6
        ):

            closing_weekday = (
                DEFAULT_BILLING_WEEKDAY
            )

        period_start, period_end = (
            cycle_for_date(
                today,
                closing_weekday,
            )
        )

        totals = await calculate_store_cycle(
            store_id,
            period_start,
            period_end,
        )

        current_cycles.append(
            {
                "id": None,
                "store_id": store_id,
                "store_name": store.get(
                    "name",
                    "Loja",
                ),
                "closing_weekday": (
                    closing_weekday
                ),
                "closing_weekday_label": (
                    billing_weekday_label(
                        closing_weekday
                    )
                ),
                "period_start": (
                    period_start.isoformat()
                ),
                "period_end": (
                    period_end.isoformat()
                ),
                "total_deliveries": (
                    totals[
                        "total_deliveries"
                    ]
                ),
                "total_fee": (
                    totals[
                        "total_fee"
                    ]
                ),
                "status": "open",
                "closed_at": None,
                "paid_at": None,
                "created_at": None,
                "updated_at": None,
            }
        )

        store_public.append(
            {
                "id": store_id,
                "name": store.get(
                    "name",
                    "Loja",
                ),
                "email": store.get(
                    "email"
                ),
                "closing_weekday": (
                    closing_weekday
                ),
                "closing_weekday_label": (
                    billing_weekday_label(
                        closing_weekday
                    )
                ),
            }
        )

    history_docs = (
        await db.store_billing_cycles
        .find({})
        .sort(
            "period_end",
            -1,
        )
        .to_list(1000)
    )

    history = [
        billing_cycle_to_public(
            cycle
        )
        for cycle in history_docs
    ]

    # =====================================================
    # NOVO:
    # ENTREGADORES
    # =====================================================

    couriers = (
        await db.users.find(
            {
                "role": "courier"
            }
        )
        .sort(
            "name",
            1,
        )
        .to_list(500)
    )

    courier_current_cycles = []

    courier_public = []

    for courier in couriers:

        courier_id = str(
            courier["_id"]
        )

        courier_name = courier.get(
            "name",
            "Entregador",
        )

        # O fechamento dos entregadores também usa
        # o mesmo dia de fechamento configurável.
        closing_weekday = int(
            courier.get(
                "billing_closing_weekday",
                DEFAULT_BILLING_WEEKDAY,
            )
        )

        if (
            closing_weekday < 0
            or closing_weekday > 6
        ):

            closing_weekday = (
                DEFAULT_BILLING_WEEKDAY
            )

        period_start, period_end = (
            cycle_for_date(
                today,
                closing_weekday,
            )
        )

        courier_totals = (
            await calculate_courier_cycle(
                courier_id,
                period_start,
                period_end,
            )
        )

        # Se o período atual já foi fechado, usamos o ciclo
        # salvo no banco para que o Admin veja o ID real,
        # o status e possa confirmar o pagamento.
        existing_courier_cycle = (
            await db.courier_billing_cycles.find_one(
                {
                    "courier_id": courier_id,
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                }
            )
        )

        payment_account = (
            _public_payment_account(
                courier
            )
        )

        courier_current_cycles.append(
            {
                "id": (
                    str(existing_courier_cycle["_id"])
                    if existing_courier_cycle and existing_courier_cycle.get("_id") is not None
                    else None
                ),
                "courier_id": courier_id,
                "courier_name": courier_name,
                "period_start": (
                    period_start.isoformat()
                ),
                "period_end": (
                    period_end.isoformat()
                ),
                "closing_weekday": (
                    closing_weekday
                ),
                "closing_weekday_label": (
                    billing_weekday_label(
                        closing_weekday
                    )
                ),
                "total_deliveries": (
                    courier_totals[
                        "total_deliveries"
                    ]
                ),
                "total_gross": (
                    courier_totals[
                        "total_gross"
                    ]
                ),
                "total_platform_fee": (
                    courier_totals[
                        "total_platform_fee"
                    ]
                ),
                "total_courier": (
                    courier_totals[
                        "total_courier"
                    ]
                ),

                # Aliases para o frontend.
                "total_amount": (
                    courier_totals[
                        "total_courier"
                    ]
                ),
                "amount": (
                    courier_totals[
                        "total_courier"
                    ]
                ),
                "total_to_pay": (
                    courier_totals[
                        "total_courier"
                    ]
                ),
                "value_to_pay": (
                    courier_totals[
                        "total_courier"
                    ]
                ),

                "status": (
                    existing_courier_cycle.get("status", "open")
                    if existing_courier_cycle
                    else "open"
                ),
                "closed_at": (
                    existing_courier_cycle.get("closed_at")
                    if existing_courier_cycle
                    else None
                ),
                "paid_at": (
                    existing_courier_cycle.get("paid_at")
                    if existing_courier_cycle
                    else None
                ),
                "created_at": (
                    existing_courier_cycle.get("created_at")
                    if existing_courier_cycle
                    else None
                ),
                "updated_at": (
                    existing_courier_cycle.get("updated_at")
                    if existing_courier_cycle
                    else None
                ),

                "payment_account": (
                    existing_courier_cycle.get("payment_account", payment_account)
                    if existing_courier_cycle
                    else payment_account
                ),

                "delivery_details": (
                    courier_totals[
                        "delivery_details"
                    ]
                ),
            }
        )

        courier_public.append(
            {
                "id": courier_id,
                "name": courier_name,
                "email": courier.get(
                    "email"
                ),
                "phone": courier.get(
                    "phone"
                ),
                "closing_weekday": (
                    closing_weekday
                ),
                "closing_weekday_label": (
                    billing_weekday_label(
                        closing_weekday
                    )
                ),
                "payment_account": payment_account,
            }
        )

    courier_history_docs = (
        await db.courier_billing_cycles
        .find({})
        .sort(
            "period_end",
            -1,
        )
        .to_list(2000)
    )

    courier_history = [
        courier_billing_cycle_to_public(
            cycle
        )
        for cycle in courier_history_docs
    ]

    # =====================================================
    # RETORNO
    # =====================================================

    return {
        # Loja
        "stores": store_public,
        "current_cycles": current_cycles,
        "history": history,

        # Entregador
        "couriers": courier_public,
        "courier_current_cycles": (
            courier_current_cycles
        ),
        "courier_history": courier_history,

        # Aliases para facilitar compatibilidade
        # com versões diferentes do frontend.
        "courier_cycles": courier_current_cycles,
        "courier_billing_history": courier_history,

        "weekdays": BILLING_WEEKDAYS,
    }


# =========================================================
# ADMIN FATURAMENTO POR PERÍODO
# LOJAS + ENTREGADORES
# =========================================================

@app.get("/admin/billing/period")
@app.get("/api/admin/billing/period")
async def admin_billing_period(
    start_date: date,
    end_date: date,
    admin: dict = Depends(
        require_roles("admin")
    ),
):
    """
    Retorna o faturamento real de um período informado pelo Admin.

    start_date e end_date são datas no formato YYYY-MM-DD.
    A mesma regra usada nos fechamentos é aplicada aos cálculos:
    - Loja: conta entregas concluídas pelo created_at e cobra PLATFORM_FEE.
    - Entregador: conta entregas concluídas pelo completed_at e calcula
      gross, taxa da plataforma e valor líquido a pagar ao entregador.

    Os ciclos históricos não são alterados; esta rota apenas consulta
    novamente as entregas do período solicitado.
    """

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="A data final não pode ser anterior à data inicial.",
        )

    # Evita consultas acidentais de períodos gigantes no painel.
    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=400,
            detail="O período máximo permitido é de 367 dias.",
        )

    stores = (
        await db.users.find(
            {"role": "store"}
        )
        .sort(
            "name",
            1,
        )
        .to_list(1000)
    )

    couriers = (
        await db.users.find(
            {"role": "courier"}
        )
        .sort(
            "name",
            1,
        )
        .to_list(1000)
    )

    store_items = []
    courier_items = []

    total_store_deliveries = 0
    total_store_billing = 0.0

    total_courier_deliveries = 0
    total_gross = 0.0
    total_platform_fee = 0.0
    total_courier = 0.0

    # -----------------------------------------------------
    # FATURAMENTO DAS LOJAS
    # -----------------------------------------------------
    for store in stores:
        store_id = str(store.get("_id"))

        totals = await calculate_store_cycle(
            store_id,
            start_date,
            end_date,
        )

        deliveries_count = int(
            totals.get("total_deliveries", 0)
        )
        fee = round(
            float(
                totals.get("total_fee", 0)
            ),
            2,
        )

        total_store_deliveries += deliveries_count
        total_store_billing += fee

        store_items.append(
            {
                "id": store_id,
                "store_id": store_id,
                "name": store.get(
                    "name",
                    "Loja",
                ),
                "store_name": store.get(
                    "name",
                    "Loja",
                ),
                "email": store.get("email"),
                "total_deliveries": deliveries_count,
                "total_fee": fee,
                "amount": fee,
                "total_amount": fee,
                "value_to_pay": fee,
            }
        )

    # -----------------------------------------------------
    # FATURAMENTO / PAGAMENTO DOS ENTREGADORES
    # -----------------------------------------------------
    for courier in couriers:
        courier_id = str(courier.get("_id"))

        totals = await calculate_courier_cycle(
            courier_id,
            start_date,
            end_date,
        )

        deliveries_count = int(
            totals.get("total_deliveries", 0)
        )
        gross = round(
            float(
                totals.get("total_gross", 0)
            ),
            2,
        )
        platform_fee = round(
            float(
                totals.get("total_platform_fee", 0)
            ),
            2,
        )
        courier_amount = round(
            float(
                totals.get("total_courier", 0)
            ),
            2,
        )

        total_courier_deliveries += deliveries_count
        total_gross += gross
        total_platform_fee += platform_fee
        total_courier += courier_amount

        courier_items.append(
            {
                "id": courier_id,
                "courier_id": courier_id,
                "name": courier.get(
                    "name",
                    "Entregador",
                ),
                "courier_name": courier.get(
                    "name",
                    "Entregador",
                ),
                "email": courier.get("email"),
                "phone": courier.get("phone"),
                "total_deliveries": deliveries_count,
                "total_gross": gross,
                "total_platform_fee": platform_fee,
                "total_courier": courier_amount,
                "total_amount": courier_amount,
                "amount": courier_amount,
                "total_to_pay": courier_amount,
                "value_to_pay": courier_amount,
            }
        )

    total_store_billing = round(
        total_store_billing,
        2,
    )
    total_gross = round(
        total_gross,
        2,
    )
    total_platform_fee = round(
        total_platform_fee,
        2,
    )
    total_courier = round(
        total_courier,
        2,
    )

    # O faturamento da plataforma pode ser visto tanto pela cobrança
    # das lojas quanto pela soma das taxas calculadas nas entregas.
    return {
        "ok": True,
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days": (end_date - start_date).days + 1,
        },
        "stores": store_items,
        "couriers": courier_items,
        "totals": {
            "store_deliveries": total_store_deliveries,
            "store_billing": total_store_billing,
            "total_store_fee": total_store_billing,
            "courier_deliveries": total_courier_deliveries,
            "gross": total_gross,
            "platform_fee": total_platform_fee,
            "courier_to_pay": total_courier,
            "total_courier": total_courier,
        },
        "platform": {
            "store_billing": total_store_billing,
            "delivery_platform_fee": total_platform_fee,
        },
    }


# =========================================================
# ALTERAR DIA DE FECHAMENTO DA LOJA
# =========================================================

@app.put(
    "/admin/stores/{store_id}/billing"
)
@app.put(
    "/api/admin/stores/{store_id}/billing"
)
async def update_store_billing(
    store_id: str,
    body: BillingClosingDayIn,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        object_id = ObjectId(
            store_id
        )

        query = {
            "_id": object_id,
            "role": "store",
        }

    except Exception:

        query = {
            "id": store_id,
            "role": "store",
        }

    result = await db.users.update_one(
        query,
        {
            "$set": {
                "billing_closing_weekday": (
                    body.closing_weekday
                ),
                "updated_at": now_iso(),
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Loja não encontrada",
        )

    return {
        "ok": True,
        "store_id": store_id,
        "closing_weekday": (
            body.closing_weekday
        ),
        "closing_weekday_label": (
            billing_weekday_label(
                body.closing_weekday
            )
        ),
    }


# =========================================================
# NOVO:
# ALTERAR DIA DE FECHAMENTO DO ENTREGADOR
# =========================================================

@app.put(
    "/admin/couriers/{courier_id}/billing"
)
@app.put(
    "/api/admin/couriers/{courier_id}/billing"
)
async def update_courier_billing(
    courier_id: str,
    body: BillingClosingDayIn,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        object_id = ObjectId(
            courier_id
        )

        query = {
            "_id": object_id,
            "role": "courier",
        }

    except Exception:

        query = {
            "id": courier_id,
            "role": "courier",
        }

    result = await db.users.update_one(
        query,
        {
            "$set": {
                "billing_closing_weekday": (
                    body.closing_weekday
                ),
                "updated_at": now_iso(),
            }
        },
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Entregador não encontrado",
        )

    return {
        "ok": True,
        "courier_id": courier_id,
        "closing_weekday": (
            body.closing_weekday
        ),
        "closing_weekday_label": (
            billing_weekday_label(
                body.closing_weekday
            )
        ),
    }


# =========================================================
# FECHAR CICLO DA LOJA
# =========================================================

@app.post(
    "/admin/billing/{store_id}/close"
)
@app.post(
    "/api/admin/billing/{store_id}/close"
)
async def close_store_billing(
    store_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        object_id = ObjectId(
            store_id
        )

        store_query = {
            "_id": object_id,
            "role": "store",
        }

    except Exception:

        store_query = {
            "id": store_id,
            "role": "store",
        }

    store = await db.users.find_one(
        store_query
    )

    if not store:

        raise HTTPException(
            status_code=404,
            detail="Loja não encontrada",
        )

    closing_weekday = int(
        store.get(
            "billing_closing_weekday",
            DEFAULT_BILLING_WEEKDAY,
        )
    )

    today = datetime.now(
        BRAZIL_TZ
    ).date()

    period_start, period_end = (
        cycle_for_date(
            today,
            closing_weekday,
        )
    )

    existing = (
        await db.store_billing_cycles.find_one(
            {
                "store_id": store_id,
                "period_start": (
                    period_start.isoformat()
                ),
                "period_end": (
                    period_end.isoformat()
                ),
            }
        )
    )

    if existing:

        return {
            "ok": True,
            "message": (
                "Este período já foi fechado."
            ),
            "cycle": billing_cycle_to_public(
                existing
            ),
        }

    totals = await calculate_store_cycle(
        store_id,
        period_start,
        period_end,
    )

    now = now_iso()

    cycle = {
        "store_id": store_id,
        "store_name": store.get(
            "name",
            "Loja",
        ),
        "closing_weekday": (
            closing_weekday
        ),
        "period_start": (
            period_start.isoformat()
        ),
        "period_end": (
            period_end.isoformat()
        ),
        "total_deliveries": (
            totals[
                "total_deliveries"
            ]
        ),
        "total_fee": (
            totals[
                "total_fee"
            ]
        ),
        "status": "closed",
        "closed_at": now,
        "paid_at": None,
        "created_at": now,
        "updated_at": now,
    }

    try:

        result = (
            await db.store_billing_cycles.insert_one(
                cycle
            )
        )

        cycle["_id"] = result.inserted_id

    except DuplicateKeyError:

        existing = (
            await db.store_billing_cycles.find_one(
                {
                    "store_id": store_id,
                    "period_start": (
                        period_start.isoformat()
                    ),
                    "period_end": (
                        period_end.isoformat()
                    ),
                }
            )
        )

        if existing:

            return {
                "ok": True,
                "message": (
                    "Este período já foi fechado."
                ),
                "cycle": (
                    billing_cycle_to_public(
                        existing
                    )
                ),
            }

        raise

    return {
        "ok": True,
        "message": (
            "Fechamento realizado com sucesso."
        ),
        "cycle": billing_cycle_to_public(
            cycle
        ),
    }


# =========================================================
# NOVO:
# FECHAR CICLO DO ENTREGADOR
# =========================================================

@app.post(
    "/admin/billing/couriers/{courier_id}/close"
)
@app.post(
    "/api/admin/billing/couriers/{courier_id}/close"
)
async def close_courier_billing(
    courier_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        object_id = ObjectId(
            courier_id
        )

        courier_query = {
            "_id": object_id,
            "role": "courier",
        }

    except Exception:

        courier_query = {
            "id": courier_id,
            "role": "courier",
        }

    courier = await db.users.find_one(
        courier_query
    )

    if not courier:

        raise HTTPException(
            status_code=404,
            detail="Entregador não encontrado",
        )

    closing_weekday = int(
        courier.get(
            "billing_closing_weekday",
            DEFAULT_BILLING_WEEKDAY,
        )
    )

    if (
        closing_weekday < 0
        or closing_weekday > 6
    ):

        closing_weekday = (
            DEFAULT_BILLING_WEEKDAY
        )

    today = datetime.now(
        BRAZIL_TZ
    ).date()

    period_start, period_end = (
        cycle_for_date(
            today,
            closing_weekday,
        )
    )

    existing = (
        await db.courier_billing_cycles.find_one(
            {
                "courier_id": courier_id,
                "period_start": (
                    period_start.isoformat()
                ),
                "period_end": (
                    period_end.isoformat()
                ),
            }
        )
    )

    if existing:

        return {
            "ok": True,
            "message": (
                "Este período já foi fechado."
            ),
            "cycle": (
                courier_billing_cycle_to_public(
                    existing
                )
            ),
        }

    totals = await calculate_courier_cycle(
        courier_id,
        period_start,
        period_end,
    )

    now = now_iso()

    cycle = {
        "courier_id": courier_id,
        "courier_name": courier.get(
            "name",
            "Entregador",
        ),
        "period_start": (
            period_start.isoformat()
        ),
        "period_end": (
            period_end.isoformat()
        ),
        "closing_weekday": (
            closing_weekday
        ),
        "total_deliveries": (
            totals[
                "total_deliveries"
            ]
        ),
        "total_gross": (
            totals[
                "total_gross"
            ]
        ),
        "total_platform_fee": (
            totals[
                "total_platform_fee"
            ]
        ),
        "total_courier": (
            totals[
                "total_courier"
            ]
        ),
        "total_amount": (
            totals[
                "total_courier"
            ]
        ),
        "status": "closed",
        "closed_at": now,
        "paid_at": None,
        "created_at": now,
        "updated_at": now,

        # Salvamos um retrato das entregas do ciclo.
        "delivery_details": (
            totals[
                "delivery_details"
            ]
        ),

        # Conta PIX no momento do fechamento.
        "payment_account": (
            _public_payment_account(
                courier
            )
        ),
    }

    try:

        result = (
            await db.courier_billing_cycles.insert_one(
                cycle
            )
        )

        cycle["_id"] = result.inserted_id

    except DuplicateKeyError:

        existing = (
            await db.courier_billing_cycles.find_one(
                {
                    "courier_id": courier_id,
                    "period_start": (
                        period_start.isoformat()
                    ),
                    "period_end": (
                        period_end.isoformat()
                    ),
                }
            )
        )

        if existing:

            return {
                "ok": True,
                "message": (
                    "Este período já foi fechado."
                ),
                "cycle": (
                    courier_billing_cycle_to_public(
                        existing
                    )
                ),
            }

        raise

    return {
        "ok": True,
        "message": (
            "Fechamento do entregador realizado com sucesso."
        ),
        "cycle": (
            courier_billing_cycle_to_public(
                cycle
            )
        ),
    }


# =========================================================
# PAGAR CICLO DA LOJA
# =========================================================

@app.post(
    "/admin/billing/cycles/{cycle_id}/pay"
)
@app.post(
    "/api/admin/billing/cycles/{cycle_id}/pay"
)
async def pay_billing_cycle(
    cycle_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        query = {
            "_id": ObjectId(
                cycle_id
            )
        }

    except Exception:

        query = {
            "id": cycle_id
        }

    cycle = await db.store_billing_cycles.find_one(
        query
    )

    if not cycle:

        raise HTTPException(
            status_code=404,
            detail="Ciclo de faturamento não encontrado",
        )

    if cycle.get("status") == "paid":

        return {
            "ok": True,
            "message": (
                "Este ciclo já está pago."
            ),
            "cycle": billing_cycle_to_public(
                cycle
            ),
        }

    if cycle.get("status") != "closed":

        raise HTTPException(
            status_code=400,
            detail=(
                "Somente ciclos fechados "
                "podem ser pagos."
            ),
        )

    paid_at = now_iso()

    await db.store_billing_cycles.update_one(
        query,
        {
            "$set": {
                "status": "paid",
                "paid_at": paid_at,
                "updated_at": paid_at,
            }
        },
    )

    updated = (
        await db.store_billing_cycles.find_one(
            query
        )
    )

    return {
        "ok": True,
        "message": (
            "Pagamento registrado com sucesso."
        ),
        "cycle": billing_cycle_to_public(
            updated
        ),
    }


# =========================================================
# NOVO:
# PAGAR CICLO DO ENTREGADOR
# =========================================================

@app.post(
    "/admin/billing/courier-cycles/{cycle_id}/pay"
)
@app.post(
    "/api/admin/billing/courier-cycles/{cycle_id}/pay"
)
async def pay_courier_billing_cycle(
    cycle_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        query = {
            "_id": ObjectId(
                cycle_id
            )
        }

    except Exception:

        query = {
            "id": cycle_id
        }

    cycle = (
        await db.courier_billing_cycles.find_one(
            query
        )
    )

    if not cycle:

        raise HTTPException(
            status_code=404,
            detail=(
                "Ciclo de pagamento do "
                "entregador não encontrado"
            ),
        )

    if cycle.get("status") == "paid":

        return {
            "ok": True,
            "message": (
                "Este pagamento já foi confirmado."
            ),
            "cycle": (
                courier_billing_cycle_to_public(
                    cycle
                )
            ),
        }

    if cycle.get("status") != "closed":

        raise HTTPException(
            status_code=400,
            detail=(
                "Somente períodos fechados "
                "podem ser pagos."
            ),
        )

    paid_at = now_iso()

    await db.courier_billing_cycles.update_one(
        query,
        {
            "$set": {
                "status": "paid",
                "paid_at": paid_at,
                "updated_at": paid_at,
            }
        },
    )

    updated = (
        await db.courier_billing_cycles.find_one(
            query
        )
    )

    return {
        "ok": True,
        "message": (
            "Pagamento do entregador "
            "confirmado com sucesso."
        ),
        "cycle": (
            courier_billing_cycle_to_public(
                updated
            )
        ),
    }


# =========================================================
# NOVO:
# CONSULTAR PAGAMENTOS DE UM ENTREGADOR
# =========================================================

@app.get(
    "/admin/billing/couriers/{courier_id}"
)
@app.get(
    "/api/admin/billing/couriers/{courier_id}"
)
async def get_courier_billing(
    courier_id: str,
    admin: dict = Depends(
        require_roles("admin")
    ),
):

    try:

        object_id = ObjectId(
            courier_id
        )

        courier_query = {
            "_id": object_id,
            "role": "courier",
        }

    except Exception:

        courier_query = {
            "id": courier_id,
            "role": "courier",
        }

    courier = await db.users.find_one(
        courier_query
    )

    if not courier:

        raise HTTPException(
            status_code=404,
            detail="Entregador não encontrado",
        )

    cycles = (
        await db.courier_billing_cycles
        .find(
            {
                "courier_id": courier_id
            }
        )
        .sort(
            "period_end",
            -1,
        )
        .to_list(1000)
    )

    return {
        "courier": {
            "id": courier_id,
            "name": courier.get(
                "name",
                "Entregador",
            ),
            "email": courier.get(
                "email"
            ),
            "phone": courier.get(
                "phone"
            ),
            "payment_account": (
                _public_payment_account(
                    courier
                )
            ),
        },
        "history": [
            courier_billing_cycle_to_public(
                cycle
            )
            for cycle in cycles
        ],
    }


# =========================================================
# WEBSOCKET
# =========================================================

class ConnectionManager:

    def __init__(self):

        self.active_connections: dict[
            str,
            WebSocket,
        ] = {}

    async def connect(
        self,
        user_id: str,
        websocket: WebSocket,
    ):

        user_id = str(
            user_id
        )

        await websocket.accept()

        old_websocket = (
            self.active_connections.get(
                user_id
            )
        )

        if (
            old_websocket is not None
            and old_websocket is not websocket
        ):

            logger.info(
                "WebSocket antigo substituído para usuário: %s",
                user_id,
            )

            try:

                await old_websocket.close()

            except Exception:

                pass

        self.active_connections[
            user_id
        ] = websocket

    def disconnect(
        self,
        user_id: str,
        websocket: Optional[WebSocket] = None,
    ):

        user_id = str(
            user_id
        )

        current_websocket = (
            self.active_connections.get(
                user_id
            )
        )

        if current_websocket is not None:

            if (
                websocket is None
                or current_websocket is websocket
            ):

                del self.active_connections[
                    user_id
                ]

    async def send_personal_message(
        self,
        message: dict,
        user_id: Optional[str],
    ):

        if not user_id:
            return False

        user_id = str(
            user_id
        )

        websocket = (
            self.active_connections.get(
                user_id
            )
        )

        if not websocket:
            return False

        try:

            await websocket.send_json(
                message
            )

            return True

        except Exception as exc:

            logger.warning(
                "Erro WebSocket para %s: %s",
                user_id,
                exc,
            )

            self.disconnect(
                user_id,
                websocket,
            )

            return False


manager = ConnectionManager()


@app.websocket(
    "/ws/{user_id}"
)
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
):

    user_id = str(
        user_id
    )

    await manager.connect(
        user_id,
        websocket,
    )

    try:

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(
            user_id,
            websocket,
        )

    except Exception as exc:

        logger.warning(
            "Erro no WebSocket %s: %s",
            user_id,
            exc,
        )

        manager.disconnect(
            user_id,
            websocket,
        )


# =========================================================
# MENSAGENS
# =========================================================

@app.post("/api/messages")
@app.post("/admin/messages")
async def send_message(
    data: dict,
    user: dict = Depends(
        get_current_user
    ),
):

    sender_id = str(
        user.get(
            "id",
            user.get("_id"),
        )
    )

    recipient_id = data.get(
        "recipient_id"
    )

    delivery_id = data.get(
        "delivery_id"
    )

    text = str(
        data.get(
            "text",
            "",
        )
    ).strip()

    if not text:

        raise HTTPException(
            status_code=400,
            detail="Mensagem vazia",
        )

    message_doc = {
        "delivery_id": delivery_id,
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "text": text,
        "created_at": datetime.now(
            timezone.utc
        ),
    }

    await db.messages.insert_one(
        message_doc
    )

    await manager.send_personal_message(
        {
            "type": "message",
            "sender_id": sender_id,
            "sender_name": user.get(
                "name",
                "Usuário",
            ),
            "delivery_id": delivery_id,
            "text": text,
            "message": text,
            "created_at": (
                message_doc[
                    "created_at"
                ].isoformat()
            ),
        },
        recipient_id,
    )

    return {
        "ok": True,
        "message": (
            "Mensagem enviada com sucesso"
        ),
    }


# =========================================================
# FUNÇÃO AUXILIAR
# =========================================================

def parse_iso_datetime_for_billing(
    value,
):

    return parse_iso_datetime(
        value
    )


# =========================================================
# REGISTRA O APIRouter
# =========================================================

app.include_router(api)

