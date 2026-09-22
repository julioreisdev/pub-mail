// =============================================================================
// Telegram — Fluxo Inicial: componentes visuais do construtor (nível Typebot).
// Só UI/presentation + helpers puros do fluxo. NÃO muda o contrato do back:
//   node.data = { title, messages:[{id,text,media,delay_seconds}],
//                 buttons:[{id,label,action,url}], answers:[{id,keyword}], apply_tags:[] }
//   edges keyed by sourceHandle ('out', 'btn-<id>', 'ans-<id>', 'fallback')
// Dark-mode via theme.vars / applyStyles (NUNCA alpha(theme.palette…)).
// =============================================================================
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EdgeLabelRenderer, Handle, Position, getBezierPath, useUpdateNodeInternals } from 'reactflow';
import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    InputBase,
    Menu,
    MenuItem,
    Popover,
    Select,
    Slider,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import {
    IconArrowRight,
    IconClick,
    IconClock,
    IconCopy,
    IconCreditCard,
    IconDots,
    IconExternalLink,
    IconFile,
    IconKeyboard,
    IconLink,
    IconMessage2,
    IconMicrophone,
    IconPhoto,
    IconPlayerPlay,
    IconPlus,
    IconRobot,
    IconTag,
    IconTrash,
    IconUsersGroup,
    IconVariable,
    IconVideo,
    IconWorld,
    IconX
} from '@tabler/icons-react';

import { TG_GRADIENT } from './index';
import TelegramMediaField from '../TelegramMediaField';
import TelegramLinkPicker from '../TelegramLinkPicker';
import SearchSelect from '../SearchSelect';
import { get } from '../../../../api/api';

const BRAND = '#229ED9';
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const tint = (t, token, a) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;

export const BTN_ACTIONS = {
    next: { label: 'Próximo passo', icon: IconArrowRight },
    url: { label: 'Abrir link', icon: IconWorld },
    group: { label: 'Entrar no grupo', icon: IconUsersGroup },
    bot: { label: 'Ir para outro bot', icon: IconRobot },
    plan: { label: 'Vender plano (checkout PIX)', icon: IconCreditCard }
};

// ---- normalização (compat: {text,media} legado → lista de 1) ----------------
export function nodeMessages(data) {
    if (Array.isArray(data?.messages) && data.messages.length) return data.messages;
    return [{ id: 'm0', text: data?.text || '', media: data?.media || null, delay_seconds: data?.delay_seconds || 0 }];
}

// =============== BLOCOS (paleta arrastável) ==================================
const MEDIA_FOR = { image: 'photo', video: 'video', audio: 'voice', document: 'document' };
const BLOCK_TITLE = {
    text: 'Mensagem',
    image: 'Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    document: 'Documento',
    delay: 'Digitando…',
    buttons: 'Com botões',
    answers: 'Pergunta',
    tag: 'Aplicar tag',
    redirect: 'Redirecionar',
    plan: 'Vender plano'
};

export const TG_BLOCK_GROUPS = [
    {
        group: 'Mensagens',
        token: 'primary',
        items: [
            { type: 'text', label: 'Texto', icon: IconMessage2 },
            { type: 'image', label: 'Imagem', icon: IconPhoto },
            { type: 'video', label: 'Vídeo', icon: IconVideo },
            { type: 'audio', label: 'Áudio', icon: IconMicrophone },
            { type: 'document', label: 'Documento', icon: IconFile },
            { type: 'delay', label: 'Atraso / Digitando…', icon: IconClock }
        ]
    },
    {
        group: 'Entradas',
        token: 'warning',
        items: [
            { type: 'buttons', label: 'Botões', icon: IconClick },
            { type: 'answers', label: 'Resposta por texto', icon: IconKeyboard }
        ]
    },
    {
        group: 'Lógica',
        token: 'secondary',
        items: [
            { type: 'tag', label: 'Aplicar tag', icon: IconTag },
            { type: 'redirect', label: 'Redirecionar', icon: IconExternalLink }
        ]
    },
    {
        group: 'Vendas',
        token: 'success',
        items: [{ type: 'plan', label: 'Vender plano (checkout)', icon: IconCreditCard }]
    }
];

const emptyMsg = () => ({ id: uid('m'), text: '', media: null, delay_seconds: 0 });

