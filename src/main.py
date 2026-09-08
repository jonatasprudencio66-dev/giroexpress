from fastapi import APIRouter, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json
import os
import uuid


# ============================================================
# APP
# ============================================================

app = FastAPI()

api_router = APIRouter()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ============================================================
# CONFIGURAÇÕES
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

USERS_FILE = os.path.join(BASE_DIR, "users.json")
DELIVERIES_FILE = os.path.join(BASE_DIR, "deliveries.json")
PRODUCTS_FILE = os.path.join(BASE_DIR, "products.json")

# Usuário utilizado para teste do painel do motoboy
DEFAULT_TEST_COURIER_EMAIL = "teste1@gmail.com"


# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================

def normalize_status(status):
    """
    Normaliza os diferentes formatos de status usados pelo sistema.
    """
    if status is None:
        return ""

    value = str(status).lower().strip()

    status_map = {
        "inprogress": "in_progress",
        "in-progress": "in_progress",
        "in progress": "in_progress",
        "accepted": "in_progress",
        "accepted_delivery": "in_progress",
        "accepted-delivery": "in_progress",
        "pending": "pending",
        "completed": "completed",
        "complete": "completed",
        "finished": "completed",
        "cancelled": "cancelled",
        "canceled": "cancelled",
    }

    return status_map.get(value, value)


def get_courier_id(item):
    """
    Aceita os três formatos que podem existir no frontend/backend.
    """

    return (
        item.get("courier_id")
        or item.get("courierid")
        or item.get("courierId")
    )


def set_courier_fields(item, courier_identifier):
    """
    Mantém compatibilidade com diferentes versões do frontend.
    """

    if courier_identifier is None:
        item["courier_id"] = None
        item["courierid"] = None
        item["courierId"] = None
        return

    courier_identifier = str(courier_identifier)

    item["courier_id"] = courier_identifier
    item["courierid"] = courier_identifier
    item["courierId"] = courier_identifier


def format_delivery(item):
    """
    Cria uma cópia da entrega e padroniza os campos
    sem modificar diretamente o objeto original.
    """

    delivery = dict(item)

    # --------------------------------------------------------
    # ID
    # --------------------------------------------------------

    if not delivery.get("id"):
        delivery["id"] = str(uuid.uuid4())[:8]

    if not delivery.get("code"):
        delivery["code"] = f"COR-{delivery['id']}"

    # --------------------------------------------------------
    # STATUS
    # --------------------------------------------------------

    status = normalize_status(delivery.get("status"))

    delivery["status"] = status

    # --------------------------------------------------------
    # COURIER
    # --------------------------------------------------------

    courier_identifier = get_courier_id(delivery)

    if courier_identifier:
        set_courier_fields(delivery, courier_identifier)
    else:
        set_courier_fields(delivery, None)

    # --------------------------------------------------------
    # LOJA
    # --------------------------------------------------------

    store_name = (
        delivery.get("store_name")
        or delivery.get("storename")
        or delivery.get("store")
        or "Loja Parceira"
    )

    delivery["store"] = store_name
    delivery["store_name"] = store_name
    delivery["storename"] = store_name

    # --------------------------------------------------------
    # CLIENTE
    # --------------------------------------------------------

    client_name = (
        delivery.get("client")
        or delivery.get("client_name")
        or delivery.get("customer")
        or "Cliente Exemplo"
    )

    delivery["client"] = client_name

    # --------------------------------------------------------
    # PREÇO
    # --------------------------------------------------------

    if "price" not in delivery or delivery["price"] is None:
        delivery["price"] = 0.0

    if "gross_price" not in delivery or delivery["gross_price"] is None:
        delivery["gross_price"] = delivery.get("price", 0.0)

    # --------------------------------------------------------
    # CAMPOS DE ENDEREÇO
    # --------------------------------------------------------

    if not delivery.get("pickup"):
        delivery["pickup"] = "Endereço da Loja"

    if not delivery.get("delivery"):
        delivery["delivery"] = "Endereço de Entrega"

    # --------------------------------------------------------
    # ITENS
    # --------------------------------------------------------

    if not delivery.get("items"):
        delivery["items"] = "Pedido"

    return delivery


# ============================================================
# USUÁRIOS
# ============================================================

def save_users(users):
    try:
        with open(
            USERS_FILE,
            "w",
            encoding="utf-8"
        ) as f:
            json.dump(
                users,
                f,
                ensure_ascii=False,
                indent=4
            )
    except Exception as e:
        print("Erro ao salvar usuários:", e)


