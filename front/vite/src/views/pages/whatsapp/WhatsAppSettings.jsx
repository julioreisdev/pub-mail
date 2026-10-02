import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
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
  IconCopy,
  IconEngine,
  IconArrowsExchange,
  IconCircleCheck,
  IconRefreshDot,
  IconDatabase,
  IconUserCircle
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgStatusPill, TgModal, TgConfirmDialog } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';
import { useRealtimeEvent } from 'realtime/useRealtime';
import AttendanceCard from './settings/AttendanceCard';
import TagsCard from './settings/TagsCard';
import QuickRepliesCard from './settings/QuickRepliesCard';
import DiagnosticsCard from './settings/DiagnosticsCard';
import { SettingsCardHeader, cardSx } from './settings/settingsKit';

// ============================================================================
// WhatsApp → Configurações: sessão da organização (1 por org) via OpenWA.
// Conectar (QR / código), status ao vivo, perfil, teste, motor, sincronização,
// atendimento, etiquetas, respostas rápidas, diagnóstico (cards em ./settings/),
// aquecimento, atividade. Estado ao vivo pelo WebSocket (wa:session / wa:sync);
// polling de reserva: 3 s enquanto conecta/aguarda QR; 15 s quando conectado.
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
function ConnectionCard({ session, qr, busy, onConnect, onLogout, onTest, onPairing, onReconnect }) {
  const st = session?.status || 'none';
  const ui = STATUS_UI[st] || STATUS_UI.none;
  const restricted = Boolean(session?.restricted_at);
  const connecting = ['created', 'initializing', 'authenticating'].includes(st);

  return (
    <TgCard hover={false} sx={cardSx}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2, columnGap: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            flexShrink: 0,
            background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
            animation: st === 'ready' ? `${pulse} 2.4s ease-out infinite` : 'none'
          }}
        >
          <IconBrandWhatsapp size={21} stroke={1.9} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>Conexão</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Um número por organização
          </Typography>
        </Box>
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
            A mensagem de teste é enviada para o próprio número conectado. Para trazer conversas e contatos de novo, use Sincronizar agora,
            logo abaixo.
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
// ----------------------------------------------------------------------------
// Motor de conexão (whatsapp-web.js ↔ direto/Baileys)
// ----------------------------------------------------------------------------
const ENGINE_UI = {
  baileys: {
    label: 'Direto (recomendado)',
    pill: 'active',
    points: [
      'Recebe fotos, áudios, vídeos e documentos',
      'Sincroniza conversas e mensagens recentes ao conectar',
      'Leve: conecta e reconecta mais rápido'
    ]
  },
  wwjs: {
    label: 'WhatsApp Web (antigo)',
    pill: 'flood',
    points: ['Não baixa as mídias que os clientes enviam', 'Mais pesado no servidor']
  }
};

function EngineCard({ session, canEdit, busy, onMigrate }) {
  const engine = session?.engine || null;
  const def = session?.default_engine || 'baileys';
  const ui = ENGINE_UI[engine || def] || ENGINE_UI.baileys;
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader icon={IconEngine} title="Motor de conexão" subtitle="Como o Pub Mail conversa com o WhatsApp" />
      <Box sx={{ mb: 1.5 }}>
        {engine ? <TgStatusPill status={ui.pill} label={`Em uso: ${ui.label}`} /> : <Chip size="small" label="Definido ao conectar" />}
      </Box>

      {engine === 'wwjs' && session?.engine_upgrade ? (
        <Alert severity="warning" icon={<IconAlertTriangle size={20} />} sx={{ mb: 1.5 }}>
          Este motor <strong>não consegue baixar as mídias</strong> que os seus clientes enviam (limitação do WhatsApp Web desde julho de
          2026). Migre para o motor direto: você escaneia um QR Code novo com o mesmo celular e nada do Pub Mail se perde.
        </Alert>
      ) : null}

      <Stack spacing={0.75} sx={{ mb: engine === 'wwjs' ? 2 : 0 }}>
        {(ENGINE_UI[engine || def] || ENGINE_UI.baileys).points.map((t) => (
          <Stack key={t} direction="row" spacing={1} alignItems="center">
            {engine === 'wwjs' ? (
              <IconAlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
            ) : (
              <IconCircleCheck size={16} style={{ color: WA_GREEN, flexShrink: 0 }} />
            )}
            <Typography variant="body2">{t}</Typography>
          </Stack>
        ))}
        {!engine ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', pt: 0.5 }}>
            Novas conexões usam o motor direto.
          </Typography>
        ) : null}
      </Stack>

      {engine && session?.engine_upgrade ? (
        <Tooltip title={canEdit ? '' : 'Só dono ou admin da organização'}>
          <span>
            <Button
              variant="contained"
              disableElevation
              onClick={onMigrate}
              disabled={!canEdit || busy}
              startIcon={<IconArrowsExchange size={18} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Migrar para o motor direto
            </Button>
          </span>
        </Tooltip>
      ) : null}
    </TgCard>
  );
}

