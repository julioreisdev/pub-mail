<?php
/**
 * Tradução pelo endpoint público do Google Tradutor (sem chave, grátis).
 *
 * - Lotes de até 40 trechos / 8 mil caracteres, em paralelo (até 4 por vez).
 * - Formato HTML: frases inteiras com links/negrito marcados por <tag id="N"> voltam na
 *   ordem certa da língua de destino.
 * - Rodízio entre 4 endpoints equivalentes; se todos falharem, "disjuntor" por 10 min
 *   (o navegador do visitante passa a traduzir direto, sem custo para o servidor).
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Cliente do Google Tradutor.
 */
class TRINV_Google {

	const ENDPOINTS = array(
		'https://translate.googleapis.com/translate_a/t?client=gtx',
		'https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex',
		'https://clients5.google.com/translate_a/t?client=dict-chrome-ex',
		'https://translate.google.com/translate_a/t?client=gtx',
	);

	const MAX_ITEMS = 40;
	const MAX_CHARS = 8000;
	const PARALLEL  = 8;
	const TIMEOUT   = 8;

	/**
	 * Servidor bloqueado pelo Google agora?
	 *
	 * @return bool
	 */
	public static function blocked() {
		return (bool) get_transient( 'trinv_blocked' );
	}

	/**
	 * Endpoints em uso: os do plugin ou os enviados pelo Pub Mail (se o Google mudar algo,
	 * a correção chega sem nova versão). Só endereços do tradutor do Google são aceitos.
	 *
	 * @return string[]
	 */
	public static function endpoints() {
		$r = get_option( 'trinv_remote' );
		$g = is_array( $r ) && ! empty( $r['g'] ) && is_array( $r['g'] ) ? array_values( array_filter( $r['g'], array( __CLASS__, 'valid_endpoint' ) ) ) : array();
		return $g ? $g : self::ENDPOINTS;
	}

	/**
	 * Endereço aceito como endpoint do tradutor.
	 *
	 * @param mixed $u Endereço.
	 * @return bool
	 */
	public static function valid_endpoint( $u ) {
		return is_string( $u ) && (bool) preg_match( '#^https://(translate\.googleapis\.com|clients\d?\.google\.com|translate\.google\.com)/translate_a/t\?client=[a-z-]+$#', $u );
	}

	/**
	 * Traduz trechos (HTML com marcadores) para $tl.
	 *
	 * @param string[] $srcs Trechos.
	 * @param string   $tl   Idioma de destino (código Google).
	 * @param string   $sl   Idioma de origem ('auto' = o Google detecta).
	 * @return array Lista alinhada com $srcs: array( tr|null, sl ).
	 */
	public static function translate( array $srcs, $tl, $sl = 'auto' ) {
		$r = self::translate_groups( array( 'x' => array( $srcs, $sl ) ), $tl );
		return $r['x'];
	}

	/**
	 * Vários grupos de trechos, cada um com a sua origem, numa rodada só de pedidos paralelos
	 * (antes era uma rodada por origem — o 1º visitante esperava várias idas ao Google).
	 *
	 * @param array  $groups chave => array( trechos, origem ).
	 * @param string $tl     Idioma de destino.
	 * @return array chave => lista alinhada de array( tr|null, sl ).
	 */
	public static function translate_groups( array $groups, $tl ) {
		$out    = array();
		$chunks = array();
		foreach ( $groups as $g => $pair ) {
			$srcs      = array_values( (array) $pair[0] );
			$sl        = '' !== (string) $pair[1] ? (string) $pair[1] : 'auto';
			$out[ $g ] = array_fill( 0, count( $srcs ), array( null, '' ) );
			foreach ( self::chunks( $srcs ) as $c ) {
				$chunks[] = array(
					'g'     => $g,
					'sl'    => $sl,
					'items' => $c,
				);
			}
		}
		if ( ! $chunks ) {
			return $out;
		}
		$eps     = self::endpoints();
		$n       = count( $eps );
		$start   = (int) get_transient( 'trinv_ep' ) % $n;
		$pending = array_keys( $chunks );
		$ok_any  = false;

		for ( $attempt = 0; $attempt < $n && $pending; $attempt++ ) {
			$ep     = ( $start + $attempt ) % $n;
			$failed = array();
			foreach ( array_chunk( $pending, self::PARALLEL ) as $group ) {
				$reqs = array();
				foreach ( $group as $ci ) {
					$reqs[ $ci ] = array(
						$eps[ $ep ] . '&sl=' . rawurlencode( $chunks[ $ci ]['sl'] ) . '&tl=' . rawurlencode( $tl ) . '&format=html',
						self::body( $chunks[ $ci ]['items'] ),
					);
				}
				$responses = self::post_many( $reqs );
				foreach ( $group as $ci ) {
					$parsed = self::parse( $responses[ $ci ] ?? null, count( $chunks[ $ci ]['items'] ) );
					if ( null === $parsed ) {
						$failed[] = $ci;
						continue;
					}
					$ok_any = true;
					foreach ( array_keys( $chunks[ $ci ]['items'] ) as $pos => $idx ) {
						$out[ $chunks[ $ci ]['g'] ][ $idx ] = $parsed[ $pos ];
					}
				}
			}
			if ( count( $failed ) < count( $pending ) ) {
				set_transient( 'trinv_ep', $ep, DAY_IN_SECONDS ); // este endpoint está respondendo.
			}
			$pending = $failed;
		}

		if ( ! $ok_any ) {
			set_transient( 'trinv_blocked', 1, 10 * MINUTE_IN_SECONDS );
		}
		return $out;
	}

