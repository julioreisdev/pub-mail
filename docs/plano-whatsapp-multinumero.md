# WhatsApp multi-número — plano e decisões (06/10/2026)

Pedido do Júlio: cada organização conecta **quantos números quiser** (na prática 2–3). Tudo o que hoje assume "1 número por organização" passa a ter a dimensão **número** (`whatsapp_sessions.id`), sem pontas soltas, com front e back profissionais.

## 1. Decisões de arquitetura

| Tema | Decisão | Por quê |
|---|---|---|
| Número | `whatsapp_sessions` vira **N por org** (sai o `UNIQUE(organization_id)`); ganha `label` (nome interno), `color`, `position`, `bot_flow_id`. | Um número = uma sessão do OpenWA, como hoje. |
| Identidade da conversa | **O id público da conversa passa a ser o `id` (uuid) da linha de `whatsapp_chats`**, não mais o jid. A linha ganha `session_id`; unique `(org, session_id, chat_id)`. O jid continua interno (gateway). | O mesmo contato falando com 2 números = 2 conversas com o mesmo jid; o front precisa de uma chave única (lista, URL `?chat=`, eventos). |
| Mensagens | `session_id` + unique `(org, session_id, wa_message_id)`. | Ids de mensagem são por aparelho. |
| Contatos | **Continuam por organização** (agenda compartilhada, CRM/clientes/etiquetas idem). Filtro "por número" = contatos que têm conversa naquele número. `is_my_contact` = está na agenda de algum número. | Cliente é da empresa, não do chip. Evita duplicar CRM. |
| Tabelas que referenciam conversa (`service_events`, `bot_sessions`, `payments`, `broadcast_sends`, `contact_statuses`, `charges`, `tasks`, `chat_notes`, `ratings`) | ganham `session_id` (backfill = a única sessão da org). | Mantém o jid legível e a migração simples. |
| Config de atendimento (`sessions.settings.service`) | passa para `whatsapp_crm_settings.service` (**por org**). Por número ficam só: aquecimento/pacing, bootstrap, sync, nome interno, fluxo do bot. | Distribuição de fila, pesquisa, LGPD são da empresa. |
| Bot | `whatsapp_bot_flows` vira N por org (nome); **cada número aponta para 0 ou 1 fluxo** (`sessions.bot_flow_id`); o mesmo fluxo pode ser usado por vários números. `bot_sessions` por (número, conversa). Bot continua **desligado por padrão** (fluxo novo `active=false`; número sem fluxo = sem bot). | "fluxo diferente para cada número ou compartilhado". |
| Status (nossos) | ao criar, escolhe 1..N números → **uma linha por número** com `batch_id`. Status dos contatos por número (`session_id`). Tela: um bloco por número, empilhados. | |
| Agendamentos | alvos passam a ser `{session_id, chat_id}`; criação com 1..N números: **"enviar por todos"** (cada alvo sai por cada número escolhido) ou **"distribuir"** (alvos repartidos entre os números, round-robin). Uma linha por número com `batch_id`. | |
| Broadcasts | `session_ids` (1..N); audiência `saved/all` é **distribuída** entre os números (round-robin, respeitando o aquecimento de cada um); `selected`/grupos mantêm o número da conversa. Presets de ritmo (Rápido / Normal / Seguro / Muito seguro) + limite diário por número + pausa a cada N envios + janela de horário. | "cada número tem 5k contatos → um broad nos dois". |
| Acesso por usuário | `users.whatsapp_sessions` JSON = ids permitidos; **`null` = todos** (padrão de OWNER/ADMIN/SUPER_ADMIN e de quem já existia). Admin escolhe os números ao criar/editar usuário com o módulo WhatsApp. Back valida em toda rota por conversa/número (`WaAccessService`); tempo real entra em sala por número. | Pedido explícito. |
| Métricas | filtro por número + quebra por número. | |
| Funil / Tarefas / Clientes / Produtos / Cobranças | continuam por org; onde aparece uma conversa, aparece o **chip do número**; filtro por número no funil; "Cobrar" usa o número da conversa. | |
| Apagar dados | por número (desconectar e apagar) ou tudo (org). | |
| Cores | cada número tem uma cor (paleta fixa, escolhida na ordem); o chip usa cor + nome interno (ou telefone). | Identificação visual em todas as telas. |

