<?php
/**
 * Copys: a biblioteca de notificações prontas (título, texto, emoji ou imagem, imagem grande, link).
 * Cadastro um a um ou por planilha (.xlsx/.csv, com modelo para baixar), filtros (disponíveis/usadas),
 * ações em massa, "Enviar agora", teste no aparelho da equipe e métricas por copy (disparos, entregues,
 * cliques). Os broadcasts sorteiam daqui. Tela "Copys" do painel.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Modelo + importação + tela.
 */
class PIP_Copies {

	const PAGE       = 'push-in-play'; // 1ª tela do grupo herda o slug do menu
	const ICON_MODES = array( 'site', 'emoji', 'image' );
	const PER_PAGE   = 40;
	const MAX_IMPORT = 1000;

	/**
	 * Cabeçalhos da planilha (chave interna → rótulo no modelo) e sinônimos aceitos na importação.
	 */
	const COLUMNS = array(
		'title'     => 'titulo',
		'body'      => 'texto',
		'icon_emoji' => 'emoji',
		'icon_url'  => 'imagem_icone',
		'image_url' => 'imagem_grande',
		'url'       => 'link',
	);
	const ALIASES = array(
		'title'      => array( 'titulo', 'title', 'nome', 'name', 'assunto' ),
		'body'       => array( 'texto', 'descricao', 'mensagem', 'body', 'description', 'text', 'corpo', 'conteudo' ),
		'icon_emoji' => array( 'emoji', 'icone emoji', 'icon emoji' ),
		'icon_url'   => array( 'imagem icone', 'imagem do icone', 'icone', 'icon', 'icon url', 'icone url', 'imagem_icone', 'icone imagem', 'icon_url' ),
		'image_url'  => array( 'imagem grande', 'imagem', 'image', 'image url', 'banner', 'imagem_grande', 'image_url', 'foto' ),
		'url'        => array( 'link', 'url', 'link ao tocar', 'destino', 'link_ao_tocar' ),
	);

	/**
	 * Hooks.
	 */
	public static function init() {
		add_action( 'admin_post_pip_copies_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_pip_copies_action', array( __CLASS__, 'handle_action' ) );
		add_action( 'admin_post_pip_copies_bulk', array( __CLASS__, 'handle_bulk' ) );
		add_action( 'admin_post_pip_copies_import', array( __CLASS__, 'handle_import' ) );
		add_action( 'admin_post_pip_copies_template', array( __CLASS__, 'handle_template' ) );
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
		$r['id']          = (int) $r['id'];
		$r['used']        = (bool) $r['used'];
		$r['used_count']  = (int) $r['used_count'];
		$r['sent_count']  = (int) $r['sent_count'];
		$r['click_count'] = (int) $r['click_count'];
		return $r;
	}

	/**
	 * Copy em branco (editor).
	 *
	 * @return array
	 */
	public static function blank() {
		return array(
			'id'           => 0,
			'title'        => '',
			'body'         => '',
			'icon_mode'    => get_site_icon_url( 96 ) ? 'site' : 'emoji',
			'icon_emoji'   => '🔔',
			'icon_url'     => '',
			'image_url'    => '',
			'url'          => '',
			'used'         => false,
			'used_count'   => 0,
			'sent_count'   => 0,
			'click_count'  => 0,
			'last_used_at' => null,
			'source'       => 'manual',
		);
	}

