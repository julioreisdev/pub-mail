import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Dialog, Fade, IconButton, InputBase, Stack, Tooltip, Typography } from '@mui/material';
import {
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhotoOff,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconSend,
  IconVideoOff,
  IconVolume,
  IconVolumeOff,
  IconX
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { post } from 'api/api';
import { TgAvatar } from 'views/pages/telegram/ui';
import { errMsg } from '../waShared';
import { WA_DARK, WA_GREEN, WA_TEAL } from '../waKit';
import { agoShort, displayName, firstUnviewedIndex, normColor, viewerFont } from './statusShared';

// =============================================================================
// StoryViewer — visualizador em tela cheia dos status de um contato (estilo
// WhatsApp): barras de progresso, avanço automático (5 s texto/imagem; duração
// do vídeo/áudio), toque esquerda/direita, segurar = pausa, ←/→/Espaço/Esc,
// responder (vira mensagem no chat citando o status) e reagir.
// Fundo sempre escuro (não segue o tema do painel — é um "player").
// =============================================================================

const STORY_MS = 5000;
const HOLD_MS = 220;
const REACTIONS = ['😍', '😂', '😮', '😢', '👏', '🔥'];
const TYPE_LABEL = { text: 'Texto', image: 'Foto', video: 'Vídeo', voice: 'Áudio' };
const OMITTED_ICON = { image: IconPhotoOff, video: IconVideoOff, voice: IconMicrophoneOff, text: IconPhotoOff };

const fmtDur = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const textSize = (len) => (len < 30 ? 34 : len < 80 ? 28 : len < 160 ? 23 : len < 320 ? 19 : 16);

const glassBtn = {
  color: '#fff',
  bgcolor: 'rgba(0,0,0,0.18)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.38)' },
  '&.Mui-disabled': { color: 'rgba(255,255,255,0.35)' }
};

