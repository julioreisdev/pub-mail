/*
 * Tradutor Invisível — decisão no <head>, antes da página aparecer.
 * Descobre o idioma do navegador, compara com o idioma do CONTEÚDO (vindo do servidor) e,
 * só se precisar traduzir, esconde a página, busca o mapa de traduções desta página e
 * carrega o script principal. Se nada disso for necessário, não faz nada.
 */
(function (w, d) {
  var h = d.documentElement;

  var SUPPORTED = ('af ak am ar as ay az be bg bho bm bn bs ca ceb ckb co cs cy da de doi dv ee el en eo es et eu fa fi fr fy ga gd gl gn gom gu ' +
    'ha haw hi hmn hr ht hu hy id ig ilo is it iw ja jw ka kk km kn ko kri ku ky la lb lg ln lo lt lus lv mai mg mi mk ml mn mni-Mtei mr ' +
    'ms mt my ne nl no nso ny om or pa pl ps pt pt-PT qu ro ru rw sa sd si sk sl sm sn so sq sr st su sv sw ta te tg th ti tk tl ' +
    'tr ts tt ug uk ur uz vi xh yi yo zh-CN zh-TW zu').split(' ');
  var ALIAS = { he: 'iw', jv: 'jw', fil: 'tl', nb: 'no', nn: 'no', mni: 'mni-Mtei', zh: 'zh-CN' };

  function norm(tag) {
    var t = String(tag || '').replace(/_/g, '-').toLowerCase().trim();
    if (!t) return '';
    if (t.indexOf('zh') === 0) return /-(tw|hk|mo|hant)/.test(t) ? 'zh-TW' : 'zh-CN';
    if (t === 'pt' || t === 'pt-br') return 'pt';
    if (t.indexOf('pt-') === 0) return 'pt-PT';
    if (t === 'mni-mtei') return 'mni-Mtei';
    var b = t.split('-')[0];
    if (ALIAS[b]) b = ALIAS[b];
    return SUPPORTED.indexOf(b) > -1 ? b : '';
  }
  function fam(c) { return c === 'pt-PT' ? 'pt' : c; }
  function same(a, b) { return !!a && !!b && fam(a) === fam(b); }

  // Caminho da página sem parâmetros de rastreio (chave do cache de traduções).
  function path() {
    var s = (w.location.search || '').replace(/^\?/, '').split('&').filter(function (kv) {
      return kv && !/^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|msclkid|mc_[a-z]+|_ga|_gl|ref|notranslate|trinv|trinv_lang|trinv_warm)(=|$)/i.test(kv);
    }).join('&');
    return (w.location.pathname || '/') + (s ? '?' + s : '');
  }

  try {
    var C = __TRINV_CFG__;
    // Pré-tradução aberta pelo painel do dono num quadro invisível: não esconde nada, só carrega
    // o script principal, que segmenta a página e pede as traduções dos idiomas da campanha.
    if (C.w) {
      if (!w.fetch || !w.DOMParser || !w.WeakSet || !w.Promise || !d.head) return;
      w.__trinv = { c: C, tl: '', full: true, warm: C.w, t0: Date.now(), u: C.ou || path(), rest: 1 };
      var wsc = d.createElement('script');
      wsc.src = C.js;
      wsc.async = true;
      d.head.appendChild(wsc);
      return;
    }
    var q = w.location.search || '';
    var ss = null;
    try { ss = w.sessionStorage; } catch (e) { /* bloqueado */ }
    var sget = function (k) { try { return ss ? ss.getItem(k) : null; } catch (e) { return null; } };
    var sset = function (k, v) { try { if (ss) { if (v === null) ss.removeItem(k); else ss.setItem(k, v); } } catch (e) { /* bloqueado */ } };

    // ?notranslate (ou ?trinv=off) mostra o original nesta aba; ?trinv=on volta ao normal.
    if (/[?&]trinv=on(&|$)/.test(q)) { sset('trinv_off', null); sset('trinv_lang', null); }
    if (/[?&](notranslate|trinv=off)(=|&|$)/.test(q)) sset('trinv_off', '1');
    if (sget('trinv_off')) return;

    // Robôs (Google, AdSense, redes sociais, Lighthouse) sempre veem o original.
    var ua = navigator.userAgent || '';
    if (/bot\b|bot\/|crawler|spider|slurp|mediapartners|adsbot|google-inspectiontool|googleother|chrome-lighthouse|facebookexternalhit|bingpreview|embedly|whatsapp|telegrambot|discordbot|pinterest/i.test(ua)) return;
    if (!w.fetch || !w.DOMParser || !w.MutationObserver || !w.WeakSet || !w.Promise || !d.head) return;

    // ?trinv_lang=es força um idioma (útil para o dono do site conferir).
    var m = q.match(/[?&]trinv_lang=([a-zA-Z_-]{2,12})/);
    if (m) sset('trinv_lang', m[1]);
    var raw = sget('trinv_lang') || (navigator.languages && navigator.languages[0]) || navigator.language || '';
    var tl = norm(raw);
    if (!tl || (C.ex || []).indexOf(tl) > -1) return;

    // completo:    o conteúdo está em outra língua → esconde e traduz tudo.
    // em volta:    o conteúdo já está na língua do visitante → não esconde nem toca no texto
    //              do post; traduz o que está em volta (menus, links para outros posts em
    //              outras línguas, comentários, textos do tema).
    var full = !same(tl, C.src);
    if (!full && !C.chrome) return;

    if (full) h.classList.add('trinv-wait');
    // o navegador não oferece a tradução dele (o Chrome mostraria um aviso).
    var meta = d.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    d.head.appendChild(meta);

    // aberto por endereço traduzido: o cache das traduções é o do endereço original (C.ou)
    var T = w.__trinv = { c: C, tl: tl, full: full, mode: full ? 'full' : 'around', t0: Date.now(), u: C.ou || path(), rest: 1 };
    var viaRest = function () {
      return fetch(C.pu + (C.pu.indexOf('?') > -1 ? '&' : '?') + 'u=' + encodeURIComponent(T.u) + '&l=' + encodeURIComponent(tl), { credentials: 'omit' })
        .then(function (r) {
          if (r.status === 401 || r.status === 403 || r.status === 404) T.rest = 0;
          return r.ok ? r.json() : null;
        });
    };
    // mapa da página: arquivo estático (servido sem PHP) cujo nome é o sha256 do caminho;
    // sem crypto.subtle (site sem https) ou sem pasta estática, pela API.
    var cs = w.crypto && w.crypto.subtle;
    var st = C.st && w.location.protocol === 'https:' ? String(C.st).replace(/^http:/, 'https:') : C.st;
    var hasMap = (C.sm || []).indexOf(tl) > -1; // o servidor já tem o mapa desta página neste idioma?
    T.pre = (st && !hasMap ? Promise.resolve(null) : st && cs && w.TextEncoder && w.Uint8Array
      ? cs.digest('SHA-256', new TextEncoder().encode(T.u)).then(function (buf) {
        var hex = '', a = new Uint8Array(buf);
        for (var i = 0; i < a.length; i++) hex += ('0' + a[i].toString(16)).slice(-2);
        return fetch(st + hex + '-' + tl + '.json', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : { m: {} }; });
      })
      : viaRest()
    ).catch(function () { return null; });

    var s = d.createElement('script');
    s.src = C.js;
    s.async = true;
    s.setAttribute('data-no-optimize', '1');
    s.setAttribute('data-cfasync', 'false');
    s.onerror = function () { h.classList.remove('trinv-wait'); };
    d.head.appendChild(s);
    setTimeout(function () { h.classList.remove('trinv-wait'); }, C.mw || 3000);
  } catch (e) {
    h.classList.remove('trinv-wait');
  }
})(window, document);
