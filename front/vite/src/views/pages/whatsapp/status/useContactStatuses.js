import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { get, post } from 'api/api';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { errMsg } from '../waShared';
import { applyViewed, mergeIncoming, normList } from './statusShared';

// =============================================================================
// useContactStatuses — status (stories) dos contatos das últimas 24 h.
//  GET  /whatsapp/contact-statuses          → { contacts, synced_at }
//  POST /whatsapp/contact-statuses/sync     → mesmo formato (puxa do gateway)
//  POST /whatsapp/contact-statuses/:id/view → marca como visto no Pub Mail
//  tempo real: `wa:status` { contact_chat_id, status } → contato sobe pro topo
// 404 = back ainda sem o recurso → `unavailable` (a página segue funcionando).
// =============================================================================

const AUTO_SYNC_AFTER_MS = 15 * 60 * 1000; // sincroniza sozinho se a última carga for mais velha
const POLL_MS = 120000;
const INCOMING_TTL_MS = 120000;

const is404 = (e) => e?.response?.status === 404;

export default function useContactStatuses({ connected } = {}) {
  const [contacts, setContacts] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');

  const seq = useRef(0);
  const viewedLocal = useRef(new Set()); // vistos aqui (sobrevivem a um GET que chegou atrasado)
  const incoming = useRef([]); // eventos em tempo real recentes (re-aplicados sobre cada resposta por 2 min)
  const refetchTimer = useRef(null);
  const autoSynced = useRef(false);

  // aplica a resposta do servidor preservando o que aconteceu durante a requisição
  const apply = useCallback((r) => {
    let list = normList(r?.contacts);
    const now = Date.now();
    incoming.current = incoming.current.filter((x) => now - x.at < INCOMING_TTL_MS);
    incoming.current.forEach((x) => {
      list = mergeIncoming(list, x.payload).list; // idempotente por id; cobre GET em voo / back atrasado
    });
    viewedLocal.current.forEach((id) => {
      list = applyViewed(list, id);
    });
    setContacts(list);
    setSyncedAt(r?.synced_at || null);
    setUnavailable(false);
    setError('');
  }, []);

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

  const sync = useCallback(
    async ({ silent = false } = {}) => {
      setSyncing(true);
      try {
        const r = await post('/whatsapp/contact-statuses/sync');
        seq.current += 1; // descarta GETs que ainda estavam em voo (a sync é mais nova)
        apply(r);
        if (!silent) {
          const n = Array.isArray(r?.contacts) ? r.contacts.length : 0;
          toast.success(
            n ? `Status atualizados — ${n} ${n === 1 ? 'contato' : 'contatos'} com status.` : 'Nenhum status nas últimas 24 horas.'
          );
        }
      } catch (e) {
        if (is404(e)) setUnavailable(true);
        else if (!silent) toast.error(errMsg(e, 'Não foi possível buscar os status no WhatsApp.'));
      } finally {
        setSyncing(false);
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

  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;

  useRealtimeEvent('wa:status', (payload) => {
    incoming.current.push({ at: Date.now(), payload });
    const chatId = String(payload?.contact_chat_id || payload?.chat_id || '');
    const known = contactsRef.current.some((c) => c.chat_id === chatId);
    setContacts((list) => mergeIncoming(list, payload).list);
    // contato novo (o evento não traz nome/foto) → busca os dados completos (debounce)
    if (!known && !payload?.contact?.name) {
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => load({ silent: true }), 1500);
    }
  });

  const markViewed = useCallback((statusId, chatId) => {
    if (!statusId || viewedLocal.current.has(statusId)) return;
    viewedLocal.current.add(statusId);
    setContacts((list) => applyViewed(list, statusId, chatId));
    post(`/whatsapp/contact-statuses/${encodeURIComponent(statusId)}/view`).catch(() => {});
  }, []);

  const byId = useMemo(() => {
    const m = new Map();
    contacts.forEach((c) => m.set(c.chat_id, c));
    return m;
  }, [contacts]);

  return { contacts, byId, syncedAt, loading, syncing, unavailable, error, load, sync, markViewed };
}
