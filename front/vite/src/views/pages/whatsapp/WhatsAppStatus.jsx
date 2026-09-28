import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconCircleDashed,
  IconPlus,
  IconPencil,
  IconTrash,
  IconRefresh,
  IconClock,
  IconSend,
  IconCalendarTime,
  IconPhoto,
  IconVideo,
  IconMicrophone,
  IconTypography,
  IconChevronLeft,
  IconChevronRight,
  IconHistory,
  IconAlertTriangle,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, patch, remove } from 'api/api';
import { TgCard, TgStatusPill, TgModal, TgConfirmDialog, TgEmptyState, TgListSkeleton } from 'views/pages/telegram/ui';
import WhatsAppMediaField from './WhatsAppMediaField';
import {
  WaPageHeader,
  WaSessionBanner,
  useWaSession,
  useNow,
  errMsg,
  fmtDateBRT,
  relTime,
  brtLocalToIso,
  isoToBrtLocal,
  brtLocalNow,
  mediaKind,
  waButtonSx,
  WA_GREEN,
  WA_DARK
} from './waKit';

// ============================================================================
// WhatsApp → Status: publicar (texto / imagem-vídeo / áudio) agora ou agendado
// (horário de Brasília), lista de agendados com countdown e histórico.
// Contrato: GET/POST /whatsapp/statuses, PATCH/DELETE /whatsapp/statuses/:id.
// ============================================================================

// paleta de fundos no estilo dos status de texto do WhatsApp
const PALETTE = [
  '#075E54',
  '#128C7E',
  '#1FA855',
  '#00A884',
  '#0B8ECF',
  '#5E35B1',
  '#8E24AA',
  '#D81B60',
  '#E65100',
  '#F09819',
  '#546E7A',
  '#1F2C34'
];
// fontes (índice enviado ao gateway) — 3 estilos oferecidos
const FONTS = [
  { id: 0, label: 'Sans', family: '"Ubuntu", "Helvetica Neue", Arial, sans-serif' },
  { id: 1, label: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { id: 2, label: 'Mono', family: '"SFMono-Regular", Menlo, Consolas, monospace' }
];
const fontFamily = (id) => (FONTS.find((f) => f.id === Number(id)) || FONTS[0]).family;

const TYPE_UI = {
  text: { label: 'Texto', icon: IconTypography },
  image: { label: 'Imagem', icon: IconPhoto },
  video: { label: 'Vídeo', icon: IconVideo },
  voice: { label: 'Áudio', icon: IconMicrophone }
};
const STATUS_UI = {
  pending: { pill: 'pending', label: 'Agendado' },
  posting: { pill: 'pending', label: 'Publicando…' },
  posted: { pill: 'active', label: 'Publicado' },
  failed: { pill: 'error', label: 'Falhou' },
  canceled: { pill: 'inactive', label: 'Cancelado' }
};
const PHONE_W = 216;
const PHONE_H = Math.round((PHONE_W * 16) / 9);

// ---------------------------------------------------------------- preview 9:16
function StatusPhonePreview({ type, body, bgColor, font, media }) {
  const kind = type === 'text' ? 'text' : mediaKind(media) || type;
  const text = String(body || '');
  const size = text.length < 40 ? 24 : text.length < 120 ? 18 : 14.5;
  const bg = type === 'text' ? bgColor || PALETTE[1] : '#0b141a';
  return (
    <Box
      sx={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: 5,
        overflow: 'hidden',
        position: 'relative',
        bgcolor: bg,
        color: '#fff',
        boxShadow: '0 14px 34px rgba(0,0,0,0.28)',
        border: '5px solid #0b141a',
        flexShrink: 0,
        transition: 'background-color .2s ease'
      }}
    >
      {/* mídia de fundo */}
      {kind === 'image' && media?.url ? (
        <img src={media.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
      {kind === 'video' && media?.url ? (
        <video
          src={media.url}
          muted
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}

      {/* barra de progresso + cabeçalho */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          p: 1,
          background: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0))',
          zIndex: 1
        }}
      >
        <Box sx={{ height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.35)', overflow: 'hidden', mb: 0.75 }}>
          <Box sx={{ width: '45%', height: '100%', bgcolor: '#fff' }} />
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.85)',
              display: 'grid',
              placeItems: 'center',
              color: WA_DARK
            }}
          >
            <IconCircleDashed size={14} />
          </Box>
          <Box sx={{ lineHeight: 1 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.1 }}>Meu status</Typography>
            <Typography sx={{ fontSize: 9, opacity: 0.8, lineHeight: 1.1 }}>agora</Typography>
          </Box>
        </Stack>
      </Box>

      {/* conteúdo */}
      {kind === 'text' ? (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2.5 }}>
          <Typography
            sx={{
              fontFamily: fontFamily(font),
              fontSize: size,
              fontWeight: 600,
              lineHeight: 1.25,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textShadow: '0 1px 2px rgba(0,0,0,0.25)',
              opacity: text ? 1 : 0.55
            }}
          >
            {text || 'Digite o texto do status…'}
          </Typography>
        </Box>
      ) : null}
      {kind === 'voice' ? (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2 }}>
          <Stack spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: WA_GREEN, display: 'grid', placeItems: 'center' }}>
              <IconMicrophone size={30} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 28, opacity: media?.url ? 1 : 0.4 }}>
              {Array.from({ length: 26 }).map((_, k) => (
                <Box key={k} sx={{ width: 3, borderRadius: 2, height: 5 + ((k * 9) % 20), bgcolor: 'rgba(255,255,255,0.85)' }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: 11, opacity: 0.8 }}>{media?.url ? 'Status de voz' : 'Grave ou envie um áudio'}</Typography>
          </Stack>
        </Box>
      ) : null}
      {(kind === 'image' || kind === 'video') && !media?.url ? (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2, textAlign: 'center' }}>
          <Stack spacing={1} alignItems="center" sx={{ opacity: 0.6 }}>
            {kind === 'video' ? <IconVideo size={40} /> : <IconPhoto size={40} />}
            <Typography sx={{ fontSize: 12 }}>Envie uma imagem ou vídeo</Typography>
          </Stack>
        </Box>
      ) : null}

      {/* legenda / rodapé */}
      {kind !== 'text' && text ? (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            p: 1.25,
            pt: 4,
            background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7))',
            zIndex: 1
          }}
        >
          <Typography sx={{ fontSize: 12.5, lineHeight: 1.3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</Typography>
        </Box>
      ) : null}
    </Box>
  );
}

