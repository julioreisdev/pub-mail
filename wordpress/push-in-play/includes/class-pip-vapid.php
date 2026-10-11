<?php
/**
 * Chaves VAPID do site (Web Push): par EC P-256 gerado uma vez e guardado nas opções.
 * A pública vai para o navegador (applicationServerKey); a privada assina os envios (próxima etapa).
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Geração e leitura das chaves.
 */
class PIP_Vapid {

	const OPTION = 'pip_vapid';

	/**
	 * Base64url sem padding.
	 *
	 * @param string $bin Bytes.
	 * @return string
	 */
	public static function b64url( $bin ) {
		return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * O servidor consegue gerar o par (OpenSSL com curva P-256)?
	 *
	 * @return bool
	 */
	public static function supported() {
		return function_exists( 'openssl_pkey_new' ) && defined( 'OPENSSL_KEYTYPE_EC' );
	}

	/**
	 * Chaves atuais, gerando na 1ª vez. Null se o servidor não suporta.
	 *
	 * @return array{public:string,private:string,created_at:string}|null
	 */
	public static function keys() {
		$k = get_option( self::OPTION );
		if ( is_array( $k ) && ! empty( $k['public'] ) && ! empty( $k['private'] ) ) {
			return $k;
		}
		if ( ! self::supported() ) {
			return null;
		}
		$res = openssl_pkey_new(
			array(
				'curve_name'       => 'prime256v1',
				'private_key_type' => OPENSSL_KEYTYPE_EC,
			)
		);
		if ( ! $res ) {
			return null;
		}
		$d = openssl_pkey_get_details( $res );
		if ( empty( $d['ec']['x'] ) || empty( $d['ec']['y'] ) || empty( $d['ec']['d'] ) ) {
			return null;
		}
		$pad = function ( $v ) {
			return str_pad( $v, 32, "\0", STR_PAD_LEFT );
		};
		$k = array(
			'public'     => self::b64url( "\x04" . $pad( $d['ec']['x'] ) . $pad( $d['ec']['y'] ) ),
			'private'    => self::b64url( $pad( $d['ec']['d'] ) ),
			'created_at' => current_time( 'mysql' ),
		);
		update_option( self::OPTION, $k, true );
		return $k;
	}

	/**
	 * Só a chave pública (ou '').
	 *
	 * @return string
	 */
	public static function public_key() {
		$k = self::keys();
		return $k ? $k['public'] : '';
	}
}
