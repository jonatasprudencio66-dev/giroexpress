"""GiroExpress iteration-3 backend tests: password reset (demo), system status, operations schedule."""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")
API = BASE_URL + "/api"

RUN = uuid.uuid4().hex[:6]
DEFAULT_OPS = {"enabled": True, "disabled_weekdays": [], "open_time": "00:00", "close_time": "23:59", "holidays": []}


def creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?\**email\**\s*:\s*\**\s*`?([^`\s*]+)', content)
    p = re.search(r'(?im)^\s*(?:[-*]\s*)?\**password\**\s*:\s*\**\s*`?([^`\s*]+)', content)
    if not e or not p:
        pytest.skip("credentials missing in /app/memory/test_credentials.md")
    return e.group(1), p.group(1)


def new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login(email, password):
    s = new_session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.fail(f"login failed for {email}: {r.status_code} {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def admin():
    e, p = creds()
    return login(e, p)


@pytest.fixture(scope="module")
def store():
    email = f"TEST_ops_store_{RUN}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "TEST Ops Store", "email": email, "password": "Secret@123", "role": "store",
        "phone": "11999990000", "address": "Av Paulista 1000, Sao Paulo"})
    assert r.status_code in (200, 201), r.text
    return login(email, "Secret@123")


@pytest.fixture(scope="module", autouse=True)
def reset_ops_after(admin):
    yield
    r = admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)
    print(f"ops reset -> {r.status_code} {r.text[:200]}")


# ---------- Forgot / reset password (demo mode) ----------
class TestPasswordReset:
    def test_forgot_password_existing_user_returns_demo_link(self):
        email, _ = creds()
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "demo_reset_link" in d, d
        assert "/reset-password?token=" in d["demo_reset_link"]
        token = d["demo_reset_link"].split("token=")[1]
        assert len(token) > 20

    def test_forgot_password_unknown_email_no_link(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"TEST_nobody_{RUN}@example.com"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d == {"ok": True}, f"leaks existence: {d}"

    def test_forgot_password_case_insensitive(self):
        email, _ = creds()
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email.upper()})
        assert r.status_code == 200
        assert "demo_reset_link" in r.json(), "uppercase email should still resolve the user"

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "not-a-real-token", "password": "Secret@999"})
        assert r.status_code == 400, r.text
        assert "inválido" in r.json().get("detail", "").lower()

    def test_reset_password_short_password_rejected(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "x" * 10, "password": "123"})
        assert r.status_code == 422, f"expected validation error, got {r.status_code} {r.text[:200]}"

    def test_reset_flow_changes_password_and_token_single_use(self):
        email = f"TEST_reset_{RUN}@example.com"
        rr = requests.post(f"{API}/auth/register", json={
            "name": "TEST Reset", "email": email, "password": "Secret@123", "role": "store"})
        assert rr.status_code in (200, 201), rr.text

        fr = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert fr.status_code == 200
        token = fr.json()["demo_reset_link"].split("token=")[1]

        newpw = "NewSecret@456"
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": newpw})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # old password no longer works
        old = requests.post(f"{API}/auth/login", json={"email": email, "password": "Secret@123"})
        assert old.status_code == 401, f"old password still valid ({old.status_code})"
        # new password works
        s = login(email, newpw)
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email

        # token reuse blocked
        again = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "Another@789"})
        assert again.status_code == 400, again.text
        assert "utilizado" in again.json().get("detail", "").lower()


# ---------- Public system status ----------
class TestSystemStatus:
    def test_status_public_no_auth(self):
        r = requests.get(f"{API}/system/status")
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(["open", "reason", "ops"]).issubset(d.keys()), d
        assert isinstance(d["open"], bool)
        ops = d["ops"]
        for k in ("enabled", "disabled_weekdays", "open_time", "close_time", "holidays"):
            assert k in ops, f"missing ops.{k}"


