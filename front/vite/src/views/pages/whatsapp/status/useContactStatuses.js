import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { get, post } from 'api/api';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { errMsg } from '../waShared';
import { applyViewed, mergeIncoming, normBlocks, payloadKey } from './statusShared';

// =============================================================================
// useContactStatuses — status (stories) dos contatos das últimas 24 h, POR NÚMERO.
//  GET  /whatsapp/contact-statuses                 → { sessions:[{session, contacts}], synced_at }
//  POST /whatsapp/contact-statuses/sync {session_id?} → mesmo formato (um número ou todos os
//       conectados) + added_total + by_session[{session_id, added, error?}]
//  POST /whatsapp/contact-statuses/:id/view        → marca como visto no Pub Mail
//  tempo real: `wa:status` { session_id, contact_chat_id, contact_jid, status } → o contato
//       sobe pro topo do bloco do número certo
// Estado: `blocks` = [{ session, contacts }] (um bloco por número permitido, mesmo vazio).
// 404 = back ainda sem o recurso → `unavailable` (a página segue funcionando).
// =============================================================================

const AUTO_SYNC_AFTER_MS = 15 * 60 * 1000; // sincroniza sozinho se a última carga for mais velha
const POLL_MS = 120000;
const INCOMING_TTL_MS = 120000;

const is404 = (e) => e?.response?.status === 404;

const countContacts = (blocks) => blocks.reduce((n, b) => n + b.contacts.length, 0);

