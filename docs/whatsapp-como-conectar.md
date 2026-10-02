# WhatsApp no Pub Mail — como conectar o seu número

Este guia mostra como ligar o WhatsApp da sua empresa ao Pub Mail e usar o Chat com atendimento em equipe, o Fluxo do Bot, os Contatos, o Status, os Agendamentos e os Broadcasts direto no painel.

> **Leia antes de conectar.** O Pub Mail se conecta ao WhatsApp como um "WhatsApp Web" automatizado. A Meta (dona do WhatsApp) pode **restringir ou banir** números que ela entende como automação, e ninguém consegue reverter isso, nem o Pub Mail. Por isso: use um **número dedicado** ao negócio, nunca o seu número pessoal, e siga as dicas de aquecimento no fim deste guia.

---

## 1. O que você precisa

- Um celular com o WhatsApp instalado e o número que será conectado já ativo nele.
- O celular com internet (o WhatsApp conectado funciona mesmo com o celular desligado depois, mas para conectar ele precisa estar online).
- Acesso ao Pub Mail com o módulo **WhatsApp** liberado no seu usuário (aparece o grupo "WhatsApp" no menu lateral).

## 2. Conectar pelo QR Code (recomendado)

1. No Pub Mail, abra **WhatsApp → Configurações**.
2. Clique em **Conectar WhatsApp**. Em alguns segundos aparece um **QR Code**.
3. No celular, abra o WhatsApp:
   - **Android:** toque nos três pontos (⋮) no canto superior direito → **Dispositivos conectados** → **Conectar dispositivo**.
   - **iPhone:** toque em **Configurações** (canto inferior direito) → **Dispositivos conectados** → **Conectar dispositivo**.
4. Aponte a câmera para o QR Code na tela do Pub Mail.
5. Aguarde. O card muda para **Conectado**, mostrando o número, o nome e a data.

O QR Code renova sozinho a cada ~40 segundos. Se ele sumir, clique em **Gerar novo QR**.

## 3. Conectar pelo número (alternativa)

Use só se a câmera não funcionar.

1. Em **WhatsApp → Configurações**, com o QR na tela, clique em **Conectar pelo número**.
2. Digite o número com DDI e DDD, só dígitos (exemplo: `5511999999999`) e clique em **Gerar código**.
3. No celular: WhatsApp → **Dispositivos conectados** → **Conectar dispositivo** → **Conectar com número de telefone** → digite o código de 8 caracteres que apareceu no Pub Mail.

> Atenção: peça o código só para um número que **ainda não está conectado** em outra sessão. O WhatsApp pode derrubar a conexão anterior.

## 4. O que acontece logo depois de conectar

O Pub Mail importa sozinho, em 1 a 3 minutos:

- as suas **conversas** (com nome e foto, incluindo grupos);
- os **contatos** da agenda do celular;
- as **últimas mensagens** das conversas mais recentes.

O progresso aparece em **Configurações → Sincronização com o celular**. Se algo não apareceu, clique em **Sincronizar agora**. Mensagens novas chegam automaticamente, sem precisar sincronizar de novo. Mensagens de antes da conexão chegam sem o arquivo de mídia: o WhatsApp não reenvia arquivos antigos.

## 5. Motor de conexão

Em **Configurações → Motor de conexão** aparece como o Pub Mail conversa com o seu WhatsApp:

- **Direto (recomendado):** recebe as fotos, áudios, vídeos e documentos que os clientes enviam e sincroniza as conversas recentes ao conectar. Toda conexão nova usa este motor.
- **WhatsApp Web (antigo):** não consegue baixar as mídias que os clientes enviam. Se a sua conexão estiver nele, clique em **Migrar para o motor direto**, escaneie o QR Code novo com o mesmo celular e pronto: conversas, contatos, etiquetas e agendamentos continuam no Pub Mail. Depois, no celular, remova o aparelho antigo em **Dispositivos conectados**, se ele continuar aparecendo.

