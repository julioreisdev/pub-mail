# Estudo — Pagamento (PIX) no Webchat, reaproveitando o que existe no Telegram

> Set/2026. Só estudo — nada implementado. Base: leitura de `back/src/telegram/telegram-payment*.ts`, `back/src/webchats/*`, `front/.../webchat/{PublicWebchat,FunnelBuilder,WebchatBuilder}.jsx`, `funnel-utils.js`, `ai-micro-services/src/services/webchat.service.js`.

## 1. O que o Telegram já tem (e o que dá pra reaproveitar)

| Peça | Arquivo | Reusável? |
|---|---|---|
| Abstração de gateway PIX (`createPixCharge/getChargeStatus/testProvider/extractWebhookChargeId`, Mercado Pago + PushinPay, status normalizado `PENDING/PAID/EXPIRED/FAILED`) | `telegram-payment-providers.ts` | **100%** — zero dependência de Nest/Telegram. Só generalizar `opts.tgUserId` → `opts.payerRef`. |
| Settings do gateway (1 linha **por org**: provider, token, `checkout_config`; token mascarado na leitura; update parcial) | `telegram_payment_settings` + `getSettings/saveSettings/testSettings/requireSettings` | **Sim** — já é config da org, não do bot. Só o nome da tabela/rota é "telegram". |
| Planos (nome, preço em centavos, duração, entrega) | `telegram_plans` | Parcial — `bot_id`/`deliver_group_id` são do Telegram. |
| Cobrança (`startCharge` passos 1–4: valida settings → plano → `createPixCharge` → grava `PENDING` com `expires_at=+30min`) | `telegram-payments.service.ts:264-300` | **Sim** (o resto do método é UI do Telegram). |
| `checkPayment` → `markPaidAndDeliver` → `grantSubscription` | `:403-515` | Sim (menos `deliver`, que é invite link + mensagens). |
| Webhook público que **reconfere na API** antes de entregar + poller 1 min (`reconcilePending`) | `telegram-payments-webhook.controller.ts`, `runner.ts` | Sim — mas o lookup `handleWebhookCharge` busca só em `telegram_payments`. |
| Vendas/assinantes paginados | `listPayments/listSubscriptions` | Sim (com coluna de canal). |

**Específico do Telegram (não reaproveita):** `sendPlanList`, render do PIX via `sendPhoto`/`<pre>`/`copy_text`, `deliver` (invite link 1 uso, mídia, edita mensagem), `sendNotPaidNudge`, `expireMessage`, kick de grupo na expiração, `bumpForContact`, callbacks `pay:/paycheck:/paycancel:`, identidade `bot_id+tg_user_id`.

**Dívidas achadas no código do Telegram (corrigir ao extrair o core):**
1. Entrega **não é atômica** (`markPaidAndDeliver` lê `delivered` e só grava no fim) — webhook + cron + "Já paguei" simultâneos podem entregar 2×. Fix: `updateMany({where:{id, delivered:false}})` como trava.
2. `sendNotPaidNudge` espalha `{inline_keyboard}` sem `reply_markup` → os botões "Já paguei"/"Gerar novo PIX" desse aviso provavelmente **não aparecem**.
3. Webhook **sem assinatura** (MP manda `x-signature`; coluna `webhook_secret` existe e não é usada). Mitigado pela reconferência na API, mas vale validar.
4. MP: sem `notification_url` (webhook só pelo painel) e sem `date_of_expiration` (os 30 min são só locais); `X-Idempotency-Key` aleatório (não idempota).
5. Token do gateway em **texto puro** — existe `social-accounts-crypto.service.ts` (AES-256-GCM) pra reaproveitar.
6. `pix_key` gravada e nunca usada.

## 2. Como o webchat funciona (o que restringe o desenho)

