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
  IconCircleX,
  IconCopy,
  IconDeviceFloppy,
  IconDots,
  IconFile,
  IconFlag3,
  IconHeadset,
  IconHourglass,
  IconMicrophone,
  IconPhoto,
  IconPlayerPlay,
  IconQrcode,
  IconTrash,
  IconUserCheck,
  IconVideo,
  IconX
} from '@tabler/icons-react';

import { OP_LABEL, fmtBRL, fmtMinutes, outputsOf, toneOfHandle, validateMeta, waitLabel } from './botModel';
import { NODE_META, TONE, TagChip, TypingDots, VarToken, WA_DARK, WA_GREEN, WaText, hexA, useBot, waBg, waFg } from './botUi';

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
  if (!url) {
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
  if (kind === 'image')
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
  return (
    <Wallpaper>
      <TextBubble text={data.text} placeholder="Escreva o texto acima das opções…" lines={3} />
    </Wallpaper>
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
  end: EndBody
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
          bgcolor: hasError ? '#DC2626' : '#F59E0B',
          color: '#fff',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.85)'
        }}
      >
        <IconAlertTriangle size={13} stroke={2.4} />
      </Box>
    </Tooltip>
  );
}

function BotNode({ id, type, data, selected }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { settings, issuesByNode, simNodeId, actions } = useBot();
  const [menuEl, setMenuEl] = useState(null);
  const meta = NODE_META[type] || NODE_META.message;
  const Icon = meta.icon;
  const outputs = useMemo(() => outputsOf(type, data, settings), [type, data, settings]);
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
  end: BotNode
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
