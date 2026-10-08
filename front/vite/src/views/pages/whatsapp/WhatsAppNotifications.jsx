import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
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
  IconBellOff,
  IconCheck,
  IconDeviceMobile,
  IconDeviceMobileDown,
  IconDevices,
  IconFlask,
  IconMoon,
  IconPlayerPlay,
  IconTrash,
  IconDeviceMobileVibration,
  IconVolume,
  IconAdjustmentsHorizontal,
  IconFilter,
  IconListCheck,
  IconUsersGroup,
  IconPhoto,
  IconUpload,
  IconUserCircle
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard } from 'views/pages/telegram/ui';
import { enableNotifications, isIOS, isMobile, openPwaDialog, pushDiagnostics, subscribePush, unsubscribePush, usePwa } from 'pwa/pwa';
import { SOUND_LABELS, playSound, vibrate } from 'notifications/sounds';
import { ICON_EMOJIS, emojiToPng, isHttpUrl, uploadIcon } from 'notifications/icons';
import { WaPageHeader, WaNumberMultiSelect, useWaSessions, waButtonSx } from './waKit';
import { fmtAgo } from './waShared';
import { SettingsCardHeader, cardSx, errText } from './settings/settingsKit';
import { CrmModal } from './crm/crmKit';
import WaChatPicker from './WaChatPicker';
import { GROUP_ICON, GROUP_TONE, KIND_ICON } from './notifications/kinds';
import { CustomCard, HistoryCard } from './notifications/CustomAndHistory';

// ============================================================================
// WhatsApp → Notificações. Tudo é POR USUÁRIO (cada atendente escolhe o que recebe):
//  - Este aparelho: permissão + inscrição no push + aparelhos registrados + teste
//  - Como avisar: canais (push / painel), som, vibração, horário silencioso
//  - O que avisar: por tipo, com escopo/números/contatos para mensagens e etapas do funil
//  - Avisos personalizados + histórico (em CustomAndHistory.jsx)
// Preferências: GET/PUT /notifications/prefs (autosave com atraso de 700 ms).
// ============================================================================

const VIB_LABELS = { short: 'Curta', double: 'Dupla', long: 'Longa', none: 'Sem vibração' };

function usePrefs() {
  const [prefs, setPrefs] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const timer = useRef(null);
  const latest = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([get('/notifications/prefs'), get('/notifications/catalog')])
      .then(([p, c]) => {
        if (!alive) return;
        setPrefs(p);
        latest.current = p;
        setCatalog(c);
      })
      .catch((e) => toast.error(errText(e, 'Não foi possível carregar as preferências.')));
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async () => {
    const body = latest.current;
    if (!body) return;
    setStatus('saving');
    try {
      const r = await put('/notifications/prefs', { prefs: body });
      latest.current = r;
      setPrefs(r);
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800);
    } catch (e) {
      setStatus('error');
      toast.error(errText(e, 'Não foi possível salvar.'));
    }
  }, []);

  /** Atualiza um trecho (função ou objeto raso) e agenda o salvamento. */
  const patch = useCallback(
    (fn) => {
      setPrefs((cur) => {
        const next = typeof fn === 'function' ? fn(cur) : { ...cur, ...fn };
        latest.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(save, 700);
    },
    [save]
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);
  return { prefs, catalog, patch, status };
}

function SaveState({ status }) {
  if (status === 'saving') return <Chip size="small" label="Salvando…" icon={<CircularProgress size={12} />} sx={{ fontWeight: 700 }} />;
  if (status === 'saved')
    return <Chip size="small" color="success" label="Salvo" icon={<IconCheck size={14} />} sx={{ fontWeight: 700 }} />;
  if (status === 'error') return <Chip size="small" color="error" label="Erro ao salvar" sx={{ fontWeight: 700 }} />;
  return null;
}

// ---------------------------------------------------------------- linha com switch
function SwitchRow({ icon: Icon, tone = 'primary', label, hint, checked, onChange, disabled, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ py: 0.75 }}>
        {Icon ? (
          <Box
            sx={(t) => ({
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: `${tone}.main`,
              bgcolor: `rgba(${t.vars.palette[tone].mainChannel} / 0.12)`
            })}
          >
            <Icon size={18} />
          </Box>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{label}</Typography>
          {hint ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
              {hint}
            </Typography>
          ) : null}
        </Box>
        <Switch checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      </Stack>
      {children ? <Collapse in={Boolean(checked)}>{children}</Collapse> : null}
    </Box>
  );
}

