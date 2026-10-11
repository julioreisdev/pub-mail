<?php
/**
 * Broadcasts: horários do dia (12:00, 12:30…) em que o site sorteia uma copy e dispara para todos os
 * inscritos. Por broadcast: horários, dias da semana, o que fazer com a copy depois (apagar / marcar
 * como usada / manter), som e vibração. "Disparar agora", status de cada horário de hoje, histórico
 * de cada disparo (qual copy, aparelhos, entregues, falhas, cliques) e desempenho por copy.
 * Cada disparo é uma linha em pip_blasts com uma cópia do conteúdo (apagar a copy não apaga o histórico).
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Modelo + agendador + tela.
 */
class PIP_Broadcasts {

	const PAGE  = 'push-in-play-broadcasts';
	const MODES = array(
		'mark_used' => array( 'Marcar como usada', 'A copy sai da lista das disponíveis depois de enviada. Quando todas estiverem usadas, o broadcast para e avisa. Você pode marcá-las como disponíveis de novo na tela Copys.' ),
		'delete'    => array( 'Apagar depois de enviar', 'A copy é apagada da biblioteca logo após o disparo. O histórico e as métricas dela continuam.' ),
		'keep'      => array( 'Manter (pode repetir)', 'A copy continua disponível e pode ser sorteada de novo. O sorteio evita repetir a última enviada.' ),
	);
	const DAYS  = array( 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb' );
	const GRACE = array( 30, 60, 120, 240, 720 );

	/**
	 * Hooks.
	 */
	public static function init() {
		add_action( 'admin_post_pip_broadcasts_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_pip_broadcasts_action', array( __CLASS__, 'handle_action' ) );
	}

	/**
	 * URL da tela.
	 *
	 * @param array $args Query.
	 * @return string
	 */
	public static function url( $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => self::PAGE ), $args ), admin_url( 'admin.php' ) );
	}

	/* ------------------------------------------------------------------ modelo */

	/**
	 * Tipos.
	 *
	 * @param array $r Linha.
	 * @return array
	 */
	private static function cast( $r ) {
		$r['id']            = (int) $r['id'];
		$r['active']        = (bool) $r['active'];
		$times              = json_decode( (string) $r['times'], true );
		$r['times']         = is_array( $times ) ? array_values( array_map( 'intval', $times ) ) : array();
		$days               = json_decode( (string) $r['days'], true );
		$r['days']          = is_array( $days ) ? array_values( array_map( 'intval', $days ) ) : array();
		$r['grace_minutes'] = (int) $r['grace_minutes'];
		return $r;
	}

	/**
	 * Broadcast em branco.
	 *
	 * @return array
	 */
	public static function blank() {
		return array(
			'id'            => 0,
			'name'          => '',
			'active'        => true,
			'times'         => array( 720 ),
			'days'          => array(),
			'after_send'    => 'mark_used',
			'sound'         => '',
			'vibrate'       => '',
			'grace_minutes' => 120,
			'last_fired_at' => null,
			'last_error'    => '',
		);
	}

	/**
	 * Um broadcast.
	 *
	 * @param int $id Id.
	 * @return array|null
	 */
	public static function get( $id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PIP_Store::table( 'broadcasts' ) . ' WHERE id = %d', (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return $row ? self::cast( $row ) : null;
	}

	/**
	 * Todos (ou só ativos).
	 *
	 * @param bool $only_active Só ativos.
	 * @return array
	 */
	public static function all( $only_active = false ) {
		global $wpdb;
		$rows = $wpdb->get_results( 'SELECT * FROM ' . PIP_Store::table( 'broadcasts' ) . ( $only_active ? ' WHERE active = 1' : '' ) . ' ORDER BY id ASC', ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return array_map( array( __CLASS__, 'cast' ), $rows ? $rows : array() );
	}

	/**
	 * "HH:MM" → minuto do dia (null se inválido).
	 *
	 * @param string $s Texto.
	 * @return int|null
	 */
	public static function parse_time( $s ) {
		if ( ! preg_match( '/^\s*(\d{1,2}):(\d{2})\s*$/', (string) $s, $m ) ) {
			return null;
		}
		$h = (int) $m[1];
		$i = (int) $m[2];
		return ( $h >= 0 && $h < 24 && $i >= 0 && $i < 60 ) ? $h * 60 + $i : null;
	}

	/**
	 * Minuto do dia → "HH:MM".
	 *
	 * @param int $t Minuto.
	 * @return string
	 */
	public static function hhmm( $t ) {
		return sprintf( '%02d:%02d', intdiv( (int) $t, 60 ), (int) $t % 60 );
	}

	/**
	 * Grava.
	 *
	 * @param array    $d  Cru (name, active, times[] "HH:MM", days[], after_send, sound, vibrate, grace_minutes).
	 * @param int|null $id Id.
	 * @return int
	 */
	public static function save( $d, $id = null ) {
		global $wpdb;
		$t     = PIP_Store::table( 'broadcasts' );
		$times = array();
		foreach ( (array) ( isset( $d['times'] ) ? $d['times'] : array() ) as $s ) {
			$m = is_int( $s ) ? $s : self::parse_time( $s );
			if ( null !== $m && $m >= 0 && $m < 1440 ) {
				$times[] = (int) $m;
			}
		}
		$times = array_values( array_unique( $times ) );
		sort( $times );
		$times = array_slice( $times, 0, 48 );
		$days  = array();
		foreach ( (array) ( isset( $d['days'] ) ? $d['days'] : array() ) as $v ) {
			$v = (int) $v;
			if ( $v >= 0 && $v <= 6 ) {
				$days[] = $v;
			}
		}
		$days = array_values( array_unique( $days ) );
		sort( $days );
		if ( 7 === count( $days ) ) {
			$days = array(); // todos
		}
		$grace = isset( $d['grace_minutes'] ) ? (int) $d['grace_minutes'] : 120;
		$row   = array(
			'name'          => mb_substr( sanitize_text_field( isset( $d['name'] ) ? (string) $d['name'] : '' ), 0, 120 ),
			'active'        => empty( $d['active'] ) ? 0 : 1,
			'times'         => wp_json_encode( $times ),
			'days'          => wp_json_encode( $days ),
			'after_send'    => isset( $d['after_send'] ) && isset( self::MODES[ $d['after_send'] ] ) ? $d['after_send'] : 'mark_used',
			'sound'         => in_array( isset( $d['sound'] ) ? $d['sound'] : '', array( 'system', 'silent', 'custom' ), true ) ? $d['sound'] : '',
			'vibrate'       => isset( PIP_Settings::VIBRATIONS[ isset( $d['vibrate'] ) ? $d['vibrate'] : '' ] ) ? $d['vibrate'] : '',
			'grace_minutes' => in_array( $grace, self::GRACE, true ) ? $grace : 120,
			'updated_at'    => current_time( 'mysql' ),
		);
		if ( '' === $row['name'] ) {
			$row['name'] = 'Broadcast ' . ( $times ? self::hhmm( $times[0] ) : '' );
		}
		if ( $id ) {
			$wpdb->update( $t, $row, array( 'id' => (int) $id ) );
			return (int) $id;
		}
		$row['created_at'] = $row['updated_at'];
		$wpdb->insert( $t, $row );
		return (int) $wpdb->insert_id;
	}

	/**
	 * Apaga (o histórico fica, com o nome do broadcast na linha do disparo).
	 *
	 * @param int $id Id.
	 */
	public static function delete( $id ) {
		global $wpdb;
		$wpdb->delete( PIP_Store::table( 'broadcasts' ), array( 'id' => (int) $id ) );
	}

	/**
	 * Liga/desliga.
	 *
	 * @param int  $id Id.
	 * @param bool $on Ligado.
	 */
	public static function set_active( $id, $on ) {
		global $wpdb;
		$wpdb->update( PIP_Store::table( 'broadcasts' ), array( 'active' => $on ? 1 : 0, 'updated_at' => current_time( 'mysql' ) ), array( 'id' => (int) $id ) );
	}

	/* ------------------------------------------------------------------ agendador */

	/**
	 * Agora, no fuso do site.
	 *
	 * @return DateTimeImmutable
	 */
	public static function now() {
		return new DateTimeImmutable( 'now', wp_timezone() );
	}

	/**
	 * Confere os horários vencidos de todos os broadcasts ativos e dispara o que ainda não saiu hoje.
	 * Chamado pelo cron de 1 min e pelas visitas (no máx. 1× a cada 20 s). Idempotente: cada horário do
	 * dia é um "slot" único por broadcast em pip_blasts.
	 *
	 * @return int Disparos criados.
	 */
	public static function dispatch() {
		if ( ! PIP_License::active() || get_transient( 'pip_bc_tick' ) ) {
			return 0;
		}
		set_transient( 'pip_bc_tick', 1, 20 );
		$rows = self::all( true );
		if ( ! $rows ) {
			return 0;
		}
		$now   = self::now();
		$mod   = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );
		$today = $now->format( 'Y-m-d' );
		$dow   = (int) $now->format( 'w' );
		$fired = 0;
		foreach ( $rows as $b ) {
			if ( $b['days'] && ! in_array( $dow, $b['days'], true ) ) {
				continue;
			}
			foreach ( $b['times'] as $t ) {
				if ( $t > $mod || $mod - $t > $b['grace_minutes'] ) {
					continue; // ainda não chegou, ou passou da tolerância (site ficou parado)
				}
				$slot = $today . ' ' . self::hhmm( $t );
				if ( self::slot_done( $b['id'], $slot ) ) {
					continue;
				}
				if ( self::fire( $b, $slot, false ) ) {
					$fired++;
				}
			}
		}
		return $fired;
	}

	/**
	 * Este horário de hoje já virou disparo?
	 *
	 * @param int    $broadcast_id Broadcast.
	 * @param string $slot         "Y-m-d HH:MM".
	 * @return bool
	 */
	public static function slot_done( $broadcast_id, $slot ) {
		global $wpdb;
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . PIP_Store::table( 'blasts' ) . ' WHERE broadcast_id = %d AND slot = %s', (int) $broadcast_id, $slot ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Dispara um broadcast: sorteia a copy, cria o disparo (um por slot) e aplica o modo na copy.
	 *
	 * @param array  $b      Broadcast.
	 * @param string $slot   Slot ("Y-m-d HH:MM" ou "m-…" para manual).
	 * @param bool   $inline Enviar alguns segundos aqui mesmo (ações do painel).
	 * @return int Id do disparo (0 = nada).
	 */
	public static function fire( $b, $slot, $inline = true ) {
		global $wpdb;
		$t    = PIP_Store::table( 'broadcasts' );
		$note = function ( $err ) use ( $wpdb, $t, $b ) {
			$wpdb->update( $t, array( 'last_error' => mb_substr( (string) $err, 0, 255 ) ), array( 'id' => (int) $b['id'] ) );
			return 0;
		};
		if ( ! PIP_Store::subscribers_count() ) {
			return $note( 'Nenhum inscrito ativo para receber.' );
		}
		$copy = PIP_Copies::pick( $b['after_send'] );
		if ( ! $copy ) {
			return $note( 'mark_used' === $b['after_send'] ? 'Todas as copys já foram usadas: marque algumas como disponíveis ou cadastre novas.' : 'Nenhuma copy cadastrada.' );
		}
		$d            = PIP_Copies::as_step( $copy );
		$d['sound']   = $b['sound'];
		$d['vibrate'] = $b['vibrate'];
		$bid          = PIP_Flow::blast( $d, array( 'kind' => 'broadcast', 'broadcast_id' => (int) $b['id'], 'copy_id' => $copy['id'], 'slot' => $slot, 'broadcast_name' => $b['name'] ), $inline );
		if ( ! $bid ) {
			return 0; // outro processo já criou este slot
		}
		PIP_Copies::note_sent( $copy['id'], $b['after_send'] );
		$wpdb->update( $t, array( 'last_fired_at' => current_time( 'mysql' ), 'last_error' => '' ), array( 'id' => (int) $b['id'] ) );
		return $bid;
	}

	/**
	 * Status de cada horário de HOJE (sent|partial|failed|sending|pending|missed) por broadcast.
	 *
	 * @param array $rows Broadcasts.
	 * @return array id → [minuto → status]
	 */
	public static function today_status( $rows ) {
		global $wpdb;
		$now   = self::now();
		$mod   = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );
		$today = $now->format( 'Y-m-d' );
		$dow   = (int) $now->format( 'w' );
		$done  = array();
		foreach ( $wpdb->get_results( $wpdb->prepare( 'SELECT broadcast_id, slot, status, total, sent, failed FROM ' . PIP_Store::table( 'blasts' ) . " WHERE kind = 'broadcast' AND slot LIKE %s", $wpdb->esc_like( $today ) . ' %' ), ARRAY_A ) as $r ) { // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$st = 'done' !== $r['status'] ? 'sending' : ( (int) $r['sent'] > 0 ? ( (int) $r['failed'] > 0 ? 'partial' : 'sent' ) : 'failed' );
			$done[ (int) $r['broadcast_id'] ][ substr( $r['slot'], 11 ) ] = $st;
		}
		$out = array();
		foreach ( $rows as $b ) {
			$skip_day = $b['days'] && ! in_array( $dow, $b['days'], true );
			foreach ( $b['times'] as $t ) {
				$k = self::hhmm( $t );
				if ( isset( $done[ $b['id'] ][ $k ] ) ) {
					$out[ $b['id'] ][ $t ] = $done[ $b['id'] ][ $k ];
				} elseif ( $skip_day || ! $b['active'] ) {
					$out[ $b['id'] ][ $t ] = 'off';
				} elseif ( $t > $mod ) {
					$out[ $b['id'] ][ $t ] = 'pending';
				} elseif ( $mod - $t <= $b['grace_minutes'] ) {
					$out[ $b['id'] ][ $t ] = 'due';
				} else {
					$out[ $b['id'] ][ $t ] = 'missed';
				}
			}
		}
		return $out;
	}

	/**
	 * Próximo disparo (timestamp) de um broadcast ativo, ou 0.
	 *
	 * @param array $b Broadcast.
	 * @return int
	 */
	public static function next_fire( $b ) {
		if ( ! $b['active'] || ! $b['times'] ) {
			return 0;
		}
		$now = self::now();
		$mod = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );
		for ( $d = 0; $d < 8; $d++ ) {
			$day = $now->modify( '+' . $d . ' day' );
			if ( $b['days'] && ! in_array( (int) $day->format( 'w' ), $b['days'], true ) ) {
				continue;
			}
			foreach ( $b['times'] as $t ) {
				if ( 0 === $d && $t <= $mod ) {
					continue;
				}
				return (int) $day->setTime( intdiv( $t, 60 ), $t % 60 )->getTimestamp();
			}
		}
		return 0;
	}

	/* ------------------------------------------------------------------ histórico */

	/**
	 * Disparos com copy (broadcast ou "Enviar agora" de uma copy), mais recentes primeiro.
	 *
	 * @param array $a {broadcast_id, copy_id, days, limit}.
	 * @return array
	 */
	public static function history( $a = array() ) {
		global $wpdb;
		$bt    = PIP_Store::table( 'blasts' );
		$conds = array( 'copy_id > 0' );
		if ( ! empty( $a['broadcast_id'] ) ) {
			$conds[] = $wpdb->prepare( 'broadcast_id = %d', (int) $a['broadcast_id'] );
		}
		if ( ! empty( $a['copy_id'] ) ) {
			$conds[] = $wpdb->prepare( 'copy_id = %d', (int) $a['copy_id'] );
		}
		if ( ! empty( $a['days'] ) ) {
			$conds[] = $wpdb->prepare( 'created_at >= %s', gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) ) - (int) $a['days'] * DAY_IN_SECONDS ) );
		}
		$limit = isset( $a['limit'] ) ? max( 1, min( 500, (int) $a['limit'] ) ) : 100;
		$rows  = $wpdb->get_results( "SELECT * FROM {$bt} WHERE " . implode( ' AND ', $conds ) . " ORDER BY id DESC LIMIT {$limit}", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $rows ? $rows : array();
	}

	/**
	 * Desempenho consolidado por copy (todos os disparos dela).
	 *
	 * @param int|null $days Período (null = tudo).
	 * @return array
	 */
	public static function copy_metrics( $days = null ) {
		global $wpdb;
		$bt    = PIP_Store::table( 'blasts' );
		$ct    = PIP_Store::table( 'copies' );
		$where = 'b.copy_id > 0';
		if ( $days ) {
			$where .= $wpdb->prepare( ' AND b.created_at >= %s', gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) ) - (int) $days * DAY_IN_SECONDS ) );
		}
		$rows = $wpdb->get_results( "SELECT b.copy_id, COUNT(*) runs, SUM(b.total) total, SUM(b.sent) sent, SUM(b.failed) failed, SUM(b.clicked) clicked, MAX(b.created_at) last_at, SUBSTRING_INDEX(GROUP_CONCAT(b.title ORDER BY b.id DESC SEPARATOR '\n'), '\n', 1) title, c.id still, c.used FROM {$bt} b LEFT JOIN {$ct} c ON c.id = b.copy_id WHERE {$where} GROUP BY b.copy_id ORDER BY sent DESC, runs DESC LIMIT 300", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $rows ? $rows : array();
	}

	/* ------------------------------------------------------------------ handlers */

	/**
	 * Salvar.
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_broadcasts_save' );
		$id = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
		$b  = isset( $_POST['b'] ) && is_array( $_POST['b'] ) ? wp_unslash( $_POST['b'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$id = self::save( $b, $id ? $id : null );
		delete_transient( 'pip_bc_tick' );
		wp_safe_redirect( self::url( array( 'msg' => 'saved' ) ) );
		exit;
	}

	/**
	 * Ações por link.
	 */
	public static function handle_action() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		$do = isset( $_GET['do'] ) ? sanitize_key( wp_unslash( $_GET['do'] ) ) : '';
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( 'pip_broadcasts_' . $do . '_' . $id );
		$args = array( 'msg' => $do );
		switch ( $do ) {
			case 'on':
			case 'off':
				self::set_active( $id, 'on' === $do );
				delete_transient( 'pip_bc_tick' );
				break;
			case 'delete':
				self::delete( $id );
				break;
			case 'fire':
				$b = self::get( $id );
				if ( $b ) {
					$bid  = self::fire( $b, 'm-' . substr( str_replace( '.', '', uniqid( '', true ) ), -14 ), true );
					$args = $bid ? array( 'msg' => 'fired', 'blast' => $bid ) : array( 'msg' => 'fire_fail', 'id' => $id );
				}
				break;
		}
		wp_safe_redirect( self::url( $args ) );
		exit;
	}

	/* ------------------------------------------------------------------ tela */

	/**
	 * Scripts.
	 */
	public static function assets() {
		wp_enqueue_script( 'pip-broadcasts-admin', PIP_URL . 'assets/pip-broadcasts-admin.js', array(), PIP_VERSION, true );
	}

	/**
	 * Link de ação com nonce.
	 *
	 * @param string $do Ação.
	 * @param int    $id Id.
	 * @return string
	 */
	private static function action_url( $do, $id ) {
		return wp_nonce_url( admin_url( 'admin-post.php?action=pip_broadcasts_action&do=' . $do . '&id=' . (int) $id ), 'pip_broadcasts_' . $do . '_' . (int) $id );
	}

	/**
	 * Tela.
	 */
	public static function render() {
		self::notices();
		if ( isset( $_GET['new'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			self::editor( self::blank() );
			return;
		}
		if ( isset( $_GET['edit'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$b = self::get( (int) $_GET['edit'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $b ) {
				self::editor( $b );
				return;
			}
		}
		$view = isset( $_GET['view'] ) ? sanitize_key( wp_unslash( $_GET['view'] ) ) : 'list'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		?>
		<div class="pip-seg pip-seg--views" role="group" aria-label="Seções">
			<a class="pip-seg__item<?php echo 'history' !== $view ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url() ); ?>">Broadcasts</a>
			<a class="pip-seg__item<?php echo 'history' === $view ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array( 'view' => 'history' ) ) ); ?>">Histórico e métricas</a>
		</div>
		<?php
		if ( 'history' === $view ) {
			self::history_view();
		} else {
			self::listing();
		}
	}

	/**
	 * Avisos.
	 */
	private static function notices() {
		$msg = isset( $_GET['msg'] ) ? sanitize_key( wp_unslash( $_GET['msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$map = array(
			'saved'  => 'Broadcast salvo.',
			'on'     => 'Broadcast ligado.',
			'off'    => 'Broadcast desligado (os horários não disparam).',
			'delete' => 'Broadcast apagado (o histórico continua).',
		);
		if ( 'fired' === $msg ) {
			$bl = isset( $_GET['blast'] ) ? PIP_Flow::blast_row( (int) $_GET['blast'] ) : null; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="pip-notice">Disparado agora' . ( $bl ? ': "' . esc_html( $bl['title'] ) . '" para ' . (int) $bl['total'] . ' aparelho(s), ' . (int) $bl['sent'] . ' já entregues' . ( 'done' === $bl['status'] ? '.' : ' — o resto sai em segundo plano.' ) : '.' ) . ' <a href="' . esc_url( self::url( array( 'view' => 'history' ) ) ) . '">Ver no histórico</a>.</div>';
		} elseif ( 'fire_fail' === $msg ) {
			$b = isset( $_GET['id'] ) ? self::get( (int) $_GET['id'] ) : null; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="pip-notice is-warn">Não disparou: ' . esc_html( $b && $b['last_error'] ? $b['last_error'] : 'nenhuma copy disponível ou nenhum inscrito.' ) . '</div>';
		} elseif ( isset( $map[ $msg ] ) ) {
			echo '<div class="pip-notice">' . esc_html( $map[ $msg ] ) . '</div>';
		}
	}

	/**
	 * Rótulo do limite de atraso.
	 *
	 * @param int $m Minutos.
	 * @return string
	 */
	public static function grace_label( $m ) {
		$m = (int) $m;
		return $m >= 60 ? ( $m / 60 ) . ' h' : $m . ' min';
	}

	/**
	 * Rótulo dos dias.
	 *
	 * @param int[] $days Dias.
	 * @return string
	 */
	private static function days_label( $days ) {
		if ( ! $days || 7 === count( $days ) ) {
			return 'todos os dias';
		}
		if ( array( 1, 2, 3, 4, 5 ) === $days ) {
			return 'dias úteis';
		}
		if ( array( 0, 6 ) === $days ) {
			return 'fins de semana';
		}
		return implode( ', ', array_map( function ( $d ) {
			return self::DAYS[ $d ];
		}, $days ) );
	}

	/**
	 * Lista.
	 */
	private static function listing() {
		$rows   = self::all();
		$status = self::today_status( $rows );
		$copies = PIP_Copies::counts();
		$labels = array(
			'sent'    => array( 'is-ok', 'enviado hoje' ),
			'partial' => array( 'is-warn', 'enviado com falhas' ),
			'failed'  => array( 'is-bad', 'falhou' ),
			'sending' => array( 'is-run', 'enviando' ),
			'due'     => array( 'is-run', 'disparando (aguarde o próximo minuto)' ),
			'pending' => array( 'is-wait', 'ainda hoje' ),
			'missed'  => array( '', 'não rodou hoje: o site ficou parado além do limite de atraso' ),
			'off'     => array( '', 'não dispara hoje' ),
		);
		?>
		<div class="pip-toolbar">
			<div class="pip-kpis">
				<div class="pip-kpi"><span class="pip-kpi__label">Broadcasts</span><span class="pip-kpi__value"><?php echo (int) count( $rows ); ?></span></div>
				<div class="pip-kpi is-accent"><span class="pip-kpi__label">Copys disponíveis</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $copies['available'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Inscritos ativos</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( PIP_Store::subscribers_count() ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Agora no site</span><span class="pip-kpi__value" style="font-size:18px"><?php echo esc_html( self::now()->format( 'H:i' ) ); ?></span></div>
			</div>
			<div class="pip-toolbar__right">
				<a class="pip-button is-primary" href="<?php echo esc_url( self::url( array( 'new' => 1 ) ) ); ?>">+ Novo broadcast</a>
			</div>
		</div>
		<?php if ( ! $copies['total'] ) : ?>
			<div class="pip-notice is-warn">Nenhuma copy cadastrada: os broadcasts não têm o que sortear. <a href="<?php echo esc_url( PIP_Copies::url() ); ?>">Cadastre ou importe copys</a>.</div>
		<?php elseif ( ! $copies['available'] ) : ?>
			<div class="pip-notice is-warn">Todas as copys estão marcadas como usadas: broadcasts com "marcar como usada" não vão disparar. <a href="<?php echo esc_url( PIP_Copies::url( array( 'filter' => 'used' ) ) ); ?>">Marque algumas como disponíveis</a> ou cadastre novas.</div>
		<?php endif; ?>
		<?php if ( ! $rows ) : ?>
			<section class="pip-card pip-empty">
				<span class="pip-empty__icon" aria-hidden="true"><?php echo PIP_Admin::icon( 'speakerphone', 30 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
				<h2 class="pip-empty__title">Nenhum broadcast ainda</h2>
				<p class="pip-empty__text">Um broadcast é uma lista de horários do dia (12:00, 12:30…). Em cada horário o site sorteia uma copy da biblioteca e envia para todos os inscritos — e você decide o que acontece com a copy depois.</p>
				<div class="pip-empty__actions">
					<a class="pip-button is-primary is-lg" href="<?php echo esc_url( self::url( array( 'new' => 1 ) ) ); ?>"><?php echo PIP_Admin::icon( 'plus', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Criar o primeiro broadcast</a>
					<?php if ( ! $copies['total'] ) : ?><a class="pip-button is-lg" href="<?php echo esc_url( PIP_Copies::url() ); ?>"><?php echo PIP_Admin::icon( 'copy', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Cadastrar copys antes</a><?php endif; ?>
				</div>
			</section>
		<?php endif; ?>
		<?php
		$nowtz   = self::now();
		$now_pct = ( (int) $nowtz->format( 'G' ) * 60 + (int) $nowtz->format( 'i' ) ) / 1440 * 100;
		?>
		<div class="pip-bcs">
			<?php foreach ( $rows as $b ) : ?>
				<?php $next = self::next_fire( $b ); ?>
				<article class="pip-card pip-bc<?php echo $b['active'] ? ' is-on' : ''; ?>">
					<div class="pip-bc__head">
						<div class="pip-bc__title">
							<h3><?php echo esc_html( $b['name'] ); ?></h3>
							<span class="pip-layout__type"><?php echo esc_html( self::MODES[ $b['after_send'] ][0] ); ?> · <?php echo esc_html( self::days_label( $b['days'] ) ); ?> · atrasado até <?php echo esc_html( self::grace_label( $b['grace_minutes'] ) ); ?></span>
						</div>
						<span class="pip-pill<?php echo $b['active'] ? ' is-on' : ''; ?>"><i></i> <?php echo $b['active'] ? 'Ligado' : 'Desligado'; ?></span>
					</div>
					<div class="pip-bc__times">
						<?php if ( ! $b['times'] ) : ?><span class="pip-muted">sem horários</span><?php endif; ?>
						<?php foreach ( $b['times'] as $t ) : ?>
							<?php $st = isset( $status[ $b['id'] ][ $t ] ) ? $status[ $b['id'] ][ $t ] : 'off'; ?>
							<span class="pip-time <?php echo esc_attr( $labels[ $st ][0] ); ?>" title="<?php echo esc_attr( $labels[ $st ][1] ); ?>"><i></i><?php echo esc_html( self::hhmm( $t ) ); ?></span>
						<?php endforeach; ?>
					</div>
					<div class="pip-day" aria-label="Linha do dia de hoje">
						<div class="pip-day__track">
							<span class="pip-day__now" style="left:<?php echo esc_attr( round( $now_pct, 2 ) ); ?>%" title="agora · <?php echo esc_attr( $nowtz->format( 'H:i' ) ); ?>"></span>
							<?php foreach ( $b['times'] as $t ) : ?>
								<?php $st = isset( $status[ $b['id'] ][ $t ] ) ? $status[ $b['id'] ][ $t ] : 'off'; ?>
								<i class="pip-day__t <?php echo esc_attr( $labels[ $st ][0] ); ?>" style="left:<?php echo esc_attr( round( $t / 1440 * 100, 2 ) ); ?>%" title="<?php echo esc_attr( self::hhmm( $t ) . ' · ' . $labels[ $st ][1] ); ?>"></i>
							<?php endforeach; ?>
						</div>
						<div class="pip-day__hours"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div>
					</div>
					<div class="pip-bc__meta">
						<span class="pip-tl-stat">último disparo: <b><?php echo $b['last_fired_at'] ? esc_html( mysql2date( 'd/m H:i', $b['last_fired_at'] ) ) : 'nunca'; ?></b></span>
						<span class="pip-tl-stat">próximo: <b><?php echo $next ? esc_html( wp_date( 'D d/m H:i', $next ) ) : '—'; ?></b></span>
						<span class="pip-tl-stat">copys que pode sortear: <b><?php echo esc_html( number_format_i18n( PIP_Copies::available_count( $b['after_send'] ) ) ); ?></b></span>
					</div>
					<?php if ( $b['last_error'] ) : ?>
						<div class="pip-notice is-warn" style="margin:0">⚠ <?php echo esc_html( $b['last_error'] ); ?></div>
					<?php endif; ?>
					<div class="pip-layout__actions">
						<a class="pip-button is-primary" href="<?php echo esc_url( self::action_url( 'fire', $b['id'] ) ); ?>" onclick="return confirm('Sortear uma copy e disparar AGORA para todos os inscritos?');"><?php echo PIP_Admin::icon( 'send', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Disparar agora</a>
						<a class="pip-button" href="<?php echo esc_url( self::url( array( 'edit' => $b['id'] ) ) ); ?>"><?php echo PIP_Admin::icon( 'edit', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Editar</a>
						<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( $b['active'] ? 'off' : 'on', $b['id'] ) ); ?>"><?php echo PIP_Admin::icon( 'power', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> <?php echo $b['active'] ? 'Desligar' : 'Ligar'; ?></a>
						<a class="pip-button is-ghost" href="<?php echo esc_url( self::url( array( 'view' => 'history', 'broadcast' => $b['id'] ) ) ); ?>"><?php echo PIP_Admin::icon( 'clock', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Histórico</a>
						<a class="pip-button is-ghost is-danger" href="<?php echo esc_url( self::action_url( 'delete', $b['id'] ) ); ?>" onclick="return confirm('Apagar este broadcast? O histórico dos disparos continua.');" aria-label="Apagar"><?php echo PIP_Admin::icon( 'trash', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></a>
					</div>
				</article>
			<?php endforeach; ?>
		</div>
		<section class="pip-card pip-legend" aria-label="Como funciona">
			<h3 class="pip-section__title">Como funciona</h3>
			<dl class="pip-legend__list">
				<div><dt>Horários</dt><dd>No fuso do site (Configurações → Geral). Quando bate a hora, o site sorteia uma copy e cria o disparo para todos os inscritos ativos; o envio sai em segundo plano em lotes paralelos.</dd></div>
				<div><dt>Sorteio</dt><dd>"Marcar como usada" sorteia só entre as disponíveis e tira a copy da lista depois; "apagar" remove a copy da biblioteca; "manter" deixa a copy voltar, evitando repetir a última enviada.</dd></div>
				<div><dt>Atraso</dt><dd>O WordPress só trabalha quando alguém visita o site (ou quando há um cron do sistema). Se bater a hora com o site "dormindo", o disparo sai assim que ele acordar, desde que o atraso caiba no limite do broadcast ("enviar atrasado até"). Passou do limite, aquele horário fica como "não rodou hoje" e nada sai fora de hora.</dd></div>
				<div><dt>Bolinhas dos horários</dt><dd>Verde = enviado hoje · âmbar = com falhas · vermelho = falhou · azul = enviando · amarelo = ainda hoje · cinza = não rodou/não dispara hoje.</dd></div>
				<div><dt>Histórico</dt><dd>Cada disparo guarda a copy enviada, quantos aparelhos, entregues, falhas e cliques. Apagar a copy ou o broadcast não apaga o histórico.</dd></div>
			</dl>
		</section>
		<?php
	}

	/**
	 * Editor.
	 *
	 * @param array $b Broadcast.
	 */
	private static function editor( $b ) {
		?>
		<a class="pip-back" href="<?php echo esc_url( self::url() ); ?>">← Todos os broadcasts</a>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="pip-editor pip-editor--single" id="pip-bc-form">
			<?php wp_nonce_field( 'pip_broadcasts_save' ); ?>
			<input type="hidden" name="action" value="pip_broadcasts_save">
			<input type="hidden" name="id" value="<?php echo (int) $b['id']; ?>">
			<div class="pip-editor__form">
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Broadcast</h2>
					<div class="pip-row">
						<label class="pip-field pip-field--grow"><span>Nome (interno)</span><input type="text" name="b[name]" value="<?php echo esc_attr( $b['name'] ); ?>" maxlength="120" placeholder="Ex.: Ofertas do meio-dia"></label>
						<label class="pip-switch" style="align-self:flex-end;margin-bottom:6px"><input type="checkbox" name="b[active]" value="1" <?php checked( $b['active'] ); ?>><i></i> Ligado</label>
					</div>
				</section>
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Horários do dia</h2>
					<p class="pip-help">No fuso do site (agora são <?php echo esc_html( self::now()->format( 'H:i' ) ); ?>). Em cada horário sai um disparo com uma copy sorteada.</p>
					<div class="pip-times" data-times>
						<?php foreach ( $b['times'] as $t ) : ?>
							<div class="pip-times__row"><input type="time" name="b[times][]" value="<?php echo esc_attr( self::hhmm( $t ) ); ?>" required><button type="button" class="pip-button is-ghost is-danger" data-remove-time aria-label="Remover horário">×</button></div>
						<?php endforeach; ?>
					</div>
					<button type="button" class="pip-button" data-add-time>+ Adicionar horário</button>
					<h3 class="pip-section__sub">Dias da semana</h3>
					<div class="pip-days">
						<?php foreach ( self::DAYS as $i => $label ) : ?>
							<label class="pip-check"><input type="checkbox" name="b[days][]" value="<?php echo (int) $i; ?>" <?php checked( ! $b['days'] || in_array( $i, $b['days'], true ) ); ?>><span><?php echo esc_html( $label ); ?></span></label>
						<?php endforeach; ?>
					</div>
					<p class="pip-help">Nenhum marcado = todos os dias.</p>
				</section>
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Depois de enviar, a copy sorteada…</h2>
					<div class="pip-choices">
						<?php foreach ( self::MODES as $k => $m ) : ?>
							<label class="pip-choice<?php echo $k === $b['after_send'] ? ' is-active' : ''; ?>"><input type="radio" name="b[after_send]" value="<?php echo esc_attr( $k ); ?>" <?php checked( $k, $b['after_send'] ); ?>><b><?php echo esc_html( $m[0] ); ?></b><span><?php echo esc_html( $m[1] ); ?></span></label>
						<?php endforeach; ?>
					</div>
				</section>
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Som, vibração e atraso</h2>
					<div class="pip-row">
						<label class="pip-field pip-field--sm"><span>Som</span><select name="b[sound]">
							<option value="" <?php selected( '', $b['sound'] ); ?>>Padrão das configurações</option>
							<option value="system" <?php selected( 'system', $b['sound'] ); ?>>Som do sistema</option>
							<option value="silent" <?php selected( 'silent', $b['sound'] ); ?>>Silenciosa</option>
							<option value="custom" <?php selected( 'custom', $b['sound'] ); ?>>Personalizado (site aberto)</option>
						</select></label>
						<label class="pip-field pip-field--sm"><span>Vibração</span><select name="b[vibrate]">
							<option value="" <?php selected( '', $b['vibrate'] ); ?>>Padrão das configurações</option>
							<?php foreach ( PIP_Settings::VIBRATIONS as $k => $v ) : ?><option value="<?php echo esc_attr( $k ); ?>" <?php selected( $k, $b['vibrate'] ); ?>><?php echo esc_html( $v[0] ); ?></option><?php endforeach; ?>
						</select></label>
						<label class="pip-field pip-field--sm"><span>Enviar atrasado até</span><select name="b[grace_minutes]">
							<?php foreach ( self::GRACE as $g ) : ?><option value="<?php echo (int) $g; ?>" <?php selected( $g, $b['grace_minutes'] ); ?>><?php echo esc_html( self::grace_label( $g ) ); ?> depois do horário</option><?php endforeach; ?>
						</select></label>
					</div>
					<p class="pip-help"><strong>Por que existe "enviar atrasado até":</strong> o WordPress só executa tarefas quando alguém visita o site (ou quando a hospedagem tem um cron do sistema). Se bater a hora e o site estiver "dormindo", o disparo sai assim que ele acordar — desde que o atraso seja menor que este limite. Passou do limite, aquele horário fica como "não rodou hoje" e nada é enviado fora de hora. Em sites com visitas o dia todo, o atraso é de segundos.</p>
				</section>
				<div class="pip-editor__save">
					<button type="submit" class="pip-button is-primary is-lg">Salvar broadcast</button>
					<a class="pip-button is-ghost" href="<?php echo esc_url( self::url() ); ?>">Cancelar</a>
				</div>
			</div>
		</form>
		<?php
	}

	/**
	 * Histórico + desempenho por copy.
	 */
	private static function history_view() {
		$bid    = isset( $_GET['broadcast'] ) ? (int) $_GET['broadcast'] : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$cid    = isset( $_GET['copy'] ) ? (int) $_GET['copy'] : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$days   = isset( $_GET['days'] ) ? sanitize_key( wp_unslash( $_GET['days'] ) ) : '30'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$days   = in_array( $days, array( '7', '30', '90', 'all' ), true ) ? $days : '30';
		$ndays  = 'all' === $days ? null : (int) $days;
		$rows   = self::history( array( 'broadcast_id' => $bid, 'copy_id' => $cid, 'days' => $ndays, 'limit' => 150 ) );
		$metric = self::copy_metrics( $ndays );
		$bcs    = array();
		foreach ( self::all() as $b ) {
			$bcs[ $b['id'] ] = $b['name'];
		}
		$tot = array( 'runs' => 0, 'total' => 0, 'sent' => 0, 'failed' => 0, 'clicked' => 0 );
		foreach ( $rows as $r ) {
			$tot['runs']++;
			$tot['total']   += (int) $r['total'];
			$tot['sent']    += (int) $r['sent'];
			$tot['failed']  += (int) $r['failed'];
			$tot['clicked'] += (int) $r['clicked'];
		}
		$qs = array( 'view' => 'history' );
		if ( $bid ) {
			$qs['broadcast'] = $bid;
		}
		if ( $cid ) {
			$qs['copy'] = $cid;
		}
		?>
		<div class="pip-toolbar">
			<div class="pip-kpis">
				<div class="pip-kpi"><span class="pip-kpi__label">Disparos</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['runs'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Aparelhos</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['total'] ) ); ?></span></div>
				<div class="pip-kpi is-accent"><span class="pip-kpi__label">Entregues</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['sent'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Falhas</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['failed'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Cliques</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['clicked'] ) ); ?><?php echo $tot['sent'] ? ' <small>' . esc_html( round( 100 * $tot['clicked'] / $tot['sent'], 1 ) ) . '%</small>' : ''; ?></span></div>
			</div>
			<div class="pip-toolbar__right">
				<div class="pip-seg" role="group" aria-label="Período">
					<?php foreach ( array( '7' => '7 dias', '30' => '30 dias', '90' => '90 dias', 'all' => 'Tudo' ) as $k => $label ) : ?>
						<a class="pip-seg__item<?php echo $k === $days ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array_merge( $qs, array( 'days' => $k ) ) ) ); ?>"><?php echo esc_html( $label ); ?></a>
					<?php endforeach; ?>
				</div>
				<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" class="pip-filters">
					<input type="hidden" name="page" value="<?php echo esc_attr( self::PAGE ); ?>"><input type="hidden" name="view" value="history"><input type="hidden" name="days" value="<?php echo esc_attr( $days ); ?>">
					<select name="broadcast" class="pip-filters__select"><option value="0">Todos os broadcasts</option><?php foreach ( $bcs as $id => $name ) : ?><option value="<?php echo (int) $id; ?>" <?php selected( $id, $bid ); ?>><?php echo esc_html( $name ); ?></option><?php endforeach; ?></select>
					<?php if ( $cid ) : ?><input type="hidden" name="copy" value="<?php echo (int) $cid; ?>"><?php endif; ?>
					<button type="submit" class="pip-button is-ghost">Filtrar</button>
					<?php if ( $cid || $bid ) : ?><a class="pip-button is-ghost" href="<?php echo esc_url( self::url( array( 'view' => 'history', 'days' => $days ) ) ); ?>">Limpar</a><?php endif; ?>
				</form>
			</div>
		</div>

		<section class="pip-card pip-section">
			<h2 class="pip-section__title">Desempenho por copy <small><?php echo 'all' === $days ? 'desde sempre' : 'últimos ' . (int) $days . ' dias'; ?></small></h2>
			<?php if ( ! $metric ) : ?>
				<p class="pip-help">Nenhum disparo com copy no período.</p>
			<?php else : ?>
			<table class="pip-table pip-table--metrics">
				<thead><tr><th>Copy</th><th>Disparos</th><th>Aparelhos</th><th>Entregues</th><th>Falhas</th><th>Cliques</th><th>CTR</th><th>Último</th><th>Estado</th></tr></thead>
				<tbody>
				<?php foreach ( $metric as $m ) : ?>
					<?php $ctr = (int) $m['sent'] ? round( 100 * (int) $m['clicked'] / (int) $m['sent'], 1 ) : 0; ?>
					<tr class="<?php echo (int) $m['copy_id'] === $cid ? 'is-active' : ''; ?>">
						<td><a href="<?php echo esc_url( self::url( array( 'view' => 'history', 'days' => $days, 'copy' => (int) $m['copy_id'] ) ) ); ?>"><strong><?php echo esc_html( $m['title'] ); ?></strong></a></td>
						<td><?php echo (int) $m['runs']; ?></td>
						<td><?php echo esc_html( number_format_i18n( (int) $m['total'] ) ); ?></td>
						<td><?php echo esc_html( number_format_i18n( (int) $m['sent'] ) ); ?></td>
						<td><?php echo esc_html( number_format_i18n( (int) $m['failed'] ) ); ?></td>
						<td><?php echo esc_html( number_format_i18n( (int) $m['clicked'] ) ); ?></td>
						<td><div class="pip-ctr"><span style="width:<?php echo esc_attr( min( 100, $ctr ) ); ?>%"></span><b><?php echo esc_html( $ctr ); ?>%</b></div></td>
						<td><?php echo esc_html( mysql2date( 'd/m H:i', $m['last_at'] ) ); ?></td>
						<td><?php if ( ! $m['still'] ) : ?><span class="pip-pill"><i></i> apagada</span><?php elseif ( (int) $m['used'] ) : ?><span class="pip-pill"><i></i> usada</span><?php else : ?><span class="pip-pill is-on"><i></i> disponível</span><?php endif; ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<?php endif; ?>
		</section>

		<section class="pip-card pip-section" style="margin-top:18px">
			<h2 class="pip-section__title">Disparos <small><?php echo $bid && isset( $bcs[ $bid ] ) ? esc_html( $bcs[ $bid ] ) : ( $cid ? 'desta copy' : 'todos' ); ?> · mais recentes primeiro (até 150)</small></h2>
			<?php if ( ! $rows ) : ?>
				<p class="pip-help">Nenhum disparo no período com esse filtro.</p>
			<?php else : ?>
			<table class="pip-table">
				<thead><tr><th>Quando</th><th>Copy enviada</th><th>Origem</th><th>Aparelhos</th><th>Entregues</th><th>Falhas</th><th>Cliques</th><th>Estado</th></tr></thead>
				<tbody>
				<?php foreach ( $rows as $r ) : ?>
					<?php $ctr = (int) $r['sent'] ? round( 100 * (int) $r['clicked'] / (int) $r['sent'], 1 ) : 0; ?>
					<tr>
						<td><?php echo esc_html( mysql2date( 'd/m H:i', $r['created_at'] ) ); ?></td>
						<td><strong><?php echo esc_html( $r['title'] ); ?></strong><br><span class="pip-muted"><?php echo esc_html( mb_substr( $r['body'], 0, 90 ) ); ?></span></td>
						<td><?php if ( 'broadcast' === $r['kind'] ) : ?><?php echo esc_html( isset( $bcs[ (int) $r['broadcast_id'] ] ) ? $bcs[ (int) $r['broadcast_id'] ] : ( $r['broadcast_name'] ? $r['broadcast_name'] . ' (apagado)' : 'broadcast' ) ); ?><br><span class="pip-muted"><?php echo esc_html( $r['slot'] && 0 !== strpos( (string) $r['slot'], 'm-' ) ? 'horário ' . substr( $r['slot'], 11 ) : 'disparo manual' ); ?></span><?php else : ?>Enviar agora (Copys)<?php endif; ?></td>
						<td><?php echo (int) $r['total']; ?></td>
						<td><?php echo (int) $r['sent']; ?></td>
						<td><?php echo (int) $r['failed']; ?></td>
						<td><?php echo (int) $r['clicked']; ?><?php echo (int) $r['sent'] ? ' <span class="pip-muted">· ' . esc_html( $ctr ) . '%</span>' : ''; ?></td>
						<td><span class="pip-pill<?php echo 'done' === $r['status'] ? ' is-on' : ''; ?>"><i></i> <?php echo 'done' === $r['status'] ? 'concluído' : 'enviando'; ?></span></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<?php endif; ?>
			<p class="pip-help">"Entregues" = aceitas pelo serviço de push (Google, Apple, Mozilla); a exibição depende do aparelho estar ligado e com internet. Cliques = toques na notificação (1 por aparelho). Os totais acima somam só os disparos listados.</p>
		</section>
		<?php
	}
}