O card **Diagnóstico da conexão** mostra se o gateway está respondendo, o último evento recebido e quantas mídias chegaram nas últimas 24 horas.

## 6. Perfil

Ainda em Configurações, no card **Perfil do WhatsApp**, você pode trocar a **foto**, o **nome de exibição** e o **recado (sobre)**. Isso muda no WhatsApp de verdade, para todos os seus contatos.

## 7. Testar

Clique em **Enviar mensagem de teste**. A mensagem vai para o **seu próprio número** (conversa "Eu mesmo" ou "Você" no WhatsApp). Se chegou, está tudo certo.

## 8. Aquecimento: por que os envios são limitados nos primeiros dias

Números novos, ou recém-conectados a uma automação, chamam a atenção do WhatsApp. O Pub Mail imita o uso humano nos **7 primeiros dias**:

| Dia | Mensagens por dia | Para contatos que nunca falaram com você |
|---|---|---|
| 1 | 20 | 5 |
| 2 | 40 | 10 |
| 3 | 80 | 20 |
| 4 | 160 | 40 |
| 5 | 320 | 60 |
| 6 | 640 | 80 |
| 7 | 1000 | 100 |

Do 8º dia em diante o número é considerado aquecido. **Só os Broadcasts obedecem a esse limite**: o que passar do limite fica aguardando o dia seguinte. Conversar no Chat, publicar Status e Agendamentos pontuais não são bloqueados.

Você pode desligar o limitador em Configurações → **Aquecimento e limites**, mas o risco de restrição passa a ser seu.

Boas práticas que reduzem muito o risco:

- Nos primeiros dias, use o número como uma pessoa: responda quem te escreve, entre em um ou dois grupos, coloque foto e recado.
- **Não dispare para listas frias** (gente que nunca falou com você) logo no começo.
- Prefira mandar para quem já te respondeu ou pediu para receber.
- Mantenha um canal alternativo (e-mail, SMS) para o que for crítico.

## 9. Atendimento em equipe no Chat

Cada conversa individual tem uma **situação de atendimento**, que aparece como etiqueta automática na lista:

| Etiqueta | Significado |
|---|---|
| **Bot** | O Fluxo do Bot está conduzindo a conversa. |
| **Na fila** | O bot transferiu, ou alguém liberou a conversa: falta um atendente assumir. |
| **Nome do atendente** | Essa pessoa está atendendo pelo painel. |
| **Celular** | Alguém respondeu direto pelo celular. |

No cabeçalho da conversa, o botão de **Atendimento** permite assumir, transferir para outra pessoa da equipe, liberar para a fila, encerrar, enviar para o bot e ver o histórico. Quem responde pelo painel assume a conversa automaticamente.

**Regra das 24 horas:** um atendimento sem nenhuma interação da equipe por 24 horas é encerrado sozinho, e a próxima mensagem do cliente volta para o bot. O prazo muda em **Configurações → Atendimento**, onde também dá para ligar a **assinatura do atendente** (o nome aparece no início de cada mensagem).

**Filtros:** use os chips **Não lidos, DMs, Grupos e Meus atendimentos**, crie filtros próprios pelo **+** e use o botão de filtros ao lado da busca para filtrar por etiqueta, situação do atendimento, atendente, "sem resposta há X horas" e data. As mensagens chegam na hora, sem recarregar a página, e o que você lê no celular também aparece como lido no painel.

## 10. Etiquetas e respostas rápidas

- **Etiquetas** (ex.: Orçamento, Pós-venda, VIP): crie em **Configurações → Etiquetas** e aplique na conversa pelo botão de etiqueta do cabeçalho.
- **Respostas rápidas:** cadastre em **Configurações → Respostas rápidas** um atalho (ex.: `/boas-vindas`) com texto e, se quiser, uma foto, áudio ou documento. No chat, digite `/` no campo de mensagem para escolher. `{{nome}}` e `{{telefone}}` são trocados pelos dados do cliente.

## 11. Fluxo do Bot

