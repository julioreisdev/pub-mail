<?php
/**
 * Configurações básicas: som e vibração padrão das notificações, comportamento (manter na tela,
 * avisar de novo) e "Enviar agora" — uma notificação para todos os inscritos naquele instante, com
 * progresso e histórico. Tela "Configurações básicas" do painel.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Opções + tela.
 */
class PIP_Settings {

	const PAGE   = 'push-in-play-settings';
	const OPTION = 'pip_settings';
	const SOUNDS = array(
		'chime' => 'Sino suave',
		'ping'  => 'Ping',
		'pop'   => 'Pop',
		'ding'  => 'Ding',
		'alert' => 'Alerta (3 toques)',
		'bell'  => 'Campainha',
	);
	const VIBRATIONS = array(
		'none'   => array( 'Sem vibração', null ),
		'short'  => array( 'Curta', array( 120 ) ),
		'double' => array( 'Dupla', array( 100, 80, 100 ) ),
		'long'   => array( 'Longa', array( 400 ) ),
		'triple' => array( 'Tripla', array( 80, 60, 80, 60, 80 ) ),
		'sos'    => array( 'Insistente', array( 200, 100, 200, 100, 400 ) ),
	);

	/**
	 * Hooks.
	 */
	public static function init() {
		add_action( 'admin_post_pip_settings_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_pip_blast_send', array( __CLASS__, 'handle_blast' ) );
	}

	/**
	 * Padrões.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'sound'               => 'system',   // system | silent | custom
			'sound_name'          => 'chime',
			'vibrate'             => 'double',
			'require_interaction' => false,
			'renotify'            => true,
		);
	}

	/**
	 * Opções normalizadas.
	 *
	 * @return array
	 */
	public static function get() {
		return self::normalize( get_option( self::OPTION, array() ) );
	}

	/**
	 * Normaliza.
	 *
	 * @param array $raw Cru.
	 * @return array
	 */
	public static function normalize( $raw ) {
		$d = self::defaults();
		$r = is_array( $raw ) ? $raw : array();
		return array(
			'sound'               => in_array( isset( $r['sound'] ) ? $r['sound'] : '', array( 'system', 'silent', 'custom' ), true ) ? $r['sound'] : $d['sound'],
			'sound_name'          => isset( self::SOUNDS[ isset( $r['sound_name'] ) ? $r['sound_name'] : '' ] ) ? $r['sound_name'] : $d['sound_name'],
			'vibrate'             => isset( self::VIBRATIONS[ isset( $r['vibrate'] ) ? $r['vibrate'] : '' ] ) ? $r['vibrate'] : $d['vibrate'],
			'require_interaction' => array_key_exists( 'require_interaction', $r ) ? ! empty( $r['require_interaction'] ) : $d['require_interaction'],
			'renotify'            => array_key_exists( 'renotify', $r ) ? ! empty( $r['renotify'] ) : $d['renotify'],
		);
	}

