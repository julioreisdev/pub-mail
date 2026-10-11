<?php
/**
 * Banco do Push In Play: layouts do popup, estatísticas diárias por layout e inscritos (push).
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Tabelas e acesso a dados.
 */
class PIP_Store {

	const DB_VERSION = 8;

	/**
	 * Plataformas reconhecidas pelo User-Agent (chave → rótulo), na ordem de exibição.
	 */
	const PLATFORMS = array(
		'android' => 'Android',
		'ios'     => 'iPhone / iPad',
		'windows' => 'Windows',
		'macos'   => 'Mac',
		'linux'   => 'Linux',
		'outro'   => 'Outros',
	);
	const TYPES      = array( 'modal', 'bar-top', 'bar-bottom', 'corner-tl', 'corner-tr', 'corner-bl', 'corner-br' );
	const EVENTS     = array( 'impression', 'click', 'granted', 'denied', 'dismissed', 'installed' );

	/**
	 * Nome de tabela com prefixo.
	 *
	 * @param string $t layouts|stats|subscribers.
	 * @return string
	 */
	public static function table( $t ) {
		global $wpdb;
		return $wpdb->prefix . 'pip_' . $t;
	}

	/**
	 * Cria/atualiza as tabelas (dbDelta) e semeia o 1º layout.
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$from    = (int) get_option( 'pip_db_version', 0 );
		$charset = $wpdb->get_charset_collate();
		$sstats  = self::table( 'send_stats' );
		$copies  = self::table( 'copies' );
		$bcasts  = self::table( 'broadcasts' );
		$layouts = self::table( 'layouts' );
		$stats   = self::table( 'stats' );
		$subs    = self::table( 'subscribers' );
		$steps   = self::table( 'flow_steps' );
		$queue   = self::table( 'queue' );
		$sends   = self::table( 'sends' );
		$blasts  = self::table( 'blasts' );
		$log     = self::table( 'log' );
		// v4 → v5: fila e envios ganham blast_id ("Enviar agora"); a chave única da fila muda.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $queue ) ) && ! $wpdb->get_var( "SHOW COLUMNS FROM {$queue} LIKE 'blast_id'" ) ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "ALTER TABLE {$queue} DROP INDEX sub_step, ADD COLUMN blast_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER step_id, ADD UNIQUE KEY sub_ref (subscriber_id, step_id, blast_id)" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		// v1 → v2: estatísticas ganham a dimensão plataforma (dbDelta não troca chave primária).
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $stats ) ) && ! $wpdb->get_var( "SHOW COLUMNS FROM {$stats} LIKE 'platform'" ) ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "ALTER TABLE {$stats} DROP PRIMARY KEY, ADD COLUMN platform VARCHAR(20) NOT NULL DEFAULT 'outro' AFTER day, ADD PRIMARY KEY (layout_id, day, platform)" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		dbDelta(
			"CREATE TABLE {$layouts} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				name VARCHAR(120) NOT NULL,
				type VARCHAR(20) NOT NULL DEFAULT 'modal',
				enabled TINYINT(1) NOT NULL DEFAULT 0,
				weight INT UNSIGNED NOT NULL DEFAULT 100,
				config LONGTEXT NULL,
				css_mode VARCHAR(10) NOT NULL DEFAULT 'append',
				custom_css LONGTEXT NULL,
				position INT NOT NULL DEFAULT 0,
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				KEY enabled (enabled, position)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$stats} (
				layout_id BIGINT UNSIGNED NOT NULL,
				day DATE NOT NULL,
				platform VARCHAR(20) NOT NULL DEFAULT 'outro',
				impressions INT UNSIGNED NOT NULL DEFAULT 0,
				clicks INT UNSIGNED NOT NULL DEFAULT 0,
				granted INT UNSIGNED NOT NULL DEFAULT 0,
				denied INT UNSIGNED NOT NULL DEFAULT 0,
				dismissed INT UNSIGNED NOT NULL DEFAULT 0,
				installed INT UNSIGNED NOT NULL DEFAULT 0,
				PRIMARY KEY  (layout_id, day, platform)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$subs} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				endpoint_hash CHAR(40) NOT NULL,
				endpoint TEXT NOT NULL,
				p256dh VARCHAR(255) NOT NULL,
				auth VARCHAR(64) NOT NULL,
				layout_id BIGINT UNSIGNED NULL,
				platform VARCHAR(20) NULL,
				browser VARCHAR(20) NULL,
				user_agent VARCHAR(255) NULL,
				page_url VARCHAR(255) NULL,
				status VARCHAR(10) NOT NULL DEFAULT 'active',
				created_at DATETIME NOT NULL,
				last_seen_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY endpoint_hash (endpoint_hash),
				KEY status (status, created_at),
				KEY status_platform (status, platform),
				KEY layout_id (layout_id)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$steps} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				position INT NOT NULL DEFAULT 0,
				delay_minutes INT UNSIGNED NOT NULL DEFAULT 0,
				enabled TINYINT(1) NOT NULL DEFAULT 1,
				title VARCHAR(120) NOT NULL DEFAULT '',
				body VARCHAR(255) NOT NULL DEFAULT '',
				icon_mode VARCHAR(10) NOT NULL DEFAULT 'site',
				icon_emoji VARCHAR(16) NOT NULL DEFAULT '',
				icon_url VARCHAR(255) NOT NULL DEFAULT '',
				image_url VARCHAR(255) NOT NULL DEFAULT '',
				url VARCHAR(255) NOT NULL DEFAULT '',
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				KEY enabled (enabled, delay_minutes)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$queue} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				subscriber_id BIGINT UNSIGNED NOT NULL,
				step_id BIGINT UNSIGNED NOT NULL,
				blast_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
				send_at DATETIME NOT NULL,
				status VARCHAR(10) NOT NULL DEFAULT 'pending',
				attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
				last_error VARCHAR(255) NULL,
				claim CHAR(12) NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY sub_ref (subscriber_id, step_id, blast_id),
				KEY due (status, send_at),
				KEY claim (claim),
				KEY blast_status (blast_id, status)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$sends} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				subscriber_id BIGINT UNSIGNED NOT NULL,
				kind VARCHAR(10) NOT NULL DEFAULT 'flow',
				step_id BIGINT UNSIGNED NULL,
				blast_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
				status VARCHAR(10) NOT NULL DEFAULT 'sent',
				code SMALLINT UNSIGNED NOT NULL DEFAULT 0,
				error VARCHAR(180) NULL,
				clicked_at DATETIME NULL,
				sent_at DATETIME NOT NULL,
				queue_id BIGINT UNSIGNED NULL,
				PRIMARY KEY  (id),
				KEY kind_step (kind, step_id),
				KEY blast (blast_id),
				KEY subscriber (subscriber_id, sent_at),
				KEY queue (queue_id),
				KEY sent_at (sent_at)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$blasts} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				title VARCHAR(120) NOT NULL DEFAULT '',
				body VARCHAR(255) NOT NULL DEFAULT '',
				icon_mode VARCHAR(10) NOT NULL DEFAULT 'site',
				icon_emoji VARCHAR(16) NOT NULL DEFAULT '',
				icon_url VARCHAR(255) NOT NULL DEFAULT '',
				image_url VARCHAR(255) NOT NULL DEFAULT '',
				url VARCHAR(255) NOT NULL DEFAULT '',
				sound VARCHAR(10) NOT NULL DEFAULT '',
				vibrate VARCHAR(10) NOT NULL DEFAULT '',
				total INT UNSIGNED NOT NULL DEFAULT 0,
				sent INT UNSIGNED NOT NULL DEFAULT 0,
				failed INT UNSIGNED NOT NULL DEFAULT 0,
				status VARCHAR(10) NOT NULL DEFAULT 'sending',
				created_at DATETIME NOT NULL,
				done_at DATETIME NULL,
				clicked INT UNSIGNED NOT NULL DEFAULT 0,
				kind VARCHAR(12) NOT NULL DEFAULT 'manual',
				broadcast_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
				copy_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
				slot VARCHAR(20) NULL,
				broadcast_name VARCHAR(120) NOT NULL DEFAULT '',
				PRIMARY KEY  (id),
				KEY status (status, created_at),
				UNIQUE KEY bc_slot (broadcast_id, slot),
				KEY copy (copy_id),
				KEY broadcast (broadcast_id, id)
			) {$charset};"
		);
		// v8: biblioteca de copys + broadcasts por horário
		dbDelta(
			"CREATE TABLE {$copies} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				title VARCHAR(120) NOT NULL DEFAULT '',
				body VARCHAR(255) NOT NULL DEFAULT '',
				icon_mode VARCHAR(10) NOT NULL DEFAULT 'site',
				icon_emoji VARCHAR(16) NOT NULL DEFAULT '',
				icon_url VARCHAR(255) NOT NULL DEFAULT '',
				image_url VARCHAR(255) NOT NULL DEFAULT '',
				url VARCHAR(255) NOT NULL DEFAULT '',
				used TINYINT(1) NOT NULL DEFAULT 0,
				used_count INT UNSIGNED NOT NULL DEFAULT 0,
				sent_count INT UNSIGNED NOT NULL DEFAULT 0,
				click_count INT UNSIGNED NOT NULL DEFAULT 0,
				last_used_at DATETIME NULL,
				source VARCHAR(10) NOT NULL DEFAULT 'manual',
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				KEY used (used, id),
				KEY last_used (last_used_at)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$bcasts} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				name VARCHAR(120) NOT NULL DEFAULT '',
				active TINYINT(1) NOT NULL DEFAULT 1,
				times TEXT NULL,
				days VARCHAR(40) NOT NULL DEFAULT '[]',
				after_send VARCHAR(10) NOT NULL DEFAULT 'mark_used',
				sound VARCHAR(10) NOT NULL DEFAULT '',
				vibrate VARCHAR(10) NOT NULL DEFAULT '',
				grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 120,
				last_fired_at DATETIME NULL,
				last_error VARCHAR(255) NULL,
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				KEY active (active)
			) {$charset};"
		);
		// agregados por dia (métricas rápidas mesmo com milhões de envios; pip_sends é podada)
		dbDelta(
			"CREATE TABLE {$sstats} (
				day DATE NOT NULL,
				kind VARCHAR(10) NOT NULL DEFAULT 'flow',
				ref_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
				sent INT UNSIGNED NOT NULL DEFAULT 0,
				failed INT UNSIGNED NOT NULL DEFAULT 0,
				clicked INT UNSIGNED NOT NULL DEFAULT 0,
				PRIMARY KEY  (day, kind, ref_id)
			) {$charset};"
		);
		dbDelta(
			"CREATE TABLE {$log} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				ts DATETIME NOT NULL,
				client VARCHAR(12) NOT NULL DEFAULT '',
				platform VARCHAR(20) NOT NULL DEFAULT '',
				browser VARCHAR(20) NOT NULL DEFAULT '',
				event VARCHAR(40) NOT NULL DEFAULT '',
				detail VARCHAR(400) NOT NULL DEFAULT '',
				PRIMARY KEY  (id),
				KEY ts (ts)
			) {$charset};"
		);
		if ( $from && $from < 7 ) {
			// v7: agregados a partir dos envios já gravados + cliques dos "Enviar agora"
			$wpdb->query( "INSERT INTO {$sstats} (day, kind, ref_id, sent, failed, clicked) SELECT DATE(sent_at), kind, COALESCE(step_id, blast_id, 0), SUM(status = 'sent'), SUM(status = 'failed'), SUM(clicked_at IS NOT NULL) FROM {$sends} WHERE kind IN ('flow', 'broadcast') GROUP BY DATE(sent_at), kind, COALESCE(step_id, blast_id, 0) ON DUPLICATE KEY UPDATE sent = VALUES(sent), failed = VALUES(failed), clicked = VALUES(clicked)" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "UPDATE {$blasts} b SET clicked = (SELECT COUNT(*) FROM {$sends} s WHERE s.blast_id = b.id AND s.clicked_at IS NOT NULL)" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		update_option( 'pip_db_version', self::DB_VERSION, true );
		self::autoload( array( 'pip_version', 'pip_db_version', 'pip_vapid', 'pip_settings', 'pip_diag_until', 'pip_flow_enabled' ) );
		delete_transient( 'pip_layout_ids' );
		if ( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$layouts}" ) ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			self::save_layout(
				array(
					'name'    => 'Modal no centro',
					'type'    => 'modal',
					'enabled' => 0,
					'weight'  => 100,
					'config'  => self::default_config(),
				)
			);
		}
	}

	/**
	 * Marca opções lidas em toda página como autoload (uma consulta a menos por visita para cada uma).
	 *
	 * @param string[] $names Opções.
	 */
	public static function autoload( $names ) {
		global $wpdb;
		if ( function_exists( 'wp_set_option_autoload_values' ) ) {
			wp_set_option_autoload_values( array_fill_keys( $names, true ) );
			return;
		}
		foreach ( $names as $n ) {
			$wpdb->update( $wpdb->options, array( 'autoload' => 'yes' ), array( 'option_name' => $n ) );
		}
		wp_cache_delete( 'alloptions', 'options' );
	}

