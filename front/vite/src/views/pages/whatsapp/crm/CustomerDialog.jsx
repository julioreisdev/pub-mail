import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCheck, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

import { post, put, remove } from 'api/api';
import { TgConfirmDialog, TgModal } from 'views/pages/telegram/ui';
import { errMsg, fmtPhone, onlyDigits } from '../waShared';
import {
  BILLING_OPTIONS,
  MoneyField,
  StatusChip,
  SUB_STATUS,
  billingShort,
  dueText,
  formatBRL,
  isRecurring,
  todayIso,
  waPrimaryBtn
} from './crmKit';

// ============================================================================
// Diálogo de cliente (criar / editar) — usado na página Clientes e no painel
// "Cliente" do chat. Abas: Dados · Assinaturas · Mais (campos personalizados,
// observações, situação). Assinaturas só depois de salvar (precisa do id).
// ============================================================================

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO'
];
const emptyAddr = { zip: '', street: '', number: '', complement: '', district: '', city: '', state: '' };

const formFrom = (c, contact) => ({
  name: c?.name || contact?.name || '',
  phone: c?.phone || contact?.phone || '',
  doc: c?.doc || '',
  email: c?.email || '',
  address: { ...emptyAddr, ...(c?.address || {}) },
  notes: c?.notes || '',
  custom: { ...(c?.custom || {}) },
  status: c?.status || 'active',
  since: c?.since || todayIso()
});

