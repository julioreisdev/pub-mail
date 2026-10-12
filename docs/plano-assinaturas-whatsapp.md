# Plano — WhatsApp como plataforma de assinaturas com autoatendimento (12/10/2026)

Pedido do Júlio: o módulo WhatsApp precisa atender o modelo **"produto = assinatura; o cliente se cadastra pelo WhatsApp, vira cliente, recebe a cobrança sozinho (PIX e boleto), consulta os próprios dados pelo bot (por telefone ou CPF), cancela quando quiser"**, genérico o bastante para clínica, provedor de internet, loja, empresa de segurança, conteúdo VIP, prefeitura, mercado.

Diagnóstico (ver mapa de 42 lacunas no histórico de 12/10): hoje o CRM é **operado pelo atendente**. Falta identidade forte do cliente, autoatendimento no bot, motor de assinatura de verdade, cartão recorrente/outros gateways, "direito de acesso" ligado ao pagamento e API para o sistema do cliente. Este plano cobre tudo isso em 8 fases (a 6 é o **agendamento com pagamento** para salão, lava-rápido, clínica e afins — pedido explícito do Júlio em 12/10).

> **Regra deste plano (lição do plano do WhatsApp):** nada de "fazer depois"/"ver na hora". Toda fase traz tabela com colunas e tipos, endpoints com corpo, blocos do bot com `data`/portas/ações, telas com arquivos, lista de E2E e critério de aceite. Se algo não couber na fase, vai para a seção "Fora deste plano" com o motivo. Decisões em aberto têm **padrão recomendado**: o desenvolvimento segue com o padrão se o Júlio não responder.

## 0. Base já existente (não refazer)

- `whatsapp_products` (billing `once|monthly|quarterly|yearly`, preço fixo), `whatsapp_customers` (1 por `contact_id`, `doc`, `email`, `address` JSON, `custom` JSON, `status active|inactive`), `whatsapp_subscriptions` (`price_cents`, `billing`, `due_day` 1–28, `status active|overdue|paused|canceled`, `next_due_at`, `last_paid_at`, `canceled_at`), `whatsapp_charges` (PIX e/ou boleto, régua, `origin manual|recurring|bot`), `whatsapp_crm_settings` (`custom_fields`, `charge`, `pipeline`, `service`).
- Gateway por org em `telegram_payment_settings` (Mercado Pago / PushinPay), `pix-providers.ts` (`createPixCharge`, `createBoletoCharge` só MP `bolbradesco`, `getChargeStatus`, `cancelCharge`), webhook único `POST /payments/webhook/:provider` (ordem: webchat → telegram → bot WhatsApp → cobranças WhatsApp → plataforma).
- Bot: motor puro `wa-bot.engine.ts` (`start/message/menu/question/condition/tags/wait/pix/handoff/end`), runtime `whatsapp-bot.service.ts` (ações `typing/send/tags/save_contact/handoff/close/finish/pix/pix_check`), simulador, variáveis `{{cliente.*}}` (`WhatsAppCrmService.varsForChat`, só quando a conversa já é de um cliente), entrega tardia de PIX (`deliverLatePayment`).
- Multi-número (`session_id` em tudo; `wa-access.service.ts` com `allowed`), tempo real (`WhatsAppPresenter`), hooks (`WhatsAppHooks.emit/on`), notificações (`NotificationsService` via `hooks.emit(kind)`), funil (`onPaid`), LGPD (`opted_out_at`), criptografia em repouso (extensão do Prisma em `whatsapp_messages/chats/contact_statuses`).

## 1. Decisões (padrão recomendado em negrito; o Júlio pode mudar antes da fase correspondente)

| # | Decisão | Opções | Padrão |
|---|---|---|---|
| D1 | Identidade do cliente | documento obrigatório / opcional | **DECIDIDO (Júlio, 12/10): CPF/CNPJ opcional por padrão; a org pode marcar `require_doc` em Configurações → Clientes. Boleto e cartão continuam exigindo documento (regra do gateway, pedido na hora)** |
| D2 | Verificação antes de mostrar dados pelo bot | nenhuma / CPF / código | **DECIDIDO (Júlio, 12/10), o mais simples: org SEM `require_doc` → o número do WhatsApp identifica o cliente (vínculo em `whatsapp_customer_contacts`); org COM `require_doc` → o bot pede o CPF/CNPJ e confere com `doc_hash`. Sem OTP, sem data de nascimento. Número novo de um cliente é vinculado pela equipe no painel (ou pelo próprio CPF, quando exigido)** |
| D3 | Cancelamento pelo cliente | imediato / fim do ciclo / configurável | **DECIDIDO (Júlio, 12/10): configurável por produto (`cancel_policy`), padrão fim do ciclo; pergunta o motivo (lista editável)** |
| D4 | Pró-rata na entrada | sim / não | **configurável por produto, padrão sim (dia do vencimento fixo, 1ª cobrança proporcional)** |
| D5 | Trial | dias por produto | **`trial_days` por produto, padrão 0** |
| D6 | Cartão recorrente | MP Preapproval (link do MP) / Asaas (tokenização própria) | **Fase 4: Asaas como 2º gateway (PIX, boleto E cartão recorrente numa API só); MP Preapproval como alternativa quando a org só tem MP** |
| D7 | Nota fiscal | integrar (NFS-e por município é um pântano) / webhook de saída | **só webhook de saída `charge.paid` com todos os dados; NF fica no sistema do cliente ou em integrador (Fase 5)** |
| D8 | Conteúdo VIP no WhatsApp (grupo) | adicionar/remover participante pelo gateway | **sim, Fase 5; se o OpenWA não expuser a rota, patch no gateway como o de `baileys-events.js`** |
| D9 | Agendamento (salão, lava-rápido, clínica…) | pagar na reserva / sinal / no local / incluso no plano | **Fase 6: política por serviço (padrão pagar na reserva com PIX de 30 min); recurso = profissional/box/sala com capacidade; agenda dia/semana/lista no painel; sem sincronização bidirecional com Google (só feed ICS de leitura)** |
| D10 | Pedidos (loja/mercado) | carrinho no bot | **Fase 7, catálogo com itens e pedido simples (sem estoque)** |
| D11 | Juros/multa | sim | **por org: multa % + juros ao mês, aplicados na 2ª via; padrão 2 % + 1 %** |

### Decisões de execução (Júlio, 12/10/2026)
- D1, D2 e D3 decididas como acima; **todos os demais itens seguem o padrão da tabela**.
- Ordem: Fase 1 → Fases 2 e 3 em paralelo → 4 → 5 → 6 → 6B → 7 → 8. Sem OK entre fases (igual ao plano do CRM): deploy + E2E + capturas ao fim de cada uma, o Júlio valida com número real o que envia mensagem.
- Número de teste real: "A Zero 1" (segundo número da org SuperAdmin), como até agora.
- Pendência prática antes da Fase 4: conta no **Asaas** com chaves de sandbox (ação do Júlio).

