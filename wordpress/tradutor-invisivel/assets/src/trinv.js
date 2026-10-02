/*
 * Tradutor Invisível — tradução da página (só é baixado quando precisa traduzir).
 *
 * 1. Divide o <body> em unidades de frase: um bloco com links/negrito dentro vira UM trecho
 *    em HTML com marcadores (<a id="0">…</a>), para o tradutor ver a frase inteira e mudar
 *    a ordem das palavras quando a língua pede. Na volta, os elementos ORIGINAIS são movidos
 *    para as posições novas (nunca recriados): eventos, classes e atributos continuam.
 * 2. Busca as traduções em 3 camadas: navegador (localStorage) → mapa da página (baixado no
 *    <head>) → servidor (cache + Google). Se o servidor não puder, o navegador fala direto com
 *    o Google.
 * 3. Revela a página e observa o que aparecer depois (comentários, carregamento infinito…).
 */
(function (w, d) {
  'use strict';
  var T = w.__trinv;
  if (!T || T.started) return;
  T.started = 1;
  T.tx = Date.now() - T.t0; // diagnóstico: quando o script começou a rodar

  var C = T.c, TL = T.tl, H = d.documentElement;
  if (!T.mode) T.mode = T.full ? 'full' : 'around'; // HTML guardado por cache com o boot antigo
  var LETTER = (function () { try { return new RegExp('\\p{L}', 'u'); } catch (e) { return /[A-Za-z]/; } })();
  var WS = /\s+/g;
  function set(s) { var o = {}; s.split(' ').forEach(function (t) { o[t] = 1; }); return o; }
  var SKIP = set('SCRIPT STYLE NOSCRIPT TEMPLATE CODE PRE KBD SAMP VAR TEXTAREA SVG MATH CANVAS IFRAME OBJECT EMBED VIDEO AUDIO SOURCE TRACK');
  var INLINE = set('A ABBR B BDI BDO BIG BR CITE DATA DEL DFN EM FONT I IMG INS LABEL MARK Q S SMALL SPAN STRIKE STRONG SUB SUP TIME TT U WBR SVG CODE KBD SAMP VAR INPUT PICTURE');
  var ATOMIC = set('BR WBR IMG INPUT PICTURE');
  var SAFE = set('a b i u s em strong small mark span sub sup q cite abbr time label font del ins');
  var ATTRS = ['title', 'alt', 'placeholder', 'aria-label'];
  var GEPS = [
    'https://translate.googleapis.com/translate_a/t?client=gtx',
    'https://translate.googleapis.com/translate_a/t?client=dict-chrome-ex',
    'https://clients5.google.com/translate_a/t?client=dict-chrome-ex',
    'https://translate.google.com/translate_a/t?client=gtx'
  ];
  var mine = new WeakSet();      // textos que nós escrevemos (não traduzir de novo)
  var produced = {};             // traduções já aplicadas (texto puro): cópia delas feita pelo site
                                 // (carrossel que clona slides) não é traduzida de novo
  var attrMine = new WeakMap();  // atributos que nós escrevemos
  var tries = new WeakMap();     // quantas vezes um bloco foi retraduzido (anti-laço)
  var userSel = C.sel || '';
  // nome do site e logo são marca: nunca traduzir.
  var BRAND = '.wp-block-site-title, .site-title, #site-title, .wp-block-site-logo, .site-logo, .custom-logo-link, .navbar-brand, .site-branding .logo';
  // nomes de pessoas (autor do post, quem comentou): "Mark" não vira "Marque"
  // dados do comprador (nome, endereço, cidade): nunca traduzidos ("Ana Teste" virava "アナテスト")
  var PRIVATE = 'address, .wc-block-components-address-card__address-section';
  var NAMES = '.fn, .wp-block-comment-author-name, .wp-block-post-author-name, .comment-author-link, .elementor-testimonial-name, .elementor-author-box__name, .woocommerce-review__author';
  // área do conteúdo do post (idioma = C.src); fora dela é o tema (idioma = C.loc).
  var CONTENT = '.entry-content, .wp-block-post-content, .post-content, .article-content, .entry-summary, .wp-block-post-excerpt, .entry-title, .wp-block-post-title, [itemprop="articleBody"], .elementor-widget-theme-post-content, .td-post-content, .post-body, .single-content';
  // listas de OUTROS posts (mais posts, relacionados, recentes): cada um pode ter outro idioma.
  var LISTS = '.wp-block-query, .wp-block-post-template, .wp-block-latest-posts, .related, .related-posts, .jp-relatedposts, .yarpp-related, .widget_recent_entries, .crp_related, ' +
    '.entry-related, .kadence-posts-list, .loop-entry, .post-navigation, .posts-navigation, .nav-links, .elementor-posts-container, .elementor-widget-posts, .wp-block-post-navigation-link';
  // bloco de OUTRO post (listas, carrosséis, relacionados): o 1º ancestral com a classe post-N
  // que o WordPress põe em cada post diz de qual post é o trecho.
  var POSTID = /(?:^|\s)post-(\d+)(?:\s|$)/;
  function otherPost(el) {
    for (var e = el; e && e.nodeType === 1 && e !== d.body; e = e.parentElement) {
      var m = POSTID.exec(e.getAttribute('class') || '');
      if (m) return +m[1] !== +(C.p || 0);
    }
    return false;
  }
  var SEP = String.fromCharCode(1); // separa a dica de idioma do texto nas chaves de cache
  // direção do texto: línguas da direita para a esquerda recebem dir="rtl" em cada bloco
  // traduzido (o layout do tema não é virado); página RTL traduzida para língua LTR, o contrário.
  var RTL = set('ar iw fa ur yi ps sd ug dv ckb');
  var TEXTBLOCK = set('P H1 H2 H3 H4 H5 H6 LI TD TH DT DD BLOCKQUOTE FIGCAPTION CAPTION LABEL BUTTON OPTION SUMMARY LEGEND A SPAN');
  var PAGE_RTL = /^rtl$/i.test(H.getAttribute('dir') || '') || !!(d.body && /^rtl$/i.test(d.body.getAttribute('dir') || ''));
  var parser = new DOMParser();
  var gStart = 0;

  function tag(n) { return (n.nodeName || '').toUpperCase(); }
  function fam(c) { return c === 'pt-PT' ? 'pt' : c; }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function parse(html) { return parser.parseFromString('<!doctype html><body>' + html, 'text/html').body; }
  function decode(html) { return parse(html).textContent; }
  function mk(text) { var t = d.createTextNode(text); mine.add(t); return t; }

  // ------------------------------------------------------------------ o que não traduzir
  function excluded(el) {
    if (SKIP[tag(el)]) return true;
    if (el !== H && el.getAttribute('translate') === 'no') return true;
    var cl = el.classList;
    if (cl && (cl.contains('notranslate') || cl.contains('trinv-no') || cl.contains('adsbygoogle'))) return true;
    var id = el.id;
    if (id && (id === 'wpadminbar' || /^(google_ads|div-gpt-ad|aswift|trinv)/.test(id))) return true;
    if (el.getAttribute('contenteditable') !== null && el.getAttribute('contenteditable') !== 'false') return true;
    if (el.matches && (el.matches(BRAND) || el.matches(NAMES) || el.matches(PRIVATE))) return true;
    if (userSel) {
      try { if (el.matches(userSel)) return true; } catch (e) { userSel = ''; }
    }
    return false;
  }
  // Com 1 a 3 palavras a detecção automática do Google erra ("em" vira inglês, "Blog" vira
  // "Blogue"). Nesses casos informamos a língua de origem pelo lugar do trecho na página.
  // Textos do tema que o WordPress já escreveu no idioma do site (lista vinda do servidor).
  var LOC = null;
  function locSet() {
    if (LOC) return LOC;
    LOC = {};
    try {
      var n = d.getElementById('trinv-loc');
      var arr = n ? JSON.parse(n.textContent || '[]') : [];
      for (var i = 0; i < arr.length; i++) LOC[String(arr[i]).replace(WS, ' ').trim()] = 1;
    } catch (e) { /* sem lista */ }
    return LOC;
  }
  // Textos do tema/WordPress (traduzidos no idioma do site) → original em inglês.
  var ORIG = null;
  function origOf(t) {
    if (!ORIG) {
      ORIG = {};
      try {
        var n = d.getElementById('trinv-orig');
        var o = n ? JSON.parse(n.textContent || '{}') : {};
        Object.keys(o).forEach(function (k) { var v = String(o[k] || '').replace(WS, ' ').trim(); if (v) ORIG[String(k).replace(WS, ' ').trim()] = v; });
      } catch (e) { /* sem lista */ }
    }
    return Object.prototype.hasOwnProperty.call(ORIG, t) ? ORIG[t] : null;
  }
  var LOCP = null; // frases do tema (2+ palavras), da maior para a menor
  function locPhrases() {
    if (LOCP) return LOCP;
    LOCP = Object.keys(locSet()).filter(function (k) { return k.length >= 8 && k.indexOf(' ') > 0 && LETTER.test(k); });
    LOCP.sort(function (a, b) { return b.length - a.length; });
    return LOCP;
  }
  function hintFor(el, s) {
    var t = decode(s).replace(WS, ' ').trim();
    if (!t) return '';
    // escrita não latina (japonês, cirílico, árabe…) o Google reconhece bem mesmo curta
    for (var i = 0; i < t.length; i++) if (t.charCodeAt(i) > 0x24F && LETTER.test(t.charAt(i))) return '';
    if (t.length > 30 || t.split(' ').length > 3) {
      // bloco longo fora do post com frase do tema no idioma do site ("© 2026 Sites - Tema
      // WordPress por Kadence WP"): cheio de marcas, a detecção automática acharia inglês.
      if (C.loc && !inContent(el)) { var lp = locPhrases(); for (var j = 0; j < lp.length; j++) if (t.indexOf(lp[j]) > -1) return C.loc; }
      return '';
    }
    if (C.loc && locSet()[t]) return C.loc;                         // texto do tema → idioma do WordPress
    if (inContent(el)) return C.src; // no post → idioma do conteúdo
    return '';                                                        // resto: detecção automática
  }
  // Trechos com idioma conhecido vindos do servidor (títulos e resumos de outros posts,
  // comentários, textos do tema sem tradução): viram o idioma de origem do bloco.
  var FX = null, FXL = null;
  function fxLoad() {
    if (FX) return;
    FX = {};
    FXL = [];
    try {
      var n = d.getElementById('trinv-fx');
      var a = n ? JSON.parse(n.textContent || '[]') : [];
      for (var i = 0; i < a.length; i++) {
        var t = String(a[i] && a[i][0] || '').replace(WS, ' ').trim(), l = String(a[i] && a[i][1] || '');
        if (t && l && !Object.prototype.hasOwnProperty.call(FX, t)) { FX[t] = l; FXL.push([t, l]); }
      }
      FXL.sort(function (x, y) { return y[0].length - x[0].length; });
    } catch (e) { /* sem lista */ }
  }
  function letters(str) { var n = 0; for (var i = 0; i < str.length; i++) if (LETTER.test(str.charAt(i))) n++; return n; }
  // Idioma do bloco pelos trechos conhecidos: null = nenhum trecho; '' = trechos de línguas
  // diferentes no mesmo bloco (vai com detecção automática, nunca é descartado).
  function fxLang(s) {
    fxLoad();
    if (!FXL.length) return null;
    var t = decode(s).replace(WS, ' ').trim();
    if (!t) return null;
    if (Object.prototype.hasOwnProperty.call(FX, t)) return FX[t];
    var found = {}, rest = t;
    for (var i = 0; i < FXL.length; i++) {
      var f = FXL[i][0];
      if (f.length > t.length) {
        if (t.length >= 12 && f.indexOf(t) > -1) return FXL[i][1]; // pedaço de um resumo/comentário
        continue;
      }
      if (rest.indexOf(f) > -1) { rest = rest.split(f).join(' '); found[fam(FXL[i][1])] = FXL[i][1]; }
    }
    var ls = Object.keys(found);
    if (!ls.length || letters(rest) * 3 > letters(t)) return null; // os trechos precisam ser quase todo o bloco
    return ls.length === 1 ? found[ls[0]] : '';
  }
  // comentários nunca são o texto do post (o Astra põe .entry-content dentro de cada comentário)
  var COMMENTS = '#comments, .comments-area, .comment-list, .commentlist, .wp-block-comments, .wp-block-comment-template, li.comment, .comment-body, .comment-respond';
  function inContent(el) { return !!(C.src && el && el.closest && el.closest(CONTENT) && !el.closest(LISTS) && !el.closest(COMMENTS) && !otherPost(el)); }
  function hintOf(el, s) { var f = fxLang(s); return f !== null ? f : hintFor(el, s); }
  // O que traduzir para cada idioma: 'full' = conteúdo em outra língua (tudo);
  // 'around' = conteúdo já na língua do visitante (só o que está em volta: menus, navegação,
  // listas de outros posts, comentários, textos do tema — o texto do post não é tocado).
  function modeFor(L) {
    if (!C.src || fam(L) !== fam(C.src)) return 'full';
    return C.chrome ? 'around' : '';
  }
  function wanted(u, L, mode) {
    if (!mode || (u.lang && fam(u.lang) === fam(L))) return false;
    return mode === 'full' || (!u.title && !u.inContent);
  }
  // q = texto enviado ao tradutor (o original em inglês, quando o site traduziu o texto do tema)
  function key(u, wrapped) { var s = wrapped ? u.wsrc : (u.q || u.src); return u.sl ? u.sl + SEP + s : s; }
  function excludedUp(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) if (excluded(e)) return true;
    return false;
  }
  function inlineOnly(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      var t = tag(c);
      if (!INLINE[t]) return false;
      if (ATOMIC[t] || excluded(c)) continue;
      if (!inlineOnly(c)) return false;
    }
    return true;
  }
  function hasText(el) {
    var tw = d.createTreeWalker(el, 4 /* SHOW_TEXT */, null);
    for (var n = tw.nextNode(); n; n = tw.nextNode()) if (LETTER.test(n.data) && !excludedUp2(n.parentNode, el)) return true;
    return false;
  }
  function excludedUp2(from, stop) {
    for (var e = from; e && e !== stop; e = e.parentElement) if (excluded(e) || island(e)) return true;
    return false;
  }
  // "Ilha": trecho dentro de uma frase que é traduzido À PARTE, com a própria origem — links de
  // categoria/tag ("Categorized as <Sem categoria>": tema em inglês, nome em português) e
  // trechos de idioma conhecido (título de outro post). Na frase, a ilha vira um marcador.
  var ISLAND = 'a[rel~="tag"], a[rel~="category"]';
  var islandMemo = new WeakMap();
  function island(el) {
    if (!el || el.nodeType !== 1 || !INLINE[tag(el)] || ATOMIC[tag(el)]) return false;
    if (islandMemo.has(el)) return islandMemo.get(el);
    var r = false;
    if (el.matches && el.matches(ISLAND)) r = true;
    else {
      fxLoad();
      var t = (el.textContent || '').replace(WS, ' ').trim();
      if (FXL.length) r = t.length >= 2 && Object.prototype.hasOwnProperty.call(FX, t);
      // rótulo do tema dentro de uma frase fora do post ("Por" + autor + data no Kadence): vai à
      // parte, pelo original em inglês ("By" → "Von"); junto, "Por" virava o verbo pôr ("Setzen")
      if (!r && C.loc && t.length >= 2 && origOf(t) !== null && !inContent(el) && restHasText(el)) r = true;
    }
    islandMemo.set(el, r);
    return r;
  }
  // o bloco em volta tem outro texto além deste elemento (nomes e trechos excluídos não contam)?
  // "<nome> disse:" continua inteiro (vai como "<nome> says:"); "Por <autor> 30 de setembro" não.
  function restHasText(el) {
    var blk = el.parentElement;
    while (blk && blk !== d.body && INLINE[tag(blk)]) blk = blk.parentElement;
    if (!blk) return false;
    var tw = d.createTreeWalker(blk, 4, null);
    for (var n = tw.nextNode(); n; n = tw.nextNode()) {
      if (el.contains(n) || !LETTER.test(n.data)) continue;
      if (!excludedUp2(n.parentNode, blk)) return true;
    }
    return false;
  }
  // ilhas dentro de elementos em linha de uma frase (sem entrar nelas)
  function islandsIn(nodes, list) {
    nodes.forEach(function (n) {
      if (n.nodeType !== 1 || ATOMIC[tag(n)] || excluded(n)) return;
      if (island(n)) { list.push(n); return; }
      islandsIn(Array.prototype.slice.call(n.childNodes), list);
    });
    return list;
  }

  // ------------------------------------------------------------------ segmentação
  function segment(root, out) {
    (function walk(el) {
      if (excluded(el)) return;
      var run = [], letters = false;
      function flush() {
        if (run.length && letters && !isMine(run)) { var mu = makeUnit(el, run); if (mu) out.push(mu); }
        var isl = islandsIn(run, []);
        run = [];
        letters = false;
        isl.forEach(walk);
      }
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          run.push(c);
          if (!letters && LETTER.test(c.data)) letters = true;
        } else if (c.nodeType === 1) {
          var t = tag(c);
          if (INLINE[t] && (ATOMIC[t] || excluded(c) || island(c) || inlineOnly(c))) {
            run.push(c);
            if (!letters && !ATOMIC[t] && !excluded(c) && !island(c) && hasText(c)) letters = true;
          } else {
            flush();
            walk(c);
          }
        }
      }
      flush();
    })(root);
    return out;
  }
  function isMine(run) {
    var any = false;
    for (var i = 0; i < run.length; i++) {
      var n = run[i];
      if (n.nodeType === 3) {
        if (LETTER.test(n.data)) { if (!mine.has(n)) return false; any = true; }
      } else if (!ATOMIC[tag(n)] && !excluded(n) && !island(n)) {
        var tw = d.createTreeWalker(n, 4, null);
        for (var t = tw.nextNode(); t; t = tw.nextNode()) {
          if (LETTER.test(t.data) && !excludedUp2(t.parentNode, n)) { if (!mine.has(t)) return false; any = true; }
        }
      }
    }
    return any;
  }
  // Nome do site dentro de uma frase fora do conteúdo ("© 2026 Sites – Tema por…"): vai como
  // marcador e volta intacto ("Sites" virava "サイト"). Dentro do post não: um nome comum
  // ("Blog", "Receitas") precisa continuar traduzível no texto.
  var BN = String(C.bn || '').replace(WS, ' ').trim();
  function wordCh(c) { return !!c && (LETTER.test(c) || /[0-9]/.test(c)); }
  function brandParts(t) {
    if (BN.length < 2) return null;
    var out = [], last = 0, i = t.indexOf(BN);
    while (i > -1) {
      if (!wordCh(t.charAt(i - 1)) && !wordCh(t.charAt(i + BN.length))) { out.push(t.slice(last, i)); last = i + BN.length; }
      i = t.indexOf(BN, i + BN.length);
    }
    if (!out.length) return null;
    out.push(t.slice(last));
    return out;
  }
  function makeUnit(parent, nodes) {
    var ctx = { els: [], at: [], par: [], pre: [], post: [], lt: [], br: !inContent(parent) };
    var s = ser(nodes, ctx, -1).replace(/ {2,}/g, ' ');
    var lead = /^\s/.test(s), trail = /\s$/.test(s);
    s = s.trim();
    for (var k = 0; k < ctx.els.length; k++) {
      if (!ctx.at[k]) continue;
      var m = new RegExp('(\\s?)<span id="' + k + '"></span>(\\s?)').exec(s);
      if (m) { ctx.pre[k] = !!m[1]; ctx.post[k] = !!m[2]; }
    }
    var plainT = decode(s).replace(WS, ' ').trim();
    if (produced[plainT]) return null; // cópia de algo que já traduzimos
    if (!LETTER.test(plainT)) return null; // só o nome do site, texto já traduzido e números ("© 2026 Sites")
    var u = { parent: parent, nodes: nodes.slice(), ctx: ctx, src: s, lead: lead, trail: trail, inContent: inContent(parent) };
    // texto do tema: parte do original em inglês. Vale também com elementos em volta (nome de
    // quem comentou: "<nome> <span>disse:</span>" → "<nome> <span>says:</span>"), desde que o
    // texto apareça inteiro num trecho só.
    var o = C.loc ? origOf(plainT) : null;
    var et = esc(plainT);
    if (o !== null && s.split(et).length === 2) { u.q = s.split(et).join(esc(o)); u.sl = 'en'; u.lang = C.loc; }
    else u.lang = u.sl = hintOf(parent, s);
    if (u.lang && fam(u.lang) === fam(TL)) return null; // já está na língua do visitante
    if (!u.q && !u.lang) splitMixed(u, parent);
    if (u.mix) return u;
    var nav = isNavLabel(parent, s);
    if (nav) u.wsrc = (nav === 2 ? STORE_MENU : 'Menu: ') + '<span id="m">' + (u.q || s) + '</span>';
    else if (C.ws && shortLabel(s)) u.wsrc = STORE_PAGE + '<span id="m">' + (u.q || s) + '</span>';
    return u;
  }
  // Frase do tema com idiomas misturados: "Published" (tema sem tradução, inglês) + data em
  // português. Junto, o Google acha que é tudo português e não traduz o "Published". Cada pedaço
  // de idioma conhecido vai à parte (com o original em inglês, quando há) e o resto com a própria
  // dica; a tradução é remontada na ordem, com os mesmos espaços.
  function knownLang(t) {
    if (t.length < 2 || !LETTER.test(t)) return null;
    var o = C.loc ? origOf(t) : null;
    if (o !== null) return { q: esc(o), sl: 'en' };
    fxLoad();
    if (FXL.length && Object.prototype.hasOwnProperty.call(FX, t) && FX[t]) return { q: null, sl: FX[t] };
    return null;
  }
  function splitMixed(u, parent) {
    if (u.src.indexOf('<') < 0 || inContent(parent)) return; // um texto só não se divide; o texto do post não é tocado
    var top = Array.prototype.slice.call(parse(u.src).childNodes), parts = [], cur = null, known = 0, other = 0, open = '', close = '';
    // frase inteira dentro de um elemento só (<span class="posted-on">Published <time>…</time></span>): entra nele
    for (var dpt = 0; dpt < 4; dpt++) {
      var els = top.filter(function (x) { return x.nodeType === 1 || (x.nodeType === 3 && /\S/.test(x.data)); });
      if (els.length !== 1 || els[0].nodeType !== 1 || !els[0].childNodes.length) break;
      var oh = els[0].outerHTML;
      open += oh.slice(0, oh.indexOf('>') + 1);
      close = '</' + els[0].nodeName.toLowerCase() + '>' + close;
      top = Array.prototype.slice.call(els[0].childNodes);
    }
    var flush = function () { if (cur) { parts.push(cur); cur = null; } };
    for (var i = 0; i < top.length; i++) {
      var n = top[i];
      if (n.nodeType === 3) {
        var raw = n.data, t = raw.replace(WS, ' ').trim(), k = t ? knownLang(t) : null;
        if (k) {
          flush();
          // já na língua do visitante: fica como está (texto do tema no idioma do site, para quem lê esse idioma)
          var same = k.q ? C.loc && fam(C.loc) === fam(TL) : fam(k.sl) === fam(TL);
          parts.push({ src: esc(t), q: k.q, sl: k.sl, raw: same ? 1 : 0, lead: /^\s/.test(raw), trail: /\s$/.test(raw) });
          known++;
          continue;
        }
        if (!cur) cur = { html: '' };
        cur.html += esc(raw);
      } else {
        if (!cur) cur = { html: '' };
        cur.html += n.outerHTML;
      }
    }
    flush();
    if (!known) return;
    for (var j = 0; j < parts.length; j++) {
      var g = parts[j];
      if (g.html === undefined) continue;
      g.lead = /^\s/.test(g.html);
      g.trail = /\s$/.test(g.html);
      g.src = g.html.trim();
      var plainG = decode(g.src).replace(WS, ' ').trim();
      if (!LETTER.test(plainG)) { g.raw = 1; continue; }
      other++;
      g.sl = hintOf(parent, g.src);
      if (g.sl && fam(g.sl) === fam(TL)) g.raw = 1; // já está na língua do visitante
    }
    if (!other && parts.length < 2) return;
    u.mix = parts;
    u.wrap = [open, close];
    u.lang = ''; // misturado
  }
  function partKey(p) { var x = p.q || p.src; return p.sl ? p.sl + SEP + x : x; }
  function ukeys(u) {
    if (u.mix) return u.mix.filter(function (p) { return !p.raw; }).map(partKey);
    return u.wsrc ? [key(u), key(u, 1)] : [key(u)];
  }
  function compose(u, get) {
    var out = '';
    for (var i = 0; i < u.mix.length; i++) {
      var p = u.mix[i], t = p.raw ? p.src : get(partKey(p));
      if (typeof t !== 'string') return null;
      if (out && (p.lead || u.mix[i - 1].trail)) out += ' ';
      out += String(t).trim();
    }
    return u.wrap ? u.wrap[0] + out + u.wrap[1] : out;
  }
  // Loja (WooCommerce): com "Menu:" o Google lê cardápio e traduz "Checkout" como "Check-out";
  // com contexto de loja acerta ("Finalizar compra", "Zur Kasse", "Pagar", "Commander").
  var STORE_MENU = 'Online store menu: ', STORE_PAGE = 'Online store page: ';
  function shortLabel(s) { var t = decode(s).trim(); return t.length > 0 && t.length <= 32 && t.split(/\s+/).length <= 3; }
  function storeLink(el) {
    if (!C.wl || !C.wl.length || !el) return false;
    var a = el.closest ? el.closest('a[href]') : null;
    if (!a && el.querySelector) a = el.querySelector('a[href]');
    if (!a) return false;
    var p;
    try { p = new URL(a.getAttribute('href'), w.location.href).pathname; } catch (e) { return false; }
    p = p.replace(/\/+$/, '');
    for (var i = 0; i < C.wl.length; i++) if (String(C.wl[i]).replace(/\/+$/, '') === p) return true;
    return false;
  }
  // Item curto de menu: sozinho o Google erra ("Sobre" → "On"). Com o contexto "Menu:" acerta
  // ("About"), mas às vezes toma a palavra por nome próprio ("Loja"). Pedimos as duas versões.
  var NAV = 'nav, [role="navigation"], .wp-block-navigation, .wp-block-page-list, .menu, .nav-menu, .navbar, .navigation, .main-navigation';
  function isNavLabel(parent, s) { // 0 = não é item de menu · 1 = menu · 2 = menu que leva a uma página da loja
    if (!parent.closest || !parent.closest(NAV) || !shortLabel(s)) return 0;
    return storeLink(parent) ? 2 : 1;
  }
  function plain(html) { return decode(html).replace(WS, ' ').trim().toLowerCase(); }
  function pickNav(u, trPlain, trWrapped) {
    var inner = null;
    if (typeof trWrapped === 'string') {
      var m = parse(trWrapped).querySelector('[id="m"]');
      if (m && plain(m.innerHTML)) inner = m.innerHTML;
    }
    if (inner === null) return trPlain;
    var src = plain(u.src);
    if (typeof trPlain === 'string' && plain(inner) === src && plain(trPlain) !== src) return trPlain;
    return inner;
  }
  // Emoji que o WordPress troca por imagem (wp-emoji, em navegador sem fonte de emoji) conta como
  // o próprio caractere: a mesma chave antes e depois da troca, e a tradução volta como texto.
  function isEmoji(n) { return n.nodeType === 1 && tag(n) === 'IMG' && /(^|\s)(emoji|wp-smiley)(\s|$)/.test(n.getAttribute('class') || '') && !!n.getAttribute('alt'); }
  function ser(nodes, ctx, parentId) {
    var out = '';
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 3 && mine.has(n) && LETTER.test(n.data)) {
        // texto que nós já traduzimos num bloco que o site redesenhou em parte (mini-carrinho do
        // WooCommerce troca só o contador): fica como está e só o texto novo vai para tradução
        var mid = ctx.els.length;
        ctx.els.push(n);
        ctx.par.push(parentId);
        ctx.at[mid] = 1;
        out += '<span id="' + mid + '"></span>';
      } else if (n.nodeType === 3) {
        var tx = n.data.replace(WS, ' '), bp = ctx.br ? brandParts(tx) : null;
        if (!bp) { out += esc(tx); continue; }
        for (var b = 0; b < bp.length; b++) {
          out += esc(bp[b]);
          if (b === bp.length - 1) break;
          var bid = ctx.els.length;
          ctx.els.push(mk(BN));
          ctx.par.push(parentId);
          ctx.at[bid] = 1;
          out += '<span id="' + bid + '"></span>';
        }
      } else if (isEmoji(n)) {
        out += esc(n.getAttribute('alt'));
      } else if (n.nodeType === 1) {
        var id = ctx.els.length, t = tag(n);
        ctx.els.push(n);
        ctx.par.push(parentId);
        if (ATOMIC[t] || excluded(n) || island(n) || !hasText(n)) {
          ctx.at[id] = 1;
          out += '<span id="' + id + '"></span>';
        } else {
          if (n.childNodes.length === 1 && n.firstChild.nodeType === 3) ctx.lt[id] = n.firstChild.data.replace(WS, ' ').trim();
          var nm = SAFE[t.toLowerCase()] ? t.toLowerCase() : 'span';
          out += '<' + nm + ' id="' + id + '">' + ser(Array.prototype.slice.call(n.childNodes), ctx, id) + '</' + nm + '>';
        }
      }
    }
    return out;
  }
  function collectAttrs(root, out) {
    var list = root.querySelectorAll('[title],[alt],[placeholder],[aria-label],input[type=submit],input[type=button],input[type=reset]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      // <textarea>: o que a pessoa digita nunca é tocado, mas o texto de exemplo (placeholder) sim
      if (tag(el) === 'TEXTAREA' ? el.getAttribute('translate') === 'no' || (el.classList && el.classList.contains('notranslate')) || excludedUp(el.parentElement) : excludedUp(el)) continue;
      var names = ATTRS.slice();
      if (tag(el) === 'INPUT' && /^(submit|button|reset)$/i.test(el.type || '')) names.push('value');
      for (var j = 0; j < names.length; j++) {
        var v = el.getAttribute(names[j]);
        if (!v || !LETTER.test(v)) continue;
        var done = attrMine.get(el);
        if ((done && done[names[j]] === v) || produced[v.replace(WS, ' ').trim()]) continue;
        var pv = v.replace(WS, ' ').trim();
        var au = { el: el, attr: names[j], src: esc(pv), inContent: inContent(el) };
        var ov = C.loc ? origOf(pv) : null;
        if (ov !== null) { au.q = esc(ov); au.sl = 'en'; au.lang = C.loc; } else au.lang = au.sl = hintOf(el, au.src);
        if (au.lang && fam(au.lang) === fam(TL)) continue;
        out.push(au);
      }
    }
    return out;
  }
  // Título da aba: o nome do site nunca é traduzido ("Sites" virava "Locais") e os separadores
  // (" – ", " | ") voltam exatamente como estavam (o Google comia o espaço antes do nome do site).
  var TSEP = /^([\s\-\u2013\u2014|\u00b7\u2022:\u00bb\u00ab\/~]*)([\s\S]*?)([\s\-\u2013\u2014|\u00b7\u2022:\u00bb\u00ab\/~]*)$/;
  var TMARK = /\s*<span id="0">\s*<\/span>\s*/g;
  function titleUnit() {
    var t = d.title.replace(WS, ' ').trim(), bn = String(C.bn || '').replace(WS, ' ').trim();
    if (!t || !LETTER.test(t)) return null;
    var pieces = bn && t.indexOf(bn) > -1 ? t.split(bn) : [t], parts = [], cores = [];
    for (var i = 0; i < pieces.length; i++) {
      var m = TSEP.exec(pieces[i]);
      if (m && LETTER.test(m[2])) { parts.push([m[1], cores.length, m[3]]); cores.push(m[2]); } else parts.push([pieces[i]]);
    }
    if (!cores.length) return null; // só o nome do site
    var tu = { title: 1, brand: pieces.length > 1 ? bn : '', parts: parts, n: cores.length, src: cores.map(esc).join(' <span id="0"></span> ') };
    if (C.ws && cores.length === 1 && shortLabel(esc(cores[0]))) tu.wsrc = STORE_PAGE + '<span id="m">' + tu.src + '</span>'; // "Checkout – Sites"
    return tu;
  }
  function collect(root, withTitle) {
    var units = segment(root, []);
    collectAttrs(root, units);
    if (withTitle && d.title) { var tu = titleUnit(); if (tu) units.push(tu); }
    return units;
  }

  // ------------------------------------------------------------------ aplicar a tradução
  function fix(tr, ctx) {
    var s = String(tr);
    s = s.replace(/(<(?!\/)[a-z0-9]+ id="\d+">)(\s+)/gi, '$2$1'); // espaço que entrou na tag volta para fora
    s = s.replace(/(\s+)(<\/[a-z0-9]+>)/gi, '$2$1');
    if (ctx) {
      for (var k = 0; k < ctx.els.length; k++) {
        if (!ctx.at[k]) continue;
        s = s.replace(new RegExp('\\s*<span id="' + k + '"></span>\\s*'), (ctx.pre[k] ? ' ' : '') + '<span id="' + k + '"></span>' + (ctx.post[k] ? ' ' : ''));
      }
    }
    if (fam(TL) !== 'fr') s = s.replace(/(<\/[a-z0-9]+>)\s+([.,;:!?%)\]}»”])/gi, '$1$2');
    return s.replace(/ {2,}/g, ' ').trim();
  }
  function build(list, ctx, used) {
    var arr = [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n.nodeType === 3) {
        if (n.data) arr.push(mk(n.data));
      } else if (n.nodeType === 1) {
        var ids = n.getAttribute('id');
        var k = ids !== null && /^\d+$/.test(ids) ? +ids : -1;
        var o = k >= 0 && k < ctx.els.length && !used[k] ? ctx.els[k] : null;
        if (o) {
          used[k] = 1;
          if (!ctx.at[k]) {
            var kids = build(n.childNodes, ctx, used);
            while (o.firstChild) o.removeChild(o.firstChild);
            for (var j = 0; j < kids.length; j++) o.appendChild(kids[j]);
          }
          arr.push(o);
        } else {
          arr.push.apply(arr, build(n.childNodes, ctx, used));
        }
      }
    }
    return arr;
  }
  var NOFLIP = 'nav,header,footer,[role=navigation],[class*=menu],[class*=nav]'; // menus mantêm a ordem do tema
  var INLINE = set('A SPAN STRONG B EM I U S SMALL MARK SUB SUP CODE KBD ABBR TIME Q CITE BR IMG WBR FONT');
  function textDiv(el) { // <div> que é só um parágrafo (depoimento do Elementor etc.), nunca um bloco de layout
    if (tag(el) !== 'DIV' || (el.closest && el.closest(NOFLIP))) return false;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!INLINE[tag(c)]) return false;
    return true;
  }
  function markDir(el) {
    if (!el || el === d.body || !(TEXTBLOCK[tag(el)] || textDiv(el)) || el.hasAttribute('dir')) return;
    var v = RTL[TL] ? 'rtl' : PAGE_RTL ? 'ltr' : '';
    if (!v) return;
    el.setAttribute('dir', v);
    var up = el.parentNode; // item de lista com texto: a lista acompanha (marcadores do lado certo)
    if (tag(el) === 'LI' && up && (tag(up) === 'UL' || tag(up) === 'OL') && !up.hasAttribute('dir') && !(up.closest && up.closest(NOFLIP))) up.setAttribute('dir', v);
  }
  function applyUnit(u, tr) {
    if (u.title) {
      var tt = String(tr).split(TMARK);
      if (tt.length !== u.n) return; // o Google juntou/perdeu um pedaço: mantém o título original
      d.title = u.parts.map(function (p) { return p.length === 1 ? p[0] : p[0] + decode(tt[p[1]]).replace(WS, ' ').trim() + p[2]; }).join(u.brand);
      return;
    }
    if (u.attr) {
      var v = decode(tr);
      if (u.el.getAttribute(u.attr) === v) return;
      produced[v.replace(WS, ' ').trim()] = 1;
      u.el.setAttribute(u.attr, v);
      var done = attrMine.get(u.el) || {};
      done[u.attr] = v;
      attrMine.set(u.el, done);
      return;
    }
    var p = u.parent;
    if (!p || !p.isConnected) return;
    for (var i = 0; i < u.nodes.length; i++) if (u.nodes[i].parentNode !== p) return; // o site mudou este bloco: pula
    var html = fix(tr, u.ctx);
    if (html === u.src) return; // já está na língua do visitante
    produced[decode(html).replace(WS, ' ').trim()] = 1;
    var ctx = u.ctx;
    if (!ctx.els.length) {
      var first = null;
      for (var f = 0; f < u.nodes.length && !first; f++) if (u.nodes[f].nodeType === 3) first = u.nodes[f];
      if (!first) { first = d.createTextNode(''); p.insertBefore(first, u.nodes[0]); }
      first.data = (u.lead ? ' ' : '') + decode(html) + (u.trail ? ' ' : '');
      mine.add(first);
      if (u.nodes.length === 1) rev(decode(u.src), decode(html));
      for (var j = 0; j < u.nodes.length; j++) if (u.nodes[j] !== first && u.nodes[j].parentNode === p) p.removeChild(u.nodes[j]);
      markDir(p);
      return;
    }
    var used = {};
    var arr = build(parse(html).childNodes, ctx, used);
    for (var k = 0; k < ctx.els.length; k++) { // marcador que sumiu na tradução: nada se perde
      if (used[k]) continue;
      var par = ctx.par[k];
      if (par === -1) arr.push(ctx.els[k]);
      else if (used[par]) ctx.els[par].appendChild(ctx.els[k]);
    }
    var ref = u.nodes[u.nodes.length - 1].nextSibling;
    var frag = d.createDocumentFragment();
    if (u.lead) frag.appendChild(mk(' '));
    for (var a = 0; a < arr.length; a++) frag.appendChild(arr[a]);
    if (u.trail) frag.appendChild(mk(' '));
    for (var b = 0; b < u.nodes.length; b++) {
      var n = u.nodes[b];
      if ((n.nodeType === 3 || isEmoji(n)) && n.parentNode === p) p.removeChild(n);
    }
    p.insertBefore(frag, ref && ref.parentNode === p ? ref : null);
    markDir(p);
    for (var q = 0; q < ctx.els.length; q++) { // folhas: o mesmo texto original volta traduzido sem pedido
      var le = ctx.els[q];
      if (ctx.lt[q] && !ctx.at[q] && le.childNodes.length === 1 && le.firstChild.nodeType === 3) rev(ctx.lt[q], le.firstChild.data);
    }
  }
  // Sites que redesenham um pedaço com o texto ORIGINAL depois da tradução (Interactivity API,
  // React com as mesmas props — ex.: contador do mini-carrinho do WooCommerce): o texto volta
  // traduzido na hora, sem pedido ao servidor.
  var REV = {}, REVN = 0;
  function rev(orig, tr) {
    var o = String(orig).replace(WS, ' ').trim(), t = String(tr).replace(WS, ' ').trim();
    if (!o || !t || o === t || !LETTER.test(o)) return;
    if (!Object.prototype.hasOwnProperty.call(REV, o)) REVN++;
    REV[o] = t;
  }
  function revert(root) {
    if (!REVN || !root) return;
    var hit = [], tw = d.createTreeWalker(root, 4, null);
    for (var t = tw.nextNode(); t; t = tw.nextNode()) {
      if (mine.has(t) || !LETTER.test(t.data)) continue;
      if (Object.prototype.hasOwnProperty.call(REV, t.data.replace(WS, ' ').trim()) && !excludedUp(t.parentNode)) hit.push(t);
    }
    if (!hit.length) return;
    pause();
    hit.forEach(function (x) {
      var a = /^\s*/.exec(x.data)[0], z = /\s*$/.exec(x.data)[0];
      x.data = a + REV[x.data.replace(WS, ' ').trim()] + z;
      mine.add(x);
      produced[x.data.replace(WS, ' ').trim()] = 1;
    });
    connect();
  }

  // ------------------------------------------------------------------ caches
  var LS_KEY = 'trinv1:' + TL;
  var ls = (function () { try { var s = w.localStorage.getItem(LS_KEY); var o = s ? JSON.parse(s) : null; return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } })();
  var pageMap = {};
  var used = {};
  var lsTimer = null;
  function lookup(src) {
    if (Object.prototype.hasOwnProperty.call(ls, src)) return ls[src];
    if (Object.prototype.hasOwnProperty.call(pageMap, src)) return pageMap[src];
    return null;
  }
  function remember(src, tr) { ls[src] = tr; used[src] = 1; }
  function saveLS() {
    if (lsTimer) return;
    lsTimer = setTimeout(function () {
      lsTimer = null;
      try {
        var s = JSON.stringify(ls);
        if (s.length > 1500000) { // cheio: fica só com o que esta página usa
          var keep = {};
          Object.keys(used).forEach(function (k) { if (ls[k] != null) keep[k] = ls[k]; });
          ls = keep;
          s = JSON.stringify(ls);
        }
        w.localStorage.setItem(LS_KEY, s);
      } catch (e) {
        try { w.localStorage.removeItem(LS_KEY); } catch (e2) { /* bloqueado */ }
      }
    }, 400);
  }

  // ------------------------------------------------------------------ rede
  function timeout(promise, ms, ctrl) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function req(url, opts, ms) {
    var ctrl = w.AbortController ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;
    return timeout(fetch(url, opts), ms, ctrl);
  }
  function chunkBy(list, maxItems, maxChars) {
    var out = [], cur = [], chars = 0;
    list.forEach(function (s) {
      if (cur.length && (cur.length >= maxItems || chars + s.length > maxChars)) { out.push(cur); cur = []; chars = 0; }
      cur.push(s);
      chars += s.length;
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function pool(items, n, fn) {
    var i = 0;
    function next() { if (i >= items.length) return Promise.resolve(); var it = items[i++]; return fn(it).then(next, next); }
    var workers = [];
    for (var k = 0; k < Math.min(n, items.length); k++) workers.push(next());
    return Promise.all(workers);
  }
  function postJSON(url, body) {
    return req(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'omit' }, 15000)
      .then(function (r) {
        if (r.status === 402) return 'stopped'; // licença do Pub Mail parada: não traduz
        if (r.status === 401 || r.status === 403 || r.status === 404) return 'blocked';
        return r.ok ? r.json() : null;
      });
  }
  function split(k) { var i = k.indexOf(SEP); return i < 0 ? ['', k] : [k.slice(0, i), k.slice(i + 1)]; }
  function server(ch, lang, wt) {
    var parts = ch.map(split);
    var msg = { u: T.u, l: lang || TL, p: C.p || 0, s: parts.map(function (x) { return x[1]; }), h: parts.map(function (x) { return x[0]; }) };
    if (wt) msg.w = wt;
    var body = JSON.stringify(msg);
    if (T.tm && !T.tm.f) T.tm.f = Date.now() - T.t0;
    var viaAjax = function () {
      return postJSON(C.ax + (C.ax.indexOf('?') > -1 ? '&' : '?') + 'action=trinv_t', body).then(function (r) { return r === 'blocked' ? null : r; });
    };
    var pr = T.rest ? postJSON(C.tu, body).then(function (r) { if (r === 'blocked') { T.rest = 0; return viaAjax(); } return r; }) : viaAjax();
    return pr.catch(function () { return null; });
  }
  function parseG(j, n) {
    if (!Array.isArray(j)) return null;
    if (n === 1 && typeof j[0] === 'string') j = [j];
    if (j.length !== n) return null;
    var out = [];
    for (var i = 0; i < n; i++) {
      var it = j[i];
      if (Array.isArray(it) && typeof it[0] === 'string') out.push(it[0]);
      else if (typeof it === 'string') out.push(it);
      else return null;
    }
    return out;
  }
  function gChunk(ch, attempt, sl) {
    if (attempt >= GEPS.length) return Promise.resolve(null);
    var idx = (gStart + attempt) % GEPS.length;
    var body = ch.map(function (s) { return 'q=' + encodeURIComponent(s); }).join('&');
    var url = GEPS[idx] + '&sl=' + encodeURIComponent(sl || 'auto') + '&tl=' + encodeURIComponent(TL) + '&format=html';
    return req(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: body, credentials: 'omit' }, 9000)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var p = parseG(j, ch.length); if (!p) throw new Error('bad'); gStart = idx; return p; })
      .catch(function () { return gChunk(ch, attempt + 1, sl); });
  }
  function google(keys) {
    var out = {}, groups = {}, jobs = [];
    if (T.stop) return Promise.resolve(out);
    keys.forEach(function (k) { var p = split(k); (groups[p[0]] = groups[p[0]] || []).push(k); });
    Object.keys(groups).forEach(function (sl) {
      chunkBy(groups[sl], 40, 8000).forEach(function (ch) { jobs.push({ sl: sl, keys: ch }); });
    });
    return pool(jobs, 4, function (job) {
      var texts = job.keys.map(function (k) { return split(k)[1]; });
      return gChunk(texts, 0, job.sl).then(function (res) { if (res) job.keys.forEach(function (k, i) { out[k] = res[i]; }); });
    }).then(function () { return out; });
  }
  function fetchAll(srcs) {
    var out = {};
    return pool(chunkBy(srcs, 300, 90000), 2, function (ch) {
      return server(ch).then(function (res) {
        if (res === 'stopped' || T.stop) { T.stop = 1; return; }
        var miss = [];
        ch.forEach(function (s, i) {
          var t = res && Array.isArray(res.t) ? res.t[i] : null;
          if (typeof t === 'string') { out[s] = t; remember(s, t); } else miss.push(s);
        });
        if (!miss.length) return;
        return google(miss).then(function (m2) {
          miss.forEach(function (s) { if (typeof m2[s] === 'string') { out[s] = m2[s]; remember(s, m2[s]); } });
        });
      });
    }).then(function () { saveLS(); return out; });
  }

  // Mesma chave já a caminho (o site reescreveu o bloco enquanto a 1ª tradução chegava: emoji,
  // carrossel): espera aquela resposta em vez de pedir de novo.
  var pendingKeys = {};
  function fetchKeys(keys) {
    var fresh = keys.filter(function (k) { return !pendingKeys[k]; });
    if (fresh.length) {
      var p = fetchAll(fresh);
      fresh.forEach(function (k) { pendingKeys[k] = p.then(function (m) { return typeof m[k] === 'string' ? m[k] : null; }, function () { return null; }); });
    }
    return Promise.all(keys.map(function (k) { return pendingKeys[k].then(function (v) { return [k, v]; }); })).then(function (pairs) {
      var out = {};
      pairs.forEach(function (x) { if (typeof x[1] === 'string') out[x[0]] = x[1]; });
      return out;
    });
  }

  // ------------------------------------------------------------------ orquestração
  var obs = null;
  function pause() { if (obs) obs.disconnect(); }
  function connect() {
    if (obs) obs.observe(d.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
  }
  function applyAll(pairs) {
    pause();
    for (var i = 0; i < pairs.length; i++) {
      try { applyUnit(pairs[i][0], pairs[i][1]); } catch (e) { /* um bloco com problema não derruba o resto */ }
    }
    connect();
  }
  function translate(units) {
    var now = [], later = [], need = {}, order = [];
    function want(k) { if (!need[k]) { need[k] = 1; order.push(k); } }
    units.forEach(function (u) {
      if (u.mix) {
        var pk = ukeys(u), got = compose(u, lookup);
        if (got !== null) { pk.forEach(function (k) { used[k] = 1; }); now.push([u, got]); }
        else { pk.forEach(function (k) { if (lookup(k) === null) want(k); }); later.push(u); }
        return;
      }
      var ka = key(u), kb = u.wsrc ? key(u, 1) : null;
      var a = lookup(ka), b = kb ? lookup(kb) : null;
      if (a !== null && (!kb || b !== null)) {
        used[ka] = 1;
        if (kb) used[kb] = 1;
        now.push([u, kb ? pickNav(u, a, b) : a]);
      } else {
        if (a === null) want(ka);
        if (kb && b === null) want(kb);
        later.push(u);
      }
    });
    if (now.length) applyAll(now);
    if (!order.length) return Promise.resolve();
    return fetchKeys(order).then(function (map) {
      var pairs = [];
      later.forEach(function (u) {
        if (u.mix) {
          var g = compose(u, function (k) { return typeof map[k] === 'string' ? map[k] : lookup(k); });
          if (g !== null) pairs.push([u, g]);
          return;
        }
        var ka = key(u), kb = u.wsrc ? key(u, 1) : null;
        var a = typeof map[ka] === 'string' ? map[ka] : lookup(ka);
        var tr = a;
        if (kb) tr = pickNav(u, a, typeof map[kb] === 'string' ? map[kb] : lookup(kb));
        if (typeof tr === 'string') pairs.push([u, tr]);
      });
      applyAll(pairs);
    });
  }
  function reveal() { H.classList.remove('trinv-wait'); }
  // ------------------------------------------------------------------ endereço traduzido
  // Depois de traduzir (e depois do "load", para os pixels de anúncio registrarem o endereço
  // original), a barra mostra o endereço no idioma do visitante. O servidor abre esse endereço.
  function lsGet(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { w.localStorage.setItem(k, v); } catch (e) { /* bloqueado */ } }
  function setPath(p) {
    if (!p || p.charAt(0) !== '/' || p === w.location.pathname || !w.history || !w.history.replaceState) return;
    try { w.history.replaceState(w.history.state, '', p + w.location.search + w.location.hash); } catch (e) { /* bloqueado */ }
  }
  function urlSwap() {
    if (!C.ul || !C.p || T.warm || T.stop) return;
    if (T.mode !== 'full') { if (C.op) setPath(C.op); return; } // conteúdo já na língua do visitante: o original
    if (C.ps && C.ps[TL]) { setPath(C.ps[TL]); return; }
    var ck = 'trinv_ps:' + C.p + ':' + TL, saved = lsGet(ck);
    if (saved) { setPath(saved); return; }
    var q = 'p=' + encodeURIComponent(C.p) + '&l=' + encodeURIComponent(TL);
    var get = function (base) {
      return req(base + (base.indexOf('?') > -1 ? '&' : '?') + q, { credentials: 'omit' }, 8000).then(function (r) { return r.ok ? r.json() : null; });
    };
    (T.rest && C.su ? get(C.su) : Promise.resolve(null)).catch(function () { return null; })
      .then(function (j) { return j || get(C.ax + (C.ax.indexOf('?') > -1 ? '&' : '?') + 'action=trinv_s'); })
      .then(function (j) { if (j && typeof j.s === 'string' && j.s) { lsSet(ck, j.s); setPath(j.s); } })
      .catch(function () { /* fica o endereço original */ });
  }
  function scheduleUrl() {
    var f = function () { setTimeout(urlSwap, 1000); };
    if (d.readyState === 'complete') f();
    else w.addEventListener('load', f);
  }
  function done() {
    shown = true;
    scheduleUrl();
    reveal();
    if (T.full) H.setAttribute('lang', TL === 'iw' ? 'he' : TL === 'jw' ? 'jv' : TL);
    watch();
  }

  // conteúdo que aparece depois (comentários, "carregar mais", pop-ups do tema…)
  var queue = [], qTimer = null, budget = 600, shown = false, mapWait = null;
  var inflight = 0, idleCbs = [];
  function idleNow() { return !inflight && !qTimer; }
  function notifyIdle() { if (idleNow()) idleCbs.splice(0).forEach(function (f) { f(); }); }
  function busy(p) {
    inflight++;
    var fin = function () { inflight--; notifyIdle(); };
    return p.then(fin, fin);
  }
  // espera o que o site acrescentou durante o carregamento ser traduzido (com limite)
  function whenIdle(ms) {
    return new Promise(function (resolve) {
      if (idleNow() || ms <= 0) { resolve(); return; }
      var t = setTimeout(resolve, ms);
      idleCbs.push(function () { clearTimeout(t); resolve(); });
    });
  }
  function blockOf(n) {
    var e = n;
    while (e && e !== d.body && INLINE[tag(e)]) e = e.parentElement;
    return e || d.body;
  }
  function enqueue(n) {
    if (!n || n.nodeType !== 1 || !d.body.contains(n)) return;
    queue.push(n);
    if (!qTimer) qTimer = setTimeout(flushQueue, shown ? 250 : 60); // escondida: rápido; depois, agrupa mais
  }
  function flushQueue() {
    qTimer = null;
    var roots = [];
    queue.splice(0).forEach(function (n) {
      var b = blockOf(n);
      if (!b || roots.some(function (r) { return r.contains(b); })) return;
      roots = roots.filter(function (r) { return !b.contains(r); });
      roots.push(b);
    });
    var units = [];
    roots.forEach(function (r) { if (!excludedUp(r)) revert(r); });
    roots.forEach(function (r) {
      if (excludedUp(r)) return;
      var c = tries.get(r) || 0;
      if (c > 8) return;
      tries.set(r, c + 1);
      segment(r, units);
      collectAttrs(r, units);
    });
    units = units.filter(function (u) { return wanted(u, TL, T.mode); });
    if (!units.length || budget <= 0) { notifyIdle(); return; }
    budget -= units.length;
    busy(mapWait ? mapWait.then(function () { return translate(units); }) : translate(units));
  }
  function watch() {
    if (obs) return;
    obs = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        if (r.type === 'childList') {
          for (var i = 0; i < r.addedNodes.length; i++) {
            var n = r.addedNodes[i];
            enqueue(n.nodeType === 1 ? n : n.parentNode);
          }
        } else if (r.type === 'characterData') {
          mine.delete(r.target);
          enqueue(r.target.parentNode);
        } else if (r.type === 'attributes') {
          enqueue(r.target.nodeType === 1 ? r.target : null);
        }
      });
    });
    connect();
  }

  // ------------------------------------------------------------------ pré-tradução (painel do dono)
  // A página foi aberta pelo painel num quadro invisível, como visitante anônimo. Segmenta
  // exatamente como um visitante e pede ao servidor TODOS os trechos em cada idioma da campanha;
  // o servidor guarda (cache + mapa da página). Nada é aplicado nem gravado no navegador.
  function warmRun() {
    var W = T.warm, langs = (W.l || []).slice();
    var res = { trinv: 'warm', done: 1, ok: 0, total: 0, langs: [] };
    var post = function (m) { try { if (w.parent && w.parent !== w) w.parent.postMessage(m, '*'); } catch (e) { /* sem painel */ } };
    var units;
    try { units = collect(d.body, true); } catch (e) { res.err = 'segment'; post(res); return; }
    var i = 0;
    (function next() {
      if (i >= langs.length) { post(res); return; }
      var L = langs[i++];
      var mode = modeFor(L); // o mesmo que o visitante desta língua vai pedir
      var keys = [], seen = {};
      units.forEach(function (u) {
        if (!wanted(u, L, mode)) return;
        var ks = ukeys(u);
        ks.forEach(function (k) { if (!seen[k]) { seen[k] = 1; keys.push(k); } });
      });
      post({ trinv: 'warm', progress: 1, i: i - 1, n: langs.length, l: L });
      var ok = 0;
      pool(chunkBy(keys, 300, 90000), 1, function (ch) {
        return server(ch, L, W.t).then(function (r) {
          if (r && Array.isArray(r.t)) r.t.forEach(function (t) { if (typeof t === 'string') ok++; });
        });
      }).then(function () {
        res.total += keys.length;
        res.ok += ok;
        if (keys.length) res.langs.push(L);
        next();
      });
    })();
  }
  // Coleta quando o conteúdo inserido por scripts já apareceu: depois do "load", espera o DOM
  // ficar 1,5 s sem mudanças (no máximo 8 s — páginas com cronômetro ou carrossel nunca param).
  function warmStart() {
    var once = 0, mo = null, quiet = null, cap = null;
    try { if (w.parent && w.parent !== w) w.parent.postMessage({ trinv: 'warm', hello: 1 }, '*'); } catch (e) { /* sem painel */ }
    function go() {
      if (once) return;
      once = 1;
      if (mo) mo.disconnect();
      clearTimeout(quiet);
      clearTimeout(cap);
      warmRun();
    }
    function settle() {
      if (mo || once) return;
      mo = new MutationObserver(function () { clearTimeout(quiet); quiet = setTimeout(go, 1500); });
      mo.observe(d.body, { childList: true, subtree: true, characterData: true });
      quiet = setTimeout(go, 1500);
      cap = setTimeout(go, 8000);
    }
    if (d.readyState === 'complete') settle();
    else { w.addEventListener('load', settle); setTimeout(settle, 8000); }
  }

  function start() {
    if (T.warm) { warmStart(); return; }
    var units;
    T.tm = { s: Date.now() - T.t0 }; // diagnóstico: início, segmentação pronta, 1º pedido
    try { units = collect(d.body, T.full).filter(function (u) { return wanted(u, TL, T.mode); }); } catch (e) { reveal(); return; }
    T.tm.c = Date.now() - T.t0;
    T.tm.n = units.length;
    // já observa: o que o site acrescentar enquanto a 1ª tradução chega (carrosséis que clonam
    // slides no carregamento, listas montadas por script) também é traduzido.
    try { watch(); } catch (e) { /* sem observador */ }
    var deadline = setTimeout(reveal, Math.max(0, (C.mw || 3000) - 300 - (Date.now() - T.t0)));
    var finish = function () {
      var left = Math.max(0, (C.mw || 3000) - 300 - (Date.now() - T.t0));
      (T.full ? whenIdle(left) : Promise.resolve()).then(function () { clearTimeout(deadline); done(); });
    };
    var pre = T.pre || Promise.resolve(null);
    // o mapa pronto da página (no máx. 0,7 s); o que o site acrescentar depois espera por ele antes
    // de pedir tradução (carrossel do Kadence cria os rótulos antes de o mapa chegar)
    mapWait = new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(null); }, 700);
      pre.then(function (r) { clearTimeout(t); resolve(r); }, function () { clearTimeout(t); resolve(null); });
    }).then(function (r) { if (r && r.m && typeof r.m === 'object') pageMap = r.m; mapWait = null; });
    // tudo já guardado no navegador: aplica na hora, sem esperar a rede
    if (units.every(function (u) { return ukeys(u).every(function (k) { return lookup(k) !== null; }); })) {
      translate(units).then(finish);
      return;
    }
    mapWait
      .then(function () { return translate(units); })
      .catch(function () { /* mostra o original */ })
      .then(finish);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  // para testes
  T._ = { segment: segment, collect: collect, applyUnit: applyUnit, fix: fix, makeUnit: makeUnit, warmRun: warmRun, modeFor: modeFor, wanted: wanted, fxLang: fxLang };
})(window, document);