def load_users():

    if os.path.exists(USERS_FILE):

        try:

            with open(
                USERS_FILE,
                "r",
                encoding="utf-8"
            ) as f:

                data = json.load(f)

                if isinstance(data, list):

                    for user in data:

                        user["status"] = user.get(
                            "status",
                            "active"
                        )

                        user["approved"] = True
                        user["is_approved"] = True

                    return data

        except Exception as e:

            print("Erro ao carregar usuários:", e)

    default_users = [

        {
            "name": "Administrador Master",
            "email": "jonatasprudencio66@gmail.com",
            "role": "admin",
            "status": "active",
            "approved": True,
            "is_approved": True
        },

        {
            "name": "Usuário Teste",
            "email": "jonatas_prudencio@hotmail.com",
            "role": "deliveryman",
            "status": "active",
            "approved": True,
            "is_approved": True
        },

        {
            "name": "Novo Motoboy Teste",
            "email": "teste1@gmail.com",
            "role": "deliveryman",
            "status": "active",
            "approved": True,
            "is_approved": True
        }
    ]

    save_users(default_users)

    return default_users


users_db = load_users()


# ============================================================
# ENTREGAS
# ============================================================

def save_deliveries(deliveries):

    try:

        with open(
            DELIVERIES_FILE,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                deliveries,
                f,
                ensure_ascii=False,
                indent=4
            )

    except Exception as e:

        print("Erro ao salvar entregas:", e)


def load_deliveries():

    default_deliveries = [

        # ----------------------------------------------------
        # CORRIDA DISPONÍVEL
        # ----------------------------------------------------

        {
            "id": "101",
            "code": "COR-101",

            "status": "pending",

            "store": "Loja Parceira",
            "store_name": "Loja Parceira",
            "storename": "Loja Parceira",

            "store_email": "loja@giroexpress.com",

            "client": "Cliente Exemplo",

            "pickup": "Rua das Flores, 123",
            "delivery": "Av. Brasil, 456 - Apto 22",

            "price": 15.50,
            "gross_price": 15.50,

            "items": "Porção de Batata Frita",

            "startTime": "2026-09-06T10:00:00",

            "distance": "2.5 km",

            "courier_id": None,
            "courierid": None,
            "courierId": None
        }
    ]

    if os.path.exists(DELIVERIES_FILE):

        try:

            with open(
                DELIVERIES_FILE,
                "r",
                encoding="utf-8"
            ) as f:

                data = json.load(f)

                if (
                    isinstance(data, list)
                    and len(data) > 0
                ):

                    formatted = []

                    for item in data:

                        formatted.append(
                            format_delivery(item)
                        )

                    return formatted

        except Exception as e:

            print("Erro ao carregar entregas:", e)

    # Corrigido:
    # antes estava save_deliveries(deliveries_file_data=...)
    save_deliveries(default_deliveries)

    return default_deliveries


deliveries_db = load_deliveries()


# ============================================================
# PRODUTOS
# ============================================================

def save_products(products):

    try:

        with open(
            PRODUCTS_FILE,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                products,
                f,
                ensure_ascii=False,
                indent=4
            )

    except Exception as e:

        print("Erro ao salvar produtos:", e)


def load_products():

    if os.path.exists(PRODUCTS_FILE):

        try:

            with open(
                PRODUCTS_FILE,
                "r",
                encoding="utf-8"
            ) as f:

                data = json.load(f)

                if isinstance(data, list):
                    return data

        except Exception as e:

            print("Erro ao carregar produtos:", e)

    return []


products_db = load_products()


# ============================================================
# FRONTEND
# ============================================================

BUILD_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "../build")
)

if os.path.exists(BUILD_DIR):

    STATIC_DIR = os.path.join(
        BUILD_DIR,
        "static"
    )

    if os.path.exists(STATIC_DIR):

        app.mount(
            "/static",
            StaticFiles(
                directory=STATIC_DIR
            ),
            name="static"
        )


# ============================================================
# API - ROOT
# ============================================================

@api_router.get("/")
def read_root():

    return {
        "message": "API GiroExpress rodando"
    }


# ============================================================
# ADMIN
# ============================================================

@api_router.get("/admin/stats")
def get_stats():

    return {
        "total_taxes": 0,
        "total_deliveries": len(deliveries_db)
    }


