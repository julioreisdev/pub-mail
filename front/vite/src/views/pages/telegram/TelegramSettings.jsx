import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import {
    IconPlus,
    IconRefresh,
    IconTrash,
    IconPencil,
    IconCopy,
    IconCheck,
    IconRobot,
    IconWorldBolt,
    IconAlertTriangle,
    IconPlugConnected,
    IconSend,
    IconChevronRight,
    IconHandClick,
    IconSettings,
    IconDotsVertical,
    IconBrandTelegram
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, patch, remove } from '../../../api/api';
import BotProfileDialog from './BotProfileDialog';
import {
    TgPageHeader,
    TgCard,
    TgAvatar,
    TgStatusPill,
    TgEmptyState,
    TgGhostButton,
    TgModal,
    TgConfirmDialog,
    TgCardGridSkeleton
} from './ui';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function errMsg(e, fallback) {
    const m = e?.response?.data?.message ?? e?.message;
    if (Array.isArray(m)) return m.join(' | ');
    return String(m || fallback);
}

function fmtDate(v) {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
    } catch {
        return String(v);
    }
}

// Tempo relativo curto ("há 5 min"); null se muito antigo (cai no absoluto).
function timeAgo(v) {
    if (!v) return null;
    const t = new Date(v).getTime();
    if (Number.isNaN(t)) return null;
    const diff = Date.now() - t;
    if (diff < 0) return 'agora';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
    return null;
}

// status do bot → chave/label do TgStatusPill
const STATUS_KEY = { ACTIVE: 'active', BANNED: 'banned', ERROR: 'error' };
const STATUS_LABEL = { ACTIVE: 'Ativo', BANNED: 'Banido', ERROR: 'Instável' };

// flood-wait do Telegram (429): pausa TEMPORÁRIA de envio. Calcula "volta em ~Xh Ym (~HH:MM)".
function floodEta(until) {
    if (!until) return null;
    const ms = new Date(until).getTime() - Date.now();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const rel = h > 0 ? `~${h}h${m > 0 ? ` ${m}min` : ''}` : `~${Math.max(1, m)}min`;
    let when = '';
    try {
        when = new Date(until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        when = '';
    }
    return { rel, when };
}

// ---------- comando copiável ----------
function CopyLine({ text, caption }) {
    const [copied, setCopied] = useState(false);
    const doCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };
    return (
        <Box>
            {caption ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    {caption}
                </Typography>
            ) : null}
            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.75
                }}
            >
                <Typography sx={{ flex: 1, fontFamily: MONO, fontSize: 13, wordBreak: 'break-all' }}>{text}</Typography>
                <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
                    <IconButton size="small" onClick={doCopy} color={copied ? 'success' : 'default'}>
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </IconButton>
                </Tooltip>
            </Stack>
        </Box>
    );
}

