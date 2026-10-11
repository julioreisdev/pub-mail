<?php
/**
 * Envio de Web Push sem biblioteca externa: assinatura VAPID (ES256) + criptografia do conteúdo
 * (RFC 8291, aes128gcm) com o OpenSSL do PHP. Testado ida e volta contra uma implementação em Node.
 *
 * Em escala: `send_many()` manda dezenas de notificações EM PARALELO (curl_multi com HTTP/2: várias
 * notificações na MESMA conexão TLS com o push service, conexões reaproveitadas entre os lotes), o JWT
 * VAPID é assinado uma vez por push service (cache) e a resposta de cada envio é classificada em ok /
 * sumiu (404, 410) / tenta de novo (429, 5xx, rede) / falha definitiva (outros 4xx).
 *
 * @package PushInPlay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Criptografia e entrega.
 */
class PIP_Push {

	const OID_EC_PUBLIC_KEY = "\x06\x07\x2a\x86\x48\xce\x3d\x02\x01";
	const OID_PRIME256V1    = "\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07";
	const MAX_PAYLOAD       = 3800; // o FCM recusa acima de 4 KB (corpo cifrado)

	/**
	 * JWT VAPID por push service (origem do endpoint), reaproveitado por até 1 h.
	 *
	 * @var array<string, array{h:string, exp:int}>
	 */
	private static $vapid_cache = array();

	/**
	 * Chave privada VAPID carregada (resource/OpenSSLAsymmetricKey).
	 *
	 * @var mixed
	 */
	private static $priv = null;

