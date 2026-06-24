# CLAUDE.md — Pub Mail (operação + evolução)

Plataforma multi-tenant de **webchats com IA** + **e-mail marketing**, com auto-provisionamento de domínios de cliente (HTTPS via certbot). Stack: NestJS (back) + 2 micros Express (ai, email) + SPA React/Vite (front) + MySQL + Redis.

> Para o panorama geral do produto e do código, veja `README.md`. Este arquivo foca em **como o ambiente de produção está montado, como fazer deploy, e o que já evoluímos**.

---

## Arquitetura (resumo)

| Serviço | Stack | Porta | Exposto publicamente? |
|---|---|---|---|
| `back` | NestJS 11 / Prisma 7 (adapter MariaDB) | 8000 | ✅ via `api.bluewebchat.online` |
| `front/vite` | React 19 / Vite 7 (SPA estática) | — (nginx serve `dist/`) | ✅ via `bluewebchat.online` + domínios de cliente |
| `ai-micro-services` | Express ESM (ioredis) | 4000 | ❌ só loopback |
| `email-micro-services` | Express ESM (BullMQ) | 9999 | ❌ só loopback (sem auth no `/send`) |
| MySQL 8 / Redis 7 | infra | 3306 / 6379 | ❌ só 127.0.0.1 |

- O **front (browser) só fala com o back** (`VITE_API_URL`). Os micros são chamados pelo back por `127.0.0.1`. **Não** existem subdomínios `ia.`/`email.` (e não devem — o email-micro não tem auth).
- Webchat público é servido em `https://<dominio-do-cliente>/webchat/<slug>` (mesma SPA, resolve por `window.location.hostname` + slug).

---

## Produção (AWS)

- **EC2** `ec2-webchat` `i-06b82885d4f2df991` · região **us-east-2** · Ubuntu 24.04 · IP **3.15.235.224**.
- **Acesso: SOMENTE via AWS SSM** (sem SSH). Perfil aws `blue` (conta 616745996127). O `session-manager-plugin` não está instalado local → use **`aws ssm send-command`** (RunShellScript) + `get-command-invocation`.
  - O SSM roda em **`/bin/sh` (dash)** — sem `trap ERR`, sem bashismos. Heredoc multi-elemento ok.