	/**
	 * Uma copy.
	 *
	 * @param int $id Id.
	 * @return array|null
	 */
	public static function get( $id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PIP_Store::table( 'copies' ) . ' WHERE id = %d', (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return $row ? self::cast( $row ) : null;
	}

	/**
	 * Limpa os campos de conteúdo (formulário, importação).
	 *
	 * @param array $d Cru.
	 * @return array
	 */
	public static function sanitize( $d ) {
		$icon_url  = mb_substr( esc_url_raw( isset( $d['icon_url'] ) ? trim( (string) $d['icon_url'] ) : '' ), 0, 255 );
		$emoji     = mb_substr( sanitize_text_field( isset( $d['icon_emoji'] ) ? (string) $d['icon_emoji'] : '' ), 0, 16 );
		$mode      = isset( $d['icon_mode'] ) && in_array( $d['icon_mode'], self::ICON_MODES, true ) ? $d['icon_mode'] : '';
		if ( ! $mode ) {
			$mode = $icon_url ? 'image' : ( '' !== $emoji ? 'emoji' : 'site' );
		}
		return array(
			'title'      => mb_substr( sanitize_text_field( isset( $d['title'] ) ? (string) $d['title'] : '' ), 0, 120 ),
			'body'       => mb_substr( sanitize_textarea_field( isset( $d['body'] ) ? (string) $d['body'] : '' ), 0, 255 ),
			'icon_mode'  => $mode,
			'icon_emoji' => $emoji,
			'icon_url'   => $icon_url,
			'image_url'  => mb_substr( esc_url_raw( isset( $d['image_url'] ) ? trim( (string) $d['image_url'] ) : '' ), 0, 255 ),
			'url'        => mb_substr( esc_url_raw( isset( $d['url'] ) ? trim( (string) $d['url'] ) : '' ), 0, 255 ),
		);
	}

	/**
	 * Grava.
	 *
	 * @param array    $d      Cru.
	 * @param int|null $id     Id (null = nova).
	 * @param string   $source manual|import.
	 * @return int Id.
	 */
	public static function save( $d, $id = null, $source = 'manual' ) {
		global $wpdb;
		$t   = PIP_Store::table( 'copies' );
		$row = self::sanitize( $d );
		if ( '' === $row['title'] ) {
			$row['title'] = 'Copy sem título';
		}
		$row['updated_at'] = current_time( 'mysql' );
		if ( $id ) {
			$wpdb->update( $t, $row, array( 'id' => (int) $id ) );
			return (int) $id;
		}
		$row['created_at'] = $row['updated_at'];
		$row['source']     = 'import' === $source ? 'import' : 'manual';
		$wpdb->insert( $t, $row );
		return (int) $wpdb->insert_id;
	}

	/**
	 * Apaga (as métricas do histórico ficam: cada disparo guarda uma cópia do conteúdo).
	 *
	 * @param int[] $ids Ids.
	 * @return int
	 */
	public static function delete( $ids ) {
		global $wpdb;
		$ids = array_filter( array_map( 'intval', (array) $ids ) );
		if ( ! $ids ) {
			return 0;
		}
		return (int) $wpdb->query( 'DELETE FROM ' . PIP_Store::table( 'copies' ) . ' WHERE id IN (' . implode( ',', $ids ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Marca como usada / disponível.
	 *
	 * @param int[] $ids  Ids.
	 * @param bool  $used Usada.
	 * @return int
	 */
	public static function set_used( $ids, $used ) {
		global $wpdb;
		$ids = array_filter( array_map( 'intval', (array) $ids ) );
		if ( ! $ids ) {
			return 0;
		}
		return (int) $wpdb->query( $wpdb->prepare( 'UPDATE ' . PIP_Store::table( 'copies' ) . ' SET used = %d, updated_at = %s WHERE id IN (' . implode( ',', $ids ) . ')', $used ? 1 : 0, current_time( 'mysql' ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Duplica (volta disponível, sem métricas).
	 *
	 * @param int $id Id.
	 * @return int|null
	 */
	public static function duplicate( $id ) {
		$c = self::get( $id );
		if ( ! $c ) {
			return null;
		}
		$c['title'] = mb_substr( $c['title'] . ' (cópia)', 0, 120 );
		return self::save( $c );
	}

	/**
	 * Totais.
	 *
	 * @return array {total, available, used, sent, clicked}
	 */
	public static function counts() {
		global $wpdb;
		$r = $wpdb->get_row( 'SELECT COUNT(*) total, SUM(used = 0) available, SUM(used = 1) used, COALESCE(SUM(sent_count), 0) sent, COALESCE(SUM(click_count), 0) clicked FROM ' . PIP_Store::table( 'copies' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return array(
			'total'     => $r ? (int) $r->total : 0,
			'available' => $r ? (int) $r->available : 0,
			'used'      => $r ? (int) $r->used : 0,
			'sent'      => $r ? (int) $r->sent : 0,
			'clicked'   => $r ? (int) $r->clicked : 0,
		);
	}

	/**
	 * Lista com filtros.
	 *
	 * @param array $a {q, filter all|available|used, orderby newest|title|used|sent|clicks, page}.
	 * @return array {items, total, pages, page}
	 */
	public static function query( $a ) {
		global $wpdb;
		$t     = PIP_Store::table( 'copies' );
		$conds = array( '1=1' );
		$f     = isset( $a['filter'] ) ? $a['filter'] : 'all';
		if ( 'available' === $f ) {
			$conds[] = 'used = 0';
		} elseif ( 'used' === $f ) {
			$conds[] = 'used = 1';
		}
		$q = isset( $a['q'] ) ? trim( (string) $a['q'] ) : '';
		if ( '' !== $q ) {
			$like    = '%' . $wpdb->esc_like( $q ) . '%';
			$conds[] = $wpdb->prepare( '(title LIKE %s OR body LIKE %s OR url LIKE %s)', $like, $like, $like );
		}
		$orders = array(
			'newest' => 'id DESC',
			'oldest' => 'id ASC',
			'title'  => 'title ASC, id DESC',
			'used'   => 'last_used_at DESC, id DESC',
			'sent'   => 'sent_count DESC, id DESC',
			'clicks' => 'click_count DESC, id DESC',
		);
		$ob    = isset( $a['orderby'] ) && isset( $orders[ $a['orderby'] ] ) ? $orders[ $a['orderby'] ] : $orders['newest'];
		$where = implode( ' AND ', $conds );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t} WHERE {$where}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$pages = max( 1, (int) ceil( $total / self::PER_PAGE ) );
		$page  = max( 1, min( $pages, (int) ( isset( $a['page'] ) ? $a['page'] : 1 ) ) );
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$t} WHERE {$where} ORDER BY {$ob} LIMIT %d OFFSET %d", self::PER_PAGE, ( $page - 1 ) * self::PER_PAGE ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return array(
			'items' => array_map( array( __CLASS__, 'cast' ), $rows ? $rows : array() ),
			'total' => $total,
			'pages' => $pages,
			'page'  => $page,
		);
	}

	/**
	 * Quantas copys podem ser sorteadas num modo.
	 *
	 * @param string $mode mark_used|delete|keep.
	 * @return int
	 */
	public static function available_count( $mode ) {
		global $wpdb;
		$t   = PIP_Store::table( 'copies' );
		$and = self::pick_and( $mode );
		return (int) $wpdb->get_var( 'mark_used' === $mode ? "SELECT COUNT(*) FROM {$t} WHERE used = 0{$and}" : "SELECT COUNT(*) FROM {$t} WHERE 1{$and}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Condição extra do sorteio (filtro `pip_copies_pick_sql`): restringe o conjunto de copys que um broadcast
	 * pode sortear — usado pelos testes para nunca tocar copys reais e gancho para segmentação futura.
	 *
	 * @param string $mode Modo.
	 * @return string '' ou ' AND (…)'.
	 */
	private static function pick_and( $mode ) {
		$extra = trim( (string) apply_filters( 'pip_copies_pick_sql', '', $mode ) );
		return '' === $extra ? '' : " AND ({$extra})";
	}

	/**
	 * Sorteia uma copy para um broadcast. "Marcar como usada" só sorteia entre as disponíveis; "apagar" e
	 * "manter" sorteiam entre todas (no "manter", evita repetir a última usada quando há mais de uma).
	 *
	 * @param string $mode mark_used|delete|keep.
	 * @return array|null
	 */
	public static function pick( $mode ) {
		global $wpdb;
		$t = PIP_Store::table( 'copies' );
		$and = self::pick_and( $mode );
		if ( 'mark_used' === $mode ) {
			$row = $wpdb->get_row( "SELECT * FROM {$t} WHERE used = 0{$and} ORDER BY RAND() LIMIT 1", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		} elseif ( 'keep' === $mode ) {
			// prefere as menos usadas recentemente (sorteio entre as mais "descansadas"), sem repetir a última
			$row = $wpdb->get_row( "SELECT * FROM {$t} WHERE (id NOT IN (SELECT id FROM (SELECT id FROM {$t} WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT 1) x) OR (SELECT COUNT(*) FROM {$t} WHERE 1{$and}) = 1){$and} ORDER BY RAND() LIMIT 1", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		} else {
			$row = $wpdb->get_row( "SELECT * FROM {$t} WHERE 1{$and} ORDER BY RAND() LIMIT 1", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		return $row ? self::cast( $row ) : null;
	}

	/**
	 * Copy no formato de "passo" (payload da notificação).
	 *
	 * @param array $c Copy.
	 * @return array
	 */
	public static function as_step( $c ) {
		return array(
			'id'         => (int) $c['id'],
			'title'      => $c['title'],
			'body'       => $c['body'],
			'icon_mode'  => $c['icon_mode'],
			'icon_emoji' => $c['icon_emoji'],
			'icon_url'   => $c['icon_url'],
			'image_url'  => $c['image_url'],
			'url'        => $c['url'] ? $c['url'] : home_url( '/' ),
		);
	}

	/**
	 * Depois de um disparo: aplica o modo (apagar / marcar usada / manter) e conta o uso.
	 *
	 * @param int    $copy_id Copy.
	 * @param string $mode    mark_used|delete|keep.
	 */
	public static function note_sent( $copy_id, $mode ) {
		global $wpdb;
		$t = PIP_Store::table( 'copies' );
		if ( 'delete' === $mode ) {
			$wpdb->delete( $t, array( 'id' => (int) $copy_id ) );
			return;
		}
		$wpdb->query( $wpdb->prepare( "UPDATE {$t} SET used_count = used_count + 1, last_used_at = %s, used = IF(%d, 1, used) WHERE id = %d", current_time( 'mysql' ), 'mark_used' === $mode ? 1 : 0, (int) $copy_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Recalcula entregues/cliques da copy a partir dos disparos dela (poucas linhas por copy).
	 *
	 * @param int $copy_id Copy.
	 */
	public static function refresh_stats( $copy_id ) {
		global $wpdb;
		$copy_id = (int) $copy_id;
		if ( ! $copy_id ) {
			return;
		}
		$bt = PIP_Store::table( 'blasts' );
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . PIP_Store::table( 'copies' ) . " SET sent_count = (SELECT COALESCE(SUM(sent), 0) FROM {$bt} WHERE copy_id = %d), click_count = (SELECT COALESCE(SUM(clicked), 0) FROM {$bt} WHERE copy_id = %d) WHERE id = %d", $copy_id, $copy_id, $copy_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/* ------------------------------------------------------------------ importação */

	/**
	 * Normaliza um cabeçalho para casar com os sinônimos.
	 *
	 * @param string $h Texto.
	 * @return string
	 */
	private static function norm_header( $h ) {
		$h = strtolower( trim( remove_accents( (string) $h ) ) );
		$h = preg_replace( '/[^a-z0-9]+/', ' ', $h );
		return trim( $h );
	}

	/**
	 * Cabeçalho → mapa coluna(índice) → campo. Sem cabeçalho reconhecido = ordem do modelo.
	 *
	 * @param array $header 1ª linha.
	 * @return array{map:array<int,string>, has_header:bool}
	 */
	public static function map_headers( $header ) {
		$map = array();
		foreach ( $header as $i => $h ) {
			$n = self::norm_header( $h );
			if ( '' === $n ) {
				continue;
			}
			foreach ( self::ALIASES as $field => $names ) {
				if ( in_array( $n, array_map( array( __CLASS__, 'norm_header' ), $names ), true ) && ! in_array( $field, $map, true ) ) {
					$map[ $i ] = $field;
					break;
				}
			}
		}
		if ( in_array( 'title', $map, true ) ) {
			return array( 'map' => $map, 'has_header' => true );
		}
		return array( 'map' => array_combine( range( 0, count( self::COLUMNS ) - 1 ), array_keys( self::COLUMNS ) ), 'has_header' => false );
	}

	/**
	 * Lê o arquivo enviado (.csv ou .xlsx) → linhas (arrays de células).
	 *
	 * @param string $path Arquivo temporário.
	 * @param string $name Nome original.
	 * @return array|WP_Error
	 */
	public static function parse_file( $path, $name ) {
		if ( ! is_readable( (string) $path ) ) {
			return new WP_Error( 'pip_import', 'Arquivo não encontrado.' );
		}
		$ext = strtolower( pathinfo( (string) $name, PATHINFO_EXTENSION ) );
		$fh  = fopen( $path, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$sig = $fh ? fread( $fh, 4 ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
		if ( $fh ) {
			fclose( $fh ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		}
		if ( 'xlsx' === $ext || "PK\x03\x04" === $sig ) {
			return self::parse_xlsx( $path );
		}
		if ( in_array( $ext, array( 'csv', 'txt', 'tsv', '' ), true ) ) {
			return self::parse_csv( (string) file_get_contents( $path ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
		return new WP_Error( 'pip_import', 'Formato não reconhecido: use .xlsx ou .csv (baixe o modelo).' );
	}

	/**
	 * CSV → linhas. Detecta separador (; , tab), tira o BOM e converte de Windows-1252 se não for UTF-8.
	 *
	 * @param string $text Conteúdo.
	 * @return array
	 */
	public static function parse_csv( $text ) {
		$text = (string) $text;
		if ( 0 === strpos( $text, "\xEF\xBB\xBF" ) ) {
			$text = substr( $text, 3 );
		}
		if ( ! mb_check_encoding( $text, 'UTF-8' ) ) {
			$text = mb_convert_encoding( $text, 'UTF-8', 'Windows-1252' );
		}
		$first = strtok( $text, "\r\n" );
		$first = false === $first ? '' : $first;
		$best  = ',';
		$bestn = -1;
		foreach ( array( ';', ',', "\t", '|' ) as $d ) {
			$n = substr_count( $first, $d );
			if ( $n > $bestn ) {
				$bestn = $n;
				$best  = $d;
			}
		}
		$rows = array();
		$h    = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		fwrite( $h, $text ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
		rewind( $h );
		while ( ( $r = fgetcsv( $h, 0, $best, '"', '\\' ) ) !== false ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fgetcsv
			if ( array( null ) === $r ) {
				continue; // linha vazia
			}
			$rows[] = array_map( 'strval', $r );
			if ( count( $rows ) > self::MAX_IMPORT + 1 ) {
				break;
			}
		}
		fclose( $h ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		return $rows;
	}

	/**
	 * Letra(s) da coluna → índice (A=0, Z=25, AA=26…).
	 *
	 * @param string $ref Referência (ex.: C7).
	 * @return int
	 */
	private static function col_index( $ref ) {
		$letters = preg_replace( '/[^A-Z]/', '', strtoupper( (string) $ref ) );
		$n       = 0;
		$len     = strlen( $letters );
		for ( $i = 0; $i < $len; $i++ ) {
			$n = $n * 26 + ( ord( $letters[ $i ] ) - 64 );
		}
		return max( 0, $n - 1 );
	}

	/**
	 * XLSX (1ª planilha) → linhas. Sem biblioteca: ZipArchive + XML (namespace-agnóstico).
	 *
	 * @param string $path Arquivo.
	 * @return array|WP_Error
	 */
	public static function parse_xlsx( $path ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			return new WP_Error( 'pip_import', 'Este servidor não lê .xlsx (PHP sem ZipArchive). Salve a planilha como .csv e importe de novo.' );
		}
		$zip = new ZipArchive();
		if ( true !== $zip->open( $path ) ) {
			return new WP_Error( 'pip_import', 'Não foi possível abrir o .xlsx.' );
		}
		$load = function ( $xml ) {
			if ( ! $xml ) {
				return null;
			}
			$prev = libxml_use_internal_errors( true );
			$doc  = simplexml_load_string( $xml );
			libxml_clear_errors();
			libxml_use_internal_errors( $prev );
			return $doc ? $doc : null;
		};
		// 1ª planilha: workbook → rels → target
		$sheet_path = 'xl/worksheets/sheet1.xml';
		$wb         = $load( $zip->getFromName( 'xl/workbook.xml' ) );
		$rels       = $load( $zip->getFromName( 'xl/_rels/workbook.xml.rels' ) );
		if ( $wb && $rels ) {
			$first = $wb->xpath( '//*[local-name()="sheets"]/*[local-name()="sheet"]' );
			if ( $first ) {
				$rid = '';
				foreach ( $first[0]->attributes( 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' ) as $k => $v ) {
					if ( 'id' === $k ) {
						$rid = (string) $v;
					}
				}
				foreach ( $rels->xpath( '//*[local-name()="Relationship"]' ) as $rel ) {
					if ( (string) $rel['Id'] === $rid ) {
						$target     = ltrim( (string) $rel['Target'], '/' );
						$sheet_path = 0 === strpos( $target, 'xl/' ) ? $target : 'xl/' . $target;
					}
				}
			}
		}
		$shared = array();
		$ss     = $load( $zip->getFromName( 'xl/sharedStrings.xml' ) );
		if ( $ss ) {
			foreach ( $ss->xpath( '//*[local-name()="si"]' ) as $si ) {
				$txt = '';
				foreach ( $si->xpath( './/*[local-name()="t"]' ) as $t ) {
					$txt .= (string) $t;
				}
				$shared[] = $txt;
			}
		}
		$sheet = $load( $zip->getFromName( $sheet_path ) );
		$zip->close();
		if ( ! $sheet ) {
			return new WP_Error( 'pip_import', 'A planilha .xlsx está vazia ou num formato que não consegui ler. Salve como .csv e tente de novo.' );
		}
		$rows = array();
		foreach ( $sheet->xpath( '//*[local-name()="sheetData"]/*[local-name()="row"]' ) as $row ) {
			$cells = array();
			$max   = -1;
			foreach ( $row->xpath( '*[local-name()="c"]' ) as $c ) {
				$idx  = self::col_index( (string) $c['r'] );
				$type = (string) $c['t'];
				$val  = '';
				if ( 's' === $type ) {
					$v   = $c->xpath( '*[local-name()="v"]' );
					$val = $v && isset( $shared[ (int) $v[0] ] ) ? $shared[ (int) $v[0] ] : '';
				} elseif ( 'inlineStr' === $type ) {
					foreach ( $c->xpath( './/*[local-name()="t"]' ) as $t ) {
						$val .= (string) $t;
					}
				} else {
					$v   = $c->xpath( '*[local-name()="v"]' );
					$val = $v ? (string) $v[0] : '';
				}
				$cells[ $idx ] = $val;
				$max           = max( $max, $idx );
			}
			if ( $max < 0 ) {
				continue;
			}
			$line = array();
			for ( $i = 0; $i <= $max; $i++ ) {
				$line[] = isset( $cells[ $i ] ) ? $cells[ $i ] : '';
			}
			$rows[] = $line;
			if ( count( $rows ) > self::MAX_IMPORT + 1 ) {
				break;
			}
		}
		return $rows;
	}

	/**
	 * Importa as linhas lidas. Pula vazias, sem título e (opcional) iguais a copys já cadastradas.
	 *
	 * @param array $rows      Linhas (arrays).
	 * @param bool  $skip_dups Pular título+texto já existentes.
	 * @return array {imported, skipped, errors[], total}
	 */
	public static function import( $rows, $skip_dups = true ) {
		global $wpdb;
		$out = array( 'imported' => 0, 'skipped' => 0, 'errors' => array(), 'total' => 0 );
		if ( ! $rows ) {
			$out['errors'][] = 'Planilha vazia.';
			return $out;
		}
		$hm    = self::map_headers( $rows[0] );
		$map   = $hm['map'];
		$start = $hm['has_header'] ? 1 : 0;
		$t     = PIP_Store::table( 'copies' );
		$seen  = array();
		if ( $skip_dups ) {
			foreach ( $wpdb->get_results( "SELECT title, body FROM {$t}", ARRAY_A ) as $e ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$seen[ md5( $e['title'] . "\n" . $e['body'] ) ] = true;
			}
		}
		$n = count( $rows );
		for ( $i = $start; $i < $n; $i++ ) {
			if ( $out['imported'] >= self::MAX_IMPORT ) {
				$out['errors'][] = 'Limite de ' . self::MAX_IMPORT . ' copys por importação; o resto não entrou.';
				break;
			}
			$r = $rows[ $i ];
			if ( '' === trim( implode( '', array_map( 'strval', $r ) ) ) ) {
				continue; // linha em branco
			}
			$out['total']++;
			$d = array();
			foreach ( $map as $idx => $field ) {
				$d[ $field ] = isset( $r[ $idx ] ) ? trim( (string) $r[ $idx ] ) : '';
			}
			$row = self::sanitize( $d );
			if ( '' === $row['title'] ) {
				$out['skipped']++;
				$out['errors'][] = 'Linha ' . ( $i + 1 ) . ': sem título.';
				continue;
			}
			$key = md5( $row['title'] . "\n" . $row['body'] );
			if ( $skip_dups && isset( $seen[ $key ] ) ) {
				$out['skipped']++;
				continue;
			}
			$seen[ $key ] = true;
			self::save( $row, null, 'import' );
			$out['imported']++;
		}
		return $out;
	}

	/**
	 * Linhas do modelo (cabeçalho + 2 exemplos).
	 *
	 * @return array
	 */
	private static function template_rows() {
		return array(
			array_values( self::COLUMNS ),
			array( 'Novidade no ar 🚀', 'Acabou de sair um conteúdo novo. Toque para ver antes de todo mundo.', '🚀', '', '', home_url( '/' ) ),
			array( 'Última chance de hoje', 'A oferta termina à meia-noite. Garanta a sua agora.', '', 'https://exemplo.com/icone-192.png', 'https://exemplo.com/banner-1200x600.jpg', home_url( '/oferta' ) ),
		);
	}

	/**
	 * Modelo em CSV (UTF-8 com BOM e ";", que o Excel em português abre direto).
	 *
	 * @return string
	 */
	public static function template_csv() {
		$h = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		foreach ( self::template_rows() as $r ) {
			fputcsv( $h, $r, ';', '"', '\\' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fputcsv
		}
		rewind( $h );
		$csv = stream_get_contents( $h );
		fclose( $h ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		return "\xEF\xBB\xBF" . $csv;
	}

	/**
	 * Modelo em .xlsx (escritor mínimo: strings inline, larguras de coluna). Null sem ZipArchive.
	 *
	 * @return string|null Binário.
	 */
	public static function template_xlsx() {
		if ( ! class_exists( 'ZipArchive' ) ) {
			return null;
		}
		$tmp = wp_tempnam( 'pip-modelo.xlsx' );
		$zip = new ZipArchive();
		if ( true !== $zip->open( $tmp, ZipArchive::OVERWRITE ) ) {
			return null;
		}
		$esc  = function ( $s ) {
			return htmlspecialchars( (string) $s, ENT_XML1 | ENT_QUOTES, 'UTF-8' );
		};
		$rows = '';
		$n    = 0;
		foreach ( self::template_rows() as $r ) {
			$n++;
			$cells = '';
			foreach ( $r as $i => $v ) {
				$col    = chr( 65 + $i );
				$cells .= '<c r="' . $col . $n . '" t="inlineStr"' . ( 1 === $n ? ' s="1"' : '' ) . '><is><t>' . $esc( $v ) . '</t></is></c>';
			}
			$rows .= '<row r="' . $n . '">' . $cells . '</row>';
		}
		$sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="6" width="40" customWidth="1"/></cols><sheetData>' . $rows . '</sheetData></worksheet>';
		$zip->addFromString( '[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' );
		$zip->addFromString( '_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' );
		$zip->addFromString( 'xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Copys" sheetId="1" r:id="rId1"/></sheets></workbook>' );
		$zip->addFromString( 'xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' );
		$zip->addFromString( 'xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>' );
		$zip->addFromString( 'xl/worksheets/sheet1.xml', $sheet );
		$zip->close();
		$bin = file_get_contents( $tmp ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		wp_delete_file( $tmp );
		return $bin ? $bin : null;
	}

	/* ------------------------------------------------------------------ handlers */

	/**
	 * Salvar.
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_copies_save' );
		$id = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
		$c  = isset( $_POST['c'] ) && is_array( $_POST['c'] ) ? wp_unslash( $_POST['c'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$id = self::save( $c, $id ? $id : null );
		$again = ! empty( $_POST['save_new'] );
		wp_safe_redirect( self::url( $again ? array( 'new' => 1, 'msg' => 'saved' ) : array( 'msg' => 'saved' ) ) );
		exit;
	}

	/**
	 * Ações por link (nonce).
	 */
	public static function handle_action() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		$do = isset( $_GET['do'] ) ? sanitize_key( wp_unslash( $_GET['do'] ) ) : '';
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( 'pip_copies_' . $do . '_' . $id );
		$args = array( 'msg' => $do );
		switch ( $do ) {
			case 'delete':
				self::delete( array( $id ) );
				break;
			case 'used':
				self::set_used( array( $id ), true );
				break;
			case 'available':
				self::set_used( array( $id ), false );
				break;
			case 'duplicate':
				$new = self::duplicate( $id );
				$args = $new ? array( 'edit' => $new, 'msg' => 'duplicated' ) : array();
				break;
			case 'send':
				$c = self::get( $id );
				if ( $c ) {
					$bid = PIP_Flow::blast( self::as_step( $c ), array( 'kind' => 'manual', 'copy_id' => $c['id'] ) );
					if ( $bid ) {
						self::note_sent( $c['id'], 'keep' );
						$args = array( 'msg' => 'sent', 'blast' => $bid );
					} else {
						$args = array( 'msg' => 'send_fail' );
					}
				}
				break;
		}
		wp_safe_redirect( self::url( $args ) );
		exit;
	}

	/**
	 * Ações em massa (POST).
	 */
	public static function handle_bulk() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_copies_bulk' );
		$ids = isset( $_POST['ids'] ) && is_array( $_POST['ids'] ) ? array_map( 'intval', $_POST['ids'] ) : array();
		$do  = isset( $_POST['bulk'] ) ? sanitize_key( wp_unslash( $_POST['bulk'] ) ) : '';
		$n   = 0;
		if ( $ids ) {
			if ( 'delete' === $do ) {
				$n = self::delete( $ids );
			} elseif ( 'used' === $do ) {
				$n = self::set_used( $ids, true );
			} elseif ( 'available' === $do ) {
				$n = self::set_used( $ids, false );
			}
		}
		wp_safe_redirect( self::url( array( 'msg' => 'bulk_' . $do, 'n' => (int) $n ) ) );
		exit;
	}

	/**
	 * Importar planilha (POST multipart).
	 */
	public static function handle_import() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_copies_import' );
		if ( empty( $_FILES['sheet'] ) || ! is_array( $_FILES['sheet'] ) || empty( $_FILES['sheet']['tmp_name'] ) || UPLOAD_ERR_OK !== (int) $_FILES['sheet']['error'] ) {
			wp_safe_redirect( self::url( array( 'msg' => 'import_nofile' ) ) );
			exit;
		}
		$f = $_FILES['sheet']; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( (int) $f['size'] > 5 * MB_IN_BYTES ) {
			wp_safe_redirect( self::url( array( 'msg' => 'import_big' ) ) );
			exit;
		}
		$rows = self::parse_file( (string) $f['tmp_name'], sanitize_file_name( (string) $f['name'] ) );
		if ( is_wp_error( $rows ) ) {
			set_transient( 'pip_import_result_' . get_current_user_id(), array( 'errors' => array( $rows->get_error_message() ), 'imported' => 0, 'skipped' => 0, 'total' => 0 ), 300 );
			wp_safe_redirect( self::url( array( 'msg' => 'import' ) ) );
			exit;
		}
		$res = self::import( $rows, ! empty( $_POST['skip_dups'] ) );
		set_transient( 'pip_import_result_' . get_current_user_id(), $res, 300 );
		wp_safe_redirect( self::url( array( 'msg' => 'import' ) ) );
		exit;
	}

	/**
	 * Baixar o modelo (?format=xlsx|csv).
	 */
	public static function handle_template() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_copies_template' );
		$fmt = isset( $_GET['format'] ) ? sanitize_key( wp_unslash( $_GET['format'] ) ) : 'xlsx';
		nocache_headers();
		if ( 'xlsx' === $fmt ) {
			$bin = self::template_xlsx();
			if ( $bin ) {
				header( 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
				header( 'Content-Disposition: attachment; filename="modelo-copys-push-in-play.xlsx"' );
				header( 'Content-Length: ' . strlen( $bin ) );
				echo $bin; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				exit;
			}
		}
		$csv = self::template_csv();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="modelo-copys-push-in-play.csv"' );
		header( 'Content-Length: ' . strlen( $csv ) );
		echo $csv; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	/* ------------------------------------------------------------------ tela */

	/**
	 * Scripts da tela.
	 */
	public static function assets() {
		wp_enqueue_script( 'pip-copies-admin', PIP_URL . 'assets/pip-copies-admin.js', array( 'pip-flow-admin' ), PIP_VERSION, true );
	}

	/**
	 * Link de ação com nonce.
	 *
	 * @param string $do Ação.
	 * @param int    $id Id.
	 * @return string
	 */
	private static function action_url( $do, $id ) {
		return wp_nonce_url( admin_url( 'admin-post.php?action=pip_copies_action&do=' . $do . '&id=' . (int) $id ), 'pip_copies_' . $do . '_' . (int) $id );
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
			$c = self::get( (int) $_GET['edit'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $c ) {
				self::editor( $c );
				return;
			}
		}
		self::listing();
	}

	/**
	 * Avisos.
	 */
	private static function notices() {
		$msg = isset( $_GET['msg'] ) ? sanitize_key( wp_unslash( $_GET['msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$n   = isset( $_GET['n'] ) ? (int) $_GET['n'] : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$map = array(
			'saved'          => 'Copy salva.',
			'delete'         => 'Copy apagada (o histórico dos disparos dela continua).',
			'used'           => 'Copy marcada como usada: os broadcasts com "marcar como usada" não a sorteiam mais.',
			'available'      => 'Copy de volta à lista das disponíveis.',
			'duplicated'     => 'Copy duplicada — edite a cópia abaixo.',
			'send_fail'      => 'Não foi possível disparar (nenhum inscrito ativo?).',
			'bulk_delete'    => $n . ' copy(s) apagada(s).',
			'bulk_used'      => $n . ' copy(s) marcada(s) como usada(s).',
			'bulk_available' => $n . ' copy(s) de volta às disponíveis.',
			'import_nofile'  => 'Escolha um arquivo .xlsx ou .csv antes de importar.',
			'import_big'     => 'Arquivo grande demais (máx. 5 MB).',
		);
		if ( 'sent' === $msg ) {
			$bl = isset( $_GET['blast'] ) ? PIP_Flow::blast_row( (int) $_GET['blast'] ) : null; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="pip-notice">Disparo criado' . ( $bl ? ' para ' . (int) $bl['total'] . ' aparelho(s): ' . (int) $bl['sent'] . ' já entregues' . ( 'done' === $bl['status'] ? '.' : ' — o resto sai em segundo plano.' ) : '.' ) . ' Acompanhe em <a href="' . esc_url( PIP_Broadcasts::url( array( 'view' => 'history' ) ) ) . '">Broadcasts → Histórico</a>.</div>';
		} elseif ( 'import' === $msg ) {
			$r = get_transient( 'pip_import_result_' . get_current_user_id() );
			delete_transient( 'pip_import_result_' . get_current_user_id() );
			if ( is_array( $r ) ) {
				$cls = $r['imported'] ? '' : ' is-warn';
				echo '<div class="pip-notice' . esc_attr( $cls ) . '"><strong>Importação:</strong> ' . (int) $r['imported'] . ' copy(s) importada(s)' . ( $r['skipped'] ? ', ' . (int) $r['skipped'] . ' pulada(s)' : '' ) . ( $r['total'] ? ' de ' . (int) $r['total'] . ' linha(s)' : '' ) . '.';
				if ( ! empty( $r['errors'] ) ) {
					echo '<br><span class="pip-muted">' . esc_html( implode( ' · ', array_slice( $r['errors'], 0, 8 ) ) ) . ( count( $r['errors'] ) > 8 ? ' …' : '' ) . '</span>';
				}
				echo '</div>';
			}
		} elseif ( isset( $map[ $msg ] ) ) {
			echo '<div class="pip-notice">' . esc_html( $map[ $msg ] ) . '</div>';
		}
	}

	/**
	 * Lista.
	 */
	private static function listing() {
		$filter  = isset( $_GET['filter'] ) ? sanitize_key( wp_unslash( $_GET['filter'] ) ) : 'all'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$filter  = in_array( $filter, array( 'all', 'available', 'used' ), true ) ? $filter : 'all';
		$q       = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$orderby = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( $_GET['orderby'] ) ) : 'newest'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$pg      = isset( $_GET['pg'] ) ? (int) $_GET['pg'] : 1; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$counts  = self::counts();
		$res     = self::query( array( 'filter' => $filter, 'q' => $q, 'orderby' => $orderby, 'page' => $pg ) );
		$qs      = array_filter( array( 'filter' => 'all' === $filter ? '' : $filter, 'q' => $q, 'orderby' => 'newest' === $orderby ? '' : $orderby ) );
		$tpl     = function ( $fmt ) {
			return wp_nonce_url( admin_url( 'admin-post.php?action=pip_copies_template&format=' . $fmt ), 'pip_copies_template' );
		};
		$show_import = isset( $_GET['import'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		?>
		<div class="pip-toolbar">
			<div class="pip-kpis">
				<div class="pip-kpi"><span class="pip-kpi__label">Copys</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $counts['total'] ) ); ?></span></div>
				<div class="pip-kpi is-accent"><span class="pip-kpi__label">Disponíveis</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $counts['available'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Usadas</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $counts['used'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Entregues (todas)</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $counts['sent'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Cliques (todas)</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $counts['clicked'] ) ); ?></span></div>
			</div>
			<div class="pip-toolbar__right">
				<a class="pip-button" href="<?php echo esc_url( self::url( array( 'import' => 1 ) ) ); ?>#pip-import"><?php echo PIP_Admin::icon( 'upload', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Importar planilha</a>
				<a class="pip-button is-primary" href="<?php echo esc_url( self::url( array( 'new' => 1 ) ) ); ?>"><?php echo PIP_Admin::icon( 'plus', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Nova copy</a>
			</div>
		</div>

		<section class="pip-card pip-section pip-import<?php echo $show_import ? ' is-open' : ''; ?>" id="pip-import">
			<div class="pip-toolbar" style="margin:0 0 8px">
				<div>
					<h2 class="pip-section__title" style="margin:0">Importar copys de uma planilha</h2>
					<p class="pip-help" style="margin-top:4px">Monte a planilha no modelo (uma copy por linha) e envie: .xlsx (Excel, Google Sheets, Numbers) ou .csv. Colunas: <code>titulo</code> (obrigatório), <code>texto</code>, <code>emoji</code>, <code>imagem_icone</code> (URL), <code>imagem_grande</code> (URL), <code>link</code>. Até <?php echo (int) self::MAX_IMPORT; ?> por vez.</p>
				</div>
				<div class="pip-toolbar__right">
					<a class="pip-button is-ghost" href="<?php echo esc_url( $tpl( 'xlsx' ) ); ?>"><?php echo PIP_Admin::icon( 'download', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Modelo .xlsx</a>
					<a class="pip-button is-ghost" href="<?php echo esc_url( $tpl( 'csv' ) ); ?>"><?php echo PIP_Admin::icon( 'download', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Modelo .csv</a>
				</div>
			</div>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data" class="pip-import__form">
				<?php wp_nonce_field( 'pip_copies_import' ); ?>
				<input type="hidden" name="action" value="pip_copies_import">
				<label class="pip-import__file"><input type="file" name="sheet" accept=".xlsx,.csv,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required><span class="pip-import__pick"><?php echo PIP_Admin::icon( 'sheet', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Escolher planilha</span><span class="pip-import__name" data-file-label>nenhum arquivo escolhido</span></label>
				<label class="pip-switch"><input type="checkbox" name="skip_dups" value="1" checked><i></i> Pular copys iguais às já cadastradas (mesmo título e texto)</label>
				<button type="submit" class="pip-button is-primary"><?php echo PIP_Admin::icon( 'upload', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Importar</button>
			</form>
		</section>

		<div class="pip-toolbar pip-toolbar--filters">
			<div class="pip-seg" role="group" aria-label="Filtro">
				<?php foreach ( array( 'all' => 'Todas', 'available' => 'Disponíveis', 'used' => 'Usadas' ) as $k => $label ) : ?>
					<a class="pip-seg__item<?php echo $k === $filter ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array_merge( $qs, array( 'filter' => $k ) ) ) ); ?>"><?php echo esc_html( $label ); ?></a>
				<?php endforeach; ?>
			</div>
			<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" class="pip-filters">
				<input type="hidden" name="page" value="<?php echo esc_attr( self::PAGE ); ?>">
				<?php if ( 'all' !== $filter ) : ?><input type="hidden" name="filter" value="<?php echo esc_attr( $filter ); ?>"><?php endif; ?>
				<span class="pip-search"><?php echo PIP_Admin::icon( 'search', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?><input type="search" name="q" value="<?php echo esc_attr( $q ); ?>" placeholder="Buscar no título, texto ou link" class="pip-filters__search"></span>
				<select name="orderby" class="pip-filters__select">
					<?php foreach ( array( 'newest' => 'Mais novas', 'oldest' => 'Mais antigas', 'title' => 'Título A–Z', 'used' => 'Usadas há menos tempo', 'sent' => 'Mais entregues', 'clicks' => 'Mais cliques' ) as $k => $label ) : ?>
						<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $k, $orderby ); ?>><?php echo esc_html( $label ); ?></option>
					<?php endforeach; ?>
				</select>
				<button type="submit" class="pip-button is-ghost">Filtrar</button>
			</form>
			<div class="pip-device-inline"><span class="pip-pill" id="pip-device-status"><i></i> verificando…</span><span class="pip-help" id="pip-device-msg" style="margin:0"></span></div>
		</div>

		<?php if ( ! $res['items'] ) : ?>
			<section class="pip-card pip-empty">
				<span class="pip-empty__icon" aria-hidden="true"><?php echo PIP_Admin::icon( 'copy', 30 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
				<h2 class="pip-empty__title"><?php echo $q || 'all' !== $filter ? 'Nenhuma copy com esse filtro' : 'Sua biblioteca está vazia'; ?></h2>
				<p class="pip-empty__text"><?php echo $q || 'all' !== $filter ? 'Troque o filtro ou limpe a busca.' : 'Cada copy é uma notificação pronta: título, texto, ícone e link. Crie a primeira ou importe dezenas de uma vez pela planilha — os broadcasts sorteiam daqui.'; ?></p>
				<?php if ( ! ( $q || 'all' !== $filter ) ) : ?>
				<div class="pip-empty__actions">
					<a class="pip-button is-primary is-lg" href="<?php echo esc_url( self::url( array( 'new' => 1 ) ) ); ?>"><?php echo PIP_Admin::icon( 'plus', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Criar a primeira copy</a>
					<a class="pip-button is-lg" href="<?php echo esc_url( self::url( array( 'import' => 1 ) ) ); ?>#pip-import"><?php echo PIP_Admin::icon( 'upload', 16 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Importar planilha</a>
				</div>
				<?php else : ?>
				<div class="pip-empty__actions"><a class="pip-button" href="<?php echo esc_url( self::url() ); ?>">Limpar filtros</a></div>
				<?php endif; ?>
			</section>
		<?php else : ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="pip-copies-form">
			<?php wp_nonce_field( 'pip_copies_bulk' ); ?>
			<input type="hidden" name="action" value="pip_copies_bulk">
			<div class="pip-bulk">
				<label class="pip-check"><input type="checkbox" data-check-all><span>Selecionar todas desta página</span></label>
				<span class="pip-bulk__count" data-bulk-count>0 selecionada(s)</span>
				<span class="pip-bulk__actions">
					<button type="submit" class="pip-button is-ghost" name="bulk" value="available" disabled data-bulk>Marcar disponíveis</button>
					<button type="submit" class="pip-button is-ghost" name="bulk" value="used" disabled data-bulk>Marcar usadas</button>
					<button type="submit" class="pip-button is-ghost is-danger" name="bulk" value="delete" disabled data-bulk data-confirm="Apagar as copys selecionadas? O histórico dos disparos continua.">Apagar</button>
				</span>
				<span class="pip-muted" style="margin-left:auto"><?php echo esc_html( number_format_i18n( $res['total'] ) ); ?> copy(s)<?php echo $res['pages'] > 1 ? ' · página ' . (int) $res['page'] . ' de ' . (int) $res['pages'] : ''; ?></span>
			</div>
			<div class="pip-copies">
				<?php foreach ( $res['items'] as $c ) : ?>
					<?php $ctr = $c['sent_count'] ? round( 100 * $c['click_count'] / $c['sent_count'], 1 ) : 0; ?>
					<article class="pip-card pip-copy<?php echo $c['used'] ? ' is-used' : ' is-available'; ?>">
						<label class="pip-check pip-copy__check"><input type="checkbox" name="ids[]" value="<?php echo (int) $c['id']; ?>"><span class="screen-reader-text">Selecionar</span></label>
						<div class="pip-copy__top"><span class="pip-copy__id">#<?php echo (int) $c['id']; ?></span><span class="pip-muted"><?php echo esc_html( mysql2date( 'd/m/Y', $c['created_at'] ) ); ?></span><?php if ( 'import' === $c['source'] ) : ?><span class="pip-chip pip-chip--xs"><?php echo PIP_Admin::icon( 'sheet', 12 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> planilha</span><?php endif; ?></div>
						<div class="pip-notif pip-copy__notif">
							<img class="pip-notif__icon" src="<?php echo esc_url( PIP_Flow::icon_url( $c ) ); ?>" alt="" loading="lazy">
							<div class="pip-notif__body">
								<div class="pip-notif__site"><?php echo esc_html( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ); ?> · agora</div>
								<div class="pip-notif__title"><?php echo esc_html( $c['title'] ); ?></div>
								<div class="pip-notif__text"><?php echo esc_html( $c['body'] ); ?></div>
								<?php if ( $c['image_url'] ) : ?><img class="pip-notif__image" src="<?php echo esc_url( $c['image_url'] ); ?>" alt="" loading="lazy"><?php endif; ?>
							</div>
						</div>
						<div class="pip-copy__meta">
							<?php if ( $c['used'] ) : ?>
								<span class="pip-pill"><i></i> Usada<?php echo $c['last_used_at'] ? ' · ' . esc_html( mysql2date( 'd/m H:i', $c['last_used_at'] ) ) : ''; ?></span>
							<?php else : ?>
								<span class="pip-pill is-on"><i></i> Disponível</span>
							<?php endif; ?>
							<span class="pip-tl-stat"><b><?php echo (int) $c['used_count']; ?></b> disparo(s)</span>
							<span class="pip-tl-stat"><b><?php echo esc_html( number_format_i18n( $c['sent_count'] ) ); ?></b> entregues</span>
							<span class="pip-tl-stat"><b><?php echo esc_html( number_format_i18n( $c['click_count'] ) ); ?></b> cliques<?php echo $c['sent_count'] ? ' · ' . esc_html( $ctr ) . '%' : ''; ?></span>
							<span class="pip-tl-link">→ <?php echo esc_html( $c['url'] ? wp_parse_url( $c['url'], PHP_URL_HOST ) . wp_parse_url( $c['url'], PHP_URL_PATH ) : 'início' ); ?></span>
						</div>
						<div class="pip-layout__actions pip-copy__actions">
							<a class="pip-button" href="<?php echo esc_url( self::url( array( 'edit' => $c['id'] ) ) ); ?>"><?php echo PIP_Admin::icon( 'edit', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Editar</a>
							<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( 'send', $c['id'] ) ); ?>" onclick="return confirm('Enviar esta copy AGORA para todos os inscritos?');"><?php echo PIP_Admin::icon( 'send', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Enviar agora</a>
							<button type="button" class="pip-button is-ghost pip-copy-test" data-copy="<?php echo (int) $c['id']; ?>"><?php echo PIP_Admin::icon( 'device', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Testar aqui</button>
							<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( $c['used'] ? 'available' : 'used', $c['id'] ) ); ?>" title="<?php echo $c['used'] ? 'Volta a poder ser sorteada' : 'Sai do sorteio dos broadcasts que marcam como usada'; ?>"><?php echo PIP_Admin::icon( $c['used'] ? 'rotate' : 'tag', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> <?php echo $c['used'] ? 'Disponível' : 'Usada'; ?></a>
							<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( 'duplicate', $c['id'] ) ); ?>"><?php echo PIP_Admin::icon( 'copy', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Duplicar</a>
							<a class="pip-button is-ghost is-danger" href="<?php echo esc_url( self::action_url( 'delete', $c['id'] ) ); ?>" onclick="return confirm('Apagar esta copy? O histórico dos disparos dela continua.');" aria-label="Apagar"><?php echo PIP_Admin::icon( 'trash', 15 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></a>
						</div>
					</article>
				<?php endforeach; ?>
			</div>
		</form>
		<?php if ( $res['pages'] > 1 ) : ?>
			<div class="pip-pager">
				<?php for ( $p = 1; $p <= $res['pages']; $p++ ) : ?>
					<a class="pip-seg__item<?php echo $p === $res['page'] ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array_merge( $qs, array( 'pg' => $p ) ) ) ); ?>"><?php echo (int) $p; ?></a>
				<?php endfor; ?>
			</div>
		<?php endif; ?>
		<?php endif; ?>
		<p class="pip-hint pip-hint--foot">"Disponível" = pode ser sorteada por um broadcast configurado para marcar como usada. "Enviar agora" dispara para todos os inscritos na hora e conta como disparo sem marcar a copy. Apagar uma copy não apaga as métricas dos disparos já feitos (cada disparo guarda uma cópia do conteúdo).</p>
		<?php
	}

	/**
	 * Editor.
	 *
	 * @param array $c Copy.
	 */
	private static function editor( $c ) {
		?>
		<a class="pip-back" href="<?php echo esc_url( self::url() ); ?>">← Todas as copys</a>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="pip-editor" id="pip-copy-form">
			<?php wp_nonce_field( 'pip_copies_save' ); ?>
			<input type="hidden" name="action" value="pip_copies_save">
			<input type="hidden" name="id" value="<?php echo (int) $c['id']; ?>">
			<div class="pip-editor__form">
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Notificação</h2>
					<label class="pip-field"><span>Título</span><input type="text" name="c[title]" value="<?php echo esc_attr( $c['title'] ); ?>" maxlength="120" required autofocus></label>
					<label class="pip-field"><span>Texto</span><textarea name="c[body]" rows="3" maxlength="255"><?php echo esc_textarea( $c['body'] ); ?></textarea></label>
					<label class="pip-field"><span>Link ao tocar</span><input type="url" name="c[url]" value="<?php echo esc_attr( $c['url'] ); ?>" maxlength="255" placeholder="<?php echo esc_attr( home_url( '/' ) ); ?>"></label>
					<p class="pip-help">Deixe em branco para abrir a página inicial. Emojis no título e no texto funcionam em todos os aparelhos.</p>
				</section>
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Ícone e imagem</h2>
					<div class="pip-row" data-icon-fields data-mode="<?php echo esc_attr( $c['icon_mode'] ); ?>">
						<label class="pip-field pip-field--sm"><span>Ícone</span><select name="c[icon_mode]">
							<option value="site" <?php selected( 'site', $c['icon_mode'] ); ?>>Ícone do site</option>
							<option value="emoji" <?php selected( 'emoji', $c['icon_mode'] ); ?>>Emoji</option>
							<option value="image" <?php selected( 'image', $c['icon_mode'] ); ?>>Imagem (URL)</option>
						</select></label>
						<label class="pip-field pip-field--sm" data-for="emoji"><span>Emoji</span><input type="text" name="c[icon_emoji]" value="<?php echo esc_attr( $c['icon_emoji'] ); ?>" maxlength="16"></label>
						<label class="pip-field pip-field--grow" data-for="image"><span>URL da imagem do ícone (quadrada, PNG/JPG)</span><input type="url" name="c[icon_url]" value="<?php echo esc_attr( $c['icon_url'] ); ?>" maxlength="255"></label>
					</div>
					<label class="pip-field"><span>Imagem grande (opcional, URL)</span><input type="url" name="c[image_url]" value="<?php echo esc_attr( $c['image_url'] ); ?>" maxlength="255"></label>
					<p class="pip-help">A imagem grande aparece expandida no Android e no Chrome do computador; o iPhone mostra só ícone, título e texto. Emoji vira imagem automaticamente.</p>
				</section>
				<div class="pip-editor__save">
					<button type="submit" class="pip-button is-primary is-lg">Salvar copy</button>
					<?php if ( ! $c['id'] ) : ?><button type="submit" class="pip-button" name="save_new" value="1">Salvar e criar outra</button><?php endif; ?>
					<button type="button" class="pip-button" id="pip-copy-test-form">Enviar como teste para este aparelho</button>
					<a class="pip-button is-ghost" href="<?php echo esc_url( self::url() ); ?>">Cancelar</a>
				</div>
			</div>
			<aside class="pip-editor__preview">
				<div class="pip-preview-head"><span class="pip-section__title">Prévia</span></div>
				<div class="pip-notif-preview">
					<div class="pip-notif" id="pip-copy-preview">
						<img class="pip-notif__icon" src="<?php echo esc_url( PIP_Flow::icon_url( $c ) ); ?>" alt="">
						<div class="pip-notif__body">
							<div class="pip-notif__site"><?php echo esc_html( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ); ?> · agora</div>
							<div class="pip-notif__title"><?php echo esc_html( $c['title'] ); ?></div>
							<div class="pip-notif__text"><?php echo esc_html( $c['body'] ); ?></div>
							<img class="pip-notif__image" src="<?php echo esc_url( $c['image_url'] ); ?>" alt="" <?php echo $c['image_url'] ? '' : 'hidden'; ?>>
						</div>
					</div>
				</div>
				<p class="pip-help">Aparência aproximada (Android / Chrome). Cada sistema desenha a notificação do seu jeito.</p>
				<p class="pip-help" id="pip-device-msg" style="margin-top:6px"></p>
				<span class="pip-pill" id="pip-device-status" style="margin-top:4px"><i></i> verificando…</span>
			</aside>
		</form>
		<?php
	}
}