// miniatura (escala a preview real)
function StatusThumb({ item, width = 60 }) {
  const s = width / PHONE_W;
  return (
    <Box sx={{ width, height: Math.round(PHONE_H * s), overflow: 'hidden', borderRadius: 1.5, flexShrink: 0 }}>
      <Box sx={{ transform: `scale(${s})`, transformOrigin: 'top left', width: PHONE_W, height: PHONE_H, pointerEvents: 'none' }}>
        <StatusPhonePreview type={item.type} body={item.body} bgColor={item.bg_color} font={item.font} media={item.media} />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------- composer
const TAB_OF_TYPE = { text: 'text', image: 'media', video: 'media', voice: 'voice' };
const emptyForm = () => ({ tab: 'text', body: '', bg_color: PALETTE[1], font: 0, media: null, when: 'now', at: brtLocalNow(60) });

function StatusComposer({ open, onClose, initial, connected }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        tab: TAB_OF_TYPE[initial.type] || 'text',
        body: initial.body || '',
        bg_color: initial.bg_color || PALETTE[1],
        font: Number(initial.font) || 0,
        media: initial.media || null,
        when: editing && initial.schedule_at ? 'schedule' : 'now',
        at: initial.schedule_at ? isoToBrtLocal(initial.schedule_at) : brtLocalNow(60)
      });
    } else setForm(emptyForm());
  }, [open, initial, editing]);

  const setF = (p) => setForm((f) => ({ ...f, ...p }));
  const type = form.tab === 'text' ? 'text' : form.tab === 'voice' ? 'voice' : mediaKind(form.media) || 'image';
  const scheduleIso = form.when === 'schedule' ? brtLocalToIso(form.at) : null;
  const scheduleInPast = form.when === 'schedule' && scheduleIso && new Date(scheduleIso).getTime() < Date.now() + 30000;

  const valid = (() => {
    if (type === 'text' && !form.body.trim()) return false;
    if (type !== 'text' && !form.media?.id) return false;
    if (form.when === 'schedule' && (!scheduleIso || scheduleInPast)) return false;
    return true;
  })();

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      if (editing) {
        const body = { schedule_at: scheduleIso, body: form.body };
        if (initial.type === 'text') Object.assign(body, { bg_color: form.bg_color, font: form.font });
        await patch(`/whatsapp/statuses/${initial.id}`, body);
        toast.success(scheduleIso ? 'Agendamento atualizado.' : 'Status enviado para publicação.');
      } else {
        const body = { type, schedule_at: scheduleIso };
        if (type === 'text') Object.assign(body, { body: form.body, bg_color: form.bg_color, font: form.font });
        else {
          body.media_id = form.media.id;
          if (form.body.trim()) body.body = form.body;
        }
        await post('/whatsapp/statuses', body);
        toast.success(scheduleIso ? `Status agendado para ${fmtDateBRT(scheduleIso)}.` : 'Status publicado!');
      }
      onClose(true);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o status.'));
    } finally {
      setSaving(false);
    }
  };

  const nowDisabled = !connected;
  const tabSx = { textTransform: 'none', fontWeight: 700, minHeight: 40 };

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose(false)}
      disableClose={saving}
      maxWidth="md"
      title={editing ? 'Editar status agendado' : initial ? 'Publicar novamente' : 'Novo status'}
      subtitle={
        editing
          ? 'Só o texto, a cor, a fonte e o horário podem mudar. Para trocar a mídia, cancele e crie outro.'
          : 'O status aparece para os contatos por 24 horas.'
      }
      tabs={
        editing ? null : (
          <Tabs
            value={form.tab}
            onChange={(_, v) => setF({ tab: v, media: null })}
            sx={{ minHeight: 40, '& .MuiTabs-indicator': { bgcolor: WA_GREEN }, '& .Mui-selected': { color: `${WA_DARK} !important` } }}
          >
            <Tab value="text" label="Texto" icon={<IconTypography size={16} />} iconPosition="start" sx={tabSx} />
            <Tab value="media" label="Imagem ou vídeo" icon={<IconPhoto size={16} />} iconPosition="start" sx={tabSx} />
            <Tab value="voice" label="Áudio" icon={<IconMicrophone size={16} />} iconPosition="start" sx={tabSx} />
          </Tabs>
        )
      }
      footer={
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: '100%' }}>
          <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={submit}
            disabled={saving || !valid || (form.when === 'now' && nowDisabled)}
            startIcon={
              saving ? (
                <CircularProgress size={15} color="inherit" />
              ) : form.when === 'now' ? (
                <IconSend size={17} />
              ) : (
                <IconCalendarTime size={17} />
              )
            }
            sx={{ ...waButtonSx, minWidth: 140 }}
          >
            {form.when === 'now' ? (editing ? 'Publicar agora' : 'Publicar') : editing ? 'Salvar agendamento' : 'Agendar'}
          </Button>
        </Stack>
      }
    >
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: `1fr ${PHONE_W}px` }, alignItems: 'start' }}>
        {/* ---------- formulário ---------- */}
        <Stack spacing={2.25}>
          {form.tab === 'text' ? (
            <>
              <TextField
                label="Texto do status"
                multiline
                minRows={4}
                fullWidth
                value={form.body}
                onChange={(e) => setF({ body: e.target.value.slice(0, 700) })}
                helperText={`${form.body.length}/700`}
                autoFocus={!editing}
              />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 1 }}>Cor de fundo</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 40px)', gap: 1 }}>
                  {PALETTE.map((c) => {
                    const on = c.toLowerCase() === String(form.bg_color).toLowerCase();
                    return (
                      <Tooltip key={c} title={c}>
                        <Box
                          role="button"
                          onClick={() => setF({ bg_color: c })}
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: c,
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#fff',
                            outline: on ? '3px solid' : '3px solid transparent',
                            outlineColor: on ? 'text.primary' : 'transparent',
                            outlineOffset: 2,
                            transition: 'transform .12s ease',
                            '&:hover': { transform: 'scale(1.08)' }
                          }}
                        >
                          {on ? <IconCheck size={18} stroke={2.5} /> : null}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 1 }}>Fonte</Typography>
                <Stack direction="row" spacing={1}>
                  {FONTS.map((f) => {
                    const on = Number(form.font) === f.id;
                    return (
                      <Box
                        key={f.id}
                        role="button"
                        onClick={() => setF({ font: f.id })}
                        sx={{
                          flex: 1,
                          textAlign: 'center',
                          py: 1,
                          borderRadius: 2,
                          border: '2px solid',
                          borderColor: on ? WA_GREEN : 'divider',
                          bgcolor: on ? 'rgba(37,211,102,0.10)' : 'transparent',
                          cursor: 'pointer',
                          fontFamily: f.family,
                          fontWeight: 600,
                          fontSize: 15,
                          transition: 'border-color .12s ease, background-color .12s ease'
                        }}
                      >
                        Aa{' '}
                        <Typography component="span" sx={{ fontFamily: 'inherit', fontSize: 12, color: 'text.secondary' }}>
                          {f.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </>
          ) : (
            <>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 1 }}>
                  {form.tab === 'voice' ? 'Áudio' : 'Imagem ou vídeo'}
                </Typography>
                {editing ? (
                  <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
                    {TYPE_UI[initial.type]?.label || 'Mídia'} · {initial.media?.filename || 'arquivo já enviado'}
                  </Alert>
                ) : (
                  <WhatsAppMediaField
                    key={form.tab}
                    value={form.media}
                    onChange={(media) => setF({ media })}
                    kinds={form.tab === 'voice' ? ['voice'] : ['image', 'video']}
                    label={form.tab === 'voice' ? 'Gravar ou enviar áudio' : 'Escolher imagem ou vídeo'}
                    autoOpen
                  />
                )}
              </Box>
              {form.tab !== 'voice' || editing ? (
                <TextField
                  label="Legenda (opcional)"
                  multiline
                  minRows={2}
                  fullWidth
                  value={form.body}
                  onChange={(e) => setF({ body: e.target.value.slice(0, 700) })}
                  helperText={`${form.body.length}/700`}
                />
              ) : null}
            </>
          )}

          {/* ---------- quando publicar ---------- */}
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 1 }}>Quando publicar</Typography>
            <Stack direction="row" spacing={1}>
              {[
                { key: 'now', label: 'Publicar agora', icon: IconSend, disabled: nowDisabled },
                { key: 'schedule', label: 'Agendar', icon: IconCalendarTime }
              ].map((o) => {
                const on = form.when === o.key;
                const Icon = o.icon;
                return (
                  <Tooltip key={o.key} title={o.disabled ? 'Conecte o WhatsApp para publicar agora' : ''}>
                    <Box
                      role="button"
                      onClick={() => !o.disabled && setF({ when: o.key })}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.75,
                        py: 1,
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: on ? WA_GREEN : 'divider',
                        bgcolor: on ? 'rgba(37,211,102,0.10)' : 'transparent',
                        color: o.disabled ? 'text.disabled' : on ? WA_DARK : 'text.primary',
                        cursor: o.disabled ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: 13.5,
                        transition: 'border-color .12s ease, background-color .12s ease'
                      }}
                    >
                      <Icon size={16} />
                      {o.label}
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>
            {form.when === 'schedule' ? (
              <TextField
                type="datetime-local"
                size="small"
                fullWidth
                value={form.at}
                onChange={(e) => setF({ at: e.target.value })}
                inputProps={{ min: brtLocalNow(1) }}
                error={Boolean(scheduleInPast)}
                helperText={
                  scheduleInPast
                    ? 'Escolha um horário no futuro.'
                    : 'Horário de Brasília. O Pub Mail publica na hora marcada (precisão de 1 minuto).'
                }
                sx={{ mt: 1.25 }}
              />
            ) : nowDisabled ? (
              <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 1 }}>
                O WhatsApp não está conectado — você pode agendar e a publicação sai quando a sessão estiver ativa no horário.
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {/* ---------- preview ---------- */}
        <Box sx={{ justifySelf: 'center', position: { md: 'sticky' }, top: 8 }}>
          <StatusPhonePreview type={type} body={form.body} bgColor={form.bg_color} font={form.font} media={form.media} />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 1 }}>
            Pré-visualização
          </Typography>
        </Box>
      </Box>
    </TgModal>
  );
}

