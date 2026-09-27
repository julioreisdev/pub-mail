# Análise — Construtor de Funil do Webchat (como funciona hoje)

> Set/2026. Leitura completa de `funnel-utils.js` (305 l.), `FunnelBuilder.jsx` (1099 l.), integração no `WebchatBuilder.jsx` e engine em `PublicWebchat.jsx` (4052 l.). Base pra desenhar o checkout/venda de produtos digitais.

## 1. Onde vive e como é salvo
- O funil é um **JSON dentro de `webchats.settings.personalizacao.funil`**. O back não valida nada (`settings` é livre) → mudanças de shape são só front.
- Aba **"Funil"** do `WebchatBuilder`: toggle **"Habilitar Construtor de Funil"** (`funil.enabled`) + botão que abre um **Dialog fullscreen** com o `FunnelBuilder`. "Concluir" só fecha o modal; persistir é o **Salvar** do builder (`PATCH /webchats/:id {settings}`) ou o **autosave de 60 s**. Com o funil ligado, a IA, as boas-vindas e os quick replies das outras abas são **ignorados** no chat público.
- `normalizeFunil` roda em **todo save** (`WebchatBuilder.normalizePersonalizacao`) e no mount do builder. O runtime público **não** normaliza — lê o JSON cru.
- Preview do builder (aba direita) mostra só a **sequência inicial** estática (mensagens + botões), sem typing.

## 2. Modelo de dados (`funnel-utils.js`)
```
funil = {
  enabled: bool,
  startSequenceId: string,
  sequences: { [id]: Sequence },          // grafo direcionado; nó = sequência
  leadCapture: { triggerSequenceId, fields: ''|'nome_telefone'|'nome_email'|'nome_telefone_email',
                 prompts: { intro, closing, nome, telefone, email } },   // UMA por funil
  ending: { message: HTML≤1000, aiTakeover: bool },                     // GLOBAL do funil
}
Sequence = { id:'seq_…', name≤80, messages: Message[] (≥1), ending: Ending, position:{x,y} }
Message  = { id:'msg_…', type:'text'|'image'|'audio', typingDurationMs: 0..5000 (default 800),
             text:  html
             image: dataUrl (base64), caption (HTML), linkUrl≤500
             audio: dataUrl (base64), durationSec 0..600 }
Ending   = { type:'options'|'wait_input'|'end',
             options: Option[]              // só se 'options'
             captureVariable: 'nome'|'telefone'|'email'|'resposta'|'' ,  nextSequenceId   // só se 'wait_input' }
Option   = { id:'opt_…', label: HTML≤200 (b/i/u/emoji), cssClass≤200,
             action: { type:'goto'|'redirect'|'end'|'send_to_ai', sequenceId, url, triggerMessage≤500 } }
```
- **Whitelists rígidas:** `normalizeMessage` só aceita `text|image|audio` (outro vira `text`); `normalizeEnding` só `options|wait_input|end`; ação só `goto|redirect|end|send_to_ai` (desconhecida vira **`goto`** e os campos extras são zerados). Opção sem label e sem destino é **descartada**. ⇒ qualquer tipo/ação nova precisa entrar aqui primeiro, senão o save do builder apaga.
- Mídia é **base64 inline no JSON** (imagem ≤4 MB original; orçamento total **5 MB** com alerta, não bloqueia). Vai inteira no `GET /public/webchat/:slug/config`.
- `substituteVariables` troca `{{nome}}`/`{{email}}`/`{{telefone}}`/`{{resposta}}` (case-insensitive) em textos, legendas, labels de botão, prompts e mensagem final.
- IDs gerados no cliente (`seq_/msg_/opt_` + timestamp + random).

