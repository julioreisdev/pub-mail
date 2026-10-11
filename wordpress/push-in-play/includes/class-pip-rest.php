<?php
/**
 * REST pública do site: eventos do popup (impressão/clique/recusa) e inscrição no push.
 * Sem login (o visitante é anônimo). Entradas validadas e limitadas; nada é devolvido ao visitante
 * além de um ok.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rotas pip/v1.
 */
class PIP_Rest {

	const NS = 'pip/v1';

	/**
	 * Registra as rotas.
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/**
	 * Rotas.
	 */
	public static function routes() {
		register_rest_route(
			self::NS,
			'/event',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'event' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/subscribe',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'subscribe' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/log',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'log' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/nclick',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'nclick' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/worker',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'worker' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/sync',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'sync' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/admin/test',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'admin_test' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	}

	/**
	 * POST /worker {t} — loopback que roda o worker em segundo plano (token assinado; ver PIP_Flow::kick).
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function worker( $req ) {
		if ( ! PIP_Flow::worker_token_ok( (string) $req->get_param( 't' ) ) ) {
			return new WP_REST_Response( array( 'ok' => false ), 403 );
		}
		$n = PIP_Flow::run_worker( 'kick' );
		PIP_Sync::maybe_push(); // já está em segundo plano: aproveita para mandar o resumo ao Pub Mail se venceu
		return new WP_REST_Response( array( 'ok' => true, 'rows' => (int) $n ), 200 );
	}

	/**
	 * POST /sync {t} — o Pub Mail pede o resumo de métricas na hora ("Sincronizar agora"). O token vem da
	 * chave da conta (PIP_Sync::token_ok); sem a chave, 403. Só na edição do Pub Mail.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function sync( $req ) {
		if ( ! self::allow( 'sync', 20 ) ) {
			return new WP_REST_Response( array( 'ok' => false ), 429 );
		}
		$b = self::body( $req );
		if ( ! PIP_Sync::token_ok( isset( $b['t'] ) ? (string) $b['t'] : (string) $req->get_param( 't' ) ) ) {
			return new WP_REST_Response( array( 'ok' => false ), 403 );
		}
		$stats = PIP_Sync::snapshot();
		update_option( PIP_Sync::OPT, array( 'at' => time(), 'ok' => 1, 'error' => '', 'reason' => 'pull', 'ms' => 0 ), false );
		return new WP_REST_Response( array( 'ok' => true, 'stats' => $stats ), 200 );
	}

	/**
	 * Limite simples por IP (transient por minuto). true = pode.
	 *
	 * @param string $what Rota.
	 * @param int    $max  Máximo por minuto.
	 * @return bool
	 */
	private static function allow( $what, $max ) {
		$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$key = 'pip_rl_' . $what . '_' . substr( md5( $ip ), 0, 12 );
		$n   = (int) get_transient( $key );
		if ( $n >= $max ) {
			return false;
		}
		set_transient( $key, $n + 1, MINUTE_IN_SECONDS );
		return true;
	}

	/**
	 * POST /log {client, events:[{e,d}]} — diagnóstico do navegador/service worker (só grava com o
	 * diagnóstico ligado no painel; desligado = 204 sem tocar no banco).
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function log( $req ) {
		if ( ! PIP_Store::diag_on() || ! self::allow( 'log', 40 ) ) {
			return new WP_REST_Response( null, 204 );
		}
		$b  = self::body( $req );
		$ev = isset( $b['events'] ) && is_array( $b['events'] ) ? $b['events'] : array();
		if ( $ev ) {
			$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
			PIP_Store::log_events( isset( $b['client'] ) ? (string) $b['client'] : '', $ev, self::device( $ua ) );
		}
		return new WP_REST_Response( null, 204 );
	}

	/**
	 * POST /nclick?id&k — clique numa notificação (chamado pelo service worker).
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function nclick( $req ) {
		PIP_Flow::clicked( (int) $req->get_param( 'id' ), (string) $req->get_param( 'k' ) );
		return new WP_REST_Response( null, 204 );
	}

	/**
	 * POST /admin/test {subscription, step_id?, register_only?} — inscreve o aparelho da equipe e envia um teste.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function admin_test( $req ) {
		$b   = self::body( $req );
		$sub = self::parse_subscription( $b );
		if ( ! $sub ) {
			return new WP_REST_Response( array( 'ok' => false, 'error' => 'Inscrição inválida.' ), 400 );
		}
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? mb_substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '';
		PIP_Store::upsert_subscriber( $sub, 0, array_merge( self::device( $ua ), array( 'user_agent' => $ua, 'page_url' => 'wp-admin' ) ) );
		$id = PIP_Store::$last_subscriber_id;
		if ( ! empty( $b['register_only'] ) ) {
			return new WP_REST_Response( array( 'ok' => true, 'subscriber_id' => $id ), 200 );
		}
		$step = ! empty( $b['step_id'] ) ? PIP_Flow::step( (int) $b['step_id'] ) : null;
		if ( ! empty( $b['copy_id'] ) ) {
			$copy = PIP_Copies::get( (int) $b['copy_id'] );
			$step = $copy ? PIP_Copies::as_step( $copy ) : null;
		}
		if ( ! empty( $b['step'] ) && is_array( $b['step'] ) ) {
			// teste do formulário ainda não salvo
			$f    = wp_unslash( $b['step'] );
			$step = array_merge( PIP_Flow::blank(), array(
				'title'      => mb_substr( sanitize_text_field( isset( $f['title'] ) ? $f['title'] : '' ), 0, 120 ),
				'body'       => mb_substr( sanitize_textarea_field( isset( $f['body'] ) ? $f['body'] : '' ), 0, 255 ),
				'icon_mode'  => in_array( isset( $f['icon_mode'] ) ? $f['icon_mode'] : '', PIP_Flow::ICON_MODES, true ) ? $f['icon_mode'] : 'site',
				'icon_emoji' => mb_substr( sanitize_text_field( isset( $f['icon_emoji'] ) ? $f['icon_emoji'] : '' ), 0, 16 ),
				'icon_url'   => esc_url_raw( isset( $f['icon_url'] ) ? $f['icon_url'] : '' ),
				'image_url'  => esc_url_raw( isset( $f['image_url'] ) ? $f['image_url'] : '' ),
				'url'        => esc_url_raw( isset( $f['url'] ) ? $f['url'] : '' ),
			) );
		}
		$res = PIP_Flow::deliver( $id, $sub, $step, 'test' );
		return new WP_REST_Response( array( 'ok' => $res['ok'], 'code' => $res['code'], 'error' => $res['error'] ), 200 );
	}

	/**
	 * {subscription:{endpoint, keys:{p256dh, auth}}} validado → {endpoint, p256dh, auth} ou null.
	 *
	 * @param array $b Corpo.
	 * @return array|null
	 */
	private static function parse_subscription( $b ) {
		$s    = isset( $b['subscription'] ) && is_array( $b['subscription'] ) ? $b['subscription'] : array();
		$keys = isset( $s['keys'] ) && is_array( $s['keys'] ) ? $s['keys'] : array();
		$ep   = isset( $s['endpoint'] ) ? esc_url_raw( (string) $s['endpoint'] ) : '';
		$p256 = isset( $keys['p256dh'] ) ? preg_replace( '/[^A-Za-z0-9_=-]/', '', (string) $keys['p256dh'] ) : '';
		$auth = isset( $keys['auth'] ) ? preg_replace( '/[^A-Za-z0-9_=-]/', '', (string) $keys['auth'] ) : '';
		if ( ! $ep || strlen( $p256 ) < 80 || strlen( $p256 ) > 255 || strlen( $auth ) < 16 || strlen( $auth ) > 64 || ! PIP_Push::endpoint_ok( $ep ) ) {
			return null;
		}
		return array( 'endpoint' => $ep, 'p256dh' => $p256, 'auth' => $auth );
	}

	/**
	 * Corpo JSON (o sendBeacon manda como blob JSON; o fetch como application/json).
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return array
	 */
	private static function body( $req ) {
		$j = $req->get_json_params();
		if ( is_array( $j ) ) {
			return $j;
		}
		$j = json_decode( (string) $req->get_body(), true );
		return is_array( $j ) ? $j : array();
	}

	/**
	 * POST /event {layout_id, event}.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function event( $req ) {
		$b     = self::body( $req );
		$id    = isset( $b['layout_id'] ) ? (int) $b['layout_id'] : 0;
		$event = isset( $b['event'] ) ? sanitize_key( $b['event'] ) : '';
		// "granted" só é contado pelo servidor, na inscrição (prova real); o resto vem do navegador.
		if ( $id > 0 && in_array( $event, array( 'impression', 'click', 'denied', 'dismissed', 'installed' ), true ) && in_array( $id, PIP_Store::layout_ids(), true ) ) {
			$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
			PIP_Store::bump( $id, $event, self::device( $ua )['platform'] );
		}
		PIP_Flow::maybe_process(); // só acorda o worker em segundo plano (nunca envia nesta requisição)
		return new WP_REST_Response( null, 204 );
	}

	/**
	 * POST /subscribe {subscription:{endpoint, keys:{p256dh, auth}}, layout_id, page}.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function subscribe( $req ) {
		if ( ! self::allow( 'sub', 30 ) ) {
			return new WP_REST_Response( array( 'ok' => false ), 429 );
		}
		$b   = self::body( $req );
		$sub = self::parse_subscription( $b );
		if ( ! $sub ) {
			return new WP_REST_Response( array( 'ok' => false ), 400 );
		}
		$ep   = $sub['endpoint'];
		$p256 = $sub['p256dh'];
		$auth = $sub['auth'];
		$layout_id = isset( $b['layout_id'] ) ? (int) $b['layout_id'] : 0;
		if ( $layout_id && ! PIP_Store::layout( $layout_id ) ) {
			$layout_id = 0;
		}
		$ua   = isset( $_SERVER['HTTP_USER_AGENT'] ) ? mb_substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '';
		$page = isset( $b['page'] ) ? mb_substr( esc_url_raw( (string) $b['page'] ), 0, 255 ) : '';
		$dev  = self::device( $ua );
		$old  = isset( $b['old_endpoint'] ) ? esc_url_raw( (string) $b['old_endpoint'] ) : '';
		$old  = ( $old && strlen( $old ) <= 1000 && 0 === strpos( $old, 'https://' ) ) ? $old : '';
		$new  = PIP_Store::upsert_subscriber(
			array(
				'endpoint' => $ep,
				'p256dh'   => $p256,
				'auth'     => $auth,
			),
			$layout_id,
			array_merge(
				$dev,
				array(
					'user_agent' => $ua,
					'page_url'   => $page,
				)
			),
			$old
		);
		$id = PIP_Store::$last_subscriber_id;
		PIP_Store::log_events( isset( $b['client'] ) ? (string) $b['client'] : '', array( array( 'e' => 'srv-subscribe', 'd' => wp_json_encode( array( 'id' => $id, 'new' => $new, 'replaced' => PIP_Store::$last_replaced, 'expired' => PIP_Store::$last_was_expired, 'ep' => substr( $ep, -10 ), 'old' => $old ? substr( $old, -10 ) : '', 'page' => mb_substr( $page, 0, 60 ) ) ) ) ), $dev );
		if ( $new && $layout_id ) {
			PIP_Store::bump( $layout_id, 'granted', $dev['platform'] );
		}
		if ( $new ) {
			PIP_Flow::enqueue( $id );
		}
		if ( $new || PIP_Store::$last_replaced ) {
			PIP_Flow::process_subscriber( $id ); // o passo "logo após ativar" (ou o que tinha falhado) sai agora
		}
		if ( PIP_Store::$last_was_expired && empty( $b['renewed'] ) ) {
			// o push service já recusou este endpoint: pede ao navegador uma inscrição nova (o status só
			// volta a 'active' quando a nova chegar)
			$GLOBALS['wpdb']->update( PIP_Store::table( 'subscribers' ), array( 'status' => 'expired' ), array( 'id' => $id ) );
			return new WP_REST_Response( array( 'ok' => true, 'expired' => true, 'subscriber_id' => $id ), 200 );
		}
		return new WP_REST_Response( array( 'ok' => true, 'subscriber_id' => $id, 'replaced' => PIP_Store::$last_replaced ), 200 );
	}

	/**
	 * Plataforma e navegador a partir do User-Agent (métricas por plataforma e lista de inscritos).
	 *
	 * @param string $ua User-Agent.
	 * @return array{platform:string,browser:string}
	 */
	public static function device( $ua ) {
		$platform = 'outro';
		if ( preg_match( '/iPhone|iPad|iPod/i', $ua ) ) {
			$platform = 'ios';
		} elseif ( preg_match( '/Android/i', $ua ) ) {
			$platform = 'android';
		} elseif ( preg_match( '/Windows/i', $ua ) ) {
			$platform = 'windows';
		} elseif ( preg_match( '/Macintosh|Mac OS/i', $ua ) ) {
			$platform = 'macos';
		} elseif ( preg_match( '/Linux/i', $ua ) ) {
			$platform = 'linux';
		}
		$browser = 'outro';
		if ( preg_match( '/Edg\//i', $ua ) ) {
			$browser = 'edge';
		} elseif ( preg_match( '/OPR\//i', $ua ) ) {
			$browser = 'opera';
		} elseif ( preg_match( '/SamsungBrowser/i', $ua ) ) {
			$browser = 'samsung';
		} elseif ( preg_match( '/Firefox\//i', $ua ) ) {
			$browser = 'firefox';
		} elseif ( preg_match( '/Chrome\//i', $ua ) ) {
			$browser = 'chrome';
		} elseif ( preg_match( '/Safari\//i', $ua ) ) {
			$browser = 'safari';
		}
		return array(
			'platform' => $platform,
			'browser'  => $browser,
		);
	}
}
