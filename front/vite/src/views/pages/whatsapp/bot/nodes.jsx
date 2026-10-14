// =============================================================================
// WhatsApp — Fluxo do Bot: nós do canvas (reactflow v11), aresta e estilos.
// Cada bloco = card com cabeçalho colorido por tipo, corpo em balões do
// WhatsApp e uma linha por saída (com a bolinha de conexão à direita).
// =============================================================================
import { Fragment, useEffect, useMemo, useState } from 'react';
import { EdgeLabelRenderer, Handle, Position, getBezierPath, useUpdateNodeInternals } from 'reactflow';
import { Box, IconButton, InputBase, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCalendarPlus,
  IconCircleX,
  IconClipboardList,
  IconClockPlus,
  IconCopy,
  IconCreditCard,
  IconDeviceFloppy,
  IconDots,
  IconFile,
  IconFlag3,
  IconHeadset,
  IconHourglass,
  IconInfoCircle,
  IconMicrophone,
  IconPhoto,
  IconPlayerPlay,
  IconQrcode,
  IconReceipt,
  IconReceipt2,
  IconShoppingCart,
  IconTicket,
  IconTrash,
  IconUserCheck,
  IconUserSearch,
  IconVideo,
  IconX
} from '@tabler/icons-react';

import {
  APPOINTMENT_KEYS,
  BOOK_RESOURCE_MODES,
  CANCEL_POLICIES,
  CRM_TEXTS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_SHOW_MODES,
  WAITLIST_PERIOD_MODES,
  WAITLIST_PRODUCT_MODES,
  bookDefault,
  ticketDefault,
  CUSTOMER_STATUS_OPTIONS,
  IDENTIFY_MODES,
  INFO_WHATS,
  INVOICE_METHODS,
  INVOICE_WHICH,
  OP_LABEL,
  ORDER_PAYMENT_OPTIONS,
  ORDER_SHOW_MODES,
  askedCustomFields,
  orderDefault,
  customerKeyMeta,
  customerKeyOf,
  fmtBRL,
  fmtMinutes,
  outputsOf,
  productLabel,
  productsFor,
  registerFieldMeta,
  toneOfHandle,
  validateMeta,
  waitLabel
} from './botModel';
import {
  NODE_META,
  TONE,
  TagChip,
  TypingDots,
  VarToken,
  WA_DARK,
  WA_GREEN,
  WaText,
  hexA,
  useBookCatalog,
  useBot,
  useTicketCatalog,
  waBg,
  waFg
} from './botUi';

const NODE_W = 284;
const HANDLE = { width: 13, height: 13, border: '2.5px solid var(--wa-handle-border, #fff)' };

// ---------------------------------------------------------------------------
// Título editável no cabeçalho (clique para renomear)
// ---------------------------------------------------------------------------
function InlineTitle({ value, onCommit, fallback }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = draft.trim().slice(0, 60);
    if (v && v !== value) onCommit(v);
  };
  if (editing) {
    return (
      <InputBase
        className="nodrag"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setDraft(value || '');
            setEditing(false);
          }
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        sx={{
          flex: 1,
          minWidth: 0,
          fontWeight: 700,
          fontSize: 13,
          color: '#fff',
          px: 0.5,
          borderRadius: 1,
          bgcolor: 'rgba(255,255,255,0.2)',
          '& input': { p: '1px 0' }
        }}
      />
    );
  }
  return (
    <Tooltip title="Clique para renomear" enterDelay={600}>
      <Typography
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        noWrap
        sx={{
          fontWeight: 700,
          fontSize: 13,
          lineHeight: 1.25,
          color: '#fff',
          cursor: 'text',
          '&:hover': { textDecoration: 'underline dotted' }
        }}
      >
        {value || fallback}
      </Typography>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Balões
// ---------------------------------------------------------------------------
function Wallpaper({ children, sx }) {
  return (
    <Box
      sx={[
        {
          px: 1.1,
          py: 1.1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.6,
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '12px 12px'
        },
        waBg('wallpaper'),
        sx
      ]}
    >
      {children}
    </Box>
  );
}

function Bubble({ children, empty, sx }) {
  return (
    <Box
      sx={[
        {
          alignSelf: 'flex-end',
          maxWidth: '94%',
          minWidth: 60,
          position: 'relative',
          borderRadius: '9px',
          borderTopRightRadius: '3px',
          px: 1,
          py: 0.65,
          fontSize: 12.5,
          lineHeight: 1.38,
          boxShadow: '0 1px 1px rgba(0,0,0,0.12)'
        },
        waBg('out'),
        waFg('text'),
        empty && { opacity: 0.75, fontStyle: 'italic' },
        sx
      ]}
    >
      {children}
    </Box>
  );
}

const clampSx = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
});

function TypingPill({ seconds }) {
  return (
    <Box
      sx={[
        {
          alignSelf: 'flex-end',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.6,
          px: 0.9,
          py: 0.3,
          borderRadius: 5,
          fontSize: 10.5,
          fontWeight: 600,
          boxShadow: '0 1px 1px rgba(0,0,0,0.08)'
        },
        waBg('in'),
        waFg('meta')
      ]}
    >
      digitando
      <TypingDots size={3.5} />
      <Box component="span" sx={{ opacity: 0.8 }}>
        {seconds}s
      </Box>
    </Box>
  );
}

function MediaPreview({ m }) {
  const kind = m.kind;
  const url = m.media?.url;
  const name = m.media?.filename;
  // Mídia com `id` mas sem URL (link assinado vencido) ainda é um arquivo válido: mostra o nome.
  if (!url && !m.media?.id) {
    const Icon = { image: IconPhoto, video: IconVideo, audio: IconMicrophone, document: IconFile }[kind] || IconFile;
    const label = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Documento' }[kind] || 'Arquivo';
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 1,
          mb: m.text ? 0.5 : 0,
          borderRadius: 1.5,
          border: '1px dashed',
          borderColor: 'rgba(0,0,0,0.25)',
          fontSize: 11.5,
          fontWeight: 600,
          opacity: 0.8
        }}
      >
        <Icon size={16} /> {label} · sem arquivo
      </Box>
    );
  }
  if (kind === 'image' && url)
    return (
      <Box
        component="img"
        src={url}
        alt=""
        draggable={false}
        sx={{ width: '100%', maxHeight: 130, objectFit: 'cover', borderRadius: 1.25, display: 'block', mb: m.text ? 0.5 : 0 }}
      />
    );
  if (kind === 'video')
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          minWidth: 170,
          aspectRatio: '16 / 9',
          borderRadius: 1.25,
          bgcolor: '#0f172a',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          mb: m.text ? 0.5 : 0,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center' }}>
          <IconPlayerPlay size={17} />
        </Box>
        {name ? (
          <Typography noWrap sx={{ position: 'absolute', left: 6, right: 6, bottom: 4, fontSize: 10, opacity: 0.8 }}>
            {name}
          </Typography>
        ) : null}
      </Box>
    );
  if (kind === 'audio')
    return (
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 176, mb: m.text ? 0.5 : 0 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: hexA(WA_DARK, 0.9),
            color: '#fff',
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <IconMicrophone size={14} />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: 20 }}>
          {Array.from({ length: 24 }).map((_, k) => (
            <Box key={k} sx={{ width: 2.5, borderRadius: 2, height: 4 + ((k * 7) % 13), bgcolor: 'currentColor', opacity: 0.45 }} />
          ))}
        </Box>
      </Stack>
    );
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ p: 0.75, borderRadius: 1.25, bgcolor: 'rgba(0,0,0,0.07)', mb: m.text ? 0.5 : 0, minWidth: 160 }}
    >
      <IconFile size={18} />
      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, maxWidth: 190 }}>
        {name || 'Documento'}
      </Typography>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Corpo por tipo
