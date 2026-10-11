<?php
/**
 * Lado do visitante: injeta o popup (quando há layout ativo e chave VAPID) e serve o service
 * worker pela raiz do site — o escopo de um service worker é a pasta do endereço dele, então um
 * arquivo em wp-content/plugins ficaria restrito àquela pasta. Endereço usado: `/?pip-sw=<versão>`
 * (passa sempre pelo WordPress; `/pip-sw.js` costuma cair no servidor web como arquivo estático
 * inexistente → 404). `/pip-sw.js` continua atendido onde o PHP recebe a requisição.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Scripts do site + service worker.
 */
class PIP_Frontend {

	const SW_PATH  = '/pip-sw.js';
	const SW_QUERY = 'pip-sw';

	/**
	 * Endereço público do service worker (escopo = raiz do site).
	 *
	 * @return string
	 */
	public static function sw_url() {
		$args = array( self::SW_QUERY => PIP_VERSION );
		if ( PIP_Store::diag_on() ) {
			$args['d'] = '1'; // diagnóstico ligado muda o endereço → o navegador atualiza o worker
		}
		return add_query_arg( $args, home_url( '/' ) );
	}

	/**
	 * Layouts ligados desta requisição (memo: head() e assets() usam a mesma lista).
	 *
	 * @var array|null
	 */
	private static $live = null;