## 3. O construtor (`FunnelBuilder.jsx`)
- **Canvas ReactFlow** com **um único tipo de nó** (`SequenceNode`: nome, badge "Início", contagem de mensagens, resumo do fim: 🔘 N botões / ⌨️ espera resposta → `{{var}}` / 🏁 fim). Handles em cima (target) e embaixo (source), mas **arestas não são desenhadas pelo usuário** — são **derivadas** do modelo: uma por opção `goto` (azul, label = texto do botão) e uma por `wait_input.nextSequenceId` (roxa tracejada). `onEdgesChange` é no-op.
- Posição persiste só no `onNodeDragStop` (fix do bug da tela branca). `fitView` no load. "Nova sequência" cria abaixo da mais baixa.
- **Painel lateral (SequenceEditor)** da sequência selecionada:
  1. Nome · "Definir como início" · excluir (mín. 1 sequência; excluir limpa referências `goto`/`nextSequenceId` que apontavam pra ela).
  2. **Mensagens**: lista ordenável (↑↓), cada uma com editor por tipo — texto (`RichTextField`: B/I/U + emoji, sanitizado pra `<b><i><u><br>`), imagem (upload → data URL, legenda rica, link ao clicar), áudio (`AudioRecorder` MediaRecorder → data URL webm/ogg, duração) — e **Delay (ms)** = tempo de "digitando…" antes dela. Botões + Texto / + Imagem / + Áudio.
  3. **Como termina?** — select: *Mostrar botões* (OptionsEditor: por botão → texto rico, classes CSS, **Ação ao clicar** = Ir para outra sequência / Abrir URL externa / 🤖 Assistente de IA (mensagem-gatilho) / Encerrar funil; "Adicionar botão"), *Esperar resposta digitada* (WaitInputEditor: variável de captura + "ir para depois"; sem próxima = encerra), *Encerrar funil*.
  4. **Captação de lead** — ativa **após esta sequência terminar**, antes de avançar. Preset de campos + mensagens do bot (intro, uma por campo, fechamento). **Só uma por funil** (ativar aqui desativa na outra). Nota: `setLeadCaptureForSequence` reconstrói `prompts` **sem `intro`/`closing`** → trocar o preset apaga esses dois textos (bug menor).
  5. **Encerramento do funil** — GLOBAL: mensagem final (rica) + switch "Liberar a IA pra continuar" (`aiTakeover`).
- Rodapé: contador "Mídia total X / 5 MB".
- `FunnelBuilder` é `memo` e emite `onChange(funil)` a cada mutação (estado interno + `lastEmittedRef` pra não entrar em loop com o pai).

## 4. Engine de execução (`PublicWebchat.jsx`)
- `funnelMode = funil.enabled && !funnelExited`. No `loadConfig`, se ligado: zera mensagens, zera `funnelState`, e após 150 ms `playFunnelSequence(startSequenceId)`. **Sem persistência**: reload = recomeça do zero (só o `session_id` sobrevive no localStorage).
- `funnelState` = `{ currentSequenceId, variables{}, awaitingInput, awaitingInputVariable, awaitingInputNextSeq, leadCaptureActive, leadCaptureFields[], leadCaptureNextSeq, leadCaptureDone }` (+ `funnelStateRef` pra callbacks estáveis; timers em `funnelTimersRef`, sempre limpos ao trocar de sequência).
- **`playFunnelSequence(id)`**: agenda com `setTimeout` em cascata — pra cada mensagem: typing por `typingDurationMs` → substitui pela bolha (`buildFunnelBotMessage`: texto→`formatAssistantHtml`+variáveis+`sanitizeHtml`; imagem→`mediaType:'image'` + legenda + `mediaLinkUrl`; áudio→`mediaType:'audio'`) → +100 ms. Ao fim (+50 ms), o **finalizer**:
  - `options` → anexa `quickReplies` **na última bolha do bot** `{text: label c/ variáveis, href: url se redirect senão '', cssClass, __funnelOptionId}`; sem opção válida ⇒ `triggerFunnelEnd`.
  - `wait_input` → `awaitingInput=true` (+variável, +próxima).
  - `end` → `triggerFunnelEnd`.
