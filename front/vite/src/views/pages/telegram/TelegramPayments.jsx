import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import {
    IconPlus,
    IconPencil,
    IconTrash,
    IconCreditCard,
    IconDeviceFloppy,
    IconCopy,
    IconCheck,
    IconPlugConnected,
    IconCoin,
    IconUsersGroup,
    IconBroadcast,
    IconChevronLeft,
    IconChevronRight
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, put, remove } from '../../../api/api';
import SearchSelect from './SearchSelect';
import TelegramMediaField from './TelegramMediaField';
import { TgPageHeader, TgCard, TgStatusPill, TgEmptyState, TgGhostButton, TgModal, TgConfirmDialog, TgListSkeleton } from './ui';

const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const PROVIDERS = [
    { value: 'mercadopago', label: 'Mercado Pago' },
    { value: 'pushinpay', label: 'PushinPay' }
];
const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
    } catch {
        return '—';
    }
};

// =============================== GATEWAY ===============================
function GatewayTab() {
    const [data, setData] = useState(null);
    const [token, setToken] = useState('');
    const [provider, setProvider] = useState('mercadopago');
    const [pixKey, setPixKey] = useState('');
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [checkout, setCheckout] = useState(null);
    const [savingC, setSavingC] = useState(false);
    const setC = (patch) => setCheckout((c) => ({ ...c, ...patch }));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const s = await get('/telegram/payments/settings');
            setData(s);
            setProvider(s.provider);
            setPixKey(s.pix_key || '');
            setActive(s.active);
            setCheckout(s.checkout || null);
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar.'));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            const payload = { provider, active, pix_key: pixKey };
            if (token.trim()) payload.access_token = token.trim();
            const s = await put('/telegram/payments/settings', payload);
            setData(s);
            setToken('');
            toast.success('Gateway salvo.');
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar.'));
        } finally {
            setSaving(false);
        }
    };
    const test = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const r = await post('/telegram/payments/settings/test', {});
            setTestResult(r);
            if (r.ok) toast.success(`Conexão OK — ${r.detail || 'credencial válida'}`);
            else toast.error(`Falhou: ${r.detail || 'credencial inválida'}`);
        } catch (e) {
            setTestResult({ ok: false, detail: errMsg(e, 'Falha no teste.') });
            toast.error(errMsg(e, 'Falha no teste.'));
        } finally {
            setTesting(false);
        }
    };
    const copyWebhook = async () => {
        try {
            await navigator.clipboard.writeText(data.webhook_url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* noop */
        }
    };
    const saveCheckout = async () => {
        setSavingC(true);
        try {
            await put('/telegram/payments/settings', { checkout });
            toast.success('Mensagens do checkout salvas.');
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar.'));
        } finally {
            setSavingC(false);
        }
    };

    if (loading) return <TgListSkeleton rows={2} />;

    return (
        <Box sx={{ maxWidth: 620 }}>
            <TgCard hover={false} sx={{ p: 2.5 }}>
                <Stack spacing={2.25}>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.75 }}>Provedor de pagamento</Typography>
                        <Select size="small" fullWidth value={provider} onChange={(e) => setProvider(e.target.value)}>
                            {PROVIDERS.map((p) => (
                                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                            ))}
                        </Select>
                    </Box>

                    <TextField
                        label="Access token / chave da API"
                        size="small"
                        fullWidth
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={data?.has_token ? `Salvo: ${data.token_masked} (deixe em branco p/ manter)` : 'Cole a credencial do gateway'}
                        helperText={provider === 'mercadopago' ? 'Mercado Pago → Suas integrações → Access Token (produção).' : 'PushinPay → Token da API.'}
                    />

                    {data?.has_token ? (
                        <Alert severity={testResult && !testResult.ok ? 'error' : 'success'} sx={{ borderRadius: 2, py: 0.25, '& .MuiAlert-message': { fontSize: 13 } }}>
                            Chave salva (<b>{data.token_masked}</b>). O campo fica vazio de propósito — a chave nunca é exibida de novo. Para trocar, cole uma nova por cima.
                            {testResult ? (testResult.ok ? ` · ✅ Conectado: ${testResult.detail}` : ` · ❌ ${testResult.detail}`) : ''}
                        </Alert>
                    ) : null}

                    <TextField label="Chave PIX (opcional)" size="small" fullWidth value={pixKey} onChange={(e) => setPixKey(e.target.value)} />

                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>URL de webhook</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                            Cadastre esta URL no painel do gateway (notificações de pagamento). A confirmação é sempre reconferida na API.
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <TextField size="small" fullWidth value={data?.webhook_url || ''} InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }} onFocus={(e) => e.target.select()} />
                            <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
                                <IconButton size="small" onClick={copyWebhook}>{copied ? <IconCheck size={16} /> : <IconCopy size={16} />}</IconButton>
                            </Tooltip>
                        </Stack>
                    </Box>

                    <Box>
                        <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label={active ? 'Cobranças ativas' : 'Cobranças pausadas'} />
                        {!active ? (
                            <Alert severity="warning" sx={{ borderRadius: 2, py: 0.25, mt: 0.5, '& .MuiAlert-message': { fontSize: 13 } }}>
                                Enquanto pausado, o bot <b>não gera PIX</b>. Ligue “Cobranças ativas” e salve para começar a vender.
                            </Alert>
                        ) : null}
                    </Box>

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <TgGhostButton onClick={test} disabled={testing || !data?.has_token} startIcon={testing ? <CircularProgress size={14} /> : <IconPlugConnected size={16} />}>
                            Testar conexão
                        </TgGhostButton>
                        <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />} sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
                            Salvar gateway
                        </Button>
                    </Stack>
                </Stack>
            </TgCard>

            {checkout ? (
                <TgCard hover={false} sx={{ p: 2.5, mt: 2 }}>
                    <Typography sx={{ fontWeight: 700 }}>Mensagens do checkout</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                        O que o bot envia quando o lead vai pagar. Variáveis: <b>{'{plano}'}</b> e <b>{'{valor}'}</b>. Pode usar <b>{'<b>negrito</b>'}</b>.
                    </Typography>
                    <Stack spacing={2}>
                        <FormControlLabel control={<Switch checked={!!checkout.send_qr} onChange={(e) => setC({ send_qr: e.target.checked })} />} label="Enviar QR code (imagem)" />
                        <FormControlLabel
                            control={<Switch checked={!!checkout.send_pix_separate} onChange={(e) => setC({ send_pix_separate: e.target.checked })} />}
                            label="Enviar o PIX copia-e-cola numa mensagem separada (fácil de copiar)"
                        />
                        <TextField label="Mensagem de instrução" size="small" fullWidth multiline minRows={2} value={checkout.instruction_text || ''} onChange={(e) => setC({ instruction_text: e.target.value })} helperText="Ex.: 💎 {plano} — {valor}. Pague com PIX e toque em Já paguei." />
                        <TextField label="Texto antes do PIX (mensagem separada)" size="small" fullWidth value={checkout.pix_message_text || ''} onChange={(e) => setC({ pix_message_text: e.target.value })} />
                        <TextField
                            label="Botão de copiar o código PIX"
                            size="small"
                            fullWidth
                            value={checkout.copy_button_text ?? ''}
                            onChange={(e) => setC({ copy_button_text: e.target.value })}
                            helperText="Botão que copia o código PIX ao toque (dentro da mensagem). Deixe vazio para não mostrar."
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField label="Rótulo do botão de pagar" size="small" fullWidth value={checkout.paid_button || ''} onChange={(e) => setC({ paid_button: e.target.value })} />
                            <TextField label="Rótulo do botão de cancelar" size="small" fullWidth value={checkout.cancel_button || ''} onChange={(e) => setC({ cancel_button: e.target.value })} />
                        </Stack>
                        <TextField label="Mensagem quando ainda não pagou" size="small" fullWidth multiline minRows={2} value={checkout.pending_text || ''} onChange={(e) => setC({ pending_text: e.target.value })} />
                        <TextField label="Mensagem quando a cobrança expirou" size="small" fullWidth multiline minRows={2} value={checkout.expired_text || ''} onChange={(e) => setC({ expired_text: e.target.value })} />
                        <Stack direction="row" justifyContent="flex-end">
                            <Button variant="contained" onClick={saveCheckout} disabled={savingC} startIcon={savingC ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />} sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
                                Salvar mensagens
                            </Button>
                        </Stack>
                    </Stack>
                </TgCard>
            ) : null}
        </Box>
    );
}