// ----------------------------------------------------------------------------
// barras de progresso (a ativa é animada por ref, sem re-render a cada frame)
// ----------------------------------------------------------------------------
function ProgressBars({ count, index, fillRef }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{ flex: 1, height: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
          <Box
            ref={i === index ? fillRef : undefined}
            // a barra ativa é escrita pelo relógio (rAF); as demais têm o valor fixo inline
            // (isso também limpa o que o relógio deixou quando ela deixa de ser a ativa)
            style={i === index ? undefined : { transform: i < index ? 'scaleX(1)' : 'scaleX(0)' }}
            sx={{
              height: '100%',
              width: '100%',
              bgcolor: '#fff',
              transformOrigin: 'left center',
              transform: 'scaleX(0)',
              boxShadow: '0 0 4px rgba(0,0,0,0.25)'
            }}
          />
        </Box>
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// ondas animadas do status de voz
// ----------------------------------------------------------------------------
function Waveform({ playing }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', height: 46 }}>
      {Array.from({ length: 28 }).map((_, k) => (
        <Box
          key={k}
          sx={{
            width: 4,
            borderRadius: 3,
            height: 10 + ((k * 13) % 30),
            bgcolor: 'rgba(255,255,255,0.88)',
            transformOrigin: 'center',
            animation: `waStoryWave 1.1s ease-in-out ${(k % 7) * 0.09}s infinite`,
            animationPlayState: playing ? 'running' : 'paused',
            '@keyframes waStoryWave': { '0%,100%': { transform: 'scaleY(0.45)' }, '50%': { transform: 'scaleY(1)' } }
          }}
        />
      ))}
    </Box>
  );
}

// =============================================================================
export default function StoryViewer({ open, startChatId, queue = [], byId, onClose, onViewed, onOpenChat, blocked }) {
  const [pos, setPos] = useState(null); // { chatId, index }
  const [restartKey, setRestartKey] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [typing, setTyping] = useState(false);
  const [footerHover, setFooterHover] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sentFor, setSentFor] = useState(null); // chat_id que já recebeu resposta nesta sessão do viewer
  const [reacted, setReacted] = useState({}); // statusId → emoji
  const [reacting, setReacting] = useState(null);
  const [bursts, setBursts] = useState([]);

  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const fillRef = useRef(null);
  const timeRef = useRef(null);
  const mediaRef = useRef(null);
  const inputRef = useRef(null);
  const elapsed = useRef(0);
  const holdTimer = useRef(null);
  const downAt = useRef(0);

  const contact = pos ? byId.get(pos.chatId) : null;
  const status = contact?.statuses?.[pos?.index] || null;
  const url = status?.media?.url || '';
  const kind = !status ? null : status.type === 'text' ? 'text' : !url || status.media_omitted || failed ? 'omitted' : status.type;
  // "toque para tocar" só vale para mídia que toca (se falhou, vira o painel de indisponível)
  const tapNeeded = needsTap && (kind === 'voice' || kind === 'video');
  const paused = userPaused || hold || typing || footerHover || hidden || tapNeeded;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const kindRef = useRef(kind);
  kindRef.current = kind;

  // ---------------------------------------------------------------- abrir
  useEffect(() => {
    if (!open || !startChatId) return;
    const c = byIdRef.current.get(startChatId);
    setPos({ chatId: startChatId, index: firstUnviewedIndex(c) });
    setUserPaused(false);
    setHold(false);
    setTyping(false);
    setFooterHover(false);
    setReply('');
    setSentFor(null);
  }, [open, startChatId]);

  // status sumiu (expirou/removido numa atualização): ajusta o índice; contato sumiu → fecha
  useEffect(() => {
    if (!open || !pos || status) return;
    const n = contact?.statuses?.length || 0;
    if (n > 0) setPos({ chatId: pos.chatId, index: Math.min(pos.index, n - 1) });
    else onCloseRef.current?.();
  }, [open, pos, status, contact]);

  // novo status na tela → zera o estado de mídia
  useEffect(() => {
    elapsed.current = 0;
    setFailed(false);
    setBuffering(false);
    setNeedsTap(false);
    setReady(!status || status.type === 'text' || !status.media?.url || status.media_omitted);
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)';
  }, [status?.id, restartKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // mídia indisponível conta 5 s como texto
  useEffect(() => {
    if (kind === 'omitted') setReady(true);
  }, [kind]);

  // marca como visto (1× por status)
  useEffect(() => {
    if (open && status && !status.viewed && pos) onViewed?.(status.id, pos.chatId);
  }, [open, status?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- navegação
  const goNext = useCallback(() => {
    if (!pos) return;
    const c = byIdRef.current.get(pos.chatId);
    if (c && pos.index < c.statuses.length - 1) {
      setPos({ chatId: pos.chatId, index: pos.index + 1 });
      return;
    }
    const q = queueRef.current;
    for (let i = q.indexOf(pos.chatId) + 1; i < q.length; i += 1) {
      const n = byIdRef.current.get(q[i]);
      if (n?.statuses?.length) {
        setPos({ chatId: q[i], index: firstUnviewedIndex(n) });
        setReply('');
        return;
      }
    }
    onCloseRef.current?.();
  }, [pos]);

  const goPrev = useCallback(() => {
    if (!pos) return;
    if (pos.index > 0) {
      setPos({ chatId: pos.chatId, index: pos.index - 1 });
      return;
    }
    const q = queueRef.current;
    for (let i = q.indexOf(pos.chatId) - 1; i >= 0; i -= 1) {
      const n = byIdRef.current.get(q[i]);
      if (n?.statuses?.length) {
        setPos({ chatId: q[i], index: n.statuses.length - 1 });
        setReply('');
        return;
      }
    }
    setRestartKey((k) => k + 1); // já é o 1º → recomeça
  }, [pos]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const goPrevRef = useRef(goPrev);
  goPrevRef.current = goPrev;

  const hasPrev = (() => {
    if (!pos) return false;
    if (pos.index > 0) return true;
    const q = queue;
    return q.slice(0, Math.max(0, q.indexOf(pos.chatId))).some((id) => byId.get(id)?.statuses?.length);
  })();

  // ---------------------------------------------------------------- relógio (rAF)
  useEffect(() => {
    if (!open || !status) return undefined;
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(120, now - last);
      last = now;
      const k = kindRef.current;
      let p = 0;
      if (k === 'video' || k === 'voice') {
        const m = mediaRef.current;
        if (m && Number.isFinite(m.duration) && m.duration > 0) {
          p = m.currentTime / m.duration;
          if (timeRef.current) timeRef.current.textContent = `${fmtDur(m.currentTime)} / ${fmtDur(m.duration)}`;
        }
      } else {
        if (!pausedRef.current && readyRef.current) elapsed.current += dt;
        p = elapsed.current / STORY_MS;
        if (p >= 1) {
          if (fillRef.current) fillRef.current.style.transform = 'scaleX(1)';
          goNextRef.current();
          return;
        }
      }
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, status?.id, kind, restartKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- mídia: tocar / pausar / som
  useEffect(() => {
    const m = mediaRef.current;
    if (!open || !m || (kind !== 'video' && kind !== 'voice')) return;
    if (kind === 'video') m.muted = muted;
    if (paused && !needsTap) {
      m.pause();
      return;
    }
    if (needsTap) return;
    const pr = m.play();
    if (pr && typeof pr.catch === 'function') {
      pr.catch((e) => {
        if (e?.name === 'NotAllowedError') {
          if (kind === 'video' && !m.muted) {
            // som bloqueado pelo navegador → volta pro mudo e segue
            m.muted = true;
            setMuted(true);
            m.play().catch(() => setNeedsTap(true));
          } else setNeedsTap(true);
        }
      });
    }
  }, [open, paused, needsTap, muted, kind, status?.id, restartKey]);

  const tapToPlay = () => {
    const m = mediaRef.current;
    if (!m) return;
    m.play()
      .then(() => setNeedsTap(false))
      .catch(() => {});
  };

  // ---------------------------------------------------------------- teclado / aba oculta
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const tag = String(e.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextRef.current();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevRef.current();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        setUserPaused((p) => !p);
      } else if (e.key === 'm') {
        setMuted((v) => !v);
      }
    };
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  // ---------------------------------------------------------------- toque (esq/dir) e segurar
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downAt.current = Date.now();
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHold(true), HOLD_MS);
  };
  const onPointerUp = (e) => {
    clearTimeout(holdTimer.current);
    const started = downAt.current;
    downAt.current = 0;
    if (!started) return;
    const wasHold = Date.now() - started >= HOLD_MS;
    setHold(false);
    if (wasHold) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) goPrev();
    else goNext();
  };
  const onPointerCancel = () => {
    clearTimeout(holdTimer.current);
    downAt.current = 0;
    setHold(false);
  };

  // ---------------------------------------------------------------- responder / reagir
  const chatId = pos?.chatId;
  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sending || !status || blocked) return;
    setSending(true);
    try {
      await post(`/whatsapp/contact-statuses/${encodeURIComponent(status.id)}/reply`, { text });
      setReply('');
      setSentFor(chatId);
      toast.success('Resposta enviada no chat');
      inputRef.current?.blur();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível enviar a resposta.'));
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (emoji) => {
    if (!status || reacting || blocked) return;
    setReacting(emoji);
    try {
      await post(`/whatsapp/contact-statuses/${encodeURIComponent(status.id)}/react`, { emoji });
      setReacted((r) => ({ ...r, [status.id]: emoji }));
      const id = `${Date.now()}-${Math.random()}`;
      setBursts((b) => [...b, { id, emoji }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1300);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível reagir a este status.'));
    } finally {
      setReacting(null);
    }
  };

  const openChat = () => {
    const id = chatId;
    onClose?.();
    if (id) onOpenChat?.(id);
  };

  // ---------------------------------------------------------------- render
  const name = displayName(contact);
  const caption = status && status.type !== 'text' ? String(status.caption || status.text || '').trim() : '';
  const uiHidden = hold;
  const vf = viewerFont(status?.font);
  const textBody = status?.type === 'text' ? String(status.text || status.caption || '') : '';
  const OmitIcon = OMITTED_ICON[status?.type] || IconPhotoOff;

  let content = null;
  if (status && kind === 'text') {
    content = (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: normColor(status.background_color),
          display: 'grid',
          placeItems: 'center',
          px: { xs: 3, sm: 4 },
          py: 12
        }}
      >
        <Typography
          component="div"
          sx={{
            fontFamily: vf.family,
            fontWeight: vf.weight,
            textTransform: vf.upper ? 'uppercase' : 'none',
            fontSize: textSize(textBody.length),
            lineHeight: 1.3,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.22)',
            maxHeight: '100%',
            overflow: 'hidden'
          }}
        >
          {textBody || ' '}
        </Typography>
      </Box>
    );
  } else if (status && kind === 'image') {
    content = (
      <>
        <Box
          sx={{
            position: 'absolute',
            inset: -30,
            backgroundImage: `url("${url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(28px) brightness(0.5)',
            opacity: ready ? 1 : 0,
            transition: 'opacity .3s ease'
          }}
        />
        <img
          key={`${status.id}-${restartKey}`}
          src={url}
          alt={caption || 'Status'}
          draggable={false}
          onLoad={() => setReady(true)}
          onError={() => {
            setFailed(true);
            setNeedsTap(false);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: ready ? 1 : 0,
            transition: 'opacity .25s ease'
          }}
        />
      </>
    );
  } else if (status && kind === 'video') {
    content = (
      <video
        key={`${status.id}-${restartKey}`}
        ref={mediaRef}
        src={url}
        playsInline
        muted={muted}
        preload="auto"
        onPlaying={() => {
          setReady(true);
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onEnded={() => goNextRef.current()}
        onError={() => {
          setFailed(true);
          setNeedsTap(false);
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      />
    );
  } else if (status && kind === 'voice') {
    content = (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(165deg, ${WA_TEAL} 0%, ${WA_DARK} 55%, ${WA_GREEN} 130%)`,
          display: 'grid',
          placeItems: 'center',
          px: 3
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ borderRadius: '50%', p: '4px', bgcolor: 'rgba(255,255,255,0.22)' }}>
              <TgAvatar name={name} photoPath={contact?.photo_path} size={116} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: WA_GREEN,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                border: '3px solid',
                borderColor: WA_DARK
              }}
            >
              <IconMicrophone size={18} />
            </Box>
          </Box>
          <Waveform playing={ready && !paused && !buffering} />
          <Typography
            ref={timeRef}
            sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
          >
            0:00
          </Typography>
        </Stack>
        <audio
          key={`${status.id}-${restartKey}`}
          ref={mediaRef}
          src={url}
          preload="auto"
          onPlaying={() => {
            setReady(true);
            setBuffering(false);
          }}
          onWaiting={() => setBuffering(true)}
          onEnded={() => goNextRef.current()}
          onError={() => {
            setFailed(true);
            setNeedsTap(false);
          }}
        />
      </Box>
    );
  } else if (status && kind === 'omitted') {
    content = (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 38%, #233138 0%, #0b141a 72%)',
          display: 'grid',
          placeItems: 'center',
          px: 4,
          textAlign: 'center'
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.8)',
              bgcolor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)'
            }}
          >
            <OmitIcon size={40} stroke={1.6} />
          </Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Mídia não disponível</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, maxWidth: 290 }}>
            {failed
              ? 'Não foi possível carregar este arquivo — o link pode ter expirado. Tente atualizar os status.'
              : `O WhatsApp não enviou ${status.type === 'video' ? 'este vídeo' : status.type === 'voice' ? 'este áudio' : 'esta foto'} para o Pub Mail. Veja no celular.`}
          </Typography>
        </Stack>
      </Box>
    );
  }

  const showSpinner =
    status && ((kind === 'image' && !ready) || ((kind === 'video' || kind === 'voice') && (!ready || buffering) && !tapNeeded));
  const myReaction = status ? reacted[status.id] : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slots={{ transition: Fade }}
      slotProps={{
        paper: { sx: { bgcolor: '#07090c', backgroundImage: 'none', overflow: 'hidden' } },
        // só limpa depois do fade-out (sem "piscar" vazio ao fechar)
        transition: { onExited: () => setPos(null) }
      }}
      aria-label={contact ? `Status de ${name}` : 'Status'}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: 'radial-gradient(circle at 50% 30%, #161d24 0%, #07090c 70%)'
        }}
      >
        {/* seta anterior (desktop) */}
        <IconButton
          aria-label="Status anterior"
          onClick={goPrev}
          disabled={!hasPrev}
          sx={{
            ...glassBtn,
            display: { xs: 'none', md: 'inline-flex' },
            width: 48,
            height: 48,
            bgcolor: 'rgba(255,255,255,0.08)',
            visibility: hasPrev ? 'visible' : 'hidden'
          }}
        >
          <IconChevronLeft size={26} />
        </IconButton>

        {/* ---------------- palco 9:16 ---------------- */}
        <Box
          sx={{
            position: 'relative',
            height: { xs: '100%', md: 'min(calc(100dvh - 40px), 880px)' },
            width: { xs: '100%', md: 'auto' },
            aspectRatio: { md: '9 / 16' },
            borderRadius: { xs: 0, md: 3 },
            overflow: 'hidden',
            bgcolor: '#000',
            boxShadow: { md: '0 30px 80px rgba(0,0,0,0.55)' },
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          {content}

          {/* camada de toque: esquerda volta, direita avança, segurar pausa */}
          <Box
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerCancel}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          />

          {/* carregando / tocar áudio */}
          {showSpinner ? (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <CircularProgress size={42} thickness={3.5} sx={{ color: 'rgba(255,255,255,0.9)' }} />
            </Box>
          ) : null}
          {tapNeeded ? (
            <Box sx={{ position: 'absolute', inset: 0, zIndex: 3, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <Button
                variant="contained"
                disableElevation
                onClick={tapToPlay}
                startIcon={<IconPlayerPlayFilled size={18} />}
                sx={{
                  pointerEvents: 'auto',
                  mt: 22,
                  borderRadius: 5,
                  px: 2.5,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' }
                }}
              >
                Tocar áudio
              </Button>
            </Box>
          ) : null}

          {/* reações que sobem */}
          {bursts.map((b) => (
            <Box
              key={b.id}
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 140,
                zIndex: 4,
                fontSize: 64,
                pointerEvents: 'none',
                animation: 'waStoryBurst 1.25s cubic-bezier(.2,.8,.3,1) forwards',
                '@keyframes waStoryBurst': {
                  '0%': { transform: 'translate(-50%, 20px) scale(0.4)', opacity: 0 },
                  '25%': { transform: 'translate(-50%, -30px) scale(1.25)', opacity: 1 },
                  '100%': { transform: 'translate(-50%, -220px) scale(0.9)', opacity: 0 }
                }
              }}
            >
              {b.emoji}
            </Box>
          ))}

          {/* ---------------- topo: barras + contato + ações ---------------- */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 3,
              px: 1.25,
              pt: 'max(10px, env(safe-area-inset-top))',
              pb: 3,
              background: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0))',
              opacity: uiHidden ? 0 : 1,
              transition: 'opacity .2s ease'
            }}
          >
            {contact ? <ProgressBars count={contact.statuses.length} index={pos?.index ?? 0} fillRef={fillRef} /> : null}
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 1.25 }}>
              <TgAvatar name={name} photoPath={contact?.photo_path} size={38} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }} noWrap>
                  {name}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.2 }} noWrap>
                  {agoShort(status?.posted_at)}
                  {status ? ` · ${TYPE_LABEL[status.type] || 'Status'}` : ''}
                  {paused && !hold ? ' · pausado' : ''}
                </Typography>
              </Box>
              {kind === 'video' ? (
                <Tooltip title={muted ? 'Ativar som (M)' : 'Silenciar (M)'}>
                  <IconButton
                    size="small"
                    onClick={() => setMuted((v) => !v)}
                    sx={glassBtn}
                    aria-label={muted ? 'Ativar som' : 'Silenciar'}
                  >
                    {muted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
                  </IconButton>
                </Tooltip>
              ) : null}
              <Tooltip title={userPaused ? 'Continuar (Espaço)' : 'Pausar (Espaço)'}>
                <IconButton
                  size="small"
                  onClick={() => setUserPaused((p) => !p)}
                  sx={glassBtn}
                  aria-label={userPaused ? 'Continuar' : 'Pausar'}
                >
                  {userPaused ? <IconPlayerPlayFilled size={18} /> : <IconPlayerPauseFilled size={18} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Fechar (Esc)">
                <IconButton size="small" onClick={onClose} sx={glassBtn} aria-label="Fechar">
                  <IconX size={20} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* ---------------- rodapé: legenda + reações + responder ---------------- */}
          <Box
            // mouse sobre a área de resposta pausa (no toque não: o "hover" emulado ficaria preso)
            onPointerEnter={(e) => e.pointerType === 'mouse' && setFooterHover(true)}
            onPointerLeave={() => setFooterHover(false)}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              px: 1.5,
              pt: 5,
              pb: 'max(12px, env(safe-area-inset-bottom))',
              background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.78) 45%)',
              opacity: uiHidden ? 0 : 1,
              transition: 'opacity .2s ease'
            }}
          >
            {caption ? (
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: 14.5,
                  lineHeight: 1.4,
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 132,
                  overflowY: 'auto',
                  mb: 1.25,
                  px: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,0.45)'
                }}
              >
                {caption}
              </Typography>
            ) : null}

            {sentFor && sentFor === chatId ? (
              <Stack direction="row" justifyContent="center" sx={{ mb: 1 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    pl: 1.25,
                    pr: 0.5,
                    py: 0.25,
                    borderRadius: 5,
                    bgcolor: 'rgba(37,211,102,0.18)',
                    border: '1px solid rgba(37,211,102,0.45)',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 600
                  }}
                >
                  <IconCheck size={14} color={WA_GREEN} stroke={3} />
                  Resposta enviada
                  <Button
                    size="small"
                    onClick={openChat}
                    endIcon={<IconArrowRight size={14} />}
                    sx={{ color: WA_GREEN, textTransform: 'none', fontWeight: 800, minWidth: 0, px: 1, py: 0.25, borderRadius: 5 }}
                  >
                    Abrir conversa
                  </Button>
                </Box>
              </Stack>
            ) : null}

            <Stack direction="row" justifyContent="center" spacing={0.5} sx={{ mb: 1.25 }}>
              {REACTIONS.map((em) => {
                const on = myReaction === em;
                return (
                  <Tooltip key={em} title={blocked ? 'Conecte o WhatsApp para reagir' : 'Reagir'} disableInteractive>
                    <span>
                      <IconButton
                        onClick={() => sendReaction(em)}
                        disabled={Boolean(reacting) || blocked || !status}
                        aria-label={`Reagir com ${em}`}
                        sx={{
                          width: 42,
                          height: 42,
                          fontSize: 24,
                          lineHeight: 1,
                          transition: 'transform .15s ease, background-color .15s ease',
                          bgcolor: on ? 'rgba(37,211,102,0.28)' : 'rgba(255,255,255,0.08)',
                          boxShadow: on ? `inset 0 0 0 2px ${WA_GREEN}` : 'none',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', transform: 'scale(1.15)' },
                          '&.Mui-disabled': { opacity: reacting === em ? 1 : 0.45 }
                        }}
                      >
                        {reacting === em ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : em}
                      </IconButton>
                    </span>
                  </Tooltip>
                );
              })}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <InputBase
                inputRef={inputRef}
                value={reply}
                onChange={(e) => setReply(e.target.value.slice(0, 1000))}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                disabled={blocked || !status}
                placeholder={blocked ? 'Conecte o WhatsApp para responder' : `Responder a ${name}…`}
                inputProps={{ 'aria-label': 'Responder ao status', enterKeyHint: 'send' }}
                sx={{
                  flex: 1,
                  height: 46,
                  px: 2,
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14.5,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  transition: 'border-color .15s ease, background-color .15s ease',
                  '&.Mui-focused': { borderColor: WA_GREEN, bgcolor: 'rgba(255,255,255,0.14)' },
                  '& input::placeholder': { color: 'rgba(255,255,255,0.7)', opacity: 1 },
                  '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.16)', bgcolor: 'rgba(255,255,255,0.06)' },
                  '& input.Mui-disabled': { WebkitTextFillColor: 'rgba(255,255,255,0.7)' },
                  '& input.Mui-disabled::placeholder': { color: 'rgba(255,255,255,0.62)' }
                }}
              />
              <IconButton
                onClick={sendReply}
                disabled={!reply.trim() || sending || blocked}
                aria-label="Enviar resposta"
                sx={{
                  width: 46,
                  height: 46,
                  flexShrink: 0,
                  color: '#fff',
                  bgcolor: WA_GREEN,
                  '&:hover': { bgcolor: WA_DARK },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.45)' }
                }}
              >
                {sending ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <IconSend size={20} />}
              </IconButton>
            </Stack>
          </Box>
        </Box>

        {/* seta próxima (desktop) */}
        <IconButton
          aria-label="Próximo status"
          onClick={goNext}
          sx={{ ...glassBtn, display: { xs: 'none', md: 'inline-flex' }, width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.08)' }}
        >
          <IconChevronRight size={26} />
        </IconButton>
      </Box>
    </Dialog>
  );
}
