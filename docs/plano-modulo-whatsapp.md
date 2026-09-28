# Plano — Módulo WhatsApp no Pub Mail (via OpenWA)

Data: 28/09/2026 · Status: **CONCLUÍDO em 28/09/2026 — Fases 0–6 + filtros personalizados do chat + Agendamentos; validado com número real** · Base técnica: OpenWA 0.23.7 (estudo em 27/09) · Dono: Júlio

## 1. O pedido

Módulo **WhatsApp** com 5 telas — Configurações (QR, testar conexão, perfil), Chat (pessoas e grupos), Status (postar, inclusive agendado), Contatos (listar e **salvar na organização** para sobreviver à troca de número), Broadcasts (contatos e grupos, com acompanhamento) — **1 sessão por organização**, qualidade alta no front e, principalmente, back que não trava. Verificar botões, reações, responder e encaminhar.

## 2. Viabilidade, item por item (verificado no código do OpenWA)

| Pedido | Viável? | Como o OpenWA entrega | Observação |
|---|---|---|---|
| Escanear QR Code | ✅ | `POST /sessions`, `POST /sessions/:id/start`, `GET /sessions/:id/qr` (ou `POST …/pairing-code` por número) + evento `session.qr` | QR expira e renova; a tela precisa fazer polling ou ouvir o evento |
| Testar conexão | ✅ | `GET /sessions/:id` (status READY/…) + envio de teste para o próprio número | igual ao botão "Enviar mensagem de teste" do Telegram |
| Foto de perfil / nome / recado | ✅ | `PUT /sessions/:id/profile/{picture,name,status}` | ambas as engines |
| Chat com pessoas e grupos | ✅ | `send-text/image/video/audio/voice/document/location/contact/sticker/poll`, `chats/typing`, `chats/read`, `GET /sessions/:id/chats` | mídia do inbound vem inline no webhook (base64) — nós guardamos |
| **Responder** (citar) | ✅ | `POST …/messages/reply` | ambas |
| **Encaminhar** | ✅ | `POST …/messages/forward` | ambas |
| **Reagir** | ✅ | `POST …/messages/react` | ambas |
| **Ver reações** recebidas | ⚠️ | `GET …/messages/:chat/:msg/reactions` só no whatsapp-web.js; evento `message.reaction` chega nas duas | com Baileys, guardamos as reações a partir do evento |
| Editar / apagar mensagem | ✅ | `edit`, `delete` | ambas |
| Histórico antigo do chat | ⚠️ | `GET …/messages/:chat/history` só no whatsapp-web.js | com Baileys só o que passar pelo webhook depois do pareamento (mesmo modelo do Telegram) |
| **Mensagem com botões** | ❌ | **não existe rota de envio**; o WhatsApp desligou botões interativos para clientes não-oficiais (só a Cloud API oficial da Meta envia). O `click-button` do OpenWA serve só para *responder* botão recebido de conta Business (Baileys) | alternativas reais: **enquete** (`send-poll`, nativa, ambas as engines) e "opções numeradas" no texto com o bot entendendo `1`/`2` |
| Status texto/imagem/vídeo/voz | ✅ | `POST /sessions/:id/status/send-{text,image,video,voice}` | no whatsapp-web.js depende de um patch do OpenWA sobre a lib (funciona hoje, é frágil a atualizações) |
| Status **agendado** | ✅ (nosso) | OpenWA não agenda; o Pub Mail guarda e um cron dispara na hora (BRT) | igual aos agendamentos de e-mail |
| Contatos | ✅ | `GET /sessions/:id/contacts`, foto, telefone de `@lid`, bloquear | salvar na org = tabela nossa, independente da sessão |
| Grupos | ✅ | listar, entrar por convite, participantes, foto, descrição, admins | **criar grupo só no Baileys** (no whatsapp-web.js está quebrado pela lib) |
| Broadcasts | ✅ | `send-bulk` com lote acompanhável (`GET batch/:id`, cancelar) **+** "send pacing" nativo (aquecimento por idade do número, teto de contatos frios/dia, disjuntor) | eu recomendo fila **nossa** (como no Telegram) por cima, para métricas/retomada por org, usando o pacing do OpenWA como rede de segurança |
| Receber tudo em tempo real | ✅ | webhook por sessão com HMAC, idempotência, retry, dead-letter; ou Socket.IO `/events` | webhook → nosso back (como Telegram) |
| Aviso de restrição/ban | ✅ | eventos `session.restriction`, `session.disconnected`, `session.reconnect_loop` | mostrar no card da sessão, igual ao "flood" do Telegram |

