# Estudo — reduzir banimento de números no WhatsApp (broadcasts e agendamentos)

Data: 08/10/2026. Escopo: módulo WhatsApp do Pub Mail (gateway OpenWA/Baileys, cliente não oficial). Base: código real de `back/src/whatsapp/whatsapp-broadcasts.service.ts`, `whatsapp-pacing.service.ts`, `whatsapp-schedules.service.ts`, `openwa.client.ts` e a configuração do gateway em produção.

> Premissa honesta: **não existe "anti-ban" garantido** num cliente não oficial. O WhatsApp pune por sinais estatísticos (denúncias e bloqueios dos destinatários, volume para desconhecidos, padrões de máquina). O que dá para fazer é reduzir cada sinal, detectar cedo quando um número está sendo punido e parar antes do ban definitivo. Este estudo lista o que já temos, onde estamos expostos e o que implementar, em ordem de impacto.

---

## 1. Como o WhatsApp decide punir (o que pesa de verdade)

Por ordem de peso, segundo o comportamento observado em ferramentas do mercado e nas políticas públicas do WhatsApp (Business Policy, "unsolicited messages"):

| # | Sinal | Peso | Como aparece no Pub Mail |
|---|---|---|---|
| 1 | **Denúncias ("reportar") e bloqueios** por quem recebe, principalmente nas primeiras mensagens de uma conversa nova | Altíssimo | Erro 403 / "blocked" no envio → `BLOCKED` na fila; `session.restriction` → `restricted_at` |
| 2 | **Volume para números que nunca conversaram com você** ("frios") e que **não têm seu número salvo** | Alto | Aquecimento por número (limite de frios/dia) |
| 3 | **Texto idêntico para muitos contatos** em pouco tempo | Alto | Copies com rotação por disparo (uma copy para TODOS da run) |
| 4 | **Ritmo de máquina**: intervalos constantes, rajadas no mesmo segundo, 24 h por dia, sem "digitando", sem ler respostas | Alto | Jitter, pausas, janela — mas sem presença por envio |
| 5 | **Número novo** (dias de vida) com volume | Alto | Aquecimento 7 dias |
| 6 | **Envio para números que não existem no WhatsApp** | Médio-alto (sinal claro de lista comprada) | Hoje só conferido ao abrir "nova conversa", não na audiência |
| 7 | **Link ou mídia na 1ª mensagem** para desconhecido; encurtadores públicos | Médio | Sem regra |
| 8 | **Perfil incompleto** (sem foto, nome, recado) | Médio | Tela Perfil existe; nada obriga |
| 9 | **Baixa taxa de resposta** (mensagens que ninguém responde = spam para o algoritmo) | Médio | Não medimos resposta por campanha |
| 10 | **Entrega sem leitura** por muito tempo (✓ 1 por horas = número do remetente possivelmente restrito) | Médio | Temos `ack`, não usamos como alarme |
| 11 | Cliente não oficial em si (fingerprint do Baileys, reconexões em loop, troca de motor) | Base fixa | `BAILEYS_BROWSER_NAME=Ubuntu`, watchdog reconecta no máx. 1×/5 min |

Conclusão prática: **denúncia + frios + texto igual + ritmo** são 80 % do problema. Cada um deles tem uma correção objetiva abaixo.

---

## 2. O que o Pub Mail já faz (inventário)

Tudo verificado no código em 08/10/2026.

**Ritmo da campanha** (`PRESET_TABLE`, `normPacing`, worker em `whatsapp-broadcasts.service.ts`)
- 4 presets + personalizado: Rápido 3 s ±30 % (exige `risk_ack`), Normal 8 s ±30 % + pausa 10 min/50, Seguro 20 s ±40 % + 15 min/30 + 300/dia, Muito seguro 45 s ±50 % + 20 min/20 + 150/dia + janela 08–20.
- Jitter (`intervalFor`), pausa a cada N, janela de horário (BRT, vira meia-noite), limite diário por campanha (`daily_limit`, vale o menor com o do aquecimento).
- **1 envio por vez por número**, números em paralelo; `PACED` quando bate o limite do dia e volta amanhã (dispatcher reabre).
- 429 do gateway → espera `retry_after`; 403/"blocked"/"not found" → `BLOCKED` (não insiste); outros erros → 3 tentativas com 1, 2, 3 min.

**Aquecimento por número** (`whatsapp-pacing.service.ts`)
- Dia N desde o pareamento: total/dia `[20,40,80,160,320,640,1000]`, frios/dia `[5,10,20,40,60,80,100]`; aquecido (≥ 8 dias) = 1000/dia e 100 frios/dia.
- "Frio" = conversa individual sem NENHUMA mensagem recebida antes (`direction='IN'`).
- Só broadcasts obedecem; chat manual e agendamentos sempre enviam, mas contam.
- O cliente pode desligar (`pacing_enabled=false`) assumindo o risco.

