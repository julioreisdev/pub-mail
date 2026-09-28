import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import {
  IconPhoto,
  IconVideo,
  IconFile,
  IconMicrophone,
  IconPlayerStop,
  IconX,
  IconUpload,
  IconPlus,
  IconCheck,
  IconTrash,
  IconRefresh
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { post } from 'api/api';
import { errMsg, fmtBytes, mediaKind, WA_GREEN, WA_DARK, waButtonSx } from './waKit';

// ============================================================================
// Campo de mídia do WhatsApp: imagem/vídeo/documento (upload) + áudio
// (gravar/ouvir/enviar). Upload → POST /whatsapp/media (multipart `file`)
// → { id, kind, mime, filename, size, url }. Variante do TelegramMediaField.
// ============================================================================

const ALL_TABS = [
  { key: 'image', label: 'Imagem', icon: IconPhoto, accept: 'image/*' },
  { key: 'video', label: 'Vídeo', icon: IconVideo, accept: 'video/*' },
  { key: 'voice', label: 'Áudio', icon: IconMicrophone, accept: 'audio/*' },
  { key: 'document', label: 'Doc', icon: IconFile, accept: '*/*' }
];
const KIND_ICON = { image: IconPhoto, video: IconVideo, voice: IconMicrophone, document: IconFile };
const KIND_LABEL = { image: 'Imagem', video: 'Vídeo', voice: 'Áudio', document: 'Documento' };
const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const tintGreen = (a) => `rgba(37, 211, 102, ${a})`;

export default function WhatsAppMediaField({ value, onChange, kinds, label = 'Adicionar mídia', autoOpen = false }) {
  const TABS = kinds?.length ? ALL_TABS.filter((t) => kinds.includes(t.key)) : ALL_TABS;
  const [open, setOpen] = useState(() => autoOpen && !(value && value.url));
  const [tab, setTab] = useState(TABS[0]?.key || 'image');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [recUrl, setRecUrl] = useState('');

  const fileRef = useRef(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const recBlobRef = useRef(null);

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(
    () => () => {
      if (recUrl) URL.revokeObjectURL(recUrl);
    },
    [recUrl]
  );

  const clearPendingRec = () => {
    if (recUrl) URL.revokeObjectURL(recUrl);
    setRecUrl('');
    recBlobRef.current = null;
    setRecSecs(0);
  };

  const uploadMedia = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await post('/whatsapp/media', fd, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      const media = {
        id: res?.id,
        kind: mediaKind({ kind: res?.kind, mime: res?.mime || file.type }),
        mime: res?.mime || file.type,
        filename: res?.filename || file.name,
        size: res?.size ?? file.size,
        url: res?.url
      };
      onChange(media);
      toast.success('Mídia adicionada.');
      setOpen(false);
      clearPendingRec();
    } catch (e) {
      toast.error(errMsg(e, 'Falha no upload.'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const pickFile = (accept) => {
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
  };
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) uploadMedia(f);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading || recording) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) uploadMedia(f);
  };

  // ---- gravação (segura o blob → só envia no "Usar áudio") ----
  const startRec = async () => {
    clearPendingRec();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data?.size) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        recBlobRef.current = blob;
        setRecUrl(URL.createObjectURL(blob));
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecSecs(0);
      setRecording(true);
    } catch {
      toast.error('Não foi possível acessar o microfone.');
    }
  };
  const stopRec = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
  };
  const useRec = () => {
    const blob = recBlobRef.current;
    if (!blob) return;
    const ext = (blob.type || '').includes('ogg') ? 'ogg' : 'webm';
    uploadMedia(new File([blob], `audio.${ext}`, { type: blob.type || 'audio/webm' }));
  };

  const active = TABS.find((t) => t.key === tab) || TABS[0];
  const kind = mediaKind(value);

  // -------- preview (mídia escolhida) --------
  if (value && value.url && !open) {
    const Icon = KIND_ICON[kind] || IconFile;
    return (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.25, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ flexShrink: 0 }}>
            {kind === 'image' ? (
              <img src={value.url} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
            ) : kind === 'video' ? (
              <video
                src={value.url}
                controls
                style={{ width: 128, height: 72, borderRadius: 10, objectFit: 'cover', display: 'block', background: '#000' }}
              />
            ) : kind === 'voice' ? (
              <audio src={value.url} controls style={{ height: 40, width: 220 }} />
            ) : (
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  color: WA_DARK,
                  bgcolor: tintGreen(0.14)
                }}
              >
                <IconFile size={28} />
              </Box>
            )}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.25 }}>
              <Icon size={14} />
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {KIND_LABEL[kind] || 'Arquivo'}
                {value.size ? ` · ${fmtBytes(value.size)}` : ''}
              </Typography>
            </Stack>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {value.filename || String(value.url).split('/').pop()}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
              <Button
                size="small"
                startIcon={<IconRefresh size={14} />}
                onClick={() => setOpen(true)}
                sx={{ textTransform: 'none', color: WA_DARK }}
              >
                Substituir
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<IconTrash size={14} />}
                onClick={() => onChange(null)}
                sx={{ textTransform: 'none' }}
              >
                Remover
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    );
  }

  // -------- affordance compacta --------
  if (!open) {
    return (
      <>
        <Button
          variant="outlined"
          size="small"
          startIcon={<IconPlus size={16} />}
          onClick={() => setOpen(true)}
          sx={{
            borderColor: 'divider',
            borderStyle: 'dashed',
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { borderColor: WA_GREEN, color: WA_DARK, bgcolor: tintGreen(0.06) }
          }}
        >
          {label}
        </Button>
        <input ref={fileRef} type="file" hidden onChange={onFileChange} />
      </>
    );
  }

  // -------- picker expandido --------
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.25, bgcolor: 'background.paper' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.5} sx={{ p: 0.4, borderRadius: 2, bgcolor: 'action.hover' }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            const Icon = t.icon;
            return (
              <Box
                key={t.key}
                role="button"
                onClick={() => {
                  setTab(t.key);
                  if (t.key !== 'voice') clearPendingRec();
                }}
                sx={{
                  cursor: 'pointer',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: on ? WA_DARK : 'text.secondary',
                  bgcolor: on ? 'background.paper' : 'transparent',
                  boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'color .12s ease, background-color .12s ease'
                }}
              >
                <Icon size={15} />
                {t.label}
              </Box>
            );
          })}
        </Stack>
        {!autoOpen || value ? (
          <Tooltip title={value ? 'Manter mídia atual' : 'Fechar'}>
            <span>
              <IconButton
                size="small"
                onClick={() => {
                  setOpen(false);
                  if (!recording) clearPendingRec();
                }}
                disabled={uploading || recording}
              >
                <IconX size={16} />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Stack>

      {tab === 'voice' ? (
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2, textAlign: 'center' }}>
          {recording ? (
            <Stack spacing={1.25} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    animation: 'waRecPulse 1s infinite',
                    '@keyframes waRecPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } }
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  Gravando… {fmtSecs(recSecs)}
                </Typography>
              </Stack>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<IconPlayerStop size={15} />}
                onClick={stopRec}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Parar
              </Button>
            </Stack>
          ) : recUrl ? (
            <Stack spacing={1.25} alignItems="center">
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Ouça antes de enviar:
              </Typography>
              <audio src={recUrl} controls style={{ height: 40, width: '100%', maxWidth: 280 }} />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={<IconCheck size={15} />}
                  onClick={useRec}
                  disabled={uploading}
                  sx={waButtonSx}
                >
                  Usar áudio
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<IconRefresh size={15} />}
                  onClick={startRec}
                  disabled={uploading}
                  sx={{ textTransform: 'none' }}
                >
                  Regravar
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<IconTrash size={15} />}
                  onClick={clearPendingRec}
                  disabled={uploading}
                  sx={{ textTransform: 'none' }}
                >
                  Descartar
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  color: WA_DARK,
                  bgcolor: tintGreen(0.14)
                }}
              >
                <IconMicrophone size={24} />
              </Box>
              <Button
                variant="contained"
                disableElevation
                size="small"
                startIcon={<IconMicrophone size={15} />}
                onClick={startRec}
                disabled={uploading}
                sx={waButtonSx}
              >
                Gravar áudio
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<IconUpload size={14} />}
                onClick={() => pickFile('audio/*')}
                disabled={uploading}
                sx={{ textTransform: 'none' }}
              >
                ou enviar um arquivo de áudio
              </Button>
            </Stack>
          )}
        </Box>
      ) : (
        <Box
          role="button"
          onClick={() => !uploading && pickFile(active.accept)}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          sx={{
            cursor: uploading ? 'default' : 'pointer',
            border: '1px dashed',
            borderColor: dragOver ? WA_GREEN : 'divider',
            bgcolor: dragOver ? tintGreen(0.08) : 'transparent',
            borderRadius: 2,
            p: 2.5,
            textAlign: 'center',
            transition: 'border-color .14s ease, background-color .14s ease',
            '&:hover': { borderColor: uploading ? 'divider' : tintGreen(0.6) }
          }}
        >
          <Stack spacing={1} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: WA_DARK,
                bgcolor: tintGreen(0.14)
              }}
            >
              <IconUpload size={22} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Arraste {active.label.toLowerCase()} aqui, ou clique para selecionar
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {active.accept === '*/*' ? 'Qualquer arquivo' : active.accept}
            </Typography>
          </Stack>
        </Box>
      )}

      {uploading ? (
        <Box sx={{ mt: 1.25 }}>
          <LinearProgress
            variant={progress > 0 && progress < 100 ? 'determinate' : 'indeterminate'}
            value={progress}
            sx={{ borderRadius: 5, height: 6, '& .MuiLinearProgress-bar': { bgcolor: WA_GREEN } }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            Enviando{progress > 0 ? ` ${progress}%` : '…'}
          </Typography>
        </Box>
      ) : null}

      <input ref={fileRef} type="file" hidden onChange={onFileChange} />
    </Box>
  );
}
