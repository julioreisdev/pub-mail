<?php
/**
 * Licença do Pub Mail (só na edição baixada pelo Pub Mail).
 *
 * O plugin baixado pelo Pub Mail traz a chave da conta (license.php) e verifica a licença de
 * hora em hora — a cada 5 minutos enquanto estiver parado. Só aceita resposta ASSINADA pelo
 * Pub Mail (Ed25519). Acesso vencido = para na hora (popup some, envios param), sem tolerância;
 * renovou = volta sozinho. Sem conseguir falar com o Pub Mail, vale o último estado conhecido
 * até a data de fim dele. A mesma chave vale para os outros plugins do Pub Mail no site.
 *
 * A edição avulsa (zip vendido separadamente) não tem licença e não faz nada disso.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Cliente de licença.
 */
class PIP_License {

	const OPT     = 'pip_license';
	const CRON    = 'pip_license_cron';
	const NOW     = 'pip_license_now';
	const LOCK    = 'pip_lic_lock';
	const RECHECK = 300; // parado: verifica de novo a cada 5 min.
	const SLUG    = 'push-in-play';

	/**
	 * Edição vinculada ao Pub Mail?
	 *
	 * @return bool
	 */
	public static function managed() {
		return defined( 'PIP_EDITION' ) && 'pubmail' === PIP_EDITION;
	}

