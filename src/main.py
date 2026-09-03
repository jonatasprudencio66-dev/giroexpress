from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# IMPORTANTE: Removido o prefix="/api" aqui para evitar duplicidade 
# caso o vercel.json já faça o rewrite para /api. 
# Se o seu vercel.json remove o /api, deixe o APIRouter sem prefixo ou ajuste conforme o rewrite.
api_router = APIRouter()

@api_router.get("/")
def read_root():
    return {"message": "GiroExpress API rodando"}

@api_router.get("/admin/stats")
def get_stats():
    return {"total_taxes": 0, "total_deliveries": 0}

@api_router.get("/admin/settings")
def get_settings():
    return {"status": True}

@api_router.get("/admin/settings/operations")
def get_operations():
    return {}

@api_router.get("/admin/users")
def get_admin_users():
    return []

@api_router.get("/tickets")
def get_tickets():
    return []

@api_router.get("/statements")
def get_statements():
    return []

@api_router.post("/auth/login")
def login(data: dict = None):
    email = data.get("email", "").lower() if data else ""
    
    # Define o cargo dinamicamente baseado no e-mail digitado
    if "loja" in email:
        role = "store"
    elif "motoboy" in email:
        role = "deliveryman"
    else:
        role = "admin"

    return {
        "access_token": "token_falso_" + role,
        "token_type": "bearer",
        "role": role,
        "user": {
            "email": email or "jonatasprudencio66@gmail.com",
            "role": role
        }
    }

@api_router.post("/auth/register")
def register(data: dict = None):
    email = data.get("email", "") if data else ""
    return {"message": "Conta criada com sucesso", "email": email}

@api_router.get("/auth/me")
def get_me(authorization: str = Header(None)):
    # Identifica dinamicamente o role com base no token enviado pelo frontend
    role = "admin"
    if authorization:
        if "store" in authorization:
            role = "store"
        elif "deliveryman" in authorization:
            role = "deliveryman"

    return {
        "email": "jonatasprudencio66@gmail.com",
        "role": role
    }

@api_router.post("/auth/logout")
def logout():
    return {"message": "Logout com sucesso"}

app.include_router(api_router)

