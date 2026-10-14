# Revisão geral das 9 etapas do plano de assinaturas (14/10/2026)

4 revisões só-leitura em paralelo (Fase 5 + auditoria/LGPD · Fase 6/6B · Fase 7 · Fase 8 + regressões das fases 1–4). Abaixo: achados consolidados com ID, decisão e dono da correção. Formato: **ID** — onde — problema → correção.

## Já corrigido e em produção (antes da divisão)
- **X1 (CRÍTICO, confirmado em produção)** — `platform-billing/access.interceptor.ts` comparava a URL crua; o Express casa rotas sem diferenciar maiúsculas e aceita barra no fim. `/WhatsApp/customers` (sem o módulo), `/WhatsApp/finance` e `/whatsapp/customers/` (sem a sub-permissão) davam 200. → `normalizeApiPath()` em `modules.const.ts` (decodifica, minúsculas, junta barras, tira barra final) usada no interceptor de acesso e no da auditoria. Retestado: 10/10 → 403.
- **Migration `20261018100000_whatsapp_review_fixes`**: `whatsapp_charges.purpose VARCHAR(16) NULL` (`'order'` | `'appointment'` | null). Schema e client já gerados.

## Contrato compartilhado entre os donos
- `charges.create(orgId, userId, dto, origin)` passa a aceitar (internos, nunca vêm de DTO público) `dto.__purpose: 'order'|'appointment'` (grava `purpose`) e `dto.__expires_minutes?: number` (validade curta do PIX; padrão para order = configuração `orders.pix_minutes` (padrão 60), appointment = o `pay_until` da reserva). Cobranças com `purpose` NÃO entram na régua de lembretes, na etiqueta Inadimplente, no `charge_overdue`, nem em multa/juros da 2ª via, e não marcam assinatura em atraso.
- Pedidos (F4) e agenda (F1) passam `__purpose` ao criar cobrança.

---

## F1 — Agenda (Fase 6) e chamados (Fase 6B) — `back/src/whatsapp/scheduling/**`, `tickets/**`, bot runtimes de agenda/chamados, `whatsapp-media.service.ts` (só `referencedIds`), front `agenda/*`, `WhatsAppAgenda.jsx`, `tickets/*`
- **S-H1** Runners com consulta limitada e linhas puladas para sempre (auto-close de chamados resolvidos `tickets.service:696-706`, quebra de SLA `:686-694`, auto-concluir agendamentos `scheduling.service:1497-1506`, expirar reservas não pagas `:1431-1442`): uma org com a opção desligada/sem acesso trava a fila de todas. → filtrar no SQL (org ativa/configuração) ou iterar por org/cursor; em `runExpireUnpaid`, cobrança PAGA → mesmo caminho do `onChargePaid` (não `continue`). ✔ 14/10
- **S-H2** Lembretes D-1/H-2 (`:1453`, `:1472`) relêem os já enviados e ocupam o teto de 2000, sem `orderBy`. → filtrar os já enviados no SQL (caminho JSON nulo ou colunas novas não — usar JSON) + `orderBy starts_at` + cursor. ✔ 14/10
- **S-H3** Captura do "1/2" (`:1352-1378`, `:1298-1307`) engole respostas do menu do bot por 24 h e não sai em done/no_show/start. → pular quando a sessão do bot está `waiting` (como chamados) e `dropConfirmPending` em `transition()`. ✔ 14/10
- **S-M1** Lembrete enviado para agendamento cancelado durante a rodada (`:1460-1480`) → `updateMany({id, status in [booked,confirmed]})` e só enfileira se count > 0. ✔ 14/10
- **S-M2** Remarcação sem trava (`:950-969`) → `SELECT … FOR UPDATE` do agendamento (ou `updateMany` condicional dentro da transação, count 0 = erro). ✔ 14/10
- **S-M3** CONTACT_BUSY sem serialização (`:688-691`) → travar a linha do contato/cliente antes do recurso ou rechecar depois do lock. ✔ 14/10
- **S-M4** Lista de espera oferece a mesma vaga duas vezes/sem mensagem (`:1224-1293`) → claim `updateMany where status='waiting'`, `offered_at` na chave de dedupe, voltar a `waiting` se `enqueue` devolver null, mutex por org no scan. ✔ 14/10
- **S-M5** `referencedIds()` não protege `whatsapp_tickets.media_ids`, `whatsapp_ticket_events.media_id`, `whatsapp_resources.photo_media_id` → incluir (limpar dados apagaria anexos). ✔ 14/10
- **S-M6** Tempo real da agenda vai para a sala da org (`:466-469`, `:1210`, `:1271`) → `emitSession` quando há `session_id`. ✔ 14/10
- **S-M7** Lista de espera, créditos e relatório sem checagem de número (`scheduling.controller:95-104`) → filtrar/assertar por `allowed`. ✔ 14/10 (parcial: lista de espera e relatório filtram por número; **créditos continuam por cliente**, sem número — decisão: crédito é do cliente, não do número)
- **S-L1** Reserva paga fora do bot manda 2 mensagens de pagamento (`:744-763`) → conferir `charges.create(send)` e mandar só uma. ✔ 14/10
- **S-L3** `start()` de um no_show não desconta o contador → `bumpNoShows(-1)` ao sair de no_show. ✔ 14/10
- **S-L4** Mapas `confirmPending/offerPending` nunca podados → expirar por TTL na leitura e varrer no runner. ✔ 14/10
- **S-L6** Comentário duplicado no retry (`comment()` + `update()` que falha) → status e comentário na mesma transação, ou validar antes. ✔ 14/10
- **S-L7** `from`/`to` inválidos → 500 → validar datas (400). ✔ 14/10
- **S-L9** `book()` não respeita a grade `slot_minutes` (API/painel) → validar; oferta manual da espera conferir vaga livre. ✔ 14/10
- Usar `__purpose:'appointment'` ao criar cobrança de reserva/sinal (contrato acima).
- Não fazer: L2 (cliente arbitrário em número compartilhado — decisão de produto), L5 (ciclo de uso na remarcação), L8 (horário de verão).