- **Dois modos.** *Funil* roda **100% no browser** (`personalizacao.funil`, sem estado no servidor, reload = recomeça). *IA* vai browser → back → micro; estado só em `webchat_sessions{lead_state, conversation_history}`; saída da IA é JSON fixo `{reply, captured_fields, release_chat, options}`.
- **Sessão** = id gerado no `localStorage` (`webchat_session:<domínio>:<slug>`), sem cookie. Rotas públicas em `/public/webchat/:slug/*`, resolvidas por `?domain=`.
- **`GET config` expõe `settings` inteiro + `ia_config` do agente** → **nenhuma credencial/preço "de verdade" pode viver em `settings`**; preço tem que vir do banco no momento da cobrança.
- **Botões são `<a>` reais** e, com `href`, o click **não passa por JS** (regra pra scripts de anúncio interceptarem). Um botão "Pagar" precisa ter `href` vazio pra cair no handler.
- **Whitelists** em `funnel-utils.js` (`normalizeMessage` só `text|image|audio`; ações só `goto|redirect|end|send_to_ai` — desconhecido vira `goto` no save do builder). Qualquer tipo novo entra ali primeiro.
- **Prompt do modo IA proíbe cobrar** ("NÃO cobra, NÃO processa pedido… NUNCA executa a operação final") — checkout via IA exige revisar isso.
- Domínios de cliente são vhosts que servem a SPA com `try_files → index.html` → **qualquer rota nova da SPA funciona em todo domínio** sem mexer no nginx.
- Sem throttling nas rotas públicas; cobrança de tokens por mensagem está desligada (`tokenCost = 0`).
- Split/redirect **perdem a query string** (UTM/click id) — importa pra atribuição de venda.

## 3. Opções de arquitetura

### A) Checkout **inline no chat** (bolha PIX) — recomendada como principal
Espelha o Telegram: ao acionar "Comprar X", o back cria a cobrança e o front renderiza uma **bolha PIX** (QR em base64 + copia-e-cola com botão copiar + contador de 30 min + botões "Já paguei" / "Cancelar"). O front faz **polling** do status (3–5 s) e, ao `PAID`, toca a **entrega** (mensagem/link/redirect/libera IA). Prós: zero atrito, mesma UX dos dois canais, reaproveita 80% do core. Contras: precisa de estado de pagamento no servidor (o funil hoje não tem) e de polling.

### B) Página de checkout dedicada (`/webchat/:slug/checkout/:paymentId`)
Rota nova na SPA (funciona em todo domínio). O funil só redireciona. Prós: melhor no mobile (abrir app do banco e voltar), link compartilhável/reabrível, fica fora do fluxo de anúncios. Contras: quebra a conversa; sessão precisa ir na URL.
→ Vale como **complemento** da A (botão "Abrir em página" / fallback quando a bolha expira).

### C) Checkout hospedado do gateway (MP Checkout Pro etc.)
Só um link. Não usa a abstração PIX, sem controle de UX, entrega depende de webhook. Descartar, exceto como "modo simples" futuro.

## 4. Desenho proposto (Opção A + B como fallback)

### Backend — extrair um módulo compartilhado `payments`
- `back/src/payments/pix-providers.ts` ← mover `telegram-payment-providers.ts` sem mudar lógica (`tgUserId`→`payerRef`). Telegram passa a importar daqui.
- **Gateway por org, único pros dois canais:** reaproveitar `telegram_payment_settings` como a config da org (leitura pelos dois módulos) e, num 2º passo, renomear pra `payment_settings` + rota `/payments/settings`. Motivo: no Mercado Pago a URL de webhook é **uma por aplicação** (painel) → precisa de **um webhook único** `POST /payments/webhook/:provider` que procure a cobrança em `telegram_payments` **e** `webchat_payments` (ou tabela única `payments` com `channel`). Manter `/telegram/payments/webhook/:provider` como alias.
- Tabelas novas (mesmo padrão utf8mb4_unicode_ci, FK em SQL):
  - `webchat_products` — `organization_id`, `webchat_id?` (null = disponível em todos os webchats da org), `name`, `description`, `price_cents`, `active`, `position`, **entrega**: `deliver_type` (`message`|`redirect`|`link`|`release_ai`), `deliver_message` (HTML), `deliver_url`, `deliver_media` JSON; `duration_days` (0 = avulso; só se fizer sentido "acesso por tempo").
  - `webchat_payments` — `organization_id`, `webchat_id`, `session_id`, `lead_id?` (+ `email_lead_id?`), `product_id?`, `provider`, `provider_charge_id`, `amount_cents`, `status`, `pix_code`, `qr_base64`(ou regenerar), `payer_name/email/phone`, `expires_at`, `paid_at`, `delivered`, `delivered_at`, `context` JSON (domain, page_url, utm).
- Endpoints **públicos** (mesmo padrão `?domain=`):
  - `POST /public/webchat/:slug/checkout {product_id, session_id, name?, email?, phone?}` → valida produto ∈ org/webchat, **preço do banco**, cria cobrança → `{payment_id, pix_code, qr_base64, amount_label, expires_at}`.
  - `GET /public/webchat/:slug/checkout/:paymentId?session_id=` → `{status, delivery?}` (só devolve a entrega quando `PAID`; `paymentId` é UUID e é amarrado ao `session_id`).
  - `POST .../checkout/:paymentId/check` → força `checkPayment` (botão "Já paguei").
  - `POST .../checkout/:paymentId/cancel`.
