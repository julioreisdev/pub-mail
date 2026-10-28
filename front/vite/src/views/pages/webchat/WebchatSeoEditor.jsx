import { useRef, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { IconLink, IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react';
import { post } from '../../../api/api';

// Prévia do link do webchat (o que WhatsApp/Telegram/Facebook mostram ao colar o link).
// Fica em `webchats.settings.seo = { title, description, image, image_w, image_h }`; o back
// injeta nas metas Open Graph do HTML público (`/public/webchat-page/<slug>`), sem depender
// de JS nem de query params.

export const DEFAULT_SEO = { title: '', description: '', image: '', image_w: null, image_h: null };

export function normalizeSeo(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const dim = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  return {
    title: String(o.title ?? '').slice(0, 120),
    description: String(o.description ?? '').slice(0, 300),
    image: /^https:\/\//i.test(String(o.image || '')) ? String(o.image).slice(0, 600) : '',
    image_w: dim(o.image_w),
    image_h: dim(o.image_h)
  };
}

export function hasSeo(raw) {
  const s = normalizeSeo(raw);
  return Boolean(s.title || s.description || s.image);
}

// Cartão no estilo da prévia do WhatsApp: imagem em cima (ou miniatura à esquerda quando
// pequena/sem imagem), título, descrição e domínio.
export function LinkPreviewCard({ seo, fallbackTitle, host, compact = false, sx }) {
  const s = normalizeSeo(seo);
  const title = s.title || fallbackTitle || 'Webchat';
  const description = s.description || '';
  const wide = s.image && !compact && (!s.image_w || !s.image_h || s.image_w / s.image_h >= 1.25);
  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: wide ? 'column' : 'row',
        width: '100%',
        maxWidth: compact ? 360 : 420,
        ...sx
      }}
    >
      {s.image ? (
        <Box
          component="img"
          src={s.image}
          alt=""
          sx={
            wide
              ? { width: '100%', height: compact ? 120 : 180, objectFit: 'cover', display: 'block', bgcolor: '#e5e7eb' }
              : { width: compact ? 64 : 92, minHeight: compact ? 64 : 92, alignSelf: 'stretch', objectFit: 'cover', flexShrink: 0, bgcolor: '#e5e7eb' }
          }
        />
      ) : (
        <Box
          sx={{
            width: compact ? 64 : 92,
            alignSelf: 'stretch',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            color: 'text.disabled'
          }}
        >
          <IconPhoto size={compact ? 22 : 28} />
        </Box>
      )}
      <Box sx={{ p: compact ? 1 : 1.25, minWidth: 0, flex: 1 }}>
        <Typography variant={compact ? 'body2' : 'subtitle2'} sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap title={title}>
          {title}
        </Typography>
        {description ? (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.35
            }}
            title={description}
          >
            {description}
          </Typography>
        ) : null}
        {host ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }} noWrap>
            {host}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

export default function WebchatSeoEditor({ value, onChange, fallbackTitle, host }) {
  const seo = normalizeSeo({ ...DEFAULT_SEO, ...(value || {}) });
  const inputRef = useRef(null);
  const [mode, setMode] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [linkDraft, setLinkDraft] = useState(seo.image);
  const patch = (p) => onChange({ ...seo, ...p });

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!/^image\//i.test(file.type)) {
      setError('Escolha uma imagem (jpg, png ou webp).');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await post('/webchats/media/image', fd, { headers: { 'Content-Type': undefined }, timeout: 0 });
      const data = res?.data ?? res;
      if (!data?.url) throw new Error('Resposta sem URL');
      patch({ image: data.url, image_w: data.width || null, image_h: data.height || null });
      setLinkDraft(data.url);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Falha ao enviar a imagem.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const applyLink = () => {
    const clean = String(linkDraft || '').trim();
    if (clean && !/^https:\/\//i.test(clean)) {
      setError('Use um endereço https:// direto para a imagem.');
      return;
    }
    setError('');
    patch({ image: clean, image_w: null, image_h: null });
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        Prévia do link (WhatsApp, Telegram, redes)
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
        O que aparece quando alguém cola o link deste webchat. Vale para o link limpo, sem parâmetros. Vazio = usa o nome do webchat.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="flex-start">
        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <TextField
            label="Título"
            size="small"
            fullWidth
            value={seo.title}
            onChange={(e) => patch({ title: e.target.value.slice(0, 120) })}
            placeholder={fallbackTitle || 'Nome do webchat'}
            inputProps={{ maxLength: 120 }}
            helperText={`${seo.title.length}/120`}
          />
          <TextField
            label="Descrição"
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            value={seo.description}
            onChange={(e) => patch({ description: e.target.value.slice(0, 300) })}
            placeholder="Uma frase curta sobre o que a pessoa encontra ao abrir o chat."
            inputProps={{ maxLength: 300 }}
            helperText={`${seo.description.length}/300`}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
              Imagem:
            </Typography>
            <Button size="small" variant={mode === 'upload' ? 'contained' : 'outlined'} startIcon={<IconUpload size={14} />} onClick={() => setMode('upload')} sx={{ borderRadius: 2 }}>
              Enviar arquivo
            </Button>
            <Button size="small" variant={mode === 'link' ? 'contained' : 'outlined'} startIcon={<IconLink size={14} />} onClick={() => setMode('link')} sx={{ borderRadius: 2 }}>
              Colar link
            </Button>
            {seo.image ? (
              <Tooltip title="Remover imagem">
                <Button size="small" color="error" variant="text" startIcon={<IconTrash size={14} />} onClick={() => { patch({ image: '', image_w: null, image_h: null }); setLinkDraft(''); }} sx={{ borderRadius: 2 }}>
                  Remover
                </Button>
              </Tooltip>
            ) : null}
          </Stack>
          {mode === 'upload' ? (
            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!uploading) handleFile(e.dataTransfer?.files?.[0]);
              }}
              onClick={() => !uploading && inputRef.current?.click()}
              sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 1.25, textAlign: 'center', cursor: uploading ? 'progress' : 'pointer', bgcolor: 'action.hover', '&:hover': { borderColor: 'primary.main' } }}
            >
              <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {seo.image ? 'Trocar a imagem' : 'Clique ou arraste a imagem aqui'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ideal 1200×630 (paisagem). Reduzida e convertida para JPEG leve no servidor.
              </Typography>
              {uploading ? <LinearProgress sx={{ mt: 1, borderRadius: 1, height: 5 }} /> : null}
            </Box>
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                fullWidth
                label="Link direto da imagem"
                placeholder="https://…/imagem.jpg"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onBlur={applyLink}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  }
                }}
              />
              <Button size="small" variant="outlined" onClick={applyLink} sx={{ borderRadius: 2, whiteSpace: 'nowrap', mt: 0.25 }}>
                Usar link
              </Button>
            </Stack>
          )}
          {error ? (
            <Alert severity="error" sx={{ py: 0.25 }} onClose={() => setError('')}>
              {error}
            </Alert>
          ) : null}
        </Stack>
        <Box sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
            Como vai aparecer
          </Typography>
          <LinkPreviewCard seo={seo} fallbackTitle={fallbackTitle} host={host} />
        </Box>
      </Stack>
    </Box>
  );
}