## 2. Cuidados obrigatórios (erros que já pagamos no módulo WhatsApp)

1. **Toda tabela nova**: `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`, `organization_id CHAR(36)`, nomes de FK/índice **únicos no banco inteiro** (conferir em `information_schema.TABLE_CONSTRAINTS` antes; `fk_wacs_*` já estourou uma vez). Migration com timestamp maior que a última; backup `mysqldump` da org antes de migration com backfill.
2. **`admin.removeOrganization`** apaga toda tabela nova (lista na ordem das FKs). Checar no E2E (criar org temporária, popular, apagar, contar 0).
3. **Multi-número**: o que é "da conversa" leva `session_id`; o que é "do cliente" é da org. Serviço que lista conversas/cobranças por número recebe `allowed` (`WaAccessService`). Nunca `sessions.row(org)`.
4. **DTO de update**: campos ausentes chegam `undefined` → filtrar antes de `{...cur, ...dto}` (já quebrou `randomize_copies` e `notification_custom`).
5. **Import circular derruba o boot** → helpers puros em `*.util.ts`; **rodar o boot local** (`yarn nest build` + `node dist/src/main.js` com banco falso por 25 s) antes de deployar mudança de DI.
6. **Gateway**: toda operação com `idempotency` determinística; webhook sempre **reconfere o status na API** antes de agir; resposta `{success:false}` do OpenWA é falha.
7. **Entrega de produto/direito nunca depende do estado da conversa** (lição da entrega tardia do PIX): o que o pagamento libera é decidido pela cobrança/assinatura, não pelo bloco em que o bot está.
8. **Nada de envio pesado dentro de requisição** (cron/worker com ritmo); cobranças em massa respeitam o mesmo freio dos broadcasts (`PacingService`), senão o número toma restrição.
9. **Datas**: vencimento é `DATE` em BRT (`brtDateStr`/`dateOnlyUTC`), nunca `new Date()` cru; "hoje" é BRT.
10. **Testes no servidor**: org temporária criada pela API admin, números falsos `55009999900xx`, **limpeza só por id do que o teste criou**, nunca `DELETE … LIKE` nem sorteio sem filtro. PIX real só com `send:false` e cancelado no fim; **boleto real nunca com CPF fictício**.
11. **Bot**: bloco novo = `TYPES` + `walk` no motor + `BotAction` + `run()` no runtime + paleta/nó/inspetor/simulador no front + `validateDefinition`; o simulador tem que funcionar **sem banco** (ações do CRM viram "info" no simulador, com um `ctx.crm` falso injetável).
12. **Front**: `theme.vars` (nunca `theme.palette` em sx), grids `minmax(0,1fr)`, modais `CrmModal/TgModal` (tela cheia no celular), `byId` do `useWaSessions` é `Map`, nunca dois `setSearchParams` seguidos.
13. **Criptografia em repouso**: dados pessoais novos sensíveis (documento, data de nascimento, endereço) entram na extensão `wa-prisma-crypto.ts` (lista de modelos/colunas) **antes** de o backfill rodar; buscar por documento exige coluna de **hash** (`doc_hash` = sha256 normalizado) ao lado da cifrada.
14. **Atualizar `CLAUDE.md` + este plano ("FEITA") + memória ao fechar cada fase**, com migrations, endpoints, gotchas e como testar.

## 3. Fases

### Fase 1 — Identidade do cliente (≈ 3 dias)
Objetivo: um cliente pode ter vários números, um número pode servir a vários clientes, e o sistema acha um cliente pelo número ou, quando a org exigir, pelo documento. Simples por decisão do Júlio (D1/D2).

**Modelo** (migration `2026MMDD_whatsapp_customer_identity`):
- `whatsapp_customer_contacts` — `customer_id CHAR(36)`, `contact_id CHAR(36)`, `role VARCHAR(16)` (`owner|financial|user|dependent`), `linked_by VARCHAR(8)` (`panel|bot|import|api`), `created_at`; PK `(customer_id, contact_id)`; FK `fk_wacc_customer` → customers CASCADE, `fk_wacc_contact` → contacts CASCADE; índice `(contact_id)`. **Backfill**: uma linha `owner` por cliente existente a partir de `whatsapp_customers.contact_id`. A coluna `contact_id` em `whatsapp_customers` fica (= contato principal) e o unique `uk_wacust_contact` **cai** (um contato pode ser de 2 clientes).
- `whatsapp_customers` ganha: `code VARCHAR(32) NULL` (código/matrícula/contrato, único por org `uk_wacust_org_code`), `doc_hash CHAR(64) NULL` (índice `idx_wacust_org_dochash (organization_id, doc_hash)`), `kind VARCHAR(8)` (`person|company`), `parent_customer_id CHAR(36) NULL` (dependente/filial), `source VARCHAR(16)` (`panel|import|bot|api`). `doc` entra na criptografia (modelo `whatsapp_customers` na extensão); a busca usa só o hash.
- `whatsapp_crm_settings.identity JSON` — `{require_doc:false, doc_kinds:['cpf','cnpj'], ask_doc_text, doc_not_found_text}`. **Sem tabela de OTP e sem data de nascimento** (decisão D2).

**Regra de identificação (`whatsapp-identity.service.ts`)**, a mais simples que resolve:
- `customerOfChat(org, key)` → cliente vinculado ao contato da conversa (prioridade `owner` > `financial` > `user` > `dependent`); com mais de um cliente no mesmo número, o bot pergunta "você é o cliente 1 (Nome) ou 2 (Nome)?".
- Org **sem** `require_doc`: o número é a identidade. O bot mostra os dados do cliente do número, ponto.
- Org **com** `require_doc`: o bot pede o documento (validação de dígito verificador), acha por `doc_hash`; se o contato ainda não está vinculado a esse cliente, vincula (`linked_by:'bot'`) e segue. Documento não encontrado → porta `not_found` (o fluxo decide: cadastrar ou atendente).
- Número novo de um cliente sem exigência de documento: a equipe vincula no painel (aba Contatos) ou o cliente informa o `code` (matrícula/contrato) se a org usar código.
- `normalizeDoc(doc)` (só dígitos; valida CPF/CNPJ; `cpfOk` do motor vai para `wa-doc.util.ts` com `cnpjOk`), `docHash(org, doc)` = sha256(`${org}:${digits}`).
- Endpoints: `GET /whatsapp/customers/lookup?doc=|code=|phone=` (404 sem revelar nada além de "não encontrado"), `POST /whatsapp/customers/:id/contacts {contact_id|phone, role}`, `DELETE /whatsapp/customers/:id/contacts/:contactId`, `GET/PUT /whatsapp/crm-settings` ganha `identity`. Import CSV aceita `code`, `kind`, telefones extras (`phones` separados por `|`). Export idem. `contacts/lookup` devolve `customers[]` (todos os clientes do contato com `role`).

