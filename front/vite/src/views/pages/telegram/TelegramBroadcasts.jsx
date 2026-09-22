import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    Menu,
    MenuItem,
    Popover,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme
} from '@mui/material';
import {
    IconPlus,
    IconTrash,
    IconSpeakerphone,
    IconClock,
    IconDeviceFloppy,
    IconPencil,
    IconPlayerPlay,
    IconHistory,
    IconMessage2,
    IconLink,
    IconChevronDown,
    IconUsers,
    IconSearch,
    IconFilter,
    IconFilterOff,
    IconDotsVertical,
    IconCircleCheckFilled,
    IconCircleXFilled,
    IconAlertTriangleFilled,
    IconLoader2,
    IconChevronLeft,
    IconChevronRight
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, put, remove } from '../../../api/api';
import TelegramMediaField from './TelegramMediaField';
import TelegramMessagesPreview from './TelegramMessagesPreview';
import TelegramLinkPicker from './TelegramLinkPicker';
import SearchSelect from './SearchSelect';
import {
    TgPageHeader,
    TgEmptyState,
    TgCard,
    TgStatusPill,
    TgFilterBar,
    TgModal,
    TgConfirmDialog,
    TgGhostButton,
    TgListSkeleton,
    TG_GRADIENT
} from './ui';

const uid = (p = 'm') => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const minToHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const hhmmToMin = (s) => {
    const [h, m] = String(s || '').split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};
const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
    } catch {
        return '—';
    }
};

// resumo de audiência de um broadcast (reusado no card + no confirm de disparo)
const audienceOf = (b) => {
    const dms = b?.targets?.dms ? b.dms_count || 0 : 0;
    const grp = (b?.targets?.group_ids || []).length;
    const ch = (b?.targets?.channel_ids || []).length;
    const parts = [];
    if (b?.targets?.dms) parts.push(`${dms.toLocaleString('pt-BR')} DMs`);
    if (grp) parts.push(`${grp} ${grp === 1 ? 'grupo' : 'grupos'}`);
    if (ch) parts.push(`${ch} ${ch === 1 ? 'canal' : 'canais'}`);
    return { dms, grp, ch, total: dms + grp + ch, parts };
};

// ---- pílula de horário com status de HOJE (bolinha colorida à esquerda + tooltip) ----
const TIME_STATUS = {
    sent: { color: 'success.main', tip: (t) => `Disparado hoje às ${t} — tudo certo` },
    partial: { color: 'warning.main', tip: (t) => `Disparado hoje às ${t}, com algumas falhas` },
    failed: { color: 'error.main', tip: (t) => `Executou hoje (${t}) e falhou` },
    sending: { color: 'info.main', tip: () => 'Enviando agora…' },
    pending: { color: 'warning.main', tip: (t) => `Aguardando o horário de hoje (${t})` },
    missed: { color: 'text.disabled', tip: (t) => `Agendado ${t} — não rodou hoje (roda no próximo dia)` }
};
function TimeChip({ minute, status }) {
    const hhmm = minToHHMM(minute);
    const st = TIME_STATUS[status] || TIME_STATUS.pending;
    const sending = status === 'sending';
    return (
        <Tooltip title={st.tip(hhmm)} arrow>
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.6,
                    pl: 0.8,
                    pr: 1,
                    py: 0.4,
                    borderRadius: 5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                    fontSize: 11.5,
                    fontWeight: 700,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    cursor: 'default'
                }}
            >
                <Box
                    sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor: st.color,
                        ...(sending
                            ? { animation: 'tgpulse 1s ease-in-out infinite', '@keyframes tgpulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } } }
                            : {})
                    }}
                />
                {hhmm}
            </Box>
        </Tooltip>
    );
}

// ---- multi-select com busca ----
function MultiSelect({ label, options, value, onChange, placeholder }) {
    const selected = options.filter((o) => (value || []).includes(o.value));
    return (
        <Autocomplete
            multiple
            options={options}
            value={selected}
            onChange={(_, vs) => onChange(vs.map((v) => v.value))}
            getOptionLabel={(o) => o?.label ?? ''}
            isOptionEqualToValue={(o, v) => o.value === v.value}
            size="small"
            renderInput={(p) => <TextField {...p} label={label} placeholder={placeholder} />}
            slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        />
    );
}

// variáveis que o worker interpola nas DMs
const VARS = [
    { token: '{{nome}}', label: 'nome' },
    { token: '{{sobrenome}}', label: 'sobrenome' },
    { token: '{{username}}', label: '@usuário' }
];
const newMessage = () => ({ id: uid(), text: '', media: null, buttons: [], delay_seconds: 0 });

