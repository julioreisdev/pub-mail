<?php
/**
 * Desinstalação: remove o que o plugin guardou.
 *
 * @package PushInPlay
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/includes/class-pip-store.php';
PIP_Store::drop();
wp_clear_scheduled_hook( 'pip_flow_tick' );
wp_clear_scheduled_hook( 'pip_daily' );
delete_option( 'pip_flow_enabled' );
delete_option( 'pip_diag_until' );
delete_option( 'pip_worker_last' );
delete_option( 'pip_cron_last' );
delete_option( 'pip_prune_last' );
foreach ( array( 'pip_idle', 'pip_kick', 'pip_worker_lock', 'pip_layout_ids', 'pip_subs_count_all' ) as $tr ) {
	delete_transient( $tr );
}
delete_option( 'pip_settings' );
delete_option( 'pip_license' );
delete_option( 'pip_sync' );
foreach ( array( 'pip_sync_next', 'pip_sync_soon', 'pip_sync_lock' ) as $tr ) {
	delete_transient( $tr );
}
wp_clear_scheduled_hook( 'pip_license_cron' );
delete_option( 'pip_version' );
delete_option( 'pip_db_version' );
delete_option( 'pip_vapid' );