	/**
	 * Base64url → bytes.
	 *
	 * @param string $s Texto.
	 * @return string
	 */
	public static function b64url_decode( $s ) {
		$s = strtr( $s, '-_', '+/' );
		return (string) base64_decode( $s . str_repeat( '=', ( 4 - strlen( $s ) % 4 ) % 4 ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	}

	/**
	 * O servidor consegue enviar? (ECDH + HKDF + AES-GCM)
	 *
	 * @return bool
	 */
	public static function supported() {
		return function_exists( 'openssl_pkey_derive' ) && function_exists( 'hash_hkdf' ) && function_exists( 'openssl_encrypt' ) && in_array( 'aes-128-gcm', array_map( 'strtolower', openssl_get_cipher_methods() ), true );
	}

	/**
	 * Multi handle do cURL, vivo durante a requisição (as conexões com os push services ficam abertas
	 * entre os lotes: sem novo handshake TLS a cada rodada).
	 *
	 * @var resource|\CurlMultiHandle|null
	 */
	private static $mh = null;

	/**
	 * Envio paralelo disponível (curl_multi; sem proxy do WordPress no caminho)?
	 *
	 * @return bool
	 */
	public static function parallel_supported() {
		return function_exists( 'curl_multi_init' ) && function_exists( 'curl_multi_setopt' ) && ! defined( 'WP_PROXY_HOST' );
	}

	/**
	 * Vários POSTs em paralelo pelo curl_multi (HTTP/2 quando o push service aceita).
	 *
	 * @param array $reqs        chave → {url, headers, data}.
	 * @param int   $concurrency Quantos por vez.
	 * @return array chave → resultado.
	 */
	private static function curl_many( $reqs, $concurrency ) {
		$out = array();
		if ( null === self::$mh ) {
			self::$mh = curl_multi_init();
			if ( defined( 'CURLMOPT_PIPELINING' ) && defined( 'CURLPIPE_MULTIPLEX' ) ) {
				curl_multi_setopt( self::$mh, CURLMOPT_PIPELINING, CURLPIPE_MULTIPLEX );
			}
			if ( defined( 'CURLMOPT_MAX_HOST_CONNECTIONS' ) ) {
				curl_multi_setopt( self::$mh, CURLMOPT_MAX_HOST_CONNECTIONS, 8 );
			}
		}
		$ca = ABSPATH . WPINC . '/certificates/ca-bundle.crt';
		$ca = is_readable( $ca ) ? $ca : '';
		foreach ( array_chunk( $reqs, $concurrency, true ) as $chunk ) {
			$hs   = array();
			$hdrs = array();
			foreach ( $chunk as $k => $r ) {
				$h          = curl_init();
				$hdrs[ $k ] = array();
				$headers    = array( 'Expect:' ); // sem "100-continue": o cURL esperaria até 1 s por POST
				foreach ( $r['headers'] as $hk => $hv ) {
					$headers[] = $hk . ': ' . $hv;
				}
				$opts = array(
					CURLOPT_URL            => $r['url'],
					CURLOPT_POST           => true,
					CURLOPT_POSTFIELDS     => $r['data'],
					CURLOPT_HTTPHEADER     => $headers,
					CURLOPT_RETURNTRANSFER => true,
					CURLOPT_HEADER         => false,
					CURLOPT_FOLLOWLOCATION => false,
					CURLOPT_TIMEOUT        => 12,
					CURLOPT_CONNECTTIMEOUT => 6,
					CURLOPT_SSL_VERIFYPEER => true,
					CURLOPT_SSL_VERIFYHOST => 2,
					CURLOPT_USERAGENT      => 'PushInPlay/' . PIP_VERSION . ' (WordPress)',
					CURLOPT_HEADERFUNCTION => function ( $ch, $line ) use ( &$hdrs, $k ) {
						$p = strpos( $line, ':' );
						if ( false !== $p ) {
							$hdrs[ $k ][ strtolower( trim( substr( $line, 0, $p ) ) ) ] = trim( substr( $line, $p + 1 ) );
						}
						return strlen( $line );
					},
				);
				if ( $ca ) {
					$opts[ CURLOPT_CAINFO ] = $ca;
				}
				if ( defined( 'CURL_HTTP_VERSION_2TLS' ) ) {
					$opts[ CURLOPT_HTTP_VERSION ] = CURL_HTTP_VERSION_2TLS;
				}
				if ( defined( 'CURLOPT_PIPEWAIT' ) ) {
					$opts[ CURLOPT_PIPEWAIT ] = true; // espera a conexão existente para multiplexar em vez de abrir outra
				}
				if ( defined( 'CURLPROTO_HTTPS' ) ) {
					$opts[ CURLOPT_PROTOCOLS ] = CURLPROTO_HTTPS;
				}
				curl_setopt_array( $h, $opts );
				curl_multi_add_handle( self::$mh, $h );
				$hs[ $k ] = $h;
			}
			$active = 0;
			$guard  = 0;
			do {
				$st = curl_multi_exec( self::$mh, $active );
				if ( $active && -1 === curl_multi_select( self::$mh, 0.5 ) ) {
					usleep( 20000 );
				}
			} while ( $active && CURLM_OK === $st && ++$guard < 100000 );
			foreach ( $hs as $k => $h ) {
				$errno = curl_errno( $h );
				if ( $errno ) {
					$out[ $k ] = self::result( false, 0, 'rede: ' . mb_substr( curl_error( $h ), 0, 160 ), false, true );
				} else {
					$code      = (int) curl_getinfo( $h, CURLINFO_RESPONSE_CODE );
					$body      = (string) curl_multi_getcontent( $h );
					$out[ $k ] = self::classify( $code, $body, isset( $hdrs[ $k ]['retry-after'] ) ? $hdrs[ $k ]['retry-after'] : '' );
				}
				curl_multi_remove_handle( self::$mh, $h );
				curl_close( $h );
			}
		}
		return $out;
	}

	/**
	 * Quantos envios simultâneos (constante PIP_SEND_CONCURRENCY ou filtro pip_send_concurrency; padrão 50).
	 * Medido num VPS de 2 vCPU contra o FCM: 25 → ~40/s, 50 → ~130/s, 80 → ~160/s (latência de rede manda;
	 * com HTTP/2 são poucas conexões, não 50).
	 *
	 * @return int
	 */
	public static function concurrency() {
		$n = defined( 'PIP_SEND_CONCURRENCY' ) ? (int) PIP_SEND_CONCURRENCY : 50;
		$n = (int) apply_filters( 'pip_send_concurrency', $n );
		return max( 1, min( 100, $n ) );
	}

	/**
	 * Endpoint aceitável para gravar/enviar: https, tamanho são, host público (nada de IP privado/loopback).
	 *
	 * @param string $endpoint URL.
	 * @return bool
	 */
	public static function endpoint_ok( $endpoint ) {
		$endpoint = (string) $endpoint;
		if ( '' === $endpoint || strlen( $endpoint ) > 1000 || 0 !== strpos( $endpoint, 'https://' ) ) {
			return false;
		}
		$u = wp_parse_url( $endpoint );
		if ( empty( $u['host'] ) || ( ! empty( $u['port'] ) && 443 !== (int) $u['port'] ) || ! empty( $u['user'] ) || ! empty( $u['pass'] ) ) {
			return false;
		}
		static $hosts = array();
		$host = strtolower( $u['host'] );
		if ( ! isset( $hosts[ $host ] ) ) {
			// wp_http_validate_url recusa localhost, IPs privados e hosts inválidos (resolve o DNS: 1× por host por requisição)
			$hosts[ $host ] = (bool) wp_http_validate_url( 'https://' . $host . '/' );
		}
		return $hosts[ $host ];
	}

	/**
	 * Chave pública EC (65 bytes, 0x04|x|y) → PEM SubjectPublicKeyInfo.
	 *
	 * @param string $point 65 bytes.
	 * @return string PEM.
	 */
	private static function public_pem( $point ) {
		$algo = "\x30\x13" . self::OID_EC_PUBLIC_KEY . self::OID_PRIME256V1;
		$bits = "\x03\x42\x00" . $point;
		$der  = "\x30\x59" . $algo . $bits;
		return "-----BEGIN PUBLIC KEY-----\n" . chunk_split( base64_encode( $der ), 64, "\n" ) . "-----END PUBLIC KEY-----\n"; // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * Chave privada EC (d de 32 bytes + ponto público) → PEM SEC1 ECPrivateKey.
	 *
	 * @param string $d     32 bytes.
	 * @param string $point 65 bytes.
	 * @return string PEM.
	 */
	private static function private_pem( $d, $point ) {
		$der = "\x30\x77"
			. "\x02\x01\x01"
			. "\x04\x20" . $d
			. "\xa0\x0a" . self::OID_PRIME256V1
			. "\xa1\x44\x03\x42\x00" . $point;
		return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split( base64_encode( $der ), 64, "\n" ) . "-----END EC PRIVATE KEY-----\n"; // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	/**
	 * Assinatura DER (SEQUENCE de 2 INTEGERs) → r||s de 64 bytes (JWS).
	 *
	 * @param string $der DER.
	 * @return string
	 */
	private static function der_to_raw( $der ) {
		$pos = 2;
		if ( "\x30" !== $der[0] ) {
			return '';
		}
		if ( ord( $der[1] ) & 0x80 ) {
			$pos = 2 + ( ord( $der[1] ) & 0x7f );
		}
		$out = '';
		for ( $i = 0; $i < 2; $i++ ) {
			if ( "\x02" !== $der[ $pos ] ) {
				return '';
			}
			$len  = ord( $der[ $pos + 1 ] );
			$int  = substr( $der, $pos + 2, $len );
			$pos += 2 + $len;
			$int  = ltrim( $int, "\x00" );
			$out .= str_pad( $int, 32, "\x00", STR_PAD_LEFT );
		}
		return $out;
	}

	/**
	 * JWT VAPID (ES256) para o push service do endpoint. Assinado uma vez por origem e reaproveitado
	 * por 1 h (o JWT vale 12 h) — numa rodada de milhares de envios são só 2 ou 3 assinaturas.
	 *
	 * @param string $endpoint URL do endpoint.
	 * @param array  $keys     {public, private} em base64url.
	 * @return string|WP_Error "t=…, k=…" para o header Authorization.
	 */
	public static function vapid_header( $endpoint, $keys ) {
		$u = wp_parse_url( $endpoint );
		if ( empty( $u['scheme'] ) || empty( $u['host'] ) ) {
			return new WP_Error( 'pip_endpoint', 'Endpoint inválido.' );
		}
		$aud = $u['scheme'] . '://' . $u['host'] . ( ! empty( $u['port'] ) ? ':' . $u['port'] : '' );
		if ( isset( self::$vapid_cache[ $aud ] ) && self::$vapid_cache[ $aud ]['exp'] > time() ) {
			return self::$vapid_cache[ $aud ]['h'];
		}
		$email  = get_option( 'admin_email' );
		$claims = array(
			'aud' => $aud,
			'exp' => time() + 12 * HOUR_IN_SECONDS,
			'sub' => $email && is_email( $email ) ? 'mailto:' . $email : home_url( '/' ),
		);
		$input  = PIP_Vapid::b64url( wp_json_encode( array( 'typ' => 'JWT', 'alg' => 'ES256' ) ) ) . '.' . PIP_Vapid::b64url( wp_json_encode( $claims ) );
		if ( ! self::$priv ) {
			$point      = self::b64url_decode( $keys['public'] );
			$d          = self::b64url_decode( $keys['private'] );
			self::$priv = openssl_pkey_get_private( self::private_pem( $d, $point ) );
		}
		if ( ! self::$priv ) {
			return new WP_Error( 'pip_key', 'Chave VAPID privada inválida.' );
		}
		$sig = '';
		if ( ! openssl_sign( $input, $sig, self::$priv, OPENSSL_ALGO_SHA256 ) ) {
			return new WP_Error( 'pip_sign', 'Falha ao assinar o JWT.' );
		}
		$raw = self::der_to_raw( $sig );
		if ( 64 !== strlen( $raw ) ) {
			return new WP_Error( 'pip_sign', 'Assinatura em formato inesperado.' );
		}
		$h = 't=' . $input . '.' . PIP_Vapid::b64url( $raw ) . ', k=' . $keys['public'];
		if ( count( self::$vapid_cache ) > 50 ) {
			self::$vapid_cache = array();
		}
		self::$vapid_cache[ $aud ] = array( 'h' => $h, 'exp' => time() + HOUR_IN_SECONDS );
		return $h;
	}

	/**
	 * Criptografa o payload para o aparelho (RFC 8291 / RFC 8188 aes128gcm).
	 *
	 * @param string $payload Texto (JSON).
	 * @param string $p256dh  Chave pública do aparelho (base64url, 65 bytes).
	 * @param string $auth    Segredo de autenticação do aparelho (base64url, 16 bytes).
	 * @return string|WP_Error Corpo binário.
	 */
	public static function encrypt( $payload, $p256dh, $auth ) {
		$ua_public = self::b64url_decode( $p256dh );
		$auth_sec  = self::b64url_decode( $auth );
		if ( 65 !== strlen( $ua_public ) || 16 !== strlen( $auth_sec ) ) {
			return new WP_Error( 'pip_keys', 'Chaves do aparelho inválidas.' );
		}
		$local = openssl_pkey_new(
			array(
				'curve_name'       => 'prime256v1',
				'private_key_type' => OPENSSL_KEYTYPE_EC,
			)
		);
		if ( ! $local ) {
			return new WP_Error( 'pip_ec', 'Não foi possível gerar a chave efêmera.' );
		}
		$ld = openssl_pkey_get_details( $local );
		if ( empty( $ld['ec']['x'] ) || empty( $ld['ec']['y'] ) ) {
			return new WP_Error( 'pip_ec', 'Chave efêmera sem coordenadas.' );
		}
		$as_public = "\x04" . str_pad( $ld['ec']['x'], 32, "\x00", STR_PAD_LEFT ) . str_pad( $ld['ec']['y'], 32, "\x00", STR_PAD_LEFT );
		$peer      = openssl_pkey_get_public( self::public_pem( $ua_public ) );
		if ( ! $peer ) {
			return new WP_Error( 'pip_keys', 'Chave pública do aparelho inválida.' );
		}
		$shared = openssl_pkey_derive( $peer, $local, 32 );
		if ( ! $shared || 32 !== strlen( $shared ) ) {
			return new WP_Error( 'pip_ecdh', 'Falha no ECDH.' );
		}
		// RFC 8291 §3.3–3.4
		$ikm   = hash_hkdf( 'sha256', $shared, 32, "WebPush: info\x00" . $ua_public . $as_public, $auth_sec );
		$salt  = random_bytes( 16 );
		$cek   = hash_hkdf( 'sha256', $ikm, 16, "Content-Encoding: aes128gcm\x00", $salt );
		$nonce = hash_hkdf( 'sha256', $ikm, 12, "Content-Encoding: nonce\x00", $salt );
		// RFC 8188: um registro só; delimitador 0x02 (último registro)
		$plain = $payload . "\x02";
		$tag   = '';
		$ct    = openssl_encrypt( $plain, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16 );
		if ( false === $ct ) {
			return new WP_Error( 'pip_aes', 'Falha ao criptografar.' );
		}
		$rs = 4096;
		return $salt . pack( 'N', $rs ) . chr( 65 ) . $as_public . $ct . $tag;
	}

	/**
	 * Resultado padrão.
	 *
	 * @param bool   $ok    Entregue ao push service.
	 * @param int    $code  HTTP.
	 * @param string $error Mensagem.
	 * @param bool   $gone  Inscrição não existe mais (404/410).
	 * @param bool   $retry Vale tentar de novo depois (429, 5xx, rede).
	 * @param int    $after Segundos sugeridos pelo push service (Retry-After), 0 = sem.
	 * @return array
	 */
	private static function result( $ok, $code, $error = '', $gone = false, $retry = false, $after = 0 ) {
		return array(
			'ok'          => $ok,
			'code'        => (int) $code,
			'gone'        => $gone,
			'retry'       => $retry,
			'retry_after' => (int) $after,
			'error'       => (string) $error,
		);
	}

	/**
	 * Falha que não adianta repetir (configuração/conteúdo).
	 *
	 * @param string $msg Mensagem.
	 * @return array
	 */
	private static function fail( $msg ) {
		return self::result( false, 0, $msg );
	}

	/**
	 * Classifica a resposta HTTP do push service.
	 *
	 * @param int    $code        HTTP (0 = rede).
	 * @param string $body        Corpo (p/ mensagem).
	 * @param string $retry_after Header Retry-After (segundos ou data), opcional.
	 * @return array
	 */
	public static function classify( $code, $body = '', $retry_after = '' ) {
		$code = (int) $code;
		if ( $code >= 200 && $code < 300 ) {
			return self::result( true, $code );
		}
		$msg = trim( mb_substr( (string) $body, 0, 180 ) );
		if ( 404 === $code || 410 === $code ) {
			return self::result( false, $code, $msg ? $msg : 'inscrição expirada', true );
		}
		$after = 0;
		if ( '' !== (string) $retry_after ) {
			$after = ctype_digit( (string) $retry_after ) ? (int) $retry_after : max( 0, (int) ( strtotime( (string) $retry_after ) - time() ) );
			$after = min( $after, HOUR_IN_SECONDS );
		}
		if ( 0 === $code || 429 === $code || 408 === $code || $code >= 500 ) {
			return self::result( false, $code, $msg ? $msg : ( $code ? 'HTTP ' . $code : 'sem resposta' ), false, true, $after );
		}
		return self::result( false, $code, $msg ? $msg : 'HTTP ' . $code ); // 400/401/403/413…: não adianta repetir
	}

	/**
	 * Monta o pedido HTTP de um envio (cifra + assina). Devolve o request ou um resultado de falha.
	 *
	 * @param array $sub     {endpoint, p256dh, auth}.
	 * @param array $payload Conteúdo.
	 * @param array $keys    VAPID.
	 * @param array $opts    {ttl, urgency}.
	 * @return array {req:array}|{fail:array}
	 */
	private static function prepare( $sub, $payload, $keys, $opts ) {
		if ( ! self::endpoint_ok( isset( $sub['endpoint'] ) ? $sub['endpoint'] : '' ) ) {
			return array( 'fail' => self::result( false, 0, 'endpoint inválido', true ) ); // trata como sumido: sai da lista
		}
		$json = wp_json_encode( $payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( strlen( $json ) > self::MAX_PAYLOAD ) {
			return array( 'fail' => self::fail( 'Conteúdo grande demais (máx. ~3,8 KB).' ) );
		}
		$body = self::encrypt( $json, $sub['p256dh'], $sub['auth'] );
		if ( is_wp_error( $body ) ) {
			return array( 'fail' => self::result( false, 0, $body->get_error_message(), 'pip_keys' === $body->get_error_code() ) );
		}
		$vapid = self::vapid_header( $sub['endpoint'], $keys );
		if ( is_wp_error( $vapid ) ) {
			return array( 'fail' => self::fail( $vapid->get_error_message() ) );
		}
		$ttl     = isset( $opts['ttl'] ) ? (int) $opts['ttl'] : DAY_IN_SECONDS;
		$urgency = isset( $opts['urgency'] ) && in_array( $opts['urgency'], array( 'very-low', 'low', 'normal', 'high' ), true ) ? $opts['urgency'] : 'normal';
		return array(
			'req' => array(
				'url'     => $sub['endpoint'],
				'type'    => 'POST',
				'headers' => array(
					'Content-Type'     => 'application/octet-stream',
					'Content-Encoding' => 'aes128gcm',
					'TTL'              => (string) $ttl,
					'Urgency'          => $urgency,
					'Authorization'    => 'vapid ' . $vapid,
				),
				'data'    => $body,
			),
		);
	}

	/**
	 * Pré-condições comuns (licença, chaves, OpenSSL). Null = ok, senão o resultado de falha.
	 *
	 * @return array|null
	 */
	private static function precheck() {
		if ( class_exists( 'PIP_License' ) && ! PIP_License::active() ) {
			return self::fail( 'Push In Play pausado: ' . PIP_License::reason() . '.' );
		}
		if ( ! PIP_Vapid::keys() ) {
			return self::fail( 'Sem chave VAPID.' );
		}
		if ( ! self::supported() ) {
			return self::fail( 'OpenSSL sem ECDH/AES-GCM.' );
		}
		return null;
	}

	/**
	 * Envia UMA notificação (teste da equipe, inscrição nova). Para lotes use send_many().
	 *
	 * @param array $sub     {endpoint, p256dh, auth}.
	 * @param array $payload Conteúdo (vira JSON).
	 * @param array $opts    {ttl, urgency}.
	 * @return array {ok, code, gone, retry, retry_after, error}
	 */
	public static function send( $sub, $payload, $opts = array() ) {
		$pre = self::precheck();
		if ( $pre ) {
			return $pre;
		}
		$p = self::prepare( $sub, $payload, PIP_Vapid::keys(), $opts );
		if ( isset( $p['fail'] ) ) {
			return $p['fail'];
		}
		return self::post_single( $p['req'] );
	}

	/**
	 * Um POST pelo wp_remote_post (caminho sem paralelismo).
	 *
	 * @param array $req {url, headers, data}.
	 * @return array
	 */
	private static function post_single( $req ) {
		$res = wp_remote_post(
			$req['url'],
			array(
				'timeout'            => 12,
				'redirection'        => 0,
				'reject_unsafe_urls' => true,
				'headers'            => $req['headers'],
				'body'               => $req['data'],
				'user-agent'         => 'PushInPlay/' . PIP_VERSION . ' (WordPress)',
			)
		);
		if ( is_wp_error( $res ) ) {
			return self::result( false, 0, $res->get_error_message(), false, true );
		}
		return self::classify( wp_remote_retrieve_response_code( $res ), wp_remote_retrieve_body( $res ), (string) wp_remote_retrieve_header( $res, 'retry-after' ) );
	}

	/**
	 * Envia VÁRIAS notificações em paralelo (curl_multi). Sem curl_multi/Requests, cai no envio um a um.
	 *
	 * @param array $items Lista chave → {sub:{endpoint,p256dh,auth}, payload:array}.
	 * @param array $opts  {ttl, urgency}.
	 * @return array chave → resultado (ver send()).
	 */
	public static function send_many( $items, $opts = array() ) {
		$out = array();
		if ( ! $items ) {
			return $out;
		}
		$pre = self::precheck();
		if ( $pre ) {
			foreach ( $items as $k => $it ) {
				$out[ $k ] = $pre;
			}
			return $out;
		}
		$keys = PIP_Vapid::keys();
		$reqs = array();
		foreach ( $items as $k => $it ) {
			$p = self::prepare( $it['sub'], $it['payload'], $keys, $opts );
			if ( isset( $p['fail'] ) ) {
				$out[ $k ] = $p['fail'];
			} else {
				$reqs[ $k ] = $p['req'];
			}
		}
		if ( ! $reqs ) {
			return $out;
		}
		if ( ! self::parallel_supported() ) {
			foreach ( $reqs as $k => $r ) {
				$out[ $k ] = self::post_single( $r );
			}
			return $out;
		}
		$res = self::curl_many( $reqs, self::concurrency() );
		foreach ( $reqs as $k => $r ) {
			$out[ $k ] = isset( $res[ $k ] ) ? $res[ $k ] : self::result( false, 0, 'sem resultado', false, true );
		}
		return $out;
	}
}
