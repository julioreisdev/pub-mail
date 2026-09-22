import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { IconPlus, IconTrash, IconClock, IconBolt, IconLink, IconDeviceFloppy, IconPencil, IconPlayerPlay, IconTargetArrow } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, put, remove } from '../../../api/api';
import TelegramMediaField from './TelegramMediaField';
import TelegramLinkPicker from './TelegramLinkPicker';
import TelegramMessagesPreview from './TelegramMessagesPreview';
import SearchSelect from './SearchSelect';
import { TgCard, TgModal, TgConfirmDialog } from './ui';

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const UNITS = { minutes: 'minutos', hours: 'horas', days: 'dias' };
const UNIT_SHORT = { minutes: 'min', hours: 'h', days: 'd' };
const UNIT_MS = { minutes: 60000, hours: 3600000, days: 86400000 };
const MEDIA_LABEL = { photo: 'Imagem', video: 'Vídeo', voice: 'Áudio', document: 'Documento' };
const DEFAULT_NAME = 'Nova automação';

const firstDelayMs = (a) => {
    const s = a?.steps?.[0];
    return (Number(s?.delay_value) || 0) * (UNIT_MS[s?.delay_unit] || 60000);
};

// título derivado quando o nome ainda é o default ("Mídia + texto, após 5 min")
function deriveTitle(a) {
    const s = a?.steps?.[0];
    if (!s) return DEFAULT_NAME;
    const hasText = !!(s.text || '').trim();
    const media = s.media?.type ? MEDIA_LABEL[s.media.type] || 'Mídia' : '';
    let what = media && hasText ? `${media} + texto` : media || (hasText ? 'Texto' : 'Passo vazio');
    return `${what}, após ${s.delay_value ?? 0} ${UNIT_SHORT[s.delay_unit] || 'min'}`;
}
const displayName = (a) => (a?.name && a.name.trim() && a.name.trim() !== DEFAULT_NAME ? a.name : deriveTitle(a));

// cadência compacta ("5 min → +10 min → +1 d") para o cabeçalho da prévia
const cadenceText = (steps = []) =>
    steps
        .map((s, i) => `${i === 0 ? '' : '+'}${s.delay_value ?? 0} ${UNIT_SHORT[s.delay_unit] || 'min'}`)
        .join(' → ');

// converte um passo em "mensagem" que o TelegramMessagesPreview entende
const stepToMessage = (s) => ({ id: s.id, text: s.text, media: s.media, buttons: s.buttons });

const emptyStep = () => ({
    id: uid('s'),
    delay_value: 5,
    delay_unit: 'minutes',
    text: '',
    media: null,
    buttons: [],
    condition: { type: 'always', on_fail: 'skip' },
    apply_tags: []
});
const emptyAutomation = () => ({ name: DEFAULT_NAME, active: true, steps: [emptyStep()] });

