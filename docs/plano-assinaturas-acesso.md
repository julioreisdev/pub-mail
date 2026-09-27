# Plano — Acesso por módulos + assinatura paga (PIX) por cliente

Data: 26/09/2026 · Status: **ENTREGUE (Fases 1–3 deployadas em 26/09/2026; Fase 4 parcial)** · Dono: Júlio

## 1. O que foi pedido (resumo fiel)

1. Em **Administração → Usuários** o superadmin cria usuários e escolhe **quais módulos** o usuário acessa: Email Marketing, Quiz, Webchat, Telegram, Configurações. **Administração** nunca aparece pra ninguém além do SUPER_ADMIN.
2. Na criação também define **preço** do acesso e se é **por período** (N dias, o superadmin digita o número) ou **vitalício**.
3. No **primeiro login**: custo zero → **modal de boas-vindas**; custo > 0 → **modal de pagamento** (QR Code, copia-e-cola, botão copiar, botão **Validar pagamento**, validação automática também). O modal **trava a tela**: trocar a URL na mão não escapa. Só entra depois de pagar.
4. Por período: os dias contam **a partir do pagamento**; ao vencer, o modal volta e bloqueia de novo. Vitalício: paga uma vez.
5. Modais **bonitos e profissionais**.
6. **Administração → Pagamentos**: configurar o gateway (Mercado Pago ou PushinPay) **do superadmin** (separado do gateway das organizações) e uma **dashboard** de assinaturas (status), valores recebidos, filtros.

## 2. Como encaixa no que já existe (o que reaproveito)

| Já existe | Uso no plano |
|---|---|
| `back/src/payments/pix-providers.ts` (`createPixCharge`, `getChargeStatus`, `cancelCharge`, `testProvider`, `extractWebhookChargeId`; MP + PushinPay) | Gera/valida o PIX da assinatura. **Zero código novo de gateway.** |
| Webhook único `POST /payments/webhook/:provider` (procura a cobrança em webchat → telegram, reconfere na API) | Ganha um 3º lookup: `platform_payments`. Como o MP só aceita **uma URL por aplicação** e a conta do superadmin é outra aplicação, a URL é a mesma e funciona. |
| `PaymentsSettingsService` (gateway por org, token mascarado, `cleanToken`, teste) | Copio o padrão pra um `PlatformBillingSettingsService` (singleton da plataforma). |
| Bolha PIX do webchat (`PixPanel`/`PixCountdown` em `PublicWebchat.jsx`) + aba Vendas (`PaymentsSettings.jsx`) | Referência visual/lógica de QR + countdown + polling + "Validar"; e da tabela com filtros/paginação. |
| `AdminService.createOrganization` (org + wallet + usuário admin numa transação) e `createUser` | O "Novo usuário" do admin passa a criar **conta (org) + usuário + plano de acesso** numa transação. |
| `JwtStrategy` com cache de 60 s de "ainda pode usar?" (A-09) | Mesmo cache passa a carregar **módulos + status da assinatura** → gating no back sem custo por request. |
| `MenuList` filtra grupos por `requiredRole`; `RequireAdmin` guard de rota | Viram filtro por **módulo** (`requiredModule`) + `RequireModule` guard. |
| `/auth/me` → `{ user, organization }` | Ganha `access: { modules, status, plan, needs_payment, welcome_pending, access_until }`. |
| Org oculta `SuperAdmin` + role SUPER_ADMIN | **Bypass total** do gating (nunca é cobrado, vê tudo). |

## 3. Decisões de modelo (as que precisam do seu OK)

**D1 — Onde vive o plano: na CONTA (organização), não no usuário.**
Todo dado do sistema é escopado por `organization_id`. Se o plano fosse por usuário, dois usuários da mesma org (um pago, outro não) veriam os mesmos dados — não faz sentido. Então: **1 cliente = 1 organização = 1 plano**, e o usuário criado é o dono dela. Na UI do admin continua chamando "usuário"/"cliente" (o superadmin não precisa saber que existe org por trás). "Adicionar usuário a uma conta existente" continua possível e ele **herda** os módulos/assinatura da conta.
→ Se você quiser mesmo por usuário, dá pra fazer, mas o bloqueio vira "quem paga entra, o colega da mesma conta não" com os mesmos dados. Recomendo por conta.