// Adiciona um bloco a um nó existente (append nas arrays certas).
export function appendBlockToData(data, type) {
    const d = { ...data };
    const messages = nodeMessages(d);
    const mediaType = MEDIA_FOR[type];
    if (type === 'text') {
        d.messages = [...messages, emptyMsg()];
    } else if (mediaType) {
        d.messages = [...messages, { ...emptyMsg(), media: { type: mediaType, url: '' } }];
    } else if (type === 'delay') {
        // aplica o "digitando…" na ÚLTIMA mensagem (default 2s se estava 0).
        d.messages = messages.map((m, i) => (i === messages.length - 1 ? { ...m, delay_seconds: m.delay_seconds || 2 } : m));
    } else if (type === 'buttons') {
        d.buttons = [...(d.buttons || []), { id: uid('b'), label: 'Novo botão', action: 'next', url: '' }];
    } else if (type === 'redirect') {
        d.buttons = [...(d.buttons || []), { id: uid('b'), label: 'Abrir link', action: 'url', url: '' }];
    } else if (type === 'plan') {
        d.buttons = [...(d.buttons || []), { id: uid('b'), label: '💎 Assinar VIP', action: 'plan', plan_id: '' }];
    } else if (type === 'answers') {
        d.answers = [...(d.answers || []), { id: uid('a'), keyword: '' }];
    } else if (type === 'tag') {
        d.apply_tags = [...(d.apply_tags || []), 'nova-tag'];
    }
    return d;
}

// Cria a data de um nó novo semeada pelo bloco solto no canvas vazio.
export function seedNodeData(type) {
    const d = { title: BLOCK_TITLE[type] || 'Mensagem', messages: [emptyMsg()], buttons: [], answers: [], apply_tags: [] };
    const mediaType = MEDIA_FOR[type];
    if (mediaType) d.messages = [{ ...emptyMsg(), media: { type: mediaType, url: '' } }];
    else if (type === 'delay') d.messages = [{ ...emptyMsg(), delay_seconds: 2 }];
    else if (type === 'buttons') d.buttons = [{ id: uid('b'), label: 'Novo botão', action: 'next', url: '' }];
    else if (type === 'redirect') d.buttons = [{ id: uid('b'), label: 'Abrir link', action: 'url', url: '' }];
    else if (type === 'plan') d.buttons = [{ id: uid('b'), label: '💎 Assinar VIP', action: 'plan', plan_id: '' }];
    else if (type === 'answers') d.answers = [{ id: uid('a'), keyword: '' }];
    else if (type === 'tag') d.apply_tags = ['nova-tag'];
    return d;
}

// Clona a data de um nó gerando novos ids (evita colisão de handles).
export function cloneNodeData(data) {
    return {
        ...data,
        title: `${data?.title || 'Mensagem'} (cópia)`,
        messages: nodeMessages(data).map((m) => ({ ...m, id: uid('m') })),
        buttons: (data?.buttons || []).map((b) => ({ ...b, id: uid('b') })),
        answers: (data?.answers || []).map((a) => ({ ...a, id: uid('a') })),
        apply_tags: [...(data?.apply_tags || [])]
    };
}

// =============== CONTEXTO (ações do container p/ os nós/edges) ================
const FlowActionsContext = createContext({});
export const useFlowActions = () => useContext(FlowActionsContext);
export function FlowActionsProvider({ value, children }) {
    return <FlowActionsContext.Provider value={value}>{children}</FlowActionsContext.Provider>;
}

// =============== PALETA ======================================================
function PaletteItem({ block, token, onDragBlock }) {
    const Icon = block.icon;
    return (
        <Box
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('application/tg-block', block.type);
                e.dataTransfer.effectAllowed = 'copy';
                onDragBlock?.(block.type);
            }}
            onDragEnd={() => onDragBlock?.(null)}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                cursor: 'grab',
                userSelect: 'none',
                transition: 'border-color .14s, box-shadow .14s, transform .14s',
                '&:hover': {
                    borderColor: (t) => tint(t, token, 0.5),
                    boxShadow: (t) => `0 2px 10px ${tint(t, token, 0.16)}`,
                    transform: 'translateY(-1px)'
                },
                '&:active': { cursor: 'grabbing' }
            }}
        >
            <Box
                sx={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    color: `${token}.main`,
                    bgcolor: (t) => tint(t, token, 0.14)
                }}
            >
                <Icon size={15} stroke={1.9} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.1 }}>
                {block.label}
            </Typography>
        </Box>
    );
}