**Audiência** (`resolveAudience`)
- Exclui `is_blocked` (vindo da agenda do gateway) e `opted_out_at` (LGPD: PARE/SAIR).
- Contatos salvos / todos / selecionados / por etiqueta, grupos; divisão entre números (`shared` igual, `own` cada um os seus); contato com conversa vai pelo número da conversa (bom: já é "quente" ali).

**Conteúdo**
- Copies em rotação (sequencial/aleatória, `delete_used`), várias mensagens por copy com `delay_seconds` (manda `typing` antes), variáveis `{{nome}}` / `{{cliente.*}}`.

**Agendamentos** (`whatsapp-schedules.service.ts`)
- Ritmo fixo 1,5–3 s entre destinos, `typing` só quando há `delay_seconds`, pula `opted_out_at`; **não obedece ao aquecimento** (decisão: ação humana pontual).

**Gateway** (`/opt/openwa-baileys/.env`)
- `SEND_PACING_ENABLED=false` (o ritmo é nosso), `SIMULATE_TYPING=false`, `BAILEYS_MARK_ONLINE_ON_CONNECT=false` (celular continua notificando), `BAILEYS_BROWSER_NAME=Ubuntu`.

**Infra que ajuda**
- Multi-número por org, Perfil (foto/nome/recado) editável, Notificações (dá para avisar o dono quando algo der errado), métricas de atendimento, `ack` por mensagem, `restricted_at` na sessão.

---

## 3. Onde estamos expostos (achados concretos)

1. **Nenhum freio automático.** Uma run continua até o fim mesmo com 30 bloqueios seguidos; `session.restriction` grava `restricted_at` mas os broadcasts e agendamentos **não param**. É o pior cenário: o número já está sendo punido e a gente continua alimentando o sinal.
2. **Não verificamos se o número existe** antes de enviar em massa. Lista importada com números inválidos gera dezenas de envios a "ninguém" — para o WhatsApp isso é lista comprada.
3. **Texto igual para todo mundo na mesma run.** A rotação de copies é por disparo, não por destinatário; não há spintax nem variação mínima. Com 500 contatos recebendo o mesmo texto em 1 h, o filtro de conteúdo repetido acende.
4. **Comportamento de máquina por envio.** Só manda `typing` se a mensagem tem `delay_seconds`; sem "digitando" proporcional ao texto, sem "pausado", sem ler as respostas que chegam durante a campanha. O preset Normal (8 s) com texto longo é impossível para um humano.
5. **Rajada no horário.** Todos os números da campanha começam no mesmo minuto e os envios se espalham só pelo intervalo. Não existe "distribuir entre 09:00 e 18:00".
6. **Limite aquecido generoso** (1000/dia, 100 frios/dia fixos) e **sem teto por hora** nem proporção frios/quentes. 100 frios em 1 hora é bem diferente de 100 frios em 10 horas.
7. **Frios e quentes misturados na fila** na ordem da audiência. O ideal é quentes primeiro (geram respostas, "aquecem" o dia) e frios espalhados.
8. **Sem pontuação de saúde do número.** A distribuição `shared` divide igual entre números, mesmo que um esteja com bloqueios recentes.
9. **Sem taxa de resposta por campanha.** Não aprendemos quais audiências são ruins; o mesmo contato que nunca responde entra em todas as campanhas.
10. **Primeira mensagem para frio sem regra**: pode ir com link, mídia, texto longo. É exatamente o que mais gera denúncia.
11. **Agendamentos**: ritmo fixo de 1,5–3 s (rápido demais para texto), modo `all` com N números pode mandar a mesma mensagem ao mesmo contato por vários números, sem teto diário.
12. **Perfil**: nada impede disparar com número sem foto e sem nome.

---

## 4. O que implementar (priorizado)

### P0 — maior impacto, menor esforço (fazer primeiro)

**4.1 Disjuntor automático (circuit breaker) por número e por run**
- Regras (por número, janela móvel dos últimos envios da run): pausar quando **bloqueios ≥ 5 % dos últimos 100 envios** ou **≥ 3 bloqueios seguidos** ou **≥ 5 falhas seguidas** ou **`session.restriction`/queda** da sessão. Pausa tudo daquele número (broadcasts **e** agendamentos) por 24 h; a campanha fica `paused` com o motivo.
- Notificação (já existe o módulo): tipo novo `broadcast_paused` com o motivo, para o dono/admin.
- Retomar: botão na campanha ("Retomar") + automático após a janela se o número voltou a ficar `ready` sem restrição.
- Modelo: `whatsapp_broadcast_runs.paused_at`, `pause_reason`; `whatsapp_sessions.cooldown_until`, `cooldown_reason`; o worker e o runner de agendamentos checam `cooldown_until` antes de enviar.
- Esforço: 1 dia.

