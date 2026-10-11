<?php
/**
 * Push In Play — teste de escala/robustez do envio (0.8.0). Roda NO SERVIDOR, dentro do WordPress:
 *   cd /var/www/<site> && sudo -u www-data wp eval-file pip_scale_e2e.php [N]
 * Cria N inscritos FALSOS (endpoint https://fcm.googleapis.com/fcm/send/TESTE-…, chaves P-256 válidas),
 * um "Enviar agora" de teste só para eles (nunca para os inscritos reais), roda o worker paralelo contra
 * o FCM real (que responde 404/410 → expirado), confere fila/envios/agregados/contadores, reivindicação
 * disjunta, clique, diagnóstico desligado por padrão, poda, loopback do worker e a rota REST.
 * Apaga tudo que criou no fim. Os dados reais do site não são tocados (contagens conferidas).
 *
 * phpcs:ignoreFile
 */
global $wpdb;
$N = isset( $args[0] ) ? max( 20, (int) $args[0] ) : 300;
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
echo "Push In Play " . PIP_VERSION . " — teste de escala com N=$N\n";

// ---------------------------------------------------------------- 0. esquema v7
$col = function ( $table, $c ) use ( $wpdb ) {
	return (bool) $wpdb->get_var( "SHOW COLUMNS FROM {$table} LIKE '{$c}'" );
};
$idx = function ( $table, $k ) use ( $wpdb ) {
	return (bool) $wpdb->get_var( "SHOW INDEX FROM {$table} WHERE Key_name = '{$k}'" );
};
echo "[esquema]\n";
ok( (int) get_option( 'pip_db_version' ) >= 7, 'pip_db_version >= 7' );
ok( $col( $T( 'queue' ), 'claim' ) && $idx( $T( 'queue' ), 'claim' ) && $idx( $T( 'queue' ), 'blast_status' ), 'fila: claim + índices' );
ok( $col( $T( 'sends' ), 'queue_id' ) && $idx( $T( 'sends' ), 'queue' ), 'envios: queue_id + índice' );
ok( $col( $T( 'blasts' ), 'clicked' ), 'enviar agora: clicked' );
ok( $idx( $T( 'subscribers' ), 'status_platform' ), 'inscritos: índice status_platform' );
ok( (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $T( 'send_stats' ) ) ), 'tabela send_stats' );
$auto = $wpdb->get_var( "SELECT autoload FROM {$wpdb->options} WHERE option_name = 'pip_vapid'" );
ok( in_array( $auto, array( 'yes', 'on', 'auto-on' ), true ), "pip_vapid autoload ($auto)" );

// ---------------------------------------------------------------- 1. unidades
echo "[unidades]\n";
$c = PIP_Push::classify( 201 );
ok( $c['ok'] && ! $c['retry'], 'classify 201 = ok' );
$c = PIP_Push::classify( 410, 'gone' );
ok( ! $c['ok'] && $c['gone'] && ! $c['retry'], 'classify 410 = sumiu' );
$c = PIP_Push::classify( 404 );
ok( $c['gone'], 'classify 404 = sumiu' );
$c = PIP_Push::classify( 429, '', '7' );
ok( ! $c['ok'] && ! $c['gone'] && $c['retry'] && 7 === $c['retry_after'], 'classify 429 = tenta de novo (Retry-After 7)' );
$c = PIP_Push::classify( 503 );
ok( $c['retry'], 'classify 503 = tenta de novo' );
$c = PIP_Push::classify( 0 );
ok( $c['retry'], 'classify rede = tenta de novo' );
$c = PIP_Push::classify( 400, 'bad' );
ok( ! $c['retry'] && ! $c['gone'], 'classify 400 = falha definitiva' );
$c = PIP_Push::classify( 413 );
ok( ! $c['retry'], 'classify 413 = falha definitiva' );
ok( PIP_Push::endpoint_ok( 'https://fcm.googleapis.com/fcm/send/abc' ), 'endpoint FCM aceito' );
ok( ! PIP_Push::endpoint_ok( 'http://fcm.googleapis.com/fcm/send/abc' ), 'endpoint http recusado' );
ok( ! PIP_Push::endpoint_ok( 'https://10.0.0.5/push' ), 'endpoint IP privado recusado' );
ok( ! PIP_Push::endpoint_ok( 'https://127.0.0.1/push' ), 'endpoint loopback recusado' );
ok( ! PIP_Push::endpoint_ok( 'https://localhost/push' ), 'endpoint localhost recusado' );
ok( ! PIP_Push::endpoint_ok( 'https://fcm.googleapis.com:8443/x' ), 'endpoint porta estranha recusado' );
ok( ! PIP_Push::endpoint_ok( 'https://' . str_repeat( 'a', 1100 ) ), 'endpoint longo recusado' );
ok( PIP_Push::parallel_supported(), 'envio paralelo disponível (curl_multi + Requests)' );
ok( PIP_Flow::worker_token_ok( PIP_Flow::worker_token() ) && ! PIP_Flow::worker_token_ok( 'x' ), 'token do worker' );

