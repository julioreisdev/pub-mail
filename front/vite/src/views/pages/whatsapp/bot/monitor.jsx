// =============================================================================
// WhatsApp — Fluxo do Bot: aba "Conversas" (monitor).
//   GET  /whatsapp/bot/sessions?session_id=   → conversas que o bot está conduzindo agora
//   POST /whatsapp/chats/:chatId/bot {action:'stop'} → tirar a conversa do bot
// Mostra só as conversas do fluxo aberto; filtro por número quando a org tem mais de um.
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { IconExternalLink, IconMessageChatbot, IconPlayerStop, IconRefresh } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { TgAvatar, TgCard, TgConfirmDialog, TgEmptyState, TgStatusPill } from 'views/pages/telegram/ui';
import { WaNumberChip, WaNumberSelect } from '../waKit';
import { fmtAgo, fmtPhone } from '../waShared';
import { NODE_META, WA_ACCENT, WA_DARK, hexA } from './botUi';

const POLL_MS = 10000;
const enc = (v) => encodeURIComponent(String(v));
const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const WAITING = {
  menu: 'Aguardando uma opção',
  question: 'Aguardando a resposta',
  pix: 'Aguardando o pagamento',
  wait: 'Em espera programada'
};

export default function BotMonitor({ flowId, flowName, sessions = [], byId, nodes = [] }) {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState('');
  const [items, setItems] = useState(null); // null = carregando
  const [refreshing, setRefreshing] = useState(false);
  const [stopping, setStopping] = useState(null); // item a confirmar
  const [stopBusy, setStopBusy] = useState(false);
  const seq = useRef(0);

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const multi = sessions.length > 1;

  const load = useCallback(
    async ({ silent = true } = {}) => {
      const s = ++seq.current;
      if (!silent) setRefreshing(true);
      try {
        const r = await get('/whatsapp/bot/sessions', { params: sessionId ? { session_id: sessionId } : {} });
        if (s !== seq.current) return;
        const list = Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : [];
        setItems(list.filter((it) => !flowId || !it.flow_id || it.flow_id === flowId));
      } catch (e) {
        if (s !== seq.current) return;
        setItems((p) => p || []);
        if (!silent) toast.error(errMsg(e, 'Não foi possível carregar as conversas.'));
      } finally {
        if (s === seq.current) setRefreshing(false);
      }
    },
    [sessionId, flowId]
  );

  useEffect(() => {
    setItems(null);
    load();
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const confirmStop = async () => {
    const it = stopping;
    if (!it?.chat?.chat_id) return;
    setStopBusy(true);
    try {
      await post(`/whatsapp/chats/${enc(it.chat.chat_id)}/bot`, { action: 'stop' });
      toast.success('Conversa retirada do bot.');
      setStopping(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível tirar a conversa do bot.'));
    } finally {
      setStopBusy(false);
    }
  };

  const loading = items === null;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15.5 }}>Conversas com o bot agora</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Clientes que o fluxo “{flowName}” está atendendo neste momento. Atualiza sozinho a cada {POLL_MS / 1000} s.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {multi ? (
            <WaNumberSelect
              sessions={sessions}
              value={sessionId}
              onChange={setSessionId}
              allowAll
              fullWidth={false}
              sx={{ minWidth: 220 }}
            />
          ) : null}
          <Tooltip title="Atualizar agora">
            <span>
              <IconButton size="small" onClick={() => load({ silent: false })} disabled={refreshing} sx={{ color: WA_ACCENT }}>
                {refreshing ? <CircularProgress size={18} color="inherit" /> : <IconRefresh size={19} />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} sx={{ color: WA_ACCENT }} />
        </Stack>
      ) : !items.length ? (
        <TgEmptyState
          dense
          icon={IconMessageChatbot}
          title="Nenhuma conversa com o bot agora"
          description={
            multi && sessionId
              ? 'Nenhum cliente deste número está no fluxo neste momento.'
              : 'Quando um cliente entrar no fluxo, a conversa aparece aqui com o passo em que ele está.'
          }
        />
      ) : (
        <Stack spacing={1}>
          {items.map((it) => {
            const chat = it.chat || {};
            const session = chat.session || byId?.get(it.session_id) || null;
            const node = it.node_id ? nodesById.get(it.node_id) : null;
            const meta = node ? NODE_META[node.type] : null;
            const stepLabel = node
              ? node.type === 'start'
                ? 'Início'
                : `${meta?.label || node.type}${node.data?.title ? ` · ${node.data.title}` : ''}`
              : it.node_id
                ? 'Bloco removido do fluxo'
                : 'Início';
            const waiting = it.status === 'waiting' || it.waiting_for;
            const name = chat.name || (chat.phone ? fmtPhone(chat.phone) : chat.jid || 'Contato');
            const key = `${it.session_id}|${chat.chat_id || chat.jid}`;
            return (
              <TgCard key={key} hover={false} sx={{ p: 1.5 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                    <TgAvatar name={name} photoPath={chat.chat_id ? `/whatsapp/chats/${enc(chat.chat_id)}/photo` : undefined} size={40} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 800, fontSize: 14 }} noWrap>
                          {name}
                        </Typography>
                        {session ? <WaNumberChip session={session} /> : null}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {chat.phone && chat.name ? `${fmtPhone(chat.phone)} · ` : ''}
                        {it.updated_at ? `atualizado ${fmtAgo(it.updated_at)}` : ''}
                        {it.started_at ? ` · começou ${fmtAgo(it.started_at)}` : ''}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.4,
                        borderRadius: 1.5,
                        fontSize: 12,
                        fontWeight: 700,
                        color: meta?.color || 'text.secondary',
                        bgcolor: hexA(meta?.color || '#94A3B8', 0.13),
                        maxWidth: 240
                      }}
                    >
                      <Typography component="span" variant="caption" sx={{ fontWeight: 700, display: 'block' }} noWrap>
                        {stepLabel}
                      </Typography>
                    </Box>
                    <TgStatusPill
                      status={waiting ? 'pending' : 'active'}
                      label={waiting ? WAITING[it.waiting_for] || 'Aguardando' : 'Em andamento'}
                    />
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<IconExternalLink size={15} />}
                      disabled={!chat.chat_id}
                      onClick={() => navigate(`/whatsapp/chat?chat=${enc(chat.chat_id)}`)}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: WA_ACCENT, borderColor: hexA(WA_DARK, 0.4) }}
                    >
                      Abrir conversa
                    </Button>
                    <Tooltip title="Tirar do bot (a conversa fica livre para um atendente)">
                      <span>
                        <IconButton size="small" color="error" disabled={!chat.chat_id} onClick={() => setStopping(it)}>
                          <IconPlayerStop size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </TgCard>
            );
          })}
        </Stack>
      )}

      <TgConfirmDialog
        open={Boolean(stopping)}
        onClose={() => !stopBusy && setStopping(null)}
        onConfirm={confirmStop}
        loading={stopBusy}
        danger
        title="Tirar a conversa do bot?"
        message="O bot para de responder esta conversa agora. O cliente pode voltar ao fluxo mandando uma nova mensagem depois da janela de reinício."
        confirmLabel="Tirar do bot"
      />
    </Box>
  );
}