**D2 — Módulo "Configurações".** O grupo Settings hoje tem Conta, Domínios, Integrações (chaves de IA/Resend), Pagamentos (gateway da org), Status da API, Tutorial. Sem Integrações o cliente não cadastra chave de IA/Resend → Webchat e E-mail ficam inúteis. Proposta: o módulo "Configurações" liga/desliga o grupo inteiro como você pediu, **mas** eu aviso no modal de criação ("sem Configurações o cliente não cadastra chaves de IA/Resend/domínios"). Alternativa: deixar **Conta + Integrações + Domínios sempre visíveis** e "Configurações" controlar só Pagamentos/API. Qual?

**D3 — Renovação: quando conta o novo período.** Vencido → paga → `access_until = paid_at + dias` (como você pediu). Se o cliente pagar **antes** de vencer (vou mostrar aviso "vence em 3 dias" com botão Renovar), proponho `access_until = access_until_atual + dias` (não perde dias). OK?

**D4 — Automações de conta bloqueada.** Cron de e-mail, fluxos, broadcasts do Telegram, rotativas etc. rodam no servidor mesmo com o cliente sem logar. Conta **vencida/pendente** deve continuar disparando? Proponho **pausar** (os runners pulam orgs sem acesso ativo) — senão o cliente "usa" sem pagar. Fica como fase própria, dá pra ligar depois.

**D5 — Mudar preço/período de uma conta já ativa.** Módulos: efeito imediato. Preço/dias: valem **na próxima cobrança** (não interrompe quem já pagou). Botões extras no admin: "Estender N dias", "Marcar como pago (manual)", "Bloquear agora". OK?

**D6 — Validade do PIX**: 30 min (igual webchat/Telegram). Expirou → botão "Gerar novo PIX" no modal.

**D7 — Contas já existentes** (hoje só a `SuperAdmin`, banco limpo): migration cria acesso **FREE + todos os módulos** pra qualquer org existente, então nada quebra em produção.

## 4. Modelo de dados (migration `20260927100000_add_platform_billing`)

```
organization_access            (1 por org — o "plano" da conta)
  organization_id  CHAR(36) PK FK→organizations CASCADE
  modules          JSON      ['email','webchat','quiz','telegram','settings']
  price_cents      INT       0 = grátis
  period_days      INT NULL  NULL = vitalício
  status           VARCHAR(16) FREE | PENDING | ACTIVE | EXPIRED | BLOCKED
  access_until     DATETIME(3) NULL   (só por período)
  first_paid_at    DATETIME(3) NULL
  last_paid_at     DATETIME(3) NULL
  welcomed_at      DATETIME(3) NULL   (modal de boas-vindas já visto)
  notes            VARCHAR(255) NULL
  created_at / updated_at

platform_payments              (cobranças de assinatura — espelho de webchat_payments)
  id, organization_id FK CASCADE, user_id (quem gerou), provider, provider_charge_id,
  amount_cents, period_days_snapshot INT NULL, status PENDING|PAID|EXPIRED|FAILED|MANUAL,
  pix_code TEXT, qr_base64 LONGTEXT, expires_at, paid_at, created_at, updated_at
  índices: (organization_id, created_at), (provider_charge_id), (status)

system_settings (singleton id=1) — gateway DO SUPERADMIN (separado do das orgs)
  + billing_provider      VARCHAR(32)  default 'mercadopago'
  + billing_access_token  TEXT NULL
  + billing_active        BOOLEAN default false
```
Tabelas novas com `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` (gotcha da FK). `admin.removeOrganization` passa a apagar `organization_access` + `platform_payments`.

Constantes: `MODULES = ['email','webchat','quiz','telegram','settings']` (`back/src/common/modules.ts`), com rótulos no front.

## 5. Backend

