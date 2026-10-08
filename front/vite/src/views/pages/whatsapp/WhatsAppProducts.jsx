import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCheck, IconPackage, IconPencil, IconPlus, IconRefresh, IconTrash, IconUsers } from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgCardGridSkeleton, TgConfirmDialog, TgEmptyState, TgModal } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';
import { WA_DARK, errMsg, tint } from './waShared';
import { BILLING_OPTIONS, MoneyField, billingLabel, billingShort, formatBRL, waPrimaryBtn } from './crm/crmKit';

// ============================================================================
// WhatsApp → Produtos: catálogo do que a empresa vende (produto, serviço, plano).
// Cada item tem preço e tipo de cobrança; é usado nas assinaturas dos clientes e
// nas cobranças (fase 2). Criar/editar/excluir: dono ou admin.
// ============================================================================

const empty = { name: '', description: '', price_cents: 0, billing: 'monthly', active: true };

function ProductCard({ p, canEdit, onEdit, onToggle, onRemove, busy }) {
  return (
    <TgCard hover={false} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, opacity: p.active ? 1 : 0.65 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: WA_DARK,
            bgcolor: (t) => tint(t, 'success', 0.14),
            flexShrink: 0
          }}
        >
          <IconPackage size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap title={p.name}>
            {p.name}
          </Typography>
          <Typography sx={{ fontWeight: 700, color: WA_DARK, fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(p.price_cents)}
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {billingShort(p.billing)}
            </Typography>
          </Typography>
        </Box>
        {canEdit ? (
          <Tooltip title={p.active ? 'Ativo — disponível para novas assinaturas' : 'Inativo — não aparece para novas assinaturas'}>
            <Switch size="small" checked={p.active} onChange={(e) => onToggle(e.target.checked)} disabled={busy} />
          </Tooltip>
        ) : null}
      </Stack>
      {p.description ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
          {p.description}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 'auto', pt: 0.5 }}>
        <Chip size="small" label={billingLabel(p.billing)} sx={{ height: 22, fontWeight: 700, borderRadius: 1.5 }} />
        <Chip
          size="small"
          icon={<IconUsers size={13} />}
          label={`${p.subscribers} cliente${p.subscribers === 1 ? '' : 's'}`}
          variant="outlined"
          sx={{ height: 22, fontWeight: 600, borderRadius: 1.5 }}
        />
        <Box sx={{ flex: 1 }} />
        {canEdit ? (
          <>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={onEdit} disabled={busy}>
                <IconPencil size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title={p.subscribers ? 'Há clientes com este produto — desative em vez de excluir' : 'Excluir'}>
              <span>
                <IconButton size="small" onClick={onRemove} disabled={busy || p.subscribers > 0}>
                  <IconTrash size={16} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : null}
      </Stack>
    </TgCard>
  );
}