// ---------------------------------------------------------------------------
function MessageBody({ data }) {
  const msgs = data.messages || [];
  return (
    <Wallpaper>
      {msgs.map((m) => (
        <Fragment key={m.id}>
          {m.delay_seconds > 0 ? <TypingPill seconds={m.delay_seconds} /> : null}
          <Bubble empty={m.kind === 'text' && !m.text?.trim()}>
            {m.kind !== 'text' ? <MediaPreview m={m} /> : null}
            {m.text?.trim() ? (
              <Box sx={clampSx(5)}>
                <WaText text={m.text} vars />
              </Box>
            ) : m.kind === 'text' ? (
              'Mensagem vazia — clique para escrever'
            ) : null}
          </Bubble>
        </Fragment>
      ))}
    </Wallpaper>
  );
}

function TextBubble({ text, placeholder, lines = 4 }) {
  const has = Boolean(text?.trim());
  return (
    <Bubble empty={!has}>
      {has ? (
        <Box sx={clampSx(lines)}>
          <WaText text={text} vars />
        </Box>
      ) : (
        placeholder
      )}
    </Bubble>
  );
}

function MiniChip({ children, color = WA_DARK }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.4,
        px: 0.75,
        py: 0.2,
        borderRadius: 5,
        fontSize: 10.5,
        fontWeight: 700,
        color,
        bgcolor: hexA(color, 0.12),
        border: `1px solid ${hexA(color, 0.25)}`,
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </Box>
  );
}

function QuestionBody({ data }) {
  const v = validateMeta(data.validate);
  return (
    <>
      <Wallpaper>
        <TextBubble text={data.text} placeholder="Escreva a pergunta…" />
      </Wallpaper>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1.25, pt: 1 }}>
        <MiniChip color="#8B5CF6">
          <IconDeviceFloppy size={11} /> {data.var ? `{{${data.var}}}` : 'sem variável'}
        </MiniChip>
        {data.validate && data.validate !== 'any' ? <MiniChip color="#8B5CF6">✓ {v.label}</MiniChip> : null}
        {data.save_to_contact ? (
          <MiniChip color="#8B5CF6">
            <IconUserCheck size={11} /> {data.save_to_contact === 'name' ? 'nome do contato' : 'e-mail do contato'}
          </MiniChip>
        ) : null}
      </Stack>
    </>
  );
}

function CustomerRuleText({ rule }) {
  const { products, crmSettings } = useBot();
  const ck = customerKeyOf(rule.key);
  const meta = customerKeyMeta(rule.key);
  if (ck === 'status') {
    const st = CUSTOMER_STATUS_OPTIONS.find((o) => o.id === rule.value);
    return (
      <>
        Cliente {rule.op === 'is_not' ? 'não está' : 'está'} <b>{st?.label?.toLowerCase() || '…'}</b>
      </>
    );
  }
  if (ck === 'product') {
    const p = (products || []).find((x) => x.id === rule.value);
    return (
      <>
        Cliente {rule.op === 'is_not' ? 'não tem' : 'tem'} o plano <b>{p?.name || (rule.value ? 'Produto removido' : '…')}</b>
      </>
    );
  }
  if (ck === 'days_overdue' || ck === 'no_shows')
    return (
      <>
        {ck === 'no_shows' ? 'Faltas' : 'Dias em atraso'} {OP_LABEL[rule.op] || rule.op} <b>{rule.value || '…'}</b>
      </>
    );
  if (ck === 'verified' || ck === 'has_open_charge' || ck === 'has_subscription') {
    const yes = rule.value !== 'false';
    return (
      <>
        {ck === 'verified' ? (yes ? 'Documento verificado' : 'Documento não verificado') : null}
        {ck === 'has_open_charge' ? (yes ? 'Tem cobrança em aberto' : 'Não tem cobrança em aberto') : null}
        {ck === 'has_subscription' ? (yes ? 'Tem assinatura ativa' : 'Não tem assinatura ativa') : null}
      </>
    );
  }
  const key = String(rule.key || '').slice(7);
  const cf = (crmSettings?.custom_fields || []).find((f) => f.key === key);
  const needs = !['empty', 'not_empty'].includes(rule.op);
  return (
    <>
      <b>{cf?.label || key || meta.label}</b> {OP_LABEL[rule.op] || rule.op}
      {needs ? (
        <>
          {' '}
          <b>“{rule.value || '…'}”</b>
        </>
      ) : null}
    </>
  );
}

