# GiroExpress - PRD

## Original Problem Statement
Aplicativo completo de entregas sob demanda (estilo Uber para entregas / B2B2C / P2P) com 4 perfis (Loja, Motoboy, Admin, Cliente Final), precificação automática por faixa de distância, taxa de R$ 1,00 do admin por entrega, faturamento semanal (Dom→Ter), lotes de até 3 entregas, chat, chamados, histórico e RBAC estrito.

## Architecture
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + sonner (toasts)
- **Backend**: FastAPI + Motor (MongoDB async)
- **Auth**: JWT (HS256, 12h access + 7d refresh) via httpOnly cookies + Bearer fallback
- **Password hashing**: bcrypt
- **Storage**: Emergent Object Storage (comprovantes de pagamento)
- **Geocoding**: OpenStreetMap Nominatim + haversine (fallback quando sem Google Maps API Key)
- **Navegação**: Link externo para Google Maps Directions

## Personas
- **Loja (`store`)**: Cadastra-se, solicita entregas, autoriza lotes, faz upload de comprovantes.
- **Motoboy (`courier`)**: Cadastra-se (status=pending), aguarda aprovação, fica online/offline, aceita/completa corridas.
- **Admin (`admin`)**: Aprova motoboys, valida comprovantes, configura dados bancários, gerencia chamados, bloqueia/reativa usuários.

## Business Rules
- Precificação: tabela fixa 0.5–15km (R$ 3,99 a R$ 24,99); R$ 1,00 sempre descontado do bruto para o admin.
- Lotes: máx 3 entregas simultâneas da mesma loja para 1 motoboy.
- Ciclo semanal: Domingo 00:00 → Sábado 23:59, vencimento Terça-feira da semana seguinte.
- Motoboys pending não podem ficar online nem ver detalhes de corridas disponíveis.
- Lockout de brute-force: 5 tentativas → 15 min de bloqueio.

## What's implemented (Feb/2026)
- Autenticação JWT + bcrypt + cookies httpOnly + Bearer fallback
- Admin seed automático (admin@giroexpress.com / Admin@2026)
- Registro Loja (auto-ativo) e Motoboy (pending)
- CRUD de entregas com RBAC estrito
- Cálculo de preço automático via `/api/pricing/quote` (por km ou por endereços)
- Geocoding real via Nominatim + haversine (fator 1.35 para rodovia)
- Aceite / iniciar rota / concluir / cancelar
- Regra de lote (máx 3 mesma loja)
- Extrato semanal (Dom→Sáb) acumulado automaticamente ao concluir entrega
- Upload de comprovante (Object Storage) + admin aprova/rejeita
- Chat de entrega (polling)
- Chamados (tickets) com prioridade e mensagens
- Painel admin: usuários, aprovações, bloqueios, config bancária, stats, tickets
- Brute-force lockout (5 tent/15 min por IP+email)
- Link para Google Maps Directions do motoboy

## Backlog / Not yet built
- P1: Google Maps embed real (aguardando API key)
- P1: Real-time chat via WebSocket (hoje é polling 4s)
- P2: Email de reset de senha (endpoints existem mas não enviam email)
- P2: Notificações push para motoboy quando surgir corrida
- P2: Timezone America/Sao_Paulo (hoje ciclo é UTC)
- P2: Splitagem de `server.py` em routers modulares
- P2: httpx.AsyncClient (hoje `requests` bloqueante nos endpoints async)
- P2: Idempotência em `accumulate_statement`

## Files
- `/app/backend/server.py` - todos endpoints
- `/app/backend/.env` - segredos (JWT, admin, EMERGENT_LLM_KEY)
- `/app/frontend/src/App.js` - router + AuthProvider + Toaster
- `/app/frontend/src/context/AuthContext.jsx`
- `/app/frontend/src/lib/api.js` + `/app/frontend/src/lib/pricing.js`
- `/app/frontend/src/pages/{LoginPage,RegisterPage,StoreDashboard,CourierDashboard,AdminDashboard}.jsx`
- `/app/frontend/src/components/{Layout,ChatModal,TicketModal}.jsx`
- `/app/memory/test_credentials.md`
