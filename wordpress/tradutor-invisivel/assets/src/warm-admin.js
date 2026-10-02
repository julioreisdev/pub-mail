/*
 * Tradutor Invisível — pré-tradução pelo painel (wp-admin, editor de blocos, Elementor).
 * Processa a fila de páginas publicadas/atualizadas: abre cada uma num quadro invisível, como
 * visitante anônimo; o próprio script do tradutor segmenta a página e pede ao servidor as
 * traduções dos idiomas da campanha. Um aviso discreto no canto mostra o andamento.
 */
(function (w, d) {
  'use strict';
  var C = w.trinvWarm;
  if (!C || !w.fetch || !w.Promise || !w.FormData) return;
  var busy = false, box = null, hideT = null;

  function ajax(action, data) {
    var fd = new FormData();
    fd.append('action', action);
    fd.append('_ajax_nonce', C.n);
    Object.keys(data || {}).forEach(function (k) { fd.append(k, data[k]); });
    return fetch(C.ax, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // ------------------------------------------------------------------ aviso no canto
  // Duas linhas: "Tradutor Invisível" e “Título” · status. O título encurta; o status nunca.
  function ui(title, status, state) {
    if (!d.body) return;
    if (!box) {
      var st = d.createElement('style');
      st.textContent = '@keyframes trinv-pulse{0%,100%{opacity:1}50%{opacity:.3}}' +
        '#trinv-warm-box{position:fixed;right:16px;bottom:16px;z-index:1000000;box-sizing:border-box;width:max-content;max-width:min(380px,calc(100vw - 32px));' +
        'padding:10px 14px 11px;background:#fff;color:#1d2327;border:1px solid #dcdcde;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.12);' +
        'font:13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s;pointer-events:none}' +
        '#trinv-warm-box.on{opacity:1;transform:none}' +
        '#trinv-warm-box .h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#50575e;margin-bottom:3px}' +
        '#trinv-warm-box i{flex:none;width:8px;height:8px;border-radius:50%;background:#2271b1}' +
        '#trinv-warm-box.run i{animation:trinv-pulse 1s ease-in-out infinite}#trinv-warm-box.ok i{background:#00a32a}#trinv-warm-box.err i{background:#d63638}' +
        '#trinv-warm-box .l{display:flex;min-width:0;padding-left:16px;white-space:nowrap}' +
        '#trinv-warm-box .t{overflow:hidden;text-overflow:ellipsis;min-width:0}#trinv-warm-box .s{flex:none}' +
        '@media (prefers-reduced-motion:reduce){#trinv-warm-box,#trinv-warm-box i{animation:none!important;transition:none!important}}';
      d.head.appendChild(st);
      box = d.createElement('div');
      box.id = 'trinv-warm-box';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      box.innerHTML = '<div class="h"><i></i><span>Tradutor Invisível</span></div><div class="l"><span class="t"></span><span class="s"></span></div>';
      d.body.appendChild(box);
      box.getBoundingClientRect(); // aplica o estado inicial antes da transição
    }
    clearTimeout(hideT);
    box.className = 'on ' + state;
    box.querySelector('.t').textContent = '“' + title + '”';
    box.querySelector('.s').textContent = ' · ' + status;
    if (state !== 'run') hideT = setTimeout(function () { box.className = state; }, 6000);
  }
  function langs(n) { return n + (n === 1 ? ' idioma' : ' idiomas'); }

  // ------------------------------------------------------------------ quadro invisível
  function run(job) {
    return new Promise(function (resolve) {
      var f = d.createElement('iframe'), hello = false, finished = false, tHello = null;
      var tAll = setTimeout(function () { end({ err: 'timeout' }); }, 180000);
      function end(res) {
        if (finished) return;
        finished = true;
        clearTimeout(tAll);
        clearTimeout(tHello);
        w.removeEventListener('message', onMsg);
        try { if (f.parentNode) f.parentNode.removeChild(f); } catch (e) { /* já saiu */ }
        resolve(res || {});
      }
      function onMsg(e) {
        var m = e.data;
        if (e.source !== f.contentWindow || !m || m.trinv !== 'warm') return;
        if (m.hello) hello = true;
        else if (m.progress) ui(job.title, 'pré-traduzindo ' + (m.i + 1) + '/' + langs(m.n), 'run');
        else if (m.done) end(m);
      }
      w.addEventListener('message', onMsg);
      // o script do tradutor avisa antes do "load"; sem aviso, o site não deixou abrir o quadro.
      f.addEventListener('load', function () {
        if (!tHello) tHello = setTimeout(function () { if (!hello) end({ err: 'noboot' }); }, 5000);
      });
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('tabindex', '-1');
      f.setAttribute('title', 'Tradutor Invisível');
      f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0;visibility:hidden;pointer-events:none';
      f.src = job.url;
      d.body.appendChild(f);
    });
  }

  function report(job, res) {
    var n = (job.langs || []).length;
    // sem pré-tradução os visitantes continuam recebendo a tradução normalmente (na 1ª visita)
    if (res.err) ui(job.title, 'não foi possível agora', 'err');
    else if (!res.total || res.ok >= res.total) ui(job.title, 'pronto em ' + langs(n), 'ok');
    else if (res.ok) ui(job.title, 'pronto em parte', 'ok');
    else ui(job.title, 'tradutor indisponível agora', 'err');
  }

  function loop() {
    return ajax('trinv_warm_next', {}).then(function (r) {
      var job = r && r.success && r.data ? r.data.job : null;
      if (!job || !job.url) return null;
      ui(job.title, 'pré-traduzindo 0/' + langs((job.langs || []).length), 'run');
      return run(job).then(function (res) {
        return ajax('trinv_warm_done', {
          id: job.id,
          ok: res.ok || 0,
          total: res.total || 0,
          langs: (res.langs || []).join(','),
          err: res.err || ''
        }).then(function () { report(job, res); return loop(); });
      });
    });
  }
  function kick() {
    if (busy) return;
    busy = true;
    loop().then(function () { busy = false; }, function () { busy = false; });
  }
  function later() { setTimeout(kick, 1500); }

  // ------------------------------------------------------------------ quando processar
  if (C.q > 0) {
    if (d.readyState === 'complete') later();
    else w.addEventListener('load', later);
  }
  // Heartbeat do WordPress (qualquer tela do painel): o servidor avisa se há fila.
  if (w.jQuery) {
    w.jQuery(d).on('heartbeat-tick', function (e, data) { if (data && data.trinv_warm) kick(); });
  }
  // Editor de blocos: logo depois de salvar/publicar.
  try {
    if (d.body && d.body.classList.contains('block-editor-page') && w.wp && w.wp.data && w.wp.data.subscribe) {
      var was = false;
      w.wp.data.subscribe(function () {
        var ed = w.wp.data.select('core/editor');
        if (!ed || !ed.isSavingPost) return;
        var saving = ed.isSavingPost() && !ed.isAutosavingPost();
        if (was && !saving) later();
        was = saving;
      });
    }
  } catch (e) { /* editor diferente */ }
  // Elementor: logo depois de publicar/atualizar.
  try {
    if (w.$e && w.$e.commands && w.$e.commands.on) {
      w.$e.commands.on('run:after', function (component, command) {
        if (/^document\/save\/(update|publish|default)$/.test(String(command))) later();
      });
    }
  } catch (e) { /* versão diferente do Elementor */ }
})(window, document);
