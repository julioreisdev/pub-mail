# Tradutor Invisível — plano (plugin WordPress)

Traduz posts e páginas para o idioma do navegador do visitante, sem nenhum aviso, botão ou popup.
Requisitos do Júlio: **rápido · instalação fácil · idioma do conteúdo · invisível · grátis**.

## Decisões

| Requisito | Como |
|---|---|
| Grátis | Endpoint público de tradução do Google (`translate_a/t`, sem chave). Testado em 30/09/2026: lote de 60 parágrafos em 0,23 s, preserva HTML, devolve o idioma detectado de cada trecho, CORS `*`. 4 endpoints equivalentes para rodízio (`translate.googleapis.com` gtx e dict-chrome-ex, `clients5.google.com`, `translate.google.com`). O `translate_a/single` já está bloqueado para IP de datacenter → **plano B pelo navegador do visitante**. |
| Instalação fácil | Plugins → Enviar → Ativar. Zero configuração (tela de ajustes opcional). Tabelas criadas na ativação e em atualização. |
| Idioma do conteúdo | Detector local (PHP) sobre o **texto do post** (título + conteúdo), nunca a configuração do WordPress. Depois o Google confirma trecho a trecho e o plugin guarda o idioma verificado. |
| Invisível | Sem UI. A página fica transparente (`opacity:0`) só enquanto traduz, com revelação garantida por CSS em 2,5 s mesmo se o JS falhar. Marca `<meta name="google" content="notranslate">` e troca `<html lang>` para o navegador não oferecer a tradução dele. |
| Rápido | Script de 1,5 KB no `<head>` decide tudo; o script principal só é baixado quando precisa traduzir. Traduções guardadas em 3 camadas: navegador (localStorage), mapa da página (1 GET já no `<head>`, antes do HTML terminar) e cache de trechos no banco (menu/rodapé reaproveitados entre páginas). Visita repetida = zero espera. |

## Arquitetura

```
<head>  boot inline (sem otimizadores)
  ├─ alvo = navigator.languages[0] normalizado (pt-BR→pt, zh-TW, pt-PT…)
  ├─ pula: robôs (Googlebot/AdSense…), ?notranslate, construtores de página, idioma igual
  ├─ modo completo (conteúdo ≠ alvo): esconde + prefetch GET /p (mapa da página)
  ├─ modo leve (conteúdo = alvo, tema em outra língua): sem esconder, só o “chrome”
  └─ injeta trinv.min.js (async)
DOMContentLoaded  trinv.js
  ├─ segmenta o DOM em unidades de frase (bloco com links/negrito dentro → 1 unidade HTML
  │   com marcadores <a id=N>; os elementos originais são MOVIDOS de volta, nunca recriados
  │   → eventos e atributos preservados)
  ├─ + atributos (title, alt, placeholder, aria-label, botões) + <title>
  ├─ aplica o que já está em cache (localStorage + mapa da página)
  ├─ faltantes → POST /t (servidor traduz no Google, guarda, devolve)
  │    └─ servidor bloqueado/limite/erro → navegador chama o Google direto (CORS *)
  ├─ revela a página (ou prazo de 1,8 s)
  └─ MutationObserver: conteúdo que aparece depois também é traduzido
```

Servidor (REST `trinv/v1`, com fallback `admin-ajax.php` se o REST estiver bloqueado):
- `GET /p?u=<caminho>&l=<idioma>` → mapa `{origem: tradução}` da página + idioma dominante.
- `POST /t {u,l,p,s:[...]}` → traduções na mesma ordem; `f:1` = “use o navegador”.
- Cache: `wp_trinv_seg` (sha256(idioma+trecho) → tradução, idioma detectado) e `wp_trinv_page` (caminho+idioma → mapa).
- Proteções: limites por requisição (800 trechos, 5 mil caracteres cada, 150 mil no total), por IP (200 mil caracteres novos/10 min) e global (1,5 milhão/h); disjuntor de 10 min se o Google bloquear o servidor; o servidor **sempre** traduz ele mesmo (o navegador nunca grava no cache compartilhado → sem envenenamento).
- Nunca roda em: admin, feed, REST, AJAX, AMP, customizer, editores (Elementor, Divi, Beaver, Bricks, Oxygen).
- Nunca toca em: script/style/code/pre/textarea/svg/iframe, anúncios (`ins.adsbygoogle`, `div-gpt-ad`, `google_ads_iframe`), `translate="no"`, `.notranslate`, barra do admin, `contenteditable`.
- Compatível com otimizadores: atributos `data-cfasync="false" data-no-optimize data-no-defer data-no-minify` + filtros de exclusão do WP Rocket, LiteSpeed, Autoptimize, SiteGround.

## Pós-processamento da tradução
- Espaço que o Google coloca dentro da tag (`em<time> 3 de`) volta para fora.
- Espaço antes de pontuação depois de uma tag (`</b> .`) é removido (exceto francês).
- Espaços no começo/fim da unidade são repostos como no original.
- Marcador que sumiu na tradução: o elemento original é reanexado no fim da unidade (nada se perde).

