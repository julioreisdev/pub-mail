<?php
/**
 * Tradutores oficiais (opcionais, com chave do dono do site): Google Cloud Translation e
 * Microsoft Translator. Usados quando o tradutor gratuito falha — ou sempre, se o dono preferir.
 * A chave fica só no servidor (nunca vai para o navegador).
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Cliente dos tradutores oficiais.
 */
class TRINV_Official {

	const MAX_ITEMS = 40;
	const MAX_CHARS = 8000;
	const TIMEOUT   = 12;

	/**
	 * Códigos Google → Microsoft (o resto é igual).
	 *
	 * @var array
	 */
	const MS_CODES = array(
		'zh-CN'    => 'zh-Hans',
		'zh-TW'    => 'zh-Hant',
		'iw'       => 'he',
		'jw'       => 'jv',
		'tl'       => 'fil',
		'pt-PT'    => 'pt-pt',
		'no'       => 'nb',
		'mni-Mtei' => 'mni',
	);

	/**
	 * Provedor configurado ('' = nenhum).
	 *
	 * @return string
	 */
	public static function provider() {
		$o = trinv_options();
		$p = (string) $o['provider'];
		return ( in_array( $p, array( 'google', 'microsoft' ), true ) && '' !== trim( (string) $o['provider_key'] ) ) ? $p : '';
	}

	/**
	 * Usar o oficial sempre (e não só quando o gratuito falha)?
	 *
	 * @return bool
	 */
	public static function always() {
		$o = trinv_options();
		return '' !== self::provider() && 'always' === $o['provider_mode'];
	}

	/**
	 * Traduz com o provedor oficial.
	 *
	 * @param string[] $srcs Trechos (HTML com marcadores).
	 * @param string   $tl   Destino (código Google).
	 * @param string   $sl   Origem ('auto' ou código Google).
	 * @return array Lista alinhada: array( tr|null, sl ).
	 */
	public static function translate( array $srcs, $tl, $sl = 'auto' ) {
		$srcs = array_values( $srcs );
		$out  = array_fill( 0, count( $srcs ), array( null, '' ) );
		$p    = self::provider();
		if ( '' === $p || ! $srcs ) {
			return $out;
		}
		foreach ( self::chunks( $srcs ) as $chunk ) {
			$res = 'google' === $p ? self::google( array_values( $chunk ), $tl, $sl ) : self::microsoft( array_values( $chunk ), $tl, $sl );
			if ( ! $res ) {
				continue;
			}
			foreach ( array_keys( $chunk ) as $pos => $idx ) {
				if ( isset( $res[ $pos ] ) ) {
					$out[ $idx ] = $res[ $pos ];
				}
			}
		}
		return $out;
	}

	/**
	 * Teste para a tela de ajustes.
	 *
	 * @return array array( ok, ms, sample, error )
	 */
	public static function health() {
		$t0 = microtime( true );
		$r  = self::translate( array( 'Good morning, <b id="0">friends</b>!' ), 'pt' );
		return array(
			'ok'     => null !== $r[0][0],
			'ms'     => (int) round( ( microtime( true ) - $t0 ) * 1000 ),
			'sample' => (string) $r[0][0],
			'error'  => (string) get_transient( 'trinv_official_error' ),
		);
	}

	/**
	 * Lotes por itens e caracteres (índices originais preservados).
	 *
	 * @param string[] $srcs Trechos.
	 * @return array
	 */
	private static function chunks( array $srcs ) {
		$chunks = array();
		$cur    = array();
		$chars  = 0;
		foreach ( $srcs as $i => $s ) {
			$len = strlen( $s );
			if ( $cur && ( count( $cur ) >= self::MAX_ITEMS || $chars + $len > self::MAX_CHARS ) ) {
				$chunks[] = $cur;
				$cur      = array();
				$chars    = 0;
			}
			$cur[ $i ] = $s;
			$chars    += $len;
		}
		if ( $cur ) {
			$chunks[] = $cur;
		}
		return $chunks;
	}