export function BlockPalette({ onDragBlock, sx }) {
    return (
        <Box
            sx={{
                width: 210,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                overflowY: 'auto',
                p: 1.25,
                ...sx
            }}
        >
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Blocos</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Arraste para o canvas ou sobre um passo
            </Typography>
            {TG_BLOCK_GROUPS.map((g) => (
                <Box key={g.group} sx={{ mt: 1.75 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75, pl: 0.25 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: `${g.token}.main` }} />
                        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary', lineHeight: 1 }}>
                            {g.group}
                        </Typography>
                    </Stack>
                    <Stack spacing={0.75}>
                        {g.items.map((b) => (
                            <PaletteItem key={b.type} block={b} token={g.token} onDragBlock={onDragBlock} />
                        ))}
                    </Stack>
                </Box>
            ))}
        </Box>
    );
}

// =============== NÓS =========================================================
function InlineTitle({ value, onCommit }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');
    useEffect(() => {
        if (!editing) setDraft(value || '');
    }, [value, editing]);
    const commit = () => {
        setEditing(false);
        const v = draft.trim();
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
                }}
                onMouseDown={(e) => e.stopPropagation()}
                sx={{ flex: 1, fontWeight: 700, fontSize: 12.5, px: 0.5, py: 0, borderRadius: 1, bgcolor: (t) => tint(t, 'primary', 0.1) }}
            />
        );
    }
    return (
        <Tooltip title="Clique para renomear" enterDelay={500}>
            <Typography
                className="nodrag"
                onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                }}
                sx={{ fontWeight: 700, fontSize: 12.5, flex: 1, cursor: 'text', minWidth: 0, '&:hover': { textDecoration: 'underline dotted' } }}
                noWrap
            >
                {value || 'Mensagem'}
            </Typography>
        </Tooltip>
    );
}

function TypingChip({ seconds, onClick }) {
    return (
        <Box
            className="nodrag"
            onClick={onClick}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                alignSelf: 'flex-start',
                px: 0.9,
                py: 0.35,
                borderRadius: 5,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: 'primary.main',
                bgcolor: (t) => tint(t, 'primary', 0.1),
                '&:hover': { bgcolor: (t) => tint(t, 'primary', 0.2) }
            }}
        >
            <IconClock size={12} />
            digitando
            <Box component="span" sx={{ display: 'inline-flex', gap: '2px', alignItems: 'flex-end', mx: 0.25 }}>
                {[0, 1, 2].map((i) => (
                    <Box
                        key={i}
                        component="span"
                        className="tg-typing-dot"
                        sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', display: 'inline-block', animationDelay: `${i * 0.18}s` }}
                    />
                ))}
            </Box>
            <Box component="span" sx={{ opacity: 0.7 }}>
                {seconds}s
            </Box>
        </Box>
    );
}

function MessageBubble({ m }) {
    const hasPhoto = m.media?.type === 'photo' && m.media.url;
    const mediaLabel = m.media?.type
        ? { photo: '📷 Imagem', video: '🎬 Vídeo', voice: '🎤 Áudio', document: '📎 Documento' }[m.media.type]
        : null;
    const emptyMedia = m.media?.type && !m.media.url;
    return (
        <Box
            sx={[
                {
                    maxWidth: '94%',
                    alignSelf: 'flex-start',
                    borderRadius: 1.5,
                    borderTopLeftRadius: 5,
                    px: 1,
                    py: 0.6,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)'
                },
                { bgcolor: '#fff', color: '#1a1a1a' },
                (t) => t.applyStyles('dark', { bgcolor: '#182533', color: '#e6eef7' })
            ]}
        >
            {hasPhoto ? (
                <Box
                    component="img"
                    src={m.media.url}
                    alt=""
                    sx={{ width: '100%', maxHeight: 90, objectFit: 'cover', borderRadius: 1, display: 'block', mb: m.text ? 0.5 : 0 }}
                />
            ) : mediaLabel ? (
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.85, mb: m.text ? 0.4 : 0 }}>
                    {mediaLabel}
                    {emptyMedia ? ' · sem arquivo' : ''}
                </Typography>
            ) : null}
            {m.text ? (
                <Typography
                    variant="caption"
                    sx={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35 }}
                >
                    {m.text}
                </Typography>
            ) : !mediaLabel ? (
                <Typography variant="caption" sx={{ opacity: 0.5 }}>
                    Sem texto…
                </Typography>
            ) : null}
        </Box>
    );
}