**Front**: `crm/CustomerDialog.jsx` aba **Contatos** (lista de números com papel, adicionar por telefone/`WaChatPicker`, remover); Configurações → Clientes: toggle **"Exigir CPF/CNPJ para identificar o cliente no bot"** + textos; `WhatsAppCustomers.jsx` busca por documento/código; `chat/CustomerPanel.jsx` mostra "este número está em N clientes" com seletor.

**E2E** (`docs/tools/wa_identity_e2e.mjs`, org temporária): cliente com 2 contatos; mesmo contato em 2 clientes; lookup por CPF (válido/inválido/não encontrado), por código, por telefone; org sem `require_doc` identifica pelo número; org com `require_doc` exige documento e vincula o número novo ao cliente achado; 2 clientes no mesmo número → pergunta qual; `varsForChat` escolhe o cliente certo por papel; import/export com os campos novos; remoção da org limpa tudo; busca por documento usa o hash (cifrado no banco). **Aceite**: 100 % do E2E; capturas do diálogo e do painel.

### Fase 2 — Blocos de CRM no bot (≈ 7 dias)
Objetivo: pontos 2, 3 e 4 do pedido. O bot cadastra, assina, consulta, emite 2ª via, cancela/pausa/troca plano, atualiza dados, sem atendente.

**Motor (`wa-bot.engine.ts`)** — tipos novos em `TYPES` e no `walk`:
- `crm_identify` — `data {title, mode:'org'|'phone'|'ask_doc'|'ask_code', ask_text, not_found_text, retries}`; portas `found | not_found | invalid | choose`. `org` (padrão) segue a configuração da org (`identity.require_doc`): sem exigência = cliente do número (`ctx.customer`); com exigência = pergunta o documento (`waiting_for:'crm_identify'`), o runtime resolve (`identity.findCustomer`) e vincula o número; `ask_code` pede matrícula/contrato. Resultado volta por `handleEvent(..., 'crm_result')` com `state.customer_id` + `state.vars.cliente.*`. Mais de um cliente no número → porta `choose` (menu gerado em runtime). Sem OTP.
- `crm_register` — `data {title, fields:[{key:'name'|'doc'|'email'|'address.zip'|...|'custom.<key>', label, required, validate}], confirm_text, link_role:'owner'}`; portas `done | cancel`. Faz as perguntas em sequência (mesma mecânica do `question`, `waiting_for:'crm_register:<idx>'`), ao fim ação `crm_create_customer` (cria ou atualiza o cliente do número, `source:'bot'`, vincula o contato).
- `crm_subscribe` — `data {title, product_id|'choose', choose_text, confirm_text, charge_now:true, method:'pix'|'boleto'|'ask'}`; portas `subscribed | paid | expired | declined | cancel`. Lista produtos ativos quando `choose` (menu numerado gerado em runtime), cria a assinatura (Fase 3 decide trial/pró-rata), gera a 1ª cobrança (`WhatsAppChargesService.create origin:'bot'`) e espera pagamento reusando a mecânica do `pix` (`waiting_for:'charge'`, eventos `charge_paid|charge_expired`).
- `crm_info` — `data {title, what:'status'|'next_charge'|'subscriptions'|'data'|'custom', template}`; porta `out`. Só monta texto com as variáveis (`{{cliente.*}}`, `{{assinatura.*}}`, `{{cobranca.*}}`). Sem cliente identificado → porta `no_customer`.
- `crm_invoice` — 2ª via: `data {title, which:'open'|'last'|'choose', method:'pix'|'boleto'|'both'}`; portas `sent | nothing_open | out`. Ação `crm_send_charge` reenvia a cobrança em aberto (recalcula juros/multa, Fase 3).
- `crm_cancel` — `data {title, subscription:'single'|'choose', ask_reason:true, reasons:[...], confirm_text, policy:'product'|'immediate'|'end_of_cycle', retention_text?}`; portas `canceled | kept | out`. Ação `crm_cancel_subscription`.
- `crm_pause` — `data {title, max_days, ask_until:true}`; portas `paused | out`. Ação `crm_pause_subscription {until}`.
- `crm_change_plan` — `data {title, products:[ids]|'all'}`; portas `changed | out`. Ação `crm_change_plan` (Fase 3 faz pró-rata).
- `crm_update` — `data {title, fields:[...]}` (mesma lista do register); porta `out`.
- `condition` ganha regras com fonte `customer`: `cliente.status in (ok|overdue|none|inactive)`, `cliente.produto = <id>`, `cliente.dias_atraso > N`, `cliente.verificado`, `cliente.custom.<key> op valor`.
- `menu` ganha `source:'products'` (opções = produtos ativos, `opt-<product_id>` como porta dinâmica + porta `other`).
- `BotContext` ganha `customer: {id, name, doc_masked, status, subscriptions:[{id, product_id, product_name, price_cents, next_due_at, status}], open_charges:[...]} | null`; `BotState` ganha `customer_id`.
- Ações novas em `BotAction`: `crm_lookup {by, value}`, `crm_create_customer {fields}`, `crm_subscribe {product_id, method}`, `crm_send_charge {which, method}`, `crm_cancel_subscription {subscription_id, reason, policy}`, `crm_pause_subscription`, `crm_change_plan`, `crm_update_customer {fields}`. Eventos novos em `handleEvent`: `crm_result`, `charge_paid`, `charge_expired`.

**Runtime (`whatsapp-bot.service.ts`)**: cada ação chama `WhatsAppCrmService`/`WhatsAppChargesService`/`WhatsAppIdentityService`; resultado volta ao motor por `handleEvent` (nunca "pula" o motor). `ctxFor` carrega `customer` via `identity.customerOfChat`. Pagamento de cobrança criada pelo bot continua pelo caminho das cobranças (`settle` → `hooks.emit('charge_paid')` → bot ouve e chama `resume(..., 'charge_paid')`, com a mesma regra de **entrega tardia**). 

**Simulador**: `POST /whatsapp/bot/simulate` aceita `crm_fixture {customer, products, charges}`; sem fixture, as ações do CRM viram `info` ("Cadastraria o cliente com …").