export default function useContactStatuses({ connected } = {}) {
  const [blocks, setBlocks] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null); // 'all' | session_id | null
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');

  const seq = useRef(0);
  const viewedLocal = useRef(new Map()); // statusId → key (vistos aqui; sobrevivem a um GET que chegou atrasado)
  const incoming = useRef([]); // eventos em tempo real recentes (re-aplicados sobre cada resposta por 2 min)
  const refetchTimer = useRef(null);
  const autoSynced = useRef(false);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // re-aplica o que aconteceu durante a requisição (eventos em voo + vistos locais) num bloco
  const settle = useCallback((block) => {
    let list = block.contacts;
    const now = Date.now();
    incoming.current = incoming.current.filter((x) => now - x.at < INCOMING_TTL_MS);
    incoming.current.forEach((x) => {
      if (String(x.payload?.session_id || '') === String(block.session.id)) list = mergeIncoming(list, x.payload, block.session).list;
    });
    viewedLocal.current.forEach((key, id) => {
      if (!key || key.startsWith(`${block.session.id}:`)) list = applyViewed(list, id, key || undefined);
    });
    return { ...block, contacts: list };
  }, []);

  // aplica a resposta do servidor. `partial` = resposta de um número só → troca só aquele bloco
  const apply = useCallback(
    (r, { partial = false } = {}) => {
      const fresh = normBlocks(r?.sessions).map(settle);
      setBlocks((prev) => {
        if (!partial) return fresh;
        const next = prev.map((b) => fresh.find((f) => f.session.id === b.session.id) || b);
        fresh.forEach((f) => {
          if (!next.some((b) => b.session.id === f.session.id)) next.push(f);
        });
        return next;
      });
      setSyncedAt(r?.synced_at || null);
      setUnavailable(false);
      setError('');
    },
    [settle]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const s = ++seq.current;
      try {
        const r = await get('/whatsapp/contact-statuses');
        if (s !== seq.current) return null;
        apply(r);
        return r;
      } catch (e) {
        if (s !== seq.current) return null;
        if (is404(e)) setUnavailable(true);
        else if (!silent) setError(errMsg(e, 'Não foi possível carregar os status dos contatos.'));
        return null;
      } finally {
        if (s === seq.current) setLoading(false);
      }
    },
    [apply]
  );

  /** Busca no gateway: `sessionId` = um número; sem ele, todos os conectados. */
  const sync = useCallback(
    async ({ silent = false, sessionId = null } = {}) => {
      setSyncingId(sessionId || 'all');
      try {
        const r = await post('/whatsapp/contact-statuses/sync', sessionId ? { session_id: sessionId } : {});
        seq.current += 1; // descarta GETs que ainda estavam em voo (a sync é mais nova)
        apply(r, { partial: Boolean(sessionId) });
        if (!silent) {
          const fails = (Array.isArray(r?.by_session) ? r.by_session : []).filter((x) => x?.error);
          const labelOf = (id) => {
            const b = (Array.isArray(r?.sessions) ? r.sessions : []).find((x) => x?.session?.id === id)?.session;
            const known = b || blocksRef.current.find((x) => x.session.id === id)?.session;
            return known?.label || known?.phone || 'número';
          };
          fails.forEach((f) => toast.error(`${labelOf(f.session_id)}: ${f.error}`));
          if (!fails.length || fails.length < (r?.by_session?.length || 1)) {
            const n = countContacts(normBlocks(r?.sessions));
            const added = Number(r?.added_total || 0);
            toast.success(
              added
                ? `${added} ${added === 1 ? 'status novo' : 'status novos'} — ${n} ${n === 1 ? 'contato' : 'contatos'} com status.`
                : n
                  ? `Tudo em dia — ${n} ${n === 1 ? 'contato' : 'contatos'} com status.`
                  : 'Nenhum status nas últimas 24 horas.'
            );
          }
        }
      } catch (e) {
        if (is404(e)) setUnavailable(true);
        else if (!silent) toast.error(errMsg(e, 'Não foi possível buscar os status no WhatsApp.'));
      } finally {
        setSyncingId(null);
        setLoading(false);
      }
    },
    [apply]
  );

  // 1ª carga
  useEffect(() => {
    load();
  }, [load]);

  // nunca sincronizou (ou faz tempo) → busca no gateway em segundo plano, 1× por visita
  useEffect(() => {
    if (autoSynced.current || loading || unavailable || error || !connected) return;
    autoSynced.current = true;
    const last = syncedAt ? new Date(syncedAt).getTime() : 0;
    if (!last || Date.now() - last > AUTO_SYNC_AFTER_MS) sync({ silent: true });
  }, [connected, loading, unavailable, error, syncedAt, sync]);

  // rede de segurança (o tempo real cobre o grosso)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden' && !unavailable) load({ silent: true });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load, unavailable]);

  useEffect(() => () => clearTimeout(refetchTimer.current), []);

  useRealtimeEvent('wa:status', (payload) => {
    const sid = String(payload?.session_id || '');
    if (!sid) return;
    incoming.current.push({ at: Date.now(), payload });
    const key = payloadKey(payload);
    const block = blocksRef.current.find((b) => b.session.id === sid);
    const known = Boolean(block && block.contacts.some((c) => c.key === key));
    setBlocks((list) =>
      list.map((b) => (b.session.id === sid ? { ...b, contacts: mergeIncoming(b.contacts, payload, b.session).list } : b))
    );
    // número ainda sem bloco ou contato novo (o evento não traz nome/foto) → busca os dados completos (debounce)
    if (!block || (!known && !payload?.contact?.name)) {
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => load({ silent: true }), 1500);
    }
  });

  const markViewed = useCallback((statusId, key) => {
    if (!statusId || viewedLocal.current.has(statusId)) return;
    viewedLocal.current.set(statusId, key || null);
    setBlocks((list) =>
      list.map((b) => (!key || key.startsWith(`${b.session.id}:`) ? { ...b, contacts: applyViewed(b.contacts, statusId, key) } : b))
    );
    post(`/whatsapp/contact-statuses/${encodeURIComponent(statusId)}/view`).catch(() => {});
  }, []);

  // contato por chave (`session_id:jid`) — único entre todos os números
  const byId = useMemo(() => {
    const m = new Map();
    blocks.forEach((b) => b.contacts.forEach((c) => m.set(c.key, c)));
    return m;
  }, [blocks]);

  const contacts = useMemo(() => blocks.flatMap((b) => b.contacts), [blocks]);

  return {
    blocks,
    contacts,
    byId,
    syncedAt,
    loading,
    syncing: Boolean(syncingId),
    syncingId,
    unavailable,
    error,
    load,
    sync,
    markViewed
  };
}
