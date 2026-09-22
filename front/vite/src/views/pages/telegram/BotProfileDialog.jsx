import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography
} from '@mui/material';
import {
    IconPlus,
    IconTrash,
    IconDeviceFloppy,
    IconCircleCheck,
    IconAlertTriangle,
    IconCopy,
    IconArrowLeft,
    IconDotsVertical,
    IconRefresh,
    IconTerminal2
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, patch } from '../../../api/api';
import AuthImage from './AuthImage';
import { TgModal, TgEmptyState, TgGhostButton } from './ui';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function errMsg(e, fb) {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
}

const EMPTY = {
    name: '',
    description: '',
    short_description: '',
    commands: [],
    username: '',
    can_join_groups: null,
    can_read_all_group_messages: null
};

// Cabeçalho de seção discreto (overline + hint + ação opcional).
function Section({ title, hint, action, children }) {
    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: hint ? 0.5 : 1 }}>
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary', lineHeight: 1.6 }}>
                    {title}
                </Typography>
                {action || null}
            </Stack>
            {hint ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                    {hint}
                </Typography>
            ) : null}
            {children}
        </Box>
    );
}

// Linha de status com indicador de "ok" vs "precisa ajustar" (relativo ao nosso fluxo de grupos).
function StatusRow({ ok, label, okText, badText, hint }) {
    return (
        <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0, mt: '1px', color: ok ? 'success.main' : 'warning.main' }}>
                {ok ? <IconCircleCheck size={20} /> : <IconAlertTriangle size={20} />}
            </Box>
            <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {label}:{' '}
                    <Box component="span" sx={{ color: ok ? 'success.main' : 'warning.main' }}>
                        {ok ? okText : badText}
                    </Box>
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {ok ? '✓ Tudo certo para captar leads em grupos.' : hint}
                </Typography>
            </Box>
        </Stack>
    );
}

