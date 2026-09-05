from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
import json
import os

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

USERS_FILE = "users.json"

def load_users():
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return [
        {
            "name": "Administrador Master",
            "email": "jonatasprudencio66@gmail.com",
            "role": "admin",
            "status": "Aprovado"
        },
        {
            "name": "Usuário Teste",
            "email": "jonatas_prudencio@hotmail.com",
            "role": "deliveryman",
            "status": "Aprovado"
        },
        {
            "name": "Novo Motoboy Teste",
            "email": "teste1@gmail.com",
            "role": "deliveryman",
            "status": "Pendente"
        }
    ]

def save_users(users):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=4)
    except Exception:
        pass

# Base de dados carregada via arquivo JSON
users_db = load_users()


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
    global users_db
    formatted_users = []
    for u in users_db:
        formatted_users.append({
            "name": u.get("name", "Usuário"),
            "email": u["email"],
            "role": u["role"],
            "status": u.get("status", "Pendente")
        })
    return formatted_users

@api_router.post("/admin/users/approve")
@api_router.post("/admin/users/{identifier}/approve")
def approve_user(identifier: str = None, data: dict = None):
    global users_db
    email = identifier or (data.get("email") if data else "") or (data.get("identifier") if data else "")
    email = email.lower()
    
    for u in users_db:
        if u["email"].lower() == email:
            u["status"] = "Aprovado"
            save_users(users_db)  # Salva permanentemente no arquivo JSON
            return {"message": "Usuário aprovado com sucesso", "user": u}
            
    raise HTTPException(status_code=404, detail="Usuário não encontrado")

@api_router.patch("/admin/users/update-status")
def update_user_status(data: dict = None):
    email = data.get("identifier", "").lower() if data else ""
    new_status = data.get("status", "").lower() if data else ""
    
    for u in users_db:
        if u["email"].lower() == email:
            if new_status in ["blocked", "bloqueado"]:
                u["status"] = "Bloqueado"
            elif new_status in ["active", "ativo", "aprovado"]:
                u["status"] = "Aprovado"
            else:
                u["status"] = "Pendente"
            return {"message": "Status atualizado com sucesso"}
            
    raise HTTPException(status_code=404, detail="Usuário não encontrado")

@api_router.get("/tickets")
def get_tickets():
    return []

@api_router.get("/statements")
def get_statements():
    return []

@api_router.get("/deliveries")
def get_deliveries():
    return []
@api_router.get("/deliveries")
def get_deliveries():
    return []

@api_router.post("/deliveries")
def create_delivery(data: dict = None):
    if not data:
        raise HTTPException(status_code=400, detail="Dados da entrega inválidos")
    return {"message": "Entrega criada com sucesso", "delivery": data}

@api_router.post("/auth/login")
def login(data: dict = None):


    if not data:
        raise HTTPException(status_code=400, detail="Dados de login inválidos")
        
    email = data.get("email", "")
    email = email.lower() if email else ""
    requested_role = data.get("role")
    
    admin_emails = ["jonatasprudencio66@gmail.com"]
    
    if email in admin_emails:
        role = "admin"
        status = "Aprovado"
        return {
            "access_token": f"token_{role}_{email}",
            "token_type": "bearer",
            "role": role,
            "user": {
                "name": "Administrador Master",
                "email": email,
                "role": role,
                "status": status
            }
        }
    else:
      user_record = next((u for u in users_db if u["email"].lower() == email), None)
    if not user_record:
        user_record = {
            "name": "Novo Usuário",
            "email": email,
            "role": requested_role or "deliveryman",
            "status": "Pendente"
        }
        users_db.append(user_record)
    else:
        # Mantém o status existente ou força se necessário
        pass

    role = user_record.get("role", "deliveryman")
    status = user_record.get("status", "Pendente")

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
    global users_db
    if not data:
        raise HTTPException(status_code=400, detail="Dados inválidos")

    email = data.get("email", "").lower()
    role = data.get("role", "deliveryman")
    name = data.get("name", "Novo Usuário")

    # Verifica se já existe
    existing = next((u for u in users_db if u["email"].lower() == email), None)
    if existing:
        return {"message": "Usuário já cadastrado", "user": existing}

    new_user = {
        "name": name,
        "email": email,
        "role": role,
        "status": "Pendente"  # Nasce pendente para exigir aprovação do admin
    }
  
    save_users(users_db)  # Salva no arquivo JSON
    return {"message": "Cadastro realizado com sucesso...", "user": new_user}

@api_router.post("/auth/login")
def login(credentials: dict):
    email = credentials.get("email", "").lower()
    
    # Procura o usuário cadastrado no banco de dados da aplicação
    user_record = next((u for u in users_db if u["email"].lower() == email), None)
    
    # Se não encontrar, define como deliveryman por padrão ou store se contiver loja/store no e-mail
    if user_record:
        role = user_record.get("role", "deliveryman")
    else:
        role = "store" if "loja" in email or "store" in email else "deliveryman"
        user_record = {"email": email, "role": role, "status": "APROVADO"}
        users_db.append(user_record)
        
    return {
        "access_token": f"token_{role}_{email}",
        "token_type": "bearer",
        "user": {
            "email": email,
            "role": role,
            "status": "APROVADO"
        }
    }

@api_router.get("/auth/me")
def get_me(authorization: str = Header(None)):
    email = "jonatas_prudencio@hotmail.com"
    
    if authorization:
        token_str = authorization.replace("Bearer ", "")
        parts = token_str.split("_")
        if len(parts) >= 3:
            email = parts[2]

    # Busca o perfil exato salvo no registro do usuário
    user_record = next((u for u in users_db if u["email"].lower() == email.lower()), None)
    
    if user_record:
        role = user_record.get("role", "deliveryman")
    else:
        role = "store" if "loja" in email.lower() or "store" in email.lower() else "deliveryman"

    return {
        "user": {
            "email": email,
            "role": role,
            "status": "APROVADO"
        }
    }


@api_router.post("/auth/logout")
def logout():
    return {"message": "Logout realizado com sucesso"}

app.include_router(api_router)