## Testes (camadas)
1. Sintaxe: `php -l` em PHP 8.3 **e 7.4** (docker), `node --check`, Plugin Check oficial do WordPress.
2. Unidade JS (Node + jsdom): idiomas, robôs, segmentação, marcadores, reordenação, marcador sumido, entidades, pontuação, eventos preservados, idempotência, observer, cache, fallback com fetch simulado.
3. Unidade PHP (wp eval): detector, cache, cliente do Google (lote, paralelo, rodízio, disjuntor), limites, validação do REST, fallback admin-ajax.
4. Ponta a ponta (Chrome headless real em sites.reveleonline.com): posts em en/es/fr/ja/pt × navegadores pt-BR/en/de/es; tempo até revelar (1ª visita, cache servidor, cache navegador); sem “piscar” do original; links/botões com JS funcionando; anúncio intocado; `?notranslate`; Googlebot; conteúdo dinâmico; celular com CPU 4× mais lenta; servidor “bloqueado” → Google direto do navegador; REST bloqueado → admin-ajax; com plugin de cache (WP Super Cache) e otimizador (Autoptimize); tema de blocos e tema clássico; console sem erros.
5. Carga: 20 primeiras visitas simultâneas em idiomas diferentes.
6. Ciclo de vida: instalar pelo .zip como o usuário, desativar, desinstalar (limpa tabelas/opções), reinstalar.

## Entregável
`tradutor-invisivel.zip` na raiz do projeto (fonte em `wordpress/tradutor-invisivel/`).

## O que mudou durante os testes (30/09/2026)
- **Mapa da página como JSON estático** em `uploads/trinv/<sha256(caminho)>-<idioma>.json`, servido pelo servidor web sem PHP (≈45 ms contra ≈200 ms da REST). O `<head>` informa em `sm` para quais idiomas o mapa já existe (olhando os arquivos) → nenhum 404 no console. "Apagar traduções" esvazia os arquivos em vez de removê-los (páginas em cache de outros plugins continuam sem 404). Sem pasta gravável → REST, automaticamente.
- **Itens de menu**: palavra solta o Google erra ("Sobre" → "On", "Início" → "Start"). O plugin pede também a versão com o contexto neutro `Menu: <span id="m">…</span>` e fica com ela, salvo quando ela devolve a palavra intacta (ex.: "Loja", lida como a cidade) — aí usa a versão sem contexto.
- **Trechos curtos (1 a 3 palavras) recebem dica de idioma de origem**: detecção automática erra ("em" → "eles", "Blog" → "Blogue"). Textos que o WordPress/tema/plugins escreveram já traduzidos (coletados via `gettext` desde o `template_redirect` — em tema de blocos o corpo é montado antes do `wp_head`) → idioma do WordPress; curtos dentro do conteúdo do post (fora de listas de outros posts) → idioma do conteúdo; escrita não latina e o resto → automático. Trecho curto que já está no idioma do visitante nem é enviado. A dica entra na chave do cache (`dica\x01texto`).
- **Nome do site e logo nunca são traduzidos.**
- **Lista de posts em várias línguas**: a dica da página vira "desconhecido" (traduz tudo; o Google mantém o que já está na língua do visitante).

## Resultados
- Unidade 75/75 · PHP 34/34 · Chrome real 57/57 · Plugin Check oficial: sem erros nem avisos · PHP 7.4 e 8.3 ok.
- Tempo até a página aparecer já traduzida (mediana de 5, desktop): sem tradução 352 ms (referência) · 1º visitante do idioma 830 ms · visitante novo com cache do servidor 526 ms · visitante voltando 155 ms. Celular lento (3G + CPU 4×) com cache: aparece junto com o DOMContentLoaded.
- Carga: 20 idiomas × 45 trechos, frios e simultâneos → 20/20 completos, sem bloqueio do Google.
- Compatível com: Twenty Twenty-Five (blocos), Twenty Twenty-One (clássico), Autoptimize (JS juntado/adiado), HTML servido de cache, REST bloqueada (usa admin-ajax), servidor bloqueado pelo Google (navegador traduz direto).
- Limites conhecidos: texto dentro de imagem; nomes próprios isolados em links às vezes são traduzidos pelo Google ("John" → "João"); qualidade de palavras soltas depende do Google.
- Kit de build/testes: `wordpress/tradutor-invisivel-dev/` (ver README).

## Versão 1.1.0 (30/09/2026) — blindagem para campanhas