function RuleLine({ rule }) {
  const { tagsById } = useBot();
  let content;
  if (rule.source === 'tag') {
    const tag = tagsById.get(rule.key);
    content = (
      <>
        {rule.op === 'not_has' ? 'Não tem' : 'Tem'}{' '}
        {rule.key ? <TagChip tag={tag} missing={!tag} /> : <i style={{ opacity: 0.7 }}>escolha a etiqueta</i>}
      </>
    );
  } else if (rule.source === 'business_hours') {
    content = rule.op === 'closed' ? 'Fora do horário de atendimento' : 'Dentro do horário de atendimento';
  } else if (rule.source === 'contact_saved') {
    content = rule.value === 'false' ? 'Contato não está salvo na agenda' : 'Contato está salvo na agenda';
  } else if (rule.source === 'customer') {
    content = <CustomerRuleText rule={rule} />;
  } else if (rule.source === 'appointment') {
    const yes = rule.value !== 'false';
    content =
      rule.key === 'next_in_hours' ? (
        <>
          Próximo agendamento {rule.op === 'gt' ? 'daqui a mais de' : 'em até'} <b>{rule.value || '…'} h</b>
        </>
      ) : rule.key === 'has_pending' ? (
        yes ? (
          'Tem agendamento aguardando pagamento'
        ) : (
          'Não tem agendamento aguardando pagamento'
        )
      ) : yes ? (
        'Tem agendamento marcado'
      ) : (
        'Não tem agendamento marcado'
      );
    if (!APPOINTMENT_KEYS.some((k) => k.id === rule.key)) content = 'Agendamento';
  } else if (rule.source === 'ticket') {
    const yes = rule.value !== 'false';
    content =
      rule.key === 'pending_customer'
        ? yes
          ? 'Tem chamado aguardando resposta do cliente'
          : 'Não tem chamado aguardando resposta do cliente'
        : yes
          ? 'Tem chamado em andamento'
          : 'Não tem chamado em andamento';
  } else if (rule.source === 'order') {
    const yes = rule.value !== 'false';
    content =
      rule.key === 'awaiting_payment'
        ? yes
          ? 'Tem pedido aguardando o PIX'
          : 'Não tem pedido aguardando o PIX'
        : yes
          ? 'Tem pedido em andamento'
          : 'Não tem pedido em andamento';
  } else {
    const subject =
      rule.source === 'var' ? rule.key ? <VarToken name={rule.key} /> : <i style={{ opacity: 0.7 }}>variável</i> : 'Mensagem do cliente';
    const needs = !['empty', 'not_empty'].includes(rule.op);
    content = (
      <>
        {subject} {OP_LABEL[rule.op] || rule.op}
        {needs ? (
          <>
            {' '}
            <b>“{rule.value || '…'}”</b>
          </>
        ) : null}
      </>
    );
  }
  return (
    <Box
      sx={{
        px: 1,
        py: 0.6,
        borderRadius: 1.5,
        fontSize: 11.5,
        lineHeight: 1.45,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
        wordBreak: 'break-word'
      }}
    >
      {content}
    </Box>
  );
}

function ConditionBody({ data }) {
  const rules = data.rules || [];
  return (
    <Box sx={{ px: 1.25, pt: 1.1, pb: 0.25 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 0.6 }}>
        {rules.length > 1 ? (data.match === 'any' ? 'Se QUALQUER regra for verdadeira:' : 'Se TODAS as regras forem verdadeiras:') : 'Se:'}
      </Typography>
      <Stack spacing={0.5}>
        {rules.length ? rules.map((r) => <RuleLine key={r.id} rule={r} />) : <RuleLine rule={{ source: 'var', op: 'eq', key: '' }} />}
      </Stack>
    </Box>
  );
}

function TagsBody({ data }) {
  const { tagsById } = useBot();
  const add = data.add || [];
  const rem = data.remove || [];
  if (!add.length && !rem.length)
    return (
      <Typography sx={{ px: 1.25, pt: 1.1, fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Escolha as etiquetas…</Typography>
    );
  return (
    <Stack spacing={0.75} sx={{ px: 1.25, pt: 1.1 }}>
      {add.length ? (
        <Box>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary', mb: 0.4 }}>ADICIONA</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {add.map((id) => (
              <TagChip key={id} tag={tagsById.get(id)} missing={!tagsById.get(id)} prefix="+" />
            ))}
          </Stack>
        </Box>
      ) : null}
      {rem.length ? (
        <Box>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary', mb: 0.4 }}>REMOVE</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {rem.map((id) => (
              <TagChip key={id} tag={tagsById.get(id)} missing={!tagsById.get(id)} prefix="−" />
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

function WaitBody({ data }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.5, pt: 1.4, pb: 0.5 }}>
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: '#64748B',
          bgcolor: hexA('#64748B', 0.14),
          flexShrink: 0
        }}
      >
        <IconHourglass size={20} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>{waitLabel(data.amount, data.unit)}</Typography>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>de pausa, depois o bot continua</Typography>
      </Box>
    </Stack>
  );
}

function PixBody({ data }) {
  const { gateway } = useBot();
  const notReady = gateway && gateway.ready === false;
  return (
    <>
      <Wallpaper>
        {data.text?.trim() ? <TextBubble text={data.text} lines={3} /> : null}
        <Bubble>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                bgcolor: '#0D9488',
                flexShrink: 0
              }}
            >
              <IconQrcode size={19} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
                {Number(data.amount_cents) > 0 ? fmtBRL(data.amount_cents) : 'R$ —'}
              </Typography>
              <Typography noWrap sx={{ fontSize: 11, opacity: 0.75, maxWidth: 180 }}>
                {data.description?.trim() || 'Produto sem nome'}
              </Typography>
            </Box>
          </Stack>
        </Bubble>
      </Wallpaper>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1.25, pt: 1 }}>
        <MiniChip color="#0D9488">{data.send_qr ? 'Com QR Code' : 'Só copia e cola'}</MiniChip>
        <MiniChip color="#0D9488">Vale {fmtMinutes(data.expires_minutes)}</MiniChip>
      </Stack>
      {notReady ? (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mx: 1.25, mt: 1, px: 1, py: 0.6, borderRadius: 1.5, color: '#B45309', bgcolor: hexA('#F59E0B', 0.14), fontSize: 11 }}
        >
          <IconAlertTriangle size={14} />
          <span>Gateway PIX não configurado</span>
        </Stack>
      ) : null}
    </>
  );
}

function HandoffBody({ data }) {
  const { attendants } = useBot();
  const who = data.assign_user_id ? (attendants || []).find((a) => a.id === data.assign_user_id) : null;
  return (
    <>
      {data.text?.trim() ? (
        <Wallpaper>
          <TextBubble text={data.text} lines={3} />
        </Wallpaper>
      ) : null}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, pt: 1.1 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: '#2563EB',
            bgcolor: hexA('#2563EB', 0.14),
            flexShrink: 0
          }}
        >
          <IconHeadset size={16} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontWeight: 600 }}>A conversa vai para</Typography>
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>
            {data.assign_user_id ? who?.name || 'Atendente removido' : 'Fila de atendimento'}
          </Typography>
        </Box>
      </Stack>
    </>
  );
}

function EndBody({ data }) {
  return (
    <>
      {data.text?.trim() ? (
        <Wallpaper>
          <TextBubble text={data.text} lines={3} />
        </Wallpaper>
      ) : null}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, pt: 1.1 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: '#DC2626',
            bgcolor: hexA('#DC2626', 0.12),
            flexShrink: 0
          }}
        >
          {data.close ? <IconFlag3 size={16} /> : <IconCircleX size={16} />}
        </Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>
          {data.close ? 'Encerra o atendimento' : 'O bot para, mas o atendimento fica aberto'}
        </Typography>
      </Stack>
    </>
  );
}