const PORT = { width: 11, height: 11, border: '2px solid #fff' };

function StartNode({ selected }) {
    return (
        <Box
            sx={{
                px: 2,
                py: 1.25,
                borderRadius: 3,
                color: '#fff',
                background: TG_GRADIENT,
                minWidth: 154,
                textAlign: 'center',
                position: 'relative',
                transition: 'box-shadow .15s',
                boxShadow: selected ? '0 0 0 3px rgba(34,158,217,0.35), 0 10px 26px rgba(34,158,217,0.45)' : '0 6px 16px rgba(34,158,217,0.35)'
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                <IconPlayerPlay size={16} />
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Início (/start)</Typography>
            </Stack>
            <Handle type="source" position={Position.Right} id="out" className="tg-port" style={{ ...PORT, background: BRAND, right: -6 }} />
        </Box>
    );
}

function MessageNode({ id, data, selected }) {
    const updateNodeInternals = useUpdateNodeInternals();
    const actions = useFlowActions();
    const [menuEl, setMenuEl] = useState(null);
    const [delayEdit, setDelayEdit] = useState(null); // { messageId, anchor }

    const messages = nodeMessages(data);
    const buttons = data.buttons || [];
    const answers = data.answers || [];
    const tags = data.apply_tags || [];
    const nextCount = buttons.filter((b) => b.action === 'next').length;

    useEffect(() => {
        updateNodeInternals(id);
    }, [id, buttons.length, nextCount, answers.length, messages.length, updateNodeInternals]);

    const mediaEmojis = messages
        .map((m) => ({ photo: '📷', video: '🎬', voice: '🎤', document: '📎' }[m.media?.type]))
        .filter(Boolean);

    const closeMenu = () => setMenuEl(null);

    return (
        <Box
            sx={[
                {
                    width: 258,
                    borderRadius: '14px',
                    bgcolor: 'background.paper',
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    position: 'relative',
                    overflow: 'visible',
                    transition: 'box-shadow .15s, border-color .15s'
                },
                selected && { boxShadow: (t) => `0 0 0 3px ${tint(t, 'primary', 0.24)}, 0 12px 28px ${tint(t, 'primary', 0.26)}` },
                !selected && { boxShadow: '0 2px 10px rgba(15,23,42,0.10)' },
                !selected && ((t) => t.applyStyles('dark', { boxShadow: '0 2px 14px rgba(0,0,0,0.55)' }))
            ]}
        >
            <Handle type="target" position={Position.Left} id="in" style={{ ...PORT, background: '#9aa5b1', left: -6 }} />

            {/* header */}
            <Box
                sx={{
                    px: 1.25,
                    py: 0.85,
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    bgcolor: (t) => tint(t, 'primary', 0.1)
                }}
            >
                <IconMessage2 size={15} style={{ flexShrink: 0, opacity: 0.9 }} />
                <InlineTitle value={data.title} onCommit={(v) => actions.onTitleChange?.(id, v)} />
                {messages.length > 1 ? (
                    <Box component="span" sx={{ fontSize: 10, fontWeight: 700, px: 0.6, py: 0.15, borderRadius: 1, bgcolor: (t) => tint(t, 'primary', 0.18) }}>
                        {messages.length}
                    </Box>
                ) : null}
                {mediaEmojis.length ? <Box component="span" sx={{ fontSize: 11 }}>{mediaEmojis.join('')}</Box> : null}
                <IconButton
                    className="nodrag"
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuEl(e.currentTarget);
                    }}
                    sx={{ ml: -0.25, mr: -0.5, p: 0.25 }}
                >
                    <IconDots size={15} />
                </IconButton>
            </Box>

            {/* bolhas de conversa */}
            <Box
                sx={[
                    { px: 1, py: 1, display: 'flex', flexDirection: 'column', gap: 0.6 },
                    { bgcolor: '#eef2f7' },
                    (t) => t.applyStyles('dark', { bgcolor: '#0e1621' })
                ]}
            >
                {messages.map((m) => (
                    <Fragment key={m.id}>
                        {m.delay_seconds > 0 ? (
                            <TypingChip
                                seconds={m.delay_seconds}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDelayEdit({ messageId: m.id, anchor: e.currentTarget });
                                }}
                            />
                        ) : null}
                        <MessageBubble m={m} />
                    </Fragment>
                ))}
            </Box>

            {/* botões (estilo telegram) com porta por botão "next" */}
            {buttons.length ? (
                <Stack sx={{ px: 1, pt: 1 }} spacing={0.5}>
                    {buttons.map((b) => {
                        const A = BTN_ACTIONS[b.action] || BTN_ACTIONS.next;
                        const Icon = A.icon;
                        return (
                            <Box
                                key={b.id}
                                sx={{
                                    position: 'relative',
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    bgcolor: (t) => tint(t, 'primary', 0.1),
                                    color: 'primary.main'
                                }}
                            >
                                <Icon size={13} />
                                <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                                    {b.label || 'Botão'}
                                </Typography>
                                {b.action === 'next' ? (
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={`btn-${b.id}`}
                                        className="tg-port"
                                        style={{ ...PORT, background: '#3390ec', right: -13 }}
                                    />
                                ) : null}
                            </Box>
                        );
                    })}
                </Stack>
            ) : null}

            {/* respostas por texto */}
            {answers.length ? (
                <Box sx={{ px: 1, pt: buttons.length ? 0.5 : 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, pl: 0.5 }}>
                        Respostas por texto:
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.25 }}>
                        {answers.map((a) => (
                            <Box
                                key={a.id}
                                sx={{ position: 'relative', px: 1, py: 0.4, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center' }}
                            >
                                <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                                    “{a.keyword || '…'}”
                                </Typography>
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`ans-${a.id}`}
                                    className="tg-port"
                                    style={{ ...PORT, background: '#7E57C2', right: -13 }}
                                />
                            </Box>
                        ))}
                    </Stack>
                </Box>
            ) : null}

            {/* tags aplicadas (display) */}
            {tags.length ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1.25, pt: 1 }}>
                    {tags.map((tg, i) => (
                        <Box
                            key={`${tg}-${i}`}
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 0.7, py: 0.15, borderRadius: 5, fontSize: 10, fontWeight: 600, color: 'secondary.main', bgcolor: (t) => tint(t, 'secondary', 0.14) }}
                        >
                            <IconTag size={10} /> {tg}
                        </Box>
                    ))}
                </Stack>
            ) : null}

            {/* fallback (qualquer resposta) */}
            <Box sx={{ position: 'relative', px: 1.25, py: 0.75, mt: 1, borderTop: '1px solid', borderColor: 'divider', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10.5 }}>
                    Qualquer resposta →
                </Typography>
                <Handle type="source" position={Position.Right} id="fallback" className="tg-port" style={{ ...PORT, background: '#9aa5b1', right: -13, top: '50%' }} />
            </Box>

            <Menu anchorEl={menuEl} open={!!menuEl} onClose={closeMenu} onClick={(e) => e.stopPropagation()}>
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        actions.onDuplicate?.(id);
                    }}
                >
                    <IconCopy size={16} style={{ marginRight: 8 }} /> Duplicar
                </MenuItem>
                <MenuItem
                    sx={{ color: 'error.main' }}
                    onClick={() => {
                        closeMenu();
                        actions.onDelete?.(id);
                    }}
                >
                    <IconTrash size={16} style={{ marginRight: 8 }} /> Excluir
                </MenuItem>
            </Menu>

            <Popover
                open={!!delayEdit}
                anchorEl={delayEdit?.anchor}
                onClose={() => setDelayEdit(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                onClick={(e) => e.stopPropagation()}
                slotProps={{ paper: { sx: { p: 2, width: 220, borderRadius: 2 } } }}
            >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <IconClock size={14} /> Atraso “digitando…”
                </Typography>
                <Slider
                    className="nodrag"
                    size="small"
                    min={0}
                    max={10}
                    step={1}
                    valueLabelDisplay="auto"
                    value={messages.find((m) => m.id === delayEdit?.messageId)?.delay_seconds || 0}
                    onChange={(_, v) => actions.onSetDelay?.(id, delayEdit.messageId, v)}
                    marks={[
                        { value: 0, label: '0s' },
                        { value: 5, label: '5s' },
                        { value: 10, label: '10s' }
                    ]}
                />
            </Popover>
        </Box>
    );
}

