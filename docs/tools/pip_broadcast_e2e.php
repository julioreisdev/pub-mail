<?php
/**
 * Push In Play — teste das telas Copys e Broadcasts (0.9.0). Roda NO SERVIDOR, dentro do WordPress:
 *   cd /var/www/<site> && sudo -u www-data wp eval-file pip_broadcast_e2e.php
 * Cria copys/broadcasts de TESTE e inscritos falsos (endpoint TESTE-… no FCM), restringe a audiência dos
 * disparos aos falsos pelo filtro `pip_blast_audience_sql` (os inscritos reais nunca recebem), exercita
 * importação (CSV ; e , / sem cabeçalho / modelo .xlsx gerado), sorteio por modo, agendador (slot do dia,
 * idempotência, tolerância, dias da semana), disparo manual, worker, histórico, métricas por copy e
 * clique. Apaga TUDO que criou por id no fim; os dados reais são conferidos antes/depois.
 *
 * phpcs:ignoreFile
 */
global $wpdb;
$T = function ( $t ) {
	return PIP_Store::table( $t );
};
$GLOBALS['pip_e2e'] = array( 'pass' => 0, 'fail' => 0 );
function ok( $cond, $msg ) {
	if ( $cond ) {
		$GLOBALS['pip_e2e']['pass']++;
		echo "  ok   $msg\n";
	} else {
		$GLOBALS['pip_e2e']['fail']++;
		echo "  FAIL $msg\n";
	}
}
function b64u( $bin ) {
	return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' );
}
echo "Push In Play " . PIP_VERSION . " — teste de Copys + Broadcasts\n";
$snap = function () use ( $wpdb, $T ) {
	return array(
		'copies'     => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('copies')} WHERE title NOT LIKE 'TESTE-E2E%'" ),
		// estado de CADA copy real (usada, contadores, última vez) — um broadcast de teste que sorteasse uma real mudaria isto
		'copy_state' => (string) $wpdb->get_var( "SELECT GROUP_CONCAT(CONCAT(id, ':', used, '/', used_count, '/', sent_count, '/', click_count, '/', IFNULL(last_used_at, '-')) ORDER BY id) FROM {$T('copies')} WHERE title NOT LIKE 'TESTE-E2E%'" ),
		'broadcasts' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('broadcasts')} WHERE name NOT LIKE 'TESTE-E2E%'" ),
		'blasts'     => (string) $wpdb->get_var( "SELECT GROUP_CONCAT(CONCAT(id, ':', total, '/', sent, '/', clicked) ORDER BY id) FROM {$T('blasts')} WHERE title NOT LIKE 'TESTE-E2E%'" ),
		'subs'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('subscribers')} WHERE endpoint NOT LIKE '%TESTE-%'" ),
		'queue'      => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('queue')} q JOIN {$T('subscribers')} s ON s.id = q.subscriber_id WHERE s.endpoint NOT LIKE '%TESTE-%'" ),
		'stats'      => (string) $wpdb->get_var( "SELECT GROUP_CONCAT(CONCAT(day, '/', kind, '/', ref_id, '=', sent, ',', failed, ',', clicked) ORDER BY day, kind, ref_id) FROM {$T('send_stats')}" ),
	);
};
$before  = $snap();
$created = array( 'copies' => array(), 'broadcasts' => array(), 'blasts' => array(), 'subs' => array() );

// audiência dos disparos = só os inscritos falsos (nunca os reais)
add_filter( 'pip_blast_audience_sql', function () {
	return "status = 'active' AND endpoint LIKE '%TESTE-%'";
} );
// sorteio de copy = só as copys de teste (0.10.1+). SEM ISTO o broadcast de teste sorteia entre TODAS as copys do
// site: em 11/10/2026 apagou uma copy real do Júlio ("🔔 Lembrete rápido", restaurada pelo binlog) e marcou
// outras duas como usadas. Se o filtro não existir (plugin antigo), o teste PARA antes de qualquer disparo.
add_filter( 'pip_copies_pick_sql', function () {
	return "title LIKE 'TESTE-E2E%'";
} );
if ( ! method_exists( 'PIP_Copies', 'pick' ) || false === strpos( file_get_contents( PIP_DIR . 'includes/class-pip-copies.php' ), 'pip_copies_pick_sql' ) ) {
	echo "ABORTADO: este plugin não tem o filtro pip_copies_pick_sql (precisa do 0.10.1+) — o teste tocaria copys reais.\n";
	return;
}

