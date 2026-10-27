<?php
// Testes do lado PHP (rodar com: wp eval-file test_php.php)
$GLOBALS['fails'] = 0; $GLOBALS['total'] = 0;
function ok( $label, $cond, $extra = null ) {
	global $fails, $total;
	$total++;
	if ( ! $cond ) { $fails++; }
	echo ( $cond ? 'PASS ' : 'FAIL ' ) . $label . ( $cond || null === $extra ? '' : '  → ' . wp_json_encode( $extra, JSON_UNESCAPED_UNICODE ) ) . "\n";
}

// ---------------------------------------------------------------- idiomas
$cases = array( 'pt-BR' => 'pt', 'pt_BR' => 'pt', 'pt-PT' => 'pt-PT', 'pt-AO' => 'pt-PT', 'en-US' => 'en', 'es-419' => 'es', 'zh' => 'zh-CN', 'zh-Hant-TW' => 'zh-TW', 'zh-HK' => 'zh-TW', 'he-IL' => 'iw', 'fil' => 'tl', 'nb-NO' => 'no', 'xx' => '', '' => '' );
$bad = array();
foreach ( $cases as $in => $want ) { if ( TRINV_Langs::normalize( $in ) !== $want ) { $bad[ $in ] = TRINV_Langs::normalize( $in ); } }
ok( 'normalização de idiomas (14 casos)', ! $bad, $bad );
ok( 'pt e pt-PT contam como a mesma língua', TRINV_Langs::same( 'pt', 'pt-PT' ) && ! TRINV_Langs::same( 'zh-CN', 'zh-TW' ) && ! TRINV_Langs::same( '', 'en' ) );
ok( 'idioma do WordPress (pt_BR) = pt', 'pt' === TRINV_Langs::site_locale(), TRINV_Langs::site_locale() );

// ---------------------------------------------------------------- detector
// posts criados por setup-site.sh (buscados pelo endereço)
$ids = array();
foreach ( array( 'grow-tomatoes' => 'en', 'recetas-cena' => 'es', 'cafe-parfait' => 'fr', 'tokyo-guide' => 'ja', 'economizar-energia' => 'pt', 'about-us' => 'en' ) as $slug => $l ) {
	$p = get_page_by_path( $slug, OBJECT, array( 'post', 'page' ) );
	if ( ! $p ) { echo "rode setup-site.sh antes (falta o post {$slug})\n"; return; }
	$ids[ $slug ] = $p->ID;
}
$want = array( $ids['grow-tomatoes'] => 'en', $ids['recetas-cena'] => 'es', $ids['cafe-parfait'] => 'fr', $ids['tokyo-guide'] => 'ja', $ids['economizar-energia'] => 'pt', $ids['about-us'] => 'en' );
$got  = array();
foreach ( $want as $id => $l ) { $p = get_post( $id ); $got[ $id ] = TRINV_Detect::detect( $p->post_title . '. ' . $p->post_content ); }
ok( 'detector acerta os 6 conteúdos (en, es, fr, ja, pt, página en)', $got === $want, $got );
$samples = array(
	'de' => 'Die Katze sitzt auf dem Sofa und schläft den ganzen Tag, weil es draußen kalt ist und sie nicht nach draußen gehen möchte. Wir haben ihr auch ein neues Kissen gekauft.',
	'it' => 'La cucina italiana è famosa in tutto il mondo per la sua semplicità e per la qualità degli ingredienti che si usano in ogni regione del paese.',
	'ru' => 'Москва — столица России и крупнейший город страны, в котором живёт более двенадцати миллионов человек и много туристов.',
	'uk' => 'Київ — столиця України, одне з найстаріших міст Європи, яке відоме своїми церквами і парками та історією.',
	'ar' => 'القاهرة هي عاصمة مصر وأكبر مدينة في العالم العربي، وتشتهر بتاريخها الطويل وآثارها الفرعونية القديمة.',
	'ko' => '서울은 대한민국의 수도이며 세계에서 가장 활기찬 도시 중 하나입니다. 전통과 현대가 조화를 이루고 있습니다.',
	'zh-CN' => '北京是中国的首都，有着悠久的历史和丰富的文化。每年都有很多游客来这里参观故宫和长城。',
);
$sg = array();
foreach ( $samples as $l => $t ) { $sg[ $l ] = TRINV_Detect::detect( $t ); }
ok( 'detector: de, it, ru, uk, ar, ko, zh', array_keys( $samples ) === array_values( $sg ), $sg );
ok( 'detector: texto curto/ambíguo = desconhecido', '' === TRINV_Detect::detect( 'Olá' ) && '' === TRINV_Detect::detect( '123 456 !!!' ) && '' === TRINV_Detect::detect( '' ) );
ok( 'detector ignora HTML e shortcodes', 'en' === TRINV_Detect::detect( '<div class="x" data-y="z">[gallery ids="1,2"] The house is on the hill and we can see the sea from the window of our room. It is a very nice place for a holiday with the family.</div>' ) );