@api_router.get("/admin/settings")
def get_settings():

    return {
        "status": True
    }


@api_router.get("/admin/settings/operations")
def get_operations():

    return {}


@api_router.get("/admin/users")
def get_admin_users():

    formatted_users = []

    for user in users_db:

        formatted_users.append({

            "name": user.get(
                "name",
                "Usuário"
            ),

            "email": user.get(
                "email",
                ""
            ),

            "role": user.get(
                "role",
                "deliveryman"
            ),

            "status": user.get(
                "status",
                "active"
            ),

            "approved": True,
            "is_approved": True
        })

    return formatted_users


@api_router.post("/admin/users/approve")
@api_router.post("/admin/users/{identifier}/approve")
def approve_user(
    identifier: str = None,
    data: dict = None
):

    global users_db

    email = (
        identifier
        or (data.get("email") if data else "")
        or (data.get("identifier") if data else "")
    )

    email = str(email).lower().strip()

    for user in users_db:

        if user["email"].lower() == email:

            user["status"] = "active"
            user["approved"] = True
            user["is_approved"] = True

            save_users(users_db)

            return {
                "message": "Usuário aprovado com sucesso",
                "user": user
            }

    raise HTTPException(
        status_code=404,
        detail="Usuário não encontrado"
    )


@api_router.patch("/admin/users/update-status")
def update_user_status(
    data: dict = None
):

    global users_db

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Dados inválidos"
        )

    email = str(
        data.get("identifier", "")
    ).lower().strip()

    new_status = str(
        data.get("status", "")
    ).lower().strip()

    for user in users_db:

        if user["email"].lower() == email:

            if new_status in [
                "blocked",
                "bloqueado"
            ]:

                user["status"] = "blocked"

            else:

                user["status"] = "active"
                user["approved"] = True
                user["is_approved"] = True

            save_users(users_db)

            return {
                "message": "Status atualizado com sucesso"
            }

    raise HTTPException(
        status_code=404,
        detail="Usuário não encontrado"
    )


# ============================================================
# TICKETS / STATEMENTS
# ============================================================

@api_router.get("/tickets")
def get_tickets():

    return []


@api_router.get("/statements")
def get_statements():

    return []


# ============================================================
# ENTREGAS
# ============================================================

@api_router.get("/deliveries")
def get_deliveries():

    """
    Retorna TODAS as corridas.

    Isso é importante porque o frontend precisa das corridas:
    - pending       -> Corridas Disponíveis
    - in_progress   -> Minhas Corridas em Andamento
    - completed     -> Histórico

    O endpoint NÃO deve retornar apenas corridas ativas.
    """

    result = []

    for item in deliveries_db:

        delivery = format_delivery(item)

        status = delivery.get("status")

        # ----------------------------------------------------
        # CORRIDA EM ANDAMENTO SEM ENTREGADOR
        # ----------------------------------------------------
        #
        # Para manter seu ambiente de teste funcional,
        # uma corrida marcada como in_progress/accepted sem
        # courier recebe o motoboy de teste.
        #
        # Depois que o sistema estiver em produção, essa parte
        # pode ser removida.
        # ----------------------------------------------------

        if status == "in_progress":

            courier_identifier = get_courier_id(
                delivery
            )

            if not courier_identifier:

                courier_identifier = (
                    DEFAULT_TEST_COURIER_EMAIL
                )

                delivery["courier_id"] = (
                    courier_identifier
                )

                delivery["courierid"] = (
                    courier_identifier
                )

                delivery["courierId"] = (
                    courier_identifier
                )

        result.append(delivery)

    return result


# ============================================================
# CRIAR ENTREGA
# ============================================================