- **Security Group** `sg-0c492d725ae1f9e26`: só **80/443** abertos.
- **Domínios** (Cloudflare, **DNS only / cinza**): `bluewebchat.online` → front (apex), `api.bluewebchat.online` → back. SSL via certbot (renova sozinho, `certbot.timer`).
- **Domínios de cliente**: cliente aponta A record para **3.15.235.224** (nuvem **laranja** ok — o back aceita CIDRs do Cloudflare). Clicar "Verificar DNS" gera vhost nginx + roda certbot automaticamente.
- Código em **`/opt/pub-mail`** (deploy nativo, sem Docker). Segredos em **`/root/pubmail.secrets`** (root-only): `DB_PASS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `IA_SERVICE_KEY`, `EMAIL_SERVICE_KEY`.
- Serviços systemd: `pubmail-back` (:8000, roda como **root** p/ escrever vhost nginx + rodar certbot), `pubmail-ai` (:4000), `pubmail-email` (:9999).
- MySQL: DB **`pubmail`**, user **`pubmail`** (mysql_native_password, TCP 127.0.0.1).

### Gotchas de config (IMPORTANTES — onde o README erra)
1. **Runtime do banco usa `DATABASE_HOST/USER/PASS/NAME/PORT`**, NÃO `DATABASE_URL` (`back/src/prisma/prisma.service.ts`). `DATABASE_URL` só serve ao CLI do Prisma (migrate/generate). Os dois coexistem no `back/.env`.
2. **`DATABASE_POOL_LIMIT=10`** é obrigatório no `back/.env`. O adapter MariaDB mantém `minimumIdle = connectionLimit` e o back abre ~5 pools; com o default (50) ele quer 250 conexões e estoura o `max_connections=151` ("Too many connections"). Com 10 → 50 conexões estáveis.
3. **`WEBCHAT_BACKEND_INTERNAL_URL=http://127.0.0.1:8000`** (default do código é `:3000`; sem isso o `/ads.txt` dos domínios de cliente quebra).
4. Micros em loopback no `back/.env`: `IA_SERVICE_URL=http://127.0.0.1:4000`, `EMAIL_SERVICE_URL=http://127.0.0.1:9999`. email-micro precisa de `NEST_WEBHOOK_URL` (callback interno) e `BASE_URL_API=https://api.bluewebchat.online` (pixel/tracking público).
5. **ffmpeg/ffprobe** é dependência (upload de vídeo em posts).
6. `system_settings` (singleton id=1) guarda `webchat_edge_ip` (= `3.15.235.224`) e `certbot_email` — já semeados. Sem isso, provisionamento de domínio de cliente falha.
7. Front no build precisa de `VITE_APP_BASE_NAME=/` e `VITE_API_URL=https://api.bluewebchat.online`.
8. **Timezone:** servidor e MySQL rodam em **UTC**. O usuário escolhe a hora do agendamento de e-mail em **Brasília**. O `EmailSchedule.decide` (`back/src/cron-jobs/domain/email_schedules_domain.ts`) avalia hora/dia em **`America/Sao_Paulo`** via `Intl.DateTimeFormat` (não usa `getHours()`, que daria a hora UTC). O cron tica no topo de cada hora UTC (= topo BRT, offset inteiro). `time` no banco = hora 0..23; `date` (one-off) = meia-noite UTC do dia escolhido.

---

## Como fazer DEPLOY de alterações

Como não há SSH, o fluxo é: empacotar arquivos → S3 → URL assinada → baixar/extrair na instância via SSM → buildar → trocar atômico / reiniciar.

**Bucket de deploy:** `s3://pubmail-deploy-616745996127` (us-east-2).

### Front (mudou só `.jsx`/`.js` do front)
1. Local: `tar -czf /tmp/x.tgz front/vite/src/.../Arquivo.jsx ...` (caminhos relativos à raiz do repo).
2. `aws s3 cp /tmp/x.tgz s3://pubmail-deploy-616745996127/x.tgz --region us-east-2 --profile blue` e gerar `aws s3 presign ... --expires-in 1800`.
3. Via SSM, na instância: `curl -fsSL -o /tmp/x.tgz "<URL>"` → `tar -xzf /tmp/x.tgz -C /opt/pub-mail` → `cd /opt/pub-mail/front/vite` → `export NODE_OPTIONS=--max-old-space-size=4096` → **build em temp + swap atômico** (zero downtime, e se falhar o site fica intacto):
   ```sh
   rm -rf dist_new
   yarn build --outDir dist_new
   [ -f dist_new/index.html ] && { rm -rf dist_prev; mv dist dist_prev; mv dist_new dist; }
   ```
4. O usuário precisa de **hard refresh** (`Cmd+Shift+R`) — o hash do bundle muda.

### Back (mudou `.ts` do back)
1–3. Mesmo upload/extract. Depois, em `/opt/pub-mail/back`:
   ```sh
   # só se mudou schema.prisma / nova migration:
   yarn prisma migrate deploy
   yarn prisma generate
   yarn nest build              # gera dist/src/main.js (processo em memória segue de pé)
   systemctl restart pubmail-back
   ```
   Só reinicie se o build passou (`test -f dist/src/main.js`). Migrations: criar pasta `back/prisma/migrations/<timestamp>_nome/migration.sql` (timestamp > último; ex.: `20260616...`) + atualizar `schema.prisma`.

