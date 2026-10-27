<?php
/**
 * Plugin Name:       Push In Play
 * Description:       Notificações push para o seu site WordPress: copys, broadcasts e layout do popup de permissão, num painel próprio.
 * Version:           0.10.3
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Júlio Cezar Reis
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       push-in-play
 * Update URI:        false
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

define( 'PIP_VERSION', '0.10.3' );
define( 'PIP_EDITION', 'standalone' ); // o pacote baixado pelo Pub Mail vem como 'pubmail'.
define( 'PIP_FILE', __FILE__ );
define( 'PIP_DIR', plugin_dir_path( __FILE__ ) );
define( 'PIP_URL', plugin_dir_url( __FILE__ ) );

if ( is_readable( PIP_DIR . 'license.php' ) ) {
	require_once PIP_DIR . 'license.php'; // dados da conta do Pub Mail (só na edição do Pub Mail).
}
require_once PIP_DIR . 'includes/class-pip-license.php';
require_once PIP_DIR . 'includes/class-pip-sync.php';
require_once PIP_DIR . 'includes/class-pip-store.php';
require_once PIP_DIR . 'includes/class-pip-vapid.php';
require_once PIP_DIR . 'includes/class-pip-push.php';
require_once PIP_DIR . 'includes/class-pip-settings.php';
require_once PIP_DIR . 'includes/class-pip-flow.php';
require_once PIP_DIR . 'includes/class-pip-copies.php';
require_once PIP_DIR . 'includes/class-pip-broadcasts.php';
require_once PIP_DIR . 'includes/class-pip-rest.php';
require_once PIP_DIR . 'includes/class-pip-frontend.php';
require_once PIP_DIR . 'includes/class-pip-popup-layout.php';
require_once PIP_DIR . 'includes/class-pip-admin.php';

register_activation_hook( __FILE__, 'pip_activate' );
register_deactivation_hook( __FILE__, 'pip_deactivate' );

/**
 * Ativação: guarda a versão instalada (base para migrações futuras).
 */
function pip_activate() {
	update_option( 'pip_version', PIP_VERSION, true );
	PIP_Store::install();
	PIP_Vapid::keys(); // gera o par VAPID do site na 1ª ativação
	if ( PIP_License::managed() ) {
		PIP_License::check();
		PIP_Sync::push_or_soon( 'install' ); // o Pub Mail vê a versão nova na hora (admin/CLI/cron) ou no próximo tick (visita)
	}
}

/**
 * Desativação: avisa o Pub Mail (o site sai da lista "Sites usando o plugin" e do painel de métricas).
 * Dados, fila e agendamentos ficam no banco para a reativação.
 */
function pip_deactivate() {
	PIP_License::goodbye( 'deactivate' );
}

add_action( 'plugins_loaded', 'pip_boot' );

/**
 * Liga o plugin.
 */
function pip_boot() {
	if ( get_option( 'pip_version' ) !== PIP_VERSION ) {
		// atualizado sem reativar (upload por cima): mesma rotina da ativação (que já inclui o esquema).
		pip_activate();
	} else {
		PIP_Store::maybe_upgrade();
	}
	PIP_License::init();
	PIP_Rest::init();
	PIP_Flow::init();
	if ( is_admin() ) {
		PIP_Settings::init();
		PIP_Copies::init();
		PIP_Broadcasts::init();
	}
	PIP_Frontend::init();
	if ( is_admin() ) {
		PIP_Popup_Layout::init();
		PIP_Admin::init();
	}
}