// ---------------------------------------------------------------- 0. esquema
echo "[esquema]\n";
ok( (int) get_option( 'pip_db_version' ) >= 8, 'pip_db_version >= 8' );
foreach ( array( 'copies', 'broadcasts' ) as $tb ) {
	ok( (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $T( $tb ) ) ), "tabela $tb" );
}
foreach ( array( 'kind', 'broadcast_id', 'copy_id', 'slot', 'broadcast_name' ) as $c ) {
	ok( (bool) $wpdb->get_var( "SHOW COLUMNS FROM {$T('blasts')} LIKE '{$c}'" ), "blasts.$c" );
}
ok( (bool) $wpdb->get_var( "SHOW INDEX FROM {$T('blasts')} WHERE Key_name = 'bc_slot' AND Non_unique = 0" ), 'blasts: chave única (broadcast_id, slot)' );

// ---------------------------------------------------------------- 1. copys: cadastro + sanitização
echo "[copys]\n";
$c1 = PIP_Copies::save( array( 'title' => 'TESTE-E2E copy 1 🚀', 'body' => 'texto 1', 'icon_emoji' => '🚀', 'url' => 'https://exemplo.com/1' ) );
$c2 = PIP_Copies::save( array( 'title' => 'TESTE-E2E copy 2', 'body' => 'texto 2', 'icon_url' => 'https://exemplo.com/i.png' ) );
$c3 = PIP_Copies::save( array( 'title' => 'TESTE-E2E copy 3', 'body' => '', 'url' => 'javascript:alert(1)' ) );
$created['copies'] = array( $c1, $c2, $c3 );
$g1 = PIP_Copies::get( $c1 );
$g2 = PIP_Copies::get( $c2 );
$g3 = PIP_Copies::get( $c3 );
ok( $g1 && 'emoji' === $g1['icon_mode'] && '🚀' === $g1['icon_emoji'], 'copy com emoji → icon_mode emoji' );
ok( $g2 && 'image' === $g2['icon_mode'] && 'https://exemplo.com/i.png' === $g2['icon_url'], 'copy com imagem → icon_mode image' );
ok( $g3 && '' === $g3['url'], 'url javascript: descartada' );
$step = PIP_Copies::as_step( $g3 );
ok( home_url( '/' ) === $step['url'] && 'TESTE-E2E copy 3' === $step['title'], 'as_step(): sem link → página inicial' );
$cn = PIP_Copies::counts();
ok( $cn['total'] >= 3 && $cn['available'] >= 3, 'counts()' );
$q = PIP_Copies::query( array( 'q' => 'TESTE-E2E copy 2' ) );
ok( 1 === $q['total'] && $q['items'][0]['id'] === $c2, 'query(): busca por título' );
PIP_Copies::set_used( array( $c2 ), true );
$q = PIP_Copies::query( array( 'filter' => 'used', 'q' => 'TESTE-E2E' ) );
ok( 1 === $q['total'] && $q['items'][0]['id'] === $c2, 'filtro usadas' );
$q = PIP_Copies::query( array( 'filter' => 'available', 'q' => 'TESTE-E2E' ) );
ok( 2 === $q['total'], 'filtro disponíveis' );
PIP_Copies::set_used( array( $c2 ), false );
$dup = PIP_Copies::duplicate( $c1 );
$created['copies'][] = $dup;
ok( $dup && false !== strpos( PIP_Copies::get( $dup )['title'], '(cópia)' ), 'duplicate()' );
PIP_Copies::delete( array( $dup ) );
ok( ! PIP_Copies::get( $dup ), 'delete()' );