// ---------------------------------------------------------------- 1. este aparelho
function DeviceCard() {
  const pwa = usePwa();
  const [devices, setDevices] = useState(null);
  const [busy, setBusy] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [diag, setDiag] = useState(null);

  const load = useCallback(
    () =>
      get('/notifications/subscriptions')
        .then((r) => setDevices(r || []))
        .catch(() => setDevices([])),
    []
  );
  useEffect(() => {
    load();
  }, [load, pwa.pushSubscribed]);

  const enable = async () => {
    setBusy('enable');
    const p = await enableNotifications();
    if (p === 'granted') {
      const r = await subscribePush();
      if (r.ok) toast.success('Este aparelho vai receber as notificações.');
      else if (r.reason === 'server_off') toast.error('O servidor está sem as chaves do push. Avise o administrador.');
      else toast.error(`Não deu para inscrever este aparelho: ${r.reason}`);
    } else if (p === 'denied') toast.error('As notificações estão bloqueadas neste navegador.');
    setBusy('');
    load();
  };
  const disable = async () => {
    setBusy('disable');
    await unsubscribePush();
    setBusy('');
    toast('Push desativado neste aparelho. Os avisos no painel continuam.');
    load();
  };
  const test = async (channel) => {
    setBusy(`test-${channel}`);
    try {
      const r = await post('/notifications/test', { channel });
      setTestResult(r);
      if (channel !== 'inapp' && !r?.push)
        toast(r?.push_enabled ? 'Nenhum aparelho recebeu o push.' : 'O push está desligado no servidor.');
    } catch (e) {
      toast.error(errText(e, 'Falha no teste.'));
    }
    setBusy('');
  };
  const removeDevice = async (id) => {
    try {
      await remove(`/notifications/subscriptions/${id}`);
      if (pwa.pushId === id) await unsubscribePush();
      load();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const perm = pwa.permission;
  const subscribed = pwa.pushSubscribed === true;
  let state;
  if (perm === 'unsupported')
    state = {
      color: 'warning',
      label: 'Sem suporte',
      text: isIOS
        ? 'No iPhone/iPad as notificações só funcionam no app instalado (iOS 16.4+). Instale pela tela inicial e ative lá.'
        : 'Este navegador não oferece notificações.'
    };
  else if (perm === 'denied')
    state = {
      color: 'error',
      label: 'Bloqueadas',
      text: isIOS
        ? 'Libere em Ajustes → Notificações → Pub Mail.'
        : 'Libere no cadeado ao lado do endereço (ou nas informações do app) → Notificações → Permitir.'
    };
  else if (perm === 'granted' && subscribed)
    state = { color: 'success', label: 'Ativas neste aparelho', text: 'Você recebe push aqui mesmo com o painel fechado.' };
  else if (perm === 'granted')
    state = {
      color: 'info',
      label: 'Permitidas, sem push',
      text: 'A permissão existe, mas este aparelho ainda não está inscrito. Ative para receber com o app fechado.'
    };
  else state = { color: 'default', label: 'Ainda não ativadas', text: 'Ative para receber os avisos neste aparelho.' };

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconDeviceMobile}
        title="Este aparelho"
        subtitle="Permissão e inscrição no push deste navegador/app."
        action={<Chip size="small" color={state.color} label={state.label} sx={{ fontWeight: 700 }} />}
        stackAction
      />
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {state.text}
      </Typography>
      {isMobile && !pwa.standalone ? (
        <Alert
          severity="info"
          icon={<IconDeviceMobileDown size={20} />}
          sx={{ mb: 1.5, borderRadius: 2, alignItems: 'center' }}
          action={
            <Button size="small" onClick={() => openPwaDialog('install')}>
              Instalar
            </Button>
          }
        >
          No celular, instale o Pub Mail como app: as notificações ficam mais confiáveis (e no iPhone só funcionam assim).
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {perm !== 'granted' || !subscribed ? (
          <Button
            variant="contained"
            disableElevation
            startIcon={busy === 'enable' ? <CircularProgress size={16} color="inherit" /> : <IconBellRinging size={18} />}
            disabled={busy !== '' || perm === 'denied' || perm === 'unsupported'}
            onClick={enable}
            sx={waButtonSx}
          >
            Ativar neste aparelho
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={busy === 'disable' ? <CircularProgress size={16} color="inherit" /> : <IconBellOff size={18} />}
            disabled={busy !== ''}
            onClick={disable}
          >
            Desativar neste aparelho
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={busy === 'test-both' ? <CircularProgress size={16} /> : <IconFlask size={18} />}
          disabled={busy !== ''}
          onClick={() => test('both')}
        >
          Enviar teste
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={async () => {
            if (diag) return setDiag(null);
            setDiag(await pushDiagnostics());
          }}
          sx={{ color: 'text.secondary' }}
        >
          {diag ? 'Fechar diagnóstico' : 'Diagnóstico'}
        </Button>
        <Button
          variant="text"
          color="inherit"
          sx={{ color: 'text.secondary' }}
          onClick={async () => {
            // aviso do sistema LOCAL (sem servidor): prova se o navegador/sistema deixa mostrar
            let p = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
            if (p === 'default') p = await enableNotifications();
            if (p !== 'granted') return toast.error('Sem permissão de notificação neste navegador.');
            try {
              const reg = await navigator.serviceWorker.getRegistration('/');
              await reg.showNotification('Aviso do sistema OK', {
                body: 'Se você está vendo isto fora do painel, o sistema permite as notificações.',
                icon: '/pwa/icon-192.png',
                badge: '/pwa/badge-96.png',
                tag: 'pm-local-test'
              });
              toast(
                'Aviso do sistema disparado. Se nada apareceu, o sistema está bloqueando: no Mac, Ajustes → Notificações → Google Chrome; no Windows, assistente de foco.',
                { duration: 9000 }
              );
            } catch (e) {
              toast.error(`Não deu para mostrar: ${e?.message || e}`);
            }
          }}
        >
          Testar aviso do sistema
        </Button>
      </Stack>
      {diag ? (
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Raio-X deste aparelho (mande para o suporte se algo falhar)
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 0.5,
              fontSize: 11.5,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'ui-monospace, Menlo, monospace'
            }}
          >
            {JSON.stringify(diag, null, 1)}
          </Box>
          <Button
            size="small"
            sx={{ mt: 0.5 }}
            onClick={() => {
              navigator.clipboard
                ?.writeText(JSON.stringify(diag, null, 1))
                .then(() => toast.success('Copiado.'))
                .catch(() => toast('Não deu para copiar; selecione o texto.'));
            }}
          >
            Copiar
          </Button>
        </Box>
      ) : null}
      {testResult ? (
        <Alert
          severity={testResult.push || testResult.inapp ? 'success' : 'warning'}
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setTestResult(null)}
        >
          {testResult.inapp ? 'Aviso no painel enviado. ' : ''}
          {testResult.push
            ? `Push enviado para ${testResult.push} ${testResult.push === 1 ? 'aparelho' : 'aparelhos'} — o aviso do sistema deve aparecer em instantes (no computador, confira se o sistema permite notificações do navegador).`
            : testResult.push_enabled
              ? 'Nenhum aparelho inscrito recebeu o push — ative neste aparelho primeiro.'
              : 'Push desligado no servidor.'}
        </Alert>
      ) : null}
      <Divider sx={{ my: 1 }} />
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, mb: 0.5 }}>
        <IconDevices size={18} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Aparelhos inscritos</Typography>
      </Stack>
      {devices === null ? (
        <Skeleton height={48} />
      ) : !devices.length ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nenhum aparelho recebe push ainda.
        </Typography>
      ) : (
        <Stack divider={<Divider />} sx={{ mt: 0.5 }}>
          {devices.map((d) => (
            <Stack key={d.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
                  {d.device_label || 'Aparelho'}{' '}
                  {pwa.pushId === d.id ? (
                    <Chip size="small" label="este" color="success" sx={{ ml: 0.5, height: 18, fontSize: 10.5, fontWeight: 700 }} />
                  ) : null}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {d.last_sent_at ? `último push ${fmtAgo(d.last_sent_at)}` : `inscrito ${fmtAgo(d.created_at)}`}
                  {d.failures ? ` · ${d.failures} falhas` : ''}
                </Typography>
              </Box>
              <Tooltip title="Remover este aparelho">
                <IconButton size="small" onClick={() => removeDevice(d.id)} aria-label="remover aparelho">
                  <IconTrash size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}
    </TgCard>
  );
}

// ---------------------------------------------------------------- 2. como avisar
function ChannelsCard({ prefs, catalog, patch, status }) {
  if (!prefs || !catalog)
    return (
      <TgCard hover={false} sx={cardSx}>
        <Skeleton height={260} />
      </TgCard>
    );
  const q = prefs.quiet || {};
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconAdjustmentsHorizontal}
        title="Como avisar"
        subtitle="Canais, som, vibração e horário silencioso."
        action={<SaveState status={status} />}
      />
      <SwitchRow
        icon={IconBellRinging}
        label="Notificações ligadas"
        hint="Desligue para não receber nada (os avisos personalizados de teste continuam)."
        checked={prefs.enabled}
        onChange={(v) => patch({ enabled: v })}
      />
      <Divider sx={{ my: 0.5 }} />
      <SwitchRow
        icon={IconDeviceMobile}
        tone="success"
        label="Push no aparelho"
        hint="Chega mesmo com o painel fechado, nos aparelhos inscritos."
        checked={prefs.push}
        onChange={(v) => patch({ push: v })}
        disabled={!prefs.enabled}
      >
        <FormControlLabel
          sx={{ ml: 5.5, mb: 0.5 }}
          control={<Switch size="small" checked={prefs.only_when_away} onChange={(e) => patch({ only_when_away: e.target.checked })} />}
          label={
            <Typography variant="body2">
              Não mandar push para o aparelho em que o painel está aberto (nele o aviso já aparece na tela)
            </Typography>
          }
        />
      </SwitchRow>
      <SwitchRow
        icon={IconListCheck}
        tone="info"
        label="Aviso no painel"
        hint="Um cartão no canto da tela enquanto o Pub Mail está aberto."
        checked={prefs.inapp}
        onChange={(v) => patch({ inapp: v })}
        disabled={!prefs.enabled}
      />
      <Divider sx={{ my: 0.5 }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Som</InputLabel>
          <Select
            label="Som"
            value={prefs.sound}
            onChange={(e) => patch({ sound: e.target.value })}
            startAdornment={<IconVolume size={18} style={{ marginRight: 8, opacity: 0.7 }} />}
          >
            {catalog.sounds.map((s) => (
              <MenuItem key={s} value={s}>
                {SOUND_LABELS[s] || s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<IconPlayerPlay size={16} />}
          onClick={() => playSound(prefs.sound)}
          disabled={prefs.sound === 'none'}
          sx={{ flexShrink: 0 }}
        >
          Ouvir
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Vibração (celular)</InputLabel>
          <Select
            label="Vibração (celular)"
            value={prefs.vibrate}
            onChange={(e) => patch({ vibrate: e.target.value })}
            startAdornment={<IconDeviceMobileVibration size={18} style={{ marginRight: 8, opacity: 0.7 }} />}
          >
            {catalog.vibrations.map((v) => (
              <MenuItem key={v} value={v}>
                {VIB_LABELS[v] || v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<IconDeviceMobileVibration size={16} />}
          disabled={prefs.vibrate === 'none'}
          onClick={() => {
            const pat = { short: [120], double: [100, 80, 100], long: [350] }[prefs.vibrate] || [];
            if (!vibrate(pat))
              toast(
                isIOS
                  ? 'O iPhone não vibra por sites nem por apps da web (limite da Apple). No push ele usa a vibração do sistema.'
                  : 'Este aparelho não vibra (ou o navegador não permite).'
              );
          }}
          sx={{ flexShrink: 0 }}
        >
          Testar
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
        O som toca no painel. No push, o aparelho usa o som do sistema; "Sem som" deixa o push silencioso.
      </Typography>
      <Divider sx={{ my: 1.5 }} />
      <SwitchRow
        icon={IconMoon}
        tone="secondary"
        label="Horário silencioso"
        hint="Sem push nesse período (horário de Brasília). No painel o aviso aparece sem som."
        checked={q.enabled}
        onChange={(v) => patch((p) => ({ ...p, quiet: { ...p.quiet, enabled: v } }))}
      >
        <Stack direction="row" spacing={1.5} sx={{ ml: 5.5, mt: 0.5, mb: 1 }}>
          <TextField
            size="small"
            type="time"
            label="Das"
            value={q.start || '22:00'}
            onChange={(e) => patch((p) => ({ ...p, quiet: { ...p.quiet, start: e.target.value } }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            type="time"
            label="Até"
            value={q.end || '07:00'}
            onChange={(e) => patch((p) => ({ ...p, quiet: { ...p.quiet, end: e.target.value } }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </SwitchRow>
    </TgCard>
  );
}

// ---------------------------------------------------------------- 2b. ícone
function IconCard({ prefs, patch }) {
  const [busy, setBusy] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef(null);
  if (!prefs)
    return (
      <TgCard hover={false} sx={cardSx}>
        <Skeleton height={220} />
      </TgCard>
    );
  const icon = prefs.icon || { mode: 'default', emoji: null, url: null };
  const preview = icon.mode !== 'default' && icon.url ? icon.url : '/pwa/icon-192.png';
  const applyEmoji = async (emoji) => {
    const e = String(emoji || '').trim();
    if (!e) return;
    setBusy(true);
    try {
      const url = await uploadIcon(await emojiToPng(e));
      patch((p) => ({ ...p, icon: { mode: 'emoji', emoji: e, url } }));
    } catch (err) {
      toast.error(errText(err, 'Não deu para gerar o ícone.'));
    }
    setBusy(false);
  };
  const applyFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadIcon(file);
      patch((p) => ({ ...p, icon: { mode: 'image', emoji: null, url } }));
    } catch (err) {
      toast.error(errText(err, 'Não deu para enviar a imagem.'));
    }
    setBusy(false);
  };
  const applyUrl = () => {
    if (!isHttpUrl(urlInput)) return toast.error('Informe um endereço completo (https://…).');
    patch((p) => ({ ...p, icon: { mode: 'image', emoji: null, url: urlInput.trim() } }));
  };
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconPhoto}
        title="Ícone das notificações"
        subtitle="A imagem que aparece ao lado do aviso, no painel e no push."
      />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <Box
          component="img"
          src={preview}
          alt=""
          sx={{ width: 64, height: 64, borderRadius: 3, objectFit: 'cover', border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            {icon.mode === 'emoji' ? `Emoji ${icon.emoji || ''}` : icon.mode === 'image' ? 'Imagem própria' : 'Logo do Pub Mail'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Mensagens e atendimento podem usar a foto do contato ou do grupo (abaixo). Nos outros avisos vale este ícone.
          </Typography>
        </Box>
        {busy ? <CircularProgress size={20} /> : null}
      </Stack>
      <RadioGroup
        value={icon.mode}
        onChange={(e) =>
          e.target.value === 'default' ? patch((p) => ({ ...p, icon: { mode: 'default', emoji: null, url: null } })) : null
        }
      >
        <FormControlLabel
          value="default"
          control={<Radio size="small" />}
          label={<Typography variant="body2">Logo do Pub Mail (padrão)</Typography>}
        />
        <FormControlLabel
          value="emoji"
          control={<Radio size="small" onClick={() => !icon.url && applyEmoji(icon.emoji || '🔔')} />}
          label={<Typography variant="body2">Emoji</Typography>}
        />
        <FormControlLabel
          value="image"
          control={<Radio size="small" onClick={() => fileRef.current?.click()} />}
          label={<Typography variant="body2">Imagem (upload ou endereço)</Typography>}
        />
      </RadioGroup>
      <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Emoji
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mt: 0.5, mb: 1 }}>
          {ICON_EMOJIS.map((e) => (
            <Button
              key={e}
              size="small"
              variant={icon.mode === 'emoji' && icon.emoji === e ? 'contained' : 'outlined'}
              color="inherit"
              disabled={busy}
              onClick={() => applyEmoji(e)}
              sx={{ minWidth: 40, px: 0.5, fontSize: 20, lineHeight: 1 }}
            >
              {e}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Outro emoji"
            value={emojiInput}
            onChange={(e) => setEmojiInput(e.target.value.slice(0, 4))}
            sx={{ width: 140 }}
          />
          <Button size="small" variant="outlined" disabled={busy || !emojiInput.trim()} onClick={() => applyEmoji(emojiInput)}>
            Usar
          </Button>
        </Stack>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', mt: 1.5 }}
        >
          Imagem
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            hidden
            onChange={(e) => {
              applyFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<IconUpload size={16} />}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Enviar imagem
          </Button>
          <TextField
            size="small"
            placeholder="https://… (PNG/JPG quadrado)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            fullWidth
          />
          <Button size="small" variant="outlined" disabled={busy || !urlInput.trim()} onClick={applyUrl} sx={{ flexShrink: 0 }}>
            Usar endereço
          </Button>
        </Stack>
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <SwitchRow
        icon={IconUserCircle}
        tone="success"
        label="Foto do contato ou do grupo"
        hint="Em mensagens, menções, fila e atribuições, o ícone é a foto de quem mandou (quando existe)."
        checked={prefs.contact_photo}
        onChange={(v) => patch({ contact_photo: v })}
      />
    </TgCard>
  );
}

// ---------------------------------------------------------------- 3. o que avisar
function KindsCard({ prefs, catalog, patch }) {
  const { sessions } = useWaSessions(0);
  const [stages, setStages] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    get('/whatsapp/pipeline/stages')
      .then((r) => setStages(Array.isArray(r) ? r : r?.items || []))
      .catch(() => setStages([]));
  }, []);
  const groups = useMemo(() => {
    if (!catalog) return [];
    const by = new Map();
    for (const k of catalog.kinds) by.set(k.group, [...(by.get(k.group) || []), k]);
    return Object.entries(catalog.groups).map(([key, g]) => ({ key, ...g, kinds: by.get(key) || [] }));
  }, [catalog]);
  if (!prefs || !catalog)
    return (
      <TgCard hover={false} sx={cardSx}>
        <Skeleton height={420} />
      </TgCard>
    );

  const m = prefs.message;
  const setMessage = (part) => patch((p) => ({ ...p, message: { ...p.message, ...part } }));
  const setContacts = (part) => patch((p) => ({ ...p, message: { ...p.message, contacts: { ...p.message.contacts, ...part } } }));
  const flag = (key) => prefs[key];
  const setFlag = (key) => (v) => patch({ [key]: v });
  const off = !prefs.enabled;

  const renderKind = (k) => {
    const Icon = KIND_ICON[k.key] || IconBellRinging;
    const tone = GROUP_TONE[k.group] || 'primary';
    if (k.key === 'message') {
      return (
        <SwitchRow
          key={k.key}
          icon={Icon}
          tone={tone}
          label={k.label}
          hint={k.description}
          checked={m.enabled}
          onChange={(v) => setMessage({ enabled: v })}
          disabled={off}
        >
          <Box sx={{ ml: { xs: 0, sm: 5.5 }, mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Quais conversas
            </Typography>
            <RadioGroup value={m.scope} onChange={(e) => setMessage({ scope: e.target.value })}>
              <FormControlLabel
                value="all"
                control={<Radio size="small" />}
                label={<Typography variant="body2">Todas as conversas</Typography>}
              />
              <FormControlLabel
                value="mine"
                control={<Radio size="small" />}
                label={<Typography variant="body2">Só as que estão comigo (atribuídas a mim)</Typography>}
              />
              <FormControlLabel
                value="unassigned"
                control={<Radio size="small" />}
                label={<Typography variant="body2">As minhas e as sem atendente</Typography>}
              />
            </RadioGroup>
            {sessions.length > 1 ? (
              <Box sx={{ mt: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                >
                  Números
                </Typography>
                <WaNumberMultiSelect
                  sessions={sessions}
                  value={m.sessions || []}
                  onChange={(ids) => setMessage({ sessions: ids?.length ? ids : null })}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Vazio = todos os números que você atende.
                </Typography>
              </Box>
            ) : null}
            <Box sx={{ mt: 1.25 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                Contatos e grupos específicos
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }} alignItems={{ sm: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <Select value={m.contacts.mode} onChange={(e) => setContacts({ mode: e.target.value })}>
                    <MenuItem value="all">Sem filtro por contato</MenuItem>
                    <MenuItem value="only">Só avisar destes contatos</MenuItem>
                    <MenuItem value="except">Avisar de todos, menos destes</MenuItem>
                  </Select>
                </FormControl>
                {m.contacts.mode !== 'all' ? (
                  <Button size="small" variant="outlined" startIcon={<IconFilter size={16} />} onClick={() => setPickerOpen(true)}>
                    Escolher ({m.contacts.chats.length})
                  </Button>
                ) : null}
              </Stack>
              {m.contacts.mode !== 'all' && m.contacts.chats.length ? (
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mt: 1 }}>
                  {m.contacts.chats.map((c) => (
                    <Chip
                      key={c.chat_id}
                      size="small"
                      label={c.name || c.jid || c.chat_id}
                      onDelete={() => setContacts({ chats: m.contacts.chats.filter((x) => x.chat_id !== c.chat_id) })}
                    />
                  ))}
                </Stack>
              ) : null}
            </Box>
          </Box>
        </SwitchRow>
      );
    }
    if (k.key === 'pipeline_moved') {
      const pl = prefs.pipeline;
      return (
        <SwitchRow
          key={k.key}
          icon={Icon}
          tone={tone}
          label={k.label}
          hint={k.description}
          checked={pl.enabled}
          onChange={(v) => patch((p) => ({ ...p, pipeline: { ...p.pipeline, enabled: v } }))}
          disabled={off}
        >
          <FormControl size="small" fullWidth sx={{ ml: { xs: 0, sm: 5.5 }, width: { xs: '100%', sm: 'calc(100% - 44px)' }, mb: 1.5 }}>
            <InputLabel>Só destas etapas</InputLabel>
            <Select
              multiple
              label="Só destas etapas"
              value={pl.stages || []}
              onChange={(e) =>
                patch((p) => ({ ...p, pipeline: { ...p.pipeline, stages: e.target.value?.length ? e.target.value : null } }))
              }
              renderValue={(sel) =>
                sel.length ? sel.map((id) => stages.find((s) => s.id === id)?.name || id).join(', ') : 'Todas as etapas'
              }
              displayEmpty
            >
              {stages.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </SwitchRow>
      );
    }
    const key = k.key === 'message_group' ? 'message_group' : k.key;
    return (
      <SwitchRow
        key={k.key}
        icon={Icon}
        tone={tone}
        label={k.label}
        hint={k.description}
        checked={flag(key)}
        onChange={setFlag(key)}
        disabled={off}
      />
    );
  };

  return (
    <TgCard hover={false} sx={{ ...cardSx, gridColumn: { xs: 'auto', md: '1 / -1' } }}>
      <SettingsCardHeader
        icon={IconListCheck}
        title="O que avisar"
        subtitle="Escolha os tipos de aviso que você quer receber. Os colegas têm as próprias escolhas."
      />
      {off ? (
        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}>
          As notificações estão desligadas em "Como avisar".
        </Alert>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3, rowGap: 1 }}>
        {groups.map((g) => {
          const GIcon = GROUP_ICON[g.key] || IconBellRinging;
          return (
            <Box key={g.key} sx={{ minWidth: 0, ...(g.key === 'messages' ? { gridColumn: { xs: 'auto', md: '1 / -1' } } : {}) }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5, mb: 0.25 }}>
                <GIcon size={18} style={{ opacity: 0.8 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{g.label}</Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                {g.description}
              </Typography>
              {g.kinds.map(renderKind)}
            </Box>
          );
        })}
      </Box>
      <CrmModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Contatos e grupos"
        subtitle={
          m.contacts.mode === 'only' ? 'Você só será avisado das conversas escolhidas.' : 'Você NÃO será avisado das conversas escolhidas.'
        }
        maxWidth="sm"
        footer={
          <Button variant="contained" disableElevation onClick={() => setPickerOpen(false)} sx={waButtonSx}>
            Pronto
          </Button>
        }
      >
        <WaChatPicker
          value={m.contacts.chats}
          onChange={(next) =>
            setContacts({
              chats: next.map((c) => ({
                chat_id: c.chat_id,
                name: c.name || c.phone || null,
                session_id: c.session_id || c.session?.id || null,
                jid: c.jid || null
              }))
            })
          }
          listHeight={320}
        />
      </CrmModal>
    </TgCard>
  );
}

// ---------------------------------------------------------------- página
export default function WhatsAppNotifications() {
  const { prefs, catalog, patch, status } = usePrefs();
  const { user } = useAuth();
  const role = user?.user?.role;
  const isAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  return (
    <Box>
      <WaPageHeader
        icon={IconBellRinging}
        title="Notificações"
        subtitle="O que você quer saber na hora, e como: push no celular, aviso no painel, som e vibração."
      />
      {catalog && !catalog.push_enabled ? (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          O push está desligado no servidor (sem chaves VAPID). Os avisos no painel funcionam; o push só depois que o administrador
          configurar.
        </Alert>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <DeviceCard />
        <ChannelsCard prefs={prefs} catalog={catalog} patch={patch} status={status} />
        <IconCard prefs={prefs} patch={patch} />
        <KindsCard prefs={prefs} catalog={catalog} patch={patch} />
        <CustomCard isAdmin={isAdmin} myId={user?.user?.id} sounds={catalog?.sounds || []} vibrations={catalog?.vibrations || []} />
        <HistoryCard />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
        <IconUsersGroup size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
        Você só recebe avisos dos números do WhatsApp que pode atender. Cada pessoa da equipe tem as próprias preferências.
      </Typography>
    </Box>
  );
}