function StepCard({ index, step, onChange, onRemove, botId, bots, plans = [] }) {
    const [linkFor, setLinkFor] = useState(null); // {kind:'text'} | {kind:'button', id}
    const set = (patch) => onChange({ ...step, ...patch });
    const setBtn = (bid, patch) => set({ buttons: step.buttons.map((b) => (b.id === bid ? { ...b, ...patch } : b)) });

    const onPickLink = (url) => {
        if (!linkFor) return;
        if (linkFor.kind === 'text') set({ text: `${step.text || ''}${step.text ? ' ' : ''}${url}` });
        else if (linkFor.kind === 'button') setBtn(linkFor.id, { url });
    };

    const inactive = step.condition?.type === 'inactive';

    return (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 2, bgcolor: 'background.paper' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Chip size="small" label={`Passo ${index + 1}`} color="primary" sx={{ fontWeight: 700 }} />
                <Tooltip title="Remover passo">
                    <IconButton size="small" color="error" onClick={onRemove}>
                        <IconTrash size={16} />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* mensagem */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
                <Button size="small" startIcon={<IconLink size={14} />} onClick={() => setLinkFor({ kind: 'text' })} sx={{ textTransform: 'none' }}>
                    Inserir link
                </Button>
            </Stack>
            <TextField
                size="small"
                fullWidth
                multiline
                minRows={3}
                placeholder="Mensagem enviada neste passo. Variáveis: {{nome}}, {{username}}."
                value={step.text}
                onChange={(e) => set({ text: e.target.value })}
                sx={{ mb: 1.5 }}
            />

            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Mídia (opcional — vai com o texto como legenda)
            </Typography>
            <TelegramMediaField value={step.media} onChange={(media) => set({ media })} />

            {/* botões (link ou plano de checkout PIX) */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Botões</Typography>
                <Button size="small" startIcon={<IconPlus size={15} />} onClick={() => set({ buttons: [...step.buttons, { id: uid('b'), label: 'Botão', url: '' }] })} sx={{ textTransform: 'none' }}>
                    Adicionar
                </Button>
            </Stack>
            <Stack spacing={1}>
                {step.buttons.map((b) => {
                    const isPlan = b.plan_id !== undefined && b.plan_id !== null;
                    return (
                        <Box key={b.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                                <TextField size="small" fullWidth placeholder="Texto do botão" value={b.label || ''} onChange={(e) => setBtn(b.id, { label: e.target.value })} />
                                <Select
                                    size="small"
                                    value={isPlan ? 'plan' : 'link'}
                                    onChange={(e) =>
                                        setBtn(b.id, e.target.value === 'plan' ? { plan_id: b.plan_id || '', url: '' } : { plan_id: undefined, url: b.url || '' })
                                    }
                                    sx={{ flexShrink: 0, minWidth: 116 }}
                                >
                                    <MenuItem value="link">🔗 Link</MenuItem>
                                    <MenuItem value="plan">💎 Plano</MenuItem>
                                </Select>
                                <IconButton size="small" color="error" onClick={() => set({ buttons: step.buttons.filter((x) => x.id !== b.id) })}>
                                    <IconTrash size={15} />
                                </IconButton>
                            </Stack>
                            {isPlan ? (
                                <>
                                    <SearchSelect
                                        fullWidth
                                        label="Plano a vender"
                                        value={b.plan_id || ''}
                                        onChange={(v) => setBtn(b.id, { plan_id: v })}
                                        options={plans.map((p) => ({ value: p.id, label: `${p.name} — ${p.price_label}` }))}
                                    />
                                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                                        {plans.length ? 'Ao tocar, o bot gera o PIX e libera o acesso ao pagar.' : 'Cadastre planos em Pagamentos / VIP.'}
                                    </Typography>
                                </>
                            ) : (
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <TextField size="small" fullWidth placeholder="https://…" value={b.url || ''} onChange={(e) => setBtn(b.id, { url: e.target.value })} />
                                    <Button size="small" variant="outlined" onClick={() => setLinkFor({ kind: 'button', id: b.id })} sx={{ borderColor: 'divider', color: 'text.primary', minWidth: 38 }}>
                                        <IconLink size={15} />
                                    </Button>
                                </Stack>
                            )}
                        </Box>
                    );
                })}
            </Stack>

            {/* condição — seção destacada */}
            <Box
                sx={(t) => ({
                    mt: 2,
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: `rgba(${t.vars.palette.primary.mainChannel} / 0.22)`,
                    bgcolor: `rgba(${t.vars.palette.primary.mainChannel} / 0.05)`
                })}
            >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, color: 'primary.main' }}>
                    <IconTargetArrow size={16} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Condição de envio
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Select size="small" value={step.condition?.type || 'always'} onChange={(e) => set({ condition: { ...step.condition, type: e.target.value } })} sx={{ bgcolor: 'background.paper', minWidth: 200 }}>
                        <MenuItem value="always">Sempre enviar</MenuItem>
                        <MenuItem value="inactive">Só se o usuário não respondeu</MenuItem>
                    </Select>
                    {inactive ? (
                        <Select size="small" value={step.condition?.on_fail || 'skip'} onChange={(e) => set({ condition: { ...step.condition, on_fail: e.target.value } })} sx={{ bgcolor: 'background.paper' }}>
                            <MenuItem value="skip">se respondeu: pular passo</MenuItem>
                            <MenuItem value="stop">se respondeu: parar automação</MenuItem>
                        </Select>
                    ) : null}
                </Stack>
            </Box>

            <TextField
                size="small"
                fullWidth
                label="Aplicar tags ao enviar"
                placeholder="lembrete, quente"
                value={(step.apply_tags || []).join(', ')}
                onChange={(e) => set({ apply_tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                sx={{ mt: 1.5 }}
                helperText="Marca o lead (separe por vírgula)."
            />

            <TelegramLinkPicker open={!!linkFor} onClose={() => setLinkFor(null)} onPick={onPickLink} botId={botId} bots={bots} />
        </Box>
    );
}

export default function TelegramAutomations({ botId, bots }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [deletingBusy, setDeletingBusy] = useState(false);
    const [plans, setPlans] = useState([]); // planos do bot (botão de checkout PIX nos passos)

    const load = useCallback(async () => {
        if (!botId) return;
        setLoading(true);
        try {
            setList(await get(`/telegram/bots/${botId}/automations`));
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar automações.'));
        } finally {
            setLoading(false);
        }
    }, [botId]);

    useEffect(() => {
        load();
    }, [load]);

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

    const save = async () => {
        setSaving(true);
        try {
            const payload = { name: editing.name, active: editing.active, steps: editing.steps };
            if (editing.id) await put(`/telegram/bots/${botId}/automations/${editing.id}`, payload);
            else await post(`/telegram/bots/${botId}/automations`, payload);
            toast.success('Automação salva.');
            setEditing(null);
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar.'));
        } finally {
            setSaving(false);
        }
    };

    const del = async () => {
        if (!deleting) return;
        setDeletingBusy(true);
        try {
            await remove(`/telegram/bots/${botId}/automations/${deleting.id}`);
            toast.success('Automação excluída.');
            setDeleting(null);
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao excluir.'));
        } finally {
            setDeletingBusy(false);
        }
    };

    const toggleActive = async (a) => {
        try {
            await put(`/telegram/bots/${botId}/automations/${a.id}`, { active: !a.active });
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao atualizar.'));
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 620 }}>
                    Mensagens temporizadas enviadas <b>depois do /start</b>, mesmo sem o usuário interagir (drip). Ex.: lembrete 1h
                    depois, sequência a cada X minutos, ou cutucar só quem não respondeu.
                </Typography>
                <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setEditing(emptyAutomation())} sx={{ borderRadius: 2, fontWeight: 700 }} disabled={!botId}>
                    Nova automação
                </Button>
            </Stack>

            {list.length === 0 ? (
                <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 3, py: 5, textAlign: 'center' }}>
                    <IconBolt size={40} style={{ opacity: 0.4 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                        Nenhuma automação. Crie a primeira para nutrir os leads automaticamente.
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ maxWidth: 720 }}>
                    {/* nó de início */}
                    <Stack direction="row" spacing={1.5}>
                        <Stack alignItems="center">
                            <Box sx={{ width: 13, height: 13, borderRadius: '50%', bgcolor: 'success.main' }} />
                            <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', minHeight: 16 }} />
                        </Stack>
                        <Box sx={{ pb: 2 }}>
                            <Chip icon={<IconPlayerPlay size={14} />} label="Lead dá /start" color="success" variant="outlined" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
                        </Box>
                    </Stack>

                    {[...list]
                        .sort((a, b) => firstDelayMs(a) - firstDelayMs(b))
                        .map((a, i, arr) => {
                            const isLast = i === arr.length - 1;
                            const first = a.steps?.[0];
                            return (
                                <Stack key={a.id} direction="row" spacing={1.5}>
                                    <Stack alignItems="center">
                                        <Box sx={{ width: 13, height: 13, borderRadius: '50%', bgcolor: a.active ? 'primary.main' : 'text.disabled' }} />
                                        {!isLast ? <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', minHeight: 16 }} /> : null}
                                    </Stack>
                                    <Box sx={{ flex: 1, minWidth: 0, pb: 2.5 }}>
                                        {/* conector de tempo (absoluto, a partir do /start) */}
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                            <IconClock size={15} />
                                            <Chip size="small" label={`após ${first?.delay_value ?? 0} ${UNIT_SHORT[first?.delay_unit] || 'min'}`} variant="outlined" sx={{ borderRadius: 1, fontWeight: 700 }} />
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>do /start</Typography>
                                        </Stack>

                                        {/* card da automação */}
                                        <TgCard accent={a.active ? 'primary.main' : undefined} sx={{ p: 1.5, opacity: a.active ? 1 : 0.72 }}>
                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                                <IconBolt size={16} />
                                                <Typography sx={{ fontWeight: 700, flex: 1 }} noWrap title={a.name}>
                                                    {displayName(a)}
                                                </Typography>
                                                <Tooltip title={a.active ? 'Ativa' : 'Inativa'}>
                                                    <Switch size="small" checked={a.active} onChange={() => toggleActive(a)} />
                                                </Tooltip>
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" onClick={() => setEditing({ ...a, steps: (a.steps || []).map((s) => ({ ...s })) })}>
                                                        <IconPencil size={16} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Excluir">
                                                    <IconButton size="small" color="error" onClick={() => setDeleting(a)}>
                                                        <IconTrash size={16} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>

                                            {/* prévia dos passos como balões do Telegram */}
                                            {(a.steps || []).length > 1 ? (
                                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                                                    Cadência: {cadenceText(a.steps)}
                                                </Typography>
                                            ) : null}
                                            <TelegramMessagesPreview messages={(a.steps || []).map(stepToMessage)} />
                                        </TgCard>
                                    </Box>
                                </Stack>
                            );
                        })}
                </Box>
            )}

            {/* editor */}
            <TgModal
                open={!!editing}
                onClose={() => setEditing(null)}
                disableClose={saving}
                maxWidth="lg"
                title={editing?.id ? 'Editar automação' : 'Nova automação'}
                subtitle="Sequência temporizada disparada quando o lead dá /start."
                footer={
                    <>
                        <Button color="inherit" onClick={() => setEditing(null)} disabled={saving} sx={{ textTransform: 'none' }}>
                            Cancelar
                        </Button>
                        <Button
                            variant="contained"
                            onClick={save}
                            disabled={saving || !editing?.steps?.length}
                            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
                            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 120 }}
                        >
                            Salvar
                        </Button>
                    </>
                }
            >
                {editing ? (
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField label="Nome" size="small" fullWidth value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder={deriveTitle(editing)} />
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                <Switch checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                                <Typography variant="body2" sx={{ fontWeight: 600, color: editing.active ? 'success.main' : 'text.secondary' }}>
                                    {editing.active ? 'Ativa' : 'Inativa'}
                                </Typography>
                            </Stack>
                        </Stack>

                        <Alert severity="info" sx={{ borderRadius: 2, py: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}>
                            Ao dar <b>/start</b>, o lead entra na automação. Os passos disparam nos tempos definidos, um após o outro.
                        </Alert>

                        <Box>
                            {/* nó de início */}
                            <Stack direction="row" spacing={1.5}>
                                <Stack alignItems="center">
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
                                    <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', minHeight: 14 }} />
                                </Stack>
                                <Box sx={{ pb: 1.5 }}>
                                    <Chip icon={<IconPlayerPlay size={14} />} label="Lead dá /start" color="success" variant="outlined" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
                                </Box>
                            </Stack>

                            {editing.steps.map((s, i) => {
                                const onChangeStep = (ns) => setEditing({ ...editing, steps: editing.steps.map((x, idx) => (idx === i ? ns : x)) });
                                const isLast = i === editing.steps.length - 1;
                                return (
                                    <Stack key={s.id} direction="row" spacing={1.5}>
                                        <Stack alignItems="center">
                                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
                                            {!isLast ? <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', minHeight: 14 }} /> : null}
                                        </Stack>
                                        <Box sx={{ flex: 1, minWidth: 0, pb: 2 }}>
                                            {/* conector de tempo */}
                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                                                <IconClock size={15} />
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Enviar após</Typography>
                                                <TextField size="small" type="number" value={s.delay_value} onChange={(e) => onChangeStep({ ...s, delay_value: Math.max(0, Number(e.target.value) || 0) })} sx={{ width: 80 }} inputProps={{ min: 0 }} />
                                                <Select size="small" value={s.delay_unit} onChange={(e) => onChangeStep({ ...s, delay_unit: e.target.value })}>
                                                    {Object.entries(UNITS).map(([k, v]) => (
                                                        <MenuItem key={k} value={k}>{v}</MenuItem>
                                                    ))}
                                                </Select>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{i === 0 ? 'do /start' : 'do passo anterior'}</Typography>
                                            </Stack>

                                            {/* editor + prévia ao vivo (paridade com Copies dos broadcasts) */}
                                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="flex-start">
                                                <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                                                    <StepCard
                                                        index={i}
                                                        step={s}
                                                        botId={botId}
                                                        bots={bots}
                                                        plans={plans}
                                                        onChange={onChangeStep}
                                                        onRemove={() => setEditing({ ...editing, steps: editing.steps.filter((_, idx) => idx !== i) })}
                                                    />
                                                </Box>
                                                <Box sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0, position: { md: 'sticky' }, top: { md: 12 } }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                                        Prévia no Telegram
                                                    </Typography>
                                                    <TelegramMessagesPreview messages={[stepToMessage(s)]} />
                                                </Box>
                                            </Stack>
                                        </Box>
                                    </Stack>
                                );
                            })}
                        </Box>
                        <Button startIcon={<IconPlus size={16} />} onClick={() => setEditing({ ...editing, steps: [...editing.steps, emptyStep()] })} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                            Adicionar passo
                        </Button>
                    </Stack>
                ) : null}
            </TgModal>

            <TgConfirmDialog
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={del}
                loading={deletingBusy}
                danger
                icon={IconTrash}
                title="Excluir automação"
                message={`A automação "${deleting ? displayName(deleting) : ''}" será removida. Os leads em andamento nela param de receber os próximos passos.`}
                confirmLabel="Excluir"
            />
        </Box>
    );
}