## F2 — Cobranças, fila, rotina diária, importação, assinaturas, CRM — `whatsapp-charges.service.ts` (+controller), `whatsapp-outbox.service.ts` (+controller, `settings/OutboxCard.jsx`), `whatsapp-import.service.ts`, `wa-import.util.ts`, `crm/ImportDialog.jsx`, `whatsapp-crm.service.ts`, `whatsapp-subscriptions.service.ts`
- **C-H1** Cartão salvo debitado por MEMBER/API sem passar `payment_method_id` (`charges.service:427` pega o cartão da assinatura) → só herdar o cartão da assinatura quando `origin` for `recurring`/`bot`; manual/api exige `payment_method_id` explícito (já restrito a dono/admin). ✔ 14/10
- **C-H2** Importação cria todo produto como mensal (`import.service:553`, `crm.service:607`) e o próprio modelo traz "Plano Anual" → coluna `billing` (once|monthly|quarterly|semiannual|yearly; aceitar PT: avulso/mensal/trimestral/semestral/anual) no import e no modelo; sem coluna = mensal só quando não houver dúvida, e o exemplo do modelo usa `billing=anual`. ✔ 14/10
- **C-H3** Fila envia conteúdo velho: (a) `resend()`/`reissue()` não cancelam lembretes já na fila (`cancelPending('charge:<id>:')`); (b) `retry`/`retryFailed`/`processOne` não conferem se a cobrança ainda está PENDENTE com o mesmo `pix_code` nem se o agendamento foi cancelado → cancelar a linha (status `canceled`, motivo) em vez de enviar. ✔ 14/10
- **C-M1** Cursor do Prisma (`cursor+skip:1`) pula/termina cedo quando a última linha muda de status → `where id > cursor` sem `cursor/skip` nos dois laços da rotina diária. ✔ 14/10
- **C-M2** `next_due` no passado na importação ignora a regra de rolar para frente (§7.2) → rolar para o 1º vencimento ≥ hoje pelo `due_day` (ou recusar a linha com erro claro). ✔ 14/10
- **C-M3** Importação sem `next_due` pula um ciclo (due_day = hoje; produto sem proporcional) → para `source:'import'` sem 1ª cobrança, `nextDue` = 1º vencimento ≥ hoje. ✔ 14/10
- **C-M4** Linha da importação sobrescreve outra pessoa no número compartilhado (`import.service:506`) → casar por `doc_hash` quando a linha tem documento; documento diferente de todos no número = cliente novo com `another:true`. ✔ 14/10
- **C-M5** Saldo reimportado em outro dia duplica (`importBalance` dedupe por `due_at` = hoje+3) → sem `balance_due`, dedupe por cliente+`origin:'import'`+PENDING+valor. ✔ 14/10
- **C-M6** Ritmo real da fila muito abaixo do prometido (1 linha por número por tick de 2 s, números em série) e ETA errada → processar números em paralelo com limite, várias linhas por número por tick até o ritmo, ETA pelo teto real; limites da UI coerentes. ✔ 14/10
- **C-M7** `whatsapp_outbox` nunca é podada e o payload fica em claro → poda diária (`sent`/`canceled` > 15 dias, `failed` > 30 dias) e o resumo conta só janela recente quando fizer sentido. (Cifrar o payload: decidir — preferir poda curta.) ✔ 14/10
- **C-L1** PAID importado com `due_at == next_due_at` conta como ciclo pago sem avançar a assinatura → recusar `paid_history` no próprio `next_due` (ou chamar `markPaid`). ✔ 14/10
- **C-L2** Histórico importado aparece em Vendas (`listSales`) como "Cobrança manual", ordenado pela importação → excluir `paid_via:'import'` das Vendas (ou rotular "Importado" e ordenar por `paid_at`). ✔ 14/10
- **C-L4** `flush` grava o JSON inteiro de erros a cada lote → gravar só no fim (ou acrescentar). ✔ 14/10
- **C-L5** `custom.<chave>` sem definição é gravado mesmo assim → descartar chaves desconhecidas na importação. ✔ 14/10
- **C-L6** `sendNow`: erro depois do gateway aceitar (bumpChat/presenter) faz o retry duplicar → `.catch` nos passos pós-envio. ✔ 14/10
- **P7-2** Campo personalizado obrigatório trava fluxos internos: `crm.createCustomer` chamado por pedidos/agenda sem `custom` (`crm.service:489` sem `skipRequired`) e `createSubscription` do bot (`subscriptions.service:443` só pula para `import`) → `skipRequired` para criações internas (`source` bot/system/order/appointment ou flag `__internal`) e para assinatura com `source` bot/system. ✔ 14/10
- **P7-3** Cobranças de pedido/agenda tratadas como fatura → implementar o contrato `__purpose` (gravar `purpose`; fora de lembretes/etiqueta/`charge_overdue`/multa; validade `__expires_minutes`). ✔ 14/10
- **P7-12 (parte)** Exportação CSV de clientes: neutralizar fórmula (célula iniciando com `= + - @ \t \r` ganha `'`). ✔ 14/10
- **A-8** `erased_at` não é respeitado: `updateCustomer`, vincular número e importação aceitam cliente apagado (LGPD) → 400 "Os dados deste cliente foram apagados (LGPD)". ✔ 14/10
- **A-4 (parte da fila)** em apagar dados (F3 chama): expor `outbox.redactForJids(org, jids)` que zera o `payload` de TODAS as linhas (qualquer status) daqueles jids. ✔ 14/10
- **C-M8** ver F3 (concorrência do bridge de webhooks).

