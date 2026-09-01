from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "GiroExpress API rodando"}

@app.get("/api/admin/stats")
def get_stats():
    return {"total_taxes": 0, "total_deliveries": 0}

@app.get("/api/admin/settings")
def get_settings():
    return {"status": True}

@app.get("/api/admin/settings/operations")
def get_operations():
    return {}

@app.get("/api/admin/users")
def get_admin_users():
    return []

@app.get("/api/tickets")
def get_tickets():
    return []

@app.get("/api/statements")
def get_statements():
    return []

@app.post("/api/auth/login")
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

@app.get("/api/auth/me")
def get_me():
    return {
        "email": "jonatasprudencio66@gmail.com",
        "role": "admin"
    }