// ---------- card de bot ----------
function BotCard({ bot, onEdit, onRevalidate, onDelete, onTest, onSettings, revalidating, testing }) {
    const [menuEl, setMenuEl] = useState(null);
    const impaired = bot.status !== 'ACTIVE';
    const statusKey = STATUS_KEY[bot.status] || 'error';
    // flood-wait: pausa temporária (bot segue ACTIVE no getMe, só não pode enviar por um tempo).
    const flood = bot.status === 'ACTIVE' ? floodEta(bot.flood_until) : null;
    const botLink = bot.username ? `https://t.me/${bot.username}` : '';
    const rel = timeAgo(bot.last_checked_at);
    const verified = rel ? `Verificado ${rel}` : `Checado ${fmtDate(bot.last_checked_at)}`;
    const gc = bot.groups_count ?? 0;
    const lc = bot.leads_count ?? 0;

    const closeMenu = () => setMenuEl(null);

    const copyLink = async () => {
        if (!botLink) return;
        try {
            await navigator.clipboard.writeText(botLink);
            toast.success('Link do bot copiado.');
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };

    const copyToken = async () => {
        try {
            await navigator.clipboard.writeText(bot.token_masked || '');
            toast.success('Copiado.');
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };

    return (
        <TgCard sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* cabeçalho */}
            <Stack direction="row" spacing={1.5} alignItems="center">
                <TgAvatar name={bot.name || bot.first_name} photoPath={`/telegram/bots/${bot.id}/photo`} size={46} kind="bot" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                        {bot.name}
                    </Typography>
                    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                            {bot.username ? `@${bot.username}` : bot.first_name || 'bot'}
                        </Typography>
                        {botLink ? (
                            <Tooltip title="Copiar link do bot (t.me)">
                                <IconButton size="small" onClick={copyLink} sx={{ p: 0.25, color: 'text.secondary' }}>
                                    <IconCopy size={13} />
                                </IconButton>
                            </Tooltip>
                        ) : null}
                    </Stack>
                </Box>
                {flood ? <TgStatusPill status="flood" label="Em pausa" /> : <TgStatusPill status={statusKey} label={STATUS_LABEL[bot.status]} />}
            </Stack>

            {/* token (chip código) */}
            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.25, py: 0.6 }}
            >
                <Typography sx={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: 'text.secondary', wordBreak: 'break-all' }}>
                    {bot.token_masked}
                </Typography>
                <Tooltip title="Copiar">
                    <IconButton size="small" onClick={copyToken} sx={{ color: 'text.secondary' }}>
                        <IconCopy size={14} />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* webhook + contadores */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ color: bot.webhook_set ? 'success.main' : 'warning.main' }}
                >
                    <IconPlugConnected size={15} />
                    <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
                        {bot.webhook_set ? 'Webhook ativo' : 'Webhook pendente'}
                    </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {gc} {gc === 1 ? 'grupo' : 'grupos'} · {lc} {lc === 1 ? 'lead' : 'leads'}
                </Typography>
            </Stack>

            {impaired ? (
                <Alert
                    severity={bot.status === 'BANNED' ? 'error' : 'warning'}
                    icon={<IconAlertTriangle size={18} />}
                    sx={{ py: 0.25, borderRadius: 2, '& .MuiAlert-message': { fontSize: 12.5 } }}
                >
                    {bot.status === 'BANNED'
                        ? 'Token inválido ou revogado — o bot fica indisponível (grupos, DMs, broadcasts). É permanente: NÃO volta sozinho; recadastre o token no BotFather e atualize aqui.'
                        : 'Não foi possível confirmar o bot no Telegram. Tente revalidar.'}
                    {bot.last_error ? (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, opacity: 0.8 }}>
                            {bot.last_error}
                        </Typography>
                    ) : null}
                </Alert>
            ) : null}

            {flood ? (
                <Alert
                    severity="warning"
                    icon={<IconAlertTriangle size={18} />}
                    sx={{ py: 0.25, borderRadius: 2, '& .MuiAlert-message': { fontSize: 12.5 } }}
                >
                    ⏳ <strong>Pausa temporária do Telegram</strong> (flood-wait). O bot não envia mensagens por
                    excesso de disparos/edições. <strong>É temporário</strong> — volta a enviar sozinho em{' '}
                    <strong>{flood.rel}</strong>
                    {flood.when ? ` (por volta de ${flood.when})` : ''}. Não precisa fazer nada; evite disparos em
                    rajada até lá.
                </Alert>
            ) : null}

            <Box sx={{ flex: 1 }} />

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {verified}
            </Typography>
            <Divider sx={{ mt: 0.25 }} />

            {/* ações */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Tooltip
                    title={
                        flood
                            ? 'Bot em pausa temporária do Telegram (flood) — aguarde liberar'
                            : bot.can_test
                              ? 'Envia uma DM de teste para você'
                              : 'Abra seu bot no Telegram e envie /start primeiro'
                    }
                >
                    <span>
                        <Button
                            size="small"
                            onClick={() => onTest(bot)}
                            disabled={testing || bot.status === 'BANNED' || !!flood}
                            startIcon={testing ? <CircularProgress size={13} /> : <IconSend size={15} />}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                color: 'text.secondary',
                                px: 1,
                                minWidth: 0,
                                '&:hover': { color: 'primary.main', bgcolor: 'action.hover' }
                            }}
                        >
                            Enviar teste
                        </Button>
                    </span>
                </Tooltip>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title="Configurar (nome, descrição, comandos…)">
                        <IconButton size="small" onClick={() => onSettings(bot)}>
                            <IconSettings size={17} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Mais ações">
                        <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)}>
                            <IconDotsVertical size={17} />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>

            <Menu
                anchorEl={menuEl}
                open={!!menuEl}
                onClose={closeMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        onRevalidate(bot);
                    }}
                    disabled={revalidating}
                >
                    <ListItemIcon>{revalidating ? <CircularProgress size={16} /> : <IconRefresh size={17} />}</ListItemIcon>
                    <ListItemText>Revalidar</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        onEdit(bot);
                    }}
                >
                    <ListItemIcon>
                        <IconPencil size={17} />
                    </ListItemIcon>
                    <ListItemText>Editar</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        onDelete(bot);
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <ListItemIcon sx={{ color: 'error.main' }}>
                        <IconTrash size={17} />
                    </ListItemIcon>
                    <ListItemText>Excluir</ListItemText>
                </MenuItem>
            </Menu>
        </TgCard>
    );
}

