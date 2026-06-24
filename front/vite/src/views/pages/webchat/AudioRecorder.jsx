import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';

// Gravador simples baseado em MediaRecorder. Devolve um data URL via onSave
// quando o usuário confirma. Pra manter baixo o tamanho do JSON do funil
// (settings vai inteiro junto pro DB), gravamos com bitrate baixo (24 kbps)
// e tetomos 60s. Resultado típico: 100-180 KB pra 60s.

const MAX_DURATION_SEC = 60;
const MIME_PREFERENCE = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
];

function pickMime() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return '';
  for (const mime of MIME_PREFERENCE) {
    try {
      if (window.MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* segue */
    }
  }
  return '';
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler áudio.'));
    reader.readAsDataURL(blob);
  });
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function AudioRecorder({ initialDataUrl = '', initialDuration = 0, onSave, onCancel }) {
  const [phase, setPhase] = useState(initialDataUrl ? 'preview' : 'idle'); // idle, recording, preview
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(initialDuration);
  const [dataUrl, setDataUrl] = useState(initialDataUrl);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);
  const stoppedAtRef = useRef(0);
  const fileInputRef = useRef(null);

  useEffect(() => () => stopAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAll() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    setError('');
    chunksRef.current = [];
    stoppedAtRef.current = 0;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Seu navegador não suporta gravação de áudio.');
      return;
    }
    if (!window.MediaRecorder) {
      setError('Seu navegador não suporta MediaRecorder.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Permissão de microfone negada ou indisponível.');
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 24_000 } : undefined);
    } catch {
      setError('Não foi possível iniciar a gravação.');
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const seconds = stoppedAtRef.current;
      try {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const url = await blobToDataUrl(blob);
        setDataUrl(url);
        setElapsed(seconds);
        setPhase('preview');
      } catch {
        setError('Falha ao processar o áudio gravado.');
      } finally {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }
    };

    setElapsed(0);
    setPhase('recording');
    const startedAt = Date.now();
    tickRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(sec);
      if (sec >= MAX_DURATION_SEC) {
        stoppedAtRef.current = sec;
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
        if (tickRef.current) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }
    }, 250);

    try {
      recorder.start();
    } catch {
      setError('Não foi possível iniciar a gravação.');
      stopAll();
      setPhase('idle');
    }
  }

  function stopRecording() {
    stoppedAtRef.current = elapsed;
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }

  function discardRecording() {
    setDataUrl('');
    setElapsed(0);
    setPhase('idle');
  }

  // Upload de arquivo de áudio (mp3, ogg, wav, etc).
  // Calcula duração via metadata e converte pra dataUrl.
  async function handleAudioFile(event) {
    setError('');
    const file = event?.target?.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('audio/')) {
      setError('O arquivo selecionado não é de áudio.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Áudio muito grande (máx 5MB no original).');
      return;
    }
    let url;
    try {
      url = await blobToDataUrl(file);
    } catch {
      setError('Falha ao ler o arquivo.');
      return;
    }
    // Tenta obter duração via metadata
    let durationSec = 0;
    try {
      durationSec = await new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        const cleanup = () => {
          audio.src = '';
        };
        audio.onloadedmetadata = () => {
          const d = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
          cleanup();
          resolve(d);
        };
        audio.onerror = () => {
          cleanup();
          resolve(0);
        };
        audio.src = url;
        // timeout defensivo
        window.setTimeout(() => resolve(0), 4000);
      });
    } catch {
      durationSec = 0;
    }
    setDataUrl(url);
    setElapsed(durationSec);
    setPhase('preview');
  }

  function confirm() {
    if (!dataUrl) return;
    onSave?.({ dataUrl, durationSec: elapsed });
  }

  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      {error ? (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          {error}
        </Typography>
      ) : null}

      {phase === 'idle' && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button variant="contained" color="error" size="small" onClick={startRecording}>
              ● Gravar áudio
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Enviar arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={handleAudioFile}
            />
            {onCancel ? (
              <Button size="small" onClick={onCancel} sx={{ ml: 'auto' }}>
                Cancelar
              </Button>
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Gravação: máx. {MAX_DURATION_SEC}s (bitrate baixo pra economizar storage). Upload: máx. 5MB, qualquer formato de áudio.
          </Typography>
        </Stack>
      )}

      {phase === 'recording' && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'error.main',
              animation: 'pulse 1s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
          <Typography variant="body2">Gravando… {formatTime(elapsed)}</Typography>
          <Button variant="outlined" size="small" onClick={stopRecording} sx={{ ml: 'auto' }}>
            Parar
          </Button>
        </Stack>
      )}

      {phase === 'preview' && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">Pré-visualização ({formatTime(elapsed)})</Typography>
            <IconButton size="small" onClick={discardRecording} sx={{ ml: 'auto' }} aria-label="descartar">
              ✕
            </IconButton>
          </Stack>
          {dataUrl ? <audio controls src={dataUrl} style={{ width: '100%' }} /> : null}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" onClick={confirm}>
              Salvar áudio
            </Button>
            <Button size="small" onClick={discardRecording}>
              Regravar
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