// ---- editor de mensagens de uma copy ----
function MessagesEditor({ messages, onChange, bots, botId }) {
    const list = messages || [];
    const refs = useRef(new Map());
    const [linkFor, setLinkFor] = useState(null); // { msgId, btnId }
    const [plans, setPlans] = useState([]); // planos do bot (botão de checkout PIX)
    const setMsg = (id, patch) => onChange(list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

    // carrega os planos do bot uma vez por botId (reusa o endpoint do inspetor de fluxo)
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

    // insere um token no cursor do campo de texto da mensagem
    const insertVar = (m, token) => {
        const el = refs.current.get(m.id);
        const cur = m.text || '';
        const start = el && el.selectionStart != null ? el.selectionStart : cur.length;
        const end = el && el.selectionEnd != null ? el.selectionEnd : cur.length;
        setMsg(m.id, { text: cur.slice(0, start) + token + cur.slice(end) });
        requestAnimationFrame(() => {
            if (el) {
                el.focus();
                const pos = start + token.length;
                try {
                    el.setSelectionRange(pos, pos);
                } catch {
                    /* noop */
                }
            }
        });
    };

    const addButton = (m) => setMsg(m.id, { buttons: [...(m.buttons || []), { id: uid('b'), label: '', url: '' }] });
    const setButton = (m, bid, patch) => setMsg(m.id, { buttons: (m.buttons || []).map((b) => (b.id === bid ? { ...b, ...patch } : b)) });
    const removeButton = (m, bid) => setMsg(m.id, { buttons: (m.buttons || []).filter((b) => b.id !== bid) });

    return (
        <Stack spacing={1.25}>
            {list.map((m, i) => (
                <Box key={m.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                        <Chip size="small" label={`Mensagem ${i + 1}`} sx={{ fontWeight: 700 }} />
                        {list.length > 1 ? (
                            <IconButton size="small" color="error" onClick={() => onChange(list.filter((x) => x.id !== m.id))}>
                                <IconTrash size={15} />
                            </IconButton>
                        ) : null}
                    </Stack>
                    <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={m.text || ''}
                        onChange={(e) => setMsg(m.id, { text: e.target.value })}
                        inputRef={(el) => refs.current.set(m.id, el)}
                        placeholder="Texto (legenda se houver mídia)."
                        sx={{ mb: 0.75 }}
                    />
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>
                            Inserir variável:
                        </Typography>
                        {VARS.map((v) => (
                            <Tooltip key={v.token} title="Personaliza nas DMs — em grupos/canais fica vazio.">
                                <Chip
                                    size="small"
                                    label={v.label}
                                    onClick={() => insertVar(m, v.token)}
                                    sx={{
                                        height: 22,
                                        cursor: 'pointer',
                                        borderRadius: 1,
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        color: 'primary.main',
                                        border: '1px solid',
                                        borderColor: (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.28)`,
                                        bgcolor: (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.12)`,
                                        '& .MuiChip-label': { px: 0.9 },
                                        '&:hover': { bgcolor: (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.2)` }
                                    }}
                                />
                            </Tooltip>
                        ))}
                        <Tooltip title="As variáveis só personalizam nas DMs; em grupos/canais ficam vazias.">
                            <Typography variant="caption" sx={{ color: 'text.disabled', cursor: 'help' }}>
                                ⓘ só DMs
                            </Typography>
                        </Tooltip>
                    </Stack>

                    <TelegramMediaField value={m.media} onChange={(media) => setMsg(m.id, { media })} />

                    <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            Botões
                        </Typography>
                        <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                            {(m.buttons || []).map((b) => {
                                const isPlan = b.plan_id !== undefined && b.plan_id !== null;
                                return (
                                    <Box key={b.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
                                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
                                            <TextField
                                                size="small"
                                                placeholder="Texto do botão"
                                                value={b.label || ''}
                                                onChange={(e) => setButton(m, b.id, { label: e.target.value })}
                                                sx={{ flex: 1 }}
                                            />
                                            <Select
                                                size="small"
                                                value={isPlan ? 'plan' : 'link'}
                                                onChange={(e) =>
                                                    setButton(
                                                        m,
                                                        b.id,
                                                        e.target.value === 'plan'
                                                            ? { plan_id: b.plan_id || '', url: '' }
                                                            : { plan_id: undefined, url: b.url || '' }
                                                    )
                                                }
                                                sx={{ flexShrink: 0, minWidth: 104 }}
                                            >
                                                <MenuItem value="link">🔗 Link</MenuItem>
                                                <MenuItem value="plan">💎 Plano</MenuItem>
                                            </Select>
                                            <IconButton size="small" color="error" onClick={() => removeButton(m, b.id)}>
                                                <IconTrash size={14} />
                                            </IconButton>
                                        </Stack>
                                        {isPlan ? (
                                            <>
                                                <SearchSelect
                                                    fullWidth
                                                    label="Plano a vender"
                                                    value={b.plan_id || ''}
                                                    onChange={(v) => setButton(m, b.id, { plan_id: v })}
                                                    options={plans.map((p) => ({ value: p.id, label: `${p.name} — ${p.price_label}` }))}
                                                />
                                                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                                                    {plans.length
                                                        ? 'Ao tocar, o bot gera o PIX e libera o acesso ao pagar.'
                                                        : 'Cadastre planos em Pagamentos / VIP.'}
                                                </Typography>
                                            </>
                                        ) : (
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                <TextField
                                                    size="small"
                                                    placeholder="https://… ou t.me/…"
                                                    value={b.url || ''}
                                                    onChange={(e) => setButton(m, b.id, { url: e.target.value })}
                                                    sx={{ flex: 1 }}
                                                />
                                                <Tooltip title="Escolher link (grupo, canal, bot, deep-link…)">
                                                    <IconButton size="small" onClick={() => setLinkFor({ msgId: m.id, btnId: b.id })}>
                                                        <IconLink size={15} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        )}
                                    </Box>
                                );
                            })}
                            <Button
                                size="small"
                                startIcon={<IconLink size={14} />}
                                onClick={() => addButton(m)}
                                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                            >
                                Adicionar botão
                            </Button>
                        </Stack>
                    </Box>

                    <TextField
                        size="small"
                        type="number"
                        label="Atraso antes desta (s)"
                        value={m.delay_seconds || 0}
                        onChange={(e) => setMsg(m.id, { delay_seconds: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })}
                        sx={{ width: 180, mt: 1.25 }}
                        inputProps={{ min: 0, max: 10 }}
                        helperText="Mostra “digitando…”."
                    />
                </Box>
            ))}
            <Button size="small" startIcon={<IconPlus size={15} />} onClick={() => onChange([...list, newMessage()])} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                Adicionar mensagem
            </Button>

            <TelegramLinkPicker
                open={!!linkFor}
                onClose={() => setLinkFor(null)}
                botId={botId}
                bots={bots}
                onPick={(url) => {
                    if (!linkFor) return;
                    onChange(
                        list.map((mm) =>
                            mm.id === linkFor.msgId
                                ? { ...mm, buttons: (mm.buttons || []).map((b) => (b.id === linkFor.btnId ? { ...b, url } : b)) }
                                : mm
                        )
                    );
                }}
            />
        </Stack>
    );
}

// ---- modal de copies ----
function CopiesModal({ broadcast, open, onClose, bots }) {
    const [copies, setCopies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [openOnMount, setOpenOnMount] = useState(null); // _k da copy recém-criada (abre expandida)

    // bot usado pelo seletor de link (grupos/canais/deep-links do bot)
    const botId = (broadcast?.bot_ids && broadcast.bot_ids[0]) || (bots && bots[0] && bots[0].id) || '';

    useEffect(() => {
        if (!open || !broadcast) return;
        setLoading(true);
        get(`/telegram/broadcasts/${broadcast.id}/copies`)
            .then((cs) =>
                setCopies(
                    cs.length
                        ? cs.map((c) => ({ ...c, messages: (c.messages || []).map((m) => ({ buttons: [], ...m })), _k: uid('c') }))
                        : [{ _k: uid('c'), messages: [newMessage()] }]
                )
            )
            .catch((e) => toast.error(errMsg(e, 'Falha ao carregar copies.')))
            .finally(() => setLoading(false));
    }, [open, broadcast]);

    const setCopy = (k, messages) => setCopies((cs) => cs.map((c) => (c._k === k ? { ...c, messages } : c)));
    const addCopy = () => {
        const k = uid('c');
        setOpenOnMount(k);
        setCopies((cs) => [...cs, { _k: k, messages: [newMessage()] }]);
    };
    const removeCopy = (k) => setCopies((cs) => cs.filter((c) => c._k !== k));

    const save = async () => {
        setSaving(true);
        try {
            await put(`/telegram/broadcasts/${broadcast.id}/copies`, { copies: copies.map((c) => ({ messages: c.messages })) });
            toast.success('Copies salvas.');
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
            disableClose={saving}
            maxWidth="lg"
            title={`Copies — ${broadcast?.name || ''}`}
            subtitle={`Cada copy é um conjunto de mensagens enviadas juntas. A cada disparo, uma copy é escolhida (${broadcast?.mode === 'random' ? 'aleatória' : 'em sequência'}).`}
            footer={
                <>
                    <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={save}
                        disabled={saving || loading}
                        startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                    >
                        Salvar copies
                    </Button>
                </>
            }
        >
            {loading ? (
                <TgListSkeleton rows={3} />
            ) : (
                <Stack spacing={1.5}>
                    {copies.map((c, i) => {
                        const msgCount = (c.messages || []).length;
                        const firstText = (c.messages || []).map((m) => (m.text || '').trim()).find(Boolean) || '';
                        return (
                            <Accordion
                                key={c._k}
                                defaultExpanded={c._k === openOnMount}
                                disableGutters
                                elevation={0}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                    bgcolor: (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.04)`,
                                    '&:before': { display: 'none' }
                                }}
                            >
                                <AccordionSummary expandIcon={<IconChevronDown size={18} />} sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1, my: 1, minWidth: 0, overflow: 'hidden' } }}>
                                    <Chip label={`Copy ${i + 1}`} color="primary" size="small" sx={{ fontWeight: 700, flexShrink: 0 }} />
                                    <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                                        {msgCount === 1 ? '1 msg' : `${msgCount} msgs`}
                                    </Typography>
                                    {firstText ? (
                                        <Typography variant="caption" sx={{ color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, pr: 1 }}>
                                            — {firstText}
                                        </Typography>
                                    ) : (
                                        <Box sx={{ flex: 1 }} />
                                    )}
                                    {copies.length > 1 ? (
                                        <Tooltip title="Remover copy">
                                            <Box
                                                component="span"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeCopy(c._k);
                                                }}
                                                sx={{ display: 'inline-flex', color: 'error.main', cursor: 'pointer', p: 0.5, mr: 0.5, borderRadius: 1, '&:hover': { bgcolor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.12)` } }}
                                            >
                                                <IconTrash size={16} />
                                            </Box>
                                        </Tooltip>
                                    ) : null}
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 320px' } }}>
                                        <MessagesEditor messages={c.messages} onChange={(msgs) => setCopy(c._k, msgs)} bots={bots} botId={botId} />
                                        <Box>
                                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                                Preview
                                            </Typography>
                                            <TelegramMessagesPreview messages={c.messages} />
                                        </Box>
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        );
                    })}
                    <Button startIcon={<IconPlus size={16} />} onClick={addCopy} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                        Adicionar copy
                    </Button>
                </Stack>
            )}
        </TgModal>
    );
}

// ---- modal de broadcast (create/edit) ----
const EMPTY = { name: 'Novo broadcast', bot_ids: [], targets: { dms: false, group_ids: [], channel_ids: [] }, times: [], mode: 'sequential', delete_used: false, active: true };

function BroadcastModal({ initial, open, onClose, bots, groups, channels }) {
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [timeInput, setTimeInput] = useState('09:00');
    const [estimate, setEstimate] = useState(null);

    useEffect(() => {
        if (open) setForm(initial ? { ...EMPTY, ...initial, targets: { dms: false, group_ids: [], channel_ids: [], ...(initial.targets || {}) } } : EMPTY);
    }, [open, initial]);

    // estimativa ao vivo
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
            post('/telegram/broadcasts/audience-estimate', { bot_ids: form.bot_ids, targets: form.targets })
                .then(setEstimate)
                .catch(() => setEstimate(null));
        }, 400);
        return () => clearTimeout(t);
    }, [open, form.bot_ids, form.targets]);

    const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setT = (patch) => setForm((f) => ({ ...f, targets: { ...f.targets, ...patch } }));

    const addTime = () => {
        const min = hhmmToMin(timeInput);
        if (min == null) return;
        if (!form.times.includes(min)) setF({ times: [...form.times, min].sort((a, b) => a - b) });
    };

    const save = async () => {
        if (!form.bot_ids.length && !form.targets.group_ids.length && !form.targets.channel_ids.length) {
            return toast.error('Selecione pelo menos um bot (DMs) ou grupos/canais.');
        }
        setSaving(true);
        try {
            const payload = { name: form.name, bot_ids: form.bot_ids, targets: form.targets, times: form.times, mode: form.mode, delete_used: form.delete_used, active: form.active };
            if (initial?.id) await put(`/telegram/broadcasts/${initial.id}`, payload);
            else await post('/telegram/broadcasts', payload);
            toast.success('Broadcast salvo.');
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
            disableClose={saving}
            maxWidth="sm"
            title={initial?.id ? 'Editar broadcast' : 'Novo broadcast'}
            footer={
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                    <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setF({ active: e.target.checked })} />} label={form.active ? 'Ativo' : 'Inativo'} />
                    <Stack direction="row" spacing={1}>
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
                    </Stack>
                </Stack>
            }
        >
            <Stack spacing={2.5}>
                <TextField label="Nome" size="small" fullWidth value={form.name} onChange={(e) => setF({ name: e.target.value })} />

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Bots (para as DMs)</Typography>
                    <MultiSelect
                        label="Bots"
                        value={form.bot_ids}
                        onChange={(v) => setF({ bot_ids: v })}
                        options={bots.map((b) => ({ value: b.id, label: `${b.name}${b.username ? ` · @${b.username}` : ''}` }))}
                        placeholder="Escolher bots…"
                    />
                </Box>

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Destinos</Typography>
                    <FormControlLabel
                        control={<Switch checked={form.targets.dms} onChange={(e) => setT({ dms: e.target.checked })} />}
                        label="Todas as DMs dos leads dos bots selecionados"
                    />
                    <Box sx={{ mt: 1 }}>
                        <MultiSelect
                            label="Grupos"
                            value={form.targets.group_ids}
                            onChange={(v) => setT({ group_ids: v })}
                            options={groups.map((g) => ({ value: g.id, label: `${g.name}${g.username ? ` (@${g.username})` : ''}` }))}
                            placeholder="Escolher grupos…"
                        />
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                        <MultiSelect
                            label="Canais"
                            value={form.targets.channel_ids}
                            onChange={(v) => setT({ channel_ids: v })}
                            options={channels.map((c) => ({ value: c.id, label: `${c.name}${c.username ? ` (@${c.username})` : ''}` }))}
                            placeholder="Escolher canais…"
                        />
                    </Box>
                    {estimate ? (
                        <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2, py: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}>
                            Audiência ≈ <b>{estimate.total}</b> ({estimate.dms} DMs · {estimate.groups} grupos · {estimate.channels} canais).
                        </Alert>
                    ) : null}
                </Box>

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Horários (todo dia, BRT)</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <TextField type="time" size="small" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} sx={{ width: 130 }} />
                        <Button variant="outlined" startIcon={<IconPlus size={15} />} onClick={addTime} sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary', textTransform: 'none' }}>
                            Adicionar
                        </Button>
                    </Stack>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {form.times.length === 0 ? (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Nenhum horário. Ex.: 11:20, 15:00…</Typography>
                        ) : null}
                        {form.times.map((t) => (
                            <Chip key={t} icon={<IconClock size={13} />} label={minToHHMM(t)} onDelete={() => setF({ times: form.times.filter((x) => x !== t) })} sx={{ borderRadius: 1.5, fontWeight: 700 }} />
                        ))}
                    </Stack>
                </Box>

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Modo de envio</Typography>
                    <RadioGroup value={form.mode} onChange={(e) => setF({ mode: e.target.value })}>
                        <FormControlLabel value="sequential" control={<Radio size="small" />} label="Sequência (rotaciona; ao fim, volta ao início)" />
                        <FormControlLabel value="random" control={<Radio size="small" />} label="Aleatório (sorteia uma copy a cada disparo)" />
                    </RadioGroup>
                    <FormControlLabel
                        control={<Switch checked={form.delete_used} onChange={(e) => setF({ delete_used: e.target.checked })} />}
                        label="Apagar a copy depois de usar"
                    />
                </Box>
            </Stack>
        </TgModal>
    );
}

// classifica o resultado de uma run p/ ícone/rótulo
function runOutcome(r) {
    if (r.status === 'SENDING') return { key: 'sending', color: 'info.main', label: 'Enviando…', Icon: IconLoader2 };
    if ((r.sent || 0) === 0 && (r.total || 0) > 0) return { key: 'failed', color: 'error.main', label: 'Falhou', Icon: IconCircleXFilled };
    if ((r.failed || 0) > 0 || (r.blocked || 0) > 0) return { key: 'partial', color: 'warning.main', label: 'Concluído com falhas', Icon: IconAlertTriangleFilled };
    return { key: 'clean', color: 'success.main', label: 'Concluído', Icon: IconCircleCheckFilled };
}

// barra de proporção enviados/bloqueados/falhas
function RunBar({ r }) {
    const total = Math.max(1, r.total || 0);
    const seg = (n, token) => (n > 0 ? <Box sx={{ width: `${(n / total) * 100}%`, bgcolor: token }} /> : null);
    return (
        <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: 'action.selected', mt: 1 }}>
            {seg(r.sent || 0, 'success.main')}
            {seg(r.blocked || 0, 'warning.main')}
            {seg(r.failed || 0, 'error.main')}
        </Box>
    );
}

// ---- modal de histórico (filtros + paginação) ----
function RunsModal({ broadcast, open, onClose }) {
    const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('all');
    const [period, setPeriod] = useState('all');
    const [page, setPage] = useState(1);

    // reset ao abrir / trocar filtro
    useEffect(() => {
        setPage(1);
    }, [status, period, open]);

    useEffect(() => {
        if (!open || !broadcast) return;
        setLoading(true);
        let from = '';
        if (period !== 'all') {
            const d = new Date();
            if (period === 'today') d.setHours(0, 0, 0, 0);
            else if (period === '7d') d.setDate(d.getDate() - 7);
            else if (period === '30d') d.setDate(d.getDate() - 30);
            from = `&from=${encodeURIComponent(d.toISOString())}`;
        }
        get(`/telegram/broadcasts/${broadcast.id}/runs?page=${page}&page_size=8&status=${status}${from}`)
            .then((d) => setData(d))
            .catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }))
            .finally(() => setLoading(false));
    }, [open, broadcast, status, period, page]);

    return (
        <TgModal
            open={open}
            onClose={onClose}
            maxWidth="md"
            title={`Histórico — ${broadcast?.name || ''}`}
            subtitle={`${data.total} disparo${data.total === 1 ? '' : 's'} registrado${data.total === 1 ? '' : 's'}.`}
            footer={
                <TgGhostButton onClick={onClose} sx={{ textTransform: 'none' }}>
                    Fechar
                </TgGhostButton>
            }
        >
            <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="runs-status-label">Status</InputLabel>
                    <Select labelId="runs-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <MenuItem value="all">Todos os status</MenuItem>
                        <MenuItem value="clean">Sucesso</MenuItem>
                        <MenuItem value="errors">Com falhas</MenuItem>
                        <MenuItem value="sending">Enviando</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="runs-period-label">Período</InputLabel>
                    <Select labelId="runs-period-label" label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
                        <MenuItem value="all">Todo o período</MenuItem>
                        <MenuItem value="today">Hoje</MenuItem>
                        <MenuItem value="7d">Últimos 7 dias</MenuItem>
                        <MenuItem value="30d">Últimos 30 dias</MenuItem>
                    </Select>
                </FormControl>
            </Stack>

            {loading ? (
                <TgListSkeleton rows={4} />
            ) : data.items.length === 0 ? (
                <TgEmptyState dense icon={IconHistory} title="Nenhum disparo" description="Nenhum disparo com esses filtros." />
            ) : (
                <Stack spacing={1}>
                    {data.items.map((r) => {
                        const oc = runOutcome(r);
                        const OcIcon = oc.Icon;
                        const rate = (r.total || 0) > 0 ? Math.round(((r.sent || 0) / r.total) * 100) : 0;
                        return (
                            <Box key={r.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, bgcolor: 'background.paper' }}>
                                <Stack direction="row" alignItems="center" spacing={1.25}>
                                    <Box
                                        sx={{
                                            color: oc.color,
                                            display: 'inline-flex',
                                            ...(oc.key === 'sending' ? { animation: 'tgspin 0.9s linear infinite', '@keyframes tgspin': { to: { transform: 'rotate(360deg)' } } } : {})
                                        }}
                                    >
                                        <OcIcon size={22} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtDate(r.run_at)}</Typography>
                                        <Typography variant="caption" sx={{ color: oc.color, fontWeight: 600 }}>{oc.label}</Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexShrink={0}>
                                        <StatPill label="Total" value={r.total} />
                                        <StatPill label="Enviados" value={r.sent} color="success.main" />
                                        {(r.blocked || 0) > 0 ? <StatPill label="Bloqueados" value={r.blocked} color="warning.main" /> : null}
                                        {(r.failed || 0) > 0 ? <StatPill label="Falhas" value={r.failed} color="error.main" /> : null}
                                    </Stack>
                                </Stack>
                                <RunBar r={r} />
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>{rate}% entregues</Typography>
                                    {(r.blocked || 0) > 0 ? (
                                        <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>· {r.blocked} bloqueados</Typography>
                                    ) : null}
                                    {(r.failed || 0) > 0 ? (
                                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>· {r.failed} falhas</Typography>
                                    ) : null}
                                </Stack>
                            </Box>
                        );
                    })}

                    {data.pages > 1 ? (
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1 }}>
                            <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                                <IconChevronLeft size={18} />
                            </IconButton>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Página {data.page} de {data.pages}
                            </Typography>
                            <IconButton size="small" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages}>
                                <IconChevronRight size={18} />
                            </IconButton>
                        </Stack>
                    ) : null}
                </Stack>
            )}
        </TgModal>
    );
}

// pequena pílula de métrica
function StatPill({ label, value, color = 'text.secondary' }) {
    return (
        <Box sx={{ textAlign: 'center', px: 1, py: 0.25, borderRadius: 1.5, bgcolor: 'action.hover', minWidth: 56 }}>
            <Typography variant="caption" sx={{ display: 'block', color, fontWeight: 800, lineHeight: 1.1 }}>
                {(value || 0).toLocaleString('pt-BR')}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: 10 }}>
                {label}
            </Typography>
        </Box>
    );
}

// ---- ações de uma linha de broadcast (⋮ overflow no narrow) ----
function RowActions({ b, compact, onFire, onCopies, onEdit, onRuns, onDelete, onToggle }) {
    const [anchor, setAnchor] = useState(null);
    const noCopies = (b.copies_count || 0) === 0;
    const secondary = [
        { key: 'edit', label: 'Editar', icon: <IconPencil size={17} />, run: () => onEdit(b) },
        { key: 'runs', label: 'Histórico', icon: <IconHistory size={17} />, run: () => onRuns(b) },
        { key: 'del', label: 'Excluir', icon: <IconTrash size={17} />, run: () => onDelete(b), danger: true }
    ];
    return (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            <Tooltip title={b.active ? 'Ativo — clique p/ pausar' : 'Inativo — clique p/ ativar'}>
                <Switch size="small" checked={b.active} onChange={() => onToggle(b)} />
            </Tooltip>
            <Tooltip title={noCopies ? 'Cadastre uma copy antes de disparar' : 'Disparar agora'}>
                <span>
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<IconPlayerPlay size={15} />}
                        onClick={() => onFire(b)}
                        disabled={noCopies}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                    >
                        Disparar
                    </Button>
                </span>
            </Tooltip>
            <Tooltip title="Copies">
                <IconButton size="small" onClick={() => onCopies(b)}><IconMessage2 size={17} /></IconButton>
            </Tooltip>
            {compact ? (
                <>
                    <Tooltip title="Mais ações">
                        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}><IconDotsVertical size={17} /></IconButton>
                    </Tooltip>
                    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160 } } }}>
                        {secondary.map((a) => (
                            <MenuItem
                                key={a.key}
                                onClick={() => {
                                    setAnchor(null);
                                    a.run();
                                }}
                                sx={{ gap: 1, fontSize: 14, ...(a.danger ? { color: 'error.main' } : {}) }}
                            >
                                {a.icon}
                                {a.label}
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            ) : (
                secondary.map((a) => (
                    <Tooltip key={a.key} title={a.label}>
                        <IconButton size="small" color={a.danger ? 'error' : 'default'} onClick={a.run}>
                            {a.icon}
                        </IconButton>
                    </Tooltip>
                ))
            )}
        </Stack>
    );
}

// =================== PÁGINA ===================
export default function TelegramBroadcasts() {
    const theme = useTheme();
    const compact = useMediaQuery(theme.breakpoints.down('md'));

    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bots, setBots] = useState([]);
    const [groups, setGroups] = useState([]);
    const [channels, setChannels] = useState([]);
    const [editing, setEditing] = useState(null); // {} for new, {id,...} for edit, or null
    const [copiesFor, setCopiesFor] = useState(null);
    const [runsFor, setRunsFor] = useState(null);
    // confirmações
    const [firingFor, setFiringFor] = useState(null);
    const [firing, setFiring] = useState(false);
    const [deletingFor, setDeletingFor] = useState(null);
    const [deleting, setDeleting] = useState(false);
    // filtros
    const [fName, setFName] = useState('');
    const [fBots, setFBots] = useState([]);
    const [fGroups, setFGroups] = useState([]);
    const [fTime, setFTime] = useState('all');
    const [filterAnchor, setFilterAnchor] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [bc, b, g, c] = await Promise.all([
                get('/telegram/broadcasts'),
                get('/telegram/bots'),
                get('/telegram/groups?bot_id=all'),
                get('/telegram/channels?bot_id=all')
            ]);
            setList(bc);
            setBots(b);
            setGroups(g);
            setChannels(c);
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar broadcasts.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleActive = async (b) => {
        try {
            await put(`/telegram/broadcasts/${b.id}`, { active: !b.active });
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao atualizar.'));
        }
    };
    const doDelete = async () => {
        const b = deletingFor;
        setDeleting(true);
        try {
            await remove(`/telegram/broadcasts/${b.id}`);
            toast.success('Broadcast excluído.');
            setDeletingFor(null);
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao excluir.'));
        } finally {
            setDeleting(false);
        }
    };
    const doFire = async () => {
        const b = firingFor;
        setFiring(true);
        try {
            await post(`/telegram/broadcasts/${b.id}/fire`, {});
            toast.success('Disparo iniciado! Acompanhe no histórico e nas DMs.');
            setFiringFor(null);
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao disparar.'));
        } finally {
            setFiring(false);
        }
    };

    const allTimes = useMemo(() => [...new Set(list.flatMap((b) => b.times || []))].sort((a, b) => a - b), [list]);
    const filtered = useMemo(
        () =>
            list.filter((b) => {
                if (fName && !(b.name || '').toLowerCase().includes(fName.toLowerCase())) return false;
                if (fBots.length && !(b.bot_ids || []).some((id) => fBots.includes(id))) return false;
                if (fGroups.length && !((b.targets?.group_ids || []).some((id) => fGroups.includes(id)))) return false;
                if (fTime !== 'all' && !(b.times || []).includes(Number(fTime))) return false;
                return true;
            }),
        [list, fName, fBots, fGroups, fTime]
    );
    const activeFilterCount = (fBots.length ? 1 : 0) + (fGroups.length ? 1 : 0) + (fTime !== 'all' ? 1 : 0);
    const filtersActive = !!fName || activeFilterCount > 0;
    const clearFilters = () => {
        setFName('');
        setFBots([]);
        setFGroups([]);
        setFTime('all');
    };

    // controles de filtro reutilizados inline (desktop) e no popover (narrow)
    const filterControls = (stacked) => (
        <>
            <Box sx={stacked ? { width: '100%' } : { flex: '1 1 160px', minWidth: 150 }}>
                <MultiSelect label="Bots" value={fBots} onChange={setFBots} options={bots.map((b) => ({ value: b.id, label: b.name }))} placeholder="Filtrar…" />
            </Box>
            <Box sx={stacked ? { width: '100%' } : { flex: '1 1 160px', minWidth: 150 }}>
                <MultiSelect label="Grupos" value={fGroups} onChange={setFGroups} options={groups.map((g) => ({ value: g.id, label: g.name }))} placeholder="Filtrar…" />
            </Box>
            <FormControl size="small" sx={stacked ? { width: '100%' } : { flex: '1 1 150px', minWidth: 140 }}>
                <InputLabel id="bc-time-filter-label">Horário</InputLabel>
                <Select labelId="bc-time-filter-label" label="Horário" value={fTime} onChange={(e) => setFTime(e.target.value)}>
                    <MenuItem value="all">Todos horários</MenuItem>
                    {allTimes.map((t) => (
                        <MenuItem key={t} value={t}>{minToHHMM(t)}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </>
    );

    const newBtn = (
        <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setEditing({})} sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            Novo broadcast
        </Button>
    );

    const fireAud = firingFor ? audienceOf(firingFor) : null;

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TgPageHeader
                icon={IconSpeakerphone}
                title="Broadcasts"
                subtitle="Disparos em massa para DMs, grupos e canais — com rotação de copies e agendamento."
                action={newBtn}
            />

            {loading ? (
                <TgListSkeleton rows={4} />
            ) : list.length === 0 ? (
                <TgEmptyState
                    icon={IconSpeakerphone}
                    title="Nenhum broadcast"
                    description="Crie um broadcast, cadastre as copies e escolha os horários."
                    action={newBtn}
                />
            ) : (
                <>
                    {/* toolbar de filtros */}
                    <TgFilterBar>
                        <TextField
                            size="small"
                            placeholder="Buscar por nome…"
                            value={fName}
                            onChange={(e) => setFName(e.target.value)}
                            InputProps={{ startAdornment: <IconSearch size={16} style={{ marginRight: 6, opacity: 0.6 }} /> }}
                            sx={{ flex: '1 1 220px', minWidth: 180 }}
                        />
                        {compact ? (
                            <>
                                <TgGhostButton startIcon={<IconFilter size={16} />} onClick={(e) => setFilterAnchor(e.currentTarget)}>
                                    Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ''}
                                </TgGhostButton>
                                {filtersActive ? (
                                    <TgGhostButton startIcon={<IconFilterOff size={16} />} onClick={clearFilters}>
                                        Limpar
                                    </TgGhostButton>
                                ) : null}
                                <Popover
                                    open={!!filterAnchor}
                                    anchorEl={filterAnchor}
                                    onClose={() => setFilterAnchor(null)}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                    slotProps={{ paper: { sx: { borderRadius: 3, mt: 1, width: 300 } } }}
                                >
                                    <Stack spacing={1.5} sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Filtros</Typography>
                                        {filterControls(true)}
                                        {filtersActive ? (
                                            <Button color="inherit" startIcon={<IconFilterOff size={16} />} onClick={clearFilters} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                                                Limpar filtros
                                            </Button>
                                        ) : null}
                                    </Stack>
                                </Popover>
                            </>
                        ) : (
                            <>
                                {filterControls(false)}
                                {filtersActive ? (
                                    <Button color="inherit" startIcon={<IconFilterOff size={16} />} onClick={clearFilters} sx={{ textTransform: 'none', flexShrink: 0 }}>
                                        Limpar
                                    </Button>
                                ) : null}
                            </>
                        )}
                    </TgFilterBar>

                    {filtered.length === 0 ? (
                        <TgEmptyState
                            dense
                            icon={IconSpeakerphone}
                            title="Nenhum resultado"
                            description="Nenhum broadcast com esses filtros."
                            action={
                                filtersActive ? (
                                    <TgGhostButton startIcon={<IconFilterOff size={16} />} onClick={clearFilters}>
                                        Limpar filtros
                                    </TgGhostButton>
                                ) : null
                            }
                        />
                    ) : (
                        <Stack spacing={1.25}>
                            {filtered.map((b) => {
                                const aud = audienceOf(b);
                                const noCopies = (b.copies_count || 0) === 0;
                                const noTimes = (b.times || []).length === 0;
                                return (
                                    <TgCard
                                        key={b.id}
                                        accent={b.active ? 'success.main' : 'divider'}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: { xs: 'column', md: 'row' },
                                            alignItems: { md: 'center' },
                                            gap: 2,
                                            p: 2
                                        }}
                                    >
                                        {/* badge */}
                                        <Box
                                            sx={{
                                                width: 46,
                                                height: 46,
                                                flexShrink: 0,
                                                borderRadius: 2.5,
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: '#fff',
                                                background: TG_GRADIENT
                                            }}
                                        >
                                            <IconSpeakerphone size={22} />
                                        </Box>

                                        {/* info principal */}
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                                <Typography sx={{ fontWeight: 700, fontSize: 15.5 }} noWrap>{b.name}</Typography>
                                                <TgStatusPill status={b.active ? 'active' : 'inactive'} />
                                            </Stack>
                                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.75 }}>
                                                <IconUsers size={14} />
                                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                                    Audiência ≈ {aud.total.toLocaleString('pt-BR')}
                                                </Typography>
                                                {aud.parts.length ? (
                                                    <Typography variant="caption" sx={{ color: 'text.disabled' }} noWrap>
                                                        ({aud.parts.join(' · ')})
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                            <Stack direction="row" spacing={1} rowGap={1.25} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 0.75 }}>
                                                <Chip size="small" label={b.mode === 'random' ? 'aleatório' : 'sequência'} variant="outlined" sx={{ borderRadius: 1, height: 22 }} />
                                                <Chip size="small" label={`${b.copies_count || 0} copies`} color={noCopies ? 'warning' : 'default'} variant="outlined" sx={{ borderRadius: 1, height: 22 }} />
                                                {noTimes ? (
                                                    <Chip size="small" icon={<IconClock size={12} />} label="Sem horários" color="warning" variant="outlined" sx={{ borderRadius: 1, height: 22, fontSize: 11 }} />
                                                ) : (
                                                    (b.times || []).map((t) => <TimeChip key={t} minute={t} status={b.time_status?.[t]} />)
                                                )}
                                            </Stack>
                                            {noCopies ? (
                                                <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.75 }}>
                                                    ⚠ Cadastre ao menos uma copy para disparar.
                                                </Typography>
                                            ) : null}
                                        </Box>

                                        {/* ações */}
                                        <RowActions
                                            b={b}
                                            compact={compact}
                                            onFire={setFiringFor}
                                            onCopies={setCopiesFor}
                                            onEdit={setEditing}
                                            onRuns={setRunsFor}
                                            onDelete={setDeletingFor}
                                            onToggle={toggleActive}
                                        />
                                    </TgCard>
                                );
                            })}
                        </Stack>
                    )}
                </>
            )}

            <BroadcastModal
                initial={editing && editing.id ? editing : null}
                open={!!editing}
                onClose={(ok) => {
                    setEditing(null);
                    if (ok) load();
                }}
                bots={bots}
                groups={groups}
                channels={channels}
            />
            <CopiesModal broadcast={copiesFor} bots={bots} open={!!copiesFor} onClose={(ok) => { setCopiesFor(null); if (ok) load(); }} />
            <RunsModal broadcast={runsFor} open={!!runsFor} onClose={() => setRunsFor(null)} />

            <TgConfirmDialog
                open={!!firingFor}
                onClose={() => setFiringFor(null)}
                onConfirm={doFire}
                loading={firing}
                icon={IconPlayerPlay}
                title="Disparar agora?"
                confirmLabel="Disparar agora"
                message={
                    firingFor
                        ? `"${firingFor.name}" será disparado agora para ≈ ${fireAud.total.toLocaleString('pt-BR')} ${fireAud.total === 1 ? 'destino' : 'destinos'}${fireAud.parts.length ? ` (${fireAud.parts.join(' · ')})` : ''}. A copy é escolhida em ${firingFor.mode === 'random' ? 'ordem aleatória' : 'sequência'}.`
                        : ''
                }
            />
            <TgConfirmDialog
                open={!!deletingFor}
                onClose={() => setDeletingFor(null)}
                onConfirm={doDelete}
                loading={deleting}
                danger
                icon={IconTrash}
                title="Excluir broadcast?"
                confirmLabel="Excluir"
                message={deletingFor ? `As copies e todo o histórico de "${deletingFor.name}" serão removidos. Esta ação não pode ser desfeita.` : ''}
            />
        </Box>
    );
}
