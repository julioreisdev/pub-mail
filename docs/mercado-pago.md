# Mercado Pago — como obter o token e configurar o webhook no Pub Mail

Este guia mostra, do zero, como preparar uma conta do Mercado Pago para receber PIX pelo Pub Mail: entrar no painel de desenvolvedores, criar a aplicação, ativar as credenciais de produção, copiar o **Access Token**, cadastrar a **URL do webhook** e, por fim, colar tudo no Pub Mail e testar.

Serve para os dois lugares em que o Pub Mail usa um gateway:

| Onde no Pub Mail | Para quê | Quem configura |
|---|---|---|
| **Administração → Pagamentos → Gateway** | Receber as **assinaturas** (o acesso à plataforma vendido aos clientes) | Só o superadmin |
| **Configurações → Pagamentos → Gateway** | Receber as **vendas** do próprio cliente (produtos no webchat e planos VIP no Telegram) | Cada organização |

O processo no Mercado Pago é idêntico. Só muda onde você cola o token no final. Se a conta do superadmin e a de um cliente forem contas diferentes do Mercado Pago, cada uma faz o processo na sua.

> **Tempo estimado:** 10 a 15 minutos. **Você precisa de:** uma conta Mercado Pago (pessoa física ou jurídica) com login e senha, e-mail/celular de verificação em mãos e o site do seu negócio (qualquer página pública sua, por exemplo `https://reveleonline.com`).

---

## 1. Antes de começar: a conta precisa estar pronta para receber PIX

Faça isto uma vez, no app ou no site do Mercado Pago (não é no painel de desenvolvedores):

1. **Conta verificada.** Entre em `mercadopago.com.br`, abra o seu perfil e confirme que a identidade está validada (documento com foto). Sem isso o Mercado Pago não libera recebimentos.
2. **Chave PIX cadastrada.** Menu **Seu negócio** (ou **Seu dinheiro**) → **Pix** → **Suas chaves** → cadastre uma chave (CPF/CNPJ, e-mail, celular ou aleatória). O QR Code gerado pelo Pub Mail é vinculado à sua conta; sem chave PIX a API recusa a criação da cobrança.

Se a conta já recebe PIX normalmente (por exemplo, pela maquininha ou pelo link de pagamento), este passo está feito.

---

## 2. Entrar no painel de desenvolvedores

1. Abra **https://www.mercadopago.com.br/developers** no navegador.
2. No canto superior direito clique em **Entrar** e use o mesmo login/senha da sua conta Mercado Pago. Pode pedir código por e-mail ou SMS.
3. Depois de logado, clique em **Suas integrações** (também no canto superior direito). Essa é a tela que lista as suas aplicações.

> Se aparecer um aviso do tipo "Complete os dados do seu negócio", clique e preencha. É rápido e obrigatório para credenciais de produção.

---

## 3. Criar a aplicação

Uma "aplicação" é só um cadastro que gera as chaves de acesso. Crie uma só para o Pub Mail.

1. Em **Suas integrações**, clique em **Criar aplicação**.
2. Preencha:
    - **Nome da aplicação:** algo que você reconheça depois, por exemplo `Pub Mail` (ou `Pub Mail Assinaturas` para o gateway do superadmin e `Pub Mail Vendas` para o gateway da organização, se forem contas diferentes).
    - **Que tipo de solução de pagamento você vai integrar?** → **Pagamentos on-line**.
    - **Está usando uma plataforma de e-commerce?** → **Não**.
    - **Qual produto você está integrando?** → **Checkout Transparente** (em algumas contas aparece como **Checkout API** ou **Pagamentos via API**; é o mesmo produto: o pagamento é criado pela API e o cliente paga sem sair do seu site).
    - Se pedir **Modelo de integração**, escolha a opção de **vendedor** (você recebendo na sua própria conta), não "marketplace".
3. Marque o aceite dos termos, resolva o reCAPTCHA (se aparecer) e clique em **Criar aplicação**.

Você cai na página da aplicação recém-criada. O menu da esquerda tem, entre outros, **Detalhes**, **Testes → Credenciais de teste**, **Produção → Credenciais de produção** e **Webhooks**.

> **Não use as credenciais de teste no Pub Mail.** Elas geram cobranças falsas que nunca são pagas de verdade. O Pub Mail só deve receber o token de **produção**.

---

## 4. Ativar as credenciais de produção e copiar o Access Token

1. No menu da esquerda da aplicação, clique em **Produção → Credenciais de produção**.
2. Na primeira vez aparece um bloco pedindo para **ativar** as credenciais. Preencha:
    - **Indústria** (ramo do negócio, escolha o mais próximo — por exemplo "Serviços" ou "Marketing").
    - **Website:** o endereço público do seu negócio, por exemplo `https://reveleonline.com`.
    - Aceite a declaração de privacidade e resolva o reCAPTCHA.
    - Clique em **Ativar credenciais de produção**.
3. Com as credenciais ativas, a tela mostra dois pares de chaves. O que o Pub Mail usa é o **Access Token** (começa com `APP_USR-` e é longo). Ignore *Public Key*, *Client ID* e *Client Secret*.
4. Clique no ícone de **copiar** ao lado do Access Token (ou em **Ver** e depois copie o texto inteiro, sem espaços antes ou depois).

**Cuidados com o token**

- Ele dá acesso total ao dinheiro da conta. Nunca envie por WhatsApp, e-mail ou grupo. Cole direto no Pub Mail e pronto.
- O Pub Mail guarda o token no servidor e nunca mais o mostra inteiro (só os primeiros e últimos caracteres).
- Se um dia vazar, volte nessa mesma tela e clique em **Renovar** (gera um token novo e invalida o antigo). Depois cole o novo no Pub Mail.

---

## 5. Cadastrar a URL do webhook

