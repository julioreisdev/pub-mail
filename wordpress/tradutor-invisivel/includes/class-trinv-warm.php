<?php
/**
 * Pré-tradução para os idiomas da campanha.
 *
 * Quando um post/página é publicado ou atualizado, ele entra numa fila. O painel do dono do
 * site (qualquer tela do wp-admin, inclusive editores) abre a página num quadro invisível como
 * visitante anônimo; o próprio script do tradutor segmenta a página exatamente como faria para
 * um visitante e pede ao servidor a tradução de todos os trechos em cada idioma da campanha.
 * Assim o primeiro visitante de cada país já recebe a página pronta, sem espera.
 *
 * Nesse quadro, pixels, anúncios e scripts de terceiros são bloqueados (CSP): a visita do
 * painel não conta como visualização em nenhuma ferramenta.
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Pré-tradução.
 */
class TRINV_Warm {

	const QUEUE  = 'trinv_warm_q';
	const TTL    = 900;  // validade do token do quadro (s).
	const LEASE  = 150;  // um painel "segura" o item por este tempo (s).
	const MAX_Q  = 200;
	const RECENT = 20;   // "pré-traduzir as mais recentes".

	/**
	 * Post aberto pelo painel nesta requisição (0 = requisição normal).
	 *
	 * @var int
	 */
	public static $active = 0;

	/**
	 * Token válido desta requisição.
	 *
	 * @var string
	 */
	private static $token = '';