# ---------- Admin operations settings ----------
class TestOperationsSettings:
    def test_ops_requires_auth(self):
        r = requests.get(f"{API}/admin/settings/operations")
        assert r.status_code in (401, 403), r.status_code
        r2 = requests.put(f"{API}/admin/settings/operations", json={"enabled": True})
        assert r2.status_code in (401, 403), r2.status_code

    def test_ops_forbidden_for_store(self, store):
        r = store.get(f"{API}/admin/settings/operations")
        assert r.status_code == 403, r.status_code
        r2 = store.put(f"{API}/admin/settings/operations", json={"enabled": False})
        assert r2.status_code == 403, r2.status_code

    def test_ops_put_persists_and_merges(self, admin):
        payload = {"disabled_weekdays": [5], "open_time": "08:00", "close_time": "22:00", "holidays": ["2026-12-25"]}
        r = admin.put(f"{API}/admin/settings/operations", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["disabled_weekdays"] == [5]
        assert d["open_time"] == "08:00"
        assert d["close_time"] == "22:00"
        assert d["holidays"] == ["2026-12-25"]
        assert d["enabled"] is True  # merged from current

        g = admin.get(f"{API}/admin/settings/operations")
        assert g.status_code == 200
        assert g.json() == d, "GET does not match PUT result (not persisted)"

        pub = requests.get(f"{API}/system/status").json()
        assert pub["ops"]["open_time"] == "08:00"

        # partial update keeps other fields
        r2 = admin.put(f"{API}/admin/settings/operations", json={"open_time": "09:00"})
        assert r2.status_code == 200
        assert r2.json()["open_time"] == "09:00"
        assert r2.json()["disabled_weekdays"] == [5], "partial PUT lost disabled_weekdays"

        admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)

    def test_ops_invalid_time_rejected(self, admin):
        r = admin.put(f"{API}/admin/settings/operations", json={"open_time": "bad"})
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:200]}"
        r2 = admin.put(f"{API}/admin/settings/operations", json={"close_time": "nope"})
        assert r2.status_code == 400, r2.status_code

    def test_ops_out_of_range_time_rejected(self, admin):
        """HH:MM must be a real clock time."""
        r = admin.put(f"{API}/admin/settings/operations", json={"open_time": "99:99"})
        assert r.status_code == 400, f"'99:99' accepted (status {r.status_code}) — invalid clock time"
        admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)

    def test_ops_invalid_weekday_and_holiday_sanitized(self, admin):
        r = admin.put(f"{API}/admin/settings/operations", json={"disabled_weekdays": [5, 9, -1, 5], "holidays": ["2026-13-45", "2026-01-02"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["disabled_weekdays"] == [5], d["disabled_weekdays"]
        assert d["holidays"] == ["2026-01-02"], d["holidays"]
        admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)


# ---------- Store blocked when system closed ----------
class TestClosedBlocksDelivery:
    payload = {
        "pickup_address": "Av Paulista 1000, Sao Paulo",
        "dropoff_address": "Rua Augusta 500, Sao Paulo",
        "client_name": "TEST Client",
        "client_phone": "11988887777",
        "distance_km": 3.0,
    }

    def test_disabled_platform_blocks_delivery(self, admin, store):
        try:
            r = admin.put(f"{API}/admin/settings/operations", json={"enabled": False})
            assert r.status_code == 200, r.text
            assert r.json()["enabled"] is False

            st = requests.get(f"{API}/system/status").json()
            assert st["open"] is False
            assert "desativada" in (st["reason"] or "").lower()

            cr = store.post(f"{API}/deliveries", json=self.payload)
            assert cr.status_code == 400, f"delivery created while platform disabled ({cr.status_code})"
            assert "desativada" in cr.json().get("detail", "").lower(), cr.text
        finally:
            admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)

        st = requests.get(f"{API}/system/status").json()
        assert st["open"] is True, st
        ok = store.post(f"{API}/deliveries", json=self.payload)
        assert ok.status_code in (200, 201), f"delivery blocked after reopening: {ok.status_code} {ok.text[:300]}"
        assert ok.json().get("code", "").startswith("DEL-")

    def test_closed_by_time_window_blocks_delivery(self, admin, store):
        try:
            r = admin.put(f"{API}/admin/settings/operations", json={"enabled": True, "open_time": "00:00", "close_time": "00:01"})
            assert r.status_code == 200, r.text
            st = requests.get(f"{API}/system/status").json()
            # depends on BR local time; skip only if we happen to be inside the window
            if st["open"]:
                pytest.skip("current BR local time is inside 00:00-00:01 window")
            assert "horário" in (st["reason"] or "").lower()
            cr = store.post(f"{API}/deliveries", json=self.payload)
            assert cr.status_code == 400, f"delivery created outside business hours ({cr.status_code})"
        finally:
            admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)

    def test_holiday_today_blocks_delivery(self, admin, store):
        from datetime import datetime, timezone, timedelta
        today_br = (datetime.now(timezone.utc) - timedelta(hours=3)).strftime("%Y-%m-%d")
        try:
            r = admin.put(f"{API}/admin/settings/operations", json={"holidays": [today_br]})
            assert r.status_code == 200, r.text
            st = requests.get(f"{API}/system/status").json()
            assert st["open"] is False, st
            assert "feriado" in (st["reason"] or "").lower()
            cr = store.post(f"{API}/deliveries", json=self.payload)
            assert cr.status_code == 400, f"delivery created on holiday ({cr.status_code})"
        finally:
            admin.put(f"{API}/admin/settings/operations", json=DEFAULT_OPS)


