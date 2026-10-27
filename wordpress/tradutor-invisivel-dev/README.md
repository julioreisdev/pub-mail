# Tradutor Invisível — kit de desenvolvimento

O plugin fica em `../tradutor-invisivel/` e o `.zip` de entrega em `/tradutor-invisivel.zip` (raiz do projeto).
Esta pasta **não vai no .zip**: é só build e testes.

```sh
cd wordpress/tradutor-invisivel-dev
npm install              # esbuild + jsdom (uma vez)
npm test                 # minifica assets/src → assets/*.min.js e roda os testes de unidade (jsdom)
npm run zip              # minifica e gera /tradutor-invisivel.zip
```

## Testes no WordPress de teste (sites.reveleonline.com)

```sh
./setup-site.sh          # cria 6 conteúdos (en, es, fr, ja, pt + página en) e um mu-plugin de teste
./run-php-tests.sh       # test_php.php dentro do WordPress (detector, cache, Google real, API, limites…)
node e2e.mjs             # Chrome real: todos os cenários (A…X); `node e2e.mjs A` roda só um
                         # D = conteúdo já no idioma do visitante (traduz o que está em volta) · R = árabe (RTL) · U = endereço (URL) traduzido
                         # S = ajustes do tradutor oficial (painel logado) · W = pré-tradução pelo painel
                         # X = "100% traduzido": 3 temas × 6 idiomas × 11 tipos de página (~30 min; TRINV_THEMES=kadence limita)
TRINV_SKIP=X,EL,WC,WCC,CACHE node e2e.mjs   # cenários A…W (tema Twenty Twenty-Five), sem a matriz e o ecossistema
TRINV_ONLY=C,D,W node e2e.mjs                 # nomes exatos (o filtro posicional casa por trecho: "C" pega WC, WCC, CACHE…)
                         # vigia: se nada avançar em 6 min, sai com "TRAVOU: … Último: <teste>"
node e2e.mjs LICSHOT     # capturas da edição do Pub Mail (precisa dela instalada no site)
./deploy-site.sh         # gera o .zip e instala no site de teste
node e2e.mjs Z           # medição de tempo (mediana de 5 rodadas)
node e2e.mjs V           # captura da página inteira traduzida em shots/
./teardown-site.sh       # remove o conteúdo de teste
```

## Ecossistema (fase 4)

```sh
./setup-ecosystem.sh     # página de vendas do Elementor (/tomato-course/) + loja WooCommerce (2 produtos virtuais, pagamento na entrega)
                         # precisa dos plugins elementor e woocommerce ativos
node e2e.mjs EL          # Elementor: 6 idiomas, sanfona/abas/alerta/contador, título, endereço traduzido e o editor do Elementor
node e2e.mjs WC          # WooCommerce em blocos (React): loja + AJAX, produto, carrinho (+quantidade), checkout, pedido feito (WC_LANGS=de-DE:de,…)
node e2e.mjs WCC         # carrinho/checkout CLÁSSICOS (troca as páginas pelos shortcodes e restaura no fim)
CACHE_LABEL=litespeed node e2e.mjs CACHE   # com um plugin de cache/otimização ativo: 4 idiomas × 5 páginas
./run-browsers.sh        # Firefox, Safari, iPhone e Android via Playwright NO SERVIDOR (/opt/trinv-browsers); filtro: ./run-browsers.sh Safari
TRINV_THEMES=astra,generatepress,hello-elementor node e2e.mjs X   # matriz "100% traduzido" em outros temas
PEEK_PAGE=/shop/ PEEK_LANG=ja node e2e.mjs PEEK   # olhar uma página: texto, erros, modo, captura em shots/PEEK-<idioma>.png
```

Antes de testar no site, atualize o plugin lá com `./deploy-site.sh` (instala a edição avulsa; a do Pub Mail volta pelo pacote da página Tradução Invisível).

Resultado em 01/10/2026 (1.4.1): unidade 132/132 · PHP 85/85 · Chrome A…W + U 109/109 · Elementor 32/32 · WooCommerce blocos 36/36 + clássico/D 21/21 · atualização automática 2/2 · LiteSpeed Cache 20/20 · WP Super Cache 20/20 · matriz X 396/396 páginas (6 temas: TT25, TT21, Kadence, Astra, GeneratePress, Hello Elementor × 6 idiomas × 11 tipos de página) · Firefox/Safari/iPhone/Android 16/16 · licença (capturas) 4/4 · sintaxe ok em PHP 7.4 e 8.3 · Plugin Check oficial: só os avisos do atualizador automático (esperados: distribuído pelo Pub Mail, não pelo wordpress.org).

1.5.1 (27/10/2026): desativar/apagar o plugin avisa o Pub Mail (`/public/wp-plugin/remove`) e o site sai da lista. 1.5.0 (27/10/2026): menu "Tradutor Invisível" na barra lateral com a página **Tradução de URL** (interruptor; desligada por padrão em instalação nova, mantida ligada em site que já tinha o plugin) e **Ajustes** como submenu (`admin.php?page=tradutor-invisivel-ajustes` — os cenários S/W/LICSHOT já usam esse endereço). Unidade 138/138 · PHP 91/91 (rodar o `test_php.php` no clone `sem-traducao-sites` com o zip instalado só para o teste, nunca no `sites`).

Edição do Pub Mail no site de teste: `./license/install-pubmail.sh` (pacote gerado no servidor com um token de 5 min, sem senha). Para testar a atualização automática: `./license/install-pubmail.sh 1.4.0` (marca como versão antiga, cache vencido) e `node e2e.mjs UPD`.

O teste da licença (conta temporária no Pub Mail de produção, instalar o pacote dela no site, vencer/renovar/bloquear/tirar o módulo/trocar a chave/atualizar) roda com `license/wp_lic_api.mjs` (API do Pub Mail: `create`, `info`, `public`, `sites`, `renew`, `block`/`unblock`, `nomodule`/`module`, `rotate`, `cleanup`) e `license/wp_lic_site.mjs` (lado do WordPress), com `SA_EMAIL`/`SA_PASS` do superadmin no ambiente; `license/shot_panel.mjs` captura a página do Pub Mail. Os cenários A…W assumem o tema Twenty Twenty-Five; os outros temas são cobertos pelo X. EL/WC/WCC rodam em qualquer tema (testados no Kadence).

Cuidados que já custaram tempo:
- Comandos enviados por `ssh` a partir do Node (`execSync`) passam pelo shell local: `$variavel` é expandida no Mac. Use base64 ou comandos sem `$`.
- `/tmp` e `/var/tmp` do servidor têm `protected_regular`: root não sobrescreve arquivo de outro dono. Use `mktemp`.
- Conteúdo de post não pode ter `<script>` (o `wpautop` quebra); use o mu-plugin de teste.
- Cenários com painel logado geram cookies de autenticação no servidor (`adminBrowser()`), válidos por 30 min e nunca impressos.
- Dentro de template string do `b.eval(...)`, `\s` vira `s`: escreva `\\s`.
- Docker local pode estar parado: a sintaxe em PHP 7.4 roda no Docker do servidor (`php:7.4-cli`).
