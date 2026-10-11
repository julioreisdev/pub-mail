<?php
/**
 * Sincronização de métricas com o Pub Mail (só na edição baixada pelo Pub Mail).
 *
 * O site manda um RESUMO para o Pub Mail — inscritos, convite de permissão, envios e cliques por dia,
 * últimos disparos, copys com mais cliques, passos da automação e saúde da fila — a cada 15 minutos
 * e logo depois que um disparo termina. Com isso o dono vê todos os sites no painel do Pub Mail sem
 * entrar em cada WordPress. Só números, títulos e datas saem do site: nenhum inscrito, endpoint,
 * chave VAPID ou texto de visitante.
 *
 * O Pub Mail também pode PEDIR o resumo na hora ("Sincronizar agora" no painel): POST /pip/v1/sync
 * com um token derivado da chave da conta (HMAC em janelas de 5 min) — sem a chave não há resposta.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Resumo + envio.
 */
class PIP_Sync {

	const OPT      = 'pip_sync';      // {at, ok, error, reason, ms}
	const NEXT     = 'pip_sync_next'; // transient: enquanto existir, não manda (15 min)
	const SOON     = 'pip_sync_soon'; // transient: disparo terminou → manda no próximo tick
	const LOCK     = 'pip_sync_lock';
	const INTERVAL = 900;
	const DAYS     = 31;
	const VERSION  = 1;

	/**
	 * Edição do Pub Mail com chave configurada?
	 *
	 * @return bool
	 */
	public static function enabled() {
		if ( ! PIP_License::managed() || ! PIP_License::configured() ) {
			return false;
		}
		// chave que o Pub Mail já recusou (trocada/inválida): não insiste a cada 15 min — volta sozinho quando a chave mudar.
		$s = PIP_License::state();
		return ! in_array( isset( $s['status'] ) ? (string) $s['status'] : '', array( 'revoked', 'invalid', 'missing' ), true );
	}

	/**
	 * Manda agora se a requisição não é de visitante (admin, cron, WP-CLI); senão deixa para o próximo tick.
	 *
	 * @param string $reason Motivo.
	 * @return bool
	 */
	public static function push_or_soon( $reason ) {
		if ( is_admin() || wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return self::push( $reason );
		}
		self::soon();
		return false;
	}

	/**
	 * Último envio.
	 *
	 * @return array
	 */
	public static function state() {
		$s = get_option( self::OPT );
		return is_array( $s ) ? $s : array();
	}

	/**
	 * Um disparo terminou (ou algo relevante mudou): manda no próximo tick, sem esperar os 15 min.
	 */
	public static function soon() {
		if ( self::enabled() ) {
			set_transient( self::SOON, 1, HOUR_IN_SECONDS );
		}
	}