- **Render dos botões**: `<a class="pubmail-qr-btn {cssClass}" href={href||'#'}>` empilhados 100%. Regra crítica: **se tem `href`, o clique não passa por JS** (navega na mesma aba; deixa scripts de anúncio interceptarem). Sem `href` + `__funnelOptionId` ⇒ `preventDefault` + `handleFunnelOptionClick(opt)` (busca a opção na sequência **atual** pelo id). Nota: pra `redirect` o `href` já vai preenchido → o ramo `window.open`+`triggerFunnelEnd` do handler nunca roda.
- **`handleFunnelOptionClick`**: some com os botões (`quickReplies:null` em todas as bolhas → não clica 2×); `send_to_ai` → limpa timers, `funnelExited=true`, e `sendMessage(triggerMessage||label)` vai pra IA como se o lead tivesse digitado; senão adiciona **bolha do usuário** com o label em texto puro (+ possível **anúncio inline** `pickFunnelInlineAd` entre mensagens); `goto` → antes checa `tryStartLeadCapture(destino)` (se a sequência atual é a trigger e ainda não capturou, intercepta) senão `playFunnelSequence`; `end`/inválida → `triggerFunnelEnd`.
- **`handleFunnelTextInput`** (input só aparece quando `awaitingInput`; footer some no resto do funil): bolha do usuário; valida leve (`email` regex, `telefone` ≥8 dígitos → mensagem de erro e reabre); grava em `variables[var]`; se está em **captação intermediária**: pergunta o próximo campo (typing 700 ms) ou, no último, `closing` + `persistFunnelLead` + `leadCaptureDone=true` + vai pra `leadCaptureNextSeq` (1,5 s) ou encerra; fora da captação: se a variável é de lead → `persistFunnelLead`; segue `awaitingInputNextSeq` (300 ms; também passa por `tryStartLeadCapture`) ou encerra.
- **`persistFunnelLead`**: só com `nome` + (`email` ou `telefone`) → `POST /public/webchat/:slug/leads {name,email,phone,source:'webchat-funil',session_id,context}` (silencioso; back faz upsert e roteia pro projeto de e-mail se o webchat tiver `email_project_id`).
- **`triggerFunnelEnd`**: mostra `ending.message` (só se tiver texto real; com variáveis; typing 700 ms), zera estado; se `aiTakeover` → 900 ms depois `funnelExited=true` (input volta e a IA assume com o histórico). Imagem com `linkUrl` clicada também dispara o fim no modo funil.
- **Anúncios**: no funil os inline ads ("entre-mensagens") são inseridos após cada ação do usuário via `pickFunnelInlineAd` (mesma engine do modo IA); topo/rodapé normais.
- **Sanitização no chat**: `sanitizeHtml` remove `script/iframe/form/style`, todo `on*` e `style`, `href/src` com `javascript:`/`data:`. Ou seja, **não dá pra injetar botão/QR "funcional" via HTML de mensagem** — qualquer elemento interativo novo tem que ser um tipo de mensagem/bolha nativo do runtime.

## 5. Limitações / gotchas relevantes pro checkout
1. **Estado 100% no browser** — não há "onde o lead está" no servidor; reload reinicia. Um pagamento precisa de registro no back + `payment_id` guardado na sessão local pra retomar.
2. **Whitelists** (`funnel-utils.js`) — ação/tipo novo precisa entrar em `normalizeEnding`/`normalizeMessage`, no `createDefault*`, no `OptionsEditor` (select de ação + campos) e no `SequenceNode` (resumo).
3. **Botão com `href` não chama JS** — "Comprar" tem que ir **sem `href`** e com `__funnelOptionId` (cai no handler). Se um dia quiser página de checkout externa, aí sim `href`.
4. **Arestas derivadas** — se a ação nova tiver destinos (ex.: "após pagar → sequência X"; "cancelou → Y"), basta gerar as edges no `useMemo` de `edges` com cor/label próprias; e limpar as referências no `deleteSequence`.
5. **Mídia base64 no config público** — entregar vídeo/PDF pelo mesmo mecanismo é inviável (tamanho + qualquer um lê o `config`). Produto pago precisa de **upload no servidor** (há `POST /email/assets` e `POST /telegram/flow-assets` como referência) e **URL só liberada após `PAID`** (assinada/expirável ou proxy que checa a cobrança).
6. **Só uma captação por funil e só 3 campos** (`nome/telefone/email`); `wait_input` pode capturar `resposta` genérica. Checkout precisa de e-mail/telefone do pagador → pode reusar `variables` já capturadas ou exigir captação antes.
7. **Sem `dataLayer`** no webchat (só no quiz) — venda deveria emitir eventos.
8. **Variáveis** são só as 4; um `{{produto}}`/`{{valor}}`/`{{pix}}` teria que ser injetado em `variables` pelo runtime.
9. Bugs menores achados: trocar o preset da captação apaga `intro`/`closing`; `redirect` nunca passa pelo handler (o `href` resolve) — inofensivos.

## 6. Onde o checkout encaixa naturalmente (pré-desenho, sem decisão)
- **Ação de botão `checkout`** (Option.action.type) com `productId` + destinos `onPaidSequenceId` / `onCancelSequenceId` → edges verdes/vermelhas no canvas.
- **Bolha nativa `pix`** gerada em runtime (QR + copia-e-cola + "Copiar" + timer + botões "Já paguei"/"Cancelar" **sem href**), com o mesmo visual de `quickReplies`; polling do status; ao `PAID` toca **mensagens de entrega** (texto/imagem/áudio já existentes + **novos tipos `video`/`file` servidos do servidor**) e segue pra `onPaidSequenceId`.
- **Produtos** cadastrados fora do JSON do funil (tabela própria: nome, preço, arquivos/mensagens de entrega) e referenciados por id — o `config` público nunca expõe preço/arquivo.
- `variables` ganha `produto`, `valor`, `pix_codigo` pra usar `{{…}}` nas mensagens da sequência de cobrança.
