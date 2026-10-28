import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

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
  IconUserCircle,
  IconPlus,
  IconTag,
  IconRobot,
  IconDotsVertical,
  IconClock
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgStatusPill, TgModal, TgConfirmDialog, TgEmptyState } from 'views/pages/telegram/ui';
import {
  WaPageHeader,
  WaNumberDot,
  SESSION_STATUS_UI,
  fmtPhoneBR,
  sessionLabel,
  useWaSessions,
  activeRestriction,
  restrictionUntilLabel,
  restrictionRemainingLabel,
  useNowTick
} from './waKit';
import { useRealtimeEvent } from 'realtime/useRealtime';
import AttendanceCard from './settings/AttendanceCard';
import TagsCard from './settings/TagsCard';
import QuickRepliesCard from './settings/QuickRepliesCard';
import DiagnosticsCard from './settings/DiagnosticsCard';
import TemplatesCard from './settings/TemplatesCard';
import CustomFieldsCard from './settings/CustomFieldsCard';
import OutboxCard from './settings/OutboxCard';
import { SettingsCardHeader, cardSx } from './settings/settingsKit';

// ============================================================================
// WhatsApp → Configurações (MULTI-NÚMERO): uma aba por número + "Novo número".
// Dentro da aba: identificação (nome interno, cor, fluxo do bot), conexão (QR / código),
// perfil, motor, sincronização, aquecimento, diagnóstico, atividade, dados do número.
// Abaixo das abas, o que é da ORGANIZAÇÃO: atendimento, etiquetas, respostas rápidas, dados.
// Estado ao vivo pelo WebSocket (wa:session / wa:sessions / wa:sync); polling de reserva.
// ============================================================================

const WA_GREEN = '#25D366';
const WA_DARK = '#128C7E';
const pulse = keyframes`0%{box-shadow:0 0 0 0 rgba(37,211,102,.45)}70%{box-shadow:0 0 0 14px rgba(37,211,102,0)}100%{box-shadow:0 0 0 0 rgba(37,211,102,0)}`;
const STATUS_UI = SESSION_STATUS_UI;
const COLORS = ['#25D366', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#EF4444', '#6366F1', '#84CC16', '#F97316'];

const WARMUP = [20, 40, 80, 160, 320, 640, 1000];
const COLD = [5, 10, 20, 40, 60, 80, 100];

const fmtPhone = fmtPhoneBR;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const errMsg = (e, fb) => e?.response?.data?.message || e?.message || fb;
const api = (id, path = '') => `/whatsapp/sessions/${id}${path}`;

// ---------------------------------------------------------------- abas dos números
function NumberTab({ session, selected, onClick }) {
  const st = session?.status || 'none';
  const ui = STATUS_UI[st] || STATUS_UI.none;
  const color = session?.color || WA_GREEN;
  const now = useNowTick(30_000);
  const restrictedUntil = activeRestriction(session, now) ? restrictionUntilLabel(session, now) : '';
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 2.5,
        border: '1.5px solid',
        borderColor: selected ? color : 'divider',
        bgcolor: selected ? `${color}18` : 'background.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
        maxWidth: 260,
        flexShrink: 0,
        textAlign: 'left',
        transition: 'border-color .15s, background-color .15s'
      }}
    >
      <WaNumberDot session={session} size={11} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }} noWrap>
          {sessionLabel(session)}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: st === 'ready' ? 'success.main' : 'text.secondary', display: 'block', lineHeight: 1.2 }}
          noWrap
        >
          {restrictedUntil ? `Restrito até ${restrictedUntil}` : st === 'ready' && session?.phone ? fmtPhone(session.phone) : ui.label}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