### Padrão de SSM (template)
```sh
CMD_ID=$(aws ssm send-command --region us-east-2 --profile blue \
  --instance-ids i-06b82885d4f2df991 --document-name "AWS-RunShellScript" \
  --timeout-seconds 1800 --parameters 'commands=["..."]' \
  --query 'Command.CommandId' --output text)
# poll get-command-invocation até Status != InProgress
```
SQL ad-hoc no banco: jogar o SQL num arquivo (base64 → decode na instância) e `mysql -upubmail -p"$(grep ^DB_PASS= /root/pubmail.secrets|cut -d= -f2)" -h127.0.0.1 pubmail < arquivo.sql` (evita inferno de aspas).

---

## Permissões / Roles

Enum `users_role`: **OWNER, ADMIN, MEMBER, SUPER_ADMIN**. O role vai no **JWT** (`req.user.role`) e no `/auth/me` (front lê em **`user?.user?.role`** — objeto aninhado `{user, organization}`).
- **SUPER_ADMIN** = admin de plataforma (vê/gerencia todas as orgs). Criado nesta evolução. **Trocar role exige relogar** (o token carrega o role antigo até expirar/refresh).
- Contas SUPER_ADMIN atuais: `santiago@bluewebchat.online`, `gabriel@bluegridmedia.com`.
- Guard: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('SUPER_ADMIN')` (`back/src/auth/roles.guard.ts`, `roles.decorator.ts`).

---

## Evolução já feita (histórico desta jornada)

### Deploy inicial (AWS)
Varredura completa do sistema → provisionamento da EC2 → pacotes (node20, yarn4, nginx, mysql8, redis7, certbot, ffmpeg) → MySQL/Redis → upload do código via S3 → 4 `.env` de produção (com as correções dos gotchas acima) → build → systemd (back/ai/email) → nginx vhosts (`pubmail-front`, `pubmail-api`, `000-default-deny`) → certbot SSL nos 2 domínios → seed `system_settings` → fix do pool de conexões.

### Webchat — builder de funil
- **Bug de arrastar bloco** (sumia/tela branca): era re-render a cada frame de drag. Corrigido com `useNodesState` + persistir posição só no `onNodeDragStop` (`front/vite/src/views/pages/webchat/FunnelBuilder.jsx`).

### Webchat — botões (antes "opções/respostas rápidas")
- **Renomeado para "Botões"** em todo o UI (builder visual + funil), mantendo as chaves de dados (`quickReplies`, `ending.options`, `value="quick"/"options"`).
- **Visual padrão**: largura total, empilhados, texto centralizado bold 600, cantos pill. Tema WhatsApp → fundo verde + texto branco. Customização preservada (`quickReplyBgColor`).
- **Classes CSS customizadas por botão** (campo "Classes CSS" no builder visual e no funil; sanitizado; aplicado no `class=""` do botão público). Campo `cssClass` em `quickReplies[]` e em `ending.options[]`.

### Webchat — layout responsivo (público)
- **Desktop (≥768px)**: chat vira **coluna centralizada de 720px**; as laterais usam o **mesmo fundo/wallpaper** do chat (contínuo). Bolha do bot ≥52% da coluna, fonte +2px.
- **Mobile (<768px)**: bolhas como antes, mas **botões ocupam 100% do container** do chat.
- Implementado com `<style>` + media queries em `PublicWebchat.jsx` (classes `pubmail-shell`, `pubmail-msg-wrap`, `pubmail-bot-bubble`, `pubmail-qr`, `pubmail-qr-btn`).

### Webchat — outros ajustes
- **Mensagem final do funil vazia** não gera mais bolha em branco (detecta HTML vazio via texto puro, não só `.trim()`).
- **Imagens** preenchem todo o container da mensagem (`width:100%`).
- **Páginas Legais**: nova aba no builder visual (label + link, reordenável). Renderiza um **rodapé discreto** no fim do webchat (público + preview). Persiste em `personalizacao.legalPages` (JSON livre — sem mudança no back).

### Anúncios — rótulo opcional
- Toggle **"Exibir rótulo de publicidade"** (antes o rótulo "PUBLICIDADE" voltava sempre). Causa real: o save nem persistia `rotulo`, e a tabela `webchat_ads` não tinha coluna pra flag.
- **Coluna `rotulo_ativo`** adicionada (migration) + DTO (`update-webchat-ads.dto.ts`) + service (`webchat.service.ts` escrita/leitura) + payload do front (`Webchats.jsx` `buildAdsPayloadFromConfig`). Render respeita `rotuloAtivo===false` (`PublicWebchat.jsx` `resolveAdRotulo`).

### Splits de webchats (pastas + redirecionamento ponderado)
- **Modelo**: tabela `webchat_splits` (slug **único global**, `is_default`), `webchats.split_id` + `webchats.split_weight` (peso relativo, default 100). Todo webchat pertence a um split; default "Padrão"/`padrao`.
- **Back**: módulo `webchat-splits` (CRUD org-scoped + `GET /public/webchat-splits/:slug` público com membros/pesos). `webchat.service` resolve split no create/update e inclui `split { slug, members:[{domain,slug,weight}] }` no config público. Apagar split: bloqueado se não-vazio; padrão não apaga.
- **Front**: página Webchats com **abas = splits** (criar/renomear/apagar/copiar-link), input de **peso %** por webchat (autosave no blur/Enter), webchat novo entra na aba ativa. Rota pública `/webchat/splits/:slug` (`SplitRedirect.jsx`) sorteia e redireciona.
- **Comportamento**: **re-sorteia a cada visita** (sticky NÃO usado, por escolha do usuário). Trava anti-loop: o redirect leva `?nsr=1` que suprime o sorteio naquele pulo e é limpo da URL — evita loop A→B→A. Link do split fica na plataforma (`bluewebchat.online/webchat/splits/<slug>`). Redirect vai para `https://<domínio>/webchat/<slug>`.

