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
    email = data.get("email", "").lower() if data else ""
    requested_role = data.get("role") if data else None
    
    store_emails = ["loja", "store", "comercial"]
    delivery_emails = ["motoboy", "courier", "delivery", "fer.nanda_cs@hotmail.com"]
    
    # Se o frontend mandou o cargo explicitamente no body, respeita ele. 
    # Caso contrário, tenta inferir pelas palavras-chave do e-mail.
    if requested_role:
        role = requested_role
    elif any(keyword in email for keyword in store_emails):
        role = "store"
    elif any(keyword in email for keyword in delivery_emails):
        role = "deliveryman"
    else:
        # Se for um e-mail novo comum (ex: teste2@hotmail.com) e nenhum cargo foi especificado,
        # defina como "deliveryman" ou "store" em vez de admin master por segurança.
        role = "deliveryman" 

    token_falso = f"token_{role}_{email}"

    # Empacota o role e o e-mail no token para que o refresh resgate ambos sem perder o dado
    token_falso = f"token_{role}_{email}"

    return {
        "access_token": token_falso,
        "token_type": "bearer",
        "role": role,
        "user": {
            "email": email,
            "role": role
        }
    }

@api_router.post("/auth/register")
def register(data: dict = None):
    email = data.get("email", "") if data else ""
    return {"message": "Conta criada com sucesso", "email": email}

@api_router.get("/auth/me")
def get_me(authorization: str = Header(None)):
    role = "admin"
    email = "jonatasprudencio66@gmail.com"
    
    if authorization:
        token_str = authorization.replace("Bearer ", "")
        parts = token_str.split("_")
        
        # Lê dinamicamente o role e o e-mail embutidos no token gerado no login
        if len(parts) >= 3:
            role = parts[1]
            email = parts[2]
        else:
            if "store" in token_str:
                role = "store"
                email = "loja@giroexpress.com"
            elif "deliveryman" in token_str or "motoboy" in token_str or "courier" in token_str:
                role = "deliveryman"
                email = "motoboy@giroexpress.com"
            else:
                role = "admin"

    return {
        "user": {
            "email": email,
            "role": role
        }
    }

@api_router.post("/auth/logout")
def logout():
    return {"message": "Logout com sucesso"}

app.include_router(api_router)