function MenuBody({ data }) {
  const { products } = useBot();
  const isProducts = data.source === 'products';
  const list = isProducts ? productsFor(products || [], data.product_ids) : [];
  return (
    <>
      <Wallpaper>
        <TextBubble text={data.text} placeholder="Escreva o texto acima das opções…" lines={3} />
      </Wallpaper>
      {isProducts ? (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1.25, pt: 1 }}>
          <MiniChip color="#4F46E5">
            <IconCreditCard size={11} /> Produtos do catálogo
          </MiniChip>
          {products ? (
            <MiniChip color={list.length ? '#4F46E5' : '#B45309'}>
              {list.length ? `${list.length} ${list.length === 1 ? 'ativo' : 'ativos'}` : 'nenhum produto ativo'}
            </MiniChip>
          ) : null}
        </Stack>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos de Cliente (CRM)
// ---------------------------------------------------------------------------
function CrmChips({ children }) {
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1.25, pt: 1 }}>
      {children}
    </Stack>
  );
}

function CrmBubbles({ children }) {
  return <Wallpaper>{children}</Wallpaper>;
}

function IdentifyBody({ data }) {
  const { crmSettings } = useBot();
  const color = NODE_META.crm_identify.color;
  const mode = IDENTIFY_MODES.find((m) => m.id === data.mode) || IDENTIFY_MODES[0];
  const eff = data.mode === 'org' ? (crmSettings ? (crmSettings.identity?.require_doc ? 'ask_doc' : 'phone') : null) : data.mode;
  const effLabel =
    eff === 'phone'
      ? 'pelo número do WhatsApp'
      : eff === 'ask_doc'
        ? 'perguntando o CPF/CNPJ'
        : eff === 'ask_code'
          ? `perguntando o ${crmSettings?.identity?.code_label || 'código'}`
          : 'conforme a organização';
  const asks = eff === 'ask_doc' || eff === 'ask_code';
  return (
    <>
      {asks || !eff ? (
        <CrmBubbles>
          <TextBubble
            text={
              data.ask_text ||
              (eff === 'ask_code'
                ? `Qual é o seu ${crmSettings?.identity?.code_label || 'código de cliente'}?`
                : crmSettings?.identity?.ask_doc_text || 'Para continuar, me informe o seu CPF ou CNPJ (só números).')
            }
            lines={3}
          />
        </CrmBubbles>
      ) : (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, pt: 1.1 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color,
              bgcolor: hexA(color, 0.14),
              flexShrink: 0
            }}
          >
            <IconUserSearch size={16} />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>
            Reconhece o cliente pelo número, sem perguntar nada
          </Typography>
        </Stack>
      )}
      <CrmChips>
        <MiniChip color={color}>{data.mode === 'org' ? `Org · ${effLabel}` : mode.label}</MiniChip>
        {asks ? <MiniChip color={color}>{data.retries || 3} tentativas</MiniChip> : null}
      </CrmChips>
    </>
  );
}

function FieldsBody({ data, color, intro }) {
  const { crmSettings } = useBot();
  const fields = data.fields || [];
  const customFields = crmSettings?.custom_fields || [];
  return (
    <>
      {intro ? (
        <CrmBubbles>
          <TextBubble text={intro} lines={2} />
        </CrmBubbles>
      ) : null}
      <Box sx={{ px: 1.25, pt: 1 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>PERGUNTA, NA ORDEM</Typography>
        {fields.length ? (
          <Stack spacing={0.4}>
            {fields.slice(0, 6).map((f, i) => {
              const meta = registerFieldMeta(f.key, customFields);
              return (
                <Stack key={f.id || f.key} direction="row" spacing={0.75} alignItems="center">
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      color,
                      bgcolor: hexA(color, 0.14),
                      flexShrink: 0
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, minWidth: 0, flex: 1 }}>
                    {f.label || meta.label}
                  </Typography>
                  {f.required === false ? <MiniChip color="#64748B">opcional</MiniChip> : null}
                </Stack>
              );
            })}
            {fields.length > 6 ? (
              <Typography sx={{ fontSize: 11, color: 'text.secondary', pl: 3.25 }}>+ {fields.length - 6} campos</Typography>
            ) : null}
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Nenhum campo — clique para adicionar</Typography>
        )}
      </Box>
      <CrmChips>
        <MiniChip color={color}>{data.confirm !== false ? 'Confirma antes de salvar' : 'Salva sem confirmar'}</MiniChip>
      </CrmChips>
    </>
  );
}
const RegisterBody = ({ data }) => <FieldsBody data={data} color={NODE_META.crm_register.color} intro={data.intro_text} />;
const UpdateBody = ({ data }) => <FieldsBody data={data} color={NODE_META.crm_update.color} />;

function ProductChip({ id, color }) {
  const { products } = useBot();
  const p = (products || []).find((x) => x.id === id);
  if (!products) return <MiniChip color={color}>Produto…</MiniChip>;
  return <MiniChip color={p ? color : '#B45309'}>{p ? productLabel(p) : 'Produto removido'}</MiniChip>;
}

function SubscribeBody({ data }) {
  const { products, gateway } = useBot();
  const color = NODE_META.crm_subscribe.color;
  const pid = data.product_id || 'choose';
  const list = pid === 'choose' ? productsFor(products || [], data.product_ids) : [];
  const notReady = data.charge_now !== false && data.method !== 'boleto' && gateway && gateway.ready === false;
  return (
    <>
      <CrmBubbles>
        {pid === 'choose' ? (
          <Bubble>
            <Box sx={clampSx(2)}>
              <WaText text={data.choose_text || CRM_TEXTS.subscribe.choose_text} vars />
            </Box>
            <Box sx={{ mt: 0.5, fontSize: 11.5, opacity: 0.85 }}>
              {products ? (
                list.length ? (
                  list.slice(0, 4).map((p, i) => <div key={p.id}>{`${i + 1}. ${productLabel(p)}`}</div>)
                ) : (
                  <i>nenhum produto ativo</i>
                )
              ) : (
                <i>carregando produtos…</i>
              )}
              {list.length > 4 ? <div>…</div> : null}
            </Box>
          </Bubble>
        ) : null}
        <TextBubble text={data.confirm_text || CRM_TEXTS.subscribe.confirm_text} lines={3} />
      </CrmBubbles>
      <CrmChips>
        {pid === 'choose' ? (
          <MiniChip color={color}>Cliente escolhe o plano</MiniChip>
        ) : pid === 'from_var' ? (
          <MiniChip color={color}>Plano do menu anterior</MiniChip>
        ) : (
          <ProductChip id={pid} color={color} />
        )}
        <MiniChip color={color}>{data.method === 'ask' ? 'PIX ou boleto' : data.method === 'boleto' ? 'Boleto' : 'PIX'}</MiniChip>
        {data.charge_now === false ? <MiniChip color="#64748B">Sem cobrar agora</MiniChip> : null}
      </CrmChips>
      {notReady ? (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mx: 1.25, mt: 1, px: 1, py: 0.6, borderRadius: 1.5, color: '#B45309', bgcolor: hexA('#F59E0B', 0.14), fontSize: 11 }}
        >
          <IconAlertTriangle size={14} />
          <span>Gateway PIX não configurado</span>
        </Stack>
      ) : null}
    </>
  );
}