@api_router.post("/deliveries")
def create_delivery(
    data: dict = None
):

    global deliveries_db

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Dados da entrega inválidos"
        )

    delivery_id = data.get(
        "id",
        str(uuid.uuid4())[:8]
    )

    price = data.get(
        "price",
        0.0
    )

    new_delivery = {

        "id": delivery_id,

        "code": data.get(
            "code",
            f"COR-{str(uuid.uuid4())[:4]}"
        ),

        "status": normalize_status(
            data.get(
                "status",
                "pending"
            )
        ),

        "store": data.get(
            "store",
            "Loja Parceira"
        ),

        "store_name": data.get(
            "store_name",
            data.get(
                "store",
                "Loja Parceira"
            )
        ),

        "storename": data.get(
            "storename",
            data.get(
                "store_name",
                data.get(
                    "store",
                    "Loja Parceira"
                )
            )
        ),

        "store_email": data.get(
            "store_email",
            "loja@giroexpress.com"
        ),

        "client": data.get(
            "client",
            "Cliente Exemplo"
        ),

        "pickup": data.get(
            "pickup",
            "Endereço da Loja"
        ),

        "delivery": data.get(
            "delivery",
            "Endereço de Entrega"
        ),

        "price": price,

        "gross_price": data.get(
            "gross_price",
            price
        ),

        "items": data.get(
            "items",
            "Pedido"
        ),

        "courier_id": data.get(
            "courier_id",
            data.get(
                "courierId",
                data.get(
                    "courierid"
                )
            )
        ),

        "courierid": data.get(
            "courierid",
            data.get(
                "courierId",
                data.get(
                    "courier_id"
                )
            )
        ),

        "courierId": data.get(
            "courierId",
            data.get(
                "courier_id",
                data.get(
                    "courierid"
                )
            )
        )
    }

    # Permite campos extras enviados pelo frontend
    new_delivery.update(data)

    # Reaplica status normalizado
    new_delivery["status"] = normalize_status(
        new_delivery.get("status")
    )

    # Reaplica aliases
    courier_identifier = get_courier_id(
        new_delivery
    )

    set_courier_fields(
        new_delivery,
        courier_identifier
    )

    deliveries_db.append(
        new_delivery
    )

    save_deliveries(
        deliveries_db
    )

    return {
        "message": "Entrega criada com sucesso",
        "delivery": new_delivery
    }


# ============================================================
# ACEITAR CORRIDA
# ============================================================

@api_router.post(
    "/deliveries/{delivery_id}/accept"
)
def accept_delivery(
    delivery_id: str,
    payload: dict = None
):

    global deliveries_db

    courier_identifier = (
        DEFAULT_TEST_COURIER_EMAIL
    )

    if payload and isinstance(
        payload,
        dict
    ):

        courier_identifier = (

            payload.get("courier_id")

            or payload.get("courierId")

            or payload.get("courierid")

            or DEFAULT_TEST_COURIER_EMAIL
        )

    courier_identifier = str(
        courier_identifier
    )

    for item in deliveries_db:

        if (
            str(item.get("id"))
            == str(delivery_id)

            or

            str(item.get("code"))
            == str(delivery_id)
        ):

            # ------------------------------------------------
            # ALTERA PARA CORRIDA EM ANDAMENTO
            # ------------------------------------------------

            item["status"] = "in_progress"

            # ------------------------------------------------
            # ATRIBUI O MOTOBOY
            # ------------------------------------------------

            set_courier_fields(
                item,
                courier_identifier
            )

            # ------------------------------------------------
            # SALVA
            # ------------------------------------------------

            save_deliveries(
                deliveries_db
            )

            return {

                "message":
                    "Corrida aceita com sucesso",

                "delivery":
                    format_delivery(item)
            }

    raise HTTPException(
        status_code=404,
        detail="Entrega não encontrada"
    )


# ============================================================
# FINALIZAR ENTREGA - PUT
# ============================================================

@api_router.put(
    "/deliveries/{delivery_id}/finish"
)
def finish_delivery(
    delivery_id: str,
    data: dict = None
):

    global deliveries_db

    for item in deliveries_db:

        if (
            str(item.get("id"))
            == str(delivery_id)

            or

            str(item.get("code"))
            == str(delivery_id)
        ):

            item["status"] = "completed"

            save_deliveries(
                deliveries_db
            )

            return {

                "message":
                    "Entrega finalizada com sucesso",

                "delivery":
                    format_delivery(item)
            }

    raise HTTPException(
        status_code=404,
        detail="Entrega não encontrada"
    )


# ============================================================
# FINALIZAR ENTREGA - POST
# ============================================================

@api_router.post(
    "/deliveries/{delivery_id}/complete"
)
def complete_delivery(
    delivery_id: str,
    data: dict = None
):

    global deliveries_db

    for item in deliveries_db:

        if (
            str(item.get("id"))
            == str(delivery_id)

            or

            str(item.get("code"))
            == str(delivery_id)
        ):

            item["status"] = "completed"

            save_deliveries(
                deliveries_db
            )

            return {

                "message":
                    "Entrega finalizada com sucesso",

                "delivery":
                    format_delivery(item)
            }

    raise HTTPException(
        status_code=404,
        detail="Entrega não encontrada"
    )


