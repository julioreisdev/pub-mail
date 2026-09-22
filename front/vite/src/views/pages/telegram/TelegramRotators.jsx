import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    FormControlLabel,
    InputAdornment,
    Radio,
    RadioGroup,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { IconPlus, IconSearch, IconPencil, IconTrash, IconRotateClockwise2, IconClock, IconUsersGroup, IconBroadcast, IconDeviceFloppy, IconMessages } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, put, remove } from '../../../api/api';
import SearchSelect from './SearchSelect';
import { TgPageHeader, TgFilterBar, TgCard, TgStatusPill, TgEmptyState, TgGhostButton, TgModal, TgConfirmDialog, TgListSkeleton } from './ui';

const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const EMPTY = { name: 'Nova rotativa', bot_id: '', target_kind: 'group', group_id: '', interval_seconds: 15, mode: 'sequential', messages: [], name_pool: [], active: true };
const DM_SENTINEL = '__dm__';

function RotatorModal({ initial, open, onClose, bots }) {
    const [form, setForm] = useState(EMPTY);
    const [targets, setTargets] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
    }, [open, initial]);

    // carrega grupos + canais do bot escolhido
    useEffect(() => {
        if (!open || !form.bot_id) {
            setTargets([]);
            return;
        }
        Promise.all([get(`/telegram/groups?bot_id=${form.bot_id}`), get(`/telegram/channels?bot_id=${form.bot_id}`)])
            .then(([g, c]) => setTargets([...g.map((x) => ({ ...x, _kind: 'group' })), ...c.map((x) => ({ ...x, _kind: 'channel' }))]))
            .catch(() => setTargets([]));
    }, [open, form.bot_id]);

    const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

    const isDm = form.target_kind === 'dm';

    const save = async () => {
        if (!form.bot_id) return toast.error('Escolha um bot.');
        if (!isDm && !form.group_id) return toast.error('Escolha onde a mensagem vai rotacionar (grupo/canal ou o próprio bot).');
        const messages = (form.messages || []).map((s) => s.trim()).filter(Boolean);
        if (!messages.length) return toast.error('Adicione ao menos uma mensagem.');
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                bot_id: form.bot_id,
                target_kind: form.target_kind,
                group_id: isDm ? null : form.group_id,
                interval_seconds: form.interval_seconds,
                mode: form.mode,
                messages,
                name_pool: form.name_pool || [],
                active: form.active
            };
            if (initial?.id) await put(`/telegram/rotators/${initial.id}`, payload);
            else await post('/telegram/rotators', payload);
            toast.success('Mensagem rotativa salva.');
            onClose(true);
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <TgModal
            open={open}
            onClose={() => !saving && onClose(false)}
            maxWidth="sm"
            title={initial?.id ? 'Editar mensagem rotativa' : 'Nova mensagem rotativa'}
            subtitle="O bot posta UMA mensagem e a edita em loop, alternando os textos abaixo."
            disableClose={saving}
            footer={
                <>
                    <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={save}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                    >
                        Salvar
                    </Button>
                </>
            }
        >
            <Stack spacing={2.25}>
                <TextField label="Nome" size="small" fullWidth value={form.name} onChange={(e) => setF({ name: e.target.value })} />

                <SearchSelect
                    fullWidth
                    label="Bot"
                    value={form.bot_id}
                    onChange={(v) => setF({ bot_id: v, group_id: '' })}
                    options={bots.map((b) => ({ value: b.id, label: `${b.name}${b.username ? ` · @${b.username}` : ''}` }))}
                />
                <SearchSelect
                    fullWidth
                    label="Onde a mensagem fica"
                    value={isDm ? DM_SENTINEL : form.group_id}
                    onChange={(v) => (v === DM_SENTINEL ? setF({ target_kind: 'dm', group_id: '' }) : setF({ target_kind: 'group', group_id: v }))}
                    options={[
                        { value: DM_SENTINEL, label: '🤖 O próprio bot (DMs de todos os leads)' },
                        ...targets.map((t) => ({ value: t.id, label: `${t._kind === 'channel' ? '📢 ' : '👥 '}${t.name || t.title}${t.username ? ` (@${t.username})` : ''}` }))
                    ]}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
                    {isDm
                        ? 'Nas DMs: o bot mantém UMA mensagem por lead, editada em loop. {{nome}} sorteia da lista de nomes abaixo. A atualização é gradual (respeita o limite do Telegram).'
                        : 'O bot precisa ser admin do grupo/canal (com permissão de postar). A mensagem é editada no lugar — não empilha.'}
                </Typography>

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Mensagens (uma por linha)</Typography>
                    <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={4}
                        value={(form.messages || []).join('\n')}
                        onChange={(e) => setF({ messages: e.target.value.split('\n') })}
                        placeholder={'Alan acabou de aderir ao VIP 🔥\nJosé acabou de aderir ao VIP 🔥\n{{nome}} acabou de aderir ao VIP 🔥'}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Use <b>{'{{nome}}'}</b> para sortear um nome da lista abaixo.
                    </Typography>
                </Box>

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Nomes para sortear (opcional, um por linha)</Typography>
                    <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={(form.name_pool || []).join('\n')}
                        onChange={(e) => setF({ name_pool: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                        placeholder={'Alan\nJosé\nMariana\nCarlos'}
                    />
                </Box>

                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                        size="small"
                        type="number"
                        label="Trocar a cada (s)"
                        value={form.interval_seconds}
                        onChange={(e) => setF({ interval_seconds: Math.min(3600, Math.max(5, Number(e.target.value) || 15)) })}
                        sx={{ width: 160 }}
                        inputProps={{ min: 5, max: 3600 }}
                    />
                    <RadioGroup row value={form.mode} onChange={(e) => setF({ mode: e.target.value })}>
                        <FormControlLabel value="sequential" control={<Radio size="small" />} label="Em sequência" />
                        <FormControlLabel value="random" control={<Radio size="small" />} label="Aleatório" />
                    </RadioGroup>
                </Stack>

                <FormControlLabel
                    control={<Switch checked={form.active} onChange={(e) => setF({ active: e.target.checked })} />}
                    label={form.active ? 'Ativa (rotacionando)' : 'Inativa'}
                />
            </Stack>
        </TgModal>
    );
}

export default function TelegramRotators() {
    const [list, setList] = useState([]);
    const [bots, setBots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // {} novo | {id} edit
    const [deleting, setDeleting] = useState(null);
    const [delBusy, setDelBusy] = useState(false);
    const [q, setQ] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [r, b] = await Promise.all([get('/telegram/rotators'), get('/telegram/bots')]);
            setList(r);
            setBots(b);
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleActive = async (r) => {
        try {
            await put(`/telegram/rotators/${r.id}`, { active: !r.active });
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao atualizar.'));
        }
    };
    const confirmDelete = async () => {
        setDelBusy(true);
        try {
            await remove(`/telegram/rotators/${deleting.id}`);
            toast.success('Rotativa excluída.');
            setDeleting(null);
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao excluir.'));
        } finally {
            setDelBusy(false);
        }
    };

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return list;
        return list.filter((r) => `${r.name} ${r.group?.title || ''} ${r.bot?.name || ''}`.toLowerCase().includes(term));
    }, [list, q]);

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TgPageHeader
                icon={IconRotateClockwise2}
                title="Mensagem rotativa"
                subtitle="Prova social: o bot mantém uma mensagem no grupo/canal e vai trocando o texto sozinho."
                action={
                    <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setEditing({})} sx={{ borderRadius: 2, fontWeight: 700 }}>
                        Nova rotativa
                    </Button>
                }
            />

            <TgFilterBar>
                <TextField
                    size="small"
                    placeholder="Buscar…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    sx={{ minWidth: 220, flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }}
                />
            </TgFilterBar>

            {loading ? (
                <TgListSkeleton rows={3} />
            ) : filtered.length === 0 ? (
                <TgEmptyState
                    icon={IconRotateClockwise2}
                    title="Nenhuma mensagem rotativa"
                    description="Crie uma para o bot manter aquela mensagem que fica trocando (ex.: “Fulano acabou de aderir ao VIP”) num grupo ou canal."
                    action={
                        <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setEditing({})} sx={{ borderRadius: 2, fontWeight: 700 }}>
                            Nova rotativa
                        </Button>
                    }
                />
            ) : (
                <Stack spacing={1.25}>
                    {filtered.map((r) => {
                        const isChannel = r.group?.type === 'channel';
                        return (
                            <TgCard key={r.id} accent={r.active ? 'success.main' : undefined} sx={{ p: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
                                <Box
                                    sx={{
                                        width: 46,
                                        height: 46,
                                        flexShrink: 0,
                                        borderRadius: 2.5,
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: '#fff',
                                        background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)'
                                    }}
                                >
                                    <IconRotateClockwise2 size={22} />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: 15.5 }} noWrap>
                                            {r.name}
                                        </Typography>
                                        <TgStatusPill status={r.active ? 'active' : 'inactive'} />
                                    </Stack>
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.75 }} flexWrap="wrap" useFlexGap>
                                        {r.target_kind === 'dm' ? <IconMessages size={14} /> : isChannel ? <IconBroadcast size={14} /> : <IconUsersGroup size={14} />}
                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                            {r.target_kind === 'dm' ? 'DMs do bot' : r.group?.title || r.group?.username || '—'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                            · via {r.bot?.name || 'bot'}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.3, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 11.5, fontWeight: 600 }}>
                                            <IconClock size={12} /> a cada {r.interval_seconds}s
                                        </Box>
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 0.9, py: 0.3, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 11.5, fontWeight: 600 }}>
                                            {r.mode === 'random' ? 'aleatório' : 'sequência'}
                                        </Box>
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 0.9, py: 0.3, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 11.5, fontWeight: 600 }}>
                                            {(r.messages || []).length} mensagens
                                        </Box>
                                    </Stack>
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                    <Tooltip title={r.active ? 'Ativa — clique p/ pausar' : 'Inativa — clique p/ ativar'}>
                                        <Switch size="small" checked={r.active} onChange={() => toggleActive(r)} />
                                    </Tooltip>
                                    <TgGhostButton startIcon={<IconPencil size={15} />} onClick={() => setEditing(r)}>
                                        Editar
                                    </TgGhostButton>
                                    <Tooltip title="Excluir">
                                        <TgGhostButton onClick={() => setDeleting(r)} sx={{ minWidth: 0, px: 1, color: 'error.main', borderColor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.3)` }}>
                                            <IconTrash size={16} />
                                        </TgGhostButton>
                                    </Tooltip>
                                </Stack>
                            </TgCard>
                        );
                    })}
                </Stack>
            )}

            <RotatorModal initial={editing && editing.id ? editing : null} open={!!editing} bots={bots} onClose={(ok) => { setEditing(null); if (ok) load(); }} />
            <TgConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                loading={delBusy}
                danger
                icon={IconTrash}
                title="Excluir rotativa?"
                message={`A mensagem rotativa "${deleting?.name}" será removida. A última mensagem postada no grupo/canal permanece lá.`}
                confirmLabel="Excluir"
            />
        </Box>
    );
}
