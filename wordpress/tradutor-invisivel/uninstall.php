<?php
/**
 * Desinstalação: remove tabelas, opções, metadados e transients do plugin.
 *
 * @package TradutorInvisivel
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

$trinv_tables = array( $wpdb->prefix . 'trinv_seg', $wpdb->prefix . 'trinv_page', $wpdb->prefix . 'trinv_slug' );
foreach ( $trinv_tables as $trinv_table ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$trinv_table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery,WordPress.DB.DirectDatabaseQuery.SchemaChange,PluginCheck.Security.DirectDB.UnescapedDBParameter
}

delete_option( 'trinv_options' );
delete_option( 'trinv_db_version' );
delete_option( 'trinv_warm_q' );
foreach ( array( '_trinv_lang', '_trinv_lang_v', '_trinv_glang', '_trinv_glang_v', '_trinv_warm' ) as $trinv_meta ) {
	delete_metadata( 'post', 0, $trinv_meta, '', true );
}
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_trinv\\_%' OR option_name LIKE '\\_transient\\_timeout\\_trinv\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
wp_clear_scheduled_hook( 'trinv_prune' );
delete_option( 'trinv_static' );

$trinv_up = wp_upload_dir( null, false );
if ( empty( $trinv_up['error'] ) && ! empty( $trinv_up['basedir'] ) ) {
	$trinv_dir = trailingslashit( $trinv_up['basedir'] ) . 'trinv';
	if ( is_dir( $trinv_dir ) ) {
		foreach ( (array) glob( $trinv_dir . '/*' ) as $trinv_file ) {
			wp_delete_file( $trinv_file );
		}
		@rmdir( $trinv_dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged,WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
	}
}