Em **WhatsApp → Fluxo do Bot** você monta o atendimento automático arrastando blocos: mensagens (texto, foto, vídeo, áudio, documento), **opções numeradas** (o cliente responde 1, 2, 3…), perguntas que guardam a resposta (nome, e-mail, telefone, CPF…), condições, etiquetas, espera, **cobrança PIX** (usa o gateway de Configurações → Pagamentos), transferir para atendente e encerrar.

Como começar com segurança:

1. Monte o fluxo e clique em **Testar fluxo**: o simulador conversa com você como se fosse o cliente, sem mandar nada no WhatsApp.
2. Na aba **Configurações** do bot, deixe o público em **Modo teste** e escolha um ou dois contatos de confiança.
3. Ative o bot e peça para esses contatos mandarem uma mensagem.
4. Quando estiver bom, troque o público para **Todos** (ou para contatos com uma etiqueta).

O bot nunca responde grupos, para de responder quando alguém da equipe entra na conversa (pelo painel ou pelo celular) e volta sozinho depois do prazo de atendimento. Você também define horário de atendimento e palavras para recomeçar o menu (ex.: "menu").

## 12. Status dos contatos

Em **WhatsApp → Status** aparecem os status que os seus contatos postaram nas últimas 24 horas. Clique no contato para ver em tela cheia, responder (a resposta vai para o chat dele) ou reagir. Na mesma tela você publica os seus status, agora ou agendados.

## 13. Trocar de número ou desconectar

Em Configurações, clique em **Desconectar / trocar número** e escolha:

- **Só desconectar**: a conexão é encerrada, mas conversas, contatos e histórico continuam no Pub Mail. Use quando for reconectar o mesmo número.
- **Desconectar e apagar os dados**: além de desconectar, apaga tudo o que veio do número (conversas, mensagens, arquivos de mídia, contatos, status, agendamentos, histórico de atendimento e de broadcasts). Para confirmar, digite **APAGAR**. Não dá para desfazer.

Se o número já estiver desconectado, use o card **Dados do número**, no fim da tela de Configurações, e clique em **Limpar todos os dados**. Ele mostra quanto está guardado antes de apagar.

Na limpeza **continuam**: etiquetas, respostas rápidas, o fluxo do bot, as campanhas de broadcast e as configurações de atendimento. O **bot e os broadcasts ficam desligados**, para nada sair sozinho do próximo número; ligue de novo quando ele estiver conectado. Se quiser, marque a opção de **manter os contatos** que você salvou, adicionou à mão ou importou.

Depois, é só conectar o número novo (ou o mesmo) pelo QR Code.

## 14. Problemas comuns

| O que aparece | O que fazer |
|---|---|
| O QR não aparece / fica carregando | Clique em **Gerar novo QR**. Se persistir, **Desconectar** e **Conectar** de novo. |
| "Desconectado" depois de um tempo | O Pub Mail reconecta sozinho em até 5 minutos. Se não voltar, confira se o celular está com internet e se o WhatsApp não foi desconectado em **Dispositivos conectados**. |
| "Restrito pelo WhatsApp" | O WhatsApp aplicou uma restrição temporária ou permanente ao número. Aguarde o prazo mostrado no celular. Se for permanente, conecte outro número. |
| Contatos ou fotos não apareceram | Clique em **Sincronizar agora** (Configurações → Sincronização com o celular) e aguarde. Fotos carregam aos poucos, quando você abre a lista. |
| Foto ou áudio do cliente aparece como "não pôde ser baixado" | A conexão está no motor antigo: migre para o motor direto (seção 5). Mídias de antes da conexão sempre ficam só no celular. |
| O bot não respondeu | Confira se ele está **Ativo**, se o contato está no público (em Modo teste, só os escolhidos respondem) e se a conversa não está com um atendente ou na fila. |
| Mensagem enviada não chega no destino | Se o contato nunca falou com você, o WhatsApp pode descartar a primeira mensagem sem avisar. Tente de novo mais tarde ou peça para a pessoa te enviar um "oi" primeiro. |
