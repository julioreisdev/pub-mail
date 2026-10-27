<?php
/**
 * Licença do Pub Mail (só na edição baixada pelo Pub Mail).
 *
 * O plugin baixado pelo Pub Mail traz a chave da conta (license.php) e verifica a licença de
 * hora em hora — a cada 5 minutos enquanto estiver parado. Só aceita resposta ASSINADA pelo
 * Pub Mail (Ed25519). Acesso vencido = para na hora, sem tolerância; renovou = volta sozinho.
 * Sem conseguir falar com o Pub Mail, vale o último estado conhecido até a data de fim dele.
 *
 * A edição avulsa (zip vendido separadamente) não tem licença e não faz nada disso.
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Cliente de licença.
 */
class TRINV_License {

	const OPT     = 'trinv_license';
	const CRON    = 'trinv_license_cron';
	const NOW     = 'trinv_license_now';
	const RECHECK = 300; // parado: verifica de novo a cada 5 min.
	const SLUG    = 'tradutor-invisivel';

	/**
	 * Edição vinculada ao Pub Mail?
	 *
	 * @return bool
	 */
	public static function managed() {
		return defined( 'TRINV_EDITION' ) && 'pubmail' === TRINV_EDITION;
	}

	/**
	 * Chave e endereço presentes (license.php)?
	 *
	 * @return bool
	 */
	public static function configured() {
		return defined( 'TRINV_LICENSE_KEY' ) && defined( 'TRINV_LICENSE_API' ) && defined( 'TRINV_LICENSE_PUBKEY' )
			&& 0 === strpos( (string) TRINV_LICENSE_API, 'https://' );
	}