### Tradutor oficial opcional (reserva)
- Ajustes → "Tradutor oficial (opcional)": Google Cloud Translation (v2, chave de API) ou Microsoft Translator (v3, chave + região). Modo **reserva** (só quando o gratuito falha) ou **sempre**.
- `includes/class-trinv-official.php`: `TRINV_Official` (lotes de 40 trechos/8 mil caracteres, `format=html`, códigos Google↔Microsoft: zh-CN↔zh-Hans, zh-TW↔zh-Hant, iw↔he, jw↔jv, tl↔fil, no↔nb, pt-PT↔pt-pt, mni-Mtei↔mni) e `TRINV_Translator` (orquestra: gratuito → oficial para o que faltou, ou o contrário no modo "sempre"). A API do plugin usa `TRINV_Translator`; com chave oficial, o servidor traduz mesmo com o gratuito bloqueado.
- A chave fica só no servidor: o campo volta sempre vazio (placeholder mostra só os 4 últimos caracteres; vazio = mantém). Botão "Testar tradutor oficial" no card de conexão; erro do provedor aparece no aviso (ex.: "HTTP 400 API key not valid"). Trocar a chave apaga o resultado do teste anterior.

### Línguas da direita para a esquerda
- Visitante em árabe, hebraico, persa, urdu, iídiche, pashto, sindi, uigur, divehi ou curdo sorani: cada bloco traduzido recebe `dir="rtl"` (o layout do tema não é espelhado). Lista de conteúdo acompanha o item (marcadores do lado certo); menus (`nav`, `header`, `footer`, classes com menu/nav) mantêm a ordem do tema. Página RTL traduzida para língua LTR recebe `dir="ltr"`.

### Pré-tradução dos idiomas da campanha
- Ajustes → "Idiomas da campanha" (ex.: `en, es, fr, de, it`). Todo post/página publicado ou atualizado entra na fila (`transition_post_status`); também há "Pré-traduzir" na lista de posts/páginas e "Pré-traduzir as 20 mais recentes" nos ajustes.
- **Como roda (paridade exata):** o painel do dono (qualquer tela do wp-admin, editor de blocos, Elementor) abre a página num quadro invisível com `?trinv_warm=<post>.<validade>.<hmac>` (15 min, `wp_salt('auth')`). Nessa requisição a página é montada como **visitante anônimo** (sem barra de admin, formulário de comentário de visitante) e o **próprio trinv.js** segmenta exatamente como faria para um visitante e pede ao servidor todos os trechos em cada idioma da campanha (mesma API `/t`, com o token: sem limite por IP, só o global). O servidor grava cache de trechos + mapa da página + JSON estático. Nada é aplicado no quadro nem gravado no navegador.
- Chegada do trabalho no painel: ao abrir qualquer tela com fila; pelo heartbeat do WordPress (`heartbeat_send` avisa `trinv_warm`); no editor de blocos logo depois de salvar (`wp.data.subscribe`); no Elementor depois de publicar (`$e.commands` `document/save/*`). Reserva de 150 s por item evita dois painéis fazendo o mesmo.
- O quadro coleta depois do `load` quando o DOM fica 1,5 s sem mudanças (máx. 8 s): pega conteúdo inserido por scripts.
- **Sem pixels nem anúncios:** o quadro recebe `Content-Security-Policy` só com o próprio site (scripts, imagens e conexões de terceiros bloqueados), `frame-ancestors` do site, sem cache (`DONOTCACHEPAGE`, `nocache_headers`, LiteSpeed nocache) e sem `X-Frame-Options`. O visitante real carrega tudo normalmente (testado com um pixel falso do Facebook).
- Depois de pré-traduzir, o cache de página do post é limpo nos plugins conhecidos (WP Rocket, WP Super Cache, W3TC, WP Fastest Cache, SiteGround, LiteSpeed) para o HTML anunciar os mapas prontos (`sm`).
- Aviso discreto no canto inferior direito do painel (2 linhas: "Tradutor Invisível" / “Título” · pré-traduzindo 2/3 idiomas → pronto em 3 idiomas). Resultado fica em `_trinv_warm` do post (ok/total/idiomas/erro); a ação da lista vira "Pré-traduzido ✓ (refazer)".
- Limitações: roda enquanto alguém com permissão de editar está com o painel aberto (quem publica está); site que bloqueia iframe pelo servidor web (`X-Frame-Options: DENY` no nginx/Apache) não pré-traduz (os visitantes continuam recebendo a tradução na 1ª visita).

### Resultados 1.1.0
- Unidade 94/94 (inclui paridade: o visitante pede exatamente as chaves pré-traduzidas, em idioma estrangeiro, português e mesma língua do conteúdo) · PHP 61/61 (tradutor oficial com respostas simuladas, token, fila, reserva, heartbeat, limite por IP) · Chrome real 91/91 · Plugin Check oficial sem erros · PHP 7.4 e 8.3.
- Primeiro visitante de cada idioma da campanha depois da pré-tradução: 440–660 ms, **zero** chamadas de tradução (só o JSON estático) — antes: ~830–1060 ms.

## Versão 1.2.0 (30/09/2026) — página 100% traduzida em qualquer tema + edição do Pub Mail

### Conteúdo já no idioma do visitante (bug relatado pelo Júlio)
Antes: post em português + visitante em português = o plugin não fazia nada, e o link "← 東京旅行ガイド" (outro post) ficava em japonês. Agora há dois modos:
- **completo** (conteúdo em outra língua): esconde e traduz tudo, como antes;
- **em volta** (conteúdo já na língua do visitante): não esconde e não toca no texto do post; traduz o que está em volta — menus, links e listas de outros posts, comentários, textos do tema. Liga junto com o ajuste "Textos do tema" (padrão ligado). A pré-tradução usa a mesma regra (`modeFor`/`wanted` compartilhados).

