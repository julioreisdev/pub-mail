import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { get, post } from 'api/api';
import QuizView from './QuizView';

function resolvePublicDomain() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('domain') || '').trim().toLowerCase();
    if (q) return q;
  } catch {
    /* noop */
  }
  return String(window.location.hostname || '').toLowerCase();
}

// Sorteio ponderado (pesos relativos).
function weightedPick(members) {
  const list = (Array.isArray(members) ? members : []).filter((m) => m && m.domain && m.slug);
  if (list.length === 0) return null;
  const total = list.reduce((sum, m) => sum + Math.max(0, Number(m.weight) || 0), 0);
  if (total <= 0) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (const m of list) {
    r -= Math.max(0, Number(m.weight) || 0);
    if (r < 0) return m;
  }
  return list[list.length - 1];
}

// Injeta HTML arbitrário (incl. <script>) num container, recriando os scripts
// pra que executem (innerHTML não roda <script>).
function injectHtml(container, html) {
  if (!container || !html) return () => {};
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const appended = [];
  Array.from(wrapper.childNodes).forEach((node) => {
    if (node.tagName === 'SCRIPT') {
      const s = document.createElement('script');
      Array.from(node.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.text = node.textContent || '';
      container.appendChild(s);
      appended.push(s);
    } else {
      const clone = node.cloneNode(true);
      container.appendChild(clone);
      appended.push(clone);
    }
  });
  return () => appended.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
}

export default function PublicQuiz() {
  const { slug = '' } = useParams();
  const domain = useMemo(() => resolvePublicDomain(), []);
  const [state, setState] = useState({ loading: true, error: '', quiz: null });
  const scriptsDone = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await get(`/public/quiz/${encodeURIComponent(slug)}/config`, { params: { domain } });
        if (!alive) return;
        if (!raw || raw.active === false) {
          setState({ loading: false, error: 'Quiz indisponível.', quiz: null });
          return;
        }

        // Split: re-sorteia na entrada direta (igual webchat). ?nsr=1 suprime.
        const params = new URLSearchParams(window.location.search);
        if (params.get('nsr') === '1') {
          params.delete('nsr');
          const qs = params.toString();
          window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
        } else {
          const members = Array.isArray(raw?.split?.members) ? raw.split.members : [];
          if (members.length > 1) {
            const chosen = weightedPick(members);
            const curDomain = String(raw.domain || '').toLowerCase();
            const curSlug = String(raw.slug || '');
            const chosenDomain = String(chosen?.domain || '').toLowerCase();
            const chosenSlug = String(chosen?.slug || '');
            if (chosenDomain && chosenSlug && (chosenDomain !== curDomain || chosenSlug !== curSlug)) {
              window.location.replace(`https://${chosenDomain}/quiz/${encodeURIComponent(chosenSlug)}?nsr=1`);
              return; // mantém o loader até a navegação
            }
          }
        }

        setState({ loading: false, error: '', quiz: raw });
        if (raw.name) document.title = raw.name;
      } catch {
        if (alive) setState({ loading: false, error: 'Quiz não encontrado.', quiz: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, domain]);

  // Injeta scripts de header/footer (anúncios) uma única vez.
  useEffect(() => {
    if (!state.quiz || scriptsDone.current) return;
    scriptsDone.current = true;
    const cleanups = [];
    if (state.quiz.header_scripts) cleanups.push(injectHtml(document.head, state.quiz.header_scripts));
    if (state.quiz.footer_scripts) cleanups.push(injectHtml(document.body, state.quiz.footer_scripts));
    return () => cleanups.forEach((fn) => fn && fn());
  }, [state.quiz]);

  const handleLeadSubmit = async (data) => {
    await post(`/public/quiz/${encodeURIComponent(slug)}/leads?domain=${encodeURIComponent(domain)}`, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: 'quiz',
      context: { domain, slug, page_url: window.location.href },
      custom_fields: { answers: data.answers || {} }
    });
  };

  if (state.loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0b1120' }}>
        <div style={{ width: 38, height: 38, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state.error || !state.quiz) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#64748b', fontFamily: 'Inter, system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
        {state.error || 'Quiz não encontrado.'}
      </div>
    );
  }

  return <QuizView config={state.quiz.settings} ads={state.quiz.ads_config} mode="live" onLeadSubmit={handleLeadSubmit} />;
}
