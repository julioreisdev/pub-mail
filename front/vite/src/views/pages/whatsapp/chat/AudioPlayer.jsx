import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconDownload, IconHeadphones, IconMicrophone, IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react';

import { WA_DARK, WA_GREEN, dlUrl } from '../waShared';

// ============================================================================
// Player de áudio compacto (estilo WhatsApp): play/pausa, barra de progresso,
// tempo, velocidade 1x/1,5x/2x e download. Só um áudio toca por vez.
// ============================================================================
let playingNow = null;
const SPEEDS = [1, 1.5, 2];
const fmt = (s) => {
  const v = Number.isFinite(s) && s > 0 ? Math.floor(s) : 0;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

const BARS = 44;
// reamostra a forma de onda do servidor (64 barras 0..100) para N barras; sem forma de onda, barras baixas e iguais
function resample(peaks, n) {
  if (!Array.isArray(peaks) || !peaks.length) return Array.from({ length: n }, () => 22);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * peaks.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
    let m = 0;
    for (let k = a; k < b && k < peaks.length; k++) m = Math.max(m, Number(peaks[k]) || 0);
    out.push(Math.max(8, Math.min(100, m)));
  }
  return out;
}

// Barras estilo WhatsApp: a parte já tocada fica na cor de destaque; clicar/arrastar busca a posição.
function Waveform({ peaks, progress, onSeek, disabled, out, voice }) {
  const ref = useRef(null);
  const bars = useMemo(() => resample(peaks, BARS), [peaks]);
  const seekAt = (clientX) => {
    const el = ref.current;
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))));
  };
  const onPointerDown = (e) => {
    e.stopPropagation();
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekAt(e.clientX);
  };
  const onPointerMove = (e) => {
    if (e.buttons & 1) seekAt(e.clientX);
  };
  const played = Math.round(progress * BARS * 100) / 100;
  // Cores por tema (a bolha de saída é verde-clara no modo claro e verde-escura no escuro —
  // barras brancas sumiam no claro). Vão em variáveis CSS para o gradiente da barra parcial.
  const on = 'var(--wv-on)';
  const offColor = 'var(--wv-off)';
  const colors = (t) => ({
    '--wv-on': voice ? (out ? WA_DARK : WA_GREEN) : '#54656f',
    '--wv-off': out ? 'rgba(17,27,33,.28)' : 'rgba(84,101,111,.32)',
    ...t.applyStyles('dark', {
      '--wv-on': out ? 'rgba(255,255,255,.95)' : voice ? WA_GREEN : '#8696a0',
      '--wv-off': out ? 'rgba(255,255,255,.4)' : 'rgba(134,150,160,.4)'
    })
  });
  return (
    <Box
      ref={ref}
      role="slider"
      aria-label="Posição do áudio"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onClick={(e) => e.stopPropagation()}
      sx={(t) => ({
        ...colors(t),
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        height: 30,
        width: '100%',
        cursor: disabled ? 'default' : 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1
      })}
    >
      {bars.map((h, i) => {
        const fill = i + 1 <= played ? 1 : i < played ? played - i : 0;
        return (
          <Box
            key={i}
            sx={{
              flex: 1,
              minWidth: 2,
              height: `${Math.max(3, Math.round((h / 100) * 26))}px`,
              borderRadius: 2,
              background:
                fill >= 1
                  ? on
                  : fill > 0
                    ? `linear-gradient(90deg, ${on} ${Math.round(fill * 100)}%, ${offColor} ${Math.round(fill * 100)}%)`
                    : offColor
            }}
          />
        );
      })}
    </Box>
  );
}