// ---------------------------------------------------------------- 2. retrato dos dados reais
$snap = function () use ( $wpdb, $T ) {
	return array(
		'subs_active' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('subscribers')} WHERE status = 'active' AND endpoint NOT LIKE '%TESTE-%'" ),
		'subs_all'    => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('subscribers')} WHERE endpoint NOT LIKE '%TESTE-%'" ),
		'queue'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('queue')} q JOIN {$T('subscribers')} s ON s.id = q.subscriber_id WHERE s.endpoint NOT LIKE '%TESTE-%'" ),
		'sends'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('sends')} x JOIN {$T('subscribers')} s ON s.id = x.subscriber_id WHERE s.endpoint NOT LIKE '%TESTE-%'" ),
		'blasts'      => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('blasts')}" ),
		'steps'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('flow_steps')}" ),
		'stats_real'  => (string) $wpdb->get_var( "SELECT GROUP_CONCAT(CONCAT(day, '/', kind, '/', ref_id, '=', sent, ',', failed, ',', clicked) ORDER BY day, kind, ref_id) FROM {$T('send_stats')}" ),
	);
};
$before = $snap();

// ---------------------------------------------------------------- 3. inscritos falsos
echo "[inscritos falsos]\n";
$t0   = microtime( true );
$vals = array();
$now  = current_time( 'mysql' );
for ( $i = 0; $i < $N; $i++ ) {
	$k   = openssl_pkey_new( array( 'curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC ) );
	$d   = openssl_pkey_get_details( $k );
	$pub = b64u( "\x04" . str_pad( $d['ec']['x'], 32, "\0", STR_PAD_LEFT ) . str_pad( $d['ec']['y'], 32, "\0", STR_PAD_LEFT ) );
	$ep  = 'https://fcm.googleapis.com/fcm/send/TESTE-' . bin2hex( random_bytes( 12 ) ) . '-' . $i;
	$vals[] = $wpdb->prepare( "(%s, %s, %s, %s, NULL, 'linux', 'chrome', 'TESTE', 'TESTE', 'active', %s, %s)", sha1( $ep ), $ep, $pub, b64u( random_bytes( 16 ) ), $now, $now );
}
$wpdb->query( "INSERT INTO {$T('subscribers')} (endpoint_hash, endpoint, p256dh, auth, layout_id, platform, browser, user_agent, page_url, status, created_at, last_seen_at) VALUES " . implode( ',', $vals ) );
$fake = array_map( 'intval', $wpdb->get_col( "SELECT id FROM {$T('subscribers')} WHERE endpoint LIKE '%TESTE-%'" ) );
ok( count( $fake ) === $N, "$N inscritos falsos criados (" . round( microtime( true ) - $t0, 2 ) . ' s)' );

// ---------------------------------------------------------------- 4. "Enviar agora" só para os falsos
echo "[enviar agora de teste]\n";
$wpdb->insert( $T( 'blasts' ), array( 'title' => 'TESTE escala (apagado no fim do teste)', 'body' => 'teste', 'icon_mode' => 'site', 'url' => home_url( '/' ), 'status' => 'sending', 'created_at' => $now, 'total' => $N ) );
$bid  = (int) $wpdb->insert_id;
$created_blasts = array( $bid );
$vals = array();
foreach ( $fake as $sid ) {
	$vals[] = $wpdb->prepare( "(%d, 0, %d, %s, 'pending', 0)", $sid, $bid, gmdate( 'Y-m-d H:i:s' ) );
}
$wpdb->query( "INSERT INTO {$T('queue')} (subscriber_id, step_id, blast_id, send_at, status, attempts) VALUES " . implode( ',', $vals ) );
ok( (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$T('queue')} WHERE blast_id = %d AND status = 'pending'", $bid ) ) === $N, "$N linhas na fila" );

// reivindicação disjunta (duas chamadas não pegam a mesma linha)
$claim = new ReflectionMethod( 'PIP_Flow', 'claim' );
$claim->setAccessible( true );
$a   = $claim->invoke( null, 7 );
$b   = $claim->invoke( null, 7 );
$ida = array_map( function ( $r ) { return (int) $r['qid']; }, $a );
$idb = array_map( function ( $r ) { return (int) $r['qid']; }, $b );
ok( 7 === count( $ida ) && 7 === count( $idb ) && ! array_intersect( $ida, $idb ), 'claim(): dois lotes disjuntos' );
$wpdb->query( "UPDATE {$T('queue')} SET status = 'pending', claim = NULL WHERE id IN (" . implode( ',', array_merge( $ida, $idb ) ) . ')' );

// worker paralelo contra o FCM real
delete_transient( 'pip_worker_lock' );
delete_transient( 'pip_idle' );
$t0   = microtime( true );
$rows = PIP_Flow::run_worker( 'test', 120 );
$dt   = microtime( true ) - $t0;
$st   = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(status='sent') s, SUM(status='failed') f, SUM(status IN ('pending','sending')) p, SUM(claim IS NOT NULL) c FROM {$T('queue')} WHERE blast_id = %d", $bid ) );
echo "  worker: $rows linhas em " . round( $dt, 2 ) . " s (" . round( $rows / max( 0.001, $dt ) ) . "/s)\n";
ok( $rows === $N, "worker tratou as $N linhas numa rodada" );
ok( 0 === (int) $st->p && 0 === (int) $st->c, 'fila: nada pendente/sending, sem claim sobrando' );
ok( (int) $st->f === $N, "fila: $N falhas definitivas (FCM recusa endpoint falso)" );
$codes = $wpdb->get_results( $wpdb->prepare( "SELECT code, COUNT(*) n FROM {$T('sends')} WHERE blast_id = %d GROUP BY code", $bid ), ARRAY_A );
echo '  códigos do FCM: ' . wp_json_encode( $codes ) . "\n";
$gone = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$T('sends')} WHERE blast_id = %d AND code IN (404, 410)", $bid ) );
ok( $gone === $N, "envios: $N respostas 404/410 (chegou no FCM em paralelo)" );
ok( (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$T('sends')} WHERE blast_id = %d AND queue_id IS NOT NULL AND kind = 'broadcast' AND step_id IS NULL", $bid ) ) === $N, 'envios: queue_id gravado, kind broadcast, step_id NULL' );
ok( (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('subscribers')} WHERE endpoint LIKE '%TESTE-%' AND status = 'expired'" ) === $N, 'inscritos falsos marcados expirados' );
$bl = PIP_Flow::blast_row( $bid );
ok( 'done' === $bl['status'] && (int) $bl['failed'] === $N && 0 === (int) $bl['sent'], 'enviar agora: done, failed=N' );
$ss = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(sent) s, SUM(failed) f FROM {$T('send_stats')} WHERE kind = 'broadcast' AND ref_id = %d", $bid ) );
ok( (int) $ss->f === $N && 0 === (int) $ss->s, 'agregados: failed=N para o envio' );
$wl = get_option( 'pip_worker_last' );
ok( is_array( $wl ) && 'test' === $wl['source'] && (int) $wl['rows'] === $N, 'pip_worker_last registrado' );
ok( $dt < max( 10, $N / 20 ), 'paralelismo: rodada rápida (' . round( $dt, 1 ) . ' s para ' . $N . ', ≥ 20/s)' );

// ---------------------------------------------------------------- 5. clique
echo "[clique]\n";
$sid = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$T('sends')} WHERE blast_id = %d ORDER BY id ASC LIMIT 1", $bid ) );
ok( ! PIP_Flow::clicked( $sid, 'chave-errada' ), 'clique com chave errada recusado' );
ok( PIP_Flow::clicked( $sid, PIP_Flow::click_key( $sid ) ), 'clique com chave certa aceito' );
PIP_Flow::clicked( $sid, PIP_Flow::click_key( $sid ) );
ok( 1 === (int) $wpdb->get_var( $wpdb->prepare( "SELECT clicked FROM {$T('blasts')} WHERE id = %d", $bid ) ), 'enviar agora: clicked=1 (2º clique não dobra)' );
ok( 1 === (int) $wpdb->get_var( $wpdb->prepare( "SELECT SUM(clicked) FROM {$T('send_stats')} WHERE kind = 'broadcast' AND ref_id = %d", $bid ) ), 'agregados: clicked=1' );

// ---------------------------------------------------------------- 6. passo do fluxo + inscrição nova (process_subscriber)
echo "[fluxo]\n";
$step_id = PIP_Flow::save_step( array( 'delay_value' => 0, 'delay_unit' => 'minutes', 'enabled' => 1, 'title' => 'TESTE passo (apagado no fim do teste)', 'body' => 'x', 'icon_mode' => 'site' ) );
$k   = openssl_pkey_new( array( 'curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC ) );
$d   = openssl_pkey_get_details( $k );
$pub = b64u( "\x04" . str_pad( $d['ec']['x'], 32, "\0", STR_PAD_LEFT ) . str_pad( $d['ec']['y'], 32, "\0", STR_PAD_LEFT ) );
$ep  = 'https://fcm.googleapis.com/fcm/send/TESTE-flow-' . bin2hex( random_bytes( 8 ) );
$new = PIP_Store::upsert_subscriber( array( 'endpoint' => $ep, 'p256dh' => $pub, 'auth' => b64u( random_bytes( 16 ) ) ), 0, array( 'platform' => 'linux', 'browser' => 'chrome', 'user_agent' => 'TESTE', 'page_url' => 'TESTE' ) );
$fid = PIP_Store::$last_subscriber_id;
ok( $new && $fid, 'inscrito novo criado' );
// só o passo TESTE entra na fila (enqueue() pegaria também os passos reais do site e sujaria as métricas deles)
$wpdb->insert( $T( 'queue' ), array( 'subscriber_id' => $fid, 'step_id' => $step_id, 'blast_id' => 0, 'send_at' => gmdate( 'Y-m-d H:i:s' ), 'status' => 'pending', 'attempts' => 0 ) );
$nq = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$T('queue')} WHERE subscriber_id = %d AND step_id = %d AND status = 'pending'", $fid, $step_id ) );
ok( 1 === $nq, 'passo TESTE na fila do inscrito' );
PIP_Flow::process_subscriber( $fid );
$q1 = $wpdb->get_row( $wpdb->prepare( "SELECT status, last_error FROM {$T('queue')} WHERE subscriber_id = %d AND step_id = %d", $fid, $step_id ), ARRAY_A );
ok( 'failed' === $q1['status'] && false !== strpos( $q1['last_error'], 'expired' ), 'process_subscriber: enviou na hora (FCM recusou → expired)' );
ok( 'expired' === $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$T('subscribers')} WHERE id = %d", $fid ) ), 'inscrito do fluxo expirado' );
$m = PIP_Flow::metrics();
ok( isset( $m[ $step_id ] ) && 1 === $m[ $step_id ]['failed'] && 0 === $m[ $step_id ]['pending'], 'metrics() do passo vem dos agregados' );
// passo desligado → skipped (sem envio)
$wpdb->update( $T( 'flow_steps' ), array( 'enabled' => 0 ), array( 'id' => $step_id ) );
$wpdb->update( $T( 'subscribers' ), array( 'status' => 'active' ), array( 'id' => $fid ) );
$wpdb->query( $wpdb->prepare( "UPDATE {$T('queue')} SET status = 'pending', attempts = 0, send_at = %s WHERE subscriber_id = %d AND step_id = %d", gmdate( 'Y-m-d H:i:s' ), $fid, $step_id ) );
PIP_Flow::process_subscriber( $fid );
ok( 'skipped' === $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$T('queue')} WHERE subscriber_id = %d AND step_id = %d", $fid, $step_id ) ), 'passo desligado → skipped sem enviar' );

// ---------------------------------------------------------------- 7. diagnóstico desligado por padrão
echo "[diagnóstico]\n";
$diag_before = (int) get_option( 'pip_diag_until', 0 );
PIP_Store::diag_set( 0 );
$nl = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('log')}" );
PIP_Store::log_events( 'teste', array( array( 'e' => 'teste-off', 'd' => 'x' ) ), array( 'platform' => 'linux', 'browser' => 'chrome' ) );
ok( $nl === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('log')}" ), 'desligado: log_events não grava' );
ok( false === strpos( PIP_Frontend::sw_url(), 'd=1' ), 'desligado: endereço do SW sem d=1' );
PIP_Store::diag_set( 1 );
PIP_Store::log_events( 'teste', array( array( 'e' => 'teste-on', 'd' => 'x' ) ), array( 'platform' => 'linux', 'browser' => 'chrome' ) );
ok( $nl + 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('log')}" ), 'ligado: log_events grava' );
ok( false !== strpos( PIP_Frontend::sw_url(), 'd=1' ), 'ligado: endereço do SW com d=1' );
$wpdb->delete( $T( 'log' ), array( 'event' => 'teste-on' ) );
update_option( 'pip_diag_until', $diag_before, true );

// ---------------------------------------------------------------- 8. poda
echo "[poda]\n";
$wpdb->insert( $T( 'sends' ), array( 'subscriber_id' => $fid, 'kind' => 'test', 'blast_id' => 0, 'status' => 'sent', 'code' => 201, 'sent_at' => gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) ) - 100 * DAY_IN_SECONDS ) ) );
$old_send = (int) $wpdb->insert_id;
$wpdb->insert( $T( 'queue' ), array( 'subscriber_id' => $fid, 'step_id' => 999999, 'blast_id' => 0, 'send_at' => gmdate( 'Y-m-d H:i:s', time() - 10 * DAY_IN_SECONDS ), 'status' => 'sent', 'attempts' => 1 ) );
$old_q = (int) $wpdb->insert_id;
$pr    = PIP_Store::prune();
ok( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$T('sends')} WHERE id = %d", $old_send ) ), 'poda: envio de 100 dias apagado' );
ok( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$T('queue')} WHERE id = %d", $old_q ) ), 'poda: fila enviada há 10 dias apagada' );
ok( (bool) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$T('sends')} WHERE id = %d", $sid ) ), 'poda: envio de hoje continua' );