export const nodeTypes = { start: StartNode, message: MessageNode };

// =============== EDGE (bezier colorido + seta + ponto animado) ===============
function BrandEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected }) {
    const actions = useFlowActions();
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.35 });
    return (
        <>
            {/* área de clique larga p/ selecionar/apagar a conexão */}
            <path d={path} fill="none" stroke="transparent" strokeWidth={18} style={{ pointerEvents: 'stroke' }} />
            <path
                id={id}
                d={path}
                markerEnd={markerEnd}
                fill="none"
                className="react-flow__edge-path tg-edge-path"
                style={{ stroke: selected ? '#1c7fb8' : BRAND, strokeWidth: selected ? 3 : 2 }}
            />
            <circle r={3.2} fill={BRAND} className="tg-edge-dot">
                <animateMotion dur="2.6s" repeatCount="indefinite" path={path} />
            </circle>
            {selected ? (
                <EdgeLabelRenderer>
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
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            bgcolor: 'error.main',
                            color: '#fff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            '&:hover': { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(1.12)` }
                        }}
                    >
                        <IconX size={12} />
                    </Box>
                </EdgeLabelRenderer>
            ) : null}
        </>
    );
}

export const edgeTypes = { brand: BrandEdge };

// =============== ESTILOS GLOBAIS injetados ===================================
export function FlowGlobalStyles() {
    return (
        <style>{`
      .tg-drop-target { outline: 2px dashed ${BRAND} !important; outline-offset: 4px; }
      @keyframes tgDot { 0%,60%,100% { opacity:.3; transform:translateY(0); } 30% { opacity:1; transform:translateY(-2px); } }
      .tg-typing-dot { animation: tgDot 1.2s infinite ease-in-out; }
      .react-flow__handle.tg-port { transition: box-shadow .12s ease, background .12s ease; }
      .react-flow__handle.tg-port:hover { box-shadow: 0 0 0 4px rgba(34,158,217,0.22); }
      .tg-edge-dot { filter: drop-shadow(0 0 2px rgba(34,158,217,.55)); }
      .react-flow__controls { border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,.18); border: 1px solid var(--tg-ctrl-border); }
      .react-flow__controls-button { background: var(--tg-ctrl-bg); color: var(--tg-ctrl-fg); border-bottom: 1px solid var(--tg-ctrl-border); }
      .react-flow__controls-button:hover { background: var(--tg-ctrl-hover); }
      .react-flow__controls-button svg { fill: currentColor; }
    `}</style>
    );
}

