<?php
// Monta o cenário de ecossistema no WordPress de teste: página do Elementor + loja WooCommerce.
// Rodado por setup-ecosystem.sh com `wp eval-file`.
wp_set_current_user( 1 );
$out = array();

// ---------------------------------------------------------------- Elementor: página de vendas
$w = function ( $id, $type, $settings ) {
	return array( 'id' => $id, 'elType' => 'widget', 'widgetType' => $type, 'settings' => $settings, 'elements' => array() );
};
$check = array( 'value' => 'fas fa-check', 'library' => 'fa-solid' );
$widgets = array(
	$w( 'w01', 'heading', array( 'title' => 'Grow juicy tomatoes on your balcony', 'header_size' => 'h1' ) ),
	$w( 'w02', 'text-editor', array( 'editor' => '<p>Our step-by-step course shows you how to grow <strong>fresh tomatoes</strong> in small spaces, even if you have never planted anything before.</p>' ) ),
	$w( 'w03', 'button', array( 'text' => 'Start the course today', 'link' => array( 'url' => 'https://example.com/checkout', 'is_external' => '', 'nofollow' => '' ) ) ),
	$w( 'w04', 'icon-list', array( 'icon_list' => array(
		array( '_id' => 'il1', 'text' => 'Lifetime access to every lesson', 'selected_icon' => $check ),
		array( '_id' => 'il2', 'text' => 'A printable planting calendar', 'selected_icon' => $check ),
		array( '_id' => 'il3', 'text' => 'Weekly answers from expert gardeners', 'selected_icon' => $check ),
	) ) ),
	$w( 'w05', 'icon-box', array( 'title_text' => 'Short video lessons', 'description_text' => 'Watch each lesson on your phone in less than ten minutes, wherever you are.' ) ),
	$w( 'w06', 'counter', array( 'starting_number' => 0, 'ending_number' => 1250, 'title' => 'Happy students' ) ),
	$w( 'w07', 'progress', array( 'title' => 'Students who finish the course', 'percent' => array( 'unit' => '%', 'size' => 87 ) ) ),
	$w( 'w08', 'accordion', array( 'tabs' => array(
		array( '_id' => 'ac1', 'tab_title' => 'How long until my first harvest?', 'tab_content' => '<p>Most students pick their first ripe tomatoes about ten weeks after planting.</p>' ),
		array( '_id' => 'ac2', 'tab_title' => 'Do I need a big garden?', 'tab_content' => '<p>No. A sunny balcony or even a bright window is enough to start.</p>' ),
	) ) ),
	$w( 'w09', 'tabs', array( 'tabs' => array(
		array( '_id' => 'tb1', 'tab_title' => 'Beginners', 'tab_content' => '<p>Start with cherry tomatoes in a large pot with good drainage.</p>' ),
		array( '_id' => 'tb2', 'tab_title' => 'Experienced growers', 'tab_content' => '<p>Try heirloom varieties and build your own wooden trellis.</p>' ),
	) ) ),
	$w( 'w10', 'testimonial', array( 'testimonial_content' => 'I picked more tomatoes this summer than in the last five years together.', 'testimonial_name' => 'Sarah Miller', 'testimonial_job' => 'Home gardener' ) ),
	$w( 'w11', 'alert', array( 'alert_title' => 'Launch offer', 'alert_description' => 'The special launch price ends on Sunday at midnight.' ) ),
	$w( 'w12', 'heading', array( 'title' => 'Join thousands of happy gardeners', 'header_size' => 'h2', '_animation' => 'fadeInUp' ) ),
);
$data = array( array( 'id' => 'sec01', 'elType' => 'section', 'settings' => array(), 'elements' => array( array( 'id' => 'col01', 'elType' => 'column', 'settings' => array( '_column_size' => 100 ), 'elements' => $widgets ) ) ) );
$page = get_page_by_path( 'tomato-course' );
$pid  = $page ? $page->ID : wp_insert_post( array( 'post_type' => 'page', 'post_title' => 'Tomato growing course', 'post_name' => 'tomato-course', 'post_status' => 'publish', 'post_content' => '' ) );
update_post_meta( $pid, '_elementor_edit_mode', 'builder' );
update_post_meta( $pid, '_wp_page_template', 'elementor_header_footer' );
$doc = \Elementor\Plugin::$instance->documents->get( $pid, false );
$doc->save( array( 'elements' => $data ) );
$out['elementor_page'] = get_permalink( $pid );
$out['post_content_len'] = strlen( wp_strip_all_tags( get_post_field( 'post_content', $pid ) ) );

// ---------------------------------------------------------------- WooCommerce: loja
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_currency', 'BRL' );
update_option( 'woocommerce_default_country', 'BR:SP' );
if ( class_exists( 'WC_Install' ) ) {
	WC_Install::create_pages();
}
// meio de pagamento de teste: pagamento na entrega (aceita produto virtual)
update_option( 'woocommerce_cod_settings', array( 'enabled' => 'yes', 'title' => 'Cash on delivery', 'description' => 'Pay with cash when you receive your order.', 'instructions' => 'Pay with cash upon delivery.', 'enable_for_methods' => array(), 'enable_for_virtual' => 'yes' ) );
update_option( 'woocommerce_enable_guest_checkout', 'yes' );
update_option( 'woocommerce_enable_checkout_login_reminder', 'no' );
$products = array(
	array( 'organic-tomato-seeds', 'Organic tomato seeds', '19.90', 'A pack of 50 organic cherry tomato seeds, tested for strong germination.', '<p>These seeds come from plants grown without chemicals. Each pack includes simple instructions and a planting calendar for every season.</p>' ),
	array( 'self-watering-pot', 'Self-watering pot', '89.00', 'A large pot with a water reservoir that keeps the soil moist for days.', '<p>Perfect for balconies: the reservoir holds enough water for a whole week, so your plants stay healthy even when you travel.</p>' ),
);
foreach ( $products as $p ) {
	$ex = get_page_by_path( $p[0], OBJECT, 'product' );
	$prod = $ex ? wc_get_product( $ex->ID ) : new WC_Product_Simple();
	$prod->set_name( $p[1] );
	$prod->set_slug( $p[0] );
	$prod->set_regular_price( $p[2] );
	$prod->set_short_description( $p[3] );
	$prod->set_description( $p[4] );
	$prod->set_status( 'publish' );
	$prod->set_catalog_visibility( 'visible' );
	$prod->set_virtual( true ); // sem frete: o checkout de teste não depende de zonas de entrega
	$out['products'][] = get_permalink( $prod->save() );
}
$out['shop']     = get_permalink( wc_get_page_id( 'shop' ) );
$out['cart']     = get_permalink( wc_get_page_id( 'cart' ) );
$out['checkout'] = get_permalink( wc_get_page_id( 'checkout' ) );
echo wp_json_encode( $out, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT ), "\n";
