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

# Base de dados em memória com usuário de teste inicial
users_db = [
    {"name": "Usuário Teste", "email": "jonatas_prudencio@hotmail.com", "role": "deliveryman", "status": "Pendente"}
]

@api_router.get("/")
def read_root():
    return {"message": "API GiroExpress rodando"}

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
    formatted_users = []
    for u in users_db:
        formatted_users.append({
            "name": u.get("name", "Usuário"),
            "email": u["email"],
            "role": u["role"],
            "status": u["status"]
        })
    return formatted_users

@api_router.post("/admin/users/action")
def user_action(data: dict = None):
    email = data.get("email", "").lower() if data else ""
    action = data.get("action", "").lower() if data else ""
    
    for u in users_db:
        if u["email"] == email:
            if action in ["approve", "aprovar", "activate", "ativar"]:
                u["status"] = "Aprovado"
            else:
                u["status"] = "Pendente"
                
    return {"message": "Ação realizada com sucesso"}

@api_router.get("/tickets")
def get_tickets():
    return []

@api_router.get("/statements")
def get_statements():
    return []

@api_router.get("/deliveries")
def get_deliveries():
    return []

@api_router.post("/auth/login")
def login(data: dict = None):
    email = data.get("email", "").lower() if data else ""
    requested_role = data.get("role") if data else None
    
    admin_emails = ["jonatasprudencio66@gmail.com"]
    
    if email in admin_emails:
        role = "admin"
        status = "Aprovado"
    else:
        user_record = next((u for u in users_db if u["email"] == email), None)
        
        if not user_record:
            user_record = {
                "name": "Novo Usuário",
                "email": email,
                "role": requested_role or "deliveryman",
                "status": "Pendente"
            }
            users_db.append(user_record)
            raise HTTPException(status_code=403, detail="Sua conta aguarda aprovação do Administrador.")
        
        if user_record["status"] != "Aprovado":
            raise HTTPException(status_code=403, detail="Sua conta aguarda aprovação do Administrador.")
            
        role = user_record["role"]
        status = user_record["status"]

    token_falso = f"token_{role}_{email}"

    return {
        "access_token": token_falso,
        "token_type": "bearer",
        "role": role,
        "user": {
            "email": email,
            "role": role,
            "status": status
        }
    }

@api_router.post("/auth/register")
def register(data: dict = None):
    email = data.get("email", "").lower() if data else ""
    role = data.get("role", "deliveryman") if data else "deliveryman"
    name = data.get("name", "Novo Usuário")
    
    if not any(u["email"] == email for u in users_db):
        users_db.append({
            "name": name,
            "email": email,
            "role": role,
            "status": "Pendente"
        })
        
    return {"message": "Conta criada com sucesso! Aguarde a aprovação do Administrador.", "email": email}

@api_router.get("/auth/me")
def get_me(authorization: str = Header(None)):
    role = "admin"
    email = "jonatasprudencio66@gmail.com"
    
    if authorization:
        token_str = authorization.replace("Bearer ", "")
        parts = token_str.split("_")
        
        if len(parts) >= 3:
            role = parts[1]
            email = parts[2]

    return {
        "user": {
            "email": email,
            "role": role
        }
    }

@api_router.post("/auth/logout")
def logout():
    return {"message": "Logout realizado com sucesso"}

app.include_router(api_router)