// =============================== PLANOS ===============================
const EMPTY_PLAN = { name: 'Novo plano', bot_id: '', price_reais: '', duration_days: 0, description: '', deliver_group_id: '', deliver_message: '', deliver_media: null, active: true };

function PlanModal({ initial, open, onClose, bots }) {
    const [form, setForm] = useState(EMPTY_PLAN);
    const [targets, setTargets] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            if (initial?.id) {
                setForm({
                    name: initial.name,
                    bot_id: initial.bot_id,
                    price_reais: (initial.price_cents / 100).toFixed(2),
                    duration_days: initial.duration_days || 0,
                    description: initial.description || '',
                    deliver_group_id: initial.deliver_group_id || '',
                    deliver_message: initial.deliver_message || '',
                    deliver_media: initial.deliver_media || null,
                    active: initial.active
                });
            } else setForm(EMPTY_PLAN);
        }
    }, [open, initial]);

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

    const save = async () => {
        if (!form.bot_id) return toast.error('Escolha o bot.');
        const cents = Math.round((Number(String(form.price_reais).replace(',', '.')) || 0) * 100);
        if (cents <= 0) return toast.error('Informe um valor válido.');
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                bot_id: form.bot_id,
                price_cents: cents,
                duration_days: Math.max(0, parseInt(form.duration_days, 10) || 0),
                description: form.description,
                deliver_group_id: form.deliver_group_id || null,
                deliver_message: form.deliver_message,
                deliver_media: form.deliver_media,
                active: form.active
            };
            if (initial?.id) await put(`/telegram/payments/plans/${initial.id}`, payload);
            else await post('/telegram/payments/plans', payload);
            toast.success('Plano salvo.');
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
            title={initial?.id ? 'Editar plano' : 'Novo plano'}
            subtitle="O lead digita /vip ou /planos no bot para ver os planos e pagar via PIX."
            disableClose={saving}
            footer={
                <>
                    <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>Cancelar</Button>
                    <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />} sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>Salvar</Button>
                </>
            }
        >
            <Stack spacing={2.25}>
                <TextField label="Nome do plano" size="small" fullWidth value={form.name} onChange={(e) => setF({ name: e.target.value })} />
                <Stack direction="row" spacing={2}>
                    <SearchSelect fullWidth label="Bot" value={form.bot_id} onChange={(v) => setF({ bot_id: v, deliver_group_id: '' })} options={bots.map((b) => ({ value: b.id, label: `${b.name}${b.username ? ` · @${b.username}` : ''}` }))} />
                    <TextField label="Valor (R$)" size="small" value={form.price_reais} onChange={(e) => setF({ price_reais: e.target.value })} sx={{ width: 140 }} InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} placeholder="19,90" />
                    <TextField
                        label="Duração (dias)"
                        size="small"
                        type="number"
                        value={form.duration_days}
                        onChange={(e) => setF({ duration_days: e.target.value })}
                        sx={{ width: 150 }}
                        inputProps={{ min: 0 }}
                        helperText="0 = vitalício"
                    />
                </Stack>
                <TextField label="Descrição (opcional)" size="small" fullWidth multiline minRows={2} value={form.description} onChange={(e) => setF({ description: e.target.value })} />

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Entrega ao confirmar o pagamento</Typography>
                    <SearchSelect
                        fullWidth
                        label="Grupo / canal VIP (link de convite único)"
                        value={form.deliver_group_id}
                        onChange={(v) => setF({ deliver_group_id: v })}
                        options={[{ value: '', label: '— nenhum —' }, ...targets.map((t) => ({ value: t.id, label: `${t._kind === 'channel' ? '📢 ' : '👥 '}${t.name || t.title}` }))]}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Ao pagar, o lead recebe um link de convite de <b>uso único</b> pro grupo/canal. O bot precisa ser admin com permissão de convidar.
                    </Typography>
                </Box>

                <TextField label="Mensagem de entrega (opcional)" size="small" fullWidth multiline minRows={2} value={form.deliver_message} onChange={(e) => setF({ deliver_message: e.target.value })} placeholder="Obrigado! Aqui está seu acesso exclusivo…" />
                <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>Conteúdo/mídia de entrega (opcional)</Typography>
                    <TelegramMediaField value={form.deliver_media} onChange={(media) => setF({ deliver_media: media })} />
                </Box>

                <FormControlLabel control={<Switch checked={form.active} onChange={(e) => setF({ active: e.target.checked })} />} label={form.active ? 'Ativo (aparece pro lead)' : 'Inativo'} />
            </Stack>
        </TgModal>
    );
}

