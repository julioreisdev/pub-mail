import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import menuItems from 'menu-items';

// Título da aba do navegador no painel logado: "PM - <tela>" (ex.: "PM - Chat").
// A tela vem do item do menu cujo endereço casa com a rota atual (o prefixo mais longo vence);
// rotas que não estão no menu (construtores, ajuda) têm nome próprio em EXTRA.
// Landing, login e páginas públicas (webchat/quiz/pagamento) definem o próprio título.

const PREFIX = 'PM';
const FALLBACK = 'Pub Mail';

// rotas fora do menu — regex sobre o caminho, testadas antes do menu
const EXTRA = [
  [/^\/webchat\/webchats\/[^/]+\/builder/, 'Construtor do webchat'],
  [/^\/quizzes\/[^/]+\/builder/, 'Construtor do quiz'],
  [/^\/email\/email-marketing-help/, 'Ajuda do e-mail'],
  [/^\/settings\/billing-account/, 'Conta'],
  [/^\/settings\/account-settings/, 'Conta'],
  [/^\/settings\/support/, 'Suporte']
];

/** [{ url, title, group }] de todos os itens do menu (com url), em qualquer nível. */
const flatten = (items, group = null, out = []) => {
  for (const it of items || []) {
    const g = it?.type === 'group' && typeof it.title === 'string' ? it.title : group;
    if (it?.url && typeof it.title === 'string') out.push({ url: it.url.replace(/\/+$/, '') || '/', title: it.title, group: g });
    if (it?.children) flatten(it.children, g, out);
  }
  return out;
};
// título repetido em grupos diferentes (Configurações, Leads, Broadcasts…) ganha o grupo: "Configurações · WhatsApp"
const RAW = flatten(menuItems.items);
const DUP = new Set(RAW.map((e) => e.title).filter((t, i, a) => a.indexOf(t) !== i));
const ENTRIES = RAW.map((e) => ({
  ...e,
  title: DUP.has(e.title) && e.group && e.group !== e.title ? `${e.title} · ${e.group}` : e.title
})).sort((a, b) => b.url.length - a.url.length);

export const titleForPath = (pathname) => {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  for (const [re, title] of EXTRA) if (re.test(path)) return title;
  const hit = ENTRIES.find((e) => path === e.url || path.startsWith(`${e.url}/`));
  return hit ? hit.title : null;
};

export const formatTitle = (screen) => (screen ? `${PREFIX} - ${screen}` : FALLBACK);

/** Atualiza `document.title` a cada troca de rota; ao sair do painel volta para "Pub Mail". */
export default function usePageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = formatTitle(titleForPath(pathname));
  }, [pathname]);
  useEffect(
    () => () => {
      document.title = FALLBACK;
    },
    []
  );
}
