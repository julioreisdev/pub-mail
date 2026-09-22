import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Chip,
    CircularProgress,
    ClickAwayListener,
    Fab,
    IconButton,
    InputAdornment,
    Paper,
    Popper,
    Skeleton,
    Stack,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery
} from '@mui/material';
import {
    IconSearch,
    IconSend,
    IconMoodSmile,
    IconPaperclip,
    IconX,
    IconUsersGroup,
    IconBroadcast,
    IconRefresh,
    IconMessage2,
    IconMessages,
    IconArrowLeft
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post } from '../../../api/api';
import AuthImage from './AuthImage';
import SearchSelect from './SearchSelect';
import { TgPageHeader, TgEmptyState, TgAvatar, TgStatusPill, TgListSkeleton } from './ui';

const POLL_MS = 3500;
const LIST_POLL_MS = 10000;
const EMOJI_CELL = 36; // altura fixa da célula de emoji (grid gap 0) → maxHeight = múltiplo dela

// tint theme-aware (troca no dark). NUNCA usar alpha(theme.palette…) em callback sx.
const tint = (t, token, a) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;

const EMOJIS = (
    '😀 😁 😂 🤣 😊 😍 😘 😎 🤩 🥳 😇 🙂 😉 😌 😢 😭 😤 😠 😡 🤔 🤨 😳 🥺 😴 🤤 😷 🤒 🤕 🤯 😱 ' +
    '👍 👎 👏 🙌 🙏 💪 🤝 👋 ✌️ 🤟 🤙 👌 ✋ 🫶 💅 🫡 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❤️‍🔥 💯 🔥 ✨ ⭐ ' +
    '🎉 🎊 🥂 🍾 🎁 🏆 🥇 💰 💸 💵 📈 📉 ✅ ❌ ⚠️ ❗ ❓ 💡 📌 📍 🔔 📣 📢 ⏰ ⏳ 🕐 🚀 🛒 🎯 🤖 ' +
    '👀 🙈 🫣 😅 😏 😜 🤪 😋 🤗 🤠 🥰 😻 💬 📝 📎 📷 🎬 🎵 🎤 🔗 🌐 ☀️ 🌙 ⚡ 🌈 🍀 🐶 🐱 ⚽'
)
    .split(' ')
    .filter(Boolean);

const fmtTimeSec = (v) => {
    if (!v) return '';
    try {
        return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(v));
    } catch {
        return '';
    }
};
const fmtTime = (v) => {
    if (!v) return '';
    try {
        return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(v));
    } catch {
        return '';
    }
};
const startOfDay = (v) => {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d;
};
const dateLabel = (v) => {
    if (!v) return '';
    try {
        const d = new Date(v);
        const today = startOfDay(new Date());
        const that = startOfDay(d);
        const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
        if (diff === 0) return 'Hoje';
        if (diff === 1) return 'Ontem';
        const opts = { day: '2-digit', month: 'long' };
        if (that.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
        return new Intl.DateTimeFormat('pt-BR', opts).format(d);
    } catch {
        return '';
    }
};
const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};

// tipo/foto/dot a partir do objeto chat (mantém as chaves de dados)
const chatKind = (chat) => (chat?.type === 'channel' ? 'channel' : chat?.kind === 'GROUP' ? 'group' : 'contact');
const chatPhoto = (chat) => (chat?.kind === 'GROUP' ? `/telegram/groups/${chat.id}/photo` : `/telegram/contacts/${chat.id}/photo`);
const kindIcon = (kind) => (kind === 'group' ? IconUsersGroup : kind === 'channel' ? IconBroadcast : undefined);
const DOT_COLOR = { group: '#8E63D9', channel: '#2AABEE', contact: '#26A69A' };