function InfoBody({ data }) {
  const color = NODE_META.crm_info.color;
  const what = INFO_WHATS.find((w) => w.id === data.what) || INFO_WHATS[0];
  const text = data.what === 'custom' ? data.template : data.template || CRM_TEXTS.info[data.what] || CRM_TEXTS.info.status;
  return (
    <>
      <CrmBubbles>
        <TextBubble text={text} placeholder="Escreva o texto com as variáveis do cliente…" lines={5} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{what.label}</MiniChip>
      </CrmChips>
    </>
  );
}

function InvoiceBody({ data }) {
  const color = NODE_META.crm_invoice.color;
  const which = INVOICE_WHICH.find((w) => w.id === data.which) || INVOICE_WHICH[0];
  const method = INVOICE_METHODS.find((m) => m.id === data.method) || INVOICE_METHODS[0];
  return (
    <>
      <CrmBubbles>
        <Bubble>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                bgcolor: color,
                flexShrink: 0
              }}
            >
              <IconReceipt2 size={19} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>Reenvia a cobrança</Typography>
              <Typography noWrap sx={{ fontSize: 11, opacity: 0.75, maxWidth: 180 }}>
                {which.label}
              </Typography>
            </Box>
          </Stack>
        </Bubble>
        <TextBubble text={data.sent_text || CRM_TEXTS.invoice.sent_text} lines={2} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{method.label}</MiniChip>
      </CrmChips>
    </>
  );
}

function CancelBody({ data }) {
  const color = NODE_META.crm_cancel.color;
  const policy = CANCEL_POLICIES.find((p) => p.id === data.policy) || CANCEL_POLICIES[0];
  const reasons = data.reasons || [];
  return (
    <>
      <CrmBubbles>
        {data.ask_reason !== false ? <TextBubble text={data.reason_text || CRM_TEXTS.cancel.reason_text} lines={2} /> : null}
        {data.retention_text?.trim() ? <TextBubble text={data.retention_text} lines={3} /> : null}
        <TextBubble text={data.confirm_text || CRM_TEXTS.cancel.confirm_text} lines={3} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{policy.label}</MiniChip>
        {data.ask_reason !== false ? (
          <MiniChip color={color}>{reasons.length ? `${reasons.length} motivos` : 'Motivos da org'}</MiniChip>
        ) : null}
        {data.retention_text?.trim() ? <MiniChip color="#16A34A">Com retenção</MiniChip> : null}
      </CrmChips>
    </>
  );
}

function PauseBody({ data }) {
  const color = NODE_META.crm_pause.color;
  return (
    <>
      <CrmBubbles>
        {data.ask_until !== false ? (
          <TextBubble
            text={(data.ask_text || CRM_TEXTS.pause.ask_text).replace(/\{\{\s*max_dias\s*\}\}/g, String(data.max_days || 30))}
            lines={2}
          />
        ) : null}
        <TextBubble text={data.paused_text || CRM_TEXTS.pause.paused_text} lines={2} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>
          {data.ask_until !== false
            ? `Cliente escolhe (até ${data.max_days || 30} dias)`
            : `${data.days || data.max_days || 30} dias fixos`}
        </MiniChip>
      </CrmChips>
    </>
  );
}