**Front** (`whatsapp/bot/`): paleta ganha grupo **Cliente** (9 blocos), `nodes.jsx` renderiza cada um (portas nomeadas), `inspector.jsx` (campos acima, seletor de produto via `GET /whatsapp/products`, construtor de lista de campos com `custom_fields` da org), `simulator.jsx` com painel "Cliente fictício"; `botModel.js` valida (produto inexistente, campo obrigatório sem label, porta sem ligação em `found/not_found`).

**E2E** (`wa_bot_crm_e2e.mjs`, org temporária, webhooks assinados): identify pelo número / por CPF (org com `require_doc`) / por código; register cria cliente com campos personalizados; subscribe com produto escolhido → cobrança criada e enviada → webhook pago → porta `paid`; cancel fim do ciclo (assinatura continua até `next_due_at`, depois `canceled`); pause; change_plan; invoice sem cobrança aberta; condition por status; cliente com 2 assinaturas; mensagem fora de ordem; simulador com e sem fixture. **Aceite**: fluxo-modelo "Provedor" (identificar → status → 2ª via → cancelar) roda de ponta a ponta no simulador e num número real de teste.

### Fase 3 — Motor de assinatura (≈ 6 dias)
Objetivo: trial, carência, pró-rata, troca de plano, cupom, reajuste, pausa programada, cancelamento com política, juros/multa, régua por produto, auditoria.

**Modelo** (migration `..._whatsapp_subscription_engine`):
- `whatsapp_products` ganha: `trial_days SMALLINT DEFAULT 0`, `grace_days SMALLINT DEFAULT 0` (dias após vencer antes de `overdue`), `prorate BOOLEAN DEFAULT true`, `cancel_policy VARCHAR(16)` (`end_of_cycle|immediate`), `billing_interval_months TINYINT NULL` (substitui o enum fixo: 1/3/6/12; `billing` continua para compat), `charge_days_before TINYINT NULL`, `reminder_rules JSON NULL` (régua própria; `NULL` = a da org), `entitlement JSON NULL` (Fase 5), `custom JSON NULL`, `category VARCHAR(64) NULL`.
- `whatsapp_subscriptions` ganha: `trial_ends_at DATE NULL`, `paused_until DATE NULL`, `cancel_at DATE NULL` (fim do ciclo), `cancel_reason VARCHAR(255)`, `coupon_id CHAR(36) NULL`, `discount_cents INT DEFAULT 0`, `discount_until DATE NULL`, `custom JSON NULL`, `external_id VARCHAR(64) NULL` (id no sistema do cliente, índice por org), `contract_number VARCHAR(64) NULL`.
- `whatsapp_coupons` — `id, organization_id, code VARCHAR(32)` (único por org), `kind` (`percent|fixed`), `value INT`, `duration` (`once|months|forever`), `months TINYINT`, `max_uses INT`, `used INT`, `product_ids JSON`, `expires_at DATE`, `active`.
- `whatsapp_subscription_events` — `id, organization_id, subscription_id, kind VARCHAR(32)` (`created|trial_started|activated|paid|overdue|paused|resumed|plan_changed|canceled|reactivated|price_changed|coupon_applied`), `data JSON`, `user_id NULL`, `source` (`panel|bot|api|system`), `created_at`; índice `(subscription_id, created_at)`.
- `whatsapp_crm_settings.charge` ganha `late_fee_percent`, `interest_month_percent`, `grace_days_default`, `cancel_reasons[]`, `readjust {percent, month}`.

**Back** (`whatsapp-crm.service.ts` → extrair `whatsapp-subscriptions.service.ts`):
- `createSubscription(org, customerId, {product_id, start_date, due_day, coupon, source})`: aplica trial (`trial_ends_at`, 1ª cobrança após o trial), pró-rata (valor = preço × dias restantes ÷ dias do ciclo, arredondado para cima em centavos), cupom; grava evento.
- `changePlan(org, subId, newProductId)`: crédito do período não usado como `discount_cents` da próxima cobrança (sem estorno); evento.
- `cancel(org, subId, {policy, reason, source})`: `immediate` → `canceled` + cancela cobranças `PENDING` da assinatura no gateway; `end_of_cycle` → `cancel_at = next_due_at`, o runner diário fecha no dia; evento.
- `pause(org, subId, until)` / `resume`: runner retoma em `paused_until`, `next_due_at` recalculado.
- `readjust`: job mensal opcional (percentual da org ou por produto), evento `price_changed` + mensagem avisando o cliente (texto em settings).
- Cobrança (`whatsapp-charges.service.ts`): `amountWithPenalty(charge, today)` (multa + juros pro rata die) usado na 2ª via; `runDailyFor` passa a: respeitar `grace_days`, régua por produto (`reminder_rules`), fechar `cancel_at`, retomar pausas, avisar trial acabando (D-3 do `trial_ends_at`).
- **Fila com ritmo**: `runDailyFor` não envia direto; cria as cobranças e empilha envios em `whatsapp_outbox` (nova tabela genérica: `session_id, chat_id, payload JSON, kind, run_at, status, attempts`) consumida por um worker com o freio do `PacingService` (máx. configurável/min por número). Lembretes e avisos usam a mesma fila. Broadcasts continuam na fila própria.
- Endpoints: `POST /whatsapp/customers/:id/subscriptions` ganha `coupon`, `start_date`, `trial`; `POST /whatsapp/subscriptions/:id/{cancel,pause,resume,change-plan,reactivate}`; `GET /whatsapp/subscriptions/:id/events`; `GET/POST/PUT/DELETE /whatsapp/coupons`; `GET /whatsapp/subscriptions?status&product_id&due_from&due_to&session_id` (lista cruzada, paginada).

**Front**: `WhatsAppProducts.jsx` (campos novos, régua própria, política de cancelamento), `crm/CustomerDialog.jsx` aba Assinaturas (ações cancelar/pausar/trocar/reativar com diálogo de política e motivo, linha do tempo de eventos), página **Cupons** (dentro de Produtos, aba), configurações de juros/multa/motivos em Cobranças.

**E2E** (`wa_subscription_engine_e2e.mjs`): trial 7 dias → 1ª cobrança no dia certo; pró-rata (entrada dia 20 com vencimento dia 5 = 15 dias); cupom percent/fixed/once/months/forever e limite de usos; troca de plano com crédito; cancelar imediato cancela PENDING no gateway (PIX real `send:false`); fim do ciclo fecha no dia (simular `cancel_at = hoje` + `run-daily`); pausa/retomada; carência; multa/juros na 2ª via; fila de envio respeita o ritmo (medir N envios/min); reajuste; eventos gravados; CSV. **Aceite**: cálculo de pró-rata/juros conferido numa tabela de 10 casos escrita no teste (datas fixas, sem `Date.now()`).

### Fase 4 — Pagamentos: gateways, cartão recorrente, link (≈ 7 dias)
Objetivo: assinatura "de verdade" (cartão), mais gateways, link de pagamento e parcelamento.