	/**
	 * Roda o install se o esquema mudou (atualização sem reativar).
	 */
	public static function maybe_upgrade() {
		if ( (int) get_option( 'pip_db_version', 0 ) < self::DB_VERSION ) {
			self::install();
		}
	}

	/**
	 * Configuração padrão de um layout.
	 *
	 * @return array
	 */
	public static function default_config() {
		return array(
			'title'         => 'Quer receber nossas novidades?',
			'message'       => 'Ative as notificações e saiba na hora quando sair algo novo. Você pode desativar quando quiser.',
			'accept'        => 'Ativar notificações',
			'dismiss'       => 'Agora não',
			'show_dismiss'  => true,
			'show_close'    => true,
			'denied_title'  => 'O navegador bloqueou as notificações',
			'denied_text'   => 'O pedido foi recusado pelo navegador, não por você. Para liberar: {browser}. Depois recarregue a página.',
			'denied_button' => 'Entendi',
			'icon'          => array(
				'mode'  => get_site_icon_url( 96 ) ? 'site' : 'emoji',
				'emoji' => '🔔',
				'url'   => '',
			),
			'colors'        => array(
				'bg'      => '#ffffff',
				'fg'      => '#0b1120',
				'btn'     => '#377ef0',
				'btn_fg'  => '#ffffff',
				'overlay' => '#0b1120',
			),
			'overlay_alpha' => 55,
			'radius'        => 16,
			'trigger'       => array(
				'delay'  => 0,
				'scroll' => 0,
			),
			'cooldown_days' => 7,
			'install'       => array(
				'ios_enabled' => true,
				'app_enabled' => true,
				'title'       => 'Instale o app do site',
				'message'     => 'Adicione este site à sua tela inicial: abre com um toque, como um aplicativo, e as notificações chegam com mais confiança.',
				'button'      => 'Adicionar à tela inicial',
				'ios_title'   => 'Receba nossas novidades no iPhone',
				'ios_message' => 'No iPhone e no iPad, as notificações só funcionam com o site na Tela de Início. Toque no botão, escolha “Adicionar à Tela de Início” e depois abra pelo ícone.',
				'ios_button'  => 'Adicionar à Tela de Início',
				'ios_step1'   => 'Toque no botão abaixo ou em Compartilhar {share}',
				'ios_step2'   => 'Escolha “Adicionar à Tela de Início”',
				'ios_step3'   => 'Abra o site pelo ícone novo',
				'ios_retry'   => 0,
				'ios_guide'   => true,
				'ios_target'  => 'Adicionar à Tela de Início',
				'ios_safari'  => 'Abrir no Safari',
				'ios_rows'    => 'Copiar|Adicionar aos Favoritos',
				'ios_tip'     => '↑ na folha que abrir, role até este item',
			),
		);
	}

