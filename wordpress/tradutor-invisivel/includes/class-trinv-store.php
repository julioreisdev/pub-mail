<?php
/**
 * Cache das traduções no banco.
 *
 * - trinv_seg:  trecho (hash de idioma + texto) → tradução. Reaproveitado entre páginas
 *               (menu, rodapé, widgets) e entre visitantes.
 * - trinv_page: página (hash do caminho) + idioma → mapa {origem: tradução}. Entregue numa
 *               única requisição logo no <head>, antes do HTML terminar de carregar.
 *
 * O cache só é escrito pelo servidor com o que ELE traduziu (nunca com texto vindo do
 * navegador), então um visitante mal-intencionado não consegue "envenenar" traduções.
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Acesso às tabelas.
 */
class TRINV_Store {

	const DB_VERSION = '4';
	const PAGE_MAX   = 3000; // itens por mapa de página.

	/**
	 * Tabela de trechos.
	 *
	 * @return string
	 */
	public static function seg_table() {
		global $wpdb;
		return $wpdb->prefix . 'trinv_seg';
	}

	/**
	 * Tabela de páginas.
	 *
	 * @return string
	 */
	public static function page_table() {
		global $wpdb;
		return $wpdb->prefix . 'trinv_page';
	}

	/**
	 * Cria/atualiza as tabelas (ativação e atualização do plugin).
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$seg     = self::seg_table();
		$page    = self::page_table();
		$slug    = TRINV_Slugs::table();
		dbDelta(
			"CREATE TABLE {$slug} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  post_id bigint(20) unsigned NOT NULL,
  l varchar(16) NOT NULL,
  slug varchar(200) NOT NULL,
  created datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY pl (post_id,l),
  KEY slug (slug(191))
) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$seg} (
  h char(64) NOT NULL,
  l varchar(16) NOT NULL,
  sl varchar(16) NOT NULL DEFAULT '',
  tr mediumtext NOT NULL,
  created datetime NOT NULL,
  PRIMARY KEY  (h),
  KEY created (created)
) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$page} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  u char(64) NOT NULL,
  l varchar(16) NOT NULL,
  sl varchar(16) NOT NULL DEFAULT '',
  m mediumtext NOT NULL,
  n int(10) unsigned NOT NULL DEFAULT 0,
  updated datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY ul (u,l),
  KEY updated (updated)
) {$charset};"
		);
		$was = (string) get_option( 'trinv_db_version' );
		update_option( 'trinv_db_version', self::DB_VERSION, false );
		if ( '' !== $was && version_compare( $was, '3', '<' ) && class_exists( 'TRINV_Slugs' ) ) {
			TRINV_Slugs::forget_store_pages(); // endereços da loja passam a sair com contexto de loja ("/confira/" → "/finalizar-compra/").
		}
		if ( '' !== $was && version_compare( $was, '4', '<' ) ) {
			self::keep_urls_on_upgrade(); // 1.5.0: a tradução de URL passou a nascer desligada; quem já tinha o plugin continua como estava.
		}
		delete_option( 'trinv_static' ); // testa de novo a pasta de arquivos estáticos.
		if ( ! wp_next_scheduled( 'trinv_prune' ) ) {
			wp_schedule_event( time() + DAY_IN_SECONDS, 'daily', 'trinv_prune' );
		}
	}

	/**
	 * 1.5.0: o padrão da tradução de URL virou "desligada" (só para instalações novas). Um site que já
	 * usava o plugin sem nunca ter salvo os ajustes rodava com ela ligada — grava isso explicitamente
	 * para nada mudar na atualização. Quem já tinha escolhido (chave 'urls' salva) fica como escolheu.
	 */
	private static function keep_urls_on_upgrade() {
		$saved = get_option( 'trinv_options', array() );
		$saved = is_array( $saved ) ? $saved : array();
		if ( array_key_exists( 'urls', $saved ) ) {
			return;
		}
		$saved['urls'] = 1;
		update_option( 'trinv_options', $saved );
	}