- **Abstração**: `back/src/payments/providers/` com interface `PaymentProvider { createPix, createBoleto, createCardSubscription, cancel, status, parseWebhook, test }` e implementações `mercadopago.ts` (hoje), `pushinpay.ts` (hoje, só PIX), **`asaas.ts`** (PIX, boleto, cartão recorrente por tokenização, split futuro), opcionalmente `efi.ts`. `pix-providers.ts` vira fachada compatível (Telegram/webchat/plataforma não mudam).
- **Gateway por finalidade**: `telegram_payment_settings` ganha `providers JSON` (`{pix:'mercadopago', boleto:'asaas', card:'asaas'}` + tokens por provedor, mascarados) e a tela Configurações → Pagamentos lista os provedores com teste individual. Webhook único passa a ter `/payments/webhook/:provider` para cada um (já é genérico).
- **Cartão recorrente**: `whatsapp_payment_methods` — `id, organization_id, customer_id, provider, provider_customer_id, provider_token, brand, last4, exp, status, created_at` (token cifrado pela extensão). Captura do cartão **sem passar pelo WhatsApp**: o bot/painel manda um **link seguro** (`https://api.<dominio>/public/pay/card/:token`, página estática do front em `/pay/card/:token`, token HMAC 30 min) que tokeniza direto no provedor (JS do Asaas/MP no navegador; o número do cartão nunca toca o nosso servidor). Assinatura com `payment_method_id` é cobrada automaticamente no vencimento (`chargeCard`), com 3 tentativas (D0, D+2, D+5) e fallback para PIX/boleto na régua.
- **Link de pagamento**: `whatsapp_charges.pay_link_token`; página `/pay/:token` (PIX copia-e-cola + QR + boleto + cartão avulso) para quem prefere pagar fora do chat; o texto de cobrança ganha `{{cobranca.link}}`.
- **Parcelamento** (cartão avulso): `installments` no produto `once`; só onde o provedor suporta.
- **Conciliação**: `GET /whatsapp/charges/reconcile?from&to` compara `PAID` locais com a lista do provedor e marca divergências; botão na tela de Cobranças.
- **Endpoints**: `POST /whatsapp/customers/:id/payment-methods/link` (gera o link), `GET/DELETE /whatsapp/customers/:id/payment-methods`, públicos `GET/POST /public/pay/*` (30/min por IP, sem JWT, token obrigatório).
- **E2E**: sandbox do Asaas (chaves de teste no `.env` do servidor, nunca impressas): PIX, boleto, tokenização com cartão de teste, cobrança recorrente, falha e retentativa, webhook assinado do Asaas, conciliação com divergência forçada; MP continua 31/31 do E2E de cobranças. **Aceite**: uma assinatura com cartão passa 2 ciclos no sandbox (datas forçadas por `run-daily` com `today` injetado).

### Fase 5 — Direito de acesso (entitlement), API pública e webhooks de saída (≈ 6 dias)
Objetivo: "pagou, e daí?" — o Pub Mail passa a liberar/cortar o serviço e avisa o sistema do cliente.

- **Entitlements**: `whatsapp_entitlements` — `id, organization_id, customer_id, subscription_id, kind VARCHAR(32)` (`group_member|tag|digital_file|external|custom`), `ref VARCHAR(255)` (jid do grupo / id da etiqueta / media_id / chave externa), `status` (`active|suspended|revoked`), `valid_until`, `last_sync_at`, `error`; `whatsapp_products.entitlement JSON` = `[{kind, ref, on_overdue:'keep'|'suspend', suspend_after_days}]`. Runner diário aplica: ativa ao pagar (`settle`), suspende em `overdue + suspend_after_days`, revoga ao cancelar; eventos.
- **Grupo VIP no WhatsApp**: `OpenWaClient` ganha `addParticipants(sid, groupId, jids[])`, `removeParticipants`, `promote/demote`, `groupInviteCode` (conferir as rotas do OpenWA `/sessions/:id/groups/:gid/participants/{add,remove}`; se não existirem no OpenWA atual, patch no gateway Baileys como o de `baileys-events.js`, documentado em `Deploy.md`). Sem o número ser admin do grupo = erro claro na tela. Entrega de arquivo digital por assinatura (`digital_file`) reusa o envio de documento do bot.
- **API pública da org**: tabela `api_keys` (`organization_id, name, key_hash, key_prefix, scopes JSON, last_used_at, revoked_at`), `Authorization: Bearer pm_…`, guard próprio (`ApiKeyGuard`), 600 req/min por chave. Rotas v1 sob `/api/v1/whatsapp/`: `customers` (GET/POST/PUT, lookup por doc/code/phone), `subscriptions` (CRUD + cancel/pause), `charges` (criar, 2ª via, status), `messages` (enviar texto/mídia para um telefone pelo número X, com o freio de ritmo), `contacts/opt-out`. Swagger só com `SWAGGER_ENABLED`.
- **Webhooks de saída**: `org_webhooks` (`organization_id, url, secret, events JSON, active`) + `org_webhook_deliveries` (payload, status, attempts, próximo envio; 5 tentativas com backoff); eventos `customer.created|updated`, `subscription.created|activated|overdue|paused|canceled|plan_changed`, `charge.created|paid|expired|canceled`, `entitlement.activated|suspended|revoked`, `message.received` (opcional, só texto, respeitando opt-out). Assinatura HMAC-SHA256 no header `X-PubMail-Signature`; `postJson` anti-SSRF já existe (`safe-http.util.ts`).
- **Tela**: Configurações → **Integrações da org** (chaves de API, webhooks com log de entregas e reenvio); produto ganha seção "Ao pagar, liberar…".
- **E2E**: grupo real de teste com um número de teste (criar grupo, adicionar, suspender, remover); API com chave válida/revogada/escopo errado; webhook de saída recebendo num endpoint local (`127.0.0.1` liberado só no teste) com assinatura conferida, retentativa após 500; remoção da org apaga chaves/webhooks/entitlements.

### Fase 6 — Agendamento com pagamento (salão, barbearia, lava-rápido, clínica, estética, oficina, consultoria…) (≈ 10 dias)
Objetivo: o cliente escolhe **um serviço específico**, o profissional/recurso, o dia e o horário pelo bot, **paga na hora** (ou sinal, ou depois, conforme a política do serviço) e fica agendado; o Pub Mail mostra uma **agenda visual** (dia/semana/por profissional) para a equipe se guiar, com confirmação, lembrete, remarcação, cancelamento, falta e lista de espera. Vale para serviço avulso **e** para serviço incluso numa assinatura (ex.: "plano mensal com 4 lavagens").