// ---------------------------------------------------------------- identificação (nome interno, cor, bot)
function IdentityCard({ session, canEdit, flows, onSave, onRemove }) {
  const [label, setLabel] = useState(session?.label || '');
  const [color, setColor] = useState(session?.color || COLORS[0]);
  const [flow, setFlow] = useState(session?.bot_flow_id || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setLabel(session?.label || '');
    setColor(session?.color || COLORS[0]);
    setFlow(session?.bot_flow_id || '');
  }, [session?.id, session?.label, session?.color, session?.bot_flow_id]);
  const dirty =
    label !== (session?.label || '') || color !== (session?.color || COLORS[0]) || (flow || '') !== (session?.bot_flow_id || '');
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ label: label.trim(), color, bot_flow_id: flow || null });
    } finally {
      setSaving(false);
    }
  };
  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconTag}
        title="Identificação do número"
        subtitle="Como este número aparece no Pub Mail (chat, agendamentos, campanhas)."
        action={
          canEdit ? (
            <Tooltip title="Apagar este número e tudo que veio dele">
              <IconButton size="small" color="error" onClick={onRemove}>
                <IconTrash size={18} />
              </IconButton>
            </Tooltip>
          ) : null
        }
      />
      <Stack spacing={1.75}>
        <TextField
          label="Nome interno"
          placeholder="Ex.: Vendas, Suporte, Loja Centro"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 80))}
          size="small"
          fullWidth
          disabled={!canEdit}
          helperText="Só a sua equipe vê. O cliente continua vendo o nome do perfil do WhatsApp."
        />
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
            Cor de identificação
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {COLORS.map((c) => (
              <ButtonBase
                key={c}
                disabled={!canEdit}
                onClick={() => setColor(c)}
                aria-label={c}
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: c,
                  border: '2px solid',
                  borderColor: color === c ? 'text.primary' : 'transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}66` : 'none'
                }}
              />
            ))}
          </Stack>
        </Box>
        <TextField
          select
          size="small"
          label="Fluxo do bot neste número"
          value={flow}
          onChange={(e) => setFlow(e.target.value)}
          disabled={!canEdit}
          fullWidth
          helperText={flows?.length ? 'O mesmo fluxo pode ser usado por vários números.' : 'Crie um fluxo em WhatsApp → Fluxo do Bot.'}
          InputProps={{ startAdornment: <IconRobot size={16} style={{ marginRight: 8, opacity: 0.7 }} /> }}
        >
          <MenuItem value="">Sem bot neste número</MenuItem>
          {(flows || []).map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.name}
              {f.active ? '' : ' (desligado)'}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          disableElevation
          onClick={save}
          disabled={!canEdit || !dirty || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <IconCheck size={18} />}
          sx={{ alignSelf: 'flex-start', fontWeight: 700, borderRadius: 2 }}
        >
          Salvar
        </Button>
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- QR / conexão
function ConnectionCard({ session, qr, busy, canEdit, onConnect, onLogout, onTest, onPairing, onReconnect }) {
  const st = session?.status || 'none';
  const ui = STATUS_UI[st] || STATUS_UI.none;
  // restrição ATIVA (com vencimento vindo do WhatsApp): o aviso e a trava do QR somem sozinhos quando vence
  const now = useNowTick(30_000);
  const restriction = activeRestriction(session, now);
  const restricted = Boolean(restriction);
  const untilLabel = restrictionUntilLabel(session, now);
  const remainingLabel = restrictionRemainingLabel(session, now);
  const [showQrAnyway, setShowQrAnyway] = useState(false);
  useEffect(() => {
    if (!restricted) setShowQrAnyway(false);
  }, [restricted]);
  const connecting = ['created', 'initializing', 'authenticating'].includes(st);
  const color = session?.color || WA_GREEN;

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
            background: `linear-gradient(135deg, ${color}, ${WA_DARK})`,
            animation: st === 'ready' ? `${pulse} 2.4s ease-out infinite` : 'none'
          }}
        >
          <IconBrandWhatsapp size={21} stroke={1.9} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>Conexão</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {sessionLabel(session)}
          </Typography>
        </Box>
        {restricted ? <TgStatusPill status="banned" label={untilLabel ? `Restrito até ${untilLabel}` : 'Restrito pelo WhatsApp'} /> : <TgStatusPill status={ui.pill} label={ui.label} />}
      </Stack>

      {session?.gateway_error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {session.gateway_error}
        </Alert>
      ) : null}
      {restricted ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            O WhatsApp restringiu este número{untilLabel ? ` até ${untilLabel}` : ''}
            {remainingLabel ? ` (faltam ${remainingLabel})` : ''}.
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {restriction?.kind === 'reachout_timelock'
              ? 'Motivo: muitas mensagens para quem não tem este número salvo. '
              : ''}
            {st === 'ready'
              ? 'Não dispare broadcasts nem mande para desconhecidos até esse horário — cada envio renova a restrição e pode derrubar a conexão.'
              : `Escaneie o QR Code só depois desse horário: conectar antes não tira a restrição, e qualquer envio durante ela a renova (foi o que aconteceu em 28/10).`}
            {' '}Este aviso some sozinho quando o prazo passar.
          </Typography>
        </Alert>
      ) : null}

      {st === 'none' && (
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            Conecte este número para usar chat, status, contatos, agendamentos e campanhas a partir do Pub Mail.
          </Typography>
          <Alert severity="info" icon={<IconAlertTriangle size={20} />}>
            Use um <strong>número dedicado</strong>, não o seu pessoal. O WhatsApp pode restringir números que automatizam mensagens, e
            nesse caso o Pub Mail não tem como reverter.
          </Alert>
          <Tooltip title={canEdit ? '' : 'Só dono ou admin da organização'}>
            <span>
              <Button
                size="large"
                variant="contained"
                disableElevation
                disabled={busy || !canEdit || session?.configured === false}
                onClick={onConnect}
                startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <IconPlugConnected size={20} />}
                sx={{ fontWeight: 700, borderRadius: 2.5, px: 3, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
              >
                Conectar WhatsApp
              </Button>
            </span>
          </Tooltip>
          {session?.configured === false ? <Alert severity="error">Gateway WhatsApp não configurado no servidor.</Alert> : null}
        </Stack>
      )}

      {connecting && (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
          <CircularProgress size={34} sx={{ color: WA_GREEN }} />
          <Typography sx={{ fontWeight: 600 }}>{ui.label}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Isso leva alguns segundos. O QR Code aparece aqui.
          </Typography>
        </Stack>
      )}

      {st === 'qr_ready' && restricted && !showQrAnyway ? (
        <Stack spacing={1.5} alignItems="flex-start" sx={{ p: 2, borderRadius: 3, border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <IconClock size={22} />
            <Box>
              <Typography sx={{ fontWeight: 800 }}>QR Code guardado até {untilLabel || 'o fim da restrição'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {remainingLabel ? `Faltam ${remainingLabel}. ` : ''}Quando o prazo passar, o QR aparece aqui sozinho e você escaneia normalmente.
              </Typography>
            </Box>
          </Stack>
          <Button size="small" variant="text" color="inherit" onClick={() => setShowQrAnyway(true)} sx={{ color: 'text.secondary', textTransform: 'none' }}>
            Mostrar o QR mesmo assim (por minha conta)
          </Button>
        </Stack>
      ) : null}
      {st === 'qr_ready' && (!restricted || showQrAnyway) && (
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
                disabled={busy || !canEdit}
                sx={{ fontWeight: 700 }}
              >
                Conectar pelo número
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<IconRefresh size={16} />}
                onClick={onReconnect}
                disabled={busy || !canEdit}
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
                disabled={busy || !canEdit}
                sx={{ fontWeight: 600 }}
              >
                Cancelar
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}

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
                background: `linear-gradient(135deg, ${color}, ${WA_DARK})`,
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
          {/* celular: os botões crescem (lado a lado se couberem, senão um por linha) sem passar do card */}
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ '& > .MuiButton-root': { flex: { xs: '1 1 auto', sm: '0 0 auto' }, minWidth: 0 } }}
          >
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
              disabled={busy || !canEdit}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Desconectar / trocar número
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            A mensagem de teste é enviada para o próprio número conectado. Para trazer conversas e contatos de novo, use Sincronizar agora.
          </Typography>
        </Stack>
      )}

      {(st === 'disconnected' || st === 'failed' || st === 'action_required') && (
        <Stack spacing={2}>
          <Alert severity={st === 'action_required' ? 'warning' : 'error'}>
            {st === 'action_required'
              ? 'O WhatsApp pediu uma ação no celular (por exemplo, confirmar o dispositivo). Abra o aplicativo e depois clique em Reconectar.'
              : `A sessão caiu${session?.last_error ? `: ${session.last_error}` : ''}. O Pub Mail tenta reconectar sozinho a cada 5 minutos; você também pode reconectar agora.`}
          </Alert>
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ '& > .MuiButton-root': { flex: { xs: '1 1 auto', sm: '0 0 auto' }, minWidth: 0 } }}
          >
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconRefresh size={18} />}
              onClick={onReconnect}
              disabled={busy || !canEdit}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Reconectar
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<IconPlugConnectedX size={18} />}
              onClick={onLogout}
              disabled={busy || !canEdit}
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