// ---- item da lista de conversas ----
function ChatListItem({ chat, active, onClick }) {
    const kind = chatKind(chat);
    const isGroupish = chat.kind === 'GROUP';
    const membersLabel = chat.member_count != null ? `${chat.member_count} ${chat.type === 'channel' ? 'inscritos' : 'membros'}` : '';
    const preview = chat.last_message_text || (isGroupish ? membersLabel : 'Sem mensagens');
    return (
        <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            onClick={onClick}
            sx={{
                px: 1.25,
                py: 1,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'background-color .12s ease',
                bgcolor: active ? (t) => tint(t, 'primary', 0.12) : 'transparent',
                '&:hover': { bgcolor: active ? (t) => tint(t, 'primary', 0.16) : 'action.hover' }
            }}
        >
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <TgAvatar name={chat.name} photoPath={chatPhoto(chat)} size={46} kind={kind} icon={kindIcon(kind)} />
                {/* presença é conceito de USUÁRIO: só DM (contato) ganha o ponto de "online" */}
                {kind === 'contact' ? (
                    <Box
                        sx={{
                            position: 'absolute',
                            right: -1,
                            bottom: -1,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: DOT_COLOR.contact,
                            border: '2px solid',
                            borderColor: 'background.paper'
                        }}
                    />
                ) : null}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                        {chat.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0, fontSize: 11 }}>
                        {fmtTime(chat.last_message_at)}
                    </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                    {chat.kind === 'CONTACT' && chat.last_message_dir === 'OUT' ? (
                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            Você:{' '}
                        </Box>
                    ) : null}
                    {preview}
                </Typography>
            </Box>
        </Stack>
    );
}

// ---- cabeçalho de seção (sticky) ----
function SectionHeader({ children }) {
    return (
        <Typography
            variant="overline"
            sx={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                display: 'block',
                px: 1.5,
                py: 0.5,
                mt: 0.25,
                color: 'text.secondary',
                fontWeight: 700,
                letterSpacing: 0.5,
                bgcolor: 'background.paper'
            }}
        >
            {children}
        </Typography>
    );
}

// ---- separador de data flutuante ----
function DateSeparator({ label }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
            <Box
                sx={{
                    px: 1.5,
                    py: 0.4,
                    borderRadius: 5,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'text.secondary',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: (t) => `0 2px 8px ${tint(t, 'primary', 0.12)}`
                }}
            >
                {label}
            </Box>
        </Box>
    );
}

// ---- balão de mensagem ----
function MessageRow({ msg, isGroup, firstOfGroup, lastOfGroup }) {
    const out = msg.direction === 'OUT';
    const showGutter = isGroup && !out;
    return (
        <Stack
            direction="row"
            spacing={0.75}
            alignItems="flex-end"
            justifyContent={out ? 'flex-end' : 'flex-start'}
            sx={{ px: 1.5, mt: firstOfGroup ? 1.25 : 0.25 }}
        >
            {showGutter ? (
                <Box sx={{ width: 28, flexShrink: 0 }}>
                    {lastOfGroup ? <TgAvatar name={msg.from_name} size={28} kind="contact" /> : null}
                </Box>
            ) : null}
            <Box
                sx={{
                    maxWidth: '76%',
                    minWidth: 0,
                    px: 1.5,
                    py: 0.85,
                    borderRadius: '16px',
                    bgcolor: out ? 'primary.main' : 'background.paper',
                    color: out ? 'primary.contrastText' : 'text.primary',
                    boxShadow: out ? 'none' : (t) => `0 1px 2px ${tint(t, 'primary', 0.1)}`,
                    ...(out && !firstOfGroup ? { borderTopRightRadius: 5 } : {}),
                    ...(!out && !firstOfGroup ? { borderTopLeftRadius: 5 } : {}),
                    ...(out && lastOfGroup ? { borderBottomRightRadius: 5 } : {}),
                    ...(!out && lastOfGroup ? { borderBottomLeftRadius: 5 } : {})
                }}
            >
                {isGroup && !out && firstOfGroup && msg.from_name ? (
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block', mb: 0.25 }}>
                        {msg.from_name}
                    </Typography>
                ) : null}

                {msg.has_image ? (
                    <Box sx={{ mb: msg.text ? 0.75 : 0.25, mt: 0.25 }}>
                        <AuthImage
                            path={`/telegram/messages/${msg.id}/media`}
                            alt="mídia"
                            size="auto"
                            rounded="12px"
                            imgStyle={{ maxWidth: 260, maxHeight: 320, width: 'auto', height: 'auto' }}
                            fallback={
                                <Box sx={{ width: 200, height: 140, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                                    <CircularProgress size={20} />
                                </Box>
                            }
                        />
                    </Box>
                ) : null}

                {msg.text ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {msg.text}
                    </Typography>
                ) : !msg.has_image ? (
                    <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: out ? 0.85 : 1, color: out ? 'inherit' : 'text.secondary' }}>
                        {msg.media_type ? `[${msg.media_type}]` : '[mensagem]'}
                    </Typography>
                ) : null}

                {lastOfGroup ? (
                    <Typography
                        component="span"
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'right',
                            mt: 0.25,
                            fontSize: 10.5,
                            lineHeight: 1,
                            color: out ? 'inherit' : 'text.secondary',
                            opacity: out ? 0.72 : 1
                        }}
                    >
                        {fmtTime(msg.created_at)}
                    </Typography>
                ) : null}
            </Box>
        </Stack>
    );
}

