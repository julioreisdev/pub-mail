# ✅ API SaaS Multi-Tenant — Resumo para Testar no Postman

Base URL (exemplo):

http://localhost:3000


Todos os endpoints protegidos exigem:

Authorization: Bearer <ACCESS_TOKEN>


---

# 1) Criar Conta (User + Organization + Wallet)

## ✅ POST `/auth/register`

Cria automaticamente:

- User (role OWNER)
- Organization
- Wallet (saldo inicial 0)
- Retorna tokens JWT

### URL

POST http://localhost:3000/auth/register


### Headers

Content-Type: application/json


### Body (raw / JSON)

```json
{
  "name": "Mateus Pereira",
  "email": "mateus@email.com",
  "password": "123456",
  "organization_name": "Minha Empresa LTDA",
  "document_id": "12345678900"
}


Response esperada
{
  "user": { ... },
  "organization": { ... },
  "wallet": { ... },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
📌 Guarde:

tokens.accessToken

tokens.refreshToken

2) Login (Recebe Token)
✅ POST /auth/login
URL
POST http://localhost:3000/auth/login
Headers
Content-Type: application/json
Body
{
  "email": "mateus@email.com",
  "password": "123456"
}



Response esperada
{
  "user": {
    "id": "...",
    "organizationId": "...",
    "role": "OWNER"
  },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "accessExpiresIn": "15m",
    "refreshExpiresIn": "30d"
  }
}



3) Rota Autenticada (User + Organization)
✅ GET /auth/me
Retorna os dados do usuário logado e sua organização.

URL
GET http://localhost:3000/auth/me
Headers
Authorization: Bearer <ACCESS_TOKEN>
Response esperada
{
  "user": {
    "id": "...",
    "name": "Mateus Pereira",
    "email": "mateus@email.com",
    "role": "OWNER"
  },
  "organization": {
    "id": "...",
    "name": "Minha Empresa LTDA",
    "document_id": "12345678900",
    "stripe_customer_id": null
  }
}


4) Cadastrar Cartão (Billing Cards)
✅ POST /billing/cards
Salva um cartão na tabela billing_cards.

📌 Se for o primeiro cartão da organização, ele vira automaticamente is_default=true.

URL
POST http://localhost:3000/billing/cards
Headers
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
Body
{
  "holder_name": "Mateus Pereira",
  "provider_token": "tok_test_123",
  "last_four_digits": "4242",
  "brand": "VISA",
  "is_default": false
}


Response esperada (provider_token não retorna)
{
  "id": "...",
  "last_four_digits": "4242",
  "brand": "VISA",
  "holder_name": "Mateus Pereira",
  "is_default": true
}
5) Ver Saldo da Wallet
✅ GET /wallet/balance
Retorna o saldo atual da organização logada.

URL
GET http://localhost:3000/wallet/balance

Headers
Authorization: Bearer <ACCESS_TOKEN>


Response esperada
{
  "id": "...",
  "organization_id": "...",
  "balance": "0.0000",
  "status": "ACTIVE"
}

(Extra) Histórico de Transações
✅ GET /wallet/transactions
URL
GET http://localhost:3000/wallet/transactions?page=1&pageSize=20

Headers
Authorization: Bearer <ACCESS_TOKEN>

Response esperada
{
  "page": 1,
  "pageSize": 20,
  "total": 2,
  "items": [
    {
      "id": "...",
      "amount": "5.0000",
      "type": "BONUS",
      "description": "Bônus inicial",
      "created_at": "2026-01-30T18:00:00.000Z"
    }
  ]
}

(Extra) Criar Transação (Atualiza Saldo)
✅ POST /transactions
Cria movimentação e atualiza o saldo automaticamente.

URL
POST http://localhost:3000/transactions
Headers
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

Body
{
  "amount": "10.0000",
  "type": "BONUS",
  "description": "Bônus de boas-vindas"
}

(Extra) Refresh Token
✅ POST /auth/refresh
Renova tokens usando refresh token.

URL
POST http://localhost:3000/auth/refresh
Body
{
  "refreshToken": "<REFRESH_TOKEN>"
}