	/**
	 * Registra o último erro (aparece no teste da tela de ajustes).
	 *
	 * @param string $msg Mensagem.
	 */
	private static function error( $msg ) {
		set_transient( 'trinv_official_error', substr( (string) $msg, 0, 300 ), HOUR_IN_SECONDS );
	}

	/**
	 * Google Cloud Translation v2 (chave de API).
	 *
	 * @param string[] $items Trechos.
	 * @param string   $tl    Destino.
	 * @param string   $sl    Origem.
	 * @return array|null
	 */
	private static function google( array $items, $tl, $sl ) {
		$o    = trinv_options();
		$body = array(
			'q'      => $items,
			'target' => $tl,
			'format' => 'html',
		);
		if ( 'auto' !== $sl && '' !== (string) $sl ) {
			$body['source'] = $sl;
		}
		$r = wp_remote_post(
			'https://translation.googleapis.com/language/translate/v2?key=' . rawurlencode( trim( (string) $o['provider_key'] ) ),
			array(
				'timeout' => self::TIMEOUT,
				'headers' => array( 'Content-Type' => 'application/json; charset=utf-8' ),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $r ) ) {
			self::error( $r->get_error_message() );
			return null;
		}
		$code = (int) wp_remote_retrieve_response_code( $r );
		$d    = json_decode( (string) wp_remote_retrieve_body( $r ), true );
		if ( 200 !== $code || ! isset( $d['data']['translations'] ) || count( $d['data']['translations'] ) !== count( $items ) ) {
			self::error( 'Google Cloud: HTTP ' . $code . ' ' . ( isset( $d['error']['message'] ) ? $d['error']['message'] : '' ) );
			return null;
		}
		$out = array();
		foreach ( $d['data']['translations'] as $t ) {
			$out[] = array( isset( $t['translatedText'] ) ? (string) $t['translatedText'] : null, isset( $t['detectedSourceLanguage'] ) ? TRINV_Langs::normalize( $t['detectedSourceLanguage'] ) : '' );
		}
		return $out;
	}

	/**
	 * Microsoft Translator v3 (chave + região).
	 *
	 * @param string[] $items Trechos.
	 * @param string   $tl    Destino.
	 * @param string   $sl    Origem.
	 * @return array|null
	 */
	private static function microsoft( array $items, $tl, $sl ) {
		$o   = trinv_options();
		$url = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&textType=html&to=' . rawurlencode( self::ms( $tl ) );
		if ( 'auto' !== $sl && '' !== (string) $sl ) {
			$url .= '&from=' . rawurlencode( self::ms( $sl ) );
		}
		$headers = array(
			'Content-Type'              => 'application/json; charset=utf-8',
			'Ocp-Apim-Subscription-Key' => trim( (string) $o['provider_key'] ),
		);
		if ( '' !== trim( (string) $o['provider_region'] ) ) {
			$headers['Ocp-Apim-Subscription-Region'] = trim( (string) $o['provider_region'] );
		}
		$body = array();
		foreach ( $items as $s ) {
			$body[] = array( 'Text' => $s );
		}
		$r = wp_remote_post(
			$url,
			array(
				'timeout' => self::TIMEOUT,
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $r ) ) {
			self::error( $r->get_error_message() );
			return null;
		}
		$code = (int) wp_remote_retrieve_response_code( $r );
		$d    = json_decode( (string) wp_remote_retrieve_body( $r ), true );
		if ( 200 !== $code || ! is_array( $d ) || count( $d ) !== count( $items ) ) {
			self::error( 'Microsoft: HTTP ' . $code . ' ' . ( isset( $d['error']['message'] ) ? $d['error']['message'] : '' ) );
			return null;
		}
		$out = array();
		foreach ( $d as $t ) {
			$tr    = isset( $t['translations'][0]['text'] ) ? (string) $t['translations'][0]['text'] : null;
			$det   = isset( $t['detectedLanguage']['language'] ) ? self::from_ms( (string) $t['detectedLanguage']['language'] ) : '';
			$out[] = array( $tr, $det );
		}
		return $out;
	}