	/**
	 * Normaliza um config vindo do formulário/banco (nunca lança; preenche o que faltar).
	 *
	 * @param mixed $raw Config bruto.
	 * @return array
	 */
	public static function normalize_config( $raw ) {
		$d = self::default_config();
		$c = is_array( $raw ) ? $raw : array();
		$hex = function ( $v, $fb ) {
			$v = strtolower( trim( (string) $v ) );
			return preg_match( '/^#[0-9a-f]{6}$/', $v ) ? $v : $fb;
		};
		// Texto livre: chave ausente = padrão; chave presente = o que o dono escreveu, inclusive em branco
		// (em branco = o elemento não aparece). $must = nunca fica em branco (rótulo de botão).
		$text = function ( $arr, $key, $fb, $max, $must = false ) {
			if ( ! array_key_exists( $key, $arr ) ) {
				return $fb;
			}
			$v = trim( sanitize_text_field( (string) $arr[ $key ] ) );
			if ( '' === $v ) {
				return $must ? $fb : '';
			}
			return mb_substr( $v, 0, $max );
		};
		$icon   = isset( $c['icon'] ) && is_array( $c['icon'] ) ? $c['icon'] : array();
		$colors = isset( $c['colors'] ) && is_array( $c['colors'] ) ? $c['colors'] : array();
		$trig   = isset( $c['trigger'] ) && is_array( $c['trigger'] ) ? $c['trigger'] : array();
		$inst   = isset( $c['install'] ) && is_array( $c['install'] ) ? $c['install'] : array();
		$di     = $d['install'];
		$alpha  = isset( $c['overlay_alpha'] ) ? max( 0, min( 100, (int) $c['overlay_alpha'] ) ) : $d['overlay_alpha'];
		$ov     = $hex( isset( $colors['overlay'] ) ? $colors['overlay'] : '', $d['colors']['overlay'] );
		return array(
			'title'         => $text( $c, 'title', $d['title'], 90 ),
			'message'       => $text( $c, 'message', $d['message'], 240 ),
			'accept'        => $text( $c, 'accept', $d['accept'], 40, true ),
			'dismiss'       => $text( $c, 'dismiss', $d['dismiss'], 40, true ),
			'show_dismiss'  => ! empty( $c['show_dismiss'] ),
			'show_close'    => ! empty( $c['show_close'] ),
			'denied_title'  => $text( $c, 'denied_title', $d['denied_title'], 90 ),
			'denied_text'   => $text( $c, 'denied_text', $d['denied_text'], 300 ),
			'denied_button' => $text( $c, 'denied_button', $d['denied_button'], 40, true ),
			'icon'          => array(
				'mode'  => in_array( isset( $icon['mode'] ) ? $icon['mode'] : '', array( 'site', 'emoji', 'image', 'none' ), true ) ? $icon['mode'] : 'emoji',
				'emoji' => mb_substr( sanitize_text_field( isset( $icon['emoji'] ) ? $icon['emoji'] : '🔔' ), 0, 8 ),
				'url'   => esc_url_raw( isset( $icon['url'] ) ? $icon['url'] : '' ),
			),
			'colors'        => array(
				'bg'      => $hex( isset( $colors['bg'] ) ? $colors['bg'] : '', $d['colors']['bg'] ),
				'fg'      => $hex( isset( $colors['fg'] ) ? $colors['fg'] : '', $d['colors']['fg'] ),
				'btn'     => $hex( isset( $colors['btn'] ) ? $colors['btn'] : '', $d['colors']['btn'] ),
				'btn_fg'  => $hex( isset( $colors['btn_fg'] ) ? $colors['btn_fg'] : '', $d['colors']['btn_fg'] ),
				'overlay' => $ov,
			),
			'overlay_alpha' => $alpha,
			'radius'        => isset( $c['radius'] ) ? max( 0, min( 40, (int) $c['radius'] ) ) : $d['radius'],
			'trigger'       => array(
				'delay'  => isset( $trig['delay'] ) ? max( 0, min( 300, (int) $trig['delay'] ) ) : $d['trigger']['delay'],
				'scroll' => isset( $trig['scroll'] ) ? max( 0, min( 100, (int) $trig['scroll'] ) ) : $d['trigger']['scroll'],
			),
			'cooldown_days' => isset( $c['cooldown_days'] ) ? max( 0, min( 365, (int) $c['cooldown_days'] ) ) : $d['cooldown_days'],
			'install'       => array(
				// layouts antigos tinham um interruptor só ('enabled'); vale para os dois
				'ios_enabled' => array_key_exists( 'ios_enabled', $inst ) ? ! empty( $inst['ios_enabled'] ) : ( array_key_exists( 'enabled', $inst ) ? ! empty( $inst['enabled'] ) : $di['ios_enabled'] ),
				'app_enabled' => array_key_exists( 'app_enabled', $inst ) ? ! empty( $inst['app_enabled'] ) : ( array_key_exists( 'enabled', $inst ) ? ! empty( $inst['enabled'] ) : $di['app_enabled'] ),
				'title'       => $text( $inst, 'title', $di['title'], 90 ),
				'message'     => $text( $inst, 'message', $di['message'], 240 ),
				'button'      => $text( $inst, 'button', $di['button'], 40, true ),
				'ios_title'   => $text( $inst, 'ios_title', $di['ios_title'], 90 ),
				'ios_message' => $text( $inst, 'ios_message', $di['ios_message'], 300 ),
				'ios_button'  => $text( $inst, 'ios_button', $di['ios_button'], 40, true ),
				'ios_step1'   => $text( $inst, 'ios_step1', $di['ios_step1'], 120 ),
				'ios_step2'   => $text( $inst, 'ios_step2', $di['ios_step2'], 120 ),
				'ios_step3'   => $text( $inst, 'ios_step3', $di['ios_step3'], 120 ),
				'ios_retry'   => isset( $inst['ios_retry'] ) ? max( 0, min( 10080, (int) $inst['ios_retry'] ) ) : $di['ios_retry'],
				'ios_guide'   => array_key_exists( 'ios_guide', $inst ) ? ! empty( $inst['ios_guide'] ) : $di['ios_guide'],
				'ios_target'  => $text( $inst, 'ios_target', $di['ios_target'], 40, true ),
				'ios_rows'    => $text( $inst, 'ios_rows', $di['ios_rows'], 120 ),
				'ios_tip'     => $text( $inst, 'ios_tip', $di['ios_tip'], 120 ),
				'ios_safari'  => $text( $inst, 'ios_safari', $di['ios_safari'], 40, true ),
			),
		);
	}