## F3 — Fase 5, auditoria e LGPD — `back/src/org-webhooks/**`, `back/src/org-api/**`, `whatsapp-entitlements.service.ts`, `back/src/audit/**`, `whatsapp-privacy.service.ts` (+controller), `back/src/wordpress/safe-http.util.ts`, `whatsapp-notify.bridge.ts`, `admin/admin.service.ts` (só limpar caches), front `account-settings/AuditLog.jsx`, `crm/CustomerDialog.jsx` (bloco LGPD/histórico)
- **A-1** Auditoria guarda os dados pessoais do cliente apagado (e a entrada do apagamento grava o nome) → no `erase`, redigir as linhas da auditoria daquele cliente (`entity=customers&entity_id` ou `changes.customer_id`): `changes = {customer_id, redacted:true}`, `summary` sem nome; logar o apagamento sem o nome. ✔ 14/10
- **A-2** Apagar não pode ser refeito depois de falha parcial → `erased_at` por último (ou estado parcial que permite repetir); apagar mensagens em lotes por id fora de uma transação única. ✔ 14/10
- **A-3** Um webhook lento trava os webhooks de todas as orgs (`org-webhooks.worker.ts:16-67`) → escolher entregas com justiça por webhook (no máx. 1–2 em voo por webhook), disjuntor por webhook após N timeouts seguidos, não esperar o mais lento do lote. ✔ 14/10
- **A-4** Em apagar dados: zerar `payload` de todas as linhas da fila dos jids do cliente (usar `outbox.redactForJids` do F2 — se ainda não existir quando você chegar lá, fazer `updateMany` direto em `whatsapp_outbox` com `payload = {messages:[], redacted:true}`). ✔ 14/10
- **A-5 / C-M8** Bridge de webhooks dispara em paralelo sem limite em eventos em massa (`org-webhooks.bridge.ts:45-62`) → fila interna com concorrência 4. ✔ 14/10
- **A-6** Apagar dados manda os dados reais para fora e não avisa a anonimização → anonimizar antes de cancelar (ou suprimir webhooks durante o apagamento) e emitir `customer.erased` (evento novo de webhook) no fim; apagar entregas antigas (`org_webhook_deliveries`) com dados daquele cliente. ✔ 14/10
- **A-7** `whatsapp_bot_sessions.vars` (CPF, e-mail, endereço) sobrevive sem `delete_messages` → sempre zerar `vars` das sessões do bot dos jids do cliente. ✔ 14/10
- **A-10** Auditoria exige o módulo WhatsApp → expor também `GET /org/audit` (fora do mapa de módulos do WhatsApp; só dono/admin) e o front usar esse; mensagem certa no front. ✔ 14/10
- **A-11** Webhook morto demora a ser desligado → contar falhas consecutivas por webhook (ou "falhando há > 24 h") e desligar por isso. ✔ 14/10
- **A-12** MEMBER lista os direitos de acesso de todos → (o F4 põe `['/whatsapp/entitlements','whatsapp:crm']` no `SUB_ANY`; você só confirma o controller). ✔ 14/10
- **A-13** Apagar cliente tira do grupo um número compartilhado (`entitlements.service:569-584`) → contar outras linhas `group_member` com mesmo `ref`+`target` e `desired='active'` antes de remover. ✔ 14/10
- **A-14** Chave de API inválida sem freio e envenenando o cache → cache separado de "não existe" e freio por IP em falha de autenticação. ✔ 14/10
- **A-15** Chave de org apagada funciona por até 60 s → limpar os caches do `OrgApiKeysService` em `admin.removeOrganization` (injete o serviço ou um método estático). ✔ 14/10
- **A-16** Anti-SSRF: bloquear `64:ff9b::/96`, `::a.b.c.d` (IPv4-compatível), `2002::/16` com IPv4 privado dentro. ✔ 14/10
- **A-17** Mascarar `document_id` na auditoria. ✔ 14/10
- **A-18** Apagar também: `whatsapp_entitlements.target` (telefone), `external_id`/`contract_number` da assinatura, `whatsapp_orders.history` (notas), erros de importação com dados dele (opcional), e cancelar lembretes na fila sobre cobranças DELE mesmo em número compartilhado (por `charge:<id>:`). ✔ 14/10
- **A-19** Entregas pendentes de org inativa nunca saem → expirar após N dias. ✔ 14/10
- **P7-13** `public-shapes.ts` tira só 7 chaves reservadas → tirar a lista completa `CF_RESERVED` (cliente e agendamento). ✔ 14/10
- **P7-18** Avisos `charge_paid`/`order_created`/`order_paid` (com valores) vão para MEMBER sem `whatsapp:finance` → na ponte de notificações, omitir o valor (ou não avisar) para quem não tem a permissão. ✔ 14/10
- Não fazer: A-9 (porta local de teste em produção — documentar; manter).

