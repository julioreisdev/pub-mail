# WhatsApp no Pub Mail — Assinaturas e autoatendimento

Este guia mostra como vender **planos e assinaturas** pelo WhatsApp e deixar o cliente se virar sozinho: ele se cadastra, assina, recebe a cobrança, paga, consulta a fatura, pede a 2ª via, agenda horário, abre chamado, faz pedido e até cancela — tudo pela conversa, sem atendente. Serve para clínica, provedor de internet, loja, empresa de segurança, conteúdo VIP, prefeitura, mercado e qualquer negócio que cobre todo mês.

> Pré-requisitos: número conectado (guia *WhatsApp — Como conectar*) e gateway de pagamento em **Configurações → Pagamentos**. O guia *WhatsApp — CRM e Cobranças* explica o básico de clientes, cobranças e funil; aqui está o que vem por cima.

---

## 1. Comece por um modelo pronto

Em **WhatsApp → Configurações**, no card **Começar com um modelo**, escolha o ramo mais parecido com o seu:

| Modelo | O que ele monta |
|---|---|
| **Clínica / consultório** | Serviços com duração, profissionais com horário, planos mensais com consultas inclusas e um bot que agenda, remarca e manda a 2ª via |
| **Provedor de internet** | Planos de fibra, chamados técnicos com protocolo e prazo, roteiro de "estou sem internet" e 2ª via |
| **Loja** | Catálogo por categoria, pedido pelo WhatsApp com entrega ou retirada e PIX |
| **Segurança e monitoramento** | Planos de monitoramento, ocorrência urgente direto para a central, chamados de equipamento |
| **Conteúdo VIP** | Plano mensal e anual, assinatura com PIX, troca de plano e cancelamento com retenção |
| **Prefeitura / serviço público** | Protocolos com foto e bairro, consulta do andamento e telefones úteis |
| **Mercado / delivery** | Catálogo por seção, pedido mínimo, frete grátis acima de um valor |

Clique em **Ver o que cria** para conferir e em **Aplicar**. O modelo cria produtos, campos, etiquetas, etapas do funil e um **fluxo do bot**. Nada é duplicado: o que já existe com o mesmo nome fica como está. **O bot do modelo nasce desligado** — revise os textos e valores, teste no simulador e só então ligue (veja a seção 6).

## 2. Produtos e planos

Em **WhatsApp → Produtos**:

- **Tipo**: *plano* (cobrança recorrente: mensal, trimestral, semestral ou anual), *produto avulso* (vendido uma vez ou no pedido) ou *serviço* (vai para a Agenda, com duração).
- **Teste grátis**: dias de teste antes da 1ª cobrança.
- **Proporcional (pró-rata)**: quem assina no meio do mês paga só os dias até o dia de vencimento escolhido.
- **Carência**: quantos dias depois do vencimento o cliente ainda é considerado em dia.
- **Régua de lembretes própria**: se este plano precisa de lembretes diferentes dos da empresa.
- **Política de cancelamento**: na hora, no fim do período já pago, ou só com atendente.
- **Ao pagar, liberar…**: o que o cliente ganha enquanto paga — **entrar num grupo do WhatsApp**, **receber uma etiqueta**, **receber um arquivo** ou um sinal para outro sistema. Atrasou além do prazo, o acesso é suspenso; cancelou, é revogado.

## 3. Clientes

Em **WhatsApp → Clientes**:

- **Vários números por cliente** (titular, financeiro, usuário, dependente) e **o mesmo número em mais de um cliente** (ex.: a mãe que paga a mensalidade de dois filhos). No bot, quem tem mais de um cadastro escolhe qual.
- **CPF/CNPJ é opcional**. Se a sua empresa exigir, ligue em **Campos e identificação → Identificação do cliente**: aí o bot pede o documento antes de mostrar faturas ou dados. O documento fica **cifrado** no banco.
- **Código / matrícula / contrato**: um código seu para o cliente informar no bot (consulta somente leitura; para 2ª via e alterações o bot pede o CPF).
- **Unidade**, **código no seu sistema (ERP)** e **endereços** de atendimento e entrega (o endereço do boleto fica separado).
- **Campos personalizados** (placa do carro, plano de saúde, número do contrato…) em clientes, produtos, assinaturas, cobranças, chamados, agendamentos e pedidos. Podem ser obrigatórios, visíveis ao cliente e **perguntados pelo bot**.

### Importar muitos clientes de uma vez

No topo da tela Clientes, **Importar CSV**:

1. **Baixe o modelo** (CSV) e preencha. As colunas principais são `phone` (obrigatória), `name`, `doc`, `email`, endereço, `product`, `price`, `due_day`. Também dá para trazer `external_id`, `unit`, campos personalizados (`custom.<campo>`), o **próximo vencimento** (`next_due`), um **saldo devedor** (`balance` + `balance_due`) e o **histórico de pagamentos** (`paid_history`, no formato `2026-08-10:129,90|2026-09-10:129,90`).
2. Envie o arquivo (até **50 mil linhas**). A importação roda **em segundo plano**: pode fechar a tela e voltar depois.
3. Acompanhe a barra de progresso. No fim, baixe o **relatório de erros** com a linha e o motivo de cada linha recusada, corrija e importe só essas de novo.

Nada importado manda mensagem nem gera cobrança no gateway — cliente antigo não recebe "boas-vindas" nem PIX na hora. Ligue **Só simular** para validar o arquivo sem gravar nada; depois clique em **Importar de verdade**.

## 4. Assinaturas

No cliente → **Assinaturas** → **Nova**:

- Escolha o plano, o **dia do vencimento**, o meio (**PIX, boleto, cartão** ou o que o cliente preferir) e, se quiser, um **cupom**.
- A tela mostra uma **prévia** antes de salvar: valor do proporcional, fim do teste e primeiro vencimento.
- **Criar a assinatura não cobra na hora**; marque **Cobrar agora** se quiser enviar a 1ª cobrança imediatamente.
- Ações: **pausar** (até uma data), **trocar de plano** (o que já foi pago vira crédito no novo), **reajustar** o valor, **cancelar** (na hora ou no fim do período) e ver a **linha do tempo** com tudo o que aconteceu.

## 5. Cobranças, cartão e régua

- **PIX e boleto** como no guia de cobranças; **cartão de crédito** com o Asaas: o cliente cadastra o cartão numa página segura do Asaas (o Pub Mail nunca vê o número) e as próximas mensalidades são **debitadas sozinhas** no vencimento. Cartão recusado tenta de novo em 2 e 5 dias e depois vira PIX.
- **Link de pagamento**: toda cobrança tem um link (`{{cobranca.link}}`) com PIX, boleto e cartão numa página só.
- **Parcelado**: produto avulso pode ser parcelado no cartão.
- **2ª via com juros e multa**: configure multa e juros ao mês; a 2ª via pedida pelo bot já vem corrigida.
- **Régua de lembretes**: antes, no dia e depois do vencimento, com textos seus. Em atraso, a conversa ganha a etiqueta **Inadimplente** (sai ao pagar).
- **Conciliar** (tela Cobranças): compara o que está no gateway com o Pub Mail e mostra divergências (pago lá e pendente aqui, pago duas vezes…).

## 6. O bot que atende sozinho

Em **WhatsApp → Fluxo do Bot**, os blocos do grupo **Cliente** fazem o autoatendimento:

| Bloco | O que faz |
|---|---|
| **Identificar cliente** | Reconhece pelo número; se a empresa exigir, pede CPF/CNPJ (ou código) |
| **Cadastrar cliente** | Pergunta nome, documento, e-mail, endereço e os campos marcados "perguntar no bot" |
| **Assinar plano** | Mostra os planos, cria a assinatura e manda a cobrança |
| **Consultar** | Situação, próximo vencimento, faturas em aberto, dados do cadastro |
| **2ª via** | Reenvia a cobrança em aberto (corrigida, se houver multa/juros) |
| **Cancelar / Pausar / Trocar de plano** | Segue a política do produto; pode pedir o motivo e oferecer retenção |
| **Atualizar dados** | O cliente corrige e-mail, endereço e campos |
| **Agendar / Meus agendamentos / Lista de espera** | Ver seção 7 |
| **Abrir chamado / Meus chamados** | Ver seção 8 |
| **Fazer pedido / Meus pedidos** | Ver seção 9 |

Use a **condição por cliente** (é cliente? está em atraso? tem assinatura? tem pedido em andamento?) para levar cada pessoa ao caminho certo. Teste tudo no **Simulador** antes de ligar — ele usa um cliente fictício e não envia nada. O fluxo **sempre começa desligado e em modo teste** (só responde aos contatos de teste); ligue de vez quando estiver satisfeito.

## 7. Agenda