// =============== INSPETOR (painel lateral overlay) ===========================
export function InspectorPanel({ node, botId, bots, focus, onChange, onDelete, onDuplicate, onClose }) {
    const [linkFor, setLinkFor] = useState(null); // {type:'text', mid} | {type:'button', id}
    const scrollRef = useRef(null);
    const msgEndRef = useRef(null);
    const lastMsgRef = useRef(null);
    const buttonsRef = useRef(null);
    const answersRef = useRef(null);
    const tagsRef = useRef(null);
    const [plans, setPlans] = useState([]);

    // ao trocar de passo (clique), reseta o scroll do inspetor para o topo
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [node?.id]);

    // planos do bot (p/ o botão "Vender plano")
    useEffect(() => {
        let alive = true;
        if (!botId) {
            setPlans([]);
            return undefined;
        }
        get(`/telegram/payments/plans?bot_id=${botId}`)
            .then((r) => alive && setPlans(Array.isArray(r) ? r : []))
            .catch(() => alive && setPlans([]));
        return () => {
            alive = false;
        };
    }, [botId]);

    // ao soltar um bloco no passo, rola o painel até a seção do bloco recém-adicionado
    useEffect(() => {
        if (!focus?.ts) return;
        const scrollTo = (ref) => {
            const c = scrollRef.current;
            const el = ref?.current;
            if (!c || !el) return;
            const cr = c.getBoundingClientRect();
            const er = el.getBoundingClientRect();
            c.scrollTo({ top: c.scrollTop + (er.top - cr.top) - 12, behavior: 'smooth' });
        };
        const t = focus.type;
        const raf = requestAnimationFrame(() => {
            if (t === 'buttons' || t === 'redirect' || t === 'plan') scrollTo(buttonsRef);
            else if (t === 'answer') scrollTo(answersRef);
            else if (t === 'tag') scrollTo(tagsRef);
            else scrollTo(lastMsgRef); // texto/mídia/atraso → mostra a mensagem recém-criada
        });
        return () => cancelAnimationFrame(raf);
    }, [focus?.ts]); // eslint-disable-line react-hooks/exhaustive-deps

    const d = node?.data || {};
    const setD = (patch) => onChange(node.id, patch);
    const messages = useMemo(() => nodeMessages(d), [node]); // eslint-disable-line react-hooks/exhaustive-deps
    const setMessages = (arr) => setD({ messages: arr });
    const setMsg = (mid, patch) => setMessages(messages.map((m) => (m.id === mid ? { ...m, ...patch } : m)));
    const addMsg = () => setMessages([...messages, { id: uid('m'), text: '', media: null, delay_seconds: 0 }]);
    const removeMsg = (mid) => setMessages(messages.filter((m) => m.id !== mid));

    const addButton = () => setD({ buttons: [...(d.buttons || []), { id: uid('b'), label: 'Novo botão', action: 'next', url: '' }] });
    const setButton = (bid, patch) => setD({ buttons: (d.buttons || []).map((b) => (b.id === bid ? { ...b, ...patch } : b)) });
    const removeButton = (bid) => setD({ buttons: (d.buttons || []).filter((b) => b.id !== bid) });

    const addAnswer = () => setD({ answers: [...(d.answers || []), { id: uid('a'), keyword: '' }] });
    const setAnswer = (aid, kw) => setD({ answers: (d.answers || []).map((a) => (a.id === aid ? { ...a, keyword: kw } : a)) });
    const removeAnswer = (aid) => setD({ answers: (d.answers || []).filter((a) => a.id !== aid) });

    const onPickLink = (url) => {
        if (!linkFor) return;
        if (linkFor.type === 'text') {
            const m = messages.find((x) => x.id === linkFor.mid);
            if (m) setMsg(m.id, { text: `${m.text || ''}${m.text ? ' ' : ''}${url}` });
        } else if (linkFor.type === 'button') setButton(linkFor.id, { url });
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* header sticky */}
            <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
            >
                <Box sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: (t) => tint(t, 'primary', 0.12) }}>
                    <IconMessage2 size={17} />
                </Box>
                <Typography sx={{ fontWeight: 700, flex: 1, ml: 0.5 }}>Editar passo</Typography>
                <Tooltip title="Duplicar">
                    <IconButton size="small" onClick={() => onDuplicate(node.id)}>
                        <IconCopy size={17} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Excluir passo">
                    <IconButton size="small" color="error" onClick={() => onDelete(node.id)}>
                        <IconTrash size={17} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Fechar">
                    <IconButton size="small" onClick={onClose}>
                        <IconX size={17} />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Box ref={scrollRef} sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
                <TextField label="Título (interno)" size="small" fullWidth value={d.title || ''} onChange={(e) => setD({ title: e.target.value })} sx={{ mb: 2 }} />

                <Box sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Mensagens</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Enviadas em sequência. A última leva os botões.
                    </Typography>
                </Box>

                <Stack spacing={1.5}>
                    {messages.map((m, i) => (
                        <Box key={m.id} ref={i === messages.length - 1 ? lastMsgRef : null} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.5, bgcolor: (t) => tint(t, 'primary', 0.03) }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Chip size="small" label={`Mensagem ${i + 1}`} sx={{ fontWeight: 700 }} />
                                <Stack direction="row" spacing={0.25} alignItems="center">
                                    <Tooltip title="Inserir link">
                                        <IconButton size="small" onClick={() => setLinkFor({ type: 'text', mid: m.id })}>
                                            <IconLink size={15} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Inserir {{nome}}">
                                        <IconButton size="small" onClick={() => setMsg(m.id, { text: `${m.text || ''}{{nome}}` })}>
                                            <IconVariable size={15} />
                                        </IconButton>
                                    </Tooltip>
                                    {messages.length > 1 ? (
                                        <IconButton size="small" color="error" onClick={() => removeMsg(m.id)}>
                                            <IconTrash size={15} />
                                        </IconButton>
                                    ) : null}
                                </Stack>
                            </Stack>
                            <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                value={m.text || ''}
                                onChange={(e) => setMsg(m.id, { text: e.target.value })}
                                placeholder="Texto (vira legenda se houver mídia). Variáveis: {{nome}}, {{username}}."
                                sx={{ mb: 1 }}
                            />
                            <TelegramMediaField value={m.media} onChange={(media) => setMsg(m.id, { media })} />
                            <Box sx={{ mt: 1.5, px: 0.5 }}>
                                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                                    <IconClock size={14} />
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        Atraso “digitando…”: {m.delay_seconds || 0}s
                                    </Typography>
                                </Stack>
                                <Slider
                                    size="small"
                                    min={0}
                                    max={10}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    value={m.delay_seconds || 0}
                                    onChange={(_, v) => setMsg(m.id, { delay_seconds: v })}
                                />
                            </Box>
                        </Box>
                    ))}
                </Stack>
                <Button size="small" startIcon={<IconPlus size={15} />} onClick={addMsg} sx={{ textTransform: 'none', mt: 1 }}>
                    Adicionar mensagem
                </Button>
                <Box ref={msgEndRef} sx={{ height: 0 }} />

                <Divider sx={{ my: 2 }} />

                {/* Botões */}
                <Stack ref={buttonsRef} direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Botões</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Aparecem na última mensagem.
                        </Typography>
                    </Box>
                    <Button size="small" startIcon={<IconPlus size={15} />} onClick={addButton} sx={{ textTransform: 'none' }}>
                        Adicionar
                    </Button>
                </Stack>
                <Stack spacing={1.5}>
                    {(d.buttons || []).length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Nenhum botão. Adicione para o usuário responder tocando.
                        </Typography>
                    ) : null}
                    {(d.buttons || []).map((b) => (
                        <Box key={b.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                <TextField size="small" fullWidth placeholder="Texto do botão" value={b.label} onChange={(e) => setButton(b.id, { label: e.target.value })} />
                                <IconButton size="small" color="error" onClick={() => removeButton(b.id)}>
                                    <IconTrash size={15} />
                                </IconButton>
                            </Stack>
                            <Select size="small" fullWidth value={b.action} onChange={(e) => setButton(b.id, { action: e.target.value })} sx={{ mb: b.action === 'next' ? 0 : 1 }}>
                                {Object.entries(BTN_ACTIONS).map(([k, v]) => (
                                    <MenuItem key={k} value={k}>
                                        {v.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {b.action === 'next' ? (
                                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                                    Conecte a bolinha azul do botão (no card) ao próximo passo.
                                </Typography>
                            ) : b.action === 'plan' ? (
                                <>
                                    <SearchSelect
                                        fullWidth
                                        label="Plano a vender"
                                        value={b.plan_id || ''}
                                        onChange={(v) => setButton(b.id, { plan_id: v })}
                                        options={plans.map((p) => ({ value: p.id, label: `${p.name} — ${p.price_label}` }))}
                                    />
                                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                                        {plans.length ? 'Ao tocar, o bot gera o PIX e libera o acesso ao pagar.' : 'Cadastre planos em Pagamentos / VIP primeiro.'}
                                    </Typography>
                                </>
                            ) : (
                                <Stack direction="row" spacing={0.5}>
                                    <TextField size="small" fullWidth placeholder="https://…" value={b.url || ''} onChange={(e) => setButton(b.id, { url: e.target.value })} />
                                    <Button size="small" variant="outlined" onClick={() => setLinkFor({ type: 'button', id: b.id })} sx={{ borderColor: 'divider', color: 'text.primary', minWidth: 40 }}>
                                        <IconLink size={16} />
                                    </Button>
                                </Stack>
                            )}
                        </Box>
                    ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Respostas por texto */}
                <Stack ref={answersRef} direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Respostas por texto</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Ramifica quando o usuário digita a palavra-chave.
                        </Typography>
                    </Box>
                    <Button size="small" startIcon={<IconPlus size={15} />} onClick={addAnswer} sx={{ textTransform: 'none' }}>
                        Adicionar
                    </Button>
                </Stack>
                <Stack spacing={1}>
                    {(d.answers || []).map((a) => (
                        <Stack key={a.id} direction="row" spacing={1} alignItems="center">
                            <TextField size="small" fullWidth placeholder="palavra-chave (ex.: sim)" value={a.keyword} onChange={(e) => setAnswer(a.id, e.target.value)} />
                            <IconButton size="small" color="error" onClick={() => removeAnswer(a.id)}>
                                <IconTrash size={15} />
                            </IconButton>
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Segmentação */}
                <Typography ref={tagsRef} sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Segmentação</Typography>
                <TextField
                    size="small"
                    fullWidth
                    label="Aplicar tags ao chegar aqui"
                    placeholder="lead, interessado"
                    value={(d.apply_tags || []).join(', ')}
                    onChange={(e) => setD({ apply_tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    helperText="Marca o lead (separe por vírgula)."
                />
            </Box>

            <TelegramLinkPicker open={!!linkFor} onClose={() => setLinkFor(null)} onPick={onPickLink} botId={botId} bots={bots} />
        </Box>
    );
}