### Página Admin de Usuários/Organizações (`/admin/users`, SUPER_ADMIN)
- **Back**: módulo `back/src/admin/*` (`@Roles('SUPER_ADMIN')`). CRUD cross-org de organizações e usuários, **criar org + usuário admin** (transação org+wallet+user), **alterar senha** (bcrypt 12, invalida sessões). **Hard delete**: usuário direto; organização apaga TODO o conteúdo (transação com `FOREIGN_KEY_CHECKS=0` + `try/finally`, cobre as 27 tabelas do tenant).
- **Front**: item de sidebar "Administração → Usuários" (filtrado por role em `MenuList`), guard `RequireAdmin`, rota `/admin/users`, página `views/pages/admin/Users.jsx` (abas Organizações/Usuários, mostra ID da org).

---

### Módulo Quizzes (EM CONSTRUÇÃO — por partes)
Plano: usuário cadastra/verifica domínios de quiz (igual webchat) → cria quizzes (build próprio, mais simples) → pode vincular a um Projeto de e-mail (captação de leads) → no fim do quiz, redireciona para URL (geral ou baseada nas respostas).
- **Parte 1 — domínios de quiz (FEITA):** reusa 100% o provisionamento de domínio do webchat. Adicionado campo **`kind`** ('webchat'|'quiz') em `webchat_domains` (migration `..._add_kind_to_webchat_domains`). `WebchatDomainsService.list/create` recebem `kind`. Novo controller `QuizDomainsController` (`/quiz-domains`, no mesmo módulo) que chama o service com `kind:'quiz'`; verify/remove/ads-txt são por-id (kind-agnósticos). Front: hook `useQuizDomains` (`/quiz-domains`), página `DomainsQuiz.jsx` (cópia de `DomainsWebchat.jsx` com webchat→quiz), nova sub-aba **"Quizzes"** em `DomainsTabs.jsx` (Conta & Domínios). Um domínio pertence a um único kind (slug/domínio único global).
- **Parte 2 — CRUD de quizzes + splits (FEITA):** tabelas `quizzes` (espelho de webchats, SEM agente/anúncios; campos name/slug/domain/email_project_id/header_scripts/footer_scripts/settings/active/split_id/split_weight) e `quiz_splits` (espelho de webchat_splits) — migration `..._add_quizzes`. Back: módulos `quizzes` (CRUD, valida domínio de quiz **VERIFIED**, projeto de e-mail, slug único por domínio) e `quiz-splits` (CRUD + `GET /public/quiz-splits/:slug`). Admin `removeOrganization` agora apaga `quizzes`+`quiz_splits`+`webchat_splits` também. Front: grupo de sidebar **"Quizzes"** → `/quizzes` (`views/pages/quiz/Quizzes.jsx`) com abas=splits, peso %, criar/editar (Nome, Domínio verificado, Projeto de e-mail, header/footer scripts), copiar/abrir link, sem ações de anúncio/builder/avançado. Rota pública `/quiz/splits/:slug` (`QuizSplitRedirect.jsx`) sorteia e redireciona p/ `https://<domínio>/quiz/<slug>`. Hooks `useQuizzes`, `useQuizDomains`.
- **Parte 3 — página pública + builder visual + captação de lead (FEITA):**
  - **Config (JSON livre):** todo o build do quiz vive em `quizzes.settings` (objeto único). Shape + normalização + 3 presets em `front/.../quiz/quizConfig.js` (`normalizeQuizConfig`, `createDefaultQuizConfig`, `QUIZ_PRESETS`, `buildPresetConfig`). Campos: theme (cores/gradiente/card/botões/fonte), logo, image, title, questions[{text,options[]}], onlineIndicator, leadCapture (nome/email/telefone com rótulos editáveis + introText + buttonLabel), redirect.url, legal{text,pages[]}, animation{type,duration}.
  - **Renderer único `QuizView.jsx`** (usado pela página pública E pelo preview do builder → preview = real). Centralizado vertical+horizontal, transições (slide/fade/zoom), fluxo perguntas→captação→redirect.
  - **Página pública `PublicQuiz.jsx`** em `/quiz/:slug` (PublicRoutes, resolve por `?domain=`/hostname). Injeta `header_scripts`/`footer_scripts` recriando `<script>`. Captura → `POST /public/quiz/:slug/leads`.
  - **Builder `QuizBuilder.jsx`** em `/quizzes/:id/builder` (ação "Builder visual" na lista). Preview ao vivo, **import/export de preset (JSON)**, upload de imagem→data URL (sem backend), autosave (debounce 2s) + Salvar. Presets: **Clean** (print), **Vibrante**, **Dark Neon**.
  - **Back:** tabela `quiz_leads` (migration `..._add_quiz_leads`). Públicos `GET /public/quiz/:slug/config` e `POST /public/quiz/:slug/leads` (`public-quizzes.controller`). `captureLead` SEMPRE grava `quiz_leads` e, se quiz tem `email_project_id`+e-mail, roteia pro `email_leads`+`email_project_leads` (igual webchat). `GET /quiz-leads` (+`/export`) p/ a página Leads.
  - **Leads (`webchat/Leads.jsx`):** seletor **Origem: Webchats | Quizzes** → busca `/quiz-leads`. Sem e-mail/sem projeto, o lead fica só em `quiz_leads` (visível em Leads). E-mail é o que roteia pro projeto.