	/**
	 * Config pronto para o renderizador (overlay com alpha aplicado; ícone do site resolvido).
	 *
	 * @param array $config Config normalizado.
	 * @return array
	 */
	public static function config_for_js( $config ) {
		$c = self::normalize_config( $config );
		if ( 'site' === $c['icon']['mode'] ) {
			$c['icon']['url'] = get_site_icon_url( 96 );
			if ( ! $c['icon']['url'] ) {
				$c['icon']['mode'] = 'emoji';
			}
		}
		$hex                   = ltrim( $c['colors']['overlay'], '#' );
		$c['colors']['overlay'] = sprintf( 'rgba(%d,%d,%d,%.2f)', hexdec( substr( $hex, 0, 2 ) ), hexdec( substr( $hex, 2, 2 ) ), hexdec( substr( $hex, 4, 2 ) ), $c['overlay_alpha'] / 100 );
		return $c;
	}

	/**
	 * Linha do banco → array com config decodificado.
	 *
	 * @param object $row Linha.
	 * @return array
	 */
	private static function hydrate( $row ) {
		$config = json_decode( (string) $row->config, true );
		return array(
			'id'         => (int) $row->id,
			'name'       => (string) $row->name,
			'type'       => in_array( $row->type, self::TYPES, true ) ? $row->type : 'modal',
			'enabled'    => (bool) $row->enabled,
			'weight'     => (int) $row->weight,
			'config'     => self::normalize_config( $config ),
			'css_mode'   => 'replace' === $row->css_mode ? 'replace' : 'append',
			'custom_css' => (string) $row->custom_css,
			'position'   => (int) $row->position,
			'created_at' => $row->created_at,
			'updated_at' => $row->updated_at,
		);
	}

