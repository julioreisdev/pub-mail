<?php
/**
 * Automação de ativação: sequência de notificações que cada novo inscrito recebe (logo após ativar,
 * depois de 30 min, 1 dia…). Passos configuráveis (atraso, título, texto, ícone, imagem, link), fila por
 * inscrito, envio pelo cron do WordPress (1 min) e também a cada visita (sites com pouco tráfego),
 * teste no aparelho da equipe e cliques por passo. Tela "Automação" do painel.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Fila, envio e tela.
 */
class PIP_Flow {

	const PAGE       = 'push-in-play-automation';
	const CRON_HOOK  = 'pip_flow_tick';
	const DAILY_HOOK = 'pip_daily';
	const LOCK       = 'pip_worker_lock';
	const KICK       = 'pip_kick';
	const IDLE       = 'pip_idle';
	const OPT_ON     = 'pip_flow_enabled';
	const ICON_MODES = array( 'site', 'emoji', 'image' );
	const UNITS      = array(
		'minutes' => 1,
		'hours'   => 60,
		'days'    => 1440,
	);

	/**
	 * Linhas de "Enviar agora" já lidas nesta requisição (id → linha|false).
	 *
	 * @var array
	 */
	private static $blast_cache = array();

	/**
	 * Hooks.
	 */
	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval
		add_action( self::CRON_HOOK, array( __CLASS__, 'tick' ) );
		add_action( self::DAILY_HOOK, array( __CLASS__, 'daily' ) );
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + 60, 'pip_minute', self::CRON_HOOK );
		}
		if ( ! wp_next_scheduled( self::DAILY_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::DAILY_HOOK );
		}
		if ( is_admin() ) {
			add_action( 'admin_post_pip_flow_save', array( __CLASS__, 'handle_save' ) );
			add_action( 'admin_post_pip_flow_action', array( __CLASS__, 'handle_action' ) );
		}
	}

	/**
	 * Intervalo de 1 minuto para o cron.
	 *
	 * @param array $s Agendas.
	 * @return array
	 */
	public static function schedules( $s ) {
		$s['pip_minute'] = array(
			'interval' => 60,
			'display'  => 'Push In Play: a cada minuto',
		);
		return $s;
	}

	/**
	 * Desagenda (desinstalação).
	 */
	public static function unschedule() {
		foreach ( array( self::CRON_HOOK, self::DAILY_HOOK ) as $hook ) {
			$t = wp_next_scheduled( $hook );
			while ( $t ) {
				wp_unschedule_event( $t, $hook );
				$t = wp_next_scheduled( $hook );
			}
		}
	}

	/* ------------------------------------------------------------------ passos */

	/**
	 * Fluxo ligado?
	 *
	 * @return bool
	 */
	public static function enabled() {
		return '0' !== (string) get_option( self::OPT_ON, '1' );
	}

	/**
	 * Passos na ordem.
	 *
	 * @param bool $only_enabled Só os ligados.
	 * @return array
	 */
	public static function steps( $only_enabled = false ) {
		global $wpdb;
		$t     = PIP_Store::table( 'flow_steps' );
		$where = $only_enabled ? 'WHERE enabled = 1' : '';
		$rows  = $wpdb->get_results( "SELECT * FROM {$t} {$where} ORDER BY delay_minutes ASC, position ASC, id ASC", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return array_map( array( __CLASS__, 'cast' ), $rows ? $rows : array() );
	}

	/**
	 * Um passo.
	 *
	 * @param int $id Id.
	 * @return array|null
	 */
	public static function step( $id ) {
		global $wpdb;
		$t   = PIP_Store::table( 'flow_steps' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $row ? self::cast( $row ) : null;
	}

	/**
	 * Tipos.
	 *
	 * @param array $r Linha.
	 * @return array
	 */
	private static function cast( $r ) {
		$r['id']            = (int) $r['id'];
		$r['position']      = (int) $r['position'];
		$r['delay_minutes'] = (int) $r['delay_minutes'];
		$r['enabled']       = (bool) $r['enabled'];
		return $r;
	}

	/**
	 * Passo em branco (editor).
	 *
	 * @return array
	 */
	public static function blank() {
		return array(
			'id'            => 0,
			'position'      => 0,
			'delay_minutes' => 0,
			'enabled'       => true,
			'title'         => '',
			'body'          => '',
			'icon_mode'     => get_site_icon_url( 96 ) ? 'site' : 'emoji',
			'icon_emoji'    => '🔔',
			'icon_url'      => '',
			'image_url'     => '',
			'url'           => home_url( '/' ),
		);
	}

	/**
	 * Grava um passo.
	 *
	 * @param array    $d  Dados crus.
	 * @param int|null $id Id (null = novo).
	 * @return int Id.
	 */
	public static function save_step( $d, $id = null ) {
		global $wpdb;
		$t    = PIP_Store::table( 'flow_steps' );
		$now  = current_time( 'mysql' );
		$unit = isset( $d['delay_unit'] ) && isset( self::UNITS[ $d['delay_unit'] ] ) ? $d['delay_unit'] : 'minutes';
		$row  = array(
			'delay_minutes' => max( 0, min( 525600, (int) ( isset( $d['delay_value'] ) ? $d['delay_value'] : 0 ) * self::UNITS[ $unit ] ) ),
			'enabled'       => empty( $d['enabled'] ) ? 0 : 1,
			'title'         => mb_substr( sanitize_text_field( isset( $d['title'] ) ? $d['title'] : '' ), 0, 120 ),
			'body'          => mb_substr( sanitize_textarea_field( isset( $d['body'] ) ? $d['body'] : '' ), 0, 255 ),
			'icon_mode'     => in_array( isset( $d['icon_mode'] ) ? $d['icon_mode'] : '', self::ICON_MODES, true ) ? $d['icon_mode'] : 'site',
			'icon_emoji'    => mb_substr( sanitize_text_field( isset( $d['icon_emoji'] ) ? $d['icon_emoji'] : '' ), 0, 16 ),
			'icon_url'      => mb_substr( esc_url_raw( isset( $d['icon_url'] ) ? $d['icon_url'] : '' ), 0, 255 ),
			'image_url'     => mb_substr( esc_url_raw( isset( $d['image_url'] ) ? $d['image_url'] : '' ), 0, 255 ),
			'url'           => mb_substr( esc_url_raw( isset( $d['url'] ) ? $d['url'] : '' ), 0, 255 ),
			'updated_at'    => $now,
		);
		if ( $id ) {
			$wpdb->update( $t, $row, array( 'id' => (int) $id ) );
			return (int) $id;
		}
		$row['position']   = (int) $wpdb->get_var( "SELECT COALESCE(MAX(position),0)+1 FROM {$t}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row['created_at'] = $now;
		$wpdb->insert( $t, $row );
		return (int) $wpdb->insert_id;
	}

	/**
	 * Apaga um passo (e o que ainda estava na fila para ele).
	 *
	 * @param int $id Id.
	 */
	public static function delete_step( $id ) {
		global $wpdb;
		$wpdb->delete( PIP_Store::table( 'flow_steps' ), array( 'id' => (int) $id ) );
		$wpdb->delete( PIP_Store::table( 'queue' ), array( 'step_id' => (int) $id, 'status' => 'pending' ) );
	}

	/* ------------------------------------------------------------------ fila */

	/**
	 * Inscrito novo: agenda todos os passos ligados a partir de agora (um INSERT só).
	 *
	 * @param int $subscriber_id Inscrito.
	 */
	public static function enqueue( $subscriber_id ) {
		global $wpdb;
		if ( ! self::enabled() ) {
			return;
		}
		$t    = PIP_Store::table( 'queue' );
		$now  = time();
		$vals = array();
		foreach ( self::steps( true ) as $s ) {
			$vals[] = $wpdb->prepare( "(%d, %d, 0, %s, 'pending', 0)", (int) $subscriber_id, $s['id'], gmdate( 'Y-m-d H:i:s', $now + $s['delay_minutes'] * 60 ) );
		}
		if ( ! $vals ) {
			return;
		}
		$wpdb->query( "INSERT IGNORE INTO {$t} (subscriber_id, step_id, blast_id, send_at, status, attempts) VALUES " . implode( ',', $vals ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		delete_transient( self::IDLE );
	}

	/* ---- worker */

	/**
	 * Quantas linhas por lote (constante PIP_SEND_BATCH ou filtro pip_send_batch; padrão 100).
	 *
	 * @return int
	 */
	public static function batch_size() {
		$n = defined( 'PIP_SEND_BATCH' ) ? (int) PIP_SEND_BATCH : 100;
		return max( 10, min( 500, (int) apply_filters( 'pip_send_batch', $n ) ) );
	}

	/**
	 * Orçamento de uma rodada em segundos (cabe no max_execution_time do PHP).
	 *
	 * @param int $want Desejado.
	 * @return int
	 */
	private static function budget( $want ) {
		$max = (int) ini_get( 'max_execution_time' );
		if ( $max > 0 && $max - 8 < $want ) {
			$want = max( 5, $max - 8 );
		}
		return (int) $want;
	}

	/**
	 * Token do loopback do worker (vale na janela de 5 min atual e na anterior).
	 *
	 * @param int $back 0 = janela atual, 1 = anterior.
	 * @return string
	 */
	public static function worker_token( $back = 0 ) {
		return hash_hmac( 'sha256', 'pip-worker|' . ( (int) floor( time() / 300 ) - (int) $back ), wp_salt( 'auth' ) );
	}

	/**
	 * Confere o token do loopback.
	 *
	 * @param string $t Token.
	 * @return bool
	 */
	public static function worker_token_ok( $t ) {
		$t = (string) $t;
		return $t && ( hash_equals( self::worker_token( 0 ), $t ) || hash_equals( self::worker_token( 1 ), $t ) );
	}

	/**
	 * Acorda o worker em segundo plano: uma requisição ao próprio site que não espera resposta
	 * (mesma técnica do WP-Cron), no máximo 1× a cada 15 s. Sem a loopback (hospedagem bloqueando),
	 * o cron de 1 min continua fazendo o serviço.
	 *
	 * @param bool $force Ignora o freio e o "fila vazia".
	 * @return bool Disparou.
	 */
	public static function kick( $force = false ) {
		if ( ! $force && ( get_transient( self::IDLE ) || get_transient( self::KICK ) ) ) {
			return false;
		}
		set_transient( self::KICK, 1, 15 );
		$url = add_query_arg( 'pip_w', (int) time(), rest_url( PIP_Rest::NS . '/worker' ) );
		wp_remote_post(
			$url,
			array(
				'timeout'   => 0.5,
				'blocking'  => false,
				'sslverify' => apply_filters( 'https_local_ssl_verify', false ),
				'body'      => array( 't' => self::worker_token() ),
				'headers'   => array( 'X-PIP-Worker' => '1' ),
			)
		);
		return true;
	}

	/**
	 * Trava do worker: só uma rodada por vez (duas em paralelo não duplicariam envios — a reserva é
	 * atômica — mas dobrariam a carga). Não é 100 % atômica no options table; basta para limitar.
	 *
	 * @return string|null Token da trava.
	 */
	private static function lock() {
		if ( get_transient( self::LOCK ) ) {
			return null;
		}
		$tok = bin2hex( random_bytes( 6 ) );
		set_transient( self::LOCK, $tok, 45 );
		usleep( 20000 );
		return get_transient( self::LOCK ) === $tok ? $tok : null;
	}

	/**
	 * Rodada do worker: reivindica lotes vencidos e envia em paralelo até esgotar a fila ou o orçamento.
	 * Se sobrou trabalho, acorda a próxima rodada na hora (cadeia) — não espera o próximo minuto.
	 *
	 * @param string $source cron|kick|blast|visit (só para o registro).
	 * @param int    $want   Orçamento desejado em segundos.
	 * @return int Linhas tratadas.
	 */
	public static function run_worker( $source = 'cron', $want = 25 ) {
		if ( ! PIP_License::active() ) {
			return 0;
		}
		$tok = self::lock();
		if ( ! $tok ) {
			return 0;
		}
		if ( function_exists( 'ignore_user_abort' ) ) {
			ignore_user_abort( true );
		}
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 90 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		}
		$t0       = microtime( true );
		$deadline = $t0 + self::budget( $want );
		$batch    = self::batch_size();
		self::steps_map( true );
		$total    = array( 'rows' => 0, 'sent' => 0, 'failed' => 0, 'retry' => 0, 'skipped' => 0 );
		$blasts   = array();
		$more     = false;
		self::reset_stale();
		do {
			$rows = self::claim( $batch );
			if ( ! $rows ) {
				break;
			}
			$r = self::send_batch( $rows );
			foreach ( $r['blasts'] as $bid ) {
				$blasts[ $bid ] = true;
			}
			foreach ( array( 'rows', 'sent', 'failed', 'retry', 'skipped' ) as $k ) {
				$total[ $k ] += $r[ $k ];
			}
			set_transient( self::LOCK, $tok, 45 );
			if ( count( $rows ) < $batch ) {
				break; // fila esvaziou
			}
			if ( microtime( true ) > $deadline ) {
				$more = true;
				break;
			}
		} while ( true );
		foreach ( array_keys( $blasts ) as $bid ) {
			self::reconcile_blast( $bid );
		}
		update_option(
			'pip_worker_last',
			array(
				'at'     => time(),
				'source' => $source,
				'rows'   => $total['rows'],
				'sent'   => $total['sent'],
				'failed' => $total['failed'],
				'retry'  => $total['retry'],
				'ms'     => (int) round( ( microtime( true ) - $t0 ) * 1000 ),
				'more'   => $more,
			),
			false
		);
		delete_transient( self::LOCK );
		if ( $more ) {
			self::kick( true );
		} else {
			set_transient( self::IDLE, 1, 50 ); // nada vencido: visitas não precisam acordar o worker até o próximo cron
		}
		return $total['rows'];
	}

	/**
	 * Tick do cron (1 min): registra e roda o worker.
	 */
	public static function tick() {
		update_option( 'pip_cron_last', time(), false );
		PIP_Broadcasts::dispatch(); // horários que bateram viram disparos
		self::run_worker( 'cron' );
		PIP_Sync::maybe_push(); // resumo para o painel do Pub Mail (15 min / fim de disparo)
	}

	/**
	 * Diário: poda e fecha envios travados.
	 */
	public static function daily() {
		$n = PIP_Store::prune();
		self::close_stuck_blasts();
		update_option( 'pip_prune_last', array( 'at' => time(), 'n' => $n ), false );
	}

	/**
	 * Compat: antigo process() → worker.
	 *
	 * @param int  $limit Ignorado.
	 * @param bool $force Ignorado.
	 */
	public static function process( $limit = 40, $force = false ) {
		unset( $limit, $force );
		self::run_worker( 'cron' );
	}

	/**
	 * Visita ao site: só acorda o worker (nunca envia dentro da requisição do visitante).
	 */
	public static function maybe_process() {
		if ( PIP_Broadcasts::dispatch() ) {
			self::kick( true );
			return;
		}
		self::kick();
	}

	/**
	 * Linhas "sending" esquecidas (processo caiu no meio) voltam para a fila depois de 10 min.
	 */
	private static function reset_stale() {
		global $wpdb;
		$q = PIP_Store::table( 'queue' );
		$wpdb->query( $wpdb->prepare( "UPDATE {$q} SET status = 'pending', claim = NULL WHERE status = 'sending' AND send_at < %s", gmdate( 'Y-m-d H:i:s', time() - 600 ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Reivindica um lote (UPDATE atômico com token) e devolve as linhas com o inscrito.
	 *
	 * @param int      $n             Quantas.
	 * @param int|null $subscriber_id Só deste inscrito (inscrição nova).
	 * @return array
	 */
	private static function claim( $n, $subscriber_id = null ) {
		global $wpdb;
		$q    = PIP_Store::table( 'queue' );
		$subs = PIP_Store::table( 'subscribers' );
		$tok  = bin2hex( random_bytes( 6 ) );
		$now  = gmdate( 'Y-m-d H:i:s' );
		if ( $subscriber_id ) {
			$claimed = $wpdb->query( $wpdb->prepare( "UPDATE {$q} SET status = 'sending', claim = %s, send_at = %s WHERE subscriber_id = %d AND status = 'pending' AND send_at <= %s ORDER BY send_at ASC, id ASC LIMIT %d", $tok, $now, (int) $subscriber_id, $now, (int) $n ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		} else {
			$claimed = $wpdb->query( $wpdb->prepare( "UPDATE {$q} SET status = 'sending', claim = %s, send_at = %s WHERE status = 'pending' AND send_at <= %s ORDER BY send_at ASC, id ASC LIMIT %d", $tok, $now, $now, (int) $n ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		if ( ! $claimed ) {
			return array();
		}
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT q.id qid, q.subscriber_id, q.step_id, q.blast_id, q.attempts, s.endpoint, s.p256dh, s.auth, s.status sstatus FROM {$q} q JOIN {$subs} s ON s.id = q.subscriber_id WHERE q.claim = %s AND q.status = 'sending' ORDER BY q.id ASC", $tok ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $rows ? $rows : array();
	}

	/**
	 * Mapa id → passo (cache por requisição).
	 *
	 * @return array
	 */
	private static function steps_map( $refresh = false ) {
		static $map = null;
		if ( null === $map || $refresh ) {
			$map = array();
			foreach ( self::steps() as $s ) {
				$map[ $s['id'] ] = $s;
			}
		}
		return $map;
	}

	/**
	 * Envia um lote reivindicado (paralelo), grava envios, atualiza fila, inscritos e agregados.
	 *
	 * @param array $rows Linhas de claim().
	 * @return array {rows, sent, failed, retry, skipped, blasts[]}
	 */
	private static function send_batch( $rows ) {
		global $wpdb;
		$q      = PIP_Store::table( 'queue' );
		$sd     = PIP_Store::table( 'sends' );
		$subs   = PIP_Store::table( 'subscribers' );
		$steps  = self::steps_map();
		$on     = self::enabled();
		$now    = current_time( 'mysql' );
		$out    = array( 'rows' => count( $rows ), 'sent' => 0, 'failed' => 0, 'retry' => 0, 'skipped' => 0, 'blasts' => array() );
		$blasts = array();
		$skip   = array();
		$send   = array(); // qid → {row, step, kind, blast_id}
		foreach ( $rows as $r ) {
			$bid = (int) $r['blast_id'];
			if ( $bid ) {
				$blasts[ $bid ] = true;
				if ( ! isset( self::$blast_cache[ $bid ] ) ) {
					$br                        = self::blast_row( $bid );
					self::$blast_cache[ $bid ] = $br ? $br : false;
				}
				$b    = self::$blast_cache[ $bid ] ? self::$blast_cache[ $bid ] : null;
				$step = $b ? self::blast_as_step( $b ) : null;
				$ok   = $step && 'active' === $r['sstatus'];
				$kind = 'broadcast';
			} else {
				$step = isset( $steps[ (int) $r['step_id'] ] ) ? $steps[ (int) $r['step_id'] ] : null;
				$ok   = $step && $step['enabled'] && 'active' === $r['sstatus'] && $on;
				$kind = 'flow';
			}
			if ( ! $ok ) {
				$skip[] = (int) $r['qid'];
				continue;
			}
			$send[ (int) $r['qid'] ] = array( 'row' => $r, 'step' => $step, 'kind' => $kind, 'blast_id' => $bid );
		}
		if ( $skip ) {
			$wpdb->query( "UPDATE {$q} SET status = 'skipped', claim = NULL WHERE id IN (" . implode( ',', array_map( 'intval', $skip ) ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$out['skipped'] = count( $skip );
		}
		$out['blasts'] = array_keys( $blasts );
		if ( ! $send ) {
			return $out;
		}
		// 1) um registro de envio por linha (o id dele vai no payload para contar o clique)
		$vals = array();
		foreach ( $send as $qid => $it ) {
			if ( 'flow' === $it['kind'] ) {
				$vals[] = $wpdb->prepare( "(%d, 'flow', %d, 0, %d, 'failed', 0, %s)", (int) $it['row']['subscriber_id'], (int) $it['step']['id'], $qid, $now );
			} else {
				$vals[] = $wpdb->prepare( "(%d, 'broadcast', NULL, %d, %d, 'failed', 0, %s)", (int) $it['row']['subscriber_id'], $it['blast_id'], $qid, $now );
			}
		}
		$wpdb->query( "INSERT INTO {$sd} (subscriber_id, kind, step_id, blast_id, queue_id, status, code, sent_at) VALUES " . implode( ',', $vals ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$ids = array();
		foreach ( $wpdb->get_results( "SELECT id, queue_id FROM {$sd} WHERE queue_id IN (" . implode( ',', array_map( 'intval', array_keys( $send ) ) ) . ') ORDER BY id DESC', ARRAY_A ) as $x ) { // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			if ( ! isset( $ids[ (int) $x['queue_id'] ] ) ) {
				$ids[ (int) $x['queue_id'] ] = (int) $x['id'];
			}
		}
		// 2) payloads (o grosso é igual por passo; só id/clique mudam por linha)
		$base  = array();
		$items = array();
		foreach ( $send as $qid => $it ) {
			$send_id = isset( $ids[ $qid ] ) ? $ids[ $qid ] : 0;
			$bk      = $it['kind'] . ':' . ( 'flow' === $it['kind'] ? $it['step']['id'] : $it['blast_id'] );
			if ( ! isset( $base[ $bk ] ) ) {
				$base[ $bk ] = self::payload( $it['step'], 0 );
			}
			$p          = $base[ $bk ];
			$p['id']    = $send_id;
			$p['click'] = self::click_url( $send_id );
			$items[ $qid ] = array(
				'sub'     => array( 'endpoint' => $it['row']['endpoint'], 'p256dh' => $it['row']['p256dh'], 'auth' => $it['row']['auth'] ),
				'payload' => $p,
			);
		}
		// 3) envio paralelo
		$results = PIP_Push::send_many( $items, array( 'ttl' => DAY_IN_SECONDS ) );
		// 4) resultados → fila, envios, inscritos, agregados
		$ok_q = array();
		$ok_s = array();
		$gone = array();
		$agg  = array();
		foreach ( $send as $qid => $it ) {
			$res     = isset( $results[ $qid ] ) ? $results[ $qid ] : array( 'ok' => false, 'code' => 0, 'gone' => false, 'retry' => true, 'retry_after' => 0, 'error' => 'sem resultado' );
			$send_id = isset( $ids[ $qid ] ) ? $ids[ $qid ] : 0;
			$ak      = $it['kind'] . ':' . ( 'flow' === $it['kind'] ? $it['step']['id'] : $it['blast_id'] );
			if ( ! isset( $agg[ $ak ] ) ) {
				$agg[ $ak ] = array( 'kind' => $it['kind'], 'ref_id' => 'flow' === $it['kind'] ? (int) $it['step']['id'] : $it['blast_id'], 'sent' => 0, 'failed' => 0 );
			}
			$attempts = (int) $it['row']['attempts'] + 1;
			if ( $res['ok'] ) {
				$ok_q[] = $qid;
				if ( $send_id ) {
					$ok_s[] = $send_id;
				}
				$agg[ $ak ]['sent']++;
				$out['sent']++;
				continue;
			}
			$err = mb_substr( (string) $res['error'], 0, 180 );
			if ( $send_id ) {
				$wpdb->update( $sd, array( 'status' => 'failed', 'code' => (int) $res['code'], 'error' => $err ), array( 'id' => $send_id ) );
			}
			if ( $res['gone'] ) {
				$gone[] = (int) $it['row']['subscriber_id'];
				$wpdb->update( $q, array( 'status' => 'failed', 'attempts' => $attempts, 'last_error' => 'expired: ' . $err, 'claim' => null ), array( 'id' => $qid ) );
				$agg[ $ak ]['failed']++;
				$out['failed']++;
			} elseif ( $res['retry'] && $attempts < 3 ) {
				$wait = $res['retry_after'] > 0 ? $res['retry_after'] : ( 1 === $attempts ? 300 : 1800 );
				$wpdb->update( $q, array( 'status' => 'pending', 'attempts' => $attempts, 'last_error' => $err, 'claim' => null, 'send_at' => gmdate( 'Y-m-d H:i:s', time() + $wait ) ), array( 'id' => $qid ) );
				$out['retry']++;
			} else {
				$wpdb->update( $q, array( 'status' => 'failed', 'attempts' => $attempts, 'last_error' => $err, 'claim' => null ), array( 'id' => $qid ) );
				$agg[ $ak ]['failed']++;
				$out['failed']++;
			}
		}
		if ( $ok_q ) {
			$wpdb->query( "UPDATE {$q} SET status = 'sent', attempts = attempts + 1, last_error = '', claim = NULL WHERE id IN (" . implode( ',', array_map( 'intval', $ok_q ) ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}
		if ( $ok_s ) {
			$wpdb->query( "UPDATE {$sd} SET status = 'sent', code = 201 WHERE id IN (" . implode( ',', array_map( 'intval', $ok_s ) ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}
		if ( $gone ) {
			$wpdb->query( "UPDATE {$subs} SET status = 'expired' WHERE id IN (" . implode( ',', array_map( 'intval', array_unique( $gone ) ) ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			foreach ( array( 'all' ) as $k ) {
				delete_transient( 'pip_subs_count_' . $k );
			}
		}
		PIP_Store::bump_send_stats( array_values( $agg ) );
		return $out;
	}

	/**
	 * Inscrição nova: manda só o que já venceu para ESTE inscrito (o passo "logo após ativar"),
	 * dentro da requisição (1 envio) — e acorda o worker para o resto da fila.
	 *
	 * @param int $subscriber_id Inscrito.
	 */
	public static function process_subscriber( $subscriber_id ) {
		if ( ! PIP_License::active() ) {
			return;
		}
		self::steps_map( true );
		$rows = self::claim( 10, (int) $subscriber_id );
		if ( $rows ) {
			$r = self::send_batch( $rows );
			foreach ( $r['blasts'] as $bid ) {
				self::reconcile_blast( $bid );
			}
		}
	}

	/**
	 * Envia um passo (ou um teste) a UM aparelho e registra em pip_sends (teste da equipe).
	 *
	 * @param int        $subscriber_id Inscrito.
	 * @param array      $sub           {endpoint, p256dh, auth}.
	 * @param array|null $step          Passo (null = teste padrão).
	 * @param string     $kind          flow|test|broadcast.
	 * @param int        $blast_id      Envio ("Enviar agora").
	 * @return array Resultado do PIP_Push::send + send_id.
	 */
	public static function deliver( $subscriber_id, $sub, $step, $kind, $blast_id = 0 ) {
		global $wpdb;
		$t = PIP_Store::table( 'sends' );
		$wpdb->insert(
			$t,
			array(
				'subscriber_id' => (int) $subscriber_id,
				'kind'          => $kind,
				'step_id'       => $step && empty( $step['is_blast'] ) && ! empty( $step['id'] ) ? (int) $step['id'] : null,
				'blast_id'      => (int) $blast_id,
				'status'        => 'failed',
				'code'          => 0,
				'sent_at'       => current_time( 'mysql' ),
			)
		);
		$send_id = (int) $wpdb->insert_id;
		$payload = self::payload( $step, $send_id );
		$res     = PIP_Push::send( $sub, $payload, array( 'ttl' => DAY_IN_SECONDS ) );
		$wpdb->update( $t, array( 'status' => $res['ok'] ? 'sent' : 'failed', 'code' => (int) $res['code'], 'error' => mb_substr( $res['error'], 0, 180 ) ), array( 'id' => $send_id ) );
		if ( $res['gone'] ) {
			$wpdb->update( PIP_Store::table( 'subscribers' ), array( 'status' => 'expired' ), array( 'id' => (int) $subscriber_id ) );
		}
		if ( 'flow' === $kind || 'broadcast' === $kind ) {
			PIP_Store::bump_send_stats( array( array( 'kind' => $kind, 'ref_id' => 'flow' === $kind ? (int) $step['id'] : (int) $blast_id, 'sent' => $res['ok'] ? 1 : 0, 'failed' => $res['ok'] ? 0 : 1 ) ) );
		}
		$res['send_id'] = $send_id;
		return $res;
	}

	/**
	 * URL que o service worker chama ao tocar na notificação (conta o clique).
	 *
	 * @param int $send_id Envio.
	 * @return string
	 */
	public static function click_url( $send_id ) {
		return add_query_arg( array( 'id' => (int) $send_id, 'k' => self::click_key( $send_id ) ), rest_url( PIP_Rest::NS . '/nclick' ) );
	}

	/**
	 * Conteúdo da notificação (o que o service worker mostra).
	 *
	 * @param array|null $step    Passo (null = teste).
	 * @param int        $send_id Id do envio (clique).
	 * @return array
	 */
	public static function payload( $step, $send_id ) {
		if ( ! $step ) {
			$step = array(
				'id'         => 0,
				'title'      => 'Teste do Push In Play',
				'body'       => 'Se você está vendo isto, as notificações de ' . wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) . ' funcionam neste aparelho.',
				'icon_mode'  => 'site',
				'icon_emoji' => '',
				'icon_url'   => '',
				'image_url'  => '',
				'url'        => home_url( '/' ),
			);
		}
		$url = $step['url'] ? $step['url'] : home_url( '/' );
		$tag = ! empty( $step['is_blast'] ) ? 'pip-blast-' . $step['id'] : 'pip-' . ( $step['id'] ? 'step-' . $step['id'] : 'test' );
		$fx  = PIP_Settings::payload_fields( ! empty( $step['is_blast'] ) ? array( 'sound' => $step['sound'], 'vibrate' => $step['vibrate'] ) : null );
		return array_merge(
			array(
				'title' => $step['title'],
				'body'  => $step['body'],
				'icon'  => self::icon_url( $step ),
				'badge' => set_url_scheme( PIP_URL . 'assets/app/badge-96.png', wp_parse_url( home_url(), PHP_URL_SCHEME ) ),
				'image' => $step['image_url'] ? $step['image_url'] : null,
				'url'   => $url,
				'tag'   => $tag,
				'id'    => (int) $send_id,
				'click' => self::click_url( $send_id ),
			),
			$fx
		);
	}

	/* ------------------------------------------------------------------ enviar agora */

	/**
	 * Cria um disparo para todos os inscritos ativos ("Enviar agora" ou broadcast): grava a linha (com uma
	 * cópia do conteúdo), enfileira (um INSERT…SELECT), manda os primeiros segundos aqui mesmo (opcional) e
	 * deixa o resto com o worker em segundo plano.
	 *
	 * @param array $d      Conteúdo (title, body, icon_mode, icon_emoji, icon_url, image_url, url, sound, vibrate).
	 * @param array $extra  {kind manual|broadcast, broadcast_id, copy_id, slot, broadcast_name}.
	 * @param bool  $inline Enviar ~4 s aqui mesmo (ações do painel); false = só acorda o worker.
	 * @return int Id do envio (0 = não criado, ex.: slot já disparado).
	 */
	public static function blast( $d, $extra = array(), $inline = true ) {
		global $wpdb;
		$bt   = PIP_Store::table( 'blasts' );
		$q    = PIP_Store::table( 'queue' );
		$subs = PIP_Store::table( 'subscribers' );
		$row  = array(
			'title'      => mb_substr( sanitize_text_field( isset( $d['title'] ) ? $d['title'] : '' ), 0, 120 ),
			'body'       => mb_substr( sanitize_textarea_field( isset( $d['body'] ) ? $d['body'] : '' ), 0, 255 ),
			'icon_mode'  => in_array( isset( $d['icon_mode'] ) ? $d['icon_mode'] : '', self::ICON_MODES, true ) ? $d['icon_mode'] : 'site',
			'icon_emoji' => mb_substr( sanitize_text_field( isset( $d['icon_emoji'] ) ? $d['icon_emoji'] : '' ), 0, 16 ),
			'icon_url'   => mb_substr( esc_url_raw( isset( $d['icon_url'] ) ? $d['icon_url'] : '' ), 0, 255 ),
			'image_url'  => mb_substr( esc_url_raw( isset( $d['image_url'] ) ? $d['image_url'] : '' ), 0, 255 ),
			'url'        => mb_substr( esc_url_raw( isset( $d['url'] ) ? $d['url'] : '' ), 0, 255 ),
			'sound'      => in_array( isset( $d['sound'] ) ? $d['sound'] : '', array( 'system', 'silent', 'custom' ), true ) ? $d['sound'] : '',
			'vibrate'    => isset( PIP_Settings::VIBRATIONS[ isset( $d['vibrate'] ) ? $d['vibrate'] : '' ] ) ? $d['vibrate'] : '',
			'status'     => 'sending',
			'created_at' => current_time( 'mysql' ),
			'kind'           => isset( $extra['kind'] ) && 'broadcast' === $extra['kind'] ? 'broadcast' : 'manual',
			'broadcast_id'   => (int) ( isset( $extra['broadcast_id'] ) ? $extra['broadcast_id'] : 0 ),
			'copy_id'        => (int) ( isset( $extra['copy_id'] ) ? $extra['copy_id'] : 0 ),
			'slot'           => isset( $extra['slot'] ) && '' !== (string) $extra['slot'] ? mb_substr( (string) $extra['slot'], 0, 20 ) : null,
			'broadcast_name' => mb_substr( sanitize_text_field( isset( $extra['broadcast_name'] ) ? (string) $extra['broadcast_name'] : '' ), 0, 120 ),
		);
		$wpdb->suppress_errors( true );
		$ok = $wpdb->insert( $bt, $row );
		$wpdb->suppress_errors( false );
		if ( ! $ok ) {
			return 0; // ex.: o slot deste broadcast já foi criado por outro processo (chave única)
		}
		$id    = (int) $wpdb->insert_id;
		$where = (string) apply_filters( 'pip_blast_audience_sql', "status = 'active'", $row );
		$n     = (int) $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$q} (subscriber_id, step_id, blast_id, send_at, status, attempts) SELECT id, 0, %d, %s, 'pending', 0 FROM {$subs} WHERE {$where}", $id, gmdate( 'Y-m-d H:i:s' ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->update( $bt, array( 'total' => max( 0, $n ), 'status' => $n > 0 ? 'sending' : 'done', 'done_at' => $n > 0 ? null : current_time( 'mysql' ) ), array( 'id' => $id ) );
		if ( $n > 0 ) {
			delete_transient( self::IDLE );
			if ( $inline ) {
				self::run_worker( 'blast', 4 ); // alguns segundos aqui, para o aviso já mostrar progresso
				self::reconcile_blast( $id );
			}
			self::kick( true );
		}
		return $id;
	}

	/**
	 * Linha de um envio.
	 *
	 * @param int $id Id.
	 * @return array|null
	 */
	public static function blast_row( $id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PIP_Store::table( 'blasts' ) . ' WHERE id = %d', (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return $row ? $row : null;
	}

	/**
	 * Envio como "passo" para o payload.
	 *
	 * @param array $b Linha.
	 * @return array
	 */
	private static function blast_as_step( $b ) {
		$b['id']       = (int) $b['id'];
		$b['is_blast'] = true;
		return $b;
	}

	/**
	 * Atualiza os contadores do envio pela fila (índice blast_id+status).
	 *
	 * @param int $id Id.
	 */
	public static function reconcile_blast( $id ) {
		global $wpdb;
		$q = PIP_Store::table( 'queue' );
		$r = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(status='sent') sent, SUM(status IN ('failed','skipped')) failed, SUM(status IN ('pending','sending')) pending FROM {$q} WHERE blast_id = %d", (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$prev = $wpdb->get_row( $wpdb->prepare( 'SELECT status, copy_id FROM ' . PIP_Store::table( 'blasts' ) . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( ! $r || ! $prev ) {
			return;
		}
		$upd = array( 'sent' => (int) $r->sent, 'failed' => (int) $r->failed, 'status' => (int) $r->pending ? 'sending' : 'done' );
		if ( ! (int) $r->pending ) {
			$upd['done_at'] = current_time( 'mysql' );
			if ( 'done' !== $prev->status ) {
				PIP_Sync::soon(); // disparo acabou de terminar: o Pub Mail recebe o resumo no próximo tick (só na transição)
			}
		}
		$wpdb->update( PIP_Store::table( 'blasts' ), $upd, array( 'id' => (int) $id ) );
		if ( (int) $prev->copy_id ) {
			PIP_Copies::refresh_stats( (int) $prev->copy_id );
		}
	}

	/**
	 * Envios ainda "sending" sem nada na fila (fila podada, processo caiu) viram "done".
	 */
	private static function close_stuck_blasts() {
		global $wpdb;
		$bt  = PIP_Store::table( 'blasts' );
		$ids = $wpdb->get_col( "SELECT id FROM {$bt} WHERE status = 'sending' AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR) ORDER BY id DESC LIMIT 50" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		foreach ( $ids ? $ids : array() as $id ) {
			self::reconcile_blast( (int) $id );
		}
	}

	/**
	 * Últimos envios (cliques vêm da coluna, sem subconsulta).
	 *
	 * @param int $limit Quantos.
	 * @return array
	 */
	public static function blasts( $limit = 20 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . PIP_Store::table( 'blasts' ) . ' ORDER BY id DESC LIMIT %d', (int) $limit ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Saúde do envio (card do painel).
	 *
	 * @return array
	 */
	public static function health() {
		global $wpdb;
		$q    = PIP_Store::table( 'queue' );
		$now  = gmdate( 'Y-m-d H:i:s' );
		$row  = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(status = 'pending' AND send_at <= %s) due, SUM(status = 'pending' AND send_at > %s) later, SUM(status = 'sending') sending FROM {$q} WHERE status IN ('pending', 'sending')", $now, $now ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$last = get_option( 'pip_worker_last', array() );
		$cron = (int) get_option( 'pip_cron_last', 0 );
		$next = wp_next_scheduled( self::CRON_HOOK );
		$sd   = PIP_Store::table( 'send_stats' );
		$td   = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(sent) sent, SUM(failed) failed, SUM(clicked) clicked FROM {$sd} WHERE day = %s", current_time( 'Y-m-d' ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return array(
			'due'         => $row ? (int) $row->due : 0,
			'later'       => $row ? (int) $row->later : 0,
			'sending'     => $row ? (int) $row->sending : 0,
			'worker_last' => is_array( $last ) ? $last : array(),
			'cron_last'   => $cron,
			'cron_next'   => $next ? (int) $next : 0,
			'cron_off'    => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON,
			'cron_stale'  => $cron ? ( time() - $cron > 5 * MINUTE_IN_SECONDS ) : ( $next && $next < time() - 5 * MINUTE_IN_SECONDS ),
			'parallel'    => PIP_Push::parallel_supported(),
			'concurrency' => PIP_Push::concurrency(),
			'batch'       => self::batch_size(),
			'today'       => array( 'sent' => $td ? (int) $td->sent : 0, 'failed' => $td ? (int) $td->failed : 0, 'clicked' => $td ? (int) $td->clicked : 0 ),
			'subscribers' => PIP_Store::subscribers_count(),
			'diag_until'  => PIP_Store::diag_until(),
			'prune_last'  => get_option( 'pip_prune_last', array() ),
		);
	}

	/**
	 * URL do ícone do passo (site / emoji via Twemoji / imagem).
	 *
	 * @param array $step Passo.
	 * @return string
	 */
	public static function icon_url( $step ) {
		$mode = isset( $step['icon_mode'] ) ? $step['icon_mode'] : 'site';
		if ( 'image' === $mode && ! empty( $step['icon_url'] ) ) {
			return $step['icon_url'];
		}
		if ( 'emoji' === $mode && ! empty( $step['icon_emoji'] ) ) {
			$u = self::emoji_url( $step['icon_emoji'] );
			if ( $u ) {
				return $u;
			}
		}
		$site = get_site_icon_url( 192 );
		return $site ? $site : PIP_URL . 'assets/app/icon-192.png';
	}

	/**
	 * Emoji → PNG do Twemoji (os navegadores não desenham emoji como ícone de notificação).
	 *
	 * @param string $emoji Emoji.
	 * @return string URL ou ''.
	 */
	public static function emoji_url( $emoji ) {
		$cps = array();
		$len = mb_strlen( $emoji );
		for ( $i = 0; $i < $len; $i++ ) {
			$cps[] = mb_ord( mb_substr( $emoji, $i, 1 ) );
		}
		if ( ! $cps ) {
			return '';
		}
		if ( ! in_array( 0x200d, $cps, true ) ) {
			$cps = array_values( array_filter( $cps, function ( $c ) {
				return 0xfe0f !== $c;
			} ) );
		}
		if ( ! $cps ) {
			return '';
		}
		return 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/' . implode( '-', array_map( function ( $c ) {
			return dechex( $c );
		}, $cps ) ) . '.png';
	}

	/**
	 * Chave do clique (impede forjar ids).
	 *
	 * @param int $send_id Envio.
	 * @return string
	 */
	public static function click_key( $send_id ) {
		return substr( hash_hmac( 'sha256', 'pip-click-' . (int) $send_id, wp_salt( 'auth' ) ), 0, 16 );
	}

	/**
	 * Registra o clique numa notificação (1º clique conta nos agregados e no envio).
	 *
	 * @param int    $send_id Envio.
	 * @param string $key     Chave.
	 * @return bool
	 */
	public static function clicked( $send_id, $key ) {
		global $wpdb;
		if ( ! $send_id || ! hash_equals( self::click_key( $send_id ), (string) $key ) ) {
			return false;
		}
		$t = PIP_Store::table( 'sends' );
		$n = (int) $wpdb->query( $wpdb->prepare( "UPDATE {$t} SET clicked_at = %s WHERE id = %d AND clicked_at IS NULL", current_time( 'mysql' ), (int) $send_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( $n ) {
			$s = $wpdb->get_row( $wpdb->prepare( "SELECT kind, step_id, blast_id, sent_at FROM {$t} WHERE id = %d", (int) $send_id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			if ( $s && in_array( $s['kind'], array( 'flow', 'broadcast' ), true ) ) {
				PIP_Store::bump_send_stats( array( array( 'day' => substr( (string) $s['sent_at'], 0, 10 ), 'kind' => $s['kind'], 'ref_id' => 'flow' === $s['kind'] ? (int) $s['step_id'] : (int) $s['blast_id'], 'clicked' => 1 ) ) );
				if ( 'broadcast' === $s['kind'] && (int) $s['blast_id'] ) {
					$wpdb->query( $wpdb->prepare( 'UPDATE ' . PIP_Store::table( 'blasts' ) . ' SET clicked = clicked + 1 WHERE id = %d', (int) $s['blast_id'] ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
					$cid = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT copy_id FROM ' . PIP_Store::table( 'blasts' ) . ' WHERE id = %d', (int) $s['blast_id'] ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
					if ( $cid ) {
						$wpdb->query( $wpdb->prepare( 'UPDATE ' . PIP_Store::table( 'copies' ) . ' SET click_count = click_count + 1 WHERE id = %d', $cid ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
					}
				}
			}
		}
		return true;
	}

	/**
	 * Métricas por passo (agregados) + fila pendente.
	 *
	 * @return array step_id → {sent, failed, clicked, pending}
	 */
	public static function metrics() {
		global $wpdb;
		$q   = PIP_Store::table( 'queue' );
		$out = array();
		foreach ( PIP_Store::send_stats( 'flow' ) as $id => $m ) {
			$out[ $id ] = array( 'sent' => $m['sent'], 'failed' => $m['failed'], 'clicked' => $m['clicked'], 'pending' => 0 );
		}
		foreach ( $wpdb->get_results( "SELECT step_id, COUNT(*) n FROM {$q} WHERE status IN ('pending','sending') AND blast_id = 0 GROUP BY step_id" ) as $r ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			if ( ! isset( $out[ (int) $r->step_id ] ) ) {
				$out[ (int) $r->step_id ] = array( 'sent' => 0, 'failed' => 0, 'clicked' => 0, 'pending' => 0 );
			}
			$out[ (int) $r->step_id ]['pending'] = (int) $r->n;
		}
		return $out;
	}

	/* ------------------------------------------------------------------ admin */

	/**
	 * URL da tela.
	 *
	 * @param array $args Query.
	 * @return string
	 */
	public static function url( $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => self::PAGE ), $args ), admin_url( 'admin.php' ) );
	}

	/**
	 * Assets da tela.
	 */
	public static function assets() {
		wp_enqueue_script( 'pip-flow-admin', PIP_URL . 'assets/pip-flow-admin.js', array(), PIP_VERSION, true );
		wp_localize_script(
			'pip-flow-admin',
			'PIP_FLOW',
			array(
				'rest'   => esc_url_raw( rest_url( PIP_Rest::NS . '/' ) ),
				'nonce'  => wp_create_nonce( 'wp_rest' ),
				'vapid'  => PIP_Vapid::public_key(),
				'sw'     => PIP_Frontend::sw_url(),
				'scope'  => wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/',
				'site'   => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'icon'   => get_site_icon_url( 192 ) ? get_site_icon_url( 192 ) : PIP_URL . 'assets/app/icon-192.png',
				'twemoji' => 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/',
			)
		);
	}

	/**
	 * Salvar passo.
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_flow_save' );
		$id = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
		$s  = isset( $_POST['s'] ) && is_array( $_POST['s'] ) ? wp_unslash( $_POST['s'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$id = self::save_step( $s, $id ? $id : null );
		wp_safe_redirect( self::url( array( 'step' => $id, 'saved' => 1 ) ) );
		exit;
	}

	/**
	 * Ações rápidas.
	 */
	public static function handle_action() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		$do = isset( $_GET['do'] ) ? sanitize_key( wp_unslash( $_GET['do'] ) ) : '';
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( 'pip_flow_' . $do . '_' . $id );
		global $wpdb;
		$t = PIP_Store::table( 'flow_steps' );
		switch ( $do ) {
			case 'flow_on':
				update_option( self::OPT_ON, '1', false );
				break;
			case 'flow_off':
				update_option( self::OPT_ON, '0', false );
				break;
			case 'enable':
			case 'disable':
				$wpdb->update( $t, array( 'enabled' => 'enable' === $do ? 1 : 0 ), array( 'id' => $id ) );
				break;
			case 'delete':
				self::delete_step( $id );
				break;
			case 'clear_log':
				PIP_Store::clear_log();
				break;
			case 'diag_on':
				PIP_Store::diag_set( 24 );
				break;
			case 'diag_off':
				PIP_Store::diag_set( 0 );
				break;
			case 'prune':
				self::daily();
				break;
		}
		wp_safe_redirect( self::url( array( 'msg' => $do ) ) );
		exit;
	}

	/**
	 * Link de ação com nonce.
	 *
	 * @param string $do Ação.
	 * @param int    $id Id.
	 * @return string
	 */
	private static function action_url( $do, $id = 0 ) {
		return wp_nonce_url( admin_url( 'admin-post.php?action=pip_flow_action&do=' . $do . '&id=' . (int) $id ), 'pip_flow_' . $do . '_' . (int) $id );
	}

	/**
	 * Atraso legível.
	 *
	 * @param int $m Minutos.
	 * @return string
	 */
	public static function delay_label( $m ) {
		if ( $m <= 0 ) {
			return 'logo após ativar';
		}
		if ( 0 === $m % 1440 ) {
			$n = $m / 1440;
			return $n . ( 1 === $n ? ' dia' : ' dias' ) . ' depois';
		}
		if ( 0 === $m % 60 ) {
			$n = $m / 60;
			return $n . ( 1 === $n ? ' hora' : ' horas' ) . ' depois';
		}
		return $m . ' min depois';
	}

	/**
	 * Valor+unidade do editor a partir dos minutos.
	 *
	 * @param int $m Minutos.
	 * @return array{0:int,1:string}
	 */
	private static function split_delay( $m ) {
		if ( $m > 0 && 0 === $m % 1440 ) {
			return array( $m / 1440, 'days' );
		}
		if ( $m > 0 && 0 === $m % 60 ) {
			return array( $m / 60, 'hours' );
		}
		return array( $m, 'minutes' );
	}

	/**
	 * Tela.
	 */
	public static function render() {
		$step_q = isset( $_GET['step'] ) ? sanitize_text_field( wp_unslash( $_GET['step'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		self::notices();
		self::device_card();
		if ( 'new' === $step_q || ( $step_q && self::step( (int) $step_q ) ) ) {
			self::editor( 'new' === $step_q ? self::blank() : self::step( (int) $step_q ) );
		} else {
			self::listing();
			self::diagnostics();
		}
	}

	/**
	 * Diagnóstico: o que cada navegador e o service worker fizeram (últimas linhas).
	 */
	private static function diagnostics() {
		$rows = PIP_Store::logs( 80 );
		global $wpdb;
		$subs = $wpdb->get_results( 'SELECT id, platform, browser, status, created_at, last_seen_at, page_url, RIGHT(endpoint, 10) ep FROM ' . PIP_Store::table( 'subscribers' ) . ' ORDER BY id DESC LIMIT 15', ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		?>
		<section class="pip-card pip-section" style="margin-top:18px" id="pip-diag">
			<div class="pip-toolbar" style="margin:0 0 10px">
				<div>
					<h2 class="pip-section__title" style="margin:0">Diagnóstico</h2>
					<p class="pip-help" style="margin-top:4px">O que cada navegador fez, passo a passo (carregou, viu o popup, aceitou, inscrição criada/renovada, resposta do site, service worker). Use para entender por que um aparelho não recebe.</p>
				</div>
				<div class="pip-toolbar__right">
					<?php $du = PIP_Store::diag_until(); ?>
					<span class="pip-pill<?php echo $du ? ' is-on' : ''; ?>"><i></i> <?php echo $du ? 'ligado até ' . esc_html( wp_date( 'd/m H:i', $du ) ) : 'desligado'; ?></span>
					<?php if ( $du ) : ?>
						<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( 'diag_off' ) ); ?>">Desligar</a>
					<?php else : ?>
						<a class="pip-button is-primary" href="<?php echo esc_url( self::action_url( 'diag_on' ) ); ?>">Ligar por 24 h</a>
					<?php endif; ?>
					<a class="pip-button is-ghost" href="<?php echo esc_url( self::url() ); ?>#pip-diag">Atualizar</a>
					<a class="pip-button is-ghost is-danger" href="<?php echo esc_url( self::action_url( 'clear_log' ) ); ?>">Limpar</a>
				</div>
			</div>
			<p class="pip-help" style="margin-top:-4px">Desligado por padrão: com muitos visitantes, registrar cada passo de cada navegador seria uma escrita no banco por visita. Ligue só para investigar um aparelho; desliga sozinho em 24 h. Os registros com mais de 7 dias são apagados na limpeza diária.</p>
			<h3 class="pip-section__sub">Aparelhos (últimos 15)</h3>
			<table class="pip-table">
				<thead><tr><th>#</th><th>Plataforma</th><th>Estado</th><th>Inscrito em</th><th>Visto em</th><th>Origem</th><th>Endpoint</th></tr></thead>
				<tbody>
				<?php foreach ( $subs as $s ) : ?>
					<tr><td><?php echo (int) $s['id']; ?></td><td><?php echo esc_html( $s['platform'] . ' · ' . $s['browser'] ); ?></td><td><span class="pip-pill<?php echo 'active' === $s['status'] ? ' is-on' : ''; ?>"><i></i> <?php echo esc_html( 'active' === $s['status'] ? 'ativo' : 'expirado' ); ?></span></td><td><?php echo esc_html( mysql2date( 'd/m H:i:s', $s['created_at'] ) ); ?></td><td><?php echo esc_html( mysql2date( 'd/m H:i:s', $s['last_seen_at'] ) ); ?></td><td class="pip-muted"><?php echo esc_html( mb_substr( (string) $s['page_url'], 0, 40 ) ); ?></td><td class="pip-muted">…<?php echo esc_html( $s['ep'] ); ?></td></tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<h3 class="pip-section__sub">Eventos (últimos 80, mais recentes primeiro)</h3>
			<?php if ( ! $rows ) : ?>
				<p class="pip-help"><?php echo PIP_Store::diag_until() ? 'Nada registrado ainda. Abra o site num aparelho e volte aqui.' : 'Nada registrado. Ligue o diagnóstico, abra o site no aparelho que quer investigar e volte aqui.'; ?></p>
			<?php else : ?>
			<table class="pip-table pip-table--log">
				<thead><tr><th>Hora</th><th>Navegador</th><th>Plataforma</th><th>Evento</th><th>Detalhe</th></tr></thead>
				<tbody>
				<?php foreach ( $rows as $r ) : ?>
					<tr><td><?php echo esc_html( mysql2date( 'd/m H:i:s', $r['ts'] ) ); ?></td><td class="pip-muted"><?php echo esc_html( $r['client'] ); ?></td><td><?php echo esc_html( $r['platform'] . ' · ' . $r['browser'] ); ?></td><td><strong><?php echo esc_html( $r['event'] ); ?></strong></td><td class="pip-muted"><?php echo esc_html( $r['detail'] ); ?></td></tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<?php endif; ?>
		</section>
		<?php
	}

	/**
	 * Avisos.
	 */
	private static function notices() {
		$msg = isset( $_GET['msg'] ) ? sanitize_key( wp_unslash( $_GET['msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$map = array(
			'flow_on'  => 'Fluxo ligado: todo novo inscrito recebe a sequência.',
			'flow_off' => 'Fluxo desligado: novos inscritos não entram na sequência (o que já estava na fila não é enviado).',
			'enable'   => 'Passo ligado.',
			'disable'  => 'Passo desligado.',
			'delete'   => 'Passo apagado.',
			'clear_log' => 'Diagnóstico limpo.',
			'diag_on'   => 'Diagnóstico ligado por 24 h: cada navegador e o service worker passam a registrar o que fazem.',
			'diag_off'  => 'Diagnóstico desligado: nada mais é gravado (o que já estava fica até a limpeza).',
			'prune'     => 'Limpeza feita.',
		);
		if ( ! empty( $_GET['saved'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="pip-notice">Passo salvo.</div>';
		} elseif ( isset( $map[ $msg ] ) ) {
			echo '<div class="pip-notice">' . esc_html( $map[ $msg ] ) . '</div>';
		}
		if ( ! PIP_Push::supported() ) {
			echo '<div class="pip-notice is-error">Este servidor não consegue enviar push (PHP sem OpenSSL com ECDH/AES-GCM ou sem hash_hkdf). Peça à hospedagem PHP ≥ 7.3 com OpenSSL.</div>';
		}
		if ( ! PIP_Vapid::keys() ) {
			echo '<div class="pip-notice is-error">Sem chaves VAPID (OpenSSL sem curva P-256): nada pode ser enviado.</div>';
		}
	}

	/**
	 * Card "Este aparelho": inscreve o navegador da equipe e manda um teste.
	 */
	private static function device_card() {
		?>
		<section class="pip-card pip-section pip-device-card" id="pip-device">
			<div class="pip-device-card__head">
				<div>
					<h2 class="pip-section__title">Teste neste aparelho</h2>
					<p class="pip-help">Para a equipe ver as notificações como o visitante vê. Ative neste navegador (ele entra na lista de inscritos como qualquer aparelho) e envie um teste. No iPhone/iPad, abra o painel pelo site adicionado à Tela de Início.</p>
				</div>
				<span class="pip-pill" id="pip-device-status"><i></i> verificando…</span>
			</div>
			<div class="pip-row">
				<button type="button" class="pip-button is-primary" id="pip-device-enable">Ativar notificações neste aparelho</button>
				<button type="button" class="pip-button" id="pip-device-test" disabled>Enviar notificação de teste</button>
				<span class="pip-help" id="pip-device-msg" style="margin:0;align-self:center"></span>
			</div>
		</section>
		<?php
	}

	/**
	 * Linha do tempo dos passos.
	 */
	private static function listing() {
		$steps = self::steps();
		$on    = self::enabled();
		$m     = self::metrics();
		?>
		<div class="pip-toolbar" style="margin-top:18px">
			<div>
				<h2 class="pip-section__title" style="margin:0">Fluxo de ativação</h2>
				<p class="pip-help" style="margin-top:4px">Cada novo inscrito recebe estes passos, contados a partir do momento em que ativou. Quem já estava inscrito antes de um passo existir não o recebe.</p>
			</div>
			<div class="pip-toolbar__right">
				<span class="pip-pill<?php echo $on ? ' is-on' : ''; ?>"><i></i> <?php echo $on ? 'Fluxo ligado' : 'Fluxo desligado'; ?></span>
				<a class="pip-button" href="<?php echo esc_url( self::action_url( $on ? 'flow_off' : 'flow_on' ) ); ?>"><?php echo $on ? 'Desligar fluxo' : 'Ligar fluxo'; ?></a>
				<a class="pip-button is-primary" href="<?php echo esc_url( self::url( array( 'step' => 'new' ) ) ); ?>">+ Nova notificação</a>
			</div>
		</div>
		<div class="pip-timeline">
			<div class="pip-tl-node is-start"><span class="pip-tl-dot"></span><div class="pip-tl-card is-start"><strong>Visitante ativa as notificações</strong><span>O relógio do fluxo começa aqui.</span></div></div>
			<?php if ( ! $steps ) : ?>
				<div class="pip-tl-node"><span class="pip-tl-dot"></span><div class="pip-tl-card is-empty">Nenhuma notificação ainda. Crie a primeira: por exemplo, uma de boas-vindas logo após ativar e outra 30 minutos depois com o seu melhor conteúdo.</div></div>
			<?php endif; ?>
			<?php foreach ( $steps as $s ) : ?>
				<?php $mm = isset( $m[ $s['id'] ] ) ? $m[ $s['id'] ] : array( 'sent' => 0, 'failed' => 0, 'clicked' => 0, 'pending' => 0 ); ?>
				<div class="pip-tl-node<?php echo $s['enabled'] ? '' : ' is-off'; ?>">
					<span class="pip-tl-delay">⏱ <?php echo esc_html( self::delay_label( $s['delay_minutes'] ) ); ?></span>
					<span class="pip-tl-dot"></span>
					<div class="pip-tl-card">
						<div class="pip-notif" data-step="<?php echo (int) $s['id']; ?>">
							<img class="pip-notif__icon" src="<?php echo esc_url( self::icon_url( $s ) ); ?>" alt="">
							<div class="pip-notif__body">
								<div class="pip-notif__site"><?php echo esc_html( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ); ?> · agora</div>
								<div class="pip-notif__title"><?php echo esc_html( $s['title'] ? $s['title'] : '(sem título)' ); ?></div>
								<div class="pip-notif__text"><?php echo esc_html( $s['body'] ); ?></div>
								<?php if ( $s['image_url'] ) : ?><img class="pip-notif__image" src="<?php echo esc_url( $s['image_url'] ); ?>" alt=""><?php endif; ?>
							</div>
						</div>
						<div class="pip-tl-meta">
							<span class="pip-pill<?php echo $s['enabled'] ? ' is-on' : ''; ?>"><i></i> <?php echo $s['enabled'] ? 'Ligada' : 'Desligada'; ?></span>
							<span class="pip-tl-stat"><b><?php echo (int) $mm['sent']; ?></b> enviadas</span>
							<span class="pip-tl-stat"><b><?php echo (int) $mm['clicked']; ?></b> cliques<?php echo $mm['sent'] ? ' · ' . round( 100 * $mm['clicked'] / $mm['sent'] ) . '%' : ''; ?></span>
							<span class="pip-tl-stat"><b><?php echo (int) $mm['pending']; ?></b> na fila</span>
							<?php if ( $mm['failed'] ) : ?><span class="pip-tl-stat is-bad"><b><?php echo (int) $mm['failed']; ?></b> falhas</span><?php endif; ?>
							<span class="pip-tl-link">→ <?php echo esc_html( $s['url'] ? wp_parse_url( $s['url'], PHP_URL_HOST ) . wp_parse_url( $s['url'], PHP_URL_PATH ) : 'início' ); ?></span>
						</div>
						<div class="pip-layout__actions">
							<a class="pip-button" href="<?php echo esc_url( self::url( array( 'step' => $s['id'] ) ) ); ?>">Editar</a>
							<button type="button" class="pip-button is-ghost pip-step-test" data-step="<?php echo (int) $s['id']; ?>">Testar neste aparelho</button>
							<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( $s['enabled'] ? 'disable' : 'enable', $s['id'] ) ); ?>"><?php echo $s['enabled'] ? 'Desligar' : 'Ligar'; ?></a>
							<a class="pip-button is-ghost is-danger" href="<?php echo esc_url( self::action_url( 'delete', $s['id'] ) ); ?>" onclick="return confirm('Apagar esta notificação do fluxo?');">Apagar</a>
						</div>
					</div>
				</div>
			<?php endforeach; ?>
		</div>
		<p class="pip-hint pip-hint--foot">Os envios saem em lotes paralelos por um worker em segundo plano (acordado na hora pelas inscrições e visitas; o cron do WordPress de 1 min é a reserva). Aparelho que não existe mais (navegador reinstalado, permissão removida) é marcado como expirado na 1ª falha definitiva. Veja a saúde do envio em Configurações básicas.</p>
		<?php
	}

	/**
	 * Editor de passo com prévia da notificação.
	 *
	 * @param array $s Passo.
	 */
	private static function editor( $s ) {
		list( $dv, $du ) = self::split_delay( $s['delay_minutes'] );
		?>
		<a class="pip-back" href="<?php echo esc_url( self::url() ); ?>">← Fluxo de ativação</a>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="pip-editor" id="pip-step-form">
			<?php wp_nonce_field( 'pip_flow_save' ); ?>
			<input type="hidden" name="action" value="pip_flow_save">
			<input type="hidden" name="id" value="<?php echo (int) $s['id']; ?>">
			<div class="pip-editor__form">
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Quando enviar</h2>
					<div class="pip-row">
						<label class="pip-field pip-field--sm"><span>Depois de</span><input type="number" name="s[delay_value]" value="<?php echo (int) $dv; ?>" min="0" max="525600"></label>
						<label class="pip-field pip-field--sm"><span>Unidade</span><select name="s[delay_unit]">
							<option value="minutes" <?php selected( 'minutes', $du ); ?>>minutos</option>
							<option value="hours" <?php selected( 'hours', $du ); ?>>horas</option>
							<option value="days" <?php selected( 'days', $du ); ?>>dias</option>
						</select></label>
						<label class="pip-switch"><input type="checkbox" name="s[enabled]" value="1" <?php checked( $s['enabled'] ); ?>><i></i> Ligada</label>
					</div>
					<p class="pip-help">Contado a partir da ativação. 0 minutos = sai na hora em que a pessoa ativa.</p>
				</section>
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Notificação</h2>
					<label class="pip-field"><span>Título</span><input type="text" name="s[title]" value="<?php echo esc_attr( $s['title'] ); ?>" maxlength="120" required></label>
					<label class="pip-field"><span>Texto</span><textarea name="s[body]" rows="3" maxlength="255"><?php echo esc_textarea( $s['body'] ); ?></textarea></label>
					<label class="pip-field"><span>Link ao tocar</span><input type="url" name="s[url]" value="<?php echo esc_attr( $s['url'] ); ?>" maxlength="255" placeholder="<?php echo esc_attr( home_url( '/' ) ); ?>"></label>
					<p class="pip-help">Deixe em branco para abrir a página inicial.</p>
				</section>
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Ícone e imagem</h2>
					<div class="pip-row" data-icon-fields data-mode="<?php echo esc_attr( $s['icon_mode'] ); ?>">
						<label class="pip-field pip-field--sm"><span>Ícone</span><select name="s[icon_mode]">
							<option value="site" <?php selected( 'site', $s['icon_mode'] ); ?>>Ícone do site</option>
							<option value="emoji" <?php selected( 'emoji', $s['icon_mode'] ); ?>>Emoji</option>
							<option value="image" <?php selected( 'image', $s['icon_mode'] ); ?>>Imagem (URL)</option>
						</select></label>
						<label class="pip-field pip-field--sm" data-for="emoji"><span>Emoji</span><input type="text" name="s[icon_emoji]" value="<?php echo esc_attr( $s['icon_emoji'] ); ?>" maxlength="16"></label>
						<label class="pip-field pip-field--grow" data-for="image"><span>URL da imagem do ícone (quadrada, PNG/JPG)</span><input type="url" name="s[icon_url]" value="<?php echo esc_attr( $s['icon_url'] ); ?>" maxlength="255"></label>
					</div>
					<label class="pip-field"><span>Imagem grande (opcional, URL)</span><input type="url" name="s[image_url]" value="<?php echo esc_attr( $s['image_url'] ); ?>" maxlength="255"></label>
					<p class="pip-help">A imagem grande aparece expandida no Android e no Chrome do computador; o iPhone mostra só ícone, título e texto. Emoji vira imagem automaticamente.</p>
				</section>
				<div class="pip-editor__save">
					<button type="submit" class="pip-button is-primary is-lg">Salvar notificação</button>
					<button type="button" class="pip-button" id="pip-step-test-form">Enviar como teste para este aparelho</button>
					<a class="pip-button is-ghost" href="<?php echo esc_url( self::url() ); ?>">Cancelar</a>
				</div>
			</div>
			<aside class="pip-editor__preview">
				<div class="pip-preview-head"><span class="pip-section__title">Prévia</span></div>
				<div class="pip-notif-preview">
					<div class="pip-notif" id="pip-notif-preview">
						<img class="pip-notif__icon" src="<?php echo esc_url( self::icon_url( $s ) ); ?>" alt="">
						<div class="pip-notif__body">
							<div class="pip-notif__site"><?php echo esc_html( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ); ?> · agora</div>
							<div class="pip-notif__title"><?php echo esc_html( $s['title'] ); ?></div>
							<div class="pip-notif__text"><?php echo esc_html( $s['body'] ); ?></div>
							<img class="pip-notif__image" src="<?php echo esc_url( $s['image_url'] ); ?>" alt="" <?php echo $s['image_url'] ? '' : 'hidden'; ?>>
						</div>
					</div>
				</div>
				<p class="pip-help">Aparência aproximada (Android / Chrome). Cada sistema desenha a notificação do seu jeito.</p>
			</aside>
		</form>
		<?php
	}
}
