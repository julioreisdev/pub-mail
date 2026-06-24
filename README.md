# Pub Mail

Plataforma multi-tenant para criação de **webchats com agentes de IA** e **email marketing em massa**, com auto-provisionamento de domínios customizados (HTTPS automático via Let's Encrypt) e rotação inteligente entre múltiplos provedores de IA.

## Sumário

- [O que é](#o-que-é)
- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Rodando localmente](#rodando-localmente)
- [Deploy em produção](#deploy-em-produção)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Funcionalidades-chave](#funcionalidades-chave)
- [Fluxo de auto-provisionamento de domínios](#fluxo-de-auto-provisionamento-de-domínios)
- [Operação](#operação)
- [Troubleshooting](#troubleshooting)

---

## O que é

O Pub Mail permite que uma organização:

1. **Crie agentes de IA** com persona/produto customizado (`prompt_mestre`, configurações de captura de lead, observações).
2. **Cadastre domínios próprios** (ex: `chat.minhamarca.com`) que ficam servindo o webchat público — basta apontar DNS na Cloudflare e o sistema gera nginx vhost + SSL Let's Encrypt automaticamente.
3. **Crie webchats** vinculando um agente a um domínio, com slug customizado (`chat.minhamarca.com/webchat/duvidas`) e personalização visual completa (cores, header, mensagens de boas-vindas, quick replies, anúncios).
4. **Capture leads** via conversa (nome, e-mail, telefone, campos custom) — leads vão pra `webchat_leads` ou são roteados pra um projeto de e-mail marketing.
5. **Envie e-mails em massa** via projetos de e-mail com templates HTML personalizados.
6. **Veja status runtime das chaves de IA** (cooldowns, quotas diárias, último erro) e exporte leads em Excel.
7. **Sirva `/ads.txt`** customizado por domínio (IAB Authorized Digital Sellers) pra integração com ADX/SSPs.

## Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│               nginx (TLS + roteamento)                   │
│  pubmail.* → SPA Vite (estático)                         │
│  pubmail-api.* → back :8000                              │
│  pubmail-ai.* → ai-micro :4000                           │
│  pubmail-mail.* → email-micro :9999                      │
│  pubmail-db.* → phpMyAdmin (basic auth + php-fpm)        │
│  <dominio-webchat-do-cliente> → SPA + /ads.txt           │
└──────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐         ┌─────────┐         ┌──────────┐
   │  Back   │ ──────→ │AI micro │         │Email mic │
   │ NestJS  │         │ Express │         │ Express  │
   │  :8000  │         │  :4000  │         │  :9999   │
   └────┬────┘         └────┬────┘         └──────────┘
        │                   │
        ▼                   ▼
   ┌────────┐          ┌────────┐
   │ MySQL  │          │ Redis  │
   │  :3306 │          │  :6379 │
   └────────┘          └────────┘
```

- **Front (Vite/React)**: SPA servida estaticamente pelo nginx em `pubmail.*` e em todos os domínios de webchat dos clientes (mesmo `dist/`, roteamento por `Host` header).
- **Back (NestJS)**: API REST autenticada por JWT. Gerencia organizações, usuários, agentes, webchats, domínios, leads, configurações do sistema (chaves de IA, Resend, etc). É quem provisiona vhosts nginx + roda certbot quando o cliente cadastra um domínio novo.
- **AI micro-services (Express, ESM)**: orquestra chamadas de IA. Tem **rotação inteligente** entre 6 provedores (Groq, Cerebras, Mistral, OpenRouter, Gemini, SambaNova) com Redis tracking de cooldown/quota por chave, fallback degradado pra Groq Llama 3.1 8B se tudo falhar.
- **Email micro-services (Express, ESM)**: dispatcher de e-mail (Resend) com fila Redis pra envios em massa.
- **MySQL 8**: storage principal (Prisma ORM).
- **Redis**: estado das chaves de IA + filas de e-mail.
- **phpMyAdmin**: admin DB com HTTP Basic Auth pelo nginx.

## Stack

| Componente | Versão |
|---|---|
| Node | 20.x |
| Yarn | 4.10.3 (corepack) |
| NestJS | 11 |
| Prisma | 7.3 |
| React | 19 |
| Vite | 7 |
| MUI | 5/7 |
| MySQL | 8.0 |
| Redis | 7 |
| nginx | 1.24+ |
| Certbot | 2.9+ |
| PHP-FPM (phpMyAdmin) | 8.3 |
| Ubuntu (prod) | 24.04 LTS |

## Estrutura do repositório

```
pub-mail/
├── back/                          # NestJS API + Prisma
│   ├── prisma/                    # schema.prisma + migrations
│   ├── src/                       # módulos (auth, webchats, email-marketing, ...)
│   └── package.json
├── ai-micro-services/             # AI router multi-provider
│   ├── src/
│   │   ├── providers/             # adapters (groq, cerebras, mistral, ...)
│   │   ├── services/              # ai-router.js, key-state-store.js, webchat.service.js
│   │   ├── controllers/
│   │   └── routes/
│   └── package.json
├── email-micro-services/          # dispatcher Resend
│   ├── server.js
│   └── package.json
├── front/vite/                    # SPA React
│   ├── src/
│   ├── vite.config.mjs
│   └── package.json
├── docker-compose.yml             # MySQL + Redis pra dev local
├── .rsync-deploy-excludes         # padrões pro rsync de deploy
└── README.md
```

## Rodando localmente

### Pré-requisitos

- Node 20+
- Yarn 4 (via `corepack enable && corepack prepare yarn@4.10.3 --activate`)
- Docker Compose (pra subir MySQL + Redis)

### Setup

```bash
# 1. Clone e suba dependências
git clone <repo> pub-mail && cd pub-mail
docker compose up -d   # sobe MySQL e Redis em portas locais

# 2. Back
cd back
echo "nodeLinker: node-modules" > .yarnrc.yml
yarn install
cp .env.example .env   # edite com suas chaves
yarn prisma generate
yarn prisma migrate deploy
yarn start:dev         # roda em :8000 com watch

# 3. AI micro-services (em outro terminal)
cd ai-micro-services
echo "nodeLinker: node-modules" > .yarnrc.yml
yarn install
cp .env.example .env
yarn start             # :4000

# 4. Email micro-services (em outro terminal)
cd email-micro-services
yarn install
cp .env.example .env
yarn start             # :9999

# 5. Front (em outro terminal)
cd front/vite
echo "nodeLinker: node-modules" > .yarnrc.yml
yarn install
yarn start             # :3000 com HMR
```

Acesse `http://localhost:3000` e crie a primeira conta via `/register`.

### .env mínimo de dev

**back/.env:**
```env
DATABASE_URL="mysql://root:mysqlpass@localhost:3306/pubmail"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET="dev_access"
JWT_REFRESH_SECRET="dev_refresh"
PORT=8000
EMAIL_SERVICE_URL="http://localhost:9999"
EMAIL_SERVICE_KEY="dev-email-key"
IA_SERVICE_URL="http://localhost:4000"
IA_SERVICE_KEY="dev-ia-key"
WEBCHAT_DOMAIN_BIND_PROVIDER="CERTBOT"
HTTP_BODY_LIMIT="2gb"
```

**ai-micro-services/.env:**
```env
PORT=4000
IA_SERVICE_KEY=dev-ia-key
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

**email-micro-services/.env:**
```env
PORT=9999
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
EMAIL_SERVICE_KEY=dev-email-key
```

**front/vite/.env:**
```env
VITE_APP_BASE_NAME=/
VITE_API_URL=http://localhost:8000
VITE_AI_URL=http://localhost:4000
VITE_EMAIL_URL=http://localhost:9999
GENERATE_SOURCEMAP=false
```

> **Atenção crítica:** `VITE_APP_BASE_NAME=/` é obrigatório. Sem ele, o build do Vite gera asset paths como `/undefined/...` e a SPA renderiza tela branca.

## Deploy em produção

Setup de referência: **Ubuntu 24.04 LTS**, single VPS, deploy nativo (sem Docker em prod).

### 1. Pacotes do sistema

```bash
apt update
apt install -y curl ca-certificates gnupg build-essential git rsync ufw \
                apache2-utils nginx redis-server mysql-server \
                certbot python3-certbot-nginx \
                php-fpm php-mysql php-mbstring php-zip php-gd php-curl php-xml unzip
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
corepack enable && corepack prepare yarn@4.10.3 --activate
```

### 2. UFW (libere SSH ANTES de habilitar)

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
```

### 3. DNS resolver confiável

A resolver default da VPS pode ter cache stale (Hostinger e similares). Force Cloudflare/Google:

```bash
mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/pubmail.conf <<EOF
[Resolve]
DNS=1.1.1.1 1.0.0.1 8.8.8.8
FallbackDNS=8.8.4.4
DNSStubListener=yes
Cache=yes
EOF
systemctl restart systemd-resolved
```

### 4. MySQL: setar senha root + criar DB

```bash
mysql -u root <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'SUA_SENHA_FORTE';
FLUSH PRIVILEGES;
CREATE DATABASE pubmail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL
```

### 5. Upload do código

Do seu local:

```bash
rsync -avz --exclude-from=.rsync-deploy-excludes ./ root@<VPS_IP>:/opt/pub-mail/
```

### 6. .env de produção

Crie os 4 `.env` em `/opt/pub-mail/{back,ai-micro-services,email-micro-services,front/vite}/.env` com os valores apropriados. Exemplos completos:

**`/opt/pub-mail/back/.env`** (chmod 600):
```env
DATABASE_URL="mysql://root:SUA_SENHA@localhost:3306/pubmail"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_ACCESS_SECRET="<32 bytes random>"
JWT_REFRESH_SECRET="<32 bytes random>"
JWT_ACCESS_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="30d"
PORT=8000
BASE_API_URL="https://pubmail-api.seu-dominio.com"
EMAIL_SERVICE_URL="http://127.0.0.1:9999"
EMAIL_SERVICE_KEY="<key compartilhada com email-micro>"
IA_SERVICE_URL="http://127.0.0.1:4000"
IA_SERVICE_KEY="<key compartilhada com ai-micro>"
WEBCHAT_DOMAIN_BIND_PROVIDER="CERTBOT"
HTTP_BODY_LIMIT="2gb"
NODE_ENV="production"
WEBCHAT_FRONT_DIST="/opt/pub-mail/front/vite/dist"
WEBCHAT_BACKEND_INTERNAL_URL="http://127.0.0.1:8000"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
CERTBOT_BIN="/usr/bin/certbot"
CERTBOT_MODE="nginx"
```

**`/opt/pub-mail/front/vite/.env`** (gravado ANTES do build):
```env
VITE_APP_VERSION=1.0.0
VITE_APP_BASE_NAME=/
VITE_API_URL=https://pubmail-api.seu-dominio.com
VITE_AI_URL=https://pubmail-ai.seu-dominio.com
VITE_EMAIL_URL=https://pubmail-mail.seu-dominio.com
GENERATE_SOURCEMAP=false
```

### 7. Build dos services

```bash
# Back
cd /opt/pub-mail/back
echo "nodeLinker: node-modules" > .yarnrc.yml
rm -rf .yarn .pnp.* node_modules
yarn install
yarn add dotenv      # exigido pelo prisma.config.ts
yarn prisma generate
yarn prisma migrate deploy
yarn nest build

# AI micro
cd /opt/pub-mail/ai-micro-services
echo "nodeLinker: node-modules" > .yarnrc.yml
rm -rf .yarn .pnp.* node_modules
yarn install

# Email micro
cd /opt/pub-mail/email-micro-services
echo "nodeLinker: node-modules" > .yarnrc.yml
rm -rf .yarn .pnp.* node_modules
yarn install

# Front
cd /opt/pub-mail/front/vite
echo "nodeLinker: node-modules" > .yarnrc.yml
yarn install
yarn build           # gera dist/
```

> **Importante:** os 4 projetos precisam de `nodeLinker: node-modules` no `.yarnrc.yml`. Sem isso, Yarn 4 usa Plug'n'Play e o Prisma + alguns pacotes nativos quebram.

### 8. Systemd units

Crie `/etc/systemd/system/pubmail-back.service`:

```ini
[Unit]
Description=Pub Mail — Back (NestJS)
After=network.target mysql.service redis-server.service
Wants=mysql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pub-mail/back
EnvironmentFile=/opt/pub-mail/back/.env
ExecStart=/usr/bin/node dist/src/main.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pubmail-back
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Faça o equivalente pra `pubmail-ai.service` (ExecStart `node src/server.js`) e `pubmail-email.service` (`node server.js`).

> O service roda **como root** porque o back precisa escrever em `/etc/nginx/sites-available` e executar `nginx`/`certbot` em runtime pra auto-provisionamento. Em ambientes que exigem hardening, você pode trocar pra um user dedicado com sudoers específico (`/etc/sudoers.d/pubmail`) liberando só esses comandos.

```bash
mkdir -p /opt/pub-mail/back/uploads
systemctl daemon-reload
systemctl enable --now pubmail-back pubmail-ai pubmail-email
```

### 9. Nginx vhosts dos 5 subdomínios fixos

Pra cada subdomínio (`pubmail`, `pubmail-api`, `pubmail-ai`, `pubmail-mail`), crie um arquivo em `/etc/nginx/sites-available/pubmail-<role>` apontando pro role correspondente:

- `pubmail-front`: serve `/opt/pub-mail/front/vite/dist` com fallback SPA `/index.html`
- `pubmail-api`: `proxy_pass http://127.0.0.1:8000;`
- `pubmail-ai`: `proxy_pass http://127.0.0.1:4000;`
- `pubmail-mail`: `proxy_pass http://127.0.0.1:9999;`

Templates completos no diretório [docs/nginx-templates/](#) (referência: gerar via deploy script).

### 10. Default deny pra Hosts não cadastrados

Crítico pra evitar que requests com `Host` desconhecido caiam no primeiro vhost (vazamento de comportamento):

```nginx
# /etc/nginx/sites-enabled/000-default-deny
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_certificate /etc/letsencrypt/live/pubmail.seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pubmail.seu-dominio.com/privkey.pem;
    return 444;
}
```

### 11. SSL Let's Encrypt

```bash
ln -s /etc/nginx/sites-available/pubmail-front /etc/nginx/sites-enabled/
# ... idem pros outros 3
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx --non-interactive --agree-tos -m seu@email.com --redirect \
  -d pubmail.seu-dominio.com \
  -d pubmail-api.seu-dominio.com \
  -d pubmail-ai.seu-dominio.com \
  -d pubmail-mail.seu-dominio.com
```

`certbot.timer` já fica ativo automaticamente, renova 2x/dia.

### 12. phpMyAdmin

```bash
htpasswd -cb /etc/nginx/pubmail-db.htpasswd admin SENHA_BASIC_AUTH
mkdir -p /opt/phpmyadmin && cd /opt/phpmyadmin
curl -sL https://files.phpmyadmin.net/phpMyAdmin/5.2.2/phpMyAdmin-5.2.2-all-languages.tar.gz \
  -o pma.tgz && tar -xzf pma.tgz --strip-components=1 && rm pma.tgz

# config.inc.php com auth_type=cookie e blowfish_secret aleatório
chown -R www-data:www-data /opt/phpmyadmin
```

Vhost: bloco `auth_basic` na location `/`, fastcgi pra `*.php` no socket `/run/php/php8.3-fpm.sock`. Cert separado via certbot.

## Variáveis de ambiente

### Back (NestJS)

| Variável | Default | Descrição |
|---|---|---|
| `PORT` | 3000 | Porta HTTP do back |
| `DATABASE_URL` | — | URL Prisma do MySQL |
| `REDIS_HOST` / `REDIS_PORT` | localhost / 6379 | Redis (filas e tokens) |
| `JWT_ACCESS_SECRET` | — | Secret access JWT |
| `JWT_REFRESH_SECRET` | — | Secret refresh JWT |
| `IA_SERVICE_URL` | — | URL interna do ai-micro |
| `IA_SERVICE_KEY` | — | Auth shared com ai-micro |
| `EMAIL_SERVICE_URL` | — | URL interna do email-micro |
| `EMAIL_SERVICE_KEY` | — | Auth shared com email-micro |
| `WEBCHAT_FRONT_DIST` | `/opt/pub-mail/front/vite/dist` | Path do build do front |
| `WEBCHAT_BACKEND_INTERNAL_URL` | `http://127.0.0.1:3000` | Usado nos vhosts auto-gerados pra proxiar `/ads.txt` |
| `NGINX_SITES_AVAILABLE` | `/etc/nginx/sites-available` | Onde back escreve vhosts |
| `NGINX_SITES_ENABLED` | `/etc/nginx/sites-enabled` | Onde back symlinka |
| `CERTBOT_BIN` | `certbot` | Path do binário |
| `CERTBOT_MODE` | `nginx` | Plugin certbot (`nginx` ou `webroot`) |

### AI micro

| Variável | Default | Descrição |
|---|---|---|
| `PORT` | 4000 | |
| `IA_SERVICE_KEY` | — | Validado em `x-api-key` |
| `REDIS_HOST` / `REDIS_PORT` | 127.0.0.1 / 6379 | KeyStateStore |
| `OPENROUTER_REFERER` | — | Header recomendado pelo OpenRouter |

### Email micro

| Variável | Default | Descrição |
|---|---|---|
| `PORT` | 9999 | |
| `EMAIL_SERVICE_KEY` | — | Validado em `x-api-key` |
| `REDIS_HOST` / `REDIS_PORT` | 127.0.0.1 / 6379 | Filas |

### Front (Vite)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_APP_BASE_NAME` | **sim (`/`)** | Sem isso, asset paths quebram (tela branca) |
| `VITE_API_URL` | sim | URL pública do back |
| `VITE_AI_URL` | sim | URL pública do ai-micro |
| `VITE_EMAIL_URL` | sim | URL pública do email-micro |

## Funcionalidades-chave

### Multi-provider AI rotation

O ai-micro tem 6 adapters (Groq, Cerebras, Mistral, OpenRouter, Gemini, SambaNova) implementando o protocolo OpenAI-compatible. O `ai-router.js`:

1. Coleta todas as `(provider, key)` enviadas pelo back.
2. Filtra chaves em cooldown ou com quota diária esgotada (estado em Redis).
3. Ordena por `(provider.priority ASC, total_uses_today ASC, last_used_at ASC)` — round-robin natural.
4. Tenta sequencialmente; em erro classifica (`rate_limit | daily_exhausted | invalid_key | transient | fatal`) e atualiza Redis com TTL apropriado.
5. **Fallback degradado**: se todas as 70B falharem, tenta Llama 3.1 8B-instant via Groq como última cartada.

A página **Status de API** no front mostra estado runtime de cada chave (cooldown countdown, reqs hoje, tokens, último erro).

### Auto-provisionamento de domínios de webchat

Cliente cadastra um domínio (ex: `chat.cliente.com`) na UI:

1. Front chama `POST /webchat-domains` com o domínio.
2. Cliente aponta DNS na Cloudflare (proxy laranja **Proxied** OK — código aceita IPs do CF via CIDRs).
3. Cliente clica **Verificar DNS**:
   - Back resolve A records, valida que apontam pra IP esperado **OU** pertencem aos CIDRs do Cloudflare.
   - Marca `status=VERIFIED`.
   - Escreve vhost HTTP em `/etc/nginx/sites-available/pubmail-domain-<dominio>` com:
     - `root` apontando pro `dist/` do front (mesmo SPA, roteia por slug)
     - `location = /ads.txt` proxiando pro back (resolve por Host header)
     - SPA fallback `try_files`
   - Recarrega nginx.
   - Roda `certbot --nginx -d <dominio>` que patcha o vhost com `listen 443 ssl` + cert.

A partir desse momento, `https://chat.cliente.com/webchat/<slug>` serve o webchat público com SSL próprio.

### ads.txt por domínio (IAB)

Cada `webchat_domains` tem coluna `ads_txt TEXT`. O cliente edita pelo botão "ads.txt" na lista de domínios. O conteúdo é servido em `https://<dominio>/ads.txt` (proxy nginx → back, que resolve por `Host` e devolve `text/plain` com `Cache-Control: public, max-age=300`).

### Captura inteligente de leads no webchat

Sistema de prompts da IA garante:
- Resposta sempre no idioma da última mensagem do usuário (multilíngue).
- Toda resposta com pelo menos 1 emoji persuasivo.
- Maioria das respostas com 2-3 quick replies contextuais — opções como sub-tópicos para aprofundar conversa com o agente.
- **Exceção**: turnos pedindo nome/e-mail/telefone do lead vêm sem opções (lead precisa digitar o dado). Há guardrail no código que força `options=[]` mesmo se a IA tentar enviar.
- Agente sempre **especialista que ajuda no chat**, nunca a instituição que entrega o serviço final (não promete contratação/aprovação/venda direta — informa, ensina, esclarece).

### Página Leads

- Tabela paginada com filtro por webchat e busca por nome/e-mail/telefone.
- **Export Excel** client-side via `xlsx` (até 50k registros por export).
- Endpoints: `GET /webchat-leads`, `GET /webchat-leads/export`.

## Operação

### Atualizar prod

```bash
# Local — pushe código
rsync -avz --exclude-from=.rsync-deploy-excludes ./ root@<VPS>:/opt/pub-mail/

# VPS — rebuild apenas o que mudou
ssh root@<VPS>
cd /opt/pub-mail/back && yarn install && yarn prisma migrate deploy && yarn nest build
cd /opt/pub-mail/front/vite && yarn install && yarn build
systemctl restart pubmail-back pubmail-ai pubmail-email
```

### Logs

```bash
journalctl -u pubmail-back -f       # ou pubmail-ai / pubmail-email
journalctl -u pubmail-back --since "1 hour ago" -p err
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Renovar certificados manualmente

```bash
certbot renew                    # respeita renew_before_expiry (30 dias)
certbot renew --force-renewal    # força (debug)
```

### Regenerar nginx blocks de todos os domínios

Útil após mudar o template `ensureNginxHttpBlockForDomain`:

```bash
curl -X POST https://pubmail-api.seu-dominio.com/webchat-domains/regenerate-nginx \
  -H "Authorization: Bearer <JWT_DA_ORG>"
```

Em seguida, re-rode `certbot --nginx -d <dominio>` pra cada domínio se o template antigo era HTTP-only.

### Backup MySQL (sugestão)

Não vem configurado por padrão. Sugestão de cron:

```bash
# /etc/cron.daily/pubmail-mysql-backup
mysqldump -u root -p"$DB_PASS" pubmail | gzip > /var/backups/pubmail-$(date +\%F).sql.gz
find /var/backups -name "pubmail-*.sql.gz" -mtime +7 -delete
```

## Troubleshooting

### Tela branca no front
- Confirme que `VITE_APP_BASE_NAME=/` está no `.env` do front **antes** de rodar `yarn build`. Sem isso, vite gera asset paths como `/undefined/...`.
- Inspecione `dist/index.html` — `<script src="...">` deve apontar pra `/assets/...`, não `/undefined/assets/...`.

### "Cannot GET /webchat/X" em domínio do cliente
- O domínio não está cadastrado, ou o vhost dele não foi criado. Sem vhost matching, o request cai no `default_server` que retorna 444 (close connection) — se sua resposta for "Cannot GET", você não tem o `000-default-deny` configurado.

### "Verificar DNS" falha mesmo com Cloudflare apontado
- Resolver da VPS pode ter cache stale. Force resolver público:
  ```bash
  cat > /etc/systemd/resolved.conf.d/pubmail.conf <<EOF
  [Resolve]
  DNS=1.1.1.1 1.0.0.1 8.8.8.8
  EOF
  systemctl restart systemd-resolved
  resolvectl flush-caches
  systemctl restart pubmail-back   # pega resolver atualizado
  ```

### certbot retorna "Another instance is already running"
```bash
pkill -f certbot
rm -f /var/lib/letsencrypt/.certbot.lock
```

### HTTP 520 em domínio de webchat após salvar ads.txt
- Bug histórico (já corrigido na v atual): salvar ads.txt regenerava o vhost zerando o SSL config. Se acontecer:
  ```bash
  certbot --nginx -d <dominio>   # patcha o vhost de novo com SSL
  ```

### Yarn 4 + Prisma quebrando
- Sempre use `nodeLinker: node-modules` no `.yarnrc.yml`. Plug'n'Play (default) não funciona com Prisma e alguns nativos.

---

**Licença**: privada / proprietary.