- Endpoints **admin** (JWT): `/webchat-products` CRUD, `/payments/sales?channel=webchat|telegram`, `GET/PUT /payments/settings` (o mesmo do Telegram).
- Segurança: rate-limit nas rotas públicas de checkout (não existe throttler — `@nestjs/throttler` ou contador por IP/sessão no Redis), no máx. N cobranças PENDING por sessão, valor nunca vem do cliente, entrega atômica (`updateMany delivered:false`), validar `x-signature` do MP quando `webhook_secret` estiver preenchido.
- Lead: **exigir e-mail ou telefone antes do PIX** (o funil já tem `leadCapture`; MP pede `payer.email`). Cobrança fica ligada ao lead e o lead segue o roteamento normal (`email_project_id`). Ao pagar: tag/atributo `paid:<produto>` no lead → destrava segmentação/gatilhos de e-mail já existentes.

### Front — funil (fase 1)
- `funnel-utils.js`: nova ação de opção `checkout {productId}` (whitelist + campos) e novo tipo de mensagem/bolha `pix` gerada em runtime (não salva no funil).
- `FunnelBuilder.jsx`: ação **"Vender produto"** com `SearchSelect` de produtos; seção "Após o pagamento" (usa a entrega do produto ou uma sequência `nextSequenceIdOnPaid`).
- `PublicWebchat.jsx`: em `handleFunnelOptionClick`, `checkout` → chama o endpoint → bolha PIX (QR, código com "Copiar", timer, "Já paguei", "Cancelar", "Abrir em página") + polling → `PAID` → toca entrega (mensagem/redirect via âncora real/`release_ai` = `setFunnelExited(true)`) → `goto` da sequência pós-pago. Persistir `payment_id` no `localStorage` da sessão pra sobreviver ao reload (hoje o funil recomeça do zero).
- `dataLayer`: `webchat_checkout_start` / `webchat_paid` (mesmo padrão do quiz) pra GTM/pixel.
- UI de produtos: aba **"Produtos"** na página Webchats (ou item de sidebar **"Pagamentos"** global com abas Gateway · Produtos (webchat) · Planos (telegram) · Vendas · Assinantes).

### Front — modo IA (fase 2)
Duas formas, da mais segura pra mais "mágica":
1. **Botões, não IA:** o agente ganha lista de produtos vendáveis; o back injeta `options` do tipo `{text:"Comprar X", action:'checkout', productId}` quando a IA sinaliza intenção (`"intent":"buy"` ou por regra). A IA nunca cria cobrança.
2. **Saída estruturada:** campo `"checkout": {"product_id"}` no contrato JSON do micro (`webchat.service.js:492-498`), validado contra a lista de produtos do agente; o back cria a cobrança e devolve `data.checkout` → front renderiza a bolha. Exige revisar o prompt que proíbe cobrar e tratar alucinação (id inexistente ⇒ ignora).

## 5. Fases sugeridas
1. **Core compartilhado + funil** (1 deploy grande ou 2): mover providers, webhook unificado, tabelas, endpoints públicos, bolha PIX, produtos no builder, vendas com coluna canal. Corrigir as 6 dívidas do Telegram no caminho.
2. **Modo IA** (botões → depois saída estruturada).
3. **Extras:** página de checkout dedicada/compartilhável, e-mail de confirmação (reusar `sendWelcomeToLead`/template do projeto), "acesso por tempo" se houver algo a expirar no webchat, MP `date_of_expiration` + `notification_url` por cobrança.

## 6. Decisões que precisam do dono
1. Inline (A) como principal, com página (B) só como fallback? 
2. Gateway **único por org** compartilhado com o Telegram (recomendado) ou credenciais separadas por canal?
3. O que é "entrega" no webchat: mensagem + link/redirect, liberar a IA, e-mail com o acesso — quais entram na fase 1?
4. Exigir e-mail/telefone antes do PIX (recomendado) ou permitir anônimo com e-mail placeholder (como o Telegram)?
5. Modo IA na fase 1 ou 2? Se sim, botões (seguro) ou saída estruturada?
6. Onde fica a UI: aba na página Webchats ou menu "Pagamentos" unificado?
7. Cobrar tokens do Pub Mail por venda/cobrança (billing interno está desligado hoje)?