	/**
	 * Atualização sem reativar (plugin substituído por versão nova).
	 */
	public static function maybe_upgrade() {
		if ( get_option( 'trinv_db_version' ) !== self::DB_VERSION ) {
			self::install();
		}
		add_action( 'trinv_prune', array( __CLASS__, 'prune' ) );
	}

	/**
	 * Desativação: só para a limpeza agendada (dados ficam até desinstalar).
	 */
	public static function deactivate() {
		wp_clear_scheduled_hook( 'trinv_prune' );
		wp_clear_scheduled_hook( 'trinv_license_cron' );
	}

	/**
	 * Chave de um trecho.
	 *
	 * @param string $lang Idioma de destino.
	 * @param string $src  Trecho de origem.
	 * @return string
	 */
	public static function key( $lang, $src ) {
		return hash( 'sha256', $lang . "\n" . $src );
	}

	/**
	 * Busca traduções já feitas.
	 *
	 * @param string   $lang Idioma de destino.
	 * @param string[] $srcs Trechos.
	 * @return array src => array( tr, sl )
	 */
	public static function get_many( $lang, array $srcs ) {
		global $wpdb;
		$out   = array();
		$by_key = array();
		foreach ( $srcs as $s ) {
			$by_key[ self::key( $lang, $s ) ] = $s;
		}
		$table = self::seg_table();
		foreach ( array_chunk( array_keys( $by_key ), 400 ) as $keys ) {
			$ph   = implode( ',', array_fill( 0, count( $keys ), '%s' ) );
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT h, sl, tr FROM {$table} WHERE h IN ({$ph})", $keys ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
			foreach ( (array) $rows as $r ) {
				if ( isset( $by_key[ $r['h'] ] ) ) {
					$out[ $by_key[ $r['h'] ] ] = array( $r['tr'], $r['sl'] );
				}
			}
		}
		return $out;
	}

