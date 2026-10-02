import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCloudOff,
  IconEyeCheck,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUser,
  IconUsers,
  IconX
} from '@tabler/icons-react';

import { TgAvatar, TgCard } from 'views/pages/telegram/ui';
import { WA_DARK, WA_GREEN, WA_GRADIENT } from '../waKit';
import SectionTitle from './SectionTitle';
import { agoShort, displayName } from './statusShared';

// =============================================================================
// Faixa "Status dos contatos" — avatares com anel segmentado (verde = novo,
// cinza = visto), nome e há quanto tempo postou. Rola na horizontal.
// =============================================================================

// ----------------------------------------------------------------------------
// StatusRing — um segmento por status; verde (gradiente) se não visto
// ----------------------------------------------------------------------------
export function StatusRing({ segments = [], size = 68, stroke = 3, dark = false, dashed = false, children }) {
  const gid = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const n = Math.max(1, segments.length);
  const seg = C / n;
  // gap visível entre segmentos (com ponta arredondada o traço cresce `stroke`)
  const gap = n > 1 ? Math.min(6, seg * 0.35) : 0;
  const dash = n > 1 ? Math.max(0.5, seg - gap - stroke) : C;
  const inner = size - 2 * (stroke + 3);
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box
        component="svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          inset: 0,
          transform: 'rotate(-90deg)',
          '& .seen': { stroke: dark ? 'rgba(255,255,255,0.45)' : t.vars.palette.text.disabled },
          '& .none': { stroke: t.vars.palette.divider }
        })}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={WA_GREEN} />
            <stop offset="100%" stopColor={WA_DARK} />
          </linearGradient>
        </defs>
        {segments.length === 0 ? (
          <circle className="none" cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} strokeDasharray={dashed ? '4 4' : undefined} />
        ) : (
          segments.map((viewed, i) => (
            <circle
              key={i}
              className={viewed ? 'seen' : undefined}
              stroke={viewed ? undefined : `url(#g${gid})`}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              strokeWidth={viewed ? Math.max(1.5, stroke - 1) : stroke}
              strokeLinecap={n > 1 ? 'round' : 'butt'}
              strokeDasharray={n > 1 ? `${dash} ${C - dash}` : undefined}
              strokeDashoffset={n > 1 ? -(i * seg + (gap + stroke) / 2) : undefined}
            />
          ))
        )}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: stroke + 3,
          left: stroke + 3,
          width: inner,
          height: inner,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        {typeof children === 'function' ? children(inner) : children}
      </Box>
    </Box>
  );
}

const ITEM_W = 86;

function StripItem({ label, sub, subStrong, onClick, children, title }) {
  return (
    <Tooltip title={title || ''} disableInteractive enterDelay={500}>
      <ButtonBase
        onClick={onClick}
        focusRipple
        sx={{
          width: ITEM_W,
          flexShrink: 0,
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          py: 1,
          px: 0.5,
          borderRadius: 2.5,
          scrollSnapAlign: 'start',
          transition: 'background-color .15s ease',
          '&:hover': { bgcolor: 'action.hover' },
          '&:hover .wa-ring': { transform: 'scale(1.04)' },
          '& .wa-ring': { transition: 'transform .18s ease' }
        }}
      >
        <Box className="wa-ring">{children}</Box>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, width: '100%', textAlign: 'center' }} noWrap>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            lineHeight: 1.1,
            width: '100%',
            textAlign: 'center',
            color: subStrong ? WA_DARK : 'text.secondary',
            fontWeight: subStrong ? 700 : 500
          }}
          noWrap
        >
          {sub}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

function MyStatusItem({ onNew, picture, name, postedCount }) {
  return (
    <StripItem
      label="Meu status"
      sub={postedCount ? `${postedCount} ${postedCount === 1 ? 'publicado' : 'publicados'}` : 'Publicar'}
      subStrong={!postedCount}
      onClick={onNew}
      title="Publicar um novo status"
    >
      <Box sx={{ position: 'relative' }}>
        <StatusRing segments={postedCount ? Array.from({ length: Math.min(postedCount, 12) }, () => true) : []} dashed>
          {(inner) =>
            picture ? (
              <img src={picture} alt="" width={inner} height={inner} style={{ objectFit: 'cover', display: 'block' }} />
            ) : (
              <Box
                sx={{
                  width: inner,
                  height: inner,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: inner * 0.4,
                  background: WA_GRADIENT
                }}
              >
                {(name || 'E').trim().charAt(0).toUpperCase()}
              </Box>
            )
          }
        </StatusRing>
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 22,
            height: 22,
            borderRadius: '50%',
            bgcolor: WA_GREEN,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            border: '2px solid',
            borderColor: 'background.paper'
          }}
        >
          <IconPlus size={13} stroke={3} />
        </Box>
      </Box>
    </StripItem>
  );
}