// ---------- aba: ajuda ----------
function HelpStep({ n, title, children }) {
    return (
        <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar sx={{ width: 30, height: 30, fontSize: 14, fontWeight: 700, bgcolor: 'primary.main', color: '#fff', flexShrink: 0 }}>
                {n}
            </Avatar>
            <Box sx={{ flex: 1, pb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{title}</Typography>
                <Stack spacing={1}>{children}</Stack>
            </Box>
        </Stack>
    );
}

// Referência completa dos comandos do @BotFather, agrupados.
const BOTFATHER_COMMANDS = [
    {
        title: 'Criar e listar',
        items: [
            { cmd: '/newbot', desc: 'Criar um novo bot' },
            { cmd: '/mybots', desc: 'Ver e gerenciar seus bots' },
            { cmd: '/mygroups', desc: 'Gerenciar grupos vinculados (games)' },
            { cmd: '/deletebot', desc: 'Apagar um bot de vez' }
        ]
    },
    {
        title: 'Token e segurança',
        items: [
            { cmd: '/token', desc: 'Mostrar o token de um bot' },
            { cmd: '/revoke', desc: 'Revogar o token e gerar um novo' }
        ]
    },
    {
        title: 'Identidade e perfil',
        items: [
            { cmd: '/setname', desc: 'Nome de exibição' },
            { cmd: '/setdescription', desc: 'Descrição (antes do /start)' },
            { cmd: '/setabouttext', desc: 'Texto curto do perfil' },
            { cmd: '/setuserpic', desc: 'Foto do bot' },
            { cmd: '/setcommands', desc: 'Menu de comandos do usuário' }
        ]
    },
    {
        title: 'Grupos e privacidade',
        items: [
            { cmd: '/setjoingroups', desc: 'Permitir adicionar a grupos' },
            { cmd: '/setprivacy', desc: 'Modo privacidade em grupos' }
        ]
    },
    {
        title: 'Inline e domínio (avançado)',
        items: [
            { cmd: '/setinline', desc: 'Ativar modo inline' },
            { cmd: '/setinlinegeo', desc: 'Pedir localização no inline' },
            { cmd: '/setinlinefeedback', desc: 'Feedback de resultados inline' },
            { cmd: '/setdomain', desc: 'Vincular domínio (Login Widget)' }
        ]
    },
    {
        title: 'Games',
        items: [
            { cmd: '/newgame', desc: 'Criar um game' },
            { cmd: '/listgames', desc: 'Listar seus games' },
            { cmd: '/editgame', desc: 'Editar um game' },
            { cmd: '/deletegame', desc: 'Apagar um game' }
        ]
    },
    {
        title: 'Utilidades',
        items: [
            { cmd: '/cancel', desc: 'Cancelar a operação atual' },
            { cmd: '/help', desc: 'Lista completa no próprio BotFather' }
        ]
    }
];

// Pílula que imita um botão do BotFather (o usuário "toca" nele no Telegram).
function Tap({ children, tone = 'default' }) {
    const token = tone === 'on' ? 'success' : tone === 'off' ? 'error' : 'primary';
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.35,
                borderRadius: 1.5,
                fontSize: 12.5,
                fontWeight: 700,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                color: `${token}.main`,
                border: '1px solid',
                borderColor: (t) => `rgba(${t.vars.palette[token].mainChannel} / 0.4)`,
                bgcolor: (t) => `rgba(${t.vars.palette[token].mainChannel} / 0.1)`
            }}
        >
            {children}
        </Box>
    );
}