	/**
	 * Chamado a cada minuto (cron) e no fim de cada rodada do worker: manda se venceu o intervalo
	 * ou se um disparo acabou de terminar. Barato quando não há nada a fazer (2 transients).
	 *
	 * @return bool Enviou.
	 */
	public static function maybe_push() {
		if ( ! self::enabled() ) {
			return false;
		}
		if ( get_transient( self::NEXT ) && ! get_transient( self::SOON ) ) {
			return false;
		}
		if ( get_transient( self::LOCK ) ) {
			return false;
		}
		set_transient( self::LOCK, 1, 60 );
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 60 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- vem depois de uma rodada do worker; o POST tem 10 s.
		}
		$ok = self::push( get_transient( self::SOON ) ? 'blast' : 'timer' );
		delete_transient( self::LOCK );
		return $ok;
	}

	/**
	 * Manda o resumo agora.
	 *
	 * @param string $reason timer|blast|manual|install|pull (só para o registro).
	 * @return bool
	 */
	public static function push( $reason = 'timer' ) {
		if ( ! self::enabled() ) {
			return false;
		}
		delete_transient( self::SOON );
		set_transient( self::NEXT, 1, self::INTERVAL );
		$t0 = microtime( true );
		$r  = wp_remote_post(
			PIP_LICENSE_API . '/public/wp-plugin/stats',
			array(
				'timeout' => 10,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'key'    => PIP_LICENSE_KEY,
						'plugin' => PIP_License::SLUG,
						'site'   => home_url( '/' ),
						'v'      => PIP_VERSION,
						'reason' => $reason,
						'stats'  => self::snapshot(),
					)
				),
			)
		);
		$code  = is_wp_error( $r ) ? 0 : (int) wp_remote_retrieve_response_code( $r );
		$ok    = $code >= 200 && $code < 300;
		$j     = $ok ? json_decode( (string) wp_remote_retrieve_body( $r ), true ) : null;
		$error = '';
		if ( is_wp_error( $r ) ) {
			$error = substr( $r->get_error_message(), 0, 200 );
		} elseif ( ! $ok ) {
			$error = 'HTTP ' . $code;
		} elseif ( ! is_array( $j ) || empty( $j['ok'] ) ) {
			$ok    = false;
			$error = is_array( $j ) && ! empty( $j['status'] ) ? sanitize_key( (string) $j['status'] ) : 'resposta inválida';
		}
		if ( $ok && isset( $j['next'] ) ) {
			set_transient( self::NEXT, 1, max( 300, min( DAY_IN_SECONDS, (int) $j['next'] ) ) );
		}
		update_option(
			self::OPT,
			array(
				'at'     => time(),
				'ok'     => $ok ? 1 : 0,
				'error'  => $error,
				'reason' => sanitize_key( $reason ),
				'ms'     => (int) round( ( microtime( true ) - $t0 ) * 1000 ),
			),
			false
		);
		return $ok;
	}

	/**
	 * Token do "Sincronizar agora" do Pub Mail: HMAC da chave em janelas de 5 min (aceita a anterior e a
	 * seguinte, para relógios um pouco fora).
	 *
	 * @param string $t Token recebido.
	 * @return bool
	 */
	public static function token_ok( $t ) {
		if ( ! self::enabled() || ! is_string( $t ) || 64 !== strlen( $t ) ) {
			return false;
		}
		$w = (int) floor( time() / 300 );
		foreach ( array( $w, $w - 1, $w + 1 ) as $x ) {
			if ( hash_equals( hash_hmac( 'sha256', 'pip-sync|' . $x, (string) PIP_LICENSE_KEY ), $t ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Texto curto para o card de licença.
	 *
	 * @return string
	 */
	public static function label() {
		$s = self::state();
		if ( empty( $s['at'] ) ) {
			return 'Métricas ainda não enviadas ao Pub Mail.';
		}
		$ago = human_time_diff( (int) $s['at'], time() );
		if ( ! empty( $s['ok'] ) ) {
			return 'Métricas enviadas ao Pub Mail há ' . $ago . '.';
		}
		return 'Último envio de métricas ao Pub Mail falhou há ' . $ago . ( ! empty( $s['error'] ) ? ' (' . $s['error'] . ')' : '' ) . '.';
	}

	/**
	 * O resumo. Tudo vem de agregados/contagens com índice — nada de varrer inscritos ou envios.
	 *
	 * @return array
	 */
	public static function snapshot() {
		global $wpdb;
		$subs   = PIP_Store::table( 'subscribers' );
		$stats  = PIP_Store::table( 'stats' );
		$sstats = PIP_Store::table( 'send_stats' );
		$queue  = PIP_Store::table( 'queue' );
		$blasts = PIP_Store::table( 'blasts' );
		$copies = PIP_Store::table( 'copies' );
		$bcasts = PIP_Store::table( 'broadcasts' );
		$steps  = PIP_Store::table( 'flow_steps' );
		$lays   = PIP_Store::table( 'layouts' );
		$sends  = PIP_Store::table( 'sends' );
		$today  = current_time( 'Y-m-d' );
		$since  = gmdate( 'Y-m-d', strtotime( $today ) - ( self::DAYS - 1 ) * DAY_IN_SECONDS );
		$int    = function ( $row, $k ) {
			return $row && isset( $row->$k ) ? (int) $row->$k : 0;
		};

		// inscritos: uma consulta só, coberta pelo índice (status, platform) — não varre a tabela mesmo com milhões
		$active  = 0;
		$expired = 0;
		$total   = 0;
		$plat    = array();
		foreach ( $wpdb->get_results( "SELECT status, platform, COUNT(*) n FROM {$subs} GROUP BY status, platform" ) as $r ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$n      = (int) $r->n;
			$total += $n;
			if ( 'active' === $r->status ) {
				$active += $n;
				$k          = sanitize_key( (string) $r->platform );
				$k          = '' === $k ? 'outro' : $k;
				$plat[ $k ] = ( isset( $plat[ $k ] ) ? $plat[ $k ] : 0 ) + $n;
			} elseif ( 'expired' === $r->status ) {
				$expired += $n;
			}
		}

		// convite de permissão: totais (tudo) e por dia (31 d)
		$pt = $wpdb->get_row( "SELECT SUM(impressions) imp, SUM(clicks) clk, SUM(granted) grt, SUM(denied) den, SUM(dismissed) dis, SUM(installed) ins FROM {$stats}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$pd = $wpdb->get_results( $wpdb->prepare( "SELECT day, SUM(impressions) imp, SUM(clicks) clk, SUM(granted) grt, SUM(denied) den, SUM(dismissed) dis, SUM(installed) ins FROM {$stats} WHERE day >= %s GROUP BY day", $since ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		// envios: totais (tudo) e por dia/origem (31 d)
		$st = $wpdb->get_row( "SELECT SUM(sent) sent, SUM(failed) failed, SUM(clicked) clicked FROM {$sstats}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$sd = $wpdb->get_results( $wpdb->prepare( "SELECT day, kind, SUM(sent) sent, SUM(failed) failed, SUM(clicked) clicked FROM {$sstats} WHERE day >= %s GROUP BY day, kind", $since ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$days  = array();
		$blank = array(
			'imp'       => 0,
			'clk'       => 0,
			'grt'       => 0,
			'den'       => 0,
			'dis'       => 0,
			'ins'       => 0,
			'sent'      => 0,
			'failed'    => 0,
			'clicked'   => 0,
			'sent_flow' => 0,
			'sent_bc'   => 0,
		);
		foreach ( $pd ? $pd : array() as $r ) {
			$d          = substr( (string) $r->day, 0, 10 );
			$days[ $d ] = array_merge(
				$blank,
				array(
					'imp' => (int) $r->imp,
					'clk' => (int) $r->clk,
					'grt' => (int) $r->grt,
					'den' => (int) $r->den,
					'dis' => (int) $r->dis,
					'ins' => (int) $r->ins,
				)
			);
		}
		foreach ( $sd ? $sd : array() as $r ) {
			$d = substr( (string) $r->day, 0, 10 );
			if ( ! isset( $days[ $d ] ) ) {
				$days[ $d ] = $blank;
			}
			$days[ $d ]['sent']    += (int) $r->sent;
			$days[ $d ]['failed']  += (int) $r->failed;
			$days[ $d ]['clicked'] += (int) $r->clicked;
			if ( 'broadcast' === $r->kind ) {
				$days[ $d ]['sent_bc'] += (int) $r->sent;
			} else {
				$days[ $d ]['sent_flow'] += (int) $r->sent;
			}
		}
		ksort( $days );
		$series = array();
		foreach ( $days as $d => $v ) {
			$series[] = array_merge( array( 'd' => $d ), $v );
		}

		// cadastro
		$c  = PIP_Copies::counts();
		$b  = $wpdb->get_row( "SELECT COUNT(*) total, SUM(active = 1) active FROM {$bcasts}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$f  = $wpdb->get_row( "SELECT COUNT(*) total, SUM(enabled = 1) enabled FROM {$steps}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$l  = $wpdb->get_row( "SELECT COUNT(*) total, SUM(enabled = 1) enabled FROM {$lays}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		// fila e saúde
		$q    = $wpdb->get_row( "SELECT SUM(status = 'pending') pending, SUM(status = 'sending') sending FROM {$queue} WHERE status IN ('pending', 'sending')" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$f24  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(failed), 0) FROM {$sstats} WHERE day >= %s", gmdate( 'Y-m-d', strtotime( $today ) - DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$ls   = $wpdb->get_var( "SELECT sent_at FROM {$sends} ORDER BY id DESC LIMIT 1" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cron = (int) get_option( 'pip_cron_last', 0 );
		$next = wp_next_scheduled( PIP_Flow::CRON_HOOK );
		$lic  = PIP_License::state();

		// últimos disparos
		$bl = array();
		foreach ( $wpdb->get_results( "SELECT id, title, kind, broadcast_name, copy_id, total, sent, failed, clicked, status, created_at FROM {$blasts} ORDER BY id DESC LIMIT 10", ARRAY_A ) as $r ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$bl[] = array(
				'id'        => (int) $r['id'],
				'title'     => (string) $r['title'],
				'kind'      => (string) $r['kind'],
				'broadcast' => (string) $r['broadcast_name'],
				'copy_id'   => (int) $r['copy_id'],
				'total'     => (int) $r['total'],
				'sent'      => (int) $r['sent'],
				'failed'    => (int) $r['failed'],
				'clicked'   => (int) $r['clicked'],
				'status'    => (string) $r['status'],
				'at'        => (int) get_gmt_from_date( (string) $r['created_at'], 'U' ),
			);
		}

		// copys com mais cliques
		$tc = array();
		foreach ( $wpdb->get_results( "SELECT id, title, sent_count, click_count, used FROM {$copies} WHERE sent_count > 0 ORDER BY click_count DESC, sent_count DESC LIMIT 8", ARRAY_A ) as $r ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$tc[] = array(
				'id'      => (int) $r['id'],
				'title'   => (string) $r['title'],
				'sent'    => (int) $r['sent_count'],
				'clicked' => (int) $r['click_count'],
				'used'    => (int) $r['used'],
			);
		}

		// passos da automação com métricas
		$sm = PIP_Store::send_stats( 'flow' );
		$fs = array();
		foreach ( $wpdb->get_results( "SELECT id, title, delay_minutes, enabled FROM {$steps} ORDER BY position ASC, id ASC LIMIT 20", ARRAY_A ) as $r ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$id   = (int) $r['id'];
			$m    = isset( $sm[ $id ] ) ? $sm[ $id ] : array( 'sent' => 0, 'failed' => 0, 'clicked' => 0 );
			$fs[] = array(
				'id'      => $id,
				'title'   => (string) $r['title'],
				'delay'   => (int) $r['delay_minutes'],
				'enabled' => (int) $r['enabled'],
				'sent'    => (int) $m['sent'],
				'clicked' => (int) $m['clicked'],
			);
		}

		return array(
			'v'           => self::VERSION,
			'at'          => time(),
			'site'        => array(
				'name' => (string) get_bloginfo( 'name' ),
				'tz'   => (string) wp_timezone_string(),
			),
			'plugin'      => array(
				'version'       => PIP_VERSION,
				'flow_enabled'  => PIP_Flow::enabled() ? 1 : 0,
				'layouts'       => $int( $l, 'total' ),
				'layouts_on'    => $int( $l, 'enabled' ),
				'copies'        => (int) $c['total'],
				'copies_free'   => (int) $c['available'],
				'copies_used'   => (int) $c['used'],
				'broadcasts'    => $int( $b, 'total' ),
				'broadcasts_on' => $int( $b, 'active' ),
				'steps'         => $int( $f, 'total' ),
				'steps_on'      => $int( $f, 'enabled' ),
				'push_ok'       => PIP_Push::supported() ? 1 : 0,
				'vapid'         => PIP_Vapid::public_key() ? 1 : 0,
				'license'       => PIP_License::active() ? 1 : 0,
				'license_ok'    => isset( $lic['ok'] ) ? (int) $lic['ok'] : 0,
			),
			'subscribers' => array(
				'active'      => $active,
				'expired'     => $expired,
				'total'       => $total,
				'by_platform' => (object) $plat,
			),
			'totals'      => array(
				'imp'     => $int( $pt, 'imp' ),
				'clk'     => $int( $pt, 'clk' ),
				'grt'     => $int( $pt, 'grt' ),
				'den'     => $int( $pt, 'den' ),
				'dis'     => $int( $pt, 'dis' ),
				'ins'     => $int( $pt, 'ins' ),
				'sent'    => $int( $st, 'sent' ),
				'failed'  => $int( $st, 'failed' ),
				'clicked' => $int( $st, 'clicked' ),
			),
			'days'        => $series,
			'health'      => array(
				'pending'    => $int( $q, 'pending' ),
				'sending'    => $int( $q, 'sending' ),
				'failed_24h' => $f24,
				'last_send'  => $ls ? (int) get_gmt_from_date( (string) $ls, 'U' ) : 0,
				'cron_last'  => $cron,
				'cron_ok'    => ( $cron && time() - $cron < 5 * MINUTE_IN_SECONDS ) || ( $next && $next > time() - 5 * MINUTE_IN_SECONDS ) ? 1 : 0,
				'cron_off'   => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ? 1 : 0,
				'parallel'   => PIP_Push::parallel_supported() ? 1 : 0,
			),
			'blasts'      => $bl,
			'copies_top'  => $tc,
			'steps'       => $fs,
		);
	}
}