// ---------------------------------------------------------------- 2. importação
echo "[importação]\n";
$csv  = "titulo;texto;emoji;imagem_icone;imagem_grande;link\n\"TESTE-E2E imp 1\";\"Olá; com ponto e vírgula\";🔥;;;https://exemplo.com/a\n\"TESTE-E2E imp 2\";texto 2;;https://exemplo.com/icon.png;https://exemplo.com/big.jpg;\n;sem titulo;;;;\n\"TESTE-E2E imp 1\";\"Olá; com ponto e vírgula\";🔥;;;https://exemplo.com/a\n";
$rows = PIP_Copies::parse_csv( "\xEF\xBB\xBF" . $csv );
ok( 5 === count( $rows ) && 6 === count( $rows[0] ), 'parse_csv(): BOM + ";" (' . count( $rows ) . ' linhas)' );
$r = PIP_Copies::import( $rows, true );
ok( 2 === $r['imported'] && 2 === $r['skipped'], 'import(): 2 importadas, 1 sem título + 1 duplicada puladas' );
$imp_ids = array_map( 'intval', $wpdb->get_col( "SELECT id FROM {$T('copies')} WHERE title LIKE 'TESTE-E2E imp%'" ) );
$created['copies'] = array_merge( $created['copies'], $imp_ids );
$i1 = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$T('copies')} WHERE title = %s", 'TESTE-E2E imp 1' ), ARRAY_A );
ok( $i1 && 'Olá; com ponto e vírgula' === $i1['body'] && 'emoji' === $i1['icon_mode'] && '🔥' === $i1['icon_emoji'] && 'import' === $i1['source'], 'linha importada com ; dentro das aspas e emoji' );
$i2 = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$T('copies')} WHERE title = %s", 'TESTE-E2E imp 2' ), ARRAY_A );
ok( $i2 && 'image' === $i2['icon_mode'] && 'https://exemplo.com/big.jpg' === $i2['image_url'], 'linha importada com ícone e imagem grande' );
$r = PIP_Copies::import( PIP_Copies::parse_csv( "Título,Mensagem,Link\nTESTE-E2E imp 3,com virgula,https://exemplo.com/3\n" ), true );
ok( 1 === $r['imported'], 'parse_csv(): "," + cabeçalhos com sinônimos/acentos (Título, Mensagem, Link)' );
$r = PIP_Copies::import( PIP_Copies::parse_csv( "TESTE-E2E imp 4\tposicional\t🎉\n" ), true );
$i4 = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$T('copies')} WHERE title = %s", 'TESTE-E2E imp 4' ), ARRAY_A );
ok( 1 === $r['imported'] && $i4 && 'posicional' === $i4['body'] && '🎉' === $i4['icon_emoji'], 'parse_csv(): tab + sem cabeçalho = ordem do modelo' );
$created['copies'] = array_merge( $created['copies'], array_map( 'intval', $wpdb->get_col( "SELECT id FROM {$T('copies')} WHERE title IN ('TESTE-E2E imp 3', 'TESTE-E2E imp 4')" ) ) );
$r = PIP_Copies::import( $rows, true );
ok( 0 === $r['imported'] && 4 === $r['skipped'], 'importar a mesma planilha de novo: tudo pulado (3 duplicadas + 1 sem título)' );
$r = PIP_Copies::import( array(), true );
ok( 0 === $r['imported'] && $r['errors'], 'planilha vazia → erro amigável' );
// modelo .xlsx gerado → lido de volta
$xlsx = PIP_Copies::template_xlsx();
ok( $xlsx && "PK\x03\x04" === substr( $xlsx, 0, 4 ), 'template_xlsx() gera um zip' );
$tmp = wp_tempnam( 'modelo.xlsx' );
file_put_contents( $tmp, $xlsx );
$rows = PIP_Copies::parse_file( $tmp, 'modelo.xlsx' );
wp_delete_file( $tmp );
ok( is_array( $rows ) && 3 === count( $rows ) && 'titulo' === $rows[0][0] && 'Novidade no ar 🚀' === $rows[1][0] && 6 === count( $rows[1] ), 'parse_xlsx(): lê o modelo gerado (cabeçalho + 2 exemplos, emoji ok)' );
$hm = PIP_Copies::map_headers( $rows[0] );
ok( $hm['has_header'] && 'title' === $hm['map'][0] && 'url' === $hm['map'][5], 'map_headers() do modelo' );
$tcsv = PIP_Copies::template_csv();
ok( 0 === strpos( $tcsv, "\xEF\xBB\xBF" ) && 3 === count( PIP_Copies::parse_csv( $tcsv ) ), 'template_csv(): BOM + 3 linhas' );
$bad = PIP_Copies::parse_file( $tmp . '.nada', 'arquivo.pdf' );
ok( is_wp_error( $bad ), 'formato desconhecido → WP_Error' );