// Linha de fluxo: [toque] › [toque] › [toque]
function Flow({ steps }) {
    return (
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {steps.map((s, i) => (
                <Box key={i} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    {typeof s === 'string' ? <Tap>{s}</Tap> : <Tap tone={s.tone}>{s.label}</Tap>}
                    {i < steps.length - 1 ? <IconChevronRight size={14} style={{ opacity: 0.5 }} /> : null}
                </Box>
            ))}
        </Stack>
    );
}

function HelpTab() {
    return (
        <Stack spacing={2.5} sx={{ maxWidth: 760 }}>
            {/* como o BotFather funciona */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar sx={{ width: 40, height: 40, background: 'linear-gradient(135deg, #2AABEE, #229ED9)', color: '#fff' }}>
                        <IconRobot size={22} />
                    </Avatar>
                    <Box>
                        <Typography sx={{ fontWeight: 700 }}>Como funciona o @BotFather</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            É o bot oficial do Telegram que cria e configura os seus bots.
                        </Typography>
                    </Box>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    O BotFather <b>não é um painel de configurações</b> — é um <b>chat</b>. Você manda uma mensagem e ele responde:
                    às vezes pedindo pra você <b>escolher qual bot</b>, às vezes mostrando <b>botões</b> pra você tocar (como{' '}
                    <Tap>Bot Settings</Tap> ou <Tap tone="off">Turn off</Tap>). É só ir seguindo a conversa com ele.
                </Typography>
            </Box>

            {/* jeito fácil: /mybots */}
            <Box sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 3, p: 2.5, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <IconHandClick size={20} />
                    <Typography sx={{ fontWeight: 700 }}>Jeito mais fácil: o menu /mybots</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    Em vez de decorar comandos, use o menu. Ele mostra botões pra tudo — nome, foto, token, privacidade, grupos.
                </Typography>
                <Stack spacing={2}>
                    <HelpStep n={1} title="Envie /mybots">
                        <CopyLine text="/mybots" caption="Lista todos os bots da sua conta" />
                    </HelpStep>
                    <HelpStep n={2} title="Toque no bot que você quer">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            O BotFather mostra seus bots como botões. Toque no bot desejado para abrir o menu dele.
                        </Typography>
                        <Flow steps={['/mybots', '@seu_bot']} />
                    </HelpStep>
                    <HelpStep n={3} title="Use os botões do menu">
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                            Os que você vai usar:
                        </Typography>
                        <Stack spacing={0.75}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Tap>API Token</Tap>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>copiar o token pra colar aqui</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Tap>Bot Settings</Tap>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>privacidade e permissão de grupos</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Tap>Edit Bot</Tap>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>nome, descrição, foto, comandos</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Tap tone="off">Delete Bot</Tap>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>apagar o bot de vez</Typography>
                            </Stack>
                        </Stack>
                    </HelpStep>
                </Stack>
            </Box>

            {/* 2 ajustes obrigatórios */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, bgcolor: 'background.paper' }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Deixe o bot pronto pro nosso fluxo (2 ajustes)</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                    Necessário pra captar leads e gerenciar grupos. Siga tocando exatamente nesta sequência:
                </Typography>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
                        1. Desligar a privacidade
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Sem isso o bot não enxerga as mensagens do grupo.
                    </Typography>
                    <Flow steps={['/mybots', '@seu_bot', 'Bot Settings', 'Group Privacy', { label: 'Turn off', tone: 'off' }]} />
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
                        2. Permitir entrar em grupos
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Confirme que está habilitado (normalmente já vem assim).
                    </Typography>
                    <Flow steps={['/mybots', '@seu_bot', 'Bot Settings', 'Allow Groups?', { label: 'Enabled', tone: 'on' }]} />
                </Box>
            </Box>

            {/* criar / personalizar */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, bgcolor: 'background.paper' }}>
                <Stack spacing={2}>
                    <HelpStep n={1} title="Ainda não tem bot? Crie um">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Envie <code>/newbot</code> e siga: escolha um <b>nome</b> e um <b>@username</b> (precisa terminar em{' '}
                            <code>bot</code>, ex.: <code>minhaempresa_bot</code>). No fim ele te dá o <b>token</b> — cole aqui na aba{' '}
                            <b>Cadastro de Bots</b>.
                        </Typography>
                        <CopyLine text="/newbot" />
                    </HelpStep>
                    <HelpStep n={2} title="Personalize a marca (opcional)">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Pelo <Tap>Edit Bot</Tap> você troca tudo com botões: <Tap>Edit Name</Tap>, <Tap>Edit Description</Tap>,{' '}
                            <Tap>Edit About</Tap>, <Tap>Edit Botpic</Tap> (a foto se muda <b>aqui</b>, não abrindo o chat do bot) e{' '}
                            <Tap>Edit Commands</Tap>.
                        </Typography>
                        <Flow steps={['/mybots', '@seu_bot', 'Edit Bot']} />
                    </HelpStep>
                </Stack>
            </Box>

            <Alert severity="warning" icon={<IconAlertTriangle size={18} />} sx={{ borderRadius: 2 }}>
                <b>Trocou o token?</b> Se você revogar o token (<Tap>API Token</Tap> → <Tap tone="off">Revoke current token</Tap>),
                atualize-o aqui no bot correspondente (Editar → Novo token). O token antigo para de funcionar na hora.
            </Alert>

            {/* referência de comandos (opcional) */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, bgcolor: 'background.paper' }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Atalhos por comando (opcional)</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                    Se preferir, dá pra chamar cada ação direto por um comando — ao enviar, o BotFather vai te perguntar{' '}
                    <b>qual bot</b> e, quando fizer sentido, mostrar os botões.
                </Typography>
                {BOTFATHER_COMMANDS.map((group) => (
                    <Box key={group.title} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                        <Typography
                            variant="overline"
                            sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1 }}
                        >
                            {group.title}
                        </Typography>
                        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                            {group.items.map((c) => (
                                <CopyLine key={c.cmd} text={c.cmd} caption={c.desc} />
                            ))}
                        </Box>
                    </Box>
                ))}
            </Box>

            <Alert severity="info" icon={<IconWorldBolt size={18} />} sx={{ borderRadius: 2 }}>
                <b>Dica de resiliência:</b> crie bots em <b>contas (números) diferentes</b> do Telegram. Se uma conta for banida,
                só os bots dela param — os demais seguem enviando. No Pub Mail você só cola os tokens; distribuir entre contas é o
                que te protege.
            </Alert>
        </Stack>
    );
}