// ---------------------------------------------------------------- 9. loopback do worker + rota REST
echo "[worker em segundo plano]\n";
$r = wp_remote_post( rest_url( 'pip/v1/worker' ), array( 'timeout' => 20, 'sslverify' => false, 'body' => array( 't' => 'errado' ) ) );
ok( 403 === (int) wp_remote_retrieve_response_code( $r ), 'REST worker: token errado → 403' );
delete_transient( 'pip_worker_lock' );
$r = wp_remote_post( rest_url( 'pip/v1/worker' ), array( 'timeout' => 40, 'sslverify' => false, 'body' => array( 't' => PIP_Flow::worker_token() ) ) );
ok( 200 === (int) wp_remote_retrieve_response_code( $r ), 'REST worker: token certo → 200 (' . wp_remote_retrieve_body( $r ) . ')' );
delete_transient( 'pip_kick' );
delete_transient( 'pip_idle' );
delete_transient( 'pip_worker_lock' );
$mark = time();
sleep( 1 );
PIP_Flow::kick( true );
$seen = false;
for ( $i = 0; $i < 12; $i++ ) {
	usleep( 500000 );
	wp_cache_delete( 'pip_worker_last', 'options' );
	$wl = get_option( 'pip_worker_last' );
	if ( is_array( $wl ) && 'kick' === $wl['source'] && (int) $wl['at'] >= $mark ) {
		$seen = true;
		break;
	}
}
ok( $seen, 'kick(): o site acordou o próprio worker (loopback) em ' . ( ( $i + 1 ) * 0.5 ) . ' s' );

