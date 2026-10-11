<?php
/**
 * Painel do Push In Play no wp-admin: grupo "Push In Play" na barra lateral com as telas
 * Copys, Broadcasts e Popup Layout. Cada tela tem cabeçalho próprio (ícone, título,
 * descrição) e, por enquanto, um estado vazio bem acabado — o conteúdo entra tela a tela.
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Menu, telas e assets do admin.
 */
class PIP_Admin {

	const SLUG = 'push-in-play';

	/**
	 * Telas do grupo, na ordem em que aparecem no menu. A 1ª usa o slug do grupo
	 * (assim o WordPress não duplica o item de topo como "Push In Play").
	 *
	 * @var array<string, array<string, string>>
	 */
	const SCREENS = array(
		'copys'        => array(
			'title' => 'Copys',
			'desc'  => 'A biblioteca das suas notificações: título, texto, emoji ou imagem, imagem grande e link. Cadastre uma a uma ou importe dezenas de uma planilha. Os broadcasts sorteiam daqui.',
			'icon'  => 'copy',
			'empty' => '',
		),
		'broadcasts'   => array(
			'title' => 'Broadcasts',
			'desc'  => 'Horários do dia em que o site sorteia uma copy e dispara para todos os inscritos — com o que fazer com a copy depois (apagar, marcar como usada ou manter) e o histórico com as métricas de cada disparo e de cada copy.',
			'icon'  => 'speakerphone',
			'empty' => '',
		),
		'automation'   => array(
			'title' => 'Automação',
			'desc'  => 'A sequência que cada novo inscrito recebe: uma notificação logo após ativar, outra 30 minutos depois, outra no dia seguinte… Título, texto, ícone, imagem e link em cada passo, com teste no aparelho da equipe.',
			'icon'  => 'bolt',
			'empty' => '',
		),
		'settings'     => array(
			'title' => 'Configurações básicas',
			'desc'  => 'Som, vibração e comportamento padrão das notificações, e o "Enviar agora": uma notificação para todos os inscritos neste instante.',
			'icon'  => 'sliders',
			'empty' => '',
		),
		'popup-layout' => array(
			'title' => 'Popup Layout',
			'desc'  => 'Como o convite para ativar notificações aparece no site: tipo, textos, cores, quando aparecer e CSS próprio. Vários layouts ligados = teste A/B com a taxa de ativação de cada um.',
			'icon'  => 'layout',
			'empty' => 'O layout do popup ainda não foi configurado. Em breve, um editor com prévia ao vivo.',
		),
	);

	/**
	 * Liga os hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( PIP_FILE ), array( __CLASS__, 'action_links' ) );
	}

	/**
	 * Grupo "Push In Play" + submenus.
	 */
	public static function menu() {
		add_menu_page(
			'Push In Play',
			'Push In Play',
			'manage_options',
			self::SLUG,
			array( __CLASS__, 'page' ),
			self::menu_icon(),
			58 // logo abaixo de "Aparência/Plugins", perto dos outros plugins com menu próprio.
		);
		foreach ( self::SCREENS as $key => $s ) {
			add_submenu_page(
				self::SLUG,
				$s['title'] . ' · Push In Play',
				$s['title'],
				'manage_options',
				self::screen_slug( $key ),
				array( __CLASS__, 'page' )
			);
		}
	}

	/**
	 * Slug de uma tela: a 1ª herda o slug do grupo.
	 *
	 * @param string $key Chave em SCREENS.
	 * @return string
	 */
	private static function screen_slug( $key ) {
		return array_key_first( self::SCREENS ) === $key ? self::SLUG : self::SLUG . '-' . $key;
	}

	/**
	 * Tela atual a partir do `page` da URL.
	 *
	 * @return string Chave em SCREENS.
	 */
	private static function current_screen() {
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : self::SLUG; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		foreach ( self::SCREENS as $key => $s ) {
			if ( self::screen_slug( $key ) === $page ) {
				return $key;
			}
		}
		return array_key_first( self::SCREENS );
	}

	/**
	 * Estamos numa tela do plugin?
	 *
	 * @param string $hook Hook da página atual.
	 * @return bool
	 */
	private static function is_ours( $hook ) {
		return false !== strpos( (string) $hook, self::SLUG );
	}