// ----------------------------------------------------------------------------
// Sincronização com o celular (progresso ao vivo)
// ----------------------------------------------------------------------------
const SYNC_STEPS = [
  { id: 'chats', label: 'Conversas' },
  { id: 'contacts', label: 'Contatos' },
  { id: 'merge', label: 'Unificação' },
  { id: 'history', label: 'Mensagens' }
];
const fmtAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function SyncCard({ session, connected, onSync }) {
  const sync = session?.sync || null;
  const running = Boolean(sync?.running);
  const phaseIdx = running ? SYNC_STEPS.findIndex((x) => x.id === sync?.phase) : -1;
  const n = (v) => (Number(v) || 0).toLocaleString('pt-BR');
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconRefreshDot}
        title="Sincronização com o celular"
        subtitle="Conversas, contatos e mensagens recentes"
        stackAction
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={onSync}
            disabled={!connected || running}
            startIcon={running ? <CircularProgress size={14} color="inherit" /> : <IconDownload size={16} />}
            sx={{ fontWeight: 700 }}
          >
            {running ? 'Sincronizando…' : 'Sincronizar agora'}
          </Button>
        }
      />

      {running ? <LinearProgress sx={{ mb: 1.5, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: WA_GREEN } }} /> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0,1fr))', lg: '1fr 1fr', xl: 'repeat(4, minmax(0,1fr))' },
          gap: 1,
          mb: 1.5
        }}
      >
        {SYNC_STEPS.map((step, i) => {
          const done = sync && (sync.phase === 'done' || (running && i < phaseIdx));
          const now = running && i === phaseIdx;
          return (
            <Stack
              key={step.id}
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                p: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: now ? WA_GREEN : 'divider',
                bgcolor: now ? 'action.hover' : 'transparent'
              }}
            >
              {now ? (
                <CircularProgress size={14} thickness={5} sx={{ color: WA_GREEN, flexShrink: 0 }} />
              ) : done ? (
                <IconCircleCheck size={16} style={{ color: WA_GREEN, flexShrink: 0 }} />
              ) : (
                <Box sx={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid', borderColor: 'divider', flexShrink: 0 }} />
              )}
              <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                {step.label}
              </Typography>
            </Stack>
          );
        })}
      </Box>

      {sync?.phase === 'error' ? (
        <Alert severity="error" sx={{ py: 0.25 }}>
          A última sincronização falhou: {sync.error || 'erro desconhecido'}
        </Alert>
      ) : sync?.finished_at || sync?.chats != null ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {n(sync.chats)} conversas · {n(sync.contacts)} contatos · {n(sync.messages)} mensagens importadas
          {sync.finished_at ? ` · ${fmtAgo(sync.finished_at)}` : ''}
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          A sincronização roda sozinha ao conectar o número.
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        Mensagens de antes da conexão chegam sem o arquivo de mídia: o WhatsApp não reenvia arquivos antigos.
      </Typography>
    </TgCard>
  );
}

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
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconUserCircle}
        title="Perfil do WhatsApp"
        subtitle={enabled ? 'É o que seus contatos veem no WhatsApp.' : 'Disponível depois de conectar.'}
      />
      <Box sx={{ opacity: enabled ? 1 : 0.6 }}>
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
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
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
          {enabled && profile && profile.status_known === false ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: -0.75 }}>
              O WhatsApp não informa o recado atual para este tipo de conexão. Escreva e salve para trocar; a partir daí ele aparece aqui.
            </Typography>
          ) : null}
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
      </Box>
    </TgCard>
  );
}