# ============================================================
# MENSAGENS
# ============================================================

@api_router.get(
    "/deliveries/{delivery_id}/messages"
)
def get_messages(
    delivery_id: str
):

    return []


@api_router.post(
    "/deliveries/{delivery_id}/messages"
)
def send_message(
    delivery_id: str,
    data: dict = None
):

    return {
        "message":
            "Mensagem enviada com sucesso",

        "data":
            data
    }


# ============================================================
# CHAT
# ============================================================

chat_messages_db = {}


@api_router.get(
    "/deliveries/{delivery_id}/chat"
)
def get_chat_messages(
    delivery_id: str
):

    return chat_messages_db.get(
        str(delivery_id),
        []
    )


@api_router.post(
    "/deliveries/{delivery_id}/chat"
)
def send_chat_message(
    delivery_id: str,
    data: dict = None
):

    did = str(delivery_id)

    if did not in chat_messages_db:

        chat_messages_db[did] = []

    if not data:

        data = {}

    msg_text = (
        data.get("message")
        or data.get("text")
        or "Mensagem"
    )

    new_msg = {

        "id":
            str(
                len(
                    chat_messages_db[did]
                ) + 1
            ),

        "sender":
            data.get(
                "sender",
                "loja"
            ),

        "text":
            msg_text,

        "time":
            "Agora"
    }

    chat_messages_db[did].append(
        new_msg
    )

    return {

        "message":
            "Mensagem enviada com sucesso",

        "data":
            new_msg
    }


# ============================================================
# PRODUTOS
# ============================================================

@api_router.get("/products")
def get_products():

    return products_db


@api_router.post("/products")
def create_product(
    data: dict = None
):

    global products_db

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Dados do produto inválidos"
        )

    new_product = {

        "id":
            data.get(
                "id",
                str(uuid.uuid4())[:8]
            ),

        "name":
            data.get(
                "name",
                "Produto Novo"
            ),

        "price":
            data.get(
                "price",
                0.0
            )
    }

    new_product.update(data)

    products_db.append(
        new_product
    )

    save_products(
        products_db
    )

    return {

        "message":
            "Produto cadastrado com sucesso",

        "product":
            new_product
    }


# ============================================================
# STATUS ONLINE DO MOTOBOY
# ============================================================

class OnlineStatus(BaseModel):

    online: bool


@api_router.post(
    "/couriers/me/online"
)
def update_courier_online_status(
    status: OnlineStatus
):

    return {

        "success": True,

        "online":
            status.online
    }


# ============================================================
# LOGIN
# ============================================================

@api_router.post("/auth/login")
def login(
    data: dict = None
):

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Dados de login inválidos"
        )

    email = str(
        data.get(
            "email",
            ""
        )
    ).lower().strip()

    if not email:

        raise HTTPException(
            status_code=400,
            detail="Email obrigatório"
        )

    # --------------------------------------------------------
    # DETERMINA ROLE
    # --------------------------------------------------------

    admin_emails = [
        "jonatasprudencio66@gmail.com"
    ]

    if email in admin_emails:

        role = "admin"

    elif (
        "loja" in email
        or "store" in email
        or email == "loja@giroexpress.com"
    ):

        role = "store"

    else:

        role = "deliveryman"

    # --------------------------------------------------------
    # PROCURA USUÁRIO
    # --------------------------------------------------------

    user_record = next(
        (
            user
            for user in users_db
            if user["email"].lower() == email
        ),
        None
    )

    # --------------------------------------------------------
    # CRIA USUÁRIO SE NÃO EXISTIR
    # --------------------------------------------------------

    if not user_record:

        user_record = {

            "name":
                (
                    "Loja Parceira"
                    if role == "store"
                    else "Usuário Teste"
                ),

            "email":
                email,

            "role":
                role,

            "status":
                "active",

            "approved":
                True,

            "is_approved":
                True
        }

        users_db.append(
            user_record
        )

    else:

        user_record["role"] = role
        user_record["status"] = "active"
        user_record["approved"] = True
        user_record["is_approved"] = True

    save_users(
        users_db
    )

    # --------------------------------------------------------
    # TOKEN
    # --------------------------------------------------------

    access_token = (
        f"token_{role}_{email}"
    )

    return {

        "access_token":
            access_token,

        "token_type":
            "bearer",

        "role":
            role,

        "user": {

            "name":
                user_record.get(
                    "name",
                    "Usuário"
                ),

            "email":
                email,

            "role":
                role,

            "status":
                "active",

            "approved":
                True,

            "is_approved":
                True
        }
    }