**Vocabulário**: *serviço* = produto com duração (`whatsapp_products` com `kind:'service'`); *recurso* = quem/o que atende (profissional, box do lava-rápido, sala, cadeira, equipamento); *agenda* = disponibilidade do recurso; *agendamento* = cliente + serviço + recurso + horário.

**Modelo** (migration `..._whatsapp_scheduling`):
- `whatsapp_products` ganha: `kind VARCHAR(16)` (`product|plan|service`), `duration_minutes SMALLINT NULL`, `buffer_after_minutes SMALLINT DEFAULT 0` (limpeza/preparo), `capacity SMALLINT DEFAULT 1` (quantos clientes ao mesmo tempo — aula em grupo), `booking JSON NULL` = `{payment:'on_booking'|'deposit'|'on_site'|'included', deposit_cents, pay_within_minutes:30, min_notice_hours:2, max_days_ahead:60, cancel_free_hours:24, cancel_policy:'refund'|'credit'|'keep', reschedule_limit:2, confirm:'none'|'ask_d1', requires_customer:true}`, `included_in_plans JSON` (ids de produtos-plano que incluem N usos por ciclo: `[{plan_id, uses_per_cycle}]`).
- `whatsapp_resources` — `id, organization_id, name VARCHAR(120), kind VARCHAR(16)` (`person|room|bay|equipment|other`), `unit_id CHAR(36) NULL` (Fase 7), `session_id CHAR(36) NULL` (número preferido para avisos), `user_id CHAR(36) NULL` (usuário do painel que é esse profissional — vê "minha agenda"), `color VARCHAR(7)`, `photo_media_id`, `services JSON` (ids dos serviços que atende; vazio = todos), `availability JSON` = `{tz:'America/Sao_Paulo', weekly:{'1':[{start:'09:00',end:'12:00'},{start:'13:00',end:'18:00'}],…}, slot_minutes:15}`, `active BOOLEAN`, `position INT`. Índice `(organization_id, active, position)`.
- `whatsapp_resource_blocks` — `id, organization_id, resource_id NULL` (NULL = todos: feriado), `starts_at DATETIME(3), ends_at DATETIME(3), reason VARCHAR(120), created_by`; índice `(resource_id, starts_at)`.
- `whatsapp_appointments` — `id, organization_id, session_id` (número por onde o cliente agendou), `chat_id VARCHAR(64)`, `customer_id CHAR(36) NULL`, `contact_id CHAR(36)`, `resource_id CHAR(36)`, `product_id CHAR(36)` (serviço), `service_name VARCHAR(120)`, `price_cents INT`, `starts_at DATETIME(3)`, `ends_at DATETIME(3)` (inclui buffer), `status VARCHAR(16)` (`pending_payment|booked|confirmed|in_progress|done|no_show|canceled|expired`), `payment VARCHAR(16)` (`none|deposit|full|included`), `charge_id CHAR(36) NULL`, `paid_cents INT DEFAULT 0`, `subscription_id CHAR(36) NULL` (uso de plano), `source VARCHAR(8)` (`bot|panel|api`), `confirmed_at, reminded_at JSON` (`{d1, h2}`), `canceled_at, cancel_by VARCHAR(8)` (`customer|staff|system`), `cancel_reason VARCHAR(255)`, `rescheduled_from CHAR(36) NULL`, `reschedules TINYINT DEFAULT 0`, `notes TEXT`, `custom JSON`, `created_by CHAR(36) NULL`, `created_at, updated_at`. Índices `(organization_id, starts_at)`, `(resource_id, starts_at)`, `(customer_id, starts_at)`, `(status, starts_at)`. **Unicidade do horário é garantida por claim atômico** (ver abaixo), não por unique (capacidade > 1 e buffers impedem unique simples).
- `whatsapp_waitlist` — `id, organization_id, contact_id, customer_id NULL, product_id, resource_id NULL, date_from DATE, date_to DATE, period VARCHAR(8)` (`any|morning|afternoon|evening`), `status` (`waiting|offered|booked|expired`), `offered_appointment_id NULL`, `offered_at`, `expires_at`.
- `whatsapp_crm_settings.scheduling JSON` — textos (`booked, reminder_d1, reminder_h2, confirm_ask, canceled, rescheduled, no_show, waitlist_offer`), `reminder_d1_hour:'18:00'`, `reminder_h2:true`, `no_show_after_minutes:30`, `auto_complete:true`, `staff_notify:true`, `calendar_feed:true`.

**Regras do motor de agenda (`whatsapp-scheduling.service.ts`, funções puras em `wa-schedule.util.ts` testáveis sem banco)**:
- `slots(resource, service, day)` = janelas da disponibilidade do dia − bloqueios − agendamentos (status ≠ canceled/expired) com `ends_at` (duração + buffer) ≥ `min_notice_hours` à frente, ≤ `max_days_ahead`, passo `slot_minutes`; capacidade > 1 conta ocupação por sobreposição. Tudo em BRT (`availability.tz`), guardado em UTC.
- **Reserva atômica**: `book()` roda em transação `SERIALIZABLE` com `SELECT … FOR UPDATE` dos agendamentos do recurso que se sobrepõem ao intervalo; se a contagem ≥ `capacity` → `ConflictException` ("horário acabou de ser ocupado") e o bot oferece o próximo. O mesmo contato não pode ter 2 agendamentos sobrepostos.
- **Pagamento**: `on_booking` → cria o agendamento `pending_payment` + cobrança (`WhatsAppChargesService.create origin:'booking'`, PIX com validade `pay_within_minutes`) → `settle` → `booked` (hook `charge_paid` → `scheduling.onPaid`); não pagou no prazo → `expired` e o horário libera (runner por minuto). `deposit` idem com `deposit_cents` e saldo `on_site`. `on_site` → `booked` direto. `included` → consome 1 uso do plano no ciclo (`whatsapp_subscription_usage`: `subscription_id, cycle_start, used`), sem plano/uso esgotado → oferece pagar avulso.
- **Confirmação e lembretes** (fila `whatsapp_outbox`, Fase 3): D-1 às `reminder_d1_hour` com "responda 1 para confirmar, 2 para remarcar" (`confirm:'ask_d1'` → `waiting` no bot por 24 h; resposta "1" → `confirmed`), H-2 lembrete curto. Sem resposta não cancela (só marca "não confirmado" na agenda).
- **Cancelar/remarcar pelo cliente**: permitido até `cancel_free_hours` antes; depois, conforme `cancel_policy` (`refund` = estorno pelo gateway quando suportado, senão crédito; `credit` = `whatsapp_customer_credits` para a próxima; `keep` = perde). Remarcação até `reschedule_limit` vezes mantém o pagamento (`rescheduled_from`).
- **Falta**: `no_show_after_minutes` depois do início sem `in_progress/done` → `no_show` (runner), mensagem opcional, contagem no cliente (`custom.no_shows`), política de sinal obrigatório após N faltas (configurável).
- **Lista de espera**: horário cancelado → oferece ao 1º da espera compatível (serviço/recurso/período), `offered` por 30 min com link/"responda 1"; não respondeu → próximo.
- **Equipe**: `hooks.emit('appointment_booked|canceled|rescheduled|no_show')` → notificações (tipos novos no catálogo) para o profissional (`resource.user_id`) e quem tem o módulo; evento `wa:appointment` em tempo real para a agenda aberta.
- **Feed ICS** por recurso (`GET /public/calendar/:token.ics`, token HMAC por recurso) para o profissional assinar no Google/Apple Calendar (leitura). Sem sincronização bidirecional.