export default function AudioPlayer({ url, voice, out, waveform, durationMs }) {
  const aRef = useRef(null);
  const fixingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  // A URL é assinada e pode mudar a cada atualização da conversa. Trocar o `src` no meio recarrega o
  // áudio e zera a reprodução — então a fonte só muda quando é OUTRA mídia (caminho diferente).
  const mediaKey = String(url || '').split('?')[0];
  const [src, setSrc] = useState(url);
  const latestUrl = useRef(url);
  latestUrl.current = url;
  const retried = useRef(false);
  useEffect(() => {
    setSrc(latestUrl.current);
    setFailed(false);
    setCur(0);
    setDur(0);
    retried.current = false;
  }, [mediaKey]);
  const onError = () => {
    // link vencido: tenta uma vez com o link mais novo, voltando para onde estava
    const a = aRef.current;
    if (!retried.current && latestUrl.current && latestUrl.current !== src) {
      retried.current = true;
      const at = a?.currentTime || 0;
      setSrc(latestUrl.current);
      window.setTimeout(() => {
        try {
          if (aRef.current && at > 0) aRef.current.currentTime = at;
        } catch {
          /* sem metadados ainda */
        }
      }, 400);
      return;
    }
    setFailed(true);
  };

  useEffect(
    () => () => {
      const a = aRef.current;
      if (a) a.pause();
      if (playingNow === a) playingNow = null;
    },
    []
  );

  // Enquanto toca, a posição é lida a cada quadro (o evento `timeupdate` dispara só ~4×/s e a
  // onda avançava aos pulos); o gradiente da barra parcial faz o avanço contínuo entre barras.
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    const tick = () => {
      const a = aRef.current;
      if (a && !fixingRef.current) setCur(a.currentTime);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [playing]);

  // gravações webm/ogg do navegador vêm sem duração (Infinity) até o fim: força o cálculo
  const onMeta = () => {
    const a = aRef.current;
    if (!a) return;
    if (!Number.isFinite(a.duration)) {
      fixingRef.current = true;
      try {
        a.currentTime = 1e7;
      } catch {
        fixingRef.current = false;
      }
    } else setDur(a.duration);
  };
  const onTime = () => {
    const a = aRef.current;
    if (!a) return;
    if (fixingRef.current) {
      fixingRef.current = false;
      if (Number.isFinite(a.duration)) setDur(a.duration);
      a.currentTime = 0;
      return;
    }
    setCur(a.currentTime);
  };
  const onDuration = () => {
    const a = aRef.current;
    if (a && !fixingRef.current && Number.isFinite(a.duration)) setDur(a.duration);
  };

  const toggle = async (e) => {
    e?.stopPropagation?.();
    const a = aRef.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    if (playingNow && playingNow !== a) playingNow.pause();
    playingNow = a;
    a.playbackRate = speed;
    try {
      await a.play();
    } catch {
      setFailed(true);
    }
  };

  const cycleSpeed = (e) => {
    e.stopPropagation();
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (aRef.current) aRef.current.playbackRate = next;
  };

  const seekRatio = (ratio) => {
    const a = aRef.current;
    const total = dur || (durationMs ? durationMs / 1000 : 0);
    if (!a || !total) return;
    const n = ratio * total;
    try {
      a.currentTime = n;
    } catch {
      /* metadados ainda não carregaram */
    }
    setCur(n);
  };

  const shown = playing || cur > 0 ? cur : dur || (durationMs ? durationMs / 1000 : 0);

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: 236, sm: 290 }, maxWidth: '100%', py: 0.25 }}>
      <audio
        ref={aRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onMeta}
        onDurationChange={onDuration}
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        onError={onError}
        style={{ display: 'none' }}
      />
      <Box
        component="button"
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar' : 'Tocar'}
        sx={{
          width: 38,
          height: 38,
          p: 0,
          border: 0,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          color: '#fff',
          bgcolor: voice ? WA_GREEN : '#8696a0',
          boxShadow: '0 2px 6px rgba(0,0,0,.14)',
          transition: 'transform .1s ease, background-color .12s',
          '&:hover': { bgcolor: voice ? WA_DARK : '#667781' },
          '&:active': { transform: 'scale(.94)' }
        }}
      >
        {playing ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} style={{ marginLeft: 2 }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Waveform
          peaks={waveform}
          progress={(() => {
            const total = dur || (durationMs ? durationMs / 1000 : 0);
            return total ? Math.min(1, cur / total) : 0;
          })()}
          onSeek={seekRatio}
          disabled={failed || !(dur || durationMs)}
          out={out}
          voice={voice}
        />
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
          {voice ? <IconMicrophone size={12} style={{ opacity: 0.6 }} /> : <IconHeadphones size={12} style={{ opacity: 0.6 }} />}
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
            {failed ? 'Não foi possível tocar' : fmt(shown)}
          </Typography>
          <Box
            component="button"
            type="button"
            onClick={cycleSpeed}
            title="Velocidade"
            sx={{
              border: 0,
              cursor: 'pointer',
              px: 0.6,
              height: 17,
              borderRadius: 10,
              fontSize: 10.5,
              fontWeight: 800,
              lineHeight: 1,
              color: 'inherit',
              bgcolor: speed === 1 ? 'rgba(128,128,128,.18)' : 'rgba(37,211,102,.28)',
              fontVariantNumeric: 'tabular-nums',
              '&:hover': { bgcolor: 'rgba(128,128,128,.3)' }
            }}
          >
            {String(speed).replace('.', ',')}x
          </Box>
        </Stack>
      </Box>
      <Tooltip title="Baixar">
        <IconButton
          size="small"
          component="a"
          href={dlUrl(url)}
          onClick={(e) => e.stopPropagation()}
          sx={{ color: 'inherit', opacity: 0.65, '&:hover': { opacity: 1 } }}
        >
          <IconDownload size={16} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