**Conclusão:** tudo que você pediu é viável, exceto **botões interativos**, que nenhum gateway não-oficial consegue enviar hoje. Nesse ponto proponho enquetes + opções numeradas.

## 3. Decisões que precisam do seu OK

**D1 — Engine (vale para a instalação inteira; o OpenWA não mistura).**

| | `whatsapp-web.js` (padrão) | `baileys` |
|---|---|---|
| Risco de ban | menor (Chromium real, tráfego igual ao WhatsApp Web) | maior (protocolo direto, fácil de identificar) |
| RAM por sessão | 300–500 MB | 30–80 MB |
| Na VPS atual (8 GB, 2 vCPU, ~1,5 GB usados pelo Pub Mail) | **~6 a 8 organizações** com folga; CPU vira gargalo antes | 40+ organizações |
| Funções | histórico, ler reações, `order/product`, tudo o que você pediu | sem histórico antigo, sem ler reações (só por evento), criar grupo funciona, versão *release candidate* |

Minha recomendação: **começar com `whatsapp-web.js`** (cada cliente é um número que pode ser banido; segurança pesa mais) e, quando passar de ~6 orgs, **VPS dedicada ao OpenWA** (16 GB / 4 vCPU) em vez de trocar a engine. Alternativa: Baileys desde o início se a meta for dezenas de clientes rápido e você aceitar o risco.

**D2 — Docker na VPS.** O OpenWA é feito para rodar em container (Chrome + ffmpeg dentro). A VPS não tem Docker. Proponho instalar Docker e subir o OpenWA em `127.0.0.1:2785` (nunca exposto), com os dados de sessão em volume persistente e backup diário.

**D3 — Modelo de acesso.** O Pub Mail guarda **uma** chave admin do OpenWA no servidor; o front nunca fala com o OpenWA. Cada org tem uma sessão `org-<id>`; toda chamada passa pelo back do Pub Mail com scoping por `organization_id`. Dashboard do OpenWA fica fechado (só localhost).

**D4 — Botões.** Aceita enquete + opções numeradas como substituto? (Não há outra saída fora da API oficial da Meta.)

**D5 — Retenção de mídia.** Mídia recebida vem inline; proponho guardar em `back/protected/whatsapp/<org>/` (fora do nginx, URL assinada como nos produtos do webchat) com **retenção de 90 dias** e limite por org. Sem isso o disco enche.

**D6 — Troca/perda de número.** Ao trocar, a sessão antiga é apagada, a nova pareia, e **contatos salvos, grupos conhecidos, broadcasts e agendamentos continuam** (são da org, não da sessão). O histórico de chat da sessão antiga fica somente leitura. OK?

**D7 — Tempo real no chat.** Polling de 3 s como nas DMs do Telegram (simples, já validado) ou WebSocket? Polling primeiro; WebSocket como melhoria.

**D8 — Aquecimento e limites.** (Implementado NO PUB MAIL, por org — o pacing do OpenWA é global e foi desligado.) Ligar o `SEND_PACING` do OpenWA com o cronograma padrão (20, 40, 80, 160, 320, 640, 1000 msgs/dia pela idade do número; frios 5→100/dia) e mostrar o limite do dia na tela de Broadcasts. Broadcast para "frios" exige que o cliente marque um aviso de risco.

## 4. Arquitetura proposta