// ---------------------------------------------------------------- aquecimento
function WarmupCard({ session, canEdit, onToggle }) {
  const day = session?.warmup_day || 0;
  const on = session?.pacing_enabled !== false;
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconFlame}
        title="Aquecimento e limites de envio"
        subtitle="Imita o uso humano nos primeiros dias para reduzir o risco de restrição."
        action={
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: on ? 'success.main' : 'text.secondary' }}>
              {on ? 'Ligado' : 'Desligado'}
            </Typography>
            <Switch checked={on} onChange={(e) => onToggle(e.target.checked)} disabled={!canEdit} color="success" />
          </Stack>
        }
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(7, minmax(0, 1fr))' },
          gap: 0.75,
          mb: 1.5
        }}
      >
        {WARMUP.map((limit, i) => {
          const d = i + 1;
          const current = day === d;
          const past = day > d;
          return (
            <Box
              key={d}
              sx={{
                py: 1,
                px: 0.5,
                minWidth: 0,
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
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: 11, whiteSpace: 'nowrap' }}>
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
  'local.logout': 'Desconectado pelo usuário',
  'local.purge': 'Dados do número apagados',
  'local.switch_engine': 'Motor de conexão trocado'
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
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader icon={IconHistory} title="Atividade da sessão" subtitle="Conexões, quedas e ações feitas nesta tela" />
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
// ---------------------------------------------------------------- dados do número
const fmtBytes = (b) => {
  const n = Number(b) || 0;
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  return `${(n / 1024 / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
};
const num = (v) => (Number(v) || 0).toLocaleString('pt-BR');

// O que a limpeza apaga, na ordem em que aparece (só as linhas com algo guardado).
const PURGE_ROWS = [
  { key: 'chats', label: 'Conversas' },
  { key: 'messages', label: 'Mensagens' },
  { key: 'media', label: 'Arquivos de mídia' },
  { key: 'contacts', label: 'Contatos' },
  { key: 'statuses', label: 'Status' },
  { key: 'schedules', label: 'Agendamentos' },
  { key: 'broadcast_runs', label: 'Histórico de broadcasts' },
  { key: 'service_events', label: 'Histórico de atendimento' },
  { key: 'filters', label: 'Filtros de conversa' }
];
function purgeValues(sum, keepContacts) {
  if (!sum) return {};
  return {
    chats: num(sum.chats),
    messages: num(sum.messages),
    media: sum.media_files ? `${num(sum.media_files)} · ${fmtBytes(sum.media_bytes)}` : '0',
    contacts: num(Math.max(0, (sum.contacts || 0) - (keepContacts ? sum.contacts_keepable || 0 : 0))),
    statuses: num((sum.contact_statuses || 0) + (sum.statuses || 0)),
    schedules: num(sum.schedules),
    broadcast_runs: num(sum.broadcast_runs),
    service_events: num(sum.service_events),
    filters: num(sum.filters)
  };
}

const DATA_TILES = [
  { label: 'Conversas', get: (s) => num(s.chats) },
  { label: 'Mensagens', get: (s) => num(s.messages) },
  { label: 'Contatos', get: (s) => num(s.contacts) },
  { label: 'Mídias', get: (s) => (s.media_files ? fmtBytes(s.media_bytes) : '0') },
  { label: 'Status', get: (s) => num((s.contact_statuses || 0) + (s.statuses || 0)) },
  { label: 'Agendamentos', get: (s) => num(s.schedules) }
];

function DataCard({ summary, canEdit, busy, onPurge }) {
  return (
    <TgCard hover={false} sx={{ ...cardSx, gridColumn: '1 / -1' }}>
      <SettingsCardHeader
        icon={IconDatabase}
        title="Dados do número"
        subtitle="Tudo o que veio do WhatsApp fica guardado no Pub Mail até você apagar."
        stackAction
        action={
          <Tooltip title={canEdit ? '' : 'Só dono ou admin da organização'}>
            <span>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={onPurge}
                disabled={!canEdit || busy || !summary || summary.empty}
                startIcon={<IconTrash size={16} />}
                sx={{ fontWeight: 700 }}
              >
                Limpar todos os dados
              </Button>
            </span>
          </Tooltip>
        }
      />
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', md: 'repeat(6, minmax(0,1fr))' }
        }}
      >
        {DATA_TILES.map((t) => (
          <Box key={t.label} sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
              {t.label}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }} noWrap>
              {summary ? t.get(summary) : '…'}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
        Limpar apaga isso de vez e desconecta o número, se ele ainda estiver conectado. Etiquetas, respostas rápidas, o fluxo do bot e as
        campanhas de broadcast continuam.
      </Typography>
    </TgCard>
  );
}

// Desconectar (escolhendo manter ou apagar os dados) ou só limpar os dados.
function ChoiceCard({ selected, danger, icon: Icon, title, text, onClick }) {
  return (
    <ButtonBase
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      sx={(t) => ({
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 1.25,
        width: '100%',
        textAlign: 'left',
        p: 1.5,
        borderRadius: 2.5,
        border: '1.5px solid',
        borderColor: selected ? (danger ? 'error.main' : 'primary.main') : 'divider',
        bgcolor: selected ? `rgba(${(danger ? t.vars.palette.error : t.vars.palette.primary).mainChannel} / 0.06)` : 'transparent',
        transition: 'border-color .15s, background-color .15s'
      })}
    >
      <Box
        sx={{
          width: 18,
          height: 18,
          mt: 0.25,
          borderRadius: '50%',
          border: '2px solid',
          borderColor: selected ? (danger ? 'error.main' : 'primary.main') : 'divider',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0
        }}
      >
        {selected ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: danger ? 'error.main' : 'primary.main' }} /> : null}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Icon size={17} />
          <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {text}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function DisconnectDialog({ mode, session, summary, onClose, onDone }) {
  const open = Boolean(mode);
  const [choice, setChoice] = useState('keep');
  const [keepContacts, setKeepContacts] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoice(mode === 'purge' ? 'purge' : 'keep');
    setKeepContacts(false);
    setConfirmText('');
  }, [open, mode]);

  const purging = choice === 'purge';
  const hasSession = Boolean(session?.openwa_session_id || summary?.has_session);
  const values = purgeValues(summary, keepContacts);
  const rows = PURGE_ROWS.filter((r) => values[r.key] && values[r.key] !== '0');
  const confirmed = confirmText.trim().toUpperCase() === 'APAGAR';

  const submit = async () => {
    setLoading(true);
    try {
      if (purging) {
        const r = await post('/whatsapp/session/purge', { confirm: confirmText.trim(), keep_contacts: keepContacts });
        const d = r?.deleted || {};
        toast.success(`Dados apagados: ${num(d.chats)} conversas, ${num(d.messages)} mensagens e ${num(d.files)} arquivos.`);
      } else {
        await post('/whatsapp/session/logout');
        toast.success('WhatsApp desconectado.');
      }
      onDone();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível concluir.'));
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'purge' ? 'Limpar todos os dados do WhatsApp?' : 'Desconectar o WhatsApp?';
  const subtitle =
    mode === 'purge'
      ? hasSession
        ? 'O número também será desconectado.'
        : 'Apaga o que ficou guardado do número que estava conectado.'
      : 'Escolha o que acontece com o que veio deste número.';
  const actionLabel = purging ? (hasSession ? 'Desconectar e apagar' : 'Apagar tudo') : 'Desconectar';

  return (
    <TgModal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      subtitle={subtitle}
      maxWidth="sm"
      footer={
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={submit}
            disabled={loading || (purging && !confirmed)}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : purging ? (
                <IconTrash size={18} />
              ) : (
                <IconPlugConnectedX size={18} />
              )
            }
            sx={{ fontWeight: 700 }}
          >
            {actionLabel}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        {mode === 'logout' ? (
          <Stack spacing={1} role="radiogroup">
            <ChoiceCard
              selected={!purging}
              icon={IconPlugConnectedX}
              title="Só desconectar"
              text="Conversas, contatos e histórico continuam no Pub Mail. Bom para reconectar o mesmo número depois."
              onClick={() => setChoice('keep')}
            />
            <ChoiceCard
              selected={purging}
              danger
              icon={IconTrash}
              title="Desconectar e apagar os dados"
              text="Remove tudo o que veio deste número. Não dá para desfazer."
              onClick={() => setChoice('purge')}
            />
          </Stack>
        ) : null}

        {purging ? (
          <>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, lineHeight: 1.6 }}>
                Será apagado
              </Typography>
              {!summary ? (
                <Stack alignItems="center" sx={{ py: 2 }}>
                  <CircularProgress size={22} />
                </Stack>
              ) : rows.length ? (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  {rows.map((r, i) => (
                    <Stack
                      key={r.key}
                      direction="row"
                      justifyContent="space-between"
                      sx={{ px: 1.5, py: 0.9, borderTop: i ? '1px solid' : 'none', borderColor: 'divider' }}
                    >
                      <Typography variant="body2">{r.label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {values[r.key]}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Não há dados guardados deste número.
                </Typography>
              )}
            </Box>

            {summary?.contacts_keepable ? (
              <FormControlLabel
                control={<Checkbox checked={keepContacts} onChange={(e) => setKeepContacts(e.target.checked)} />}
                label={
                  <Typography variant="body2">
                    Manter os {num(summary.contacts_keepable)} contatos salvos, adicionados à mão ou importados
                  </Typography>
                }
              />
            ) : null}

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Continuam: etiquetas, respostas rápidas, o fluxo do bot, as campanhas de broadcast e as configurações de atendimento.
            </Typography>
            {summary?.bot_active || summary?.active_broadcasts ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                {summary.bot_active && summary.active_broadcasts
                  ? 'O bot e os broadcasts ativos serão desligados'
                  : summary.bot_active
                    ? 'O bot será desligado'
                    : 'Os broadcasts ativos serão desligados'}
                , para nada sair sozinho do próximo número. Ligue de novo quando ele estiver conectado.
              </Alert>
            ) : null}

            <TextField
              label="Digite APAGAR para confirmar"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.slice(0, 20))}
              size="small"
              fullWidth
              autoComplete="off"
              error={Boolean(confirmText) && !confirmed && confirmText.trim().length >= 6}
            />
          </>
        ) : null}
      </Stack>
    </TgModal>
  );
}

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
  const [syncDlg, setSyncDlg] = useState(null); // {chats, per_chat}
  const [dataDlg, setDataDlg] = useState(null); // 'logout' | 'purge'
  const [dataSummary, setDataSummary] = useState(null);
  // muda após "Limpar todos os dados" → recria os cards que buscam dados por conta própria
  // (diagnóstico e contagem de conversas por etiqueta) sem precisar recarregar a página
  const [dataVersion, setDataVersion] = useState(0);
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

  const loadSummary = useCallback(async () => {
    try {
      setDataSummary(await get('/whatsapp/session/data-summary'));
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    load();
    loadEvents();
    loadSummary();
  }, [load, loadEvents, loadSummary]);

  // tempo real: conexão mudou (QR novo, conectou, caiu…) e progresso da sincronização
  useRealtimeEvent('wa:session', (ev) => {
    load();
    loadEvents();
    loadSummary();
    if (ev?.event === 'local.purge') setDataVersion((v) => v + 1);
  });
  useRealtimeEvent('wa:sync', (sync) => {
    setSession((prev) => (prev ? { ...prev, sync } : prev));
    if (sync?.phase === 'done') loadSummary();
    if (sync?.phase === 'done' && !sync?.repass) toast.success('Sincronização concluída.', { id: 'wa-sync-done' });
  });

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

  // Sincroniza de novo com o celular (roda sozinha ao conectar; aqui é o "de novo"). Roda em
  // background no servidor; o progresso chega pelo WebSocket (wa:sync).
  const bootstrap = () => setSyncDlg({ chats: 60, per_chat: 40 });
  const doBootstrap = async () => {
    const opts = syncDlg || {};
    setSyncDlg(null);
    setBootstrapping(true);
    try {
      await post('/whatsapp/session/bootstrap', { chats: opts.chats, per_chat: opts.per_chat });
      setSession((prev) => (prev ? { ...prev, sync: { ...(prev.sync || {}), running: true, phase: 'chats' } } : prev));
      toast('Sincronização iniciada. Acompanhe o progresso no card.', { icon: '🔄' });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível sincronizar.'));
    } finally {
      setBootstrapping(false);
    }
  };
  const doMigrate = () => {
    setConfirm(null);
    run(
      () => post('/whatsapp/session/switch-engine', { engine: session?.default_engine || 'baileys' }),
      'Escaneie o QR Code novo com o mesmo celular.'
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const onReconnect = () => run(() => post('/whatsapp/session/start'), 'Reconectando…');
  const onLogout = () => {
    loadSummary();
    setDataDlg('logout');
  };
  const onPurge = () => {
    loadSummary();
    setDataDlg('purge');
  };
  const onDataDone = () => {
    setDataDlg(null);
    setDataVersion((v) => v + 1);
    load();
    loadEvents();
    loadSummary();
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
        subtitle="Conexão do número, perfil, atendimento, etiquetas e respostas rápidas."
        action={headerAction}
      />

      {!session ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress sx={{ color: WA_GREEN }} />
        </Stack>
      ) : (
        // Uma grade só, com duas colunas iguais: bordas e alturas alinhadas em todas as linhas.
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            alignItems: 'stretch',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }
          }}
        >
          <ConnectionCard
            session={session}
            qr={qr}
            busy={busy}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onLogout={onLogout}
            onTest={() => setTest({ open: true, text: '', loading: false })}
            onPairing={() => setPairing({ open: true, phone: '', code: '', loading: false })}
          />
          <ProfileCard enabled={connected} canEdit={canEdit} />
          <EngineCard session={session} canEdit={canEdit} busy={busy} onMigrate={() => setConfirm({ kind: 'migrate' })} />
          <SyncCard session={session} connected={connected} onSync={bootstrap} />
          <AttendanceCard canEdit={canEdit} />
          <TagsCard key={`tags-${dataVersion}`} canEdit={canEdit} />
          <QuickRepliesCard />
          <DiagnosticsCard
            key={`diag-${dataVersion}`}
            status={st}
            canEdit={canEdit}
            upgradeAvailable={Boolean(session?.engine_upgrade)}
            onMigrate={() => setConfirm({ kind: 'migrate' })}
          />
          <WarmupCard session={session} canEdit={canEdit} onToggle={onToggle} />
          <ActivityCard events={events} />
          <DataCard summary={dataSummary} canEdit={canEdit} busy={busy} onPurge={onPurge} />
        </Box>
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

      <DisconnectDialog mode={dataDlg} session={session} summary={dataSummary} onClose={() => setDataDlg(null)} onDone={onDataDone} />
      <TgConfirmDialog
        open={confirm?.kind === 'migrate'}
        onClose={() => setConfirm(null)}
        onConfirm={doMigrate}
        loading={busy}
        title="Migrar para o motor direto?"
        message="A conexão atual será encerrada e um QR Code novo aparece aqui. Escaneie com o mesmo celular (WhatsApp → Dispositivos conectados → Conectar dispositivo). Conversas, contatos, etiquetas, agendamentos e broadcasts continuam no Pub Mail. Depois, remova o aparelho antigo da lista de dispositivos do celular, se ele continuar aparecendo."
        confirmLabel="Migrar agora"
      />
      <TgModal
        open={Boolean(syncDlg)}
        onClose={() => setSyncDlg(null)}
        title="Sincronizar com o celular"
        subtitle="Traz conversas, contatos e as mensagens mais recentes."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setSyncDlg(null)}>Cancelar</Button>
            <Button
              variant="contained"
              disableElevation
              onClick={doBootstrap}
              disabled={bootstrapping}
              startIcon={<IconDownload size={18} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Sincronizar
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2}>
          <TextField
            select
            size="small"
            label="Conversas mais recentes"
            value={syncDlg?.chats || 60}
            onChange={(e) => setSyncDlg((d) => ({ ...d, chats: Number(e.target.value) }))}
          >
            {[30, 60, 120, 200].map((v) => (
              <MenuItem key={v} value={v}>
                {v} conversas
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Mensagens por conversa"
            value={syncDlg?.per_chat || 40}
            onChange={(e) => setSyncDlg((d) => ({ ...d, per_chat: Number(e.target.value) }))}
          >
            {[20, 40, 100].map((v) => (
              <MenuItem key={v} value={v}>
                até {v} mensagens
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Mensagens já importadas não se repetem. Quanto mais conversas, mais demora (roda em segundo plano).
          </Typography>
        </Stack>
      </TgModal>
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