// ---------------------------------------------------------------- card agendado
function ScheduledCard({ item, now, onEdit, onCancel }) {
  const T = TYPE_UI[item.type] || TYPE_UI.text;
  const TIcon = T.icon;
  const posting = item.status === 'posting';
  return (
    <TgCard sx={{ p: 1.75, display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
      <StatusThumb item={item} width={58} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
          <Chip
            size="small"
            icon={<TIcon size={13} />}
            label={T.label}
            variant="outlined"
            sx={{ height: 22, borderRadius: 1, fontWeight: 700 }}
          />
          <TgStatusPill status={STATUS_UI[item.status]?.pill || 'pending'} label={STATUS_UI[item.status]?.label} />
        </Stack>
        <Typography
          variant="body2"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: item.body ? 'text.primary' : 'text.disabled',
            mb: 0.75
          }}
        >
          {item.body || item.media?.filename || 'Sem legenda'}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mt: 'auto' }}>
          <IconClock size={14} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {fmtDateBRT(item.schedule_at)}
          </Typography>
          <Typography variant="caption" sx={{ color: posting ? 'info.main' : WA_DARK, fontWeight: 700 }}>
            · {posting ? 'publicando…' : relTime(item.schedule_at, now)}
          </Typography>
        </Stack>
      </Box>
      <Stack spacing={0.25} sx={{ flexShrink: 0 }}>
        <Tooltip title="Editar">
          <span>
            <IconButton size="small" onClick={() => onEdit(item)} disabled={posting}>
              <IconPencil size={17} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cancelar agendamento">
          <span>
            <IconButton size="small" color="error" onClick={() => onCancel(item)} disabled={posting}>
              <IconX size={17} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- linha histórico
