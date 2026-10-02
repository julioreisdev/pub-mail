<?php
/**
 * Endpoints públicos usados pelo script da página.
 *
 * REST:  GET  /wp-json/trinv/v1/p?u=<caminho>&l=<idioma>   → mapa de traduções da página
 *        POST /wp-json/trinv/v1/t {u,l,p,s:[...]}            → traduz trechos (cache + Google)
 * Se o REST estiver bloqueado para visitantes (plugins de segurança), o script usa os mesmos
 * handlers via admin-ajax.php (action=trinv_p / trinv_t).
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * API pública.
 */
class TRINV_API {

	const MAX_ITEMS      = 800;
	const MAX_ITEM_BYTES = 6000;
	const MAX_BYTES      = 200000;
	const IP_BYTES       = 200000;   // caracteres novos por IP a cada 10 min.
	const GLOBAL_BYTES   = 1500000;  // caracteres novos por hora no site todo.

	/**
	 * Registra rotas e ações.
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'wp_ajax_trinv_p', array( __CLASS__, 'ajax_page' ) );
		add_action( 'wp_ajax_nopriv_trinv_p', array( __CLASS__, 'ajax_page' ) );
		add_action( 'wp_ajax_trinv_t', array( __CLASS__, 'ajax_translate' ) );
		add_action( 'wp_ajax_nopriv_trinv_t', array( __CLASS__, 'ajax_translate' ) );
		add_action( 'wp_ajax_trinv_s', array( __CLASS__, 'ajax_slug' ) );
		add_action( 'wp_ajax_nopriv_trinv_s', array( __CLASS__, 'ajax_slug' ) );
	}

	/**
	 * Rotas REST.
	 */
	public static function routes() {
		register_rest_route(
			'trinv/v1',
			'/p',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_page' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'trinv/v1',
			'/s',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'rest_slug' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'trinv/v1',
			'/t',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_translate' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * REST: mapa da página.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function rest_page( $req ) {
		$res  = self::page( (string) $req->get_param( 'u' ), (string) $req->get_param( 'l' ) );
		$resp = new WP_REST_Response( $res['body'], $res['status'] );
		$resp->header( 'Cache-Control', 'no-cache' );
		$resp->header( 'X-Robots-Tag', 'noindex' );
		return $resp;
	}

	/**
	 * REST: traduzir.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function rest_translate( $req ) {
		$data = $req->get_json_params();
		$res  = self::translate( is_array( $data ) ? $data : array() );
		$resp = new WP_REST_Response( $res['body'], $res['status'] );
		$resp->header( 'Cache-Control', 'no-store' );
		$resp->header( 'X-Robots-Tag', 'noindex' );
		return $resp;
	}

	/**
	 * REST: endereço traduzido de um post.
	 *
	 * @param WP_REST_Request $req Requisição.
	 * @return WP_REST_Response
	 */
	public static function rest_slug( $req ) {
		$res  = self::slug( (int) $req->get_param( 'p' ), (string) $req->get_param( 'l' ) );
		$resp = new WP_REST_Response( $res['body'], $res['status'] );
		$resp->header( 'Cache-Control', 'no-cache' );
		$resp->header( 'X-Robots-Tag', 'noindex' );
		return $resp;
	}

	/**
	 * admin-ajax: endereço traduzido.
	 */
	public static function ajax_slug() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- endpoint público.
		$p   = isset( $_GET['p'] ) ? absint( $_GET['p'] ) : 0;
		$l   = isset( $_GET['l'] ) ? sanitize_text_field( wp_unslash( $_GET['l'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$res = self::slug( $p, $l );
		nocache_headers();
		wp_send_json( $res['body'], $res['status'] );
	}

	/**
	 * Endereço traduzido (gera uma vez por post e idioma).
	 *
	 * @param int    $p Post.
	 * @param string $l Idioma.
	 * @return array
	 */
	public static function slug( $p, $l ) {
		if ( ! TRINV_License::active() ) {
			return self::stopped();
		}
		$l = TRINV_Langs::normalize( $l );
		if ( ! $p || '' === $l ) {
			return array(
				'status' => 400,
				'body'   => array( 'error' => 'bad_request' ),
			);
		}
		$post = get_post( $p );
		$path = '';
		if ( $post instanceof WP_Post ) {
			$path = TRINV_Slugs::path_for( $post, $l );
			if ( '' === $path && TRINV_Translator::available() && self::allow( strlen( (string) $post->post_title ) ) ) {
				$path = TRINV_Slugs::ensure( $p, $l );
			}
		}
		return array(
			'status' => 200,
			'body'   => array(
				's' => $path,
				'o' => $post instanceof WP_Post ? TRINV_Slugs::original_path( $post ) : '',
			),
		);
	}

	/**
	 * admin-ajax: mapa da página.
	 */
	public static function ajax_page() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- endpoint público, somente leitura.
		$u   = isset( $_GET['u'] ) ? sanitize_text_field( wp_unslash( $_GET['u'] ) ) : '';
		$l   = isset( $_GET['l'] ) ? sanitize_text_field( wp_unslash( $_GET['l'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$res = self::page( $u, $l );
		nocache_headers();
		wp_send_json( $res['body'], $res['status'] );
	}

	/**
	 * admin-ajax: traduzir (corpo JSON).
	 */
	public static function ajax_translate() {
		$raw  = file_get_contents( 'php://input' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$data = json_decode( (string) $raw, true );
		$res  = self::translate( is_array( $data ) ? $data : array() );
		nocache_headers();
		wp_send_json( $res['body'], $res['status'] );
	}

	/**
	 * Mapa da página.
	 *
	 * @param string $u Caminho.
	 * @param string $l Idioma.
	 * @return array
	 */
	public static function page( $u, $l ) {
		if ( ! TRINV_License::active() ) {
			return self::stopped();
		}
		$l = TRINV_Langs::normalize( $l );
		$u = self::clean_path( $u );
		if ( ! $l || '' === $u ) {
			return array(
				'status' => 400,
				'body'   => array( 'error' => 'bad_request' ),
			);
		}
		$p = TRINV_Store::page_get( $u, $l );
		return array(
			'status' => 200,
			'body'   => array(
				'm'  => (object) $p['m'],
				'sl' => $p['sl'],
			),
		);
	}

	/**
	 * Traduz uma lista de trechos: cache primeiro, faltantes no Google.
	 *
	 * @param array $data array( u, l, p, s[] ).
	 * @return array
	 */
	public static function translate( array $data ) {
		if ( ! TRINV_License::active() ) {
			return self::stopped();
		}
		$l = TRINV_Langs::normalize( isset( $data['l'] ) ? (string) $data['l'] : '' );
		$s = isset( $data['s'] ) && is_array( $data['s'] ) ? $data['s'] : null;
		if ( ! $l || null === $s ) {
			return array(
				'status' => 400,
				'body'   => array( 'error' => 'bad_request' ),
			);
		}
		if ( count( $s ) > self::MAX_ITEMS ) {
			return array(
				'status' => 413,
				'body'   => array( 'error' => 'too_many' ),
			);
		}
		// Cada trecho pode vir com uma dica de idioma de origem (trechos curtos, em que a
		// detecção automática erra). A chave de cache é "dica\x01texto" (ou só o texto).
		$hints = isset( $data['h'] ) && is_array( $data['h'] ) ? $data['h'] : array();
		$cks   = array(); // chave composta por posição (null = item inválido).
		$parts = array(); // chave => array( texto, dica ).
		$bytes = 0;
		foreach ( array_values( $s ) as $i => $item ) {
			if ( ! is_string( $item ) || '' === $item || strlen( $item ) > self::MAX_ITEM_BYTES ) {
				$cks[] = null;
				continue;
			}
			$hint = isset( $hints[ $i ] ) && is_string( $hints[ $i ] ) ? TRINV_Langs::normalize( $hints[ $i ] ) : '';
			$ck   = '' !== $hint ? $hint . "\x01" . $item : $item;
			$bytes       += strlen( $item );
			$cks[]        = $ck;
			$parts[ $ck ] = array( $item, $hint );
		}
		if ( $bytes > self::MAX_BYTES ) {
			return array(
				'status' => 413,
				'body'   => array( 'error' => 'too_large' ),
			);
		}

		$valid  = array_keys( $parts );
		$found  = $valid ? TRINV_Store::get_many( $l, $valid ) : array();
		$groups = array(); // dica => [ck...]
		$mbytes = 0;
		foreach ( $valid as $ck ) {
			if ( ! isset( $found[ $ck ] ) ) {
				$groups[ $parts[ $ck ][1] ][] = $ck;
				$mbytes                       += strlen( $parts[ $ck ][0] );
			}
		}

		$fallback = false;
		// pré-tradução do painel (token assinado): sem o limite por IP, só o global.
		$warm = isset( $data['w'] ) && is_string( $data['w'] ) && TRINV_Warm::verify( $data['w'] );
		if ( $groups ) {
			if ( ! TRINV_Translator::available() || ! self::allow( $mbytes, $warm ) ) {
				$fallback = true; // o navegador do visitante traduz o que faltou.
			} else {
				$new = array();
				$req = array(); // todas as origens de uma vez (pedidos paralelos)
				foreach ( $groups as $hint => $list ) {
					$texts = array();
					foreach ( $list as $ck ) {
						$texts[] = $parts[ $ck ][0];
					}
					$req[ 'h' . $hint ] = array( $texts, '' !== (string) $hint ? (string) $hint : 'auto' );
				}
				$all = TRINV_Translator::translate_groups( $req, $l );
				foreach ( $groups as $hint => $list ) {
					$res = $all[ 'h' . $hint ];
					foreach ( $list as $j => $ck ) {
						if ( null !== $res[ $j ][0] ) {
							$pair         = array( $res[ $j ][0], '' !== (string) $hint ? '' : $res[ $j ][1] );
							$new[ $ck ]   = $pair;
							$found[ $ck ] = $pair;
						} else {
							$fallback = true;
						}
					}
				}
				TRINV_Store::put_many( $l, $new );
			}
		}

		// resposta alinhada + idioma dominante (só trechos com detecção automática, por tamanho).
		$t    = array();
		$map  = array();
		$lens = array();
		foreach ( $cks as $ck ) {
			if ( is_string( $ck ) && isset( $found[ $ck ] ) ) {
				$t[]        = $found[ $ck ][0];
				$map[ $ck ] = $found[ $ck ][0];
				$sl         = (string) $found[ $ck ][1];
				if ( '' !== $sl && '' === $parts[ $ck ][1] ) {
					$lens[ $sl ] = ( $lens[ $sl ] ?? 0 ) + strlen( $parts[ $ck ][0] );
				}
			} else {
				$t[] = null;
			}
		}
		arsort( $lens );
		$dominant = $lens ? (string) array_key_first( $lens ) : '';

		$u = self::clean_path( isset( $data['u'] ) ? (string) $data['u'] : '' );
		if ( '' !== $u && $map ) {
			TRINV_Store::page_merge( $u, $l, $map, $dominant );
		}
		if ( $dominant && ! empty( $data['p'] ) ) {
			TRINV_Frontend::remember_verified( (int) $data['p'], $dominant, $lens );
		}
		if ( $warm && ! empty( $data['p'] ) ) {
			TRINV_Slugs::ensure( (int) $data['p'], $l ); // pré-tradução: o endereço traduzido também fica pronto.
		}

		return array(
			'status' => 200,
			'body'   => array(
				't'  => $t,
				'f'  => $fallback ? 1 : 0,
				'sl' => $dominant,
			),
		);
	}

	/**
	 * Licença do Pub Mail parada: o navegador não traduz (nem direto no Google).
	 *
	 * @return array
	 */
	private static function stopped() {
		return array(
			'status' => 402,
			'body'   => array( 'error' => 'license' ),
		);
	}

	/**
	 * Caminho normalizado da página (sem domínio, sem #, até 500 caracteres).
	 *
	 * @param string $u Caminho.
	 * @return string
	 */
	public static function clean_path( $u ) {
		$u = trim( (string) $u );
		if ( '' === $u || '/' !== $u[0] || strlen( $u ) > 500 ) {
			return '';
		}
		$hash = strpos( $u, '#' );
		return false === $hash ? $u : substr( $u, 0, $hash );
	}

	/**
	 * Limite de caracteres NOVOS enviados ao Google (por IP e global).
	 *
	 * @param int  $bytes Tamanho do que falta traduzir.
	 * @param bool $warm  Pré-tradução do painel (ignora o limite por IP).
	 * @return bool
	 */
	private static function allow( $bytes, $warm = false ) {
		$ip      = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0';
		$k_ip    = 'trinv_rl_' . md5( $ip ) . '_' . (int) floor( time() / 600 );
		$k_all   = 'trinv_rg_' . (int) floor( time() / 3600 );
		$ip_max  = (int) apply_filters( 'trinv_ip_limit', self::IP_BYTES );
		$all_max = (int) apply_filters( 'trinv_global_limit', self::GLOBAL_BYTES );
		$ip_used = (int) get_transient( $k_ip );
		$all     = (int) get_transient( $k_all );
		if ( ( ! $warm && $ip_used + $bytes > $ip_max ) || $all + $bytes > $all_max ) {
			return false;
		}
		if ( ! $warm ) {
			set_transient( $k_ip, $ip_used + $bytes, 900 );
		}
		set_transient( $k_all, $all + $bytes, 3900 );
		return true;
	}
}
