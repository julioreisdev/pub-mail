import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import {
  IconActivityHeartbeat,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconArrowsExchange,
  IconClock,
  IconEngine,
  IconMessages,
  IconPhoto,
  IconRefresh,
  IconWifi,
  IconWifiOff
} from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard } from 'views/pages/telegram/ui';
import { fmtAgo, fmtDateTime } from '../waShared';
import { waButtonSx } from '../waKit';
import { SettingsCardHeader, cardSx, errText, plural, warnTextSx } from './settingsKit';

// ============================================================================
// Card "Diagnóstico da conexão" (compacto): gateway, motor, último evento,
// mensagens e mídia nas últimas 24 h. GET /whatsapp/sessions/:id/diagnostics (por número).
// Recarrega quando o status da sessão muda e no botão "Atualizar".
// ============================================================================

const ENGINE_LABEL = { baileys: 'Direto', wwjs: 'WhatsApp Web (antigo)' };
const n = (v) => (Number(v) || 0).toLocaleString('pt-BR');
const tint = (token, a) => (t) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;

function latencyToken(ms) {
  if (ms == null) return 'success';
  if (ms < 400) return 'success';
  if (ms < 1500) return 'warning';
  return 'error';
}

function Tile({ icon: Icon, label, children, tooltip }) {
  const body = (
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0, height: '100%' }}>
      <Stack direction="row" spacing={0.6} alignItems="flex-start" sx={{ color: 'text.secondary', mb: 0.5 }}>
        <Icon size={14} />
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {label}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
  return tooltip ? (
    <Tooltip title={tooltip}>
      <Box sx={{ minWidth: 0 }}>{body}</Box>
    </Tooltip>
  ) : (
    body
  );
}

export default function DiagnosticsCard({ sessionId, status, canEdit, upgradeAvailable, onMigrate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(
    async (initial = false) => {
      const s = ++seq.current;
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const d = await get(`/whatsapp/sessions/${sessionId}/diagnostics`);
        if (s !== seq.current) return;
        setData(d || null);
        setError('');
      } catch (e) {
        if (s !== seq.current) return;
        setError(
          e?.response?.status === 404
            ? 'O diagnóstico ainda não está disponível neste servidor.'
            : errText(e, 'Não foi possível verificar a conexão agora.')
        );
      } finally {
        if (s === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [sessionId]
  );

  // 1ª carga + sempre que a sessão muda de status (conectou, caiu, QR…)
  const first = useRef(true);
  useEffect(() => {
    load(first.current);
    first.current = false;
  }, [load, status]);

  const gw = data?.gateway || {};
  const engine = data?.engine || null;
  const missing = Number(data?.media_24h?.missing) || 0;
  const received = Number(data?.media_24h?.received) || 0;
  const token = gw.ok ? latencyToken(gw.ms) : 'error';
  const checkedAt = data?.checked_at
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(data.checked_at))
    : '';

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconActivityHeartbeat}
        title="Diagnóstico da conexão"
        stackAction
        subtitle={checkedAt ? `Verificado às ${checkedAt}` : 'Gateway, mensagens e mídia nas últimas 24 h'}
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={() => load(false)}
            disabled={loading || refreshing}
            startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <IconRefresh size={16} />}
            sx={{ fontWeight: 700 }}
          >
            Atualizar
          </Button>
        }
      />

      {loading ? (
        <Stack spacing={1.25}>
          <Skeleton variant="rounded" height={58} />
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={66} />
            ))}
          </Box>
        </Stack>
      ) : error && !data ? (
        <Alert
          severity={/disponível neste servidor/.test(error) ? 'info' : 'error'}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => load(false)}
              disabled={refreshing}
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Tentar de novo
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <Stack spacing={1.25} sx={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity .15s ease' }}>
          {error ? (
            <Alert severity="warning" sx={{ py: 0.25 }}>
              {error} Mostrando a última verificação.
            </Alert>
          ) : null}

          {/* gateway */}
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: tint(token, 0.35), bgcolor: tint(token, 0.07) }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                color: `${gw.ok ? 'success' : 'error'}.main`,
                bgcolor: tint(gw.ok ? 'success' : 'error', 0.14)
              }}
            >
              {gw.ok ? <IconWifi size={20} /> : <IconWifiOff size={20} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {gw.ok ? 'Gateway online' : 'Gateway fora do ar'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', wordBreak: 'break-word' }}>
                {gw.ok ? 'O servidor do WhatsApp está respondendo.' : gw.error || 'O servidor do WhatsApp não respondeu.'}
              </Typography>
            </Box>
            {gw.ms != null ? (
              <Box
                sx={{
                  px: 1,
                  py: 0.35,
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: `${token}.main`,
                  bgcolor: tint(token, 0.14),
                  flexShrink: 0
                }}
              >
                {n(gw.ms)} ms
              </Box>
            ) : null}
          </Stack>

          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Tile icon={IconEngine} label="Motor em uso">
              <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.35 }}>
                {engine ? ENGINE_LABEL[engine] || engine : 'Nenhum'}
              </Typography>
              {!engine ? (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Padrão: {ENGINE_LABEL[data?.default_engine] || 'Direto'}
                </Typography>
              ) : null}
            </Tile>
            <Tile icon={IconClock} label="Último evento" tooltip={data?.last_event_at ? fmtDateTime(data.last_event_at) : ''}>
              <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.35 }}>
                {data?.last_event_at ? fmtAgo(data.last_event_at) : 'Nenhum ainda'}
              </Typography>
            </Tile>
            <Tile icon={IconMessages} label="Mensagens (24 h)">
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                <Tooltip title="Recebidas">
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    <IconArrowDownLeft size={15} style={{ color: '#25D366' }} />
                    <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {n(data?.messages_24h?.in)}
                    </Typography>
                  </Stack>
                </Tooltip>
                <Tooltip title="Enviadas">
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    <IconArrowUpRight size={15} style={{ color: '#34B7F1' }} />
                    <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {n(data?.messages_24h?.out)}
                    </Typography>
                  </Stack>
                </Tooltip>
              </Stack>
            </Tile>
            <Tile icon={IconPhoto} label="Mídias recebidas (24 h)">
              <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {n(received)} {received === 1 ? 'baixada' : 'baixadas'}
              </Typography>
              <Typography
                variant="caption"
                sx={[{ color: 'text.secondary', fontWeight: missing ? 700 : 400, display: 'block' }, missing > 0 && warnTextSx]}
              >
                {missing ? `${n(missing)} sem arquivo` : 'Nenhuma faltando'}
              </Typography>
            </Tile>
          </Box>

          {missing > 0 && engine === 'wwjs' ? (
            <Alert
              severity="warning"
              sx={{ alignItems: 'center' }}
              action={
                canEdit && upgradeAvailable && onMigrate ? (
                  <Button
                    size="small"
                    variant="contained"
                    disableElevation
                    startIcon={<IconArrowsExchange size={16} />}
                    onClick={onMigrate}
                    sx={{ ...waButtonSx, whiteSpace: 'nowrap' }}
                  >
                    Migrar
                  </Button>
                ) : null
              }
            >
              {plural(missing, 'mídia enviada pelos clientes não foi baixada', 'mídias enviadas pelos clientes não foram baixadas')} pelo
              motor antigo. Migre para o motor direto para receber fotos, áudios e documentos.
            </Alert>
          ) : null}
        </Stack>
      )}
    </TgCard>
  );
}
