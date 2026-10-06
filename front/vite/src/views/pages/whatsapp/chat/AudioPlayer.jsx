import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconDownload, IconHeadphones, IconMicrophone, IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react';

import { WA_DARK, WA_GREEN, dual, dlUrl } from '../waShared';

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

export default function AudioPlayer({ url, voice, out }) {
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

  const seek = (_, v) => {
    const a = aRef.current;
    const n = Array.isArray(v) ? v[0] : v;
    if (!a || !dur) return;
    a.currentTime = n;
    setCur(n);
  };

  const accent = voice ? dual({ color: WA_DARK }, { color: WA_GREEN }) : dual({ color: '#54656f' }, { color: '#aebac1' });
  const shown = playing || cur > 0 ? cur : dur;

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
        <Slider
          size="small"
          min={0}
          max={dur || 1}
          step={0.1}
          value={Math.min(cur, dur || 1)}
          onChange={seek}
          disabled={!dur}
          aria-label="Posição do áudio"
          onClick={(e) => e.stopPropagation()}
          sx={[
            accent,
            {
              display: 'block',
              height: 4,
              py: '9px',
              '& .MuiSlider-thumb': { width: 11, height: 11, boxShadow: 'none', '&:hover, &.Mui-focusVisible': { boxShadow: 'none' } },
              '& .MuiSlider-rail': { opacity: out ? 0.3 : 0.22 },
              '&.Mui-disabled': { color: 'inherit', opacity: 0.55 }
            }
          ]}
        />
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: -0.5 }}>
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
