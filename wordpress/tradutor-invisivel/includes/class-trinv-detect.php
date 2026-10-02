<?php
/**
 * Detecta o idioma de um texto (o conteúdo do post — nunca a configuração do WordPress).
 *
 * Usado só como "dica" para decidir, antes da página aparecer, se ela precisa ser traduzida.
 * Quando não tem certeza, devolve '' (aí o navegador traduz e o Google confirma o idioma).
 *
 * @package TradutorInvisivel
 */

defined( 'ABSPATH' ) || exit;

/**
 * Detector por escrita (alfabeto) + palavras funcionais.
 */
class TRINV_Detect {

	/**
	 * Escritas não latinas: [regex de caracteres, idioma].
	 *
	 * @var array
	 */
	const SCRIPTS = array(
		array( '/[\x{AC00}-\x{D7AF}\x{1100}-\x{11FF}]/u', 'ko' ),
		array( '/[\x{3040}-\x{30FF}]/u', 'ja' ),
		array( '/[\x{4E00}-\x{9FFF}]/u', 'zh-CN' ),
		array( '/[\x{0400}-\x{04FF}]/u', 'ru' ),
		array( '/[\x{0600}-\x{06FF}]/u', 'ar' ),
		array( '/[\x{0590}-\x{05FF}]/u', 'iw' ),
		array( '/[\x{0900}-\x{097F}]/u', 'hi' ),
		array( '/[\x{0E00}-\x{0E7F}]/u', 'th' ),
		array( '/[\x{0370}-\x{03FF}]/u', 'el' ),
		array( '/[\x{0980}-\x{09FF}]/u', 'bn' ),
		array( '/[\x{0B80}-\x{0BFF}]/u', 'ta' ),
		array( '/[\x{10A0}-\x{10FF}]/u', 'ka' ),
		array( '/[\x{0530}-\x{058F}]/u', 'hy' ),
	);

	/**
	 * Palavras funcionais mais frequentes por idioma (escrita latina).
	 *
	 * @var array
	 */
	const WORDS = array(
		'en' => 'the and of to is that for it with as was on are you this be at by not or have from but they we an which can will your our has more their if about what when there would been were who how also just into than only its',
		'pt' => 'de que não uma um para com os se na no por mais dos das como mas foi ao ele ela isso já também só pelo pela você são está até quando muito nos seu sua ou ser tem é à às em do da essa esse este esta pode sobre depois ainda seus suas',
		'es' => 'el la de que y en los las del se por un una para con no es al lo como más pero sus le ya este sí porque esta entre cuando muy sin sobre también me hasta hay donde está son fue ha han otro todos puede',
		'fr' => 'le la les de des et est un une du en que qui dans pour pas sur au avec ce il elle sont par plus ne se nous vous mais ou cette aux leur été être très sans comme tout fait peut aussi',
		'de' => 'der die und das ist nicht ein eine zu den von mit sich des auf für im dem es auch als an wird sie ich wir oder aber nach bei noch wie einem einer durch über sind vom kann haben werden',
		'it' => 'il di che e la per un una del della non sono con gli le si in da al lo dei delle come anche più ma nel nella questo questa ha alla degli essere ci è suo sua molto',
		'nl' => 'de het een en van is dat niet op te zijn met voor er in ook aan als bij maar wordt door naar om deze worden dit nog heeft je wij zij hun kan meer',
		'pl' => 'i w nie na się z do to że jest o jak ale po co tak za od przez dla jego tylko może być są jej już gdy oraz tym czy było bardzo',
		'tr' => 've bir bu da de için ile çok daha gibi olarak en ama olan var ne kadar sonra her değil mi ben sen o biz onlar şey göre yok ise',
		'id' => 'yang dan di ini itu dengan untuk dari tidak dalam akan pada juga ke ada saya kami mereka bisa atau karena oleh sudah lebih seperti adalah kita anda',
		'ro' => 'și în de la cu pe nu o un că este sunt din pentru mai care ce se lui ale al dar fost acest această sau',
		'sv' => 'och att det i som en på är av för med till den har de inte om ett men var jag så vi kan från eller när ska',
		'cs' => 'a se na je že v to do s z o jako ale pro jsou by jeho jak být také po tak jen které který která však',
		'vi' => 'của và là các có được trong cho không những với này một người khi để đã cũng như từ về thì sẽ tôi bạn chúng',
	);

	/**
	 * Detecta o idioma de um texto.
	 *
	 * @param string $text Texto (HTML é removido).
	 * @return string Código do Google ou '' se não houver certeza.
	 */
	public static function detect( $text ) {
		$text = wp_strip_all_tags( strip_shortcodes( (string) $text ) );
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$text = function_exists( 'mb_substr' ) ? mb_substr( $text, 0, 20000 ) : substr( $text, 0, 20000 );
		if ( '' === trim( $text ) ) {
			return '';
		}

		// 1) Escrita (alfabeto): conta letras de cada escrita contra letras latinas.
		$latin = preg_match_all( '/[a-zA-Z\x{00C0}-\x{024F}]/u', $text );
		$best  = '';
		$max   = 0;
		foreach ( self::SCRIPTS as $s ) {
			$n = preg_match_all( $s[0], $text );
			if ( $n > $max ) {
				$max  = $n;
				$best = $s[1];
			}
		}
		if ( $max > 0 && $max >= $latin ) {
			if ( 'zh-CN' === $best && preg_match_all( '/[\x{3040}-\x{30FF}]/u', $text ) > 0 ) {
				return 'ja'; // japonês mistura kanji com kana.
			}
			if ( 'ru' === $best && preg_match( '/[іїєґІЇЄҐ]/u', $text ) ) {
				return 'uk';
			}
			if ( 'ar' === $best && preg_match_all( '/[ٹڈڑںے]/u', $text ) > 2 ) {
				return 'ur';
			}
			if ( 'ar' === $best && preg_match_all( '/[پچژگ]/u', $text ) > 2 ) {
				return 'fa';
			}
			return $max >= 20 ? $best : '';
		}

		// 2) Latim: palavras funcionais.
		$lower  = function_exists( 'mb_strtolower' ) ? mb_strtolower( $text, 'UTF-8' ) : strtolower( $text );
		$tokens = preg_split( '/[^\p{L}]+/u', $lower, -1, PREG_SPLIT_NO_EMPTY );
		if ( ! $tokens ) {
			return '';
		}
		$tokens = array_slice( $tokens, 0, 4000 );
		$total  = count( $tokens );
		if ( $total < 12 ) {
			return '';
		}
		static $sets = null;
		if ( null === $sets ) {
			$sets = array();
			foreach ( self::WORDS as $lang => $words ) {
				$sets[ $lang ] = array_flip( explode( ' ', $words ) );
			}
		}
		$scores = array_fill_keys( array_keys( $sets ), 0 );
		foreach ( $tokens as $tk ) {
			foreach ( $sets as $lang => $set ) {
				if ( isset( $set[ $tk ] ) ) {
					++$scores[ $lang ];
				}
			}
		}
		arsort( $scores );
		$langs  = array_keys( $scores );
		$first  = $scores[ $langs[0] ];
		$second = $scores[ $langs[1] ];
		// precisa de evidência mínima e vantagem clara sobre o 2º colocado.
		if ( $first < 5 || $first < $total * 0.08 || $first < $second * 1.25 ) {
			return '';
		}
		return $langs[0];
	}
}
