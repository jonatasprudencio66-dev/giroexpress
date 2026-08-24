# GiroExpress - Test Credentials

## Admin (Seeded automatically at startup)
- **Email:** admin@giroexpress.com
- **Password:** Admin@2026
- **Role:** admin

## Test Store (create via UI or API)
- Register at `/register` with role=store to create a store account (auto-active).

## Test Courier (create via UI or API)
- Register at `/register` with role=courier — status starts as `pending`, must be approved by admin.

## Auth endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me

## Key API endpoints
- POST /api/deliveries (store)
- GET  /api/deliveries
- POST /api/deliveries/{id}/accept | /start | /complete | /cancel
- POST /api/pricing/quote
- GET  /api/pricing/table
- GET  /api/statements
- POST /api/statements/{id}/proof (multipart file)
- POST /api/statements/{id}/approve (admin)
- POST /api/tickets ; GET /api/tickets ; POST /api/tickets/{id}/message ; POST /api/tickets/{id}/resolve
- GET/POST /api/deliveries/{id}/chat
- POST /api/couriers/me/online
- POST /api/stores/me/allow-batch
- GET  /api/admin/users ; PATCH /api/admin/users/{id} ; POST /api/admin/users/{id}/approve
- GET/PUT /api/admin/settings ; /api/admin/settings/bank
- GET  /api/admin/stats
- GET  /api/files?path=... (auth required)
