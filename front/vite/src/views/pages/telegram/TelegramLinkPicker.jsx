import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { IconWorld, IconUsersGroup, IconBroadcast, IconRobot, IconLink, IconCopy, IconCheck } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { get } from '../../../api/api';
import SearchSelect from './SearchSelect';
import { TgModal } from './ui';

// Garante que links do Telegram abram o APP (t.me), nunca web.telegram.org.
// Links não-Telegram (site comum) passam intactos.
export function normalizeTelegramLink(raw) {
    let s = String(raw || '').trim();
    if (!s) return s;
    // web.telegram.org/k/#@user  ou  /a/#@user  → t.me/user
    const web = s.match(/web\.telegram\.org\/[ka]\/#?@?([A-Za-z0-9_]{3,})/i);
    if (web) return `https://t.me/${web[1]}`;
    // tg://resolve?domain=user  → t.me/user
    const tg = s.match(/^tg:\/\/resolve\?domain=([A-Za-z0-9_]{3,})/i);
    if (tg) return `https://t.me/${tg[1]}`;
    // telegram.me/...  → t.me/...
    s = s.replace(/^https?:\/\/telegram\.me\//i, 'https://t.me/');
    // @user  ou  user (username puro) → t.me/user
    if (/^@?[A-Za-z0-9_]{4,32}$/.test(s)) return `https://t.me/${s.replace(/^@/, '')}`;
    // t.me sem https → adiciona
    s = s.replace(/^(https?:\/\/)?(www\.)?t\.me\//i, 'https://t.me/');
    return s;
}

const TYPES = [
    { value: 'url', label: 'URL', hint: 'Qualquer link', icon: IconWorld, emoji: '🌐' },
    { value: 'group', label: 'Grupo', hint: 'Entrar num grupo', icon: IconUsersGroup },
    { value: 'channel', label: 'Canal', hint: 'Entrar num canal', icon: IconBroadcast },
    { value: 'bot', label: 'Bot', hint: 'Ir para outro bot', icon: IconRobot },
    { value: 'deeplink', label: 'Deep-link', hint: 'Captação ?start=', icon: IconLink }
];

// card selecionável de tipo de link
function TypeCard({ type, active, onClick }) {
    const Icon = type.icon;
    return (
        <Box
            role="button"
            onClick={onClick}
            sx={(t) => ({
                cursor: 'pointer',
                userSelect: 'none',
                px: 1,
                py: 1.15,
                borderRadius: 2,
                border: '1px solid',
                borderColor: active ? 'primary.main' : 'divider',
                bgcolor: active ? `rgba(${t.vars.palette.primary.mainChannel} / 0.10)` : 'background.paper',
                color: active ? 'primary.main' : 'text.secondary',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                textAlign: 'center',
                transition: 'border-color .14s ease, background-color .14s ease, color .14s ease',
                '&:hover': { borderColor: active ? 'primary.main' : `rgba(${t.vars.palette.primary.mainChannel} / 0.4)` }
            })}
        >
            <Icon size={20} stroke={1.8} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: active ? 'primary.main' : 'text.primary', lineHeight: 1.1 }}>
                {type.label}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1.1 }}>
                {type.hint}
            </Typography>
        </Box>
    );
}