export default function WhatsAppProducts() {
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [items, setItems] = useState(null);
  const [dlg, setDlg] = useState(null); // {id?, ...campos}
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await get('/whatsapp/products');
      setItems(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar os produtos.'));
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!dlg.name.trim()) return toast.error('Dê um nome ao produto.');
    setBusy(true);
    try {
      const body = {
        name: dlg.name.trim(),
        description: dlg.description,
        price_cents: dlg.price_cents,
        billing: dlg.billing,
        active: dlg.active
      };
      if (dlg.id) await put(`/whatsapp/products/${dlg.id}`, body);
      else await post('/whatsapp/products', body);
      toast.success(dlg.id ? 'Produto salvo.' : 'Produto criado.');
      setDlg(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const toggle = async (p, active) => {
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, active } : x)));
    try {
      await put(`/whatsapp/products/${p.id}`, { active });
    } catch (e) {
      setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, active: !active } : x)));
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    }
  };

  const doRemove = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/products/${confirm.id}`);
      toast.success('Produto excluído.');
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível excluir.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <WaPageHeader
        icon={IconPackage}
        title="Produtos"
        subtitle="O que a sua empresa vende: produtos, serviços e planos, com preço e forma de cobrança."
        sx={{ mb: 2.5 }}
        action={
          // celular: o WaPageHeader põe isto numa linha própria (o botão cresce, o ícone não)
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Atualizar">
              <IconButton onClick={load}>
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            {canEdit ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setDlg({ ...empty })}
                sx={waPrimaryBtn}
              >
                Novo produto
              </Button>
            ) : null}
          </Stack>
        }
      />

      {!canEdit ? (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}>
          Só o dono ou um admin da organização altera o catálogo. Você pode usar os produtos nas assinaturas dos clientes.
        </Alert>
      ) : null}

      {items === null ? (
        <TgCardGridSkeleton count={6} height={150} />
      ) : items.length === 0 ? (
        <TgEmptyState
          icon={IconPackage}
          title="Nenhum produto ainda"
          description="Cadastre o que você vende — um plano mensal, um serviço avulso, um produto. Depois é só vincular aos clientes e cobrar pelo WhatsApp."
          action={
            canEdit ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setDlg({ ...empty })}
                sx={waPrimaryBtn}
              >
                Criar o primeiro produto
              </Button>
            ) : null
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }
          }}
        >
          {items.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              canEdit={canEdit}
              busy={busy}
              onEdit={() =>
                setDlg({
                  id: p.id,
                  name: p.name,
                  description: p.description || '',
                  price_cents: p.price_cents,
                  billing: p.billing,
                  active: p.active
                })
              }
              onToggle={(v) => toggle(p, v)}
              onRemove={() => setConfirm(p)}
            />
          ))}
        </Box>
      )}

      <TgModal
        open={Boolean(dlg)}
        onClose={() => !busy && setDlg(null)}
        title={dlg?.id ? 'Editar produto' : 'Novo produto'}
        subtitle="Produto, serviço ou plano. O valor é o preço de tabela; na assinatura dá para ajustar por cliente."
        maxWidth="xs"
        disableClose={busy}
        footer={
          <>
            <Button color="inherit" onClick={() => setDlg(null)} disabled={busy} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={save}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
              sx={waPrimaryBtn}
            >
              {dlg?.id ? 'Salvar' : 'Criar'}
            </Button>
          </>
        }
      >
        {dlg ? (
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="Nome"
              value={dlg.name}
              onChange={(e) => setDlg((d) => ({ ...d, name: e.target.value.slice(0, 120) }))}
              fullWidth
              autoFocus
              placeholder="Ex.: Plano Premium, Consultoria, Mensalidade"
            />
            <MoneyField
              label="Preço"
              valueCents={dlg.price_cents}
              onChange={(c) => setDlg((d) => ({ ...d, price_cents: c }))}
              helperText="Digite só números: 1990 vira R$ 19,90"
            />
            <TextField
              select
              size="small"
              label="Cobrança"
              value={dlg.billing}
              onChange={(e) => setDlg((d) => ({ ...d, billing: e.target.value }))}
              fullWidth
              helperText="Recorrente (mensal, trimestral, anual) gera vencimento; avulso cobra uma vez."
            >
              {BILLING_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Descrição (opcional)"
              value={dlg.description}
              onChange={(e) => setDlg((d) => ({ ...d, description: e.target.value.slice(0, 500) }))}
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch size="small" checked={dlg.active} onChange={(e) => setDlg((d) => ({ ...d, active: e.target.checked }))} />
              <Typography variant="body2">
                {dlg.active ? 'Ativo — disponível para novas assinaturas' : 'Inativo — fica escondido nas novas assinaturas'}
              </Typography>
            </Stack>
          </Stack>
        ) : null}
      </TgModal>

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={doRemove}
        loading={busy}
        danger
        title="Excluir este produto?"
        message={`"${confirm?.name}" sai do catálogo. Assinaturas antigas mantêm o nome.`}
        confirmLabel="Excluir"
      />
    </Box>
  );
}