// ---------- página ----------
export default function TelegramSettings() {
    const [tab, setTab] = useState(0);

    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState({ open: false, mode: 'add', bot: null });
    const [form, setForm] = useState({ name: '', token: '' });
    const [saving, setSaving] = useState(false);
    const [delTarget, setDelTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [revalId, setRevalId] = useState('');
    const [testId, setTestId] = useState('');
    const [settingsBot, setSettingsBot] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setBots(await get('/telegram/bots'));
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar os bots.'));
        } finally {
            setLoading(false);
        }
    }, []);

    // Recarrega a lista SEM ligar o spinner de página (evita a lista sumir por 1s).
    const refresh = useCallback(async () => {
        try {
            setBots(await get('/telegram/bots'));
        } catch {
            /* mantém o estado atual */
        }
    }, []);

    const replaceBot = useCallback((bot) => {
        setBots((prev) => prev.map((b) => (b.id === bot.id ? bot : b)));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openAdd = () => {
        setForm({ name: '', token: '' });
        setDialog({ open: true, mode: 'add', bot: null });
    };
    const openEdit = (bot) => {
        setForm({ name: bot.name || '', token: '' });
        setDialog({ open: true, mode: 'edit', bot });
    };
    const closeDialog = () => {
        if (!saving) setDialog((d) => ({ ...d, open: false }));
    };

    const submit = async () => {
        const name = form.name.trim();
        const token = form.token.trim();
        if (!name) return toast.error('Informe um nome para o bot.');
        if (dialog.mode === 'add' && !token) return toast.error('Cole o token do bot.');
        setSaving(true);
        try {
            if (dialog.mode === 'add') {
                await post('/telegram/bots', { name, token });
                toast.success('Bot cadastrado.');
            } else {
                const payload = { name };
                if (token) payload.token = token;
                await patch(`/telegram/bots/${dialog.bot.id}`, payload);
                toast.success('Bot atualizado.');
            }
            setDialog((d) => ({ ...d, open: false }));
            await refresh();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar o bot.'));
        } finally {
            setSaving(false);
        }
    };

    const revalidate = async (bot) => {
        setRevalId(bot.id);
        try {
            const updated = await post(`/telegram/bots/${bot.id}/revalidate`);
            if (updated && updated.id) replaceBot(updated);
            toast.success('Revalidado.');
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao revalidar.'));
        } finally {
            setRevalId('');
        }
    };

    const sendTest = async (bot) => {
        setTestId(bot.id);
        try {
            await post(`/telegram/bots/${bot.id}/test`);
            toast.success('Mensagem de teste enviada! Confira no Telegram.');
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao enviar a mensagem de teste.'));
        } finally {
            setTestId('');
        }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            await remove(`/telegram/bots/${delTarget.id}`);
            toast.success('Bot excluído.');
            setDelTarget(null);
            await refresh();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao excluir.'));
        } finally {
            setDeleting(false);
        }
    };

    const total = bots.length;
    const activeCount = bots.filter((b) => b.status === 'ACTIVE').length;
    const botsSubtitle = loading
        ? 'Carregando os seus bots…'
        : total === 0
          ? 'Cadastre o primeiro bot para captar leads e disparar mensagens no Telegram.'
          : `${total} ${total === 1 ? 'bot cadastrado' : 'bots cadastrados'} · ${activeCount} ${
                activeCount === 1 ? 'ativo' : 'ativos'
            }. Cada bot é um remetente independente — distribua-os em contas diferentes para resistir a banimentos.`;

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TgPageHeader
                icon={IconBrandTelegram}
                title="Configurações"
                subtitle={tab === 0 ? botsSubtitle : 'Crie e configure bots no @BotFather e deixe-os prontos para o nosso fluxo.'}
                action={
                    tab === 0 ? (
                        <Button
                            variant="contained"
                            startIcon={<IconPlus size={18} />}
                            onClick={openAdd}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            Adicionar bot
                        </Button>
                    ) : null
                }
            />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Cadastro de Bots" sx={{ fontWeight: 600, textTransform: 'none' }} />
                    <Tab label="Ajuda" sx={{ fontWeight: 600, textTransform: 'none' }} />
                </Tabs>
            </Box>

            {tab === 0 ? (
                loading ? (
                    <TgCardGridSkeleton count={3} height={210} />
                ) : bots.length === 0 ? (
                    <TgEmptyState
                        icon={IconRobot}
                        title="Nenhum bot ainda"
                        description="Crie um bot no @BotFather e cadastre o token aqui. Veja o passo a passo na aba Ajuda."
                        action={
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center">
                                <Button
                                    variant="contained"
                                    startIcon={<IconPlus size={18} />}
                                    onClick={openAdd}
                                    sx={{ borderRadius: 2, fontWeight: 700 }}
                                >
                                    Adicionar bot
                                </Button>
                                <TgGhostButton startIcon={<IconHandClick size={16} />} onClick={() => setTab(1)}>
                                    Ver a aba Ajuda
                                </TgGhostButton>
                            </Stack>
                        }
                    />
                ) : (
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2,
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }
                        }}
                    >
                        {bots.map((bot) => (
                            <BotCard
                                key={bot.id}
                                bot={bot}
                                onEdit={openEdit}
                                onRevalidate={revalidate}
                                onDelete={setDelTarget}
                                onTest={sendTest}
                                onSettings={setSettingsBot}
                                revalidating={revalId === bot.id}
                                testing={testId === bot.id}
                            />
                        ))}
                    </Box>
                )
            ) : (
                <HelpTab />
            )}

            {/* modal add/edit */}
            <TgModal
                open={dialog.open}
                onClose={closeDialog}
                disableClose={saving}
                maxWidth="sm"
                title={dialog.mode === 'add' ? 'Adicionar bot' : 'Editar bot'}
                subtitle={
                    dialog.mode === 'add'
                        ? 'Cadastre um bot para captar leads e disparar mensagens no Telegram.'
                        : 'Atualize o nome ou troque o token deste bot.'
                }
                footer={
                    <>
                        <Button onClick={closeDialog} color="inherit" disabled={saving} sx={{ textTransform: 'none' }}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={submit}
                            variant="contained"
                            disabled={saving}
                            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : null}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            {dialog.mode === 'add' ? 'Cadastrar' : 'Salvar'}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2}>
                    <TextField
                        label="Nome no Pub Mail"
                        placeholder="Ex.: Bot Principal — Conta 1"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        fullWidth
                        autoFocus
                        helperText="Só para identificar o bot aqui na plataforma."
                    />
                    <TextField
                        label={dialog.mode === 'add' ? 'Token do bot' : 'Novo token (opcional)'}
                        placeholder="123456789:AA..."
                        value={form.token}
                        onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                        fullWidth
                        helperText={
                            dialog.mode === 'add'
                                ? 'Cole o token que o @BotFather te enviou. Validamos no Telegram na hora.'
                                : 'Deixe em branco para manter o token atual.'
                        }
                    />
                    {dialog.mode === 'add' ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Não tem um bot?{' '}
                            <Box
                                component="span"
                                onClick={() => {
                                    setDialog((d) => ({ ...d, open: false }));
                                    setTab(1);
                                }}
                                sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                                crie com /newbot na aba Ajuda
                            </Box>
                            .
                        </Typography>
                    ) : null}
                </Stack>
            </TgModal>

            {/* confirmação de exclusão */}
            <TgConfirmDialog
                open={!!delTarget}
                onClose={() => setDelTarget(null)}
                onConfirm={confirmDelete}
                loading={deleting}
                danger
                icon={IconTrash}
                title="Excluir bot"
                message={`Excluir "${delTarget?.name}" remove também tudo vinculado a ele (grupos, links, broadcasts e DMs). Leads que só existiam por este bot serão removidos; quem também é de outro bot permanece. Esta ação é irreversível.`}
                confirmLabel="Excluir"
            />

            <BotProfileDialog
                botId={settingsBot?.id}
                botName={settingsBot?.name}
                open={!!settingsBot}
                onClose={() => setSettingsBot(null)}
                onSaved={load}
            />
        </Box>
    );
}