**4.2 Verificação de existência antes do envio em massa**
- Para contatos **sem conversa e sem histórico** (`wa_exists` desconhecido), rodar `contacts/check/<n>` na montagem da audiência (ou no primeiro envio), com cache em `whatsapp_contacts.wa_exists` + `wa_exists_checked_at` (válido 30 dias). Inexistente → `SKIPPED` (novo status, com contagem na run), nunca `BLOCKED`.
- Ritmo da checagem: 1/s com jitter (o gateway consulta o WhatsApp; checagem em massa também é sinal — limitar a 300/dia por número e só os desconhecidos).
- Esforço: 1 dia.

**4.3 Presença humana por envio**
- Antes de cada mensagem: `typing` por **1–3 s + 40 ms por caractere, teto 8 s, com jitter**; depois `paused`. Mídia: `recording` para áudio, `typing` curto para imagem.
- Se a conversa tem mensagens recebidas não lidas, **marcar como lida** (`markRead`) antes de enviar — é o que um humano faria.
- Intervalo mínimo entre envios do mesmo número passa a respeitar o tamanho do texto (nunca menos que o tempo de digitação).
- Esforço: 0,5 dia (helpers já existem: `openwa.typing`, `chat.markRead`).

**4.4 Variação de texto por destinatário**
- Spintax nas copies: `{Oi|Olá|E aí}, {{nome}}!` → sorteio por destinatário (parser simples, aninhado, testado em Node).
- Copy sorteada **por destinatário** (não por run) quando há 2+ copies; opção "variações automáticas leves" (pontuação final, emoji de uma lista, ordem de 2 frases marcadas) para quem não quer escrever spintax.
- Detector no pré-voo (4.6): alerta se a campanha vai mandar texto idêntico para > 50 contatos.
- Esforço: 1 dia.

**4.5 Limites mais realistas e frios espalhados**
- Defaults novos (por número, aquecido): **600/dia**, **80 frios/dia**, **20 frios/hora**, frios no máximo **30 % do volume** do dia. Aquecimento: manter a rampa, mas frios/hora = `cold_day/8`.
- Fila ordenada: **quentes primeiro, frios intercalados** (1 frio a cada 3 quentes enquanto houver quentes).
- Agendamentos passam a obedecer **teto por hora** (não o aquecimento inteiro) e dedupe no modo `all`.
- Esforço: 1 dia.

**4.6 Goteio ao longo do dia + pré-voo**
- Opção na campanha: "Distribuir entre HH:MM e HH:MM" → cada envio recebe `next_at` espalhado uniformemente na janela, com jitter; números diferentes recebem offset inicial diferente (nunca começam no mesmo segundo).
- **Pré-voo** ao salvar/disparar: perfil completo?, número aquecido?, % de frios, texto idêntico?, link/encurtador na 1ª mensagem?, mídia na 1ª mensagem?, estimativa de duração, **nota de risco A–E** com o que fazer para melhorar. Não bloqueia (o dono decide), mas exige `risk_ack` em D/E.
- Esforço: 1,5 dia.

### P1 — importante, esforço médio

**4.7 Pontuação de saúde do número (0–100)**
- Fatores: idade do pareamento, bloqueios 7 d, falhas 7 d, taxa de resposta 7 d, `ack = 1` (entregue nunca) acima de 20 % nas últimas 24 h, restrições, quedas. Guardar diário em `whatsapp_session_health` (data, score, fatores) para gráfico.
- Uso: mostrar nas Configurações e no card da campanha; **`shared` distribui proporcional à saúde** (número com 40 recebe metade do que um com 80); abaixo de 30 = só chat manual.
- Esforço: 2 dias.

**4.8 Taxa de resposta e limpeza de audiência**
- Por run: quantos responderam em 24 h (`whatsapp_messages IN` após o envio). Mostrar no histórico ao lado de enviados/bloqueados.
- Regra opcional: contato que **não respondeu a 3 campanhas seguidas** vira `cold_streak=3` e sai da audiência automática "todos/salvos" (continua em "selecionados" e no chat).
- Esforço: 1,5 dia.

**4.9 Primeira mensagem para frio**
- Campanha ganha "Mensagem de abertura para quem nunca conversou": curta, sem link/mídia, com pergunta; o restante da copy (link/mídia) só vai **se a pessoa responder** (gatilho no inbound, 24 h) — ou imediatamente para quem já é quente.
- Esforço: 1,5 dia (reusa a sequência "aguardar resposta" do runner).