export default function BotProfileDialog({ botId, botName, open, onClose, onSaved }) {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [showIntro, setShowIntro] = useState(true);
    const bodyRef = useRef(null);

    const load = useCallback(async () => {
        if (!botId) return;
        setLoading(true);
        setError('');
        try {
            const p = await get(`/telegram/bots/${botId}/profile`);
            setForm({ ...EMPTY, ...p, commands: Array.isArray(p.commands) ? p.commands : [] });
            setShowIntro(!!(p.description && p.description.trim()));
        } catch (e) {
            // NÃO apresentar campos vazios como verdade — salvar assim apagaria o perfil real.
            const msg = errMsg(e, 'Falha ao carregar o perfil.');
            setError(msg);
            setForm(EMPTY);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [botId]);

    // Toda abertura re-busca o perfil e mostra o loading primeiro.
    useEffect(() => {
        if (open) {
            setTab(0);
            load();
        }
    }, [open, load]);

    // Troca de aba volta o scroll do corpo do modal ao topo (senão o Preview abre cortado).
    useEffect(() => {
        const el = bodyRef.current?.closest('.MuiDialogContent-root');
        if (el) el.scrollTop = 0;
    }, [tab]);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const setCmd = (i, k, v) => setForm((f) => ({ ...f, commands: f.commands.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)) }));
    const addCmd = () => setForm((f) => ({ ...f, commands: [...f.commands, { command: '', description: '' }] }));
    const removeCmd = (i) => setForm((f) => ({ ...f, commands: f.commands.filter((_, idx) => idx !== i) }));

    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                description: showIntro ? form.description : '',
                short_description: form.short_description,
                commands: form.commands
                    .map((c) => ({ command: (c.command || '').trim(), description: (c.description || '').trim() }))
                    .filter((c) => c.command && c.description)
            };
            const p = await patch(`/telegram/bots/${botId}/profile`, payload);
            setForm({ ...EMPTY, ...p, commands: Array.isArray(p.commands) ? p.commands : [] });
            toast.success('Perfil atualizado no Telegram.');
            onSaved?.();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar.'));
        } finally {
            setSaving(false);
        }
    };

    const copyUserpic = async () => {
        try {
            await navigator.clipboard.writeText('/setuserpic');
            toast.success('Comando /setuserpic copiado.');
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };

    const initial = (form.name || botName || '?').trim().charAt(0).toUpperCase();
    const botAvatar = (px) => (
        <AuthImage
            path={`/telegram/bots/${botId}/photo`}
            alt={form.name}
            size={px}
            fallback={
                <Avatar sx={{ width: px, height: px, fontSize: px * 0.4, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #2AABEE, #229ED9)' }}>
                    {initial}
                </Avatar>
            }
        />
    );

    return (
        <TgModal
            open={open}
            onClose={onClose}
            disableClose={saving}
            maxWidth="sm"
            title="Configurar bot"
            subtitle={
                <>
                    <Box component="span" sx={{ display: 'block' }}>
                        {botName}
                        {form.username ? ` · @${form.username}` : ''}
                    </Box>
                    <Box component="span" sx={{ display: 'block', color: 'text.disabled', mt: 0.25 }}>
                        As alterações são aplicadas direto no Telegram.
                    </Box>
                </>
            }
            tabs={
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Configurações" sx={{ textTransform: 'none', fontWeight: 600 }} />
                    <Tab label="Preview" sx={{ textTransform: 'none', fontWeight: 600 }} />
                </Tabs>
            }
            footer={
                loading ? null : (
                    <>
                        <Button color="inherit" onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
                            Fechar
                        </Button>
                        <Button
                            variant="contained"
                            onClick={save}
                            disabled={saving || !!error}
                            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            Salvar
                        </Button>
                    </>
                )
            }
        >
            <Box ref={bodyRef}>
            {loading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', gap: 1.5, py: 6 }}>
                    <CircularProgress />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Carregando o perfil do bot…
                    </Typography>
                </Box>
            ) : error ? (
                <Stack spacing={2} alignItems="center" sx={{ py: 5, px: 2, textAlign: 'center' }}>
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'error.main',
                            bgcolor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.14)`
                        }}
                    >
                        <IconAlertTriangle size={28} stroke={1.8} />
                    </Box>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Não foi possível carregar o perfil
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 380, mx: 'auto' }}>
                            {error} Salvar está desativado para não sobrescrever os dados reais do bot no Telegram.
                        </Typography>
                    </Box>
                    <TgGhostButton startIcon={<IconRefresh size={16} />} onClick={load}>
                        Tentar novamente
                    </TgGhostButton>
                </Stack>
            ) : tab === 0 ? (
                <Stack spacing={2.5}>
                    {/* Foto */}
                    <Section title="Foto">
                        <Stack direction="row" spacing={2} alignItems="center">
                            {botAvatar(64)}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    A foto só pode ser trocada no <b>@BotFather</b> (é uma limitação do Telegram). Envie o comando
                                    abaixo, escolha este bot e mande a imagem:
                                </Typography>
                                <TgGhostButton startIcon={<IconCopy size={14} />} onClick={copyUserpic} sx={{ mt: 1, fontFamily: MONO }}>
                                    /setuserpic
                                </TgGhostButton>
                            </Box>
                        </Stack>
                    </Section>

                    <Divider />

                    {/* Perfil */}
                    <Section title="Perfil">
                        <Stack spacing={2}>
                            <TextField
                                label="Nome de exibição"
                                value={form.name}
                                onChange={(e) => setField('name', e.target.value)}
                                fullWidth
                                inputProps={{ maxLength: 64 }}
                                helperText="Como o bot aparece no Telegram."
                            />
                            <TextField
                                label="Sobre (texto curto do perfil)"
                                value={form.short_description}
                                onChange={(e) => setField('short_description', e.target.value)}
                                fullWidth
                                multiline
                                minRows={2}
                                inputProps={{ maxLength: 120 }}
                                helperText={`${form.short_description?.length || 0}/120 · aparece na aba "Sobre".`}
                            />
                            <Box>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 700 }}>Apresentação (“O que este bot pode fazer?”)</Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                            Card que aparece ao abrir o bot, antes do /start. Desligue para não mostrar.
                                        </Typography>
                                    </Box>
                                    <Switch checked={showIntro} onChange={(e) => setShowIntro(e.target.checked)} />
                                </Stack>
                                <TextField
                                    value={form.description}
                                    onChange={(e) => setField('description', e.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    disabled={!showIntro}
                                    placeholder="Ex.: Assistente da Blue Grid. Envie /start para começar."
                                    inputProps={{ maxLength: 512 }}
                                    helperText={showIntro ? `${form.description?.length || 0}/512` : 'Desligado — o card não será exibido.'}
                                />
                            </Box>
                        </Stack>
                    </Section>

                    <Divider />

                    {/* Comandos */}
                    <Section
                        title="Comandos"
                        hint={
                            <>
                                Aparecem no menu “/” do chat. Ex.: <code>start</code> → “Começar”.
                            </>
                        }
                        action={
                            <Button size="small" startIcon={<IconPlus size={16} />} onClick={addCmd} sx={{ textTransform: 'none' }}>
                                Adicionar
                            </Button>
                        }
                    >
                        <Stack spacing={1}>
                            {form.commands.length === 0 ? (
                                <TgEmptyState
                                    dense
                                    icon={IconTerminal2}
                                    title="Nenhum comando"
                                    description="Adicione comandos para o menu “/”. Deixar vazio remove o menu."
                                />
                            ) : (
                                form.commands.map((c, i) => (
                                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            placeholder="comando"
                                            value={c.command}
                                            onChange={(e) => setCmd(i, 'command', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                            sx={{ width: 140 }}
                                            InputProps={{ startAdornment: <Box component="span" sx={{ color: 'text.secondary', mr: 0.25 }}>/</Box> }}
                                            inputProps={{ maxLength: 32 }}
                                        />
                                        <TextField
                                            size="small"
                                            placeholder="Descrição"
                                            value={c.description}
                                            onChange={(e) => setCmd(i, 'description', e.target.value)}
                                            fullWidth
                                            inputProps={{ maxLength: 256 }}
                                        />
                                        <IconButton size="small" color="error" onClick={() => removeCmd(i)}>
                                            <IconTrash size={16} />
                                        </IconButton>
                                    </Stack>
                                ))
                            )}
                        </Stack>
                    </Section>

                    <Divider />

                    {/* Status */}
                    <Section
                        title="Status para grupos"
                        hint={
                            <>
                                Para captar leads e ler mensagens em grupos, o ideal é: <b>entrar em grupos permitido</b> e{' '}
                                <b>privacidade desligada</b>. Estes dois só mudam no @BotFather.
                            </>
                        }
                    >
                        <Stack spacing={1.5}>
                            <StatusRow
                                ok={!!form.can_join_groups}
                                label="Entrar em grupos"
                                okText="permitido"
                                badText="bloqueado"
                                hint="⚠ Ative no BotFather: /setjoingroups → Enable."
                            />
                            <StatusRow
                                ok={!!form.can_read_all_group_messages}
                                label="Privacidade"
                                okText="desligada (lê o grupo)"
                                badText="ligada (não lê o grupo)"
                                hint="⚠ Desligue no BotFather: /setprivacy → Disable."
                            />
                        </Stack>
                    </Section>
                </Stack>
            ) : (
                // ---- PREVIEW (tela do Telegram ao abrir o bot) ----
                <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5, textAlign: 'center' }}>
                        É isto que o usuário vê ao abrir o link do bot, antes de iniciar.
                    </Typography>
                    <Box
                        sx={(theme) => ({
                            maxWidth: 320,
                            mx: 'auto',
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 540,
                            bgcolor: '#c6d3e1',
                            ...theme.applyStyles('dark', { bgcolor: '#0e1621' })
                        })}
                    >
                        {/* header */}
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={(theme) => ({ px: 1.5, py: 1.1, color: '#fff', bgcolor: '#5288c1', ...theme.applyStyles('dark', { bgcolor: '#17212b' }) })}
                        >
                            <IconArrowLeft size={20} />
                            {botAvatar(34)}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2 }} noWrap>
                                    {form.name || botName || 'Bot'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                    bot
                                </Typography>
                            </Box>
                            <IconDotsVertical size={20} />
                        </Stack>

                        {/* corpo (wallpaper) */}
                        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            {showIntro && form.description?.trim() ? (
                                <Box
                                    sx={(theme) => ({
                                        width: '100%',
                                        maxWidth: 280,
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        bgcolor: '#e9eef3',
                                        ...theme.applyStyles('dark', { bgcolor: '#1c2836' })
                                    })}
                                >
                                    <Box sx={{ p: 2, display: 'grid', placeItems: 'center' }}>
                                        <AuthImage
                                            path={`/telegram/bots/${botId}/photo`}
                                            alt={form.name}
                                            size={150}
                                            rounded="24px"
                                            imgStyle={{ width: 150, height: 150 }}
                                            fallback={
                                                <Box
                                                    sx={{
                                                        width: 150,
                                                        height: 150,
                                                        borderRadius: '24px',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        color: '#fff',
                                                        fontWeight: 700,
                                                        fontSize: 56,
                                                        background: 'linear-gradient(135deg, #2AABEE, #229ED9)'
                                                    }}
                                                >
                                                    {initial}
                                                </Box>
                                            }
                                        />
                                    </Box>
                                    <Box sx={(theme) => ({ px: 2, py: 1.75, bgcolor: 'rgba(0,0,0,0.04)', ...theme.applyStyles('dark', { bgcolor: 'rgba(0,0,0,0.28)' }) })}>
                                        <Typography sx={(theme) => ({ fontWeight: 700, mb: 0.75, color: '#111', ...theme.applyStyles('dark', { color: '#fff' }) })}>
                                            O que este bot pode fazer?
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={(theme) => ({ whiteSpace: 'pre-wrap', color: '#333', ...theme.applyStyles('dark', { color: '#c9d3dd' }) })}
                                        >
                                            {form.description}
                                        </Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <Typography
                                    variant="caption"
                                    sx={(theme) => ({ color: 'rgba(0,0,0,0.5)', ...theme.applyStyles('dark', { color: 'rgba(255,255,255,0.5)' }) })}
                                >
                                    Sem apresentação — o usuário verá só o botão “Iniciar Bot”.
                                </Typography>
                            )}
                        </Box>

                        {/* botão iniciar */}
                        <Box sx={(theme) => ({ p: 1.5, bgcolor: '#fff', ...theme.applyStyles('dark', { bgcolor: '#17212b' }) })}>
                            <Box
                                sx={{
                                    textAlign: 'center',
                                    color: '#fff',
                                    fontWeight: 700,
                                    py: 1.25,
                                    borderRadius: 6,
                                    bgcolor: '#50a8eb',
                                    userSelect: 'none'
                                }}
                            >
                                Iniciar Bot
                            </Box>
                        </Box>
                    </Box>
                </Box>
            )}
            </Box>
        </TgModal>
    );
}