// ---------------------------------------------------------------- dica por post (frontend)
$hints = array();
foreach ( $want as $id => $l ) { $hints[ $id ] = TRINV_Frontend::post_lang( get_post( $id ) ); }
ok( 'dica de idioma por post (grava meta por versão)', $hints === $want && get_post_meta( $ids['grow-tomatoes'], '_trinv_lang_v', true ) === get_post( $ids['grow-tomatoes'] )->post_modified_gmt, $hints );
delete_transient( 'trinv_site_lang' );
ok( 'idioma predominante do site (reserva para páginas curtas)', in_array( TRINV_Frontend::site_lang(), array( 'en', 'pt' ), true ), TRINV_Frontend::site_lang() );
ok( 'caminho: aceita /x/, recusa domínio, corta #', '/a/?b=1' === TRINV_API::clean_path( '/a/?b=1#c' ) && '' === TRINV_API::clean_path( 'https://evil.com/' ) && '' === TRINV_API::clean_path( '/' . str_repeat( 'a', 600 ) ) );

// ---------------------------------------------------------------- cache
TRINV_Store::clear();
$src = 'Tom & Jerry <b id="0">"quotes"</b> — ação 日本 🍅';
TRINV_Store::put_many( 'pt', array( $src => array( 'Tradução <b id="0">ok</b> 🍅', 'en' ) ) );
$g = TRINV_Store::get_many( 'pt', array( $src, 'missing' ) );
ok( 'cache de trechos: grava/lê com unicode e emoji', isset( $g[ $src ] ) && 'Tradução <b id="0">ok</b> 🍅' === $g[ $src ][0] && 'en' === $g[ $src ][1] && ! isset( $g['missing'] ), $g );
ok( 'cache separa por idioma', ! TRINV_Store::get_many( 'es', array( $src ) ) );
TRINV_Store::page_merge( '/x/', 'pt', array( 'A' => 'Á', 'B' => 'Bê' ), 'en' );
TRINV_Store::page_merge( '/x/', 'pt', array( 'C' => 'Cê' ), '' );
$pg = TRINV_Store::page_get( '/x/', 'pt' );
ok( 'mapa da página junta e guarda idioma dominante', array( 'A' => 'Á', 'B' => 'Bê', 'C' => 'Cê' ) === $pg['m'] && 'en' === $pg['sl'], $pg );

// ---------------------------------------------------------------- Google (real)
delete_transient( 'trinv_blocked' );
$t0 = microtime( true );
$r  = TRINV_Google::translate( array( 'Hello <a id="0">world</a>!', 'Buenos días', 'Olá mundo' ), 'pt' );
$ms = (int) ( ( microtime( true ) - $t0 ) * 1000 );
ok( "Google real: 3 trechos em {$ms} ms, idiomas detectados", 0 === strpos( $r[0][0], 'Olá <a id="0">mundo</a>' ) && 'en' === $r[0][1] && 'es' === $r[1][1] && 'pt' === $r[2][1], $r );
$many = array();
for ( $i = 1; $i <= 130; $i++ ) { $many[] = "This is sentence number $i about the <b id=\"0\">garden</b> and the kitchen of our house."; }
$t0 = microtime( true );
$r  = TRINV_Google::translate( $many, 'es' );
$ms = (int) ( ( microtime( true ) - $t0 ) * 1000 );
$okc = count( array_filter( $r, function ( $x ) { return null !== $x[0]; } ) );
ok( "Google real: 130 trechos (4 lotes em paralelo) em {$ms} ms", 130 === $okc && false !== strpos( $r[129][0], '130' ), array( $okc, $r[129] ) );
ok( 'Google: lote em paralelo é rápido (< 3 s)', $ms < 3000, $ms );

// ---------------------------------------------------------------- API
$bad = TRINV_API::translate( array( 'l' => 'xx', 's' => array( 'a' ) ) );
ok( 'API: idioma inválido = 400', 400 === $bad['status'] );
$bad = TRINV_API::translate( array( 'l' => 'pt', 's' => array_fill( 0, 801, 'a' ) ) );
ok( 'API: mais de 800 trechos = 413', 413 === $bad['status'] );
$bad = TRINV_API::translate( array( 'l' => 'pt', 's' => array_fill( 0, 50, str_repeat( 'abc ', 1400 ) ) ) );
ok( 'API: corpo acima de 200 KB = 413', 413 === $bad['status'] );
$res = TRINV_API::translate( array( 'u' => '/api-test/', 'l' => 'pt', 'p' => $ids['grow-tomatoes'], 's' => array( 'Good night', 12345, str_repeat( 'x', 7000 ), 'Good night' ) ) );
ok( 'API: resposta alinhada, itens inválidos = null, repetidos ok', 200 === $res['status'] && 'Boa noite' === $res['body']['t'][0] && null === $res['body']['t'][1] && null === $res['body']['t'][2] && 'Boa noite' === $res['body']['t'][3] && 'en' === $res['body']['sl'], $res );
$pg = TRINV_API::page( '/api-test/', 'pt-BR' );
ok( 'API: mapa da página disponível no GET', 200 === $pg['status'] && 'Boa noite' === ( (array) $pg['body']['m'] )['Good night'], $pg );
set_transient( 'trinv_blocked', 1, 60 );
$res = TRINV_API::translate( array( 'l' => 'pt', 's' => array( 'Good night', 'Brand new sentence never seen' ) ) );
ok( 'disjuntor: cache ainda serve; novo pede reserva (f=1)', 'Boa noite' === $res['body']['t'][0] && null === $res['body']['t'][1] && 1 === $res['body']['f'], $res['body'] );
delete_transient( 'trinv_blocked' );
add_filter( 'trinv_ip_limit', function () { return 10; } );
$res = TRINV_API::translate( array( 'l' => 'pt', 's' => array( 'Another completely new sentence here' ) ) );
ok( 'limite por IP: acima do limite pede reserva (sem chamar o Google)', null === $res['body']['t'][0] && 1 === $res['body']['f'], $res['body'] );
remove_all_filters( 'trinv_ip_limit' );