	/**
	 * Ganchos.
	 */
	public static function init() {
		// quadro do painel: a página é montada como visitante anônimo (mesmo HTML de um visitante).
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- o token assinado é a verificação.
		$tok = isset( $_GET['trinv_warm'] ) ? sanitize_text_field( wp_unslash( $_GET['trinv_warm'] ) ) : '';
		if ( '' !== $tok && ! is_admin() && self::verify( $tok ) ) {
			self::$active = self::verify( $tok );
			self::$token  = $tok;
			add_filter( 'determine_current_user', '__return_zero', PHP_INT_MAX );
			add_action( 'init', array( __CLASS__, 'as_visitor' ), -9999 );
			add_filter( 'show_admin_bar', '__return_false', PHP_INT_MAX );
			add_action( 'send_headers', array( __CLASS__, 'headers' ), PHP_INT_MAX );
			add_action( 'template_redirect', array( __CLASS__, 'no_page_cache' ), 0 );
		}

		add_action( 'transition_post_status', array( __CLASS__, 'on_status' ), 10, 3 );
		add_filter( 'heartbeat_send', array( __CLASS__, 'heartbeat' ), 10, 1 );
		add_action( 'wp_ajax_trinv_warm_next', array( __CLASS__, 'ajax_next' ) );
		add_action( 'wp_ajax_trinv_warm_done', array( __CLASS__, 'ajax_done' ) );
		add_action( 'admin_post_trinv_warm_now', array( __CLASS__, 'action_now' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_action( 'elementor/editor/after_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_filter( 'post_row_actions', array( __CLASS__, 'row_action' ), 10, 2 );
		add_filter( 'page_row_actions', array( __CLASS__, 'row_action' ), 10, 2 );
		add_action( 'admin_notices', array( __CLASS__, 'notice' ) );
	}

	/**
	 * Idiomas da campanha (sem os excluídos).
	 *
	 * @return string[]
	 */
	public static function langs() {
		$o    = trinv_options();
		$skip = TRINV_Frontend::excluded_langs( (string) $o['skip'] );
		$out  = array();
		foreach ( TRINV_Frontend::excluded_langs( (string) $o['campaign'] ) as $l ) {
			if ( ! in_array( $l, $skip, true ) ) {
				$out[] = $l;
			}
		}
		return array_slice( $out, 0, 30 );
	}

	/**
	 * Pré-tradução ligada?
	 *
	 * @return bool
	 */
	public static function enabled() {
		$o = trinv_options();
		return ! empty( $o['enabled'] ) && (bool) self::langs() && TRINV_License::active();
	}

	// ------------------------------------------------------------------ token do quadro

	/**
	 * Token assinado para abrir um post no quadro do painel.
	 *
	 * @param int $post_id Post.
	 * @return string
	 */
	public static function token( $post_id ) {
		$exp = time() + self::TTL;
		return (int) $post_id . '.' . $exp . '.' . self::sign( (int) $post_id, $exp );
	}

	/**
	 * Confere o token.
	 *
	 * @param string $tok Token.
	 * @return int Post (0 = inválido ou vencido).
	 */
	public static function verify( $tok ) {
		if ( ! is_string( $tok ) || ! preg_match( '/^(\d{1,20})\.(\d{9,12})\.([a-f0-9]{32})$/', $tok, $m ) ) {
			return 0;
		}
		if ( (int) $m[2] < time() || (int) $m[2] > time() + self::TTL + 60 ) {
			return 0;
		}
		return hash_equals( self::sign( (int) $m[1], (int) $m[2] ), $m[3] ) ? (int) $m[1] : 0;
	}

	/**
	 * Assinatura.
	 *
	 * @param int $post_id Post.
	 * @param int $exp     Validade.
	 * @return string
	 */
	private static function sign( $post_id, $exp ) {
		return substr( hash_hmac( 'sha256', 'trinv-warm|' . $post_id . '|' . $exp, wp_salt( 'auth' ) ), 0, 32 );
	}

	/**
	 * Configuração do quadro para o script (vazio fora do quadro).
	 *
	 * @return array|null
	 */
	public static function cfg() {
		if ( ! self::$active ) {
			return null;
		}
		return array(
			't' => self::$token,
			'l' => self::langs(),
		);
	}

	// ------------------------------------------------------------------ requisição do quadro

	/**
	 * Algum plugin pode ter lido o usuário antes: garante o visitante anônimo.
	 */
	public static function as_visitor() {
		if ( get_current_user_id() ) {
			wp_set_current_user( 0 );
		}
	}

	/**
	 * Cabeçalhos do quadro: sem cache, pode ser aberto pelo painel, sem terceiros (pixels,
	 * anúncios, análises): a visita do painel não é contada em lugar nenhum.
	 */
	public static function headers() {
		if ( headers_sent() ) {
			return;
		}
		nocache_headers();
		header_remove( 'X-Frame-Options' );
		$own = array( "'self'" );
		foreach ( array( home_url( '/' ), site_url( '/' ), admin_url( '/' ), content_url( '/' ), includes_url( '/' ), TRINV_URL, rest_url() ) as $u ) {
			$p = wp_parse_url( $u );
			if ( ! empty( $p['host'] ) ) {
				$own[] = ( isset( $p['scheme'] ) ? $p['scheme'] : 'https' ) . '://' . $p['host'] . ( isset( $p['port'] ) ? ':' . $p['port'] : '' );
			}
		}
		$own = implode( ' ', array_unique( $own ) );
		header( "Content-Security-Policy: default-src {$own} 'unsafe-inline' 'unsafe-eval' data: blob:; img-src {$own} data: blob:; media-src 'none'; connect-src {$own}; frame-src 'none'; frame-ancestors {$own}; form-action 'none'" );
		header( 'X-Robots-Tag: noindex, nofollow' );
	}

	/**
	 * Plugins de cache não guardam esta versão.
	 */
	public static function no_page_cache() {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- constante padrão dos plugins de cache.
		}
		do_action( 'litespeed_control_set_nocache', 'trinv warm' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- gancho do LiteSpeed Cache.
	}

	// ------------------------------------------------------------------ fila

	/**
	 * Post pode ser pré-traduzido?
	 *
	 * @param WP_Post|int $post Post.
	 * @return bool
	 */
	public static function eligible( $post ) {
		$post = get_post( $post );
		if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status || '' !== (string) $post->post_password ) {
			return false;
		}
		if ( wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
			return false;
		}
		return is_post_type_viewable( $post->post_type ) && 'attachment' !== $post->post_type;
	}

	/**
	 * Publicado ou atualizado → fila.
	 *
	 * @param string  $new  Status novo.
	 * @param string  $old  Status anterior.
	 * @param WP_Post $post Post.
	 */
	public static function on_status( $new, $old, $post ) {
		if ( 'publish' === $new && self::enabled() && self::eligible( $post ) ) {
			self::enqueue_ids( array( $post->ID ) );
		}
	}

	/**
	 * Coloca posts na fila.
	 *
	 * @param int[] $ids Posts.
	 * @return int Quantos entraram.
	 */
	public static function enqueue_ids( array $ids ) {
		$q = self::queue();
		$n = 0;
		foreach ( $ids as $id ) {
			$id = (int) $id;
			if ( $id > 0 && self::eligible( $id ) ) {
				unset( $q[ $id ] );
				$q[ $id ] = 0; // vai para o fim, sem reserva.
				++$n;
			}
		}
		if ( count( $q ) > self::MAX_Q ) {
			$q = array_slice( $q, -self::MAX_Q, null, true );
		}
		update_option( self::QUEUE, $q, false );
		return $n;
	}

	/**
	 * Fila atual (post => reservado até).
	 *
	 * @return array
	 */
	public static function queue() {
		$q = get_option( self::QUEUE, array() );
		return is_array( $q ) ? $q : array();
	}

	/**
	 * Próximo item livre (reserva por LEASE segundos).
	 *
	 * @return array|null
	 */
	public static function next() {
		if ( ! self::enabled() ) {
			return null;
		}
		$q     = self::queue();
		$now   = time();
		$dirty = false;
		foreach ( $q as $id => $lease ) {
			if ( ! self::eligible( (int) $id ) ) {
				unset( $q[ $id ] );
				$dirty = true;
				continue;
			}
			if ( (int) $lease > $now ) {
				continue;
			}
			$q[ $id ] = $now + self::LEASE;
			update_option( self::QUEUE, $q, false );
			$url = get_permalink( (int) $id );
			return array(
				'id'    => (int) $id,
				'title' => html_entity_decode( get_the_title( (int) $id ), ENT_QUOTES, 'UTF-8' ),
				'url'   => add_query_arg( 'trinv_warm', self::token( (int) $id ), $url ),
				'langs' => self::langs(),
				'left'  => count( $q ),
			);
		}
		if ( $dirty ) {
			update_option( self::QUEUE, $q, false );
		}
		return null;
	}

	/**
	 * Item concluído.
	 *
	 * @param int    $id    Post.
	 * @param int    $ok    Trechos traduzidos.
	 * @param int    $total Trechos pedidos.
	 * @param array  $langs Idiomas feitos.
	 * @param string $err   Erro do painel.
	 */
	public static function done( $id, $ok, $total, array $langs, $err ) {
		$q = self::queue();
		unset( $q[ $id ] );
		update_option( self::QUEUE, $q, false );
		update_post_meta(
			$id,
			'_trinv_warm',
			array(
				'at'    => time(),
				'ok'    => (int) $ok,
				'total' => (int) $total,
				'langs' => array_values( array_filter( array_map( array( 'TRINV_Langs', 'normalize' ), $langs ) ) ),
				'err'   => substr( sanitize_key( $err ), 0, 20 ),
			)
		);
		if ( $ok > 0 ) {
			self::purge( $id ); // o HTML guardado passa a anunciar os mapas prontos.
		}
	}

	/**
	 * Limpa o cache de página do post nos plugins de cache conhecidos (se houver).
	 *
	 * @param int $id Post.
	 */
	public static function purge( $id ) {
		$url = get_permalink( $id );
		clean_post_cache( $id );
		if ( function_exists( 'rocket_clean_post' ) ) {
			rocket_clean_post( $id );
		}
		if ( function_exists( 'wp_cache_post_change' ) ) {
			wp_cache_post_change( $id ); // WP Super Cache.
		}
		if ( function_exists( 'w3tc_flush_post' ) ) {
			w3tc_flush_post( $id );
		}
		if ( function_exists( 'wpfc_clear_post_cache_by_id' ) ) {
			wpfc_clear_post_cache_by_id( $id ); // WP Fastest Cache.
		}
		if ( function_exists( 'sg_cachepress_purge_cache' ) && $url ) {
			sg_cachepress_purge_cache( $url ); // SiteGround.
		}
		do_action( 'litespeed_purge_post', $id ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- gancho do LiteSpeed Cache.
		do_action( 'trinv_purge_post', $id, $url );
	}

	/**
	 * Limpa todo o cache de página nos plugins de cache conhecidos (a licença parou ou voltou:
	 * o HTML guardado não pode continuar com o tradutor — nem ficar sem ele).
	 */
	public static function purge_all() {
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache(); // WP Super Cache.
		}
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}
		if ( function_exists( 'wpfc_clear_all_cache' ) ) {
			wpfc_clear_all_cache( true ); // WP Fastest Cache.
		}
		if ( function_exists( 'sg_cachepress_purge_everything' ) ) {
			sg_cachepress_purge_everything(); // SiteGround.
		}
		do_action( 'litespeed_purge_all' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- gancho do LiteSpeed Cache.
		do_action( 'breeze_clear_all_cache' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- gancho do Breeze.
		do_action( 'trinv_purge_all' );
	}

	// ------------------------------------------------------------------ painel

	/**
	 * Heartbeat do WordPress: avisa o painel quando há páginas na fila (qualquer tela, inclusive
	 * editores de blocos e do Elementor).
	 *
	 * @param array $response Resposta.
	 * @return array
	 */
	public static function heartbeat( $response ) {
		if ( current_user_can( 'edit_posts' ) && self::enabled() ) {
			$n = count( self::queue() );
			if ( $n ) {
				$response['trinv_warm'] = $n;
			}
		}
		return $response;
	}

	/**
	 * Script do painel que processa a fila.
	 */
	public static function enqueue() {
		if ( ! current_user_can( 'edit_posts' ) || ! self::enabled() ) {
			return;
		}
		$file = TRINV_DIR . 'assets/warm-admin.min.js';
		if ( ! is_readable( $file ) ) {
			return;
		}
		wp_enqueue_script( 'trinv-warm', TRINV_URL . 'assets/warm-admin.min.js', array(), TRINV_VERSION, true );
		wp_add_inline_script(
			'trinv-warm',
			'window.trinvWarm=' . wp_json_encode(
				array(
					'ax' => admin_url( 'admin-ajax.php' ),
					'n'  => wp_create_nonce( 'trinv_warm' ),
					'q'  => count( self::queue() ),
				)
			) . ';',
			'before'
		);
	}

	/**
	 * AJAX: próximo item.
	 */
	public static function ajax_next() {
		check_ajax_referer( 'trinv_warm' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( null, 403 );
		}
		wp_send_json_success( array( 'job' => self::next() ) );
	}

	/**
	 * AJAX: item concluído.
	 */
	public static function ajax_done() {
		check_ajax_referer( 'trinv_warm' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( null, 403 );
		}
		$id = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;
		if ( ! $id ) {
			wp_send_json_error( null, 400 );
		}
		$langs = isset( $_POST['langs'] ) ? explode( ',', sanitize_text_field( wp_unslash( $_POST['langs'] ) ) ) : array();
		self::done(
			$id,
			isset( $_POST['ok'] ) ? absint( $_POST['ok'] ) : 0,
			isset( $_POST['total'] ) ? absint( $_POST['total'] ) : 0,
			$langs,
			isset( $_POST['err'] ) ? sanitize_key( wp_unslash( $_POST['err'] ) ) : ''
		);
		wp_send_json_success( array( 'left' => count( self::queue() ) ) );
	}

	/**
	 * Botão "Pré-traduzir" (lista de posts) e "as mais recentes" (ajustes).
	 */
	public static function action_now() {
		check_admin_referer( 'trinv_warm_now' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( 'Sem permissão.' );
		}
		$ids = array();
		if ( ! empty( $_GET['post'] ) ) {
			$id = absint( $_GET['post'] );
			if ( current_user_can( 'edit_post', $id ) ) {
				$ids[] = $id;
			}
		} elseif ( current_user_can( 'manage_options' ) ) {
			$ids = get_posts(
				array(
					'post_type'    => array_values( get_post_types( array( 'public' => true ) ) ),
					'post_status'  => 'publish',
					'numberposts'  => self::RECENT,
					'orderby'      => 'modified',
					'fields'       => 'ids',
					'has_password' => false,
				)
			);
		}
		$n    = self::enabled() ? self::enqueue_ids( $ids ) : 0;
		$back = wp_get_referer() ? wp_get_referer() : TRINV_Admin::url( true );
		wp_safe_redirect( add_query_arg( 'trinv_warm_q', $n, remove_query_arg( 'trinv_warm_q', $back ) ) );
		exit;
	}

	/**
	 * Aviso depois de colocar páginas na fila.
	 */
	public static function notice() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- só exibe um número.
		if ( ! isset( $_GET['trinv_warm_q'] ) || ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		$n = absint( $_GET['trinv_warm_q'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $n ) {
			echo '<div class="notice notice-warning is-dismissible"><p>Nenhuma página publicada para pré-traduzir. Confira os idiomas da campanha em Tradutor Invisível → Ajustes.</p></div>';
			return;
		}
		$msg = 1 === $n ? 'Página na fila de pré-tradução.' : sprintf( '%d páginas na fila de pré-tradução.', $n );
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $msg . ' Acompanhe pelo aviso no canto da tela.' ) . '</p></div>';
	}

	/**
	 * Ação "Pré-traduzir" na lista de posts/páginas.
	 *
	 * @param array   $actions Ações.
	 * @param WP_Post $post    Post.
	 * @return array
	 */
	public static function row_action( $actions, $post ) {
		if ( ! self::enabled() || ! self::eligible( $post ) || ! current_user_can( 'edit_post', $post->ID ) ) {
			return $actions;
		}
		$url = wp_nonce_url( admin_url( 'admin-post.php?action=trinv_warm_now&post=' . (int) $post->ID ), 'trinv_warm_now' );
		$m   = get_post_meta( $post->ID, '_trinv_warm', true );
		$tip = is_array( $m ) && ! empty( $m['at'] ) && $m['at'] >= strtotime( $post->post_modified_gmt . ' UTC' ) ? 'Pré-traduzido ✓ (refazer)' : 'Pré-traduzir';
		$actions['trinv_warm'] = '<a href="' . esc_url( $url ) . '">' . esc_html( $tip ) . '</a>';
		return $actions;
	}
}