### O servidor informa o idioma do que aparece na página (`#trinv-fx`, rodapé)
- Títulos (`the_title`) e resumos (`get_the_excerpt`) de outros posts → idioma de cada post (detector com cache por versão).
- Comentários (`comment_text`) → detector.
- Textos do tema/plugins **sem tradução carregada** → `en`.
- No navegador, o bloco que é (quase todo) um desses trechos recebe a origem certa; se o trecho já está na língua do visitante, nem é enviado. Blocos com trechos de línguas diferentes vão com detecção automática.
- **Ilhas:** links de categoria/tag (`rel=tag|category`) e trechos conhecidos dentro de uma frase são traduzidos **à parte**, com a própria origem ("Categorized as <Sem categoria>" num tema sem tradução: a frase vem do inglês e o nome da categoria do português).

### Textos do tema pelo original em inglês (`#trinv-orig`)
O `gettext` entrega o texto traduzido **e** o original. O navegador envia o original em inglês ao tradutor ("Responder" → "Reply" para o visitante em inglês; "Antworten" para o alemão, em vez de traduzir do português, que dava "To respond"). Vale também para frases com `%s` (pedaços em volta dos marcadores, ex.: "- Tema WordPress por %s" do Kadence) e para blocos com um nome ao lado ("Mark <span>disse:</span>" → "Mark <span>says:</span>").

### Outros acertos encontrados testando o Kadence
- Nomes de pessoas nunca são traduzidos (`.fn`, nome do autor, nome de quem comentou): "Mark" virava "Marque".
- Itens de listas/carrosséis de **outros posts** usam as mesmas classes do post principal (`.entry-title`, `.entry-summary`): o plugin agora distingue pelo `post-N` do WordPress e por seletores de listas (Kadence `entry-related`, `loop-entry`…).
- O observador de conteúdo novo começa **junto** com a primeira tradução (o carrossel do Kadence clona os slides no carregamento, antes do fim da 1ª tradução) e, no modo completo, a página só aparece depois que esse conteúdo também foi traduzido (sempre dentro da espera máxima).
- Cópias de trechos já traduzidos (clones do carrossel) não são traduzidas de novo.
- Frases longas do tema cheias de marcas ("© 2026 Sites - Tema WordPress por Kadence WP") usam o idioma do site como origem quando contêm uma frase do tema.

### Teste "100% traduzido" (cenário X do e2e)
3 temas (Twenty Twenty-Five de blocos, Kadence, Twenty Twenty-One clássico) × 6 idiomas de visitante (pt, en, es, ja, de, ar) × 7 páginas (5 posts em en/es/fr/ja/pt, página "About us" e a home com posts misturados), com comentários em espanhol/inglês/português. Para cada página, procura no texto visível qualquer frase de outra língua (frases do conteúdo de teste, títulos, comentários, textos do tema em português, qualquer caractere japonês) e se o texto original apareceu antes da tradução. **126/126 páginas 100% traduzidas.**

### Edição do Pub Mail (fase 3 do plano)
- Mesmo código, marcador `TRINV_EDITION` no arquivo principal (`standalone` no zip da raiz; o Pub Mail troca para `pubmail` e acrescenta `license.php` com a chave da conta, o endereço da API, o do painel e a chave pública Ed25519).
- `includes/class-trinv-license.php`: verificação de hora em hora (a cada 5 min parado, em segundo plano pelo WP-Cron), só aceita resposta assinada, do próprio site e recente; sem resposta válida mantém o último estado até a data de fim; **vencido pela data = para na hora** (sem tolerância); mudança de estado esvazia os mapas estáticos (ao parar) e limpa o cache de página nos plugins conhecidos. Parado: sem script no HTML, API responde 402 e o navegador não traduz direto no Google, pré-tradução desligada, aviso no Painel/Plugins e card "Licença do Pub Mail" nos ajustes (com "Verificar agora").
- Atualização automática: `pre_set_site_transient_update_plugins` + `plugins_api` + auto-update ligado; o Pub Mail oferece a versão do código em `/opt/pub-mail/wordpress/tradutor-invisivel` e serve o pacote por token de 48 h. `Update URI: false` impede que o wordpress.org ofereça outro plugin com o mesmo nome.
- Configuração remota: o Pub Mail pode trocar os endpoints do tradutor (`WP_PLUGIN_GOOGLE_ENDPOINTS`) sem nova versão.
- Pub Mail: módulo `wordpress` (tabelas `wp_plugin_licenses` e `wp_plugin_sites`, migration `20260930120000_wp_plugin_licenses`; rotas `GET /wordpress/translator`, `GET /wordpress/translator/download`, `POST /wordpress/translator/rotate`; públicas `POST /public/wp-plugin/check|update`, `GET /public/wp-plugin/package?t=`), página WordPress → Tradução Invisível.
- Limite honesto: o plugin é PHP/JS legível; um técnico pode editar o código e tirar a checagem. A proteção impede o uso casual (apagar o `license.php` não libera: a edição do Pub Mail sem chave fica parada) e falsificação de resposta (assinatura).

