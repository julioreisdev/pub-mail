<?php
/**
 * Tela "Popup Layout": lista dos layouts com as métricas de cada um (impressões, cliques,
 * ativações, taxa) e o editor com prévia ao vivo. Salvar/ligar/duplicar/apagar passam pelo
 * admin-post com nonce.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Lista + editor de layouts.
 */
class PIP_Popup_Layout {

	const PAGE = 'push-in-play-popup-layout';

	/**
	 * Hooks das ações do formulário.
	 */
	public static function init() {
		add_action( 'admin_post_pip_layout_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_pip_layout_action', array( __CLASS__, 'handle_action' ) );
	}

	/**
	 * URL da tela (com parâmetros).
	 *
	 * @param array $args Query extra.
	 * @return string
	 */
	public static function url( $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => self::PAGE ), $args ), admin_url( 'admin.php' ) );
	}

	/**
	 * Estamos no editor?
	 *
	 * @return bool
	 */
	public static function editing() {
		return isset( $_GET['edit'] ) || isset( $_GET['new'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Scripts do editor (renderizador + prévia).
	 */
	public static function assets() {
		if ( ! self::editing() ) {
			return;
		}
		wp_enqueue_script( 'pip-popup', PIP_URL . 'assets/pip-popup.js', array(), PIP_VERSION, true );
		wp_enqueue_script( 'pip-admin', PIP_URL . 'assets/pip-admin.js', array( 'pip-popup' ), PIP_VERSION, true );
	}

	// ------------------------------------------------------------------ ações

	/**
	 * Salvar (novo ou edição).
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'pip_layout_save' );
		$id = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
		$l  = isset( $_POST['l'] ) && is_array( $_POST['l'] ) ? wp_unslash( $_POST['l'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$c  = isset( $_POST['c'] ) && is_array( $_POST['c'] ) ? wp_unslash( $_POST['c'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$config = array(
			'title'         => isset( $c['title'] ) ? $c['title'] : '',
			'message'       => isset( $c['message'] ) ? $c['message'] : '',
			'accept'        => isset( $c['accept'] ) ? $c['accept'] : '',
			'dismiss'       => isset( $c['dismiss'] ) ? $c['dismiss'] : '',
			'show_dismiss'  => ! empty( $c['show_dismiss'] ),
			'show_close'    => ! empty( $c['show_close'] ),
			'denied_title'  => isset( $c['denied_title'] ) ? $c['denied_title'] : '',
			'denied_text'   => isset( $c['denied_text'] ) ? $c['denied_text'] : '',
			'denied_button' => isset( $c['denied_button'] ) ? $c['denied_button'] : '',
			'icon'          => array(
				'mode'  => isset( $c['icon_mode'] ) ? $c['icon_mode'] : 'emoji',
				'emoji' => isset( $c['icon_emoji'] ) ? $c['icon_emoji'] : '🔔',
				'url'   => isset( $c['icon_url'] ) ? $c['icon_url'] : '',
			),
			'colors'        => array(
				'bg'      => isset( $c['bg'] ) ? $c['bg'] : '',
				'fg'      => isset( $c['fg'] ) ? $c['fg'] : '',
				'btn'     => isset( $c['btn'] ) ? $c['btn'] : '',
				'btn_fg'  => isset( $c['btn_fg'] ) ? $c['btn_fg'] : '',
				'overlay' => isset( $c['overlay'] ) ? $c['overlay'] : '',
			),
			'overlay_alpha' => isset( $c['overlay_alpha'] ) ? $c['overlay_alpha'] : 55,
			'radius'        => isset( $c['radius'] ) ? $c['radius'] : 16,
			'trigger'       => array(
				'delay'  => isset( $c['delay'] ) ? $c['delay'] : 3,
				'scroll' => isset( $c['scroll'] ) ? $c['scroll'] : 0,
			),
			'cooldown_days' => isset( $c['cooldown_days'] ) ? $c['cooldown_days'] : 7,
			'install'       => array(
				'ios_enabled' => ! empty( $c['ios_enabled'] ),
				'app_enabled' => ! empty( $c['app_enabled'] ),
				'title'       => isset( $c['install_title'] ) ? $c['install_title'] : '',
				'message'     => isset( $c['install_message'] ) ? $c['install_message'] : '',
				'button'      => isset( $c['install_button'] ) ? $c['install_button'] : '',
				'ios_title'   => isset( $c['ios_title'] ) ? $c['ios_title'] : '',
				'ios_message' => isset( $c['ios_message'] ) ? $c['ios_message'] : '',
				'ios_button'  => isset( $c['ios_button'] ) ? $c['ios_button'] : '',
				'ios_step1'   => isset( $c['ios_step1'] ) ? $c['ios_step1'] : '',
				'ios_step2'   => isset( $c['ios_step2'] ) ? $c['ios_step2'] : '',
				'ios_step3'   => isset( $c['ios_step3'] ) ? $c['ios_step3'] : '',
				'ios_retry'   => isset( $c['ios_retry'] ) ? $c['ios_retry'] : 0,
				'ios_guide'   => ! empty( $c['ios_guide'] ),
				'ios_target'  => isset( $c['ios_target'] ) ? $c['ios_target'] : '',
				'ios_safari'  => isset( $c['ios_safari'] ) ? $c['ios_safari'] : '',
				'ios_rows'    => isset( $c['ios_rows'] ) ? $c['ios_rows'] : '',
				'ios_tip'     => isset( $c['ios_tip'] ) ? $c['ios_tip'] : '',
			),
		);
		$data   = array(
			'name'       => isset( $l['name'] ) ? $l['name'] : '',
			'type'       => isset( $l['type'] ) ? $l['type'] : 'modal',
			'enabled'    => ! empty( $l['enabled'] ),
			'weight'     => isset( $l['weight'] ) ? $l['weight'] : 100,
			'config'     => $config,
			'css_mode'   => isset( $_POST['css_mode'] ) ? sanitize_key( wp_unslash( $_POST['css_mode'] ) ) : 'append',
			'custom_css' => isset( $_POST['custom_css'] ) ? self::clean_css( wp_unslash( $_POST['custom_css'] ) ) : '', // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		);
		$id = PIP_Store::save_layout( $data, $id ? $id : null );
		wp_safe_redirect( self::url( array( 'edit' => $id, 'saved' => 1 ) ) );
		exit;
	}

	/**
	 * Ligar/desligar, duplicar, apagar (links com nonce).
	 */
	public static function handle_action() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		$do = isset( $_GET['do'] ) ? sanitize_key( wp_unslash( $_GET['do'] ) ) : '';
		check_admin_referer( 'pip_layout_' . $do . '_' . $id );
		$msg = '';
		if ( 'enable' === $do || 'disable' === $do ) {
			PIP_Store::set_enabled( $id, 'enable' === $do );
			$msg = 'enable' === $do ? 'enabled' : 'disabled';
		} elseif ( 'duplicate' === $do ) {
			$new = PIP_Store::duplicate_layout( $id );
			wp_safe_redirect( self::url( $new ? array( 'edit' => $new, 'duplicated' => 1 ) : array() ) );
			exit;
		} elseif ( 'delete' === $do ) {
			PIP_Store::delete_layout( $id );
			$msg = 'deleted';
		}
		wp_safe_redirect( self::url( $msg ? array( 'msg' => $msg ) : array() ) );
		exit;
	}

	/**
	 * CSS do usuário: só texto, sem tags (vai dentro de <style> na página pública).
	 *
	 * @param string $css CSS.
	 * @return string
	 */
	private static function clean_css( $css ) {
		$css = str_replace( array( '</', '<script', 'expression(', 'javascript:' ), array( '< /', '', '', '' ), (string) $css );
		return $css;
	}

	/**
	 * Link de ação com nonce.
	 *
	 * @param string $do Ação.
	 * @param int    $id Id.
	 * @return string
	 */
	private static function action_url( $do, $id ) {
		return wp_nonce_url( admin_url( 'admin-post.php?action=pip_layout_action&do=' . $do . '&id=' . (int) $id ), 'pip_layout_' . $do . '_' . $id );
	}

	// ------------------------------------------------------------------ telas

	/**
	 * Tela (lista ou editor).
	 */
	public static function render() {
		self::notices();
		if ( self::editing() ) {
			self::editor();
		} else {
			self::listing();
		}
	}

	/**
	 * Avisos pós-ação.
	 */
	private static function notices() {
		$map = array(
			'saved'      => 'Layout salvo.',
			'duplicated' => 'Layout duplicado (desligado). Ajuste e ligue quando quiser.',
		);
		$msg = '';
		foreach ( $map as $k => $v ) {
			if ( isset( $_GET[ $k ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				$msg = $v;
			}
		}
		if ( isset( $_GET['msg'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$m   = sanitize_key( wp_unslash( $_GET['msg'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$msg = array(
				'enabled'  => 'Layout ligado: já aparece no site.',
				'disabled' => 'Layout desligado.',
				'deleted'  => 'Layout apagado.',
			);
			$msg = isset( $msg[ $m ] ) ? $msg[ $m ] : '';
		}
		if ( $msg ) {
			echo '<div class="pip-notice">' . esc_html( $msg ) . '</div>';
		}
		if ( ! PIP_Vapid::keys() ) {
			echo '<div class="pip-notice is-error">Este servidor não consegue gerar as chaves do push (OpenSSL sem curva P-256). O popup não será exibido até isso ser resolvido pela hospedagem.</div>';
		}
	}

	/**
	 * Lista dos layouts + métricas.
	 */
	private static function listing() {
		$days    = isset( $_GET['days'] ) ? sanitize_key( wp_unslash( $_GET['days'] ) ) : '30'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$days    = in_array( $days, array( '7', '30', '90', 'all' ), true ) ? $days : '30';
		$ndays   = 'all' === $days ? null : (int) $days;
		$plats   = PIP_Store::platforms( $ndays );
		$plat    = isset( $_GET['platform'] ) ? sanitize_key( wp_unslash( $_GET['platform'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$plat    = in_array( $plat, $plats, true ) ? $plat : '';
		$qs      = array( 'days' => $days );
		if ( $plat ) {
			$qs['platform'] = $plat;
		}
		$layouts = PIP_Store::layouts();
		$stats   = PIP_Store::stats( $ndays, $plat ? $plat : null );
		$active  = array_filter(
			$layouts,
			function ( $l ) {
				return $l['enabled'];
			}
		);
		$weight_total = 0;
		foreach ( $active as $a ) {
			$weight_total += $a['weight'];
		}
		$tot = array(
			'impressions' => 0,
			'clicks'      => 0,
			'granted'     => 0,
			'installed'   => 0,
		);
		foreach ( $stats as $s ) {
			$tot['impressions'] += $s['impressions'];
			$tot['clicks']      += $s['clicks'];
			$tot['granted']     += $s['granted'];
			$tot['installed']   += $s['installed'];
		}
		$subs = PIP_Store::subscribers_count( $plat ? $plat : null );
		?>
		<div class="pip-toolbar">
			<div class="pip-kpis">
				<div class="pip-kpi"><span class="pip-kpi__label">Impressões</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['impressions'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Cliques</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['clicks'] ) ); ?></span></div>
				<div class="pip-kpi is-accent"><span class="pip-kpi__label">Ativações</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['granted'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Apps instalados</span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $tot['installed'] ) ); ?></span></div>
				<div class="pip-kpi"><span class="pip-kpi__label">Inscritos<?php echo $plat ? ' · ' . esc_html( PIP_Store::PLATFORMS[ $plat ] ) : ' (total)'; ?></span><span class="pip-kpi__value"><?php echo esc_html( number_format_i18n( $subs ) ); ?></span></div>
			</div>
			<div class="pip-toolbar__right">
				<div class="pip-seg" role="group" aria-label="Período">
					<?php foreach ( array( '7' => '7 dias', '30' => '30 dias', '90' => '90 dias', 'all' => 'Tudo' ) as $k => $label ) : ?>
						<a class="pip-seg__item<?php echo $k === $days ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array_merge( $qs, array( 'days' => $k ) ) ) ); ?>"><?php echo esc_html( $label ); ?></a>
					<?php endforeach; ?>
				</div>
				<?php if ( $plats ) : ?>
					<div class="pip-seg" role="group" aria-label="Plataforma">
						<a class="pip-seg__item<?php echo '' === $plat ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array( 'days' => $days ) ) ); ?>">Todas</a>
						<?php foreach ( $plats as $k ) : ?>
							<a class="pip-seg__item<?php echo $k === $plat ? ' is-active' : ''; ?>" href="<?php echo esc_url( self::url( array( 'days' => $days, 'platform' => $k ) ) ); ?>"><?php echo esc_html( PIP_Store::PLATFORMS[ $k ] ); ?></a>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
				<a class="pip-button is-primary" href="<?php echo esc_url( self::url( array( 'new' => 1 ) ) ); ?>">+ Novo layout</a>
			</div>
		</div>

		<?php if ( ! $active ) : ?>
			<div class="pip-notice is-warn">Nenhum layout ligado: o popup não aparece no site. Ligue um layout abaixo (ou crie um novo).</div>
		<?php elseif ( count( $active ) > 1 ) : ?>
			<p class="pip-hint">Com <?php echo (int) count( $active ); ?> layouts ligados, cada visitante novo vê um deles, sorteado pelo peso. O mesmo visitante vê sempre o mesmo layout, e a ativação conta para o layout que ele viu.</p>
		<?php endif; ?>

		<div class="pip-grid">
			<?php foreach ( $layouts as $l ) : ?>
				<?php
				$s     = isset( $stats[ $l['id'] ] ) ? $stats[ $l['id'] ] : array( 'impressions' => 0, 'clicks' => 0, 'granted' => 0, 'denied' => 0, 'dismissed' => 0, 'installed' => 0 );
				$rate  = $s['impressions'] ? round( 100 * $s['granted'] / $s['impressions'], 1 ) : 0;
				$ctr   = $s['impressions'] ? round( 100 * $s['clicks'] / $s['impressions'], 1 ) : 0;
				$share = ( $l['enabled'] && $weight_total ) ? round( 100 * $l['weight'] / $weight_total ) : 0;
				?>
				<article class="pip-card pip-layout<?php echo $l['enabled'] ? ' is-on' : ''; ?>">
					<div class="pip-layout__head">
						<span class="pip-mini pip-mini--<?php echo esc_attr( $l['type'] ); ?>" aria-hidden="true"><i></i></span>
						<div class="pip-layout__title">
							<h3><?php echo esc_html( $l['name'] ); ?></h3>
							<span class="pip-layout__type"><?php echo esc_html( self::type_label( $l['type'] ) ); ?></span>
						</div>
						<?php if ( $l['enabled'] ) : ?>
							<span class="pip-pill is-on"><i></i>Ligado<?php echo count( $active ) > 1 ? ' · ' . (int) $share . '%' : ''; ?></span>
						<?php else : ?>
							<span class="pip-pill"><i></i>Desligado</span>
						<?php endif; ?>
					</div>
					<div class="pip-layout__stats">
						<div><span class="pip-stat__n"><?php echo esc_html( number_format_i18n( $s['impressions'] ) ); ?></span><span class="pip-stat__l">impressões</span></div>
						<div><span class="pip-stat__n"><?php echo esc_html( number_format_i18n( $s['clicks'] ) ); ?></span><span class="pip-stat__l">cliques · <?php echo esc_html( $ctr ); ?>%</span></div>
						<div class="is-accent"><span class="pip-stat__n"><?php echo esc_html( number_format_i18n( $s['granted'] ) ); ?></span><span class="pip-stat__l">ativações · <?php echo esc_html( $rate ); ?>%</span></div>
						<div><span class="pip-stat__n"><?php echo esc_html( number_format_i18n( $s['dismissed'] + $s['denied'] ) ); ?></span><span class="pip-stat__l">recusas</span></div>
					</div>
					<div class="pip-bar" title="Ativações por impressão"><span style="width:<?php echo esc_attr( min( 100, $rate ) ); ?>%"></span></div>
					<div class="pip-layout__actions">
						<a class="pip-button" href="<?php echo esc_url( self::url( array( 'edit' => $l['id'] ) ) ); ?>">Editar</a>
						<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( $l['enabled'] ? 'disable' : 'enable', $l['id'] ) ); ?>"><?php echo $l['enabled'] ? 'Desligar' : 'Ligar'; ?></a>
						<a class="pip-button is-ghost" href="<?php echo esc_url( self::action_url( 'duplicate', $l['id'] ) ); ?>">Duplicar</a>
						<a class="pip-button is-ghost is-danger" href="<?php echo esc_url( self::action_url( 'delete', $l['id'] ) ); ?>" onclick="return confirm('Apagar este layout e as métricas dele?');">Apagar</a>
					</div>
				</article>
			<?php endforeach; ?>
		</div>
		<section class="pip-card pip-legend" aria-label="O que cada número significa">
			<h3 class="pip-section__title">O que cada número significa</h3>
			<dl class="pip-legend__list">
				<div><dt>Impressões</dt><dd>Quantas vezes o popup foi exibido a um visitante. Cada pessoa vê o popup uma vez por visita; quem já ativou ou bloqueou as notificações não entra na conta.</dd></div>
				<div><dt>Cliques</dt><dd>Quantas vezes alguém tocou em “ativar”. A porcentagem ao lado é cliques ÷ impressões (quanto o layout convence a tocar).</dd></div>
				<div><dt>Ativações</dt><dd>Quantos realmente liberaram as notificações no navegador e ficaram inscritos, contados pelo servidor na hora da inscrição. A porcentagem é ativações ÷ impressões: é a taxa que diz qual layout funciona melhor.</dd></div>
				<div><dt>Recusas</dt><dd>Quem fechou o popup, tocou em “agora não” ou negou a permissão do navegador. Quem recusa só volta a ver o popup depois do prazo definido em “Se recusar, esperar (dias)”.</dd></div>
				<div><dt>Inscritos (total)</dt><dd>Quantos aparelhos estão inscritos hoje para receber as notificações do site, somando todos os layouts e todo o período. É a lista para a qual os broadcasts vão sair.</dd></div>
				<div><dt>Período</dt><dd>Os botões 7 / 30 / 90 dias e Tudo filtram impressões, cliques, ativações e recusas. “Inscritos (total)” não muda com o período.</dd></div>
				<div><dt>Apps instalados</dt><dd>Quantos visitantes abriram o site como app pela primeira vez (adicionado à tela inicial no iPhone, Android ou computador). No iPhone esse passo é obrigatório para receber notificações.</dd></div>
				<div><dt>Plataforma</dt><dd>Android, iPhone / iPad, Windows, Mac, Linux: filtra todos os números (inclusive inscritos) pelo aparelho do visitante, lido do navegador. Só aparecem as plataformas que já registraram pelo menos 1 evento ou inscrito.</dd></div>
			</dl>
		</section>
		<p class="pip-hint pip-hint--foot">No iPhone e iPad o push só funciona com o site adicionado à Tela de Início (iOS 16.4+); no Safari comum o popup nem aparece. No computador e no Android funciona direto no navegador.</p>
		<?php
	}

	/**
	 * Rótulo do tipo.
	 *
	 * @param string $type Tipo.
	 * @return string
	 */
	public static function type_label( $type ) {
		$m = array(
			'modal'      => 'Modal no centro',
			'bar-top'    => 'Barra no topo',
			'bar-bottom' => 'Barra no rodapé',
			'corner-tl'  => 'Canto superior esquerdo',
			'corner-tr'  => 'Canto superior direito',
			'corner-bl'  => 'Canto inferior esquerdo',
			'corner-br'  => 'Canto inferior direito',
		);
		return isset( $m[ $type ] ) ? $m[ $type ] : $type;
	}

	/**
	 * Editor com prévia ao vivo.
	 */
	private static function editor() {
		$id = isset( $_GET['edit'] ) ? (int) $_GET['edit'] : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$l  = $id ? PIP_Store::layout( $id ) : null;
		if ( $id && ! $l ) {
			echo '<div class="pip-notice is-error">Layout não encontrado.</div>';
			return;
		}
		if ( ! $l ) {
			$l = array(
				'id'         => 0,
				'name'       => 'Novo layout',
				'type'       => 'modal',
				'enabled'    => false,
				'weight'     => 100,
				'config'     => PIP_Store::default_config(),
				'css_mode'   => 'append',
				'custom_css' => '',
			);
		}
		$c         = $l['config'];
		$site_icon = get_site_icon_url( 96 );
		$field     = function ( $name, $value, $attrs = '' ) {
			return '<input type="text" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" ' . $attrs . '>';
		};
		$color     = function ( $name, $value ) {
			return '<span class="pip-color" data-color><input type="color" value="' . esc_attr( $value ) . '" aria-label="Cor"><input type="text" name="' . esc_attr( $name ) . '" value="' . esc_attr( $value ) . '" maxlength="7" pattern="#[0-9a-fA-F]{6}"></span>';
		};
		?>
		<a class="pip-back" href="<?php echo esc_url( self::url() ); ?>">← Todos os layouts</a>
		<form id="pip-layout-form" class="pip-editor" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" data-site-icon="<?php echo esc_attr( $site_icon ); ?>">
			<?php wp_nonce_field( 'pip_layout_save' ); ?>
			<input type="hidden" name="action" value="pip_layout_save">
			<input type="hidden" name="id" value="<?php echo (int) $l['id']; ?>">

			<div class="pip-editor__form">
				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Identificação</h2>
					<div class="pip-row">
						<label class="pip-field pip-field--grow"><span>Nome interno</span><?php echo $field( 'l[name]', $l['name'], 'maxlength="120" required' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field pip-field--sm"><span>Peso (tráfego)</span><input type="number" name="l[weight]" value="<?php echo (int) $l['weight']; ?>" min="0" max="1000"></label>
						<label class="pip-switch"><input type="checkbox" name="l[enabled]" value="1" <?php checked( $l['enabled'] ); ?>><i></i><span>Ligado no site</span></label>
					</div>
					<p class="pip-help">Com mais de um layout ligado, o peso define a parte do tráfego de cada um (100 e 100 = metade para cada).</p>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Tipo de popup</h2>
					<div class="pip-types">
						<?php foreach ( PIP_Store::TYPES as $t ) : ?>
							<label class="pip-type-card<?php echo $t === $l['type'] ? ' is-active' : ''; ?>">
								<input type="radio" name="l[type]" value="<?php echo esc_attr( $t ); ?>" <?php checked( $t, $l['type'] ); ?>>
								<span class="pip-mini pip-mini--<?php echo esc_attr( $t ); ?>" aria-hidden="true"><i></i></span>
								<span class="pip-type-card__label"><?php echo esc_html( self::type_label( $t ) ); ?></span>
							</label>
						<?php endforeach; ?>
					</div>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Textos</h2>
					<p class="pip-help">Título ou mensagem em branco = não aparece no popup.</p>
					<label class="pip-field"><span>Título</span><?php echo $field( 'c[title]', $c['title'], 'maxlength="90"' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
					<label class="pip-field"><span>Mensagem</span><textarea name="c[message]" rows="3" maxlength="240"><?php echo esc_textarea( $c['message'] ); ?></textarea></label>
					<div class="pip-row">
						<label class="pip-field pip-field--grow"><span>Botão de aceitar</span><?php echo $field( 'c[accept]', $c['accept'], 'maxlength="40"' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field pip-field--grow"><span>Botão de recusar</span><?php echo $field( 'c[dismiss]', $c['dismiss'], 'maxlength="40"' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
					</div>
					<h3 class="pip-section__sub">Quando o navegador nega a permissão</h3>
					<label class="pip-field"><span>Título</span><input type="text" name="c[denied_title]" value="<?php echo esc_attr( $c['denied_title'] ); ?>" maxlength="90"></label>
					<label class="pip-field"><span>Mensagem</span><textarea name="c[denied_text]" rows="2" maxlength="300"><?php echo esc_textarea( $c['denied_text'] ); ?></textarea></label>
					<div class="pip-row"><label class="pip-field pip-field--grow"><span>Botão</span><input type="text" name="c[denied_button]" value="<?php echo esc_attr( $c['denied_button'] ); ?>" maxlength="40"></label></div>
					<p class="pip-help">Aparece quando a pessoa toca em “ativar” mas o navegador responde “negado” (site bloqueado antes, navegador sem permissão no Android, bloqueio automático do Samsung Internet…). <code>{browser}</code> vira o caminho das configurações do navegador da pessoa.</p>
					<div class="pip-row pip-row--checks">
						<label class="pip-check"><input type="checkbox" name="c[show_dismiss]" value="1" <?php checked( $c['show_dismiss'] ); ?>> Mostrar o botão de recusar</label>
						<label class="pip-check"><input type="checkbox" name="c[show_close]" value="1" <?php checked( $c['show_close'] ); ?>> Mostrar o “×” de fechar</label>
					</div>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Ícone</h2>
					<div class="pip-row" data-icon-fields data-mode="<?php echo esc_attr( $c['icon']['mode'] ); ?>">
						<label class="pip-field pip-field--sm"><span>Origem</span>
							<select name="c[icon_mode]">
								<option value="site" <?php selected( 'site', $c['icon']['mode'] ); ?> <?php disabled( ! $site_icon ); ?>>Ícone do site<?php echo $site_icon ? '' : ' (não definido)'; ?></option>
								<option value="emoji" <?php selected( 'emoji', $c['icon']['mode'] ); ?>>Emoji</option>
								<option value="image" <?php selected( 'image', $c['icon']['mode'] ); ?>>Imagem (URL)</option>
								<option value="none" <?php selected( 'none', $c['icon']['mode'] ); ?>>Sem ícone</option>
							</select>
						</label>
						<label class="pip-field pip-field--sm" data-for="emoji"><span>Emoji</span><?php echo $field( 'c[icon_emoji]', $c['icon']['emoji'], 'maxlength="8"' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field pip-field--grow" data-for="image"><span>URL da imagem</span><?php echo $field( 'c[icon_url]', $c['icon']['url'], 'placeholder="https://…/icone.png"' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
					</div>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Cores e forma</h2>
					<div class="pip-colors">
						<label class="pip-field"><span>Fundo</span><?php echo $color( 'c[bg]', $c['colors']['bg'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field"><span>Texto</span><?php echo $color( 'c[fg]', $c['colors']['fg'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field"><span>Botão</span><?php echo $color( 'c[btn]', $c['colors']['btn'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field"><span>Texto do botão</span><?php echo $color( 'c[btn_fg]', $c['colors']['btn_fg'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field"><span>Fundo escurecido (modal)</span><?php echo $color( 'c[overlay]', $c['colors']['overlay'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
						<label class="pip-field"><span>Opacidade do fundo (%)</span><input type="number" name="c[overlay_alpha]" value="<?php echo (int) $c['overlay_alpha']; ?>" min="0" max="100"></label>
					</div>
					<label class="pip-field pip-field--range"><span>Cantos arredondados: <output><?php echo (int) $c['radius']; ?></output> px</span><input type="range" name="c[radius]" value="<?php echo (int) $c['radius']; ?>" min="0" max="40" oninput="this.previousElementSibling.querySelector('output').value=this.value"></label>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">Quando aparecer</h2>
					<div class="pip-row">
						<label class="pip-field pip-field--sm"><span>Depois de (segundos)</span><input type="number" name="c[delay]" value="<?php echo (int) $c['trigger']['delay']; ?>" min="0" max="300"></label>
						<label class="pip-field pip-field--sm"><span>Ou ao rolar (%)</span><input type="number" name="c[scroll]" value="<?php echo (int) $c['trigger']['scroll']; ?>" min="0" max="100"></label>
						<label class="pip-field pip-field--sm"><span>Se recusar, esperar (dias)</span><input type="number" name="c[cooldown_days]" value="<?php echo (int) $c['cooldown_days']; ?>" min="0" max="365"></label>
					</div>
					<p class="pip-help">Rolagem 0 = ignora a rolagem. Com os dois preenchidos, vale o que acontecer primeiro. Quem já ativou ou bloqueou as notificações nunca vê o popup.</p>
				</section>

				<section class="pip-card pip-section">
					<h2 class="pip-section__title">App na tela inicial</h2>
					<p class="pip-help">O site vira um “app” com o nome e o ícone do site (Aparência → Personalizar → Ícone do site; sem ele, um ícone genérico). Os dois convites abaixo são independentes.</p>
					<h3 class="pip-section__sub">Convite para iPhone e iPad</h3>
					<label class="pip-switch"><input type="checkbox" name="c[ios_enabled]" value="1" <?php checked( ! empty( $c['install']['ios_enabled'] ) ); ?>><i></i> Convidar quem está no iPhone/iPad a adicionar o site à Tela de Início</label>
					<p class="pip-help">No iPhone é o único caminho: o iOS só entrega notificações a sites na Tela de Início e não deixa adicionar sozinho; o botão abre a folha de compartilhar do próprio iPhone. Desligado = quem está no iPhone não vê nada.</p>
					<label class="pip-field"><span>Título</span><input type="text" name="c[ios_title]" value="<?php echo esc_attr( $c['install']['ios_title'] ); ?>" maxlength="90"></label>
					<label class="pip-field"><span>Mensagem</span><textarea name="c[ios_message]" rows="3" maxlength="300"><?php echo esc_textarea( $c['install']['ios_message'] ); ?></textarea></label>
					<div class="pip-row">
						<label class="pip-field pip-field--grow"><span>Botão</span><input type="text" name="c[ios_button]" value="<?php echo esc_attr( $c['install']['ios_button'] ); ?>" maxlength="40"></label>
						<label class="pip-field pip-field--sm"><span>Tocou e não adicionou: lembrar em (min)</span><input type="number" name="c[ios_retry]" value="<?php echo (int) $c['install']['ios_retry']; ?>" min="0" max="10080"></label>
					</div>
					<label class="pip-field"><span>Passo 1</span><input type="text" name="c[ios_step1]" value="<?php echo esc_attr( $c['install']['ios_step1'] ); ?>" maxlength="120"></label>
					<label class="pip-field"><span>Passo 2</span><input type="text" name="c[ios_step2]" value="<?php echo esc_attr( $c['install']['ios_step2'] ); ?>" maxlength="120"></label>
					<label class="pip-field"><span>Passo 3</span><input type="text" name="c[ios_step3]" value="<?php echo esc_attr( $c['install']['ios_step3'] ); ?>" maxlength="120"></label>
					<div class="pip-row">
						<label class="pip-check" style="align-self:center"><input type="checkbox" name="c[ios_guide]" value="1" <?php checked( ! empty( $c['install']['ios_guide'] ) ); ?>> Mostrar a ilustração da folha de compartilhar com o item destacado</label>
						<label class="pip-field pip-field--grow"><span>Nome do item na folha (idioma do iPhone do visitante)</span><input type="text" name="c[ios_target]" value="<?php echo esc_attr( $c['install']['ios_target'] ); ?>" maxlength="40"></label>
						<label class="pip-field pip-field--grow"><span>Botão quando o link abriu dentro de outro app</span><input type="text" name="c[ios_safari]" value="<?php echo esc_attr( $c['install']['ios_safari'] ); ?>" maxlength="40"></label>
					</div>
					<div class="pip-row">
						<label class="pip-field pip-field--grow"><span>Linhas de exemplo da ilustração (separe com |)</span><input type="text" name="c[ios_rows]" value="<?php echo esc_attr( $c['install']['ios_rows'] ); ?>" maxlength="120"></label>
						<label class="pip-field pip-field--grow"><span>Dica abaixo da ilustração</span><input type="text" name="c[ios_tip]" value="<?php echo esc_attr( $c['install']['ios_tip'] ); ?>" maxlength="120"></label>
					</div>
					<p class="pip-help">Link aberto no navegador interno do app do Google, Instagram, Facebook, TikTok etc.: a folha desses apps não tem “Adicionar à Tela de Início”, então o botão vira “Abrir no Safari” e leva a mesma página para o Safari (esquema <code>x-safari-https://</code>), onde o convite normal aparece.</p>
					<p class="pip-help">Todo texto do popup é seu: campo em branco = aquele texto não aparece (só os rótulos de botão voltam ao padrão). Escreva os passos no idioma do seu público; <code>{share}</code> vira o ícone de Compartilhar do iPhone. Passo em branco não aparece. “Lembrar em” 0 = o convite volta na próxima página enquanto o site não for adicionado; “Agora não” respeita os dias de espera de “Quando aparecer”.</p>
					<h3 class="pip-section__sub">Convite no Android e no computador</h3>
					<label class="pip-switch"><input type="checkbox" name="c[app_enabled]" value="1" <?php checked( ! empty( $c['install']['app_enabled'] ) ); ?>><i></i> Depois de ativar as notificações, convidar a instalar o app do site</label>
					<p class="pip-help">Opcional: nessas plataformas as notificações já funcionam sem instalar. O convite usa o instalador nativo do Chrome/Edge (um toque) e aparece logo após a pessoa ativar as notificações.</p>
					<label class="pip-field"><span>Título</span><input type="text" name="c[install_title]" value="<?php echo esc_attr( $c['install']['title'] ); ?>" maxlength="90"></label>
					<label class="pip-field"><span>Mensagem</span><textarea name="c[install_message]" rows="2" maxlength="240"><?php echo esc_textarea( $c['install']['message'] ); ?></textarea></label>
					<div class="pip-row">
						<label class="pip-field pip-field--grow"><span>Botão</span><input type="text" name="c[install_button]" value="<?php echo esc_attr( $c['install']['button'] ); ?>" maxlength="40"></label>
					</div>
				</section>

				<details class="pip-card pip-section pip-advanced" <?php echo trim( $l['custom_css'] ) ? 'open' : ''; ?>>
					<summary><h2 class="pip-section__title">CSS personalizado <small>avançado</small></h2></summary>
					<div class="pip-row pip-row--checks">
						<label class="pip-check"><input type="radio" name="css_mode" value="append" <?php checked( 'append', $l['css_mode'] ); ?>> Acrescentar ao CSS padrão</label>
						<label class="pip-check"><input type="radio" name="css_mode" value="replace" <?php checked( 'replace', $l['css_mode'] ); ?>> Substituir o CSS padrão por completo</label>
					</div>
					<textarea name="custom_css" rows="12" class="pip-code" spellcheck="false" placeholder=".pip-box { border: 2px solid #377ef0; }"><?php echo esc_textarea( $l['custom_css'] ); ?></textarea>
					<div class="pip-row">
						<button type="button" class="pip-button is-ghost" id="pip-css-default">Carregar o CSS padrão para editar</button>
					</div>
					<p class="pip-help">Classes: <code>.pip-root</code> (raiz, com a classe do tipo, ex. <code>.pip-type-modal</code>), <code>.pip-overlay</code>, <code>.pip-box</code>, <code>.pip-icon</code>, <code>.pip-title</code>, <code>.pip-text</code>, <code>.pip-actions</code>, <code>.pip-accept</code>, <code>.pip-dismiss</code>, <code>.pip-close</code>. Variáveis: <code>--pip-bg</code>, <code>--pip-fg</code>, <code>--pip-btn</code>, <code>--pip-btn-fg</code>, <code>--pip-overlay</code>, <code>--pip-radius</code>.</p>
				</details>

				<div class="pip-editor__save">
					<button type="submit" class="pip-button is-primary is-lg">Salvar layout</button>
					<a class="pip-button is-ghost" href="<?php echo esc_url( self::url() ); ?>">Cancelar</a>
				</div>
			</div>

			<aside class="pip-editor__preview">
				<div class="pip-preview-head">
					<span class="pip-section__title">Prévia</span>
					<span class="pip-preview-head__segs">
						<span class="pip-seg">
							<button type="button" class="pip-seg__item is-active" data-stage-variant="permission">Permissão</button>
							<button type="button" class="pip-seg__item" data-stage-variant="ios">iPhone</button>
							<button type="button" class="pip-seg__item" data-stage-variant="install">Instalar app</button>
							<button type="button" class="pip-seg__item" data-stage-variant="denied">Negado</button>
						</span>
						<span class="pip-seg">
							<button type="button" class="pip-seg__item is-active" data-stage-size="desktop">Computador</button>
							<button type="button" class="pip-seg__item" data-stage-size="phone">Celular</button>
						</span>
					</span>
				</div>
				<div class="pip-preview" data-size="desktop">
					<div class="pip-device__frame">
					<div class="pip-device">
						<div class="pip-device__chrome" aria-hidden="true">
							<span class="pip-device__dots"><i></i><i></i><i></i></span>
							<span class="pip-device__url"><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></span>
						</div>
						<div class="pip-device__status" aria-hidden="true">
							<span class="pip-device__time">9:41</span>
							<span class="pip-device__notch"></span>
							<span class="pip-device__icons"><i class="is-signal"></i><i class="is-wifi"></i><i class="is-battery"></i></span>
						</div>
						<div class="pip-device__screen">
							<div class="pip-mock" aria-hidden="true">
								<div class="pip-mock__nav">
									<span class="pip-mock__logo"><?php echo esc_html( get_bloginfo( 'name' ) ); ?></span>
									<span class="pip-mock__menu"><i></i><i></i><i></i><i></i></span>
									<span class="pip-mock__burger"><i></i><i></i><i></i></span>
								</div>
								<div class="pip-mock__hero">
									<div class="pip-mock__hero-text">
										<span class="pip-mock__title"></span>
										<span class="pip-mock__line"></span>
										<span class="pip-mock__line is-short"></span>
										<span class="pip-mock__btn"></span>
									</div>
									<div class="pip-mock__hero-img"></div>
								</div>
								<div class="pip-mock__cards">
									<div class="pip-mock__card"><i></i><b></b><s></s><s class="is-short"></s></div>
									<div class="pip-mock__card"><i></i><b></b><s></s><s class="is-short"></s></div>
									<div class="pip-mock__card"><i></i><b></b><s></s><s class="is-short"></s></div>
								</div>
								<div class="pip-mock__para">
									<span class="pip-mock__line"></span><span class="pip-mock__line"></span><span class="pip-mock__line is-short"></span>
								</div>
							</div>
							<div id="pip-stage"></div>
						</div>
					</div>
					</div>
				</div>
				<p class="pip-help">A prévia usa o mesmo código que roda no site. Os botões aqui não fazem nada.</p>
			</aside>
		</form>
		<?php
	}
}