	/**
	 * Campos de som/vibração que vão no payload do push.
	 *
	 * @param array|null $override {sound, sound_name, vibrate} de um envio específico (ou null = padrão).
	 * @return array
	 */
	public static function payload_fields( $override = null ) {
		$s = self::get();
		if ( is_array( $override ) ) {
			$s = self::normalize( array_merge( $s, array_filter( $override, function ( $v ) {
				return null !== $v && '' !== $v;
			} ) ) );
		}
		$vib = self::VIBRATIONS[ $s['vibrate'] ][1];
		return array(
			'silent'              => 'silent' === $s['sound'],
			'sound'               => 'custom' === $s['sound'] ? $s['sound_name'] : '',
			'vibrate'             => $vib ? $vib : null,
			'require_interaction' => (bool) $s['require_interaction'],
			'renotify'            => (bool) $s['renotify'],
		);
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

	/**
	 * Assets.
	 */
	public static function assets() {
		wp_enqueue_script( 'pip-sounds', PIP_URL . 'assets/pip-sounds.js', array(), PIP_VERSION, true );
		wp_enqueue_script( 'pip-settings-admin', PIP_URL . 'assets/pip-settings-admin.js', array( 'pip-sounds' ), PIP_VERSION, true );
		wp_localize_script(
			'pip-settings-admin',
			'PIP_SETTINGS',
			array(
				'site'    => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'icon'    => get_site_icon_url( 192 ) ? get_site_icon_url( 192 ) : PIP_URL . 'assets/app/icon-192.png',
				'twemoji' => 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/',
			)
		);
	}

	/**
	 * Salvar configurações.
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_settings_save' );
		$o = isset( $_POST['o'] ) && is_array( $_POST['o'] ) ? wp_unslash( $_POST['o'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		update_option( self::OPTION, self::normalize( array_map( 'sanitize_text_field', array_map( 'strval', $o ) ) ), true );
		wp_safe_redirect( self::url( array( 'saved' => 1 ) ) );
		exit;
	}

	/**
	 * Enviar agora.
	 */
	public static function handle_blast() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_blast_send' );
		$b  = isset( $_POST['b'] ) && is_array( $_POST['b'] ) ? wp_unslash( $_POST['b'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$id = PIP_Flow::blast( $b );
		wp_safe_redirect( self::url( array( 'blast' => $id ) ) );
		exit;
	}

	/**
	 * Tela.
	 */
	public static function render() {
		$s = self::get();
		self::health_card();
		if ( ! empty( $_GET['saved'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="pip-notice">Configurações salvas. Valem para todas as notificações a partir de agora (fluxo, testes e envios).</div>';
		}
		if ( ! empty( $_GET['blast'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$bl = PIP_Flow::blast_row( (int) $_GET['blast'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $bl ) {
				echo '<div class="pip-notice">Envio criado para ' . (int) $bl['total'] . ' aparelho(s): ' . (int) $bl['sent'] . ' já entregues ao serviço de push, ' . (int) $bl['failed'] . ' falhas' . ( 'done' === $bl['status'] ? '.' : ' — o resto sai nos próximos minutos (cron e visitas).' ) . '</div>';
			}
		}
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="pip-settings">
			<?php wp_nonce_field( 'pip_settings_save' ); ?>
			<input type="hidden" name="action" value="pip_settings_save">
			<div class="pip-settings__grid">
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Som</h2>
					<div class="pip-choices">
						<label class="pip-choice<?php echo 'system' === $s['sound'] ? ' is-active' : ''; ?>"><input type="radio" name="o[sound]" value="system" <?php checked( 'system', $s['sound'] ); ?>><b>Som do sistema</b><span>O aparelho toca o som padrão de notificação dele (celular e computador).</span></label>
						<label class="pip-choice<?php echo 'silent' === $s['sound'] ? ' is-active' : ''; ?>"><input type="radio" name="o[sound]" value="silent" <?php checked( 'silent', $s['sound'] ); ?>><b>Silenciosa</b><span>Chega sem som e sem vibração.</span></label>
						<label class="pip-choice<?php echo 'custom' === $s['sound'] ? ' is-active' : ''; ?>"><input type="radio" name="o[sound]" value="custom" <?php checked( 'custom', $s['sound'] ); ?>><b>Som personalizado + som do sistema</b><span>Quando o site estiver aberto numa aba, toca também o som escolhido abaixo.</span></label>
					</div>
					<div class="pip-sound-list" data-sound-list>
						<?php foreach ( self::SOUNDS as $k => $label ) : ?>
							<label class="pip-sound<?php echo $k === $s['sound_name'] ? ' is-active' : ''; ?>">
								<input type="radio" name="o[sound_name]" value="<?php echo esc_attr( $k ); ?>" <?php checked( $k, $s['sound_name'] ); ?>>
								<span><?php echo esc_html( $label ); ?></span>
								<button type="button" class="pip-button is-ghost pip-play" data-sound="<?php echo esc_attr( $k ); ?>" aria-label="Ouvir">▶ Ouvir</button>
							</label>
						<?php endforeach; ?>
					</div>
					<p class="pip-help"><strong>Limite dos navegadores:</strong> nenhum deles deixa trocar o som do sistema de uma notificação push — toca sempre o som padrão do aparelho. O som personalizado só toca quando a pessoa está com o site aberto numa aba (no celular, com o app do site aberto).</p>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Vibração</h2>
					<div class="pip-sound-list">
						<?php foreach ( self::VIBRATIONS as $k => $v ) : ?>
							<label class="pip-sound<?php echo $k === $s['vibrate'] ? ' is-active' : ''; ?>">
								<input type="radio" name="o[vibrate]" value="<?php echo esc_attr( $k ); ?>" <?php checked( $k, $s['vibrate'] ); ?>>
								<span><?php echo esc_html( $v[0] ); ?><?php echo $v[1] ? ' <small>' . esc_html( implode( '·', $v[1] ) ) . ' ms</small>' : ''; ?></span>
								<?php if ( $v[1] ) : ?><button type="button" class="pip-button is-ghost pip-vibe" data-vibe="<?php echo esc_attr( $k ); ?>">Testar</button><?php endif; ?>
							</label>
						<?php endforeach; ?>
					</div>
					<p class="pip-help"><strong>Só no Android.</strong> Computador e iPhone não vibram com push. No Android 8 ou mais novo, o Chrome pode usar a vibração do canal do site no lugar do padrão escolhido (a pessoa ajusta em Configurações → Notificações → site). "Testar" vibra este aparelho, se for Android.</p>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Comportamento</h2>
					<label class="pip-switch"><input type="checkbox" name="o[require_interaction]" value="1" <?php checked( $s['require_interaction'] ); ?>><i></i> Manter na tela até a pessoa fechar (computador)</label>
					<label class="pip-switch"><input type="checkbox" name="o[renotify]" value="1" <?php checked( $s['renotify'] ); ?>><i></i> Avisar de novo (som/vibração) se chegar outra notificação do mesmo tipo</label>
					<p class="pip-help">No celular as notificações ficam na barra até a pessoa limpar; "manter na tela" vale para o Chrome e Edge no computador, onde elas somem sozinhas depois de alguns segundos.</p>
					<div class="pip-editor__save" style="padding-bottom:0">
						<button type="submit" class="pip-button is-primary is-lg">Salvar configurações</button>
					</div>
				</section>
			</div>
		</form>

		<?php self::blast_form(); ?>
		<?php self::blast_history(); ?>
		<?php
	}

	/**
	 * "há X" legível.
	 *
	 * @param int $ts Timestamp (0 = nunca).
	 * @return string
	 */
	private static function ago( $ts ) {
		if ( ! $ts ) {
			return 'nunca';
		}
		$d = max( 0, time() - (int) $ts );
		if ( $d < 60 ) {
			return 'há ' . $d . ' s';
		}
		if ( $d < 3600 ) {
			return 'há ' . floor( $d / 60 ) . ' min';
		}
		if ( $d < 86400 ) {
			return 'há ' . floor( $d / 3600 ) . ' h';
		}
		return 'há ' . floor( $d / 86400 ) . ' dia(s)';
	}

	/**
	 * Card "Saúde do envio": fila, worker, cron, paralelismo, hoje.
	 */
	private static function health_card() {
		$h    = PIP_Flow::health();
		$wl   = $h['worker_last'];
		$warn = array();
		if ( ! PIP_Push::supported() ) {
			$warn[] = 'Este servidor não consegue enviar push (PHP sem OpenSSL com ECDH/AES-GCM ou sem hash_hkdf).';
		}
		if ( $h['cron_off'] && $h['cron_stale'] ) {
			$warn[] = 'O WP-Cron está desligado (DISABLE_WP_CRON) e nenhum tick chegou nos últimos 5 min: configure um cron do sistema chamando wp-cron.php a cada minuto, senão os passos com atraso (30 min, 1 dia…) atrasam.';
		} elseif ( $h['cron_stale'] && $h['cron_last'] ) {
			$warn[] = 'O cron do WordPress não roda há ' . self::ago( $h['cron_last'] ) . '. Sem visitas ele não dispara sozinho; para envios no horário certo, um cron do sistema a cada minuto é o ideal.';
		}
		if ( ! $h['parallel'] ) {
			$warn[] = 'Sem curl_multi no PHP: os envios saem um a um (bem mais lento com muitos inscritos). Peça à hospedagem a extensão cURL.';
		}
		if ( $h['due'] > 0 && ( empty( $wl['at'] ) || time() - (int) $wl['at'] > 10 * MINUTE_IN_SECONDS ) ) {
			$warn[] = number_format_i18n( $h['due'] ) . ' notificação(ões) vencidas na fila e o worker não roda há mais de 10 min — verifique o cron e se o site consegue chamar a si mesmo (loopback).';
		}
		?>
		<section class="pip-card pip-section pip-health">
			<div class="pip-toolbar" style="margin:0 0 12px">
				<div>
					<h2 class="pip-section__title" style="margin:0">Saúde do envio</h2>
					<p class="pip-help" style="margin-top:4px">O que está esperando para sair, quando o worker rodou pela última vez e como o servidor envia.</p>
				</div>
				<div class="pip-toolbar__right">
					<span class="pip-pill<?php echo $warn ? '' : ' is-on'; ?>"><i></i> <?php echo $warn ? 'atenção' : 'tudo certo'; ?></span>
					<a class="pip-button is-ghost" href="<?php echo esc_url( self::url() ); ?>">Atualizar</a>
				</div>
			</div>
			<?php foreach ( $warn as $w ) : ?>
				<div class="pip-notice is-warn"><?php echo esc_html( $w ); ?></div>
			<?php endforeach; ?>
			<div class="pip-kpis pip-kpis--health">
				<div class="pip-kpi"><span class="pip-kpi__label">Inscritos ativos</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $h['subscribers'] ) ); ?></span></div>
				<div class="pip-kpi<?php echo $h['due'] ? ' is-accent' : ''; ?>"><span class="pip-kpi__label">Na fila agora</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $h['due'] + $h['sending'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Agendadas (atraso)</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $h['later'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Hoje · entregues</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $h['today']['sent'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Hoje · falhas</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $h['today']['failed'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Hoje · cliques</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $h['today']['clicked'] ) ); ?></span></div>
			</div>
			<dl class="pip-legend__list pip-health__list">
				<div><dt>Worker</dt><dd><?php echo ! empty( $wl['at'] ) ? esc_html( 'última rodada ' . self::ago( $wl['at'] ) . ' (' . $wl['source'] . '): ' . number_format_i18n( (int) $wl['rows'] ) . ' tratadas, ' . number_format_i18n( (int) $wl['sent'] ) . ' entregues, ' . number_format_i18n( (int) $wl['failed'] ) . ' falhas em ' . number_format_i18n( (int) $wl['ms'] ) . ' ms' . ( ! empty( $wl['more'] ) ? ' · continuou em seguida' : '' ) ) : 'ainda não rodou'; ?></dd></div>
				<div><dt>Cron do WordPress</dt><dd><?php echo esc_html( ( $h['cron_off'] ? 'DISABLE_WP_CRON ligado (cron do sistema) · ' : '' ) . 'último tick ' . self::ago( $h['cron_last'] ) . ( $h['cron_next'] ? ' · próximo ' . wp_date( 'H:i:s', $h['cron_next'] ) : '' ) ); ?></dd></div>
				<div><dt>Como envia</dt><dd><?php echo esc_html( $h['parallel'] ? $h['concurrency'] . ' envios em paralelo (curl_multi), lotes de ' . $h['batch'] : 'um a um (sem curl_multi)' ); ?> · cada rodada usa até ~25 s e, se sobrar fila, acorda a próxima na hora.</dd></div>
				<div><dt>Limpeza</dt><dd><?php $pl = $h['prune_last']; echo esc_html( ! empty( $pl['at'] ) ? 'última ' . self::ago( $pl['at'] ) : 'diária (ainda não rodou)' ); ?> · envios individuais ficam 90 dias (os totais ficam para sempre), fila enviada 7 dias, inscritos expirados 60 dias, diagnóstico 7 dias.</dd></div>
				<div><dt>Diagnóstico</dt><dd><?php echo $h['diag_until'] ? esc_html( 'ligado até ' . wp_date( 'd/m H:i', $h['diag_until'] ) ) : 'desligado (ligue em Automação → Diagnóstico só para investigar um aparelho)'; ?></dd></div>
			</dl>
		</section>
		<?php
	}

	/**
	 * Formulário "Enviar agora".
	 */
	private static function blast_form() {
		$active = PIP_Store::subscribers_count();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="pip-editor pip-blast" id="pip-blast-form" onsubmit="return confirm('Enviar agora para <?php echo (int) $active; ?> aparelho(s)?');">
			<?php wp_nonce_field( 'pip_blast_send' ); ?>
			<input type="hidden" name="action" value="pip_blast_send">
			<div class="pip-editor__form">
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Enviar agora <small><?php echo (int) $active; ?> inscrito(s)</small></h2>
					<p class="pip-help">Uma notificação para todos os aparelhos inscritos, neste instante. O envio começa na hora; com muitos inscritos o restante sai nos próximos minutos (cron e visitas) e o progresso aparece no histórico abaixo.</p>
					<label class="pip-field"><span>Título</span><input type="text" name="b[title]" maxlength="120" required></label>
					<label class="pip-field"><span>Texto</span><textarea name="b[body]" rows="3" maxlength="255"></textarea></label>
					<label class="pip-field"><span>Link ao tocar</span><input type="url" name="b[url]" maxlength="255" placeholder="<?php echo esc_attr( home_url( '/' ) ); ?>"></label>
					<div class="pip-row" data-icon-fields data-mode="<?php echo get_site_icon_url( 96 ) ? 'site' : 'emoji'; ?>">
						<label class="pip-field pip-field--sm"><span>Ícone</span><select name="b[icon_mode]">
							<option value="site">Ícone do site</option>
							<option value="emoji" <?php selected( ! get_site_icon_url( 96 ) ); ?>>Emoji</option>
							<option value="image">Imagem (URL)</option>
						</select></label>
						<label class="pip-field pip-field--sm" data-for="emoji"><span>Emoji</span><input type="text" name="b[icon_emoji]" value="🔔" maxlength="16"></label>
						<label class="pip-field pip-field--grow" data-for="image"><span>URL da imagem do ícone</span><input type="url" name="b[icon_url]" maxlength="255"></label>
					</div>
					<label class="pip-field"><span>Imagem grande (opcional, URL)</span><input type="url" name="b[image_url]" maxlength="255"></label>
					<div class="pip-row">
						<label class="pip-field pip-field--sm"><span>Som deste envio</span><select name="b[sound]">
							<option value="">Padrão das configurações</option>
							<option value="system">Som do sistema</option>
							<option value="silent">Silenciosa</option>
							<option value="custom">Personalizado (site aberto)</option>
						</select></label>
						<label class="pip-field pip-field--sm"><span>Vibração deste envio</span><select name="b[vibrate]">
							<option value="">Padrão das configurações</option>
							<?php foreach ( self::VIBRATIONS as $k => $v ) : ?><option value="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $v[0] ); ?></option><?php endforeach; ?>
						</select></label>
					</div>
					<div class="pip-editor__save">
						<button type="submit" class="pip-button is-primary is-lg" <?php disabled( ! $active ); ?>>Enviar agora para todos</button>
					</div>
				</section>
			</div>
			<aside class="pip-editor__preview">
				<div class="pip-preview-head"><span class="pip-section__title">Prévia</span></div>
				<div class="pip-notif-preview">
					<div class="pip-notif" id="pip-blast-preview">
						<img class="pip-notif__icon" src="<?php echo esc_url( get_site_icon_url( 192 ) ? get_site_icon_url( 192 ) : PIP_URL . 'assets/app/icon-192.png' ); ?>" alt="">
						<div class="pip-notif__body">
							<div class="pip-notif__site"><?php echo esc_html( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) ); ?> · agora</div>
							<div class="pip-notif__title">(sem título)</div>
							<div class="pip-notif__text"></div>
							<img class="pip-notif__image" src="" alt="" hidden>
						</div>
					</div>
				</div>
			</aside>
		</form>
		<?php
	}

	/**
	 * Histórico dos "Enviar agora".
	 */
	private static function blast_history() {
		$rows = PIP_Flow::blasts( 20 );
		if ( ! $rows ) {
			return;
		}
		?>
		<section class="pip-card pip-section" style="margin-top:18px">
			<h2 class="pip-section__title">Histórico de envios</h2>
			<table class="pip-table">
				<thead><tr><th>Quando</th><th>Notificação</th><th>Origem</th><th>Aparelhos</th><th>Entregues</th><th>Falhas</th><th>Cliques</th><th>Estado</th></tr></thead>
				<tbody>
				<?php foreach ( $rows as $b ) : ?>
					<tr>
						<td><?php echo esc_html( mysql2date( 'd/m H:i', $b['created_at'] ) ); ?></td>
						<td><strong><?php echo esc_html( $b['title'] ); ?></strong><br><span class="pip-muted"><?php echo esc_html( mb_substr( $b['body'], 0, 80 ) ); ?></span></td>
						<td class="pip-muted"><?php echo 'broadcast' === $b['kind'] ? 'Broadcast' . ( $b['broadcast_name'] ? ' · ' . esc_html( $b['broadcast_name'] ) : '' ) : ( (int) $b['copy_id'] ? 'Copy (Enviar agora)' : 'Enviar agora' ); ?></td>
						<td><?php echo (int) $b['total']; ?></td>
						<td><?php echo (int) $b['sent']; ?></td>
						<td><?php echo (int) $b['failed']; ?></td>
						<td><?php echo (int) $b['clicked']; ?></td>
						<td><span class="pip-pill<?php echo 'done' === $b['status'] ? ' is-on' : ''; ?>"><i></i> <?php echo 'done' === $b['status'] ? 'concluído' : 'enviando'; ?></span></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<p class="pip-help">"Entregues" = aceitas pelo serviço de push do navegador (Google, Apple, Mozilla); a exibição final depende do aparelho estar ligado e com internet.</p>
		</section>
		<?php
	}
}
