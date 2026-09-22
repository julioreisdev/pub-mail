# Pub Mail

<p align="right">
  <a href="README.md">🇧🇷 Ler em português</a> · <a href="README.en.md"><b>🇺🇸 English</b></a>
</p>

A **multi-tenant** marketing and automation platform: **AI-powered webchats**, **quizzes**, full **email marketing** (visual builder, automations, segmentation, A/B tests, analytics) and a **Telegram module** (bots, DMs, groups/channels, broadcasts, flows, social proof and PIX sales). Customers' own domains are provisioned automatically (nginx + Let's Encrypt HTTPS), and AI calls rotate intelligently across multiple providers.

![Pub Mail dashboard](docs/images/dashboard.png)

## Table of contents

- [Overview](#overview)
- [Modules](#modules)
  - [AI Webchat](#ai-webchat)
  - [Quizzes](#quizzes)
  - [Email Marketing](#email-marketing)
  - [Leads and Automations](#leads-and-automations)
  - [Telegram](#telegram)
  - [Administration, Integrations and Account](#administration-integrations-and-account)
- [Architecture](#architecture)
- [Stack](#stack)
- [Repository layout](#repository-layout)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Production deployment](#production-deployment)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)

---

## Overview

Each **organization** (tenant) owns its users, token wallet, agents, domains, webchats, quizzes, email projects, leads and Telegram bots — all isolated by `organization_id`. A platform `SUPER_ADMIN` manages organizations and users.

Typical flow: capture leads (webchat, quiz, website form, Telegram) → nurture (initial flow, automations, broadcasts, triggers) → convert (emails, Telegram VIP with PIX) → measure (analytics, per-lead engagement).

## Modules

### AI Webchat

- **AI agents** with persona/product (`prompt_mestre`), lead-capture rules and notes.
- **Custom domains** (`chat.yourbrand.com`): the customer points DNS, clicks "Verify DNS" and the system creates the nginx vhost + SSL certificate by itself. Per-domain editable `ads.txt` (IAB).
- **Webchats** with a slug (`/webchat/faq`), full visual customization, **buttons** (quick replies with CSS classes), **legal pages** footer, **ads** (GPT/ADX, optional label) and a responsive layout (720px column on desktop).
- **Splits**: webchat folders with **weighted redirection** (`/webchat/splits/<slug>` picks a member by weight, with an anti-loop guard).
- **Smart lead capture** inside the conversation (name/email/phone/custom fields), multilingual, with prompt guardrails; leads can be routed to an email project.
- **Multi-provider AI rotation** (Groq, Cerebras, Mistral, OpenRouter, Gemini, SambaNova) with per-key cooldown/quota in Redis and a degraded fallback.

### Quizzes

- **Quiz domains** (same provisioning as webchat) and **quiz CRUD** with weighted splits.
- **Visual builder** (`/quizzes/:id/builder`) with real preview, 3 presets (Clean, Vibrant, Dark Neon), preset import/export, per-question description, content blocks (text/image/divider) and per-button CSS classes.
- **Lead capture** at the end (configurable fields) → `quiz_leads` and, if linked, the email project.
- **Per-answer redirect** (each option may have its own URL) or a global one.
- **Instant email to the lead** (HTML/visual builder, `{{name}}/{{email}}/{{phone}}` variables).
- **Ads** (top slot) mirrored from the webchat and **GTM-ready tracking** (real `<a>` elements + `dataLayer` events: `quiz_answer`, `quiz_lead`, `quiz_complete`).

### Email Marketing

- **Projects** (lists) with sender, cold-lead blocking and "only leads who interacted in the flow".
- **Block-based visual builder** (text, image, tracked button, divider, spacer, card, columns, top bar) producing **minimal, clean HTML** that lands in the inbox; **preheader** and **From Name** per template; images optimized (sharp) and served straight by nginx with a 1-year cache.
- **Import templates from Claude**: ready-made prompt + flat `.xlsx/.csv` sheet → templates editable in the builder.
- **Recurring schedules** by time of day (minute-of-day in Brasília time), **templates per schedule**, **manual dispatch**, **resend to non-openers**.
- **Segmentation** by rules (opened/clicked within X days, open/click rate, tags, source, join date) with live counts.
- **A/B tests** of subject + template with automatic decision and winner sent to the rest.
- **Capture form v2**: a **single copy-pasteable snippet** (WordPress format: paste in the code editor, edit in the visual editor) — fields, texts, button with destination URL, colors, optional feedback, all configurable and saved per project. Without an email the button is a plain link; with an email it captures then redirects. Public API `POST /email/leads/subscribe/:org/:project` for custom forms.
- **Deliverability**: strict email validation at every entry point, automatic hygiene (fixes/removes invalid ones), **Resend webhooks** (delivered/bounce/spam) with **automatic suppression** and token refunds when nothing is sent.
- **Analytics**: dispatches, delivered, opens, unique clicks, bounces, spam, time series and current engagement of the base.

### Leads and Automations

- **Leads** unified by source (Webchats, Quizzes, Email projects): per-lead engagement, **tags** (single and bulk edit), server-side filters, Excel export.
- **Initial Flow** (drip per project): email sequence with delays, **per-step conditions** (only if the previous one was opened/clicked) and **per-step metrics**.
- **Recycling (win-back)**: schedules that fire **only to cold leads**.
- **Behavior triggers**: on open/click → add tag or send template, with per-lead frequency (once, cooldown, unlimited).

### Telegram

![Telegram DMs](docs/images/telegram-dms.png)

- **Bots** (@BotFather token) with automatic webhook, revalidation, profile (name, description, commands) and a **flood/ban warning** on the card.
- **Telegram-style DMs** (photos, emojis, attachments, contact tags, presence), auto-discovered **Groups** and **Channels** (invite link, photo, member count, leave).
- **Initial Flow**: visual builder (reactflow) with draggable blocks — multiple messages, media/audio (voice via ffmpeg), "typing" delay, buttons (next step, link, group, another bot, **sell plan**), text answers, tags, capture deep-link (`?start=`).
- **Timed automations** after `/start` ("inactive" condition, tags, buttons).
- **Mass broadcasts** (DMs + groups + channels, several bots) with copy rotation, daily times, variables (`{{nome}}` etc.), inline buttons, per-bot rate-limited queue, per-time status and paginated history.
- **Rotating message (social proof)**: one message **edited in a loop** ("Someone just joined…") in groups/channels or in DMs, always kept as the last message, with anti-flood guards (minimum cadence, per-lead edit cap, detection of leads who left).
- **Payments / VIP**: `/vip` → plans → **PIX** (Mercado Pago or PushinPay, QR + copy-paste with a copy button) → real gateway validation → **single-use invite link** to the VIP group/channel. **Time-based subscriptions** with reminder, expiration (removes from VIP) and renewal. Fully configurable checkout messages. Plan button also available in broadcasts, automations and flows.

### Administration, Integrations and Account

![Integrations](docs/images/integracoes.png)

- **Administration → Users** (`SUPER_ADMIN`): cross-org organizations and users, create org + admin, change password, cascading delete. Supports a **hidden developer organization** (invisible to everyone else).
- **Integrations**: per-provider AI keys **masked** (add/remove per key, automatic rotation), Resend + webhook Signing Secret, edge IP and certbot email. **API Status** shows each key's runtime state; **AI Tutorial** explains how to get the keys.
- **Account & Domains**: account data, webchat and quiz domains.
- **UI**: **light/dark** theme, collapsible sidebar groups, account summary dashboard.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   nginx (TLS + routing)                      │
│  bluewebchat.online          → Vite SPA (static)             │
│  api.bluewebchat.online      → back :8000 (+ /uploads)       │
│  <customer-domain>           → SPA + /ads.txt (webchat/quiz) │
└──────────────────────────────────────────────────────────────┘
                     │
                     ▼
              ┌────────────┐   127.0.0.1   ┌────────────┐  ┌────────────┐
              │   Back     │ ────────────▶ │  AI micro  │  │ Email micro│
              │  NestJS    │ ────────────▶ │  :4000     │  │   :9999    │
              │   :8000    │               └─────┬──────┘  └─────┬──────┘
              └─────┬──────┘                     │               │
                    ▼                            ▼               ▼
              ┌──────────┐                 ┌──────────────────────┐
              │  MySQL 8 │                 │        Redis 7       │
              └──────────┘                 └──────────────────────┘
   External: Telegram Bot API (webhooks) · Resend (email + webhooks) · Mercado Pago / PushinPay (PIX)
```

- **Front (Vite/React)**: SPA served by nginx on the platform domain and on every customer domain (same `dist/`, routed by `Host`). The browser **only talks to the back**.
- **Back (NestJS)**: REST API (JWT), multi-tenant, provisions vhosts + certbot, runs crons/workers (schedules, flows, A/B, hygiene, Telegram) and receives the public webhooks (Telegram, Resend, payment gateways).
- **AI micro** and **Email micro**: loopback only; the back is their only client.
- **MySQL 8** (Prisma) and **Redis** (AI key state + BullMQ email queues).

## Stack

| Component | Version |
|---|---|
| Node | 20.x |
| Yarn | 4.x (corepack, `nodeLinker: node-modules`) |
| NestJS | 11 |
| Prisma | 7 (MariaDB adapter) |
| React / Vite / MUI | 19 / 7 / 7 |
| reactflow | 11 |
| MySQL | 8.0 |
| Redis | 7 |
| nginx / Certbot | 1.24+ / 2.9+ |
| ffmpeg, libvips (sharp) | system dependencies (audio/images) |
| Ubuntu (prod) | 24.04 LTS |

## Repository layout

```
pub-mail/
├── back/                      # NestJS API + Prisma
│   ├── prisma/                # schema.prisma + migrations
│   └── src/
│       ├── auth/ admin/       # JWT, roles, administration
│       ├── webchats/ quizzes/ # webchat, domains, quizzes, splits, ads
│       ├── email-marketing/   # projects, templates, leads, flows, ab, triggers, analytics…
│       ├── cron-jobs/         # email schedules
│       ├── telegram/          # bots, chat, flows, automations, broadcasts, rotators, payments
│       └── webhooks/          # Resend + open/click tracking
├── ai-micro-services/         # multi-provider AI router
├── email-micro-services/      # Resend dispatcher (BullMQ)
├── front/vite/                # React SPA
│   └── src/views/pages/       # webchat, quiz, email, leads, telegram, admin…
├── docs/images/               # images used in this README
├── docker-compose.yml         # MySQL + Redis + phpMyAdmin for local dev
└── CLAUDE.md                  # detailed operational notes (deploy, gotchas, history)
```

## Running locally

### Prerequisites

Node 20, Yarn 4 (corepack), Docker (for MySQL/Redis), `ffmpeg` (Telegram audio) and `libvips` (sharp) — both optional in dev.

### Setup

```bash
# 1. Infra dependencies
docker compose up -d            # MySQL :3306, Redis :6379, phpMyAdmin :8081

# 2. Back
cd back && yarn install
yarn prisma migrate deploy && yarn prisma generate
yarn start:dev                  # :8000

# 3. AI micro (another terminal)
cd ai-micro-services && yarn install && yarn dev   # :4000

# 4. Email micro (another terminal)
cd email-micro-services && yarn install && yarn dev   # :9999

# 5. Front (another terminal)
cd front/vite && yarn install && yarn dev   # :3000
```

> Webhooks (Telegram, Resend, gateways) need a public URL — in dev use a tunnel (e.g. `ngrok http 8000`) and point `PUBLIC_API_URL` at it.

## Environment variables

### Back (NestJS)

| Variable | Default | Description |
|---|---|---|
| `PORT` | 8000 | HTTP port |
| `DATABASE_HOST/USER/PASS/NAME/PORT` | — | **Runtime connection** (MariaDB adapter) |
| `DATABASE_URL` | — | Prisma CLI only (migrate/generate) |
| `DATABASE_POOL_LIMIT` | 10 | **Required** — the back opens several pools; the default (50) exceeds MySQL's `max_connections` |
| `REDIS_HOST` / `REDIS_PORT` | 127.0.0.1 / 6379 | Redis |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — | JWT secrets |
| `IA_SERVICE_URL` / `IA_SERVICE_KEY` | `http://127.0.0.1:4000` | AI micro |
| `EMAIL_SERVICE_URL` / `EMAIL_SERVICE_KEY` | `http://127.0.0.1:9999` | Email micro |
| `PUBLIC_API_URL` | `https://api.bluewebchat.online` | Public back URL (Telegram/payment webhooks, capture form) |
| `WEBCHAT_FRONT_DIST` | `/opt/pub-mail/front/vite/dist` | Front build served on customer domains |
| `WEBCHAT_BACKEND_INTERNAL_URL` | `http://127.0.0.1:8000` | Used in generated vhosts for `/ads.txt` |
| `NGINX_SITES_AVAILABLE` / `NGINX_SITES_ENABLED` | `/etc/nginx/...` | Where the back writes vhosts |
| `CERTBOT_BIN` / `CERTBOT_MODE` | `certbot` / `nginx` | SSL provisioning |
| `HTTP_BODY_LIMIT`, `UPLOAD_MAX_FILE_SIZE_BYTES` | — | Upload limits |

Platform settings (AI keys, Resend, webhook secret, edge IP, certbot email) live in the database (`system_settings`) and are edited under **Integrations**.

### AI micro

| Variable | Default | Description |
|---|---|---|
| `PORT` | 4000 | |
| `IA_SERVICE_KEY` | — | Validated in `x-api-key` |
| `REDIS_HOST` / `REDIS_PORT` | 127.0.0.1 / 6379 | Key state |
| `OPENROUTER_REFERER` | — | Header recommended by OpenRouter |

### Email micro

| Variable | Default | Description |
|---|---|---|
| `PORT` | 9999 | |
| `EMAIL_SERVICE_KEY` | — | Validated in `x-api-key` |
| `REDIS_HOST` / `REDIS_PORT` | 127.0.0.1 / 6379 | BullMQ queues |
| `NEST_WEBHOOK_URL` | — | Internal callback to the back (dispatch result) |
| `BASE_URL_API` | — | Public back URL (open pixel / tracked click) |

### Front (Vite)

| Variable | Required | Description |
|---|---|---|
| `VITE_APP_BASE_NAME` | **yes (`/`)** | Without it asset paths break (blank page) |
| `VITE_API_URL` | yes | Public back URL — the browser only talks to it |

## Production deployment

Production runs on **AWS EC2 (Ubuntu 24.04)**, native deployment (no Docker), `systemd` services (`pubmail-back`, `pubmail-ai`, `pubmail-email`), nginx + certbot. Access is **AWS SSM only** (no SSH): code is packaged, uploaded to S3 and extracted on the instance via `aws ssm send-command`.

Flow summary (details, gotchas and the full step-by-step live in `CLAUDE.md`):

```bash
# Front: package → S3 → extract on the instance → build into a temp dir → atomic swap
cd /opt/pub-mail/front/vite && export NODE_OPTIONS=--max-old-space-size=4096
rm -rf dist_new && yarn build --outDir dist_new
[ -f dist_new/index.html ] && { rm -rf dist_prev; mv dist dist_prev; mv dist_new dist; }

# Back: (if the schema changed) migrate deploy + generate → build → restart only if the build passed
cd /opt/pub-mail/back && yarn prisma migrate deploy && yarn prisma generate
yarn nest build && test -f dist/src/main.js && systemctl restart pubmail-back
```

Infra points that matter:

- **Only 80/443** open. Platform domains on Cloudflare in **DNS only**; customer domains may use the proxy (the back accepts Cloudflare CIDRs).
- Secrets in `/root/pubmail.secrets`; the back runs as root to write vhosts and run certbot.
- `nginx` serves `/uploads` straight from disk (email/Telegram images never hit Node).
- Redis with `maxmemory` + `noeviction`; MySQL with a tuned `innodb_buffer_pool_size`; 2 GB swap.

## Operations

```bash
journalctl -u pubmail-back -f                      # logs (or pubmail-ai / pubmail-email)
journalctl -u pubmail-back --since "1 hour ago" -p err
certbot renew                                      # renewal (the timer already does it)
mysqldump -u pubmail -p pubmail | gzip > backup.sql.gz
```

- **Regenerate vhosts** for every domain: `POST /webchat-domains/regenerate-nginx` (org JWT) and, if needed, `certbot --nginx -d <domain>`.
- **Telegram in flood-wait**: the bot card shows "Paused" with the return time; the runners honour `retry_after` on their own.

## Troubleshooting

- **Blank page on the front** — `VITE_APP_BASE_NAME=/` must exist **before** `yarn build`.
- **MySQL "Too many connections"** — `DATABASE_POOL_LIMIT=10` is missing from `back/.env`.
- **Broken `/ads.txt` on a customer domain** — `WEBCHAT_BACKEND_INTERNAL_URL` must point to `:8000`.
- **"Verify DNS" fails with correct DNS** — stale resolver cache: use `1.1.1.1`/`8.8.8.8` in `systemd-resolved` and restart the back.
- **certbot "Another instance is already running"** — `pkill -f certbot && rm -f /var/lib/letsencrypt/.certbot.lock`.
- **Dispatch with 0 sent** — an invalid email used to fail the whole batch (fixed: validation + individual fallback + token refund). Check `error_message` on the dispatch.
- **Telegram bot not answering** — check the card under Telegram → Settings: revoked token (permanent, re-register) or flood-wait (temporary, recovers by itself).
- **Yarn 4 + Prisma** — always `nodeLinker: node-modules` in `.yarnrc.yml`.

---

**License**: private / proprietary.