```
Cliente (SPA) ──JWT──▶ back Pub Mail (NestJS)  ──API key admin, 127.0.0.1──▶ OpenWA (Docker :2785)
                            ▲                                                       │
                            └──────── POST /webhooks/whatsapp/:session (HMAC) ◀─────┘
```

- **Infra:** Docker + `docker-compose` em `/opt/openwa` (imagem fixada por versão, `ENGINE_TYPE`, SQLite interno do OpenWA em volume, `SEND_PACING_*`, `WEBHOOK_SSRF_PROTECT` off só para `127.0.0.1`, `MAX_CONCURRENT_SESSIONS`, `mem_limit`). Backup do volume de sessões no cron diário. Atualização do OpenWA só manual e testada (cadência alta de breaking changes).
- **Back `back/src/whatsapp/`** (mesmo padrão do Telegram): `openwa.client.ts` (HTTP client tipado, timeouts, retries, mapeia erros 429 `SEND_PACING_LIMITED` → mensagem clara), `whatsapp-sessions.service` (1 por org: criar/iniciar/QR/pareamento por código/status/parar/apagar/perfil/teste), `whatsapp-webhook.controller` (`@Public @SkipThrottle`, verifica `X-OpenWA-Signature` sobre o raw body, dedupe por `X-OpenWA-Idempotency-Key`, ACK rápido e processa em background — igual ao Telegram), `whatsapp-inbound.service` (grava mensagens/chats/contatos/reações/acks, salva mídia protegida, marca restrição/desconexão), `whatsapp-chat.service` (lista chats, thread, enviar texto/mídia/áudio/doc, responder, encaminhar, reagir, editar, apagar, digitando, lido), `whatsapp-contacts.service` (sincronizar da sessão, **salvar na org**, tags, exportar), `whatsapp-status.service` + runner (postar agora / agendar, cron por minuto em BRT), `whatsapp-broadcasts.{service,runner}` (audiência = contatos salvos + grupos, copies com rotação, agendamento diário, fila `whatsapp_broadcast_sends` com worker e ritmo por sessão, retomada, métricas, respeita 429 do pacing com espera), `whatsapp-watchdog.runner` (checa `GET /sessions/:id` a cada minuto, reinicia sessão caída, registra `restricted`).
- **Tabelas** (migration `…_add_whatsapp`): `whatsapp_sessions` (org única, `openwa_session_id`, status, phone, pushname, `paired_at`, `restricted_at`, `last_seen_at`), `whatsapp_contacts` (org, phone, lid, name, pushname, `saved` bool, tags, `source_session_id`, foto), `whatsapp_chats` (org, chat_id, kind individual|group, title, `last_message_*`, unread), `whatsapp_groups` (org, chat_id, subject, participantes count, admin bool), `whatsapp_messages` (org, chat_id, wa_message_id, direction, type, body, media ref, `quoted_id`, `forwarded`, ack 0–4, reactions JSON, `sent_by_user_id`), `whatsapp_media` (protegida, mime, size, path, expira), `whatsapp_statuses` (org, type, body/media, `schedule_at`, status pending|posted|failed, `wa_status_id`, result), `whatsapp_broadcasts` / `_copies` / `_runs` / `_sends` (espelho do Telegram). `admin.removeOrganization` apaga tudo e destrói a sessão no OpenWA.
- **Módulo de acesso:** chave `whatsapp` em `MODULES` + mapa de rota `/whatsapp*` + `requiredModule` no menu + `RequireModule`; runners pulam org sem acesso (`isOrgActive`).
- **Front `views/pages/whatsapp/`**: grupo de sidebar **WhatsApp** (ícone `IconBrandWhatsapp`) com 5 itens; reaproveita o design-system do Telegram (`telegram/ui` → promover a `ui-component/kit` compartilhado). Telas: **Configurações** (card da sessão com QR ao vivo/pareamento por código, status com bolinha, número, foto, nome, recado, "Enviar mensagem de teste", "Desconectar/trocar número", aviso de restrição e do aquecimento), **Chat** (lista com busca/filtro pessoas|grupos, thread estilo WhatsApp com bolhas, mídia inline, citação, encaminhado, reações, acks ✓✓, composer com anexo/áudio gravado/emoji/enquete, responder/encaminhar/reagir/editar/apagar no menu da bolha), **Status** (compor texto/imagem/vídeo/voz com preview estilo stories, "publicar agora" ou "agendar", lista de agendados/publicados com resultado), **Contatos** (tabela da sessão vs salvos na org, sincronizar, salvar em massa, tags, importar/exportar, "verificar se tem WhatsApp"), **Broadcasts** (igual ao Telegram: lista com status por horário, modal de audiência contatos/grupos com estimativa, copies com preview, histórico com barra enviados/falhas, limite do dia do aquecimento visível).