### 5.1 Módulo novo `back/src/platform-billing/`
- `platform-billing-settings.service.ts` — get/save/test do gateway do superadmin (token nunca volta cru; `cleanToken`; `require()` devolve null se não pronto). Lê/grava `system_settings`.
- `access.service.ts` — regras da conta:
  - `getAccess(orgId)` → `{ modules, status, price_cents, period_days, access_until, needs_payment, welcome_pending }` (com cache 60 s em memória, invalidado nos writes).
  - `needs_payment` = `status ∈ {PENDING, EXPIRED, BLOCKED}`; `welcome_pending` = `welcomed_at == null && !needs_payment`.
  - `upsertPlan(orgId, {modules, price_cents, period_days})` — chamado pelo admin. Regras: preço 0 → `FREE`; preço > 0 e nunca pagou → `PENDING`; ativo → mantém status (preço/dias valem na próxima cobrança).
  - `markPaid(orgId, payment)` — transição atômica (`updateMany` com status ≠ PAID no pagamento); calcula `access_until` (D3); `status = ACTIVE`; vitalício → `access_until = null`.
  - `expireDue()` — cron **a cada hora**: `ACTIVE && access_until < now` → `EXPIRED`.
  - Ações admin: `extend(orgId, days)`, `markManualPaid(orgId)`, `block(orgId)`, `unblock`.
- `platform-payments.service.ts` — espelho do `WebchatPaymentsService`:
  - `createCharge(orgId, userId)` — reaproveita PENDING válido; `createPixCharge(provider, token, price_cents, 'Pub Mail — acesso <N dias|vitalício>', { payerRef: orgId, email: user.email, name, webhookUrl, idempotency: 'pb-<org>-<minuto>' })`; grava `platform_payments`; expira em 30 min.
  - `check(paymentId, orgId)` — reconfere no gateway (máx. 1×/2 s por cobrança), PAID → `access.markPaid`.
  - `handleWebhookCharge(provider, chargeId)` — plugado no webhook único (3º lookup).
  - `reconcilePending()` — cron 1 min (expira vencidas, reconfere pendentes, revisita EXPIRED 24 h) — copiar do webchat.
  - `sales(filters)` — lista paginada + KPIs (receita total, mês atual, por status, série mensal) pra dashboard.
- `access.guard.ts` — **guard global** (`APP_GUARD`, depois do Throttler): 
  - ignora rotas `@Public()`, webhooks, `/auth/*`, `/billing/*` (o próprio fluxo de pagamento), `/dashboard/overview`, `/profile`.
  - `SUPER_ADMIN` → sempre passa.
  - `needs_payment` → **402 Payment Required** `{ code: 'PAYMENT_REQUIRED' }` em tudo que não é whitelist (é isso que impede "trocar a URL na mão": o front pode até renderizar a rota, mas nenhuma API responde).
  - módulo: mapa **prefixo de rota → módulo** (`/email*`, `/project-schedules*`, `/email-project-leads*` → email; `/webchats*`, `/agentes*`, `/webchat-*`, `/ia-integrations*`, `/public/...` não (público) → webchat; `/quizzes*`, `/quiz-*` → quiz; `/telegram*` → telegram; `/system-settings*`, `/payments/settings*`, `/payments/sales`, `/domains*`, `/organizations*`, `/users*` → settings). Sem o módulo → **403** `{ code: 'MODULE_DISABLED', module }`. Rota fora do mapa → passa (dashboard, leads agregados etc.).
  - lê do `AccessService.getAccess` (cache 60 s — mesmo padrão do `JwtStrategy`).
- Controllers:
  - **Cliente (JWT)** `/billing`: `GET /billing/me` (access + cobrança pendente atual, se houver), `POST /billing/charge` (gera/reaproveita PIX; `@Throttle 10/min`), `GET /billing/charge/:id` (status; polling), `POST /billing/charge/:id/check` (Validar; `@Throttle 30/min`), `POST /billing/welcome-seen`.
  - **Admin (SUPER_ADMIN)** `/admin/billing`: `GET/PUT settings`, `POST settings/test`, `GET subscriptions?status&q&page&page_size` (join org + owner + último pagamento), `PATCH subscriptions/:orgId` (modules/price/period), `POST subscriptions/:orgId/extend {days}`, `POST subscriptions/:orgId/mark-paid`, `POST subscriptions/:orgId/block|unblock`, `GET payments?status&from&to&q&page`, `GET overview?from&to` (KPIs + série mensal).