- **Parte 6 — e-mail imediato ao lead (FEITA):** colunas `lead_email_html` (LONGTEXT) + `lead_email_subject` no `quizzes` (migration `..._add_quiz_lead_email`). No modal de criar/editar quiz, **se há projeto de e-mail vinculado**, aparece o campo com abas **HTML / Preview** (preview num `<iframe sandbox srcDoc>`). Variáveis Handlebars: `{{name}}/{{email}}/{{phone}}/{{unsubscribe_link}}`. **`QuizLeadEmailService.maybeSend`** (best-effort, NUNCA lança) é chamado no fim do `captureLead`: se houver `lead_email_html` + projeto + e-mail do lead, monta payload de 1 lead e chama o micro `/send` (reusa o disparo, cria `email_projects_schedules_sent` p/ histórico/tracking, cobra token igual disparo). Sem HTML ⇒ não envia. Requer `project.settings.sender` configurado.
- **Parte 5 — anúncios (FEITA, espelhado do webchat):**
  - **Modelo:** tabela `quiz_ads` (espelho de `webchat_ads`, com `quiz_id`) — migration `..._add_quiz_ads`. Uma linha por **posição** (`@@unique(quiz_id, position)`). Por ora a UI só expõe **`topo`**, mas o back já aceita `rodape`/`intersticial` (DTO `update-quiz-ads.dto.ts` + `quiz-ads.service`).
  - **Normalização:** `back/src/quizzes/ads-normalize.util.ts` = cópia FIEL das funções puras do webchat (`normalizeAdContract` etc.) — infere `gpt_slot`/`gpt_div_id`/`gpt_sizes` do código colado, detecta HTML fixo (ADX), preserva rótulo. **NÃO divergir disso** ou o anúncio não imprime.
  - **Back:** `QuizAdsService` (get/update por posição; vazio remove a posição; `ativo=false` preserva mas some do público). Endpoints `GET /quizzes/:id/ads` e `PATCH /quizzes/:id/ads` no `quizzes.controller`. `getPublicConfig` inclui `ads_config` (publicOnly=true → sem inativos). Admin removeOrg apaga `quiz_ads`.
  - **Front:** engine `quiz/quizAds.js` (espelho do `PublicWebchat`: 3 modos — HTML fixo / GPT slot / código-como-HTML — carrega `gpt.js`, recria `<script>`, rótulo). `QuizView` recebe `ads` e monta o **topo** (`#quiz-ad-topo` acima do card) só no modo **live** (`mountQuizAds`). `PublicQuiz` passa `ads_config`. Configuração via **`QuizAdsDialog.jsx`** (ação 📣 "Anúncios" na lista de quizzes): código, tamanho, avançado (gpt_slot/div), rótulo + toggle, ativar/desativar. Builder NÃO mostra ad (igual webchat).