## Versão 1.3.0 (01/10/2026) — endereço traduzido + ajustes finais

### Endereço (URL) traduzido — `includes/class-trinv-slugs.php`
- Tabela `{prefix}trinv_slug` (post_id, l, slug; únicos post+idioma; índice no slug), criada na versão 2 do banco do plugin. Um nome por post e idioma, gerado **uma vez** a partir do título traduzido (`sanitize_title`; fora do ASCII fica em %xx como o WordPress guarda, ex. `/自宅でトマトを育てる-完全ガイド/`). Nunca repete o nome de outro post (`-2`, `-3`…) nem de um post de verdade. Post já no idioma do visitante: fica o endereço original. Subpáginas: cada nível traduzido.
- Abrir o endereço traduzido: filtro `request` troca o nome pelo post (`p`/`post_type` ou `page_id`) — post de verdade com o mesmo nome sempre vence; `redirect_canonical` desligado nessa requisição; `<link rel="canonical">` continua no original. O cache de traduções usa o caminho original (`ou`/`request_path`).
- Navegador: depois de traduzir **e** do `load` + 1 s (pixels de anúncio registram o endereço original), `history.replaceState` troca o caminho mantendo parâmetros (utm…) e âncora. Caminho vem do `<head>` (`ps`, idiomas já gerados), do `localStorage` ou de `GET /wp-json/trinv/v1/s?p=&l=` (fallback `admin-ajax` `trinv_s`). Quem lê no idioma do conteúdo volta ao endereço original (`op`). A pré-tradução da campanha já gera os endereços dos idiomas da campanha.
- Ajuste "Endereço (URL)" ligado por padrão; desligado sozinho com links permanentes "Simples". Apagar o post apaga os endereços dele; "Apagar traduções" não mexe nos endereços (links compartilhados continuam valendo).

### Outros
- **Título da aba:** o nome do site nunca é traduzido (a home mostrava "Locais"): vai como marcador no título; título que é só o nome do site nem é enviado.
- **Emoji do WordPress (wp-emoji):** a imagem conta como o próprio caractere — mesma chave antes/depois da troca (pré-tradução = visitante) e sem retradução depois de aplicar.
- **Desempenho:** o servidor manda todas as origens numa rodada paralela de até 8 pedidos; o observador reaproveita a tradução já a caminho para a mesma chave; revelação espera o conteúdo inserido no carregamento (fila de 60 ms enquanto a página está escondida).
- **Conteúdo de teste mais natural** (o fim da home parecia estranho): anúncio como bloco "Advertisement", código promocional `TOMATO10`, botão "👍 This guide helped me", dica inserida por script, ilustração de tomate.
- **Teste X ampliado:** 11 tipos de página (5 posts, página, home, categoria, autor, busca, 404), título da aba conferido (nome do site intacto) e checagem estrita para alemão/árabe (nenhuma linha do original pode ficar igual). Cenário **U** (endereço traduzido): 14/14.


## Versão 1.4.0 (01/10/2026) — fase 4: ecossistema

Cenário montado no site de teste por `setup-ecosystem.sh` (`ecosystem.php`): página de vendas em inglês no **Elementor 4.3** (título, texto, botão, lista com ícones, caixa com ícone, contador, barra de progresso, sanfona, abas, depoimento, alerta, animação de entrada) e loja **WooCommerce 11.1** (2 produtos virtuais em inglês, carrinho/checkout em blocos, pagamento na entrega para teste).

