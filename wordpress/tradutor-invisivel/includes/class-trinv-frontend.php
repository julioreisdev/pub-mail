<?php
/**
 * Front: imprime no <head> um script mínimo que decide, antes da página aparecer, se ela
 * precisa ser traduzida para o idioma do navegador — e só então carrega o script principal.
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Integração com o tema.
 */
class TRINV_Frontend {

	/**
	 * Textos curtos que o WordPress/tema/plugins escreveram JÁ traduzidos para o idioma do
	 * site nesta página (via gettext). O navegador usa isso como dica de idioma de origem:
	 * com 1 a 3 palavras a detecção automática erra ("em" vira inglês, "Blog" vira "Blogue").
	 *
	 * @var array
	 */
	private static $loc = array();

	/**
	 * Trechos com idioma conhecido que aparecem nesta página fora do conteúdo principal:
	 * títulos/resumos de OUTROS posts (links de navegação, listas, widgets), comentários e
	 * textos do tema que ficaram sem tradução (inglês). texto => idioma. O navegador usa isso
	 * como idioma de origem e para saber o que já está na língua do visitante.
	 *
	 * @var array
	 */
	private static $fx = array();

	/**
	 * Textos do tema/plugins sem tradução carregada (ficam em inglês). Cota separada.
	 *
	 * @var array
	 */
	private static $fx_en = array();

	/**
	 * Textos do tema/WordPress traduzidos → original em inglês. O visitante em inglês recebe o
	 * texto original e os outros idiomas são traduzidos a partir dele (melhor que do português).
	 *
	 * @var array
	 */
	private static $orig = array();

	/**
	 * Cache de "este text domain tem tradução carregada?".
	 *
	 * @var array
	 */
	private static $loaded = array();

	/**
	 * Ganchos.
	 */
	public static function init() {
		add_action( 'template_redirect', array( __CLASS__, 'start_collecting' ), PHP_INT_MAX );
		add_action( 'wp_head', array( __CLASS__, 'head' ), 1 );
		add_action( 'wp_footer', array( __CLASS__, 'footer' ), 999 );

		// Otimizadores (WP Rocket, LiteSpeed, Autoptimize, SiteGround) não devem adiar/juntar o script.
		$exclude = function ( $list ) {
			$list   = is_array( $list ) ? $list : array();
			$list[] = 'trinv';
			return $list;
		};
		foreach ( array( 'rocket_delay_js_exclusions', 'rocket_exclude_defer_js', 'rocket_exclude_js', 'rocket_excluded_inline_js_content', 'litespeed_optm_js_defer_exc', 'litespeed_optimize_js_excludes', 'sgo_javascript_combine_excluded_inline_content', 'sgo_js_async_exclude', 'sgo_js_minify_exclude' ) as $filter ) {
			add_filter( $filter, $exclude );
		}
		add_filter(
			'autoptimize_filter_js_exclude',
			function ( $ex ) {
				return ( is_string( $ex ) && '' !== $ex ? $ex . ', ' : '' ) . 'trinv';
			}
		);
	}