// ---------------------------------------------------------------- idioma confirmado pelo Google (só preenche desconhecido)
$short = wp_insert_post( array( 'post_title' => 'Hi', 'post_content' => 'Short.', 'post_status' => 'publish' ) );
$pl    = TRINV_Frontend::post_lang( get_post( $short ) );
$GLOBALS['wp_query']     = new WP_Query( array( 'p' => $short ) ); // phpcs:ignore
$GLOBALS['wp_the_query'] = $GLOBALS['wp_query']; // phpcs:ignore
ok( 'página sem texto suficiente: idioma desconhecido (nunca o do site — carrinho da loja ficava sem tradução)', '' === TRINV_Frontend::hint(), TRINV_Frontend::hint() );
wp_reset_query();
TRINV_Frontend::remember_verified( $short, 'en', array( 'en' => 90, 'pt' => 10 ) );
ok( 'post curto: detector não sabe → Google confirma', '' === $pl && 'en' === TRINV_Frontend::post_lang( get_post( $short ) ), array( $pl, TRINV_Frontend::post_lang( get_post( $short ) ) ) );
TRINV_Frontend::remember_verified( $ids['economizar-energia'], 'en', array( 'en' => 99 ) );
ok( 'Google nunca contradiz o detector (post pt continua pt)', 'pt' === TRINV_Frontend::post_lang( get_post( $ids['economizar-energia'] ) ) );
wp_delete_post( $short, true );

// ---------------------------------------------------------------- opções / sanitização
$s = TRINV_Admin::sanitize( array( 'enabled' => '1', 'skip' => 'EN-us, es;xx,pt_BR', 'selectors' => '.a, #b<script>', 'maxwait' => '99999' ) );
ok( 'ajustes: idiomas normalizados, seletor limpo, espera limitada', 'en, es, pt' === $s['skip'] && false === strpos( $s['selectors'], '<' ) && 8000 === $s['maxwait'] && 0 === $s['chrome'], $s );

// ---------------------------------------------------------------- dica de idioma (trechos curtos)
delete_transient( 'trinv_blocked' );
$res = TRINV_API::translate( array( 'l' => 'en', 's' => array( 'em', 'Blog', 'Sem categoria', 'em' ), 'h' => array( 'pt', 'pt', 'pt', '' ) ) );
ok( 'API com dica pt→en: "em"→"in", "Sem categoria"→"Uncategorized"', 200 === $res['status'] && 'in' === strtolower( $res['body']['t'][0] ) && 'Blog' === $res['body']['t'][1] && false !== stripos( $res['body']['t'][2], 'uncategorized' ), $res['body'] );
$g = TRINV_Store::get_many( 'en', array( "pt\x01em", 'em' ) );
ok( 'cache separa o mesmo texto com e sem dica', isset( $g["pt\x01em"] ) && isset( $g['em'] ), array_keys( $g ) );
$res = TRINV_API::translate( array( 'l' => 'en', 's' => array( 'x y z' ), 'h' => array( 'zz-invalido' ) ) );
ok( 'dica inválida vira detecção automática', 200 === $res['status'], $res );