**Endpoints** (`/whatsapp/scheduling/*`, JWT, `allowed` por número onde houver `session_id`):
- `GET/POST/PUT/DELETE resources`, `PUT resources/reorder`, `GET/POST/DELETE resources/:id/blocks`, `GET resources/:id/ics-link`.
- `GET availability?product_id&resource_id?&from&to` → dias com vagas e horários (`[{date, slots:[{starts_at, ends_at, resource_id, left}]}]`).
- `GET appointments?from&to&resource_id&status&customer_id&session_id&q` (lista e visão de agenda), `GET appointments/:id`, `POST appointments` (painel: cliente/contato, serviço, recurso, horário, pagamento `on_site|charge`), `PATCH appointments/:id` (notas, horário = remarcar com claim), `POST appointments/:id/{confirm,start,done,no-show,cancel,reschedule,charge,resend}`, `GET appointments/counts?date` (badge do dia).
- `GET/POST/DELETE waitlist`, `POST waitlist/:id/offer`.
- `GET/PUT settings` (textos e regras), `GET report?from&to` (ocupação por recurso, receita por serviço, faltas %, cancelamentos, ticket médio, horários de pico).

**Blocos do bot** (motor + runtime + front, mesma disciplina da Fase 2):
- `book_service` — `data {title, services:[ids]|'all', resource:'ask'|'auto'|<id>, days_ahead, texts:{choose_service, choose_resource, choose_day, choose_time, confirm, paid, pending_payment, no_slots, conflict}}`; sub-passos internos (`waiting_for:'book:service'|'book:resource'|'book:day'|'book:time'|'book:confirm'|'book:payment'`), menus numerados gerados em runtime (serviços ativos do recurso, próximos 7 dias com vaga "qua 15/10 · 6 horários", horários em colunas "09:00 09:30 10:00…", "mais horários" / "outro dia"); portas `booked | pending_payment | expired | no_slots | cancel`. Com `requires_customer` e sem cliente → encadeia o `crm_register` (campos mínimos: nome) antes.
- `my_appointments` — lista os próximos do cliente/contato (até 5) com opções **confirmar / remarcar / cancelar** por número; portas `out | none`. Remarcar reaproveita os passos de dia/horário do `book_service`.
- `waitlist_join` — `data {title, product_id|'ask', period:'ask'|'any'}`; porta `out`.
- `condition` ganha regras `agendamento.proximo_em_horas`, `agendamento.tem_pendente`, `cliente.faltas > N`.
- Variáveis `{{agendamento.servico|profissional|data|hora|valor|endereco|link_cancelar}}`.

**Front**:
- Página **Agenda** (`/whatsapp/agenda`, item `IconCalendarEvent` no grupo WhatsApp, `views/pages/whatsapp/WhatsAppAgenda.jsx` + `whatsapp/agenda/`): visões **Dia** (colunas por recurso, linhas de 15 min, blocos coloridos pelo status: amarelo aguardando pagamento, azul agendado, verde confirmado, cinza concluído, vermelho falta/cancelado), **Semana** (por recurso selecionado), **Lista** (tabela com filtros: período, recurso, serviço, status, número; busca por cliente; paginação) e **Hoje** (resumo: próximos, não confirmados, pendentes de pagamento, faltas). Arrastar bloco = remarcar (com confirmação e claim). Clique = gaveta com cliente, serviço, pagamento (cobrar/2ª via/marcar pago), ações (confirmar, iniciar, concluir, falta, cancelar com política, remarcar, abrir conversa), notas, histórico. Botão **Novo agendamento** (diálogo com busca de cliente/contato, serviço, recurso, calendário com disponibilidade real, pagamento). Tempo real por `wa:appointment`. Celular: visão Dia com um recurso por vez e lista.
- **Recursos** (`/whatsapp/resources`): cards com foto/cor, serviços, disponibilidade semanal em grade clicável (arrasta para marcar), bloqueios/férias, link ICS, "é o usuário X".
- **Produtos**: serviço com duração, buffer, capacidade, política de pagamento/cancelamento, inclusão em planos.
- **Painel da conversa** (`CustomerPanel`): aba **Agenda** com próximos/histórico e "Agendar" rápido.
- **Configurações → Agendamento**: textos, lembretes, falta, lista de espera, notificação da equipe.
- Relatório na página **Métricas** (aba Agenda) com ocupação, receita por serviço, faltas.

**E2E** (`docs/tools/wa_scheduling_e2e.mjs`, org temporária, datas fixas injetadas): disponibilidade com 2 janelas, buffer, bloqueio e feriado; capacidade 3 (aula) enchendo e recusando o 4º; `min_notice`/`max_days`; **50 reservas simultâneas no mesmo horário → exatamente `capacity` aceitas**; `on_booking` → PIX (real, `send:false`, cancelado no fim) → webhook pago → `booked`; não pagou → `expired` e horário livre de novo; `deposit`; `included` consome uso do plano e esgota; confirmação D-1 por resposta "1"; H-2; remarcação dentro do limite mantém pagamento; cancelamento antes/depois do prazo com as 3 políticas (crédito gravado); falta automática; lista de espera recebendo a oferta e vencendo; bot `book_service` completo no simulador com fixture e num número real; feed ICS válido (`node ical` parse); notificação ao profissional; relatório conferido contra SQL; remoção da org limpa tudo. **Aceite**: fluxo "Salão" (escolher corte → profissional → dia → horário → PIX → agendado → lembrete D-1 → confirmado → concluído) e "Lava-rápido" (2 boxes, capacidade por box, pagar no local) rodam de ponta a ponta; agenda do dia conferida em captura desktop e celular.

