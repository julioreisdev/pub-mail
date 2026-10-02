<?php
/**
 * Plugin Name:       Tradutor Invisível
 * Description:       Traduz automaticamente posts e páginas para o idioma do navegador de cada visitante, sem botões, avisos ou configuração. O idioma de origem é detectado pelo próprio conteúdo.
 * Version:           1.4.2
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Júlio Cezar Reis
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       tradutor-invisivel
 * Update URI:        false
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

define( 'TRINV_VERSION', '1.4.2' );
define( 'TRINV_EDITION', 'standalone' ); // o pacote baixado pelo Pub Mail vem como 'pubmail' (com licença).
define( 'TRINV_FILE', __FILE__ );
define( 'TRINV_DIR', plugin_dir_path( __FILE__ ) );
define( 'TRINV_URL', plugin_dir_url( __FILE__ ) );

if ( is_readable( TRINV_DIR . 'license.php' ) ) {
	require_once TRINV_DIR . 'license.php'; // chave da conta do Pub Mail (só na edição do Pub Mail).
}
require_once TRINV_DIR . 'includes/class-trinv-langs.php';
require_once TRINV_DIR . 'includes/class-trinv-detect.php';
require_once TRINV_DIR . 'includes/class-trinv-store.php';
require_once TRINV_DIR . 'includes/class-trinv-google.php';
require_once TRINV_DIR . 'includes/class-trinv-official.php';
require_once TRINV_DIR . 'includes/class-trinv-api.php';
require_once TRINV_DIR . 'includes/class-trinv-warm.php';
require_once TRINV_DIR . 'includes/class-trinv-slugs.php';
require_once TRINV_DIR . 'includes/class-trinv-license.php';
require_once TRINV_DIR . 'includes/class-trinv-frontend.php';
require_once TRINV_DIR . 'includes/class-trinv-admin.php';

register_activation_hook( __FILE__, 'trinv_activate' );
register_deactivation_hook( __FILE__, array( 'TRINV_Store', 'deactivate' ) );

/**
 * Ativação: tabelas e, na edição do Pub Mail, a 1ª verificação da licença.
 */
function trinv_activate() {
	TRINV_Store::install();
	if ( TRINV_License::managed() ) {
		TRINV_License::check();
	}
}

add_action( 'plugins_loaded', 'trinv_boot' );

/**
 * Liga o plugin.
 */
function trinv_boot() {
	TRINV_Store::maybe_upgrade();
	TRINV_License::init();
	TRINV_API::init();
	TRINV_Frontend::init();
	TRINV_Warm::init();
	TRINV_Slugs::init();
	if ( is_admin() ) {
		TRINV_Admin::init();
	}
}

/**
 * Opções (todas opcionais — o plugin funciona sem abrir a tela de ajustes).
 *
 * @return array
 */
function trinv_options() {
	$defaults = array(
		'enabled'   => 1,  // traduz para os visitantes.
		'chrome'    => 1,  // traduz textos do tema quando o conteúdo já está no idioma do visitante.
		'skip'      => '', // idiomas para os quais não traduzir (ex.: "en, es").
		'selectors' => '', // seletores CSS extras que nunca devem ser traduzidos.
		'maxwait'   => 3000, // tempo máximo (ms) com a página escondida esperando a tradução.
		'campaign'  => '', // idiomas da campanha: páginas publicadas são pré-traduzidas neles.
		'urls'      => 1,  // endereço (URL) dos posts e páginas no idioma do visitante.
		// tradutor oficial opcional (chave do dono do site): 'google' | 'microsoft'.
		'provider'        => '',
		'provider_key'    => '',
		'provider_region' => '',
		'provider_mode'   => 'fallback', // 'fallback' = só quando o gratuito falha; 'always' = sempre.
	);
	$saved = get_option( 'trinv_options', array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), $defaults );
}