- Webhook: `PaymentsWebhookController` ganha `platform.handleWebhookCharge` como 3º lookup. Módulo `PlatformBillingModule` exportado pro `PaymentsModule`.

### 5.2 Admin (usuários) — `admin.service/controller`
- `CreateOrganizationDto` e um novo **`CreateClientDto`** (`name`, `email`, `password`, `modules[]`, `price_cents`, `period_days|null`, `org_name?`) → `POST /admin/clients` cria org + wallet + usuário OWNER + `organization_access` **na mesma transação**. (O `POST /admin/users` antigo continua pra adicionar usuário numa conta existente — herda o plano.)
- `GET /admin/users` e `GET /admin/organizations` passam a devolver `access` (módulos, status, preço, vencimento) pra tabela.
- `UpdateAdminUserDto`/org: `PATCH /admin/billing/subscriptions/:orgId` cobre módulos/preço/período (não misturo no DTO do usuário).
- Whitelist do `ValidationPipe`: DTOs com `@IsArray() @IsIn(MODULES, {each:true})`, `@IsInt() @Min(0)` preço, `@IsInt() @Min(1)` dias ou null.

### 5.3 `/auth/me`
Inclui `access` (via `AccessService.getAccess`). SUPER_ADMIN → `{ modules: ALL, status: 'FREE', needs_payment: false, welcome_pending: false, super: true }`.

### 5.4 Cron
- `PlatformBillingRunner`: `@Cron(EVERY_MINUTE)` reconcile de cobranças; `@Cron(EVERY_HOUR)` expira acessos vencidos.
- (D4, fase separada) helper `AccessService.isActive(orgId)` pra runners de e-mail/Telegram/webchat pularem contas sem acesso.

## 6. Front-end

### 6.1 Contexto de acesso
- `AuthContext` expõe `access` (de `/auth/me`) + `refreshAccess()` (re-busca `/auth/me`).
- Hook `useAccess()` → `{ modules, has(module), needsPayment, welcomePending, status, accessUntil, plan }`.
- `api.js`: interceptor trata **402** → dispara `refreshAccess()` (o `AccessGate` reage e mostra o modal) e **403 `MODULE_DISABLED`** → toast "Módulo não incluído no seu plano" + navega pro dashboard.

### 6.2 `AccessGate` (dentro do `MainLayout`, antes do `<Outlet/>`)
- `needsPayment` → renderiza **`PaymentLockScreen` no lugar do `<Outlet/>`** (não é só um modal por cima: a página nem monta). Sidebar fica visível mas desabilitada/opaca (dá contexto de "isto é o app"), sem cliques. Trocar URL → mesmo gate → mesma tela. `Dialog` com `disableEscapeKeyDown`, sem `onClose`, `fullScreen` no mobile.
- `welcomePending` → `WelcomeModal` por cima do dashboard; "Começar" → `POST /billing/welcome-seen` → some pra sempre (persistido no servidor, não em localStorage).
- Banner discreto no topo quando `accessUntil` está a ≤ 3 dias: "Seu acesso vence em X dias · Renovar agora" (abre o mesmo fluxo PIX sem bloquear).