function ChangePlanBody({ data }) {
  const { products } = useBot();
  const color = NODE_META.crm_change_plan.color;
  const list = productsFor(products || [], data.product_ids);
  return (
    <>
      <CrmBubbles>
        <Bubble>
          <Box sx={clampSx(2)}>
            <WaText text={data.choose_text || CRM_TEXTS.change_plan.choose_text} vars />
          </Box>
          <Box sx={{ mt: 0.5, fontSize: 11.5, opacity: 0.85 }}>
            {products ? (
              list.length ? (
                list.slice(0, 4).map((p, i) => <div key={p.id}>{`${i + 1}. ${productLabel(p)}`}</div>)
              ) : (
                <i>nenhum produto ativo</i>
              )
            ) : (
              <i>carregando produtos…</i>
            )}
            {list.length > 4 ? <div>…</div> : null}
          </Box>
        </Bubble>
        <TextBubble text={data.changed_text || CRM_TEXTS.change_plan.changed_text} lines={2} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>
          {(data.product_ids || []).length ? `${(data.product_ids || []).length} planos permitidos` : 'Qualquer plano ativo'}
        </MiniChip>
        <MiniChip color={color}>{data.confirm !== false ? 'Confirma antes' : 'Sem confirmação'}</MiniChip>
      </CrmChips>
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos de Agenda (Fase 6)
// ---------------------------------------------------------------------------
const bt = (type, data, key) => String(data?.texts?.[key] || '').trim() || bookDefault(type, key);

function AgendaHead({ color, Icon, title, sub }) {
  return (
    <Bubble>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            bgcolor: color,
            flexShrink: 0
          }}
        >
          <Icon size={19} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>{title}</Typography>
          {sub ? (
            <Typography noWrap sx={{ fontSize: 11, opacity: 0.75, maxWidth: 180 }}>
              {sub}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Bubble>
  );
}

function BookServiceBody({ data }) {
  const { services, resources } = useBookCatalog();
  const color = NODE_META.book_service.color;
  const ids = data.services || [];
  const names = ids.map((id) => (services || []).find((x) => x.id === id)?.name || (services ? 'Serviço removido' : '…'));
  const mode = BOOK_RESOURCE_MODES.find((m) => m.id === data.resource);
  const fixed = !mode ? (resources || []).find((r) => r.id === data.resource)?.name || 'Profissional removido' : null;
  return (
    <>
      <CrmBubbles>
        <AgendaHead
          color={color}
          Icon={IconCalendarPlus}
          title="Agenda um serviço"
          sub={ids.length ? names.join(', ') : 'Todos os serviços'}
        />
        <TextBubble text={bt('book_service', data, 'choose_day')} lines={2} />
        <Bubble>
          <Typography sx={{ fontSize: 11.5, opacity: 0.85 }}>1️⃣ qua 15/10 · 6 horários</Typography>
          <Typography sx={{ fontSize: 11.5, opacity: 0.85 }}>2️⃣ qui 16/10 · 4 horários</Typography>
        </Bubble>
        <TextBubble text={bt('book_service', data, 'booked')} lines={2} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{fixed ? `Com ${fixed}` : mode?.id === 'ask' ? 'Pergunta com quem' : 'Profissional automático'}</MiniChip>
        <MiniChip color={color}>{`${data.days_ahead || 14} dias`}</MiniChip>
        {data.confirm === false ? <MiniChip color={color}>Sem confirmação</MiniChip> : null}
      </CrmChips>
    </>
  );
}

function MyAppointmentsBody({ data }) {
  const color = NODE_META.my_appointments.color;
  const acts = [
    data.allow_confirm !== false ? 'Confirmar' : null,
    data.allow_reschedule !== false ? 'Remarcar' : null,
    data.allow_cancel !== false ? 'Cancelar' : null
  ].filter(Boolean);
  return (
    <>
      <CrmBubbles>
        <AgendaHead color={color} Icon={IconCalendarEvent} title="Próximos agendamentos" sub="do contato e dos clientes dele" />
        <TextBubble text={bt('my_appointments', data, 'choose_action')} lines={3} />
      </CrmBubbles>
      <CrmChips>
        {acts.length ? (
          acts.map((a) => (
            <MiniChip key={a} color={color}>
              {a}
            </MiniChip>
          ))
        ) : (
          <MiniChip color={color}>Só mostra</MiniChip>
        )}
      </CrmChips>
    </>
  );
}

function WaitlistBody({ data }) {
  const { services } = useBookCatalog();
  const color = NODE_META.waitlist_join.color;
  const pm = WAITLIST_PRODUCT_MODES.find((m) => m.id === data.product_id);
  const svc = pm ? null : (services || []).find((x) => x.id === data.product_id)?.name || (services ? 'Serviço removido' : '…');
  const per = WAITLIST_PERIOD_MODES.find((m) => m.id === data.period) || WAITLIST_PERIOD_MODES[0];
  return (
    <>
      <CrmBubbles>
        <AgendaHead
          color={color}
          Icon={IconClockPlus}
          title="Entra na lista de espera"
          sub={svc || (pm?.id === 'ask' ? 'Pergunta o serviço' : 'Serviço do "Agendar"')}
        />
        {data.period === 'ask' ? <TextBubble text={bt('waitlist_join', data, 'choose_period')} lines={2} /> : null}
        <TextBubble text={bt('waitlist_join', data, 'done')} lines={2} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{per.label}</MiniChip>
        <MiniChip color={color}>{`${data.days_ahead || 14} dias`}</MiniChip>
      </CrmChips>
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos de Chamados (Fase 6B)
// ---------------------------------------------------------------------------
const tkt = (type, data, key) => String(data?.texts?.[key] || '').trim() || ticketDefault(type, key);

function OpenTicketBody({ data }) {
  const { categories } = useTicketCatalog();
  const color = NODE_META.open_ticket.color;
  const ask = (data.category || 'ask') === 'ask';
  const cat = ask ? null : (categories || []).find((c) => c.key === data.category);
  const catLabel = ask ? 'Pergunta a categoria' : cat ? cat.label : categories ? 'Categoria removida' : data.category;
  const prio = TICKET_PRIORITY_OPTIONS.find((o) => o.id === (data.priority || 'default'));
  return (
    <>
      <CrmBubbles>
        <AgendaHead color={color} Icon={IconTicket} title="Abre um chamado" sub={catLabel} />
        {ask ? <TextBubble text={tkt('open_ticket', data, 'choose_category')} lines={2} /> : null}
        <TextBubble text={tkt('open_ticket', data, 'ask_description')} lines={2} />
        <TextBubble text={tkt('open_ticket', data, 'created')} lines={3} />
      </CrmBubbles>
      <CrmChips>
        {data.ask_subject ? <MiniChip color={color}>Pergunta o assunto</MiniChip> : null}
        <MiniChip color={color}>{data.ask_photo !== false ? 'Aceita até 3 fotos' : 'Sem fotos'}</MiniChip>
        {prio && prio.id !== 'default' ? <MiniChip color={color}>{`Prioridade ${prio.label.toLowerCase()}`}</MiniChip> : null}
        {!ask && categories && cat && cat.active === false ? <MiniChip color="#DC2626">Categoria desativada</MiniChip> : null}
      </CrmChips>
    </>
  );
}

function MyTicketsBody({ data }) {
  const color = NODE_META.my_tickets.color;
  const show = TICKET_SHOW_MODES.find((m) => m.id === data.show) || TICKET_SHOW_MODES[0];
  return (
    <>
      <CrmBubbles>
        <AgendaHead color={color} Icon={IconClipboardList} title="Chamados do contato" sub={show.label} />
        <TextBubble text={tkt('my_tickets', data, 'details')} lines={3} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{data.allow_add_info !== false ? 'Enviar mais informações' : 'Só consulta'}</MiniChip>
        <MiniChip color={color}>Protocolo digitado</MiniChip>
      </CrmChips>
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos de Pedidos (Fase 7)
// ---------------------------------------------------------------------------
const ord = (type, data, key) => String(data?.texts?.[key] || '').trim() || orderDefault(type, key);

function OrderCartBody({ data }) {
  const { customFieldMap } = useBot();
  const color = NODE_META.order_cart.color;
  const all = data.categories === 'all' || data.categories == null;
  const cats = Array.isArray(data.categories) ? data.categories : [];
  const sub = all ? 'Todas as categorias' : cats.length ? cats.join(', ') : 'Nenhuma categoria escolhida';
  const pay = ORDER_PAYMENT_OPTIONS.find((o) => o.id === (data.payment || 'ask')) || ORDER_PAYMENT_OPTIONS[0];
  const recv = [data.allow_delivery !== false ? 'Entrega' : null, data.allow_pickup !== false ? 'Retirada' : null].filter(Boolean);
  const asked = askedCustomFields(customFieldMap, 'order');
  return (
    <>
      <CrmBubbles>
        <AgendaHead color={color} Icon={IconShoppingCart} title="Monta um pedido" sub={sub} />
        <TextBubble text={ord('order_cart', data, 'choose_product')} lines={2} />
        <Bubble>
          <Typography sx={{ fontSize: 11.5, opacity: 0.85 }}>1. X-Burguer · R$ 25,00</Typography>
          <Typography sx={{ fontSize: 11.5, opacity: 0.85 }}>2. X-Salada · R$ 28,00</Typography>
          <Typography sx={{ fontSize: 11.5, opacity: 0.85 }}>3. 🛒 Ver carrinho</Typography>
        </Bubble>
        <TextBubble text={ord('order_cart', data, 'summary')} lines={3} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{all ? 'Categorias: todas' : `${cats.length} ${cats.length === 1 ? 'categoria' : 'categorias'}`}</MiniChip>
        {recv.length ? (
          <MiniChip color={color}>{recv.join(' + ')}</MiniChip>
        ) : (
          <MiniChip color="#DC2626">Sem entrega nem retirada</MiniChip>
        )}
        <MiniChip color={color}>
          {pay.id === 'ask' ? 'Pagamento: pergunta' : pay.id === 'pix' ? 'Pagamento: PIX' : 'Pagamento: na entrega'}
        </MiniChip>
        {data.ask_notes ? <MiniChip color={color}>Pede observação</MiniChip> : null}
        {asked.length ? (
          <MiniChip color={color}>{`Pergunta ${asked.length} ${asked.length === 1 ? 'campo' : 'campos'} do pedido`}</MiniChip>
        ) : null}
      </CrmChips>
    </>
  );
}

function MyOrdersBody({ data }) {
  const color = NODE_META.my_orders.color;
  const show = ORDER_SHOW_MODES.find((m) => m.id === data.show) || ORDER_SHOW_MODES[0];
  return (
    <>
      <CrmBubbles>
        <AgendaHead color={color} Icon={IconReceipt} title="Pedidos do contato" sub={show.label} />
        <TextBubble text={ord('my_orders', data, 'details')} lines={3} />
      </CrmBubbles>
      <CrmChips>
        <MiniChip color={color}>{show.id === 'all' ? 'Todos (últimos 5)' : 'Em andamento'}</MiniChip>
      </CrmChips>
    </>
  );
}

const BODY = {
  message: MessageBody,
  menu: MenuBody,
  question: QuestionBody,
  condition: ConditionBody,
  tags: TagsBody,
  wait: WaitBody,
  pix: PixBody,
  handoff: HandoffBody,
  end: EndBody,
  crm_identify: IdentifyBody,
  crm_register: RegisterBody,
  crm_subscribe: SubscribeBody,
  crm_info: InfoBody,
  crm_invoice: InvoiceBody,
  crm_cancel: CancelBody,
  crm_pause: PauseBody,
  crm_change_plan: ChangePlanBody,
  crm_update: UpdateBody,
  book_service: BookServiceBody,
  my_appointments: MyAppointmentsBody,
  waitlist_join: WaitlistBody,
  open_ticket: OpenTicketBody,
  my_tickets: MyTicketsBody,
  order_cart: OrderCartBody,
  my_orders: MyOrdersBody
};

// ---------------------------------------------------------------------------
// Nó genérico
// ---------------------------------------------------------------------------
function OutputRow({ out, first }) {
  const color = TONE[out.tone] || TONE.neutral;
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 0.75,
        pl: 1.25,
        pr: 1.6,
        py: 0.6,
        borderTop: first ? 'none' : '1px dashed',
        borderColor: 'divider'
      }}
    >
      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 700, color: out.tone === 'neutral' ? 'text.primary' : color, minWidth: 0 }}>
        {out.label}
      </Typography>
      <Handle
        type="source"
        position={Position.Right}
        id={out.id}
        className="wa-port"
        style={{ ...HANDLE, background: color, right: -8, top: '50%' }}
      />
    </Box>
  );
}

function IssueBadge({ issues }) {
  if (!issues?.length) return null;
  const hasError = issues.some((i) => i.level === 'error');
  const onlyInfo = issues.every((i) => i.level === 'info');
  return (
    <Tooltip
      title={
        <Box sx={{ py: 0.25 }}>
          {issues.map((i) => (
            <Typography key={i.id} sx={{ fontSize: 12, lineHeight: 1.45 }}>
              • {i.text}
            </Typography>
          ))}
        </Box>
      }
      placement="top"
    >
      <Box
        className="nodrag"
        sx={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: hasError ? '#DC2626' : onlyInfo ? '#2563EB' : '#F59E0B',
          color: '#fff',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.85)'
        }}
      >
        {onlyInfo ? <IconInfoCircle size={13} stroke={2.4} /> : <IconAlertTriangle size={13} stroke={2.4} />}
      </Box>
    </Tooltip>
  );
}

