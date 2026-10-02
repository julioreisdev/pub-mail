=== Tradutor Invisível ===
Contributors: julioreisdev
Tags: translation, translate, language, multilingual, automatic
Requires at least: 5.8
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.4.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Automatically shows every post and page in the language of each visitor's browser. No buttons, no pop-ups, no setup, no cost.

== Description ==

* **Invisible:** there is no language switcher, bar or pop-up. A visitor from Brazil simply reads in Portuguese; a visitor from Spain, in Spanish.
* **Content language:** the source language is detected from the text of each post and page, not from the WordPress language setting.
* **Fast:** each page is translated once per language and stored on the site and in the browser. Later visits show the translated page right away. Visitors who already read the content language download nothing extra.
* **Free, no API key:** it uses Google's public translation endpoint. If the site's server is rate-limited, the visitor's browser translates directly without interruption.
* **Safe for SEO and ads:** search engines and ad crawlers always receive the original page, and the HTML does not change. Ads, code, scripts and forms are never touched.

* **Campaign languages:** list the countries' languages of your campaign and every post or page you publish is translated in advance, so even the first visitor from each country gets the page instantly.
* **100% of the page:** when a post is already in the visitor's language, everything around it is still translated — menus, links and lists of other posts in other languages, comments and theme texts — without touching the post itself.
* **Translated addresses (URLs):** after the page is translated, the address bar shows the post or page address in the visitor's language (/grow-tomatoes/ → /cultivando-tomates-em-casa/). The translated address opens the same page when shared; the canonical link stays on the original.
* **Right-to-left languages:** visitors reading Arabic, Hebrew, Persian or Urdu get the text written right to left, without mirroring the theme layout.
* **Optional official translator:** add a Google Cloud Translation or Microsoft Translator key to guarantee translation even if the free service is unavailable (as a backup or always).

Whole sentences are translated at once, and the original links, bold text, icons and buttons are moved into place, so their scripts and styles keep working.

== Installation ==

1. Plugins → Add New → Upload Plugin → choose `tradutor-invisivel.zip`.
2. Activate. That's it.

Optional settings are under Settings → Tradutor Invisível.

== Frequently Asked Questions ==

= How can I see the site as a visitor from another country? =
Add `?trinv_lang=en` (or `es`, `fr`, `ja`…) to the address. `?trinv=on` returns to normal.

= How can I see the original? =
Add `?notranslate` to the address (valid for that browser tab).

= How do I keep a part of the page untranslated? =
Use the `notranslate` class (or the `translate="no"` attribute), or add CSS selectors in the settings.

= Does it work with page cache plugins? =
Yes. The HTML is always the original and the same for everyone; translation happens in the browser with translations served from the plugin cache. Tested with LiteSpeed Cache (minify, combine, delayed JavaScript), WP Super Cache and Autoptimize.

= Does it work with Elementor and WooCommerce? =
Yes. Elementor pages (accordions, tabs, counters, testimonials, animations) are translated, including content that only appears after a click, and the Elementor editor is never touched. In WooCommerce the shop, product pages, cart and checkout (block or classic) are translated and keep working; the buyer's name and address are never translated, and the cart, checkout and account pages keep their original addresses for payment gateways.

= Which browsers are supported? =
Chrome, Edge, Firefox and Safari on computers, iPhone and Android.

= Privacy =
The public text of your pages is sent to Google Translate. When the visitor's browser translates directly, that request comes from the visitor's browser. If you configure an official translator, the text is also sent to that provider (Google Cloud or Microsoft) from your server; the API key never reaches the browser.

== Changelog ==

= 1.4.2 =
* Theme labels inside a mixed line (for example "By" + author + date) are translated on their own from the English original, so a short label is never read as a different word ("Por" became "Setzen" in German).
* Lines mixing an untranslated theme text with text in the site language (for example "Published" + a date in Portuguese) are translated piece by piece, each from its own language, and put back in place.

= 1.4.1 =
* Store pages (shop, cart, checkout, my account) also get translated addresses; order addresses (order received, order pay, account orders) keep the original.
* Store words translated as a store: "Checkout" becomes "Finalizar compra", "Zur Kasse", "Pagar" (no more "Check-out" or "Confira") in menus, page titles, the tab title and the translated address.

= 1.4.0 =
* Elementor: tested with accordions, tabs, counters, testimonials, alerts and entrance animations; content revealed by a click is translated too; the editor is untouched.
* WooCommerce: shop, product, cart and checkout blocks (React) translated and working; the buyer's name and address are never translated; cart, checkout, account and order pages keep their original addresses.
* The site name is kept inside sentences around the content (footer copyright, header), not only in the logo and the tab title.
* Tab title separators (" – ", " | ") are kept exactly as in the original.
* Right-to-left languages: text blocks built with <div> (testimonials, page builders) also get the right direction.
* The address bar only changes on the post's own address (never on /2/, comment pages or order pages).
* Comments are never treated as the post text (Astra marks each comment as content): visitors reading the post's language get them translated.
* Example text (placeholder) of text areas is translated, such as the order notes field; what the visitor types is never touched.
* Pieces the site redraws after translation (the WooCommerce mini-cart counter, interactive blocks) come back translated instantly, without new requests; only new text is sent.
* Pages without their own text (cart, checkout, builders that keep the text outside the post): the language is identified by the translator instead of assuming the site language.
* Tested with LiteSpeed Cache, WP Super Cache, Firefox, Safari, iPhone and Android, and the Astra, GeneratePress, Hello Elementor, Kadence, Twenty Twenty-Five and Twenty Twenty-One themes.

= 1.3.0 =
* Post and page addresses (URLs) in the visitor's language, generated once per post and language; they open the same page when shared.
* The site name is never translated in the browser tab title.
* WordPress emoji images are handled as the emoji itself (no repeated translations, same result in pre-translation).
* Faster first visit: all source languages go to the translator in one parallel round, and repeated pieces reuse the translation already on its way.

= 1.2.0 =
* Pages already in the visitor's language: menus, links to posts in other languages, related posts, comments and theme texts are translated too.
* Theme and WordPress texts are translated from their English originals (visitors in English see the original texts).
* Names of authors and commenters are never translated.
* Content added by scripts while the page loads (carousels, lists) is translated before the page appears.
* Tested with Twenty Twenty-Five, Twenty Twenty-One and Kadence.

= 1.1.0 =
* Campaign languages: pages are translated in advance when published or updated (runs from the dashboard, with ad pixels blocked).
* Optional official translator (Google Cloud Translation or Microsoft Translator), used as a backup or always.
* Right-to-left text direction for Arabic, Hebrew, Persian, Urdu and similar languages.

= 1.0.0 =
* First release.