### 6.3 `PaymentLockScreen` / `PixCheckoutCard` (componente reusado no banner de renovação)
- Layout: card centralizado ~480 px, logo "Pub Mail", título "Ative seu acesso" (ou "Renove seu acesso"), resumo do plano (chips dos módulos, "R$ 97,00 · 30 dias" ou "· vitalício"), **QR Code** (img base64 do gateway; se o provider não devolver, gerar com `qrcode` lib a partir do copia-e-cola), campo copia-e-cola truncado + botão **"Copiar código PIX"** (clipboard com fallback `execCommand`, feedback "Copiado ✓"), botão primário **"Já paguei — validar"** (POST check; trava 2 s; mensagem "Ainda não identificamos o pagamento" quando não), **countdown 30 min** (ao zerar → "PIX expirado" + "Gerar novo PIX"), texto "Validamos automaticamente em segundos após o pagamento", link "Sair" (logout).
- Polling `GET /billing/charge/:id` a cada 5 s enquanto PENDING; PAID → animação de sucesso (check em círculo, confete leve) → "Acesso liberado até DD/MM/AAAA" → `refreshAccess()` → gate abre.
- Estados: sem gateway configurado pelo superadmin → tela "Pagamento indisponível no momento, fale com o suporte" (não pode dar erro cru).
- Visual: fundo com o mesmo gradiente navy do login (`LoginShowcase`), card claro, tipografia Ubuntu, dark mode via `theme.vars`. Mobile: fullScreen com scroll.

### 6.4 `WelcomeModal`
- Marca + "Bem-vindo(a), {nome}!" + "Sua conta está pronta." + grade dos módulos liberados (ícone + nome + 1 linha do que faz: os mesmos itens do login showcase) + CTA "Começar" (+ opcional "Ver tutorial" → `/settings/api-tutorial` se tiver settings).

### 6.5 Menu e rotas por módulo
- `menu-items/*.js`: cada grupo ganha `requiredModule: 'email'|'webchat'|'quiz'|'telegram'|'settings'` (dashboard e leads sem). `MenuList` filtra por `requiredRole` **e** `requiredModule` (`has(module)`); SUPER_ADMIN vê tudo.
- `routes/RequireModule.jsx` (`<RequireModule module="email"/>`) envolvendo os blocos `email`, `webchat`, `quizzes`, `telegram`, `settings`, `posts`, `ia-content` em `MainRoutes` → sem módulo → `Navigate /dashboard` + toast.
- Dashboard: cards só dos módulos liberados; card "Módulos do seu plano" com status/vencimento.
- Item **Leads**: visível se `email || webchat || quiz`; as origens do seletor filtradas pelos módulos.

### 6.6 Admin → Usuários (`views/pages/admin/Users.jsx`)
- Botão principal vira **"Novo cliente"** (cria conta + usuário + plano) com dialog em 2 seções: **Dados** (nome, e-mail, senha, nome da conta opcional = nome) e **Acesso** (multi-select de módulos com chips e descrição; `MoneyField` R$ — reusa o estilo do funil; toggle "Vitalício / Por período" + campo "Dias" com atalhos 30/90/365; prévia "R$ 97,00 a cada 30 dias" / "R$ 0 — acesso gratuito"; aviso da D2 quando Configurações desmarcado).
- Tabela de usuários ganha colunas **Módulos** (chips compactos), **Plano** (R$ + período), **Status** (pill: Grátis / Aguardando pagamento / Ativo até DD/MM / Vencido / Bloqueado). Ações extras no menu `⋮`: "Editar acesso" (mesmo form de Acesso → `PATCH /admin/billing/subscriptions/:orgId`), "Estender dias", "Marcar como pago", "Bloquear/Desbloquear".
- "Novo usuário" (adicionar a conta existente) continua, mostrando "herda o plano da conta X".

### 6.7 Admin → Pagamentos (`/admin/payments`, `views/pages/admin/Payments.jsx`, item `admin-payments` com `IconCreditCard`, `requiredRole: 'SUPER_ADMIN'`)
- Aba **Gateway**: provedor (MP/PushinPay), token mascarado (só envia se digitado), Ativo, "Testar conexão", URL do webhook copiável, aviso "Este gateway recebe as **assinaturas do Pub Mail**; o gateway das organizações fica em Configurações → Pagamentos de cada cliente".
- Aba **Assinaturas** (dashboard): KPIs (Receita total · Receita no período · Ativas · Aguardando pagamento · Vencidas · MRR estimado = soma de `price_cents×30/period_days` das ativas), gráfico de receita por mês (apexcharts, como Analytics), tabela: cliente (nome/e-mail/conta), módulos, plano, status, pago em, vence em, total pago; filtros: status, busca, período (hoje/7d/30d/personalizado), paginação "Mostrando X–Y de N"; ações inline (estender, marcar pago, bloquear, editar acesso).
- Aba **Cobranças**: todas as `platform_payments` com status/valor/cliente/provedor/data + filtros.

