# WhatsApp no Pub Mail — como conectar o seu número

Este guia mostra como ligar o WhatsApp da sua empresa ao Pub Mail para usar o Chat, os Contatos, o Status, os Agendamentos e os Broadcasts direto no painel.

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

Se algo não apareceu, clique em **Importar do celular** em Configurações. Mensagens novas chegam automaticamente, sem precisar importar de novo.

## 5. Perfil

Ainda em Configurações, no card **Perfil do WhatsApp**, você pode trocar a **foto**, o **nome de exibição** e o **recado (sobre)**. Isso muda no WhatsApp de verdade, para todos os seus contatos.

## 6. Testar

Clique em **Enviar mensagem de teste**. A mensagem vai para o **seu próprio número** (conversa "Eu mesmo" ou "Você" no WhatsApp). Se chegou, está tudo certo.

## 7. Aquecimento: por que os envios são limitados nos primeiros dias

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

## 8. Trocar de número ou desconectar

Em Configurações, clique em **Desconectar / trocar número**. A conexão é encerrada, mas os **contatos salvos na organização**, os **broadcasts** e os **agendamentos** continuam. Depois, é só conectar o número novo (ou o mesmo) pelo QR Code.

## 9. Problemas comuns

| O que aparece | O que fazer |
|---|---|
| O QR não aparece / fica carregando | Clique em **Gerar novo QR**. Se persistir, **Desconectar** e **Conectar** de novo. |
| "Desconectado" depois de um tempo | O Pub Mail reconecta sozinho em até 5 minutos. Se não voltar, confira se o celular está com internet e se o WhatsApp não foi desconectado em **Dispositivos conectados**. |
| "Restrito pelo WhatsApp" | O WhatsApp aplicou uma restrição temporária ou permanente ao número. Aguarde o prazo mostrado no celular. Se for permanente, conecte outro número. |
| Contatos ou fotos não apareceram | Clique em **Importar do celular** e aguarde. Fotos carregam aos poucos, quando você abre a lista. |
| Mensagem enviada não chega no destino | Se o contato nunca falou com você, o WhatsApp pode descartar a primeira mensagem sem avisar. Tente de novo mais tarde ou peça para a pessoa te enviar um "oi" primeiro. |