// ---------------------------------------------------------------- 3. sorteio por modo
echo "[sorteio]\n";
$ids_all = $created['copies'];
PIP_Copies::set_used( $ids_all, true );
PIP_Copies::set_used( array( $c1 ), false );
$p = PIP_Copies::pick( 'mark_used' );
ok( $p && $p['id'] === $c1, 'mark_used: sorteia só entre as disponíveis' );
PIP_Copies::set_used( $ids_all, false );
$wpdb->update( $T( 'copies' ), array( 'last_used_at' => current_time( 'mysql' ) ), array( 'id' => $c1 ) );
$hit = 0;
for ( $i = 0; $i < 12; $i++ ) {
	$p = PIP_Copies::pick( 'keep' );
	if ( $p && $p['id'] === $c1 ) {
		$hit++;
	}
}
ok( 0 === $hit, 'keep: nunca repete a última usada (12 sorteios)' );
$wpdb->update( $T( 'copies' ), array( 'last_used_at' => null ), array( 'id' => $c1 ) );

// ---------------------------------------------------------------- 4. inscritos falsos
echo "[inscritos falsos]\n";
$now  = current_time( 'mysql' );
$vals = array();
for ( $i = 0; $i < 5; $i++ ) {
	$k   = openssl_pkey_new( array( 'curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC ) );
	$d   = openssl_pkey_get_details( $k );
	$pub = b64u( "\x04" . str_pad( $d['ec']['x'], 32, "\0", STR_PAD_LEFT ) . str_pad( $d['ec']['y'], 32, "\0", STR_PAD_LEFT ) );
	$ep  = 'https://fcm.googleapis.com/fcm/send/TESTE-bc' . bin2hex( random_bytes( 10 ) ) . '-' . $i;
	$vals[] = $wpdb->prepare( "(%s, %s, %s, %s, NULL, 'linux', 'chrome', 'TESTE', 'TESTE', 'active', %s, %s)", sha1( $ep ), $ep, $pub, b64u( random_bytes( 16 ) ), $now, $now );
}
$wpdb->query( "INSERT INTO {$T('subscribers')} (endpoint_hash, endpoint, p256dh, auth, layout_id, platform, browser, user_agent, page_url, status, created_at, last_seen_at) VALUES " . implode( ',', $vals ) );
$created['subs'] = array_map( 'intval', $wpdb->get_col( "SELECT id FROM {$T('subscribers')} WHERE endpoint LIKE '%TESTE-bc%'" ) );
ok( 5 === count( $created['subs'] ), '5 inscritos falsos' );
delete_transient( 'pip_subs_count_all' );

// ---------------------------------------------------------------- 5. broadcasts: cadastro
echo "[broadcasts]\n";
$nowtz = PIP_Broadcasts::now();
$mod   = (int) $nowtz->format( 'G' ) * 60 + (int) $nowtz->format( 'i' );
$dow   = (int) $nowtz->format( 'w' );
$b1    = PIP_Broadcasts::save( array( 'name' => 'TESTE-E2E agora', 'active' => 1, 'times' => array( PIP_Broadcasts::hhmm( $mod ), '25:99', 'xx', PIP_Broadcasts::hhmm( $mod ) ), 'after_send' => 'mark_used', 'grace_minutes' => 120 ) );
$created['broadcasts'][] = $b1;
$gb = PIP_Broadcasts::get( $b1 );
ok( $gb && array( $mod ) === $gb['times'] && array() === $gb['days'] && 'mark_used' === $gb['after_send'], 'save(): horários inválidos/duplicados fora, dias = todos' );
ok( 720 === PIP_Broadcasts::parse_time( '12:00' ) && 750 === PIP_Broadcasts::parse_time( '12:30' ) && null === PIP_Broadcasts::parse_time( '24:00' ), 'parse_time()' );
$b_days = PIP_Broadcasts::save( array( 'name' => 'TESTE-E2E outro dia', 'active' => 1, 'times' => array( PIP_Broadcasts::hhmm( $mod ) ), 'days' => array( ( $dow + 1 ) % 7 ), 'after_send' => 'keep' ) );
$created['broadcasts'][] = $b_days;
$b_old = PIP_Broadcasts::save( array( 'name' => 'TESTE-E2E fora da tolerância', 'active' => 1, 'times' => array( ( $mod + 1440 - 200 ) % 1440 ), 'after_send' => 'keep', 'grace_minutes' => 60 ) );
$created['broadcasts'][] = $b_old;
$b_off = PIP_Broadcasts::save( array( 'name' => 'TESTE-E2E desligado', 'active' => 0, 'times' => array( PIP_Broadcasts::hhmm( $mod ) ), 'after_send' => 'keep' ) );
$created['broadcasts'][] = $b_off;
$st = PIP_Broadcasts::today_status( array( PIP_Broadcasts::get( $b1 ), PIP_Broadcasts::get( $b_days ), PIP_Broadcasts::get( $b_off ) ) );
ok( 'due' === $st[ $b1 ][ $mod ] && 'off' === $st[ $b_days ][ $mod ] && 'off' === $st[ $b_off ][ $mod ], 'today_status(): due / outro dia / desligado' );
$nf = PIP_Broadcasts::next_fire( PIP_Broadcasts::get( $b1 ) );
ok( $nf > time() && $nf - time() < 25 * 3600, 'next_fire(): amanhã no mesmo horário' );

// ---------------------------------------------------------------- 6. agendador
echo "[agendador]\n";
delete_transient( 'pip_bc_tick' );
delete_transient( 'pip_worker_lock' );
$avail_before = PIP_Copies::available_count( 'mark_used' );
$fired        = PIP_Broadcasts::dispatch();
ok( 1 === $fired, 'dispatch(): 1 disparo (só o broadcast do horário atual, dia certo, dentro da tolerância)' );
$slot = $nowtz->format( 'Y-m-d' ) . ' ' . PIP_Broadcasts::hhmm( $mod );
$bl   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$T('blasts')} WHERE broadcast_id = %d AND slot = %s", $b1, $slot ), ARRAY_A );
ok( $bl && 'broadcast' === $bl['kind'] && (int) $bl['copy_id'] > 0 && 5 === (int) $bl['total'] && 'TESTE-E2E agora' === $bl['broadcast_name'], 'disparo criado no slot com copy sorteada e 5 aparelhos (só os falsos)' );
if ( $bl ) {
	$created['blasts'][] = (int) $bl['id'];
}
$used_copy = $bl ? PIP_Copies::get( (int) $bl['copy_id'] ) : null;
ok( $used_copy && $used_copy['used'] && 1 === $used_copy['used_count'] && $used_copy['last_used_at'], 'copy sorteada marcada como usada (used_count 1)' );
ok( PIP_Copies::available_count( 'mark_used' ) === $avail_before - 1, 'disponíveis caiu em 1' );
delete_transient( 'pip_bc_tick' );
ok( 0 === PIP_Broadcasts::dispatch(), 'dispatch() de novo: nada (slot já disparado)' );
ok( PIP_Broadcasts::slot_done( $b1, $slot ) && ! PIP_Broadcasts::slot_done( $b_days, $slot ), 'slot_done()' );
ok( '' === (string) PIP_Broadcasts::get( $b1 )['last_error'] && PIP_Broadcasts::get( $b1 )['last_fired_at'], 'last_fired_at gravado, sem erro' );
$st = PIP_Broadcasts::today_status( array( PIP_Broadcasts::get( $b1 ) ) );
ok( in_array( $st[ $b1 ][ $mod ], array( 'sending', 'sent', 'failed', 'partial' ), true ), 'today_status() do slot disparado: ' . $st[ $b1 ][ $mod ] );
// worker entrega (FCM recusa os falsos → falhas). O dispatch já acordou um worker em segundo plano
// (loopback); aqui só esperamos ele terminar — ou rodamos nós mesmos se a trava estiver livre.
for ( $i = 0; $i < 40; $i++ ) {
	PIP_Flow::run_worker( 'test', 30 );
	wp_cache_flush();
	$bl = PIP_Flow::blast_row( (int) $bl['id'] );
	if ( 'done' === $bl['status'] ) {
		break;
	}
	usleep( 500000 );
}
echo "  (disparo concluído em " . ( $i * 0.5 ) . " s)\n";
ok( 'done' === $bl['status'] && 5 === (int) $bl['failed'] && 0 === (int) $bl['sent'], 'worker: disparo concluído (5 falhas = FCM recusou endpoint falso)' );
$st = PIP_Broadcasts::today_status( array( PIP_Broadcasts::get( $b1 ) ) );
ok( 'failed' === $st[ $b1 ][ $mod ], 'today_status() depois do worker: failed' );
// modo apagar
$b_del = PIP_Broadcasts::save( array( 'name' => 'TESTE-E2E apagar', 'active' => 1, 'times' => array( PIP_Broadcasts::hhmm( $mod ) ), 'after_send' => 'delete' ) );
$created['broadcasts'][] = $b_del;
$before_cnt = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('copies')} WHERE title LIKE 'TESTE-E2E%'" );
$bid_del    = PIP_Broadcasts::fire( PIP_Broadcasts::get( $b_del ), 'm-teste' . substr( uniqid(), -8 ), false );
if ( $bid_del ) {
	$created['blasts'][] = $bid_del;
}
$row_del = $bid_del ? PIP_Flow::blast_row( $bid_del ) : null;
ok( $bid_del && $row_del && (int) $row_del['copy_id'] > 0 && ! PIP_Copies::get( (int) $row_del['copy_id'] ), 'modo apagar: copy sorteada apagada da biblioteca' );
ok( $row_del && '' !== $row_del['title'], 'o disparo guarda uma cópia do conteúdo (histórico sobrevive)' );
ok( (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('copies')} WHERE title LIKE 'TESTE-E2E%'" ) === $before_cnt - 1, 'uma copy a menos' );
// sem copy disponível → erro amigável, sem disparo
$b_none = PIP_Broadcasts::save( array( 'name' => 'TESTE-E2E sem copy', 'active' => 1, 'times' => array( PIP_Broadcasts::hhmm( $mod ) ), 'after_send' => 'mark_used' ) );
$created['broadcasts'][] = $b_none;
$ids_now = array_map( 'intval', $wpdb->get_col( "SELECT id FROM {$T('copies')} WHERE title LIKE 'TESTE-E2E%'" ) );
PIP_Copies::set_used( $ids_now, true ); // só as de teste (o sorteio está filtrado a elas)
ok( 0 === PIP_Broadcasts::fire( PIP_Broadcasts::get( $b_none ), 'm-none', false ), 'sem copy disponível: fire() não cria disparo' );
ok( false !== strpos( (string) PIP_Broadcasts::get( $b_none )['last_error'], 'usadas' ), 'last_error explica (todas usadas)' );
PIP_Copies::set_used( $ids_now, false );

// ---------------------------------------------------------------- 7. histórico, métricas por copy, clique
echo "[histórico]\n";
$h = PIP_Broadcasts::history( array( 'broadcast_id' => $b1, 'days' => 1 ) );
ok( 1 === count( $h ) && (int) $h[0]['id'] === (int) $bl['id'], 'history() por broadcast' );
$h = PIP_Broadcasts::history( array( 'copy_id' => (int) $bl['copy_id'] ) );
ok( 1 === count( $h ), 'history() por copy' );
$send_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$T('sends')} WHERE blast_id = %d ORDER BY id LIMIT 1", (int) $bl['id'] ) );
PIP_Flow::clicked( $send_id, PIP_Flow::click_key( $send_id ) );
PIP_Flow::clicked( $send_id, PIP_Flow::click_key( $send_id ) );
$cm = array_filter( PIP_Broadcasts::copy_metrics( 1 ), function ( $m ) use ( $bl ) {
	return (int) $m['copy_id'] === (int) $bl['copy_id'];
} );
$cm = array_values( $cm );
ok( $cm && 1 === (int) $cm[0]['runs'] && 5 === (int) $cm[0]['total'] && 1 === (int) $cm[0]['clicked'], 'copy_metrics(): 1 disparo, 5 aparelhos, 1 clique (2º clique não dobra)' );
$cc = PIP_Copies::get( (int) $bl['copy_id'] );
ok( $cc && 1 === $cc['click_count'] && 0 === $cc['sent_count'], 'copy: click_count 1, sent_count 0 (tudo falhou no FCM)' );
$cm_del = array_values( array_filter( PIP_Broadcasts::copy_metrics( 1 ), function ( $m ) use ( $row_del ) {
	return $row_del && (int) $m['copy_id'] === (int) $row_del['copy_id'];
} ) );
ok( $cm_del && empty( $cm_del[0]['still'] ) && $cm_del[0]['title'] === $row_del['title'], 'copy apagada continua no desempenho (título do disparo, estado "apagada")' );
// teste no aparelho por copy (REST admin/test com copy_id) — só a montagem do passo
$step = PIP_Copies::as_step( PIP_Copies::get( $c1 ) );
$pl   = PIP_Flow::payload( $step, 1 );
ok( 'TESTE-E2E copy 1 🚀' === $pl['title'] && false !== strpos( $pl['icon'], 'twemoji' ) && 'https://exemplo.com/1' === $pl['url'], 'payload() de uma copy (emoji → Twemoji)' );

