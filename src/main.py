from fastapi import FastAPI

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

api_router = APIRouter(prefix="/api")

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
    email = data.get("email", "") if data else ""
    role = "admin"
    if "loja" in email.lower():
        role = "store"
    elif "motoboy" in email.lower():
        role = "deliveryman"

    return {
        "access_token": "token_falso",
        "token_type": "bearer",
        "role": role,
        "user": {
            "email": email or "jonatasprudencio66@gmail.com",
            "role": role
        }
    }

@api_router.get("/auth/me")
def get_me():
    return {
        "email": "jonatasprudencio66@gmail.com",
        "role": "admin"
    }

@api_router.post("/auth/logout")
def logout():
    return {"message": "Logout com sucesso"}

app.include_router(api_router)