import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconBellRinging,
  IconClock,
  IconHistory,
  IconPencil,
  IconPlus,
  IconSend,
  IconSparkles,
  IconTrash,
  IconUser,
  IconUsers,
  IconFlask
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgCard, TgConfirmDialog } from 'views/pages/telegram/ui';
import { SOUND_LABELS } from 'notifications/sounds';
import { emojiToPng, isHttpUrl, uploadIcon } from 'notifications/icons';
import { brtLocalToIso, fmtDateBRT, isoToBrtLocal, waButtonSx } from '../waKit';
import { fmtAgo } from '../waShared';
import { SettingsCardHeader, cardSx, errText } from '../settings/settingsKit';
import { CrmModal } from '../crm/crmKit';
import { KIND_ICON } from './kinds';

// ============================================================================
// Avisos personalizados (criar/editar/disparar/agendar) + histórico do que o usuário recebeu.
// /notifications/custom*, /notifications/history*
// ============================================================================

const VIB_LABELS = { short: 'Curta', double: 'Dupla', long: 'Longa', none: 'Sem vibração' };
const EMOJIS = ['🔔', '📣', '⚠️', '✅', '🚀', '💰', '📅', '🧪', '🎉', '❗'];

const emptyForm = (myId) => ({
  name: '',
  emoji: '🔔',
  icon_url: '',
  title: '',
  body: '',
  url: '',
  sound: 'default',
  vibrate: 'short',
  important: false,
  recipients: { mode: 'me', user_ids: myId ? [myId] : [] },
  schedule_at: ''
});

