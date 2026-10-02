<?php
/**
 * Endereço (URL) traduzido dos posts e páginas.
 *
 * Para cada post e idioma, gera uma vez um endereço a partir do título traduzido
 * (/grow-tomatoes/ → /cultivando-tomates-em-casa/). O navegador do visitante troca o endereço
 * na barra depois de traduzir a página; abrir o endereço traduzido mostra o mesmo post (sem
 * redirecionar; o <link rel="canonical"> continua no original).
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Endereços traduzidos.
 */
class TRINV_Slugs {

	/**
	 * Post aberto por um endereço traduzido nesta requisição (0 = endereço original).
	 *
	 * @var int
	 */
	public static $resolved = 0;

	/**
	 * Tabela.
	 *
	 * @return string
	 */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'trinv_slug';
	}

	/**
	 * Ganchos.
	 */
	public static function init() {
		add_filter( 'request', array( __CLASS__, 'request' ), 1 );
		add_filter( 'redirect_canonical', array( __CLASS__, 'no_canonical' ), 10, 1 );
		add_action( 'deleted_post', array( __CLASS__, 'forget' ) );
	}

	/**
	 * Ligado? (ajuste "Traduzir o endereço", endereços bonitos e licença).
	 *
	 * @return bool
	 */
	public static function enabled() {
		$o = trinv_options();
		return ! empty( $o['urls'] ) && ! empty( $o['enabled'] ) && '' !== (string) get_option( 'permalink_structure' ) && TRINV_License::active();
	}

	/**
	 * Abre o post certo quando o endereço é um endereço traduzido. Um post de verdade com o
	 * mesmo nome sempre tem prioridade.
	 *
	 * @param array $qv Variáveis da consulta.
	 * @return array
	 */
	public static function request( $qv ) {
		if ( is_admin() || ! is_array( $qv ) ) {
			return $qv;
		}
		$name = '';
		if ( ! empty( $qv['name'] ) && is_string( $qv['name'] ) ) {
			$name = $qv['name'];
		} elseif ( ! empty( $qv['pagename'] ) && is_string( $qv['pagename'] ) ) {
			$name = $qv['pagename'];
		}
		if ( '' === $name || ! self::enabled() ) {
			return $qv;
		}
		$parts = explode( '/', trim( $name, '/' ) );
		$last  = self::key( (string) end( $parts ) );
		if ( '' === $last ) {
			return $qv;
		}
		global $wpdb;
		$table = self::table();
		$id    = (int) $wpdb->get_var( $wpdb->prepare( "SELECT post_id FROM {$table} WHERE slug = %s LIMIT 1", $last ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
		$post  = $id ? get_post( $id ) : null;
		if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status || ! is_post_type_viewable( $post->post_type ) ) {
			return $qv;
		}
		$real = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_name = %s AND post_status = 'publish' LIMIT 1", $last ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		if ( $real ) {
			return $qv; // existe um post com esse nome: ele vence.
		}
		self::$resolved = $post->ID;
		$keep           = array_intersect_key( $qv, array_flip( array( 'page', 'paged', 'cpage', 'preview', 'trinv_lang', 'notranslate', 'trinv' ) ) );
		if ( function_exists( 'wc_get_page_id' ) && (int) wc_get_page_id( 'shop' ) === (int) $post->ID ) {
			return array_merge( $keep, array( 'post_type' => 'product' ) ); // a página "Loja" é a lista de produtos.
		}
		if ( 'page' === $post->post_type ) {
			return array_merge( $keep, array( 'page_id' => $post->ID ) );
		}
		return array_merge(
			$keep,
			array(
				'p'         => $post->ID,
				'post_type' => $post->post_type,
			)
		);
	}

	/**
	 * Sem redirecionar o endereço traduzido para o original.
	 *
	 * @param mixed $url Destino.
	 * @return mixed
	 */
	public static function no_canonical( $url ) {
		return self::$resolved ? false : $url;
	}

	/**
	 * Post apagado: some dos endereços.
	 *
	 * @param int $post_id Post.
	 */
	public static function forget( $post_id ) {
		global $wpdb;
		$wpdb->delete( self::table(), array( 'post_id' => (int) $post_id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * Nome do endereço como o WordPress guarda (minúsculas; fora do ASCII em %xx).
	 *
	 * @param string $s Trecho do endereço.
	 * @return string
	 */
	public static function key( $s ) {
		return (string) sanitize_title_for_query( rawurldecode( (string) $s ) );
	}

	/**
	 * Caminho original de um post (sem domínio).
	 *
	 * @param WP_Post $post Post.
	 * @return string
	 */
	public static function original_path( $post ) {
		$p = wp_parse_url( (string) get_permalink( $post ), PHP_URL_PATH );
		return is_string( $p ) && '' !== $p ? $p : '/';
	}

	/**
	 * Página da loja do WooCommerce (Loja, Carrinho, Checkout, Minha conta)?
	 *
	 * @param int $id Post.
	 * @return bool
	 */
	public static function is_store_page( $id ) {
		if ( ! function_exists( 'wc_get_page_id' ) ) {
			return false;
		}
		foreach ( array( 'shop', 'cart', 'checkout', 'myaccount' ) as $page ) {
			if ( (int) wc_get_page_id( $page ) === (int) $id ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Apaga os endereços traduzidos das páginas da loja (refeitos com contexto de loja).
	 */
	public static function forget_store_pages() {
		global $wpdb;
		if ( ! function_exists( 'wc_get_page_id' ) ) {
			return;
		}
		$table = self::table();
		foreach ( array( 'shop', 'cart', 'checkout', 'myaccount' ) as $page ) {
			$id = (int) wc_get_page_id( $page );
			if ( $id > 0 ) {
				$wpdb->delete( $table, array( 'post_id' => $id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			}
		}
	}

	/**
	 * Post cujo endereço pode ser traduzido nesta página: o post aberto ou, na loja do
	 * WooCommerce (lista de produtos), a página "Loja".
	 *
	 * @return int
	 */
	public static function current_id() {
		if ( is_singular() ) {
			return (int) get_queried_object_id();
		}
		if ( function_exists( 'is_shop' ) && function_exists( 'wc_get_page_id' ) && is_shop() && ! is_search() && wc_get_page_id( 'shop' ) > 0 ) {
			return (int) wc_get_page_id( 'shop' );
		}
		return 0;
	}

	/**
	 * O endereço desta página pode virar o traduzido? Só no endereço do próprio post (carrinho,
	 * checkout e conta da loja inclusive): nunca em /2/, /comment-page-2/ nem nos endereços de
	 * pedido do WooCommerce (/order-received/…, /order-pay/…, /my-account/orders/…), que os
	 * gateways de pagamento e o WooCommerce montam e leem.
	 *
	 * @param WP_Post|null $post Post aberto.
	 * @return bool
	 */
	public static function swappable( $post ) {
		if ( ! $post instanceof WP_Post ) {
			return false;
		}
		if ( function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url() ) {
			return false;
		}
		if ( (int) get_query_var( 'page' ) > 1 || (int) get_query_var( 'paged' ) > 1 || (int) get_query_var( 'cpage' ) > 0 ) {
			return false;
		}
		if ( self::$resolved ) {
			return true;
		}
		$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- só comparado.
		$path = (string) wp_parse_url( $uri, PHP_URL_PATH );
		return untrailingslashit( rawurldecode( $path ) ) === untrailingslashit( rawurldecode( self::original_path( $post ) ) );
	}

	/**
	 * Endereço traduzido de um post num idioma ('' se ainda não existe).
	 *
	 * @param WP_Post $post Post.
	 * @param string  $lang Idioma.
	 * @param array   $map  post_id => slug (desse idioma), se já carregado.
	 * @return string
	 */
	public static function path_for( $post, $lang, $map = null ) {
		$orig = self::original_path( $post );
		$segs = explode( '/', trim( $orig, '/' ) );
		if ( '' === $orig || '/' === $orig || ! $segs ) {
			return '';
		}
		$chain = is_post_type_hierarchical( $post->post_type ) ? array_merge( array_reverse( get_post_ancestors( $post ) ), array( $post->ID ) ) : array( $post->ID );
		if ( null === $map ) {
			$map = self::slugs( $chain, $lang );
		}
		if ( empty( $map[ $post->ID ] ) ) {
			return '';
		}
		$n = count( $segs );
		foreach ( array_reverse( $chain ) as $i => $id ) {
			$pos = $n - 1 - $i;
			if ( $pos < 0 ) {
				break;
			}
			if ( ! empty( $map[ $id ] ) ) {
				$segs[ $pos ] = $map[ $id ];
			}
		}
		return '/' . implode( '/', $segs ) . ( '/' === substr( $orig, -1 ) ? '/' : '' );
	}

	/**
	 * Nomes traduzidos de vários posts num idioma.
	 *
	 * @param int[]  $ids  Posts.
	 * @param string $lang Idioma.
	 * @return array post_id => slug
	 */
	private static function slugs( array $ids, $lang ) {
		global $wpdb;
		$ids = array_values( array_filter( array_map( 'intval', $ids ) ) );
		if ( ! $ids ) {
			return array();
		}
		$table = self::table();
		$in    = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT post_id, slug FROM {$table} WHERE l = %s AND post_id IN ({$in})", array_merge( array( $lang ), $ids ) ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		$out   = array();
		foreach ( (array) $rows as $r ) {
			$out[ (int) $r['post_id'] ] = (string) $r['slug'];
		}
		return $out;
	}

	/**
	 * Endereços já prontos do post atual (idioma => caminho), para o <head>.
	 *
	 * @param WP_Post $post Post.
	 * @return array
	 */
	public static function known_paths( $post ) {
		global $wpdb;
		$table = self::table();
		$langs = $wpdb->get_col( $wpdb->prepare( "SELECT l FROM {$table} WHERE post_id = %d", $post->ID ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
		$out   = array();
		foreach ( (array) $langs as $l ) {
			$p = self::path_for( $post, (string) $l );
			if ( '' !== $p ) {
				$out[ (string) $l ] = $p;
			}
		}
		return $out;
	}

	/**
	 * Garante o endereço traduzido de um post num idioma (traduz o título uma vez só).
	 *
	 * @param int    $post_id Post.
	 * @param string $lang    Idioma.
	 * @return string Caminho traduzido ('' = fica o original).
	 */
	public static function ensure( $post_id, $lang ) {
		$lang = TRINV_Langs::normalize( (string) $lang );
		$post = get_post( (int) $post_id );
		if ( '' === $lang || ! $post instanceof WP_Post || 'publish' !== $post->post_status || '' !== (string) $post->post_password
			|| ! is_post_type_viewable( $post->post_type ) || 'attachment' === $post->post_type || ! self::enabled() ) {
			return '';
		}
		$chain = is_post_type_hierarchical( $post->post_type ) ? array_merge( array_reverse( get_post_ancestors( $post ) ), array( $post->ID ) ) : array( $post->ID );
		$map   = self::slugs( $chain, $lang );
		foreach ( $chain as $id ) {
			if ( empty( $map[ $id ] ) ) {
				$slug = self::make( (int) $id, $lang );
				if ( '' !== $slug ) {
					$map[ $id ] = $slug;
				}
			}
		}
		return self::path_for( $post, $lang, $map );
	}

	/**
	 * Cria o nome traduzido (título traduzido → nome de endereço único).
	 *
	 * @param int    $id   Post.
	 * @param string $lang Idioma.
	 * @return string
	 */
	private static function make( $id, $lang ) {
		global $wpdb;
		$post = get_post( $id );
		if ( ! $post instanceof WP_Post ) {
			return '';
		}
		$src = TRINV_Frontend::post_lang( $post );
		if ( '' !== $src && TRINV_Langs::family( $src ) === TRINV_Langs::family( $lang ) ) {
			return ''; // já está nesse idioma: fica o endereço original.
		}
		$title = trim( html_entity_decode( wp_strip_all_tags( (string) $post->post_title ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
		if ( '' === $title ) {
			return '';
		}
		$store = self::is_store_page( $id );
		$q     = $store ? 'Online store page: <span id="m">' . esc_html( $title ) . '</span>' : esc_html( $title ); // sem contexto, "Checkout" vira "Confira" e "Shop", "Comprar".
		$res   = TRINV_Translator::translate( array( $q ), $lang, '' !== $src ? $src : 'auto' );
		$out   = is_string( $res[0][0] ) ? $res[0][0] : '';
		if ( $store ) {
			$out = preg_match( '#<span id="m">(.*?)</span>#s', $out, $m ) ? $m[1] : '';
		}
		$tr = trim( html_entity_decode( wp_strip_all_tags( $out ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
		if ( '' === $tr ) {
			return '';
		}
		$base = sanitize_title( $tr );
		if ( '' === $base || $base === $post->post_name ) {
			return '';
		}
		$table = self::table();
		$slug  = $base;
		for ( $i = 2; $i < 50; $i++ ) {
			$other = (int) $wpdb->get_var( $wpdb->prepare( "SELECT post_id FROM {$table} WHERE slug = %s AND post_id <> %d LIMIT 1", $slug, $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
			$real  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_name = %s AND ID <> %d LIMIT 1", $slug, $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			if ( ! $other && ! $real ) {
				break;
			}
			$slug = substr( $base, 0, 190 ) . '-' . $i;
		}
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$table} (post_id, l, slug, created) VALUES (%d, %s, %s, %s)", $id, $lang, $slug, current_time( 'mysql', true ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
		$saved = $wpdb->get_var( $wpdb->prepare( "SELECT slug FROM {$table} WHERE post_id = %d AND l = %s", $id, $lang ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
		return is_string( $saved ) ? $saved : '';
	}
}