	/**
	 * Chave e endereço presentes (license.php)?
	 *
	 * @return bool
	 */
	public static function configured() {
		return defined( 'PIP_LICENSE_KEY' ) && defined( 'PIP_LICENSE_API' ) && defined( 'PIP_LICENSE_PUBKEY' )
			&& 0 === strpos( (string) PIP_LICENSE_API, 'https://' );
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
		add_action( 'admin_post_pip_license_check', array( __CLASS__, 'action_check' ) );
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
	 * O plugin pode funcionar agora? (edição avulsa: sempre)
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
	 * Em toda requisição (barato): agenda as verificações e reage à mudança de estado.
	 */
	public static function tick() {
		if ( ! wp_next_scheduled( self::CRON ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', self::CRON );
		}
		$s = self::state();
		// plugin baixado de novo (chave nova) ou instalado por cima de outro: confere já.
		if ( ( isset( $s['kh'] ) ? $s['kh'] : '' ) !== self::key_hash() ) {
			if ( is_admin() || wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
				self::check();
				$s = self::state();
			} elseif ( ! get_transient( self::LOCK ) ) {
				set_transient( self::LOCK, 1, 60 );
				wp_schedule_single_event( time(), self::NOW, array( 'k' . time() ) );
			}
		}
		$now = self::active();
		if ( ! array_key_exists( 'live', $s ) || (bool) $s['live'] !== $now ) {
			self::changed( $now );
		}
		// parado ou nunca verificado: tenta de novo a cada 5 min, em segundo plano (WP-Cron).
		if ( ! $now && time() - (int) ( isset( $s['checked'] ) ? $s['checked'] : 0 ) >= self::RECHECK && ! get_transient( self::LOCK ) ) {
			set_transient( self::LOCK, 1, self::RECHECK - 10 );
			wp_schedule_single_event( time(), self::NOW, array( (int) floor( time() / self::RECHECK ) ) );
		}
	}

	/**
	 * Impressão da chave instalada.
	 *
	 * @return string
	 */
	private static function key_hash() {
		return self::configured() ? substr( md5( (string) PIP_LICENSE_KEY ), 0, 12 ) : 'none';
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
			$s = array_merge( $s, array( 'kh' => self::key_hash(), 'active' => 0, 'status' => 'missing', 'until' => 0, 'error' => '' ) );
			self::save( $s );
			self::sync();
			return false;
		}
		$r = wp_remote_post(
			PIP_LICENSE_API . '/public/wp-plugin/check',
			array(
				'timeout' => 10,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'key'    => PIP_LICENSE_KEY,
						'plugin' => self::SLUG,
						'site'   => home_url( '/' ),
						'v'      => PIP_VERSION,
						'wp'     => get_bloginfo( 'version' ),
						'php'    => PHP_VERSION,
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
				'status' => substr( sanitize_key( (string) ( isset( $p['status'] ) ? $p['status'] : '' ) ), 0, 20 ),
				'until'  => max( 0, (int) ( isset( $p['until'] ) ? $p['until'] : 0 ) ),
				'ok'     => time(),
				'error'  => '',
			)
		);
		self::save( $s );
		self::sync();
		return true;
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
		if ( ! is_array( $j ) || empty( $j['d'] ) || empty( $j['s'] ) || ! defined( 'PIP_LICENSE_PUBKEY' ) ) {
			return null;
		}
		if ( ! function_exists( 'sodium_crypto_sign_verify_detached' ) && is_readable( ABSPATH . WPINC . '/sodium_compat/autoload.php' ) ) {
			require_once ABSPATH . WPINC . '/sodium_compat/autoload.php';
		}
		if ( ! function_exists( 'sodium_crypto_sign_verify_detached' ) ) {
			return null;
		}
		$d   = base64_decode( (string) $j['d'], true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$sig = base64_decode( (string) $j['s'], true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$pk  = base64_decode( (string) PIP_LICENSE_PUBKEY, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
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
		if ( ! is_array( $p ) || 1 !== (int) ( isset( $p['v'] ) ? $p['v'] : 0 ) || abs( time() - (int) ( isset( $p['iat'] ) ? $p['iat'] : 0 ) ) > DAY_IN_SECONDS ) {
			return null;
		}
		$site = (string) ( isset( $p['site'] ) ? $p['site'] : '' );
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
	 * Parou ou voltou: só registra (o popup e os envios consultam active() na hora).
	 *
	 * @param bool $active Estado novo.
	 */
	private static function changed( $active ) {
		$s         = self::state();
		$s['live'] = $active ? 1 : 0;
		self::save( $s );
	}

	// ------------------------------------------------------------------ painel

	/**
	 * Motivo da pausa, em português.
	 *
	 * @return string
	 */
	public static function reason() {
		$s     = self::state();
		$until = (int) ( isset( $s['until'] ) ? $s['until'] : 0 );
		if ( ! empty( $s['active'] ) && $until && time() >= $until ) {
			return 'o acesso ao Pub Mail venceu em ' . wp_date( 'd/m/Y', $until );
		}
		switch ( isset( $s['status'] ) ? $s['status'] : '' ) {
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
	 * Data de fim legível ('' = sem fim).
	 *
	 * @return string
	 */
	public static function until_label() {
		$s     = self::state();
		$until = (int) ( isset( $s['until'] ) ? $s['until'] : 0 );
		return $until ? wp_date( 'd/m/Y', $until ) : '';
	}

	/**
	 * Endereço do Pub Mail para renovar.
	 *
	 * @return string
	 */
	public static function panel_url() {
		return defined( 'PIP_LICENSE_PANEL' ) ? (string) PIP_LICENSE_PANEL : '';
	}

	/**
	 * URL de "Verificar agora".
	 *
	 * @return string
	 */
	public static function check_url() {
		return wp_nonce_url( admin_url( 'admin-post.php?action=pip_license_check' ), 'pip_license_check' );
	}

	/**
	 * Aviso no Painel e em Plugins enquanto estiver parado (nas telas do plugin há o card).
	 */
	public static function notice() {
		if ( self::active() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( $screen && ! in_array( $screen->id, array( 'dashboard', 'plugins' ), true ) ) {
			return;
		}
		echo '<div class="notice notice-error"><p><strong>Push In Play pausado:</strong> ' . esc_html( self::reason() ) . '. O popup não aparece e nenhuma notificação é enviada.</p><p>';
		if ( self::panel_url() ) {
			echo '<a class="button button-primary" href="' . esc_url( self::panel_url() ) . '" target="_blank" rel="noopener">Abrir o Pub Mail</a> ';
		}
		echo '<a class="button" href="' . esc_url( self::check_url() ) . '">Verificar agora</a></p></div>';
	}

	/**
	 * "Verificar agora".
	 */
	public static function action_check() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_license_check' );
		delete_transient( self::LOCK );
		$ok   = self::check();
		if ( $ok ) {
			PIP_Sync::push( 'manual' ); // métricas atualizadas no painel do Pub Mail junto com a verificação
		}
		$back = wp_get_referer() ? wp_get_referer() : admin_url( 'admin.php?page=' . PIP_Admin::SLUG );
		wp_safe_redirect( add_query_arg( 'pip_lic', $ok ? ( self::active() ? 'on' : 'off' ) : 'err', remove_query_arg( 'pip_lic', $back ) ) );
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
		$c = get_site_transient( 'pip_update_info' );
		if ( ! $force && is_array( $c ) ) {
			return $c;
		}
		$info = array( 'ok' => false );
		if ( self::configured() ) {
			$r = wp_remote_post(
				PIP_LICENSE_API . '/public/wp-plugin/update',
				array(
					'timeout' => 10,
					'headers' => array( 'Content-Type' => 'application/json' ),
					'body'    => wp_json_encode( array( 'key' => PIP_LICENSE_KEY, 'plugin' => self::SLUG, 'v' => PIP_VERSION ) ),
				)
			);
			$j = is_wp_error( $r ) ? null : json_decode( (string) wp_remote_retrieve_body( $r ), true );
			if ( is_array( $j ) && ! empty( $j['ok'] ) && ! empty( $j['version'] ) && ! empty( $j['package'] ) && 0 === strpos( (string) $j['package'], PIP_LICENSE_API . '/' ) ) {
				$info = $j;
			}
		}
		set_site_transient( 'pip_update_info', $info, empty( $info['ok'] ) ? HOUR_IN_SECONDS : 6 * HOUR_IN_SECONDS );
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
		$file  = plugin_basename( PIP_FILE );
		$force = is_admin() && isset( $_GET['force-check'] ) && current_user_can( 'update_plugins' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$info  = self::remote_info( $force );
		$item  = array(
			'id'           => $file,
			'slug'         => self::SLUG,
			'plugin'       => $file,
			'new_version'  => PIP_VERSION,
			'url'          => self::panel_url(),
			'package'      => '',
			'icons'        => array(),
			'banners'      => array(),
			'tested'       => '',
			'requires'     => '5.8',
			'requires_php' => '7.4',
		);
		if ( ! empty( $info['ok'] ) && version_compare( (string) $info['version'], PIP_VERSION, '>' ) ) {
			$item['new_version'] = (string) $info['version'];
			$item['package']     = (string) $info['package'];
			$item['tested']      = (string) ( isset( $info['tested'] ) ? $info['tested'] : '' );
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
			'name'          => 'Push In Play',
			'slug'          => self::SLUG,
			'version'       => ! empty( $info['version'] ) ? (string) $info['version'] : PIP_VERSION,
			'author'        => 'Júlio Cezar Reis',
			'homepage'      => self::panel_url(),
			'requires'      => '5.8',
			'requires_php'  => '7.4',
			'tested'        => (string) ( isset( $info['tested'] ) ? $info['tested'] : '' ),
			'download_link' => (string) ( isset( $info['package'] ) ? $info['package'] : '' ),
			'sections'      => array(
				'description' => '<p>Notificações push para o seu site WordPress: popup de permissão, fluxo de ativação, envio para todos os inscritos.</p>',
				'changelog'   => '<pre>' . esc_html( (string) ( isset( $info['changelog'] ) ? $info['changelog'] : '' ) ) . '</pre>',
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
		return ( isset( $item->plugin ) && plugin_basename( PIP_FILE ) === $item->plugin ) ? true : $update;
	}
}
