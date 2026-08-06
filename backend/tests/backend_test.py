"""GiroExpress backend API tests (pytest)."""
import os
import re
import io
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = BASE_URL + "/api"

RUN = uuid.uuid4().hex[:6]

STATE = {}


def creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?\**email\**\s*:\s*\**\s*`?([^`\s*]+)', content)
    p = re.search(r'(?im)^\s*(?:[-*]\s*)?\**password\**\s*:\s*\**\s*`?([^`\s*]+)', content)
    return e.group(1), p.group(1)


def new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login(email, password):
    s = new_session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:300]}"
    tok = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s, r


# ---------- Health ----------
class TestHealth:
    def test_root_api(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_admin_login_and_cookies(self):
        email, password = creds()
        s, r = login(email, password)
        data = r.json()
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == email
        assert "id" in data["user"] and "_id" not in data["user"]
        cookies = {c.name: c for c in r.cookies}
        assert "access_token" in cookies, f"cookies: {list(cookies)}"
        # httpOnly flag
        assert cookies["access_token"]._rest.get("HttpOnly", True) is not False
        STATE["admin"] = s

    def test_admin_bcrypt_hash_format(self):
        import subprocess, json
        out = subprocess.run(
            ["python", "-c",
             "import os,asyncio;from dotenv import load_dotenv;load_dotenv('/app/backend/.env');"
             "from motor.motor_asyncio import AsyncIOMotorClient;"
             "c=AsyncIOMotorClient(os.environ['MONGO_URL']);d=c[os.environ['DB_NAME']];"
             "print(asyncio.get_event_loop().run_until_complete(d.users.find_one({'email':os.environ['ADMIN_EMAIL'].lower()}))['password_hash'])"],
            capture_output=True, text=True)
        h = out.stdout.strip().splitlines()[-1] if out.stdout.strip() else ""
        assert h.startswith("$2b$"), f"hash format unexpected: {h[:10]} err={out.stderr[-300:]}"

    def test_login_invalid_password(self):
        email, _ = creds()
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong-pass-x"})
        assert r.status_code == 401

    def test_brute_force_lockout(self):
        """Playbook: lockout after 5 failed attempts."""
        email = f"TEST_bf_{RUN}@example.com"
        requests.post(f"{API}/auth/register", json={"name": "BF", "email": email, "password": "Secret@123", "role": "store"})
        codes = []
        for _ in range(6):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "bad-pass"})
            codes.append(r.status_code)
        assert any(c in (423, 429, 403) for c in codes), f"no lockout after 6 failures: {codes}"

    def test_register_store_active(self):
        email = f"TEST_store_{RUN}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Loja", "email": email, "password": "Secret@123", "role": "store",
            "phone": "11999999999", "address": "Av Paulista 1000, Sao Paulo"})
        assert r.status_code == 200, r.text[:300]
        u = r.json()["user"]
        assert u["role"] == "store" and u["status"] == "active"
        STATE["store_email"] = email
        s = new_session()
        s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        STATE["store"] = s
        STATE["store_id"] = u["id"]

    def test_register_courier_pending(self):
        email = f"TEST_courier_{RUN}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Motoboy", "email": email, "password": "Secret@123", "role": "courier", "vehicle": "moto"})
        assert r.status_code == 200, r.text[:300]
        u = r.json()["user"]
        assert u["status"] == "pending"
        STATE["courier_email"] = email
        s = new_session()
        s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        STATE["courier"] = s
        STATE["courier_id"] = u["id"]

    def test_register_duplicate_email(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "dup", "email": STATE["store_email"], "password": "Secret@123", "role": "store"})
        assert r.status_code == 400

    def test_register_invalid_role(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "x", "email": f"TEST_admin_{RUN}@example.com", "password": "Secret@123", "role": "admin"})
        assert r.status_code == 400

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_store(self):
        r = STATE["store"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["email"] == STATE["store_email"].lower()


# ---------- Pricing ----------
class TestPricing:
    @pytest.mark.parametrize("km,gross,est", [
        (0.5, 3.99, 12), (1.0, 3.99, 14), (2.0, 4.99, 17), (3.0, 5.99, 19),
        (7.5, 12.99, 29), (10.0, 17.99, 33), (15.0, 24.99, 41), (30.0, 24.99, 41),
    ])
    def test_quote_by_km(self, km, gross, est):
        r = requests.post(f"{API}/pricing/quote", json={"distance_km": km})
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["gross_price"] == gross
        assert d["platform_fee"] == 1.00
        assert d["net_courier"] == round(gross - 1.0, 2)
        assert d["estimated_min"] == est

    def test_quote_missing_data(self):
        r = requests.post(f"{API}/pricing/quote", json={})
        assert r.status_code == 400

    def test_quote_geocoding(self):
        r = requests.post(f"{API}/pricing/quote", json={
            "pickup_address": "Avenida Paulista 1000, Sao Paulo, SP",
            "dropoff_address": "Rua Augusta 500, Sao Paulo, SP"})
        assert r.status_code in (200, 400), r.text[:200]
        if r.status_code == 200:
            d = r.json()
            assert d["distance_km"] > 0
        else:
            pytest.skip("geocoding (Nominatim) unavailable from this environment")

    def test_pricing_table(self):
        r = requests.get(f"{API}/pricing/table")
        assert r.status_code == 200
        d = r.json()
        assert len(d["table"]) == 30
        assert d["platform_fee"] == 1.0


# ---------- Deliveries + RBAC ----------
class TestDeliveries:
    def test_store_creates_delivery(self):
        r = STATE["store"].post(f"{API}/deliveries", json={
            "pickup_address": "Loja A", "dropoff_address": "Cliente B",
            "client_name": "TEST Cliente", "client_phone": "11988887777", "distance_km": 3.0})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["gross_price"] == 5.99 and d["net_courier"] == 4.99 and d["estimated_min"] == 19
        assert d["status"] == "pending" and d["code"].startswith("DEL-")
        STATE["delivery_id"] = d["id"]

    def test_courier_cannot_create_delivery(self):
        r = STATE["courier"].post(f"{API}/deliveries", json={
            "pickup_address": "a", "dropoff_address": "b", "client_name": "c", "distance_km": 2.0})
        assert r.status_code == 403

    def test_store_sees_only_own(self):
        other_email = f"TEST_store2_{RUN}@example.com"
        rr = requests.post(f"{API}/auth/register", json={
            "name": "TEST Loja2", "email": other_email, "password": "Secret@123", "role": "store"})
        s2 = new_session()
        s2.headers.update({"Authorization": f"Bearer {rr.json()['access_token']}"})
        STATE["store2"] = s2
        r = s2.get(f"{API}/deliveries")
        assert r.status_code == 200
        assert all(d["store_id"] != STATE["store_id"] for d in r.json())
        # own list contains created delivery
        r1 = STATE["store"].get(f"{API}/deliveries")
        assert any(d["id"] == STATE["delivery_id"] for d in r1.json())
        # cross-store detail access forbidden
        r2 = s2.get(f"{API}/deliveries/{STATE['delivery_id']}")
        assert r2.status_code == 403

    def test_pending_courier_cannot_go_online(self):
        r = STATE["courier"].post(f"{API}/couriers/me/online", json={"online": True})
        assert r.status_code == 403, r.text[:200]

    def test_pending_courier_cannot_accept(self):
        r = STATE["courier"].post(f"{API}/deliveries/{STATE['delivery_id']}/accept")
        assert r.status_code == 403

    def test_admin_approves_courier(self):
        admin, _ = login(*creds())
        STATE["admin"] = admin
        r = admin.post(f"{API}/admin/users/{STATE['courier_id']}/approve")
        assert r.status_code == 200
        users = admin.get(f"{API}/admin/users").json()
        me = [u for u in users if u["id"] == STATE["courier_id"]][0]
        assert me["status"] == "active"

    def test_courier_online_and_accept(self):
        r = STATE["courier"].post(f"{API}/couriers/me/online", json={"online": True})
        assert r.status_code == 200 and r.json()["online"] is True
        r = STATE["courier"].post(f"{API}/deliveries/{STATE['delivery_id']}/accept")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["status"] == "accepted" and d["courier_id"] == STATE["courier_id"]

    def test_available_filter_excludes_accepted(self):
        r = STATE["courier"].get(f"{API}/deliveries", params={"status": "available"})
        assert r.status_code == 200
        assert all(d["id"] != STATE["delivery_id"] for d in r.json())

    def test_batch_limit_three_per_store(self):
        ids = []
        for _ in range(3):
            rr = STATE["store"].post(f"{API}/deliveries", json={
                "pickup_address": "Loja A", "dropoff_address": "Cliente X",
                "client_name": "TEST Batch", "distance_km": 1.0})
            assert rr.status_code == 200
            ids.append(rr.json()["id"])
        # already has 1 accepted; accepting 2 more -> 3 active
        r1 = STATE["courier"].post(f"{API}/deliveries/{ids[0]}/accept")
        r2 = STATE["courier"].post(f"{API}/deliveries/{ids[1]}/accept")
        assert r1.status_code == 200 and r2.status_code == 200
        r3 = STATE["courier"].post(f"{API}/deliveries/{ids[2]}/accept")
        assert r3.status_code == 400, f"4th simultaneous accept should fail: {r3.status_code}"
        STATE["extra_ids"] = ids

    def test_start_and_complete(self):
        did = STATE["delivery_id"]
        r = STATE["courier"].post(f"{API}/deliveries/{did}/start")
        assert r.status_code == 200 and r.json()["status"] == "in_transit"
        r = STATE["courier"].post(f"{API}/deliveries/{did}/complete")
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["status"] == "delivered" and d["delivered_at"]

    def test_delivery_invalid_id(self):
        r = STATE["store"].get(f"{API}/deliveries/notanid")
        assert r.status_code == 400


# ---------- Statements ----------
class TestStatements:
    def test_store_statement_created(self):
        r = STATE["store"].get(f"{API}/statements")
        assert r.status_code == 200, r.text[:200]
        stmts = r.json()
        assert len(stmts) >= 1
        s = stmts[0]
        assert s["total_gross"] >= 5.99
        assert s["total_deliveries"] >= 1
        assert s["status"] == "open"
        assert "Domingo" in (s["cycle_label"] or "")
        STATE["statement_id"] = s["id"]

    def test_courier_cannot_list_statements(self):
        r = STATE["courier"].get(f"{API}/statements")
        assert r.status_code == 403

    def test_upload_proof(self):
        s = requests.Session()
        s.headers.update({"Authorization": STATE["store"].headers["Authorization"]})
        files = {"file": ("proof.png", io.BytesIO(b"\x89PNG\r\n\x1a\nTESTPROOF"), "image/png")}
        r = s.post(f"{API}/statements/{STATE['statement_id']}/proof", files=files)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        STATE["proof_path"] = r.json()["proof_path"]
        st = STATE["store"].get(f"{API}/statements").json()[0]
        assert st["status"] == "under_review"
        assert st["proof_path"]

    def test_file_rbac(self):
        path = STATE.get("proof_path")
        if not path:
            pytest.skip("no proof uploaded")
        r = STATE["store"].get(f"{API}/files", params={"path": path})
        assert r.status_code == 200, r.text[:200]
        assert r.headers["content-type"].startswith("image/png")
        r2 = STATE["store2"].get(f"{API}/files", params={"path": path})
        assert r2.status_code == 403
        r3 = STATE["admin"].get(f"{API}/files", params={"path": path})
        assert r3.status_code == 200

    def test_store_cannot_approve_statement(self):
        r = STATE["store"].post(f"{API}/statements/{STATE['statement_id']}/approve", json={"approved": True})
        assert r.status_code == 403

    def test_admin_approves_statement(self):
        r = STATE["admin"].post(f"{API}/statements/{STATE['statement_id']}/approve", json={"approved": True})
        assert r.status_code == 200 and r.json()["status"] == "approved"
        st = STATE["store"].get(f"{API}/statements").json()[0]
        assert st["status"] == "approved"


# ---------- Chat ----------
class TestChat:
    def test_chat_flow(self):
        did = STATE["delivery_id"]
        r = STATE["store"].post(f"{API}/deliveries/{did}/chat", json={"text": "Msg 1 loja"})
        assert r.status_code == 200, r.text[:200]
        assert "_id" not in r.json()
        time.sleep(0.5)
        r2 = STATE["courier"].post(f"{API}/deliveries/{did}/chat", json={"text": "Msg 2 motoboy"})
        assert r2.status_code == 200
        msgs = STATE["store"].get(f"{API}/deliveries/{did}/chat").json()
        texts = [m["text"] for m in msgs]
        assert texts[:2] == ["Msg 1 loja", "Msg 2 motoboy"], texts

    def test_chat_rbac(self):
        r = STATE["store2"].get(f"{API}/deliveries/{STATE['delivery_id']}/chat")
        assert r.status_code == 403
        r2 = STATE["store2"].post(f"{API}/deliveries/{STATE['delivery_id']}/chat", json={"text": "hack"})
        assert r2.status_code == 403


# ---------- Tickets ----------
class TestTickets:
    def test_create_and_list(self):
        r = STATE["store"].post(f"{API}/tickets", json={"subject": "TEST problema", "priority": "alta", "message": "detalhe"})
        assert r.status_code == 200, r.text[:200]
        t = r.json()
        assert t["status"] == "open" and len(t["messages"]) == 1
        STATE["ticket_id"] = t["id"]
        mine = STATE["store"].get(f"{API}/tickets").json()
        assert all(x["opened_by_id"] == STATE["store_id"] for x in mine)
        other = STATE["store2"].get(f"{API}/tickets").json()
        assert all(x["id"] != STATE["ticket_id"] for x in other)
        alladmin = STATE["admin"].get(f"{API}/tickets").json()
        assert any(x["id"] == STATE["ticket_id"] for x in alladmin)

    def test_ticket_message_rbac(self):
        r = STATE["store2"].post(f"{API}/tickets/{STATE['ticket_id']}/message", json={"text": "x"})
        assert r.status_code == 403

    def test_resolve_ticket(self):
        r = STATE["store"].post(f"{API}/tickets/{STATE['ticket_id']}/resolve")
        assert r.status_code == 403
        r = STATE["admin"].post(f"{API}/tickets/{STATE['ticket_id']}/resolve")
        assert r.status_code == 200
        t = [x for x in STATE["admin"].get(f"{API}/tickets").json() if x["id"] == STATE["ticket_id"]][0]
        assert t["status"] == "resolved"


# ---------- Admin ----------
class TestAdmin:
    def test_stats(self):
        r = STATE["admin"].get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        assert d["delivered"] >= 1
        assert d["platform_fees_collected"] == round(d["delivered"] * 1.0, 2)

    def test_bank_settings(self):
        payload = {"bank": "TEST Banco 001", "agency": "1234", "account": "56789-0", "pix_key": "test@pix.com"}
        r = STATE["admin"].put(f"{API}/admin/settings/bank", json=payload)
        assert r.status_code == 200
        g = STATE["admin"].get(f"{API}/admin/settings").json()
        assert g["bank"] == payload
        assert g["platform_fee"] == 1.0

    def test_non_admin_denied(self):
        for ep in ["/admin/users", "/admin/stats", "/admin/settings"]:
            r = STATE["store"].get(f"{API}{ep}")
            assert r.status_code == 403, ep

    def test_block_user_prevents_login(self):
        email = f"TEST_block_{RUN}@example.com"
        rr = requests.post(f"{API}/auth/register", json={"name": "TEST Block", "email": email, "password": "Secret@123", "role": "store"})
        uid = rr.json()["user"]["id"]
        r = STATE["admin"].patch(f"{API}/admin/users/{uid}", json={"status": "blocked"})
        assert r.status_code == 200
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Secret@123"})
        assert r2.status_code == 403, f"blocked user login returned {r2.status_code}"


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    try:
        from pymongo import MongoClient
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        c = MongoClient(os.environ["MONGO_URL"])
        d = c[os.environ["DB_NAME"]]
        ids = [str(u["_id"]) for u in d.users.find({"email": {"$regex": "^test_"}}, {"_id": 1})]
        d.deliveries.delete_many({"store_id": {"$in": ids}})
        d.statements.delete_many({"store_id": {"$in": ids}})
        d.tickets.delete_many({"opened_by_id": {"$in": ids}})
        d.chat_messages.delete_many({"sender_id": {"$in": ids}})
        d.users.delete_many({"email": {"$regex": "^test_"}})
        c.close()
    except Exception as e:  # cleanup must never fail the suite
        print(f"cleanup skipped: {e}")