## F4 — Fase 7 — `back/src/whatsapp/orders/**`, `finance/**`, `templates/**`, `wa-custom-fields.util.ts`, `whatsapp-units.service.ts`, `platform-billing/modules.const.ts`, front `chat/CustomerPanel.jsx`, `WhatsAppChat.jsx` (só o botão Cobrar/menus), `orders/*`, `tickets/NewTicketDialog.jsx` (busca de cliente), `WhatsAppFinance.jsx`
- **P7-4** PIX pago depois do pedido cancelado (`orders.service` `onChargePaid` ~405) → se `canceled`, registrar o pagamento sem mandar "pago" e avisar a equipe ("pago após cancelamento — estornar ou reabrir"). ✔ 14/10
- **P7-5** Rotas com dinheiro sem `whatsapp:finance`: `POST /whatsapp/orders/:id/mark-paid` (sem guarda de papel), `GET /whatsapp/customers/:id/payment-methods`, `GET /whatsapp/subscriptions*` (preços), `GET /whatsapp/metrics` (valores de cobrança) → regras no `modules.const.ts` (`SUB_ANY`/`SUB_READ_EXACT`) + `/whatsapp/entitlements` em `whatsapp:crm` (A-12). Decidir desconto/`none` em pedido para MEMBER: desconto > 0 ou pagamento `none` exige finance. ✔ 14/10
- **P7-6** Front chama rotas proibidas para o MEMBER: `CustomerPanel.jsx:103` busca `/whatsapp/charges` sempre; botão "Cobrar" aparece; `NewOrderDialog`/`NewTicketDialog` buscam `/whatsapp/customers` (exige crm) → só chamar com `hasPermission`; para escolher cliente sem crm, usar `GET /whatsapp/customers/lookup` (sem crm) ou criar `GET /whatsapp/customers/pick?q=` leve (no `SUB_READ_EXACT` liberado). ✔ 14/10
- **P7-7** Financeiro ignora a restrição de número (`finance.controller:16-21`) → passar `allowed` e filtrar por `session_id IN allowed` nas cobranças. ✔ 14/10
- **P7-8** Marcar pedido como pago cancela o PIX em vez de liquidar (`orders.service:373`) → usar a liquidação manual das cobranças (`paid_via:'manual'`) para a receita aparecer; pedidos "na entrega" entregues: decidir (contar como recebido no Financeiro como linha separada "Pedidos pagos na entrega"). ✔ 14/10
- **P7-9** Reaplicar modelo sobrescreve configurações da org (`templates.service:156,163,176`) → só aplicar configurações quando a área ainda não tem nada salvo; senão `skipped`. ✔ 14/10
- **P7-10** Filtro de unidade do Financeiro com `IN` gigante → subconsulta SQL por `unit_id`. ✔ 14/10
- **P7-11** CSV com fórmula → neutralizar nas exportações do Financeiro. ✔ 14/10
- **P7-12** Valores de campo sem definição sem limite de tamanho; `units.custom` e `delivery.address` crus → limite ~2 KB por valor; normalizar o endereço do pedido como `normAddress`. ✔ 14/10
- **P7-14** Pedido criado num número que o usuário não pode usar (`orders.controller assertTarget`) → conferir `canUse` no `session_id` resolvido. ✔ 14/10
- **P7-15** `orders.list` com data inválida → 400; `markPaid` emite `order_paid` mesmo sem atualizar nada. ✔ 14/10
- **P7-16** Modelo: entidade com 30 campos descarta extras mas relata "criado"; duas aplicações simultâneas duplicam → relatar certo e trava por org em memória. ✔ 14/10
- **P7-17** Previsão 60/90 conta cada assinatura uma vez; churn conta quem nunca ativou; `session_id` não vale para MRR/churn; `take 200000` trunca → contar os ciclos dentro da janela, churn só com quem estava ativa no início, documentar o resto. ✔ 14/10
- Usar `__purpose:'order'` + `__expires_minutes` (configuração nova `orders.pix_minutes`, padrão 60) ao criar a cobrança do pedido.
- **P7-19**: não fazer (regra "visto = leitura" da Fase 2).


