# WhatsApp no Pub Mail — CRM e Cobranças

Este guia mostra como usar o WhatsApp do Pub Mail como central de atendimento e vendas: cadastrar **Clientes** e **Produtos**, **cobrar por PIX ou boleto** dentro da conversa, organizar as oportunidades no **Funil**, não esquecer nada com **Tarefas** e **Notas**, acompanhar os **números** da equipe e cuidar da **LGPD**.

> Pré-requisito: o número já conectado (veja o guia *WhatsApp — Como conectar*). Para cobrar, o gateway de pagamento precisa estar configurado em **Configurações → Pagamentos** (Mercado Pago ou PushinPay; boleto só com Mercado Pago).

---

## 1. Produtos

Em **WhatsApp → Produtos**, cadastre o que a sua empresa vende ou presta: nome, valor e como é cobrado (**avulso**, **mensal**, **trimestral** ou **anual**). Exemplos: "Plano Fibra 300 MB — R$ 129,90 mensal", "Consultoria — R$ 500,00 avulso".

Produtos servem para preencher valor e descrição das cobranças com um clique e para vincular assinaturas aos clientes. Um produto em uso por algum cliente não pode ser apagado; desative-o.

## 2. Clientes

Em **WhatsApp → Clientes** ficam os contatos que são clientes de verdade.

- **Tornar cliente**: abra a conversa no Chat, clique no ícone de cliente (👤💲) no cabeçalho e em **Tornar cliente**. Ou use **Novo cliente** na tela Clientes informando o telefone.
- **Dados**: nome, CPF/CNPJ, e-mail e endereço são opcionais, mas **obrigatórios para boleto**. Observações são só da equipe.
- **Campos personalizados** (dono/admin): crie campos como "Número do contrato" ou "Plano" (texto, número, data ou lista) e eles aparecem no cadastro de todos os clientes.
- **Assinaturas**: vincule um produto, ajuste o valor se precisar e escolha o **dia do vencimento** (1 a 28). A tela mostra quem está **em dia** ou **em atraso**, o **próximo vencimento** e a **receita mensal** das assinaturas.
- **Importar / Exportar CSV**: no topo da tela. O arquivo de importação aceita as colunas `phone,name,doc,email,zip,street,number,district,city,state,notes,product,price,due_day` (só `phone` e `name` são obrigatórias; `product` vincula uma assinatura pelo nome do produto, criando-o se não existir e `price` for informado).

**Variáveis**: em qualquer mensagem (respostas rápidas, broadcasts, agendamentos, bot, mensagens do funil) você pode usar `{{cliente.nome}}`, `{{cliente.primeiro_nome}}`, `{{cliente.produto}}`, `{{cliente.valor}}`, `{{cliente.vencimento}}`, `{{cliente.dia_vencimento}}`, `{{cliente.status}}` e `{{cliente.<campo personalizado>}}`.

## 3. Cobranças

### Cobrar numa conversa
1. No Chat, abra a conversa e clique em **Cobrar** (ícone de recibo). O contato precisa ser cliente; se não for, o painel "Tornar cliente" abre primeiro.
2. Escolha a assinatura ou o produto (valor e descrição preenchem sozinhos) ou digite um valor livre.
3. Escolha **PIX**, **Boleto** ou **PIX + Boleto** e o vencimento.
4. **Gerar e enviar**: o cliente recebe a mensagem com o valor, o **código PIX copia e cola**, a **imagem do QR Code** e, se houver, o **link do boleto** com a linha digitável.

A confirmação é **automática**: assim que o pagamento cai no gateway, a cobrança vira **Paga**, o cliente recebe o **recibo** e, se era uma assinatura, o **vencimento avança** para o próximo período.

### Cobrança recorrente
Com uma assinatura mensal/trimestral/anual, o Pub Mail **gera e envia a cobrança sozinho** alguns dias antes do vencimento (padrão: 5 dias) e manda os **lembretes** da régua: 3 dias antes, no dia, 1 dia depois e 5 dias depois. No dia seguinte ao vencimento sem pagamento, o cliente fica **em atraso** e recebe a etiqueta **Inadimplente** na conversa (sai ao pagar).

### Tela Cobranças
Em **WhatsApp → Cobranças**: valores **a receber**, **em atraso** e **recebido no mês**; filtros por situação, meio e origem; por cobrança: **copiar o PIX**, **abrir o boleto**, **verificar pagamento**, **reenviar na conversa**, **marcar como paga** (quando o cliente pagou por fora; só dono/admin) e **cancelar** (cancela também no gateway). **Rodar agora** executa na hora a rotina diária (que roda sozinha às 9h).

### Configurar (dono/admin)
Validade do PIX e do boleto após o vencimento, quantos dias antes gerar a recorrente, enviar ou não o QR, etiqueta de inadimplente, quais lembretes usar e todos os **textos** (com `{{cliente.*}}`, `{{cobranca.valor}}`, `{{cobranca.descricao}}`, `{{cobranca.vencimento}}`, `{{cobranca.pix}}`, `{{cobranca.boleto_link}}`, `{{cobranca.boleto_codigo}}`).

> Importante sobre PIX no Mercado Pago: um PIX pago **depois** de expirar é devolvido ao pagador. Por isso a validade padrão é longa (7 dias após o vencimento) e a confirmação é automática.