function ContactItem({ contact, now, onOpen }) {
  const name = displayName(contact);
  const unseen = contact.statuses.filter((s) => !s.viewed).length;
  return (
    <StripItem
      label={name}
      sub={agoShort(contact.last_at, now)}
      subStrong={!contact.all_viewed}
      onClick={() => onOpen(contact.chat_id)}
      title={`${name} · ${contact.statuses.length} ${contact.statuses.length === 1 ? 'status' : 'status'}${unseen ? ` (${unseen} ${unseen === 1 ? 'novo' : 'novos'})` : ''}`}
    >
      <StatusRing segments={contact.statuses.map((s) => s.viewed)}>
        {(inner) => <TgAvatar name={contact.name} photoPath={contact.photo_path} size={inner} kind="contact" icon={IconUser} />}
      </StatusRing>
    </StripItem>
  );
}

// ----------------------------------------------------------------------------
// Faixa completa
// ----------------------------------------------------------------------------
// Conectado há menos de 24 h: parte dos status do dia é de antes da conexão e não chega.
const recentlyConnected = (iso, now) => Boolean(iso) && (now || Date.now()) - new Date(iso).getTime() < 24 * 3600 * 1000;
const fmtConnected = (iso) => {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `hoje às ${hm}` : `ontem às ${hm}`;
};

