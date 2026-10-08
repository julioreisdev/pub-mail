# WhatsApp multi-número — contrato interno do back (para quem mexe nos serviços)

Leia `docs/plano-whatsapp-multinumero.md` (decisões) antes. Este arquivo é o contrato das peças já prontas
(núcleo) que os demais serviços devem usar. **Não altere as assinaturas abaixo** — adapte o seu serviço a elas.

## Identidade
- `whatsapp_sessions` = um NÚMERO. Colunas novas: `label`, `color`, `position`, `bot_flow_id`. N por org.
- Conversa = `(organization_id, session_id, chat_id)` onde `chat_id` é o **jid** do WhatsApp. Unique `organization_id_session_id_chat_id`.
- **API pública**: `chat_id` = **uuid da linha** de `whatsapp_chats` (`presenter.shapeChat` devolve `id`, `chat_id` (= id), `jid`, `session_id`, `session {id,label,color,phone,status,connected}`). Mensagens: `chat_id` (uuid), `jid`, `session_id`.
- Mensagens: unique `organization_id_session_id_wa_message_id`. Colunas `session_id` também em: service_events, bot_sessions (unique `organization_id_session_id_chat_id`), payments, broadcast_sends, contact_statuses (unique `organization_id_session_id_wa_status_id`), charges, tasks, chat_notes, ratings, statuses (+`batch_id`), schedules (+`batch_id`, `mode`).
- `whatsapp_bot_flows`: N por org (`position`); `whatsapp_sessions.bot_flow_id` aponta o fluxo do número (null = sem bot).
- `whatsapp_crm_settings.service` = configuração de atendimento da org (antes em sessions.settings.service).
- `whatsapp_broadcasts.session_ids` (JSON), `.pacing` (JSON); `whatsapp_broadcast_runs.by_session` (JSON).
- `users.whatsapp_sessions` (JSON de ids; null = todos).

## Serviços do núcleo (prontos)
```ts
// wa-access.service.ts
WaAccessService.allowedIds(user: {userId, organizationId, role}) → Promise<Set<string>|null>   // null = todos
WaAccessService.canUse(user, sessionId) / assertSession(user, sessionId) (403) / assertChat(user, {session_id}) (404)
WaAccessService.sessionWhere(user, sessionId?) → {} | {session_id} | {session_id:{in}} | null (null = nada)

// whatsapp-sessions.service.ts   (SessionRow = linha prisma de whatsapp_sessions)
sessions.rowsOf(orgId) · readyRows(orgId) · rowById(orgId, id) · requireRow(orgId, id) (404) · requireReady(orgId, id) (400 claro)
sessions.anyReady(orgId, preferId?) · brief(row) → {id,label,color,phone,status,connected} · get(orgId,id) · list(orgId, allowed)
sessions.create/update/reorder/remove/start/stop/qr/pairingCode/logout/switchEngine/wipe/sendTest/setPacing/events/diagnostics/getProfile… (orgId, sessionId, …)
sessionLabel(row) (export) · SESSION_COLORS (export)

// whatsapp-presenter.service.ts
presenter.sessionMap(orgId) → Map<id, brief> (cache 60 s) · invalidateSessions(orgId) · sessionBrief(row)
presenter.chatUuid(orgId, sessionId, jid) → uuid|null (cache)   · forgetChatUuid(…)
presenter.shapeChats(orgId, rows) · shapeMessages(orgId, rows) (chat_id = uuid)
presenter.emit(orgId, event, payload)                     // sala do módulo (org): etiquetas, tarefas, funil, wa:sessions…
presenter.emitSession(orgId, sessionId, event, payload)  // sala do NÚMERO: conversas/mensagens
presenter.message(orgId, {id} | {waId, sessionId}) · messageShaped(orgId, shaped) · messageDeleted(orgId, sessionId, chatUuid, id)
presenter.chat(orgId, sessionId, jid) · chatRow(row) · session(orgId, sessionId, payload) · sync(orgId, {session_id?, …})

// whatsapp-inbound.service.ts
inbound.bumpChat(orgId, sessionId, jid, {type, body, direction, at, name?, kind?, incUnread?})
inbound.recomputeUnread(orgId, sessionId, jid) · scheduleUnread(orgId, sessionId, jid, delay?)
inbound.onMessage(row, data, fromWebhookSent?, {silent?, history?})   // row = SessionRow

// whatsapp-hooks.service.ts
InboundEvent = { orgId, session: SessionRow, sessionId, chatId (jid), message }
ServiceClosedEvent = { orgId, sessionId, chatId (jid), userId, assignedUserId }

// whatsapp-attendance.service.ts   (ChatKey = { session_id, chat_id (jid) })
attendance.settings(orgId) (org) · updateSettings(orgId, dto) · sign(orgId, userId, text)
attendance.attendants(orgId, sessionId?) · chatRow(orgId, chatUuid) (404) · event(orgId, ChatKey, event, userId, meta?)
attendance.events(orgId, chatUuid) · setStatus(orgId, ChatKey, status, opts) · changeTags(orgId, ChatKey, add, remove)
attendance.setChatTags(orgId, chatUuid, ids, userId) · action(orgId, userId, chatUuid, action, target?)
attendance.stopBot(orgId, ChatKey, status?) · onPanelSend(orgId, ChatKey, userId) · onPhoneSend(orgId, sessionId, jid) · expired(chat, resetHours)

// whatsapp-contacts.service.ts  (contatos são DA ORG; o que depende do número recebe a sessão: SessionRow | sessionId)
contacts.touch(orgId, session|null, waId, info) · canonicalChatId(orgId, session, jid) · phoneOfLid(orgId, session, lid)
contacts.identify(orgId, jids, {chatId?, session?}) · enrichParticipants(orgId, session, jid, participants) · fillMentions(orgId, rows)
contacts.lookup(orgId, jidOrPhone, {sessionId?, chatId?, allowed?}) · mergeChats(orgId, session, phone, lid) · resolveLids(orgId, session) · mergeAll(orgId, session)
contacts.list(orgId, q, allowed) (q.session_id) · sync(orgId, session) · check(orgId, contactId, sessionId?) · photo(orgId, {contactId?|chatUuid?|jid?, sessionId?})
contacts.createManual/patch/bulk/remove/importCsv/exportCsv/tags/getOrFail (inalterados)

// whatsapp-chat.service.ts
chat.chatRow(orgId, chatUuid) (404) · messageSession(orgId, msgId) · listChats(orgId, q, userId, sessionWhere) · counts(orgId, userId, sessionWhere)
chat.getChat(orgId, uuid) · messages(orgId, uuid, q) · openByPhone(orgId, sessionId, phone, name?) · markRead/typing/setFlag(orgId, uuid, …)
chat.recordOut(row: SessionRow, jid, r, {type, body, media_id, quoted, quoted_preview, forwarded, extra, userId}) → shaped
chat.sendText(orgId, userId, {chat_id: uuid, text, quoted_wa_id?, mentions?}) · sendMedia · sendStoredMedia · sendLocation · sendPoll
chat.react/edit/delete(orgId, msgId, …) · forward(orgId, userId, msgId, to: uuid[], allowed) · fillVars(orgId, {chat_id: jid}, text)
chat.importHistory(orgId, row|sessionId, …) · syncChats(orgId, row|sessionId) · groups(orgId, sessionWhere)

// whatsapp-system-send.service.ts
sender.text(orgId, sessionId, jid, text, mark) → boolean

// whatsapp-pacing.service.ts  (POR NÚMERO)
pacing.summary(row) · canSend(row, jid, dailyCap?) · limits(pairedAt) · sentToday(row)   // row = {id, paired_at, pacing_enabled, organization_id}

// whatsapp-media.service.ts (inalterado): store, storeBase64, readBase64, toPublic, signedUrl, referencedIds, absPath
```