	/**
	 * Código Google → Microsoft.
	 *
	 * @param string $code Código.
	 * @return string
	 */
	public static function ms( $code ) {
		return isset( self::MS_CODES[ $code ] ) ? self::MS_CODES[ $code ] : $code;
	}

	/**
	 * Código Microsoft → Google.
	 *
	 * @param string $code Código.
	 * @return string
	 */
	public static function from_ms( $code ) {
		$flip = array_flip( self::MS_CODES );
		return isset( $flip[ $code ] ) ? $flip[ $code ] : TRINV_Langs::normalize( $code );
	}
}

/**
 * Orquestra os tradutores: gratuito primeiro; oficial quando o gratuito falha (ou sempre).
 */
class TRINV_Translator {

	/**
	 * Há algum tradutor disponível no servidor agora?
	 *
	 * @return bool
	 */
	public static function available() {
		return ! TRINV_Google::blocked() || '' !== TRINV_Official::provider();
	}

	/**
	 * Traduz trechos.
	 *
	 * @param string[] $srcs Trechos.
	 * @param string   $tl   Destino.
	 * @param string   $sl   Origem.
	 * @return array Lista alinhada: array( tr|null, sl ).
	 */
	public static function translate( array $srcs, $tl, $sl = 'auto' ) {
		$srcs = array_values( $srcs );
		if ( TRINV_Official::always() ) {
			$out = TRINV_Official::translate( $srcs, $tl, $sl );
			return self::fill( $out, $srcs, $tl, $sl, 'free' );
		}
		$out = TRINV_Google::blocked() ? array_fill( 0, count( $srcs ), array( null, '' ) ) : TRINV_Google::translate( $srcs, $tl, $sl );
		return self::fill( $out, $srcs, $tl, $sl, 'official' );
	}

	/**
	 * Vários grupos (cada um com a sua origem) de uma vez: o gratuito numa rodada paralela só.
	 *
	 * @param array  $groups chave => array( trechos, origem ).
	 * @param string $tl     Destino.
	 * @return array chave => lista alinhada de array( tr|null, sl ).
	 */
	public static function translate_groups( array $groups, $tl ) {
		$out = array();
		if ( TRINV_Official::always() || TRINV_Google::blocked() ) {
			foreach ( $groups as $g => $p ) {
				$out[ $g ] = self::translate( (array) $p[0], $tl, (string) $p[1] );
			}
			return $out;
		}
		$free = TRINV_Google::translate_groups( $groups, $tl );
		foreach ( $groups as $g => $p ) {
			$out[ $g ] = self::fill( $free[ $g ], array_values( (array) $p[0] ), $tl, '' !== (string) $p[1] ? (string) $p[1] : 'auto', 'official' );
		}
		return $out;
	}

	/**
	 * Completa o que faltou com o outro tradutor.
	 *
	 * @param array  $out  Resultado parcial.
	 * @param array  $srcs Trechos.
	 * @param string $tl   Destino.
	 * @param string $sl   Origem.
	 * @param string $with 'official' | 'free'.
	 * @return array
	 */
	private static function fill( array $out, array $srcs, $tl, $sl, $with ) {
		$miss = array();
		foreach ( $out as $i => $pair ) {
			if ( null === $pair[0] ) {
				$miss[ $i ] = $srcs[ $i ];
			}
		}
		if ( ! $miss ) {
			return $out;
		}
		if ( 'official' === $with && '' === TRINV_Official::provider() ) {
			return $out;
		}
		if ( 'free' === $with && TRINV_Google::blocked() ) {
			return $out;
		}
		$res = 'official' === $with ? TRINV_Official::translate( array_values( $miss ), $tl, $sl ) : TRINV_Google::translate( array_values( $miss ), $tl, $sl );
		foreach ( array_keys( $miss ) as $pos => $idx ) {
			if ( null !== $res[ $pos ][0] ) {
				$out[ $idx ] = $res[ $pos ];
			}
		}
		return $out;
	}
}