function BotNode({ id, type, data, selected }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { settings, products, issuesByNode, simNodeId, actions } = useBot();
  const [menuEl, setMenuEl] = useState(null);
  const meta = NODE_META[type] || NODE_META.message;
  const Icon = meta.icon;
  const outputs = useMemo(() => outputsOf(type, data, settings, products), [type, data, settings, products]);
  const outKey = outputs.map((o) => o.id).join('|');
  const issues = issuesByNode?.[id];
  const Body = BODY[type];
  const isSim = simNodeId === id;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outKey, updateNodeInternals]);

  return (
    <Box
      className={isSim ? 'wa-sim-current' : undefined}
      sx={[
        {
          width: NODE_W,
          borderRadius: '16px',
          bgcolor: 'background.paper',
          border: '1.5px solid',
          borderColor: selected ? meta.color : 'divider',
          position: 'relative',
          transition: 'box-shadow .15s, border-color .15s',
          boxShadow: selected
            ? `0 0 0 4px ${hexA(meta.color, 0.2)}, 0 14px 30px ${hexA(meta.color, 0.26)}`
            : '0 2px 10px rgba(15,23,42,0.10)'
        },
        !selected && ((t) => t.applyStyles('dark', { boxShadow: '0 2px 14px rgba(0,0,0,0.55)' }))
      ]}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="wa-port"
        style={{ ...HANDLE, background: '#94A3B8', left: -8, top: 23 }}
      />

      {/* cabeçalho */}
      <Box
        sx={{
          px: 1.1,
          py: 0.8,
          minHeight: 46,
          display: 'flex',
          alignItems: 'center',
          gap: 0.9,
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          bgcolor: meta.color,
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(0,0,0,0.10))',
          color: '#fff'
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.75,
            bgcolor: 'rgba(255,255,255,0.22)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <Icon size={16} stroke={2} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85, lineHeight: 1.2 }}
            noWrap
          >
            {meta.label}
          </Typography>
          <InlineTitle value={data.title} fallback={meta.label} onCommit={(v) => actions.onTitleChange?.(id, v)} />
        </Box>
        <IssueBadge issues={issues} />
        <IconButton
          className="nodrag"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuEl(e.currentTarget);
          }}
          sx={{ color: '#fff', p: 0.35, mr: -0.4, '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
        >
          <IconDots size={16} />
        </IconButton>
      </Box>

      {/* corpo */}
      {Body ? <Body data={data} /> : null}

      {/* saídas */}
      {outputs.length ? (
        <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pb: 0.25 }}>
          {outputs.map((o, i) => (
            <OutputRow key={o.id} out={o} first={i === 0} />
          ))}
        </Box>
      ) : (
        <Stack
          direction="row"
          spacing={0.6}
          alignItems="center"
          sx={{ mt: 1.1, px: 1.25, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.disabled' }} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>O bot para aqui</Typography>
        </Stack>
      )}

      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem
          onClick={() => {
            setMenuEl(null);
            actions.onDuplicate?.(id);
          }}
        >
          <IconCopy size={16} style={{ marginRight: 8 }} /> Duplicar
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setMenuEl(null);
            actions.onDelete?.(id);
          }}
        >
          <IconTrash size={16} style={{ marginRight: 8 }} /> Excluir
        </MenuItem>
      </Menu>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