function CustomForm({ open, onClose, initial, myId, isAdmin, sounds, vibrations, onSaved }) {
  const [f, setF] = useState(emptyForm(myId));
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(
      initial
        ? {
            ...emptyForm(myId),
            ...initial,
            url: initial.url || '',
            body: initial.body || '',
            emoji: initial.emoji || '',
            icon_url: initial.icon_url || '',
            schedule_at: initial.schedule_at ? isoToBrtLocal(initial.schedule_at) : '',
            recipients: initial.recipients || { mode: 'me', user_ids: [] }
          }
        : emptyForm(myId)
    );
    if (isAdmin)
      get('/notifications/people')
        .then((r) => setPeople(r || []))
        .catch(() => setPeople([]));
  }, [open, initial, myId, isAdmin]);
  const set = (k, v) => setF((c) => ({ ...c, [k]: v }));
  const [iconBusy, setIconBusy] = useState(false);
  const iconFileRef = useRef(null);
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        icon_url: f.icon_url || null,
        url: f.url || null,
        body: f.body || null,
        emoji: f.emoji || null,
        schedule_at: f.schedule_at ? brtLocalToIso(f.schedule_at) : null
      };
      const r = initial?.id ? await put(`/notifications/custom/${initial.id}`, body) : await post('/notifications/custom', body);
      onSaved(r);
      onClose();
    } catch (e) {
      toast.error(errText(e, 'Não foi possível salvar o aviso.'));
    }
    setBusy(false);
  };
  const rec = f.recipients || { mode: 'me', user_ids: [] };
  return (
    <CrmModal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Editar aviso' : 'Novo aviso personalizado'}
      subtitle="Um aviso que você monta e dispara quando quiser — para testar ou para avisar a equipe."
      maxWidth="sm"
      footer={
        <>
          <Button onClick={onClose} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy || !f.name.trim() || !f.title.trim()}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
            sx={waButtonSx}
          >
            Salvar
          </Button>
        </>
      }
    >
      <Stack spacing={1.75} sx={{ pt: 0.5 }}>
        <TextField
          label="Nome interno"
          value={f.name}
          onChange={(e) => set('name', e.target.value)}
          size="small"
          fullWidth
          placeholder="Ex.: Reunião diária, Teste de push"
          slotProps={{ htmlInput: { maxLength: 80 } }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ width: 96 }}>
            <InputLabel>Ícone</InputLabel>
            <Select label="Ícone" value={f.emoji} onChange={(e) => set('emoji', e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {EMOJIS.map((e) => (
                <MenuItem key={e} value={e}>
                  {e}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Título"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            component="img"
            src={f.icon_url || '/pwa/icon-192.png'}
            alt=""
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              objectFit: 'cover',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#fff',
              flexShrink: 0
            }}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={!f.emoji || iconBusy}
              onClick={async () => {
                setIconBusy(true);
                try {
                  set('icon_url', await uploadIcon(await emojiToPng(f.emoji), `custom-${initial?.id || 'novo'}`));
                } catch (e) {
                  toast.error(errText(e, 'Não deu para gerar o ícone.'));
                }
                setIconBusy(false);
              }}
            >
              Ícone = emoji {f.emoji || ''}
            </Button>
            <Button size="small" variant="outlined" disabled={iconBusy} onClick={() => iconFileRef.current?.click()}>
              Enviar imagem
            </Button>
            <input
              ref={iconFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setIconBusy(true);
                try {
                  set('icon_url', await uploadIcon(file, `custom-${initial?.id || 'novo'}`));
                } catch (err) {
                  toast.error(errText(err, 'Não deu para enviar a imagem.'));
                }
                setIconBusy(false);
              }}
            />
            {f.icon_url ? (
              <Button size="small" color="inherit" onClick={() => set('icon_url', '')}>
                Sem ícone próprio
              </Button>
            ) : null}
          </Stack>
        </Stack>
        <TextField
          label="Endereço do ícone (opcional)"
          value={f.icon_url}
          onChange={(e) => set('icon_url', e.target.value)}
          size="small"
          fullWidth
          placeholder="https://… (imagem quadrada)"
          error={Boolean(f.icon_url) && !isHttpUrl(f.icon_url)}
          helperText="Imagem que aparece ao lado do aviso. Vazio = ícone das suas preferências."
        />
        <TextField
          label="Texto"
          value={f.body}
          onChange={(e) => set('body', e.target.value)}
          size="small"
          fullWidth
          multiline
          minRows={2}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <TextField
          label="Link ao tocar (opcional)"
          value={f.url}
          onChange={(e) => set('url', e.target.value)}
          size="small"
          fullWidth
          placeholder="/whatsapp/chat ou https://…"
          helperText="Tela do painel (começa com /) ou endereço completo."
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel>Som</InputLabel>
            <Select label="Som" value={f.sound} onChange={(e) => set('sound', e.target.value)}>
              {sounds.map((s) => (
                <MenuItem key={s} value={s}>
                  {SOUND_LABELS[s] || s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Vibração</InputLabel>
            <Select label="Vibração" value={f.vibrate} onChange={(e) => set('vibrate', e.target.value)}>
              {vibrations.map((v) => (
                <MenuItem key={v} value={v}>
                  {VIB_LABELS[v] || v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <FormControlLabel
          control={<Switch checked={f.important} onChange={(e) => set('important', e.target.checked)} />}
          label={<Typography variant="body2">Importante: fica na tela até a pessoa tocar</Typography>}
        />
        <Divider />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Para quem</Typography>
        <FormControl size="small" fullWidth>
          <Select value={rec.mode} onChange={(e) => set('recipients', { ...rec, mode: e.target.value })}>
            <MenuItem value="me">Só para mim</MenuItem>
            {isAdmin ? <MenuItem value="all">Toda a equipe</MenuItem> : null}
            {isAdmin ? <MenuItem value="users">Pessoas escolhidas</MenuItem> : null}
          </Select>
        </FormControl>
        {rec.mode === 'users' ? (
          <FormControl size="small" fullWidth>
            <InputLabel>Pessoas</InputLabel>
            <Select
              multiple
              label="Pessoas"
              value={rec.user_ids || []}
              onChange={(e) => set('recipients', { ...rec, user_ids: e.target.value })}
              renderValue={(sel) => sel.map((id) => people.find((p) => p.id === id)?.name || id).join(', ')}
            >
              {people.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} {p.id === myId ? '(você)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
        {!isAdmin ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Só o dono ou um admin pode enviar avisos para outras pessoas.
          </Typography>
        ) : null}
        <Divider />
        <TextField
          type="datetime-local"
          label="Agendar para (opcional, horário de Brasília)"
          value={f.schedule_at}
          onChange={(e) => set('schedule_at', e.target.value)}
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="Vazio = só manual (botão Disparar). Com data, dispara sozinho nesse horário, uma vez."
        />
      </Stack>
    </CrmModal>
  );
}
CustomForm.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  initial: PropTypes.object,
  myId: PropTypes.string,
  isAdmin: PropTypes.bool,
  sounds: PropTypes.array,
  vibrations: PropTypes.array,
  onSaved: PropTypes.func
};

export function CustomCard({ isAdmin, myId, sounds, vibrations }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ open: false, initial: null });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(
    () =>
      get('/notifications/custom')
        .then((r) => setItems(r || []))
        .catch(() => setItems([])),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const fire = async (c, onlyMe) => {
    setBusy(`${c.id}:${onlyMe ? 'me' : 'all'}`);
    try {
      const r = await post(`/notifications/custom/${c.id}/fire`, { only_me: onlyMe });
      const s = r || {};
      toast.success(
        onlyMe
          ? 'Teste enviado para você.'
          : `Enviado para ${s.sent || 0} ${s.sent === 1 ? 'pessoa' : 'pessoas'}${s.skipped ? ` (${s.skipped} com o tipo desligado)` : ''}.`
      );
      load();
    } catch (e) {
      toast.error(errText(e, 'Não foi possível disparar.'));
    }
    setBusy('');
  };
  const del = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      await remove(`/notifications/custom/${c.id}`);
      load();
    } catch (e) {
      toast.error(errText(e));
    }
  };
  const recLabel = (r) =>
    r?.mode === 'all' ? 'Toda a equipe' : r?.mode === 'users' ? `${(r.user_ids || []).length} pessoas` : 'Só para mim';

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconSparkles}
        title="Avisos personalizados"
        subtitle="Monte um aviso e dispare quando quiser — teste, lembrete, comunicado."
        action={
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={16} />}
            onClick={() => setForm({ open: true, initial: null })}
            sx={waButtonSx}
          >
            Novo
          </Button>
        }
        stackAction
      />
      {items === null ? (
        <Skeleton height={120} />
      ) : !items.length ? (
        <Alert severity="info" icon={<IconFlask size={20} />} sx={{ borderRadius: 2 }}>
          Nenhum aviso ainda. Crie um "Teste" para ver como a notificação chega no seu aparelho.
        </Alert>
      ) : (
        <Stack divider={<Divider />}>
          {items.map((c) => {
            const scheduled = c.schedule_at && !c.sent_at;
            return (
              <Stack key={c.id} direction="row" alignItems="flex-start" spacing={1} sx={{ py: 1.25 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'action.hover',
                    fontSize: 18,
                    flexShrink: 0
                  }}
                >
                  {c.icon_url ? (
                    <Box component="img" src={c.icon_url} alt="" sx={{ width: 36, height: 36, borderRadius: 2, objectFit: 'cover' }} />
                  ) : (
                    c.emoji || '🔔'
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                    {c.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    {c.title}
                    {c.body ? ` — ${c.body}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      icon={c.recipients?.mode === 'me' ? <IconUser size={13} /> : <IconUsers size={13} />}
                      label={recLabel(c.recipients)}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                    {scheduled ? (
                      <Chip
                        size="small"
                        color="warning"
                        icon={<IconClock size={13} />}
                        label={`agendado ${fmtDateBRT(c.schedule_at)}`}
                        sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                      />
                    ) : null}
                    {c.important ? (
                      <Chip size="small" color="error" label="importante" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                    ) : null}
                    {c.fire_count ? (
                      <Chip size="small" label={`${c.fire_count}× · ${fmtAgo(c.last_fired_at)}`} sx={{ height: 20, fontSize: 11 }} />
                    ) : null}
                    {c.created_by_name && c.created_by !== myId ? (
                      <Chip size="small" label={`por ${c.created_by_name}`} sx={{ height: 20, fontSize: 11 }} />
                    ) : null}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                  <Tooltip title="Enviar só para mim (teste)">
                    <span>
                      <IconButton size="small" onClick={() => fire(c, true)} disabled={busy !== ''} aria-label="testar">
                        {busy === `${c.id}:me` ? <CircularProgress size={16} /> : <IconFlask size={17} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Disparar agora para os destinatários">
                    <span>
                      <IconButton size="small" color="primary" onClick={() => fire(c, false)} disabled={busy !== ''} aria-label="disparar">
                        {busy === `${c.id}:all` ? <CircularProgress size={16} /> : <IconSend size={17} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => setForm({ open: true, initial: c })} aria-label="editar">
                      <IconPencil size={17} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton size="small" onClick={() => setConfirm(c)} aria-label="excluir">
                      <IconTrash size={17} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}
      <CustomForm
        open={form.open}
        initial={form.initial}
        onClose={() => setForm({ open: false, initial: null })}
        myId={myId}
        isAdmin={isAdmin}
        sounds={sounds}
        vibrations={vibrations}
        onSaved={() => load()}
      />
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={del}
        title="Excluir aviso?"
        message={`"${confirm?.name}" será apagado. O histórico do que já foi enviado continua.`}
        confirmLabel="Excluir"
        danger
      />
    </TgCard>
  );
}
CustomCard.propTypes = { isAdmin: PropTypes.bool, myId: PropTypes.string, sounds: PropTypes.array, vibrations: PropTypes.array };

export function HistoryCard() {
  const [data, setData] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(
    () =>
      get('/notifications/history', { params: { size: 30 } })
        .then((r) => setData(r))
        .catch(() => setData({ items: [], total: 0 })),
    []
  );
  useEffect(() => {
    load();
    const onLive = (ev) => {
      const n = ev.detail;
      if (!n?.title) return;
      setData((cur) => {
        const items = cur?.items || [];
        if (n.id && items.some((x) => x.id === n.id)) return cur;
        return {
          ...(cur || {}),
          total: (cur?.total || 0) + 1,
          items: [
            {
              id: n.id || `live-${Date.now()}`,
              kind: n.kind,
              title: n.title,
              body: n.body,
              url: n.url,
              channels: [n.via || 'inapp'],
              status: 'sent',
              created_at: n.at || new Date().toISOString()
            },
            ...items
          ].slice(0, 30)
        };
      });
    };
    window.addEventListener('pm:notify', onLive);
    return () => window.removeEventListener('pm:notify', onLive);
  }, [load]);
  const clear = async () => {
    setConfirm(false);
    await remove('/notifications/history').catch(() => undefined);
    load();
  };
  const items = data?.items || [];
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconHistory}
        title="Histórico"
        subtitle={
          data ? `${data.total || 0} ${data.total === 1 ? 'aviso' : 'avisos'} nos últimos 30 dias.` : 'Últimos avisos enviados a você.'
        }
        action={
          items.length ? (
            <Button size="small" color="inherit" startIcon={<IconTrash size={15} />} onClick={() => setConfirm(true)}>
              Limpar
            </Button>
          ) : null
        }
        stackAction
      />
      {data === null ? (
        <Skeleton height={160} />
      ) : !items.length ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nada por aqui ainda. Use "Enviar teste" para ver o primeiro.
        </Typography>
      ) : (
        <Stack divider={<Divider />} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
          {items.map((n) => {
            const Icon = KIND_ICON[n.kind] || IconBellRinging;
            const muted = n.status !== 'sent';
            return (
              <Stack key={n.id} direction="row" spacing={1.25} alignItems="flex-start" sx={{ py: 1, opacity: muted ? 0.6 : 1 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'action.hover',
                    flexShrink: 0
                  }}
                >
                  <Icon size={17} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3 }}>{n.title}</Typography>
                  {n.body ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5 }} noWrap>
                      {n.body}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {fmtAgo(n.created_at)}
                    {n.channels?.length
                      ? ` · ${n.channels.map((c) => (c === 'inapp' ? 'painel' : c === 'push' ? 'push' : c === 'no_device' ? 'sem aparelho' : c)).join(' + ')}`
                      : ''}
                    {n.status === 'quiet' ? ' · horário silencioso' : n.status === 'no_device' ? ' · nenhum aparelho recebeu' : ''}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      )}
      <TgConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={clear}
        title="Limpar histórico?"
        message="Apaga a lista de avisos recebidos. As preferências continuam."
        confirmLabel="Limpar"
        danger
      />
    </TgCard>
  );
}