// ---------------------------------------------------------------- tradutor oficial (respostas simuladas)
$saved_opts = get_option( 'trinv_options' );
$mock_log   = array();
$mock_mode  = array( 'google' => 'ok', 'microsoft' => 'ok' );
$mock = function ( $pre, $args, $url ) use ( &$mock_log, &$mock_mode ) {
	if ( false !== strpos( $url, 'translation.googleapis.com/language/translate/v2' ) ) {
		$mock_log[] = array( 'google', $url, json_decode( $args['body'], true ) );
		if ( 'fail' === $mock_mode['google'] ) {
			return array( 'headers' => array(), 'body' => '{"error":{"message":"API key not valid"}}', 'response' => array( 'code' => 400, 'message' => 'Bad' ), 'cookies' => array() );
		}
		$b  = json_decode( $args['body'], true );
		$tr = array();
		foreach ( $b['q'] as $q ) { $tr[] = array( 'translatedText' => '[G:' . $b['target'] . '] ' . $q, 'detectedSourceLanguage' => 'en' ); }
		return array( 'headers' => array(), 'body' => wp_json_encode( array( 'data' => array( 'translations' => $tr ) ) ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
	}
	if ( false !== strpos( $url, 'api.cognitive.microsofttranslator.com/translate' ) ) {
		$mock_log[] = array( 'microsoft', $url, json_decode( $args['body'], true ), $args['headers'] );
		$b  = json_decode( $args['body'], true );
		$tr = array();
		foreach ( $b as $it ) { $tr[] = array( 'detectedLanguage' => array( 'language' => 'he' ), 'translations' => array( array( 'text' => '[M] ' . $it['Text'], 'to' => 'x' ) ) ); }
		return array( 'headers' => array(), 'body' => wp_json_encode( $tr ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
	}
	return $pre;
};
add_filter( 'pre_http_request', $mock, 10, 3 );

update_option( 'trinv_options', array_merge( trinv_options(), array( 'provider' => '', 'provider_key' => '' ) ) );
set_transient( 'trinv_blocked', 1, 120 );
ok( 'sem chave oficial e gratuito bloqueado: nada disponível no servidor', ! TRINV_Translator::available() );

update_option( 'trinv_options', array_merge( trinv_options(), array( 'provider' => 'google', 'provider_key' => 'TESTKEY123', 'provider_mode' => 'fallback' ) ) );
ok( 'com chave oficial: disponível mesmo com o gratuito bloqueado', TRINV_Translator::available() );
$mock_log = array();
$r = TRINV_Translator::translate( array( 'Hello <b id="0">you</b>', 'Bye' ), 'pt', 'auto' );
ok( 'gratuito bloqueado → Google Cloud traduz (HTML, sem origem = automático)', '[G:pt] Hello <b id="0">you</b>' === $r[0][0] && 'en' === $r[0][1] && 1 === count( $mock_log ) && false !== strpos( $mock_log[0][1], 'key=TESTKEY123' ) && 'html' === $mock_log[0][2]['format'] && ! isset( $mock_log[0][2]['source'] ), array( $r, $mock_log ) );
$mock_log = array();
TRINV_Translator::translate( array( 'Hi' ), 'es', 'pt' );
ok( 'dica de origem vai como "source" para o Google Cloud', 'pt' === ( $mock_log[0][2]['source'] ?? '' ), $mock_log );
$res = TRINV_API::translate( array( 'l' => 'fr', 's' => array( 'Official test sentence ' . wp_rand() ) ) );
ok( 'API com gratuito bloqueado + chave oficial: traduz no servidor (f=0)', 0 === $res['body']['f'] && 0 === strpos( (string) $res['body']['t'][0], '[G:fr]' ), $res['body'] );

delete_transient( 'trinv_blocked' );
update_option( 'trinv_options', array_merge( trinv_options(), array( 'provider_mode' => 'always' ) ) );
$mock_log = array();
$r = TRINV_Translator::translate( array( 'Always official' ), 'de' );
ok( 'modo "sempre": usa o oficial primeiro', '[G:de] Always official' === $r[0][0] && 1 === count( $mock_log ), $r );
$mock_mode['google'] = 'fail';
$r = TRINV_Translator::translate( array( 'Good morning' ), 'es' );
ok( 'modo "sempre" com o oficial falhando: cai no gratuito', is_string( $r[0][0] ) && false === strpos( $r[0][0], '[G:' ) && '' !== $r[0][0], $r );
ok( 'erro do oficial registrado para a tela de ajustes', false !== strpos( (string) get_transient( 'trinv_official_error' ), 'API key not valid' ) );
$mock_mode['google'] = 'ok';

update_option( 'trinv_options', array_merge( trinv_options(), array( 'provider' => 'microsoft', 'provider_key' => 'MSKEY', 'provider_region' => 'brazilsouth', 'provider_mode' => 'always' ) ) );
$mock_log = array();
$r = TRINV_Translator::translate( array( 'Hello' ), 'zh-TW', 'iw' );
$m = $mock_log[0] ?? array( '', '', array(), array() );
ok( 'Microsoft: códigos convertidos (zh-TW→zh-Hant, iw→he), HTML, chave e região', 'microsoft' === $m[0] && false !== strpos( $m[1], 'to=zh-Hant' ) && false !== strpos( $m[1], 'from=he' ) && false !== strpos( $m[1], 'textType=html' ) && 'MSKEY' === $m[3]['Ocp-Apim-Subscription-Key'] && 'brazilsouth' === $m[3]['Ocp-Apim-Subscription-Region'], $m );
ok( 'Microsoft: idioma detectado volta no código do Google (he→iw)', '[M] Hello' === $r[0][0] && 'iw' === $r[0][1], $r );

$s = TRINV_Admin::sanitize( array( 'provider' => 'microsoft', 'provider_key' => '', 'provider_region' => 'BrazilSouth!', 'provider_mode' => 'always' ) );
ok( 'ajustes: chave em branco mantém a salva; região limpa', 'MSKEY' === $s['provider_key'] && 'brazilsouth' === $s['provider_region'] && 'always' === $s['provider_mode'], $s );
$s = TRINV_Admin::sanitize( array( 'provider' => '', 'provider_key' => '' ) );
ok( 'ajustes: "Nenhum" apaga a chave', '' === $s['provider'] && '' === $s['provider_key'], $s );

remove_filter( 'pre_http_request', $mock, 10 );
update_option( 'trinv_options', $saved_opts ? $saved_opts : array() );
delete_transient( 'trinv_blocked' );
delete_transient( 'trinv_official_error' );

// ---------------------------------------------------------------- pré-tradução (fila, token, limites)
$saved_opts = get_option( 'trinv_options' );
$saved_q    = get_option( TRINV_Warm::QUEUE );
update_option( 'trinv_options', array_merge( trinv_options(), array( 'campaign' => 'es, DE, xx, pt-br', 'skip' => 'pt', 'provider' => '', 'provider_key' => '' ) ) );
ok( 'idiomas da campanha normalizados e sem os excluídos', array( 'es', 'de' ) === TRINV_Warm::langs(), TRINV_Warm::langs() );
$s = TRINV_Admin::sanitize( array( 'campaign' => 'EN; es ,  zz, ja' ) );
ok( 'ajustes: idiomas da campanha limpos', 'en, es, ja' === $s['campaign'], $s['campaign'] );

$tok = TRINV_Warm::token( 123 );
$bad = substr( $tok, 0, -1 ) . ( 'a' === substr( $tok, -1 ) ? 'b' : 'a' );
ok( 'token válido abre o post certo', 123 === TRINV_Warm::verify( $tok ) );
ok( 'token adulterado, de outro post ou lixo é recusado', 0 === TRINV_Warm::verify( $bad ) && 0 === TRINV_Warm::verify( '124' . substr( $tok, 3 ) ) && 0 === TRINV_Warm::verify( 'lixo' ) && 0 === TRINV_Warm::verify( '' ) );
$sign = new ReflectionMethod( 'TRINV_Warm', 'sign' );
$sign->setAccessible( true );
$old = time() - 5;
ok( 'token vencido é recusado', 0 === TRINV_Warm::verify( '123.' . $old . '.' . $sign->invoke( null, 123, $old ) ) );

delete_option( TRINV_Warm::QUEUE );
$pid   = wp_insert_post( array( 'post_title' => 'Warm test', 'post_content' => 'Warm test content for the queue.', 'post_status' => 'publish' ) );
$draft = wp_insert_post( array( 'post_title' => 'Rascunho', 'post_content' => 'x', 'post_status' => 'draft' ) );
$pw    = wp_insert_post( array( 'post_title' => 'Senha', 'post_content' => 'x', 'post_status' => 'publish', 'post_password' => 'abc' ) );
ok( 'publicar coloca o post na fila', array_key_exists( $pid, TRINV_Warm::queue() ) );
ok( 'rascunho e post com senha não entram na fila', ! array_key_exists( $draft, TRINV_Warm::queue() ) && ! array_key_exists( $pw, TRINV_Warm::queue() ) );
wp_set_current_user( 1 );
$hb = TRINV_Warm::heartbeat( array() );
wp_set_current_user( 0 );
ok( 'heartbeat avisa o painel que há fila', 1 === ( $hb['trinv_warm'] ?? 0 ), $hb );
$job = TRINV_Warm::next();
$qs  = $job ? wp_parse_args( (string) wp_parse_url( $job['url'], PHP_URL_QUERY ) ) : array();
ok( 'próximo item: link do post com token e os idiomas', $job && $pid === $job['id'] && array( 'es', 'de' ) === $job['langs'] && $pid === TRINV_Warm::verify( $qs['trinv_warm'] ?? '' ), $job );
ok( 'item reservado não é entregue a outro painel', null === TRINV_Warm::next() );
TRINV_Warm::done( $pid, 40, 40, array( 'es', 'de', '<x>' ), 'Timeout!' );
$m = get_post_meta( $pid, '_trinv_warm', true );
ok( 'concluído: sai da fila e registra o resultado no post (dados limpos)', ! array_key_exists( $pid, TRINV_Warm::queue() ) && 40 === $m['ok'] && array( 'es', 'de' ) === $m['langs'] && 'timeout' === $m['err'], $m );

// limite por IP: o token do painel passa; visitante comum e token falso não
update_option( 'trinv_options', array_merge( trinv_options(), array( 'provider' => 'google', 'provider_key' => 'K', 'provider_mode' => 'always' ) ) );
$mock_mode['google'] = 'ok';
add_filter( 'pre_http_request', $mock, 10, 3 );
$tiny = function () { return 1; };
add_filter( 'trinv_ip_limit', $tiny );
$r1 = TRINV_API::translate( array( 'l' => 'es', 's' => array( 'Rate test ' . wp_rand() ) ) );
$r2 = TRINV_API::translate( array( 'l' => 'es', 's' => array( 'Rate test ' . wp_rand() ), 'w' => TRINV_Warm::token( $pid ) ) );
$r3 = TRINV_API::translate( array( 'l' => 'es', 's' => array( 'Rate test ' . wp_rand() ), 'w' => $bad ) );
ok( 'visitante comum além do limite por IP: o navegador assume (f=1)', 1 === $r1['body']['f'], $r1['body'] );
ok( 'pré-tradução do painel (token) passa do limite por IP', 0 === $r2['body']['f'] && 0 === strpos( (string) $r2['body']['t'][0], '[G:es]' ), $r2['body'] );
ok( 'token adulterado não passa do limite', 1 === $r3['body']['f'], $r3['body'] );
remove_filter( 'trinv_ip_limit', $tiny );
remove_filter( 'pre_http_request', $mock, 10 );

update_option( 'trinv_options', array_merge( trinv_options(), array( 'campaign' => '' ) ) );
wp_update_post( array( 'ID' => $pid, 'post_title' => 'Warm test 2' ) );
ok( 'sem idiomas da campanha: nada entra na fila e o painel não recebe trabalho', ! array_key_exists( $pid, TRINV_Warm::queue() ) && null === TRINV_Warm::next() );
foreach ( array( $pid, $draft, $pw ) as $x ) {
	wp_delete_post( $x, true );
}
update_option( 'trinv_options', $saved_opts ? $saved_opts : array() );
update_option( TRINV_Warm::QUEUE, is_array( $saved_q ) ? $saved_q : array(), false );
delete_transient( 'trinv_official_error' );

// ---------------------------------------------------------------- endereço traduzido
global $wpdb;
TRINV_Store::install();
$urls_saved = get_option( 'trinv_options' );
ok( '1.5.0: tradução de URL nasce DESLIGADA (padrão sem ajustes salvos)', ( function () use ( $urls_saved ) { delete_option( 'trinv_options' ); $r = trinv_options(); if ( false === $urls_saved ) { delete_option( 'trinv_options' ); } else { update_option( 'trinv_options', $urls_saved ); } return 0 === (int) $r['urls'] && ! TRINV_Slugs::enabled() && TRINV_Slugs::resolving(); } )() );
ok( '1.5.0: atualização de site antigo sem ajustes salvos mantém a tradução de URL ligada', ( function () use ( $urls_saved ) { delete_option( 'trinv_options' ); update_option( 'trinv_db_version', '3' ); TRINV_Store::maybe_upgrade(); $o = get_option( 'trinv_options' ); $r = is_array( $o ) && 1 === (int) ( $o['urls'] ?? 0 ) && '4' === (string) get_option( 'trinv_db_version' ); if ( false === $urls_saved ) { delete_option( 'trinv_options' ); } else { update_option( 'trinv_options', $urls_saved ); } return $r; } )() );
ok( '1.5.0: atualização de site que já tinha escolhido (urls=0) respeita a escolha', ( function () use ( $urls_saved ) { update_option( 'trinv_options', array( 'urls' => 0 ) ); update_option( 'trinv_db_version', '3' ); TRINV_Store::maybe_upgrade(); $o = get_option( 'trinv_options' ); $r = 0 === (int) $o['urls']; if ( false === $urls_saved ) { delete_option( 'trinv_options' ); } else { update_option( 'trinv_options', $urls_saved ); } return $r; } )() );
update_option( 'trinv_options', array_merge( trinv_options(), array( 'urls' => 1 ) ) ); // o resto desta seção testa a tradução de URL LIGADA
$st  = TRINV_Slugs::table();
$rowf = function ( $id, $l ) use ( $wpdb, $st ) { return (string) $wpdb->get_var( $wpdb->prepare( "SELECT slug FROM {$st} WHERE post_id = %d AND l = %s", $id, $l ) ); }; // phpcs:ignore
$EN  = 'Growing your own tomatoes is one of the most rewarding things you can do in a small garden. In this guide we walk through every step.';
$sp  = wp_insert_post( array( 'post_title' => 'Growing Tomatoes at Home', 'post_content' => $EN, 'post_status' => 'publish', 'post_name' => 'slug-test-tomatoes' ) );
$path = TRINV_Slugs::ensure( $sp, 'pt' );
$row  = $rowf( $sp, 'pt' );
ok( 'endereço pt gerado do título traduzido', '' !== $path && '/' . $row . '/' === $path && false === strpos( $path, 'slug-test-tomatoes' ) && (bool) preg_match( '#^/[a-z0-9-]+/$#', $path ), array( $path ) );
ok( 'gerado uma vez só (a 2ª chamada devolve o mesmo)', TRINV_Slugs::ensure( $sp, 'pt' ) === $path );
$qv = TRINV_Slugs::request( array( 'name' => $row ) );
ok( 'endereço traduzido abre o post (p + post_type)', $sp === ( $qv['p'] ?? 0 ) && 'post' === ( $qv['post_type'] ?? '' ) && TRINV_Slugs::$resolved === $sp, $qv );
TRINV_Slugs::$resolved = 0;
ok( 'nome de post de verdade não é desviado', array( 'name' => 'slug-test-tomatoes' ) === TRINV_Slugs::request( array( 'name' => 'slug-test-tomatoes' ) ) );
ok( 'endereço traduzido não é redirecionado para o original', ( function () { TRINV_Slugs::$resolved = 1; $r = TRINV_Slugs::no_canonical( 'https://x/y/' ); TRINV_Slugs::$resolved = 0; return false === $r; } )() );
$ptp = wp_insert_post( array( 'post_title' => 'Como economizar energia em casa', 'post_content' => 'Economizar energia em casa é mais fácil do que parece. Pequenas mudanças de hábito fazem uma grande diferença na conta de luz no fim do mês.', 'post_status' => 'publish' ) );
ok( 'post já no idioma do visitante: fica o endereço original', '' === TRINV_Slugs::ensure( $ptp, 'pt' ) );
$ja   = TRINV_Slugs::ensure( $sp, 'ja' );
$jrow = $rowf( $sp, 'ja' );
ok( 'japonês: endereço com caracteres japoneses (codificado como o WordPress guarda)', '' !== $ja && false !== strpos( $jrow, '%' ) && (bool) preg_match( '/[\x{3040}-\x{30ff}\x{4e00}-\x{9fff}]/u', rawurldecode( $jrow ) ), rawurldecode( $jrow ) );
$up = preg_replace_callback( '/%[0-9a-f]{2}/', function ( $m ) { return strtoupper( $m[0] ); }, $jrow );
$qv = TRINV_Slugs::request( array( 'name' => $up ) );
ok( 'japonês: abre também com %XX maiúsculo (como o navegador manda)', $sp === ( $qv['p'] ?? 0 ), $qv );
TRINV_Slugs::$resolved = 0;
$c1 = wp_insert_post( array( 'post_title' => 'Slug Collision Garden Test', 'post_content' => $EN, 'post_status' => 'publish' ) );
$c2 = wp_insert_post( array( 'post_title' => 'Slug Collision Garden Test', 'post_content' => $EN, 'post_status' => 'publish' ) );
$p1 = TRINV_Slugs::ensure( $c1, 'pt' );
$p2 = TRINV_Slugs::ensure( $c2, 'pt' );
ok( 'dois posts com o mesmo título: endereços traduzidos diferentes (-2)', '' !== $p1 && '' !== $p2 && $p1 !== $p2 && '-2/' === substr( $p2, -3 ), array( $p1, $p2 ) );
$parent = wp_insert_post( array( 'post_type' => 'page', 'post_title' => 'About our company', 'post_content' => 'We are a small company that loves gardening and good food for everyone in the world.', 'post_status' => 'publish' ) );
$child  = wp_insert_post( array( 'post_type' => 'page', 'post_parent' => $parent, 'post_title' => 'Our team members', 'post_content' => 'Meet the people who write our guides every single week for all of our readers.', 'post_status' => 'publish' ) );
$cp   = TRINV_Slugs::ensure( $child, 'pt' );
$segs = explode( '/', trim( $cp, '/' ) );
ok( 'subpágina: os dois níveis do endereço traduzidos', 2 === count( $segs ) && false === strpos( $cp, 'about-our-company' ) && false === strpos( $cp, 'our-team-members' ), $cp );
$qv = TRINV_Slugs::request( array( 'pagename' => $cp ) );
ok( 'subpágina traduzida abre a página (page_id)', $child === ( $qv['page_id'] ?? 0 ), $qv );
TRINV_Slugs::$resolved = 0;
$res = TRINV_API::slug( $sp, 'pt' );
ok( 'API /s devolve o endereço traduzido e o original', $path === $res['body']['s'] && '/slug-test-tomatoes/' === $res['body']['o'], $res['body'] );
$old_uri = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : null;
$_SERVER['REQUEST_URI'] = '/slug-test-tomatoes/?utm_source=fb';
ok( 'troca de endereço: no endereço do próprio post, sim', TRINV_Slugs::swappable( get_post( $sp ) ) );
$_SERVER['REQUEST_URI'] = '/slug-test-tomatoes/2/';
ok( 'troca de endereço: em sub-caminho (/2/, /order-received/…), não', ! TRINV_Slugs::swappable( get_post( $sp ) ) );
$_SERVER['REQUEST_URI'] = '/slug-test-tomatoes/';
set_query_var( 'cpage', 2 );
ok( 'troca de endereço: em página de comentários, não', ! TRINV_Slugs::swappable( get_post( $sp ) ) );
set_query_var( 'cpage', 0 );
if ( function_exists( 'wc_get_page_id' ) && function_exists( 'is_checkout' ) && wc_get_page_id( 'checkout' ) > 0 ) {
	global $wp_actions;
	$had_wp = isset( $wp_actions['wp'] ) ? $wp_actions['wp'] : null;
	$wp_actions['wp'] = 1; // phpcs:ignore -- numa visita a ação "wp" já rodou antes do <head>
	foreach ( array( 'cart', 'checkout', 'myaccount' ) as $wcp ) {
		$GLOBALS['wp_query']     = new WP_Query( array( 'page_id' => wc_get_page_id( $wcp ) ) ); // phpcs:ignore
		$GLOBALS['wp_the_query'] = $GLOBALS['wp_query']; // phpcs:ignore
		$GLOBALS['post']         = get_post( wc_get_page_id( $wcp ) ); // phpcs:ignore -- como numa visita (WP::register_globals)
		$ccu                     = 'Automattic\\WooCommerce\\Blocks\\Utils\\CartCheckoutUtils';
		foreach ( array( 'is_cart_page', 'is_checkout_page' ) as $prop ) { // o WooCommerce guarda o resultado por requisição
			if ( class_exists( $ccu ) && property_exists( $ccu, $prop ) ) {
				$rp = new ReflectionProperty( $ccu, $prop );
				$rp->setAccessible( true );
				$rp->setValue( null, null );
			}
		}
		$_SERVER['REQUEST_URI']  = (string) wp_parse_url( get_permalink( wc_get_page_id( $wcp ) ), PHP_URL_PATH );
		ok( "loja ($wcp): endereço da página traduzido", TRINV_Slugs::swappable( get_post( wc_get_page_id( $wcp ) ) ) );
		if ( 'cart' !== $wcp ) {
			$ep = 'checkout' === $wcp ? 'order-received' : 'orders';
			$GLOBALS['wp']->query_vars[ $ep ] = '123';
			ok( "loja ($wcp): endereço de pedido (/$ep/) continua original", ! TRINV_Slugs::swappable( get_post( wc_get_page_id( $wcp ) ) ) );
			unset( $GLOBALS['wp']->query_vars[ $ep ] );
		}
	}
	TRINV_Slugs::forget_store_pages();
	$ck_pt = rawurldecode( TRINV_Slugs::ensure( (int) wc_get_page_id( 'checkout' ), 'pt' ) );
	$sh_pt = rawurldecode( TRINV_Slugs::ensure( (int) wc_get_page_id( 'shop' ), 'pt' ) );
	$ck_de = rawurldecode( TRINV_Slugs::ensure( (int) wc_get_page_id( 'checkout' ), 'de' ) );
	ok( 'loja: endereços com contexto de loja ("/finalizar-compra/", "/loja/", nunca "/confira/" ou "/comprar/")', false !== strpos( $ck_pt, 'finalizar' ) && false !== strpos( $sh_pt, 'loja' ) && false !== strpos( $ck_de, 'kasse' ), array( $ck_pt, $sh_pt, $ck_de ) );
	$shop_id = (int) wc_get_page_id( 'shop' );
	if ( $shop_id > 0 ) {
		$qv = TRINV_Slugs::request( array( 'pagename' => trim( (string) TRINV_Slugs::ensure( $shop_id, 'pt' ), '/' ) ) );
		ok( 'loja: endereço traduzido da página "Loja" abre a lista de produtos', array( 'post_type' => 'product' ) === $qv && TRINV_Slugs::$resolved === $shop_id, $qv );
		TRINV_Slugs::$resolved = 0;
	}
	wp_reset_query();
	if ( null === $had_wp ) {
		unset( $wp_actions['wp'] );
	}
}
$_SERVER['REQUEST_URI'] = $old_uri;
update_option( 'trinv_options', array_merge( trinv_options(), array( 'urls' => 0 ) ) );
ok( 'desligada: não cria endereço novo (ensure devolve vazio)', '' === TRINV_Slugs::ensure( $c1, 'ja' ) && '' === $rowf( $c1, 'ja' ) );
$qv = TRINV_Slugs::request( array( 'name' => $row ) );
ok( 'desligada: endereço traduzido já criado continua abrindo o post (link compartilhado não quebra)', $sp === ( $qv['p'] ?? 0 ) && TRINV_Slugs::$resolved === $sp, $qv );
TRINV_Slugs::$resolved = 0;
ok( 'desligada: API /s não gera e devolve só o original', ( function () use ( $c1 ) { $r = TRINV_API::slug( $c1, 'ja' ); return '' === $r['body']['s'] && '' !== $r['body']['o']; } )() );
if ( false === $urls_saved ) { delete_option( 'trinv_options' ); } else { update_option( 'trinv_options', $urls_saved ); }
wp_delete_post( $sp, true );
ok( 'post apagado: endereços traduzidos dele somem', '' === $rowf( $sp, 'pt' ) && '' === $rowf( $sp, 'ja' ) );
foreach ( array( $ptp, $c1, $c2, $child, $parent ) as $x ) {
	wp_delete_post( $x, true );
}

// ---------------------------------------------------------------- mapas estáticos
TRINV_Store::page_merge( '/static-test/', 'pt', array( 'Hello' => 'Olá' ), 'en' );
$d = TRINV_Store::static_dir();
$f = $d[0] . '/' . TRINV_Store::static_name( '/static-test/', 'pt' );
$j = json_decode( (string) file_get_contents( $f ), true );
ok( 'mapa estático gravado (nome = sha256 do caminho)', TRINV_Store::static_ok() && 'Olá' === ( $j['m']['Hello'] ?? '' ) && 'en' === $j['sl'], $j );
ok( 'idiomas com mapa pronto (sem banco)', array( 'pt' ) === TRINV_Store::static_langs( '/static-test/' ) && array() === TRINV_Store::static_langs( '/nada/' ) );
$code = wp_remote_retrieve_response_code( wp_remote_get( str_replace( 'http:', 'https:', $d[1] ) . TRINV_Store::static_name( '/static-test/', 'pt' ) ) );
ok( 'mapa estático servido pelo servidor web (HTTP 200)', 200 === (int) $code, $code );
ok( 'request_path tira rastreio e mantém o resto', ( function () { $_SERVER['REQUEST_URI'] = '/a/b/?utm_source=x&page=2&fbclid=9&notranslate'; return '/a/b/?page=2' === TRINV_Frontend::request_path(); } )() );
TRINV_Store::clear();
$j = json_decode( (string) file_get_contents( $f ), true );
ok( 'apagar traduções esvazia o arquivo (sem 404 para páginas em cache)', file_exists( $f ) && array() === $j['m'], $j );
echo "\n" . ( $GLOBALS['total'] - $GLOBALS['fails'] ) . '/' . $GLOBALS['total'] . " passaram\n";