- **Parte 4 — split na entrada direta + redirect por resposta (FEITA):**
  - **Split fire direto:** `getPublicConfig` agora inclui `split{slug,members}` (via `buildPublicSplit`). `PublicQuiz.jsx` re-sorteia na entrada direta em `/quiz/:slug` e redireciona p/ `https://<domínio>/quiz/<slug>?nsr=1` (trava anti-loop `?nsr=1`, igual webchat).
  - **Redirect por resposta:** cada opção tem campo opcional `redirect` (no builder: "↪ Redirecionar"). `QuizView` usa `redirectRef` (último não-vazio vence) com prioridade sobre `redirect.url` geral; vale tanto no fim sem captação quanto após enviar o lead.

## Convenções / lembretes
- Deploy front sempre com **build-em-temp + swap atômico** (não buildar direto em `dist`).
- Build back: o processo em memória continua de pé durante o `nest build`; só reiniciar se o build passou.
- `personalizacao` do webchat é **JSON livre** (`settings: Record<string,any>` no DTO) → campos novos persistem sem mexer no back. **Anúncios NÃO** — têm tabela/DTO próprios (`webchat_ads` / `update-webchat-ads.dto.ts`), exigem coluna+DTO+service+payload.
- NestJS tem `ValidationPipe` global com `forbidNonWhitelisted` → campo novo em payload com DTO estruturado precisa entrar no DTO senão é descartado/rejeitado.
- Multi-tenancy: scoping manual por `organization_id` (vindo de `req.user.organizationId`) em cada service. Métodos admin ignoram esse scoping (são cross-org, atrás do RolesGuard).