// ---- skeleton do painel de mensagens ----
function MessagesSkeleton() {
    const rows = [
        { out: false, w: '48%', h: 34 },
        { out: false, w: '32%', h: 34 },
        { out: true, w: '55%', h: 52 },
        { out: false, w: '40%', h: 34 },
        { out: true, w: '30%', h: 34 }
    ];
    return (
        <Stack spacing={1.25} sx={{ px: 1.5, py: 2 }}>
            {rows.map((r, i) => (
                <Stack key={i} direction="row" justifyContent={r.out ? 'flex-end' : 'flex-start'}>
                    <Skeleton variant="rounded" width={r.w} height={r.h} sx={{ borderRadius: 3 }} />
                </Stack>
            ))}
        </Stack>
    );
}

// wallpaper sutil (padrão de pontos + brilhos suaves), theme-aware
const WALLPAPER = {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundImage:
        'radial-gradient(circle at 18% 12%, rgba(42,171,238,0.06), transparent 42%),' +
        'radial-gradient(circle at 84% 82%, rgba(126,87,194,0.05), transparent 42%),' +
        'radial-gradient(rgba(130,140,160,0.12) 1px, transparent 1.4px)',
    backgroundSize: 'auto, auto, 20px 20px'
};

// =================== PÁGINA ===================
export default function TelegramDMs() {
    const isNarrow = useMediaQuery('(max-width:760px)');

    const [bots, setBots] = useState([]);
    const [botId, setBotId] = useState('');
    const [q, setQ] = useState('');
    const [groups, setGroups] = useState([]);
    const [channels, setChannels] = useState([]);
    const [conv, setConv] = useState({ items: [], page: 1, has_more: false, total: 0 });
    const [listLoading, setListLoading] = useState(false);

    const [active, setActive] = useState(null); // {kind, id, name, username,...}
    const [messages, setMessages] = useState([]);
    const [msgLoading, setMsgLoading] = useState(false);
    const [sinceRef, setSinceRef] = useState(null);
    const [lastSync, setLastSync] = useState(null);

    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [photo, setPhoto] = useState(null); // {file, url}
    const [emojiAnchor, setEmojiAnchor] = useState(null);
    const [recentEmojis, setRecentEmojis] = useState([]);

    const endRef = useRef(null);
    const fileRef = useRef(null);
    const activeRef = useRef(null);
    activeRef.current = active;

    // carrega bots
    useEffect(() => {
        get('/telegram/bots')
            .then((rows) => {
                setBots(rows);
                if (rows.length) setBotId((prev) => prev || rows[0].id);
            })
            .catch((e) => toast.error(errMsg(e, 'Falha ao carregar bots.')));
    }, []);

    const loadConversations = useCallback(async (id, query, page, append) => {
        if (!id) return;
        setListLoading(true);
        try {
            const first = page === 1 && !query;
            const [c, g, ch] = await Promise.all([
                get(`/telegram/conversations?bot_id=${id}&page=${page}&q=${encodeURIComponent(query || '')}`),
                first ? get(`/telegram/groups?bot_id=${id}`) : Promise.resolve(null),
                first ? get(`/telegram/channels?bot_id=${id}`) : Promise.resolve(null)
            ]);
            if (g) setGroups(g);
            if (ch) setChannels(ch);
            setConv((prev) => ({
                items: append ? [...prev.items, ...c.items] : c.items,
                page: c.page,
                has_more: c.has_more,
                total: c.total
            }));
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar conversas.'));
        } finally {
            setListLoading(false);
        }
    }, []);

    // troca de bot
    useEffect(() => {
        if (!botId) return;
        setActive(null);
        setMessages([]);
        setGroups([]);
        setChannels([]);
        setConv({ items: [], page: 1, has_more: false, total: 0 });
        loadConversations(botId, q, 1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [botId]);

    // busca com debounce
    useEffect(() => {
        if (!botId) return;
        const t = setTimeout(() => loadConversations(botId, q, 1, false), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    // refresh periódico da lista
    useEffect(() => {
        if (!botId) return undefined;
        const t = setInterval(() => loadConversations(botId, q, 1, false), LIST_POLL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [botId, q]);

    const scrollToEnd = () => {
        requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
    };

    const openChat = useCallback(async (chat) => {
        setActive(chat);
        setMessages([]);
        setMsgLoading(true);
        setSinceRef(null);
        try {
            const r = await get(`/telegram/messages?kind=${chat.kind}&id=${chat.id}`);
            setMessages(r.messages);
            setSinceRef(r.server_time);
            setLastSync(r.server_time);
            if (r.chat) setActive((prev) => ({ ...prev, ...r.chat }));
            scrollToEnd();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao abrir a conversa.'));
        } finally {
            setMsgLoading(false);
        }
    }, []);

    // polling de mensagens do chat aberto
    useEffect(() => {
        if (!active || !sinceRef) return undefined;
        const tick = async () => {
            const cur = activeRef.current;
            if (!cur) return;
            try {
                const r = await get(`/telegram/messages?kind=${cur.kind}&id=${cur.id}&since=${encodeURIComponent(sinceRef)}`);
                setLastSync(r.server_time);
                setSinceRef(r.server_time);
                if (r.messages?.length) {
                    setMessages((prev) => {
                        const seen = new Set(prev.map((m) => m.id));
                        const fresh = r.messages.filter((m) => !seen.has(m.id));
                        return fresh.length ? [...prev, ...fresh] : prev;
                    });
                    scrollToEnd();
                }
            } catch {
                /* silencioso */
            }
        };
        const t = setInterval(tick, POLL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active?.id, sinceRef]);

    const pickPhoto = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setPhoto({ file: f, url: URL.createObjectURL(f) });
        e.target.value = '';
    };

    const send = async () => {
        const cur = activeRef.current;
        if (!cur) return;
        const body = text.trim();
        if (!body && !photo) return;
        setSending(true);
        try {
            let msg;
            if (photo) {
                const fd = new FormData();
                fd.append('kind', cur.kind);
                fd.append('id', cur.id);
                if (body) fd.append('text', body);
                fd.append('photo', photo.file);
                msg = await post('/telegram/messages', fd, { headers: { 'Content-Type': undefined } });
            } else {
                msg = await post('/telegram/messages', { kind: cur.kind, id: cur.id, text: body });
            }
            setMessages((prev) => [...prev, msg]);
            setText('');
            setPhoto(null);
            scrollToEnd();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao enviar.'));
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const addEmoji = (em) => {
        setText((t) => t + em);
        setRecentEmojis((prev) => [em, ...prev.filter((x) => x !== em)].slice(0, 16));
    };

    const allChats = useMemo(() => [...groups, ...channels, ...conv.items], [groups, channels, conv.items]);
    const isGroup = active?.kind === 'GROUP';
    const canSend = !!text.trim() || !!photo;

    // monta as linhas de mensagem (agrupamento + separadores de data)
    const messageRows = useMemo(() => {
        const out = [];
        let lastDay = null;
        const gap = (a, b) => Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        messages.forEach((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const day = startOfDay(m.created_at).getTime();
            if (day !== lastDay) {
                out.push(<DateSeparator key={`d-${m.id}`} label={dateLabel(m.created_at)} />);
                lastDay = day;
            }
            const grpPrev =
                prev &&
                prev.direction === m.direction &&
                gap(prev, m) < 60000 &&
                (!isGroup || prev.from_name === m.from_name) &&
                startOfDay(prev.created_at).getTime() === day;
            const grpNext =
                next &&
                next.direction === m.direction &&
                gap(next, m) < 60000 &&
                (!isGroup || next.from_name === m.from_name) &&
                startOfDay(next.created_at).getTime() === day;
            out.push(<MessageRow key={m.id} msg={m} isGroup={isGroup} firstOfGroup={!grpPrev} lastOfGroup={!grpNext} />);
        });
        return out;
    }, [messages, isGroup]);

    const showList = !isNarrow || !active;
    const showChat = !isNarrow || !!active;

    const headerSubtitle = active
        ? active.kind === 'GROUP'
            ? active.member_count != null
                ? `${active.type === 'channel' ? 'Canal' : 'Grupo'} · ${active.member_count} ${active.type === 'channel' ? 'inscritos' : 'membros'}`
                : active.type === 'channel'
                  ? 'Canal'
                  : 'Grupo'
            : active.username
              ? `@${active.username}`
              : `id ${active.tg_user_id}`
        : '';

    // altura exata (mede o topo do bloco e desconta o rodapé) — evita scroll de página
    const shellRef = useRef(null);
    const [shellH, setShellH] = useState(0);
    useEffect(() => {
        const calc = () => {
            const el = shellRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top;
            setShellH(Math.max(420, Math.round(window.innerHeight - top - 74)));
        };
        calc();
        const t1 = setTimeout(calc, 120);
        const t2 = setTimeout(calc, 400);
        window.addEventListener('resize', calc);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('resize', calc);
        };
    }, []);

    return (
        <Box ref={shellRef} sx={{ display: 'flex', flexDirection: 'column', height: shellH ? `${shellH}px` : 'calc(100dvh - 176px)', minHeight: 420 }}>
            <TgPageHeader
                icon={IconMessages}
                title="Mensagens"
                subtitle="Converse com leads e responda em grupos e canais"
                sx={{ mb: 2 }}
                action={
                    <Tooltip title="Atualizar lista">
                        <span>
                            <IconButton onClick={() => loadConversations(botId, q, 1, false)} disabled={!botId}>
                                <IconRefresh size={18} />
                            </IconButton>
                        </span>
                    </Tooltip>
                }
            />

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: 'background.paper'
                }}
            >
                {/* ---------- coluna esquerda ---------- */}
                {showList ? (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            width: isNarrow ? '100%' : 340,
                            flexShrink: 0,
                            borderRight: isNarrow ? 'none' : '1px solid',
                            borderColor: 'divider'
                        }}
                    >
                        {/* filtros (estilo TgFilterBar, compacto) */}
                        <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <SearchSelect
                                fullWidth
                                sx={{ mb: 1 }}
                                label="Bot"
                                value={botId}
                                onChange={setBotId}
                                options={[
                                    ...(bots.length ? [{ value: 'all', label: 'Todos os bots' }] : []),
                                    ...bots.map((b) => ({ value: b.id, label: `${b.name}${b.username ? ` · @${b.username}` : ''}` }))
                                ]}
                            />
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Buscar por @, número ou nome…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <IconSearch size={16} />
                                        </InputAdornment>
                                    )
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Box>

                        <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', p: 0.75 }}>
                            {listLoading && allChats.length === 0 ? (
                                <Box sx={{ p: 1 }}>
                                    <TgListSkeleton rows={7} />
                                </Box>
                            ) : allChats.length === 0 ? (
                                <TgEmptyState
                                    dense
                                    icon={IconMessage2}
                                    title="Nenhuma conversa ainda"
                                    description="Quando alguém enviar /start ao bot (ou ele receber mensagem num grupo), aparece aqui."
                                    sx={{ m: 1, border: 'none', bgcolor: 'transparent' }}
                                />
                            ) : (
                                <Stack spacing={0.25}>
                                    {groups.length ? <SectionHeader>Grupos</SectionHeader> : null}
                                    {groups.map((g) => (
                                        <ChatListItem
                                            key={g.id}
                                            chat={g}
                                            active={active?.kind === 'GROUP' && active?.id === g.id}
                                            onClick={() => openChat(g)}
                                        />
                                    ))}
                                    {channels.length ? <SectionHeader>Canais</SectionHeader> : null}
                                    {channels.map((ch) => (
                                        <ChatListItem
                                            key={ch.id}
                                            chat={ch}
                                            active={active?.kind === 'GROUP' && active?.id === ch.id}
                                            onClick={() => openChat(ch)}
                                        />
                                    ))}
                                    {(groups.length || channels.length) && conv.items.length ? <SectionHeader>Conversas</SectionHeader> : null}
                                    {conv.items.map((c) => (
                                        <ChatListItem
                                            key={c.id}
                                            chat={c}
                                            active={active?.kind === 'CONTACT' && active?.id === c.id}
                                            onClick={() => openChat(c)}
                                        />
                                    ))}
                                    {conv.has_more ? (
                                        <Box sx={{ textAlign: 'center', py: 1 }}>
                                            <Typography
                                                variant="caption"
                                                onClick={() => loadConversations(botId, q, conv.page + 1, true)}
                                                sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Carregar mais ({conv.total - conv.items.length})
                                            </Typography>
                                        </Box>
                                    ) : null}
                                </Stack>
                            )}
                        </Box>
                    </Box>
                ) : null}

                {/* ---------- coluna direita (chat) ---------- */}
                {showChat ? (
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            position: 'relative',
                            bgcolor: 'background.default',
                            '&::before': WALLPAPER
                        }}
                    >
                        {!active ? (
                            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3, position: 'relative', zIndex: 1 }}>
                                <TgEmptyState
                                    icon={IconMessages}
                                    title="Selecione uma conversa"
                                    description="Escolha um contato, grupo ou canal à esquerda para ver e responder mensagens."
                                    sx={{ border: 'none', bgcolor: 'transparent' }}
                                />
                            </Box>
                        ) : (
                            <>
                                {/* header do chat */}
                                <Stack
                                    direction="row"
                                    spacing={1.25}
                                    alignItems="center"
                                    sx={{
                                        p: 1.25,
                                        position: 'relative',
                                        zIndex: 1,
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper'
                                    }}
                                >
                                    {isNarrow ? (
                                        <IconButton size="small" onClick={() => setActive(null)} sx={{ ml: -0.5 }}>
                                            <IconArrowLeft size={20} />
                                        </IconButton>
                                    ) : null}
                                    <TgAvatar name={active.name} photoPath={chatPhoto(active)} size={42} kind={chatKind(active)} icon={kindIcon(chatKind(active))} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 700 }} noWrap>
                                            {active.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                                            {headerSubtitle}
                                        </Typography>
                                        {active.kind === 'CONTACT' && active.tags?.length ? (
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
                                                {active.tags.slice(0, 6).map((t, i) => (
                                                    <Chip
                                                        key={i}
                                                        label={t}
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ height: 18, fontSize: 10, borderRadius: 1 }}
                                                    />
                                                ))}
                                            </Stack>
                                        ) : null}
                                    </Box>
                                    {/* presença é conceito de USUÁRIO: grupo/canal não fica "Online" */}
                                    {active.kind === 'CONTACT' ? (
                                        <Tooltip title={`id ${active.tg_user_id ?? active.id} · sync ${fmtTimeSec(lastSync) || '—'}`}>
                                            <Box sx={{ flexShrink: 0 }}>
                                                <TgStatusPill status="online" size="sm" />
                                            </Box>
                                        </Tooltip>
                                    ) : null}
                                </Stack>

                                {/* mensagens */}
                                <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', position: 'relative', zIndex: 1 }}>
                                    {msgLoading ? (
                                        <MessagesSkeleton />
                                    ) : messages.length === 0 ? (
                                        <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 3 }}>
                                            <TgEmptyState
                                                dense
                                                icon={IconMessage2}
                                                title="Sem mensagens ainda"
                                                description="Envie a primeira mensagem abaixo."
                                                sx={{ border: 'none', bgcolor: 'transparent' }}
                                            />
                                        </Box>
                                    ) : (
                                        <Box sx={{ py: 1.5 }}>
                                            {messageRows}
                                            <div ref={endRef} />
                                        </Box>
                                    )}
                                </Box>

                                {/* preview da foto anexada */}
                                {photo ? (
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ px: 1.5, py: 1, position: 'relative', zIndex: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
                                    >
                                        <img src={photo.url} alt="anexo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                                        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }} noWrap>
                                            {photo.file.name}
                                        </Typography>
                                        <IconButton size="small" onClick={() => setPhoto(null)}>
                                            <IconX size={16} />
                                        </IconButton>
                                    </Stack>
                                ) : null}

                                {/* composer */}
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="flex-end"
                                    sx={{
                                        p: 1.25,
                                        position: 'relative',
                                        zIndex: 1,
                                        borderTop: photo ? 'none' : '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper'
                                    }}
                                >
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            display: 'flex',
                                            alignItems: 'flex-end',
                                            gap: 0.25,
                                            px: 0.75,
                                            py: 0.25,
                                            borderRadius: 6,
                                            bgcolor: 'background.default',
                                            border: '1px solid',
                                            borderColor: 'divider'
                                        }}
                                    >
                                        <Tooltip title="Emoji">
                                            <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)}>
                                                <IconMoodSmile size={20} />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Anexar foto">
                                            <IconButton size="small" onClick={() => fileRef.current?.click()}>
                                                <IconPaperclip size={20} />
                                            </IconButton>
                                        </Tooltip>
                                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            multiline
                                            maxRows={6}
                                            placeholder="Escreva uma mensagem…"
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            onKeyDown={onKeyDown}
                                            InputProps={{ disableUnderline: true }}
                                            sx={{ py: 0.75, '& textarea': { fontSize: 14, lineHeight: 1.4 } }}
                                        />
                                    </Box>
                                    <Tooltip title="Enviar">
                                        <span>
                                            <Fab
                                                color="primary"
                                                onClick={send}
                                                disabled={sending || !canSend}
                                                sx={{
                                                    width: 46,
                                                    height: 46,
                                                    flexShrink: 0,
                                                    boxShadow: (t) => (canSend ? `0 6px 16px ${tint(t, 'primary', 0.4)}` : 'none')
                                                }}
                                            >
                                                {sending ? <CircularProgress size={18} color="inherit" /> : <IconSend size={20} />}
                                            </Fab>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </>
                        )}
                    </Box>
                ) : null}
            </Box>

            {/* emoji popover — Popper + ClickAwayListener (SEM backdrop): o 1º clique numa conversa
                fecha o picker E chega no item (o backdrop do Popover engolia esse clique) */}
            <Popper
                open={!!emojiAnchor}
                anchorEl={emojiAnchor}
                placement="top-start"
                modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
                sx={{ zIndex: (t) => t.zIndex.modal }}
            >
                <ClickAwayListener onClickAway={() => setEmojiAnchor(null)}>
                    <Paper elevation={8} sx={{ p: 1, borderRadius: 2, maxWidth: 312 }}>
                        {recentEmojis.length ? (
                            <Box sx={{ mb: 0.75 }}>
                                <Typography variant="overline" sx={{ color: 'text.secondary', px: 0.5, fontWeight: 700 }}>
                                    Recentes
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0 }}>
                                    {recentEmojis.map((em, i) => (
                                        <Box
                                            key={`r-${em}-${i}`}
                                            onClick={() => addEmoji(em)}
                                            sx={{ fontSize: 20, height: EMOJI_CELL, display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                                        >
                                            {em}
                                        </Box>
                                    ))}
                                </Box>
                                <Box sx={{ height: '1px', bgcolor: 'divider', my: 0.75 }} />
                            </Box>
                        ) : null}
                        {/* maxHeight = múltiplo exato de EMOJI_CELL (gap 0) → nenhuma linha cortada */}
                        <Box
                            sx={{
                                maxHeight: EMOJI_CELL * 6,
                                overflowY: 'auto',
                                overscrollBehavior: 'contain',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(8, 1fr)',
                                gap: 0
                            }}
                        >
                            {EMOJIS.map((em, i) => (
                                <Box
                                    key={`${em}-${i}`}
                                    onClick={() => addEmoji(em)}
                                    sx={{ fontSize: 20, height: EMOJI_CELL, display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                                >
                                    {em}
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </ClickAwayListener>
            </Popper>
        </Box>
    );
}