function StartNode({ id, selected }) {
  const { settings, issuesByNode, simNodeId } = useBot();
  const trig = settings?.trigger;
  const aud = settings?.audience;
  const sub =
    trig?.mode === 'keywords'
      ? trig.keywords?.length
        ? `Se contiver: ${trig.keywords.slice(0, 3).join(', ')}${trig.keywords.length > 3 ? '…' : ''}`
        : 'Só com palavras-chave (nenhuma definida)'
      : 'Qualquer mensagem';
  const audLabel = aud?.mode === 'test' ? 'Modo teste' : aud?.mode === 'tags' ? 'Só com etiquetas' : null;
  const issues = issuesByNode?.[id];
  return (
    <Box
      className={simNodeId === id ? 'wa-sim-current' : undefined}
      sx={{
        width: 214,
        px: 1.5,
        py: 1.25,
        borderRadius: '18px',
        color: '#fff',
        background: `linear-gradient(135deg, ${WA_GREEN} 0%, ${WA_DARK} 100%)`,
        position: 'relative',
        transition: 'box-shadow .15s',
        boxShadow: selected ? `0 0 0 4px ${hexA(WA_GREEN, 0.3)}, 0 12px 28px ${hexA(WA_DARK, 0.45)}` : `0 8px 20px ${hexA(WA_DARK, 0.35)}`
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.22)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <IconPlayerPlay size={16} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>Cliente mandou mensagem</Typography>
          <Typography noWrap sx={{ fontSize: 11, opacity: 0.88 }}>
            {sub}
          </Typography>
        </Box>
        <IssueBadge issues={issues} />
      </Stack>
      {audLabel ? (
        <Box
          sx={{
            mt: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.9,
            py: 0.2,
            borderRadius: 5,
            bgcolor: 'rgba(255,255,255,0.2)',
            fontSize: 10.5,
            fontWeight: 700
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FDE68A' }} />
          {audLabel}
        </Box>
      ) : null}
      <Handle type="source" position={Position.Right} id="out" className="wa-port" style={{ ...HANDLE, background: '#fff', right: -8 }} />
    </Box>
  );
}

export const nodeTypes = {
  start: StartNode,
  message: BotNode,
  menu: BotNode,
  question: BotNode,
  condition: BotNode,
  tags: BotNode,
  wait: BotNode,
  pix: BotNode,
  handoff: BotNode,
  end: BotNode,
  crm_identify: BotNode,
  crm_register: BotNode,
  crm_subscribe: BotNode,
  crm_info: BotNode,
  crm_invoice: BotNode,
  crm_cancel: BotNode,
  crm_pause: BotNode,
  crm_change_plan: BotNode,
  crm_update: BotNode,
  book_service: BotNode,
  my_appointments: BotNode,
  waitlist_join: BotNode,
  open_ticket: BotNode,
  my_tickets: BotNode,
  order_cart: BotNode,
  my_orders: BotNode
};

// ---------------------------------------------------------------------------
// Aresta: bezier colorida pelo tipo da saída + ponto animado + excluir
// ---------------------------------------------------------------------------
function WaEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, sourceHandleId }) {
  const { actions } = useBot();
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.32 });
  const tone = toneOfHandle(sourceHandleId);
  const color = TONE[tone] || TONE.neutral;
  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={18} style={{ pointerEvents: 'stroke' }} />
      <path
        id={id}
        d={path}
        markerEnd={markerEnd}
        fill="none"
        className="react-flow__edge-path"
        style={{
          stroke: color,
          strokeWidth: selected ? 3.2 : 2.2,
          strokeDasharray: tone === 'bad' ? '6 5' : undefined,
          opacity: selected ? 1 : 0.9
        }}
      />
      <circle r={3.4} fill={color} className="wa-edge-dot">
        <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
      </circle>
      {selected ? (
        <EdgeLabelRenderer>
          <Tooltip title="Remover conexão">
            <Box
              className="nodrag nopan"
              onClick={(e) => {
                e.stopPropagation();
                actions.onDeleteEdge?.(id);
              }}
              sx={{
                position: 'absolute',
                pointerEvents: 'all',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                bgcolor: 'error.main',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              <IconX size={13} />
            </Box>
          </Tooltip>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const edgeTypes = { wa: WaEdge };

// ---------------------------------------------------------------------------
// Estilos globais do construtor
// ---------------------------------------------------------------------------
export function BotFlowStyles() {
  return (
    <style>{`
      :root { --wa-accent: #128C7E; --wa-token: #0B6B61; --wa-warn: #B45309; --wa-ok: #15803D; }
      [data-color-scheme='dark'] { --wa-accent: #25D366; --wa-token: #A7F3D0; --wa-warn: #FBBF24; --wa-ok: #4ADE80; }
      @keyframes waDot { 0%,60%,100% { opacity:.3; transform:translateY(0); } 30% { opacity:1; transform:translateY(-2px); } }
      .wa-typing-dot { animation: waDot 1.2s infinite ease-in-out; }
      .react-flow__handle.wa-port { transition: box-shadow .12s ease, transform .12s ease; }
      .react-flow__handle.wa-port:hover { box-shadow: 0 0 0 5px ${hexA(WA_GREEN, 0.25)}; }
      .react-flow__handle.wa-port.connectingfrom, .react-flow__handle.wa-port.connectingto { box-shadow: 0 0 0 5px ${hexA(WA_GREEN, 0.35)}; }
      .wa-edge-dot { filter: drop-shadow(0 0 2px ${hexA(WA_GREEN, 0.6)}); }
      .react-flow__node.selected, .react-flow__node:focus, .react-flow__node:focus-visible { outline: none; }
      @keyframes waSimPulse { 0% { box-shadow: 0 0 0 0 ${hexA(WA_GREEN, 0.55)}; } 70% { box-shadow: 0 0 0 14px ${hexA(WA_GREEN, 0)}; } 100% { box-shadow: 0 0 0 0 ${hexA(WA_GREEN, 0)}; } }
      .wa-sim-current { animation: waSimPulse 1.6s infinite; outline: 2.5px solid ${WA_GREEN}; outline-offset: 3px; }
      .wa-drop-hint { animation: waDot 1.4s infinite ease-in-out; }
      .react-flow__controls { border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,.18); border: 1px solid var(--wa-ctrl-border); }
      .react-flow__controls-button { background: var(--wa-ctrl-bg); color: var(--wa-ctrl-fg); border-bottom: 1px solid var(--wa-ctrl-border); }
      .react-flow__controls-button:hover { background: var(--wa-ctrl-hover); }
      .react-flow__controls-button svg { fill: currentColor; }
      @media (max-width: 599.95px) {
        .react-flow__controls { bottom: 12px; left: 12px; }
        .react-flow__controls-button { width: 42px; height: 42px; }
        .react-flow__controls-button svg { max-width: 18px; max-height: 18px; width: 18px; height: 18px; }
      }
      .react-flow__connectionline path, .react-flow__connection-path { stroke: ${WA_GREEN}; stroke-width: 2.4; stroke-dasharray: 6 5; }
    `}</style>
  );
}
