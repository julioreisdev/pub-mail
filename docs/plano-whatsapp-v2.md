# WhatsApp v2 — upgrade do módulo (plano e checklist)

Pedido do Júlio em 29/09/2026: melhorias visuais, bugs, tempo real, etiquetas, status dos contatos e um novo **Fluxo do Bot** com atendimento humano. Execução em etapas, cada uma com deploy e teste em produção.

## Diagnóstico (29/09/2026)

| Problema relatado | Causa encontrada |
|---|---|
| Mídia do cliente aparece "Indisponível" | O whatsapp-web.js (motor atual do OpenWA) **não baixa mídia recebida** desde a migração do WhatsApp para IDs `@lid` (jul/2026). Erro `t: t` na página do WhatsApp Web, 283 falhas em 24 h. É defeito da biblioteca, sem correção publicada ([wwebjs #201844](https://github.com/wwebjs/whatsapp-web.js/issues/201844)); a 1.34.7 (abr/2026) é a última versão. O OpenWA já mantém 11 remendos sobre ela. |
| Lido/não lido fica errado | O OpenWA não emite evento quando a conversa é lida no celular (nenhum dos dois motores). O Pub Mail só zerava ao abrir no painel. |
| Conversa não rola até o fim | O scroll ia ao fim antes das imagens carregarem; a altura crescia depois. |
| Barra de rolagem grossa nos filtros | `scrollbar-width: thin` não vale em todos os navegadores; a barra aparece grossa. |
| Atualização a cada 3 s | Polling. |

**Motor:** o motor **Baileys** do OpenWA baixa mídia recebida normalmente, faz a sincronização inicial (conversas, contatos, mensagens recentes e mapeamento `@lid`) e usa ~10× menos memória. Limitações: histórico anterior à conexão chega **sem mídia** (vale para os dois motores) e não lê reações antigas. Risco de banimento: os dois são não oficiais; o que pesa é o comportamento (volume, listas frias). O Baileys é o motor padrão da Evolution API, a mais usada no mercado brasileiro de atendimento.

**Decisão aplicada:** sobe um **segundo gateway** (OpenWA com Baileys) ao lado do atual. Organizações novas conectam no Baileys. A org que já está conectada continua no whatsapp-web.js até clicar em **Migrar para o novo motor** em Configurações (pede um novo QR; nada do Pub Mail se perde). Os dois gateways usam o mesmo webhook.

## Etapas

### Etapa 1 — Fundação (motor, mídia, tempo real) ✅ 29/09/2026
Validado: WebSocket autenticado (recusa token inválido), evento `wa:chat` ao marcar lida, não lidas do banco = gateway (162 conversas / 2.459). Falta só o Júlio migrar a conexão para o motor direto (botão em Configurações, exige escanear QR).
- [x] Container `openwa-baileys` em `127.0.0.1:2786` (`ENGINE_TYPE=baileys`, `BAILEYS_MARK_ONLINE_ON_CONNECT=false` para o celular continuar recebendo notificações, `SIMULATE_TYPING=false`, limites de mídia inline no webhook maiores), backup incluído.
- [x] `whatsapp_sessions.engine` + cliente OpenWA multi-gateway (roteia por sessão) + `WHATSAPP_DEFAULT_ENGINE`.
- [x] `POST /whatsapp/session/switch-engine` e card "Motor de conexão" em Configurações.
- [x] Bootstrap por motor: no Baileys, histórico vem de `GET /sessions/:id/messages` (store do gateway).
- [x] Mídia: estados claros (baixando / indisponível com motivo / tentar de novo) e botão de download em toda mídia.
- [x] **WebSocket** (Socket.IO, JWT no handshake, sala por org, só quem tem o módulo): eventos `wa:message`, `wa:chat`, `wa:session`, `wa:sync`. Front com reconexão e fallback lento.
- [x] Sincronização de lidos: runner compara `unreadCount` do gateway (20 s com alguém online, 3 min sem ninguém) e empurra pelo WebSocket.

### Etapa 2 — Chat
✅ Back e tela publicados em 29/09.
- [x] Filtros com rolagem sem barra grossa (setas + esmaecimento), filtro **DMs**.
- [x] Rolagem: abre no fim, fica presa ao fim enquanto a mídia carrega, pílula "N novas mensagens".
- [x] Mídia e tipos: imagem, vídeo, áudio/voz (velocidade), documento, figurinha, localização, contato, enquete, chamada, apagada, editada, encaminhada, resposta (clique leva à original), reações.
- [x] **Etiquetas** por conversa (catálogo da org com cor) + etiquetas automáticas (Bot, nome do atendente, Aguardando, Encerrado).
- [x] Filtros avançados: etiquetas, situação do atendimento, atendente, "meus atendimentos", sem resposta há X horas, período.
- [x] Ações de atendimento no cabeçalho: assumir, transferir, enviar para o bot, encerrar.
- [x] Respostas rápidas (`/atalho` no campo de mensagem).

### Etapa 3 — Fluxo do Bot + atendimento
✅ Publicado em 29/09 (interpretador 24/24 em Node; teste real 12/12 na conversa "Eu"; construtor + simulador).
- [x] Modelo: `whatsapp_bot_flows` (1 por org: definição + configurações), `whatsapp_bot_sessions` (estado por conversa), colunas de atendimento em `whatsapp_chats`.
- [x] Runtime: cliente manda mensagem → entra no fluxo (etiqueta Bot); humano responde (painel ou celular) → bot pausa; **24 h** sem interação humana → zera e a próxima mensagem volta ao bot.
- [x] Blocos: mensagens (texto, imagem, vídeo, áudio, documento, com atraso "digitando"), opções numeradas, pergunta com variável, condição, etiquetas, transferir para humano, cobrança PIX (gateway da org), espera, encerrar.
- [x] Aba **Configurações**: ativo, público (todos / só contatos de teste / só com etiqueta), janela de reinício, mensagens de opção inválida, palavra para voltar ao menu, horário de atendimento.
- [x] **Simulador** no construtor (testa o fluxo sem enviar nada no WhatsApp).

### Etapa 4 — Status dos contatos
✅ Publicado em 29/09 (sincronização trouxe 69 status de 30 contatos; visualizador em tela cheia).
- [x] Evento `status.received` + carga do store do gateway → `whatsapp_contact_statuses` (24 h).
- [x] Tela: rodinha de contatos com status, visualizador com progresso, responder e reagir.

### Etapa 5 — Configurações ✅ 29/09
- [x] Progresso da sincronização ao vivo e "sincronizar agora" com opções.
- [x] Atendimento: janela de reinício, assinatura do atendente, som/notificação.
- [x] Gerenciar etiquetas, respostas rápidas e horário de atendimento.
- [x] Diagnóstico do gateway (último evento, falhas de mídia).

### Fechamento
- [x] CLAUDE.md, memória, README PT/EN, Deploy.md + PDF, tutorial do cliente.

**Pendente com o Júlio:** migrar a conexão para o motor direto (Configurações → Motor de conexão → escanear o QR). Sem isso, mídias recebidas continuam sem arquivo.