// Escolhe/insere um link: grupo conhecido (t.me/@grupo), outro bot, ou URL livre.
export default function TelegramLinkPicker({ open, onClose, onPick, botId, bots }) {
    const [kind, setKind] = useState('url');
    const [groups, setGroups] = useState([]);
    const [channels, setChannels] = useState([]);
    const [value, setValue] = useState('');
    const [dlBot, setDlBot] = useState('');
    const [dlParam, setDlParam] = useState('');
    const [resolving, setResolving] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [copied, setCopied] = useState(false);

    // dedupe (ex.: grupo migrado p/ supergrupo gera 2 linhas) — mantém o "vivo" (com membros).
    const dedupeGroups = (list) => {
        const map = new Map();
        for (const g of list || []) {
            const key = (g.username || g.name || g.id || '').toLowerCase();
            const cur = map.get(key);
            if (!cur || (g.member_count != null && cur.member_count == null)) map.set(key, g);
        }
        return [...map.values()];
    };

    useEffect(() => {
        if (open && botId) {
            get(`/telegram/groups?bot_id=${botId}`).then((gs) => setGroups(dedupeGroups(gs))).catch(() => setGroups([]));
            get(`/telegram/channels?bot_id=${botId}`).then((cs) => setChannels(dedupeGroups(cs))).catch(() => setChannels([]));
            setKind('url');
            setValue('');
            setDlBot('');
            setDlParam('');
            setSelectedGroupId('');
            setSelectedChannelId('');
            setCopied(false);
        }
    }, [open, botId]);

    // resolve o link de um grupo/canal (público → t.me/@; privado → convite via bot admin).
    const resolveChat = async (list, id) => {
        const g = list.find((x) => x.id === id);
        if (!g) return;
        if (g.username) {
            setValue(`https://t.me/${g.username}`);
            return;
        }
        setResolving(true);
        try {
            const r = await get(`/telegram/groups/${g.id}/invite-link`);
            setValue(r.url);
        } catch (e) {
            const m = e?.response?.data?.message ?? e?.message;
            toast.error(Array.isArray(m) ? m.join(' | ') : String(m || 'Falha ao gerar o link.'));
        } finally {
            setResolving(false);
        }
    };

    const dlUrl = dlBot && dlParam.trim() ? `https://t.me/${dlBot}?start=${encodeURIComponent(dlParam.trim())}` : '';
    const copyDl = async () => {
        if (!dlUrl) return;
        try {
            await navigator.clipboard.writeText(dlUrl);
            setCopied(true);
            toast.success('Link copiado!');
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };
    const confirm = () => {
        const raw = kind === 'deeplink' ? dlUrl : value.trim();
        if (!raw) return;
        // grupo/bot/deeplink → normaliza p/ t.me (abre o app). URL livre: só conserta
        // se for um link do Telegram Web (não mexe em sites comuns).
        const isTgWeb = /web\.telegram\.org|telegram\.me|^tg:\/\//i.test(raw);
        const v = kind === 'url' ? (isTgWeb ? normalizeTelegramLink(raw) : raw) : normalizeTelegramLink(raw);
        onPick(v);
        onClose();
    };

    const canInsert = kind === 'deeplink' ? !!dlUrl : !!value.trim();

    return (
        <TgModal
            open={open}
            onClose={onClose}
            title="Inserir link"
            subtitle="Abre o app do Telegram (t.me) quando aplicável."
            maxWidth="sm"
            footer={
                <>
                    <Button color="inherit" onClick={onClose} sx={{ textTransform: 'none' }}>
                        Cancelar
                    </Button>
                    <Button variant="contained" onClick={confirm} disabled={!canInsert} sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 110 }}>
                        Inserir
                    </Button>
                </>
            }
        >
            <Stack spacing={2}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                    {TYPES.map((t) => (
                        <TypeCard key={t.value} type={t} active={kind === t.value} onClick={() => { setKind(t.value); setValue(''); setCopied(false); }} />
                    ))}
                </Box>

                {kind === 'deeplink' ? (
                    <>
                        <SearchSelect
                            fullWidth
                            label="Bot"
                            value={dlBot}
                            onChange={setDlBot}
                            options={(bots || []).filter((b) => b.username).map((b) => ({ value: b.username, label: b.name, secondary: `@${b.username}`, icon: IconRobot }))}
                        />
                        <TextField size="small" fullWidth label="Parâmetro (ex.: campanha_black)" placeholder="fb_camp_x" value={dlParam} onChange={(e) => setDlParam(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} helperText="Chega como origem do lead ({{start_param}}). Só letras/números/_/-." />
                        {dlUrl ? (
                            <TextField
                                size="small"
                                fullWidth
                                value={dlUrl}
                                InputProps={{
                                    readOnly: true,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip title={copied ? 'Copiado!' : 'Copiar link'}>
                                                <IconButton size="small" onClick={copyDl} edge="end" color={copied ? 'success' : 'default'}>
                                                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                                </IconButton>
                                            </Tooltip>
                                        </InputAdornment>
                                    )
                                }}
                                onFocus={(e) => e.target.select()}
                                label="Link gerado"
                            />
                        ) : null}
                    </>
                ) : kind === 'channel' ? (
                    <>
                        <SearchSelect
                            fullWidth
                            label="Canal do bot"
                            value={selectedChannelId}
                            onChange={(v) => {
                                setSelectedChannelId(v);
                                resolveChat(channels, v);
                            }}
                            options={channels.map((c) => ({ value: c.id, label: c.name, secondary: c.username ? `@${c.username}` : 'privado', avatarPath: `/telegram/groups/${c.id}/photo`, icon: IconBroadcast }))}
                        />
                        {resolving ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={14} />
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Gerando link de convite…</Typography>
                            </Stack>
                        ) : null}
                        <TextField size="small" fullWidth label="Link do canal" placeholder="Selecione acima, ou cole um convite" value={value} onChange={(e) => setValue(e.target.value)} helperText="Privado: o bot precisa ser admin do canal." />
                    </>
                ) : kind === 'group' ? (
                    <>
                        <SearchSelect
                            fullWidth
                            label="Grupo do bot"
                            value={selectedGroupId}
                            onChange={(v) => {
                                setSelectedGroupId(v);
                                resolveChat(groups, v);
                            }}
                            options={groups.map((g) => ({ value: g.id, label: g.name, secondary: g.username ? `@${g.username}` : 'privado', avatarPath: `/telegram/groups/${g.id}/photo`, icon: IconUsersGroup }))}
                        />
                        {resolving ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={14} />
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Gerando link de convite…</Typography>
                            </Stack>
                        ) : null}
                        <TextField size="small" fullWidth label="Link do grupo" placeholder="Selecione acima, ou cole um convite" value={value} onChange={(e) => setValue(e.target.value)} helperText="Privado: o bot precisa ser admin com permissão de convidar." />
                    </>
                ) : kind === 'bot' ? (
                    <>
                        <SearchSelect
                            fullWidth
                            label="Seus bots"
                            value={value}
                            onChange={setValue}
                            options={(bots || []).filter((b) => b.username).map((b) => ({ value: `https://t.me/${b.username}`, label: b.name, secondary: `@${b.username}`, icon: IconRobot }))}
                        />
                        <TextField size="small" fullWidth label="ou cole o link do bot" placeholder="https://t.me/OutroBot" value={value} onChange={(e) => setValue(e.target.value)} />
                    </>
                ) : (
                    <TextField size="small" fullWidth label="URL" placeholder="https://…" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
                )}
            </Stack>
        </TgModal>
    );
}