const maskDoc = (v) => {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};
const maskCep = (v) => {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// ----------------------------------------------------------------------------
// Formulário de assinatura (inline)
// ----------------------------------------------------------------------------
function SubscriptionForm({ initial, products, onCancel, onSave, busy }) {
  const [f, setF] = useState(() => ({
    product_id: initial?.product_id || '',
    product_name: initial?.product_name || '',
    price_cents: initial?.price_cents ?? 0,
    billing: initial?.billing || 'monthly',
    due_day: initial?.due_day || new Date().getDate() > 28 ? 28 : new Date().getDate(),
    next_due_at: initial?.next_due_at || '',
    status: initial?.status || 'active',
    notes: initial?.notes || ''
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pickProduct = (id) => {
    const p = products.find((x) => x.id === id);
    setF((x) => ({ ...x, product_id: id, ...(p ? { product_name: p.name, price_cents: p.price_cents, billing: p.billing } : {}) }));
  };
  const recurring = isRecurring(f.billing);
  const save = () => {
    if (!f.product_id && !f.product_name.trim()) return toast.error('Escolha um produto ou dê um nome à assinatura.');
    if (recurring && !(f.due_day >= 1 && f.due_day <= 28)) return toast.error('Dia de vencimento entre 1 e 28.');
    onSave({
      product_id: f.product_id || null,
      product_name: f.product_name.trim() || undefined,
      price_cents: f.price_cents,
      billing: f.billing,
      due_day: recurring ? Number(f.due_day) : null,
      next_due_at: recurring && f.next_due_at ? f.next_due_at : recurring ? undefined : null,
      status: f.status,
      notes: f.notes
    });
  };
  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: 'action.hover' }}>
      <Stack spacing={1.25}>
        <TextField
          select
          size="small"
          label="Produto / serviço"
          value={f.product_id}
          onChange={(e) => pickProduct(e.target.value)}
          fullWidth
        >
          <MenuItem value="">
            <em>Sem produto do catálogo (nome livre)</em>
          </MenuItem>
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id} disabled={!p.active}>
              {p.name} · {formatBRL(p.price_cents)}
              {billingShort(p.billing)}
            </MenuItem>
          ))}
        </TextField>
        {!f.product_id ? (
          <TextField
            size="small"
            label="Nome do produto ou serviço"
            value={f.product_name}
            onChange={(e) => set('product_name', e.target.value.slice(0, 120))}
            fullWidth
          />
        ) : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <MoneyField label="Valor cobrado" valueCents={f.price_cents} onChange={(c) => set('price_cents', c)} />
          <TextField select size="small" label="Cobrança" value={f.billing} onChange={(e) => set('billing', e.target.value)} fullWidth>
            {BILLING_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {recurring ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              size="small"
              type="number"
              label="Dia do vencimento"
              value={f.due_day}
              onChange={(e) => set('due_day', Math.min(28, Math.max(1, parseInt(e.target.value || '1', 10) || 1)))}
              inputProps={{ min: 1, max: 28 }}
              fullWidth
              helperText="1 a 28 (todo mês)"
            />
            <TextField
              size="small"
              type="date"
              label="Próximo vencimento"
              value={f.next_due_at}
              onChange={(e) => set('next_due_at', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              helperText="Vazio = calculado pelo dia"
            />
          </Stack>
        ) : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField select size="small" label="Situação" value={f.status} onChange={(e) => set('status', e.target.value)} fullWidth>
            {Object.entries(SUB_STATUS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Observação"
            value={f.notes}
            onChange={(e) => set('notes', e.target.value.slice(0, 500))}
            fullWidth
          />
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" color="inherit" onClick={onCancel} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <IconCheck size={15} />}
            sx={waPrimaryBtn}
          >
            {initial ? 'Salvar assinatura' : 'Adicionar assinatura'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function SubscriptionRow({ s, onEdit, onRemove }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{ px: 1.25, py: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
            {s.product_name}
          </Typography>
          <StatusChip map={SUB_STATUS} status={s.status} />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
          {s.price_label}
          {billingShort(s.billing)}
          {s.next_due_label ? ` · ${s.next_due_label} (${dueText(s.days_to_due)})` : ''}
          {s.notes ? ` · ${s.notes}` : ''}
        </Typography>
      </Box>
      <Tooltip title="Editar">
        <IconButton size="small" onClick={onEdit}>
          <IconPencil size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Excluir">
        <IconButton size="small" onClick={onRemove}>
          <IconTrash size={16} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

// ============================================================================
export default function CustomerDialog({ open, onClose, customer, contact, products = [], fields = [], onSaved, onDeleted, canDelete }) {

  const [tab, setTab] = useState('data');
  const [f, setF] = useState(() => formFrom(customer, contact));
  const [cur, setCur] = useState(customer || null); // cliente após salvar (assinaturas)
  const [busy, setBusy] = useState(false);
  const [subForm, setSubForm] = useState(null); // null | 'new' | assinatura
  const [subBusy, setSubBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'sub', s} | {kind:'customer'}

  useEffect(() => {
    if (!open) return;
    setTab('data');
    setF(formFrom(customer, contact));
    setCur(customer || null);
    setBusy(false);
    setSubForm(null);
    setConfirm(null);
  }, [open, customer, contact]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setAddr = (k, v) => setF((x) => ({ ...x, address: { ...x.address, [k]: v } }));
  const setCustom = (k, v) => setF((x) => ({ ...x, custom: { ...x.custom, [k]: v } }));

  const payload = () => ({
    name: f.name.trim(),
    doc: onlyDigits(f.doc) || '',
    email: f.email.trim(),
    address: f.address,
    notes: f.notes,
    custom: f.custom,
    status: f.status,
    since: f.since || null
  });

  const save = async () => {
    if (!f.name.trim()) return toast.error('Informe o nome do cliente.');
    setBusy(true);
    try {
      let saved;
      if (cur?.id) saved = await put(`/whatsapp/customers/${cur.id}`, payload());
      else {
        const body = { ...payload() };
        if (contact?.id) body.contact_id = contact.id;
        else {
          const phone = onlyDigits(f.phone);
          if (phone.length < 10 || phone.length > 15) {
            setBusy(false);
            return toast.error('Informe o WhatsApp com DDI e DDD, ex.: 5511999999999.');
          }
          body.phone = phone;
        }
        saved = await post('/whatsapp/customers', body);
      }
      setCur(saved);
      onSaved?.(saved);
      if (!cur?.id) {
        toast.success('Cliente cadastrado. Agora adicione o que ele usa ou paga.');
        setTab('subs');
        setSubForm('new');
      } else {
        toast.success('Cliente salvo.');
        onClose?.();
      }
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const saveSub = async (body) => {
    if (!cur?.id) return;
    setSubBusy(true);
    try {
      const r =
        subForm && subForm !== 'new'
          ? await put(`/whatsapp/customers/${cur.id}/subscriptions/${subForm.id}`, body)
          : await post(`/whatsapp/customers/${cur.id}/subscriptions`, body);
      setCur(r);
      onSaved?.(r);
      setSubForm(null);
      toast.success(subForm === 'new' ? 'Assinatura adicionada.' : 'Assinatura salva.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a assinatura.'));
    } finally {
      setSubBusy(false);
    }
  };

  const removeSub = async () => {
    const s = confirm?.s;
    if (!s || !cur?.id) return;
    setSubBusy(true);
    try {
      const r = await remove(`/whatsapp/customers/${cur.id}/subscriptions/${s.id}`);
      setCur(r);
      onSaved?.(r);
      setConfirm(null);
      toast.success('Assinatura excluída.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível excluir.'));
    } finally {
      setSubBusy(false);
    }
  };

  const removeCustomer = async () => {
    if (!cur?.id) return;
    setBusy(true);
    try {
      await remove(`/whatsapp/customers/${cur.id}`);
      toast.success('Cliente removido (o contato continua).');
      setConfirm(null);
      onDeleted?.(cur);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível remover.'));
    } finally {
      setBusy(false);
    }
  };

  const subs = useMemo(
    () =>
      (cur?.subscriptions || [])
        .filter((s) => s.status !== 'canceled')
        .concat((cur?.subscriptions || []).filter((s) => s.status === 'canceled')),
    [cur]
  );
  const activeProducts = products.filter((p) => p.active || subs.some((s) => s.product_id === p.id));

  return (
    <>
      <TgModal
        open={open}
        onClose={() => !busy && onClose?.()}
        title={cur?.id ? cur.name : 'Novo cliente'}
        subtitle={
          cur?.id
            ? `${fmtPhone(cur.phone) || ''}${cur.monthly_cents ? ` · ${cur.monthly_label}/mês` : ''}`
            : contact
              ? `Promover ${contact.name || fmtPhone(contact.phone)} a cliente`
              : 'Cadastre quem compra ou assina algo da sua empresa'
        }
        maxWidth="sm"
        disableClose={busy}
        tabs={
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }, minHeight: 40 }}
          >
            <Tab value="data" label="Dados" />
            <Tab value="subs" label={`Assinaturas${subs.length ? ` (${subs.length})` : ''}`} disabled={!cur?.id} />
            <Tab value="more" label="Mais" />
          </Tabs>
        }
        footer={
          <>
            {cur?.id && canDelete ? (
              <Button
                color="error"
                onClick={() => setConfirm({ kind: 'customer' })}
                disabled={busy}
                sx={{ textTransform: 'none', mr: 'auto' }}
              >
                Remover cliente
              </Button>
            ) : null}
            <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
              {cur?.id ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={save}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
              sx={waPrimaryBtn}
            >
              {cur?.id ? 'Salvar' : 'Cadastrar'}
            </Button>
          </>
        }
      >
        {tab === 'data' ? (
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="Nome do cliente"
              value={f.name}
              onChange={(e) => set('name', e.target.value.slice(0, 255))}
              fullWidth
              autoFocus={!cur?.id}
            />
            <TextField
              size="small"
              label="WhatsApp"
              value={cur?.id || contact ? fmtPhone(f.phone) : f.phone}
              onChange={(e) => set('phone', e.target.value)}
              fullWidth
              disabled={Boolean(cur?.id || contact)}
              helperText={cur?.id || contact ? 'É o contato desta conversa.' : 'Com DDI e DDD, só números: 5511999999999'}
              inputProps={{ inputMode: 'numeric' }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="CPF ou CNPJ"
                value={maskDoc(f.doc)}
                onChange={(e) => set('doc', e.target.value)}
                fullWidth
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                size="small"
                label="E-mail"
                type="email"
                value={f.email}
                onChange={(e) => set('email', e.target.value.slice(0, 255))}
                fullWidth
              />
            </Stack>
            <Divider>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                Endereço (necessário só para boleto)
              </Typography>
            </Divider>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="CEP"
                value={maskCep(f.address.zip)}
                onChange={(e) => setAddr('zip', e.target.value)}
                sx={{ width: { sm: 150 } }}
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                size="small"
                label="Rua"
                value={f.address.street}
                onChange={(e) => setAddr('street', e.target.value.slice(0, 120))}
                fullWidth
              />
              <TextField
                size="small"
                label="Nº"
                value={f.address.number}
                onChange={(e) => setAddr('number', e.target.value.slice(0, 20))}
                sx={{ width: { sm: 110 } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="Complemento"
                value={f.address.complement}
                onChange={(e) => setAddr('complement', e.target.value.slice(0, 60))}
                fullWidth
              />
              <TextField
                size="small"
                label="Bairro"
                value={f.address.district}
                onChange={(e) => setAddr('district', e.target.value.slice(0, 80))}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="Cidade"
                value={f.address.city}
                onChange={(e) => setAddr('city', e.target.value.slice(0, 80))}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="UF"
                value={f.address.state}
                onChange={(e) => setAddr('state', e.target.value)}
                sx={{ width: { sm: 110 } }}
              >
                <MenuItem value="">—</MenuItem>
                {UFS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        ) : null}

        {tab === 'subs' ? (
          <Stack spacing={1.25}>
            {!activeProducts.length && !subs.length ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Você ainda não tem produtos cadastrados. Dá para criar a assinatura com um nome livre, ou cadastre o catálogo em{' '}
                <strong>WhatsApp → Produtos</strong>.
              </Alert>
            ) : null}
            {subs.map((s) =>
              subForm && subForm !== 'new' && subForm.id === s.id ? (
                <SubscriptionForm
                  key={s.id}
                  initial={s}
                  products={activeProducts}
                  busy={subBusy}
                  onCancel={() => setSubForm(null)}
                  onSave={saveSub}
                />
              ) : (
                <SubscriptionRow key={s.id} s={s} onEdit={() => setSubForm(s)} onRemove={() => setConfirm({ kind: 'sub', s })} />
              )
            )}
            {subForm === 'new' ? (
              <SubscriptionForm products={activeProducts} busy={subBusy} onCancel={() => setSubForm(null)} onSave={saveSub} />
            ) : (
              <Button
                startIcon={<IconPlus size={16} />}
                onClick={() => setSubForm('new')}
                sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
              >
                Adicionar produto / assinatura
              </Button>
            )}
            {!subs.length && subForm !== 'new' ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                O que este cliente usa ou paga: produto, plano, serviço — com valor e dia de vencimento quando for recorrente.
              </Typography>
            ) : null}
          </Stack>
        ) : null}

        {tab === 'more' ? (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                size="small"
                label="Situação do cliente"
                value={f.status}
                onChange={(e) => set('status', e.target.value)}
                fullWidth
              >
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="date"
                label="Cliente desde"
                value={f.since || ''}
                onChange={(e) => set('since', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            {fields.length ? (
              <>
                <Divider>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    Campos da sua empresa
                  </Typography>
                </Divider>
                {fields.map((fd) =>
                  fd.type === 'select' ? (
                    <TextField
                      key={fd.key}
                      select
                      size="small"
                      label={fd.label}
                      value={f.custom[fd.key] || ''}
                      onChange={(e) => setCustom(fd.key, e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">—</MenuItem>
                      {(fd.options || []).map((o) => (
                        <MenuItem key={o} value={o}>
                          {o}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      key={fd.key}
                      size="small"
                      type={fd.type === 'number' ? 'number' : fd.type === 'date' ? 'date' : 'text'}
                      label={fd.label}
                      value={f.custom[fd.key] || ''}
                      onChange={(e) => setCustom(fd.key, e.target.value.slice(0, 500))}
                      InputLabelProps={fd.type === 'date' ? { shrink: true } : undefined}
                      fullWidth
                    />
                  )
                )}
              </>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Precisa de campos próprios (contrato, placa, matrícula…)? Crie em{' '}
                <strong>WhatsApp → Clientes → Campos personalizados</strong>.
              </Typography>
            )}
            <TextField
              size="small"
              label="Observações"
              value={f.notes}
              onChange={(e) => set('notes', e.target.value.slice(0, 20000))}
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              placeholder="Tudo que a equipe precisa lembrar sobre este cliente."
            />
          </Stack>
        ) : null}
      </TgModal>

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.kind === 'sub' ? removeSub : removeCustomer}
        loading={subBusy || busy}
        danger
        title={confirm?.kind === 'sub' ? 'Excluir esta assinatura?' : 'Remover este cliente?'}
        message={
          confirm?.kind === 'sub'
            ? `${confirm.s?.product_name} sai do cadastro do cliente. O histórico de cobranças não é apagado.`
            : 'O cadastro de cliente e as assinaturas dele são apagados. O contato do WhatsApp e a conversa continuam.'
        }
        confirmLabel={confirm?.kind === 'sub' ? 'Excluir' : 'Remover'}
      />
    </>
  );
}
