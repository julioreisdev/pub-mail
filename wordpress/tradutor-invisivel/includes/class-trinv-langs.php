<?php
/**
 * Idiomas aceitos pelo tradutor e normalização de códigos.
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Códigos no formato do Google Tradutor.
 */
class TRINV_Langs {

	/**
	 * Idiomas de destino suportados.
	 *
	 * @var string[]
	 */
	const SUPPORTED = array(
		'af', 'ak', 'am', 'ar', 'as', 'ay', 'az', 'be', 'bg', 'bho', 'bm', 'bn', 'bs', 'ca', 'ceb', 'ckb', 'co', 'cs', 'cy', 'da',
		'de', 'doi', 'dv', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'fi', 'fr', 'fy', 'ga', 'gd', 'gl', 'gn', 'gom', 'gu',
		'ha', 'haw', 'hi', 'hmn', 'hr', 'ht', 'hu', 'hy', 'id', 'ig', 'ilo', 'is', 'it', 'iw', 'ja', 'jw', 'ka', 'kk', 'km', 'kn',
		'ko', 'kri', 'ku', 'ky', 'la', 'lb', 'lg', 'ln', 'lo', 'lt', 'lus', 'lv', 'mai', 'mg', 'mi', 'mk', 'ml', 'mn', 'mni-Mtei', 'mr',
		'ms', 'mt', 'my', 'ne', 'nl', 'no', 'nso', 'ny', 'om', 'or', 'pa', 'pl', 'ps', 'pt', 'pt-PT', 'qu', 'ro', 'ru', 'rw', 'sa',
		'sd', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl',
		'tr', 'ts', 'tt', 'ug', 'uk', 'ur', 'uz', 'vi', 'xh', 'yi', 'yo', 'zh-CN', 'zh-TW', 'zu',
	);

	/**
	 * Apelidos (padrão do navegador → código do Google).
	 *
	 * @var array
	 */
	const ALIASES = array(
		'he'  => 'iw',
		'jv'  => 'jw',
		'fil' => 'tl',
		'nb'  => 'no',
		'nn'  => 'no',
		'mni' => 'mni-Mtei',
		'zh'  => 'zh-CN',
	);

	/**
	 * Normaliza uma etiqueta de idioma (pt-BR, en_US, zh-Hant…) para o código do Google.
	 * Devolve '' se o idioma não é suportado.
	 *
	 * @param string $tag Etiqueta.
	 * @return string
	 */
	public static function normalize( $tag ) {
		$t = strtolower( str_replace( '_', '-', trim( (string) $tag ) ) );
		if ( '' === $t ) {
			return '';
		}
		if ( 0 === strpos( $t, 'zh' ) ) {
			return preg_match( '/-(tw|hk|mo|hant)/', $t ) ? 'zh-TW' : 'zh-CN';
		}
		if ( 'pt' === $t || 'pt-br' === $t ) {
			return 'pt';
		}
		if ( 0 === strpos( $t, 'pt-' ) ) {
			return 'pt-PT';
		}
		if ( 'mni-mtei' === $t ) {
			return 'mni-Mtei';
		}
		$base = explode( '-', $t );
		$base = $base[0];
		if ( isset( self::ALIASES[ $base ] ) ) {
			$base = self::ALIASES[ $base ];
		}
		return in_array( $base, self::SUPPORTED, true ) ? $base : '';
	}

	/**
	 * Mesma língua para fins de "precisa traduzir?" (pt e pt-PT contam como iguais).
	 *
	 * @param string $a Código.
	 * @param string $b Código.
	 * @return bool
	 */
	public static function same( $a, $b ) {
		if ( '' === $a || '' === $b ) {
			return false;
		}
		$fa = self::family( $a );
		$fb = self::family( $b );
		return $fa === $fb;
	}

	/**
	 * Família da língua (pt-PT → pt; zh-CN e zh-TW continuam diferentes).
	 *
	 * @param string $code Código.
	 * @return string
	 */
	public static function family( $code ) {
		return 'pt-PT' === $code ? 'pt' : $code;
	}

	/**
	 * Idioma (código Google) do locale do WordPress, ex.: pt_BR → pt.
	 *
	 * @return string
	 */
	public static function site_locale() {
		return self::normalize( function_exists( 'determine_locale' ) ? determine_locale() : get_locale() );
	}
}