## 4. Funil

Em **WhatsApp → Funil** você vê as conversas como cartões em colunas (etapas): **Novo → Em contato → Proposta → Fechado → Perdido** (pode renomear, recolorir, reordenar e criar até 15).

- **Arraste** o cartão entre colunas ou use o menu ⋮ → **Mover para**.
- **Valor estimado** por conversa; a coluna soma os valores.
- **Ações da etapa** (dono/admin, menu da coluna → Editar): ao receber uma conversa, a etapa pode **enviar uma mensagem**, **aplicar/remover etiquetas** e **criar uma tarefa** com prazo.
- **Automação** (botão no topo): **entrada automática** (toda conversa individual que mandar mensagem e ainda não estiver no funil entra na etapa escolhida) e **pago → etapa** (quando uma cobrança é paga, a conversa vai para a etapa escolhida, por exemplo "Fechado").
- Na conversa, a aba **Funil** do painel lateral mostra e muda a etapa e o valor.

## 5. Tarefas e Notas

- **Tarefas** (**WhatsApp → Tarefas** ou aba **Tarefas** na conversa): título, prazo, responsável e conversa ligada. Abas **Minhas / Todas / Concluídas**, grupos **Atrasadas / Hoje / Próximas / Sem prazo**. Quando o prazo chega, o responsável recebe um **aviso** no painel.
- **Notas internas** (aba **Notas** na conversa): observações da equipe que o cliente nunca vê. Dá para **fixar** no topo; só quem escreveu (ou um admin) edita ou apaga.
- Tudo isso aparece na **linha do tempo** do atendimento (mudança de etapa, tarefa criada/concluída, nota).

## 6. Métricas

Em **WhatsApp → Métricas** (período de 7, 30, 90 dias, mês ou personalizado):
- conversas ativas e novas, mensagens recebidas/enviadas (humano, bot, automático);
- **tempo até a 1ª resposta humana** e **tempo de resolução** (média e mediana);
- atendimentos assumidos/encerrados, fila e em atendimento agora;
- **por atendente**: enviadas, assumidos, encerrados, 1ª resposta e nota de satisfação;
- conversas por **etiqueta**, situação do **funil** e **cobranças** (emitidas, pagas, em atraso).

## 7. Pesquisa de satisfação

Em **Configurações → Atendimento**, ligue **Pesquisa de satisfação ao encerrar**. Quando um atendente encerra o atendimento pelo painel, o cliente recebe a pergunta (ex.: "De 1 a 5, como foi o nosso atendimento?"). A resposta que começar com o número vira a **nota** (o resto vira comentário), aparece nas Métricas e na linha do tempo, e o cliente recebe o agradecimento. A pergunta vale pelo prazo configurado (padrão 24 h) e não se repete na mesma conversa em 24 h.

## 8. Distribuição automática da fila

Em **Configurações → Atendimento → Distribuição automática da fila**:
- **Desligada**: a fila fica visível e cada um assume o que quiser.
- **Rodízio**: cada conversa nova da fila vai para o próximo atendente **online**.
- **Menos ocupado**: vai para quem tem menos conversas em andamento.

"Online" é quem está com o Pub Mail aberto no módulo WhatsApp. Sem ninguém online, a conversa espera e é distribuída assim que alguém entrar. Quem liberou uma conversa para a fila não a recebe de volta na hora.

## 9. LGPD — descadastro por palavra

Ligado por padrão em **Configurações → Atendimento**: se o contato mandar **só** a palavra de saída (padrão **PARE**, **SAIR** ou **CANCELAR**; sem diferença de maiúsculas ou acentos), ele é marcado como **descadastrado**, recebe a confirmação e **sai dos broadcasts e dos agendamentos**. Cobranças, lembretes, mensagens do bot, do funil e do atendimento continuam, por serem comunicação da relação comercial.

Em **Contatos**, o filtro **LGPD** lista os descadastrados (chip "Descadastrado") e o botão de **reativar** só deve ser usado com o consentimento do contato.

## 10. Perguntas frequentes

| Situação | O que fazer |
|---|---|
| "Configure o gateway de pagamento" ao cobrar | Vá em **Configurações → Pagamentos**, cole o token do Mercado Pago (ou PushinPay), teste e ative. |
| Boleto desabilitado | Boleto só existe no Mercado Pago e o cliente precisa de CPF/CNPJ, e-mail e endereço completo no cadastro. |
| Cobrança "Falhou" | O gateway recusou (token inválido, conta sem PIX, dados do pagador). Corrija e crie de novo. |
| O cliente pagou mas continua "Em aberto" | Clique em **Verificar pagamento**. Se pagou por fora, **Marcar como paga**. Confira também se o webhook do gateway está cadastrado (URL em Configurações → Pagamentos). |
| A cobrança recorrente não foi gerada | A assinatura precisa estar **ativa** com vencimento futuro e a opção **Gerar e enviar sozinho** ligada em Cobranças → Configurar. Use **Rodar agora** para testar. |
| A pesquisa de satisfação não foi enviada | Ela só sai quando um atendente **encerra** pelo painel uma conversa que estava em atendimento ou na fila, com o WhatsApp conectado. |
| Conversa não entrou no funil sozinha | Ligue a **entrada automática** em Funil → Automação e escolha a etapa. Só conversas individuais entram. |