### Correções encontradas
- **Título da aba:** o Google comia o espaço antes do marcador do nome do site ("Tomatenanbaukurs –Sites"). Agora só o texto vai para tradução; separadores (" – ", " | ", " — ") e o nome do site voltam exatamente como estavam.
- **Nome do site dentro de frases** fora do conteúdo (rodapé "© 2026 Sites – Tema por…" virava "サイト"): vai como marcador e volta intacto. Dentro do post não (um nome comum como "Blog" precisa continuar traduzível). "© 2026 Sites" sozinho nem é enviado.
- **Dados do comprador nunca traduzidos** (`PRIVATE`: `<address>` e o cartão de endereço do checkout em blocos) — "Ana Teste / Rua das Flores" virava "アナテスト / フローレス通り" na confirmação do pedido. Nomes de depoimento do Elementor e autor de avaliação do WooCommerce entram em `NAMES`.
- **Endereço traduzido só no endereço do próprio post** (`TRINV_Slugs::swappable`): nunca em `/2/`, página de comentários, `/order-received/…`, `/my-account/orders/`, nem no carrinho, checkout e conta da loja (gateways de pagamento leem o endereço). Antes, em `/my-account/orders/` a barra iria para `/mein-konto/` e recarregar abriria outra tela.
- **RTL em `<div>` de texto** (depoimento do Elementor): `<div>` que só tem texto e elementos de texto recebe `dir`; contêiner de layout e menus continuam sem.
- **Comentários nunca são o texto do post** (`COMMENTS` em `inContent`): o Astra põe `.entry-content` dentro de cada comentário, e no modo "em volta" (visitante na língua do post) os comentários em outras línguas ficavam sem tradução.
- **Texto de exemplo de `<textarea>`** ("Notes about your order…" no checkout clássico): o `placeholder` é traduzido; o que a pessoa digita continua intocado (`notranslate`/`translate="no"` respeitados).
- **Blocos redesenhados pelo site depois da tradução** (contador do mini-carrinho do WooCommerce via Interactivity API): (1) texto que nós já escrevemos vira marcador intacto e só o texto novo vai para tradução (antes ia "Seu carrinho (items: 0)" inteiro, o Google detectava português e devolvia sem traduzir, a cada visita); (2) memória `REV` original → tradução nesta página: se o site devolve um texto exatamente ao original, ele volta traduzido na hora, sem pedido (o 2º visitante, que pega tudo do cache, traduzia antes do WooCommerce montar o carrinho e gerava 1 pedido a mais por visita). Unidade sem letras depois dos marcadores nem é enviada.
- **Página sem texto próprio** (carrinho/checkout só com blocos, construtores que guardam o texto fora do post): `TRINV_Frontend::hint()` devolve desconhecido em vez do idioma do site; o Google identifica e `remember_verified` memoriza por versão do post. Antes, depois de qualquer edição da página do carrinho, o visitante na língua do site via o carrinho em inglês.

### Kit de testes
- `setup-ecosystem.sh` + `ecosystem.php` (cenário), `e2e.mjs` com **EL** (Elementor), **WC** (WooCommerce em blocos), **WCC** (clássico: troca as páginas pelos shortcodes e restaura), **CACHE** (com qualquer plugin de cache ativo), **PEEK** (olhar uma página), filtro exato `TRINV_ONLY=C,D,W` e vigia que encerra com "TRAVOU: … Último: <teste>" se nada avançar em 6 min.
- `browsers.mjs` + `run-browsers.sh`: Firefox, Safari, iPhone (WebKit) e Android (Chromium) via Playwright **no servidor** (`/opt/trinv-browsers`, navegadores em `ms/`), 4 idiomas × 4 páginas + botão Voltar.

### Resultados
- Unidade **129/129** · PHP **81/81** (inclui `swappable` com carrinho/checkout/conta do WooCommerce e página sem texto = idioma desconhecido) · sintaxe PHP 7.4 e 8.3 · Plugin Check: só os avisos esperados do atualizador.
- Chrome real: A…W + U **109/109** (Twenty Twenty-Five, com Elementor e WooCommerce ativos) · **EL** Elementor 32/32 (de, pt, es, ja, ar, en; editor do Elementor sem o tradutor) · **WC** WooCommerce em blocos 36/36 (loja + AJAX, produto, carrinho com quantidade, checkout, pedido feito de verdade; de, ja, ar, pt) · **WCC** clássico 12/12 · **CACHE** LiteSpeed Cache (CSS/JS minificado e combinado, JS "Delayed", HTML minificado, lazy load) 20/20 e WP Super Cache (2º visitante recebe o HTML do cache) 20/20 · LICSHOT 4/4.
- **Matriz X: 6 temas × 6 idiomas × 11 tipos de página = 396/396 páginas 100% traduzidas** (Twenty Twenty-Five, Twenty Twenty-One, Kadence, Astra, GeneratePress, Hello Elementor), com nome do site intacto no título e no rodapé.
- **Navegadores (Playwright no servidor): 16/16** — Firefox, Safari, iPhone (WebKit) e Android (Chromium) × pt/de/ja/en × 4 páginas + botão Voltar. Mediana até aparecer traduzida: Android 305 ms · iPhone 462 ms · Firefox 596 ms · Safari 606 ms.
- Publicado: zip da raiz 1.4.0; Pub Mail serve a 1.4.0 de `/opt/pub-mail/wordpress/tradutor-invisivel` (backup da 1.3.0 em `/root/backups/tradutor-invisivel-1.3.0-2026-10-01.tgz`); site de teste com Kadence + edição do Pub Mail 1.4.0 (licença ativa, org SuperAdmin) + Elementor + WooCommerce ativos (LiteSpeed Cache e WP Super Cache instalados e desativados).
- Pacote do Pub Mail gerado sem senha: token de 5 min assinado **no servidor** com `JWT_ACCESS_SECRET` do `back/.env` → `GET 127.0.0.1:8000/wordpress/translator/download` → `wp plugin install` (o servidor não tem `unzip`; conferir o zip com Python).

## Versão 1.4.1 (01/10/2026) — loja: URL traduzida e "Finalizar compra"