# ---------- Regression smoke ----------
class TestRegressionSmoke:
    def test_admin_login_and_stats(self, admin):
        r = admin.get(f"{API}/admin/stats")
        assert r.status_code == 200, r.text
        assert "total_users" in r.json()

    def test_pricing_quote_still_works(self):
        r = requests.post(f"{API}/pricing/quote", json={"distance_km": 3.0})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["gross_price"] > 0 and d["net_courier"] > 0 and d["estimated_min"] > 0

    def test_courier_flow_smoke(self, admin, store):
        email = f"TEST_ops_courier_{RUN}@example.com"
        rr = requests.post(f"{API}/auth/register", json={
            "name": "TEST Ops Courier", "email": email, "password": "Secret@123", "role": "courier",
            "phone": "11977776666", "vehicle": "moto"})
        assert rr.status_code in (200, 201), rr.text
        cid = rr.json()["user"]["id"]
        ap = admin.post(f"{API}/admin/users/{cid}/approve")
        assert ap.status_code == 200, ap.text
        c = login(email, "Secret@123")
        on = c.post(f"{API}/couriers/me/online", json={"online": True})
        assert on.status_code == 200, on.text

        dr = store.post(f"{API}/deliveries", json=TestClosedBlocksDelivery.payload)
        assert dr.status_code in (200, 201), dr.text
        did = dr.json()["id"]

        avail = c.get(f"{API}/deliveries")
        assert avail.status_code == 200
        assert any(x["id"] == did for x in avail.json()), "new delivery not visible to online courier"

        acc = c.post(f"{API}/deliveries/{did}/accept")
        assert acc.status_code == 200, acc.text
        stt = c.post(f"{API}/deliveries/{did}/start")
        assert stt.status_code == 200, stt.text
        comp = c.post(f"{API}/deliveries/{did}/complete")
        assert comp.status_code == 200, comp.text
        chk = c.get(f"{API}/deliveries/{did}")
        assert chk.json()["status"] == "delivered"


# ---------- Cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup_module():
    yield
    try:
        from pymongo import MongoClient
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        c = MongoClient(os.environ["MONGO_URL"])
        d = c[os.environ["DB_NAME"]]
        emails = list(d.users.find({"email": {"$regex": f"test_(ops|reset)_.*{RUN}", "$options": "i"}}, {"_id": 1}))
        ids = [str(u["_id"]) for u in emails]
        d.deliveries.delete_many({"store_id": {"$in": ids}})
        d.statements.delete_many({"$or": [{"store_id": {"$in": ids}}, {"courier_id": {"$in": ids}}]})
        d.password_reset_tokens.delete_many({"user_id": {"$in": ids}})
        d.users.delete_many({"_id": {"$in": [u["_id"] for u in emails]}})
        c.close()
    except Exception as e:
        print(f"cleanup skipped: {e}")