## 2. Modelo (migration `20261006120000_whatsapp_multi_number`)
- `whatsapp_sessions`: `-UNIQUE(org)` → `INDEX(org, position)`; `+label VARCHAR(80)`, `+color VARCHAR(16)`, `+position INT DEFAULT 0`, `+bot_flow_id CHAR(36) NULL`.
- `+session_id CHAR(36)` em: chats, messages, service_events, bot_sessions, payments, broadcast_sends, contact_statuses, charges, tasks, chat_notes, ratings, statuses, schedules. Backfill por org. Em chats/messages/bot_sessions/contact_statuses/statuses/schedules vira **NOT NULL** (hoje toda org com dados tem exatamente 1 sessão — conferido em produção: 0 órfãos).
- Uniques: chats `(org, session_id, chat_id)`; messages `(org, session_id, wa_message_id)`; bot_sessions `(org, session_id, chat_id)`; contact_statuses `(org, session_id, wa_status_id)`.
- `whatsapp_bot_flows`: `-UNIQUE(org)` → `INDEX(org)`. Backfill `sessions.bot_flow_id = flow.id WHERE flow.active`.
- `whatsapp_crm_settings.service JSON` ← `sessions.settings->'$.service'`.
- `whatsapp_statuses.batch_id`, `whatsapp_schedules.batch_id`, `whatsapp_schedules.mode` ('all'|'split').
- `whatsapp_broadcasts.session_ids JSON` (backfill `[sessão]`), `+pacing JSON` (preset/limites/janela); `whatsapp_broadcast_runs.by_session JSON`.
- `whatsapp_chat_filters.chat_ids` passa a guardar `[{session_id, chat_id}]` (migração converte strings).
- `users.whatsapp_sessions JSON NULL`.

## 3. Contrato da API (mudanças)
- `GET /whatsapp/sessions` (só as permitidas ao usuário; cada uma com status ao vivo), `POST /whatsapp/sessions` (cria = "Novo número"), `PATCH /whatsapp/sessions/:id` (label/cor/posição/bot_flow_id/pacing), `DELETE /whatsapp/sessions/:id` (desconecta + apaga dados do número). Rotas de sessão existentes passam a `/whatsapp/sessions/:id/...` (`qr`, `start`, `stop`, `pairing-code`, `logout`, `switch-engine`, `test`, `bootstrap`, `events`, `diagnostics`, `profile`, `profile/picture`, `data-summary`, `purge`). **`/whatsapp/session` (singular) some.**
- Conversa: `/whatsapp/chats/:id/...` com `:id` = uuid da linha. A listagem aceita `session_id` (um) ou nada (todos os permitidos). Cada conversa devolve `id`, `chat_id` (jid), `session_id`, `session {id,label,phone,color}`.
- `POST /whatsapp/chats/open {session_id, phone, name?}`; `GET /whatsapp/contacts/lookup?jid&session_id`; fotos `GET /whatsapp/chats/:id/photo`.
- Mensagens: `POST /whatsapp/messages/send {chat_id: <uuid>, ...}` (idem media/location/poll/reply/forward).
- Bot: `GET/POST/PUT/DELETE /whatsapp/bot/flows[/:id]`, `POST /whatsapp/bot/flows/:id/active`, `PUT /whatsapp/sessions/:id` (bot_flow_id), `POST /whatsapp/bot/simulate {flow_id}`, `GET /whatsapp/bot/sessions?session_id`.
- Status: `POST /whatsapp/statuses {session_ids: [...], ...}` → cria N; `GET /whatsapp/statuses?session_id`; `GET /whatsapp/contact-statuses?session_id`; `POST /whatsapp/contact-statuses/sync {session_id?}`.
- Agendamentos: `POST /whatsapp/schedules {session_ids, mode, targets:[{session_id?, chat_id|phone}], ...}`.
- Broadcasts: `session_ids`, `pacing {preset, interval_ms, jitter_pct, daily_limit, pause_every, pause_minutes, window}`; `audience-estimate` devolve por número.
- Eventos WS: todo payload de conversa/mensagem leva `session_id`; `wa:session` leva `session_id`.
- Admin: `POST/PATCH /admin/users` aceitam `whatsapp_sessions: string[] | null`; `GET /admin/organizations/:id/whatsapp-sessions` lista os números da org para o formulário.