## 5. Fases (1 deploy por fase, com teste em produção antes de você validar)

| Fase | Entrega | Tamanho |
|---|---|---|
| 0 ✅ | Docker + OpenWA 0.23.7 em 127.0.0.1 (`/opt/openwa`), env, chave no `back/.env`, cliente HTTP tipado, tabela `whatsapp_sessions`+`whatsapp_session_events`, módulo `whatsapp` no gating e no menu, regra ufw p/ o container alcançar o back. Backup do volume: pendente (Fase 6) | feito |
| 1 ✅ | **Configurações**: sessão por org, QR/pareamento, status ao vivo, perfil (nome/recado/foto), teste, desconectar/trocar número, aquecimento com toggle de responsabilidade, atividade, watchdog, webhook assinado gravando eventos | feito |
| 2 ✅ | Pipeline de entrada (message.*/group.* → tabelas; mídia protegida; fila sequencial por sessão) + tela de Contatos (salvar na org, tags, bulk, sync, import/export CSV, verificar número) | feito |
| 3 ✅ | Chat completo (lista, thread, polling 3 s, texto/mídia/áudio gravado/documento/localização/enquete, responder, encaminhar, reagir, editar, apagar, digitando, lido, acks, grupos com participantes) | feito |
| 4 ✅ | Status texto/imagem/vídeo/voz, agora ou agendado (BRT), preview 9:16, histórico | feito |
| 5 ✅ | Broadcasts (audiência salvos/todos/tags/selecionados + grupos, copies com rotação e variáveis, horários diários, fila com ritmo e aquecimento POR ORG, histórico com envios, aviso de risco obrigatório) | feito |
| 6 ✅ | Backup diário do volume, cota de mídia por org, tutorial `WhatsApp - Como conectar.pdf`, Deploy.md §22 + PDF, README PT/EN | feito |
| + ✅ | Extras pedidos em 28/09: filtros personalizados no Chat (abas com contatos/grupos) e página **Agendamentos** (mensagem pontual em data/hora; some da lista após enviar) | feito |

Ordem pensada para você testar cedo com número real (Fase 1) antes de investir no chat.

## 6. Riscos que ficam mesmo fazendo tudo certo

- **Ban do número do cliente.** Não depende de nós. Mitigação: número dedicado, aquecimento automático, tetos diários, aviso obrigatório na tela de Broadcasts, evento de restrição visível. O termo de uso do Pub Mail precisa dizer isso.
- **Quebra por atualização do WhatsApp Web.** O OpenWA corrige rápido (várias releases por semana), mas entre a quebra e o fix o módulo pode ficar sem enviar. Fixar versão e atualizar de forma controlada; watchdog avisa.
- **Mantenedor único do OpenWA.** Se o projeto parar, a alternativa é trocar o gateway (Evolution API, WAHA) — por isso o `openwa.client.ts` isola a API atrás de uma interface nossa.
- **Recursos.** Com `whatsapp-web.js`, cada org custa ~0,5 GB de RAM permanente e CPU no pareamento; planejar VPS dedicada quando passar de 6 orgs.