export default function ContactStatusStrip({
  contacts,
  loading,
  syncing,
  unavailable,
  error,
  syncedAt,
  now,
  connected,
  onOpen,
  onSync,
  onReload,
  onNew,
  myPicture,
  myName,
  myPostedCount,
  connectedSince
}) {
  const [q, setQ] = useState('');
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return contacts;
    const digits = term.replace(/\D/g, '');
    return contacts.filter(
      (c) => displayName(c).toLowerCase().includes(term) || (digits.length >= 3 && String(c.phone || '').includes(digits))
    );
  }, [contacts, q]);

  const unseenCount = useMemo(() => contacts.filter((c) => !c.all_viewed).length, [contacts]);
  const firstSeenIdx = filtered.findIndex((c) => c.all_viewed);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, filtered.length, loading]);

  const scrollBy = (dir) =>
    scroller.current?.scrollBy({ left: dir * Math.max(240, (scroller.current?.clientWidth || 600) * 0.7), behavior: 'smooth' });

  const openFromStrip = (chatId) =>
    onOpen(
      chatId,
      filtered.map((c) => c.chat_id)
    );

  const arrowSx = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 34,
    height: 34,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    display: { xs: 'none', md: 'inline-flex' },
    '&:hover': { bgcolor: 'background.paper', color: WA_DARK }
  };

  const mask =
    edges.left && edges.right
      ? 'linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)'
      : edges.left
        ? 'linear-gradient(to right, transparent, #000 28px)'
        : edges.right
          ? 'linear-gradient(to right, #000 calc(100% - 28px), transparent)'
          : 'none';

  // ---------- corpo ----------
  let body;
  if (loading) {
    body = (
      <Stack direction="row" spacing={1.5} sx={{ py: 1, overflow: 'hidden' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Stack key={i} spacing={0.75} alignItems="center" sx={{ width: ITEM_W, flexShrink: 0 }}>
            <Skeleton variant="circular" width={68} height={68} />
            <Skeleton variant="rounded" width={58} height={10} />
            <Skeleton variant="rounded" width={38} height={8} />
          </Stack>
        ))}
      </Stack>
    );
  } else if (unavailable) {
    body = (
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ py: 1.5, px: 0.5 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: WA_DARK,
            bgcolor: 'rgba(37,211,102,.14)'
          }}
        >
          <IconCloudOff size={24} stroke={1.8} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>Em breve por aqui</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Os status que seus contatos publicarem nas últimas 24 horas vão aparecer nesta faixa assim que o recurso for liberado no
            servidor. Publicar os seus status continua funcionando normalmente.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={onReload}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
        >
          Tentar de novo
        </Button>
      </Stack>
    );
  } else if (error && !contacts.length) {
    body = (
      <Alert
        severity="warning"
        sx={{ borderRadius: 2, my: 1 }}
        action={
          <Button color="inherit" size="small" onClick={onReload} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Tentar de novo
          </Button>
        }
      >
        {error}
      </Alert>
    );
  } else {
    const nobody = contacts.length === 0;
    body = (
      <Box sx={{ position: 'relative' }}>
        {edges.left ? (
          <IconButton aria-label="Rolar para a esquerda" onClick={() => scrollBy(-1)} sx={{ ...arrowSx, left: -6 }}>
            <IconChevronLeft size={18} />
          </IconButton>
        ) : null}
        {edges.right ? (
          <IconButton aria-label="Rolar para a direita" onClick={() => scrollBy(1)} sx={{ ...arrowSx, right: -6 }}>
            <IconChevronRight size={18} />
          </IconButton>
        ) : null}
        <Box
          ref={scroller}
          onScroll={measure}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.5,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            scrollSnapType: 'x proximity',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            WebkitMaskImage: mask,
            maskImage: mask,
            mx: -0.5
          }}
        >
          {onNew ? <MyStatusItem onNew={onNew} picture={myPicture} name={myName} postedCount={myPostedCount} /> : null}
          {onNew && filtered.length ? (
            <Box sx={{ width: '1px', alignSelf: 'stretch', my: 2, mx: 0.75, bgcolor: 'divider', flexShrink: 0 }} />
          ) : null}
          {filtered.map((c, i) => (
            <Box key={c.chat_id} sx={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
              {i > 0 && i === firstSeenIdx ? (
                <Tooltip title="Daqui em diante: já vistos">
                  <Box sx={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', px: 0.75 }}>
                    <Box sx={{ color: 'text.disabled', display: 'grid', placeItems: 'center' }}>
                      <IconEyeCheck size={16} />
                    </Box>
                  </Box>
                </Tooltip>
              ) : null}
              <ContactItem contact={c} now={now} onOpen={openFromStrip} />
            </Box>
          ))}
          {nobody || !filtered.length ? (
            <Box sx={{ flex: 1, minWidth: 220, alignSelf: 'center', px: 1.5, py: 1 }}>
              {nobody ? (
                <>
                  <Typography sx={{ fontWeight: 700 }}>Nenhum contato publicou status nas últimas 24 horas</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    {connected
                      ? 'Quando alguém da sua agenda publicar, o status aparece aqui na hora.'
                      : 'Conecte o WhatsApp para receber os status dos seus contatos.'}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={onSync}
                    disabled={syncing || !connected}
                    startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <IconRefresh size={16} />}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                  >
                    Buscar no WhatsApp
                  </Button>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nenhum contato encontrado para “{q.trim()}”.
                </Typography>
              )}
            </Box>
          ) : null}
        </Box>
      </Box>
    );
  }

  return (
    <TgCard hover={false} sx={{ p: { xs: 1.5, sm: 2 }, mb: 3.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 1.5 }} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
        <SectionTitle
          icon={IconUsers}
          title="Status dos contatos"
          caption={`Últimas 24 h${syncedAt ? ` · atualizado ${agoShort(syncedAt, now)}` : ''}`}
          extra={
            unseenCount ? (
              <Chip
                size="small"
                label={`${unseenCount} ${unseenCount === 1 ? 'novo' : 'novos'}`}
                sx={{ height: 22, fontWeight: 800, color: '#fff', bgcolor: WA_GREEN, flexShrink: 0 }}
              />
            ) : null
          }
          action={
            <Tooltip title={connected ? 'Buscar status novos no WhatsApp' : 'Conecte o WhatsApp para buscar'}>
              <span>
                <IconButton
                  onClick={onSync}
                  disabled={syncing || unavailable || !connected}
                  sx={{ display: { sm: 'none' }, color: WA_DARK }}
                  aria-label="Atualizar status"
                >
                  {syncing ? <CircularProgress size={18} color="inherit" /> : <IconRefresh size={20} />}
                </IconButton>
              </span>
            </Tooltip>
          }
          sx={{ flex: 1 }}
        />
        {!unavailable && contacts.length > 0 ? (
          <TextField
            size="small"
            placeholder="Buscar contato"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ width: { xs: '100%', sm: 220 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <IconSearch size={16} />
                  </InputAdornment>
                ),
                endAdornment: q ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQ('')} aria-label="Limpar busca" edge="end">
                      <IconX size={14} />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }
            }}
          />
        ) : null}
        <Tooltip title={connected ? 'Buscar status novos no WhatsApp' : 'Conecte o WhatsApp para buscar'}>
          <span>
            <Button
              variant="outlined"
              color="inherit"
              onClick={onSync}
              disabled={syncing || unavailable || !connected}
              startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <IconRefresh size={17} />}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
                borderColor: 'divider'
              }}
            >
              {syncing ? 'Atualizando…' : 'Atualizar'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      {recentlyConnected(connectedSince, now) ? (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.25 }}>
          Número conectado {fmtConnected(connectedSince)}: status publicados antes disso não são repassados ao Pub Mail. Os novos aparecem
          aqui assim que forem postados.
        </Typography>
      ) : null}
      {body}
    </TgCard>
  );
}