### Fase 6B — Tickets/protocolos (prefeitura, provedor, suporte) (≈ 3 dias)
- `whatsapp_tickets` (`number INT` sequencial por org via tabela `whatsapp_counters` com `UPDATE … SET value = LAST_INSERT_ID(value+1)`, `customer_id, chat_id, category, priority, status open|pending|resolved|closed, assigned_user_id, sla_due_at`), `whatsapp_ticket_events`. Bloco `open_ticket` (categoria + descrição + foto opcional → protocolo) e `my_tickets` (consulta pelo número, status). Categorias/SLA em `crm_settings.tickets`. Tela `/whatsapp/tickets` (fila, filtros, SLA vencendo) + aba no painel da conversa. Notificações `ticket_assigned|ticket_sla`.
- E2E: protocolo sequencial sem furo com 50 criações paralelas; SLA vencido → notificação; fluxo no simulador.

### Fase 7 — Genérico para qualquer vertical (≈ 6 dias)
- **Campos personalizados em tudo**: `custom_fields` por entidade em `crm_settings` (`customer|product|subscription|charge|ticket|appointment`), com tipo (`text|number|date|select|bool|phone|email|cpf`), obrigatório, visível para o cliente (bot pode mostrar/pedir). Variáveis `{{assinatura.custom.x}}`, `{{produto.custom.x}}`.
- **Entidades extras**: `whatsapp_units` (filial/unidade com endereço e `session_id` preferido), `whatsapp_customers.unit_id`, `whatsapp_customers.external_id`; **endereço de instalação/atendimento** separado do endereço de cobrança (`addresses JSON [{kind, ...}]`).
- **Pedidos** (loja/mercado): `whatsapp_orders` (`customer_id, chat_id, items JSON [{product_id, name, qty, price_cents}], total_cents, status new|confirmed|paid|preparing|delivered|canceled, delivery JSON, charge_id`), bloco `order_cart` (catálogo paginado por categoria, quantidade, endereço, pagamento via cobrança) e tela `/whatsapp/orders` (quadro por status). Sem estoque.
- **Templates por vertical**: `docs/templates/whatsapp/<vertical>.json` (produtos de exemplo, campos personalizados, fluxo do bot completo, régua, etiquetas, etapas do funil) importáveis em Configurações → "Começar com um modelo": **Clínica**, **Provedor de internet**, **Loja**, **Segurança/monitoramento**, **Conteúdo VIP**, **Prefeitura/serviço público**, **Mercado/delivery**. Cada modelo tem o fluxo testado no simulador (fixture no próprio JSON).
- **Relatórios**: `GET /whatsapp/finance?from&to` (MRR, churn, inadimplência %, previsão de recebimento 30/60/90, recebido por meio, por produto, por unidade, cohort por mês de entrada) + página **Financeiro** (apexcharts) + export CSV.
- **Papéis**: módulo `whatsapp` ganha sub-permissões em `users.modules` (`whatsapp:finance`, `whatsapp:crm`, `whatsapp:settings`) checadas pelo `RolesGuard` estendido; MEMBER sem `finance` não vê cobranças/financeiro.
- **E2E**: importar cada template numa org temporária e rodar o fluxo no simulador com a fixture; pedido completo com pagamento; campos personalizados obrigatórios bloqueando cadastro; relatório com números conferidos contra SQL.

### Fase 8 — Escala, operação e fechamento (≈ 4 dias)
- Fila `whatsapp_outbox` com worker por número (ritmo configurável, pausa em restrição do número via `session_restricted`), painel "Fila de envios" em Configurações.
- `runDailyFor` em lotes por org com cursor (não carregar todas as assinaturas na memória); índices `(organization_id, next_due_at)`, `(organization_id, cancel_at)`, `(organization_id, paused_until)`.
- Importação em escala (CSV até 50 mil linhas por job em segundo plano com relatório de erros por linha; histórico de pagamentos e saldo devedor inicial).
- Auditoria geral (`org_audit_log`: quem alterou produto/assinatura/cobrança/config) e LGPD: exportar/apagar dados de um cliente (`POST /whatsapp/customers/:id/erase`, anonimiza e revoga).
- Tutoriais em PDF (`docs/whatsapp-assinaturas.md` → `WhatsApp - Assinaturas.pdf`), READMEs PT/EN, `Deploy.md` (envs dos gateways novos), landing (recursos do plano WhatsApp).
- Carga: 10 mil clientes / 10 mil assinaturas numa org temporária, `run-daily` abaixo de 60 s, fila esvaziando no ritmo configurado, painel respondendo em < 500 ms nas listagens.

## 4. Ordem, dependências e estimativa

| Fase | Depende de | Dias |
|---|---|---|
| 1 Identidade | — | 3 |
| 2 Bot CRM | 1 | 7 |
| 3 Motor de assinatura | 1 | 6 |
| 4 Gateways/cartão | 3 | 7 |
| 5 Entitlement/API/webhooks | 3 (e 4 para cartão) | 6 |
| 6 Agendamento com pagamento | 2, 3 | 10 |
| 6B Tickets | 2 | 3 |
| 7 Vertical genérico | 2, 3, 5, 6 | 6 |
| 8 Escala/fechamento | todas | 4 |

Total ≈ 52 dias de desenvolvimento, uma fase por deploy, validação ao fim de cada uma (E2E no servidor + capturas + teste com número real quando houver envio). Fases 2 e 3 podem andar em paralelo (agentes separados) porque tocam arquivos diferentes (bot × assinaturas); a integração `crm_subscribe` → motor fecha no fim da 3.

## 5. Definição de pronto (vale para toda fase)
1. Migration aplicada em produção com backup prévio; `admin.removeOrganization` cobre as tabelas novas.
2. `tsc` 0 erros; boot local sem `UndefinedDependency`; `nest build` sem `error TS` no servidor.
3. E2E da fase 100 % numa org temporária, limpando só por id; nenhum dado real tocado (retrato antes = depois).
4. Capturas das telas novas em desktop (claro/escuro) e celular, sem erro de console nem rolagem lateral.
5. `CLAUDE.md`, este plano ("FEITA" com migrations/endpoints/gotchas) e memória atualizados; README quando houver tela/módulo novo.
6. O Júlio valida com número real o que envia mensagem (bot, cobrança, lembrete); PIX real de R$ 1,00 quando a fase mexer em pagamento.

## 6. Fora deste plano (com motivo)
- Nota fiscal eletrônica: por município/UF, exige certificado digital do cliente; fica no sistema dele via webhook `charge.paid` ou integrador (Fase 5 entrega os dados).
- Estoque e logística de entrega (loja/mercado): pedido simples cobre o atendimento; estoque é outro produto.
- Prontuário/dados clínicos: dado sensível de saúde, fora do escopo (agenda e cobrança da clínica entram).
- Botões/listas nativas do WhatsApp: não existem no cliente não oficial; menus numerados continuam.
- Cobrança em moeda estrangeira: gateways brasileiros só BRL.