O webhook é o aviso automático que o Mercado Pago manda para o Pub Mail no instante em que um PIX é pago. Com ele a confirmação é imediata. Sem ele o Pub Mail ainda confirma sozinho (ele consulta o Mercado Pago a cada minuto e a tela do cliente a cada 5 segundos), só que com alguns segundos de atraso.

1. No menu da esquerda da aplicação, clique em **Webhooks**.
2. Clique em **Configurar notificações**.
3. Escolha a aba **Modo produtivo** (não "Modo de teste").
4. No campo **URL de produção**, cole exatamente a URL abaixo.

```
https://api.reveleonline.com/payments/webhook/mercadopago
```

Se a sua instalação do Pub Mail usa outro domínio, troque só a parte `api.reveleonline.com`. A URL certa aparece pronta para copiar na própria tela de Gateway do Pub Mail ("URL do webhook").

5. Em **Eventos**, marque **Pagamentos** (às vezes escrito como *Pagamentos / payment*). Não precisa marcar mais nada.
6. Clique em **Salvar configuração**.
7. Depois de salvar, o Mercado Pago mostra uma **assinatura secreta**. O Pub Mail **não precisa dela**: ele nunca confia só no aviso, sempre confere o pagamento diretamente na API do Mercado Pago antes de liberar qualquer coisa. Pode ignorar.
8. Opcional: clique em **Simular** para o Mercado Pago disparar um aviso de teste. O resultado deve ser um código **200** (recebido). Se der erro, confira se a URL foi colada sem espaços e começa com `https://`.

> A mesma URL de webhook serve para tudo no Pub Mail: assinaturas, vendas do webchat e planos do Telegram. O sistema descobre sozinho a qual cobrança o aviso pertence.

---

## 6. Colar no Pub Mail e testar

### Gateway das assinaturas (superadmin)

1. Entre no Pub Mail como superadmin.
2. Menu **Administração → Pagamentos**, aba **Gateway**.
3. **Provedor:** Mercado Pago.
4. **Access Token:** cole o token copiado no passo 4.
5. Clique em **Testar conexão**. Deve aparecer uma confirmação de sucesso com o nome/ID da conta. Se der erro, veja a seção 7.
6. Ligue **Ativo** e clique em **Salvar**.
7. Confira que a **URL do webhook** mostrada nessa tela é a mesma que você cadastrou no passo 5.

A partir daí, todo cliente criado em **Administração → Usuários → Novo cliente** com preço maior que zero recebe, no primeiro login, a tela de pagamento com o QR Code e o código PIX gerados nesta conta.

### Gateway das vendas de uma organização

Mesma coisa, só que em **Configurações → Pagamentos**, aba **Gateway**, logado como usuário daquela organização. Esse token é o que recebe as vendas dos produtos do webchat e dos planos VIP do Telegram. A aba **Vendas** ao lado mostra tudo que entrou.

### Fazendo um teste real de ponta a ponta

1. Em **Administração → Usuários → Novo cliente**, crie um usuário de teste com um valor baixo (por exemplo **R$ 1,00**, 30 dias).
2. Abra uma janela anônima do navegador e entre com esse usuário. A tela de pagamento aparece na hora.
3. Pague o PIX pelo app do seu banco.
4. Em poucos segundos a tela mostra **Pagamento confirmado** e abre a plataforma sozinha. Se demorar, clique em **Já paguei — validar**.
5. Volte como superadmin em **Administração → Pagamentos → Assinaturas**: o cliente aparece como **Ativo** com a data de vencimento, e a aba **Cobranças** mostra o pagamento.
6. Apague o usuário de teste em **Administração → Usuários** (ícone de lixeira). O R$ 1,00 fica na sua conta Mercado Pago normalmente.

---

## 7. Problemas comuns

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| **Testar conexão** dá erro / "não autorizado" | Token de **teste** colado no lugar do de produção, token copiado pela metade, ou credenciais de produção ainda não ativadas | Volte ao passo 4, ative as credenciais e copie o Access Token de **Produção** inteiro |
| "Não foi possível gerar o PIX" na tela do cliente | Conta sem **chave PIX** ou sem verificação de identidade | Passo 1. Depois de cadastrar a chave, tente de novo (não precisa mudar nada no Pub Mail) |
| "Pagamento indisponível no momento. Fale com o administrador." | Gateway sem token ou com **Ativo** desligado | Passo 6: cole o token, teste, ligue Ativo e salve |
| Cliente pagou e a tela não liberou | Webhook não cadastrado ou cadastrado em "Modo de teste" | Clique em **Já paguei — validar**. Depois corrija o webhook (passo 5) para as próximas vezes serem instantâneas |
| **Simular** no Mercado Pago não retorna 200 | URL digitada errada ou com espaço | Copie a URL da tela de Gateway do Pub Mail e cole de novo |
| Token vazou | — | Passo 4, botão **Renovar**; cole o novo token no Pub Mail e clique em Salvar |

---

## 8. Resumo em uma página

1. Conta verificada + chave PIX cadastrada.
2. `mercadopago.com.br/developers` → **Entrar** → **Suas integrações** → **Criar aplicação** (Pagamentos on-line · sem plataforma · Checkout Transparente).
3. **Produção → Credenciais de produção** → **Ativar** → copiar o **Access Token** (`APP_USR-…`).
4. **Webhooks → Configurar notificações → Modo produtivo** → URL `https://api.reveleonline.com/payments/webhook/mercadopago` → evento **Pagamentos** → **Salvar**.
5. Pub Mail → **Administração → Pagamentos → Gateway** (ou **Configurações → Pagamentos** para vendas) → colar token → **Testar conexão** → **Ativo** → **Salvar**.
6. Teste com um cliente de R$ 1,00 e apague depois.