function HistoryRow({ item, onRetry, onDelete }) {
  const T = TYPE_UI[item.type] || TYPE_UI.text;
  const TIcon = T.icon;
  const st = STATUS_UI[item.status] || STATUS_UI.posted;
  const when = item.posted_at || item.schedule_at || item.created_at;
  return (
    <TgCard hover={false} sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', opacity: item.status === 'canceled' ? 0.7 : 1 }}>
      <StatusThumb item={item} width={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.25 }}>
          <Chip
            size="small"
            icon={<TIcon size={13} />}
            label={T.label}
            variant="outlined"
            sx={{ height: 22, borderRadius: 1, fontWeight: 700 }}
          />
          <TgStatusPill status={st.pill} label={st.label} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.status === 'posted' ? 'publicado em ' : ''}
            {fmtDateBRT(when)}
          </Typography>
        </Stack>
        <Typography variant="body2" noWrap sx={{ color: item.body ? 'text.primary' : 'text.disabled' }}>
          {item.body || item.media?.filename || 'Sem legenda'}
        </Typography>
        {item.status === 'failed' && item.error ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main', mt: 0.25 }}>
            <IconAlertTriangle size={13} />
            <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
              {item.error}
            </Typography>
          </Stack>
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
        {item.status === 'failed' || item.status === 'canceled' ? (
          <Tooltip title="Publicar novamente">
            <IconButton size="small" onClick={() => onRetry(item)} sx={{ color: WA_DARK }}>
              <IconRefresh size={17} />
            </IconButton>
          </Tooltip>
        ) : null}
        {item.status === 'posted' ? (
          <Tooltip title="Apagar do WhatsApp">
            <IconButton size="small" color="error" onClick={() => onDelete(item)}>
              <IconTrash size={17} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    </TgCard>
  );
}

// =================== PÁGINA ===================
export default function WhatsAppStatus() {
  const { session, loading: sessionLoading, connected } = useWaSession();
  const now = useNow(30000);

  const [scheduled, setScheduled] = useState([]);
  const [loadingSched, setLoadingSched] = useState(true);
  const [history, setHistory] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loadingHist, setLoadingHist] = useState(true);
  const [histStatus, setHistStatus] = useState('all');
  const [histPage, setHistPage] = useState(1);

  const [composer, setComposer] = useState(null); // { initial } | null
  const [cancelFor, setCancelFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const schedSeq = useRef(0);
  const loadScheduled = useCallback(async () => {
    const s = ++schedSeq.current;
    try {
      const r = await get('/whatsapp/statuses', { params: { status: 'pending', page: 1, page_size: 100 } });
      if (s !== schedSeq.current) return;
      const items = (Array.isArray(r) ? r : r?.items || []).filter((x) => ['pending', 'posting'].includes(x.status));
      items.sort((a, b) => new Date(a.schedule_at || 0) - new Date(b.schedule_at || 0));
      setScheduled(items);
    } catch (e) {
      if (s === schedSeq.current) toast.error(errMsg(e, 'Falha ao carregar os agendados.'));
    } finally {
      if (s === schedSeq.current) setLoadingSched(false);
    }
  }, []);

  const histSeq = useRef(0);
  const loadHistory = useCallback(async () => {
    const s = ++histSeq.current;
    setLoadingHist(true);
    try {
      const r = await get('/whatsapp/statuses', { params: { status: histStatus, page: histPage, page_size: 12 } });
      if (s !== histSeq.current) return;
      const items = (Array.isArray(r) ? r : r?.items || []).filter((x) => !['pending', 'posting'].includes(x.status));
      setHistory({ items, total: r?.total ?? items.length, page: r?.page ?? histPage, pages: r?.pages ?? 1 });
    } catch (e) {
      if (s === histSeq.current) toast.error(errMsg(e, 'Falha ao carregar o histórico.'));
    } finally {
      if (s === histSeq.current) setLoadingHist(false);
    }
  }, [histStatus, histPage]);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  useEffect(() => {
    setHistPage(1);
  }, [histStatus]);

  // agendados mudam sozinhos (cron publica) → polling leve
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadScheduled();
      if (scheduled.some((x) => x.status === 'posting' || new Date(x.schedule_at || 0).getTime() < Date.now())) loadHistory();
    }, 30000);
    return () => clearInterval(id);
  }, [loadScheduled, loadHistory, scheduled]);

  const reloadAll = () => {
    loadScheduled();
    loadHistory();
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/statuses/${cancelFor.id}`);
      toast.success('Agendamento cancelado.');
      setCancelFor(null);
      reloadAll();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível cancelar.'));
    } finally {
      setBusy(false);
    }
  };
  const doDelete = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/statuses/${deleteFor.id}`);
      toast.success('Status removido do WhatsApp.');
      setDeleteFor(null);
      reloadAll();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
    }
  };

  // re-criar a partir de um item (falhou/cancelado) — sem id ⇒ POST novo
  const retry = (item) =>
    setComposer({
      initial: { type: item.type, body: item.body, bg_color: item.bg_color, font: item.font, media: item.media, schedule_at: null }
    });

  const newBtn = (
    <Button
      variant="contained"
      disableElevation
      startIcon={<IconPlus size={18} />}
      onClick={() => setComposer({ initial: null })}
      sx={waButtonSx}
    >
      Novo status
    </Button>
  );

  const nextUp = useMemo(() => scheduled.find((x) => x.status === 'pending'), [scheduled]);

  return (
    <Box>
      <WaPageHeader
        icon={IconCircleDashed}
        title="Status"
        subtitle="Publique status de texto, imagem, vídeo ou áudio — agora ou no horário que você marcar."
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Atualizar">
              <IconButton onClick={reloadAll}>
                <IconRefresh size={20} />
              </IconButton>
            </Tooltip>
            {newBtn}
          </Stack>
        }
      />

      <WaSessionBanner session={session} loading={sessionLoading} connected={connected} what="publicar status" />

      {/* ---------- agendados ---------- */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <IconCalendarTime size={18} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Agendados
        </Typography>
        <Chip size="small" label={scheduled.length} sx={{ fontWeight: 700, height: 22 }} />
        {nextUp ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            · próximo {relTime(nextUp.schedule_at, now)}
          </Typography>
        ) : null}
      </Stack>
      {loadingSched ? (
        <TgListSkeleton rows={2} />
      ) : scheduled.length === 0 ? (
        <TgEmptyState
          dense
          icon={IconCalendarTime}
          title="Nada agendado"
          description="Crie um status e escolha “Agendar” para publicar em um horário específico (Brasília)."
          action={newBtn}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }
          }}
        >
          {scheduled.map((item) => (
            <ScheduledCard key={item.id} item={item} now={now} onEdit={(it) => setComposer({ initial: it })} onCancel={setCancelFor} />
          ))}
        </Box>
      )}

      {/* ---------- histórico ---------- */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1} sx={{ mt: 4, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
          <IconHistory size={18} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Histórico
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {history.total ? `${history.total} ${history.total === 1 ? 'registro' : 'registros'}` : ''}
          </Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="wa-status-hist-label">Mostrar</InputLabel>
          <Select labelId="wa-status-hist-label" label="Mostrar" value={histStatus} onChange={(e) => setHistStatus(e.target.value)}>
            <MenuItem value="all">Tudo</MenuItem>
            <MenuItem value="posted">Publicados</MenuItem>
            <MenuItem value="failed">Com falha</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {loadingHist ? (
        <TgListSkeleton rows={3} />
      ) : history.items.length === 0 ? (
        <TgEmptyState dense icon={IconHistory} title="Nenhum status ainda" description="Os status publicados e as falhas aparecem aqui." />
      ) : (
        <Stack spacing={1}>
          {history.items.map((item) => (
            <HistoryRow key={item.id} item={item} onRetry={retry} onDelete={setDeleteFor} />
          ))}
          {history.pages > 1 ? (
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1 }}>
              <IconButton size="small" onClick={() => setHistPage((p) => Math.max(1, p - 1))} disabled={histPage <= 1}>
                <IconChevronLeft size={18} />
              </IconButton>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Página {history.page} de {history.pages}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setHistPage((p) => Math.min(history.pages, p + 1))}
                disabled={histPage >= history.pages}
              >
                <IconChevronRight size={18} />
              </IconButton>
            </Stack>
          ) : null}
        </Stack>
      )}

      <StatusComposer
        open={!!composer}
        initial={composer?.initial || null}
        connected={connected}
        onClose={(ok) => {
          setComposer(null);
          if (ok) reloadAll();
        }}
      />
      <TgConfirmDialog
        open={!!cancelFor}
        onClose={() => setCancelFor(null)}
        onConfirm={doCancel}
        loading={busy}
        danger
        icon={IconX}
        title="Cancelar agendamento?"
        confirmLabel="Cancelar agendamento"
        message={cancelFor ? `O status marcado para ${fmtDateBRT(cancelFor.schedule_at)} não será publicado.` : ''}
      />
      <TgConfirmDialog
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={doDelete}
        loading={busy}
        danger
        icon={IconTrash}
        title="Apagar do WhatsApp?"
        confirmLabel="Apagar"
        message="O Pub Mail vai tentar remover este status do seu WhatsApp. Quem já viu não recebe aviso."
      />
    </Box>
  );
}