	/**
	 * Teste rápido para a tela de ajustes.
	 *
	 * @return array array( ok, ms, sample )
	 */
	public static function health() {
		$t0 = microtime( true );
		$r  = self::translate( array( 'Good morning, <b id="0">friends</b>!' ), 'pt' );
		return array(
			'ok'     => null !== $r[0][0],
			'ms'     => (int) round( ( microtime( true ) - $t0 ) * 1000 ),
			'sample' => (string) $r[0][0],
		);
	}

	/**
	 * Divide em lotes respeitando itens e caracteres.
	 *
	 * @param string[] $srcs Trechos.
	 * @return array Lista de lotes; cada lote = índice original => trecho.
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
	 * Corpo x-www-form-urlencoded com "q" repetido.
	 *
	 * @param array $items Trechos.
	 * @return string
	 */
	private static function body( array $items ) {
		$parts = array();
		foreach ( $items as $s ) {
			$parts[] = 'q=' . rawurlencode( $s );
		}
		return implode( '&', $parts );
	}

	/**
	 * Interpreta a resposta: [[tr, sl], ...] (ou [tr, sl] / strings em variações antigas).
	 *
	 * @param array|null $res Resposta (code, body).
	 * @param int        $n   Quantidade esperada.
	 * @return array|null Lista de array( tr, sl ) ou null se falhou.
	 */
	private static function parse( $res, $n ) {
		if ( ! is_array( $res ) || 200 !== (int) $res['code'] ) {
			return null;
		}
		$body = ltrim( (string) $res['body'] );
		if ( '' === $body || '[' !== $body[0] ) {
			return null; // página HTML ("Sorry…") = bloqueio.
		}
		$d = json_decode( $body, true );
		if ( ! is_array( $d ) ) {
			return null;
		}
		if ( 1 === $n && isset( $d[0] ) && is_string( $d[0] ) ) {
			$d = array( $d );
		}
		if ( count( $d ) !== $n ) {
			return null;
		}
		$out = array();
		foreach ( $d as $item ) {
			if ( is_array( $item ) && isset( $item[0] ) && is_string( $item[0] ) ) {
				$out[] = array( $item[0], isset( $item[1] ) && is_string( $item[1] ) ? $item[1] : '' );
			} elseif ( is_string( $item ) ) {
				$out[] = array( $item, '' );
			} else {
				return null;
			}
		}
		return $out;
	}

	/**
	 * Vários POSTs em paralelo (Requests do WordPress); sem ele, um por vez.
	 *
	 * @param array $reqs chave => array( url, corpo ).
	 * @return array chave => array( code, body )
	 */
	private static function post_many( array $reqs ) {
		$headers = array(
			'Content-Type' => 'application/x-www-form-urlencoded;charset=UTF-8',
			'Accept'       => 'application/json',
		);
		$ua      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
		$class   = class_exists( '\WpOrg\Requests\Requests' ) ? '\WpOrg\Requests\Requests' : ( class_exists( 'Requests' ) ? 'Requests' : '' );
		$out     = array();

		if ( $class && count( $reqs ) > 1 ) {
			$requests = array();
			foreach ( $reqs as $k => $rq ) {
				$requests[ $k ] = array(
					'url'     => $rq[0],
					'type'    => 'POST',
					'headers' => $headers,
					'data'    => $rq[1],
				);
			}
			$verify = apply_filters( 'https_ssl_verify', true, reset( $reqs )[0] ) ? ABSPATH . WPINC . '/certificates/ca-bundle.crt' : false; // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- filtro do próprio WordPress.
			try {
				$responses = call_user_func(
					array( $class, 'request_multiple' ),
					$requests,
					array(
						'timeout'         => self::TIMEOUT,
						'connect_timeout' => 5,
						'useragent'       => $ua,
						'verify'          => $verify,
					)
				);
				foreach ( $reqs as $k => $rq ) {
					$r = $responses[ $k ] ?? null;
					if ( is_object( $r ) && isset( $r->status_code ) ) {
						$out[ $k ] = array(
							'code' => (int) $r->status_code,
							'body' => (string) $r->body,
						);
					}
				}
				return $out;
			} catch ( \Throwable $e ) {
				$out = array(); // cai para o modo sequencial abaixo.
			}
		}

		foreach ( $reqs as $k => $rq ) {
			$r = wp_remote_post(
				$rq[0],
				array(
					'timeout'    => self::TIMEOUT,
					'headers'    => $headers,
					'body'       => $rq[1],
					'user-agent' => $ua,
				)
			);
			if ( ! is_wp_error( $r ) ) {
				$out[ $k ] = array(
					'code' => (int) wp_remote_retrieve_response_code( $r ),
					'body' => (string) wp_remote_retrieve_body( $r ),
				);
			}
		}
		return $out;
	}
}