function PlansTab({ bots }) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [botFilter, setBotFilter] = useState('all');
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [delBusy, setDelBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setPlans(await get(`/telegram/payments/plans${botFilter !== 'all' ? `?bot_id=${botFilter}` : ''}`));
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao carregar planos.'));
        } finally {
            setLoading(false);
        }
    }, [botFilter]);
    useEffect(() => {
        load();
    }, [load]);

    const toggleActive = async (p) => {
        try {
            await put(`/telegram/payments/plans/${p.id}`, { active: !p.active });
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha.'));
        }
    };
    const confirmDelete = async () => {
        setDelBusy(true);
        try {
            await remove(`/telegram/payments/plans/${deleting.id}`);
            toast.success('Plano excluído.');
            setDeleting(null);
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao excluir.'));
        } finally {
            setDelBusy(false);
        }
    };

    const botName = useMemo(() => new Map(bots.map((b) => [b.id, b.name])), [bots]);

    return (
        <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <SearchSelect sx={{ minWidth: 220 }} label="Bot" value={botFilter} onChange={setBotFilter} options={[{ value: 'all', label: 'Todos os bots' }, ...bots.map((b) => ({ value: b.id, label: b.name }))]} />
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setEditing({})} sx={{ borderRadius: 2, fontWeight: 700 }}>Novo plano</Button>
            </Stack>

            {loading ? (
                <TgListSkeleton rows={3} />
            ) : plans.length === 0 ? (
                <TgEmptyState icon={IconCoin} title="Nenhum plano" description="Crie um plano VIP com valor e o grupo/canal de entrega. O lead digita /vip no bot para comprar." action={<Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => setEditing({})} sx={{ borderRadius: 2, fontWeight: 700 }}>Novo plano</Button>} />
            ) : (
                <Stack spacing={1.25}>
                    {plans.map((p) => (
                        <TgCard key={p.id} accent={p.active ? 'success.main' : undefined} sx={{ p: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
                            <Box sx={{ width: 46, height: 46, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)' }}>
                                <IconCoin size={22} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: 15.5 }} noWrap>{p.name}</Typography>
                                    <TgStatusPill status={p.active ? 'active' : 'inactive'} />
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ color: 'text.secondary' }}>
                                    <Typography sx={{ fontWeight: 800, color: 'success.main', fontSize: 15 }}>{p.price_label}</Typography>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 0.9, py: 0.3, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 11.5, fontWeight: 600 }}>
                                        {p.duration_days > 0 ? `${p.duration_days} dias` : 'vitalício'}
                                    </Box>
                                    <Typography variant="caption">· {botName.get(p.bot_id) || 'bot'}</Typography>
                                    {p.deliver_group ? (
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.3, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 11.5, fontWeight: 600 }}>
                                            {p.deliver_group.type === 'channel' ? <IconBroadcast size={12} /> : <IconUsersGroup size={12} />}
                                            {p.deliver_group.title}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" sx={{ color: 'warning.main' }}>sem grupo de entrega</Typography>
                                    )}
                                </Stack>
                            </Box>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                <Tooltip title={p.active ? 'Ativo' : 'Inativo'}>
                                    <Switch size="small" checked={p.active} onChange={() => toggleActive(p)} />
                                </Tooltip>
                                <TgGhostButton startIcon={<IconPencil size={15} />} onClick={() => setEditing(p)}>Editar</TgGhostButton>
                                <Tooltip title="Excluir">
                                    <TgGhostButton onClick={() => setDeleting(p)} sx={{ minWidth: 0, px: 1, color: 'error.main', borderColor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.3)` }}>
                                        <IconTrash size={16} />
                                    </TgGhostButton>
                                </Tooltip>
                            </Stack>
                        </TgCard>
                    ))}
                </Stack>
            )}

            <PlanModal initial={editing && editing.id ? editing : null} open={!!editing} bots={bots} onClose={(ok) => { setEditing(null); if (ok) load(); }} />
            <TgConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={delBusy} danger icon={IconTrash} title="Excluir plano?" message={`O plano "${deleting?.name}" será removido. Vendas já feitas continuam no histórico.`} confirmLabel="Excluir" />
        </Box>
    );
}

// =============================== VENDAS ===============================
const SALE_STATUS = { PAID: 'active', PENDING: 'pending', EXPIRED: 'inactive', FAILED: 'error' };
const SALE_LABEL = { PAID: 'Pago', PENDING: 'Aguardando', EXPIRED: 'Expirado', FAILED: 'Falhou' };

function SalesTab({ bots }) {
    const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1, revenue_paid: 'R$ 0,00', paid_count: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('all');
    const [botFilter, setBotFilter] = useState('all');
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [status, botFilter]);

    useEffect(() => {
        setLoading(true);
        get(`/telegram/payments/sales?page=${page}&status=${status}&bot_id=${botFilter}`)
            .then(setData)
            .catch(() => setData({ items: [], total: 0, page: 1, pages: 1, revenue_paid: 'R$ 0,00', paid_count: 0 }))
            .finally(() => setLoading(false));
    }, [page, status, botFilter]);

    return (
        <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <TgCard hover={false} sx={{ p: 1.75, px: 2.5, flex: '0 0 auto' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Receita confirmada</Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.main' }}>{data.revenue_paid}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{data.paid_count} venda(s) paga(s)</Typography>
                </TgCard>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <SearchSelect sx={{ minWidth: 200 }} label="Bot" value={botFilter} onChange={setBotFilter} options={[{ value: 'all', label: 'Todos os bots' }, ...bots.map((b) => ({ value: b.id, label: b.name }))]} />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="sales-status-label">Status</InputLabel>
                    <Select labelId="sales-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <MenuItem value="all">Todos os status</MenuItem>
                        <MenuItem value="paid">Pagos</MenuItem>
                        <MenuItem value="pending">Aguardando</MenuItem>
                        <MenuItem value="expired">Expirados</MenuItem>
                    </Select>
                </FormControl>
            </Stack>

            {loading ? (
                <TgListSkeleton rows={5} />
            ) : data.items.length === 0 ? (
                <TgEmptyState icon={IconCreditCard} title="Nenhuma venda" description="As cobranças aparecem aqui assim que um lead tocar num plano." dense />
            ) : (
                <Stack spacing={1}>
                    {data.items.map((s) => (
                        <TgCard key={s.id} sx={{ p: 1.5, display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }} noWrap>{s.plan_name}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lead {s.tg_user_id} · {fmtDate(s.created_at)}</Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 800 }}>{s.amount_label}</Typography>
                            <TgStatusPill status={SALE_STATUS[s.status] || 'inactive'} label={SALE_LABEL[s.status] || s.status} />
                            {s.status === 'PAID' && s.delivered ? <TgStatusPill status="ok" label="Entregue" /> : null}
                        </TgCard>
                    ))}

                    {data.pages > 1 ? (
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1 }}>
                            <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><IconChevronLeft size={18} /></IconButton>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Página {data.page} de {data.pages}</Typography>
                            <IconButton size="small" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages}><IconChevronRight size={18} /></IconButton>
                        </Stack>
                    ) : null}
                </Stack>
            )}
        </Box>
    );
}

// =============================== ASSINANTES ===============================
const SUB_STATUS = { ACTIVE: 'active', EXPIRED: 'inactive', CANCELED: 'error' };
const SUB_LABEL = { ACTIVE: 'Ativa', EXPIRED: 'Expirada', CANCELED: 'Cancelada' };
const fmtDay = (v) => {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(v));
    } catch {
        return '—';
    }
};

function SubscriptionsTab({ bots }) {
    const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1, active_count: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('all');
    const [botFilter, setBotFilter] = useState('all');
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [status, botFilter]);

    useEffect(() => {
        setLoading(true);
        get(`/telegram/payments/subscriptions?page=${page}&status=${status}&bot_id=${botFilter}`)
            .then(setData)
            .catch(() => setData({ items: [], total: 0, page: 1, pages: 1, active_count: 0 }))
            .finally(() => setLoading(false));
    }, [page, status, botFilter]);

    return (
        <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <TgCard hover={false} sx={{ p: 1.75, px: 2.5, flex: '0 0 auto' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Assinantes ativos</Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.main' }}>{data.active_count}</Typography>
                </TgCard>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                <SearchSelect sx={{ minWidth: 200 }} label="Bot" value={botFilter} onChange={setBotFilter} options={[{ value: 'all', label: 'Todos os bots' }, ...bots.map((b) => ({ value: b.id, label: b.name }))]} />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="subs-status-label">Status</InputLabel>
                    <Select labelId="subs-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <MenuItem value="all">Todas</MenuItem>
                        <MenuItem value="active">Ativas</MenuItem>
                        <MenuItem value="expired">Expiradas</MenuItem>
                        <MenuItem value="canceled">Canceladas</MenuItem>
                    </Select>
                </FormControl>
            </Stack>

            {loading ? (
                <TgListSkeleton rows={5} />
            ) : data.items.length === 0 ? (
                <TgEmptyState icon={IconUsersGroup} title="Nenhum assinante" description="Assinaturas por tempo aparecem aqui quando um lead compra um plano com duração." dense />
            ) : (
                <Stack spacing={1}>
                    {data.items.map((s) => (
                        <TgCard key={s.id} sx={{ p: 1.5, display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }} noWrap>{s.plan_name}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lead {s.tg_user_id}</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>vence</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtDay(s.access_until)}</Typography>
                            </Box>
                            <TgStatusPill status={SUB_STATUS[s.status] || 'inactive'} label={SUB_LABEL[s.status] || s.status} />
                        </TgCard>
                    ))}
                    {data.pages > 1 ? (
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1 }}>
                            <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><IconChevronLeft size={18} /></IconButton>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Página {data.page} de {data.pages}</Typography>
                            <IconButton size="small" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages}><IconChevronRight size={18} /></IconButton>
                        </Stack>
                    ) : null}
                </Stack>
            )}
        </Box>
    );
}

// =============================== PÁGINA ===============================
export default function TelegramPayments() {
    const [tab, setTab] = useState(0);
    const [bots, setBots] = useState([]);

    useEffect(() => {
        get('/telegram/bots').then(setBots).catch(() => setBots([]));
    }, []);

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TgPageHeader icon={IconCreditCard} title="Pagamentos / VIP" subtitle="Planos, gateway PIX e vendas — o lead paga no bot e recebe acesso exclusivo." />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Tab label="Planos" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab label="Gateway" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab label="Vendas" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab label="Assinantes" sx={{ textTransform: 'none', fontWeight: 700 }} />
            </Tabs>

            {tab === 0 ? <PlansTab bots={bots} /> : tab === 1 ? <GatewayTab /> : tab === 2 ? <SalesTab bots={bots} /> : <SubscriptionsTab bots={bots} />}
        </Box>
    );
}