// ---------------------------------------------------------------- 10. SW e manifesto com cache
echo "[service worker]\n";
$r = wp_remote_get( home_url( '/?pip-sw=' . PIP_VERSION ), array( 'timeout' => 15, 'sslverify' => false ) );
$cc = (string) wp_remote_retrieve_header( $r, 'cache-control' );
$et = (string) wp_remote_retrieve_header( $r, 'etag' );
ok( 200 === (int) wp_remote_retrieve_response_code( $r ) && false !== strpos( $cc, 'max-age=86400' ) && $et, "SW: 200 com cache de 1 dia ($cc)" );
ok( false !== strpos( (string) wp_remote_retrieve_body( $r ), '"diag":false' ) || false !== strpos( (string) wp_remote_retrieve_body( $r ), '"diag":true' ), 'SW: PIP_SW.diag injetado' );
$r2 = wp_remote_get( home_url( '/?pip-sw=' . PIP_VERSION ), array( 'timeout' => 15, 'sslverify' => false, 'headers' => array( 'If-None-Match' => $et ) ) );
ok( 304 === (int) wp_remote_retrieve_response_code( $r2 ), 'SW: If-None-Match → 304' );
$r3 = wp_remote_get( home_url( '/?pip-manifest=1' ), array( 'timeout' => 15, 'sslverify' => false ) );
ok( in_array( (int) wp_remote_retrieve_response_code( $r3 ), array( 200, 404 ), true ) && ( 404 === (int) wp_remote_retrieve_response_code( $r3 ) || false !== strpos( (string) wp_remote_retrieve_header( $r3, 'cache-control' ), 'max-age=3600' ) ), 'manifesto: cache de 1 h' );
$r4 = wp_remote_get( home_url( '/' ), array( 'timeout' => 15, 'sslverify' => false, 'headers' => array( 'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120' ) ) );
$html = (string) wp_remote_retrieve_body( $r4 );
ok( false !== strpos( $html, '"diag":' ), 'página: PIP_CFG traz diag' );
ok( false !== strpos( $html, 'pip-sw=' . PIP_VERSION ), 'página: SW da versão atual' );