	/**
	 * Todos os layouts (ordem de posição) ou só os ativos.
	 *
	 * @param bool $only_enabled Só ativos.
	 * @return array[]
	 */
	public static function layouts( $only_enabled = false ) {
		global $wpdb;
		$t     = self::table( 'layouts' );
		$where = $only_enabled ? 'WHERE enabled = 1' : '';
		$rows  = $wpdb->get_results( "SELECT * FROM {$t} {$where} ORDER BY position ASC, id ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return array_map( array( __CLASS__, 'hydrate' ), $rows ? $rows : array() );
	}

	/**
	 * Um layout.
	 *
	 * @param int $id Id.
	 * @return array|null
	 */
	public static function layout( $id ) {
		global $wpdb;
		$t   = self::table( 'layouts' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $row ? self::hydrate( $row ) : null;
	}

	/**
	 * Cria/atualiza um layout.
	 *
	 * @param array    $data name/type/enabled/weight/config/css_mode/custom_css.
	 * @param int|null $id   Id para atualizar.
	 * @return int Id.
	 */
	public static function save_layout( $data, $id = null ) {
		global $wpdb;
		$t   = self::table( 'layouts' );
		$now = current_time( 'mysql' );
		$row = array(
			'name'       => mb_substr( sanitize_text_field( isset( $data['name'] ) ? $data['name'] : '' ), 0, 120 ),
			'type'       => in_array( isset( $data['type'] ) ? $data['type'] : '', self::TYPES, true ) ? $data['type'] : 'modal',
			'enabled'    => empty( $data['enabled'] ) ? 0 : 1,
			'weight'     => isset( $data['weight'] ) ? max( 0, min( 1000, (int) $data['weight'] ) ) : 100,
			'config'     => wp_json_encode( self::normalize_config( isset( $data['config'] ) ? $data['config'] : array() ) ),
			'css_mode'   => ( isset( $data['css_mode'] ) && 'replace' === $data['css_mode'] ) ? 'replace' : 'append',
			'custom_css' => mb_substr( (string) ( isset( $data['custom_css'] ) ? $data['custom_css'] : '' ), 0, 60000 ),
			'updated_at' => $now,
		);
		if ( '' === $row['name'] ) {
			$row['name'] = 'Layout sem nome';
		}
		delete_transient( 'pip_layout_ids' );
		if ( $id ) {
			$wpdb->update( $t, $row, array( 'id' => (int) $id ) );
			return (int) $id;
		}
		$row['created_at'] = $now;
		$row['position']   = (int) $wpdb->get_var( "SELECT COALESCE(MAX(position), 0) + 1 FROM {$t}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->insert( $t, $row );
		return (int) $wpdb->insert_id;
	}

	/**
	 * Ids dos layouts existentes (cache de 5 min): valida eventos do site sem uma consulta por impressão.
	 *
	 * @return int[]
	 */
	public static function layout_ids() {
		global $wpdb;
		$ids = get_transient( 'pip_layout_ids' );
		if ( ! is_array( $ids ) ) {
			$ids = array_map( 'intval', (array) $wpdb->get_col( 'SELECT id FROM ' . self::table( 'layouts' ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			set_transient( 'pip_layout_ids', $ids, 5 * MINUTE_IN_SECONDS );
		}
		return $ids;
	}

	/**
	 * Liga/desliga.
	 *
	 * @param int  $id      Id.
	 * @param bool $enabled Ativo.
	 */
	public static function set_enabled( $id, $enabled ) {
		global $wpdb;
		$wpdb->update( self::table( 'layouts' ), array( 'enabled' => $enabled ? 1 : 0, 'updated_at' => current_time( 'mysql' ) ), array( 'id' => (int) $id ) );
	}

	/**
	 * Apaga o layout (as estatísticas dele também; os inscritos ficam, só perdem o vínculo).
	 *
	 * @param int $id Id.
	 */
	public static function delete_layout( $id ) {
		global $wpdb;
		delete_transient( 'pip_layout_ids' );
		$wpdb->delete( self::table( 'layouts' ), array( 'id' => (int) $id ) );
		$wpdb->delete( self::table( 'stats' ), array( 'layout_id' => (int) $id ) );
		$wpdb->update( self::table( 'subscribers' ), array( 'layout_id' => null ), array( 'layout_id' => (int) $id ) );
	}

	/**
	 * Duplica um layout (desligado).
	 *
	 * @param int $id Id.
	 * @return int|null Novo id.
	 */
	public static function duplicate_layout( $id ) {
		$l = self::layout( $id );
		if ( ! $l ) {
			return null;
		}
		$l['name']    = mb_substr( $l['name'] . ' (cópia)', 0, 120 );
		$l['enabled'] = 0;
		return self::save_layout( $l );
	}

	/**
	 * Soma 1 num contador do dia (hoje no fuso do site).
	 *
	 * @param int    $layout_id Layout.
	 * @param string $event     Evento (EVENTS).
	 * @param string $platform  Plataforma do visitante (PLATFORMS).
	 */
	public static function bump( $layout_id, $event, $platform = 'outro' ) {
		global $wpdb;
		if ( ! in_array( $event, self::EVENTS, true ) ) {
			return;
		}
		$col = array(
			'impression' => 'impressions',
			'click'      => 'clicks',
			'granted'    => 'granted',
			'denied'     => 'denied',
			'dismissed'  => 'dismissed',
			'installed'  => 'installed',
		)[ $event ];
		$t        = self::table( 'stats' );
		$platform = isset( self::PLATFORMS[ $platform ] ) ? $platform : 'outro';
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$t} (layout_id, day, platform, {$col}) VALUES (%d, %s, %s, 1) ON DUPLICATE KEY UPDATE {$col} = {$col} + 1", (int) $layout_id, current_time( 'Y-m-d' ), $platform ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Condição de período (dias até hoje, no fuso do site). '' = tudo.
	 *
	 * @param int|null $days Dias.
	 * @return string SQL (`day >= '...'`) ou ''.
	 */
	private static function since_sql( $days ) {
		global $wpdb;
		if ( ! $days ) {
			return '';
		}
		$since = gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) ) - ( (int) $days - 1 ) * DAY_IN_SECONDS );
		return $wpdb->prepare( 'day >= %s', $since );
	}

	/**
	 * Plataformas com pelo menos 1 evento no período (ou 1 inscrito ativo), na ordem de PLATFORMS.
	 *
	 * @param int|null $days Dias (null = tudo).
	 * @return string[] Chaves de PLATFORMS.
	 */
	public static function platforms( $days = 30 ) {
		global $wpdb;
		$t     = self::table( 'stats' );
		$subs  = self::table( 'subscribers' );
		$since = self::since_sql( $days );
		$where = $since ? "WHERE {$since}" : '';
		$rows  = $wpdb->get_col( "SELECT platform FROM {$t} {$where} GROUP BY platform HAVING SUM(impressions + clicks + granted + denied + dismissed + installed) > 0 UNION SELECT DISTINCT platform FROM {$subs} WHERE status = 'active' AND platform IS NOT NULL" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$set   = array_fill_keys( array_map( 'strval', $rows ? $rows : array() ), true );
		$out   = array();
		foreach ( array_keys( self::PLATFORMS ) as $k ) {
			if ( isset( $set[ $k ] ) ) {
				$out[] = $k;
			}
		}
		return $out;
	}

	/**
	 * Totais por layout no período.
	 *
	 * @param int|null    $days     Dias (null = tudo).
	 * @param string|null $platform Só esta plataforma (null = todas).
	 * @return array<int, array> layout_id → {impressions, clicks, granted, denied, dismissed}
	 */
	public static function stats( $days = 30, $platform = null ) {
		global $wpdb;
		$t     = self::table( 'stats' );
		$conds = array();
		$since = self::since_sql( $days );
		if ( $since ) {
			$conds[] = $since;
		}
		if ( $platform ) {
			$conds[] = $wpdb->prepare( 'platform = %s', $platform );
		}
		$where = $conds ? 'WHERE ' . implode( ' AND ', $conds ) : '';
		$rows = $wpdb->get_results( "SELECT layout_id, SUM(impressions) impressions, SUM(clicks) clicks, SUM(granted) granted, SUM(denied) denied, SUM(dismissed) dismissed, SUM(installed) installed FROM {$t} {$where} GROUP BY layout_id" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$out  = array();
		foreach ( $rows ? $rows : array() as $r ) {
			$out[ (int) $r->layout_id ] = array(
				'impressions' => (int) $r->impressions,
				'clicks'      => (int) $r->clicks,
				'granted'     => (int) $r->granted,
				'denied'      => (int) $r->denied,
				'dismissed'   => (int) $r->dismissed,
				'installed'   => (int) $r->installed,
			);
		}
		return $out;
	}

	/**
	 * Grava/atualiza um inscrito. Devolve true se é NOVO (conta como ativação).
	 *
	 * @param array $sub       {endpoint, p256dh, auth}.
	 * @param int   $layout_id Layout de origem (0 = desconhecido).
	 * @param array $meta      {platform, browser, user_agent, page_url}.
	 * @return bool
	 */
	/**
	 * Id do último inscrito gravado por upsert_subscriber().
	 *
	 * @var int
	 */
	public static $last_subscriber_id = 0;

	/**
	 * O endpoint reenviado já tinha sido recusado pelo push service (410)? O cliente deve refazer a inscrição.
	 *
	 * @var bool
	 */
	public static $last_was_expired = false;

	/**
	 * O último upsert trocou um endpoint antigo pelo novo NO LUGAR (mesmo inscrito)?
	 *
	 * @var bool
	 */
	public static $last_replaced = false;

	/**
	 * @param string $old_endpoint Endpoint anterior deste navegador (troca no lugar, sem duplicar).
	 */
	public static function upsert_subscriber( $sub, $layout_id, $meta, $old_endpoint = '' ) {
		global $wpdb;
		$t    = self::table( 'subscribers' );
		$hash = sha1( $sub['endpoint'] );
		$now  = current_time( 'mysql' );
		$old  = $wpdb->get_row( $wpdb->prepare( "SELECT id, status FROM {$t} WHERE endpoint_hash = %s", $hash ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$id   = $old ? (int) $old['id'] : 0;
		self::$last_was_expired = $old && 'expired' === $old['status'];
		self::$last_replaced    = false;
		// o navegador trocou de inscrição (renovação, app instalado…): a linha antiga vira a nova
		if ( ! $id && $old_endpoint && $old_endpoint !== $sub['endpoint'] ) {
			$prev = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE endpoint_hash = %s", sha1( $old_endpoint ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			if ( $prev ) {
				$wpdb->update(
					$t,
					array(
						'endpoint_hash' => $hash,
						'endpoint'      => $sub['endpoint'],
						'p256dh'        => $sub['p256dh'],
						'auth'          => $sub['auth'],
						'platform'      => $meta['platform'],
						'browser'       => $meta['browser'],
						'user_agent'    => $meta['user_agent'],
						'page_url'      => $meta['page_url'],
						'status'        => 'active',
						'last_seen_at'  => $now,
					),
					array( 'id' => $prev )
				);
				self::$last_subscriber_id = $prev;
				self::$last_replaced      = true;
				self::$last_was_expired   = false;
				// o que falhou por "expirado" volta para a fila: a pessoa recebe no endpoint novo
				$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::table( 'queue' ) . " SET status = 'pending', attempts = 0, last_error = '' WHERE subscriber_id = %d AND status = 'failed' AND last_error LIKE %s", $prev, '%expired%' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				return false;
			}
		} elseif ( $old_endpoint && $old_endpoint !== $sub['endpoint'] ) {
			$wpdb->update( $t, array( 'status' => 'expired' ), array( 'endpoint_hash' => sha1( $old_endpoint ) ) );
		}
		$row  = array(
			'p256dh'       => $sub['p256dh'],
			'auth'         => $sub['auth'],
			'platform'     => $meta['platform'],
			'browser'      => $meta['browser'],
			'user_agent'   => $meta['user_agent'],
			'page_url'     => $meta['page_url'],
			'status'       => 'active',
			'last_seen_at' => $now,
		);
		if ( $id ) {
			$wpdb->update( $t, $row, array( 'id' => $id ) );
			self::$last_subscriber_id = $id;
			return false;
		}
		$row['endpoint_hash'] = $hash;
		$row['endpoint']      = $sub['endpoint'];
		$row['layout_id']     = $layout_id ? (int) $layout_id : null;
		$row['created_at']    = $now;
		$wpdb->insert( $t, $row );
		self::$last_subscriber_id = (int) $wpdb->insert_id;
		return true;
	}

	/**
	 * Diagnóstico: grava eventos do navegador/service worker (tela Automação).
	 *
	 * @param string $client   Id curto do navegador ('sw' = service worker).
	 * @param array  $events   [{e, d}].
	 * @param array  $device   {platform, browser}.
	 */
	public static function log_events( $client, $events, $device ) {
		global $wpdb;
		if ( ! self::diag_on() ) {
			return; // diagnóstico desligado: nada é gravado (em escala, isso seria uma escrita por visita)
		}
		$t   = self::table( 'log' );
		$now = current_time( 'mysql' );
		$n   = 0;
		foreach ( $events as $ev ) {
			if ( ! is_array( $ev ) || $n++ >= 25 ) {
				break;
			}
			$wpdb->insert(
				$t,
				array(
					'ts'       => $now,
					'client'   => mb_substr( sanitize_key( $client ), 0, 12 ),
					'platform' => $device['platform'],
					'browser'  => $device['browser'],
					'event'    => mb_substr( sanitize_key( isset( $ev['e'] ) ? $ev['e'] : '' ), 0, 40 ),
					'detail'   => mb_substr( sanitize_text_field( isset( $ev['d'] ) ? (string) $ev['d'] : '' ), 0, 400 ),
				)
			);
		}
		if ( 0 === wp_rand( 0, 20 ) ) {
			$wpdb->query( "DELETE FROM {$t} WHERE id < (SELECT id FROM (SELECT id FROM {$t} ORDER BY id DESC LIMIT 1 OFFSET 1500) x)" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
	}

	/**
	 * Últimas linhas do diagnóstico.
	 *
	 * @param int $limit Quantas.
	 * @return array
	 */
	public static function logs( $limit = 80 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::table( 'log' ) . ' ORDER BY id DESC LIMIT %d', (int) $limit ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Limpa o diagnóstico.
	 */
	public static function clear_log() {
		global $wpdb;
		$wpdb->query( 'TRUNCATE TABLE ' . self::table( 'log' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Diagnóstico ligado? (opção pip_diag_until = até quando; 0 = desligado). Ligado, o site e o
	 * service worker mandam cada passo para a tabela pip_log; desligado, nada é gravado.
	 *
	 * @return bool
	 */
	public static function diag_on() {
		return (int) get_option( 'pip_diag_until', 0 ) > time();
	}

	/**
	 * Até quando o diagnóstico fica ligado (timestamp) ou 0.
	 *
	 * @return int
	 */
	public static function diag_until() {
		$u = (int) get_option( 'pip_diag_until', 0 );
		return $u > time() ? $u : 0;
	}

	/**
	 * Liga o diagnóstico por N horas (0 = desliga).
	 *
	 * @param float $hours Horas.
	 */
	public static function diag_set( $hours ) {
		update_option( 'pip_diag_until', $hours > 0 ? time() + (int) ( $hours * HOUR_IN_SECONDS ) : 0, true );
	}

	/**
	 * Soma nos agregados diários de envio (kind flow|broadcast, ref = passo ou envio).
	 *
	 * @param array $rows Lista de {kind, ref_id, sent, failed, clicked} (um por passo/envio).
	 */
	public static function bump_send_stats( $rows ) {
		global $wpdb;
		$vals = array();
		$day  = current_time( 'Y-m-d' );
		foreach ( $rows as $r ) {
			$sent    = (int) ( isset( $r['sent'] ) ? $r['sent'] : 0 );
			$failed  = (int) ( isset( $r['failed'] ) ? $r['failed'] : 0 );
			$clicked = (int) ( isset( $r['clicked'] ) ? $r['clicked'] : 0 );
			if ( ! $sent && ! $failed && ! $clicked ) {
				continue;
			}
			$vals[] = $wpdb->prepare( '(%s, %s, %d, %d, %d, %d)', isset( $r['day'] ) ? $r['day'] : $day, 'broadcast' === $r['kind'] ? 'broadcast' : 'flow', (int) $r['ref_id'], $sent, $failed, $clicked );
		}
		if ( ! $vals ) {
			return;
		}
		$wpdb->query( 'INSERT INTO ' . self::table( 'send_stats' ) . ' (day, kind, ref_id, sent, failed, clicked) VALUES ' . implode( ',', $vals ) . ' ON DUPLICATE KEY UPDATE sent = sent + VALUES(sent), failed = failed + VALUES(failed), clicked = clicked + VALUES(clicked)' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Totais por passo/envio a partir dos agregados.
	 *
	 * @param string $kind flow|broadcast.
	 * @return array ref_id → {sent, failed, clicked}
	 */
	public static function send_stats( $kind ) {
		global $wpdb;
		$out = array();
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT ref_id, SUM(sent) sent, SUM(failed) failed, SUM(clicked) clicked FROM ' . self::table( 'send_stats' ) . ' WHERE kind = %s GROUP BY ref_id', 'broadcast' === $kind ? 'broadcast' : 'flow' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		foreach ( $rows ? $rows : array() as $r ) {
			$out[ (int) $r->ref_id ] = array( 'sent' => (int) $r->sent, 'failed' => (int) $r->failed, 'clicked' => (int) $r->clicked );
		}
		return $out;
	}

	/**
	 * Limpeza diária: o que já cumpriu o papel sai do banco (as métricas vivem nos agregados).
	 * Envios individuais ficam `pip_sends_days` dias (padrão 90; servem para o clique), fila enviada 7 dias,
	 * fila com falha 30 dias, inscritos expirados 60 dias, diagnóstico 7 dias.
	 *
	 * @return array Contagens apagadas.
	 */
	public static function prune() {
		global $wpdb;
		$keep_sends = max( 7, (int) apply_filters( 'pip_sends_days', 90 ) );
		$out        = array();
		$loops      = 0;
		$cut        = function ( $days ) {
			return gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
		};
		$local = function ( $days ) {
			return gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) ) - $days * DAY_IN_SECONDS );
		};
		// em lotes de 5 mil (não trava o banco com um DELETE gigante)
		$batch = function ( $sql ) use ( $wpdb, &$loops ) {
			$n = 0;
			do {
				$d = (int) $wpdb->query( $sql . ' LIMIT 5000' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				$n += $d;
			} while ( $d >= 5000 && ++$loops < 200 );
			return $n;
		};
		$out['sends']   = $batch( $wpdb->prepare( 'DELETE FROM ' . self::table( 'sends' ) . ' WHERE sent_at < %s', $local( $keep_sends ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$out['queue']   = $batch( $wpdb->prepare( 'DELETE FROM ' . self::table( 'queue' ) . " WHERE status = 'sent' AND send_at < %s", $cut( 7 ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$out['queue']  += $batch( $wpdb->prepare( 'DELETE FROM ' . self::table( 'queue' ) . " WHERE status IN ('failed', 'skipped') AND send_at < %s", $cut( 30 ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$out['subs']    = $batch( $wpdb->prepare( 'DELETE FROM ' . self::table( 'subscribers' ) . " WHERE status = 'expired' AND last_seen_at < %s", $local( 60 ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$out['log']     = $batch( $wpdb->prepare( 'DELETE FROM ' . self::table( 'log' ) . ' WHERE ts < %s', $local( 7 ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$out['stats']   = $batch( $wpdb->prepare( 'DELETE FROM ' . self::table( 'send_stats' ) . ' WHERE day < %s', gmdate( 'Y-m-d', time() - 400 * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return $out;
	}

	/**
	 * Quantos inscritos ativos (opcionalmente só de uma plataforma). Cache de 60 s: com milhões de
	 * linhas o COUNT custa, e o painel não precisa do número exato a cada abertura.
	 *
	 * @param string|null $platform Plataforma.
	 * @return int
	 */
	public static function subscribers_count( $platform = null ) {
		global $wpdb;
		$key = 'pip_subs_count_' . ( $platform ? sanitize_key( $platform ) : 'all' );
		$n   = get_transient( $key );
		if ( false !== $n ) {
			return (int) $n;
		}
		$t = self::table( 'subscribers' );
		if ( $platform ) {
			$n = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$t} WHERE status = 'active' AND platform = %s", $platform ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		} else {
			$n = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t} WHERE status = 'active'" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		set_transient( $key, $n, MINUTE_IN_SECONDS );
		return $n;
	}

	/**
	 * Apaga tudo (desinstalação).
	 */
	public static function drop() {
		global $wpdb;
		foreach ( array( 'layouts', 'stats', 'subscribers', 'flow_steps', 'queue', 'sends', 'blasts', 'log', 'send_stats', 'copies', 'broadcasts' ) as $t ) {
			$wpdb->query( 'DROP TABLE IF EXISTS ' . self::table( $t ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}
	}
}