	/**
	 * O tradutor deve rodar nesta requisição?
	 *
	 * @return bool
	 */
	public static function should_run() {
		$o = trinv_options();
		if ( empty( $o['enabled'] ) || ! TRINV_License::active() ) {
			return false;
		}
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return false;
		}
		if ( is_feed() || is_robots() || is_trackback() || is_embed() || is_customize_preview() || is_preview() ) {
			return false;
		}
		if ( ( function_exists( 'amp_is_request' ) && amp_is_request() ) || ( function_exists( 'is_amp_endpoint' ) && is_amp_endpoint() ) ) {
			return false;
		}
		// editores visuais (Elementor, Divi, Beaver, Bricks, Oxygen, Thrive, WPBakery, Brizy).
		foreach ( array( 'elementor-preview', 'et_fb', 'fl_builder', 'bricks', 'ct_builder', 'tve', 'vc_editable', 'brizy-edit-iframe' ) as $param ) {
			if ( isset( $_GET[ $param ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				return false;
			}
		}
		return (bool) apply_filters( 'trinv_enabled', true );
	}

	/**
	 * CSS + script de decisão no <head>.
	 */
	public static function head() {
		if ( ! self::should_run() ) {
			return;
		}
		$o   = trinv_options();
		$cfg = array(
			'v'      => TRINV_VERSION,
			'src'    => self::hint(),
			'loc'    => TRINV_Langs::site_locale(),
			'chrome' => empty( $o['chrome'] ) ? 0 : 1,
			'ex'     => self::excluded_langs( (string) $o['skip'] ),
			'sel'    => self::clean_selectors( (string) $o['selectors'] ),
			'mw'     => max( 800, min( 8000, (int) $o['maxwait'] ) ),
			'pu'     => rest_url( 'trinv/v1/p' ),
			'tu'     => rest_url( 'trinv/v1/t' ),
			'ax'     => admin_url( 'admin-ajax.php' ),
			'js'     => TRINV_URL . 'assets/trinv.min.js?ver=' . TRINV_VERSION,
			'p'      => TRINV_Slugs::current_id(),
			'st'     => '',
		);
		$warm = TRINV_Warm::cfg();
		if ( $warm ) {
			$cfg['w'] = $warm; // quadro de pré-tradução aberto pelo painel.
		}
		$cfg['bn'] = trim( html_entity_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ); // nome do site: nunca traduzido.
		$store     = self::store_cfg();
		if ( $store ) {
			$cfg = array_merge( $cfg, $store ); // loja: "Checkout" vira "Finalizar compra", não "Check-out".
		}
		if ( TRINV_Slugs::enabled() && $cfg['p'] && TRINV_Slugs::swappable( get_post( $cfg['p'] ) ) ) {
			$cfg['ul'] = 1;
			$cfg['su'] = rest_url( 'trinv/v1/s' );
			$cfg['ps'] = (object) TRINV_Slugs::known_paths( get_post( $cfg['p'] ) ); // endereços traduzidos prontos.
			if ( TRINV_Slugs::$resolved ) {
				$cfg['ou'] = self::request_path(); // aberto por endereço traduzido: o original é a chave do cache.
				$cfg['op'] = TRINV_Slugs::original_path( get_post( $cfg['p'] ) );
			}
		}
		if ( TRINV_Store::static_ok() ) {
			$d         = TRINV_Store::static_dir();
			$cfg['st'] = $d ? $d[1] : '';
			$cfg['sm'] = TRINV_Store::static_langs( self::request_path() ); // idiomas com mapa pronto.
		}
		$boot = self::boot_js();
		if ( '' === $boot ) {
			return;
		}

		$attrs = 'data-cfasync="false" data-no-optimize="1" data-no-defer="1" data-no-minify="1" data-pagespeed-no-defer';
		// Página transparente só enquanto traduz; o CSS revela sozinho em mw ms mesmo se o JS falhar.
		echo '<style id="trinv-css">html.trinv-wait body{opacity:0;animation:trinv-show 0s linear ' . (int) $cfg['mw'] . 'ms forwards}@keyframes trinv-show{to{opacity:1}}</style>' . "\n";
		echo '<script id="trinv-boot" ' . $attrs . '>' . str_replace( '__TRINV_CFG__', wp_json_encode( $cfg ), $boot ) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON codificado; script estático do plugin.
	}

	/**
	 * Começa a anotar os textos do tema. Em temas de bloco o corpo da página é montado ANTES
	 * do wp_head, por isso isto roda no template_redirect (antes da montagem, em qualquer tema).
	 */
	public static function start_collecting() {
		if ( ! self::should_run() ) {
			return;
		}
		add_filter( 'the_title', array( __CLASS__, 'fx_title' ), PHP_INT_MAX, 2 );
		add_filter( 'get_the_excerpt', array( __CLASS__, 'fx_excerpt' ), PHP_INT_MAX, 2 );
		add_filter( 'comment_text', array( __CLASS__, 'fx_comment' ), PHP_INT_MAX, 2 );
		if ( '' === TRINV_Langs::site_locale() ) {
			return;
		}
		add_filter( 'gettext', array( __CLASS__, 'collect' ), PHP_INT_MAX, 3 );
		add_filter( 'gettext_with_context', array( __CLASS__, 'collect_ctx' ), PHP_INT_MAX, 4 );
		add_filter( 'ngettext', array( __CLASS__, 'collect_n' ), PHP_INT_MAX, 5 );
	}

	/**
	 * gettext: guarda textos curtos já no idioma do site.
	 *
	 * @param string $translation Texto traduzido.
	 * @param string $text        Original.
	 * @param string $domain      Text domain.
	 * @return string
	 */
	public static function collect( $translation, $text, $domain ) {
		$len = strlen( (string) $translation );
		if ( 0 === $len || $len > 80 || count( self::$loc ) >= 400 ) {
			return $translation;
		}
		$en = false;
		if ( $translation === $text ) {
			// igual ao original: só vale se o domínio tem tradução carregada (o tradutor manteve a
			// palavra, ex.: "Blog"); sem tradução carregada, é o original do tema (inglês).
			if ( ! isset( self::$loaded[ $domain ] ) ) {
				self::$loaded[ $domain ] = is_textdomain_loaded( $domain );
			}
			if ( ! self::$loaded[ $domain ] ) {
				if ( 'en' === TRINV_Langs::family( TRINV_Langs::site_locale() ) || count( self::$fx_en ) >= 250 ) {
					return $translation;
				}
				$en = true;
			}
		}
		// "- Tema WordPress por %s": vale cada pedaço fixo em volta dos marcadores.
		$parts = preg_split( '/%(?:\d+\$)?[sdfu]/', (string) $translation );
		$origs = preg_split( '/%(?:\d+\$)?[sdfu]/', (string) $text );
		$cut   = count( $parts ) > 1; // pontuação nas pontas só é recortada nos pedaços em volta de %s
		if ( ! $en && $translation !== $text && count( $parts ) === count( $origs ) && count( self::$orig ) < 400 ) {
			foreach ( $parts as $i => $part ) {
				$a = self::plain( $part, $cut );
				$b = self::plain( $origs[ $i ], $cut );
				if ( '' !== $a && '' !== $b && $a !== $b && strlen( $a ) <= 200 && preg_match( '/\p{L}/u', $a ) && ! isset( self::$orig[ $a ] ) ) {
					self::$orig[ $a ] = $b;
				}
			}
		}
		foreach ( $parts as $part ) {
			$t = self::plain( $part, $cut );
			if ( '' === $t || false !== strpos( $t, '%' ) || substr_count( $t, ' ' ) > 2 || strlen( $t ) > 40 || ! preg_match( '/\p{L}/u', $t ) ) {
				continue;
			}
			if ( $en ) {
				self::$fx_en[ $t ] = 'en';
			} else {
				self::$loc[ $t ] = 1;
			}
		}
		return $translation;
	}

	/**
	 * Texto puro de um pedaço de string traduzível (sem tags, entidades e pontuação nas pontas).
	 *
	 * @param string $s   Texto.
	 * @param bool   $cut Recortar pontuação das pontas (pedaços em volta de %s).
	 * @return string
	 */
	private static function plain( $s, $cut = false ) {
		$s = trim( (string) preg_replace( '/\s+/u', ' ', html_entity_decode( wp_strip_all_tags( (string) $s ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );
		return $cut ? (string) preg_replace( '/^[\s\-–—:|·•,;()\[\]]+|[\s\-–—:|·•,;()\[\]]+$/u', '', $s ) : $s;
	}

	/**
	 * gettext_with_context.
	 *
	 * @param string $translation Texto traduzido.
	 * @param string $text        Original.
	 * @param string $context     Contexto.
	 * @param string $domain      Text domain.
	 * @return string
	 */
	public static function collect_ctx( $translation, $text, $context, $domain ) {
		return self::collect( $translation, $text, $domain );
	}

	/**
	 * ngettext.
	 *
	 * @param string $translation Texto traduzido.
	 * @param string $single      Singular.
	 * @param string $plural      Plural.
	 * @param int    $number      Número.
	 * @param string $domain      Text domain.
	 * @return string
	 */
	public static function collect_n( $translation, $single, $plural, $number, $domain ) {
		return self::collect( $translation, 1 === (int) $number ? $single : $plural, $domain );
	}

	/**
	 * Guarda um trecho com idioma conhecido.
	 *
	 * @param string $html Texto (pode ter HTML/entidades).
	 * @param string $lang Idioma.
	 * @param int    $max  Tamanho máximo aceito.
	 */
	private static function fx_add( $html, $lang, $max = 1000 ) {
		$lang = TRINV_Langs::normalize( (string) $lang );
		if ( '' === $lang || count( self::$fx ) >= 400 ) {
			return;
		}
		$t = trim( preg_replace( '/\s+/u', ' ', html_entity_decode( wp_strip_all_tags( (string) $html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );
		$n = function_exists( 'mb_strlen' ) ? mb_strlen( $t ) : strlen( $t );
		if ( $n < 2 || $n > $max || ! preg_match( '/\p{L}/u', $t ) ) {
			return;
		}
		if ( ! isset( self::$fx[ $t ] ) ) {
			self::$fx[ $t ] = $lang;
		}
	}

	/**
	 * Post publicado e visível (não item de menu, bloco reutilizável…)?
	 *
	 * @param mixed $post Post ou ID.
	 * @return WP_Post|null
	 */
	private static function public_post( $post ) {
		$p = get_post( $post );
		return ( $p instanceof WP_Post && 'publish' === $p->post_status && is_post_type_viewable( $p->post_type ) && 'attachment' !== $p->post_type ) ? $p : null;
	}

	/**
	 * Título de um post: guarda o idioma dele.
	 *
	 * @param string $title Título.
	 * @param int    $id    Post.
	 * @return string
	 */
	public static function fx_title( $title, $id = 0 ) {
		$p = $id ? self::public_post( $id ) : null;
		if ( $p ) {
			self::fx_add( $title, self::post_lang( $p ), 300 );
		}
		return $title;
	}

	/**
	 * Resumo de um post: guarda o idioma dele.
	 *
	 * @param string $excerpt Resumo.
	 * @param mixed  $post    Post.
	 * @return string
	 */
	public static function fx_excerpt( $excerpt, $post = null ) {
		$p = self::public_post( $post );
		if ( $p ) {
			self::fx_add( $excerpt, self::post_lang( $p ) );
		}
		return $excerpt;
	}

	/**
	 * Comentário: idioma detectado pelo texto dele.
	 *
	 * @param string $text    Texto.
	 * @param mixed  $comment Comentário.
	 * @return string
	 */
	public static function fx_comment( $text, $comment = null ) {
		self::fx_add( $text, TRINV_Detect::detect( $text ), 2000 );
		return $text;
	}

	/**
	 * Rodapé: entrega a lista de textos do tema e os trechos com idioma conhecido
	 * (dados JSON, não executam nada).
	 */
	public static function footer() {
		if ( ! has_filter( 'the_title', array( __CLASS__, 'fx_title' ) ) ) {
			return;
		}
		$attrs = 'type="application/json" data-no-optimize="1"';
		if ( self::$loc && has_filter( 'gettext', array( __CLASS__, 'collect' ) ) ) {
			echo '<script id="trinv-loc" ' . $attrs . '>' . wp_json_encode( array_map( 'strval', array_keys( self::$loc ) ) ) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON codificado.
		}
		if ( self::$orig ) {
			echo '<script id="trinv-orig" ' . $attrs . '>' . wp_json_encode( self::$orig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG ) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON codificado (JSON_HEX_TAG: sem </script>).
		}
		$fx = self::$fx + self::$fx_en; // títulos/comentários primeiro.
		unset( $fx[''] );
		if ( $fx ) {
			$pairs = array();
			$bytes = 0;
			foreach ( $fx as $t => $l ) {
				$bytes += strlen( (string) $t ) + 12;
				if ( $bytes > 60000 ) {
					break;
				}
				$pairs[] = array( (string) $t, $l );
			}
			echo '<script id="trinv-fx" ' . $attrs . '>' . wp_json_encode( $pairs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG ) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON codificado (JSON_HEX_TAG: sem </script>).
		}
	}

	/**
	 * Script de decisão (arquivo do plugin, já minificado).
	 *
	 * @return string
	 */
	private static function boot_js() {
		static $js = null;
		if ( null === $js ) {
			$file = TRINV_DIR . 'assets/boot.min.js';
			$js   = is_readable( $file ) ? trim( (string) file_get_contents( $file ) ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
		return $js;
	}

	/**
	 * Caminho desta página como o navegador calcula (sem parâmetros de rastreio).
	 *
	 * @return string
	 */
	public static function request_path() {
		$uri   = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- só vira hash.
		$parts = explode( '?', $uri, 2 );
		$path  = '' !== $parts[0] ? $parts[0] : '/';
		if ( TRINV_Slugs::$resolved ) {
			$path = TRINV_Slugs::original_path( get_post( TRINV_Slugs::$resolved ) ); // endereço traduzido → o original
		}
		$keep  = array();
		foreach ( explode( '&', isset( $parts[1] ) ? $parts[1] : '' ) as $kv ) {
			if ( '' !== $kv && ! preg_match( '/^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|msclkid|mc_[a-z]+|_ga|_gl|ref|notranslate|trinv|trinv_lang|trinv_warm)(=|$)/i', $kv ) ) {
				$keep[] = $kv;
			}
		}
		return $path . ( $keep ? '?' . implode( '&', $keep ) : '' );
	}

	/**
	 * Páginas da loja (WooCommerce): caminhos das páginas Loja, Carrinho, Checkout e Minha conta
	 * (`wl`, links do menu traduzidos com contexto de loja) e se esta página é da loja (`ws`).
	 *
	 * @return array
	 */
	public static function store_cfg() {
		if ( ! function_exists( 'wc_get_page_id' ) ) {
			return array();
		}
		$out = array();
		$wl  = array();
		foreach ( array( 'shop', 'cart', 'checkout', 'myaccount' ) as $page ) {
			$id = (int) wc_get_page_id( $page );
			$pp = $id > 0 ? wp_parse_url( (string) get_permalink( $id ), PHP_URL_PATH ) : '';
			if ( is_string( $pp ) && '' !== $pp ) {
				$wl[] = untrailingslashit( $pp );
			}
		}
		if ( $wl ) {
			$out['wl'] = $wl;
		}
		$is = ( function_exists( 'is_woocommerce' ) && is_woocommerce() )
			|| ( function_exists( 'is_cart' ) && is_cart() )
			|| ( function_exists( 'is_checkout' ) && is_checkout() )
			|| ( function_exists( 'is_account_page' ) && is_account_page() );
		if ( $is ) {
			$out['ws'] = 1;
		}
		return $out;
	}

	/**
	 * Idioma do CONTEÚDO desta página (nunca o idioma configurado no WordPress).
	 *
	 * @return string Código do Google ou '' (desconhecido → o navegador verifica).
	 */
	public static function hint() {
		if ( is_singular() ) {
			$post = get_queried_object();
			if ( $post instanceof WP_Post ) {
				// sem texto suficiente (carrinho/checkout da loja, construtores que guardam o texto
				// fora do post): desconhecido — o Google identifica e o servidor memoriza; nunca
				// supor o idioma do site (o visitante dessa língua ficaria sem tradução).
				return self::post_lang( $post );
			}
		}
		global $wp_query;
		$posts = ( $wp_query instanceof WP_Query && is_array( $wp_query->posts ) ) ? $wp_query->posts : array();
		if ( $posts ) {
			// lista de posts: se todos estão na mesma língua, é ela; se misturam línguas,
			// "desconhecido" (traduz tudo e o Google mantém o que já está na língua do visitante).
			$langs = array();
			foreach ( array_slice( $posts, 0, 30 ) as $p ) {
				if ( $p instanceof WP_Post ) {
					$l = self::post_lang( $p );
					if ( '' !== $l ) {
						$langs[ TRINV_Langs::family( $l ) ] = $l;
					}
				}
			}
			if ( 1 === count( $langs ) ) {
				return (string) reset( $langs );
			}
			if ( count( $langs ) > 1 ) {
				return '';
			}
		}
		return self::site_lang();
	}

	/**
	 * Idioma de um post (detectado pelo texto; guardado por versão do post).
	 *
	 * @param WP_Post $post Post.
	 * @return string
	 */
	public static function post_lang( $post ) {
		$ver = (string) $post->post_modified_gmt;
		if ( get_post_meta( $post->ID, '_trinv_lang_v', true ) === $ver ) {
			$l = (string) get_post_meta( $post->ID, '_trinv_lang', true );
			if ( '' === $l && get_post_meta( $post->ID, '_trinv_glang_v', true ) === $ver ) {
				$l = (string) get_post_meta( $post->ID, '_trinv_glang', true ); // confirmado pelo Google.
			}
			return $l;
		}
		$l = TRINV_Detect::detect( $post->post_title . ". \n" . $post->post_content );
		update_post_meta( $post->ID, '_trinv_lang', $l );
		update_post_meta( $post->ID, '_trinv_lang_v', $ver );
		return $l;
	}

	/**
	 * Idioma predominante do site (últimos conteúdos publicados) — reserva para páginas
	 * com pouco texto.
	 *
	 * @return string
	 */
	public static function site_lang() {
		$l = get_transient( 'trinv_site_lang' );
		if ( false !== $l ) {
			return (string) $l;
		}
		$posts = get_posts(
			array(
				'post_type'        => array( 'post', 'page' ),
				'post_status'      => 'publish',
				'numberposts'      => 12,
				'orderby'          => 'modified',
				'suppress_filters' => false,
			)
		);
		$text = '';
		foreach ( $posts as $p ) {
			$text .= $p->post_title . ". \n" . wp_trim_words( $p->post_content, 150, '' ) . "\n";
		}
		$l = TRINV_Detect::detect( $text );
		set_transient( 'trinv_site_lang', $l, DAY_IN_SECONDS );
		return $l;
	}

	/**
	 * O Google confirmou o idioma de um post que o detector local não soube dizer.
	 * Só preenche o desconhecido (nunca contradiz o detector) e só com maioria clara.
	 *
	 * @param int    $post_id  Post.
	 * @param string $dominant Idioma dominante.
	 * @param array  $lens     Idioma => caracteres.
	 */
	public static function remember_verified( $post_id, $dominant, array $lens ) {
		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status ) {
			return;
		}
		$ver = (string) $post->post_modified_gmt;
		if ( get_post_meta( $post_id, '_trinv_lang_v', true ) !== $ver || '' !== (string) get_post_meta( $post_id, '_trinv_lang', true ) ) {
			return;
		}
		$total = array_sum( $lens );
		if ( ! $total || $lens[ $dominant ] / $total < 0.7 ) {
			return;
		}
		$code = TRINV_Langs::normalize( $dominant );
		if ( '' === $code || get_post_meta( $post_id, '_trinv_glang_v', true ) === $ver ) {
			return;
		}
		update_post_meta( $post_id, '_trinv_glang', $code );
		update_post_meta( $post_id, '_trinv_glang_v', $ver );
	}

	/**
	 * Lista de idiomas excluídos (texto livre → códigos).
	 *
	 * @param string $raw Texto.
	 * @return string[]
	 */
	public static function excluded_langs( $raw ) {
		$out = array();
		foreach ( preg_split( '/[\s,;]+/', $raw, -1, PREG_SPLIT_NO_EMPTY ) as $tag ) {
			$code = TRINV_Langs::normalize( $tag );
			if ( '' !== $code ) {
				$out[] = $code;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * Seletores CSS extras (só caracteres de seletor).
	 *
	 * @param string $raw Texto.
	 * @return string
	 */
	public static function clean_selectors( $raw ) {
		$raw = preg_replace( '/[^a-zA-Z0-9_\-#.,:\[\]="\' >+~*()]/', '', $raw );
		return trim( (string) $raw, " ,\t\n" );
	}
}