## 4. Front (por tela)
- **Configurações**: abas = números (chip colorido + nome interno + status) + aba **"Novo número"**. Dentro da aba: Conexão, Perfil, Aquecimento, Motor, Atividade, Dados do número, campo "Nome interno" + cor. Abaixo das abas (org): Atendimento, Etiquetas, Respostas rápidas, Diagnóstico (por número, dentro da aba).
- **Chat**: seletor de número no topo da lista ("Todos os números" + um por número); chip do número em cada conversa e no cabeçalho; nova conversa pede o número; "Conversar" (contato/menção) pede o número quando há mais de um.
- **Fluxo do Bot**: lista de fluxos (criar/duplicar/renomear/excluir) + para cada fluxo os números que o usam; o editor é o de hoje; ligar/desligar por fluxo; atribuição por número também na aba de configurações do bot.
- **Status**: um bloco por número (status do número + status dos contatos daquele número); "Novo status" com seleção de números.
- **Agendamentos**: números + modo (todos/distribuir) + alvos; lista com chip do número; histórico agrupado por lote.
- **Contatos**: filtro por número.
- **Funil / Tarefas / Clientes / Produtos / Cobranças / Métricas**: chip do número onde há conversa; filtro por número no Funil e nas Métricas; Cobrar/abrir conversa levam o número.
- **Broadcasts**: números + presets de ritmo + limites; estimativa por número; histórico por número.
- **Admin → Usuários**: ao marcar o módulo WhatsApp, lista dos números da org (checkboxes; "todos").
- Kit: `WaNumberChip` (cor + rótulo), `WaNumberSelect`, `useWaSessions()` (lista + tempo real) em `waKit.jsx`.

## 5. Execução (fases) — registro
- [x] F1 (06/10/2026) Núcleo back: migration + schema; `WhatsAppSessionsService` por sessão; `WaAccessService`; presenter (id/session); inbound/chat/contacts/attendance/pipeline/notes/tasks/ratings/charges por conversa-uuid; filtros; runners (watchdog, chat-sync, bootstrap, media).
- [x] F2 (06/10/2026, tsc 0 erros, boot local OK — 166 rotas /whatsapp) Back funcionalidades: bot (fluxos N), status, agendamentos, broadcasts (distribuição + presets), métricas, data/purge por número, admin (usuário × números, removeOrganization), realtime por número.
- [x] F3 (06/10/2026) Front: kit (`waKit.jsx`: `useWaSessions`, `WaNumberChip/Dot/Select/MultiSelect`) + Configurações (abas por número + "Novo número" + identificação nome/cor/fluxo do bot + cards por número + cards da org) + Chat (chips "Todos os números"/por número com não lidas, `?session=`, chip do número por conversa e no cabeçalho, nova conversa escolhe o número, contato com conversas em vários números).
- [x] F4 (06/10/2026, 5 agentes em paralelo) Front: Bot, Status, Agendamentos, Contatos, Broadcasts, Funil, Tarefas, Clientes, Cobranças, Métricas, Admin.
- [x] F5 (06/10/2026) Deploy único feito (backup `/root/backups/wa-antes-multinumero-202610061449.sql.gz`, migration aplicada: 274 conversas / 4530 mensagens com número, sessão virou "Principal"); E2E `wa_multi_e2e.mjs` 75/75 no servidor; telas conferidas no navegador com 1 e com 2 números (2º número criado e apagado pela tela). Deploy único (back + migration + front), E2E no servidor com 2ª sessão simulada por webhook assinado, capturas, docs (CLAUDE.md, README PT/EN, tutorial), memória.

## 6. Testes
- Boot local do back (DI) antes do deploy.
- E2E no servidor: cria 2º número (linha de sessão sem gateway + webhook assinado simulando mensagens), confere: 2 conversas do mesmo jid, listagem por número e "todos", envio pelo número certo (gateway recebe o `openwa_session_id` certo), status/agendamento/broadcast criando 1 linha por número, usuário MEMBER limitado a 1 número (403 na conversa do outro, lista filtrada, socket sem eventos do outro), purge por número não toca o outro, admin removeOrganization limpa tudo.