## 7. Segurança / regras
- Preço e período **sempre lidos do banco** na hora de gerar o PIX (o cliente não manda valor).
- Token do gateway do superadmin nunca sai cru; `RolesGuard SUPER_ADMIN` em `/admin/billing/*`.
- Transição PENDING→PAID atômica; webhook forjado não fura (sempre reconfere na API com o token da plataforma).
- `AccessGuard` no back é a trava real; o front só melhora a experiência.
- Rate limit nos endpoints do cliente (charge 10/min, check 30/min).
- Logs: `platform-billing` loga criação/pagamento/expiração com `orgId` (sem token).

## 8. Checklist de execução (ordem de deploy)

### Fase 0 — decisões (RESPONDIDAS em 26/09/2026)
- [x] D1 **plano/pagamento por organização**; **módulos por USUÁRIO** (`users.modules`) — numa mesma conta um usuário pode ter Configurações e outro não. O superadmin escolhe os módulos em cada usuário.
- [x] D2 "Configurações" liga/desliga o grupo inteiro, como pedido (aviso no cadastro).
- [x] D3 renovação **sempre conta do dia do pagamento**: `access_until = paid_at + period_days` (não soma ao vencimento anterior).
- [x] D4 **vencido = tudo para** (crons de e-mail/fluxos/gatilhos/A-B, Telegram broadcasts/automações/rotativas/fluxo, webchat e quiz públicos → "temporariamente indisponível"). Aviso a partir de **3 dias antes, no máx. 2× por dia** (modal dispensável com "Renovar agora").
- [x] D5 preço/período novos valem na próxima cobrança.
- [x] D6 sem link de suporte no modal.

### Fase 1 — backend base (DEPLOYADA 26/09/2026, E2E 37/37 em produção)
- [x] Migration `20260927100000_add_platform_billing`: `organization_access`, `platform_payments`, `users.modules`+`welcomed_at`, `system_settings.billing_*` (backfill: orgs existentes FREE, usuários existentes com todos os módulos)
- [x] `platform-billing/modules.const.ts` (lista + mapa rota→módulo + rotas abertas)
- [x] `PlatformBillingModule` (@Global): `AccessService` (cache 60 s, estado ao vivo), `PlatformBillingSettingsService` (gateway do superadmin em `system_settings`), `PlatformPaymentsService` (PIX + reconcile + overview + lista), `SubscriptionsService`, `PlatformBillingRunner`, `AccessInterceptor` (APP_INTERCEPTOR: 402 `PAYMENT_REQUIRED` / 403 `MODULE_DISABLED`), controllers `/access` e `/admin/billing`
- [x] `/auth/me` devolve `access`
- [x] `POST /admin/clients` (org + wallet + usuário + plano + módulos em transação); `modules` em `POST/PATCH /admin/users`; `GET /admin/users|organizations` com `access`; `removeOrganization` apaga as 2 tabelas; `/auth/register` cria usuário sem módulos
- [x] Webhook único com o 3º lookup (`platform_payments`)
- [x] "Vencido = tudo para": webchat/quiz públicos 503; runners de e-mail (schedules, welcome, flows, A/B, gatilhos, e-mail do quiz) e Telegram (webhook flow/pagamentos, broadcasts dispatcher+worker, automações, rotativas, VIP expiry/reminder) pulam org inativa
- [x] E2E em produção (org temporária, apagada no fim): PENDING→402, mark-paid→ACTIVE 30d, 403 por módulo, liberar módulo, estender, bloquear/desbloquear, trocar plano, vencimento ao vivo, listagens, cliente grátis + welcome-seen

