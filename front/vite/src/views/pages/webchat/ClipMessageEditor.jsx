import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, LinearProgress, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { IconLink, IconPlayerPlay, IconTrash, IconUpload, IconVideo } from '@tabler/icons-react';
import { post } from 'api/api';
import RichTextField from './RichTextField';
import { normalizeVideoUrl } from './funnel-utils';

const MAX_MB = 120;

function formatMb(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(n > 50 * 1048576 ? 0 : 1)} MB`;
}

// Editor compartilhado do "Vídeo" PÚBLICO do webchat (funil e boas-vindas do
// builder visual). Sobe o arquivo para POST /webchats/media (vira MP4 H.264,
// servido em /uploads) ou aceita um link .mp4 já hospedado. `value` é
// { url, caption, autoplay }; `onPatch` recebe só os campos alterados.
export default function ClipMessageEditor({ value, onPatch, showCaption = true, compact = false }) {
  const url = String(value?.url || '');
  const inputRef = useRef(null);
  const [mode, setMode] = useState('upload');
  const [progress, setProgress] = useState(null); // null | 0..100 | 'processing'
  const [error, setError] = useState('');
  const [linkDraft, setLinkDraft] = useState(url);
  const [fileInfo, setFileInfo] = useState(null);

  useEffect(() => {
    if (mode === 'link') setLinkDraft(url);
  }, [url, mode]);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!/^video\//i.test(file.type) && !/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name || '')) {
      setError('Escolha um arquivo de vídeo (mp4, mov, webm…).');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Vídeo acima de ${MAX_MB} MB. Comprima antes ou hospede fora e cole o link.`);
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setProgress(0);
    try {
      const res = await post('/webchats/media', fd, {
        headers: { 'Content-Type': undefined },
        timeout: 0,
        onUploadProgress: (ev) => {
          if (!ev?.total) return;
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setProgress(pct >= 100 ? 'processing' : pct);
        },
      });
      const data = res?.data ?? res;
      if (!data?.url) throw new Error('Resposta sem URL');
      setFileInfo({ name: data.name || file.name, size: data.size_bytes || file.size });
      onPatch({ url: data.url });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Falha ao enviar o vídeo.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const applyLink = () => {
    const clean = normalizeVideoUrl(linkDraft);
    if (linkDraft.trim() && !clean) {
      setError('Link inválido: use um endereço https:// direto para o arquivo de vídeo (.mp4).');
      return;
    }
    setError('');
    setFileInfo(null);
    onPatch({ url: clean });
  };

  const uploading = progress !== null;

  return (
    <Stack spacing={1.25}>
      {url ? (
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: '#000',
            border: '1px solid',
            borderColor: 'divider',
            maxWidth: compact ? 320 : 420,
          }}
        >
          <video
            key={url}
            src={url}
            controls
            playsInline
            preload="metadata"
            muted
            style={{ width: '100%', maxHeight: compact ? 200 : 260, display: 'block', background: '#000' }}
          />
          <Tooltip title="Remover vídeo">
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => {
                setFileInfo(null);
                setLinkDraft('');
                onPatch({ url: '' });
              }}
              sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, p: 0.6, borderRadius: 2, boxShadow: 2 }}
            >
              <IconTrash size={16} />
            </Button>
          </Tooltip>
        </Box>
      ) : null}

      {url && fileInfo ? (
        <Typography variant="caption" color="text.secondary" noWrap>
          {fileInfo.name} · {formatMb(fileInfo.size)} · convertido para MP4
        </Typography>
      ) : null}

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant={mode === 'upload' ? 'contained' : 'outlined'}
          startIcon={<IconUpload size={15} />}
          onClick={() => setMode('upload')}
          sx={{ borderRadius: 2 }}
        >
          Enviar arquivo
        </Button>
        <Button
          size="small"
          variant={mode === 'link' ? 'contained' : 'outlined'}
          startIcon={<IconLink size={15} />}
          onClick={() => setMode('link')}
          sx={{ borderRadius: 2 }}
        >
          Colar link
        </Button>
      </Stack>

      {mode === 'upload' ? (
        <Box
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading) handleFile(e.dataTransfer?.files?.[0]);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: compact ? 1.25 : 1.75,
            textAlign: 'center',
            cursor: uploading ? 'progress' : 'pointer',
            bgcolor: 'action.hover',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mp4,.mov,.webm,.m4v"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Stack spacing={0.5} alignItems="center">
            <IconVideo size={compact ? 22 : 28} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {url ? 'Trocar o vídeo' : 'Clique ou arraste o vídeo aqui'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              MP4, MOV ou WebM até {MAX_MB} MB. Convertido para tocar em qualquer celular.
            </Typography>
          </Stack>
          {uploading ? (
            <Box sx={{ mt: 1.25 }} onClick={(e) => e.stopPropagation()}>
              <LinearProgress
                variant={progress === 'processing' ? 'indeterminate' : 'determinate'}
                value={progress === 'processing' ? undefined : progress}
                sx={{ borderRadius: 1, height: 6 }}
              />
              <Typography variant="caption" color="text.secondary">
                {progress === 'processing' ? 'Convertendo o vídeo no servidor…' : `Enviando… ${progress}%`}
              </Typography>
            </Box>
          ) : null}
        </Box>
      ) : (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            size="small"
            fullWidth
            label="Link direto do vídeo (.mp4)"
            placeholder="https://…/video.mp4"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onBlur={applyLink}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
            }}
            helperText="Precisa ser o arquivo em si (termina em .mp4), não uma página do YouTube/Vimeo."
          />
          <Button size="small" variant="outlined" onClick={applyLink} sx={{ mt: 0.25, borderRadius: 2, whiteSpace: 'nowrap' }}>
            Usar link
          </Button>
        </Stack>
      )}

      {error ? (
        <Alert severity="error" sx={{ py: 0.25 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <FormControlLabel
        control={<Switch size="small" checked={value?.autoplay !== false} onChange={(e) => onPatch({ autoplay: e.target.checked })} />}
        label={
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconPlayerPlay size={14} />
            <Typography variant="body2">Tocar automaticamente quando o navegador permitir</Typography>
          </Stack>
        }
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        Quando o navegador bloqueia o autoplay (1ª visita sem toque), o vídeo aparece com um botão de play grande no centro.
      </Typography>

      {showCaption ? (
        <RichTextField
          label="Legenda (opcional)"
          placeholder="Texto abaixo do vídeo… pode usar {{nome}} ou {{q_nome}}."
          value={value?.caption || ''}
          onChange={(html) => onPatch({ caption: html })}
          minHeight={48}
        />
      ) : null}
    </Stack>
  );
}