Bugs relatados pelo Júlio com prints: `/my-account/` sem URL traduzida e "Check-out" no menu.
- **"Check-out" / "Confira":** com o contexto "Menu:" o Google lê **cardápio** em português ("Cardápio: Check-out") e, sem contexto, "Checkout" vira "Confira". Com contexto de loja acerta em quase todos os idiomas (pt "Finalizar compra", de "Zur Kasse", es "Pagar", fr "Commander"). Agora: item de menu que leva a uma página da loja → `Online store menu:`; título curto (≤ 3 palavras) numa página da loja → `Online store page:`; título da aba de página da loja com um pedaço só → também. O servidor manda no `<head>` `wl` (caminhos de Loja/Carrinho/Checkout/Minha conta) e `ws` (esta página é da loja) — `TRINV_Frontend::store_cfg()`.
- **URL traduzida na loja:** carrinho, checkout e minha conta deixam de ser excluídos em `TRINV_Slugs::swappable()`; continuam originais só os endereços de pedido do WooCommerce (`is_wc_endpoint_url()`: `/order-received/`, `/order-pay/`, `/my-account/orders/`…), além de `/2/` e páginas de comentários. A **Loja** (lista de produtos) também: `TRINV_Slugs::current_id()` devolve a página "Loja" em `is_shop()`, e o filtro `request` abre o endereço traduzido dela como `post_type=product`.
- **Endereço da página da loja com contexto:** `make()` traduz o título com `Online store page:` (antes `/comprar/`, `/confira/`, `/verificar/`, `/carro/`; agora `/loja/`, `/finalizar-compra/`, `/pagar/`, `/carrito/`, `/zur-kasse/`). Banco do plugin **versão 3**: ao atualizar, `TRINV_Slugs::forget_store_pages()` apaga os endereços antigos das páginas da loja (refeitos na próxima visita).
- **Pedido extra no 2º visitante (carrossel do Kadence):** os rótulos do carrossel ("Go to slide 1"…) apareciam antes de o mapa pronto da página chegar e iam direto para `/t`. Agora o que aparece depois espera o mapa (`mapWait`, no máx. 0,7 s) antes de pedir tradução.

### Resultados 1.4.1
- Unidade 132/132 · PHP 85/85 · A…W + U 109/109 (TT25) · WooCommerce blocos 36/36 (carrinho e checkout com URL traduzida, pedido concluído, confirmação no endereço original) · clássico + D no Kadence 21/21 · **matriz X 396/396** (6 temas) · navegadores 16/16 (Android 297 ms · iPhone 448 ms · Firefox 516 ms · Safari 604 ms) · **atualização automática 2/2** (cenário UPD).
- **Atualização automática:** o plugin guarda por 6 h a resposta do Pub Mail sobre versões (`trinv_update_info`); o botão "Verificar novamente" do painel (`update-core.php?force-check=1`) agora ignora esse cache e consulta na hora. Testado: edição do Pub Mail marcada como 1.4.0 + cache vencido → "Verificar novamente" acha a 1.4.1 → `wp plugin update` instala → edição pubmail, licença ativa.
- Kit: `license/install-pubmail.sh [versão-falsa]` instala no site de teste a edição do Pub Mail gerada no servidor (token de 5 min, sem senha); `node e2e.mjs UPD` testa a atualização.
- Publicado: zip da raiz e Pub Mail na 1.4.1 (backups da 1.3.0 e 1.4.0 em `/root/backups/`); site de teste = Kadence + edição do Pub Mail 1.4.1 (licença ativa) + Elementor + WooCommerce.

## Versão 1.5.0 (27/10/2026) — menu próprio + tradução de URL desligada por padrão

Pedido do Júlio: a tradução do endereço (URL) deve **vir desabilitada** e o dono liga num item **"Tradutor Invisível" na barra lateral do WordPress**, numa página com uma função só: o checkbox "Habilitar tradução de URL".