# ============================================================
# REGISTRO
# ============================================================

@api_router.post("/auth/register")
def register(
    data: dict = None
):

    global users_db

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Dados inválidos"
        )

    email = str(
        data.get(
            "email",
            ""
        )
    ).lower().strip()

    role = data.get(
        "role",
        "deliveryman"
    )

    name = data.get(
        "name",
        "Novo Usuário"
    )

    if not email:

        raise HTTPException(
            status_code=400,
            detail="Email obrigatório"
        )

    existing = next(
        (
            user
            for user in users_db
            if user["email"].lower() == email
        ),
        None
    )

    if existing:

        return {

            "message":
                "Usuário já cadastrado",

            "user":
                existing
        }

    new_user = {

        "name":
            name,

        "email":
            email,

        "role":
            role,

        "status":
            "active",

        "approved":
            True,

        "is_approved":
            True
    }

    users_db.append(
        new_user
    )

    save_users(
        users_db
    )

    return {

        "message":
            "Cadastro realizado com sucesso",

        "user":
            new_user
    }


# ============================================================
# USUÁRIO LOGADO
# ============================================================

@api_router.get("/auth/me")
def get_me(
    authorization: str = Header(None)
):

    # --------------------------------------------------------
    # USUÁRIO PADRÃO
    # --------------------------------------------------------

    email = DEFAULT_TEST_COURIER_EMAIL

    # --------------------------------------------------------
    # LÊ TOKEN
    # --------------------------------------------------------

    if authorization:

        token_str = (
            authorization
            .replace(
                "Bearer ",
                ""
            )
            .strip()
        )

        # Token:
        #
        # token_deliveryman_teste1@gmail.com
        #
        # split("_", 2) é importante porque o email
        # pode possuir "_" .
        #

        if token_str.startswith(
            "token_"
        ):

            parts = token_str.split(
                "_",
                2
            )

            if len(parts) == 3:

                email = (
                    parts[2]
                    .strip()
                    .lower()
                )

    # --------------------------------------------------------
    # PROCURA USUÁRIO
    # --------------------------------------------------------

    user_record = next(
        (
            user
            for user in users_db
            if user["email"].lower()
            == email.lower()
        ),
        None
    )

    # --------------------------------------------------------
    # SE EXISTIR
    # --------------------------------------------------------

    if user_record:

        role = user_record.get(
            "role",
            "deliveryman"
        )

        name = user_record.get(
            "name",
            "Usuário"
        )

    # --------------------------------------------------------
    # SE NÃO EXISTIR
    # --------------------------------------------------------

    else:

        role = (
            "store"

            if (
                "loja" in email.lower()
                or
                "store" in email.lower()
            )

            else "deliveryman"
        )

        name = "Usuário"

    # --------------------------------------------------------
    # RESPOSTA
    # --------------------------------------------------------

    return {

        "user": {

            "name":
                name,

            "email":
                email,

            "role":
                role,

            "status":
                "active",

            "approved":
                True,

            "is_approved":
                True
        }
    }


# ============================================================
# LOGOUT
# ============================================================

@api_router.post("/auth/logout")
def logout():

    return {

        "message":
            "Logout realizado com sucesso"
    }


# ============================================================
# INCLUI API ROUTER
# ============================================================

# IMPORTANTE:
# Existe apenas UMA inclusão do router.
app.include_router(
    api_router,
    prefix="/api"
)


# ============================================================
# FRONTEND FALLBACK
# ============================================================

if os.path.exists(BUILD_DIR):

    @app.get("/{full_path:path}")
    async def serve_frontend(
        full_path: str
    ):

        # Nunca deixa o fallback capturar a API
        if full_path.startswith("api"):

            raise HTTPException(
                status_code=404,
                detail="Not Found"
            )

        target_path = os.path.join(
            BUILD_DIR,
            full_path
        )

        if (
            os.path.exists(target_path)
            and
            os.path.isfile(target_path)
        ):

            return FileResponse(
                target_path
            )

        return FileResponse(
            os.path.join(
                BUILD_DIR,
                "index.html"
            )
        )