// ---------------------------------------------------------------- limpeza (só por id do que o teste criou)
echo "[limpeza]\n";
remove_all_filters( 'pip_blast_audience_sql' );
remove_all_filters( 'pip_copies_pick_sql' );
$bl_ids = array_filter( array_map( 'intval', $created['blasts'] ) );
if ( $bl_ids ) {
	$in = implode( ',', $bl_ids );
	$wpdb->query( "DELETE FROM {$T('queue')} WHERE blast_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('sends')} WHERE blast_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('send_stats')} WHERE kind = 'broadcast' AND ref_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('blasts')} WHERE id IN ($in)" );
}
if ( $created['subs'] ) {
	$in = implode( ',', array_map( 'intval', $created['subs'] ) );
	$wpdb->query( "DELETE FROM {$T('queue')} WHERE subscriber_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('sends')} WHERE subscriber_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('subscribers')} WHERE id IN ($in)" );
}
if ( $created['copies'] ) {
	$wpdb->query( "DELETE FROM {$T('copies')} WHERE id IN (" . implode( ',', array_map( 'intval', $created['copies'] ) ) . ')' );
}
if ( $created['broadcasts'] ) {
	$wpdb->query( "DELETE FROM {$T('broadcasts')} WHERE id IN (" . implode( ',', array_map( 'intval', $created['broadcasts'] ) ) . ')' );
}
foreach ( array( 'pip_subs_count_all', 'pip_subs_count_linux', 'pip_bc_tick', 'pip_kick', 'pip_idle', 'pip_worker_lock' ) as $tr ) {
	delete_transient( $tr );
}
$after = $snap();
ok( $after === $before, 'dados reais intocados' . ( $after === $before ? '' : "\n       antes: " . wp_json_encode( $before ) . "\n       depois: " . wp_json_encode( $after ) ) );
ok( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('copies')} WHERE title LIKE 'TESTE-E2E%'" ) && 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('broadcasts')} WHERE name LIKE 'TESTE-E2E%'" ), 'copys e broadcasts de teste removidos' );
echo "\nRESULTADO: {$GLOBALS['pip_e2e']['pass']} ok, {$GLOBALS['pip_e2e']['fail']} falhas\n";
exit( $GLOBALS['pip_e2e']['fail'] ? 1 : 0 );