## Fechamento (14/10/2026)
- Todos os itens das seções F1–F4 corrigidos (✔), exceto **P7-19** (não fazer, por regra) e **S-M7** (parcial, ver o item). **X1** já estava em produção antes da divisão.
- Decisões que ficaram como estão: `ORG_WEBHOOK_ALLOW_LOCAL_PORTS=18999` continua no `back/.env` de produção (só libera a porta do E2E em loopback); um número com vários clientes continua possível (o bot pede o documento para separar); em **Métricas**, MEMBER sem `whatsapp:finance` vê a página mas o bloco de cobranças vem `null` (o back tira os valores) em vez de 403.
- Regras de sub-permissão finais: `whatsapp:finance` = cobranças, financeiro, cartões salvos, `orders/:id/mark-paid`; `whatsapp:crm` = clientes (lista/exportação), assinaturas (leitura e linha do tempo), direitos de acesso, importações, cupons; escolher cliente sem crm = `GET /whatsapp/customer-pick?q=`.
- Publicado em produção às 13:18 (back) / 13:20 (front) com backup `/root/backups/pubmail-antes-revisao-20261014-1317.sql.gz`.
- **Testes no servidor depois do deploy (14/10/2026):** identidade 44/44, assinaturas 102/102, bot 142/142, Fase 5 55/55, Fase 7 50/50, chamados 53/53, agenda 35/35, modelos 407/407, multi-número 75/75, Asaas sandbox 46/46, gateway real 19/19, Fase 8 47/47, carga (10 mil clientes) 24/24; fila de envios (local) 16/16. Dois testes foram ajustados por codificarem o comportamento antigo: Fase 7 (o "Recebido" agora soma "Pedidos pagos na entrega") e Asaas (cobrança manual só usa o cartão salvo com `payment_method_id` explícito — C-H1). Home: seção Assinaturas conferida em computador claro/escuro e celular, sem rolagem lateral nem erro de console.
