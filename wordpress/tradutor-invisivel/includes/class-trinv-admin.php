<?php
/**
 * Painel do plugin (menu "Tradutor Invisível" na barra lateral do WordPress):
 * - Tradução de URL: a única decisão que o dono precisa tomar (desligada por padrão).
 * - Ajustes: tudo opcional — o plugin funciona sem abrir esta tela.
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Administração.
 */
class TRINV_Admin {

	const SLUG          = 'tradutor-invisivel';         // menu + página "Tradução de URL".
	const SLUG_SETTINGS = 'tradutor-invisivel-ajustes'; // submenu "Ajustes" (opcionais).

	/**
	 * Ganchos.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'settings' ) );
		add_action( 'admin_post_trinv_urls', array( __CLASS__, 'action_urls' ) );
		add_action( 'admin_post_trinv_test', array( __CLASS__, 'action_test' ) );
		add_action( 'admin_post_trinv_clear', array( __CLASS__, 'action_clear' ) );
		add_action( 'admin_post_trinv_test_official', array( __CLASS__, 'action_test_official' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( TRINV_FILE ), array( __CLASS__, 'links' ) );
	}

	/**
	 * Endereço de uma tela do plugin no painel.
	 *
	 * @param bool  $settings true = Ajustes; false = Tradução de URL.
	 * @param array $args     Parâmetros extras (ex.: trinv_msg).
	 * @return string
	 */
	public static function url( $settings = false, $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => $settings ? self::SLUG_SETTINGS : self::SLUG ), $args ), admin_url( 'admin.php' ) );
	}

	/**
	 * Menu "Tradutor Invisível" na barra lateral: Tradução de URL (página principal) + Ajustes.
	 */
	public static function menu() {
		add_menu_page( 'Tradutor Invisível', 'Tradutor Invisível', 'manage_options', self::SLUG, array( __CLASS__, 'urls_page' ), 'dashicons-translation', '58.6' );
		add_submenu_page( self::SLUG, 'Tradução de URL — Tradutor Invisível', 'Tradução de URL', 'manage_options', self::SLUG, array( __CLASS__, 'urls_page' ) );
		add_submenu_page( self::SLUG, 'Ajustes — Tradutor Invisível', 'Ajustes', 'manage_options', self::SLUG_SETTINGS, array( __CLASS__, 'page' ) );
	}

	/**
	 * Links "Tradução de URL" e "Ajustes" na lista de plugins.
	 *
	 * @param array $links Links.
	 * @return array
	 */
	public static function links( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( self::url() ) . '">Tradução de URL</a>',
			'<a href="' . esc_url( self::url( true ) ) . '">Ajustes</a>'
		);
		return $links;
	}

	/**
	 * Registra a opção.
	 */
	public static function settings() {
		register_setting(
			'trinv',
			'trinv_options',
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
			)
		);
	}

	/**
	 * Limpa o que veio do formulário.
	 *
	 * @param mixed $in Valores.
	 * @return array
	 */
	public static function sanitize( $in ) {
		$in       = is_array( $in ) ? $in : array();
		$cur      = trinv_options();
		$provider = isset( $in['provider'] ) && in_array( $in['provider'], array( 'google', 'microsoft' ), true ) ? $in['provider'] : '';
		$key      = isset( $in['provider_key'] ) ? trim( sanitize_text_field( (string) $in['provider_key'] ) ) : '';
		if ( '' === $key && $provider === $cur['provider'] ) {
			$key = (string) $cur['provider_key']; // campo em branco = mantém a chave salva.
		}
		if ( $provider !== $cur['provider'] || $key !== (string) $cur['provider_key'] ) {
			delete_transient( 'trinv_official_health' ); // resultado do teste era da chave anterior.
			delete_transient( 'trinv_official_error' );
		}
		return array(
			'provider'        => $provider,
			'provider_key'    => '' === $provider ? '' : $key,
			'provider_region' => isset( $in['provider_region'] ) ? substr( preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $in['provider_region'] ) ), 0, 40 ) : '',
			'provider_mode'   => isset( $in['provider_mode'] ) && 'always' === $in['provider_mode'] ? 'always' : 'fallback',
			'enabled'   => empty( $in['enabled'] ) ? 0 : 1,
			'chrome'    => empty( $in['chrome'] ) ? 0 : 1,
			// a tradução de URL é decidida na página do menu (não está mais neste formulário): sem a chave, mantém.
			'urls'      => array_key_exists( 'urls', $in ) ? ( empty( $in['urls'] ) ? 0 : 1 ) : ( empty( $cur['urls'] ) ? 0 : 1 ),
			'skip'      => implode( ', ', TRINV_Frontend::excluded_langs( isset( $in['skip'] ) ? sanitize_text_field( (string) $in['skip'] ) : '' ) ),
			'campaign'  => implode( ', ', array_slice( TRINV_Frontend::excluded_langs( isset( $in['campaign'] ) ? sanitize_text_field( (string) $in['campaign'] ) : '' ), 0, 30 ) ),
			'selectors' => TRINV_Frontend::clean_selectors( isset( $in['selectors'] ) ? (string) $in['selectors'] : '' ),
			'maxwait'   => max( 800, min( 8000, isset( $in['maxwait'] ) ? (int) $in['maxwait'] : 3000 ) ),
		);
	}

	/**
	 * Testa a conexão com o tradutor.
	 */
	public static function action_test() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'trinv_test' );
		delete_transient( 'trinv_blocked' );
		set_transient( 'trinv_health', TRINV_Google::health(), 10 * MINUTE_IN_SECONDS );
		wp_safe_redirect( self::url( true, array( 'trinv_msg' => 'test' ) ) );
		exit;
	}

	/**
	 * Testa o tradutor oficial.
	 */
	public static function action_test_official() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'trinv_test_official' );
		delete_transient( 'trinv_official_error' );
		set_transient( 'trinv_official_health', TRINV_Official::health(), 10 * MINUTE_IN_SECONDS );
		wp_safe_redirect( self::url( true, array( 'trinv_msg' => 'official' ) ) . '#trinv-official' );
		exit;
	}

	/**
	 * Apaga as traduções guardadas.
	 */
	public static function action_clear() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'trinv_clear' );
		TRINV_Store::clear();
		wp_safe_redirect( self::url( true, array( 'trinv_msg' => 'cleared' ) ) );
		exit;
	}

	/**
	 * Tamanho legível.
	 *
	 * @param int $b Bytes.
	 * @return string
	 */
	private static function size( $b ) {
		if ( $b < 1048576 ) {
			return number_format_i18n( max( 0, $b ) / 1024, 0 ) . ' KB';
		}
		return number_format_i18n( $b / 1048576, 1 ) . ' MB';
	}

	/**
	 * Liga/desliga a tradução de URL (formulário da página do menu).
	 */
	public static function action_urls() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.' );
		}
		check_admin_referer( 'trinv_urls' );
		$on        = empty( $_POST['urls'] ) ? 0 : 1;
		$o         = trinv_options();
		$was       = empty( $o['urls'] ) ? 0 : 1;
		$o['urls'] = $on;
		update_option( 'trinv_options', $o );
		if ( $was !== $on ) {
			TRINV_Warm::purge_all(); // o HTML guardado por plugins de cache traz a configuração antiga do endereço.
		}
		wp_safe_redirect( self::url( false, array( 'trinv_msg' => $on ? 'urls_on' : 'urls_off' ) ) );
		exit;
	}

	/**
	 * Página do menu: Tradução de URL (uma decisão só, bem explicada).
	 */
	public static function urls_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$o      = trinv_options();
		$on     = ! empty( $o['urls'] );
		$pretty = '' !== (string) get_option( 'permalink_structure' );
		$lic    = TRINV_License::active();
		$live   = $on && $pretty && $lic && ! empty( $o['enabled'] );
		$msg    = isset( $_GET['trinv_msg'] ) ? sanitize_key( wp_unslash( $_GET['trinv_msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$count  = TRINV_Slugs::count();
		$recent = get_posts(
			array(
				'post_type'   => array( 'post', 'page' ),
				'post_status' => 'publish',
				'numberposts' => 1,
			)
		);
		$sample = $recent ? get_permalink( $recent[0] ) : home_url( '/' );
		?>
		<div class="wrap trinv trinv-urls">
			<style>
				.trinv-urls{max-width:900px}
				.trinv-urls h1{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
				.trinv-urls .trinv-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-weight:600;font-size:12px;vertical-align:middle}
				.trinv-urls .trinv-pill:before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
				.trinv-urls .ok{background:#e7f6ec;color:#1e7e34}.trinv-urls .off{background:#f0f0f1;color:#50575e}.trinv-urls .warn{background:#fcf3e5;color:#8a5a00}
				.trinv-hero{background:#fff;border:1px solid #dcdcde;border-radius:14px;padding:26px 30px 24px;margin-top:18px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
				.trinv-hero__top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
				.trinv-hero__icon{width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,#2271b1,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 6px 16px rgba(34,113,177,.25)}
				.trinv-hero__icon .dashicons{font-size:28px;width:28px;height:28px}
				.trinv-hero h2{margin:0;font-size:21px;line-height:1.25;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
				.trinv-hero__sub{color:#50575e;margin:4px 0 0;font-size:14px}
				.trinv-hero > p{color:#50575e;font-size:14px;line-height:1.6;max-width:760px}
				.trinv-example{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:20px 0 22px;padding:16px 18px;background:#f6f7f7;border-radius:12px}
				.trinv-example div{min-width:0}
				.trinv-example small{display:block;color:#646970;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
				.trinv-example code{display:inline-block;font-size:13px;background:#fff;border:1px solid #dcdcde;padding:6px 10px;border-radius:8px;max-width:100%;overflow:hidden;text-overflow:ellipsis}
				.trinv-example .trinv-arrow{color:#2271b1;font-size:24px;line-height:1;padding-top:16px}
				.trinv-switch-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 20px;border:1px solid #dcdcde;border-radius:12px;background:#fff;transition:background .2s,border-color .2s}
				.trinv-switch-row.is-on{border-color:#9fd3ad;background:#f3faf5}
				.trinv-switch{display:flex;align-items:center;gap:14px;cursor:pointer;font-size:15px;font-weight:600;color:#1d2327;margin:0}
				.trinv-switch input{position:absolute;opacity:0;width:0;height:0}
				.trinv-switch i{position:relative;width:48px;height:27px;border-radius:999px;background:#c3c4c7;transition:background .2s;flex:none}
				.trinv-switch i:after{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s}
				.trinv-switch input:checked+i{background:#1e7e34}
				.trinv-switch input:checked+i:after{left:24px}
				.trinv-switch input:focus-visible+i{outline:2px solid #2271b1;outline-offset:2px}
				.trinv-switch-row .trinv-state{display:flex;align-items:center;gap:10px}
				.trinv-urls .submit{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 0 0;padding:0}
				.trinv-urls .trinv-unsaved{color:#8a5a00;font-size:13px;display:none}
				.trinv-urls.is-dirty .trinv-unsaved{display:inline}
				.trinv-notes{margin:22px 0 0;padding:0;list-style:none;display:grid;gap:10px}
				.trinv-notes li{display:flex;gap:10px;color:#50575e;line-height:1.55;font-size:13px}
				.trinv-notes .dashicons{color:#2271b1;flex:none;margin-top:1px}
				.trinv-warnbox{display:flex;gap:10px;align-items:flex-start;margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#fcf3e5;color:#6b4500;border:1px solid #f0d9ad;font-size:13px;line-height:1.5}
				.trinv-warnbox .dashicons{flex:none;color:#b26b00}
				.trinv-warnbox a{color:inherit;font-weight:600}
				.trinv-foot{margin-top:16px;color:#646970;font-size:13px}
				@media (max-width:600px){.trinv-hero{padding:20px 18px}.trinv-example .trinv-arrow{display:none}}
			</style>
			<h1>Tradutor Invisível
				<?php if ( ! $lic ) : ?>
					<span class="trinv-pill warn">Pausado · licença</span>
				<?php elseif ( ! empty( $o['enabled'] ) ) : ?>
					<span class="trinv-pill ok">Ativo</span>
				<?php else : ?>
					<span class="trinv-pill off">Pausado</span>
				<?php endif; ?>
			</h1>

			<?php if ( 'urls_on' === $msg ) : ?>
				<div class="notice notice-success is-dismissible"><p><strong>Tradução de URL ligada.</strong> A partir de agora, depois de traduzir a página, o endereço na barra do navegador aparece no idioma do visitante.</p></div>
			<?php elseif ( 'urls_off' === $msg ) : ?>
				<div class="notice notice-info is-dismissible"><p><strong>Tradução de URL desligada.</strong> O endereço fica sempre o original. Endereços traduzidos já compartilhados continuam abrindo a página normalmente.</p></div>
			<?php endif; ?>

			<div class="trinv-hero">
				<div class="trinv-hero__top">
					<div class="trinv-hero__icon"><span class="dashicons dashicons-admin-links"></span></div>
					<div>
						<h2>Tradução de URL
							<?php if ( $live ) : ?>
								<span class="trinv-pill ok">Ligada</span>
							<?php elseif ( $on ) : ?>
								<span class="trinv-pill warn">Ligada · aguardando</span>
							<?php else : ?>
								<span class="trinv-pill off">Desligada</span>
							<?php endif; ?>
						</h2>
						<p class="trinv-hero__sub">Mostra o endereço dos posts e páginas no idioma de cada visitante.</p>
					</div>
				</div>

				<p>O conteúdo da página já é traduzido para o idioma do navegador de quem visita. Com esta opção ligada, o <strong>endereço</strong> também: depois que a página aparece traduzida, a barra do navegador passa a mostrar um endereço no idioma do visitante. Esse endereço abre a mesma página quando é compartilhado, e o endereço original continua sendo o canônico para o Google.</p>

				<div class="trinv-example" aria-hidden="true">
					<div><small>Endereço original</small><code>/grow-tomatoes/</code></div>
					<span class="trinv-arrow">&rarr;</span>
					<div><small>Visitante em português</small><code>/cultivando-tomates-em-casa/</code></div>
					<span class="trinv-arrow">&rarr;</span>
					<div><small>Visitante em espanhol</small><code>/cultivando-tomates-en-casa/</code></div>
				</div>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="trinv-urls-form">
					<input type="hidden" name="action" value="trinv_urls">
					<?php wp_nonce_field( 'trinv_urls' ); ?>
					<div class="trinv-switch-row <?php echo $on ? 'is-on' : ''; ?>" id="trinv-urls-row">
						<label class="trinv-switch" for="trinv-urls">
							<input type="checkbox" id="trinv-urls" name="urls" value="1" <?php checked( $on ); ?>>
							<i aria-hidden="true"></i>
							<span>Habilitar tradução de URL</span>
						</label>
						<span class="trinv-state"><span class="trinv-pill <?php echo $on ? 'ok' : 'off'; ?>" id="trinv-urls-state"><?php echo $on ? 'Ligada' : 'Desligada'; ?></span></span>
					</div>
					<p class="submit">
						<button type="submit" class="button button-primary button-large">Salvar</button>
						<span class="trinv-unsaved">Alteração ainda não salva.</span>
					</p>
				</form>

				<?php if ( ! $pretty ) : ?>
					<div class="trinv-warnbox"><span class="dashicons dashicons-warning"></span><span>Os links permanentes deste site estão no modelo <strong>Simples</strong> (<code>?p=123</code>), que não tem palavras para traduzir. Escolha outro modelo em <a href="<?php echo esc_url( admin_url( 'options-permalink.php' ) ); ?>">Configurações → Links permanentes</a> (por exemplo "Nome do post") para a tradução de URL funcionar.</span></div>
				<?php endif; ?>
				<?php if ( ! $lic ) : ?>
					<div class="trinv-warnbox"><span class="dashicons dashicons-warning"></span><span><?php echo esc_html( 'O tradutor está pausado: ' . TRINV_License::reason() . '.' ); ?> <?php if ( TRINV_License::panel_url() ) : ?><a href="<?php echo esc_url( TRINV_License::panel_url() ); ?>" target="_blank" rel="noopener">Abrir o Pub Mail</a><?php endif; ?></span></div>
				<?php elseif ( empty( $o['enabled'] ) ) : ?>
					<div class="trinv-warnbox"><span class="dashicons dashicons-warning"></span><span>A tradução está pausada em <a href="<?php echo esc_url( self::url( true ) ); ?>">Ajustes</a>. A tradução de URL só acontece com o tradutor ativo.</span></div>
				<?php endif; ?>

				<ul class="trinv-notes">
					<li><span class="dashicons dashicons-yes-alt"></span><span>Cada endereço é criado <strong>uma vez por página e idioma</strong>, a partir do título traduzido, e fica guardado no site.<?php echo $count ? ' ' . esc_html( sprintf( 1 === $count ? 'Já existe %s endereço traduzido criado.' : 'Já existem %s endereços traduzidos criados.', number_format_i18n( $count ) ) ) : ''; ?></span></li>
					<li><span class="dashicons dashicons-yes-alt"></span><span>Quem lê no idioma original do conteúdo continua vendo o endereço original. O <code>&lt;link rel="canonical"&gt;</code> nunca muda.</span></li>
					<li><span class="dashicons dashicons-yes-alt"></span><span>Carrinho, finalização de compra e páginas de pedido da loja mantêm o endereço original (os meios de pagamento leem esse endereço).</span></li>
					<li><span class="dashicons dashicons-yes-alt"></span><span>Ao desligar, nada quebra: os endereços traduzidos já compartilhados continuam abrindo a página, só a barra do navegador volta a mostrar o original.</span></li>
				</ul>
			</div>

			<p class="trinv-foot">Para conferir como um visitante vê: <a target="_blank" rel="noopener" href="<?php echo esc_url( add_query_arg( 'trinv_lang', 'en', $sample ) ); ?>">ver em inglês</a> · <a target="_blank" rel="noopener" href="<?php echo esc_url( add_query_arg( 'trinv_lang', 'es', $sample ) ); ?>">ver em espanhol</a>. Idiomas da campanha, tradutor oficial e outros ajustes opcionais ficam em <a href="<?php echo esc_url( self::url( true ) ); ?>">Ajustes</a>.</p>
			<script>
				(function () {
					var cb = document.getElementById('trinv-urls'), row = document.getElementById('trinv-urls-row'), st = document.getElementById('trinv-urls-state'), wrap = document.querySelector('.trinv-urls');
					if (!cb || !row || !st || !wrap) return;
					var saved = cb.checked;
					cb.addEventListener('change', function () {
						row.className = 'trinv-switch-row' + (cb.checked ? ' is-on' : '');
						st.className = 'trinv-pill ' + (cb.checked ? 'ok' : 'off');
						st.textContent = cb.checked ? 'Ligada' : 'Desligada';
						wrap.className = wrap.className.replace(' is-dirty', '') + (cb.checked !== saved ? ' is-dirty' : '');
					});
				})();
			</script>
		</div>
		<?php
	}

	/**
	 * Tela de ajustes (opcionais).
	 */
	public static function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$o      = trinv_options();
		$stats  = TRINV_Store::stats();
		$health  = get_transient( 'trinv_health' );
		$ohealth = get_transient( 'trinv_official_health' );
		$block  = TRINV_Google::blocked();
		$msg    = isset( $_GET['trinv_msg'] ) ? sanitize_key( wp_unslash( $_GET['trinv_msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$recent = get_posts(
			array(
				'post_type'   => array( 'post', 'page' ),
				'post_status' => 'publish',
				'numberposts' => 1,
			)
		);
		$sample = $recent ? get_permalink( $recent[0] ) : home_url( '/' );
		?>
		<div class="wrap trinv">
			<style>
				.trinv .trinv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;max-width:1100px;margin-top:16px}
				.trinv .trinv-card{background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:18px 20px}
				.trinv .trinv-card h2{margin:0 0 6px;font-size:15px}
				.trinv .trinv-card p{color:#50575e;margin:6px 0}
				.trinv .trinv-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-weight:600;font-size:12px;vertical-align:middle;margin-left:8px}
				.trinv .trinv-pill:before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
				.trinv .ok{background:#e7f6ec;color:#1e7e34}.trinv .off{background:#f0f0f1;color:#50575e}.trinv .warn{background:#fcf3e5;color:#8a5a00}
				.trinv .trinv-num{font-size:26px;font-weight:700;line-height:1.1}
				.trinv .trinv-stats{display:flex;gap:28px;margin:10px 0}
				.trinv code{font-size:12px}
				.trinv .form-table th{width:210px}
				.trinv .trinv-prov-fields{margin-top:10px;display:grid;gap:8px;max-width:520px}
				.trinv .trinv-prov-fields input[type=password],.trinv .trinv-prov-fields input[type=text]{width:100%;max-width:520px}
				.trinv #trinv-official:has(#trinv-prov option[value=""]:checked) .trinv-prov-fields{display:none}
				.trinv #trinv-official:not(:has(#trinv-prov option[value="microsoft"]:checked)) .trinv-ms-only{display:none}
				.trinv .trinv-prov-fields p{margin:0}
				.trinv .trinv-warm-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
				.trinv .trinv-warm-row .trinv-pill{margin-left:0}
			</style>
			<h1>Tradutor Invisível
				<?php if ( ! TRINV_License::active() ) : ?>
					<span class="trinv-pill warn">Pausado · licença</span>
				<?php elseif ( ! empty( $o['enabled'] ) ) : ?>
					<span class="trinv-pill ok">Ativo</span>
				<?php else : ?>
					<span class="trinv-pill off">Pausado</span>
				<?php endif; ?>
			</h1>
			<p style="max-width:760px;color:#50575e">Cada visitante lê seus posts e páginas no idioma do próprio navegador, automaticamente e sem nenhum botão ou aviso. O idioma de origem é descoberto pelo <strong>conteúdo</strong> de cada página, não pela configuração do WordPress. Não precisa configurar nada.</p>

			<?php if ( 'lic_on' === $msg ) : ?>
				<div class="notice notice-success is-dismissible"><p>Licença ativa. O tradutor está funcionando.</p></div>
			<?php elseif ( 'lic_off' === $msg ) : ?>
				<div class="notice notice-warning is-dismissible"><p><?php echo esc_html( 'Licença verificada, mas o tradutor continua pausado: ' . TRINV_License::reason() . '.' ); ?></p></div>
			<?php elseif ( 'lic_err' === $msg ) : ?>
				<div class="notice notice-warning is-dismissible"><p>Não foi possível falar com o Pub Mail agora. Tente de novo em instantes.</p></div>
			<?php endif; ?>

			<?php if ( TRINV_License::managed() ) : ?>
				<?php
				$trinv_ls    = TRINV_License::state();
				$trinv_until = (int) ( $trinv_ls['until'] ?? 0 );
				$trinv_ok    = (int) ( $trinv_ls['ok'] ?? 0 );
				?>
				<div class="trinv-card" style="max-width:1066px;margin-top:16px">
					<h2>Licença do Pub Mail
						<?php if ( TRINV_License::active() ) : ?>
							<span class="trinv-pill ok">Ativa</span>
						<?php else : ?>
							<span class="trinv-pill warn">Pausada</span>
						<?php endif; ?>
					</h2>
					<?php if ( TRINV_License::active() ) : ?>
						<p><?php echo $trinv_until ? esc_html( 'Vinculada à sua conta do Pub Mail. Válida até ' . wp_date( 'd/m/Y \à\s H:i', $trinv_until ) . ' — ao renovar no Pub Mail, continua sozinha.' ) : 'Vinculada à sua conta do Pub Mail, sem data de fim.'; ?></p>
					<?php else : ?>
						<p><?php echo esc_html( 'O tradutor está pausado: ' . TRINV_License::reason() . '. Os visitantes veem o site no idioma original. Depois de resolver no Pub Mail, ele volta sozinho em até 5 minutos.' ); ?></p>
					<?php endif; ?>
					<p style="color:#646970"><?php echo $trinv_ok ? esc_html( 'Última confirmação: ' . human_time_diff( $trinv_ok ) . ' atrás.' ) : 'Ainda não confirmada.'; ?></p>
					<p style="display:flex;gap:8px;flex-wrap:wrap">
						<a class="button" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=trinv_license_check' ), 'trinv_license_check' ) ); ?>">Verificar agora</a>
						<?php if ( TRINV_License::panel_url() ) : ?>
							<a class="button" href="<?php echo esc_url( TRINV_License::panel_url() ); ?>" target="_blank" rel="noopener">Abrir o Pub Mail</a>
						<?php endif; ?>
					</p>
				</div>
			<?php endif; ?>

			<?php if ( 'cleared' === $msg ) : ?>
				<div class="notice notice-success is-dismissible"><p>Traduções guardadas apagadas. Elas serão refeitas conforme os visitantes chegarem.</p></div>
			<?php elseif ( 'official' === $msg && is_array( $ohealth ) ) : ?>
				<div class="notice <?php echo $ohealth['ok'] ? 'notice-success' : 'notice-error'; ?> is-dismissible"><p><?php echo $ohealth['ok'] ? esc_html( 'Tradutor oficial respondendo (' . (int) $ohealth['ms'] . ' ms).' ) : esc_html( 'O tradutor oficial não respondeu: ' . ( '' !== $ohealth['error'] ? $ohealth['error'] : 'confira a chave.' ) ); ?></p></div>
			<?php elseif ( 'test' === $msg && is_array( $health ) ) : ?>
				<div class="notice <?php echo $health['ok'] ? 'notice-success' : 'notice-warning'; ?> is-dismissible"><p><?php echo $health['ok'] ? 'Tradutor respondendo.' : 'O servidor não conseguiu falar com o tradutor agora. Os visitantes continuam recebendo a tradução pelo próprio navegador.'; ?></p></div>
			<?php endif; ?>

			<div class="trinv-grid">
				<div class="trinv-card">
					<h2>Como conferir</h2>
					<p>Abra qualquer página com <code>?trinv_lang=en</code> no fim do endereço (ou <code>es</code>, <code>fr</code>, <code>ja</code>…) para ver como um visitante daquele idioma vê.</p>
					<p><a class="button" target="_blank" rel="noopener" href="<?php echo esc_url( add_query_arg( 'trinv_lang', 'en', $sample ) ); ?>">Ver em inglês</a>
						<a class="button" target="_blank" rel="noopener" href="<?php echo esc_url( add_query_arg( 'trinv_lang', 'es', $sample ) ); ?>">Ver em espanhol</a>
						<a class="button" target="_blank" rel="noopener" href="<?php echo esc_url( add_query_arg( 'trinv', 'on', $sample ) ); ?>">Voltar ao normal</a></p>
					<p>Para ver o original: <code>?notranslate</code>. Para nunca traduzir um trecho, use a classe <code>notranslate</code>.</p>
				</div>

				<div class="trinv-card">
					<h2>Conexão com o tradutor
						<?php if ( $block ) : ?>
							<span class="trinv-pill warn">Pelo navegador</span>
						<?php elseif ( is_array( $health ) && $health['ok'] ) : ?>
							<span class="trinv-pill ok">OK · <?php echo (int) $health['ms']; ?> ms</span>
						<?php endif; ?>
					</h2>
					<?php if ( $block ) : ?>
						<p>O servidor do site foi limitado pelo tradutor por alguns minutos. Enquanto isso, cada visitante traduz pelo próprio navegador — continua funcionando, só sem o cache compartilhado.</p>
					<?php else : ?>
						<p>Grátis e sem chave. O servidor traduz e guarda; se ele for limitado, o navegador do visitante assume sozinho.</p>
					<?php endif; ?>
					<?php if ( '' !== TRINV_Official::provider() ) : ?>
						<p>Tradutor oficial: <strong><?php echo 'google' === TRINV_Official::provider() ? 'Google Cloud' : 'Microsoft'; ?></strong> · <?php echo TRINV_Official::always() ? 'usado sempre' : 'reserva'; ?>
							<?php if ( is_array( $ohealth ) ) : ?>
								<span class="trinv-pill <?php echo $ohealth['ok'] ? 'ok' : 'warn'; ?>"><?php echo $ohealth['ok'] ? esc_html( 'OK · ' . (int) $ohealth['ms'] . ' ms' ) : 'Com erro'; ?></span>
							<?php endif; ?>
						</p>
					<?php endif; ?>
					<?php if ( is_array( $health ) && $health['ok'] ) : ?>
						<p>Teste: <em><?php echo esc_html( wp_strip_all_tags( $health['sample'] ) ); ?></em></p>
					<?php endif; ?>
					<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
							<input type="hidden" name="action" value="trinv_test">
							<?php wp_nonce_field( 'trinv_test' ); ?>
							<button class="button">Testar agora</button>
						</form>
						<?php if ( '' !== TRINV_Official::provider() ) : ?>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
								<input type="hidden" name="action" value="trinv_test_official">
								<?php wp_nonce_field( 'trinv_test_official' ); ?>
								<button class="button">Testar tradutor oficial</button>
							</form>
						<?php endif; ?>
					</div>
				</div>

				<div class="trinv-card">
					<h2>Traduções guardadas</h2>
					<div class="trinv-stats">
						<div><div class="trinv-num"><?php echo esc_html( number_format_i18n( $stats['pages'] ) ); ?></div>páginas × idiomas</div>
						<div><div class="trinv-num"><?php echo esc_html( number_format_i18n( $stats['segments'] ) ); ?></div>trechos</div>
						<div><div class="trinv-num"><?php echo esc_html( self::size( $stats['bytes'] ) ); ?></div>no banco</div>
					</div>
					<?php if ( $stats['langs'] ) : ?>
						<p>Idiomas dos visitantes:
							<?php
							$parts = array();
							foreach ( $stats['langs'] as $row ) {
								$parts[] = '<code>' . esc_html( $row['l'] ) . '</code> ' . (int) $row['n'];
							}
							echo wp_kses( implode( ' · ', $parts ), array( 'code' => array() ) );
							?>
						</p>
					<?php endif; ?>
					<p>Uma página é traduzida uma única vez por idioma; depois vem do cache, na hora.</p>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('Apagar todas as traduções guardadas? Elas serão refeitas conforme os visitantes chegarem.');">
						<input type="hidden" name="action" value="trinv_clear">
						<?php wp_nonce_field( 'trinv_clear' ); ?>
						<button class="button">Apagar traduções guardadas</button>
					</form>
				</div>
			</div>

			<form method="post" action="options.php" class="trinv-card" style="max-width:1066px;margin-top:16px">
				<?php settings_fields( 'trinv' ); ?>
				<h2>Ajustes (opcionais)</h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">Tradução</th>
						<td><label><input type="checkbox" name="trinv_options[enabled]" value="1" <?php checked( ! empty( $o['enabled'] ) ); ?>> Traduzir para o idioma de cada visitante</label></td>
					</tr>
					<tr id="trinv-campaign">
						<th scope="row"><label for="trinv-camp">Idiomas da campanha</label></th>
						<td><input id="trinv-camp" type="text" class="regular-text" name="trinv_options[campaign]" value="<?php echo esc_attr( $o['campaign'] ); ?>" placeholder="ex.: en, es, fr, de, it">
							<p class="description">Cada post ou página publicado (ou atualizado) é pré-traduzido nesses idiomas: o primeiro visitante de cada país já recebe a página pronta. Vazio = traduz na primeira visita.<br>
								Códigos: <code>en</code> inglês · <code>es</code> espanhol · <code>fr</code> francês · <code>de</code> alemão · <code>it</code> italiano · <code>pt</code> português · <code>ja</code> japonês · <code>ar</code> árabe.</p>
							<?php if ( TRINV_Warm::enabled() ) : ?>
								<p class="trinv-warm-row">
									<button class="button" form="trinv-warm-form">Pré-traduzir as <?php echo (int) TRINV_Warm::RECENT; ?> mais recentes</button>
									<?php $trinv_q = count( TRINV_Warm::queue() ); ?>
									<span class="trinv-pill <?php echo $trinv_q ? 'warn' : 'ok'; ?>"><?php echo $trinv_q ? esc_html( sprintf( '%d na fila', $trinv_q ) ) : 'Fila vazia'; ?></span>
								</p>
								<p class="description">A pré-tradução roda pelo seu navegador enquanto o painel está aberto (um aviso aparece no canto da tela). Pixels e anúncios não são carregados nela.</p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row">Textos do tema</th>
						<td><label><input type="checkbox" name="trinv_options[chrome]" value="1" <?php checked( ! empty( $o['chrome'] ) ); ?>> Traduzir menus e textos do tema mesmo quando o conteúdo já está no idioma do visitante</label>
							<p class="description">Útil quando o WordPress está em um idioma e os posts em outro.</p></td>
					</tr>
					<tr>
						<th scope="row">Tradução de URL</th>
						<td><span class="trinv-pill <?php echo ! empty( $o['urls'] ) ? 'ok' : 'off'; ?>" style="margin-left:0"><?php echo ! empty( $o['urls'] ) ? 'Ligada' : 'Desligada'; ?></span>
							<p class="description">Mostrar o endereço dos posts e páginas no idioma do visitante (<code>/grow-tomatoes/</code> → <code>/cultivando-tomates-em-casa/</code>). Liga e desliga em <a href="<?php echo esc_url( self::url() ); ?>">Tradutor Invisível → Tradução de URL</a>.</p></td>
					</tr>
					<tr>
						<th scope="row"><label for="trinv-ex">Não traduzir para</label></th>
						<td><input id="trinv-ex" type="text" class="regular-text" name="trinv_options[skip]" value="<?php echo esc_attr( $o['skip'] ); ?>" placeholder="ex.: en, es">
							<p class="description">Visitantes desses idiomas veem o original.</p></td>
					</tr>
					<tr>
						<th scope="row"><label for="trinv-sel">Nunca traduzir</label></th>
						<td><input id="trinv-sel" type="text" class="regular-text" name="trinv_options[selectors]" value="<?php echo esc_attr( $o['selectors'] ); ?>" placeholder="ex.: .marca, #rodape-legal">
							<p class="description">Seletores CSS de trechos que devem ficar no original (além da classe <code>notranslate</code>).</p></td>
					</tr>
					<tr>
						<th scope="row"><label for="trinv-mw">Espera máxima</label></th>
						<td><input id="trinv-mw" type="number" min="800" max="8000" step="100" name="trinv_options[maxwait]" value="<?php echo (int) $o['maxwait']; ?>"> ms
							<p class="description">Tempo máximo com a página escondida esperando a primeira tradução. Depois disso ela aparece de qualquer jeito.</p></td>
					</tr>
					<tr id="trinv-official">
						<th scope="row"><label for="trinv-prov">Tradutor oficial (opcional)</label></th>
						<td>
							<select id="trinv-prov" name="trinv_options[provider]">
								<option value="" <?php selected( $o['provider'], '' ); ?>>Nenhum (só o gratuito)</option>
								<option value="google" <?php selected( $o['provider'], 'google' ); ?>>Google Cloud Translation</option>
								<option value="microsoft" <?php selected( $o['provider'], 'microsoft' ); ?>>Microsoft Translator</option>
							</select>
							<div class="trinv-prov-fields">
								<p><input type="password" id="trinv-key" name="trinv_options[provider_key]" value="" autocomplete="new-password" aria-label="Chave de API" placeholder="<?php echo '' !== $o['provider_key'] ? esc_attr( 'Chave salva (…' . substr( $o['provider_key'], -4 ) . ') — deixe em branco para manter' ) : 'Chave de API'; ?>"></p>
								<p class="trinv-ms-only"><input type="text" id="trinv-region" name="trinv_options[provider_region]" value="<?php echo esc_attr( $o['provider_region'] ); ?>" aria-label="Região do recurso" placeholder="Região do recurso (ex.: brazilsouth) — vazio se for global"></p>
								<p><label><input type="radio" name="trinv_options[provider_mode]" value="fallback" <?php checked( 'always' !== $o['provider_mode'] ); ?>> Usar só quando o gratuito falhar</label>
									&nbsp; <label><input type="radio" name="trinv_options[provider_mode]" value="always" <?php checked( 'always' === $o['provider_mode'] ); ?>> Usar sempre</label></p>
							</div>
							<p class="description">Garante a tradução mesmo se o tradutor gratuito ficar indisponível. Tem custo no provedor (cota grátis mensal). A chave fica só no servidor.</p>
						</td>
					</tr>
				</table>
				<?php submit_button( 'Salvar ajustes' ); ?>
			</form>
			<form id="trinv-warm-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" hidden>
				<input type="hidden" name="action" value="trinv_warm_now">
				<?php wp_nonce_field( 'trinv_warm_now' ); ?>
			</form>
		</div>
		<?php
	}
}