### Fase 2 — front do cliente (DEPLOYADA 26/09/2026)
- [x] `AuthContext.refreshAccess` + `hooks/useAccess` + `api.js` (eventos 402/403)
- [x] `layout/MainLayout/AccessGate.jsx` + `views/pages/access/{PaymentLockScreen,PixCheckoutCard,WelcomeModal,RenewalReminder}.jsx` + `modules.js`
- [x] Menu por módulo (`requiredModule`), `routes/RequireModule.jsx` nas rotas email/settings/webchat/quizzes/telegram/posts/ia-content, dashboard filtrado + card "Seu acesso", Leads filtrado, hooks `useWebchats/useQuizzes/useEmailProjects` só buscam com o módulo
- [x] Screenshots (Chrome headless + CDP com tokens injetados): tela de PIX desktop/mobile/dark, boas-vindas, lembrete de renovação

### Fase 3 — front do admin (DEPLOYADA 26/09/2026)
- [x] `admin/Users.jsx`: "Novo cliente" (dados + módulos + preço + vitalício/dias), "Adicionar usuário a uma conta", colunas Módulos/Plano/Acesso, ação "Acesso" (módulos + plano + estender/marcar pago/bloquear); `admin/ModulesPicker.jsx`, `admin/PlanFields.jsx`
- [x] `admin/Payments.jsx` (`/admin/payments`, item "Pagamentos" no grupo Administração): Gateway / Assinaturas (KPIs + gráfico + tabela + ações) / Cobranças

### Fase 4 — extras
- [x] Runners pulam contas sem acesso ativo (feito na Fase 1)
- [ ] Aviso ao superadmin quando alguém paga (opcional, não feito)
- [x] Documentação: `CLAUDE.md`, memória, este plano; README (menção curta)
- [ ] `Deploy.md`/PDF: config do gateway da plataforma é feita pela UI (sem env nova) — nada a mudar no runbook

### Revisão pós-entrega (26/09/2026, 3 agentes revisores + correções deployadas)
- [x] Back (8 defeitos): bloqueio furado por PIX já aberto; extend em vitalício; org auto-registrada sem linha; FREE→pago marcava vitalício como vencido; construtor de funil bloqueado sem `settings` (`GET /payments/settings` isento); block inócuo em conta grátis; mark-paid sem cancelar PIX no gateway; erro transitório cacheando "sem módulos". + datas inválidas em from/to, `/me` aberto.
- [x] Front cliente (10 itens): 403 de módulo só toast; Leads/Domínios/hooks só consultam módulos liberados; corrida do login; card PIX (contador, `onPaid` estável, expirado só pelo servidor); WelcomeModal não trava; lint ES2022.
- [x] Front admin (7 itens + 3 extras): "Dias" não vira vitalício ao limpar; clamps de preço/dias/notas; paginação após filtro; erros stale; AccessDialog com reset/erro; "(desativada)" no select; aviso de desbloqueio no marcar pago; gráfico em modo system.
- [x] E2E ampliado (48 casos) passando em produção; screenshots pós-correção ok.

## Pós-deploy — a cargo do dono
- Seguir o **`Mercado Pago.pdf`** (raiz) e cadastrar o **token do gateway do superadmin** em Administração → Pagamentos → Gateway (Mercado Pago ou PushinPay), testar conexão e ativar. Sem isso a tela de PIX do cliente mostra "Pagamento indisponível no momento. Fale com o administrador." e nada é cobrado.
- Cliente que compra o acesso: criar em Administração → Usuários → "Novo cliente".

## 9. Pontos de atenção
- **MP de conta diferente**: o token do superadmin é de outra conta/aplicação; a `notification_url` que mandamos no `createPixCharge` já resolve o roteamento (não depende do painel do MP).
- **Cache de 60 s** do `AccessGuard`: após pagar, invalido o cache da org na hora (`markPaid`), então a liberação é imediata.
- **Usuário SUPER_ADMIN em org não-oculta**: bypass por role, não por org.
- **`ValidationPipe forbidNonWhitelisted`**: todo campo novo entra nos DTOs.
- **Sem tokens/billing antigo**: não toco em `wallets`/`transactions`/Stripe; o novo módulo é independente (o `wallet` continua sendo criado na org só porque o código legado exige).