// ---------------------------------------------------------------- 11. REST pública: subscribe recusa endpoint ruim
echo "[REST subscribe]\n";
$r = wp_remote_post( rest_url( 'pip/v1/subscribe' ), array( 'timeout' => 15, 'sslverify' => false, 'headers' => array( 'Content-Type' => 'application/json' ), 'body' => wp_json_encode( array( 'subscription' => array( 'endpoint' => 'https://10.0.0.9/x', 'keys' => array( 'p256dh' => $pub, 'auth' => b64u( random_bytes( 16 ) ) ) ) ) ) ) );
ok( 400 === (int) wp_remote_retrieve_response_code( $r ), 'subscribe com endpoint privado → 400' );

// ---------------------------------------------------------------- limpeza
echo "[limpeza]\n";
$ids = array_map( 'intval', $wpdb->get_col( "SELECT id FROM {$T('subscribers')} WHERE endpoint LIKE '%TESTE-%'" ) );
if ( $ids ) {
	$in = implode( ',', $ids );
	$wpdb->query( "DELETE FROM {$T('queue')} WHERE subscriber_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('sends')} WHERE subscriber_id IN ($in)" );
	$wpdb->query( "DELETE FROM {$T('subscribers')} WHERE id IN ($in)" );
}
$wpdb->query( $wpdb->prepare( "DELETE FROM {$T('send_stats')} WHERE (kind = 'broadcast' AND ref_id = %d) OR (kind = 'flow' AND ref_id = %d)", $bid, $step_id ) );
// SÓ as linhas criadas pelo teste (por id — nunca por título: títulos reais podem começar com "Teste")
$wpdb->query( $wpdb->prepare( "DELETE FROM {$T('blasts')} WHERE id = %d", $bid ) );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$T('flow_steps')} WHERE id = %d", $step_id ) );
$wpdb->query( "DELETE FROM {$T('log')} WHERE client = 'teste'" );
foreach ( array( 'pip_subs_count_all', 'pip_subs_count_linux', 'pip_kick', 'pip_idle', 'pip_worker_lock' ) as $tr ) {
	delete_transient( $tr );
}
$after = $snap();
ok( $after === $before, 'dados reais intocados' . ( $after === $before ? ': ' . wp_json_encode( $after ) : "\n       antes: " . wp_json_encode( $before ) . "\n       depois: " . wp_json_encode( $after ) ) );
ok( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$T('subscribers')} WHERE endpoint LIKE '%TESTE-%'" ), 'inscritos falsos removidos' );
echo "\nRESULTADO: {$GLOBALS['pip_e2e']['pass']} ok, {$GLOBALS['pip_e2e']['fail']} falhas\n";
exit( $GLOBALS['pip_e2e']['fail'] ? 1 : 0 );