- **WhatsApp → Recursos**: profissionais, salas, boxes ou equipamentos, com os horários de cada dia da semana, folgas e bloqueios. Cada recurso tem um link de calendário (ICS) para assinar no Google Agenda ou no celular.
- **Serviços** (Produtos do tipo serviço): duração, intervalo de limpeza, vagas por horário (aula em grupo), e como pagar: **no local**, **na reserva**, **sinal** ou **incluso no plano**.
- **WhatsApp → Agenda**: visão Hoje, Dia, Semana e Lista, lista de espera e configurações (confirmação um dia antes, lembrete 2 horas antes, prazo para remarcar/cancelar, o que fazer com falta).
- O cliente agenda pelo bot escolhendo serviço, profissional, dia e horário; recebe confirmação e lembrete, e responde **1** para confirmar ou **2** para remarcar.

## 8. Chamados (protocolos)

**WhatsApp → Chamados**: cada pedido de suporte vira um **protocolo** sem falhas na numeração (ex.: `NET2026000123`), com categoria, prioridade, prazo (SLA), responsável e histórico. Respostas podem ser **internas** (só a equipe vê) ou **públicas** (vão ao cliente). O cliente abre e acompanha pelo bot, inclusive mandando fotos. Avisos de prazo vencendo chegam na tela e no celular.

## 9. Pedidos

**WhatsApp → Pedidos**: quadro por situação (recebido → confirmado → em preparo → saiu para entrega → entregue). O cliente monta o carrinho pelo bot, escolhe entrega ou retirada e paga por **PIX** ou **na entrega/retirada**. Em **Configurações** da tela: taxa de entrega, frete grátis a partir de um valor, pedido mínimo e os avisos que o cliente recebe a cada mudança. PIX que vence sem pagamento cancela sozinho o pedido que ainda não andou.

## 10. Financeiro

**WhatsApp → Financeiro**: receita recorrente do mês (MRR), assinaturas ativas, novas e canceladas, **inadimplência**, **ticket médio**, **previsão de recebimento** em 30/60/90 dias, recebido por meio de pagamento, por produto e por unidade, gráfico por dia e a permanência dos clientes por mês de entrada. Exporte recebimentos e assinaturas em CSV.

## 11. Equipe e permissões

Em **Administração → Usuários** (ou com o dono da conta), cada atendente pode ter acesso ao WhatsApp **sem** ver o **Financeiro** (cobranças e valores), **sem** alterar o **CRM** (clientes, produtos, assinaturas) e **sem** mexer nas **Configurações**. Também dá para limitar a quais **números** cada um tem acesso.

## 12. Fila de envios

Tudo o que o sistema manda sozinho (cobranças, lembretes, avisos de assinatura, confirmações) passa pela **fila de envios**, com um **ritmo** por número para não parecer disparo em massa. Em **WhatsApp → Configurações → Fila de envios**:

- quantas mensagens estão esperando, saíram e falharam, por número, e em quanto tempo a fila esvazia;
- **pausar/retomar** um número (se o WhatsApp restringir o número, a fila dele pausa sozinha);
- mudar o **ritmo** (mensagens por minuto) da empresa ou de um número;
- **Ver fila**: cada envio com o destino e a mensagem, para **tentar de novo** ou **cancelar**.

## 13. Auditoria e LGPD

- **Configurações → Auditoria** (dono/admin): quem alterou o quê e quando — produtos, assinaturas, cobranças, clientes, configurações, inclusive o **antes e depois** de cada campo. No cliente, a aba **Histórico** mostra só o dele.
- **Exportar dados (LGPD)**: no cliente, gera um arquivo com tudo o que a empresa guarda sobre ele (para atender um pedido do titular).
- **Apagar dados do cliente**: cancela as assinaturas e cobranças em aberto, revoga os acessos, remove cartões salvos e **anonimiza** o cadastro (opcionalmente apaga também as conversas e mídias). Pagamentos já feitos continuam registrados sem os dados pessoais, porque a lei fiscal exige.

## 14. Integrações (API e webhooks)

Em **Configurações → API e Webhooks**, gere uma **chave de API** com as permissões necessárias para que o seu sistema crie clientes, assinaturas, cobranças, chamados e pedidos, e cadastre **webhooks** para ser avisado quando algo acontece (cobrança paga, assinatura cancelada, pedido criado…). Cada aviso vem assinado para você conferir que veio do Pub Mail.

---

### Dúvidas comuns

**O cliente pagou e a assinatura não avançou.** Abra a cobrança e clique em **Verificar pagamento**; se o gateway confirmar, ela vira paga e a assinatura avança. Use **Conciliar** para checar várias de uma vez.

**O bot não respondeu um cliente.** Confira se o fluxo está **ligado**, se não está em **modo teste** e se o número está atribuído a esse fluxo. Conversas em atendimento humano ficam fora do bot até encerrar.

**As cobranças estão demorando a sair.** Veja a **Fila de envios**: o número pode estar pausado, desconectado ou com um ritmo baixo.
