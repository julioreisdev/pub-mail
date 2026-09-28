import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';

import {
  IconBrandWhatsapp,
  IconQrcode,
  IconRefresh,
  IconPlugConnected,
  IconPlugConnectedX,
  IconSend,
  IconDeviceMobile,
  IconDownload,
  IconCheck,
  IconAlertTriangle,
  IconCamera,
  IconTrash,
  IconFlame,
  IconHistory,
  IconCopy
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgStatusPill, TgModal, TgConfirmDialog } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';

// ============================================================================
// WhatsApp → Configurações: sessão da organização (1 por org) via OpenWA.
// Conectar (QR / código), status ao vivo, perfil, teste, aquecimento, atividade.
// Polling: 3 s enquanto conecta/aguarda QR; 15 s quando conectado.
// ============================================================================

const WA_GREEN = '#25D366';
const WA_DARK = '#128C7E';
const pulse = keyframes`0%{box-shadow:0 0 0 0 rgba(37,211,102,.45)}70%{box-shadow:0 0 0 14px rgba(37,211,102,0)}100%{box-shadow:0 0 0 0 rgba(37,211,102,0)}`;

const STATUS_UI = {
  none: { pill: 'inactive', label: 'Não conectado' },
  created: { pill: 'pending', label: 'Preparando…' },
  initializing: { pill: 'pending', label: 'Iniciando…' },
  qr_ready: { pill: 'pending', label: 'Aguardando leitura do QR' },
  authenticating: { pill: 'pending', label: 'Autenticando…' },
  ready: { pill: 'active', label: 'Conectado' },
  disconnected: { pill: 'error', label: 'Desconectado' },
  action_required: { pill: 'flood', label: 'Ação necessária' },
  failed: { pill: 'error', label: 'Falhou' }
};

const WARMUP = [20, 40, 80, 160, 320, 640, 1000];
const COLD = [5, 10, 20, 40, 60, 80, 100];

const fmtPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `+55 (${ddd}) ${rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`}`;
  }
  return `+${d}`;
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const errMsg = (e, fb) => e?.response?.data?.message || e?.message || fb;

// ---------------------------------------------------------------- QR / conexão
function ConnectionCard({ session, qr, busy, onConnect, onLogout, onTest, onPairing, onReconnect, onBootstrap, bootstrapping }) {
  const st = session?.status || 'none';
  const ui = STATUS_UI[st] || STATUS_UI.none;
  const restricted = Boolean(session?.restricted_at);
  const connecting = ['created', 'initializing', 'authenticating'].includes(st);

  return (
    <TgCard hover={false} sx={{ p: { xs: 2, sm: 3 }, height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
              animation: st === 'ready' ? `${pulse} 2.4s ease-out infinite` : 'none'
            }}
          >
            <IconBrandWhatsapp size={26} stroke={1.9} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.15 }}>Conexão</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Um número por organização
            </Typography>
          </Box>
        </Stack>
        {restricted ? <TgStatusPill status="banned" label="Restrito pelo WhatsApp" /> : <TgStatusPill status={ui.pill} label={ui.label} />}
      </Stack>

      {session?.gateway_error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {session.gateway_error}
        </Alert>
      ) : null}
      {restricted ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          O WhatsApp aplicou uma restrição a este número{session?.last_error ? `: ${session.last_error}` : ''}. Aguarde o prazo informado no
          celular ou conecte outro número.
        </Alert>
      ) : null}

      {/* ---------- não conectado ---------- */}
      {st === 'none' && (
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            Conecte o WhatsApp da sua organização para usar chat, status, contatos e broadcasts a partir do Pub Mail.
          </Typography>
          <Alert severity="info" icon={<IconAlertTriangle size={20} />}>
            Use um <strong>número dedicado</strong>, não o seu pessoal. O WhatsApp pode restringir números que automatizam mensagens, e
            nesse caso o Pub Mail não tem como reverter.
          </Alert>
          <Button
            size="large"
            variant="contained"
            disableElevation
            disabled={busy || session?.configured === false}
            onClick={onConnect}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <IconPlugConnected size={20} />}
            sx={{ alignSelf: 'flex-start', fontWeight: 700, borderRadius: 2.5, px: 3, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
          >
            Conectar WhatsApp
          </Button>
          {session?.configured === false ? <Alert severity="error">Gateway WhatsApp não configurado no servidor.</Alert> : null}
        </Stack>
      )}

      {/* ---------- conectando ---------- */}
      {connecting && (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
          <CircularProgress size={34} sx={{ color: WA_GREEN }} />
          <Typography sx={{ fontWeight: 600 }}>{ui.label}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Isso leva alguns segundos. O QR Code aparece aqui.
          </Typography>
        </Stack>
      )}

      {/* ---------- QR ---------- */}
      {st === 'qr_ready' && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 3,
              bgcolor: '#fff',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 12px 32px rgba(15,23,42,.10)',
              width: 248,
              height: 248,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}
          >
            {qr ? (
              <img src={qr} alt="QR Code do WhatsApp" width={220} height={220} style={{ display: 'block' }} />
            ) : (
              <CircularProgress size={28} sx={{ color: WA_GREEN }} />
            )}
          </Box>
          <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Escaneie com o celular</Typography>
            {[
              ['1', 'Abra o WhatsApp no celular do número que será conectado.'],
              ['2', 'Toque em ⋮ (Android) ou Configurações (iPhone) → Dispositivos conectados → Conectar dispositivo.'],
              ['3', 'Aponte a câmera para o QR Code ao lado. O código renova sozinho a cada ~40 s.']
            ].map(([n, t]) => (
              <Stack key={n} direction="row" spacing={1.25} alignItems="flex-start">
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: WA_GREEN,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 12,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}
                >
                  {n}
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t}
                </Typography>
              </Stack>
            ))}
            <Divider sx={{ my: 0.5 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconDeviceMobile size={16} />}
                onClick={onPairing}
                disabled={busy}
                sx={{ fontWeight: 700 }}
              >
                Conectar pelo número
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<IconRefresh size={16} />}
                onClick={onReconnect}
                disabled={busy}
                sx={{ fontWeight: 600 }}
              >
                Gerar novo QR
              </Button>
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<IconPlugConnectedX size={16} />}
                onClick={onLogout}
                disabled={busy}
                sx={{ fontWeight: 600 }}
              >
                Cancelar
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}

      {/* ---------- conectado ---------- */}
      {st === 'ready' && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
                flexShrink: 0
              }}
            >
              <IconCheck size={30} stroke={2.4} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                {fmtPhone(session.phone) || 'Número identificando…'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {session.push_name ? `${session.push_name} · ` : ''}conectado em {fmtDate(session.paired_at)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {session.warmup_day ? (
              <Chip
                size="small"
                icon={<IconFlame size={14} />}
                label={session.warmup_day >= 8 ? 'Número aquecido' : `Aquecimento · dia ${session.warmup_day}/7`}
                sx={{ fontWeight: 700 }}
                color={session.warmup_day >= 8 ? 'success' : 'warning'}
                variant="outlined"
              />
            ) : null}
            {session.last_event_at ? (
              <Chip size="small" label={`Último evento ${fmtDate(session.last_event_at)}`} variant="outlined" />
            ) : null}
          </Stack>
          <Divider />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconSend size={18} />}
              onClick={onTest}
              disabled={busy}
              sx={{ fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Enviar mensagem de teste
            </Button>
            <Button
              variant="outlined"
              startIcon={bootstrapping ? <CircularProgress size={16} color="inherit" /> : <IconDownload size={18} />}
              onClick={onBootstrap}
              disabled={busy || bootstrapping}
              sx={{ fontWeight: 700, borderRadius: 2, borderColor: WA_DARK, color: WA_DARK }}
            >
              {bootstrapping ? 'Importando…' : 'Importar do celular'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<IconPlugConnectedX size={18} />}
              onClick={onLogout}
              disabled={busy}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Desconectar / trocar número
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            A mensagem de teste é enviada para o próprio número conectado. Importar do celular traz conversas, contatos e histórico: ao
            conectar isso roda sozinho; use se algo não apareceu.
          </Typography>
        </Stack>
      )}

      {/* ---------- caiu ---------- */}
      {(st === 'disconnected' || st === 'failed' || st === 'action_required') && (
        <Stack spacing={2}>
          <Alert severity={st === 'action_required' ? 'warning' : 'error'}>
            {st === 'action_required'
              ? 'O WhatsApp pediu uma ação no celular (por exemplo, confirmar o dispositivo). Abra o aplicativo e depois clique em Reconectar.'
              : `A sessão caiu${session?.last_error ? `: ${session.last_error}` : ''}. O Pub Mail tenta reconectar sozinho a cada 5 minutos; você também pode reconectar agora.`}
          </Alert>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconRefresh size={18} />}
              onClick={onReconnect}
              disabled={busy}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Reconectar
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<IconPlugConnectedX size={18} />}
              onClick={onLogout}
              disabled={busy}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Desconectar / trocar número
            </Button>
          </Stack>
        </Stack>
      )}
    </TgCard>
  );
}

// ---------------------------------------------------------------- perfil
function ProfileCard({ enabled, canEdit }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', status: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const p = await get('/whatsapp/profile');
      setProfile(p);
      setForm({ name: p?.name || '', status: p?.status || '' });
    } catch {
      /* mostra vazio */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = profile && (form.name !== (profile.name || '') || form.status !== (profile.status || ''));

  const save = async () => {
    setSaving(true);
    try {
      const body = {};
      if (form.name !== (profile?.name || '')) body.name = form.name.trim();
      if (form.status !== (profile?.status || '')) body.status = form.status;
      const p = await put('/whatsapp/profile', body);
      setProfile(p);
      setForm({ name: p?.name || '', status: p?.status || '' });
      toast.success('Perfil atualizado no WhatsApp.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar o perfil.'));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await put('/whatsapp/profile/picture', fd, { headers: { 'Content-Type': undefined } });
      toast.success('Foto de perfil atualizada.');
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível enviar a foto.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePicture = async () => {
    setUploading(true);
    try {
      await remove('/whatsapp/profile/picture');
      toast.success('Foto removida.');
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível remover a foto.'));
    } finally {
      setUploading(false);
    }
  };

  const picture = profile?.picture || null;
  const initial = (form.name || profile?.name || 'W').trim().charAt(0).toUpperCase();

  return (
    <TgCard hover={false} sx={{ p: { xs: 2, sm: 3 }, height: '100%', opacity: enabled ? 1 : 0.6 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.25 }}>Perfil do WhatsApp</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2.5 }}>
        {enabled ? 'É o que seus contatos veem no WhatsApp.' : 'Disponível depois de conectar.'}
      </Typography>

      <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mb: 2.5 }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box
            sx={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 34,
              background: picture ? 'transparent' : `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
              border: '3px solid',
              borderColor: 'background.paper',
              boxShadow: '0 6px 18px rgba(15,23,42,.14)'
            }}
          >
            {picture ? (
              <img src={picture} alt="Foto de perfil" width={92} height={92} style={{ objectFit: 'cover', display: 'block' }} />
            ) : (
              initial
            )}
          </Box>
          {canEdit && enabled ? (
            <Tooltip title="Trocar foto">
              <IconButton
                size="small"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                sx={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'background.paper' }
                }}
              >
                {uploading ? <CircularProgress size={16} /> : <IconCamera size={16} />}
              </IconButton>
            </Tooltip>
          ) : null}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{form.name || profile?.name || (enabled ? 'Sem nome' : '—')}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {fmtPhone(profile?.phone) || ''}
          </Typography>
          {picture && canEdit && enabled ? (
            <Button
              size="small"
              color="error"
              startIcon={<IconTrash size={14} />}
              onClick={removePicture}
              disabled={uploading}
              sx={{ mt: 0.5, fontWeight: 600, px: 0.5 }}
            >
              Remover foto
            </Button>
          ) : null}
        </Box>
      </Stack>

      <Stack spacing={1.75}>
        <TextField
          label="Nome de exibição"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, 25) }))}
          size="small"
          fullWidth
          disabled={!enabled || !canEdit || loading}
          helperText={`${form.name.length}/25`}
        />
        <TextField
          label="Recado (sobre)"
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value.slice(0, 139) }))}
          size="small"
          fullWidth
          multiline
          minRows={2}
          disabled={!enabled || !canEdit || loading}
          helperText={`${form.status.length}/139`}
        />
        <Button
          variant="contained"
          disableElevation
          onClick={save}
          disabled={!enabled || !canEdit || !dirty || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <IconCheck size={18} />}
          sx={{ alignSelf: 'flex-start', fontWeight: 700, borderRadius: 2 }}
        >
          Salvar perfil
        </Button>
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- aquecimento
function WarmupCard({ session, canEdit, onToggle }) {
  const day = session?.warmup_day || 0;
  const on = session?.pacing_enabled !== false;
  return (
    <TgCard hover={false} sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Aquecimento e limites de envio</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Imita o uso humano nos primeiros dias para reduzir o risco de restrição.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: on ? 'success.main' : 'text.secondary' }}>
            {on ? 'Ligado' : 'Desligado'}
          </Typography>
          <Switch checked={on} onChange={(e) => onToggle(e.target.checked)} disabled={!canEdit} color="success" />
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(7, 1fr)' }, gap: 1, mb: 1.5 }}>
        {WARMUP.map((limit, i) => {
          const d = i + 1;
          const current = day === d;
          const past = day > d;
          return (
            <Box
              key={d}
              sx={{
                p: 1,
                borderRadius: 2,
                textAlign: 'center',
                border: '1px solid',
                borderColor: current ? WA_GREEN : 'divider',
                bgcolor: current ? `${WA_GREEN}14` : past ? 'action.hover' : 'transparent',
                opacity: on ? 1 : 0.45
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Dia {d}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>{limit}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {COLD[i]} frios
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        Mensagens por dia (e, abaixo, quantas podem ir para contatos que nunca falaram com você). Do 8º dia em diante o número é considerado
        aquecido. {on ? 'Passou do limite, o envio espera o dia seguinte.' : 'Desligado: você assume o risco de restrição pelo WhatsApp.'}
      </Typography>
    </TgCard>
  );
}

// ---------------------------------------------------------------- atividade
const EVENT_LABEL = {
  'session.status': 'Status',
  'session.qr': 'QR Code gerado',
  'session.authenticated': 'Autenticado',
  'session.disconnected': 'Desconectado',
  'session.reconnect_loop': 'Reconectando em loop',
  'session.restriction': 'Restrição do WhatsApp',
  'local.logout': 'Desconectado pelo usuário'
};
// Agrupa eventos iguais consecutivos (o QR renova a cada ~40 s e encheria a lista).
function groupEvents(events) {
  const out = [];
  for (const ev of events || []) {
    const st = ev?.payload?.status;
    const label = ev.event === 'session.status' && st ? `Status → ${STATUS_UI[st]?.label || st}` : EVENT_LABEL[ev.event] || ev.event;
    const last = out[out.length - 1];
    if (last && last.label === label) last.count += 1;
    else out.push({ id: ev.id, created_at: ev.created_at, label, count: 1 });
  }
  return out;
}
function ActivityCard({ events }) {
  return (
    <TgCard hover={false} sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <IconHistory size={18} />
        <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Atividade da sessão</Typography>
      </Stack>
      {!events?.length ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nenhum evento ainda.
        </Typography>
      ) : (
        <Stack spacing={0.75} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
          {groupEvents(events).map((ev) => (
            <Stack
              key={ev.id}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ py: 0.5, borderBottom: '1px dashed', borderColor: 'divider' }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 118, fontVariantNumeric: 'tabular-nums' }}>
                {fmtDate(ev.created_at)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {ev.label}
              </Typography>
              {ev.count > 1 ? <Chip size="small" label={`×${ev.count}`} sx={{ height: 20, fontWeight: 700 }} /> : null}
            </Stack>
          ))}
        </Stack>
      )}
    </TgCard>
  );
}

// ============================================================================
export default function WhatsAppSettings() {
  const { user } = useAuth();
  const role = user?.user?.role;
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  const [session, setSession] = useState(null);
  const [qr, setQr] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'logout'|'pacing'}
  const [pairing, setPairing] = useState({ open: false, phone: '', code: '', loading: false });
  const [test, setTest] = useState({ open: false, text: '', loading: false });
  const [bootstrapping, setBootstrapping] = useState(false);
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const s = await get('/whatsapp/session');
      if (seq !== seqRef.current) return;
      setSession(s);
      if (s?.status === 'qr_ready') {
        const q = await get('/whatsapp/session/qr').catch(() => null);
        if (seq === seqRef.current) setQr(q?.qr || null);
      } else setQr(null);
    } catch (e) {
      if (seq === seqRef.current) setSession((prev) => prev || { status: 'none', gateway_error: errMsg(e, 'Falha ao carregar.') });
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await get('/whatsapp/session/events', { params: { limit: 40 } }));
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    load();
    loadEvents();
  }, [load, loadEvents]);

  // polling adaptativo
  const st = session?.status || 'none';
  useEffect(() => {
    if (document.visibilityState === 'hidden') return undefined;
    const fast = ['created', 'initializing', 'qr_ready', 'authenticating'].includes(st);
    const ms = fast ? 3000 : st === 'ready' ? 15000 : 10000;
    const id = window.setInterval(() => {
      load();
      if (!fast) loadEvents();
    }, ms);
    return () => window.clearInterval(id);
  }, [st, load, loadEvents]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) toast.success(okMsg);
      if (r && typeof r === 'object' && 'status' in r) setSession(r);
      await load();
      await loadEvents();
    } catch (e) {
      toast.error(errMsg(e, 'Falha na operação.'));
    } finally {
      setBusy(false);
    }
  };

  const onConnect = () => run(() => post('/whatsapp/session/start'));

  // Importa conversas/contatos/histórico do celular (roda sozinho ao conectar; aqui é o "de novo")
  const bootstrap = async () => {
    setBootstrapping(true);
    try {
      const r = await post('/whatsapp/session/bootstrap', {}, { timeout: 180000 });
      if (r?.running) toast('Uma importação já está em andamento. Aguarde alguns instantes.', { icon: '⏳' });
      else if (r?.skipped) toast('Importação ignorada: nada novo para trazer agora.', { icon: 'ℹ️' });
      else {
        const n = (v) => (Number(v) || 0).toLocaleString('pt-BR');
        const chats = Number(r?.chats?.synced) || 0;
        const contacts = (Number(r?.contacts?.imported) || 0) + (Number(r?.contacts?.updated) || 0);
        const msgs = Number(r?.history?.imported) || 0;
        toast.success(
          `${n(chats)} conversa${chats === 1 ? '' : 's'}, ${n(contacts)} contato${contacts === 1 ? '' : 's'}, ${n(msgs)} mensage${msgs === 1 ? 'm' : 'ns'} importad${msgs === 1 ? 'a' : 'as'}.`,
          { duration: 6000 }
        );
      }
      await loadEvents();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível importar do celular.'));
    } finally {
      setBootstrapping(false);
    }
  };
  const onReconnect = () => run(() => post('/whatsapp/session/start'), 'Reconectando…');
  const onLogout = () => setConfirm({ kind: 'logout' });
  const doLogout = () => {
    setConfirm(null);
    run(() => post('/whatsapp/session/logout'), 'WhatsApp desconectado.');
  };
  const onToggle = (enabled) => {
    if (!enabled) setConfirm({ kind: 'pacing' });
    else run(() => put('/whatsapp/session/pacing', { enabled: true }), 'Aquecimento ligado.');
  };
  const doDisablePacing = () => {
    setConfirm(null);
    run(() => put('/whatsapp/session/pacing', { enabled: false }), 'Limitador desligado. Responsabilidade assumida.');
  };

  const requestPairing = async () => {
    const phone = pairing.phone.replace(/\D/g, '');
    if (phone.length < 10) return toast.error('Informe o número com DDI e DDD, ex.: 5511999999999.');
    setPairing((p) => ({ ...p, loading: true }));
    try {
      const r = await post('/whatsapp/session/pairing-code', { phone });
      setPairing((p) => ({ ...p, code: r?.code || '', loading: false }));
      if (!r?.code) toast.error('O gateway não devolveu o código. Tente pelo QR.');
    } catch (e) {
      setPairing((p) => ({ ...p, loading: false }));
      toast.error(errMsg(e, 'Não foi possível gerar o código.'));
    }
  };

  const sendTest = async () => {
    setTest((t) => ({ ...t, loading: true }));
    try {
      await post('/whatsapp/session/test', { text: test.text || undefined });
      toast.success('Mensagem de teste enviada para o seu número.');
      setTest({ open: false, text: '', loading: false });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível enviar.'));
      setTest((t) => ({ ...t, loading: false }));
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(pairing.code);
      toast.success('Código copiado.');
    } catch {
      /* ignore */
    }
  };

  const connected = st === 'ready';
  const headerAction = useMemo(
    () => (
      <Tooltip title="Atualizar">
        <IconButton
          onClick={() => {
            load();
            loadEvents();
          }}
          disabled={busy}
        >
          <IconRefresh size={20} />
        </IconButton>
      </Tooltip>
    ),
    [load, loadEvents, busy]
  );

  return (
    <Box>
      <WaPageHeader
        icon={IconBrandWhatsapp}
        title="WhatsApp"
        subtitle="Conecte o número da organização e configure o perfil."
        action={headerAction}
      />

      {!session ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress sx={{ color: WA_GREEN }} />
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' } }}>
            <ConnectionCard
              session={session}
              qr={qr}
              busy={busy}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onLogout={onLogout}
              onTest={() => setTest({ open: true, text: '', loading: false })}
              onPairing={() => setPairing({ open: true, phone: '', code: '', loading: false })}
              onBootstrap={bootstrap}
              bootstrapping={bootstrapping}
            />
            <ProfileCard enabled={connected} canEdit={canEdit} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' } }}>
            <WarmupCard session={session} canEdit={canEdit} onToggle={onToggle} />
            <ActivityCard events={events} />
          </Box>
        </Stack>
      )}

      {/* pareamento por número */}
      <TgModal
        open={pairing.open}
        onClose={() => setPairing({ open: false, phone: '', code: '', loading: false })}
        title="Conectar pelo número"
        subtitle="Alternativa ao QR: o WhatsApp mostra um campo para digitar o código."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setPairing({ open: false, phone: '', code: '', loading: false })}>Fechar</Button>
            {!pairing.code ? (
              <Button
                variant="contained"
                disableElevation
                onClick={requestPairing}
                disabled={pairing.loading}
                startIcon={pairing.loading ? <CircularProgress size={16} color="inherit" /> : <IconQrcode size={18} />}
                sx={{ fontWeight: 700 }}
              >
                Gerar código
              </Button>
            ) : null}
          </Stack>
        }
      >
        <Stack spacing={2}>
          <Alert severity="warning" sx={{ py: 0.5 }}>
            Só use com um número que <strong>ainda não está conectado</strong> em outra sessão: o WhatsApp pode derrubar a conexão anterior.
          </Alert>
          <TextField
            label="Número com DDI e DDD"
            placeholder="5511999999999"
            value={pairing.phone}
            onChange={(e) => setPairing((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
            size="small"
            fullWidth
            disabled={Boolean(pairing.code)}
            inputProps={{ inputMode: 'numeric' }}
          />
          {pairing.code ? (
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                borderRadius: 2.5,
                bgcolor: 'background.default',
                border: '1px dashed',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Digite este código no celular: WhatsApp → Dispositivos conectados → Conectar dispositivo → Conectar com número
              </Typography>
              <Typography
                sx={{ fontWeight: 800, fontSize: 30, letterSpacing: '0.18em', fontFamily: 'ui-monospace, Menlo, monospace', my: 1 }}
              >
                {pairing.code}
              </Typography>
              <Button size="small" startIcon={<IconCopy size={16} />} onClick={copyCode} sx={{ fontWeight: 700 }}>
                Copiar
              </Button>
            </Box>
          ) : null}
        </Stack>
      </TgModal>

      {/* mensagem de teste */}
      <TgModal
        open={test.open}
        onClose={() => setTest({ open: false, text: '', loading: false })}
        title="Enviar mensagem de teste"
        subtitle={`Vai para ${fmtPhone(session?.phone) || 'o número conectado'}.`}
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setTest({ open: false, text: '', loading: false })}>Cancelar</Button>
            <Button
              variant="contained"
              disableElevation
              onClick={sendTest}
              disabled={test.loading}
              startIcon={test.loading ? <CircularProgress size={16} color="inherit" /> : <IconSend size={18} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Enviar
            </Button>
          </Stack>
        }
      >
        <TextField
          label="Texto (opcional)"
          placeholder="Deixe vazio para a mensagem padrão do Pub Mail"
          value={test.text}
          onChange={(e) => setTest((t) => ({ ...t, text: e.target.value.slice(0, 500) }))}
          size="small"
          fullWidth
          multiline
          minRows={3}
        />
      </TgModal>

      <TgConfirmDialog
        open={confirm?.kind === 'logout'}
        onClose={() => setConfirm(null)}
        onConfirm={doLogout}
        danger
        loading={busy}
        title="Desconectar o WhatsApp?"
        message="A sessão será encerrada e removida do gateway. Contatos salvos, broadcasts e agendamentos continuam na organização; para voltar, basta conectar de novo (o mesmo número ou outro)."
        confirmLabel="Desconectar"
      />
      <TgConfirmDialog
        open={confirm?.kind === 'pacing'}
        onClose={() => setConfirm(null)}
        onConfirm={doDisablePacing}
        danger
        loading={busy}
        title="Desligar o limitador de envio?"
        message="Sem o aquecimento e os limites diários, o WhatsApp pode restringir ou banir este número, e o Pub Mail não tem como reverter. Ao continuar, você declara que assume essa responsabilidade."
        confirmLabel="Assumo o risco, desligar"
      />
    </Box>
  );
}