// ---------------------------------------------------------------- motor
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
  wwjs: { label: 'WhatsApp Web (antigo)', pill: 'flood', points: ['Não baixa as mídias que os clientes enviam', 'Mais pesado no servidor'] }
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
          Este motor <strong>não consegue baixar as mídias</strong> que os seus clientes enviam. Migre para o motor direto: você escaneia um
          QR Code novo com o mesmo celular e nada do Pub Mail se perde.
        </Alert>
      ) : null}
      <Stack spacing={0.75} sx={{ mb: engine === 'wwjs' ? 2 : 0 }}>
        {ui.points.map((t) => (
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

// ---------------------------------------------------------------- sincronização
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
        subtitle="Conversas, contatos e mensagens recentes deste número"
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

// ---------------------------------------------------------------- perfil
function ProfileCard({ sessionId, enabled, canEdit }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', status: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!enabled || !sessionId) return;
    setLoading(true);
    try {
      const p = await get(api(sessionId, '/profile'));
      setProfile(p);
      setForm({ name: p?.name || '', status: p?.status || '' });
    } catch {
      /* mostra vazio */
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionId]);
  useEffect(() => {
    setProfile(null);
    load();
  }, [load]);

  const dirty = profile && (form.name !== (profile.name || '') || form.status !== (profile.status || ''));
  const save = async () => {
    setSaving(true);
    try {
      const body = {};
      if (form.name !== (profile?.name || '')) body.name = form.name.trim();
      if (form.status !== (profile?.status || '')) body.status = form.status;
      const p = await put(api(sessionId, '/profile'), body);
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
      await put(api(sessionId, '/profile/picture'), fd, { headers: { 'Content-Type': undefined } });
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
      await remove(api(sessionId, '/profile/picture'));
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
        subtitle="Imita o uso humano nos primeiros dias para reduzir o risco de restrição (por número)."
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
  'local.switch_engine': 'Motor de conexão trocado',
  'local.create': 'Número criado'
};
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
      <SettingsCardHeader icon={IconHistory} title="Atividade do número" subtitle="Conexões, quedas e ações feitas nesta tela" />
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

// ---------------------------------------------------------------- dados (do número / da org)
const fmtBytes = (b) => {
  const n = Number(b) || 0;
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  return `${(n / 1024 / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
};
const num = (v) => (Number(v) || 0).toLocaleString('pt-BR');

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
function purgeValues(sum, keepContacts, perNumber) {
  if (!sum) return {};
  return {
    chats: num(sum.chats),
    messages: num(sum.messages),
    media: sum.media_files ? `${num(sum.media_files)} · ${fmtBytes(sum.media_bytes)}` : '0',
    contacts: perNumber ? '0' : num(Math.max(0, (sum.contacts || 0) - (keepContacts ? sum.contacts_keepable || 0 : 0))),
    statuses: num((sum.contact_statuses || 0) + (sum.statuses || 0)),
    schedules: num(sum.schedules),
    broadcast_runs: num(sum.broadcast_runs),
    service_events: num(sum.service_events),
    filters: perNumber ? '0' : num(sum.filters)
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

function DataCard({ summary, canEdit, busy, onPurge, perNumber }) {
  return (
    <TgCard hover={false} sx={{ ...cardSx, gridColumn: '1 / -1' }}>
      <SettingsCardHeader
        icon={IconDatabase}
        title={perNumber ? 'Dados deste número' : 'Dados de todos os números'}
        subtitle={
          perNumber
            ? 'Conversas, mensagens e mídias que vieram deste número.'
            : 'Tudo o que veio do WhatsApp fica guardado no Pub Mail até você apagar.'
        }
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
                {perNumber ? 'Limpar dados do número' : 'Limpar todos os dados'}
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
        {DATA_TILES.filter((t) => !(perNumber && t.label === 'Contatos')).map((t) => (
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
        {perNumber
          ? 'Limpar apaga as conversas, mensagens, status e agendamentos deste número e o desconecta. Contatos são da organização e continuam.'
          : 'Limpar apaga isso de vez e desconecta todos os números. Etiquetas, respostas rápidas, fluxos do bot e campanhas continuam.'}
      </Typography>
    </TgCard>
  );
}

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

// mode: 'logout' | 'purge' (número) | 'purge_all' (org) | 'remove' (apagar o número)
function DisconnectDialog({ mode, session, summary, onClose, onDone }) {
  const open = Boolean(mode);
  const [choice, setChoice] = useState('keep');
  const [keepContacts, setKeepContacts] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setChoice(mode === 'logout' ? 'keep' : 'purge');
    setKeepContacts(false);
    setConfirmText('');
  }, [open, mode]);

  const perNumber = mode !== 'purge_all';
  const purging = choice === 'purge';
  const hasSession = Boolean(session?.exists || summary?.has_session);
  const values = purgeValues(summary, keepContacts, perNumber);
  const rows = PURGE_ROWS.filter((r) => values[r.key] && values[r.key] !== '0');
  const confirmed = confirmText.trim().toUpperCase() === 'APAGAR';

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'remove') {
        await remove(api(session.id));
        toast.success(`Número "${sessionLabel(session)}" apagado.`);
      } else if (purging && mode === 'purge_all') {
        const r = await post('/whatsapp/sessions/purge', { confirm: confirmText.trim(), keep_contacts: keepContacts });
        const d = r?.deleted || {};
        toast.success(`Dados apagados: ${num(d.chats)} conversas, ${num(d.messages)} mensagens e ${num(d.files)} arquivos.`);
      } else if (purging) {
        const r = await post(api(session.id, '/purge'), { confirm: confirmText.trim() });
        const d = r?.deleted || {};
        toast.success(`Dados do número apagados: ${num(d.chats)} conversas e ${num(d.messages)} mensagens.`);
      } else {
        await post(api(session.id, '/logout'));
        toast.success('Número desconectado.');
      }
      onDone();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível concluir.'));
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'remove'
      ? `Apagar o número "${sessionLabel(session)}"?`
      : mode === 'purge_all'
        ? 'Limpar os dados de todos os números?'
        : mode === 'purge'
          ? 'Limpar os dados deste número?'
          : 'Desconectar este número?';
  const subtitle =
    mode === 'remove'
      ? 'Remove a aba e tudo o que veio dele. Não dá para desfazer.'
      : purging
        ? hasSession
          ? 'O número também será desconectado.'
          : 'Apaga o que ficou guardado.'
        : 'Escolha o que acontece com o que veio deste número.';
  const actionLabel = mode === 'remove' ? 'Apagar número' : purging ? (hasSession ? 'Desconectar e apagar' : 'Apagar') : 'Desconectar';

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
            disabled={loading || ((purging || mode === 'remove') && !confirmed)}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : purging || mode === 'remove' ? (
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
              text="Conversas e histórico continuam no Pub Mail. Bom para reconectar o mesmo número depois."
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

        {purging || mode === 'remove' ? (
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
                  Não há dados guardados.
                </Typography>
              )}
            </Box>
            {mode === 'purge_all' && summary?.contacts_keepable ? (
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
              {perNumber
                ? 'Continuam: contatos (são da organização), etiquetas, respostas rápidas, fluxos do bot, campanhas e configurações.'
                : 'Continuam: etiquetas, respostas rápidas, fluxos do bot, campanhas e configurações de atendimento.'}
            </Typography>
            {summary?.bot_active || summary?.active_broadcasts ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                {perNumber
                  ? 'O bot deste número será desligado'
                  : summary.bot_active && summary.active_broadcasts
                    ? 'O bot e os broadcasts ativos serão desligados'
                    : summary.bot_active
                      ? 'O bot será desligado'
                      : 'Os broadcasts ativos serão desligados'}
                , para nada sair sozinho. Ligue de novo quando quiser.
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

// ============================================================================
// Painel de UM número (aba)
// ============================================================================
function NumberPanel({ sessionId, canEdit, flows, onSessionsChanged, onRemove }) {
  const [session, setSession] = useState(null);
  const [qr, setQr] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'pacing'|'migrate'}
  const [pairing, setPairing] = useState({ open: false, phone: '', code: '', loading: false });
  const [test, setTest] = useState({ open: false, text: '', loading: false });
  const [bootstrapping, setBootstrapping] = useState(false);
  const [syncDlg, setSyncDlg] = useState(null);
  const [dataDlg, setDataDlg] = useState(null); // 'logout' | 'purge'
  const [dataSummary, setDataSummary] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const s = await get(api(sessionId));
      if (seq !== seqRef.current) return;
      setSession(s);
      if (s?.status === 'qr_ready') {
        const q = await get(api(sessionId, '/qr')).catch(() => null);
        if (seq === seqRef.current) setQr(q?.qr || null);
      } else setQr(null);
    } catch (e) {
      if (seq === seqRef.current)
        setSession((prev) => prev || { id: sessionId, status: 'none', gateway_error: errMsg(e, 'Falha ao carregar.') });
    }
  }, [sessionId]);
  const loadEvents = useCallback(async () => {
    try {
      setEvents(await get(api(sessionId, '/events'), { params: { limit: 40 } }));
    } catch {
      /* silencioso */
    }
  }, [sessionId]);
  const loadSummary = useCallback(async () => {
    try {
      setDataSummary(await get(api(sessionId, '/data-summary')));
    } catch {
      /* silencioso */
    }
  }, [sessionId]);

  useEffect(() => {
    setSession(null);
    setQr(null);
    setEvents([]);
    setDataSummary(null);
    load();
    loadEvents();
    loadSummary();
  }, [load, loadEvents, loadSummary]);

  useRealtimeEvent('wa:session', (ev) => {
    if (ev?.session_id && ev.session_id !== sessionId) return;
    load();
    loadEvents();
    loadSummary();
    if (ev?.event === 'local.purge') setDataVersion((v) => v + 1);
  });
  useRealtimeEvent('wa:sync', (sync) => {
    if (sync?.session_id && sync.session_id !== sessionId) return;
    setSession((prev) => (prev ? { ...prev, sync } : prev));
    if (sync?.phase === 'done') loadSummary();
    if (sync?.phase === 'done' && !sync?.repass) toast.success('Sincronização concluída.', { id: `wa-sync-done-${sessionId}` });
  });

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
      onSessionsChanged?.();
    } catch (e) {
      toast.error(errMsg(e, 'Falha na operação.'));
    } finally {
      setBusy(false);
    }
  };

  const onConnect = () => run(() => post(api(sessionId, '/start')));
  const onReconnect = () => run(() => post(api(sessionId, '/start')), 'Reconectando…');
  const bootstrap = () => setSyncDlg({ chats: 60, per_chat: 40 });
  const doBootstrap = async () => {
    const opts = syncDlg || {};
    setSyncDlg(null);
    setBootstrapping(true);
    try {
      await post(api(sessionId, '/bootstrap'), { chats: opts.chats, per_chat: opts.per_chat });
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
      () => post(api(sessionId, '/switch-engine'), { engine: session?.default_engine || 'baileys' }),
      'Escaneie o QR Code novo com o mesmo celular.'
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
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
    onSessionsChanged?.();
  };
  const onToggle = (enabled) => {
    if (!enabled) setConfirm({ kind: 'pacing' });
    else run(() => put(api(sessionId, '/pacing'), { enabled: true }), 'Aquecimento ligado.');
  };
  const doDisablePacing = () => {
    setConfirm(null);
    run(() => put(api(sessionId, '/pacing'), { enabled: false }), 'Limitador desligado. Responsabilidade assumida.');
  };
  const saveIdentity = async (body) => {
    try {
      const s = await put(api(sessionId), body);
      setSession(s);
      toast.success('Número atualizado.');
      onSessionsChanged?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    }
  };
  const requestPairing = async () => {
    const phone = pairing.phone.replace(/\D/g, '');
    if (phone.length < 10) return toast.error('Informe o número com DDI e DDD, ex.: 5511999999999.');
    setPairing((p) => ({ ...p, loading: true }));
    try {
      const r = await post(api(sessionId, '/pairing-code'), { phone });
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
      await post(api(sessionId, '/test'), { text: test.text || undefined });
      toast.success('Mensagem de teste enviada para o próprio número.');
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

  if (!session)
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress sx={{ color: WA_GREEN }} />
      </Stack>
    );
  const connected = st === 'ready';
  return (
    <Box>
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
          canEdit={canEdit}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onLogout={onLogout}
          onTest={() => setTest({ open: true, text: '', loading: false })}
          onPairing={() => setPairing({ open: true, phone: '', code: '', loading: false })}
        />
        <IdentityCard
          session={session}
          canEdit={canEdit}
          flows={flows}
          onSave={saveIdentity}
          onRemove={() => onRemove(session, dataSummary)}
        />
        <ProfileCard sessionId={sessionId} enabled={connected} canEdit={canEdit} />
        <EngineCard session={session} canEdit={canEdit} busy={busy} onMigrate={() => setConfirm({ kind: 'migrate' })} />
        <SyncCard session={session} connected={connected} onSync={bootstrap} />
        <WarmupCard session={session} canEdit={canEdit} onToggle={onToggle} />
        <DiagnosticsCard
          key={`diag-${sessionId}-${dataVersion}`}
          sessionId={sessionId}
          status={st}
          canEdit={canEdit}
          upgradeAvailable={Boolean(session?.engine_upgrade)}
          onMigrate={() => setConfirm({ kind: 'migrate' })}
        />
        <ActivityCard events={events} />
        <DataCard summary={dataSummary} canEdit={canEdit} busy={busy} onPurge={onPurge} perNumber />
      </Box>

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
        message="A conexão atual será encerrada e um QR Code novo aparece aqui. Escaneie com o mesmo celular. Conversas, contatos, etiquetas, agendamentos e campanhas continuam no Pub Mail."
        confirmLabel="Migrar agora"
      />
      <TgModal
        open={Boolean(syncDlg)}
        onClose={() => setSyncDlg(null)}
        title="Sincronizar com o celular"
        subtitle="Traz conversas, contatos e as mensagens mais recentes deste número."
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

// ============================================================================
export default function WhatsAppSettings() {
  const { user } = useAuth();
  const role = user?.user?.role;
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const { sessions, loading, reload, max, configured, gateway_error: gatewayError } = useWaSessions(15000);
  const [params, setParams] = useSearchParams();
  const selectedParam = params.get('number');
  const [creating, setCreating] = useState(false);
  const [newDlg, setNewDlg] = useState(null); // { label, color }
  const [removeDlg, setRemoveDlg] = useState(null); // { session, summary }
  const [orgDlg, setOrgDlg] = useState(null); // 'purge_all'
  const [orgSummary, setOrgSummary] = useState(null);
  const [flows, setFlows] = useState([]);
  const [orgVersion, setOrgVersion] = useState(0);

  const selected = useMemo(() => sessions.find((s) => s.id === selectedParam) || sessions[0] || null, [sessions, selectedParam]);
  const select = (id) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (id) n.set('number', id);
        else n.delete('number');
        return n;
      },
      { replace: true }
    );

  const loadFlows = useCallback(async () => {
    try {
      const r = await get('/whatsapp/bot/flows');
      setFlows(Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []);
    } catch {
      setFlows([]);
    }
  }, []);
  const loadOrgSummary = useCallback(async () => {
    try {
      setOrgSummary(await get('/whatsapp/sessions/data-summary'));
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    loadFlows();
    loadOrgSummary();
  }, [loadFlows, loadOrgSummary]);

  const createNumber = async () => {
    setCreating(true);
    try {
      const s = await post('/whatsapp/sessions', { label: newDlg?.label?.trim() || undefined, color: newDlg?.color || undefined });
      setNewDlg(null);
      await reload();
      select(s?.id);
      toast.success('Número criado. Clique em Conectar para escanear o QR.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível criar o número.'));
    } finally {
      setCreating(false);
    }
  };

  const onRemove = async (session, summary) => {
    setRemoveDlg({ session, summary });
  };
  const onRemoved = async () => {
    setRemoveDlg(null);
    await reload();
    select(null);
    loadOrgSummary();
  };
  const onOrgPurge = () => {
    loadOrgSummary();
    setOrgDlg('purge_all');
  };
  const onOrgDone = () => {
    setOrgDlg(null);
    setOrgVersion((v) => v + 1);
    reload();
    loadOrgSummary();
  };

  const headerAction = useMemo(
    () => (
      // celular: o WaPageHeader põe isto numa linha própria (o botão cresce, o ícone não)
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {canEdit ? (
          <Button
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={18} />}
            onClick={() => setNewDlg({ label: '', color: COLORS[sessions.length % COLORS.length] })}
            disabled={!configured || sessions.length >= max}
            sx={{ fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
          >
            Novo número
          </Button>
        ) : null}
        <Tooltip title="Atualizar">
          <IconButton onClick={reload}>
            <IconRefresh size={20} />
          </IconButton>
        </Tooltip>
      </Stack>
    ),
    [canEdit, configured, sessions.length, max, reload]
  );

  return (
    <Box>
      <WaPageHeader
        icon={IconBrandWhatsapp}
        title="WhatsApp"
        subtitle={
          sessions.length
            ? `${sessions.length} ${sessions.length === 1 ? 'número' : 'números'} · ${sessions.filter((s) => s.connected).length} conectado${sessions.filter((s) => s.connected).length === 1 ? '' : 's'}`
            : 'Conecte um ou mais números do WhatsApp à sua organização.'
        }
        action={headerAction}
      />

      {gatewayError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {gatewayError}
        </Alert>
      ) : null}

      {loading && !sessions.length ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress sx={{ color: WA_GREEN }} />
        </Stack>
      ) : !sessions.length ? (
        <TgCard hover={false} sx={{ ...cardSx, mb: 2 }}>
          <TgEmptyState
            icon={IconBrandWhatsapp}
            title="Nenhum número ainda"
            description={
              canEdit
                ? 'Crie o primeiro número e escaneie o QR Code com o celular. Você pode conectar quantos números quiser, cada um com nome, cor e fluxo do bot próprios.'
                : 'Peça a um administrador da organização para conectar um número ou liberar o acesso aos números existentes.'
            }
            action={
              canEdit ? (
                <Button
                  variant="contained"
                  disableElevation
                  size="large"
                  startIcon={<IconPlus size={20} />}
                  onClick={() => setNewDlg({ label: 'Principal', color: COLORS[0] })}
                  disabled={!configured}
                  sx={{ fontWeight: 700, borderRadius: 2.5, px: 3, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
                >
                  Criar o primeiro número
                </Button>
              ) : null
            }
          />
        </TgCard>
      ) : (
        <>
          {/* abas dos números */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'thin' }}>
            {sessions.map((s) => (
              <NumberTab key={s.id} session={s} selected={selected?.id === s.id} onClick={() => select(s.id)} />
            ))}
            {canEdit && sessions.length < max ? (
              <ButtonBase
                onClick={() => setNewDlg({ label: '', color: COLORS[sessions.length % COLORS.length] })}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 2.5,
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  flexShrink: 0,
                  fontWeight: 700,
                  fontSize: 14,
                  '&:hover': { borderColor: WA_GREEN, color: WA_DARK }
                }}
              >
                <IconPlus size={16} /> Novo número
              </ButtonBase>
            ) : null}
          </Stack>
          {selected ? (
            <NumberPanel
              key={selected.id}
              sessionId={selected.id}
              canEdit={canEdit}
              flows={flows}
              onSessionsChanged={reload}
              onRemove={onRemove}
            />
          ) : null}
        </>
      )}

      {/* configurações da organização */}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 4, mb: 1.5 }}>
        <IconDotsVertical size={18} style={{ opacity: 0.5 }} />
        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Configurações da organização</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          valem para todos os números
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'stretch',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }
        }}
      >
        {/* Fase 7: modelos prontos por ramo (só dono/admin) e campos personalizados por cadastro */}
        {canEdit ? <TemplatesCard canEdit={canEdit} onApplied={() => setOrgVersion((v) => v + 1)} /> : null}
        <AttendanceCard canEdit={canEdit} />
        {/* Fase 8: fila de envios (pausa e ritmo por número) */}
        <OutboxCard canEdit={canEdit} />
        <TagsCard key={`tags-${orgVersion}`} canEdit={canEdit} />
        <QuickRepliesCard />
        <CustomFieldsCard canEdit={canEdit} />
        <DataCard summary={orgSummary} canEdit={canEdit} busy={false} onPurge={onOrgPurge} />
      </Box>

      {/* novo número */}
      <TgModal
        open={Boolean(newDlg)}
        onClose={() => setNewDlg(null)}
        title="Novo número"
        subtitle="Depois de criar, clique em Conectar e escaneie o QR Code."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setNewDlg(null)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={createNumber}
              disabled={creating}
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <IconPlus size={18} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Criar
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2}>
          <TextField
            label="Nome interno"
            placeholder="Ex.: Vendas, Suporte, Loja Centro"
            value={newDlg?.label || ''}
            onChange={(e) => setNewDlg((d) => ({ ...d, label: e.target.value.slice(0, 80) }))}
            size="small"
            fullWidth
            autoFocus
            helperText="Só a sua equipe vê. Dá para mudar depois."
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Cor de identificação
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {COLORS.map((c) => (
                <ButtonBase
                  key={c}
                  onClick={() => setNewDlg((d) => ({ ...d, color: c }))}
                  aria-label={c}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: c,
                    border: '2px solid',
                    borderColor: newDlg?.color === c ? 'text.primary' : 'transparent',
                    boxShadow: newDlg?.color === c ? `0 0 0 2px ${c}66` : 'none'
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </TgModal>

      <DisconnectDialog
        mode={removeDlg ? 'remove' : null}
        session={removeDlg?.session}
        summary={removeDlg?.summary}
        onClose={() => setRemoveDlg(null)}
        onDone={onRemoved}
      />
      <DisconnectDialog mode={orgDlg} session={null} summary={orgSummary} onClose={() => setOrgDlg(null)} onDone={onOrgDone} />
    </Box>
  );
}