	/**
	 * Ganchos.
	 */
	public static function init() {
		if ( ! self::managed() ) {
			return;
		}
		add_action( self::CRON, array( __CLASS__, 'check' ) );
		add_action( self::NOW, array( __CLASS__, 'check' ) );
		add_action( 'init', array( __CLASS__, 'tick' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notice' ) );
		add_action( 'admin_post_trinv_license_check', array( __CLASS__, 'action_check' ) );
		add_filter( 'pre_set_site_transient_update_plugins', array( __CLASS__, 'updates' ) );
		add_filter( 'plugins_api', array( __CLASS__, 'plugin_info' ), 20, 3 );
		add_filter( 'auto_update_plugin', array( __CLASS__, 'auto_update' ), 10, 2 );
	}

	/**
	 * Último estado verificado.
	 *
	 * @return array
	 */
	public static function state() {
		$s = get_option( self::OPT );
		return is_array( $s ) ? $s : array();
	}

	/**
	 * O tradutor pode funcionar agora? (edição avulsa: sempre)
	 *
	 * @return bool
	 */
	public static function active() {
		if ( ! self::managed() ) {
			return true;
		}
		$s = self::state();
		if ( empty( $s['active'] ) ) {
			return false;
		}
		$until = isset( $s['until'] ) ? (int) $s['until'] : 0;
		return 0 === $until || time() < $until; // sem tolerância: venceu, parou.
	}

	/**
	 * Em toda requisição (barato): agenda as verificações e reage à mudança de estado
	 * (inclusive o vencimento pela data, sem precisar falar com o Pub Mail).
	 */
	public static function tick() {
		if ( ! wp_next_scheduled( self::CRON ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', self::CRON );
		}
		$s = self::state();
		// plugin baixado de novo (chave nova) ou recém-instalado por cima de outro (sem o gancho de
		// ativação): confere já — no painel/cron na hora; numa visita, em segundo plano.
		if ( ( $s['kh'] ?? '' ) !== self::key_hash() ) {
			if ( is_admin() || wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
				self::check();
				$s = self::state();
			} elseif ( ! get_transient( 'trinv_lic_lock' ) ) {
				set_transient( 'trinv_lic_lock', 1, 60 );
				wp_schedule_single_event( time(), self::NOW, array( 'k' . time() ) );
			}
		}
		$now = self::active();
		if ( ! array_key_exists( 'live', $s ) || (bool) $s['live'] !== $now ) {
			self::changed( $now );
		}
		// parado ou nunca verificado: tenta de novo a cada 5 min, em segundo plano (WP-Cron).
		if ( ! $now && time() - (int) ( $s['checked'] ?? 0 ) >= self::RECHECK && ! get_transient( 'trinv_lic_lock' ) ) {
			set_transient( 'trinv_lic_lock', 1, self::RECHECK - 10 );
			wp_schedule_single_event( time(), self::NOW, array( (int) floor( time() / self::RECHECK ) ) );
		}
	}

	/**
	 * Impressão da chave instalada (sabe quando o plugin foi trocado por um com outra chave).
	 *
	 * @return string
	 */
	private static function key_hash() {
		return self::configured() ? substr( md5( (string) TRINV_LICENSE_KEY ), 0, 12 ) : 'none';
	}

	/**
	 * Verifica a licença no Pub Mail.
	 *
	 * @return bool Resposta válida recebida.
	 */
	public static function check() {
		if ( ! self::managed() ) {
			return false;
		}
		$s            = self::state();
		$s['checked'] = time();
		if ( ! self::configured() ) {
			$s = array_merge(
				$s,
				array(
					'kh'     => self::key_hash(),
					'active' => 0,
					'status' => 'missing',
					'until'  => 0,
					'error'  => '',
				)
			);
			self::save( $s );
			self::sync();
			return false;
		}
		$r = wp_remote_post(
			TRINV_LICENSE_API . '/public/wp-plugin/check',
			array(
				'timeout' => 10,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'key'  => TRINV_LICENSE_KEY,
						'site' => home_url( '/' ),
						'v'    => TRINV_VERSION,
						'wp'   => get_bloginfo( 'version' ),
						'php'  => PHP_VERSION,
					)
				),
			)
		);
		$p = is_wp_error( $r ) ? null : self::verify( (string) wp_remote_retrieve_body( $r ) );
		if ( null === $p ) {
			// sem resposta válida: mantém o último estado conhecido (vale até a data de fim dele).
			$s['error'] = is_wp_error( $r ) ? substr( $r->get_error_message(), 0, 200 ) : 'HTTP ' . (int) wp_remote_retrieve_response_code( $r );
			self::save( $s );
			return false;
		}
		$s = array_merge(
			$s,
			array(
				'kh'     => self::key_hash(),
				'active' => empty( $p['active'] ) ? 0 : 1,
				'status' => substr( sanitize_key( (string) ( $p['status'] ?? '' ) ), 0, 20 ),
				'until'  => max( 0, (int) ( $p['until'] ?? 0 ) ),
				'ok'     => time(),
				'error'  => '',
			)
		);
		self::save( $s );
		self::remote( isset( $p['cfg'] ) && is_array( $p['cfg'] ) ? $p['cfg'] : array() );
		self::sync();
		return true;
	}

	/**
	 * Avisa o Pub Mail que o plugin saiu deste site (desativado ou apagado): o site some da lista
	 * "Sites usando o plugin" na hora. Best-effort (5 s); ao reativar/reinstalar, a 1ª verificação da
	 * licença põe o site de volta.
	 *
	 * @param string $reason 'deactivate' | 'uninstall'.
	 */
	public static function goodbye( $reason = 'deactivate' ) {
		if ( ! self::managed() || ! self::configured() ) {
			return;
		}
		wp_remote_post(
			TRINV_LICENSE_API . '/public/wp-plugin/remove',
			array(
				'timeout' => 5,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'key'    => TRINV_LICENSE_KEY,
						'plugin' => self::SLUG,
						'site'   => home_url( '/' ),
						'reason' => $reason,
						'v'      => TRINV_VERSION,
					)
				),
			)
		);
	}

	/**
	 * Aplica a mudança de estado, se houve.
	 */
	private static function sync() {
		$s = self::state();
		if ( ! array_key_exists( 'live', $s ) || (bool) $s['live'] !== self::active() ) {
			self::changed( self::active() );
		}
	}

	/**
	 * Grava o estado (lido em toda página: autoload).
	 *
	 * @param array $s Estado.
	 */
	private static function save( array $s ) {
		update_option( self::OPT, $s, true );
	}

	/**
	 * Confere a assinatura e a validade da resposta.
	 *
	 * @param string $body Corpo.
	 * @return array|null
	 */
	public static function verify( $body ) {
		$j = json_decode( $body, true );
		if ( ! is_array( $j ) || empty( $j['d'] ) || empty( $j['s'] ) || ! defined( 'TRINV_LICENSE_PUBKEY' ) ) {
			return null;
		}
		if ( ! function_exists( 'sodium_crypto_sign_verify_detached' ) && is_readable( ABSPATH . WPINC . '/sodium_compat/autoload.php' ) ) {
			require_once ABSPATH . WPINC . '/sodium_compat/autoload.php';
		}
		if ( ! function_exists( 'sodium_crypto_sign_verify_detached' ) ) {
			return null;
		}
		$d   = base64_decode( (string) $j['d'], true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- resposta assinada.
		$sig = base64_decode( (string) $j['s'], true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- assinatura.
		$pk  = base64_decode( (string) TRINV_LICENSE_PUBKEY, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- chave pública.
		if ( false === $d || false === $sig || false === $pk || 64 !== strlen( $sig ) || 32 !== strlen( $pk ) ) {
			return null;
		}
		try {
			if ( ! sodium_crypto_sign_verify_detached( $sig, $d, $pk ) ) {
				return null;
			}
		} catch ( Exception $e ) {
			return null;
		}
		$p = json_decode( $d, true );
		if ( ! is_array( $p ) || 1 !== (int) ( $p['v'] ?? 0 ) || abs( time() - (int) ( $p['iat'] ?? 0 ) ) > DAY_IN_SECONDS ) {
			return null;
		}
		$site = (string) ( $p['site'] ?? '' );
		if ( '' !== $site && self::site_host() !== $site ) {
			return null; // resposta de outro site.
		}
		return $p;
	}

	/**
	 * Identificação deste site (igual à do Pub Mail: host + caminho, minúsculas).
	 *
	 * @return string
	 */
	public static function site_host() {
		$u = wp_parse_url( home_url( '/' ) );
		if ( empty( $u['host'] ) ) {
			return '';
		}
		$p = isset( $u['path'] ) ? rtrim( $u['path'], '/' ) : '';
		return strtolower( $u['host'] . ( isset( $u['port'] ) ? ':' . $u['port'] : '' ) . $p );
	}

	/**
	 * Configuração enviada pelo Pub Mail (ex.: endpoints do tradutor).
	 *
	 * @param array $cfg Configuração.
	 */
	private static function remote( array $cfg ) {
		$g   = isset( $cfg['g'] ) && is_array( $cfg['g'] ) ? array_values( array_filter( $cfg['g'], array( 'TRINV_Google', 'valid_endpoint' ) ) ) : array();
		$new = $g ? array( 'g' => array_slice( $g, 0, 8 ) ) : array();
		if ( get_option( 'trinv_remote', array() ) !== $new ) {
			update_option( 'trinv_remote', $new, true );
		}
	}

	/**
	 * Parou ou voltou: tira o cache de página (o HTML guardado não pode continuar traduzindo
	 * — nem deixar de traduzir) e, ao parar, esvazia os mapas estáticos.
	 *
	 * @param bool $active Estado novo.
	 */
	private static function changed( $active ) {
		$s         = self::state();
		$s['live'] = $active ? 1 : 0;
		self::save( $s );
		if ( ! $active ) {
			TRINV_Store::clear_static();
		}
		TRINV_Warm::purge_all();
	}

	// ------------------------------------------------------------------ painel

	/**
	 * Motivo da pausa, em português.
	 *
	 * @return string
	 */
	public static function reason() {
		$s     = self::state();
		$until = (int) ( $s['until'] ?? 0 );
		if ( ! empty( $s['active'] ) && $until && time() >= $until ) {
			return 'o acesso ao Pub Mail venceu em ' . wp_date( 'd/m/Y', $until );
		}
		switch ( $s['status'] ?? '' ) {
			case 'expired':
				return 'o acesso ao Pub Mail venceu';
			case 'pending':
				return 'o pagamento do acesso ao Pub Mail está pendente';
			case 'blocked':
				return 'a conta do Pub Mail está bloqueada';
			case 'disabled':
				return 'a conta do Pub Mail está desativada';
			case 'no_module':
				return 'o módulo WordPress não está liberado na sua conta do Pub Mail';
			case 'revoked':
				return 'a chave deste plugin foi trocada no Pub Mail — baixe o plugin de novo pelo Pub Mail';
			case 'invalid':
			case 'missing':
				return 'a licença deste plugin não é válida — baixe o plugin pelo Pub Mail';
		}
		return empty( $s['ok'] ) ? 'ainda não foi possível confirmar a licença no Pub Mail' . ( ! empty( $s['error'] ) ? ' (' . $s['error'] . ')' : '' ) : 'a licença não está ativa';
	}

	/**
	 * Endereço do Pub Mail para renovar.
	 *
	 * @return string
	 */
	public static function panel_url() {
		return defined( 'TRINV_LICENSE_PANEL' ) ? (string) TRINV_LICENSE_PANEL : '';
	}

	/**
	 * Aviso no painel enquanto estiver parado (painel e plugins).
	 */
	public static function notice() {
		if ( self::active() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && ! in_array( $screen->id, array( 'dashboard', 'plugins' ), true ) ) { // nos ajustes o card da licença já mostra.
			return;
		}
		$check = wp_nonce_url( admin_url( 'admin-post.php?action=trinv_license_check' ), 'trinv_license_check' );
		echo '<div class="notice notice-error"><p><strong>Tradutor Invisível pausado:</strong> ' . esc_html( self::reason() ) . '. Os visitantes veem o site no idioma original.</p><p>';
		if ( self::panel_url() ) {
			echo '<a class="button button-primary" href="' . esc_url( self::panel_url() ) . '" target="_blank" rel="noopener">Abrir o Pub Mail</a> ';
		}
		echo '<a class="button" href="' . esc_url( $check ) . '">Verificar agora</a></p></div>';
	}

	/**
	 * "Verificar agora".
	 */
	public static function action_check() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'trinv_license_check' );
		delete_transient( 'trinv_lic_lock' );
		$ok   = self::check();
		$back = wp_get_referer() ? wp_get_referer() : TRINV_Admin::url( true );
		wp_safe_redirect( add_query_arg( 'trinv_msg', $ok ? ( self::active() ? 'lic_on' : 'lic_off' ) : 'lic_err', remove_query_arg( 'trinv_msg', $back ) ) );
		exit;
	}

	// ------------------------------------------------------------------ atualização automática

	/**
	 * Versão disponível no Pub Mail (cache de 6 h).
	 *
	 * @param bool $force Ignorar o cache.
	 * @return array
	 */
	public static function remote_info( $force = false ) {
		$c = get_site_transient( 'trinv_update_info' );
		if ( ! $force && is_array( $c ) ) {
			return $c;
		}
		$info = array( 'ok' => false );
		if ( self::configured() ) {
			$r = wp_remote_post(
				TRINV_LICENSE_API . '/public/wp-plugin/update',
				array(
					'timeout' => 10,
					'headers' => array( 'Content-Type' => 'application/json' ),
					'body'    => wp_json_encode(
						array(
							'key' => TRINV_LICENSE_KEY,
							'v'   => TRINV_VERSION,
						)
					),
				)
			);
			$j = is_wp_error( $r ) ? null : json_decode( (string) wp_remote_retrieve_body( $r ), true );
			if ( is_array( $j ) && ! empty( $j['ok'] ) && ! empty( $j['version'] ) && ! empty( $j['package'] ) && 0 === strpos( (string) $j['package'], TRINV_LICENSE_API . '/' ) ) {
				$info = $j;
			}
		}
		set_site_transient( 'trinv_update_info', $info, empty( $info['ok'] ) ? HOUR_IN_SECONDS : 6 * HOUR_IN_SECONDS );
		return $info;
	}

	/**
	 * Oferece a versão nova ao WordPress.
	 *
	 * @param mixed $transient Transient de atualizações.
	 * @return mixed
	 */
	public static function updates( $transient ) {
		if ( ! is_object( $transient ) ) {
			return $transient;
		}
		$file = plugin_basename( TRINV_FILE );
		// "Verificar novamente" (Painel → Atualizações) consulta o Pub Mail na hora, sem esperar o cache de 6 h.
		$force = is_admin() && isset( $_GET['force-check'] ) && current_user_can( 'update_plugins' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- só lê; o próprio WordPress usa esse parâmetro sem nonce.
		$info  = self::remote_info( $force );
		$item  = array(
			'id'           => $file,
			'slug'         => self::SLUG,
			'plugin'       => $file,
			'new_version'  => TRINV_VERSION,
			'url'          => self::panel_url(),
			'package'      => '',
			'icons'        => array(),
			'banners'      => array(),
			'tested'       => '',
			'requires'     => '5.8',
			'requires_php' => '7.4',
		);
		if ( ! empty( $info['ok'] ) && version_compare( (string) $info['version'], TRINV_VERSION, '>' ) ) {
			$item['new_version'] = (string) $info['version'];
			$item['package']     = (string) $info['package'];
			$item['tested']      = (string) ( $info['tested'] ?? '' );
			if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
				$transient->response = array();
			}
			$transient->response[ $file ] = (object) $item;
			unset( $transient->no_update[ $file ] );
		} else {
			if ( isset( $transient->response[ $file ] ) ) {
				unset( $transient->response[ $file ] );
			}
			$transient->no_update[ $file ] = (object) $item;
		}
		return $transient;
	}

	/**
	 * Janela "Ver detalhes" da atualização.
	 *
	 * @param mixed  $res    Resultado.
	 * @param string $action Ação.
	 * @param object $args   Argumentos.
	 * @return mixed
	 */
	public static function plugin_info( $res, $action, $args ) {
		if ( 'plugin_information' !== $action || ! isset( $args->slug ) || self::SLUG !== $args->slug ) {
			return $res;
		}
		$info = self::remote_info();
		return (object) array(
			'name'          => 'Tradutor Invisível',
			'slug'          => self::SLUG,
			'version'       => ! empty( $info['version'] ) ? (string) $info['version'] : TRINV_VERSION,
			'author'        => 'Júlio Cezar Reis',
			'homepage'      => self::panel_url(),
			'requires'      => '5.8',
			'requires_php'  => '7.4',
			'tested'        => (string) ( $info['tested'] ?? '' ),
			'download_link' => (string) ( $info['package'] ?? '' ),
			'sections'      => array(
				'description' => '<p>Mostra cada post e página no idioma do navegador de cada visitante, sem botões nem avisos.</p>',
				'changelog'   => '<pre>' . esc_html( (string) ( $info['changelog'] ?? '' ) ) . '</pre>',
			),
		);
	}

	/**
	 * Atualiza sozinho (correções chegam a todos os sites).
	 *
	 * @param mixed  $update Decisão atual.
	 * @param object $item   Plugin.
	 * @return mixed
	 */
	public static function auto_update( $update, $item ) {
		return ( isset( $item->plugin ) && plugin_basename( TRINV_FILE ) === $item->plugin ) ? true : $update;
	}
}