	/**
	 * Liga os hooks.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'maybe_serve_sw' ), 0 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'wp_head', array( __CLASS__, 'head' ), 1 );
	}

	/**
	 * Responde `/?pip-sw=…` (ou /pip-sw.js) com o service worker, antes de qualquer rewrite.
	 */
	public static function maybe_serve_sw() {
		if ( isset( $_GET['pip-manifest'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			self::serve_manifest();
		}
		$by_query = isset( $_GET[ self::SW_QUERY ] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $by_query ) {
			$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			$home = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
			$home = $home ? rtrim( $home, '/' ) : '';
			if ( $uri !== $home . self::SW_PATH ) {
				return;
			}
		}
		$file = PIP_DIR . 'assets/pip-sw.js';
		if ( ! is_readable( $file ) ) {
			status_header( 404 );
			exit;
		}
		$diag = $by_query && isset( $_GET['d'] ) && PIP_Store::diag_on(); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$cfg  = array( 'vapid' => PIP_Vapid::public_key(), 'rest' => esc_url_raw( rest_url( PIP_Rest::NS . '/' ) ), 'diag' => $diag );
		$etag = '"' . substr( md5( PIP_VERSION . '|' . (int) filemtime( $file ) . '|' . wp_json_encode( $cfg ) ), 0, 20 ) . '"';
		if ( isset( $_SERVER['HTTP_IF_NONE_MATCH'] ) && trim( (string) wp_unslash( $_SERVER['HTTP_IF_NONE_MATCH'] ) ) === $etag ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			status_header( 304 );
			header( 'ETag: ' . $etag );
			exit;
		}
		if ( $by_query ) {
			// a versão está no endereço: pode ficar em cache 1 dia (o navegador não baixa o worker a cada visita)
			header( 'Cache-Control: public, max-age=86400' );
		} else {
			nocache_headers();
		}
		header( 'ETag: ' . $etag );
		header( 'Content-Type: application/javascript; charset=utf-8' );
		header( 'Service-Worker-Allowed: /' );
		header( 'X-Content-Type-Options: nosniff' );
		echo '/* Push In Play v' . esc_js( PIP_VERSION ) . " */\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo 'self.PIP_SW = ' . wp_json_encode( $cfg ) . ";\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		exit;
	}

	/**
	 * Layouts ligados (cru) — só quando há chave VAPID.
	 *
	 * @return array
	 */
	private static function live_layouts() {
		if ( null !== self::$live ) {
			return self::$live;
		}
		if ( ! PIP_License::active() ) {
			self::$live = array();
			return self::$live;
		}
		$layouts    = PIP_Store::layouts( true );
		self::$live = $layouts && PIP_Vapid::public_key() ? $layouts : array();
		return self::$live;
	}

	/**
	 * Algum layout ligado oferece o app na tela inicial?
	 *
	 * @param array $layouts Layouts.
	 * @return bool
	 */
	private static function wants_app( $layouts ) {
		foreach ( $layouts as $l ) {
			$c = PIP_Store::normalize_config( $l['config'] );
			if ( ! empty( $c['install']['ios_enabled'] ) || ! empty( $c['install']['app_enabled'] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Ícones do app: os do site (Aparência → Personalizar → Ícone do site) ou os genéricos do plugin.
	 *
	 * @return array<int, array{src:string,sizes:string,type:string,purpose:string}>
	 */
	private static function app_icons() {
		$site = get_site_icon_url( 512 );
		if ( $site ) {
			return array(
				array( 'src' => get_site_icon_url( 192 ), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any' ),
				array( 'src' => $site, 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any' ),
				array( 'src' => $site, 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable' ),
			);
		}
		return array(
			array( 'src' => PIP_URL . 'assets/app/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any' ),
			array( 'src' => PIP_URL . 'assets/app/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any' ),
			array( 'src' => PIP_URL . 'assets/app/maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable' ),
		);
	}

	/**
	 * Cor principal do 1º layout ligado (barra do sistema / splash).
	 *
	 * @param array $layouts Layouts.
	 * @return string
	 */
	private static function theme_color( $layouts ) {
		foreach ( $layouts as $l ) {
			$c = PIP_Store::normalize_config( $l['config'] );
			return $c['colors']['btn'];
		}
		return '#377ef0';
	}

	/**
	 * Responde `/?pip-manifest=1` com o manifesto do app (nome e ícone do site, abre em tela cheia).
	 */
	private static function serve_manifest() {
		$layouts = self::live_layouts();
		if ( ! $layouts ) {
			status_header( 404 );
			exit;
		}
		$name  = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		$short = mb_substr( $name, 0, 12 );
		$path  = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		$m     = array(
			'id'               => $path ? $path : '/',
			'name'             => $name,
			'short_name'       => $short ? $short : $name,
			'description'      => wp_specialchars_decode( get_bloginfo( 'description' ), ENT_QUOTES ),
			'start_url'        => add_query_arg( 'pip-app', '1', home_url( '/' ) ),
			'scope'            => $path ? $path : '/',
			'display'          => 'standalone',
			'background_color' => '#ffffff',
			'theme_color'      => self::theme_color( $layouts ),
			'lang'             => get_bloginfo( 'language' ),
			'icons'            => self::app_icons(),
		);
		header( 'Cache-Control: public, max-age=3600' );
		header( 'Content-Type: application/manifest+json; charset=utf-8' );
		echo wp_json_encode( $m, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	/**
	 * `<head>`: manifesto, metas da Apple/Android e captura cedo do convite nativo de instalação.
	 */
	public static function head() {
		if ( is_admin() || is_feed() || is_embed() ) {
			return;
		}
		$layouts = self::live_layouts();
		if ( ! $layouts || ! self::wants_app( $layouts ) ) {
			return;
		}
		$apple = get_site_icon_url( 180 );
		$apple = $apple ? $apple : PIP_URL . 'assets/app/apple-180.png';
		echo "\n<!-- Push In Play: app na tela inicial -->\n";
		echo '<link rel="manifest" href="' . esc_url( add_query_arg( 'pip-manifest', '1', home_url( '/' ) ) ) . '">' . "\n";
		echo '<meta name="mobile-web-app-capable" content="yes">' . "\n";
		echo '<meta name="apple-mobile-web-app-capable" content="yes">' . "\n";
		echo '<meta name="apple-mobile-web-app-status-bar-style" content="default">' . "\n";
		echo '<meta name="apple-mobile-web-app-title" content="' . esc_attr( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ) . '">' . "\n";
		echo '<meta name="theme-color" content="' . esc_attr( self::theme_color( $layouts ) ) . '">' . "\n";
		echo '<link rel="apple-touch-icon" sizes="180x180" href="' . esc_url( $apple ) . '">' . "\n";
		// o convite nativo (Chrome/Edge/Android) dispara cedo; guardamos para o nosso botão.
		echo "<script>window.__pipInstallEvt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pipInstallEvt=e;});</script>\n";
	}

	/**
	 * Script do popup com a configuração dos layouts ativos.
	 */
	public static function assets() {
		if ( is_admin() || is_feed() || is_embed() || ( function_exists( 'wp_is_json_request' ) && wp_is_json_request() ) ) {
			return;
		}
		$layouts = self::live_layouts(); // licença pausada ou sem VAPID = nada no site
		if ( ! $layouts ) {
			return;
		}
		$vapid = PIP_Vapid::public_key();
		if ( ! $vapid ) {
			return;
		}
		$cfg = array(
			'layouts'       => array_map(
				function ( $l ) {
					return array(
						'id'         => $l['id'],
						'type'       => $l['type'],
						'weight'     => $l['weight'],
						'css_mode'   => $l['css_mode'],
						'custom_css' => $l['custom_css'],
						'config'     => PIP_Store::config_for_js( $l['config'] ),
					);
				},
				$layouts
			),
			'vapid'         => $vapid,
			'rest'          => esc_url_raw( rest_url( PIP_Rest::NS . '/' ) ),
			'sw'            => self::sw_url(),
			'scope'         => wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ?: '/',
			'cooldown_days' => 7,
			'site'          => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
			'diag'          => PIP_Store::diag_on(),
		);
		wp_register_script( 'pip-popup', PIP_URL . 'assets/pip-popup.js', array(), PIP_VERSION, true );
		$deps = array( 'pip-popup' );
		if ( 'custom' === PIP_Settings::get()['sound'] ) {
			wp_register_script( 'pip-sounds', PIP_URL . 'assets/pip-sounds.js', array(), PIP_VERSION, true );
			$deps[] = 'pip-sounds';
		}
		wp_register_script( 'pip-front', PIP_URL . 'assets/pip-front.js', $deps, PIP_VERSION, true );
		wp_add_inline_script( 'pip-front', 'window.PIP_CFG = ' . wp_json_encode( $cfg ) . ';', 'before' );
		wp_enqueue_script( 'pip-front' );
	}
}