	/**
	 * CSS e fonte só nas telas do plugin.
	 *
	 * @param string $hook Hook da página atual.
	 */
	public static function assets( $hook ) {
		if ( ! self::is_ours( $hook ) ) {
			return;
		}
		wp_enqueue_style(
			'pip-font',
			'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
			array(),
			null // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		);
		wp_enqueue_style( 'pip-admin', PIP_URL . 'assets/admin.css', array(), PIP_VERSION );
		if ( 'popup-layout' === self::current_screen() ) {
			PIP_Popup_Layout::assets();
		}
		if ( 'copys' === self::current_screen() ) {
			PIP_Flow::assets(); // teste no aparelho (PIP_FLOW + pip-flow-admin.js)
			PIP_Copies::assets();
		}
		if ( 'broadcasts' === self::current_screen() ) {
			PIP_Broadcasts::assets();
		}
		if ( 'automation' === self::current_screen() ) {
			PIP_Flow::assets();
		}
		if ( 'settings' === self::current_screen() ) {
			PIP_Settings::assets();
		}
	}

	/**
	 * Link "Abrir painel" na lista de plugins.
	 *
	 * @param string[] $links Links existentes.
	 * @return string[]
	 */
	public static function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">Abrir painel</a>' );
		return $links;
	}

	/**
	 * Ícone do menu (sino com um "play" dentro), em base64 para o WordPress colorir sozinho.
	 *
	 * @return string
	 */
	private static function menu_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#a7aaad" fill-rule="evenodd" d="M12 2.2c.6 0 1.1.5 1.1 1.1v.9a6.6 6.6 0 0 1 5.5 6.5v3.6l1.6 2.4a1.1 1.1 0 0 1-.9 1.7H4.7a1.1 1.1 0 0 1-.9-1.7l1.6-2.4v-3.6a6.6 6.6 0 0 1 5.5-6.5v-.9c0-.6.5-1.1 1.1-1.1Zm-1.6 6.1a.6.6 0 0 0-.9.5v5.4c0 .5.5.8.9.5l4.3-2.7a.6.6 0 0 0 0-1l-4.3-2.7ZM9.3 19.8h5.4a2.7 2.7 0 0 1-5.4 0Z"/></svg>';
		return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * Ícones das telas (traços estilo Tabler, 24×24, stroke 1.8).
	 *
	 * @param string $name Nome do ícone.
	 * @param int    $size Tamanho em px.
	 * @return string SVG.
	 */
	public static function icon( $name, $size = 22 ) {
		$paths = array(
			'edit'        => '<path d="M4 20h4l10.5-10.5a2.828 2.828 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>',
			'send'        => '<path d="M10 14l11-11"/><path d="M21 3l-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1L21 3"/>',
			'power'       => '<path d="M7 6a7.75 7.75 0 1 0 10 0"/><path d="M12 4v8"/>',
			'trash'       => '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
			'clock'       => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
			'upload'      => '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/>',
			'download'    => '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 11l5 5 5-5"/><path d="M12 4v12"/>',
			'search'      => '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>',
			'check'       => '<path d="M5 12l5 5L20 7"/>',
			'rotate'      => '<path d="M4.05 11a8 8 0 1 1 .5 4"/><path d="M4 20v-5h5"/>',
			'tag'         => '<path d="M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"/><path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592-5.592a2.41 2.41 0 0 0 0-3.408l-7.71-7.71A2 2 0 0 0 11.172 3H6a3 3 0 0 0-3 3z"/>',
			'plus'        => '<path d="M12 5v14"/><path d="M5 12h14"/>',
			'device'      => '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/>',
			'calendar'    => '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/>',
			'sheet'       => '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M10 4v16"/>',
			'copy'        => '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
			'speakerphone' => '<path d="M18 8a3 3 0 0 1 0 6"/><path d="M10 8v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5"/><path d="M12 8h0l4.524-3.77A.9.9 0 0 1 18 4.92v12.16a.9.9 0 0 1-1.476.69L12 14H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h8"/>',
			'layout'      => '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 15h16"/><path d="M9 15v5"/>',
			'bolt'        => '<path d="M13 3l-7 10h5l-1 8 7-10h-5l1-8z"/>',
			'sliders'     => '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
			'users'       => '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>',
			'bell'        => '<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
			'sparkles'    => '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zm0-12a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zM9 18a6 6 0 0 1 6-6a6 6 0 0 1-6-6a6 6 0 0 1-6 6a6 6 0 0 1 6 6z"/>',
		);
		$d = isset( $paths[ $name ] ) ? $paths[ $name ] : $paths['bell'];
		return '<svg xmlns="http://www.w3.org/2000/svg" width="' . (int) $size . '" height="' . (int) $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $d . '</svg>';
	}