**4.10 Perfil e janela por padrão**
- Pré-voo bloqueia disparo com número sem foto **e** sem nome (os dois).
- Preset Normal ganha janela 08–20 BRT por padrão; opção "não enviar aos domingos".
- Esforço: 0,5 dia.

### P2 — refinamento

**4.11 Aquecimento ativo opcional** — nos 7 primeiros dias, os números da org trocam mensagens entre si (e com um número "âncora" da própria empresa) com respostas reais, criando histórico de conversa bilateral. Útil, mas é o tipo de coisa que o WhatsApp também aprende a reconhecer se for mecânico; se fizer, com textos variados, horários humanos e volume baixo (10–20/dia).

**4.12 Links** — domínio próprio para links de campanha (sem encurtador público), um domínio por org se possível; link só a partir da 2ª mensagem; nunca mais de 1 link por mensagem.

**4.13 Gateway** — manter `SIMULATE_TYPING=false` (o nosso é por envio e proporcional); manter `BAILEYS_MARK_ONLINE_ON_CONNECT=false`; não trocar de motor sem necessidade (cada troca = novo dispositivo vinculado); watchdog continua 1×/5 min.

**4.14 Educação na tela** — card fixo em Broadcasts com as 6 regras (número aquecido, audiência que conhece você, texto variado, sem link na 1ª mensagem, horário comercial, pare ao primeiro sinal) e link para este estudo em versão cliente.

---

## 5. Parâmetros recomendados (defaults)

| Parâmetro | Hoje | Recomendado |
|---|---|---|
| Aquecido — total/dia por número | 1000 | **600** |
| Aquecido — frios/dia | 100 | **80** |
| Frios/hora (novo) | — | **20** (aquecimento: `frios_dia/8`) |
| Frios no volume do dia (novo) | — | **≤ 30 %** |
| Preset Normal | 8 s ±30 %, sem janela | **12 s ±40 %, janela 08–20, pausa 10 min/40** |
| Preset Rápido | 3 s | manter, só com `risk_ack` e número saudável (score ≥ 70) |
| Agendamentos | 1,5–3 s fixo | **tempo de digitação + 4–9 s**, teto 20 frios/hora |
| Tentativas após erro | 3 (1/2/3 min) | manter |
| Disjuntor (novo) | — | 5 % bloqueios em 100, 3 bloqueios seguidos, 5 falhas seguidas, restrição → pausa 24 h |
| Checagem de existência (novo) | — | só desconhecidos, 1/s, 300/dia/número, cache 30 d |

---

## 6. Ordem de implementação e esforço

| Etapa | Itens | Esforço | Resultado |
|---|---|---|---|
| 1 | 4.1 disjuntor + 4.3 presença humana | 1,5 dia | Para de alimentar punição; envio deixa de parecer máquina |
| 2 | 4.2 existência + 4.5 limites/frios | 2 dias | Corta o sinal de "lista comprada" e o excesso de frios |
| 3 | 4.4 variação + 4.6 goteio e pré-voo | 2,5 dias | Texto único por pessoa, sem rajada, dono enxerga o risco antes |
| 4 | 4.7 saúde + 4.8 resposta + 4.9 abertura | 5 dias | Rodízio inteligente, audiência limpa, 1ª mensagem segura |
| 5 | 4.10–4.14 | 2 dias | Acabamento |

Total ≈ 13 dias úteis, entregáveis um por deploy (padrão do projeto: implemento → deploy → você valida).

---

## 7. O que medir depois (para saber se funcionou)

- Bloqueios por 100 envios (meta: < 1 %) e por número.
- Taxa de resposta em 24 h por campanha (meta: > 10 % em audiência quente, > 3 % em fria).
- % de envios com `ack = 1` depois de 1 h (meta: < 10 %).
- Restrições/quedas por número por mês (meta: 0).
- Números banidos por mês (meta: 0) — hoje não registramos o motivo do fim de uma sessão; acrescentar `ended_reason` quando o gateway reporta `logged out`.

Tudo isso cabe na tela de Métricas existente (`whatsapp-metrics.service.ts`) como uma aba "Saúde dos números".

---

## 8. O que NÃO fazer

- Não prometer ao cliente "sem ban": prometer **menos risco e aviso cedo**.
- Não subir os limites por pedido do cliente sem o `risk_ack` e sem o número aquecido.
- Não usar encurtadores públicos nem o mesmo link para toda a base em 1 h.
- Não mandar mídia/documento na 1ª mensagem para quem nunca conversou.
- Não religar `SEND_PACING_ENABLED`/`SIMULATE_TYPING` do gateway (são globais e conflitam com o ritmo por número).