### O que mudou
- **Menu "Tradutor Invisível"** (`add_menu_page`, ícone `dashicons-translation`, posição 58.6) em `class-trinv-admin.php` → página **Tradução de URL** (`admin.php?page=tradutor-invisivel`, `urls_page()`): cartão com ícone, estado (Ligada / Ligada · aguardando / Desligada), explicação, exemplo `/grow-tomatoes/` → `/cultivando-tomates-em-casa/` → `/cultivando-tomates-en-casa/`, **interruptor** "Habilitar tradução de URL" + Salvar (`admin_post_trinv_urls`, nonce, `manage_options`), avisos quando os links permanentes são "Simples", quando a licença está pausada ou a tradução está desligada nos ajustes, 4 notas (um endereço por página e idioma + contagem de `trinv_slug`, canônico, páginas da loja, desligar não quebra nada) e rodapé com "ver em inglês/espanhol" + link para Ajustes. Sem JS obrigatório: o script só atualiza a pílula e mostra "Alteração ainda não salva".
- **Ajustes** virou submenu do mesmo menu (`admin.php?page=tradutor-invisivel-ajustes`); saiu de Configurações. A linha "Endereço (URL)" do formulário virou um ponteiro (pílula + link) para a página do menu; `sanitize()` mantém `urls` quando a chave não vem no formulário. Todos os redirecionamentos (`trinv_test`, `trinv_test_official`, `trinv_clear`, `trinv_warm_now`, `trinv_license_check`) usam `TRINV_Admin::url()`; links da lista de plugins = "Tradução de URL" + "Ajustes".
- **Padrão `urls = 0`** em `trinv_options()`. **Migração** (`TRINV_Store::DB_VERSION = '4'`, `keep_urls_on_upgrade()`): site que já tinha o plugin e nunca salvou a chave `urls` recebe `urls = 1` gravado (continua como estava); quem já tinha escolhido fica como escolheu; instalação nova nasce desligada.
- **Desligada não quebra link compartilhado:** `TRINV_Slugs::resolving()` (plugin ligado + links bonitos + licença) é o que o filtro `request` usa para abrir um endereço traduzido já criado; `enabled()` (= `resolving()` + `urls`) continua valendo para **gerar** endereços (`ensure`, API `/s`, pré-tradução) e para a troca na barra (`ul/su/ps` no boot). O boot recebe `ou/op` sempre que a página foi aberta por um endereço traduzido, e o `urlSwap` do `trinv.js` sem `ul` leva a barra de volta ao original (`setPath(C.op)`).
- Ligar/desligar com mudança chama `TRINV_Warm::purge_all()` (HTML guardado por plugins de cache traz a configuração antiga).
- Painel do Pub Mail (`TranslatorPlugin.jsx`): dica abaixo dos 3 passos dizendo onde ligar a tradução de URL.

### Testes
- Unidade 138/138 (`npm test`; +2: sem `ul` nada é trocado nem pedido; aberto por endereço traduzido volta ao original).
- PHP 91/91 (`test_php.php`, rodado no clone `sem-traducao-sites.reveleonline.com` com o zip avulso instalado só para o teste e desinstalado no fim — o `sites` é o site de apresentação): padrão desligado, migração de site antigo (sem chave → 1; `urls=0` salvo → respeita), desligada não gera (`ensure`/`/s`) e resolve o que já existe.
- `sites.reveleonline.com` atualizado pelo **pacote do Pub Mail** (`license/install-pubmail.sh`): migração gravou `{"urls":1}`, banco v4, 67 endereços intactos; Playwright no servidor **18/18** (menu + submenus, página Ligada, desligar de verdade → aviso, opção 0, site público sem `ul`, endereço traduzido antigo ainda 200 com `op`, `/s` em idioma novo não cria; religar → `ul`+`ps` de volta; Ajustes sem o checkbox antigo e "Testar agora" voltando para a tela nova; lista de plugins 1.5.0 com os 2 links; celular 390 px sem rolagem lateral; zero erro de console). Sessão de captura destruída no fim.
- Sintaxe PHP 7.4 e 8.3 OK. Zip da raiz e `/opt/pub-mail/wordpress/tradutor-invisivel` na 1.5.0 (backup da 1.4.2 em `/root/backups/tradutor-invisivel-1.4.2-<data>`); os sites com a edição do Pub Mail atualizam sozinhos.

### 1.5.1 (27/10/2026) — site apagado some da lista do Pub Mail
Print do Júlio: apagou o plugin do `sites` e o site continuou em "Sites usando o plugin". A lista era "todo site que já se apresentou". Agora: **(1)** o plugin avisa o Pub Mail ao ser **desativado** (`trinv_deactivate()` → `TRINV_License::goodbye('deactivate')`) e ao ser **apagado** (`uninstall.php` lê o `license.php` e faz o mesmo POST, `reason:'uninstall'`) em **`POST /public/wp-plugin/remove {key, plugin, site, reason}`** (best-effort, 5 s; só na edição do Pub Mail); **(2)** o Pub Mail grava `wp_plugin_sites.removed_at` (migration `20261027120000_wp_plugin_sites_removed`) em todas as linhas daquele endereço+plugin da conta e a lista (`info()` e `pushSites()` do Push In Play, via `installedWhere()`) só traz `removed_at IS NULL` **e** com verificação de licença nos últimos **3 dias** (`SITE_STALE_MS` — rede de segurança para pasta apagada por FTP/site fora do ar, que não consegue avisar); `check()`/`stats()` zeram o `removed_at` (reativou/reinstalou = volta). O mesmo foi feito no **Push In Play 0.10.3** (`pip_deactivate()` — o plugin não tinha gancho de desativação — + `uninstall.php` + `PIP_License::goodbye`). Testado em produção: `sites` desativa → some (log do back "plugin … deactivate em sites.reveleonline.com"), reativa → volta, nos dois plugins; clone `sem-traducao-sites` com a edição do Pub Mail: desativar some, `removed_at` zerado por SQL + `wp plugin uninstall` → some de novo pelo `uninstall.php`, clone limpo. Atenção: o Júlio tinha **apagado** o Tradutor do `sites` (uninstall apaga tabelas e opções — os 67 endereços traduzidos e a opção `urls=1` da migração se foram); eu reinstalei a 1.5.1 pelo pacote do Pub Mail e ele nasceu com a tradução de URL **desligada** (instalação nova).