	/**
	 * Card da licença (só na edição do Pub Mail): ativa até…, ou pausada com o motivo.
	 */
	private static function license_card() {
		if ( ! PIP_License::managed() ) {
			return;
		}
		$msg = isset( $_GET['pip_lic'] ) ? sanitize_key( wp_unslash( $_GET['pip_lic'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( 'on' === $msg ) {
			echo '<div class="pip-notice">Licença verificada: ativa.</div>';
		} elseif ( 'off' === $msg ) {
			echo '<div class="pip-notice is-warn">' . esc_html( 'Licença verificada, mas o plugin continua pausado: ' . PIP_License::reason() . '.' ) . '</div>';
		} elseif ( 'err' === $msg ) {
			echo '<div class="pip-notice is-error">Não foi possível falar com o Pub Mail agora. Tente de novo em instantes.</div>';
		}
		$active = PIP_License::active();
		$until  = PIP_License::until_label();
		?>
		<div class="pip-license<?php echo $active ? ' is-on' : ' is-off'; ?>">
			<span class="pip-license__pill"><i></i> <?php echo $active ? ( $until ? 'Licença ativa até ' . esc_html( $until ) : 'Licença ativa' ) : 'Plugin pausado'; ?></span>
			<span class="pip-license__text">
				<?php if ( $active ) : ?>
					Vinculado à sua conta do Pub Mail. Atualiza sozinho quando sai versão nova. <?php echo esc_html( PIP_Sync::label() ); ?>
				<?php else : ?>
					<?php echo esc_html( ucfirst( PIP_License::reason() ) ); ?>. O popup não aparece e nenhuma notificação é enviada até resolver.
				<?php endif; ?>
			</span>
			<span class="pip-license__actions">
				<?php if ( ! $active && PIP_License::panel_url() ) : ?>
					<a class="pip-button is-primary" href="<?php echo esc_url( PIP_License::panel_url() ); ?>" target="_blank" rel="noopener">Abrir o Pub Mail</a>
				<?php endif; ?>
				<a class="pip-button is-ghost" href="<?php echo esc_url( PIP_License::check_url() ); ?>">Verificar agora</a>
			</span>
		</div>
		<?php
	}

	/**
	 * Renderiza a tela atual.
	 */
	public static function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$key = self::current_screen();
		$s   = self::SCREENS[ $key ];
		?>
		<div class="wrap pip-wrap">
			<header class="pip-header">
				<div class="pip-brand">
					<span class="pip-brand__mark" aria-hidden="true"><?php echo self::icon( 'bell', 22 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
					<div class="pip-brand__text">
						<span class="pip-brand__kicker">Push In Play</span>
						<h1 class="pip-brand__title"><?php echo esc_html( $s['title'] ); ?></h1>
					</div>
				</div>
				<span class="pip-version" title="Versão do plugin">v<?php echo esc_html( PIP_VERSION ); ?></span>
			</header>
			<p class="pip-lead"><?php echo esc_html( $s['desc'] ); ?></p>

			<?php self::license_card(); ?>

			<nav class="pip-tabs" aria-label="Telas do Push In Play">
				<?php foreach ( self::SCREENS as $k => $t ) : ?>
					<a class="pip-tab<?php echo $k === $key ? ' is-active' : ''; ?>" href="<?php echo esc_url( admin_url( 'admin.php?page=' . self::screen_slug( $k ) ) ); ?>">
						<?php echo self::icon( $t['icon'], 17 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						<span><?php echo esc_html( $t['title'] ); ?></span>
					</a>
				<?php endforeach; ?>
			</nav>

			<?php if ( 'popup-layout' === $key ) : ?>
				<?php PIP_Popup_Layout::render(); ?>
			<?php elseif ( 'copys' === $key ) : ?>
				<?php PIP_Copies::render(); ?>
			<?php elseif ( 'broadcasts' === $key ) : ?>
				<?php PIP_Broadcasts::render(); ?>
			<?php elseif ( 'automation' === $key ) : ?>
				<?php PIP_Flow::render(); ?>
			<?php elseif ( 'settings' === $key ) : ?>
				<?php PIP_Settings::render(); ?>
			<?php else : ?>
			<section class="pip-card pip-empty">
				<span class="pip-empty__icon" aria-hidden="true"><?php echo self::icon( $s['icon'], 30 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
				<h2 class="pip-empty__title"><?php echo esc_html( $s['title'] ); ?> em construção</h2>
				<p class="pip-empty__text"><?php echo esc_html( $s['empty'] ); ?></p>
				<span class="pip-chip"><?php echo self::icon( 'sparkles', 14 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> Em breve</span>
			</section>
			<?php endif; ?>
		</div>
		<?php
	}
}