	/**
	 * Grava traduções.
	 *
	 * @param string $lang Idioma de destino.
	 * @param array  $rows src => array( tr, sl ).
	 */
	public static function put_many( $lang, array $rows ) {
		global $wpdb;
		if ( ! $rows ) {
			return;
		}
		$table = self::seg_table();
		$now   = current_time( 'mysql', true );
		foreach ( array_chunk( $rows, 150, true ) as $chunk ) {
			$values = array();
			$args   = array();
			foreach ( $chunk as $src => $pair ) {
				$values[] = '(%s,%s,%s,%s,%s)';
				array_push( $args, self::key( $lang, (string) $src ), $lang, substr( (string) $pair[1], 0, 16 ), (string) $pair[0], $now );
			}
			$sql = "INSERT INTO {$table} (h, l, sl, tr, created) VALUES " . implode( ',', $values ) . ' ON DUPLICATE KEY UPDATE tr = VALUES(tr), sl = VALUES(sl)';
			$wpdb->query( $wpdb->prepare( $sql, $args ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- placeholders montados acima
		}
	}

	/**
	 * Hash do caminho de uma página.
	 *
	 * @param string $path Caminho (ex.: /meu-post/).
	 * @return string
	 */
	public static function page_key( $path ) {
		return hash( 'sha256', (string) $path );
	}

	/**
	 * Mapa de traduções de uma página.
	 *
	 * @param string $path Caminho.
	 * @param string $lang Idioma de destino.
	 * @return array array( 'm' => array, 'sl' => string )
	 */
	public static function page_get( $path, $lang ) {
		global $wpdb;
		$table = self::page_table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT m, sl FROM {$table} WHERE u = %s AND l = %s", self::page_key( $path ), $lang ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		if ( ! $row ) {
			return array( 'm' => array(), 'sl' => '' );
		}
		$m = json_decode( $row['m'], true );
		return array( 'm' => is_array( $m ) ? $m : array(), 'sl' => (string) $row['sl'] );
	}

	/**
	 * Junta traduções novas no mapa da página.
	 *
	 * @param string $path Caminho.
	 * @param string $lang Idioma de destino.
	 * @param array  $map  src => tr.
	 * @param string $sl   Idioma dominante detectado.
	 */
	public static function page_merge( $path, $lang, array $map, $sl ) {
		global $wpdb;
		if ( ! $map ) {
			return;
		}
		$cur = self::page_get( $path, $lang );
		$m   = $cur['m'];
		if ( count( $m ) + count( $map ) > self::PAGE_MAX ) {
			$m = array(); // página mudou demais: recomeça só com o que está nela agora.
		}
		foreach ( $map as $src => $tr ) {
			$m[ (string) $src ] = (string) $tr;
		}
		$m     = array_slice( $m, -self::PAGE_MAX, null, true );
		$json  = wp_json_encode( $m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		$table = self::page_table();
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
			$wpdb->prepare(
				"INSERT INTO {$table} (u, l, sl, m, n, updated) VALUES (%s, %s, %s, %s, %d, %s) ON DUPLICATE KEY UPDATE m = VALUES(m), n = VALUES(n), updated = VALUES(updated), sl = IF(VALUES(sl) = '', sl, VALUES(sl))", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				self::page_key( $path ),
				$lang,
				substr( (string) $sl, 0, 16 ),
				$json,
				count( $m ),
				current_time( 'mysql', true )
			)
		);
		self::write_static( $path, $lang, $m, '' !== $sl ? $sl : $cur['sl'] );
	}

	/**
	 * Pasta dos mapas estáticos (servidos direto pelo servidor web, sem PHP).
	 *
	 * @return array|null array( dir, url )
	 */
	public static function static_dir() {
		$u = wp_upload_dir( null, false );
		if ( ! empty( $u['error'] ) || empty( $u['basedir'] ) ) {
			return null;
		}
		return array( trailingslashit( $u['basedir'] ) . 'trinv', trailingslashit( $u['baseurl'] ) . 'trinv/' );
	}

	/**
	 * A pasta de estáticos funciona neste servidor? (testado uma vez e guardado)
	 *
	 * @return bool
	 */
	public static function static_ok() {
		$ok = get_option( 'trinv_static' );
		if ( false === $ok ) {
			$ok = self::probe_static() ? 'yes' : 'no';
			update_option( 'trinv_static', $ok, false );
		}
		return 'yes' === $ok;
	}

	/**
	 * Cria a pasta e confirma que dá para gravar e ler.
	 *
	 * @return bool
	 */
	private static function probe_static() {
		$d = self::static_dir();
		if ( ! $d || ! wp_mkdir_p( $d[0] ) ) {
			return false;
		}
		if ( ! file_exists( $d[0] . '/index.php' ) ) {
			file_put_contents( $d[0] . '/index.php', "<?php\n// Silence is golden.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}
		$f = $d[0] . '/probe.json';
		$w = file_put_contents( $f, '{"ok":1}' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		$ok = $w && '{"ok":1}' === file_get_contents( $f ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		wp_delete_file( $f );
		return (bool) $ok;
	}

	/**
	 * Nome do arquivo estático de uma página (o navegador calcula o mesmo: sha256 do caminho).
	 *
	 * @param string $path Caminho.
	 * @param string $lang Idioma.
	 * @return string
	 */
	public static function static_name( $path, $lang ) {
		return hash( 'sha256', (string) $path ) . '-' . preg_replace( '/[^a-zA-Z-]/', '', (string) $lang ) . '.json';
	}

	/**
	 * Grava o mapa da página como JSON estático (troca atômica).
	 *
	 * @param string $path Caminho.
	 * @param string $lang Idioma.
	 * @param array  $m    Mapa.
	 * @param string $sl   Idioma dominante.
	 */
	private static function write_static( $path, $lang, array $m, $sl ) {
		if ( ! self::static_ok() ) {
			return;
		}
		$d    = self::static_dir();
		$file = $d[0] . '/' . self::static_name( $path, $lang );
		$tmp  = $file . '.' . wp_generate_password( 6, false ) . '.tmp';
		$json = wp_json_encode( array( 'm' => (object) $m, 'sl' => (string) $sl ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( $json && false !== file_put_contents( $tmp, $json ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			if ( ! @rename( $tmp, $file ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged,WordPress.WP.AlternativeFunctions.rename_rename
				wp_delete_file( $tmp );
			}
		}
	}

	/**
	 * Idiomas que já têm mapa estático para esta página (olha os arquivos, sem banco).
	 *
	 * @param string $path Caminho.
	 * @return string[]
	 */
	public static function static_langs( $path ) {
		if ( ! self::static_ok() ) {
			return array();
		}
		$d   = self::static_dir();
		$h   = hash( 'sha256', (string) $path );
		$out = array();
		foreach ( (array) glob( $d[0] . '/' . $h . '-*.json' ) as $f ) {
			if ( preg_match( '/-([a-zA-Z-]+)\.json$/', (string) $f, $m ) ) {
				$out[] = $m[1];
			}
		}
		return $out;
	}

	/**
	 * Esvazia os mapas estáticos. Os arquivos continuam existindo (vazios): páginas guardadas
	 * por plugins de cache ainda apontam para eles e não devem gerar erro 404 no navegador.
	 */
	public static function clear_static() {
		$d = self::static_dir();
		if ( ! $d || ! is_dir( $d[0] ) ) {
			return;
		}
		foreach ( (array) glob( $d[0] . '/*.json' ) as $f ) {
			file_put_contents( $f, '{"m":{},"sl":""}' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}
	}

	/**
	 * Números para a tela de ajustes.
	 *
	 * @return array
	 */
	public static function stats() {
		global $wpdb;
		$seg   = self::seg_table();
		$page  = self::page_table();
		$s     = $wpdb->get_row( "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(tr)),0) AS b FROM {$seg}", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		$p     = $wpdb->get_row( "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(m)),0) AS b FROM {$page}", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		$langs = $wpdb->get_results( "SELECT l, COUNT(*) AS n FROM {$page} GROUP BY l ORDER BY n DESC LIMIT 12", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		return array(
			'segments' => (int) ( $s['n'] ?? 0 ),
			'pages'    => (int) ( $p['n'] ?? 0 ),
			'bytes'    => (int) ( $s['b'] ?? 0 ) + (int) ( $p['b'] ?? 0 ),
			'langs'    => is_array( $langs ) ? $langs : array(),
		);
	}

	/**
	 * Apaga todas as traduções.
	 */
	public static function clear() {
		global $wpdb;
		$wpdb->query( 'TRUNCATE TABLE ' . self::seg_table() ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery,WordPress.DB.DirectDatabaseQuery.SchemaChange,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
		$wpdb->query( 'TRUNCATE TABLE ' . self::page_table() ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery,WordPress.DB.DirectDatabaseQuery.SchemaChange,PluginCheck.Security.DirectDB.UnescapedDBParameter -- nome de tabela vem de $wpdb->prefix
		self::clear_static();
		delete_metadata( 'post', 0, '_trinv_glang', '', true );
		delete_metadata( 'post', 0, '_trinv_glang_v', '', true );
	}

	/**
	 * Limpeza diária: mapas de página parados há 90 dias e trechos com mais de 1 ano.
	 */
	public static function prune() {
		global $wpdb;
		$page = self::page_table();
		$seg  = self::seg_table();
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$page} WHERE updated < %s", gmdate( 'Y-m-d H:i:s', time() - 90 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$seg} WHERE created < %s", gmdate( 'Y-m-d H:i:s', time() - 365 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- nome de tabela vem de $wpdb->prefix
		$d = self::static_dir();
		if ( $d && is_dir( $d[0] ) ) {
			foreach ( (array) glob( $d[0] . '/*.json' ) as $f ) {
				if ( @filemtime( $f ) < time() - 90 * DAY_IN_SECONDS ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
					wp_delete_file( $f );
				}
			}
		}
	}
}
