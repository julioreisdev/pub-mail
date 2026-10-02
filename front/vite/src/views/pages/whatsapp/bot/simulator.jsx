// =============================================================================
// WhatsApp — Fluxo do Bot: simulador (celular de mentira). Testa o rascunho
// ATUAL (não salvo) via POST /whatsapp/bot/simulate — nada vai ao WhatsApp.
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, InputBase, Stack, Tooltip, Typography } from '@mui/material';
import {
  IconBolt,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconFile,
  IconHeadset,
  IconHourglass,
  IconInfoCircle,
  IconPlayerSkipForward,
  IconQrcode,
  IconRefresh,
  IconRobot,
  IconSend2,
  IconTags,
  IconVariable,
  IconX
} from '@tabler/icons-react';

import { post } from 'api/api';
import { fmtBRL, simNodeOf } from './botModel';
import { TagChip, TypingDots, WA_ACCENT, WA_DARK, WA_GREEN, WA_TEAL, WaText, hexA, useBot, waBg, waFg } from './botUi';

const MAX_WAIT = 8000;
const FAST_WAIT = 350;
const now = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
const secsLabel = (s) => {
  const n = Number(s) || 0;
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  if (n < 86400) return `${Math.round(n / 360) / 10} h`.replace('.', ',');
  return `${Math.round(n / 8640) / 10} dias`.replace('.', ',');
};
const errText = (e) => {
  const status = e?.response?.status;
  if (status === 404) return 'O simulador ainda não está disponível no servidor. Tente de novo depois da atualização.';
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || 'Não foi possível simular.');
};

// números das opções na última mensagem do bot (atalhos de resposta)
// montado via fromCharCode (sem escapes \u nus no fonte): VS16 (FE0F), keycap (20E3) e 🔟 (D83D DD1F)
const VS16 = String.fromCharCode(0xfe0f);
const KEYCAP = String.fromCharCode(0x20e3);
const TEN = String.fromCharCode(0xd83d, 0xdd1f);
const KEYCAP_RE = new RegExp(`^\\s*((?:\\d(?:${VS16})?${KEYCAP})+|${TEN}|\\d{1,2}[.)-])`, 'u');
const quickNumbers = (text) => {
  const out = [];
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const m = KEYCAP_RE.exec(line);
      if (!m) return;
      const tok = m[1];
      const n = tok.includes(TEN) ? 10 : parseInt(tok.replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && !out.includes(n)) out.push(n);
    });
  return out.slice(0, 10);
};

// ---------------------------------------------------------------------------
// Balões
// ---------------------------------------------------------------------------
function Bubble({ mine, children, time }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', px: 1.25 }}>
      <Box
        sx={[
          {
            position: 'relative',
            maxWidth: '84%',
            minWidth: 64,
            px: 1,
            pt: 0.7,
            pb: 0.45,
            borderRadius: '9px',
            fontSize: 13.5,
            lineHeight: 1.4,
            boxShadow: '0 1px 1px rgba(0,0,0,0.13)'
          },
          mine ? { borderTopRightRadius: '3px' } : { borderTopLeftRadius: '3px' },
          waBg(mine ? 'out' : 'in'),
          waFg('text')
        ]}
      >
        {children}
        <Typography component="div" sx={[{ fontSize: 10, textAlign: 'right', mt: 0.2, lineHeight: 1 }, waFg('meta')]}>
          {time}
        </Typography>
      </Box>
    </Box>
  );
}

function BotMessage({ message }) {
  const kind = message?.kind || 'text';
  const media = message?.media;
  const text = message?.text;
  return (
    <>
      {kind === 'image' && media?.url ? (
        <Box
          component="img"
          src={media.url}
          alt=""
          sx={{ display: 'block', width: '100%', maxWidth: 240, borderRadius: 1.5, mb: text ? 0.6 : 0.2 }}
        />
      ) : null}
      {kind === 'video' && media?.url ? (
        <Box
          component="video"
          src={media.url}
          controls
          sx={{ display: 'block', width: '100%', maxWidth: 240, borderRadius: 1.5, mb: text ? 0.6 : 0.2, bgcolor: '#000' }}
        />
      ) : null}
      {kind === 'audio' && media?.url ? (
        <Box component="audio" src={media.url} controls sx={{ display: 'block', width: 230, height: 38, mb: 0.3 }} />
      ) : null}
      {kind === 'document' ? (
        <Stack
          component={media?.url ? 'a' : 'div'}
          href={media?.url || undefined}
          target="_blank"
          rel="noreferrer"
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            p: 0.9,
            mb: text ? 0.6 : 0.2,
            borderRadius: 1.5,
            bgcolor: 'rgba(0,0,0,0.07)',
            color: 'inherit',
            textDecoration: 'none',
            minWidth: 180
          }}
        >
          <IconFile size={22} />
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, maxWidth: 190 }}>
            {media?.filename || 'Documento'}
          </Typography>
        </Stack>
      ) : null}
      {kind !== 'text' && !media?.url ? (
        <Typography sx={{ fontSize: 12, opacity: 0.7, fontStyle: 'italic', mb: text ? 0.4 : 0 }}>[{kind} sem arquivo]</Typography>
      ) : null}
      {text ? <WaText text={text} /> : null}
    </>
  );
}