## Regras para os serviços restantes
1. **Nada mais usa `sessions.row(orgId)` nem `whatsapp_sessions.findUnique({organization_id})`.** O número vem da conversa (`chat.session_id`), do DTO (`session_id`/`session_ids`) ou de `sessions.readyRows(orgId)`.
2. Toda gravação em `whatsapp_messages` leva `session_id`; o unique é `organization_id_session_id_wa_message_id`.
3. Toda gravação por conversa (service_events, tasks, notes, ratings, charges, bot_sessions, payments, broadcast_sends) leva `session_id`.
4. Rotas que recebem conversa recebem o **uuid**; converta com `chat.chatRow(orgId, uuid)` → `{ id, session_id, chat_id (jid), … }`. Para devolver conversas, use `presenter.shapeChats`.
5. Eventos em tempo real de conversa/mensagem: `presenter.emitSession(orgId, sessionId, …)`; de org: `presenter.emit`.
6. Acesso: controllers recebem `allowed = await access.allowedIds(req.user)` e passam ao serviço quando a lista pode cruzar números; o serviço filtra `session_id in allowed` (null = sem filtro) e responde 404 para recurso de número alheio.
7. Configuração de atendimento: `attendance.settings(orgId)` (não mexa em `whatsapp_sessions.settings.service`).
8. Envio: sempre `sessions.requireReady(orgId, sessionId)` → `row.openwa_session_id`; depois `chat.recordOut(row, jid, r, …)` ou gravação própria com `session_id`.
9. `whatsapp_chat_filters.chat_ids` = uuids de conversa.
10. Sem `import` circular novo: helpers de JID em `wa-jid.util.ts`; prévias em `wa-preview.util.ts`.

## Adendo (06/10/2026) — divisão da audiência do broadcast e dono do contato

- `whatsapp_broadcasts.distribution`: `shared` ("Usar em conjunto", padrão — audiência somada e dividida igualmente entre os números conectados no disparo) ou `own` ("Cada número dispara para seus contatos"). Vale só com 2+ números.
- `whatsapp_contact_sessions (contact_id, session_id, organization_id)`: de qual número o contato veio (agenda sincronizada por ele ou mensagem por ele). Gravado por `contacts.linkToSession` em `sync` e `touch`. É o que define "contatos do número" no modo `own` e no filtro `GET /whatsapp/contacts?session_id`.
- `POST /whatsapp/broadcasts/audience-estimate {targets, session_ids, distribution}` → `{contacts, groups, total, by_session[], warnings[], distribution, unassigned}`.
- Regras completas no CLAUDE.md, seção "Broadcasts com vários números".