function Note({ icon: Icon = IconInfoCircle, children, tone = 'info' }) {
  const color = { info: '#64748B', ok: '#16A34A', warn: '#D97706', error: '#DC2626', brand: WA_DARK, blue: '#2563EB' }[tone] || '#64748B';
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', px: 2 }}>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={[
          {
            maxWidth: '92%',
            px: 1.1,
            py: 0.5,
            borderRadius: 2,
            fontSize: 11.5,
            fontWeight: 600,
            lineHeight: 1.4,
            boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
            border: `1px solid ${hexA(color, 0.3)}`
          },
          (t) => ({ bgcolor: '#fff8e1', color: '#54656f', ...t.applyStyles('dark', { bgcolor: '#182229', color: '#aebac1' }) })
        ]}
      >
        <Box sx={{ color, display: 'flex', flexShrink: 0 }}>
          <Icon size={14} />
        </Box>
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Stack>
    </Box>
  );
}

function PixCard({ item }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!item.code) return;
    navigator.clipboard
      ?.writeText(item.code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', px: 1.25 }}>
      <Box
        sx={[
          { width: '84%', borderRadius: '9px', borderTopLeftRadius: '3px', overflow: 'hidden', boxShadow: '0 1px 1px rgba(0,0,0,0.13)' },
          waBg('in'),
          waFg('text')
        ]}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 1, bgcolor: hexA('#0D9488', 0.12) }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: '#0D9488', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <IconQrcode size={19} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>{fmtBRL(item.amount_cents)}</Typography>
            <Typography noWrap sx={{ fontSize: 11.5, opacity: 0.75 }}>
              {item.description || 'Cobrança PIX'}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, opacity: 0.6, mb: 0.4 }}>PIX COPIA E COLA (simulado)</Typography>
          <Box
            sx={{
              fontFamily: 'monospace',
              fontSize: 11,
              wordBreak: 'break-all',
              p: 0.75,
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.06)',
              maxHeight: 54,
              overflow: 'hidden'
            }}
          >
            {item.code || '—'}
          </Box>
          <Button
            size="small"
            fullWidth
            onClick={copy}
            startIcon={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, color: WA_ACCENT }}
          >
            {copied ? 'Copiado!' : 'Copiar código'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Simulador
// ---------------------------------------------------------------------------
export default function BotSimulator({ getPayload, flowSig, onClose, onCurrentNode }) {
  const { attendants } = useBot();
  const [items, setItems] = useState([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState({ pix: false, wait: false });
  const [fast, setFast] = useState(false);
  const [startSig, setStartSig] = useState(null);

  const stateRef = useRef(null);
  const endedRef = useRef(false);
  const runRef = useRef(0);
  const skipRef = useRef(null);
  const fastRef = useRef(false);
  fastRef.current = fast;
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const seq = useRef(0);

  const push = useCallback((item) => setItems((p) => [...p, { id: ++seq.current, at: now(), ...item }]), []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items.length, typing]);

  useEffect(
    () => () => {
      runRef.current += 1;
      skipRef.current?.();
      onCurrentNode?.(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sleep = (ms) =>
    new Promise((resolve) => {
      const wait = fastRef.current ? Math.min(ms, FAST_WAIT) : Math.min(ms, MAX_WAIT);
      let t = null;
      const done = () => {
        if (t) clearTimeout(t);
        skipRef.current = null;
        resolve();
      };
      t = setTimeout(done, Math.max(0, wait));
      skipRef.current = done;
    });

  const play = async (actions, runId) => {
    let typedMs = 0;
    for (const a of actions || []) {
      if (runId !== runRef.current) return;
      switch (a?.type) {
        case 'typing': {
          const ms = Number(a.ms) || 0;
          if (ms > 0) {
            setTyping(true);
            await sleep(ms);
            setTyping(false);
            typedMs += ms;
          }
          break;
        }
        case 'send': {
          const wait = Math.max(0, (Number(a.delay_ms) || 0) - typedMs);
          typedMs = 0;
          if (wait > 0) {
            setTyping(true);
            await sleep(wait);
            setTyping(false);
          }
          if (runId !== runRef.current) return;
          push({ kind: 'bot', message: a.message || {} });
          await sleep(fastRef.current ? 60 : 280);
          break;
        }
        case 'info':
          push({ kind: 'note', tone: 'info', text: a.text });
          break;
        case 'tags':
          push({ kind: 'tags', add: a.add || [], remove: a.remove || [] });
          break;
        case 'set_var':
          push({ kind: 'note', tone: 'brand', icon: IconVariable, text: `{{${a.name}}} = ${a.value ?? ''}` });
          break;
        case 'handoff': {
          const who = a.assign_user_id ? (attendants || []).find((x) => x.id === a.assign_user_id) : null;
          push({
            kind: 'note',
            tone: 'blue',
            icon: IconHeadset,
            text: a.assign_user_id
              ? `Conversa transferida para ${who?.name || 'o atendente escolhido'}.`
              : 'Conversa transferida para a fila de atendimento.'
          });
          break;
        }
        case 'close':
          push({ kind: 'note', tone: 'ok', icon: IconCircleCheck, text: 'Atendimento encerrado.' });
          break;
        case 'pix':
          push({ kind: 'pix', amount_cents: a.amount_cents, description: a.description, code: a.code });
          setPending((p) => ({ ...p, pix: true }));
          break;
        case 'wait':
          push({ kind: 'note', tone: 'warn', icon: IconHourglass, text: `O bot vai esperar ${secsLabel(a.seconds)} antes de continuar.` });
          setPending((p) => ({ ...p, wait: true }));
          break;
        default:
          break;
      }
    }
  };

  const run = async ({ text, event }) => {
    if (busy) return;
    const t = String(text || '').trim();
    if (!event && !t) return;
    const runId = runRef.current;
    let state = stateRef.current;
    if (endedRef.current && !event) {
      push({ kind: 'divider', text: 'Nova conversa' });
      state = null;
      stateRef.current = null;
      endedRef.current = false;
    }
    if (!state && !event) setStartSig(flowSig);
    if (t) push({ kind: 'user', text: t });
    if (event === 'pix_paid' || event === 'pix_expired') setPending((p) => ({ ...p, pix: false }));
    if (event === 'wait_done') setPending((p) => ({ ...p, wait: false }));
    setInput('');
    setBusy(true);
    try {
      const { definition, settings } = getPayload();
      const body = { definition, settings };
      if (state) body.state = state;
      if (t) body.input = t;
      if (event) body.event = event;
      const r = await post('/whatsapp/bot/simulate', body);
      if (runId !== runRef.current) return;
      stateRef.current = r?.state ?? null;
      endedRef.current = Boolean(r?.ended);
      onCurrentNode?.(r?.ended ? null : simNodeOf(r?.state));
      await play(r?.actions || [], runId);
      if (runId !== runRef.current) return;
      if (r?.ended) {
        setPending({ pix: false, wait: false });
        push({ kind: 'end' });
      }
    } catch (e) {
      if (runId !== runRef.current) return;
      push({ kind: 'note', tone: 'error', text: errText(e) });
    } finally {
      if (runId === runRef.current) {
        setBusy(false);
        setTyping(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  };

  const restart = () => {
    runRef.current += 1;
    skipRef.current?.();
    stateRef.current = null;
    endedRef.current = false;
    setItems([]);
    setTyping(false);
    setBusy(false);
    setPending({ pix: false, wait: false });
    setStartSig(null);
    onCurrentNode?.(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // atalhos numéricos: última mensagem do bot depois da última fala do cliente
  const lastUserIdx = items.map((i) => i.kind).lastIndexOf('user');
  const lastBot = [...items.slice(lastUserIdx + 1)].reverse().find((i) => i.kind === 'bot');
  const quick = !busy && lastBot && !endedRef.current ? quickNumbers(lastBot.message?.text) : [];
  const changed = startSig && flowSig !== startSig && items.length > 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* barra do "celular" */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={[
          { px: 1.25, py: 1, color: '#fff', flexShrink: 0 },
          (t) => ({ bgcolor: WA_TEAL, ...t.applyStyles('dark', { bgcolor: '#202c33' }) })
        ]}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: WA_GREEN, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <IconRobot size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }} noWrap>
            Simulador do bot
          </Typography>
          <Typography sx={{ fontSize: 11, opacity: 0.8 }} noWrap>
            {typing ? 'digitando…' : 'rascunho atual · nada é enviado'}
          </Typography>
        </Box>
        <Tooltip title={fast ? 'Rápido: pula as esperas' : 'Tempo real: respeita o "digitando…" (até 8 s)'}>
          <IconButton size="small" onClick={() => setFast((v) => !v)} sx={{ color: fast ? '#FDE68A' : 'rgba(255,255,255,0.85)' }}>
            <IconBolt size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reiniciar conversa">
          <IconButton size="small" onClick={restart} sx={{ color: 'rgba(255,255,255,0.9)' }}>
            <IconRefresh size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fechar simulador">
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.9)' }}>
            <IconX size={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      {changed ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            px: 1.25,
            py: 0.6,
            bgcolor: hexA('#F59E0B', 0.14),
            borderBottom: '1px solid',
            borderColor: hexA('#F59E0B', 0.3),
            flexShrink: 0
          }}
        >
          <Typography sx={{ fontSize: 11.5, flex: 1, fontWeight: 600 }}>Você alterou o fluxo durante o teste.</Typography>
          <Button size="small" onClick={restart} sx={{ textTransform: 'none', fontWeight: 700, py: 0, color: '#B45309' }}>
            Reiniciar
          </Button>
        </Stack>
      ) : null}

      {/* conversa */}
      <Box
        ref={listRef}
        sx={[
          {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
            backgroundSize: '14px 14px'
          },
          waBg('wallpaper')
        ]}
      >
        {items.length === 0 && !busy ? (
          <Box sx={{ m: 'auto', px: 3, textAlign: 'center' }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                mx: 'auto',
                mb: 1.25,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
                boxShadow: `0 8px 20px ${hexA(WA_DARK, 0.35)}`
              }}
            >
              <IconRobot size={30} />
            </Box>
            <Typography sx={[{ fontWeight: 800, fontSize: 15 }, waFg('text')]}>Teste seu fluxo</Typography>
            <Typography sx={[{ fontSize: 12.5, mt: 0.5, lineHeight: 1.5 }, waFg('meta')]}>
              Escreva como se fosse o cliente. O teste usa o que está na tela agora, mesmo sem salvar — e nada é enviado ao WhatsApp.
            </Typography>
            <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.75 }}>
              {['Oi', 'Olá, bom dia!', 'Quero saber o preço'].map((q) => (
                <Box
                  key={q}
                  component="button"
                  type="button"
                  onClick={() => run({ text: q })}
                  sx={[
                    {
                      border: 'none',
                      cursor: 'pointer',
                      px: 1.25,
                      py: 0.6,
                      borderRadius: 5,
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.12)'
                    },
                    waBg('out'),
                    waFg('text')
                  ]}
                >
                  {q}
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}

        {items.map((it) => {
          if (it.kind === 'user')
            return (
              <Bubble key={it.id} mine time={it.at}>
                <WaText text={it.text} />
              </Bubble>
            );
          if (it.kind === 'bot')
            return (
              <Bubble key={it.id} time={it.at}>
                <BotMessage message={it.message} />
              </Bubble>
            );
          if (it.kind === 'pix') return <PixCard key={it.id} item={it} />;
          if (it.kind === 'tags')
            return (
              <Note key={it.id} icon={IconTags} tone="brand">
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <span>Etiquetas:</span>
                  {(it.add || []).map((t) => (
                    <TagChip key={`a-${t.id || t.name}`} tag={t} prefix="+" />
                  ))}
                  {(it.remove || []).map((t) => (
                    <TagChip key={`r-${t.id || t.name}`} tag={t} prefix="−" />
                  ))}
                </Stack>
              </Note>
            );
          if (it.kind === 'end')
            return (
              <Note key={it.id} icon={IconCircleCheck} tone="ok">
                O fluxo terminou. Mande outra mensagem para começar de novo.
              </Note>
            );
          if (it.kind === 'divider')
            return (
              <Stack key={it.id} direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.5 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography sx={[{ fontSize: 11, fontWeight: 700 }, waFg('meta')]}>{it.text}</Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Stack>
            );
          return (
            <Note key={it.id} icon={it.icon} tone={it.tone}>
              {it.text}
            </Note>
          );
        })}

        {typing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25 }}>
            <Box
              sx={[
                {
                  px: 1.4,
                  py: 1.1,
                  borderRadius: '9px',
                  borderTopLeftRadius: '3px',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
                  display: 'flex'
                },
                waBg('in'),
                waFg('meta')
              ]}
            >
              <TypingDots size={6} />
            </Box>
            {!fast ? (
              <Tooltip title="Pular a espera">
                <IconButton size="small" onClick={() => skipRef.current?.()} sx={[{ p: 0.5 }, waFg('meta')]}>
                  <IconPlayerSkipForward size={15} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        ) : null}
        {busy && !typing ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
            <CircularProgress size={16} sx={{ color: WA_ACCENT }} />
          </Box>
        ) : null}
      </Box>

      {/* ações de evento */}
      {(pending.pix || pending.wait) && !busy ? (
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 1.25, py: 0.9, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}
        >
          {pending.pix ? (
            <>
              <Button
                size="small"
                variant="contained"
                disableElevation
                startIcon={<IconCircleCheck size={16} />}
                onClick={() => run({ event: 'pix_paid' })}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#16A34A', '&:hover': { bgcolor: '#15803D' } }}
              >
                Simular pagamento
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconHourglass size={16} />}
                onClick={() => run({ event: 'pix_expired' })}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#C2410C', borderColor: hexA('#EA580C', 0.5) }}
              >
                Simular expiração
              </Button>
            </>
          ) : null}
          {pending.wait ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconPlayerSkipForward size={16} />}
              onClick={() => run({ event: 'wait_done' })}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: WA_ACCENT, borderColor: hexA(WA_DARK, 0.5) }}
            >
              Pular espera
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {/* atalhos numéricos */}
      {quick.length ? (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            px: 1.25,
            pt: 0.9,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, alignSelf: 'center', mr: 0.25, whiteSpace: 'nowrap' }}>
            Responder:
          </Typography>
          {quick.map((n) => (
            <Box
              key={n}
              component="button"
              type="button"
              onClick={() => run({ text: String(n) })}
              sx={{
                border: `1px solid ${hexA(WA_DARK, 0.4)}`,
                bgcolor: hexA(WA_GREEN, 0.08),
                color: WA_ACCENT,
                cursor: 'pointer',
                borderRadius: 5,
                minWidth: 30,
                px: 1,
                py: 0.3,
                fontWeight: 800,
                fontSize: 12.5,
                fontFamily: 'inherit',
                '&:hover': { bgcolor: hexA(WA_GREEN, 0.18) }
              }}
            >
              {n}
            </Box>
          ))}
        </Stack>
      ) : null}

      {/* campo de mensagem */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-end"
        sx={[{ px: 1, py: 1, flexShrink: 0 }, (t) => ({ bgcolor: '#f0f2f5', ...t.applyStyles('dark', { bgcolor: '#202c33' }) })]}
      >
        <Box
          sx={[
            { flex: 1, px: 1.5, py: 0.9, borderRadius: 5, minWidth: 0 },
            (t) => ({ bgcolor: '#fff', ...t.applyStyles('dark', { bgcolor: '#2a3942' }) })
          ]}
        >
          <InputBase
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder={endedRef.current ? 'Mande algo para recomeçar…' : 'Mensagem do cliente'}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                run({ text: input });
              }
            }}
            sx={[{ fontSize: 14, p: 0 }, waFg('text')]}
          />
        </Box>
        <IconButton
          onClick={() => run({ text: input })}
          disabled={busy || !input.trim()}
          sx={{
            width: 42,
            height: 42,
            flexShrink: 0,
            color: '#fff',
            bgcolor: WA_GREEN,
            '&:hover': { bgcolor: WA_DARK },
            '&.Mui-disabled': { color: '#fff', bgcolor: hexA(WA_GREEN, 0.45) }
          }}
        >
          {busy ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <IconSend2 size={19} />}
        </IconButton>
      </Stack>
    </Box>
  );
}
